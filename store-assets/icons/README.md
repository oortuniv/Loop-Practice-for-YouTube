# Icon Placeholder Files

This directory should contain your Chrome Extension icons.

## Required Files

- **icon-16.png** (16x16 pixels) - Extension toolbar
- **icon-48.png** (48x48 pixels) - Extension management page  
- **icon-128.png** (128x128 pixels) - Chrome Web Store listing

## Current Status

⚠️ **Icons not yet created** - Please create icons following the guide in `ICON_DESIGN_GUIDE.md`

## Quick Creation Guide

### Option 1: Use Figma (Recommended)
1. Open Figma (free account)
2. Create 128x128 canvas
3. Design icon with:
   - Musical note (♪) or instrument
   - Loop/circular arrow (⟳)
   - YouTube blue color (#065fd4)
4. Export as PNG (transparent background)
5. Scale to create 48x48 and 16x16 versions

### Option 2: Use Canva
1. Create custom size: 128x128px
2. Search for "music loop" icons
3. Customize colors to match YouTube theme
4. Download as PNG with transparent background
5. Resize using online tools for smaller versions

### Option 3: Hire a Designer
- Fiverr: $5-20 for icon design
- Upwork: Professional designers available
- 99designs: Icon design contests

## Design Tips

✅ **DO**:
- Keep design simple and recognizable
- Use high contrast colors
- Test at 16px size first
- Leave padding around edges
- Use PNG format with transparency

❌ **DON'T**:
- Use too many details (won't scale well)
- Use text in small icons
- Copy exact brand logos
- Use JPEG format
- Make icon touch edges

## After Creating Icons

1. Save in this directory:
   - `icon-16.png`
   - `icon-48.png`
   - `icon-128.png`

2. Copy to `/public/` directory for building:
   ```bash
   cp icon-*.png ../../public/
   ```

3. Rebuild extension:
   ```bash
   cd ../..
   npm run build
   ```

4. Test in Chrome:
   - Load unpacked extension
   - Check toolbar icon
   - Check chrome://extensions page

---

**See**: `ICON_DESIGN_GUIDE.md` for detailed instructions
