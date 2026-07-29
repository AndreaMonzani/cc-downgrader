# CC Downgrader 🚀

> **Downgrade Everything.** Client-side, privacy-first web tool to downgrade Adobe After Effects (`.aep`, `.aepx`) and Adobe Premiere Pro (`.prproj`) project files to older versions.

![License](https://img.shields.io/badge/license-MIT-purple.svg)
![Build](https://img.shields.io/badge/version-1.0.0-cyan.svg)

## 🌟 Features

- **100% Client-Side Processing**: No project files are uploaded to any server. All byte manipulations and GZIP processing happen directly in your browser.
- **After Effects Engine**: Structural RIFX parser patching `head` signature bytes without corrupting project composition trees.
- **Premiere Pro Engine**: Decompresses `.prproj` XML streams using `pako` and patches project schema version attributes.
- **Quick & Advanced Modes**: Drag-and-drop quick downgrade or advanced selection UI with file metadata extraction.

## 🛠️ Tech Stack

- **Framework/Bundler**: Vite
- **Language**: JavaScript (ES Modules)
- **Styling**: Modern CSS (Glassmorphism, Responsive Grid, Custom Cursor)
- **Compression**: `pako` (GZIP/Deflate)

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

1. Clone the repository:
   ```bash
   git clone [https://github.com/your-username/cc-downgrader.git](https://github.com/your-username/cc-downgrader.git)
   cd cc-downgrader