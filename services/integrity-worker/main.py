import base64
import hmac
import os
from typing import List

import cv2
import mediapipe as mp
import numpy as np
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="KeepMe Integrity Worker", docs_url=None, redoc_url=None)
face_mesh = mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=True, min_detection_confidence=0.6)
segmenter = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=0)


class Zone(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    width: float = Field(gt=0, le=1)
    height: float = Field(gt=0, le=1)


class AnalyzeRequest(BaseModel):
    source: str
    result: str
    customZones: List[Zone] = Field(default_factory=list)


def authorize(authorization: str | None = Header(default=None)):
    expected = os.environ.get("INTEGRITY_WORKER_TOKEN")
    supplied = authorization.removeprefix("Bearer ") if authorization else ""
    if not expected or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


def decode(value: str):
    try:
        raw = base64.b64decode(value, validate=True)
        if len(raw) > 12 * 1024 * 1024:
            raise ValueError("too large")
        image = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
        if image is None or image.shape[0] * image.shape[1] > 24_000_000:
            raise ValueError("invalid image")
        return image
    except Exception as error:
        raise HTTPException(status_code=400, detail="Invalid image") from error


def landmarks(image):
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    result = face_mesh.process(rgb)
    if not result.multi_face_landmarks:
        return None
    return np.array([[point.x, point.y] for point in result.multi_face_landmarks[0].landmark], dtype=np.float32)


def landmark_score(source, result):
    src = landmarks(source)
    dst = landmarks(result)
    if src is None or dst is None or len(src) != len(dst):
        return 0.0, 0.0, False
    transform, inliers = cv2.estimateAffinePartial2D(dst, src, method=cv2.RANSAC, ransacReprojThreshold=0.012)
    if transform is None:
        return 0.0, 0.0, False
    aligned = cv2.transform(dst[None, :, :], transform)[0]
    displacement = np.linalg.norm(src - aligned, axis=1)
    stability = float(np.clip(1.0 - np.median(displacement) / 0.035, 0, 1))
    confidence = float(np.mean(inliers)) if inliers is not None else 0.0
    return stability, confidence, confidence >= 0.72 and stability >= 0.45


def person_mask(image):
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    mask = segmenter.process(rgb).segmentation_mask
    return cv2.resize(mask, (256, 256), interpolation=cv2.INTER_AREA)


def silhouette_score(source, result):
    src = person_mask(source)
    dst = person_mask(result)
    yy, xx = np.mgrid[0:256, 0:256]
    x = (xx + 0.5) / 256
    y = (yy + 0.5) / 256
    garment = (y >= 0.34) & ((((x - 0.5) / 0.31) ** 2 + ((y - 0.64) / 0.31) ** 2) <= 1)
    outside = ~garment
    src_binary = src >= 0.5
    dst_binary = dst >= 0.5
    union = np.sum((src_binary | dst_binary) & outside)
    intersection = np.sum((src_binary & dst_binary) & outside)
    score = float(intersection / union) if union else 1.0
    confidence = float(np.clip((np.mean(np.abs(src - 0.5)) + np.mean(np.abs(dst - 0.5))) * 2, 0, 1))
    return score, confidence


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/v1/analyze", dependencies=[Depends(authorize)])
def analyze(body: AnalyzeRequest):
    source = decode(body.source)
    result = decode(body.result)
    face_stability, alignment_confidence, reliable = landmark_score(source, result)
    silhouette_stability, segmentation_confidence = silhouette_score(source, result)
    return {
        "alignmentReliable": reliable,
        "alignmentConfidence": round(alignment_confidence, 4),
        "faceLandmarkStability": round(face_stability, 4),
        "silhouetteStability": round(silhouette_stability, 4),
        "segmentationConfidence": round(segmentation_confidence, 4),
    }
