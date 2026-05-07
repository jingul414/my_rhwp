# oh-my-han-word

[rhwp](https://github.com/edwardkim/rhwp) 프로젝트를 **데비안 계열 리눅스용 단독 실행형 데스크탑 앱**으로 패키징한 래퍼입니다.

HWP/HWPX 파일의 파싱·렌더링·편집 기능은 모두 [rhwp](https://github.com/edwardkim/rhwp)가 담당하며, 이 프로젝트는 그 위에 아래 기능을 얹습니다.

## 이 프로젝트가 추가하는 것

- **네이티브 데스크탑 앱** — Tauri로 패키징, 별도 서버·브라우저 없이 실행
- **OS 네이티브 파일 열기 다이얼로그** — `파일 → 열기` 시 OS 파일 선택 창 사용
- **자동 .deb 빌드** — rhwp upstream 업데이트 감지 → 자동으로 새 릴리즈 생성

HWP 편집·렌더링 기능의 로드맵은 [rhwp 로드맵](https://github.com/edwardkim/rhwp#로드맵)을 참고하세요.

## 설치

[Releases](../../releases) 페이지에서 최신 `.deb` 파일을 다운로드 후 설치합니다.

```bash
sudo dpkg -i rhwp-desktop_*.deb
```

## 빌드 구조

```
oh-my-han-word/
├── src-tauri/          # Tauri 백엔드 (Rust) — 파일 I/O, OS 다이얼로그 연동
│   └── src/
│       ├── lib.rs              # pick_hwp_file Tauri 커맨드
│       └── tauri-bridge.js     # 초기화 스크립트 — rhwp-studio와 IPC 연결
├── src-rhwp/           # rhwp 서브모듈 (upstream: edwardkim/rhwp, 직접 수정 금지)
│   ├── src/            # Rust 소스 (HWP 파서/렌더러)
│   ├── pkg/            # wasm-pack 빌드 출력 (WASM + JS 바인딩)
│   └── rhwp-studio/    # 웹 프론트엔드 (Tauri WebView에서 실행)
└── .github/workflows/
    ├── build.yml           # Tauri 앱 빌드 → .deb 릴리즈
    └── check-upstream.yml  # rhwp upstream 변경 감지 → 자동 빌드 트리거
```

## 개발/빌드 메모

서브모듈 `src-rhwp`의 현재 요구 사항은 Rust 1.75+, Node.js 18+입니다. 데스크탑 앱 빌드는 다음 산출물을 사용합니다.

- `wasm-pack build src-rhwp --target web` → `src-rhwp/pkg/`
- `npm --prefix src-rhwp/rhwp-studio run build` → `src-rhwp/rhwp-studio/dist/`

Tauri 설정은 `src-rhwp/rhwp-studio/dist`를 `frontendDist`로 사용합니다. CI의 `CI=true` 조건은 캐시된 `src-rhwp/pkg`가 있을 때 `wasm-pack` 재빌드만 건너뛰기 위한 것이며, `rhwp-studio` 설치와 빌드는 Tauri `beforeBuildCommand`에서 계속 실행됩니다.

## 라이선스

MIT — 단, 서브모듈 [rhwp](https://github.com/edwardkim/rhwp)는 해당 프로젝트의 라이선스를 따릅니다.
