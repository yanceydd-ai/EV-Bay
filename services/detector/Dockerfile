FROM python:3.12-slim

WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

COPY services/detector/requirements.txt .
RUN pip install --no-cache-dir \
    --index-url https://download.pytorch.org/whl/cpu \
    torch==2.5.1+cpu \
    torchvision==0.20.1+cpu \
  && pip install --no-cache-dir -r requirements.txt

COPY services/detector .
CMD ["python", "detector.py"]
