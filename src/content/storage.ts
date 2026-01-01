import { VideoProfile, StorageKey } from '../types';

export async function loadProfile(videoId: string): Promise<VideoProfile> {
  const key: StorageKey = `vid:${videoId}`;
  const data = await chrome.storage.sync.get(key);

  if (data[key]) {
    const profile = data[key] as VideoProfile;
    // 페이지 로드 시 활성 루프 초기화 (새로고침/페이지 이동 시 루프 비활성화)
    profile.activeSegmentId = null;
    return profile;
  }
  
  // 새로운 프로필 생성
  const fresh: VideoProfile = { 
    videoId, 
    defaultRate: 1.0, 
    segments: [], 
    activeSegmentId: null
  };
  
  await chrome.storage.sync.set({ [key]: fresh });
  return fresh;
}

export async function saveProfile(profile: VideoProfile): Promise<void> {
  const key: StorageKey = `vid:${profile.videoId}`;
  await chrome.storage.sync.set({ [key]: profile });
}

export async function deleteProfile(videoId: string): Promise<void> {
  const key: StorageKey = `vid:${videoId}`;
  await chrome.storage.sync.remove(key);
}

export async function getAllProfiles(): Promise<VideoProfile[]> {
  const data = await chrome.storage.sync.get(null);
  return Object.values(data).filter(item => 
    typeof item === 'object' && 
    item !== null && 
    'videoId' in item && 
    'segments' in item
  ) as VideoProfile[];
}

export async function clearAllProfiles(): Promise<void> {
  await chrome.storage.sync.clear();
} 