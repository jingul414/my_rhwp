(function () {
  // Tauri 환경에서만 실행 (withGlobalTauri: true 필요)
  if (typeof window.__TAURI__ === 'undefined') return;

  var invoke = window.__TAURI__.core.invoke;

  async function openWithTauri() {
    try {
      var result = await invoke('pick_hwp_file');
      if (!result) return;

      // base64 → Uint8Array 변환
      var binary = atob(result.data_b64);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      // rhwp-studio postMessage API로 파일 전달
      window.postMessage(
        {
          type: 'rhwp-request',
          id: Date.now(),
          method: 'loadFile',
          params: { data: bytes, fileName: result.file_name },
        },
        '*'
      );

      // 창 제목 업데이트 (1-2)
      try {
        var getCurrentWindow = window.__TAURI__.window.getCurrentWindow;
        if (getCurrentWindow) {
          await getCurrentWindow().setTitle('RHWP Desktop — ' + result.file_name);
        }
      } catch (_) {}
    } catch (e) {
      console.error('[tauri-bridge] 파일 열기 실패:', e);
    }
  }

  // #file-input.click() 을 Tauri 네이티브 다이얼로그로 교체
  function patchFileInput() {
    var input = document.getElementById('file-input');
    if (input) input.click = openWithTauri;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchFileInput);
  } else {
    patchFileInput();
  }
})();
