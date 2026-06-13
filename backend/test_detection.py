import cv2
from detector import detect_vehicles

cap = cv2.VideoCapture("demo.mp4")

while True:

    ret,frame = cap.read()

    if not ret:
        break

    data = detect_vehicles(frame)

    cv2.imshow("Traffic Detection",data["frame"])

    if cv2.waitKey(1)==27:
        break

cap.release()
cv2.destroyAllWindows()