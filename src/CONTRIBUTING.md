# Contributing to CC Downgrader 🚀

First off, thank you for considering contributing to CC Downgrader! It's open-source tools like this that make the creative community great.

## 🤝 How Can I Contribute?

### Reporting Bugs
If you find a project file format that crashes the tool or fails to convert:
1. Open an issue on GitHub.
2. Specify the Adobe software version (e.g., Premiere Pro 2026 -> 2024).
3. Do **NOT** upload proprietary or confidential media assets; only describe the error output.

### Pull Requests
1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

## 🛠️ Code Architecture

- `src/core/fileRouter.js`: Main entry point for detecting file signatures (`.prproj` vs `.aep`).
- `src/tools/pr/downgrader.js`: GZIP XML stream decompression (`pako`) and schema patching.
- `src/tools/aep/downgrader.js`: RIFX binary parser & byte header modification.

## 📜 License
By contributing, you agree that your contributions will be licensed under the MIT License.