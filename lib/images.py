"""Shared PNG I/O for the parity and pixel-diff scripts (Pillow based).

Original integration code governed by the repository LICENSE. Replaces the two
hand-written PNG chunk/zlib/filter codecs formerly in app-parity-test/imgdiff.py
and web-verify-pixel/pixel_diff.py.

Public API
  load_rgba(path)            -> (width, height, bytearray RGBA, alpha preserved)
  save_rgba(path, w, h, rgba)
  load_rgb_rows(path)        -> (width, height, rows) with rows[y][x] = (r, g, b);
                                alpha is composited over white using floor
                                integer division: (c * a + 255 * (255 - a)) // 255
  save_rgb_rows(path, w, h, rows)

Input must be a PNG of at most MAX_PIXELS pixels. Truncated, corrupt or
non-PNG files raise ImageError. 16-bit greyscale keeps its high byte (v >> 8).
"""
import os
import tempfile

from PIL import Image

MAX_PIXELS = 80_000_000
_GRAY16 = {"I;16": 1, "I;16L": 1, "I;16B": 0}


class ImageError(ValueError):
    pass


def _check_size(width, height, what):
    for v in (width, height):
        if isinstance(v, bool) or not isinstance(v, int) or v < 1:
            raise ImageError("%s: width and height must be positive integers" % what)
    if width * height > MAX_PIXELS:
        raise ImageError("%s: %dx%d exceeds the %d pixel limit" % (what, width, height, MAX_PIXELS))


def _gray16_to_l(im):
    if im.mode == "I":
        im = im.convert("I;16")
    data = im.tobytes()
    return Image.frombytes("L", im.size, data[_GRAY16.get(im.mode, 1)::2])


def _open_png(path):
    path = os.fspath(path)
    try:
        with Image.open(path) as probe:
            if probe.format != "PNG":
                raise ImageError("%s is not a PNG" % path)
            _check_size(probe.width, probe.height, path)
            probe.verify()
        im = Image.open(path)
        im.load()
    except ImageError:
        raise
    except Image.DecompressionBombError as exc:
        raise ImageError("%s: %s" % (path, exc)) from exc
    except (OSError, SyntaxError, ValueError, EOFError) as exc:
        if isinstance(exc, FileNotFoundError) or isinstance(exc, PermissionError):
            raise
        raise ImageError("%s is not a readable PNG (corrupt or truncated): %s" % (path, exc)) from exc
    return im


def load_rgba(path):
    im = _open_png(path)
    try:
        if im.mode in _GRAY16 or im.mode == "I":
            im = _gray16_to_l(im)
        rgba = im.convert("RGBA")
        return rgba.width, rgba.height, bytearray(rgba.tobytes())
    finally:
        im.close()


def load_rgb_rows(path):
    width, height, rgba = load_rgba(path)
    rows = []
    for y in range(height):
        base = y * width * 4
        row = []
        for i in range(base, base + width * 4, 4):
            a = rgba[i + 3]
            if a == 255:
                row.append((rgba[i], rgba[i + 1], rgba[i + 2]))
            else:
                inv = 255 * (255 - a)
                row.append(((rgba[i] * a + inv) // 255, (rgba[i + 1] * a + inv) // 255,
                            (rgba[i + 2] * a + inv) // 255))
        rows.append(row)
    return width, height, rows


def _save(path, mode, width, height, data):
    path = os.fspath(path)
    parent = os.path.dirname(path) or "."
    os.makedirs(parent, exist_ok=True)
    im = Image.frombytes(mode, (width, height), bytes(data))
    fd, tmp = tempfile.mkstemp(prefix=".img-", suffix=".png", dir=parent)
    try:
        with os.fdopen(fd, "wb") as fh:
            im.save(fh, format="PNG")
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def save_rgba(path, width, height, rgba):
    _check_size(width, height, "save_rgba")
    if not isinstance(rgba, (bytes, bytearray, memoryview)):
        raise ImageError("save_rgba: rgba must be bytes-like")
    if len(rgba) != width * height * 4:
        raise ImageError("save_rgba: buffer has %d bytes, expected %d" % (len(rgba), width * height * 4))
    _save(path, "RGBA", width, height, rgba)


def save_rgb_rows(path, width, height, rows):
    _check_size(width, height, "save_rgb_rows")
    if len(rows) != height:
        raise ImageError("save_rgb_rows: got %d rows, expected %d" % (len(rows), height))
    buf = bytearray()
    for row in rows:
        if len(row) != width:
            raise ImageError("save_rgb_rows: row has %d pixels, expected %d" % (len(row), width))
        for px in row:
            if len(px) != 3:
                raise ImageError("save_rgb_rows: pixel must be an (r, g, b) triple")
            try:
                buf += bytes(px)
            except (ValueError, TypeError) as exc:
                raise ImageError("save_rgb_rows: channel values must be integers 0..255") from exc
    _save(path, "RGB", width, height, buf)
