# oh-my-han-word

[rhwp](https://github.com/edwardkim/rhwp) 프로젝트를 **데비안 계열 리눅스용 단독 실행형 데스크탑 앱**으로 패키징한 래퍼입니다.

HWP/HWPX 파일의 파싱·렌더링·편집 기능은 모두 [rhwp](https://github.com/edwardkim/rhwp)가 담당하며, 이 프로젝트는 그 위에 아래 기능을 얹습니다.

## 이 프로젝트가 추가하는 것

- **네이티브 데스크탑 앱** — Tauri로 패키징, 별도 서버·브라우저 없이 실행
- **OS 네이티브 파일 열기 다이얼로그** — `파일 → 열기` 시 OS 파일 선택 창 사용
- **네이티브 저장 흐름** — `Ctrl+S` 저장, 다른 이름으로 저장, 기존 파일 덮어쓰기 지원
- **최근 파일 및 파일 연결** — 최근 파일 목록과 `.hwp`/`.hwpx` 파일 연결 지원
- **자동 .deb 빌드** — rhwp upstream 업데이트 감지 → 자동으로 새 릴리즈 생성

HWP 편집·렌더링 기능의 로드맵은 [rhwp 로드맵](https://github.com/edwardkim/rhwp#로드맵)을 참고하세요.

## 설치

[Releases](../../releases) 페이지에서 최신 `.deb` 파일을 다운로드 후 설치합니다. Debian/Ubuntu 계열 배포판을 대상으로 합니다.

```bash
sudo dpkg -i rhwp-desktop_*.deb
```

의존성 문제가 표시되면 다음 명령으로 이어서 설치합니다.

```bash
sudo apt install -f
```

또는 apt가 로컬 `.deb` 의존성을 함께 처리하도록 설치할 수 있습니다.

```bash
sudo apt install ./rhwp-desktop_*.deb
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

## 개발/빌드

처음 체크아웃한 뒤 서브모듈과 루트 의존성을 준비합니다.

```bash
git submodule update --init --recursive
npm ci
```

개발 모드:

```bash
npm run tauri dev
```

`.deb` 패키지 빌드:

```bash
npm run tauri build -- --bundles deb
```

빌드 결과물은 `src-tauri/target/release/bundle/deb/` 아래에 생성됩니다.

서브모듈 `src-rhwp`의 현재 요구 사항은 Rust 1.75+, Node.js 18+입니다. CI는 Node.js 20과 Tauri v2 리눅스 빌드 의존성을 사용합니다. 로컬 데비안 계열 환경에서는 WebKitGTK/Tauri 빌드 의존성이 필요할 수 있습니다.

```bash
sudo apt install \
  build-essential curl wget file libssl-dev libgtk-3-dev \
  libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
```

데스크탑 앱 빌드는 다음 산출물을 사용합니다.

- `wasm-pack build src-rhwp --target web` → `src-rhwp/pkg/`
- `npm --prefix src-rhwp/rhwp-studio run build` → `src-rhwp/rhwp-studio/dist/`

Tauri 설정은 `src-rhwp/rhwp-studio/dist`를 `frontendDist`로 사용합니다. CI의 `CI=true` 조건은 캐시된 `src-rhwp/pkg`가 있을 때 `wasm-pack` 재빌드만 건너뛰기 위한 것이며, `rhwp-studio` 설치와 빌드는 Tauri `beforeBuildCommand`에서 계속 실행됩니다.

## upstream 상태

`src-rhwp`는 [edwardkim/rhwp](https://github.com/edwardkim/rhwp)를 그대로 가져오는 서브모듈입니다. HWP/HWPX 파싱, 렌더링, 편집 기능은 upstream 변경을 따르며, 이 저장소에서는 데스크탑 패키징과 OS 연동만 관리합니다.

GitHub Actions가 upstream `rhwp`의 새 커밋을 주기적으로 확인합니다. 새 버전이 올라오면 `src-rhwp` 서브모듈을 최신 upstream으로 갱신하는 커밋을 만들고, 그 커밋이 `main`에 푸시되면서 데스크탑 앱 `.deb` 릴리즈 빌드가 자동으로 실행됩니다.

수동으로 upstream을 갱신하려면 다음처럼 확인합니다.

```bash
git -C src-rhwp fetch origin
git -C src-rhwp checkout origin/main
git add src-rhwp
```

## 고지

본 프로젝트는 한글과컴퓨터와 제휴, 후원, 승인 관계가 없는 독립 오픈소스 프로젝트입니다. "한글", "한컴", "HWP", "HWPX"는 각 권리자의 상표일 수 있습니다.

## 라이선스

MIT — 단, 서브모듈 [rhwp](https://github.com/edwardkim/rhwp)는 해당 프로젝트의 라이선스를 따릅니다.
