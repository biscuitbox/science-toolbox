/* ============================================================
   과학 도구상자 — 메인 스크립트
   tools.json을 읽어 ① 맨 위 "도구 표"와 ② 분야별 도구 칸을 그립니다.

   ✅ 새로 생긴 선택 필드
      "symbol": "Lr"  ← 도구 칸에 크게 보이는 원소 기호(1~3글자)
                        비워 두면 id에서 자동으로 만듭니다.
                        예) light-ray-lab → "Lr", qr-code-maker → "Qc"
   ============================================================ */

// ===== 분야(카테고리) 설정 =====
// 색은 style.css의 --c-분야 변수에서 가져옵니다(칠판 화면에서 자동으로 밝은 색으로 바뀜).
const CATEGORIES = {
  physics:   { name: '물리',      short: '물리',     description: '역학, 전자기, 빛과 파동, 열, 현대물리' },
  chemistry: { name: '화학',      short: '화학',     description: '물질의 구성, 화학 반응, 산과 염기, 전기 화학' },
  biology:   { name: '생명과학',  short: '생명',     description: '세포, 유전, 우리 몸, 생태와 진화' },
  earth:     { name: '지구과학',  short: '지구',     description: '지질, 대기와 날씨, 천문, 해양' },
  maker:     { name: '메이커',    short: '메이커',   description: '직접 만들고 실험하는 활동' },
  common:    { name: '공통 도구', short: '공통',     description: '단위 변환, 주기율표, QR코드처럼 여러 분야에서 쓰는 도구' },
  classroom: { name: '학급 운영', short: '학급',     description: '모둠 구성, 자리 바꾸기, 발표자 뽑기 같은 교실 운영 도구' }
};

const CATEGORY_ORDER = ['physics', 'chemistry', 'biology', 'earth', 'maker', 'common', 'classroom'];

// 분야 아이콘 (색만으로 구분하지 않도록 모양도 함께 씁니다)
const ICONS = {
  physics:   '<path d="M2 12c2-5.5 4.5-5.5 6.5 0s4.5 5.5 6.5 0 4.5-5.5 7-1"/>',
  chemistry: '<path d="M9 3h6M10 3v6.5L4.6 19a1.4 1.4 0 0 0 1.2 2.1h12.4a1.4 1.4 0 0 0 1.2-2.1L14 9.5V3"/><path d="M7.2 15h9.6"/>',
  biology:   '<path d="M5 20c0-8.5 5.5-14.5 15-16-.8 10-6.8 16-15 16z"/><path d="M5 20 13.5 11.5"/>',
  earth:     '<path d="M2 20 9 8.5l4 6 3-4 6 9.5z"/><circle cx="17.5" cy="5" r="2"/>',
  maker:     '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  common:    '<rect x="2" y="8" width="20" height="8" rx="1"/><path d="M6 8v3M10 8v4.5M14 8v3M18 8v4.5"/>',
  classroom: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M15.6 14.2A5 5 0 0 1 21 19"/>',
  star:      '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'
};

function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

// ===== 학년 필터 =====
const GRADE_FILTERS = [
  { id: 'all',        name: '전체', match: () => true },
  { id: 'elementary', name: '초등', match: lvl => lvl.includes('초') || isAllGrades(lvl) },
  { id: 'middle',     name: '중등', match: lvl => lvl.includes('중') || isAllGrades(lvl) },
  { id: 'high',       name: '고등', match: lvl => lvl.includes('고') || isAllGrades(lvl) }
];

// "전 학년"과 "전체" 모두 모든 학년으로 취급
function isAllGrades(lvl) {
  return lvl.includes('전 학년') || lvl.includes('전학년') || lvl.trim() === '전체';
}

// ===== 상태 =====
let allTools = [];
let activeGrade = 'all';
let searchQuery = '';
let teacherMode = false;
let boardMode = false;

// ===== 초기화 =====
async function init() {
  try {
    teacherMode = localStorage.getItem('teacherMode') === 'true';
    boardMode = localStorage.getItem('boardMode') === 'true';
    activeGrade = localStorage.getItem('activeGrade') || 'all';
    if (!GRADE_FILTERS.some(f => f.id === activeGrade)) activeGrade = 'all';
  } catch { /* 시크릿 모드 등에서는 저장소를 못 쓸 수 있음 */ }

  setupSwitch('teacher-mode-toggle', teacherMode, on => {
    teacherMode = on;
    save('teacherMode', on);
    renderTiles();
  });

  setupSwitch('board-mode-toggle', boardMode, on => {
    boardMode = on;
    save('boardMode', on);
    if (on) document.documentElement.dataset.theme = 'board';
    else delete document.documentElement.dataset.theme;
  });

  setupSearch();
  setupBackToTable();

  try {
    const response = await fetch('tools.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error('tools.json 로딩 실패');
    const data = await response.json();
    allTools = (data.tools || []).map(t => ({ ...t, available: true }));

    renderGradeFilter();
    renderAll();
    checkAvailability();
  } catch (err) {
    document.getElementById('sections').innerHTML = `
      <div class="empty-state">
        <strong>도구 목록(tools.json)을 불러오지 못했어요.</strong>
        tools.json이 index.html과 같은 폴더에 있는지, 쉼표·따옴표 같은 문법 오류가 없는지 확인해 주세요.<br>
        문법 확인은 jsonlint.com에 내용을 붙여 넣으면 됩니다.
      </div>`;
    console.error(err);
  }
}

function save(key, value) {
  try { localStorage.setItem(key, String(value)); } catch {}
}

function setupSwitch(id, initial, onChange) {
  const input = document.getElementById(id);
  input.checked = initial;
  input.setAttribute('aria-checked', String(initial));
  input.addEventListener('change', () => {
    input.setAttribute('aria-checked', String(input.checked));
    onChange(input.checked);
  });
}

// ===== 폴더 존재 자동 확인 =====
// 각 도구의 path에 HEAD 요청(파일 내용은 받지 않고 '있는지'만 확인)을 보내
// 없으면 "준비 중"으로 바꿉니다.
async function checkAvailability() {
  const results = await Promise.all(allTools.map(async (tool, i) => {
    try {
      const res = await fetch(tool.path, { method: 'HEAD', cache: 'no-store' });
      return { i, available: res.ok };
    } catch {
      return { i, available: false };
    }
  }));

  let changed = false;
  results.forEach(({ i, available }) => {
    if (allTools[i].available !== available) {
      allTools[i].available = available;
      changed = true;
    }
  });
  if (changed) renderAll();
}

// ===== 원소 기호 =====
function symbolOf(tool) {
  if (tool.symbol) return String(tool.symbol).slice(0, 3);
  const parts = String(tool.id || tool.name || '?').split(/[-_\s]+/).filter(Boolean);
  if (parts.length >= 2) return parts[0][0].toUpperCase() + parts[1][0].toLowerCase();
  const w = parts[0] || '?';
  return w[0].toUpperCase() + (w[1] || '').toLowerCase();
}

// ===== 필터링 =====
function matches(t) {
  const grade = GRADE_FILTERS.find(f => f.id === activeGrade);
  if (grade && !grade.match(t.level || '')) return false;

  if (searchQuery) {
    const standards = toArray(t.achievementStandard);
    const haystack = [
      t.name, t.description, t.subcategory, ...(t.tags || []),
      t.level, t.target, t.activityType, symbolOf(t),
      CATEGORIES[t.category]?.name,
      ...standards, ...standards.map(s => `[${s}]`)
    ].filter(Boolean).join(' ').toLowerCase();
    if (!haystack.includes(searchQuery)) return false;
  }
  return true;
}

function toArray(v) {
  if (!v) return [];
  return (Array.isArray(v) ? v : [v]).map(s => String(s).replace(/[[\]]/g, '').trim()).filter(Boolean);
}

// ===== 전체 그리기 =====
function renderAll() {
  renderTable();
  renderTiles();
  renderCount();
}

function renderTiles() {
  const filtered = allTools.filter(matches);
  renderFeatured(filtered);
  renderCategories(filtered);
}

function renderCount() {
  const ready = allTools.filter(t => t.available !== false).length;
  const soon = allTools.length - ready;
  document.getElementById('site-count').innerHTML =
    `지금 쓸 수 있는 도구 <strong>${ready}개</strong>` + (soon ? `, 준비 중 ${soon}개` : '');
}

// ===== 맨 위 도구 표 =====
function renderTable() {
  const table = document.getElementById('ptable');
  const cats = CATEGORY_ORDER.filter(c => allTools.some(t => t.category === c));

  table.innerHTML = cats.map(catId => {
    const cat = CATEGORIES[catId];
    const tools = allTools.filter(t => t.category === catId)
      .sort((a, b) => (b.available !== false) - (a.available !== false));

    const cells = tools.map(t => {
      const ready = t.available !== false;
      const out = !matches(t) ? ' is-out' : '';
      const label = `${t.name}${t.level ? ' (' + t.level + ')' : ''}${ready ? '' : ' — 준비 중'}`;
      if (!ready) {
        return `<span class="pt is-ghost${out}" role="img" aria-label="${escape(label)}" title="${escape(label)}">${escape(symbolOf(t))}</span>`;
      }
      return `<a class="pt${out}" href="#tool-${escape(t.id)}" data-tool="${escape(t.id)}" aria-label="${escape(label)}">${escape(symbolOf(t))}<span class="pt-tip" aria-hidden="true">${escape(t.name)}</span></a>`;
    }).join('');

    const hasReady = tools.some(t => t.available !== false);
    const headHref = hasReady ? `#cat-${catId}` : '#cat-soon';

    return `<div class="prow" style="--cat:var(--c-${catId})">
        <a class="prow-head" href="${headHref}">${icon(catId)}<span>${cat.short}</span></a>
        <div class="prow-cells">${cells}</div>
      </div>`;
  }).join('');

  table.querySelectorAll('a.pt').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      goToTool(a.dataset.tool);
    });
  });
}

// 표의 칸을 누르면 그 도구 칸으로 이동해 한 번 강조
function goToTool(id) {
  let el = document.getElementById(`tool-${id}`);
  if (!el) {
    // 검색·학년 필터 때문에 숨어 있으면 필터를 풀고 다시 찾기
    resetFilters();
    el = document.getElementById(`tool-${id}`);
  }
  if (!el) return;
  el.scrollIntoView({ block: 'center' });
  el.classList.remove('is-arrived');
  void el.offsetWidth;
  el.classList.add('is-arrived');
  el.focus({ preventScroll: true });
  history.replaceState(null, '', `#tool-${id}`);
}

function resetFilters() {
  searchQuery = '';
  document.getElementById('search').value = '';
  activeGrade = 'all';
  save('activeGrade', 'all');
  updateGradeButtons();
  renderTable();
  renderTiles();
}

// ===== 학년 필터 =====
function renderGradeFilter() {
  const wrap = document.getElementById('grade-filter');
  wrap.innerHTML = GRADE_FILTERS.map(f =>
    `<button class="grade-btn" type="button" role="radio" data-grade="${f.id}">${f.name}</button>`
  ).join('');

  const buttons = [...wrap.querySelectorAll('.grade-btn')];
  buttons.forEach((btn, i) => {
    btn.addEventListener('click', () => selectGrade(btn.dataset.grade));
    // 화살표 키로 옆 버튼으로 이동 (라디오 버튼 묶음의 표준 조작법)
    btn.addEventListener('keydown', e => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const next = buttons[(i + step + buttons.length) % buttons.length];
      selectGrade(next.dataset.grade);
      next.focus();
    });
  });
  updateGradeButtons();
}

function selectGrade(id) {
  activeGrade = id;
  save('activeGrade', id);
  updateGradeButtons();
  renderTable();
  renderTiles();
}

function updateGradeButtons() {
  document.querySelectorAll('.grade-btn').forEach(b => {
    const on = b.dataset.grade === activeGrade;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  });
}

// ===== 추천 도구 =====
function renderFeatured(tools) {
  const box = document.getElementById('featured');
  const featured = tools.filter(t => t.featured && t.available !== false).slice(0, 6);
  if (featured.length === 0) { box.innerHTML = ''; return; }

  box.innerHTML = `
    <section class="featured-section" aria-labelledby="featured-title">
      <div class="section-head">
        <h2 class="section-title" id="featured-title">${icon('star')}추천 도구</h2>
        <span class="section-note">자주 쓰거나 새로 들어온 도구</span>
      </div>
      <div class="tile-grid">${featured.map(t => renderTile(t, { inFeatured: true })).join('')}</div>
    </section>`;
}

// ===== 분야별 영역 =====
function renderCategories(tools) {
  const box = document.getElementById('sections');

  if (tools.length === 0) {
    box.innerHTML = `
      <div class="empty-state">
        <strong>찾는 조건에 맞는 도구가 없어요.</strong>
        검색어를 줄이거나 학년을 '전체'로 바꿔 보세요.<br>
        <button type="button" id="reset-filters">검색과 학년 필터 지우기</button>
      </div>`;
    document.getElementById('reset-filters').addEventListener('click', resetFilters);
    return;
  }

  const byCat = {};
  CATEGORY_ORDER.forEach(c => { byCat[c] = []; });
  tools.forEach(t => {
    if (byCat[t.category]) byCat[t.category].push(t);
    else console.warn(`알 수 없는 분야: ${t.category} (도구: ${t.name})`);
  });

  const withReady = CATEGORY_ORDER.filter(c => byCat[c].some(t => t.available !== false));
  const onlySoon  = CATEGORY_ORDER.filter(c => byCat[c].length > 0 && !withReady.includes(c));

  box.innerHTML =
    withReady.map(c => renderCategorySection(c, byCat[c])).join('') +
    renderSoonSection(onlySoon, byCat);
}

// 아직 쓸 수 있는 도구가 하나도 없는 분야는 마지막에 한 영역으로 모읍니다
function renderSoonSection(catIds, byCat) {
  if (!catIds.length) return '';
  return `
    <section class="soon-section" id="cat-soon" aria-labelledby="cat-title-soon">
      <div class="section-head">
        <h2 class="section-title" id="cat-title-soon">곧 열릴 분야</h2>
        <span class="section-note">도구 폴더를 올리면 자동으로 해당 분야 칸이 채워져요</span>
      </div>
      ${catIds.map(c => `
        <div class="soon-cat" id="cat-${c}" style="--cat:var(--c-${c})">
          <h3 class="soon-cat-name">${icon(c)}${CATEGORIES[c].name}</h3>
          ${ghostList(byCat[c])}
        </div>`).join('')}
    </section>`;
}

function ghostList(tools) {
  return `<ul class="ghost-list">
    ${tools.map(t => `
      <li class="ghost" aria-label="${escape(t.name)} (준비 중)">
        <span class="ghost-symbol" aria-hidden="true">${escape(symbolOf(t))}</span>
        <span>${escape(t.name)}</span>
        ${t.level ? `<span class="ghost-level">${escape(t.level)}</span>` : ''}
      </li>`).join('')}
  </ul>`;
}

function renderCategorySection(catId, tools) {
  const cat = CATEGORIES[catId];
  const ready = tools.filter(t => t.available !== false);
  const soon = tools.filter(t => t.available === false);

  // 하위 분류: 하나라도 채워져 있으면 그룹으로 나눔
  let body = '';
  if (ready.some(t => (t.subcategory || '').trim())) {
    const groups = {};
    ready.forEach(t => {
      const sub = (t.subcategory || '').trim();
      (groups[sub] = groups[sub] || []).push(t);
    });
    body = Object.keys(groups)
      .sort((a, b) => (a === '') - (b === '') || a.localeCompare(b, 'ko'))
      .map(sub => `
        <div class="subcategory-group">
          ${sub ? `<h3 class="subcategory-name">${escape(sub)}</h3>` : (Object.keys(groups).length > 1 ? `<h3 class="subcategory-name">기타</h3>` : '')}
          <div class="tile-grid">${groups[sub].map(t => renderTile(t)).join('')}</div>
        </div>`).join('');
  } else if (ready.length) {
    body = `<div class="tile-grid">${ready.map(t => renderTile(t)).join('')}</div>`;
  }

  const ghosts = soon.length ? `
    <div class="ghost-row">
      <p class="ghost-title">곧 채워질 칸</p>
      ${ghostList(soon)}
    </div>` : '';

  const countText = soon.length ? `${ready.length}개, 준비 중 ${soon.length}개` : `${ready.length}개`;

  return `
    <section class="category-section" id="cat-${catId}" style="--cat:var(--c-${catId})" aria-labelledby="cat-title-${catId}">
      <div class="section-head">
        <h2 class="section-title" id="cat-title-${catId}"><span class="cat-icon">${icon(catId)}</span>${cat.name}</h2>
        <span class="section-count">${countText}</span>
        <span class="section-note">${cat.description}</span>
      </div>
      ${body}
      ${ghosts}
    </section>`;
}

// ===== 도구 칸 한 개 =====
function renderTile(tool, { inFeatured = false } = {}) {
  const catId = CATEGORIES[tool.category] ? tool.category : 'common';
  const classes = ['tile'];
  const showStar = tool.featured && !inFeatured;
  if (showStar) classes.push('has-star');

  // 메이커: 난이도·시간 + 안전 주의
  let maker = '';
  if (tool.category === 'maker') {
    const items = [];
    if (tool.difficulty) {
      const d = Math.max(0, Math.min(3, Number(tool.difficulty)));
      items.push(`<span><span class="difficulty-stars" aria-hidden="true">${'★'.repeat(d)}${'☆'.repeat(3 - d)}</span> 난이도 ${['', '쉬움', '보통', '어려움'][d] || ''}</span>`);
    }
    if (tool.duration) items.push(`<span>⏱ ${escape(tool.duration)}</span>`);
    if (items.length) maker += `<div class="maker-info">${items.join('')}</div>`;
    if (tool.safetyNotes) maker += `<div class="safety-note"><strong>⚠️ 안전 주의</strong> ${escape(tool.safetyNotes)}</div>`;
  }

  // 교사용 정보 (스위치를 켰을 때만)
  let teacher = '';
  if (teacherMode) {
    const rows = [];
    if (tool.target)   rows.push(['대상', escape(tool.target)]);
    if (tool.sessions) rows.push(['차시', escape(tool.sessions)]);
    if (Array.isArray(tool.materials) && tool.materials.length) rows.push(['준비물', tool.materials.map(escape).join(', ')]);
    const stds = toArray(tool.achievementStandard);
    if (stds.length) rows.push(['성취기준', stds.map(s => `<span class="std-code">[${escape(s)}]</span>`).join('')]);
    if (tool.source) rows.push(['출처', escape(tool.source)]);
    if (rows.length) {
      teacher = `<div class="teacher-info"><dl class="teacher-box">
        ${rows.map(([k, v]) => `<div class="teacher-row"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}
      </dl></div>`;
    }
  }

  const idAttr = inFeatured ? '' : `id="tool-${escape(tool.id)}"`;

  return `
    <a class="${classes.join(' ')}" ${idAttr} href="${escape(tool.path)}" style="--cat:var(--c-${catId})">
      <div class="tile-top">
        <span class="tile-level">${escape(tool.level || '')}</span>
        <span class="tile-activity">${escape(tool.activityType || '')}</span>
      </div>
      ${showStar ? `<span class="tile-star">★ 추천</span>` : ''}
      <div class="tile-symbol" aria-hidden="true">${escape(symbolOf(tool))}</div>
      <h3 class="tile-name">${escape(tool.name)}</h3>
      <p class="tile-desc">${escape(tool.description || '')}</p>
      ${maker}
      ${teacher}
    </a>`;
}

// ===== 검색 =====
function setupSearch() {
  const input = document.getElementById('search');
  input.addEventListener('input', () => {
    searchQuery = input.value.trim().toLowerCase();
    renderTable();
    renderTiles();
  });
}

// ===== "도구 표" 돌아가기 버튼 =====
function setupBackToTable() {
  const btn = document.getElementById('to-table');
  const hero = document.getElementById('top');
  if (!('IntersectionObserver' in window)) { btn.classList.add('is-visible'); return; }
  new IntersectionObserver(([entry]) => {
    btn.classList.toggle('is-visible', !entry.isIntersecting);
  }).observe(hero);
}

// ===== HTML 이스케이프 =====
function escape(str) {
  if (str == null) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

document.addEventListener('DOMContentLoaded', init);
