# nano-mux
A modern terminal workspace built with Electron, React, and TypeScript.  
`nano-mux` combines:
- Multi-session terminal tabs
- File explorer with folder navigation
- Built-in code editor (CodeMirror 6)
- Git status panel with quick diff viewing

## Features
- **Terminal sessions** powered by `node-pty` + `xterm`
  - Create, switch, and close multiple terminal tabs
  - PTY resize support
  - Clickable links in terminal output
- **File explorer**
  - Browse directories
  - Expand/collapse folders
  - Open files directly in the editor
  - Open system folder picker (`Cmd/Ctrl + O`)
- **Editor**
  - Syntax highlighting (TS/JS, JSON, HTML, CSS, Markdown, Python, Rust, C/C++)
  - Save with `Cmd/Ctrl + S`
  - Edit and diff modes
- **Git panel**
  - Detects repository status
  - Shows current branch + ahead/behind counts
  - Lists staged/changed files
  - Click files to open diff view

## Tech Stack
- **Desktop shell:** Electron
- **UI:** React 18
- **Language:** TypeScript
- **Terminal:** xterm + node-pty
- **Editor:** CodeMirror 6
- **Git integration:** simple-git
- **State management:** Zustand
- **Bundling:** Webpack

## Project Structure
```text
src/
  main/       # Electron main process (window + IPC + PTY + FS + Git handlers)
  preload/    # Secure context bridge API exposed to renderer
  renderer/   # React UI (terminal, explorer, editor, git panel)
public/       # Static assets (icon, HTML template)
```

## Requirements
- Node.js 18+ (recommended)
- npm 9+ (recommended)
- macOS/Linux/Windows

## Getting Started
Install dependencies:

```bash
npm install
```

Run in development mode:

```bash
npm run dev
```

This starts:
- main/preload builds
- renderer dev server on `http://localhost:9000`
- Electron app with `NANO_MUX_DEV=1`

Run production build + app:

```bash
npm start
```

Build only:

```bash
npm run build
```

## Available Scripts
- `npm run build:main` – compile Electron main process
- `npm run build:preload` – compile preload bridge
- `npm run build:renderer` – build renderer bundle
- `npm run build` – run all builds
- `npm run dev:renderer` – run renderer dev server
- `npm run dev` – launch full development environment
- `npm start` – build and run Electron app

## Keyboard Shortcuts
- `Cmd/Ctrl + O` – open directory picker
- `Cmd/Ctrl + S` – save current file in editor

## Architecture Overview
- The **main process** manages:
  - PTY sessions (`pty:create`, `pty:write`, `pty:resize`, `pty:destroy`)
  - File system operations (`fs:readDir`, `fs:readFile`, `fs:writeFile`)
  - Git operations (`git:status`, `git:diff`, `git:fileContent`)
  - Shell external URL opening and folder dialog
- The **preload layer** exposes a typed `window.nanoMux` API via `contextBridge`
- The **renderer** consumes this API from React components and manages app state in Zustand

## Notes
- Hidden files/directories are currently filtered out in the file explorer.
- No dedicated test/lint scripts are currently defined in `package.json`.
- If native module rebuild issues occur (e.g., `node-pty`), run:

```bash
npx electron-rebuild
```

## License
No license file is currently included. Add one (for example, MIT) if you plan to distribute this project.
