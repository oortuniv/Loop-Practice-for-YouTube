import { LoopSegment, VideoProfile } from '../types';
import { parseTimeSignature, throttle } from '../utils';
import { BeatMap } from './audio/beat-map';
import { Metronome, ScheduledBeatNodes, cancelScheduledBeat } from './audio/metronome';

// 빌드 고유 ID (디버깅용) - 코드 변경 시 수동으로 업데이트
export const BUILD_ID = 'v2025-0104-014';
console.log(`[LoopController] 🔧 빌드 ID: ${BUILD_ID}`);

// 인스턴스 추적용
let instanceCounter = 0;

/**
 * LoopController: 루프 재생 및 메트로놈 관리
 *
 * 새 구조 (이벤트 기반, 폴링 없음):
 * - BeatMap: 비트 시간 사전 계산 (Beat Sync 완료 시)
 * - Metronome: 클릭음 재생
 * - 이벤트 기반 스케줄링: video.playing, seeked, ratechange 등
 *
 * 기능:
 * 1. 루프 재생: loopEnd 도달 시 자동으로 loopStart로 점프
 * 2. 메트로놈: 미리 스케줄된 비트에 맞춰 클릭음 재생
 * 3. 글로벌 싱크: 전체 영상에 대해 메트로놈만 재생 (루프 없이)
 */
export class LoopController {
  private video: HTMLVideoElement;
  private profile: VideoProfile;
  private active?: LoopSegment;
  private tickThrottled: () => void;

  // 핵심 컴포넌트
  private metronome: Metronome;

  // BeatMap 관리 (글로벌/로컬 별도)
  private globalBeatMap: BeatMap | null = null;
  private localBeatMaps: Map<string, BeatMap> = new Map();

  // 스케줄링 상태
  private scheduledNodes: ScheduledBeatNodes[] = [];
  private nextLoopScheduledNodes: ScheduledBeatNodes[] = []; // 다음 루프용 (취소 가능)
  private nextLoopBeatTimers: number[] = []; // 다음 루프 UI 콜백 타이머
  private loopJumpTimer: number | null = null;
  private beatDisplayTimers: number[] = []; // UI 콜백 타이머 추적
  private continueScheduleTimer: number | null = null; // 30초 연속 스케줄링용
  private isScheduling: boolean = false;

  // 상태 플래그
  private globalSyncMetronomeActive: boolean = false;
  private metronomeEnabled: boolean = false;
  private isJumping: boolean = false;
  private jumpCompletedAt: number = 0; // 점프 완료 시간 (pause 무시용)

  // 루프 범위
  private loopStart: number = 0;
  private loopEnd: number = Infinity;

  // UI 콜백
  private beatDisplayCallback: ((beat: number, total: number) => void) | null = null;

  // 카운트인 관련 상태
  private countInActive: boolean = false;
  private countInVideoStartTimer: number | null = null;

  // 인스턴스 ID
  private readonly instanceId: number;

  // 이벤트 핸들러 참조 (dispose 시 제거용)
  private boundHandlers: {
    pause: () => void;
    playing: () => void;
    seeked: () => void;
    ratechange: () => void;
  } | null = null;

  constructor(video: HTMLVideoElement, profile: VideoProfile) {
    this.instanceId = ++instanceCounter;
    console.log(`[LoopController] 🆕 인스턴스 생성 #${this.instanceId}`, {
      videoId: profile.videoId,
      activeSegmentId: profile.activeSegmentId,
      segmentsCount: profile.segments.length
    });

    this.video = video;
    this.profile = profile;
    this.tickThrottled = throttle(() => this.tick(), 50);

    // 메트로놈 초기화
    this.metronome = new Metronome();

    // 초기 활성 구간 설정
    if (profile.activeSegmentId) {
      this.setActive(profile.activeSegmentId);
    }

    // 비디오 이벤트 리스너
    this.setupVideoEventListeners();

    // 초기 BeatMap 생성 (글로벌 설정이 있으면)
    this.updateGlobalBeatMap();

    // 로컬 BeatMap 초기화 (이미 Beat Sync가 완료된 세그먼트들)
    for (const segment of profile.segments) {
      if (segment.useGlobalSync === false && segment.localTempo && segment.localTimeSignature) {
        this.updateLocalBeatMap(segment.id);
      }
    }
  }

  // ==================== 비디오 이벤트 리스너 ====================

  private setupVideoEventListeners(): void {
    // 핸들러를 바인딩하여 저장 (나중에 제거할 수 있도록)
    this.boundHandlers = {
      pause: this.handlePause.bind(this),
      playing: this.handlePlaying.bind(this),
      seeked: this.handleSeeked.bind(this),
      ratechange: this.handleRatechange.bind(this)
    };

    this.video.addEventListener('pause', this.boundHandlers.pause);
    this.video.addEventListener('playing', this.boundHandlers.playing);
    this.video.addEventListener('seeked', this.boundHandlers.seeked);
    this.video.addEventListener('ratechange', this.boundHandlers.ratechange);
  }

  private removeVideoEventListeners(): void {
    if (!this.boundHandlers) return;

    this.video.removeEventListener('pause', this.boundHandlers.pause);
    this.video.removeEventListener('playing', this.boundHandlers.playing);
    this.video.removeEventListener('seeked', this.boundHandlers.seeked);
    this.video.removeEventListener('ratechange', this.boundHandlers.ratechange);

    this.boundHandlers = null;
    console.log(`[LoopController #${this.instanceId}] 비디오 이벤트 리스너 제거 완료`);
  }

  private handlePause(): void {
    const now = performance.now();
    const timeSinceJumpCompleted = now - this.jumpCompletedAt;

    console.log(`[LoopController #${this.instanceId}] pause 이벤트:`, {
      isJumping: this.isJumping,
      timeSinceJumpCompleted: timeSinceJumpCompleted.toFixed(1),
      scheduledNodesCount: this.scheduledNodes.length
    });

    // 루프 점프 중에는 pause 이벤트 무시 (YouTube가 seek 시 잠시 pause 발생)
    if (this.isJumping) {
      console.log('[LoopController] 루프 점프 중이므로 pause 무시');
      return;
    }

    // 점프 완료 직후 100ms 이내의 pause도 무시 (YouTube의 지연된 pause 이벤트)
    if (timeSinceJumpCompleted < 100) {
      console.log('[LoopController] 루프 점프 직후이므로 pause 무시');
      return;
    }

    this.cancelAllScheduled();
  }

  private handlePlaying(): void {
    console.log(`[LoopController #${this.instanceId}] playing 이벤트:`, {
      countInActive: this.countInActive,
      isJumping: this.isJumping,
      globalSyncMetronomeActive: this.globalSyncMetronomeActive,
      metronomeEnabled: this.metronomeEnabled,
      activeId: this.active?.id,
      scheduledNodesCount: this.scheduledNodes.length
    });

    if (this.countInActive || this.isJumping) return;

    if (this.metronomeEnabled || this.globalSyncMetronomeActive) {
      // ✅ 중복 스케줄링 방지: 기존 스케줄이 있으면 스킵
      if (this.scheduledNodes.length > 0) {
        console.log('[LoopController] playing: 이미 스케줄된 비트가 있어 스킵');
        return;
      }
      this.scheduleBeatsFrom(this.video.currentTime);
    }
  }

  private handleSeeked(): void {
    console.log(`[LoopController #${this.instanceId}] seeked 이벤트:`, {
      countInActive: this.countInActive,
      isJumping: this.isJumping,
      metronomeEnabled: this.metronomeEnabled,
      globalSyncMetronomeActive: this.globalSyncMetronomeActive,
      currentTime: this.video.currentTime.toFixed(3)
    });
    if (this.countInActive || this.isJumping) return;
    if (!this.metronomeEnabled && !this.globalSyncMetronomeActive) return;

    this.cancelAllScheduled();
    if (!this.video.paused) {
      this.scheduleBeatsFrom(this.video.currentTime);
    }
  }

  private handleRatechange(): void {
    console.log(`[LoopController #${this.instanceId}] ratechange 이벤트:`, {
      newRate: this.video.playbackRate,
      countInActive: this.countInActive,
      isJumping: this.isJumping
    });
    if (this.countInActive || this.isJumping) return;
    if (!this.metronomeEnabled && !this.globalSyncMetronomeActive) return;

    this.cancelAllScheduled();
    if (!this.video.paused) {
      this.scheduleBeatsFrom(this.video.currentTime);
    }
  }

  // ==================== 스케줄링 ====================

  // 루프 비활성화 시 최대 스케줄링 시간 (초)
  private readonly MAX_SCHEDULE_AHEAD = 30;

  /**
   * 현재 시점부터 루프 범위 내 모든 비트 스케줄링
   */
  private scheduleBeatsFrom(videoTimeA: number): void {
    if (this.isScheduling) return;
    this.isScheduling = true;

    const beatMap = this.getActiveBeatMap();
    if (!beatMap) {
      console.log('[LoopController] BeatMap 없음, 스케줄링 스킵');
      this.isScheduling = false;
      return;
    }

    // ✅ 스케줄 누적 방지: 새 스케줄링 전에 기존 스케줄 정리
    const prevScheduledCount = this.scheduledNodes.length;
    if (prevScheduledCount > 0) {
      console.log('[LoopController] 기존 스케줄 정리:', { prevScheduledCount });
      this.cancelAllScheduled();
    }

    const audioTimeA = this.metronome.getAudioContext().currentTime;
    const playbackRate = this.video.playbackRate;

    // ✅ 루프 비활성화 시 전체 비디오가 아닌 30초만 스케줄링 (성능 문제 방지)
    let endTime: number;
    if (this.loopEnd !== Infinity) {
      endTime = this.loopEnd;
    } else {
      endTime = Math.min(videoTimeA + this.MAX_SCHEDULE_AHEAD, this.video.duration);
    }

    // 루프 범위 내 비트 조회
    const beatsInRange = beatMap.getBeatsInRange(videoTimeA, endTime);

    // 첫 몇 개 비트 확인용 로그
    const firstBeats = beatsInRange.slice(0, 5).map(b => ({
      videoTime: b.videoTime.toFixed(3),
      beatNumber: b.beatNumber
    }));

    console.log('[LoopController] 스케줄링 시작:', {
      videoTimeA: videoTimeA.toFixed(3),
      audioTimeA: audioTimeA.toFixed(3),
      playbackRate,
      loopRange: [this.loopStart, this.loopEnd],
      endTime: endTime.toFixed(3),
      beatsCount: beatsInRange.length,
      beatMapOffset: beatMap.beatOffset.toFixed(3),
      firstBeats
    });

    // 각 비트 스케줄링
    const ctxCurrentTime = this.metronome.getAudioContext().currentTime;
    let scheduledCount = 0;

    for (const beat of beatsInRange) {
      const deltaVideo = beat.videoTime - videoTimeA;
      const audioTime = audioTimeA + (deltaVideo / playbackRate);
      const timeUntilBeat = audioTime - ctxCurrentTime;

      // ✅ 첫 비트가 50ms 이내로 지났으면 즉시 재생 (seek/0초 시작 오차 보정)
      if (timeUntilBeat < 0 && timeUntilBeat > -0.050) {
        console.log(`[LoopController] 비트 즉시 재생 (오차 보정): beat ${beat.beatNumber}, late=${(-timeUntilBeat * 1000).toFixed(1)}ms`);
        this.metronome.playClickNow(beat.isDownbeat);
        scheduledCount++;
      } else {
        const nodes = this.metronome.scheduleBeatAt(audioTime, beat.isDownbeat);
        if (nodes) {
          this.scheduledNodes.push(nodes);
          scheduledCount++;
        }
      }

      // UI 콜백은 setTimeout으로 호출 (비동기)
      if (this.beatDisplayCallback) {
        const delayMs = Math.max(0, (audioTime - audioTimeA) * 1000);
        const timerId = window.setTimeout(() => {
          console.log(`[Beat UI] 현재 루프 - beat: ${beat.beatNumber}/${beatMap.beatsPerBar}, videoTime: ${beat.videoTime.toFixed(3)}, delayMs: ${delayMs.toFixed(1)}`);
          this.beatDisplayCallback?.(beat.beatNumber, beatMap.beatsPerBar);
        }, delayMs);
        this.beatDisplayTimers.push(timerId);
      }
    }

    console.log(`[LoopController] 스케줄 완료: ${scheduledCount}/${beatsInRange.length}개 비트`);

    // 루프 점프 스케줄링 (루프 활성화된 경우)
    if (this.loopEnd !== Infinity && this.active) {
      this.scheduleLoopJump(videoTimeA, audioTimeA, playbackRate, beatMap);
    } else if (this.loopEnd === Infinity && endTime < this.video.duration) {
      // ✅ 루프 비활성화 시: 30초 후 추가 스케줄링 예약
      this.scheduleContinueScheduling(endTime, playbackRate);
    }

    this.isScheduling = false;
  }

  /**
   * 연속 스케줄링 예약 (루프 없이 30초 이상 재생 시)
   */
  private scheduleContinueScheduling(nextVideoTime: number, playbackRate: number): void {
    // 기존 타이머 취소
    if (this.continueScheduleTimer !== null) {
      clearTimeout(this.continueScheduleTimer);
    }

    // 현재 비디오 시간 기준으로 다음 스케줄링까지 대기 시간 계산
    const currentVideoTime = this.video.currentTime;
    const deltaVideo = nextVideoTime - currentVideoTime;
    // 25초 후에 미리 스케줄링 (5초 여유)
    const delayMs = Math.max(0, (deltaVideo / playbackRate) * 1000 - 5000);

    console.log('[LoopController] 연속 스케줄링 예약:', {
      currentVideoTime: currentVideoTime.toFixed(3),
      nextVideoTime: nextVideoTime.toFixed(3),
      delayMs: delayMs.toFixed(1),
      playbackRate
    });

    this.continueScheduleTimer = window.setTimeout(() => {
      this.continueScheduleTimer = null;

      // 재생 중이고 메트로놈이 활성화된 경우에만 스케줄링
      if (!this.video.paused && (this.metronomeEnabled || this.globalSyncMetronomeActive)) {
        console.log('[LoopController] 연속 스케줄링 실행:', {
          videoCurrentTime: this.video.currentTime.toFixed(3),
          globalSyncMetronomeActive: this.globalSyncMetronomeActive,
          metronomeEnabled: this.metronomeEnabled
        });
        this.scheduleBeatsFrom(this.video.currentTime);
      } else {
        console.log('[LoopController] 연속 스케줄링 스킵 (정지 또는 메트로놈 비활성화):', {
          paused: this.video.paused,
          globalSyncMetronomeActive: this.globalSyncMetronomeActive,
          metronomeEnabled: this.metronomeEnabled
        });
      }
    }, delayMs);
  }

  /**
   * 루프 점프 스케줄링 (점프 타이머만 - 비트는 seeked 후 스케줄)
   */
  private scheduleLoopJump(
    videoTimeA: number,
    audioTimeA: number,
    playbackRate: number,
    beatMap: BeatMap
  ): void {
    // ⚠️ 진단 로그: 이전 타이머가 있는지 확인
    if (this.loopJumpTimer !== null) {
      console.warn('[LoopController] ⚠️ 이전 loopJumpTimer가 아직 존재함! 취소하고 새로 스케줄', {
        existingTimerId: this.loopJumpTimer
      });
      clearTimeout(this.loopJumpTimer);
    }

    // 루프 점프 시점 = loopEnd
    const deltaToLoopEnd = this.loopEnd - videoTimeA;
    const audioTimeLoopEnd = audioTimeA + (deltaToLoopEnd / playbackRate);

    // 루프 점프 실행 스케줄 (비트는 seeked 후에 스케줄)
    const delayMs = (audioTimeLoopEnd - audioTimeA) * 1000;
    const timerId = window.setTimeout(() => {
      this.executeLoopJump(playbackRate, beatMap);
    }, Math.max(0, delayMs - 10)); // 10ms 여유를 두고 실행
    this.loopJumpTimer = timerId;

    console.log('[LoopController] 루프 점프 스케줄:', {
      loopEnd: this.loopEnd.toFixed(3),
      audioTimeLoopEnd: audioTimeLoopEnd.toFixed(3),
      delayMs: delayMs.toFixed(1),
      timerId
    });
  }

  // seeked 리스너 추적용
  private currentSeekedListener: (() => void) | null = null;
  private seekedListenerIdCounter: number = 0;

  /**
   * 루프 점프 실행 (seeked 이벤트에서 비트 스케줄링)
   */
  private executeLoopJump(playbackRate: number, beatMap: BeatMap): void {
    if (this.video.paused) return;

    // ✅ 루프가 비활성화되었으면 점프 실행하지 않음
    if (this.loopEnd === Infinity || !this.active) {
      console.log('[LoopController] executeLoopJump 스킵: 루프 비활성화됨', {
        loopEnd: this.loopEnd,
        activeId: this.active?.id
      });
      this.loopJumpTimer = null;
      return;
    }

    this.isJumping = true;
    const jumpAudioTime = this.metronome.getAudioContext().currentTime;

    // ⚠️ 진단: 이전 seeked 리스너가 있는지 확인
    if (this.currentSeekedListener) {
      console.warn('[LoopController] ⚠️ 이전 seeked 리스너가 아직 존재함! 제거하고 새로 등록');
      this.video.removeEventListener('seeked', this.currentSeekedListener);
      this.currentSeekedListener = null;
    }

    console.log(`[LoopController #${this.instanceId}] 루프 점프 실행 (seek 전): → ${this.loopStart.toFixed(3)}s`, {
      jumpAudioTime: jumpAudioTime.toFixed(3),
      videoCurrentTime: this.video.currentTime.toFixed(3),
      playbackRate,
      loopRange: [this.loopStart.toFixed(3), this.loopEnd.toFixed(3)],
      scheduledNodesCount: this.scheduledNodes.length,
      loopJumpTimerId: this.loopJumpTimer
    });

    // ✅ 핵심: 이전 루프의 스케줄된 비트들 취소 (누적 방지)
    // 루프 점프 타이머는 유지하고, 비트 노드와 UI 타이머만 취소
    for (const nodes of this.scheduledNodes) {
      cancelScheduledBeat(nodes);
    }
    this.scheduledNodes = [];
    for (const timerId of this.beatDisplayTimers) {
      clearTimeout(timerId);
    }
    this.beatDisplayTimers = [];

    // loopJumpTimer 초기화 (실행되었으므로)
    this.loopJumpTimer = null;

    this.video.currentTime = this.loopStart;

    console.log(`[LoopController #${this.instanceId}] 루프 점프 실행 (seek 후):`, {
      videoCurrentTime: this.video.currentTime.toFixed(3),
      loopStart: this.loopStart.toFixed(3),
      audioTimeNow: this.metronome.getAudioContext().currentTime.toFixed(3)
    });

    // seeked 이벤트 한 번만 처리
    const listenerId = ++this.seekedListenerIdCounter;
    const onSeeked = () => {
      const seekedAudioTime = this.metronome.getAudioContext().currentTime;
      const currentPlaybackRate = this.video.playbackRate;

      console.log(`[LoopController #${this.instanceId}] onSeeked (루프점프): seeked 이벤트 수신`, {
        listenerId,
        jumpAudioTime: jumpAudioTime.toFixed(3),
        seekedAudioTime: seekedAudioTime.toFixed(3),
        seekDelay: (seekedAudioTime - jumpAudioTime).toFixed(3),
        videoCurrentTime: this.video.currentTime.toFixed(3)
      });

      this.video.removeEventListener('seeked', onSeeked);
      this.currentSeekedListener = null;

      // ✅ 핵심 수정: seeked 완료 후 현재 시점 기준으로 비트 스케줄링
      this.scheduleCurrentLoopBeats(seekedAudioTime, currentPlaybackRate, beatMap);

      // 다음 루프 점프 스케줄링 (루프가 아직 활성화된 경우에만)
      if (this.loopEnd !== Infinity && this.active) {
        this.scheduleLoopJump(this.loopStart, seekedAudioTime, currentPlaybackRate, beatMap);
      } else {
        console.log('[LoopController] 루프 비활성화됨, 다음 루프 점프 스케줄링 스킵');
      }

      // isJumping 해제 (약간 대기)
      setTimeout(() => {
        this.isJumping = false;
        this.jumpCompletedAt = performance.now();
        console.log('[LoopController] isJumping 해제, jumpCompletedAt 설정');
      }, 20);
    };

    this.currentSeekedListener = onSeeked;
    this.video.addEventListener('seeked', onSeeked);
    console.log(`[LoopController] seeked 리스너 등록 완료: listenerId=${listenerId}`);
  }

  /**
   * 현재 루프의 비트 스케줄링 (seeked 후 호출)
   */
  private scheduleCurrentLoopBeats(
    audioTimeA: number,
    playbackRate: number,
    beatMap: BeatMap
  ): void {
    const videoTimeA = this.video.currentTime;
    const endTime = this.loopEnd !== Infinity ? this.loopEnd : this.video.duration;
    const ctx = this.metronome.getAudioContext();
    const ctxCurrentTime = ctx.currentTime;

    // 루프 범위 내 비트 조회
    // ✅ loopStart를 기준으로 조회 (seek 후 video.currentTime이 약간 다를 수 있음)
    // 단, videoTimeA보다 약간 앞의 비트도 포함 (50ms 여유)
    const queryStart = Math.max(0, Math.min(videoTimeA, this.loopStart) - 0.05);
    const beatsInRange = beatMap.getBeatsInRange(queryStart, endTime);

    // 첫 비트까지의 시간 계산
    const firstBeatVideoTime = beatsInRange[0]?.videoTime;
    const timeUntilFirstBeat = firstBeatVideoTime !== undefined
      ? firstBeatVideoTime - videoTimeA
      : null;

    console.log('[LoopController] scheduleCurrentLoopBeats: 비트 스케줄링', {
      videoTimeA: videoTimeA.toFixed(3),
      queryStart: queryStart.toFixed(3),
      audioTimeA: audioTimeA.toFixed(3),
      ctxCurrentTime: ctxCurrentTime.toFixed(3),
      audioTimeAvsCtx: (audioTimeA - ctxCurrentTime).toFixed(3),
      playbackRate,
      loopRange: [this.loopStart.toFixed(3), this.loopEnd.toFixed(3)],
      beatsCount: beatsInRange.length,
      firstBeatVideoTime: firstBeatVideoTime?.toFixed(3) || 'none',
      timeUntilFirstBeat: timeUntilFirstBeat?.toFixed(3) || 'none',
      beatMapOffset: beatMap.beatOffset.toFixed(3)
    });

    // ⚠️ 첫 비트까지 2초 이상 걸리면 경고
    if (timeUntilFirstBeat !== null && timeUntilFirstBeat > 2) {
      console.warn('[LoopController] ⚠️ 첫 비트까지 시간이 깁니다:', {
        loopStart: this.loopStart.toFixed(3),
        firstBeatVideoTime: firstBeatVideoTime?.toFixed(3),
        timeUntilFirstBeat: timeUntilFirstBeat.toFixed(3),
        beatMapOffset: beatMap.beatOffset.toFixed(3),
        suggestion: 'BeatMap offset이 루프 시작점과 맞지 않을 수 있음'
      });
    }

    let scheduledCount = 0;
    let skippedCount = 0;

    // 각 비트 스케줄링
    for (const beat of beatsInRange) {
      const deltaVideo = beat.videoTime - videoTimeA;
      const audioTime = audioTimeA + (deltaVideo / playbackRate);
      const timeUntilBeat = audioTime - ctxCurrentTime;

      let nodes: ScheduledBeatNodes | null = null;

      // ✅ 첫 비트가 10ms 이내로 지났으면 즉시 재생 (seek 오차 보정)
      if (timeUntilBeat < 0 && timeUntilBeat > -0.010) {
        console.log(`[LoopController] 첫 비트 즉시 재생 (seek 오차 보정): beat ${beat.beatNumber}, late=${(-timeUntilBeat * 1000).toFixed(1)}ms`);
        this.metronome.playClickNow(beat.isDownbeat);
        scheduledCount++;
      } else {
        nodes = this.metronome.scheduleBeatAt(audioTime, beat.isDownbeat);
        if (nodes) {
          this.scheduledNodes.push(nodes);
          scheduledCount++;
        } else {
          skippedCount++;
          // 첫 몇 개의 스킵된 비트만 로그
          if (skippedCount <= 3) {
            console.warn(`[LoopController] 비트 스킵됨: beat ${beat.beatNumber}, audioTime=${audioTime.toFixed(3)}, timeUntilBeat=${timeUntilBeat.toFixed(3)}`);
          }
        }
      }

      // UI 콜백
      if (this.beatDisplayCallback) {
        const delayMs = (audioTime - audioTimeA) * 1000;
        const timerId = window.setTimeout(() => {
          console.log(`[Beat UI] 루프점프 후 - beat: ${beat.beatNumber}/${beatMap.beatsPerBar}, videoTime: ${beat.videoTime.toFixed(3)}, delayMs: ${delayMs.toFixed(1)}`);
          this.beatDisplayCallback?.(beat.beatNumber, beatMap.beatsPerBar);
        }, Math.max(0, delayMs));
        this.beatDisplayTimers.push(timerId);
      }
    }

    console.log('[LoopController] scheduleCurrentLoopBeats 완료:', {
      scheduledCount,
      skippedCount,
      totalScheduledNodes: this.scheduledNodes.length
    });
  }

  /**
   * 다음 루프용 스케줄 취소 (루프 점프 시 호출)
   */
  private cancelNextLoopScheduled(): void {
    console.log('[LoopController] cancelNextLoopScheduled: 다음 루프 스케줄 취소', {
      nodesCount: this.nextLoopScheduledNodes.length,
      timersCount: this.nextLoopBeatTimers.length
    });

    // 다음 루프 오디오 노드 취소
    for (const nodes of this.nextLoopScheduledNodes) {
      cancelScheduledBeat(nodes);
    }
    this.nextLoopScheduledNodes = [];

    // 다음 루프 UI 콜백 타이머 취소
    for (const timerId of this.nextLoopBeatTimers) {
      clearTimeout(timerId);
    }
    this.nextLoopBeatTimers = [];
  }

  /**
   * 모든 스케줄된 오디오 취소
   */
  private cancelAllScheduled(): void {
    const cancelInfo = {
      scheduledNodesCount: this.scheduledNodes.length,
      nextLoopNodesCount: this.nextLoopScheduledNodes.length,
      hasLoopJumpTimer: this.loopJumpTimer !== null,
      hasContinueScheduleTimer: this.continueScheduleTimer !== null,
      beatDisplayTimersCount: this.beatDisplayTimers.length
    };
    console.log('[LoopController] cancelAllScheduled: 모든 스케줄 취소', cancelInfo);

    // 오디오 노드 취소
    for (const nodes of this.scheduledNodes) {
      cancelScheduledBeat(nodes);
    }
    this.scheduledNodes = [];

    // 다음 루프용도 취소
    this.cancelNextLoopScheduled();

    // 루프 점프 타이머 취소
    if (this.loopJumpTimer !== null) {
      clearTimeout(this.loopJumpTimer);
      this.loopJumpTimer = null;
    }

    // 연속 스케줄링 타이머 취소
    if (this.continueScheduleTimer !== null) {
      clearTimeout(this.continueScheduleTimer);
      this.continueScheduleTimer = null;
    }

    // UI 콜백 타이머 취소
    for (const timerId of this.beatDisplayTimers) {
      clearTimeout(timerId);
    }
    this.beatDisplayTimers = [];
  }

  // ==================== BeatMap 관리 ====================

  /**
   * 현재 활성 BeatMap 반환
   */
  private getActiveBeatMap(): BeatMap | null {
    const useLocal = this.active?.useGlobalSync === false;
    const beatMap = useLocal
      ? this.localBeatMaps.get(this.active!.id) || null
      : this.globalBeatMap;
    console.log('[LoopController] getActiveBeatMap:', {
      useLocal,
      activeId: this.active?.id,
      hasBeatMap: beatMap !== null,
      bpm: beatMap?.bpm,
      beatsPerBar: beatMap?.beatsPerBar
    });
    return beatMap;
  }

  /**
   * 글로벌 BeatMap 업데이트 (Beat Sync 완료 시 호출)
   */
  updateGlobalBeatMap(): void {
    // 오프셋이 0일 수 있으므로 undefined 체크 사용
    if (!this.profile.tempo || !this.profile.timeSignature || this.profile.globalMetronomeOffset === undefined) {
      this.globalBeatMap = null;
      return;
    }

    const [beatsPerBar] = parseTimeSignature(this.profile.timeSignature);
    this.globalBeatMap = new BeatMap(
      this.profile.tempo,
      this.profile.globalMetronomeOffset,
      beatsPerBar,
      this.video.duration || 3600 // 기본 1시간
    );

    console.log('[LoopController] 글로벌 BeatMap 업데이트:', {
      bpm: this.profile.tempo,
      offset: this.profile.globalMetronomeOffset,
      beatsPerBar,
      totalBeats: this.globalBeatMap.length
    });
  }

  /**
   * 로컬 BeatMap 업데이트 (세그먼트별 Beat Sync 완료 시 호출)
   */
  updateLocalBeatMap(segmentId: string): void {
    const segment = this.profile.segments.find(s => s.id === segmentId);
    if (!segment) return;

    if (!segment.localTempo || !segment.localTimeSignature || segment.localMetronomeOffset === undefined) {
      this.localBeatMaps.delete(segmentId);
      return;
    }

    const [beatsPerBar] = parseTimeSignature(segment.localTimeSignature);
    const beatMap = new BeatMap(
      segment.localTempo,
      segment.localMetronomeOffset,
      beatsPerBar,
      this.video.duration || 3600
    );

    this.localBeatMaps.set(segmentId, beatMap);

    console.log('[LoopController] 로컬 BeatMap 업데이트:', {
      segmentId,
      bpm: segment.localTempo,
      offset: segment.localMetronomeOffset,
      beatsPerBar,
      totalBeats: beatMap.length
    });
  }

  // ==================== Profile 관리 ====================

  setProfile(profile: VideoProfile): void {
    this.profile = profile;

    // BeatMap 업데이트
    this.updateGlobalBeatMap();

    if (profile.activeSegmentId) {
      const foundSegment = profile.segments.find(s => s.id === profile.activeSegmentId);
      this.active = foundSegment || undefined;

      if (this.active) {
        this.loopStart = this.active.start;
        this.loopEnd = this.active.end;

        const effectiveSync = this.getEffectiveSync(this.active);
        this.metronomeEnabled = !!(this.active.metronomeEnabled && effectiveSync.tempo && effectiveSync.timeSignature);
      }
    } else {
      this.active = undefined;
      this.loopStart = 0;
      this.loopEnd = Infinity;

      if (!this.globalSyncMetronomeActive) {
        this.metronomeEnabled = false;
        this.cancelAllScheduled();
      } else {
        // ✅ 글로벌 싱크 메트로놈이 활성화되어 있으면 현재 위치부터 재스케줄링
        if (!this.video.paused) {
          console.log('[LoopController] setProfile: 루프 비활성화됨, 글로벌 메트로놈 계속 재생');
          this.cancelAllScheduled();
          this.scheduleBeatsFrom(this.video.currentTime);
        }
      }
    }

    this.applyActiveRate();
  }

  setActive(id?: string | null): void {
    console.log(`[LoopController] setActive (빌드: ${BUILD_ID}):`, { id, globalSync: this.globalSyncMetronomeActive });

    // 기존 스케줄 취소
    this.cancelAllScheduled();

    if (id) {
      const foundSegment = this.profile.segments.find(s => s.id === id);
      this.active = foundSegment || undefined;
    } else {
      this.active = undefined;
    }

    this.applyActiveRate();

    if (this.active) {
      this.loopStart = this.active.start;
      this.loopEnd = this.active.end;

      if (!this.globalSyncMetronomeActive) {
        const effectiveSync = this.getEffectiveSync(this.active);
        this.metronomeEnabled = !!(this.active.metronomeEnabled && effectiveSync.tempo && effectiveSync.timeSignature);
      }

      // 재생 중이면 스케줄링 시작
      if (!this.video.paused && (this.metronomeEnabled || this.globalSyncMetronomeActive)) {
        this.scheduleBeatsFrom(this.video.currentTime);
      }
    } else {
      this.loopStart = 0;
      this.loopEnd = Infinity;

      if (!this.globalSyncMetronomeActive) {
        this.metronomeEnabled = false;
      }

      // ✅ 글로벌 싱크 메트로놈이 활성화되어 있으면 현재 위치부터 재스케줄링
      if (this.globalSyncMetronomeActive && !this.video.paused) {
        console.log('[LoopController] 루프 비활성화됨, 글로벌 메트로놈 계속 재생');
        this.scheduleBeatsFrom(this.video.currentTime);
      }
    }
  }

  getActive(): LoopSegment | undefined {
    return this.active;
  }

  getProfile(): VideoProfile {
    return this.profile;
  }

  // ==================== 메트로놈 관리 ====================

  toggleMetronome(segmentId: string): boolean {
    const segment = this.profile.segments.find(s => s.id === segmentId);
    if (!segment) return false;

    segment.metronomeEnabled = !segment.metronomeEnabled;

    if (this.active?.id === segmentId) {
      const effectiveSync = this.getEffectiveSync(segment);
      this.metronomeEnabled = !!(segment.metronomeEnabled && effectiveSync.tempo && effectiveSync.timeSignature);

      // 재스케줄링
      this.cancelAllScheduled();
      if (!this.video.paused && this.metronomeEnabled) {
        this.scheduleBeatsFrom(this.video.currentTime);
      }
    }

    return segment.metronomeEnabled;
  }

  isMetronomeEnabled(segmentId: string): boolean {
    const segment = this.profile.segments.find(s => s.id === segmentId);
    return segment?.metronomeEnabled || false;
  }

  setMetronomeVolume(volume: number): void {
    this.metronome.setVolume(volume);

    // 실시간 볼륨 반영: 재생 중이고 메트로놈 활성화 상태면 재스케줄링
    if (!this.video.paused && (this.metronomeEnabled || this.globalSyncMetronomeActive)) {
      this.cancelAllScheduled();
      this.scheduleBeatsFrom(this.video.currentTime);
    }
  }

  setMetronomeBeatCallback(callback: ((beat: number, total: number) => void) | null): void {
    this.beatDisplayCallback = callback;
  }

  // ==================== 글로벌 싱크 메트로놈 ====================

  startGlobalSyncMetronome(): void {
    if (!this.profile.tempo || !this.profile.timeSignature) {
      console.log('[Global Sync Metronome] 시작 실패: BPM 또는 박자표 미설정');
      return;
    }

    this.globalSyncMetronomeActive = true;
    this.metronomeEnabled = true;

    // BeatMap 업데이트
    this.updateGlobalBeatMap();

    // 루프 범위 설정
    if (this.active) {
      this.loopStart = this.active.start;
      this.loopEnd = this.active.end;
    } else {
      this.loopStart = 0;
      this.loopEnd = Infinity;
    }

    console.log('[Global Sync Metronome] 시작:', {
      bpm: this.profile.tempo,
      timeSignature: this.profile.timeSignature,
      activeLoop: this.active?.id
    });

    // 재생 중이면 스케줄링 시작
    if (!this.video.paused) {
      this.scheduleBeatsFrom(this.video.currentTime);
    }
  }

  stopGlobalSyncMetronome(): void {
    this.globalSyncMetronomeActive = false;
    this.metronomeEnabled = false;
    this.cancelAllScheduled();
    console.log('[Global Sync Metronome] 중지');
  }

  isGlobalSyncMetronomeActive(): boolean {
    return this.globalSyncMetronomeActive;
  }

  // ==================== 루프 재생 관리 ====================

  tick(): void {
    if (!this.active) return;

    const latestSegment = this.profile.segments.find(s => s.id === this.active!.id);
    if (!latestSegment) return;

    const { start, end } = latestSegment;
    if (typeof start !== 'number' || typeof end !== 'number' || isNaN(start) || isNaN(end)) return;
    if (start >= end) return;

    // 루프 범위 업데이트 (UI에서 변경된 경우)
    if (this.loopStart !== start || this.loopEnd !== end) {
      this.loopStart = start;
      this.loopEnd = end;

      // 재스케줄링 필요
      if ((this.metronomeEnabled || this.globalSyncMetronomeActive) && !this.video.paused) {
        this.cancelAllScheduled();
        this.scheduleBeatsFrom(this.video.currentTime);
      }
    }
  }

  onTimeUpdate(): void {
    this.tickThrottled();
  }

  // ==================== 구간 관리 ====================

  gotoPrevNext(dir: -1 | 1): void {
    const currentTime = this.video.currentTime;
    if (typeof currentTime !== 'number' || isNaN(currentTime)) return;

    const segments = [...this.profile.segments].sort((a, b) => a.start - b.start);
    if (segments.length === 0) return;

    if (dir > 0) {
      const next = segments.find(s => s.start > currentTime) ?? segments[0];
      this.setActive(next?.id);
      if (next && typeof next.start === 'number') {
        this.video.currentTime = next.start;
      }
    } else {
      const prev = [...segments].reverse().find(s => s.start < currentTime) ?? segments[segments.length - 1];
      this.setActive(prev?.id);
      if (prev && typeof prev.start === 'number') {
        this.video.currentTime = prev.start;
      }
    }

    this.applyActiveRate();
  }

  applyActiveRate(): void {
    const safeDefaultRate = typeof this.profile.defaultRate === 'number' && !isNaN(this.profile.defaultRate)
      ? this.profile.defaultRate
      : 1.0;
    const rate = this.active?.rate ?? safeDefaultRate;
    this.video.playbackRate = rate;
  }

  createSegmentFromCurrentTime(type: 'start' | 'end', label?: string): LoopSegment | null {
    const currentTime = this.video.currentTime;
    if (typeof currentTime !== 'number' || isNaN(currentTime)) return null;

    const safeDefaultRate = typeof this.profile.defaultRate === 'number' && !isNaN(this.profile.defaultRate)
      ? this.profile.defaultRate
      : 1.0;

    if (type === 'start') {
      const endTime = Math.min(currentTime + 10, this.video.duration);
      if (typeof endTime !== 'number' || isNaN(endTime)) return null;

      let segmentLabel = label;
      if (!segmentLabel) {
        const startMin = Math.floor(currentTime / 60);
        const startSec = Math.floor(currentTime % 60);
        const endMin = Math.floor(endTime / 60);
        const endSec = Math.floor(endTime % 60);
        segmentLabel = `${startMin.toString().padStart(2, '0')}:${startSec.toString().padStart(2, '0')}~${endMin.toString().padStart(2, '0')}:${endSec.toString().padStart(2, '0')}`;
      }

      const segment: LoopSegment = {
        id: Math.random().toString(36).substring(2, 15),
        start: currentTime,
        end: endTime,
        rate: safeDefaultRate,
        label: segmentLabel
      };

      this.profile.segments.push(segment);
      return segment;
    } else {
      const lastSegment = this.profile.segments[this.profile.segments.length - 1];
      if (lastSegment && lastSegment.start < currentTime) {
        lastSegment.end = currentTime;

        if (!lastSegment.label || lastSegment.label.startsWith('구간 ')) {
          const startMin = Math.floor(lastSegment.start / 60);
          const startSec = Math.floor(lastSegment.start % 60);
          const endMin = Math.floor(currentTime / 60);
          const endSec = Math.floor(currentTime % 60);
          lastSegment.label = `${startMin.toString().padStart(2, '0')}:${startSec.toString().padStart(2, '0')}~${endMin.toString().padStart(2, '0')}:${endSec.toString().padStart(2, '0')}`;
        }

        return lastSegment;
      }
    }

    return null;
  }

  updateSegment(id: string, updates: Partial<LoopSegment>): boolean {
    const segment = this.profile.segments.find(s => s.id === id);
    if (!segment) return false;

    const newStart = updates.start !== undefined ? updates.start : segment.start;
    const newEnd = updates.end !== undefined ? updates.end : segment.end;

    if (typeof newStart === 'number' && typeof newEnd === 'number' && !isNaN(newStart) && !isNaN(newEnd)) {
      if (newStart >= newEnd) return false;
    }

    Object.assign(segment, updates);

    if (this.active?.id === id) {
      this.applyActiveRate();

      if (updates.start !== undefined || updates.end !== undefined) {
        this.loopStart = segment.start;
        this.loopEnd = segment.end;

        // 재스케줄링
        if ((this.metronomeEnabled || this.globalSyncMetronomeActive) && !this.video.paused) {
          this.cancelAllScheduled();
          this.scheduleBeatsFrom(this.video.currentTime);
        }
      }
    }

    return true;
  }

  deleteSegment(id: string): boolean {
    const index = this.profile.segments.findIndex(s => s.id === id);
    if (index === -1) return false;

    this.profile.segments.splice(index, 1);
    this.localBeatMaps.delete(id);

    if (this.active?.id === id) {
      this.setActive(null);
    }

    return true;
  }

  setDefaultRate(rate: number): void {
    this.profile.defaultRate = rate;
    this.applyActiveRate();
  }

  getSegmentAtCurrentTime(): LoopSegment | undefined {
    const currentTime = this.video.currentTime;
    if (typeof currentTime !== 'number' || isNaN(currentTime)) return undefined;

    return this.profile.segments.find(s =>
      currentTime >= s.start && currentTime <= s.end
    );
  }

  // ==================== Beat Sync 설정 ====================

  private getEffectiveSync(segment: LoopSegment): {
    tempo: number | undefined;
    timeSignature: string | undefined;
    offset: number | undefined;
  } {
    if (segment.useGlobalSync !== false) {
      return {
        tempo: this.profile.tempo,
        timeSignature: this.profile.timeSignature,
        offset: this.profile.globalMetronomeOffset
      };
    } else {
      return {
        tempo: segment.localTempo,
        timeSignature: segment.localTimeSignature,
        offset: segment.localMetronomeOffset
      };
    }
  }

  // ==================== 카운트인 ====================

  startCountIn(
    segmentId: string,
    onBeat: (beat: number, total: number) => void,
    onComplete: () => void
  ): void {
    const segment = this.profile.segments.find(s => s.id === segmentId);
    if (!segment) {
      console.error('[Count-In] 세그먼트를 찾을 수 없음:', segmentId);
      return;
    }

    const effectiveSync = this.getEffectiveSync(segment);
    if (!effectiveSync.tempo || !effectiveSync.timeSignature) {
      console.error('[Count-In] BPM 또는 박자표 미설정');
      return;
    }

    const [beatsPerBar] = parseTimeSignature(effectiveSync.timeSignature);
    const bpm = effectiveSync.tempo;

    console.log('[Count-In] 시작:', { segmentId, bpm, beatsPerBar, loopStart: segment.start });

    this.countInActive = true;

    // 타이머 기반 카운트인 (영상 정지 상태에서)
    this.video.currentTime = segment.start;
    this.startTimerBasedCountIn(segment, bpm, beatsPerBar, onBeat, onComplete);
  }

  private startTimerBasedCountIn(
    segment: LoopSegment,
    bpm: number,
    beatsPerBar: number,
    onBeat: (beat: number, total: number) => void,
    onComplete: () => void
  ): void {
    const beatDuration = 60 / bpm;
    let currentBeat = 0;

    const ctx = this.metronome.getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const playNextBeat = () => {
      if (!this.countInActive) return;

      const isDownbeat = currentBeat === 0;
      this.metronome.playClickNow(isDownbeat);
      onBeat(currentBeat + 1, beatsPerBar);
      currentBeat++;

      if (currentBeat < beatsPerBar) {
        this.countInVideoStartTimer = window.setTimeout(playNextBeat, beatDuration * 1000);
      } else {
        this.handleTimerCountInComplete(segment, onComplete);
      }
    };

    playNextBeat();
  }

  private handleTimerCountInComplete(segment: LoopSegment, onComplete: () => void): void {
    const latestSegment = this.profile.segments.find(s => s.id === segment.id);
    if (!latestSegment) {
      this.resetCountInState();
      return;
    }

    this.setActive(latestSegment.id);

    this.video.currentTime = latestSegment.start;
    this.video.play().catch(err => console.error('[Count-In] 재생 실패:', err));

    onComplete();
    this.resetCountInState();
  }

  cancelCountIn(pauseVideo: boolean = true): void {
    if (!this.countInActive) return;

    this.cancelAllScheduled();

    if (this.countInVideoStartTimer !== null) {
      clearTimeout(this.countInVideoStartTimer);
      this.countInVideoStartTimer = null;
    }

    if (pauseVideo) {
      this.video.pause();
    }

    this.resetCountInState();
  }

  private resetCountInState(): void {
    this.countInActive = false;
    this.countInVideoStartTimer = null;
  }

  isCountInActive(): boolean {
    return this.countInActive;
  }

  // ==================== 리소스 정리 ====================

  dispose(): void {
    console.log(`[LoopController #${this.instanceId}] 🗑️ dispose 호출`);
    this.cancelCountIn();
    this.cancelAllScheduled();
    this.removeVideoEventListeners();
    this.metronome.dispose();
    this.globalSyncMetronomeActive = false;
  }
}
