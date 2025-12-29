# Development Documentation

이 디렉토리는 Loop Practice for YouTube 확장 프로그램의 개발 히스토리와 기술 문서를 관리합니다.

## 📁 문서 구조

```
docs/development/
├── README.md                    # 이 파일
├── ARCHITECTURE.md              # 프로젝트 아키텍처 개요
├── CHANGELOG.md                 # 주요 변경사항 및 릴리스 노트
└── sessions/                    # 날짜별 개발 세션 로그
    └── 2025-12-29/
        ├── session-01-ui-improvements.md
        └── session-02-bug-fixes.md
```

## 📝 문서 사용 가이드

### 새 세션 시작 시
1. `sessions/YYYY-MM-DD/` 디렉토리 확인
2. 가장 최근 세션 문서 읽기
3. `ARCHITECTURE.md`에서 전체 구조 파악

### 세션 종료 시
1. 현재 작업 내용을 세션 문서에 기록
2. 주요 변경사항은 `CHANGELOG.md`에 업데이트
3. 아키텍처 변경이 있다면 `ARCHITECTURE.md` 업데이트

## 🔍 빠른 참조

- **최근 변경사항**: [CHANGELOG.md](./CHANGELOG.md)
- **시스템 구조**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **오늘 작업**: [sessions/2025-12-29/](./sessions/2025-12-29/)

## 💡 팁

새로운 Claude 세션을 시작할 때 이렇게 요청하세요:

```
"docs/development/ARCHITECTURE.md와
docs/development/sessions/2025-12-29/ 디렉토리의
가장 최근 파일을 읽고 작업을 이어가고 싶어"
```
