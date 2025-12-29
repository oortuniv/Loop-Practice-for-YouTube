# Chrome Web Store Submission Guide

## 📦 Required Assets

### 1. Icons (Required)

**Location**: `store-assets/icons/`

- **icon-16.png** (16x16) - Extension toolbar icon (small)
- **icon-48.png** (48x48) - Extension management page
- **icon-128.png** (128x128) - Chrome Web Store listing & installation dialog

**Design Guidelines**:
- Use PNG format with transparency
- Simple, recognizable design
- Visible at small sizes
- Consistent with brand colors

**Current Status**: ⚠️ **TODO** - Need to create icons showing:
- Musical note or loop symbol
- Guitar/instrument silhouette
- YouTube play button integration

---

### 2. Screenshots (Required, 1-5 images)

**Location**: `store-assets/screenshots/`

**Required Sizes**:
- 1280x800 (16:10 ratio) - Preferred
- OR 640x400 minimum

**What to Show**:
1. **Main Interface** - Loop section cards with controls
2. **Creating a Loop** - New loop creation dialog
3. **Tempo Settings** - BPM and time signature controls
4. **Multiple Loops** - Several practice sections organized
5. **Speed Control** - Playback speed adjustment in action

**Current Status**: ⚠️ **TODO** - Need to capture actual screenshots from YouTube

---

### 3. Promotional Images (Optional but Recommended)

**Small Promotional Tile** (440x280)
- Location: `store-assets/promotional/tile-small.png`
- Used in Chrome Web Store search results

**Large Promotional Tile** (920x680)
- Location: `store-assets/promotional/tile-large.png`
- Featured on store homepage (if selected)

**Marquee** (1400x560)
- Location: `store-assets/promotional/marquee.png`
- Top banner on extension detail page

**Current Status**: ⚠️ **TODO** - Design promotional graphics

---

## 📄 Required Documents

### 1. Privacy Policy (Required)

**Status**: ✅ Created at `PRIVACY_POLICY.md`

**Must Include**:
- What data is collected
- How data is used
- Data storage location
- User rights

### 2. Store Listing Description

**Status**: ✅ Created at `STORE_LISTING.md`

**Includes**:
- Short description (132 characters max)
- Detailed description
- Key features
- Usage instructions

### 3. License

**Status**: ✅ Created at `LICENSE`

---

## 🎨 Icon Design Suggestions

### Concept 1: Loop + Music
```
┌─────────────┐
│   ♪ ↻       │  Musical note + loop arrow
│  LOOP       │
│  PRACTICE   │
└─────────────┘
```

### Concept 2: Instrument Focus
```
┌─────────────┐
│   🎸 ⟳      │  Guitar + circular arrow
│             │
└─────────────┘
```

### Concept 3: YouTube Integration
```
┌─────────────┐
│  ▶️ ∞       │  Play button + infinity/loop
│             │
└─────────────┘
```

**Color Palette**:
- Primary: #065fd4 (YouTube Blue)
- Accent: #FF0000 (YouTube Red)
- Background: White/Transparent
- Text: Dark gray (#212529)

---

## 📸 Screenshot Guidelines

### Screenshot 1: Main Interface
**Caption**: "Organize practice sections with loop cards"
**Show**:
- Multiple loop cards with different labels (Intro, Verse, Chorus)
- Play/pause buttons
- Time ranges clearly visible
- Collapse/expand functionality

### Screenshot 2: Creating a Loop
**Caption**: "Create loops in seconds with bar-based duration"
**Show**:
- New loop creation interface
- Bar duration selector (2, 4, 8, 16 bars)
- Label presets dropdown
- Current video timestamp

### Screenshot 3: Tempo & Speed Control
**Caption**: "Set tempo with TAP feature and adjust playback speed"
**Show**:
- BPM input with TAP button
- Time signature selector
- Speed slider/control
- Active loop playing

### Screenshot 4: Practice Workflow
**Caption**: "Jump between sections instantly for efficient practice"
**Show**:
- Multiple loops with different speeds
- Active loop highlighted
- Drag handles for reordering

### Screenshot 5: Dark Mode (Optional)
**Caption**: "Works seamlessly with YouTube's dark theme"
**Show**:
- Same interface in dark mode
- Good contrast and readability

---

## ✅ Pre-Submission Checklist

### Code & Build
- [ ] All features working correctly
- [ ] No console errors
- [ ] Tested on latest Chrome version
- [ ] Build produces clean dist/ folder
- [ ] manifest.json version updated

### Assets
- [ ] icon-16.png created
- [ ] icon-48.png created
- [ ] icon-128.png created
- [ ] At least 1 screenshot (1280x800)
- [ ] Promotional tile (optional)

### Documents
- [ ] Privacy Policy published (need public URL)
- [ ] Store listing description ready
- [ ] License file included
- [ ] README.md up to date

### Store Listing Content
- [ ] Extension name (max 45 characters): ✅ "Loop Practice for YouTube"
- [ ] Short description (max 132 characters): ✅ Ready
- [ ] Detailed description: ✅ Ready
- [ ] Category selected: "Productivity" or "Tools"
- [ ] Language: English
- [ ] Support email/website provided

### Legal & Compliance
- [ ] Privacy policy URL (required if collecting data)
- [ ] Terms of service (if applicable)
- [ ] Developer email verified
- [ ] One-time developer registration fee paid ($5 USD)

---

## 🚀 Submission Steps

1. **Prepare Developer Account**
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Pay $5 one-time registration fee
   - Verify email address

2. **Create ZIP Package**
   ```bash
   cd dist
   zip -r ../loop-practice-for-youtube.zip .
   ```

3. **Upload to Store**
   - Click "New Item" in dashboard
   - Upload ZIP file
   - Fill in store listing details
   - Upload all required images

4. **Complete Store Listing**
   - Add description (copy from STORE_LISTING.md)
   - Upload screenshots
   - Select category: "Productivity"
   - Add privacy policy URL
   - Add support website/email

5. **Submit for Review**
   - Click "Submit for Review"
   - Review typically takes 1-3 business days
   - Address any reviewer feedback

---

## 📊 Post-Launch Checklist

- [ ] Monitor reviews and ratings
- [ ] Respond to user feedback
- [ ] Track usage statistics in dashboard
- [ ] Plan updates based on user requests
- [ ] Keep privacy policy URL active

---

## 🔗 Important Links

- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- [Developer Program Policies](https://developer.chrome.com/docs/webstore/program-policies/)
- [Branding Guidelines](https://developer.chrome.com/docs/webstore/branding/)
- [Best Practices](https://developer.chrome.com/docs/webstore/best_practices/)

---

**Last Updated**: 2025-12-29
**Version**: 0.1.0
