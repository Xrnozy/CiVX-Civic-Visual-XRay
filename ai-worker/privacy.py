"""Privacy blurring for public map thumbnails."""

import cv2
import numpy as np


def blur_faces_and_plates(image_path: str, output_path: str) -> str:
    img = cv2.imread(image_path)
    if img is None:
        return image_path
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    faces = face_cascade.detectMultiScale(gray, 1.1, 4)
    for (x, y, w, h) in faces:
        roi = img[y : y + h, x : x + w]
        img[y : y + h, x : x + w] = cv2.GaussianBlur(roi, (51, 51), 30)
    cv2.imwrite(output_path, img)
    return output_path
