# 🎥 FS Webcam Prototype (Part 3) — Webcam Interaction (p5.js)

A motion-driven webcam interaction prototype built with **p5.js**.  
Move in front of the camera to generate particles, reveal a ring pattern, and drive an optional audio layer.  
Includes optional recording (**canvas + generated audio + optional microphone**).

---

## 🚀 Live Demo

👉 **Open the demo:** **https://royeid.github.io/FS-webcam-prototype/**  
✅ Click here: **[Launch Live Demo](https://royeid.github.io/FS-webcam-prototype/)**

> 📱 **Mobile note:** Allow **Camera** permission when prompted.  
> 🔊 Tap once anywhere to **unlock audio** (browser requirement).

---

## 🧭 Overview

This repository contains **Part 3** of the **Flying Submarine evaluation task**:

> Build a basic interactive visual using a webcam.  
> When a person stands in front of the webcam, their movement affects the environment  
> (particles / distortion / color changes / hidden visuals revealed).

### ✨ What this prototype does
- 🫧 **Motion detection** drives **glowing particle generation**
- 🌀 Motion reveals a **hidden visual pattern** (concentric rings)
- 🎛️ Minimal UI controls **sensitivity** and key actions
- 🎵 Optional **audio feedback** reacts to motion (rhythm + pitch)
- ⏺️ Optional **recording** captures the canvas + audio (and mic if enabled)

---

## ✅ Features

### 📷 Webcam motion detection
- Background model with **calibration** + **slow adaptation** (reduces noise/flicker)
- Stable **motion energy** output (0–100%)
- Tracks the **motion centroid** (where movement is happening)

### 🎨 Visual response
- Motion spawns **glow particles**
- Rings intensify as motion increases
- Fullscreen “cover” webcam layout (**desktop + mobile responsive**)

### 🔊 Audio response (optional)
- Motion energy → **tick rhythm**
- Motion speed → **pitch**
- Strong motion adds subtle **whoosh** texture

### ⏺️ Recording (optional)
- Records to **`.webm`** (best supported in **Chrome / Android**)
- Includes **generated audio**
- Includes **microphone** if enabled (permission required)

---

## 🎮 Controls

### 🧩 UI Buttons
- **Calibrate (C)** — capture the background model (best when the scene is still)
- **Start/Stop Recording (P)** — records canvas + audio
- **Toggle Video (V)** — show/hide webcam feed
- **Reset Particles (R)** — clears current particles
- **Sound ON/OFF (S)** — toggles generated audio
- **Mic ON/OFF (M)** — toggles microphone input in recording

### ⌨️ Keyboard shortcuts
`H` help • `V` video • `R` reset • `C` calibrate • `P` record • `S` sound • `M` mic

---

## 🗂️ Project Structure

- `index.html` — UI + loads p5.js + connects buttons to the sketch
- `sketch.js` — webcam capture, motion detection, visuals, audio, recording logic

---

## 💻 Run Locally

Webcam access requires a server (**not** `file://`).

### Option A — Python server
```bash
python -m http.server 8000
