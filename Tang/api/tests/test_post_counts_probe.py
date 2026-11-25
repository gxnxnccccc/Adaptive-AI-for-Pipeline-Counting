"""Hostile / edge probes for POST /api/counts (T5). No real Supabase, no .env."""
import io
import json
import re
from pathlib import Path

import pytest
from PIL import Image

from app import main
from tests.test_post_counts import env, files, png, saved_files  # noqa: F401 (env is a fixture)

CONTRACT = Path(__file__).resolve().parents[2] / "docs" / "api-contract.md"


def encode(fmt, size=(120, 90), **kw) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, (10, 120, 200)).save(buf, fmt, **kw)
    return buf.getvalue()


def all_disk(tmp_path):
    return [p for p in tmp_path.rglob("*")]


# ---- field name / formats -------------------------------------------------
def test_wrong_field_name_422(env):
    client, fake, tmp = env
    r = client.post("/api/counts", files=[("files", ("p.png", png(), "image/png"))])
    assert r.status_code == 422
    assert fake.calls == [] and saved_files(tmp) == []


def test_png_and_webp_accepted(env):
    client, fake, tmp = env
    r = client.post("/api/counts", files=[
        ("images", ("a.png", encode("PNG"), "image/png")),
        ("images", ("b.webp", encode("WEBP"), "image/webp")),
        ("images", ("c.jpg", encode("JPEG"), "image/jpeg")),
    ])
    assert r.status_code == 200, r.text
    assert len(r.json()["images"]) == 3
    exts = sorted(p.suffix for p in saved_files(tmp))
    assert exts == [".jpg", ".png", ".webp"]


def test_exif_rotated_jpeg(env):
    client, _, _ = env
    im = Image.new("RGB", (200, 100), (50, 50, 50))
    exif = Image.Exif()
    exif[0x0112] = 6  # rotate 90 CW -> displayed 100 x 200
    buf = io.BytesIO()
    im.save(buf, "JPEG", exif=exif)
    r = client.post("/api/counts", files=files(buf.getvalue(), name="r.jpg", ctype="image/jpeg"))
    assert r.status_code == 200, r.text
    img = r.json()["images"][0]
    # boxes must live inside the DISPLAYED (transposed) size 100 wide x 200 high
    for box in [img["crop_box"]] + [p["box"] for p in img["pipes"]]:
        x, y, w, h = box
        assert x >= 0 and y >= 0 and w > 0 and h > 0
        assert x + w <= 100 and y + h <= 200, box


# ---- bad input --------------------------------------------------------------
def test_zero_byte_file_415(env):
    client, fake, tmp = env
    r = client.post("/api/counts", files=files(b"", name="empty.jpg", ctype="image/jpeg"))
    assert r.status_code == 415
    assert fake.calls == [] and saved_files(tmp) == []


def test_text_renamed_jpg_415(env):
    client, fake, tmp = env
    r = client.post("/api/counts", files=files(b"just some text\n" * 50, name="fake.jpg", ctype="image/jpeg"))
    assert r.status_code == 415
    assert fake.calls == [] and saved_files(tmp) == []


def test_mixed_valid_invalid_nothing_saved(env):
    client, fake, tmp = env
    for order in ([png(), b"nope"], [b"nope", png()]):
        r = client.post("/api/counts", files=files(*order))
        assert r.status_code == 415
        assert fake.calls == []
        assert all_disk(tmp) == []  # not even an empty batch dir


# ---- filenames ----------------------------------------------------------------
ODD_NAMES = [
    "../../x.jpg",
    "..\\..\\evil.png",
    "/etc/passwd.jpg",
    "C:\\Windows\\win.jpg",
    "รูปท่อ เหล็ก ๑.jpg",
    "a\u202egpj.exe",
    "x" * 300 + ".jpg",
    "na me;'--\".webp",
    "noext",
]


@pytest.mark.parametrize("name", ODD_NAMES)
def test_odd_filenames_never_leak_or_escape(env, name):
    client, fake, tmp = env
    r = client.post("/api/counts", files=files(png(), name=name))
    assert r.status_code == 200, (name, r.text)
    assert name not in r.text and "x.jpg" not in r.text and "evil" not in r.text
    # every file stays under tmp/images/<batch>/<uuid>.<ext>
    for p in saved_files(tmp):
        rel = p.relative_to(tmp)
        assert rel.parts[0] == "images" and len(rel.parts) == 3
        assert re.fullmatch(r"[0-9a-f-]{36}\.(jpg|png|webp|bin)", rel.parts[2]), rel
    # nothing written beside tmp (traversal target)
    assert not (tmp.parent / "x.jpg").exists() and not (tmp.parent.parent / "x.jpg").exists()


def test_no_filename_or_internal_text_in_errors(env, monkeypatch):
    client, fake, tmp = env
    secret = "SECRET_NAME_123.jpg"
    # 415
    r = client.post("/api/counts", files=files(b"junk", name=secret))
    assert r.status_code == 415 and secret not in r.text and str(tmp) not in r.text
    # 413 oversize
    monkeypatch.setattr(main, "MAX_IMAGE_BYTES", 100)
    r = client.post("/api/counts", files=files(png() + b"\0" * 500, name=secret))
    assert r.status_code == 413 and secret not in r.text and str(tmp) not in r.text
    monkeypatch.undo()
    # 413 too many
    r = client.post("/api/counts", files=files(*[png()] * 11, name=secret))
    assert r.status_code == 413 and secret not in r.text and str(tmp) not in r.text
    # 500
    fake.fail_on = "batches"
    r = client.post("/api/counts", files=files(png(), name=secret))
    assert r.status_code == 500
    for leak in (secret, str(tmp), "boom", "RuntimeError", "Traceback", "images"):
        assert leak not in r.text, leak
    assert saved_files(tmp) == []  # cleaned up after failed insert


def test_detector_failure_is_not_leaked(env):
    client, fake, tmp = env

    class Boom:
        def detect(self, b):
            raise RuntimeError("detector secret path C:\\models\\x.pt")

    main.app.dependency_overrides[main.get_detector] = lambda: Boom()
    c = client.__class__(main.app, raise_server_exceptions=False)
    r = c.post("/api/counts", files=files(png()))
    assert r.status_code == 500
    assert "secret" not in r.text and "models" not in r.text
    assert fake.calls == [] and saved_files(tmp) == []


# ---- counts / limits ------------------------------------------------------------
def test_ten_ok_eleven_rejected(env):
    client, fake, tmp = env
    r = client.post("/api/counts", files=files(*[png()] * 10))
    assert r.status_code == 200 and len(r.json()["images"]) == 10
    fake.calls.clear()
    before = len(saved_files(tmp))
    r = client.post("/api/counts", files=files(*[png()] * 11))
    assert r.status_code == 413
    assert fake.calls == [] and len(saved_files(tmp)) == before


def test_same_image_twice(env):
    client, _, _ = env
    b = png()
    imgs = client.post("/api/counts", files=files(b, b)).json()["images"]
    assert imgs[0]["count"] == imgs[1]["count"]
    assert imgs[0]["pipes"] == imgs[1]["pipes"]
    assert imgs[0]["image_id"] != imgs[1]["image_id"]


def test_image_ids_match_saved_rows_and_files(env):
    client, fake, tmp = env
    blobs = [png(color=(i * 30, 5, 5)) for i in range(4)]
    body = client.post("/api/counts", files=files(*blobs)).json()
    rows = fake.calls[1][1]
    assert [r["id"] for r in rows] == [i["image_id"] for i in body["images"]]
    assert all(r["batch_id"] == body["batch_id"] for r in rows)
    assert fake.calls[0][1]["id"] == body["batch_id"]
    stems = sorted(p.stem for p in saved_files(tmp))
    assert stems == sorted(i["image_id"] for i in body["images"])
    for r, i in zip(rows, body["images"]):
        assert r["count"] == i["count"] and r["pipes"] == i["pipes"]


# ---- contract ---------------------------------------------------------------------
def _contract_json():
    text = CONTRACT.read_text(encoding="utf-8")
    start = text.index("## POST /api/counts (multipart")
    block = re.search(r"```json\n(.*?)```", text[start:], re.S).group(1)
    block = block.replace("[x, y, w, h]", "[0,0,0,0]")
    return json.loads(block)


def test_response_keys_equal_contract(env):
    client, _, _ = env
    body = client.post("/api/counts", files=files(png())).json()
    c = _contract_json()
    assert set(body) == set(c)
    ci, bi = c["images"][0], body["images"][0]
    assert set(bi) == set(ci)
    assert set(bi["pipes"][0]) == set(ci["pipes"][0])
    assert set(bi["quality"]) == set(ci["quality"])
    for k in ("batch_id",):
        assert isinstance(body[k], str)
    assert isinstance(bi["count"], int) and isinstance(bi["stored_bytes"], int)


# ---- CORS / health -----------------------------------------------------------------
def test_cors_preflight_allowed_origin(env):
    client, _, _ = env
    r = client.options("/api/counts", headers={
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    })
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "POST" in r.headers.get("access-control-allow-methods", "")


def test_cors_preflight_evil_origin_rejected(env):
    client, _, _ = env
    r = client.options("/api/counts", headers={
        "Origin": "http://evil.example",
        "Access-Control-Request-Method": "POST",
    })
    assert r.status_code == 400
    assert "access-control-allow-origin" not in r.headers


def test_cors_actual_post_evil_origin_no_allow_header(env):
    client, _, _ = env
    r = client.post("/api/counts", files=files(png()), headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in r.headers


def test_health_still_ok(env):
    client, _, _ = env
    r = client.get("/health")
    assert r.status_code == 200 and r.json() == {"status": "ok"}
