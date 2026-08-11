<h1 align="center">Datagrid</h1>

<p align="center">
  A private, local-first note-taking app built around an infinite snapping grid.
</p>

<p align="center">
  Arrange text, images, spreadsheets, and links as portable cards without giving up ownership of your files.
</p>

---

## Overview

Datagrid replaces the freeform canvas with a structured two-dimensional grid. Cards snap into evenly spaced slots, reflow around one another, and remain editable directly on the canvas.

Every canvas is saved as a single OpenDocument Text (`.odt`) file containing its layout, text, images, link previews, and embedded spreadsheets.

## Features

- Infinite panning and zooming grid
- Text, image, spreadsheet, and rich link cards
- Live card reflow and grid-based resizing
- Lightweight headings, bold, italic, and lists
- Spreadsheet formulas and calculated columns
- Automatic image and link accent colors
- Multiple open canvases with tabs
- Per-canvas emojis
- Undo and redo
- Light and dark themes
- Adjustable interface scale and fonts
- User-selected local library folder
- Portable OpenDocument storage
- Offline-first operation

## Installation

### Windows installer

1. Open the repository's [Releases](https://github.com/rafay-pk/datagrid/releases) page.
2. Download the latest Datagrid installer.
3. Run the installer.
4. Launch Datagrid from the Start menu.

Windows may display a warning for unsigned applications. Review the downloaded file and repository before continuing.

## Development

Datagrid is built with Tauri 2, React, TypeScript, Vite, and Rust.

### Requirements

- Windows 10 or Windows 11
- Node.js
- Rust with the MSVC toolchain
- Microsoft C++ Build Tools
- WebView2

### Run locally

```powershell
npm install
npm run tauri dev
```

### Create a release build

```powershell
.\release.ps1 0.1.0
```

Installers are generated under `src-tauri/target/release/bundle/`.

## Data and privacy

Datagrid does not require an account. Canvas files remain in the library folder selected by the user, and no canvas data is sent to a Datagrid service.

Link previews require a network connection when first collected. Their metadata and preview images are then stored inside the canvas for offline use.

## Portability

Datagrid canvases are standard `.odt` files with embedded spreadsheet documents and images. Other OpenDocument applications can access the underlying content even when they do not understand Datagrid's spatial layout.

## Contributing

Bug reports and improvement suggestions are welcome through GitHub Issues.
