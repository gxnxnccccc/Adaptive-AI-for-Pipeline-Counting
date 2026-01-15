"""
Simple test script - just run this to see results quickly
"""
import cv2
import numpy as np


def auto_detect_pipes(image_path):
    img = cv2.imread(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Enhance circles
    gray = cv2.medianBlur(gray, 5)

    # Detect circles (pipe ends)
    circles = cv2.HoughCircles(
        gray,
        cv2.HOUGH_GRADIENT,
        dp=1,
        minDist=20,
        param1=50,
        param2=30,
        minRadius=10,
        maxRadius=50
    )

    # Convert to YOLO format bounding boxes
    labels = []
    if circles is not None:
        circles = np.uint16(np.around(circles))
        for circle in circles[0, :]:
            x, y, r = circle
            # Convert circle to bounding box
            bbox = [x - r, y - r, x + r, y + r]
            labels.append(bbox)

    return circles, labels, img


# Run the test
image_path = "est_pic/DO25110210_4_nikhon.jpg"  # CHANGE THIS to your image path

print("Testing pipe detection...")
circles, labels, img = auto_detect_pipes(image_path)

if circles is not None:
    print(f"✓ SUCCESS! Detected {len(labels)} pipes")

    # Draw results
    output = img.copy()
    circles = np.uint16(np.around(circles))

    for i, circle in enumerate(circles[0, :]):
        x, y, r = circle
        # Draw green circle
        cv2.circle(output, (x, y), r, (0, 255, 0), 2)
        # Draw red center
        cv2.circle(output, (x, y), 2, (0, 0, 255), 3)
        # Draw blue bounding box
        cv2.rectangle(output, (x - r, y - r), (x + r, y + r), (255, 0, 0), 2)
        # Add number
        cv2.putText(output, str(i + 1), (x - 10, y - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 2)

    # Add total count
    cv2.putText(output, f"Total: {len(labels)} pipes", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)

    # Save result
    cv2.imwrite('detected_pipes.jpg', output)
    print("Saved visualization as 'detected_pipes.jpg'")

    # Print first 5 detections
    print("\nFirst 5 detected bounding boxes (x1, y1, x2, y2):")
    for i, bbox in enumerate(labels[:5]):
        print(f"  Pipe {i + 1}: {bbox}")

else:
    print("✗ FAILED: No pipes detected")
    print("\nTry adjusting these parameters:")
    print("  - Increase maxRadius if pipes are large")
    print("  - Decrease param2 (e.g., 30 → 20) to detect more")
    print("  - Decrease minDist if pipes are close together")