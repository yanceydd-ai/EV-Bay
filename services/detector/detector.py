import os
import time
from collections import defaultdict
from dataclasses import dataclass

import cv2
import requests
from ultralytics import YOLO


@dataclass
class BayRegion:
    id: int
    x1: float
    y1: float
    x2: float
    y2: float


def load_regions() -> list[BayRegion]:
    raw = os.getenv(
        "BAY_REGIONS",
        "1:0.02,0.10,0.24,0.92;2:0.26,0.10,0.48,0.92;3:0.52,0.10,0.74,0.92;4:0.76,0.10,0.98,0.92",
    )
    regions: list[BayRegion] = []
    for item in raw.split(";"):
        bay_id, coords = item.split(":")
        x1, y1, x2, y2 = [float(value) for value in coords.split(",")]
        regions.append(BayRegion(int(bay_id), x1, y1, x2, y2))
    return regions


def intersects(region: BayRegion, box: tuple[float, float, float, float], width: int, height: int) -> bool:
    rx1, ry1, rx2, ry2 = region.x1 * width, region.y1 * height, region.x2 * width, region.y2 * height
    bx1, by1, bx2, by2 = box
    ix1, iy1 = max(rx1, bx1), max(ry1, by1)
    ix2, iy2 = min(rx2, bx2), min(ry2, by2)
    if ix2 <= ix1 or iy2 <= iy1:
        return False

    intersection = (ix2 - ix1) * (iy2 - iy1)
    region_area = (rx2 - rx1) * (ry2 - ry1)
    return intersection / region_area > 0.08


def post_status(bays: list[dict]) -> None:
    api_base_url = os.getenv("API_BASE_URL", "http://localhost:3000")
    api_key = os.getenv("INTERNAL_API_KEY", "")
    response = requests.post(
        f"{api_base_url}/api/detector/status",
        json={"source": "rtsp-detector", "bays": bays},
        headers={"x-api-key": api_key},
        timeout=10,
    )
    response.raise_for_status()


def main() -> None:
    rtsp_url = os.environ["RTSP_URL"]
    interval = int(os.getenv("DETECTOR_INTERVAL_SECONDS", "10"))
    min_confidence = float(os.getenv("DETECTOR_MIN_CONFIDENCE", "0.55"))
    confirmation_seconds = int(os.getenv("DETECTOR_CONFIRMATION_SECONDS", "45"))
    required_observations = max(1, confirmation_seconds // max(1, interval))
    regions = load_regions()
    model = YOLO(os.getenv("YOLO_MODEL", "yolov8n.pt"))
    stable_status: dict[int, str] = defaultdict(lambda: "unknown")
    pending_status: dict[int, str] = {}
    pending_counts: dict[int, int] = defaultdict(int)

    capture = cv2.VideoCapture(rtsp_url)
    while True:
        ok, frame = capture.read()
        if not ok:
            capture.release()
            time.sleep(5)
            capture = cv2.VideoCapture(rtsp_url)
            continue

        height, width = frame.shape[:2]
        results = model(frame, verbose=False)[0]
        vehicle_boxes: list[tuple[float, float, float, float, float]] = []

        for box in results.boxes:
            cls = int(box.cls[0])
            label = model.names.get(cls, "")
            confidence = float(box.conf[0])
            if label in {"car", "truck", "bus"} and confidence >= min_confidence:
                x1, y1, x2, y2 = [float(value) for value in box.xyxy[0]]
                vehicle_boxes.append((x1, y1, x2, y2, confidence))

        observed = []
        for region in regions:
            matches = [box for box in vehicle_boxes if intersects(region, box[:4], width, height)]
            status = "occupied" if matches else "open"
            confidence = max([box[4] for box in matches], default=0.8)

            if status == stable_status[region.id]:
                pending_counts[region.id] = 0
            elif pending_status.get(region.id) == status:
                pending_counts[region.id] += 1
            else:
                pending_status[region.id] = status
                pending_counts[region.id] = 1

            if pending_counts[region.id] >= required_observations:
                stable_status[region.id] = status
                pending_counts[region.id] = 0

            observed.append(
                {
                    "id": region.id,
                    "status": stable_status[region.id],
                    "confidence": round(confidence, 3),
                }
            )

        try:
            post_status(observed)
            print(f"posted bay status: {observed}", flush=True)
        except requests.RequestException as exc:
            print(f"failed to post bay status: {exc}", flush=True)

        time.sleep(interval)


if __name__ == "__main__":
    main()

