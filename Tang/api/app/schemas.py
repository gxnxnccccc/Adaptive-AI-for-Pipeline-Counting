from pydantic import BaseModel

# OPEN with ML team (docs/api-contract.md): box format. Assumed [x, y, w, h] in
# pixels of the uploaded image. Only app/detector.py knows this.
Box = tuple[int, int, int, int]


class Pipe(BaseModel):
    box: Box
    confidence: float


class Detection(BaseModel):
    count: int
    crop_box: Box
    pipes: list[Pipe]
