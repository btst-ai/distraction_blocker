
## 🛠️ Development & Building

This project has been restructured to support both a Development and a Production version.

### Directory Structure
- `src/`: Source code (`background`, `popup`, `data`, `assets`).
- `scripts/`: Build scripts and configuration.
- `docs/`: Documentation.
- `dist/`: Output directory for builds (generated).

### Building the Extension

Use the Python build script to generate the extension:

**Development Build** ("Gorudo Dev" - Full blocklist, debug logs):
```bash
python3 scripts/build.py dev
```
Output: `dist/dev/`

**Production Build** ("Gorudo" - Minimal blocklist, no logs):
```bash
python3 scripts/build.py prod
```
Output: `dist/prod/`

### Configuration
- Blocklists are defined in `scripts/config.py`.
- Manifest template is `src/manifest.json`.
