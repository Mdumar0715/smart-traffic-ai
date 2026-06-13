import cv2
import os
import threading
import time

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from detector import detect_vehicles


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_FOLDER = "uploads"

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)


lanes = ["lane1","lane2","lane3"]

video_paths = {lane: None for lane in lanes}
latest_frames = {lane: None for lane in lanes}


vehicle_stats = {
    lane: {
        "cars":       0,
        "bikes":      0,
        "buses":      0,
        "trucks":     0,
        "density":    0.0,   # float 0.0–1.0
        "green_time": 0
    }
    for lane in lanes
}


# -----------------------------
# DETECTION THREAD
# -----------------------------

def process_video(lane):

    print(f"{lane} detection thread started")

    path = video_paths[lane]
    cap  = cv2.VideoCapture(path)

    while True:

        success, frame = cap.read()

        # Restart video when it ends
        if not success:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue

        data = detect_vehicles(frame)

        vehicle_stats[lane]["cars"]   = data["cars"]
        vehicle_stats[lane]["bikes"]  = data["bikes"]
        vehicle_stats[lane]["buses"]  = data["buses"]
        vehicle_stats[lane]["trucks"] = data["trucks"]

        total = (
            data["cars"]   +
            data["bikes"]  +
            data["buses"]  +
            data["trucks"]
        )

        # density as float 0.0–1.0  (frontend DensityBar expects a number)
        vehicle_stats[lane]["density"] = round(min(1.0, total / 20.0), 3)

        vehicle_stats[lane]["green_time"] = int(
            4 +
            data["bikes"]  * 2 +
            data["cars"]   * 3 +
            data["buses"]  * 4 +
            data["trucks"] * 5
        )

        latest_frames[lane] = data["frame"]

        time.sleep(0.01)

    cap.release()


# -----------------------------
# HEALTH CHECK
# -----------------------------

@app.get("/health")
def health():
    return {"status": "ok", "lanes": lanes}


# -----------------------------
# VIDEO UPLOAD
# -----------------------------

@app.post("/upload-video/{lane}")
async def upload_video(lane: str, file: UploadFile = File(...)):

    if lane not in lanes:
        return {"error": "invalid lane"}

    try:
        # Sanitise filename — remove spaces
        safe_name = (file.filename or "video.mp4").replace(" ", "_")
        path = os.path.join(UPLOAD_FOLDER, f"{lane}_{safe_name}")

        contents = await file.read()
        if len(contents) == 0:
            return {"error": "uploaded file is empty"}

        with open(path, "wb") as buffer:
            buffer.write(contents)

        video_paths[lane] = path

        thread = threading.Thread(
            target=process_video,
            args=(lane,),
            daemon=True
        )
        thread.start()

        return {
            "message":    f"{lane} processing started",
            "file":       safe_name,
            "size_bytes": len(contents)
        }

    except Exception as e:
        print(f"Upload error for {lane}: {e}")
        return {"error": str(e)}


# -----------------------------
# VIDEO STREAM
# -----------------------------

def generate_frames(lane):

    while True:

        frame = latest_frames[lane]

        if frame is None:
            time.sleep(0.03)
            continue

        ret, buffer = cv2.imencode(".jpg", frame)
        if not ret:
            continue

        frame_bytes = buffer.tobytes()

        yield (
            b'--frame\r\n'
            b'Content-Type: image/jpeg\r\n\r\n' +
            frame_bytes +
            b'\r\n'
        )


@app.get("/video-stream/{lane}")
def video_stream(lane: str):

    if lane not in lanes:
        return {"error": "invalid lane"}

    return StreamingResponse(
        generate_frames(lane),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


# -----------------------------
# STATS API
# -----------------------------

@app.get("/stats/{lane}")
def get_stats(lane: str):

    if lane not in lanes:
        return {"error": "invalid lane"}

    return vehicle_stats[lane]