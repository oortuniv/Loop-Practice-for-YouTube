# Privacy Policy for Loop Practice for YouTube

**Last Updated**: January 4, 2026
**Effective Date**: December 29, 2025

## Introduction

Loop Practice for YouTube ("we", "our", or "the Extension") is committed to protecting your privacy. This Privacy Policy explains how our Chrome Extension collects, uses, and safeguards your information.

## Information We Collect

### Data Stored Locally

Loop Practice for YouTube stores the following data **locally on your device** using Chrome's Storage API:

1. **Loop Section Data**
   - Start and end times for practice sections
   - Section labels and playback speeds
   - Tempo (BPM) and time signature settings
   - Beat sync offset (first downbeat timing)
   - Metronome preferences (enabled/disabled, volume)
   - Per-video configuration

2. **UI Preferences**
   - Collapsed/expanded state of section cards
   - Theme preferences (automatically detected from YouTube)

3. **Audio Settings**
   - Metronome volume level
   - This data is used solely to generate click sounds locally via Web Audio API

### Data We DO NOT Collect

- ❌ Personal information (name, email, address)
- ❌ Browsing history outside of YouTube
- ❌ YouTube watch history
- ❌ Credit card or payment information
- ❌ Location data
- ❌ Device information beyond what's necessary for the extension to function

## How We Use Your Information

The data collected is used **exclusively** for:

1. **Functionality**: Storing your practice loop configurations for each YouTube video
2. **Persistence**: Remembering your settings when you return to a video
3. **Synchronization**: Optionally syncing your loop data across your Chrome browsers (if you're signed into Chrome)
4. **Audio Generation**: Creating metronome click sounds locally using Web Audio API (no audio is recorded or transmitted)

## Data Storage and Security

### Local Storage
- All data is stored locally using Chrome's `chrome.storage.sync` API
- Data is tied to your Chrome profile
- No data is sent to external servers
- We do not operate any backend servers or databases

### Chrome Sync (Optional)
- If you're signed into Chrome, your loop data may sync across your devices
- This sync is handled entirely by Google's Chrome Sync service
- We have no access to this synced data
- You can disable Chrome Sync in your Chrome settings

## Third-Party Services

### YouTube
- This extension operates on YouTube.com
- We do not collect or transmit your YouTube viewing data
- YouTube's own privacy policy applies to your use of their service

### No Analytics or Tracking
- We do **not** use Google Analytics
- We do **not** use any third-party tracking services
- We do **not** collect usage statistics
- We do **not** serve advertisements

## Data Retention

- Your loop data remains stored until you:
  - Manually delete loops using the extension
  - Uninstall the extension
  - Clear your Chrome browsing data/storage
- We do not have the ability to access or delete your data remotely

## Your Rights

You have the right to:

1. **Access**: View all your stored data through the extension interface
2. **Delete**: Remove any or all loop sections at any time
3. **Export**: No automatic export feature currently, but all data is stored locally in Chrome storage
4. **Opt-out**: Uninstall the extension to stop all data collection

## Children's Privacy

Loop Practice for YouTube does not knowingly collect information from children under 13. The extension is designed for musicians and learners of all ages practicing with YouTube videos.

## Changes to This Privacy Policy

We may update this Privacy Policy from time to time. When we do:
- We will update the "Last Updated" date at the top
- Significant changes will be noted in the extension's update notes
- Continued use of the extension after changes constitutes acceptance

## Permissions Explained

Our extension requests the following Chrome permissions:

- **storage**: To save your loop configurations locally
- **activeTab**: To interact with the current YouTube tab
- **scripting**: To inject our interface into YouTube pages
- **tabs**: To detect when you navigate to a new YouTube video

These permissions are used **only** for the functionality described in this policy.

## Contact Us

If you have questions about this Privacy Policy or our privacy practices:

- **GitHub Issues**: [Report an issue](https://github.com/yourusername/loop-practice-for-youtube/issues)
- **Email**: [Your support email]

## Compliance

This extension complies with:
- Chrome Web Store Developer Program Policies
- General Data Protection Regulation (GDPR)
- California Consumer Privacy Act (CCPA)

## Data Processing Basis (GDPR)

For users in the EU, our legal basis for processing your data is:
- **Consent**: By installing and using the extension
- **Legitimate Interest**: Providing the core functionality you requested

## Your GDPR Rights

EU users have additional rights:
- Right to access your data
- Right to rectification
- Right to erasure ("right to be forgotten")
- Right to restrict processing
- Right to data portability
- Right to object

To exercise these rights, uninstall the extension or contact us at the email above.

---

**Summary**: Loop Practice for YouTube stores your practice loop data locally on your device. We don't collect personal information, don't use analytics, and don't send your data anywhere. Your privacy is fully protected.
