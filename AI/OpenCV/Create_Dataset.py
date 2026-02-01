import os
import cv2

# ==============================
# CONFIG
# ==============================
IMAGE_DIR = "dataset/images"
LABEL_DIR = "dataset/labels"

OUT_IMAGE_DIR = "dataset_titled/images"
OUT_LABEL_DIR = "dataset_titled/labels"

TILE_SIZE = 640        # 640 or 800 recommended
OVERLAP = 0.15         # 15% overlap helps edge objects
MIN_BOX_AREA = 0.0003  # drop tiny fragments

os.makedirs(OUT_IMAGE_DIR, exist_ok=True)
os.makedirs(OUT_LABEL_DIR, exist_ok=True)


# ==============================
# UTILITIES
# ==============================
def load_yolo_labels(label_path):
    boxes = []
    if not os.path.exists(label_path):
        return boxes

    with open(label_path, "r") as f:
        for line in f:
            cls, xc, yc, w, h = map(float, line.strip().split())
            boxes.append((int(cls), xc, yc, w, h))
    return boxes


def save_yolo_labels(path, boxes):
    with open(path, "w") as f:
        for cls, xc, yc, w, h in boxes:
            f.write(f"{cls} {xc:.6f} {yc:.6f} {w:.6f} {h:.6f}\n")


# ==============================
# MAIN TILING LOGIC
# ==============================
for img_name in os.listdir(IMAGE_DIR):
    if not img_name.lower().endswith((".jpg", ".png", ".jpeg")):
        continue

    img_path = os.path.join(IMAGE_DIR, img_name)
    label_path = os.path.join(LABEL_DIR, os.path.splitext(img_name)[0] + ".txt")

    image = cv2.imread(img_path)
    if image is None:
        continue

    H, W = image.shape[:2]
    boxes = load_yolo_labels(label_path)

    step = int(TILE_SIZE * (1 - OVERLAP))
    tile_id = 0

    for y0 in range(0, H - TILE_SIZE + 1, step):
        for x0 in range(0, W - TILE_SIZE + 1, step):
            tile = image[y0:y0 + TILE_SIZE, x0:x0 + TILE_SIZE]
            tile_boxes = []

            for cls, xc, yc, bw, bh in boxes:
                # Convert YOLO -> absolute
                abs_xc = xc * W
                abs_yc = yc * H
                abs_w = bw * W
                abs_h = bh * H

                x1 = abs_xc - abs_w / 2
                y1 = abs_yc - abs_h / 2
                x2 = abs_xc + abs_w / 2
                y2 = abs_yc + abs_h / 2

                # Intersection with tile
                ix1 = max(x1, x0)
                iy1 = max(y1, y0)
                ix2 = min(x2, x0 + TILE_SIZE)
                iy2 = min(y2, y0 + TILE_SIZE)

                iw = ix2 - ix1
                ih = iy2 - iy1

                if iw <= 0 or ih <= 0:
                    continue

                # Filter tiny fragments
                if (iw * ih) / (TILE_SIZE * TILE_SIZE) < MIN_BOX_AREA:
                    continue

                # Convert back to YOLO (tile-relative)
                new_xc = ((ix1 + ix2) / 2 - x0) / TILE_SIZE
                new_yc = ((iy1 + iy2) / 2 - y0) / TILE_SIZE
                new_w = iw / TILE_SIZE
                new_h = ih / TILE_SIZE

                tile_boxes.append((cls, new_xc, new_yc, new_w, new_h))

            if not tile_boxes:
                continue

            tile_name = f"{os.path.splitext(img_name)[0]}_tile_{tile_id}"
            cv2.imwrite(os.path.join(OUT_IMAGE_DIR, tile_name + ".jpg"), tile)
            save_yolo_labels(os.path.join(OUT_LABEL_DIR, tile_name + ".txt"), tile_boxes)

            tile_id += 1

print("✅ Tiling completed.")
