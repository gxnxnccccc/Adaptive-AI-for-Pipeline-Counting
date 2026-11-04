import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.repo import InMemoryRepo, get_repo


@pytest.fixture
def repo():
    """Every test gets a fresh in-memory DB; nothing talks to Supabase."""
    fake = InMemoryRepo()
    app.dependency_overrides[get_repo] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_repo, None)


@pytest.fixture
def client(repo):
    return TestClient(app)


def png_stack(n=4) -> bytes:
    """n x n light circles on a dark background."""
    img = np.full((300, 300, 3), 60, np.uint8)
    for i in range(n):
        for j in range(n):
            cv2.circle(img, (40 + i * 60, 40 + j * 60), 25, (200, 200, 200), -1)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return buf.tobytes()


def files(*items):
    return [("images", (name, data, ctype)) for name, data, ctype in items]
