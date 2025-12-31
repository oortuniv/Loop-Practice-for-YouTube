# 배포 자동화 가이드

## 📋 개요

이 프로젝트는 GitHub Actions를 통한 자동 빌드 시스템을 사용합니다.

**두 가지 배포 방식**:
1. **태그 기반 배포**: GitHub Release 자동 생성 (공식 릴리스용)
2. **main 브랜치 배포**: 빌드 아티팩트 생성 (개발/테스트용)

---

## 🏷️ 방법 1: 태그 기반 배포 (추천)

### 사용 시기
- 새 버전을 Chrome Web Store에 제출할 때
- 공식 릴리스 버전을 배포할 때

### 배포 절차

#### 1. 버전 업데이트
```bash
# package.json 버전 업데이트 + Git 태그 자동 생성
npm version patch  # 0.1.0 → 0.1.1 (버그 수정)
npm version minor  # 0.1.1 → 0.2.0 (새 기능)
npm version major  # 0.2.0 → 1.0.0 (큰 변경)
```

#### 2. 태그 푸시
```bash
git push origin v0.1.1  # 생성된 태그 푸시
# 또는
git push --follow-tags  # 커밋과 태그 함께 푸시
```

#### 3. 자동 빌드 대기
- GitHub Actions가 자동으로 실행됨
- 진행 상황: [GitHub Actions 탭](../../actions) 확인
- 약 2-3분 소요

#### 4. Release 다운로드
- [Releases 페이지](../../releases)에서 ZIP 파일 다운로드
- `loop-practice-for-youtube-{버전}.zip` 파일 획득

#### 5. Chrome Web Store 업로드
1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) 접속
2. 확장 프로그램 선택
3. "패키지" → "새 패키지 업로드"
4. 다운로드한 ZIP 파일 업로드
5. "제출하여 검토" 클릭

---

## 🔄 방법 2: main 브랜치 푸시 배포

### 사용 시기
- 빠른 테스트가 필요할 때
- 정식 릴리스 전 검증
- develop 브랜치에서 main으로 머지 후

### 배포 절차

#### 1. main 브랜치에 푸시
```bash
git checkout main
git merge develop  # 또는 직접 커밋
git push origin main
```

#### 2. 자동 빌드 대기
- GitHub Actions 자동 실행
- 문서/설정 파일 변경은 빌드 트리거 안 됨

#### 3. 아티팩트 다운로드
1. [Actions 탭](../../actions) 접속
2. 최근 워크플로우 실행 클릭
3. "Artifacts" 섹션에서 ZIP 다운로드
4. 30일간 보관됨

---

## 🔧 버전 관리 전략

### package.json vs manifest.ts

**문제**: Chrome Extension은 `manifest.json`에도 버전이 필요
**해결**: GitHub Actions가 자동으로 동기화

```
package.json (version: "0.1.1")
    ↓
GitHub Actions 빌드 시
    ↓
manifest.ts 자동 업데이트
    ↓
dist/manifest.json (version: "0.1.1")
```

### 버전 업데이트 규칙

```bash
# Patch (0.1.0 → 0.1.1): 버그 수정, 작은 개선
npm version patch

# Minor (0.1.0 → 0.2.0): 새 기능, 하위 호환
npm version minor

# Major (0.1.0 → 1.0.0): 큰 변경, 하위 호환 깨짐
npm version major
```

---

## 🌿 브랜치 전략

```
main (production)
  └── develop (개발/테스트)
       └── feature/* (선택사항)
```

### 워크플로우

1. **일상 개발**: `develop` 브랜치에서 작업
2. **기능 개발**: 필요시 `feature/기능명` 브랜치 생성
3. **테스트**: develop에서 충분히 테스트
4. **배포 준비**:
   ```bash
   git checkout main
   git merge develop
   npm version patch  # 버전 업데이트
   git push --follow-tags
   ```

---

## 📦 빌드 아티팩트 구조

### GitHub Release (태그 기반)
```
loop-practice-for-youtube-0.1.1.zip
├── manifest.json (버전 자동 업데이트됨)
├── background.js
├── popup.html
├── content/
└── assets/
```

### GitHub Artifacts (main 푸시)
- 동일한 구조
- Actions 탭에서 다운로드
- 30일 후 자동 삭제

---

## 🚨 문제 해결

### Q: 빌드가 실행되지 않아요
- `.github/workflows/` 파일이 main 브랜치에 있는지 확인
- Actions 탭에서 워크플로우가 활성화되어 있는지 확인
- 문서 파일만 수정한 경우 빌드 스킵됨 (정상)

### Q: 태그를 잘못 만들었어요
```bash
# 로컬 태그 삭제
git tag -d v0.1.1

# 원격 태그 삭제
git push origin :refs/tags/v0.1.1
```

### Q: manifest 버전이 안 맞아요
- GitHub Actions가 자동으로 동기화함
- 로컬에서는 `package.json` 버전만 관리하면 됨
- 빌드된 `dist/manifest.json`에 올바른 버전이 들어감

### Q: 수동으로 빌드하고 싶어요
```bash
npm run build
cd dist
zip -r ../my-build.zip .
```

---

## 📊 워크플로우 비교

| 특성 | 태그 기반 | main 푸시 |
|------|----------|-----------|
| **트리거** | `git push origin v*.*.*` | `git push origin main` |
| **결과물** | GitHub Release | Artifacts |
| **보관 기간** | 영구 | 30일 |
| **용도** | 공식 릴리스 | 테스트/검증 |
| **버전 관리** | 태그에서 추출 | package.json |
| **Release Notes** | 자동 생성 | 커밋 댓글 |

---

## 🎯 권장 워크플로우

### 일반적인 개발 사이클

```bash
# 1. develop 브랜치에서 작업
git checkout develop
# ... 코드 수정 ...
git commit -m "feat: 새 기능 추가"
git push origin develop

# 2. 테스트 완료 후 main에 머지
git checkout main
git merge develop
git push origin main
# → GitHub Actions가 빌드 (Artifacts 생성)
# → Artifacts 다운로드하여 로컬 테스트

# 3. 배포 준비됨 → 태그 생성
npm version minor  # 0.1.0 → 0.2.0
git push --follow-tags
# → GitHub Release 자동 생성
# → Chrome Web Store에 업로드
```

---

## 📚 참고 자료

- [GitHub Actions 문서](https://docs.github.com/en/actions)
- [npm version 문서](https://docs.npmjs.com/cli/v9/commands/npm-version)
- [Chrome Web Store 개발자 가이드](https://developer.chrome.com/docs/webstore/)

---

**마지막 업데이트**: 2025-12-31
