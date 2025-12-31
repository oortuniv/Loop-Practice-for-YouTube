# Loop Practice for YouTube

> A Chrome Extension for efficient practice with YouTube videos through section looping and playback speed control.

YouTube 동영상으로 연습할 때 필요한 구간 반복, 속도 조절 기능을 제공하는 Chrome 확장 프로그램입니다.

## ✨ Features

### 🔁 Loop Management
- **Multiple Loop Sections**: Create and manage multiple practice sections within a single video
- **Quick Section Creation**: Create loops in 2, 4, 8, or 16 bar increments (requires tempo settings)
- **Preset Labels**: Choose from common section names (Intro, Verse, Chorus, Bridge, Outro) or create custom labels
- **Drag & Drop Reordering**: Reorganize your loop sections with simple drag and drop
- **Collapsible Cards**: Collapse sections to keep your workspace clean

### ⏯️ Playback Control
- **Automatic Looping**: Seamlessly loops back to the start when reaching the end of a section
- **Speed Adjustment**: Change playback speed from 0.25x to 2x for each loop section
- **Fine-grained Time Control**: Adjust start/end times with precision using drag or manual input

### 🎵 Music Practice Features
- **Tempo (BPM) Tracking**: Set the song's tempo for bar-based loop creation
- **TAP Tempo**: Quickly determine BPM by tapping along with the music
- **Time Signature Support**: Support for various time signatures (2/4, 3/4, 4/4, 5/4, 6/8, 7/8, 9/8, 12/8, 6/4)

### 💾 Data Persistence
- **Auto-save**: All settings and loop sections are automatically saved
- **Per-video Storage**: Each video maintains its own set of loops and settings
- **Chrome Sync**: Settings sync across your Chrome browsers (when signed in)

## 🚀 Installation

### From Source (Development)

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/loop-practice-for-youtube.git
   cd loop-practice-for-youtube
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```

4. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` folder from this project

## 📖 Usage

1. **Navigate to any YouTube video**
   - The extension automatically activates on YouTube watch pages

2. **Create a loop section**
   - Click "+ New Loop" button
   - Choose a duration (2, 4, 8, or 16 bars) or custom time
   - Add a label to identify the section

3. **Activate a loop**
   - Click the play icon (▶) on any loop card
   - The video will automatically loop between the start and end times

4. **Adjust settings**
   - Set **Tempo (BPM)**: Use TAP button or type manually
   - Set **Time Signature**: Select from dropdown
   - Adjust **Speed**: Fine-tune playback speed per loop

5. **Manage loops**
   - **Edit**: Click the pencil icon to rename
   - **Delete**: Use the menu (⋮) to remove
   - **Reorder**: Drag cards to reorganize
   - **Collapse**: Click the chevron to minimize cards

## ⌨️ Keyboard Shortcuts

*Currently disabled - can be re-enabled in future versions*

## 🛠️ Development

### Project Structure
```
src/
├── manifest.ts              # Chrome Extension Manifest V3
├── background.ts            # Service Worker
├── popup.ts/html            # Extension Popup UI
├── types.ts                 # TypeScript Type Definitions
├── utils.ts                 # Utility Functions
└── content/                 # Content Script (injected into YouTube)
    ├── index.ts             # Main entry point
    ├── loops.ts             # Loop Controller
    ├── storage.ts           # Chrome Storage API wrapper
    ├── ui-controller.ts     # UI Rendering & Event Handling
    ├── ui.ts                # DOM Injection
    └── audio/
        └── metronome.ts     # Web Audio API Metronome
```

### Build Commands

```bash
# Development build with watch mode
npm run dev

# Production build
npm run build

# Run tests
npm test

# Run tests in watch mode
npm test:watch
```

### Tech Stack
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool
- **Chrome Extension Manifest V3** - Latest extension platform
- **Preact** - Lightweight UI framework
- **Vitest** - Unit testing
- **Web Audio API** - Audio timing features

## 📝 Notes

### Current Limitations
- Keyboard shortcuts are temporarily disabled
- Some advanced metronome features are hidden in UI but available in code
- Depends on YouTube's DOM structure (may break with YouTube updates)

### Browser Compatibility
- Chrome/Chromium-based browsers (Edge, Brave, etc.)
- Requires Manifest V3 support

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📦 Chrome Web Store Submission

Ready to publish? Check out the complete submission guide:

📁 **[store-assets/STORE_SUBMISSION_GUIDE.md](store-assets/STORE_SUBMISSION_GUIDE.md)**

### Quick Checklist
- [ ] Icons created (16x16, 48x48, 128x128)
- [ ] Screenshots captured (1280x800, at least 1)
- [ ] Privacy Policy published (publicly accessible URL needed)
- [ ] Store listing description ready
- [ ] Developer account registered ($5 one-time fee)

See detailed guides in `store-assets/`:
- `ICON_DESIGN_GUIDE.md` - Icon creation instructions
- `SCREENSHOT_GUIDE.md` - Screenshot requirements and tips
- `STORE_LISTING.md` - Complete store description content

## 📄 License

Copyright (c) 2025 oortuniv. All Rights Reserved.

This is proprietary software. See [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [CRXJS Vite Plugin](https://crxjs.dev/vite-plugin)
- Inspired by musicians who practice with YouTube videos

---

**Loop Practice for YouTube** - Practice smarter, not harder 🎸
