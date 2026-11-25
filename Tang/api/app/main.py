import io
from typing import Callable

from fastapi import Depends, FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from app import repo
from app.config import cors_origins
from app.detector import Detector, MockDetector

MAX_IMAGES = 10
MAX_IMAGE_BYTES = 15 * 1024 * 1024

app = FastAPI(title="SPDS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


def get_detector() -> Detector:
    """Swap point for the real model. Tests override this."""
    return MockDetector()


def get_saver() -> Callable[[list[repo.ImageToSave]], repo.SavedBatch]:
    """Swap point for persistence. Tests override this with a fake client."""
    return repo.save_batch


@app.get("/health")
def health():
    return {"status": "ok"}


def _check_image(data: bytes) -> bool:
    try:
        img = Image.open(io.BytesIO(data))
        img.load()  # Pillow decodes lazily; force a full decode
        return True
    except Exception:  # incl. DecompressionBombError, truncated files
        return False


@app.post("/api/counts")
def post_counts(
    images: list[UploadFile],
    detector: Detector = Depends(get_detector),
    save: Callable = Depends(get_saver),
):
    # Too many -> 413 (same family as oversize). Zero/missing field -> 422 from FastAPI.
    if not images:
        raise HTTPException(422, "ต้องแนบรูปอย่างน้อย 1 รูป")
    if len(images) > MAX_IMAGES:
        raise HTTPException(413, f"อัปโหลดได้ไม่เกิน {MAX_IMAGES} รูปต่อครั้ง")

    # Validate EVERYTHING before saving anything (repo.save_batch does not validate).
    blobs: list[bytes] = []
    for i, f in enumerate(images, start=1):
        data = f.file.read(MAX_IMAGE_BYTES + 1)
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(413, f"รูปที่ {i} ใหญ่เกิน {MAX_IMAGE_BYTES // (1024 * 1024)} MB")
        if not _check_image(data):
            raise HTTPException(415, f"ไฟล์ที่ {i} ไม่ใช่รูปภาพที่เปิดได้")
        blobs.append(data)

    to_save = []
    for i, (f, data) in enumerate(zip(images, blobs), start=1):
        try:
            det = detector.detect(data)
        except ValueError:
            raise HTTPException(415, f"ไฟล์ที่ {i} ไม่ใช่รูปภาพที่เปิดได้")
        # Placeholder, NOT a real measurement (OPEN-3: quality check not defined yet).
        quality = {"brightness": "ok", "blur": "ok"}
        to_save.append(repo.ImageToSave(f.filename or "", data, det, quality))

    try:
        saved = save(to_save)
    except Exception:
        # Details stay server-side; never return exception text or paths.
        raise HTTPException(500, "บันทึกผลไม่สำเร็จ ลองใหม่อีกครั้ง")

    return {
        "batch_id": saved.batch_id,
        "images": [
            {
                "image_id": image_id,
                "count": s.detection.count,
                "crop_box": list(s.detection.crop_box),
                "pipes": [{"box": list(p.box), "confidence": p.confidence} for p in s.detection.pipes],
                "quality": s.quality,
                "stored_bytes": len(s.data),  # no compression yet, matches repo
                "original_bytes": len(s.data),
            }
            for image_id, s in zip(saved.image_ids, to_save)
        ],
    }
