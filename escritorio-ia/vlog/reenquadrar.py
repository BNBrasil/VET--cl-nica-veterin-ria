#!/usr/bin/env python3
"""Acha a posição horizontal do rosto num trecho de vídeo (para o recorte 9:16 "rosto").

Uso: python vlog/reenquadrar.py <video> <ini_s> <fim_s>
Imprime UMA linha JSON: {"x": 0.42, "metodo": "mediapipe", "amostras": 10, "rostos": 8}
ou {"x": null, "motivo": "..."}. x = centro do rosto em fração da largura (0 = esquerda, 1 = direita),
já com a rotação do celular aplicada pelo OpenCV.

Opcional: precisa de Python 3 + opencv-python; com mediapipe fica mais preciso.
    pip install mediapipe opencv-python
Sem mediapipe usa o detector Haar do próprio OpenCV. Só lê o vídeo: nunca altera o bruto.
"""
import json
import sys


def sair(**dados):
    print(json.dumps(dados, ensure_ascii=False))
    sys.exit(0)


MODELO_URL = ("https://storage.googleapis.com/mediapipe-models/face_detector/"
              "blaze_face_short_range/float16/latest/blaze_face_short_range.tflite")


def modelo_tasks():
    """Modelo do FaceDetector (API nova do MediaPipe), guardado em vlog/ferramentas/ (baixa 1 vez, ~230 KB)."""
    import os
    import urllib.request
    pasta = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ferramentas")
    arq = os.path.join(pasta, "blaze_face_short_range.tflite")
    if not os.path.exists(arq):
        os.makedirs(pasta, exist_ok=True)
        urllib.request.urlretrieve(MODELO_URL, arq + ".tmp")
        os.replace(arq + ".tmp", arq)
    return arq


def detector_mediapipe_tasks(mp):
    from mediapipe.tasks.python import vision
    from mediapipe.tasks.python.core import base_options
    opcoes = vision.FaceDetectorOptions(base_options=base_options.BaseOptions(model_asset_path=modelo_tasks()),
                                        min_detection_confidence=0.5)
    fd = vision.FaceDetector.create_from_options(opcoes)

    def detectar(img_bgr):
        import cv2
        h, w = img_bgr.shape[:2]
        img = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB))
        caixas = []
        for d in fd.detect(img).detections:
            b = d.bounding_box
            score = d.categories[0].score if d.categories else 0.5
            caixas.append(((b.origin_x + b.width / 2) / w, (b.width * b.height) / (w * h), score))
        return caixas

    return detectar


def detector_mediapipe():
    try:
        import mediapipe as mp
    except Exception:
        return None
    if not hasattr(mp, "solutions"):  # mediapipe novo: só a API "tasks"
        try:
            return detector_mediapipe_tasks(mp)
        except Exception:
            return None
    try:
        fd = mp.solutions.face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.5)
    except Exception:
        return None

    def detectar(img_bgr):
        import cv2
        r = fd.process(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB))
        caixas = []
        for d in (r.detections or []):
            b = d.location_data.relative_bounding_box
            caixas.append((b.xmin + b.width / 2, b.width * b.height, d.score[0] if d.score else 0.5))
        return caixas

    return detectar


def detector_haar():
    import cv2
    arq = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    cascata = cv2.CascadeClassifier(arq)
    if cascata.empty():
        return None

    def detectar(img_bgr):
        cinza = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        h, w = cinza.shape
        rostos = cascata.detectMultiScale(cinza, scaleFactor=1.15, minNeighbors=6, minSize=(max(24, w // 20), max(24, w // 20)))
        return [((x + fw / 2) / w, (fw * fh) / (w * h), 0.5) for (x, y, fw, fh) in rostos]

    return detectar


def main():
    if len(sys.argv) < 4:
        sair(x=None, motivo="uso: reenquadrar.py <video> <ini> <fim>")
    video, ini, fim = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
    try:
        import cv2
    except Exception:
        sair(x=None, motivo="OpenCV não instalado (pip install opencv-python mediapipe)")

    detectar, metodo = detector_mediapipe(), "mediapipe"
    if detectar is None:
        detectar, metodo = detector_haar(), "opencv-haar"
    if detectar is None:
        sair(x=None, motivo="nenhum detector de rosto disponível")

    cap = cv2.VideoCapture(video)
    if not cap.isOpened():
        sair(x=None, motivo="não consegui abrir o vídeo")
    n = 10
    xs = []
    for i in range(n):
        t = ini + (fim - ini) * (i + 0.5) / n
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ok, img = cap.read()
        if not ok:
            continue
        h, w = img.shape[:2]
        if w > 960:  # detecção em resolução menor: mais rápido e igual de bom
            img = cv2.resize(img, (960, int(h * 960 / w)))
        caixas = detectar(img)
        if caixas:
            # o maior rosto (mais perto da câmera) pesa mais
            x, _, _ = max(caixas, key=lambda c: c[1] * (0.5 + c[2]))
            xs.append(x)
    cap.release()
    if len(xs) < max(2, n // 4):
        sair(x=None, motivo=f"rosto encontrado em só {len(xs)} de {n} quadros", metodo=metodo)
    xs.sort()
    mediana = xs[len(xs) // 2]  # recorte fixo no trecho: sem "pulos" de câmera
    sair(x=round(mediana, 4), metodo=metodo, amostras=n, rostos=len(xs))


if __name__ == "__main__":
    main()
