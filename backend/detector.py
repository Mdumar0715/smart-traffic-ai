import cv2
import math
from ultralytics import YOLO

model = YOLO("models/yolov8m.pt")

line_x = 400
line_y = 0
line_angle = 15
LINE_LENGTH = 900


def get_line_points():

    rad = math.radians(line_angle)

    x1,y1 = int(line_x),int(line_y)

    x2 = int(x1 - LINE_LENGTH * math.sin(rad))
    y2 = int(y1 + LINE_LENGTH * math.cos(rad))

    return (x1,y1),(x2,y2)


def above_line(x,y):

    p1,p2 = get_line_points()

    return (p2[0]-p1[0])*(y-p1[1]) - (p2[1]-p1[1])*(x-p1[0]) > 0


def detect_vehicles(frame):

    results = model(frame,imgsz=1280,conf=0.18)[0]

    cars = 0
    bikes = 0
    buses = 0
    trucks = 0

    for box in results.boxes:

        cls = int(box.cls[0])
        name = model.names[cls]

        x1,y1,x2,y2 = map(int,box.xyxy[0])

        width = x2-x1
        height = y2-y1

        if width < 20 or height < 20:
            continue

        cx,cy = (x1+x2)//2,(y1+y2)//2

        if not above_line(cx,cy):
            continue

        if name == "car":
            cars += 1
            color=(0,255,255)

        elif name == "motorcycle":
            bikes += 1
            color=(255,0,0)

        elif name == "bus":
            buses += 1
            color=(0,165,255)

        elif name == "truck":
            trucks += 1
            color=(0,0,255)

        else:
            continue

        cv2.rectangle(frame,(x1,y1),(x2,y2),color,2)
        cv2.putText(frame,name,(x1,y1-8),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,color,2)

    return {
        "cars":cars,
        "bikes":bikes,
        "buses":buses,
        "trucks":trucks,
        "frame":frame
    }