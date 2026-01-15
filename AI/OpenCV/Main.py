import cv2
import numpy as np
import matplotlib.pyplot as plt
import math

# =========================================================
# CONFIG
# =========================================================
IMAGE_LIST = [
    "AI/test_pic/DO25110210_4_nikhon.jpg",
    "AI/test_pic/DO25110213_1_nikhon.jpg",
    "AI/test_pic/DO25110220_1_Pittawat.jpg",
    "AI/test_pic/DO25110257_3_Pittawat.jpg",
    "AI/test_pic/DO25110261_1_Pittawat.jpg",
    "AI/test_pic/DO25110277_2_Pittawat.jpg",
    "AI/test_pic/DO25110284_2_Pittawat.jpg",
    "AI/test_pic/Front_pipe.webp",
    "AI/test_pic/Metal_Pipe.jpg"
]

RADIUS_SCALES = [
    {"name": "small",  "min": 4,  "max": 15, "param2": 28, "color": (0, 0, 255)},
    {"name": "medium", "min": 16, "max": 35, "param2": 40, "color": (0, 255, 0)},
    {"name": "large",  "min": 36, "max": 90, "param2": 55, "color": (255, 0, 0)}
]

# =========================================================
# SETUP GRID
# =========================================================
num_images = len(IMAGE_LIST)
cols = 3
rows = math.ceil(num_images / cols)

fig, axes = plt.subplots(rows, cols, figsize=(6 * cols, 5 * rows))
axes = axes.flatten()

# =========================================================
# PROCESS EACH IMAGE
# =========================================================
for idx, img_path in enumerate(IMAGE_LIST):
    img = cv2.imread(img_path)
    ax = axes[idx]

    if img is None:
        ax.set_title("Image load failed")
        ax.axis("off")
        continue

    # -----------------------------
    # ROI
    # -----------------------------
    h, w = img.shape[:2]
    roi = img[int(0.20*h):int(0.90*h), int(0.05*w):int(0.95*w)]
    offset_x, offset_y = int(0.05*w), int(0.20*h)

    # -----------------------------
    # Preprocessing
    # -----------------------------
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(2.0, (8, 8))
    gray_eq = clahe.apply(gray)
    gray_blur = cv2.bilateralFilter(gray_eq, 9, 75, 75)
    avg_brightness = np.mean(gray_eq)

    # -----------------------------
    # Multi-scale detection
    # -----------------------------
    detections = []

    for scale in RADIUS_SCALES:
        circles = cv2.HoughCircles(
            gray_blur,
            cv2.HOUGH_GRADIENT,
            dp=1.2,
            minDist=scale["min"] * 2,
            param1=100,
            param2=scale["param2"],
            minRadius=scale["min"],
            maxRadius=scale["max"]
        )

        if circles is None:
            continue

        circles = np.round(circles[0]).astype("int")

        for x, y, r in circles:
            mask = np.zeros(gray.shape, np.uint8)
            cv2.circle(mask, (x, y), int(0.7*r), 255, -1)
            mean_inside = cv2.mean(gray_eq, mask=mask)[0]

            if scale["name"] == "small" and mean_inside > avg_brightness * 1.6:
                continue
            if scale["name"] == "medium" and mean_inside > avg_brightness * 1.35:
                continue
            if scale["name"] == "large" and mean_inside > avg_brightness * 1.2:
                continue

            detections.append((x, y, r, scale["name"]))

    # -----------------------------
    # Deduplication
    # -----------------------------
    final = []

    for x, y, r, scale in detections:
        keep = True
        for fx, fy, fr, fscale in final:
            if scale != fscale:
                continue
            if np.hypot(x - fx, y - fy) < 0.4 * fr and abs(r - fr) < 0.3 * fr:
                keep = False
                break
        if keep:
            final.append((x, y, r, scale))

    # -----------------------------
    # Draw results
    # -----------------------------
    output = img.copy()
    counts = {"small": 0, "medium": 0, "large": 0}

    for x, y, r, scale in final:
        color = next(s["color"] for s in RADIUS_SCALES if s["name"] == scale)
        cv2.circle(output, (x + offset_x, y + offset_y), r, color, 2)
        cv2.circle(output, (x + offset_x, y + offset_y), 2, color, -1)
        counts[scale] += 1

    ax.imshow(cv2.cvtColor(output, cv2.COLOR_BGR2RGB))
    ax.set_title(
        f"{img_path.split('/')[-1]}\n"
        f"Total: {len(final)} | "
        f"S: {counts['small']} "
        f"M: {counts['medium']} "
        f"L: {counts['large']}"
    )
    ax.axis("off")

# Hide unused axes
for i in range(idx + 1, len(axes)):
    axes[i].axis("off")

plt.tight_layout()
plt.show()
