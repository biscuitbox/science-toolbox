/* ============================================================
   과학 도구상자 — 공통 내비게이션 (toolbox-nav.js)

   ✅ 각 도구의 index.html 안에 이 한 줄만 넣으면 끝입니다.
      <script src="../../toolbox-nav.js"></script>

   ✅ 위치는 </head> 바로 앞이나 </body> 바로 앞 어디든 됩니다.

   ✅ 폴더 깊이가 2단계(카테고리/도구명/)이면 "../../"를 쓰세요.
      나중에 3단계(카테고리/하위분류/도구명/)가 되면 "../../../"으로 바꾸면 됩니다.

   ── 이 파일의 위치: 사이트 루트(index.html과 같은 폴더)
   ============================================================ */

(function () {
  'use strict';

  // ── 1. document.currentScript 는 스크립트 실행 시점에만 유효합니다.
  //       DOMContentLoaded 콜백 안에서는 이미 null이 되므로
  //       여기서 즉시 변수에 저장해 두어야 합니다.
  var script = document.currentScript;
  if (!script) {
    // 아주 오래된 브라우저(IE9 이하) 예외 처리 — 그냥 종료
    return;
  }

  // ── 2. 이 파일 자신의 URL에서 사이트 루트를 계산합니다.
  //       예) "https://user.github.io/science-toolbox/toolbox-nav.js"
  //        →  "https://user.github.io/science-toolbox/"
  //       경로 마지막 "/" 이후를 지우면 디렉터리(= 사이트 루트)가 됩니다.
  var rootUrl = script.src.replace(/\/[^/]+$/, '/');

  // ── 3. 링크의 디자인 CSS ─────────────────────────────────────────────
  //       배경이 어둡든 밝든 잘 보이는 반투명 다크 글래스 스타일입니다.
  //       도구가 원한다면 .toolbox-back-link { ... }를 덮어쓰면 됩니다.
  var CSS = [
    '/* toolbox-nav.js 자동 주입 CSS */',
    '.toolbox-back-link {',
    '  position: fixed;',
    '  top: 14px;',
    '  left: 14px;',
    '  z-index: 9999;',
    '  display: inline-flex;',
    '  align-items: center;',
    '  gap: 0.3rem;',
    '  padding: 0.42rem 0.9rem;',
    '  font-family: var(--font-body, "Pretendard", "Noto Sans KR", system-ui, sans-serif);',
    '  font-size: 0.73rem;',
    '  letter-spacing: 0.04em;',
    '  color: rgba(220, 228, 248, 0.88);',
    '  text-decoration: none;',
    '  background: rgba(12, 18, 32, 0.72);',
    '  border: 1px solid rgba(255, 255, 255, 0.14);',
    '  border-radius: 999px;',
    '  backdrop-filter: blur(12px);',
    '  -webkit-backdrop-filter: blur(12px);',
    '  transition: color 0.18s, border-color 0.18s, background 0.18s;',
    '  line-height: 1;',
    '  white-space: nowrap;',
    '  user-select: none;',
    '  cursor: pointer;',
    '}',
    '.toolbox-back-link:hover {',
    '  color: #ffffff;',
    '  background: rgba(12, 18, 32, 0.92);',
    '  border-color: rgba(255, 255, 255, 0.32);',
    '}',
    '.toolbox-back-link:focus-visible {',
    '  outline: 2px solid rgba(56, 189, 248, 0.65);',
    '  outline-offset: 3px;',
    '}',
    '@media print {',
    '  .toolbox-back-link { display: none !important; }',
    '}',
    '@media (max-width: 600px) {',
    '  .toolbox-back-link {',
    '    top: 10px; left: 10px;',
    '    font-size: 0.65rem;',
    '    padding: 0.32rem 0.65rem;',
    '  }',
    '}'
  ].join('\n');

  // ── 4. CSS와 링크를 DOM에 삽입합니다 ────────────────────────────────
  function inject() {
    // 이미 삽입된 경우 중복 실행 방지
    if (document.querySelector('.toolbox-back-link')) return;

    // <style> 태그를 <head> 안에 추가
    var styleEl = document.createElement('style');
    styleEl.setAttribute('data-source', 'toolbox-nav');
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    // <a> 링크를 <body> 맨 첫 번째 자식으로 추가
    var link = document.createElement('a');
    link.href = rootUrl;
    link.className = 'toolbox-back-link';
    link.setAttribute('aria-label', '과학 도구상자 홈으로 돌아가기');
    link.textContent = '← 도구상자';
    document.body.insertBefore(link, document.body.firstChild);
  }

  // DOM 준비 상태에 따라 즉시 실행하거나 준비될 때까지 기다립니다
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject(); // 이미 DOM이 준비된 경우 (스크립트를 body 끝에 넣었을 때)
  }

}());
