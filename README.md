# Flying Submarine – AI Intern Evaluation (Part 3)

## Webcam Interaction Prototype (p5.js)

This repository contains **Part 3** of the Flying Submarine evaluation task:

> **Create a basic interactive visual using a webcam.**  
> When a person stands in front of the webcam, their movement affects the environment (particles / distortion / color changes / hidden visuals revealed).

My prototype creates a **clean, modern “immersive room” effect**:

- **Motion detection** (webcam) drives **particle generation**
- Motion reveals a **hidden visual pattern** (concentric “brand rings”)
- A minimal UI panel controls sensitivity and key actions
- Optional: **sound layer** reacts to motion (motion → rhythm & pitch)
- Optional: **recording** captures the canvas (and sound, and mic if enabled)

---

## Features

- **Webcam motion detection**

  - Uses a background model (calibration + slow adaptation) to reduce noise
  - Outputs a stable **motion energy value** (0–100%)
  - Tracks the **motion centroid** (where movement is happening)

- **Visual response**

  - Motion spawns **glowing particles**
  - Motion strength reveals **a hidden pattern** around the centroid
  - Fullscreen “cover” video layout (responsive desktop + mobile)

- **Audio response (optional)**

  - Motion energy controls **tick rhythm**
  - Motion speed controls **pitch**
  - Strong motion adds a subtle **whoosh** layer

- **Recording (optional)**
  - Records the canvas into a `.webm` file (best supported on Android/Chrome)
  - Includes generated sound
  - Includes mic audio if **Mic ON** (permission required)

---

## Project Files

- `index.html` – UI layout + buttons + loads p5.js + sketch
- `sketch.js` – webcam capture, motion detection, visuals, audio, recording

---

## How to Run (Recommended)

Webcam access usually requires running a local server (not `file://`).

### Option A: Python Local Server

1. Open a terminal inside the project folder
2. Run:
   ```bash
   python -m http.server 8000
   ```
