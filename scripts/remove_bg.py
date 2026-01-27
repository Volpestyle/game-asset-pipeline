from __future__ import annotations

import argparse
import io
import json
import logging
import os
from pathlib import Path
import sys
import time

from PIL import Image
import numpy as np


SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg"}
LOG_NAME = "background_removal"
logger = logging.getLogger(LOG_NAME)


def _detect_bg_color(img: Image.Image, sample_size: int = 5) -> tuple[int, int, int] | None:
    """Detect background color by sampling corners of the image."""
    pixels = []
    w, h = img.size
    if w <= 0 or h <= 0:
        logger.error("Cannot detect background color for empty image.")
        return None
    sample_size = min(sample_size, w, h)
    if sample_size <= 0:
        return None
    # Sample from corners
    for x in range(sample_size):
        for y in range(sample_size):
            pixels.append(img.getpixel((x, y))[:3])  # top-left
            pixels.append(img.getpixel((w - 1 - x, y))[:3])  # top-right
            pixels.append(img.getpixel((x, h - 1 - y))[:3])  # bottom-left
            pixels.append(img.getpixel((w - 1 - x, h - 1 - y))[:3])  # bottom-right

    # Find most common color
    from collections import Counter
    color_counts = Counter(pixels)
    most_common = color_counts.most_common(1)
    if most_common:
        return most_common[0][0]
    return None


def _remove_bg_color(img: Image.Image, bg_color: tuple[int, int, int], tolerance: int) -> Image.Image:
    """Remove pixels that closely match the detected background color."""
    img = img.convert("RGBA")
    data = np.array(img)
    rgb = data[:, :, :3].astype(np.int16)
    bg = np.array(bg_color, dtype=np.int16)
    tolerance = max(0, tolerance)
    matches_bg = np.all(np.abs(rgb - bg) <= tolerance, axis=2)
    match_count = int(np.sum(matches_bg))
    logger.info("Post-process: bg match pixels=%s bg=%s tolerance=%s", match_count, bg_color, tolerance)
    if match_count == 0:
        return img
    data[matches_bg, 3] = 0
    return Image.fromarray(data)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Remove background from images.")
    parser.add_argument("--input", required=True, help="Input file or directory.")
    parser.add_argument("--output", required=True, help="Output file or directory.")
    parser.add_argument(
        "--model",
        default="u2net",
        help="rembg model name (default: u2net).",
    )
    parser.add_argument(
        "--alpha-matting",
        action="store_true",
        default=False,
        help="Enable alpha matting for cleaner edges (default: False).",
    )
    parser.add_argument(
        "--alpha-matting-foreground-threshold",
        type=int,
        default=240,
        help="Alpha matting foreground threshold (default: 240).",
    )
    parser.add_argument(
        "--alpha-matting-background-threshold",
        type=int,
        default=10,
        help="Alpha matting background threshold (default: 10).",
    )
    post_process_group = parser.add_mutually_exclusive_group()
    post_process_group.add_argument(
        "--post-process",
        action="store_true",
        default=True,
        dest="post_process",
        help="Enable post-process to remove residual background color (default: True).",
    )
    post_process_group.add_argument(
        "--no-post-process",
        action="store_false",
        dest="post_process",
        help="Disable post-process for residual background color.",
    )
    parser.add_argument(
        "--color-tolerance",
        type=int,
        default=5,
        help="Tolerance for background color matching (default: 5).",
    )
    parser.add_argument(
        "--log-level",
        default=os.getenv("BG_REMOVE_LOG_LEVEL", "INFO"),
        help="Logging level (default: INFO, env: BG_REMOVE_LOG_LEVEL).",
    )
    return parser.parse_args()


def _load_session(model_name: str | None):
    if not model_name:
        return None
    from rembg import new_session

    return new_session(model_name)


def _remove_bytes(data: bytes, session, alpha_matting: bool = True, fg_threshold: int = 240, bg_threshold: int = 10):
    from rembg import remove

    kwargs = {
        "alpha_matting": alpha_matting,
        "alpha_matting_foreground_threshold": fg_threshold,
        "alpha_matting_background_threshold": bg_threshold,
    }
    if session is not None:
        kwargs["session"] = session
    return remove(data, **kwargs)


def _process_file(
    input_path: Path,
    output_path: Path,
    session,
    alpha_matting: bool,
    fg_threshold: int,
    bg_threshold: int,
    post_process: bool,
    color_tolerance: int,
) -> None:
    logger.info("Processing image: %s -> %s", input_path, output_path)
    try:
        data = input_path.read_bytes()
    except Exception:
        logger.exception("Failed to read input image: %s", input_path)
        raise

    # Detect background color from original image before removal
    bg_color = None
    if post_process:
        try:
            original = Image.open(io.BytesIO(data)).convert("RGBA")
            bg_color = _detect_bg_color(original)
            logger.debug("Detected BG color=%s", bg_color)
        except Exception:
            logger.exception("Failed to detect background color for %s", input_path)
            raise
        if bg_color is None:
            logger.warning(
                "Post-process enabled but background color detection failed for %s; skipping post-process",
                input_path,
            )

    # Run rembg
    try:
        output = _remove_bytes(data, session, alpha_matting, fg_threshold, bg_threshold)
    except Exception:
        logger.exception("rembg failed for %s", input_path)
        raise

    # Post-process to remove residual background color
    if post_process and bg_color is not None:
        try:
            result_img = Image.open(io.BytesIO(output)).convert("RGBA")
            before_transparent = np.sum(np.array(result_img)[:, :, 3] == 0)
            result_img = _remove_bg_color(
                result_img,
                bg_color,
                color_tolerance,
            )
            after_transparent = np.sum(np.array(result_img)[:, :, 3] == 0)
            logger.info(
                "Post-process: transparent pixels %s -> %s (removed %s)",
                int(before_transparent),
                int(after_transparent),
                int(after_transparent - before_transparent),
            )
            buf = io.BytesIO()
            result_img.save(buf, format="PNG")
            output = buf.getvalue()
        except Exception:
            logger.exception("Post-process failed for %s", input_path)
            raise

    output_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        output_path.write_bytes(output)
    except Exception:
        logger.exception("Failed to write output image: %s", output_path)
        raise


def _iter_inputs(input_path: Path) -> list[Path]:
    if input_path.is_dir():
        files = [
            item
            for item in sorted(input_path.iterdir())
            if item.is_file() and item.suffix.lower() in SUPPORTED_EXTENSIONS
        ]
        return files
    if input_path.suffix.lower() in SUPPORTED_EXTENSIONS:
        return [input_path]
    return []


def _resolve_log_level(value: str | None) -> int:
    if not value:
        return logging.INFO
    normalized = value.strip().upper()
    resolved = getattr(logging, normalized, None)
    if isinstance(resolved, int):
        return resolved
    return logging.INFO


def _configure_logging(level_name: str | None) -> None:
    logging.basicConfig(
        level=_resolve_log_level(level_name),
        format="%(asctime)s [%(levelname)s] %(message)s",
    )


def main() -> int:
    args = _parse_args()
    _configure_logging(args.log_level)
    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        logger.error("Input not found: %s", input_path)
        return 2

    start = time.time()
    session = _load_session(args.model.strip())
    inputs = _iter_inputs(input_path)
    if not inputs:
        logger.error("No supported images found in %s", input_path)
        return 3

    alpha_matting = args.alpha_matting
    fg_threshold = args.alpha_matting_foreground_threshold
    bg_threshold = args.alpha_matting_background_threshold
    post_process = args.post_process
    color_tolerance = args.color_tolerance
    if input_path.is_dir():
        output_path.mkdir(parents=True, exist_ok=True)
        for item in inputs:
            _process_file(
                item,
                output_path / item.name,
                session,
                alpha_matting,
                fg_threshold,
                bg_threshold,
                post_process,
                color_tolerance,
            )
    else:
        _process_file(
            input_path,
            output_path,
            session,
            alpha_matting,
            fg_threshold,
            bg_threshold,
            post_process,
            color_tolerance,
        )

    duration_ms = int((time.time() - start) * 1000)
    logger.info("Background removal finished: processed=%s durationMs=%s", len(inputs), duration_ms)
    print(json.dumps({"processed": len(inputs), "durationMs": duration_ms}))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # pragma: no cover - unexpected errors
        logger.exception("Background removal failed: %s", exc)
        sys.exit(1)
