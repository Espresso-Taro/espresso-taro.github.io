<!-- README.en.md -->

# IME-aware Kanji Typing Game
### Practical Japanese typing practice for office work

Live: https://espresso-taro.github.io/Otonano-typing-game/

> Japanese version: [README.md](./README.md)

---

## Screenshot
![App screenshot](docs/Screenshot_20251221-161633~2.png)

---

## What is this?

This is a **Japanese typing practice game that includes IME (Kana-to-Kanji conversion) operations**.  
Many typing trainers focus on raw keystroke speed, but real office work requires:

- reading and composing sentences
- converting Kana to Kanji with IME
- selecting candidates and confirming conversion
- fixing wrong conversions quickly

This project is designed to practice that full workflow.

No account required. Free to use. Works on both desktop and mobile.

---

## Key Features

- **IME-aware scoring** (Kanji conversion included)
- **Office-oriented Japanese texts**
- **CPM (Characters Per Minute)** as the primary metric
- **Progress chart** to visualize improvement
- **Rankings and group battles** (friends / colleagues / classes)
- **Mobile support** (flick input and external keyboards)

---

## Why IME-aware?

In real Japanese writing, the bottleneck is often not typing speed but:

- conversion timing
- candidate selection
- correcting wrong conversions
- maintaining accuracy while composing sentences

This app focuses on those office-relevant skills, not only raw key speed.

---

## Run locally (example)

No build step is required.  
Serve the folder with any local server and open it in your browser.

### Python

```bash
python -m http.server 8000
