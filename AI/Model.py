from ultralytics import YOLO

model = YOLO("yolov8n.pt")

model.train(
    data="data.yaml",
    imgsz=640,
    epochs=20,
    batch=8
)

