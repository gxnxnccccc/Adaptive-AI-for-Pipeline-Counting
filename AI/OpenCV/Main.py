import cv2
import numpy as np
import math
import json
import os
from typing import Tuple, List, Dict
from datetime import datetime

TEST_MODE = True
VISUALIZE = False  # KEEP FALSE for memory safety
MAX_WIDTH = 1600   # MAIN memory control knob

# =========================================================
# CONFIG
# =========================================================
IMAGE_DIR = "./Dataset/upload"
VALID_EXTS = (".jpg", ".jpeg", ".png", ".webp")

DATASET_DIR = "dataset"
IMG_DIR = f"{DATASET_DIR}/images"
LBL_DIR = f"{DATASET_DIR}/labels"
CLASSES_FILE = f"{DATASET_DIR}/classes.txt"

DEBUG_VIS_DIR = "debug_vis"  # optional

RADIUS_SCALES = [
    {"name": "small",  "min": 4,  "max": 15, "param2": 32, "color": (0, 0, 255)},
    {"name": "medium", "min": 16, "max": 35, "param2": 38, "color": (0, 255, 0)},
    {"name": "large",  "min": 36, "max": 90, "param2": 42, "color": (255, 0, 0)}
]

CONFIDENCE_THRESHOLDS = {
    'auto_accept': 0.75,
    'needs_review': 0.50,
    'max_reasonable_count': 450,
    'min_reasonable_count': 3
}

# =========================================================
# UTILS
# =========================================================
def load_images_from_folder(folder: str):
    return sorted([
        os.path.join(folder, f)
        for f in os.listdir(folder)
        if f.lower().endswith(VALID_EXTS)
    ])


def ensure_dataset_structure():
    os.makedirs(IMG_DIR, exist_ok=True)
    os.makedirs(LBL_DIR, exist_ok=True)
    os.makedirs(DEBUG_VIS_DIR, exist_ok=True)

    if not os.path.exists(CLASSES_FILE):
        with open(CLASSES_FILE, "w") as f:
            f.write("pipe\n")


# =========================================================
# PREPROCESSING
# =========================================================
def extract_roi(img: np.ndarray) -> Tuple[np.ndarray, Tuple[int, int]]:
    h, w = img.shape[:2]
    y1, y2 = int(0.15 * h), int(0.90 * h)
    x1, x2 = int(0.05 * w), int(0.95 * w)
    return img[y1:y2, x1:x2], (x1, y1)


def preprocess_image(roi):
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

    clahe = cv2.createCLAHE(2.2, (8, 8))
    gray_eq = clahe.apply(gray)

    gray_blur = cv2.GaussianBlur(gray_eq, (5, 5), 1.0)
    edges = cv2.Canny(gray_blur, 40, 120)
    edges = cv2.dilate(edges, np.ones((2, 2), np.uint8), 1)

    return gray_eq, gray_blur, edges, hsv, np.mean(gray_eq)


# =========================================================
# VALIDATION
# =========================================================
def compute_edge_circularity(edges, x, y, r):
    angles = np.linspace(0, 2 * np.pi, 36)
    return sum(
        edges[int(y + r*np.sin(a)), int(x + r*np.cos(a))] > 0
        for a in angles
        if 0 <= int(y + r*np.sin(a)) < edges.shape[0]
        and 0 <= int(x + r*np.cos(a)) < edges.shape[1]
    ) / len(angles)


def is_valid_pipe_circle(gray, edges, hsv, x, y, r, avg, scale):
    circularity = compute_edge_circularity(edges, x, y, r)
    if circularity < 0.22:
        return False, 0

    quality = circularity * 100
    return True, quality


# =========================================================
# DETECTION
# =========================================================
def detect_pipes(gray_blur, gray_eq, edges, hsv, avg, scales):
    detections = []

    # HARD memory guard
    if gray_blur.size > 2_000_000:
        return detections

    for scale in scales:
        circles = cv2.HoughCircles(
            gray_blur,
            cv2.HOUGH_GRADIENT,
            dp=1.15,
            minDist=int(scale["min"] * 1.7),
            param1=55,
            param2=scale["param2"],
            minRadius=scale["min"],
            maxRadius=scale["max"]
        )

        if circles is None:
            continue

        for x, y, r in np.round(circles[0]).astype(int):
            ok, q = is_valid_pipe_circle(gray_eq, edges, hsv, x, y, r, avg, scale["name"])
            if ok:
                detections.append((x, y, r, scale["name"], q))

    return detections


# =========================================================
# EXPORT
# =========================================================
def export_to_yolo(detections, path, offset, shape):
    H, W = shape[:2]
    with open(path, "w") as f:
        for x, y, r, *_ in detections:
            fx, fy = x + offset[0], y + offset[1]
            f.write(f"0 {fx/W:.6f} {fy/H:.6f} {(2*r)/W:.6f} {(2*r)/H:.6f}\n")


def export_log(img_path, detections, confidence, action):
    os.makedirs("detection_logs", exist_ok=True)
    name = os.path.splitext(os.path.basename(img_path))[0]
    with open(f"detection_logs/{name}.json", "w") as f:
        json.dump({
            "image": img_path,
            "count": len(detections),
            "confidence": confidence,
            "action": action
        }, f, indent=2)


# =========================================================
# MAIN IMAGE PROCESSOR
# =========================================================
def process_single_image(img_path, export_labels=True, export_logs=True):
    img = cv2.imread(img_path)
    if img is None:
        return

    # 🔥 MEMORY FIX #1
    h, w = img.shape[:2]
    if w > MAX_WIDTH:
        s = MAX_WIDTH / w
        img = cv2.resize(img, (int(w*s), int(h*s)), cv2.INTER_AREA)

    roi, offset = extract_roi(img)
    gray_eq, gray_blur, edges, hsv, avg = preprocess_image(roi)

    detections = detect_pipes(gray_blur, gray_eq, edges, hsv, avg, RADIUS_SCALES)

    confidence = min(1.0, len(detections) / 50)
    action = "AUTO_ACCEPT" if confidence > 0.75 else "NEEDS_REVIEW"

    if export_labels:
        ensure_dataset_structure()
        name = os.path.splitext(os.path.basename(img_path))[0]
        cv2.imwrite(f"{IMG_DIR}/{name}.jpg", img)
        export_to_yolo(detections, f"{LBL_DIR}/{name}.txt", offset, img.shape)

    if export_logs:
        export_log(img_path, detections, confidence, action)

    if VISUALIZE:
        vis = img.copy()
        for x, y, r, *_ in detections:
            cv2.circle(vis, (x+offset[0], y+offset[1]), r, (0,255,0), 2)
        cv2.imwrite(f"{DEBUG_VIS_DIR}/{os.path.basename(img_path)}", vis)

    # 🔥 MEMORY FIX #2
    del img, roi, gray_eq, gray_blur, edges, hsv


# =========================================================
# BATCH
# =========================================================
def process_image_batch():
    images = load_images_from_folder(IMAGE_DIR)
    print(f"Processing {len(images)} images...\n")

    for i, img in enumerate(images, 1):
        print(f"[{i}/{len(images)}] {os.path.basename(img)}")
        process_single_image(img)


# =========================================================
# ENTRY
# =========================================================
if __name__ == "__main__":
    print("="*70)
    print("PIPE DETECTION (MEMORY SAFE / HEADLESS)")
    print("="*70)
    process_image_batch()
    print("\n✓ Finished without visualization")