function k(){return document.querySelector("video")}function I(l=location.href){try{const e=new URL(l);return e.hostname==="youtu.be"?e.pathname.slice(1)||null:e.hostname.includes("youtube.com")&&e.searchParams.get("v")||null}catch{return null}}function N(){return I()!==null&&!location.pathname.includes("/shorts")}function P(){return new Promise(l=>{const e=k();if(e){l(e);return}const t=new MutationObserver(()=>{const o=k();o&&(t.disconnect(),l(o))});t.observe(document.body,{childList:!0,subtree:!0})})}function D(l){let e=location.href;const t=()=>{location.href!==e&&(e=location.href,l())};window.addEventListener("popstate",t);const o=history.pushState,n=history.replaceState;history.pushState=function(...i){o.apply(history,i),setTimeout(t,0)},history.replaceState=function(...i){n.apply(history,i),setTimeout(t,0)},document.addEventListener("yt-navigate-finish",t)}async function B(l){const e=`vid:${l}`,t=await chrome.storage.sync.get(e);if(t[e])return t[e];const o={videoId:l,defaultRate:1,segments:[],activeSegmentId:null};return await chrome.storage.sync.set({[e]:o}),o}async function z(l){const e=`vid:${l.videoId}`;await chrome.storage.sync.set({[e]:l})}function R(l,e,t){return Math.min(Math.max(l,e),t)}function U(l){if(!l||!l.tagName)return!1;const e=l.tagName.toLowerCase();return["input","textarea","select"].includes(e)||l.contentEditable==="true"||l.isContentEditable}function A(l,e){let t;return function(...o){t||(l.apply(this,o),t=!0,setTimeout(()=>t=!1,e))}}function C(l){const e=l.split("/");return[parseInt(e[0],10),parseInt(e[1],10)]}function $(l,e,t){const[o,n]=C(t),i=60/e,s=4/n;return l*o*s*i}function _(l,e,t){const[o,n]=C(t),i=60/e,s=4/n;return l/i/(o*s)}var O=Object.defineProperty,G=(l,e,t)=>e in l?O(l,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):l[e]=t,f=(l,e,t)=>G(l,typeof e!="symbol"?e+"":e,t);class Y{constructor(){f(this,"audioContext",null),f(this,"schedulerTimer",null),f(this,"nextBeatTime",0),f(this,"currentBeat",0),f(this,"bpm",120),f(this,"beatsPerBar",4),f(this,"isPlaying",!1),f(this,"SCHEDULE_AHEAD_TIME",.1),f(this,"SCHEDULER_INTERVAL",25),f(this,"cachedBeats",[]),f(this,"cacheKey",""),f(this,"loopDuration",0)}start(e,t,o=0,n){console.log("[Metronome] start() 호출:",{bpm:e,timeSignature:t,startOffset:o,loopDuration:n}),this.isPlaying&&(console.log("[Metronome] 이미 재생 중, 중지 후 재시작"),this.stop()),this.audioContext?console.log("[Metronome] 기존 AudioContext 사용:",this.audioContext.state):(this.audioContext=new AudioContext,console.log("[Metronome] AudioContext 생성:",this.audioContext.state)),this.bpm=e;const[i]=C(t);this.beatsPerBar=i;const s=`${e}-${t}-${n||0}`;s!==this.cacheKey||this.cachedBeats.length===0?(console.log("[Metronome] 클릭음 시간 캐시 생성 중..."),this.cacheKey=s,this.loopDuration=n||0,this.generateBeatCache()):console.log("[Metronome] 캐시된 클릭음 시간 사용"),this.currentBeat=this.calculateBeatOffset(o),this.nextBeatTime=this.audioContext.currentTime,this.isPlaying=!0,console.log("[Metronome] 메트로놈 시작됨:",{bpm:this.bpm,beatsPerBar:this.beatsPerBar,currentBeat:this.currentBeat,nextBeatTime:this.nextBeatTime,audioContextTime:this.audioContext.currentTime,cachedBeatsCount:this.cachedBeats.length}),this.schedulerTimer=window.setInterval(()=>{this.scheduler()},this.SCHEDULER_INTERVAL)}stop(){this.isPlaying=!1,this.schedulerTimer!==null&&(clearInterval(this.schedulerTimer),this.schedulerTimer=null)}isRunning(){return this.isPlaying}calculateBeatOffset(e){const t=60/this.bpm,o=e/t;return Math.floor(o%this.beatsPerBar)}resync(e){!this.isPlaying||!this.audioContext||(this.currentBeat=this.calculateBeatOffset(e),this.nextBeatTime=this.audioContext.currentTime)}scheduler(){if(!this.audioContext||!this.isPlaying)return;const e=this.audioContext.currentTime;let t=0;for(;this.nextBeatTime<e+this.SCHEDULE_AHEAD_TIME;){this.scheduleClick(this.nextBeatTime,this.currentBeat),t++;const o=60/this.bpm;this.nextBeatTime+=o,this.currentBeat=(this.currentBeat+1)%this.beatsPerBar}t>0&&console.log(`[Metronome] 스케줄링됨: ${t}개 beat, 다음 beat 시간: ${this.nextBeatTime.toFixed(3)}`)}scheduleClick(e,t){}dispose(){this.stop(),this.audioContext&&(this.audioContext.close(),this.audioContext=null),this.cachedBeats=[],this.cacheKey=""}generateBeatCache(){if(this.cachedBeats=[],!this.bpm||!this.beatsPerBar){console.warn("[Metronome] generateBeatCache: BPM 또는 beatsPerBar가 설정되지 않음");return}const e=60/this.bpm,t=this.loopDuration>0?this.loopDuration:60,o=Math.ceil(t/e);for(let n=0;n<o;n++){const i=n*e,s=n%this.beatsPerBar;this.cachedBeats.push({time:i,beatNumber:s})}console.log(`[Metronome] Beat 캐시 생성 완료: ${this.cachedBeats.length}개 beats, duration=${t.toFixed(2)}s`)}}var q=Object.defineProperty,V=(l,e,t)=>e in l?q(l,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):l[e]=t,S=(l,e,t)=>V(l,typeof e!="symbol"?e+"":e,t);class j{constructor(e,t){S(this,"video"),S(this,"profile"),S(this,"active"),S(this,"tickThrottled"),S(this,"metronome"),S(this,"globalSyncMetronomeActive",!1),this.video=e,this.profile=t,this.tickThrottled=A(()=>this.tick(),50),this.metronome=new Y,t.activeSegmentId&&this.setActive(t.activeSegmentId),this.video.addEventListener("pause",()=>{this.metronome.isRunning()&&(this.globalSyncMetronomeActive?this.stopGlobalSyncMetronome():this.stopMetronome())}),this.video.addEventListener("play",()=>{var o;this.globalSyncMetronomeActive?this.startGlobalSyncMetronome():(o=this.active)!=null&&o.metronomeEnabled&&this.startMetronome()})}setProfile(e){if(this.profile=e,console.log("LoopController setProfile:",{activeSegmentId:e.activeSegmentId,segmentsCount:e.segments.length}),e.activeSegmentId){const t=e.segments.find(o=>o.id===e.activeSegmentId);console.log("setProfile에서 찾은 구간:",t),this.active=t||void 0}else this.active=void 0,this.metronome.isRunning()&&this.stopMetronome();this.applyActiveRate(),this.active?console.log(`setProfile 후 루프 활성화: ${this.active.label} (${this.active.start}s ~ ${this.active.end}s)`):console.log("setProfile 후 루프 비활성화")}setActive(e){if(console.log("setActive 호출됨:",{id:e,segmentsCount:this.profile.segments.length}),e){const t=this.profile.segments.find(o=>o.id===e);console.log("찾은 구간:",t),this.active=t||void 0}else this.active=void 0;this.applyActiveRate(),this.active?(console.log(`루프 활성화: ${this.active.label} (${this.active.start}s ~ ${this.active.end}s)`),this.active.metronomeEnabled&&!this.video.paused&&(this.stopMetronome(),this.startMetronome())):(console.log("루프 비활성화"),this.metronome.isRunning()&&this.stopMetronome())}getActive(){return this.active}getProfile(){return this.profile}tick(){if(!this.active)return;const{start:e,end:t}=this.active;if(e==null||isNaN(e)||typeof e!="number"||t===void 0||t===null||isNaN(t)||typeof t!="number"){console.log("루프 체크: start 또는 end 값이 유효하지 않음",{start:e,end:t});return}if(e>=t){console.log("루프 체크: start가 end보다 크거나 같음 (무효한 구간)",{start:e,end:t});return}const o=this.video.currentTime;if(o==null||isNaN(o)||typeof o!="number"){console.log("루프 체크: currentTime이 유효하지 않음",o);return}this.active.metronomeEnabled&&!this.video.paused&&!this.metronome.isRunning()&&this.startMetronome(),o>=t&&(console.log(`루프 점프: ${o.toFixed(2)}s → ${e.toFixed(2)}s`),this.video.currentTime=e,this.active.metronomeEnabled&&this.metronome.isRunning()&&(this.stopMetronome(),this.startMetronome()),this.video.paused&&(console.log("루프 점프 후 재생 시작"),this.video.play().catch(n=>{console.error("루프 점프 후 재생 실패:",n)})))}onTimeUpdate(){this.tickThrottled()}gotoPrevNext(e){const t=this.video.currentTime;if(t==null||isNaN(t)||typeof t!="number"){console.log("gotoPrevNext: currentTime이 유효하지 않음",t);return}const o=[...this.profile.segments].sort((n,i)=>n.start-i.start);if(o.length!==0){if(e>0){const n=o.find(i=>i.start>t)??o[0];this.setActive(n==null?void 0:n.id),n&&typeof n.start=="number"&&!isNaN(n.start)&&(this.video.currentTime=n.start)}else{const n=[...o].reverse().find(i=>i.start<t)??o[o.length-1];this.setActive(n==null?void 0:n.id),n&&typeof n.start=="number"&&!isNaN(n.start)&&(this.video.currentTime=n.start)}this.applyActiveRate()}}applyActiveRate(){var o;const e=typeof this.profile.defaultRate=="number"&&!isNaN(this.profile.defaultRate)?this.profile.defaultRate:1,t=((o=this.active)==null?void 0:o.rate)??e;this.video.playbackRate=t}createSegmentFromCurrentTime(e,t){const o=this.video.currentTime;if(o==null||isNaN(o)||typeof o!="number")return console.log("createSegmentFromCurrentTime: currentTime이 유효하지 않음",o),null;const n=typeof this.profile.defaultRate=="number"&&!isNaN(this.profile.defaultRate)?this.profile.defaultRate:1;if(e==="start"){const i=Math.min(o+10,this.video.duration);if(i==null||isNaN(i)||typeof i!="number")return console.log("createSegmentFromCurrentTime: endTime이 유효하지 않음",i),null;let s=t;if(!s){const r=Math.floor(o/60),d=Math.floor(o%60),p=Math.floor(i/60),c=Math.floor(i%60);s=`${r}:${d.toString().padStart(2,"0")}~${p}:${c.toString().padStart(2,"0")}`}const a={id:Math.random().toString(36).substring(2,15),start:o,end:i,rate:n,label:s};return this.profile.segments.push(a),a}else{const i=this.profile.segments[this.profile.segments.length-1];if(i&&i.start<o){if(i.end=o,!i.label||i.label.startsWith("구간 ")){const s=Math.floor(i.start/60),a=Math.floor(i.start%60),r=Math.floor(o/60),d=Math.floor(o%60);i.label=`${s}:${a.toString().padStart(2,"0")}~${r}:${d.toString().padStart(2,"0")}`}return i}}return null}updateSegment(e,t){var s;const o=this.profile.segments.find(a=>a.id===e);if(!o)return!1;const n=t.start!==void 0?t.start:o.start,i=t.end!==void 0?t.end:o.end;return typeof n=="number"&&typeof i=="number"&&!isNaN(n)&&!isNaN(i)&&n>=i?(console.log("구간 업데이트 실패: start가 end보다 크거나 같음",{newStart:n,newEnd:i}),!1):(Object.assign(o,t),((s=this.active)==null?void 0:s.id)===e&&(this.applyActiveRate(),(t.start!==void 0||t.end!==void 0)&&this.active.metronomeEnabled&&!this.video.paused&&(this.stopMetronome(),this.startMetronome())),!0)}deleteSegment(e){var o;const t=this.profile.segments.findIndex(n=>n.id===e);return t===-1?!1:(this.profile.segments.splice(t,1),((o=this.active)==null?void 0:o.id)===e&&this.setActive(null),!0)}setDefaultRate(e){this.profile.defaultRate=e,this.applyActiveRate()}getSegmentAtCurrentTime(){const e=this.video.currentTime;if(e==null||isNaN(e)||typeof e!="number"){console.log("getSegmentAtCurrentTime: currentTime이 유효하지 않음",e);return}return this.profile.segments.find(t=>e>=t.start&&e<=t.end)}toggleMetronome(e){var o;const t=this.profile.segments.find(n=>n.id===e);return t?(t.metronomeEnabled=!t.metronomeEnabled,((o=this.active)==null?void 0:o.id)===e&&(t.metronomeEnabled?this.video.paused||this.startMetronome():this.stopMetronome()),t.metronomeEnabled):!1}isMetronomeEnabled(e){const t=this.profile.segments.find(o=>o.id===e);return(t==null?void 0:t.metronomeEnabled)||!1}startMetronome(){if(!this.active||!this.profile.tempo||!this.profile.timeSignature){console.log("메트로놈 시작 실패: BPM 또는 박자표 미설정");return}const e=this.profile.globalMetronomeOffset||0,t=this.video.currentTime-e,o=this.active.end-this.active.start;this.metronome.start(this.profile.tempo,this.profile.timeSignature,t,o),console.log("메트로놈 시작:",{bpm:this.profile.tempo,timeSignature:this.profile.timeSignature,videoCurrentTime:this.video.currentTime,globalOffset:e,startOffset:t,loopDuration:o})}stopMetronome(){this.metronome.stop(),console.log("메트로놈 중지")}startGlobalSyncMetronome(){if(!this.profile.tempo||!this.profile.timeSignature){console.log("[Global Sync Metronome] 시작 실패: BPM 또는 박자표 미설정");return}this.globalSyncMetronomeActive=!0;const e=this.profile.globalMetronomeOffset||0,t=this.video.currentTime-e;this.metronome.start(this.profile.tempo,this.profile.timeSignature,t),console.log("[Global Sync Metronome] 시작:",{bpm:this.profile.tempo,timeSignature:this.profile.timeSignature,videoCurrentTime:this.video.currentTime,globalOffset:e,startOffset:t})}stopGlobalSyncMetronome(){this.globalSyncMetronomeActive=!1,this.metronome.stop(),console.log("[Global Sync Metronome] 중지")}dispose(){this.metronome.dispose()}}var F=Object.defineProperty,H=(l,e,t)=>e in l?F(l,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):l[e]=t,L=(l,e,t)=>H(l,typeof e!="symbol"?e+"":e,t);class K{constructor(){L(this,"ctx"),L(this,"running",!1)}async run(e){const{beats:t,bpm:o,onComplete:n}=e;if(this.running)return;this.ctx||(this.ctx=new(window.AudioContext||window.webkitAudioContext)),this.running=!0;const i=60/o,s=this.ctx.currentTime+.1;for(let r=0;r<t;r++){const d=s+r*i;this.playCountInClick(d,r===0)}const a=s+t*i;setTimeout(()=>{this.running=!1,n()},(a-this.ctx.currentTime)*1e3)}playCountInClick(e,t){if(!this.ctx)return;const o=this.ctx,n=o.createOscillator(),i=o.createGain();t?(n.frequency.value=600,i.gain.value=.4):(n.frequency.value=1e3,i.gain.value=.2);const s=.05;i.gain.setValueAtTime(0,e),i.gain.linearRampToValueAtTime(i.gain.value,e+.01),i.gain.exponentialRampToValueAtTime(.001,e+s),n.connect(i).connect(o.destination),n.start(e),n.stop(e+s)}isRunning(){return this.running}stop(){this.running=!1}}var W=Object.defineProperty,J=(l,e,t)=>e in l?W(l,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):l[e]=t,E=(l,e,t)=>J(l,typeof e!="symbol"?e+"":e,t);class Q{constructor(){E(this,"container"),E(this,"shadowRoot"),console.log("YouTubeUI 생성")}async inject(){if(this.removeAllContainers(),this.container&&document.body.contains(this.container))return console.log("UI 컨테이너가 이미 존재함"),this.container;const e=await this.waitForSecondary();return e?(this.container=document.createElement("div"),this.container.id="looptube-container",this.container.style.cssText=`
      width: 100%;
      margin-bottom: 16px;
      position: relative;
      z-index: 100;
    `,this.shadowRoot=this.container.attachShadow({mode:"open"}),e.insertBefore(this.container,e.firstChild),console.log("UI 컨테이너 주입 완료"),this.container):(console.log("YouTube secondary 영역을 찾을 수 없음"),null)}removeAllContainers(){document.querySelectorAll("#looptube-container").forEach(t=>{t.parentNode&&(t.parentNode.removeChild(t),console.log("기존 looptube 컨테이너 제거됨"))})}async waitForSecondary(e=50){for(let t=0;t<e;t++){const o=document.querySelector("#secondary");if(o)return console.log(`#secondary 요소 발견 (${t+1}번째 시도)`),o;await new Promise(n=>setTimeout(n,100))}return console.error("#secondary 요소를 찾을 수 없음 (최대 시도 횟수 초과)"),null}render(e,t){if(!this.shadowRoot){console.error("Shadow root가 없음");return}this.shadowRoot.innerHTML=`
      <style>${t}</style>
      ${e}
    `,console.log("UI 렌더링 완료")}querySelector(e){var t;return((t=this.shadowRoot)==null?void 0:t.querySelector(e))||null}querySelectorAll(e){var t;return((t=this.shadowRoot)==null?void 0:t.querySelectorAll(e))||document.querySelectorAll("never-match")}addEventListener(e,t,o){const n=this.querySelector(e);n?n.addEventListener(t,o):console.warn(`요소를 찾을 수 없음: ${e}`)}remove(){this.container&&this.container.parentNode&&(this.container.parentNode.removeChild(this.container),console.log("UI 컨테이너 제거 완료")),this.container=void 0,this.shadowRoot=void 0}isAttached(){return!!(this.container&&document.body.contains(this.container))}}var X=Object.defineProperty,Z=(l,e,t)=>e in l?X(l,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):l[e]=t,b=(l,e,t)=>Z(l,typeof e!="symbol"?e+"":e,t);class ee{constructor(){b(this,"ui"),b(this,"profile"),b(this,"onCommand"),b(this,"isCollapsed",!1),b(this,"isDarkTheme",!1),b(this,"collapsedSegments",new Map),b(this,"draggedSegmentId",null),b(this,"globalSyncMetronomeEnabled",!1),b(this,"tapTimes",[]),this.ui=new Q,this.detectTheme(),this.observeThemeChanges()}async init(e,t){if(this.profile=e,this.onCommand=t,!await this.ui.inject()){console.error("UI 주입 실패");return}this.loadCollapsedState(),this.render(),this.setupEventListeners(),console.log("UIController 초기화 완료")}render(){const e=this.getHTML(),t=this.getStyles();this.ui.render(e,t)}updateProfile(e){this.profile=e,this.render(),this.setupEventListeners()}detectTheme(){const e=document.documentElement;this.isDarkTheme=e.hasAttribute("dark")||e.getAttribute("data-color-scheme")==="dark"}observeThemeChanges(){const e=document.documentElement;new MutationObserver(()=>{const o=this.isDarkTheme;this.detectTheme(),o!==this.isDarkTheme&&(this.render(),this.setupEventListeners())}).observe(e,{attributes:!0,attributeFilter:["dark","data-color-scheme"]})}isMetronomeActive(e){var o;const t=(o=this.profile)==null?void 0:o.segments.find(n=>n.id===e);return(t==null?void 0:t.metronomeEnabled)||!1}isGlobalSyncMetronomeActive(){return this.globalSyncMetronomeEnabled}getMetronomeTooltip(e){var n,i;const t=!!((n=this.profile)!=null&&n.tempo),o=!!((i=this.profile)!=null&&i.timeSignature);return!t&&!o?"Set BPM and Time Signature to enable metronome":t?o?e?"Toggle metronome click sound":"Toggle metronome (will play when loop is active)":"Set Time Signature to enable metronome":"Set BPM to enable metronome"}formatSyncOffset(e){return e.toFixed(3)}setMetronomeActive(e){this.render(),this.setupEventListeners()}getBarInputHTML(e,t,o){var p,c;if(!((p=this.profile)!=null&&p.tempo)||!((c=this.profile)!=null&&c.timeSignature))return"";const n=this.profile.tempo,i=this.profile.timeSignature,s=o-t,a=_(s,n,i),r=Math.max(1,Math.min(16,Math.round(a))),d=Array.from({length:16},(h,m)=>{const g=m+1;return`<option value="${g}" ${g===r?"selected":""}>${g} bar${g>1?"s":""}</option>`}).join("");return`
      <select class="bar-select" data-segment-id="${e}">
        ${d}
      </select>
    `}getDurationOptions(){var i,s,a,r;if(!(((i=this.profile)==null?void 0:i.tempo)||((s=this.profile)==null?void 0:s.timeSignature)))return`
        <option value="5">5 seconds</option>
        <option value="10" selected>10 seconds</option>
        <option value="20">20 seconds</option>
        <option value="30">30 seconds</option>
        <option value="60">60 seconds</option>
        <option disabled>─ Set BPM for bar mode ─</option>
      `;const t=((a=this.profile)==null?void 0:a.tempo)||120,o=((r=this.profile)==null?void 0:r.timeSignature)||"4/4";return`
      <optgroup label="Bars (Recommended)">
        ${Array.from({length:16},(d,p)=>{const c=p+1,h=$(c,t,o),m=c===1?"1 bar":`${c} bars`;return`<option value="bar:${c}" ${c===8?"selected":""}>${m} (${h.toFixed(1)}s)</option>`}).join("")}
      </optgroup>
      <optgroup label="Seconds">
        <option value="5">5 seconds</option>
        <option value="10">10 seconds</option>
        <option value="20">20 seconds</option>
        <option value="30">30 seconds</option>
        <option value="60">60 seconds</option>
      </optgroup>
    `}getHTML(){if(!this.profile)return"";const e=this.profile.segments.map(a=>this.getSegmentHTML(a)).join(""),t=this.isCollapsed?'<svg viewBox="0 0 24 24" width="24" height="24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" fill="currentColor"/></svg>':'<svg viewBox="0 0 24 24" width="24" height="24"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" fill="currentColor"/></svg>',o=this.profile.videoTitle||"YouTube Video",n=this.profile.channelName||"Unknown Channel",i=this.profile.tempo,s=this.profile.timeSignature;return`
      <div class="looptube-panel ${this.isCollapsed?"collapsed":""}">
        <div class="header" id="panelHeader">
          <div class="header-left">
            <button class="toggle-btn" id="toggleBtn" aria-label="${this.isCollapsed?"Expand":"Collapse"}">
              ${t}
            </button>
            <h1>Loop Practice for YouTube</h1>
          </div>
          <div class="loop-count">${this.profile.segments.length} loops</div>
        </div>

        <div class="panel-content" style="display: ${this.isCollapsed?"none":"block"}">
          <!-- Video Info Card -->
          <div class="video-info-section">
            <div class="video-info">
              <div class="video-title" title="${o}">${o}</div>
              <div class="channel-name">${n}</div>
            </div>

            <div class="global-settings">
              <div class="settings-row">
                <div class="setting-group">
                  <label>Tempo (BPM):</label>
                  <div class="tempo-controls">
                    <input type="text" id="tempoInput" class="tempo-input" value="${i||"---"}" data-placeholder="---">
                    <button class="btn btn-small btn-tap" id="tapTempo">TAP</button>
                  </div>
                </div>

                <div class="setting-group">
                  <label>Time Signature:</label>
                  <select id="timeSignature" class="time-signature-select">
                    <option value="" ${s?"":"selected"}>---</option>
                    <option value="2/4" ${s==="2/4"?"selected":""}>2/4</option>
                    <option value="3/4" ${s==="3/4"?"selected":""}>3/4</option>
                    <option value="4/4" ${s==="4/4"?"selected":""}>4/4</option>
                    <option value="5/4" ${s==="5/4"?"selected":""}>5/4</option>
                    <option value="3/8" ${s==="3/8"?"selected":""}>3/8</option>
                    <option value="6/8" ${s==="6/8"?"selected":""}>6/8</option>
                    <option value="7/8" ${s==="7/8"?"selected":""}>7/8</option>
                    <option value="9/8" ${s==="9/8"?"selected":""}>9/8</option>
                    <option value="12/8" ${s==="12/8"?"selected":""}>12/8</option>
                    <option value="6/4" ${s==="6/4"?"selected":""}>6/4</option>
                  </select>
                </div>
              </div>

              <!-- Global Sync 기능 임시 숨김 (로직은 유지) -->
              <!--
              <div class="setting-group global-sync-group" style="display: none;">
                <label>Global Sync:</label>
                <div class="sync-controls">
                  <button
                    class="btn-metronome ${this.isGlobalSyncMetronomeActive()?"active":""}"
                    id="globalSyncMetronome"
                    ${!i||!s?"disabled":""}
                    title="Toggle metronome for global sync adjustment"
                  >
                    ♪
                  </button>
                  <input
                    type="text"
                    id="globalSyncInput"
                    class="sync-input"
                    value="${this.formatSyncOffset(this.profile.globalMetronomeOffset||0)}"
                    ${!i||!s?"disabled":""}
                  >
                  <span class="sync-unit">s</span>
                  <button
                    class="btn btn-small btn-sync"
                    id="syncGlobal"
                    ${!i||!s?"disabled":""}
                    title="Apply global sync to all loops"
                  >
                    SYNC
                  </button>
                </div>
              </div>
              -->
            </div>
          </div>

          <!-- Loop Management Card -->
          <div class="controls-section">
            <div class="control-group">
              <label>Loop Management:</label>
              <div class="segment-management">
                <input
                  type="text"
                  id="segmentLabel"
                  class="segment-input label-input"
                  list="labelPresets"
                  placeholder="Loop name..."
                />
                <datalist id="labelPresets">
                  <option value="Intro">
                  <option value="Verse">
                  <option value="Chorus">
                  <option value="Bridge">
                  <option value="Outro">
                </datalist>
                <select id="loopDuration" class="segment-input duration-select">
                  ${this.getDurationOptions()}
                </select>
                <button class="btn btn-small btn-primary" id="createSegment">Create</button>
              </div>
            </div>
          </div>

          <div class="segments-list" id="segmentsList">
            ${e||'<div class="no-loops">No loops yet. Create one!</div>'}
          </div>
        </div>
      </div>
    `}getSegmentHTML(e){var d,p,c;const t=e.id===((d=this.profile)==null?void 0:d.activeSegmentId),o=this.collapsedSegments.get(e.id)||!1,n=e.label||"Loop",i=typeof e.start=="number"&&!isNaN(e.start)?e.start:0,s=typeof e.end=="number"&&!isNaN(e.end)?e.end:10,a=typeof e.rate=="number"&&!isNaN(e.rate)?e.rate:1,r=o?'<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>':'<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>';return`
      <div class="segment-item ${t?"active":""} ${o?"collapsed":""}" data-segment-id="${e.id}" draggable="true">
        <div class="segment-header">
          <button class="collapse-toggle-btn" data-segment-id="${e.id}" data-action="toggle-collapse" title="${o?"Expand":"Collapse"}">
            ${r}
          </button>
          <div class="segment-label">
            <span class="label-text">${n}</span>
            <button class="label-edit-btn" data-segment-id="${e.id}" data-action="edit-label">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
            </button>
          </div>
          ${o?`
          <div class="segment-time-range">${this.formatTime(i)} ~ ${this.formatTime(s)}</div>
          <button class="btn btn-loop-compact ${t?"active":""}" data-segment-id="${e.id}" data-action="jump-and-activate" title="Activate loop">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
            </svg>
          </button>
          `:""}
          <div class="menu-container">
            <button class="btn-menu" data-segment-id="${e.id}" data-action="toggle-menu" title="More options">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
            <div class="menu-dropdown" data-segment-id="${e.id}" style="display: none;">
              <button class="menu-item menu-delete" data-segment-id="${e.id}" data-action="delete">Delete</button>
            </div>
          </div>
        </div>
        <div class="segment-body" style="${o?"display: none;":""}">
          <div class="segment-controls">
            <div class="time-input-group">
              <label>Start:</label>
              <input type="text" class="time-input" data-segment-id="${e.id}" data-time-type="start"
                     value="${this.formatTime(i)}" placeholder="0:00.000">
              <button class="time-set-btn" data-segment-id="${e.id}" data-action="set-start-time" title="Set to current time">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                </svg>
              </button>
            </div>
            <div class="time-input-group">
              <label>End:</label>
              <input type="text" class="time-input" data-segment-id="${e.id}" data-time-type="end"
                     value="${this.formatTime(s)}" placeholder="0:00.000">
              ${this.getBarInputHTML(e.id,i,s)}
              <button class="time-set-btn" data-segment-id="${e.id}" data-action="set-end-time" title="Set to current time">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                </svg>
              </button>
            </div>
            <div class="rate-control-group">
              <label>Speed:</label>
              <button class="rate-btn" data-segment-id="${e.id}" data-action="decrease-rate">-</button>
              <div class="rate-input-container">
                <input type="text" class="rate-input" data-segment-id="${e.id}"
                       value="${Math.round(a*100)}" readonly>
                <span class="rate-unit">%</span>
              </div>
              <button class="rate-btn" data-segment-id="${e.id}" data-action="increase-rate">+</button>
            </div>
          </div>
          <div class="segment-actions">
            <div class="action-buttons-vertical">
              <button class="btn btn-loop ${t?"active":""}" data-segment-id="${e.id}" data-action="jump-and-activate" title="Activate loop">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                </svg>
              </button>
              <!-- 메트로놈 버튼 임시 숨김 (로직은 유지) -->
              <!--
              <button class="btn btn-metronome ${this.isMetronomeActive(e.id)?"active":""}"
                      data-segment-id="${e.id}"
                      data-action="toggle-metronome"
                      ${!((p=this.profile)!=null&&p.tempo)||!((c=this.profile)!=null&&c.timeSignature)?"disabled":""}
                      title="${this.getMetronomeTooltip(t)}">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 2L6 20h12L12 2zm0 3.5l3.5 12.5h-7L12 5.5z"/>
                  <path d="M12 6v8"/>
                  <circle cx="12" cy="10" r="1.5"/>
                </svg>
              </button>
              -->
            </div>
          </div>
        </div>
      </div>
    `}getStyles(){const e=this.isDarkTheme?"#212121":"#fff",t=this.isDarkTheme?"#0f0f0f":"#f9f9f9",o=this.isDarkTheme?"#fff":"#030303",n=this.isDarkTheme?"#aaa":"#606060",i=this.isDarkTheme?"#3f3f3f":"#e5e5e5",s=this.isDarkTheme?"#3f3f3f":"#f2f2f2",a=this.isDarkTheme?"#121212":"#fff",r=this.isDarkTheme?"#303030":"#ccc";return`
      * {
        box-sizing: border-box;
      }

      .looptube-panel {
        font-family: Roboto, Arial, sans-serif;
        background: ${e};
        border-radius: 12px;
        padding: 0;
        box-shadow: none;
        border: 1px solid ${i};
      }

      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid ${i};
        cursor: pointer;
        user-select: none;
      }

      .header-left {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
      }

      .toggle-btn {
        background: transparent;
        border: none;
        padding: 0;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        color: ${o};
        transition: background-color 0.2s;
        border-radius: 50%;
      }

      .toggle-btn:hover {
        background: ${s};
      }

      .header h1 {
        margin: 0;
        font-size: 16px;
        font-weight: 500;
        color: ${o};
      }

      .loop-count {
        background: ${this.isDarkTheme?"#3f3f3f":"#f2f2f2"};
        color: ${o};
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 400;
      }

      .panel-content {
        padding: 12px 16px;
      }

      /* Video Info Section */
      .video-info-section {
        background: ${t};
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 12px;
        border: 1px solid ${i};
      }

      .video-info {
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid ${i};
      }

      .video-title {
        font-size: 14px;
        font-weight: 500;
        color: ${o};
        margin-bottom: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .channel-name {
        font-size: 12px;
        color: ${n};
      }

      .global-settings {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .settings-row {
        display: flex;
        gap: 12px;
      }

      .setting-group {
        flex: 1;
      }

      .setting-group label {
        display: block;
        font-size: 11px;
        font-weight: 400;
        color: ${n};
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .tempo-controls {
        display: flex;
        gap: 6px;
        align-items: stretch;
      }

      .tempo-input {
        flex: 1;
        padding: 6px 10px;
        border: 1px solid ${r};
        border-radius: 2px;
        font-size: 13px;
        background: ${a};
        color: ${o};
        cursor: ns-resize;
      }

      .tempo-input:focus {
        outline: none;
        border-color: #065fd4;
      }

      .tempo-input::-webkit-inner-spin-button,
      .tempo-input::-webkit-outer-spin-button {
        opacity: 1;
      }

      .btn-tap {
        flex: 0 0 auto;
        background: ${this.isDarkTheme?"#3f3f3f":"#e0e0e0"};
        color: ${o};
        font-weight: 600;
        padding: 6px 12px;
      }

      .btn-tap:hover {
        background: ${this.isDarkTheme?"#505050":"#d0d0d0"};
      }

      .btn-tap:active {
        background: #065fd4;
        color: white;
      }

      .time-signature-select {
        width: 100%;
        padding: 6px 10px;
        border: 1px solid ${r};
        border-radius: 2px;
        font-size: 13px;
        background: ${a};
        color: ${o};
      }

      .time-signature-select:focus {
        outline: none;
        border-color: #065fd4;
      }

      .global-sync-group {
        /* Global sync는 이미 settings row 아래에 위치하므로 margin-top 불필요 */
      }

      .sync-controls {
        display: flex;
        gap: 4px;
        align-items: center;
      }

      .sync-input {
        flex: 1;
        padding: 6px 10px;
        border: 1px solid ${r};
        border-radius: 2px;
        font-size: 13px;
        background: ${a};
        color: ${o};
        text-align: right;
        cursor: ns-resize;
        font-family: 'Roboto Mono', monospace;
      }

      .sync-input:focus {
        outline: none;
        border-color: #065fd4;
      }

      .sync-input:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .sync-unit {
        font-size: 12px;
        color: ${n};
        margin-right: 4px;
      }

      .btn-sync {
        flex: 0 0 auto;
        background: ${this.isDarkTheme?"#3f3f3f":"#e0e0e0"};
        color: ${o};
        font-weight: 600;
        padding: 6px 12px;
      }

      .btn-sync:hover:not(:disabled) {
        background: ${this.isDarkTheme?"#505050":"#d0d0d0"};
      }

      .btn-sync:active:not(:disabled) {
        background: #065fd4;
        color: white;
      }

      .btn-sync:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .controls-section {
        background: ${t};
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 12px;
        border: 1px solid ${i};
      }

      .control-group {
        margin-bottom: 0;
      }

      .control-group label {
        display: block;
        font-size: 12px;
        font-weight: 400;
        color: ${n};
        margin-bottom: 6px;
      }

      .segment-management {
        display: flex;
        gap: 6px;
        align-items: center;
      }

      .segment-input {
        flex: 1;
        padding: 6px 10px;
        border: 1px solid ${r};
        border-radius: 2px;
        font-size: 13px;
        background: ${a};
        color: ${o};
      }

      .segment-input:focus {
        outline: none;
        border-color: #065fd4;
      }

      .duration-select {
        flex: 0 0 auto;
        width: 90px;
        margin-right: 0;
        font-size: 12px;
        padding: 6px 8px;
      }

      #createSegment {
        flex-shrink: 0;
        white-space: nowrap;
      }

      .btn {
        padding: 6px 12px;
        border: none;
        border-radius: 18px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .btn-small {
        padding: 6px 12px;
        font-size: 12px;
      }

      .btn-primary {
        background: #065fd4;
        color: white;
      }

      .btn-primary:hover {
        background: #0553c2;
      }

      .btn-secondary {
        background: ${this.isDarkTheme?"#3f3f3f":"#0000000d"};
        color: ${this.isDarkTheme?"#fff":"#030303"};
      }

      .btn-secondary:hover {
        background: ${this.isDarkTheme?"#4f4f4f":"#0000001a"};
      }

      .btn-loop {
        background: ${this.isDarkTheme?"#3f3f3f":"#f9f9f9"};
        color: ${n};
        border: 1px solid ${i};
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 12px;
        border-radius: 8px;
        width: 100%;
        height: 100%;
        min-width: 48px;
      }

      .btn-loop:hover {
        background: ${this.isDarkTheme?"#4f4f4f":"#f2f2f2"};
      }

      .btn-loop.active {
        background: #065fd4;
        color: white;
        border-color: #065fd4;
      }

      .btn-loop svg {
        display: block;
      }

      .segments-list {
        max-height: 400px;
        overflow-y: auto;
        background: transparent;
        border-radius: 8px;
        padding: 0;
      }

      .no-loops {
        text-align: center;
        color: ${n};
        padding: 24px;
        font-size: 14px;
      }

      .segment-item {
        display: flex;
        flex-direction: column;
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 8px;
        background: ${t};
        transition: all 0.2s;
        border: 1px solid ${i};
        cursor: default;
      }

      .segment-item:hover {
        background: ${s};
      }

      .segment-item.active {
        background: ${this.isDarkTheme?"#0d3a72":"#e8f0fe"};
        border: 1px solid #065fd4;
      }

      .segment-item.dragging {
        opacity: 0.5;
        cursor: default;
      }

      .segment-item.drag-over {
        border: 2px dashed #065fd4;
        background: ${this.isDarkTheme?"#1a4d8f":"#d2e3fc"};
      }

      .segment-header {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
        gap: 8px;
      }

      .segment-item.collapsed {
        padding: 8px 12px;
      }

      .segment-item.collapsed .segment-header {
        margin-bottom: 0;
      }

      .collapse-toggle-btn {
        background: transparent;
        border: none;
        color: ${n};
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        cursor: pointer;
        border-radius: 4px;
        transition: all 0.2s;
        flex-shrink: 0;
      }

      .collapse-toggle-btn:hover {
        background: ${this.isDarkTheme?"#3f3f3f":"#f0f0f0"};
        color: ${o};
      }

      .segment-time-range {
        font-size: 11px;
        color: ${n};
        font-family: 'Courier New', monospace;
        white-space: nowrap;
        margin-right: 8px;
      }

      .btn-loop-compact {
        background: ${this.isDarkTheme?"#3f3f3f":"#f9f9f9"};
        color: ${n};
        border: 1px solid ${i};
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 6px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        flex-shrink: 0;
      }

      .btn-loop-compact:hover {
        background: ${this.isDarkTheme?"#4f4f4f":"#f2f2f2"};
      }

      .btn-loop-compact.active {
        background: #065fd4;
        color: white;
        border-color: #065fd4;
      }

      .segment-item.collapsed .segment-body {
        display: none !important;
      }

      .segment-body {
        display: flex;
        gap: 12px;
        align-items: stretch;
      }

      .segment-controls {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1;
        min-width: 0;
        overflow: hidden;
      }

      .segment-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 500;
        font-size: 14px;
        color: ${o};
        flex: 1;
        min-width: 0;
      }

      .segment-label .label-text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .label-edit-btn {
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 4px;
        transition: all 0.2s;
        border-radius: 50%;
        color: ${n};
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .label-edit-btn:hover {
        background: ${s};
        color: ${o};
      }

      .label-edit-btn svg {
        display: block;
      }

      .label-input {
        flex: 1;
        padding: 4px 8px;
        border: 1px solid ${r};
        border-radius: 2px;
        font-size: 11px;
        background: ${a};
        color: ${o};
        cursor: pointer;
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
      }

      .label-input:focus {
        outline: none;
        border-color: #065fd4;
      }

      .time-input-group {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: ${n};
        flex-wrap: nowrap;
      }

      .time-input-group label {
        flex: 0 0 38px;
        font-size: 11px;
        margin: 0;
        color: ${n};
      }

      .time-input {
        flex: 1;
        min-width: 70px;
        padding: 4px 6px;
        border: 1px solid ${r};
        border-radius: 2px;
        font-size: 11px;
        text-align: center;
        background: ${a};
        color: ${o};
        font-family: 'Courier New', monospace;
        cursor: ns-resize;
        user-select: none;
      }

      .bar-select {
        flex: 0 0 70px;
        padding: 4px 4px;
        border: 1px solid ${r};
        border-radius: 2px;
        font-size: 10px;
        background: ${a};
        color: ${o};
        cursor: pointer;
      }

      .bar-select:focus {
        outline: none;
        border-color: #065fd4;
      }

      .time-input:focus {
        outline: none;
        border-color: #065fd4;
        user-select: text;
        cursor: text;
      }

      .time-input.dragging {
        border-color: #065fd4;
        background: ${this.isDarkTheme?"#1a1a1a":"#f0f7ff"};
        cursor: ns-resize;
      }

      .time-set-btn {
        background: ${this.isDarkTheme?"#3f3f3f":"#e5e5e5"};
        color: ${o};
        border: none;
        border-radius: 50%;
        padding: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        flex-shrink: 0;
        width: 24px;
        height: 24px;
      }

      .time-set-btn:hover {
        background: ${this.isDarkTheme?"#4f4f4f":"#d0d0d0"};
      }

      .time-set-btn svg {
        display: block;
      }

      .rate-control-group {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: ${n};
      }

      .rate-control-group label {
        flex: 0 0 38px;
        margin: 0;
      }

      .rate-input-container {
        display: flex;
        align-items: center;
        gap: 4px;
        flex: 1;
        min-width: 50px;
      }

      .rate-btn {
        background: ${this.isDarkTheme?"#3f3f3f":"#e5e5e5"};
        color: ${o};
        border: none;
        border-radius: 2px;
        font-size: 12px;
        padding: 4px 8px;
        cursor: pointer;
        min-width: 24px;
        font-weight: 500;
      }

      .rate-btn:hover {
        background: ${this.isDarkTheme?"#4f4f4f":"#d0d0d0"};
      }

      .rate-input {
        flex: 1;
        padding: 4px 6px;
        border: 1px solid ${r};
        border-radius: 2px;
        font-size: 11px;
        text-align: center;
        min-width: 50px;
        background: ${a};
        color: ${o};
        cursor: ns-resize;
        user-select: none;
        font-family: 'Courier New', monospace;
      }

      .rate-input:focus {
        outline: none;
        border-color: #065fd4;
      }

      .rate-input.dragging {
        border-color: #065fd4;
        background: ${this.isDarkTheme?"#1a1a1a":"#f0f7ff"};
        cursor: ns-resize;
      }

      /* number input 기본 스피너 제거 */
      .rate-input::-webkit-outer-spin-button,
      .rate-input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      .rate-input[type=number] {
        -moz-appearance: textfield;
      }

      .rate-unit {
        font-size: 11px;
        color: ${n};
      }

      .segment-actions {
        display: flex;
        align-items: stretch;
        min-width: 60px;
      }

      .action-buttons-vertical {
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: 100%;
      }

      .btn-metronome {
        background: ${this.isDarkTheme?"#3f3f3f":"#f9f9f9"};
        color: ${n};
        border: 2px solid ${i};
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 6px;
        border-radius: 8px;
        width: 100%;
        height: 32px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-metronome:hover:not(:disabled) {
        background: ${this.isDarkTheme?"#4f4f4f":"#f2f2f2"};
      }

      .btn-metronome.active {
        background: ${this.isDarkTheme?"#3f3f3f":"#f9f9f9"};
        color: ${o};
        border-color: #8B6F47;
        border-width: 2px;
      }

      .btn-metronome:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .btn-metronome svg {
        display: block;
      }

      .menu-container {
        position: relative;
      }

      .btn-menu {
        background: transparent;
        border: none;
        padding: 4px;
        cursor: pointer;
        border-radius: 50%;
        transition: all 0.2s;
        color: ${n};
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .btn-menu:hover {
        background: ${this.isDarkTheme?"#3f3f3f":"#f2f2f2"};
        color: ${o};
      }

      .btn-menu svg {
        display: block;
      }

      .menu-dropdown {
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 4px;
        background: ${e};
        border: 1px solid ${i};
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        min-width: 120px;
        z-index: 1000;
        overflow: hidden;
      }

      .menu-item {
        display: block;
        width: 100%;
        padding: 10px 16px;
        background: transparent;
        border: none;
        text-align: left;
        font-size: 13px;
        color: ${o};
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .menu-item:hover {
        background: ${s};
      }

      .menu-delete {
        color: ${this.isDarkTheme?"#ff6b6b":"#cc0000"};
      }

      .menu-delete:hover {
        background: ${this.isDarkTheme?"#3f1f1f":"#ffebee"};
      }

      /* 스크롤바 스타일 */
      .segments-list::-webkit-scrollbar {
        width: 8px;
      }

      .segments-list::-webkit-scrollbar-track {
        background: transparent;
      }

      .segments-list::-webkit-scrollbar-thumb {
        background: ${this.isDarkTheme?"#3f3f3f":"#ccc"};
        border-radius: 4px;
      }

      .segments-list::-webkit-scrollbar-thumb:hover {
        background: ${this.isDarkTheme?"#4f4f4f":"#aaa"};
      }
    `}setupEventListeners(){if(!this.ui.isAttached()){console.log("UI가 아직 첨부되지 않음");return}const e=this.ui.querySelector("#toggleBtn");e&&e.addEventListener("click",h=>{h.stopPropagation(),this.toggleCollapse()});const t=this.ui.querySelector("#panelHeader");t&&t.addEventListener("click",h=>{h.target.closest("#toggleBtn")||this.toggleCollapse()});const o=this.ui.querySelector("#createSegment");o&&o.addEventListener("click",()=>this.handleCreateSegment());const n=this.ui.querySelector("#segmentLabel");n&&this.preventYouTubeShortcuts(n);const i=this.ui.querySelector("#tempoInput");i&&(this.preventYouTubeShortcuts(i),i.addEventListener("focus",h=>{const m=h.target;m.value==="---"&&(m.value="")}),i.addEventListener("blur",h=>{const m=h.target;m.value.trim()===""&&(m.value="---")}),i.addEventListener("change",h=>this.handleTempoChange(h)),i.addEventListener("mousedown",h=>this.handleTempoInputMouseDown(h)));const s=this.ui.querySelector("#tapTempo");s&&s.addEventListener("click",()=>this.handleTapTempo());const a=this.ui.querySelector("#timeSignature");a&&a.addEventListener("change",h=>this.handleTimeSignatureChange(h));const r=this.ui.querySelector("#globalSyncInput");r&&(this.preventYouTubeShortcuts(r),r.addEventListener("change",h=>this.handleGlobalSyncChange(h)),r.addEventListener("mousedown",h=>this.handleGlobalSyncInputMouseDown(h)));const d=this.ui.querySelector("#syncGlobal");d&&d.addEventListener("click",()=>this.handleSyncGlobal());const p=this.ui.querySelector("#globalSyncMetronome");p&&p.addEventListener("click",()=>this.handleGlobalSyncMetronomeToggle());const c=this.ui.querySelector("#segmentsList");c&&(c.addEventListener("click",u=>this.handleSegmentClick(u)),c.addEventListener("blur",u=>this.handleInputBlur(u),!0),c.addEventListener("keydown",u=>this.handleInputKeydown(u),!0),c.addEventListener("input",u=>this.handleInputChange(u),!0),c.addEventListener("mousedown",u=>{const y=u.target;y.classList.contains("time-input")?this.handleTimeInputMouseDown(u):y.classList.contains("rate-input")&&this.handleRateInputMouseDown(u)},!0),c.addEventListener("change",u=>{u.target.classList.contains("bar-select")&&this.handleBarSelectChange(u)},!0),c.querySelectorAll(".time-input").forEach(u=>this.preventYouTubeShortcuts(u)),c.querySelectorAll(".rate-input").forEach(u=>this.preventYouTubeShortcuts(u)),c.querySelectorAll(".bar-select").forEach(u=>this.preventYouTubeShortcuts(u)),c.addEventListener("dragstart",u=>this.handleDragStart(u)),c.addEventListener("dragover",u=>this.handleDragOver(u)),c.addEventListener("drop",u=>this.handleDrop(u)),c.addEventListener("dragend",u=>this.handleDragEnd(u)),c.addEventListener("dragleave",u=>this.handleDragLeave(u)))}preventYouTubeShortcuts(e){e.addEventListener("keydown",t=>{t.stopPropagation()}),e.addEventListener("keyup",t=>{t.stopPropagation()}),e.addEventListener("keypress",t=>{t.stopPropagation()})}toggleCollapse(){this.isCollapsed=!this.isCollapsed,this.render(),this.setupEventListeners()}handleCreateSegment(){var i,s;const e=this.ui.querySelector("#segmentLabel"),t=this.ui.querySelector("#loopDuration"),o=((i=e==null?void 0:e.value)==null?void 0:i.trim())||"",n=(t==null?void 0:t.value)||"10";(s=this.onCommand)==null||s.call(this,"create-segment",{label:o,duration:n}),e&&(e.value="")}handleSegmentClick(e){const t=e.target;console.log("handleSegmentClick:",{tagName:t.tagName,classList:Array.from(t.classList),targetElement:t});let o=t;if(t.tagName==="svg"||t.tagName==="path"){const n=t.closest("button");n&&(o=n,console.log("SVG 클릭 감지, 부모 버튼 찾음:",o))}if(o.tagName==="BUTTON"||o.tagName==="INPUT"){const n=o.getAttribute("data-segment-id"),i=o.getAttribute("data-action");console.log("세그먼트 클릭 이벤트:",{segmentId:n,action:i}),n&&i?this.handleAction(i,n):console.warn("segmentId 또는 action이 없음:",{segmentId:n,action:i})}}handleAction(e,t){var o,n,i,s,a,r,d;switch(console.log("handleAction 호출됨:",{action:e,segmentId:t}),e){case"jump-and-activate":console.log("jump-and-activate 액션 실행"),(o=this.onCommand)==null||o.call(this,"jump-and-activate",{segmentId:t});break;case"delete":console.log("delete 액션 실행"),this.closeAllMenus(),(n=this.onCommand)==null||n.call(this,"delete-segment",{segmentId:t});break;case"toggle-menu":console.log("toggle-menu 액션 실행"),this.toggleMenu(t);break;case"edit-label":console.log("edit-label 액션 실행"),this.editSegmentLabel(t);break;case"set-start-time":console.log("set-start-time 액션 실행"),(i=this.onCommand)==null||i.call(this,"set-start-time",{segmentId:t});break;case"set-end-time":console.log("set-end-time 액션 실행"),(s=this.onCommand)==null||s.call(this,"set-end-time",{segmentId:t});break;case"decrease-rate":console.log("decrease-rate 액션 실행"),(a=this.onCommand)==null||a.call(this,"decrease-rate",{segmentId:t});break;case"increase-rate":console.log("increase-rate 액션 실행"),(r=this.onCommand)==null||r.call(this,"increase-rate",{segmentId:t});break;case"toggle-metronome":console.log("toggle-metronome 액션 실행"),(d=this.onCommand)==null||d.call(this,"toggle-metronome",{segmentId:t});break;case"toggle-collapse":console.log("toggle-collapse 액션 실행"),this.handleToggleCollapse(t);break;default:console.warn("알 수 없는 액션:",e)}}toggleMenu(e){const t=this.ui.querySelector(`.menu-dropdown[data-segment-id="${e}"]`);if(!t)return;const o=t.style.display!=="none";if(this.closeAllMenus(),!o){t.style.display="block";const n=i=>{i.target.closest(".menu-container")||(this.closeAllMenus(),document.removeEventListener("click",n))};setTimeout(()=>{document.addEventListener("click",n)},0)}}closeAllMenus(){this.ui.querySelectorAll(".menu-dropdown").forEach(t=>{t.style.display="none"})}editSegmentLabel(e){var d;const t=this.ui.querySelector(`[data-segment-id="${e}"]`);if(!t)return;const o=t.querySelector(".label-text");if(!o)return;const n=o.textContent||"",i=document.createElement("input");i.type="text",i.className="label-input",i.value=n;let s=!1;const a=()=>{var c;if(s)return;s=!0;const p=i.value.trim()||"Loop";p!==n&&((c=this.onCommand)==null||c.call(this,"update-label",{segmentId:e,label:p})),o.textContent=p,i.parentNode&&i.parentNode.removeChild(i),o.style.display="inline"},r=()=>{s||(s=!0,o.textContent=n,o.style.display="inline",i.parentNode&&i.parentNode.removeChild(i))};i.addEventListener("blur",a),i.addEventListener("keydown",p=>{p.key==="Enter"?(p.preventDefault(),a()):p.key==="Escape"&&(p.preventDefault(),r())}),this.preventYouTubeShortcuts(i),o.style.display="none",(d=o.parentNode)==null||d.insertBefore(i,o),i.focus(),i.select()}handleInputBlur(e){var o,n;const t=e.target;if(t.classList.contains("time-input")){const i=t.getAttribute("data-segment-id"),s=t.getAttribute("data-time-type");if(i&&s){const a=this.parseTimeInput(t.value);if(a!==null)(o=this.onCommand)==null||o.call(this,"update-time",{segmentId:i,timeType:s,time:a});else{const r=(n=this.profile)==null?void 0:n.segments.find(d=>d.id===i);r&&(t.value=this.formatTime(s==="start"?r.start:r.end))}}}}handleInputKeydown(e){const t=e.target;t.classList.contains("time-input")&&e.key==="Enter"&&(e.preventDefault(),t.blur())}handleInputChange(e){var o;const t=e.target;if(t.classList.contains("rate-input")){const n=t.getAttribute("data-segment-id");if(n){const i=parseFloat(t.value)/100;!isNaN(i)&&i>=.05&&i<=1.6&&((o=this.onCommand)==null||o.call(this,"update-rate",{segmentId:n,rate:i}))}}}handleTimeInputMouseDown(e){var p;const t=e.target;if(!t.classList.contains("time-input")||document.activeElement===t)return;e.preventDefault();const o=t.getAttribute("data-segment-id"),n=t.getAttribute("data-time-type");if(!o||!n)return;const i=(p=this.profile)==null?void 0:p.segments.find(c=>c.id===o);if(!i)return;const s=e.clientY,a=n==="start"?i.start:i.end;t.classList.add("dragging");const r=c=>{var y;const h=s-c.clientY,m=c.shiftKey?.001:.01,g=h*m;let u=Math.max(0,a+g);u=Math.round(u*1e3)/1e3,n==="start"&&i.end!==void 0?u=Math.min(u,i.end-.001):n==="end"&&i.start!==void 0&&(u=Math.max(u,i.start+.001)),t.value=this.formatTime(u),(y=this.onCommand)==null||y.call(this,"update-time",{segmentId:o,timeType:n,time:u})},d=()=>{t.classList.remove("dragging"),document.removeEventListener("mousemove",r),document.removeEventListener("mouseup",d)};document.addEventListener("mousemove",r),document.addEventListener("mouseup",d)}handleBarSelectChange(e){var r,d,p,c;const t=e.target,o=t.getAttribute("data-segment-id");if(!o)return;const n=(r=this.profile)==null?void 0:r.segments.find(h=>h.id===o);if(!n||!((d=this.profile)!=null&&d.tempo)||!((p=this.profile)!=null&&p.timeSignature))return;const i=this.profile.tempo,s=this.profile.timeSignature,a=parseInt(t.value,10);if(!isNaN(a)&&a>=1){const h=$(a,i,s),m=n.start+h;(c=this.onCommand)==null||c.call(this,"update-time",{segmentId:o,timeType:"end",time:m})}}handleRateInputMouseDown(e){var d;const t=e.target;if(!t.classList.contains("rate-input")||document.activeElement===t)return;e.preventDefault();const o=t.getAttribute("data-segment-id");if(!o)return;const n=(d=this.profile)==null?void 0:d.segments.find(p=>p.id===o);if(!n)return;const i=e.clientY,s=n.rate||1;t.classList.add("dragging");const a=p=>{var u;const h=(i-p.clientY)*.01;let m=s+h;m=Math.max(.05,Math.min(1.6,m)),m=Math.round(m*100)/100;const g=Math.round(m*100);t.value=g.toString(),(u=this.onCommand)==null||u.call(this,"update-rate",{segmentId:o,rate:m})},r=()=>{t.classList.remove("dragging"),document.removeEventListener("mousemove",a),document.removeEventListener("mouseup",r)};document.addEventListener("mousemove",a),document.addEventListener("mouseup",r)}parseTimeInput(e){const t=e.trim();if(!t)return null;const o=t.split(":");if(o.length===2){const i=parseInt(o[0],10),s=o[1].split("."),a=parseInt(s[0],10),r=s[1]?parseInt(s[1].padEnd(3,"0").substring(0,3),10):0;return!isNaN(i)&&!isNaN(a)&&i>=0&&a>=0&&a<60?i*60+a+r/1e3:null}const n=parseFloat(t);return!isNaN(n)&&n>=0?n:null}formatTime(e){if(typeof e!="number"||isNaN(e))return"0:00.000";const t=Math.floor(e/60),o=Math.floor(e%60),n=Math.floor(e%1*1e3);return`${t}:${o.toString().padStart(2,"0")}.${n.toString().padStart(3,"0")}`}handleTempoChange(e){var i,s;const t=e.target,o=t.value.trim();if(o==="---"||o===""){t.value="---",(i=this.onCommand)==null||i.call(this,"update-tempo",{tempo:void 0});return}let n=parseInt(o,10);isNaN(n)||n<20?n=20:n>300&&(n=300),t.value=n.toString(),(s=this.onCommand)==null||s.call(this,"update-tempo",{tempo:n})}handleTempoInputMouseDown(e){const t=e.target;if(document.activeElement===t)return;e.preventDefault();const o=e.clientY,n=t.value.trim(),i=n==="---"||n===""?120:parseInt(n,10);t.classList.add("dragging");const s=r=>{var h;const d=o-r.clientY,p=Math.round(d/5);let c=i+p;c=Math.max(20,Math.min(300,c)),t.value=c.toString(),(h=this.onCommand)==null||h.call(this,"update-tempo",{tempo:c})},a=()=>{t.classList.remove("dragging"),document.removeEventListener("mousemove",s),document.removeEventListener("mouseup",a)};document.addEventListener("mousemove",s),document.addEventListener("mouseup",a)}handleTapTempo(){var a;const e=Date.now();if(this.tapTimes.length>0&&e-this.tapTimes[this.tapTimes.length-1]>2e3&&(this.tapTimes=[]),this.tapTimes.push(e),this.tapTimes.length<2)return;this.tapTimes.length>8&&this.tapTimes.shift();const t=[];for(let r=1;r<this.tapTimes.length;r++)t.push(this.tapTimes[r]-this.tapTimes[r-1]);const o=t.reduce((r,d)=>r+d,0)/t.length,n=Math.round(6e4/o),i=Math.max(20,Math.min(300,n)),s=this.ui.querySelector("#tempoInput");s&&(s.value=i.toString()),(a=this.onCommand)==null||a.call(this,"update-tempo",{tempo:i})}handleTimeSignatureChange(e){var n;const t=e.target,o=t.value===""?void 0:t.value;(n=this.onCommand)==null||n.call(this,"update-time-signature",{timeSignature:o})}handleToggleCollapse(e){const t=this.collapsedSegments.get(e)||!1;this.collapsedSegments.set(e,!t),this.saveCollapsedState(),this.render(),this.setupEventListeners(),setTimeout(()=>{const o=this.ui.querySelector(".segments-list"),n=this.ui.querySelector(`[data-segment-id="${e}"]`);if(o&&n){const i=o.getBoundingClientRect(),s=n.getBoundingClientRect();if(s.bottom>i.bottom){const a=s.bottom-i.bottom+10;o.scrollTop+=a}}},50)}saveCollapsedState(){const e={};this.collapsedSegments.forEach((t,o)=>{e[o]=t}),localStorage.setItem("loop-practice-collapsed-segments",JSON.stringify(e))}loadCollapsedState(){try{const e=localStorage.getItem("loop-practice-collapsed-segments");if(e){const t=JSON.parse(e);Object.entries(t).forEach(([o,n])=>{this.collapsedSegments.set(o,n)})}}catch(e){console.error("Failed to load collapsed state:",e)}}handleDragStart(e){const t=e.target,o=t.closest(".segment-item");if(o){if(t.tagName==="BUTTON"||t.tagName==="INPUT"||t.tagName==="SELECT"||t.closest("button")||t.closest("input")||t.closest("select")){e.preventDefault();return}this.draggedSegmentId=o.dataset.segmentId||null,o.classList.add("dragging"),e.dataTransfer&&(e.dataTransfer.effectAllowed="move",e.dataTransfer.setData("text/html",o.innerHTML))}}handleDragOver(e){e.preventDefault();const o=e.target.closest(".segment-item");!o||!this.draggedSegmentId||o.dataset.segmentId===this.draggedSegmentId||(e.dataTransfer&&(e.dataTransfer.dropEffect="move"),o.classList.add("drag-over"))}handleDragLeave(e){const o=e.target.closest(".segment-item");o&&o.classList.remove("drag-over")}handleDrop(e){var r;e.preventDefault(),e.stopPropagation();const o=e.target.closest(".segment-item");if(!o||!this.draggedSegmentId||!this.profile)return;const n=o.dataset.segmentId;if(!n||n===this.draggedSegmentId)return;const i=this.profile.segments.findIndex(d=>d.id===this.draggedSegmentId),s=this.profile.segments.findIndex(d=>d.id===n);if(i===-1||s===-1)return;const[a]=this.profile.segments.splice(i,1);this.profile.segments.splice(s,0,a),(r=this.onCommand)==null||r.call(this,"reorder-segments",{segments:this.profile.segments}),o.classList.remove("drag-over")}handleDragEnd(e){const o=e.target.closest(".segment-item");o&&o.classList.remove("dragging"),this.ui.querySelectorAll(".segment-item").forEach(i=>i.classList.remove("drag-over")),this.draggedSegmentId=null}handleGlobalSyncChange(e){var i,s;const t=e.target,o=parseFloat(t.value);if(isNaN(o)){t.value=this.formatSyncOffset(((i=this.profile)==null?void 0:i.globalMetronomeOffset)||0);return}const n=Math.max(-999.999,Math.min(999.999,o));t.value=this.formatSyncOffset(n),(s=this.onCommand)==null||s.call(this,"update-global-sync",{offset:n})}handleGlobalSyncInputMouseDown(e){const t=e.target,o=e.clientY,n=parseFloat(t.value)||0;let i=!1;const s=3;let a=n;const r=p=>{var g;const c=o-p.clientY;if(!i&&Math.abs(c)<s)return;i=!0,t.style.cursor="ns-resize";const h=n+c*.001,m=Math.max(-999.999,Math.min(999.999,h));t.value=this.formatSyncOffset(m),a=m,(g=this.onCommand)==null||g.call(this,"update-global-sync-realtime",{offset:m})},d=()=>{var p;document.removeEventListener("mousemove",r),document.removeEventListener("mouseup",d),t.style.cursor="ns-resize",i&&(e.preventDefault(),(p=this.onCommand)==null||p.call(this,"update-global-sync",{offset:a}))};document.addEventListener("mousemove",r),document.addEventListener("mouseup",d)}handleSyncGlobal(){var n,i,s;if(!((n=this.profile)!=null&&n.tempo)||!((i=this.profile)!=null&&i.timeSignature))return;const e=this.profile.globalMetronomeOffset||0,o=this.profile.segments.length>0?`Apply global sync (${this.formatSyncOffset(e)}s) to all loops?

This will overwrite existing loop-specific sync settings.`:`Save global sync setting (${this.formatSyncOffset(e)}s)?`;confirm(o)&&((s=this.onCommand)==null||s.call(this,"apply-global-sync",{offset:e}))}handleGlobalSyncMetronomeToggle(){var e,t,o;!((e=this.profile)!=null&&e.tempo)||!((t=this.profile)!=null&&t.timeSignature)||(this.globalSyncMetronomeEnabled=!this.globalSyncMetronomeEnabled,(o=this.onCommand)==null||o.call(this,"toggle-global-sync-metronome",{enabled:this.globalSyncMetronomeEnabled}),this.render(),this.setupEventListeners())}cleanup(){this.ui.remove()}}var te=Object.defineProperty,oe=(l,e,t)=>e in l?te(l,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):l[e]=t,v=(l,e,t)=>oe(l,typeof e!="symbol"?e+"":e,t);class ie{constructor(){v(this,"video"),v(this,"videoId"),v(this,"profile"),v(this,"loopController"),v(this,"countIn",new K),v(this,"uiController"),v(this,"isInitialized",!1),v(this,"saveProfileThrottled"),this.saveProfileThrottled=A(()=>this.saveProfile(),1e3),chrome.runtime.onMessage.addListener(this.handleMessage.bind(this)),console.log("Content Script 메시지 리스너 등록 완료")}async init(){if(this.isInitialized){console.log("이미 초기화됨, 초기화 건너뜀");return}try{if(console.log("YouTubeLoopPractice 초기화 시작"),!N()){console.log("YouTube watch 페이지가 아님, 초기화 건너뜀");return}if(console.log("YouTube watch 페이지 확인됨"),this.video=await P(),!this.video){console.log("비디오 요소를 찾을 수 없음");return}console.log("비디오 요소 발견:",this.video);const e=I();if(!e){console.log("비디오 ID를 추출할 수 없음");return}this.videoId=e,console.log("비디오 ID:",e),this.profile=await B(this.videoId),console.log("프로필 로드 완료:",this.profile),await this.fetchVideoMetadata(),this.loopController=new j(this.video,this.profile),console.log("루프 컨트롤러 초기화 완료"),this.uiController=new ee,await this.uiController.init(this.profile,this.handleUICommand.bind(this)),console.log("UI 컨트롤러 초기화 완료"),this.setupEventListeners(),console.log("이벤트 리스너 설정 완료"),D(()=>{console.log("YouTube 네비게이션 감지, 정리 후 재초기화"),this.cleanup(),setTimeout(()=>this.init(),1e3)}),this.isInitialized=!0,console.log("Loop Practice for YouTube 초기화 완료"),this.profile.activeSegmentId&&(console.log("활성 구간 복원:",this.profile.activeSegmentId),this.loopController.setActive(this.profile.activeSegmentId))}catch(e){console.error("초기화 실패:",e)}}setupEventListeners(){if(!this.video||!this.loopController){console.log("setupEventListeners: video 또는 loopController가 없음",{video:!!this.video,loopController:!!this.loopController});return}console.log("이벤트 리스너 설정 시작");const e=()=>{var t;(t=this.loopController)==null||t.onTimeUpdate()};this.video.addEventListener("timeupdate",e),console.log("timeupdate 이벤트 리스너 등록 완료"),window.addEventListener("keydown",this.handleKeydown.bind(this)),console.log("모든 이벤트 리스너 설정 완료")}handleKeydown(e){if(U(e.target))return;switch(e.key.toLowerCase()){case" ":e.preventDefault(),this.togglePlay();break;case"l":e.preventDefault(),this.toggleLoop();break;case"[":e.preventDefault(),this.gotoSegment(-1);break;case"]":e.preventDefault(),this.gotoSegment(1);break;case"-":case"_":e.preventDefault(),this.changeRate(-.05);break;case"=":case"+":e.preventDefault(),this.changeRate(.05);break;case"c":e.preventDefault(),this.runCountIn();break}}async handleUICommand(e,t){var o,n;try{switch(e){case"create-segment":let i;const s=t==null?void 0:t.duration;if(typeof s=="string"&&s.startsWith("bar:")){const r=parseInt(s.split(":")[1],10);if(!isNaN(r)&&this.profile){const d=this.profile.tempo||120,p=this.profile.timeSignature||"4/4";i=$(r,d,p)}}else typeof s=="number"?i=s:typeof s=="string"&&(i=parseInt(s,10));this.createSegmentFromUI((t==null?void 0:t.label)||"",i),this.refreshUI();break;case"set-segment-end":this.setSegmentEnd(),this.refreshUI();break;case"jump-and-activate":await this.jumpAndActivateSegment(t==null?void 0:t.segmentId),this.refreshUI();break;case"delete-segment":this.deleteSegment(t==null?void 0:t.segmentId),this.refreshUI();break;case"update-label":this.updateSegment(t==null?void 0:t.segmentId,{label:t==null?void 0:t.label}),this.refreshUI();break;case"set-start-time":await this.setSegmentStartTime(t==null?void 0:t.segmentId),this.refreshUI();break;case"set-end-time":await this.setSegmentEndTime(t==null?void 0:t.segmentId),this.refreshUI();break;case"update-time":const a=(t==null?void 0:t.timeType)==="start"?{start:t==null?void 0:t.time}:{end:t==null?void 0:t.time};this.updateSegment(t==null?void 0:t.segmentId,a),this.video&&typeof(t==null?void 0:t.time)=="number"&&!isNaN(t.time)&&(this.video.currentTime=t.time),this.refreshUI();break;case"decrease-rate":this.decreaseSegmentRate(t==null?void 0:t.segmentId),this.refreshUI();break;case"increase-rate":this.increaseSegmentRate(t==null?void 0:t.segmentId),this.refreshUI();break;case"update-rate":this.updateSegment(t==null?void 0:t.segmentId,{rate:t==null?void 0:t.rate}),this.refreshUI();break;case"update-tempo":this.updateProfile(r=>{r.tempo=t==null?void 0:t.tempo}),this.refreshUI();break;case"update-time-signature":this.updateProfile(r=>{r.timeSignature=t==null?void 0:t.timeSignature}),this.refreshUI();break;case"toggle-metronome":this.toggleMetronome(t==null?void 0:t.segmentId),this.refreshUI();break;case"update-global-sync-realtime":if(this.updateProfile(r=>{r.globalMetronomeOffset=t==null?void 0:t.offset}),this.loopController&&this.loopController.getActive()){const r=this.loopController.getActive();r!=null&&r.metronomeEnabled&&!((o=this.video)!=null&&o.paused)&&(this.loopController.toggleMetronome(r.id),this.loopController.toggleMetronome(r.id))}break;case"update-global-sync":if(this.updateProfile(r=>{r.globalMetronomeOffset=t==null?void 0:t.offset}),this.saveProfile(),this.loopController&&this.loopController.getActive()){const r=this.loopController.getActive();r!=null&&r.metronomeEnabled&&!((n=this.video)!=null&&n.paused)&&(this.loopController.toggleMetronome(r.id),this.loopController.toggleMetronome(r.id))}break;case"apply-global-sync":this.applyGlobalSyncToAllLoops(t==null?void 0:t.offset),this.refreshUI();break;case"toggle-global-sync-metronome":this.toggleGlobalSyncMetronome(t==null?void 0:t.enabled);break;case"reorder-segments":t!=null&&t.segments?(this.updateProfile(r=>{r.segments=t.segments}),this.saveProfile()):this.reorderSegments(t==null?void 0:t.draggedId,t==null?void 0:t.targetId),this.refreshUI();break;default:console.warn("Unknown UI command:",e)}}catch(i){console.error("Error handling UI command:",i)}}refreshUI(){this.uiController&&this.profile&&this.uiController.updateProfile(this.profile)}async fetchVideoMetadata(){if(this.profile)try{let e="";for(let n=0;n<50;n++){const i=document.querySelector("h1.ytd-watch-metadata yt-formatted-string");if(i!=null&&i.textContent){e=i.textContent.trim();break}await new Promise(s=>setTimeout(s,100))}let t="";for(let n=0;n<50;n++){const i=document.querySelector("ytd-channel-name#channel-name yt-formatted-string a");if(i!=null&&i.textContent){t=i.textContent.trim();break}await new Promise(s=>setTimeout(s,100))}let o=!1;e&&this.profile.videoTitle!==e&&(this.profile.videoTitle=e,o=!0),t&&this.profile.channelName!==t&&(this.profile.channelName=t,o=!0),o&&(await this.saveProfile(),console.log("영상 메타데이터 저장:",{videoTitle:e,channelName:t}))}catch(e){console.error("영상 메타데이터 가져오기 실패:",e)}}handleMessage(e,t,o){var n;try{if(console.log("Content Script message received:",e),(e==null?void 0:e.type)==="PING")return console.log("PING message received, sending response"),o({status:"ok",timestamp:Date.now(),initialized:this.isInitialized}),!0;if((e==null?void 0:e.type)==="GET_CURRENT_TIME"){const i=((n=this.video)==null?void 0:n.currentTime)||0;return console.log("Current time request:",i),o({currentTime:i}),!0}if((e==null?void 0:e.type)==="JUMP_TO_TIME")return this.video&&typeof e.time=="number"?(this.video.currentTime=e.time,console.log("Jumped to time:",e.time),o({success:!0})):o({error:"Invalid time or video not available"}),!0;if(!this.isInitialized)return console.log("Content Script not initialized, ignoring message:",e==null?void 0:e.type),o({error:"Content script not initialized"}),!0;if((e==null?void 0:e.type)==="COMMAND"){switch(e.command){case"toggle-play":this.togglePlay();break;case"toggle-loop":this.toggleLoop();break;case"prev-segment":this.gotoSegment(-1);break;case"next-segment":this.gotoSegment(1);break;case"decrease-speed":this.changeRate(-.05);break;case"increase-speed":this.changeRate(.05);break;case"count-in":this.runCountIn();break;case"set-segment-end":this.setSegmentEnd();break}o({success:!0})}else if((e==null?void 0:e.type)==="CREATE_SEGMENT"){const i=this.createSegmentWithTime(e.label,e.startTime,e.endTime);o({success:!!i,segment:i})}else if((e==null?void 0:e.type)==="ACTIVATE_SEGMENT")this.activateSegment(e.segmentId),o({success:!0});else if((e==null?void 0:e.type)==="DELETE_SEGMENT"){const i=this.deleteSegment(e.segmentId);o({success:i})}else if((e==null?void 0:e.type)==="UPDATE_SEGMENT"){const i={};e.label!==void 0&&(i.label=e.label),e.start!==void 0&&(i.start=e.start),e.end!==void 0&&(i.end=e.end),e.rate!==void 0&&(i.rate=e.rate);const s=this.updateSegment(e.segmentId,i);o({success:s})}else(e==null?void 0:e.type)==="GET_STATE"?o({profile:this.profile}):(console.log("Unknown message type:",e==null?void 0:e.type),o({error:"Unknown message type"}))}catch(i){console.error("Error processing message:",i),o({error:i instanceof Error?i.message:"Unknown error"})}return!0}togglePlay(){this.video&&(this.video.paused?this.video.play().catch(()=>{}):this.video.pause())}toggleLoop(){var t;if(console.log("toggleLoop 호출됨"),!this.profile||!this.loopController){console.log("toggleLoop: profile 또는 loopController가 없음",{profile:!!this.profile,loopController:!!this.loopController});return}const e=this.profile.segments.find(o=>o.id===this.profile.activeSegmentId);if(console.log("toggleLoop: 현재 활성 구간",e),e)console.log("toggleLoop: 활성 구간 비활성화"),this.updateProfile(o=>{o.activeSegmentId=null});else{const o=(t=this.video)==null?void 0:t.currentTime;if(console.log("toggleLoop: 현재 시간",o),o==null||isNaN(o)||typeof o!="number"){console.log("toggleLoop: currentTime이 유효하지 않음",o);return}const n=this.profile.segments.find(i=>o>=i.start&&o<=i.end);console.log("toggleLoop: 현재 시간에 해당하는 구간",n),n?(console.log("toggleLoop: 구간 활성화",n.label),this.updateProfile(i=>{i.activeSegmentId=n.id})):console.log("toggleLoop: 현재 시간에 해당하는 구간이 없음")}}toggleMetronome(e){if(console.log("toggleMetronome 호출됨:",{segmentId:e}),!this.loopController||!e){console.log("toggleMetronome: loopController가 없거나 segmentId가 없음");return}const t=this.loopController.toggleMetronome(e);console.log("메트로놈 상태:",t?"활성화":"비활성화"),this.uiController&&this.uiController.setMetronomeActive(t?e:null)}reorderSegments(e,t){if(!this.profile||!e||!t)return;const o=this.profile.segments.findIndex(s=>s.id===e),n=this.profile.segments.findIndex(s=>s.id===t);if(o===-1||n===-1)return;const[i]=this.profile.segments.splice(o,1);this.profile.segments.splice(n,0,i),this.saveProfileThrottled(),console.log("세그먼트 순서 변경:",{draggedId:e,targetId:t,newOrder:this.profile.segments.map(s=>s.id)})}applyGlobalSyncToAllLoops(e){!this.profile||!this.profile.tempo||!this.profile.timeSignature||(this.updateProfile(t=>{t.globalMetronomeOffset=e}),this.saveProfile(),console.log("글로벌 싱크 적용:",{globalOffset:e,segmentsCount:this.profile.segments.length}))}toggleGlobalSyncMetronome(e){var t,o,n;if(!(!this.loopController||!((t=this.profile)!=null&&t.tempo)||!((o=this.profile)!=null&&o.timeSignature)))if(console.log("[Global Sync Metronome] Toggle:",{enabled:e,video:(n=this.video)==null?void 0:n.currentTime}),e){const i=this.loopController.getActive();i&&(console.log("[Global Sync Metronome] Disabling active loop:",i.id),this.loopController.setActive(null)),this.video&&!this.video.paused&&this.loopController.startGlobalSyncMetronome()}else console.log("[Global Sync Metronome] Stopping metronome"),this.loopController.stopGlobalSyncMetronome()}gotoSegment(e){this.loopController&&this.loopController.gotoPrevNext(e)}changeRate(e){if(!this.profile)return;const t=typeof this.profile.defaultRate=="number"&&!isNaN(this.profile.defaultRate)?this.profile.defaultRate:1,o=R(t+e,.25,2);this.updateProfile(n=>{n.defaultRate=o})}runCountIn(){if(!this.video||!this.loopController){console.log("비디오 또는 루프 컨트롤러가 없습니다.");return}const e=this.loopController.getActive();if(!e){console.log("활성 구간이 없습니다.");return}this.countIn.run({beats:4,bpm:120,onComplete:()=>{this.video&&typeof e.start=="number"&&!isNaN(e.start)?(this.video.currentTime=e.start,this.video.play().catch(()=>{})):console.log("runCountIn: activeSegment.start이 유효하지 않음",e.start)}})}createSegmentFromUI(e,t){if(!this.video||!this.profile)return;const o=this.video.currentTime;if(o==null||isNaN(o)||typeof o!="number"){console.log("createSegmentFromUI: currentTime이 유효하지 않음",o);return}const n=t&&!isNaN(t)?t:10,i=Math.min(o+n,this.video.duration);return this.createSegmentWithTime(e,o,i)}createSegmentWithTime(e,t,o){if(!this.video||!this.profile)return;let n=t;if((n==null||isNaN(n)||typeof n!="number")&&(n=this.video.currentTime,n==null||isNaN(n)||typeof n!="number")){console.log("createSegmentWithTime: startTime이 유효하지 않음",n);return}let i=o;(i==null||isNaN(i)||typeof i!="number")&&(i=Math.min(n+10,this.video.duration));const s=typeof this.profile.defaultRate=="number"&&!isNaN(this.profile.defaultRate)?this.profile.defaultRate:1;let a=e;if(!a){const d=Math.floor(n/60),p=Math.floor(n%60),c=Math.floor(i/60),h=Math.floor(i%60);a=`${d}:${p.toString().padStart(2,"0")}~${c}:${h.toString().padStart(2,"0")}`}const r={id:Math.random().toString(36).substring(2,15),start:n,end:i,rate:s,label:a};return this.updateProfile(d=>{d.segments=[...d.segments,r]}),console.log(`구간 생성: ${a} (${n}s ~ ${i}s)`),r}setSegmentEnd(){if(!this.video||!this.profile)return;const e=this.video.currentTime;if(e==null||isNaN(e)||typeof e!="number"){console.log("setSegmentEnd: currentTime이 유효하지 않음",e);return}const t=this.profile.segments[this.profile.segments.length-1];t&&t.start<e&&(this.updateProfile(o=>{o.segments=o.segments.map((n,i)=>i===o.segments.length-1?{...n,end:e}:n)}),console.log(`구간 끝점 설정: ${e}`))}activateSegment(e){this.profile&&this.updateProfile(t=>{t.activeSegmentId===e?(t.activeSegmentId=null,console.log(`구간 비활성화: ${e}`)):(t.activeSegmentId=e,console.log(`구간 활성화: ${e}`))})}deleteSegment(e){if(!this.loopController)return!1;const t=this.loopController.deleteSegment(e);return t&&this.saveProfileThrottled(),t}updateSegment(e,t){if(!this.loopController)return!1;const o={};t.label!==void 0&&(o.label=t.label),t.start!==void 0&&(o.start=t.start),t.end!==void 0&&(o.end=t.end),t.rate!==void 0&&(o.rate=t.rate);const n=this.loopController.updateSegment(e,o);return n&&(this.profile&&this.loopController.setProfile(this.profile),this.saveProfileThrottled()),n}async jumpAndActivateSegment(e){if(console.log("jumpAndActivateSegment 호출됨:",e),!this.video){console.warn("jumpAndActivateSegment: video가 없음");return}if(!this.profile){console.warn("jumpAndActivateSegment: profile이 없음");return}const t=this.profile.segments.find(o=>o.id===e);if(!t){console.error("jumpAndActivateSegment: 구간을 찾을 수 없음:",e);return}console.log("jumpAndActivateSegment: 찾은 구간:",t),console.log("jumpAndActivateSegment: 현재 activeSegmentId:",this.profile.activeSegmentId),e===this.profile.activeSegmentId?(console.log("jumpAndActivateSegment: 이미 활성화된 구간이므로 비활성화"),this.activateSegment(e)):(console.log("jumpAndActivateSegment: 구간 활성화 및 시작 지점으로 이동:",t.start),this.video.currentTime=t.start,this.activateSegment(e))}async setSegmentStartTime(e){if(!this.video)return;const t=this.video.currentTime;if(t==null||isNaN(t)||typeof t!="number"){console.log("setSegmentStartTime: currentTime이 유효하지 않음",t);return}this.updateSegment(e,{start:t})}async setSegmentEndTime(e){if(!this.video)return;const t=this.video.currentTime;if(t==null||isNaN(t)||typeof t!="number"){console.log("setSegmentEndTime: currentTime이 유효하지 않음",t);return}this.updateSegment(e,{end:t})}decreaseSegmentRate(e){var i;const t=(i=this.profile)==null?void 0:i.segments.find(s=>s.id===e);if(!t)return;const o=t.rate,n=Math.max(.05,o-.05);this.updateSegment(e,{rate:n})}increaseSegmentRate(e){var i;const t=(i=this.profile)==null?void 0:i.segments.find(s=>s.id===e);if(!t)return;const o=t.rate,n=Math.min(1.6,o+.05);this.updateSegment(e,{rate:n})}updateProfile(e){var t;this.profile&&(e(this.profile),console.log("프로필 업데이트:",{activeSegmentId:this.profile.activeSegmentId,segmentsCount:this.profile.segments.length}),(t=this.loopController)==null||t.setProfile(this.profile),this.saveProfileThrottled())}async saveProfile(){if(!this.profile)return;const e=3;let t=0;for(;t<e;)try{await z(this.profile);return}catch(o){if(t++,console.error(`프로필 저장 실패 (${t}/${e}):`,o),t<e){const n=Math.pow(2,t-1)*1e3;await new Promise(i=>setTimeout(i,n))}else console.error("프로필 저장 최종 실패")}}cleanup(){this.isInitialized=!1,this.countIn.stop(),this.uiController&&(this.uiController.cleanup(),this.uiController=void 0),this.video&&this.video.removeEventListener("timeupdate",()=>{}),window.removeEventListener("keydown",this.handleKeydown.bind(this)),chrome.runtime.onMessage.removeListener(this.handleMessage.bind(this)),console.log("Loop Practice for YouTube 정리 완료")}}const x=new ie,T=()=>{if(console.log("Content Script 초기화 시작"),!N()){console.log("YouTube watch 페이지가 아님, 초기화 건너뜀");return}const l=()=>{document.querySelector("video")?(console.log("비디오 요소 발견, 확장 프로그램 초기화"),x.init().catch(t=>{console.error("확장 프로그램 초기화 실패:",t)})):(console.log("비디오 요소 대기 중..."),setTimeout(l,100))};l()};T();document.readyState==="loading"&&document.addEventListener("DOMContentLoaded",()=>{x.isInitialized||(console.log("DOMContentLoaded 후 초기화 시도"),T())});window.addEventListener("load",()=>{setTimeout(()=>{x.isInitialized||(console.log("페이지 로드 완료 후 추가 초기화 시도"),T())},500)});setTimeout(()=>{x.isInitialized||(console.log("지연 초기화 시도"),T())},3e3);let w=location.href;const M=()=>{location.href!==w&&(w=location.href,console.log("YouTube 네비게이션 감지:",w),x.cleanup(),setTimeout(()=>{console.log("네비게이션 후 재초기화"),T()},500))};window.addEventListener("popstate",M);const ne=history.pushState,se=history.replaceState;history.pushState=function(...l){ne.apply(history,l),setTimeout(M,0)};history.replaceState=function(...l){se.apply(history,l),setTimeout(M,0)};export{ie as YouTubeLoopPractice};
