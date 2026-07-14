# EV Bay

EV Bay is an on-prem EV charging bay monitor. It watches a local RTSP camera feed, classifies four charging bays as open, occupied, or unknown, and notifies subscribed drivers when availability changes from full to one or more open bays.

## What is included

- Next.js dashboard and API
- PostgreSQL schema for bays, subscriptions, events, and notification logs
- Python/OpenCV/YOLO detector service for RTSP camera feeds
- Docker Compose deployment for a Linux server
- Optional Resend email and Twilio SMS delivery

## Architecture

```text
RTSP camera
  -> detector service
  -> Next.js API
  -> PostgreSQL
  -> notification delivery
  -> dashboard and subscription UI
```

Vercel is not required for this version. The app is designed to run on the Linux server that can reach the camera feed.

## Quick start

1. Copy the example environment file.

   ```bash
   cp .env.example .env
   ```

2. Edit `.env`.

   Required values:

   - `INTERNAL_API_KEY`
   - `RTSP_URL`
   - `DATABASE_URL`

   Optional values:

   - `RESEND_API_KEY` and `EMAIL_FROM` for email
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` for SMS

3. Start the stack.

   ```bash
   docker compose up --build
   ```

   The detector image installs CPU-only PyTorch wheels by default. This avoids downloading large NVIDIA/CUDA packages on servers without a supported GPU.

   If a previous detector build failed with `No space left on device`, free the partial Docker build cache before rebuilding:

   ```bash
   docker builder prune
   ```

4. Open the dashboard.

   ```text
   http://localhost:3000
   ```

## Camera calibration

The detector uses `BAY_REGIONS` to map each parking bay to a normalized rectangle in the camera frame:

```text
BAY_REGIONS=1:0.02,0.10,0.24,0.92;2:0.26,0.10,0.48,0.92;3:0.52,0.10,0.74,0.92;4:0.76,0.10,0.98,0.92
```

Each region is:

```text
bay_id:x1,y1,x2,y2
```

Coordinates are percentages of frame width and height. For example, `0.02,0.10,0.24,0.92` means left 2%, top 10%, right 24%, bottom 92%.

## Notification behavior

Notifications are state-change based. The app sends notifications only when the system moves from:

```text
0 open bays -> 1 or more open bays
```

This avoids sending a message every time a frame is processed. The detector also waits for a stable observation window using `DETECTOR_CONFIRMATION_SECONDS`.

If email or SMS credentials are missing, deliveries are logged to the web container logs instead of failing the workflow.

## API

### Get current status

```bash
curl http://localhost:3000/api/status
```

### Post detector status

```bash
curl -X POST http://localhost:3000/api/detector/status \
  -H "Content-Type: application/json" \
  -H "x-api-key: $INTERNAL_API_KEY" \
  -d '{
    "source": "manual-test",
    "bays": [
      { "id": 1, "status": "occupied", "confidence": 0.94 },
      { "id": 2, "status": "open", "confidence": 0.89 },
      { "id": 3, "status": "occupied", "confidence": 0.91 },
      { "id": 4, "status": "unknown", "confidence": 0.42 }
    ]
  }'
```

## Production notes

- Put the server and camera on the same trusted network.
- Use a long random `INTERNAL_API_KEY`.
- Put the dashboard behind HTTPS with Caddy, Nginx, Cloudflare Tunnel, or Tailscale.
- Start with email notifications, then add SMS after the detection logic is stable.
- Avoid storing video. Store short-lived debug snapshots only if you need calibration evidence.
- Use a UPS for the server and network gear if reliability matters.
