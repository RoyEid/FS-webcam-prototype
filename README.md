# FS Webcam Prototype (Part 3) — Webcam Interaction (p5.js)

A motion-driven webcam interaction prototype built with **p5.js**.  
Your movement in front of the camera generates particles, reveals a ring pattern, and can drive an audio layer.  
Includes optional recording (canvas + generated audio + optional microphone).

---

## Overview

This repository contains **Part 3** of the Flying Submarine evaluation task:

> Build a basic interactive visual using a webcam.  
> When a person stands in front of the webcam, their movement affects the environment (particles / distortion / color changes / hidden visuals revealed).

### What this prototype does

- **Motion detection** drives **glowing particle generation**
- Motion reveals a **hidden visual pattern** (concentric rings)
- A minimal UI controls **sensitivity** and key actions
- Optional **audio feedback** reacts to motion (rhythm + pitch)
- Optional **recording** captures the canvas + audio (and mic if enabled)

---

## Features

### Webcam Motion Detection
- Background model with **calibration** + **slow adaptation** (reduces noise/flicker)
- Stable **motion energy** output (0–100%)
- Tracks the **motion centroid** (where movement is happening)

### Visual Response
- Motion spawns **glow particles**
- Rings appear stronger as motion increases
- Fullscreen “cover” webcam layout (desktop + mobile responsive)

### Audio Response (Optional)
- Motion energy → **tick rhythm**
- Motion speed → **pitch**
- Strong motion adds subtle **whoosh** texture

### Recording (Optional)
- Records to **`.webm`** (best supported in Chrome / Android)
- Includes **generated sound**
- Includes **microphone** if enabled (permission required)

---

## Project Structure

- `index.html` — UI + loads p5.js + connects buttons to the sketch
- `sketch.js` — webcam capture, motion detection, visuals, audio, recording logic

---

## Run Locally

Webcam access requires a server (not `file://`).

### Option A — Python server
```bash
python -m http.server 8000
