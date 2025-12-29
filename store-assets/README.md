# Store Assets Directory

This directory contains all necessary files and documentation for submitting **Loop Practice for YouTube** to the Chrome Web Store.

## 📁 Directory Structure

```
store-assets/
├── README.md                          # This file
├── STORE_SUBMISSION_GUIDE.md          # Complete submission guide
├── STORE_LISTING.md                   # Store description content
├── SCREENSHOT_GUIDE.md                # Screenshot requirements
├── icons/
│   ├── ICON_DESIGN_GUIDE.md          # Icon creation guide
│   ├── icon-16.png                    # ⚠️ TODO: Create 16x16 icon
│   ├── icon-48.png                    # ⚠️ TODO: Create 48x48 icon
│   └── icon-128.png                   # ⚠️ TODO: Create 128x128 icon
├── screenshots/
│   ├── 01-main-interface.png          # ⚠️ TODO: Capture screenshot
│   ├── 02-create-loop.png             # ⚠️ TODO: Capture screenshot
│   ├── 03-tempo-control.png           # ⚠️ TODO: Capture screenshot
│   ├── 04-speed-control.png           # ⚠️ TODO: Capture screenshot
│   └── 05-organization.png            # ⚠️ TODO: Capture screenshot
└── promotional/
    ├── tile-small.png                 # Optional: 440x280
    ├── tile-large.png                 # Optional: 920x680
    └── marquee.png                    # Optional: 1400x560
```

## 📋 Submission Checklist

### Required Files
- [ ] **Icons** (3 files - 16px, 48px, 128px)
- [ ] **Screenshots** (1-5 files, 1280x800 recommended)
- [ ] **Privacy Policy** (publicly accessible URL)
- [ ] **Store Listing Description** (from STORE_LISTING.md)
- [ ] **ZIP Package** (built extension from /dist folder)

### Optional but Recommended
- [ ] Promotional Tile (Small - 440x280)
- [ ] Promotional Tile (Large - 920x680)
- [ ] Marquee Banner (1400x560)
- [ ] Promotional video (YouTube link)

### Administrative
- [ ] Chrome Web Store Developer Account ($5 one-time fee)
- [ ] Support email address
- [ ] Support website/GitHub link
- [ ] Category selected (Productivity)

## 🚀 Quick Start Guide

### Step 1: Create Icons
1. Read `icons/ICON_DESIGN_GUIDE.md`
2. Design icons using Figma, Canva, or your preferred tool
3. Export 3 sizes: 16x16, 48x48, 128x128
4. Save in `icons/` folder
5. Copy to `/public/` folder for building

### Step 2: Capture Screenshots
1. Read `SCREENSHOT_GUIDE.md`
2. Load extension in Chrome
3. Navigate to a YouTube music tutorial
4. Set up realistic practice loops
5. Capture 5 screenshots (1280x800)
6. Save in `screenshots/` folder with numbered names

### Step 3: Prepare Documentation
1. Review `STORE_LISTING.md` for store description
2. Ensure `PRIVACY_POLICY.md` is published online
3. Update support email and GitHub links
4. Prepare answers for Chrome Web Store questions

### Step 4: Build and Package
```bash
# From project root
npm run build

# Create ZIP file
cd dist
zip -r ../loop-practice-for-youtube.zip .
cd ..
```

### Step 5: Submit
1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click "New Item"
3. Upload ZIP file
4. Fill in all required fields (use content from STORE_LISTING.md)
5. Upload icons and screenshots
6. Submit for review

## 📝 Important Notes

### Privacy Policy URL
⚠️ **CRITICAL**: You MUST host the privacy policy on a publicly accessible URL before submission.

Options:
1. **GitHub Pages** (Recommended - Free)
   - Enable GitHub Pages for this repo
   - URL: `https://yourusername.github.io/loop-practice-for-youtube/PRIVACY_POLICY.html`

2. **Your Personal Website**
   - Host PRIVACY_POLICY.md as HTML
   - Ensure it's accessible without login

3. **Free Hosting**
   - Netlify, Vercel, or similar
   - Deploy just the privacy policy page

### Icon Requirements
- Must be PNG with transparency
- Exact sizes: 16x16, 48x48, 128x128 pixels
- Recognizable at all sizes
- Professional appearance

### Screenshot Requirements
- PNG or JPEG format
- 1280x800 pixels (16:10 ratio) preferred
- Minimum 640x400 pixels
- Maximum 5 screenshots
- Under 5MB each
- No personal information visible

## 🎨 Design Assets

### Color Palette
Use these colors for consistency:

- **YouTube Blue**: `#065fd4`
- **YouTube Red**: `#FF0000`
- **Dark Gray**: `#212529`
- **Light Gray**: `#f8f9fa`
- **Border**: `#e0e0e0`

### Fonts
- **Primary**: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto
- **Monospace**: 'Courier New', monospace

### Icon Concepts
See `icons/ICON_DESIGN_GUIDE.md` for detailed design concepts including:
- Loop arrow + music note
- Guitar + repeat symbol
- Play button + loop
- Minimalist circular arrow

## 📊 Review Process

After submission:
1. **Automated Review**: Instant check for policy violations
2. **Manual Review**: 1-3 business days typically
3. **Possible Outcomes**:
   - ✅ Approved - Extension goes live
   - ⚠️ Needs Changes - Address feedback and resubmit
   - ❌ Rejected - Fix issues and appeal/resubmit

## 🔄 Post-Launch

Once approved:
- Monitor reviews and ratings
- Respond to user feedback
- Track analytics in dashboard
- Plan updates based on requests
- Keep privacy policy URL active

## 📞 Support

Questions about submission?
- Chrome Web Store Developer Support
- [Chrome Extension Development Forums](https://groups.google.com/a/chromium.org/g/chromium-extensions)
- [Stack Overflow - Chrome Extension](https://stackoverflow.com/questions/tagged/google-chrome-extension)

## 🔗 Useful Links

- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- [Developer Program Policies](https://developer.chrome.com/docs/webstore/program-policies/)
- [Publishing Guide](https://developer.chrome.com/docs/webstore/publish/)
- [Branding Guidelines](https://developer.chrome.com/docs/webstore/branding/)
- [Review Status](https://developer.chrome.com/docs/webstore/review-process/)

---

**Last Updated**: 2025-12-29
**Status**: Ready for Asset Creation

**Next Actions**:
1. Create icons (see `icons/ICON_DESIGN_GUIDE.md`)
2. Capture screenshots (see `SCREENSHOT_GUIDE.md`)
3. Publish privacy policy online
4. Submit to Chrome Web Store
