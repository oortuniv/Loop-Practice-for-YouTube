import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: "Loop Practice for YouTube",
  version: "0.1.0",
  description: "Practice efficiently with section looping, speed control, and tempo tracking. Perfect for musicians learning from YouTube videos.",


  permissions: [
    "storage",
    "activeTab",
    "scripting",
    "tabs"
  ],
  
  host_permissions: [
    "*://*.youtube.com/*",
    "*://youtu.be/*"
  ],
  
  content_scripts: [{
    matches: [
      "*://*.youtube.com/*",
      "*://youtu.be/*"
    ],
    js: ["src/content/index.ts"],
    run_at: "document_end",
    all_frames: false
  }],

  // Keyboard shortcuts temporarily disabled (can be re-enabled later)
  // commands: {
  //   "toggle-play": {
  //     suggested_key: { default: "Alt+P" },
  //     description: "재생/일시정지"
  //   },
  //   "toggle-loop": {
  //     suggested_key: { default: "Alt+L" },
  //     description: "구간반복 토글"
  //   },
  //   "prev-segment": {
  //     suggested_key: { default: "Alt+Left" },
  //     description: "이전 구간"
  //   },
  //   "next-segment": {
  //     suggested_key: { default: "Alt+Right" },
  //     description: "다음 구간"
  //   }
  // },

  action: {
    default_title: "Loop Practice for YouTube",
    default_popup: "src/popup.html"
  },
  
  background: { 
    service_worker: "src/background.ts", 
    type: "module" 
  },
  

}); 