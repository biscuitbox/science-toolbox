/* ============================================================
   과학 도구상자 — 메인 스크립트
   ============================================================ */

// ===== 카테고리 설정 =====
const CATEGORIES = {
  physics:   { name: '물리',      color: '#1D4ED8', description: '역학 · 전자기 · 광학 · 열·파동 · 현대물리' },
  chemistry: { name: '화학',      color: '#B45309', description: '일반화학 · 무기 · 유기 · 분석 · 생화학' },
  biology:   { name: '생명과학',  color: '#15803D', description: '세포 · 유전 · 인체 · 생태·진화' },
  earth:     { name: '지구과학',  color: '#78350F', description: '지질 · 대기·기상 · 천문 · 해양' },
  maker:     { name: '메이커',    color: '#BE123C', description: '직접 만들고 실험하는 활동 모음' },
  common:    { name: '공통 도구', color: '#57534E', description: '여러 분야에서 두루 쓰이는 도구 — 단위 변환, 주기율표, 계산기 등' },
  classroom: { name: '학급 운영', color: '#6D28D9', description: '모둠 구성 · 수업 타이머 · 발표 순서 · 평가 도구 등 교실 운영 도구' }
};

const CATEGORY_ORDER = ['physics', 'chemistry', 'biology', 'earth', 'maker', 'common', 'classroom'];

// ===== 학년 필터 정의 =====
// match 함수가 true를 반환하면 해당 도구가 필터에 포함됨
const GRADE_FILTERS = [
  { id: 'all',        name: '전체', match: () => true },
  { id: 'elementary', name: '초등', match: lvl => lvl.includes('초') || lvl.includes('전 학년') },
  { id: 'middle',     name: '중등', match: lvl => lvl.includes('중') || lvl.includes('전 학년') },
  { id: 'high',       name: '고등', match: lvl => lvl.includes('고') || lvl.includes('전 학년') }
];

// ===== 상태 =====
let allTools = [];
let activeGrade = 'all';
let searchQuery = '';
let teacherMode = false;

// ===== 초기화 =====
async function init() {
  // 사용자 설정 복원 (브라우저 저장소)
  try {
    teacherMode = localStorage.getItem('teacherMode') === 'true';
    activeGrade = localStorage.getItem('activeGrade') || 'all';
  } catch { /* 시크릿 모드 등에서 실패 가능, 무시 */ }

  // 토글 초기 상태 반영
  const toggle = document.getElementById('teacher-mode-toggle');
  toggle.checked = teacherMode;
  toggle.addEventListener('change', () => {
    teacherMode = toggle.checked;
    try { localStorage.setItem('teacherMode', teacherMode); } catch {}
    renderAll();
  });

  try {
    const response = await fetch('tools.json');
    if (!response.ok) throw new Error('tools.json 로딩 실패');
    const data = await response.json();
    allTools = (data.tools || []).map(t => ({ ...t, available: true })); // 일단 모두 사용 가능으로 가정

    renderNav();
    renderGradeFilter();
    renderAll();

    // 백그라운드에서 실제 폴더 존재 여부 확인
    checkAvailability();
  } catch (err) {
    document.getElementById('content').innerHTML = `
      <div class="empty-state">
        <strong>tools.json 파일을 불러올 수 없습니다.</strong>
        같은 폴더에 파일이 있는지 확인해주세요.<br>
        (로컬에서 테스트한다면 GitHub Pages에 올린 뒤 확인하거나 간단한 로컬 서버를 띄워야 합니다.)
      </div>
    `;
    console.error(err);
  }

  setupSearch();
}

// ===== 폴더 존재 자동 확인 =====
// 각 도구 path에 HEAD 요청을 보내 404면 coming-soon으로 표시
async function checkAvailability() {
  const updates = await Promise.all(allTools.map(async (tool, i) => {
    try {
      const res = await fetch(tool.path, { method: 'HEAD', cache: 'no-store' });
      return { index: i, available: res.ok };
    } catch {
      return { index: i, available: false };
    }
  }));

  let changed = false;
  updates.forEach(({ index, available }) => {
    if (allTools[index].available !== available) {
      allTools[index].available = available;
      changed = true;
    }
  });

  if (changed) renderAll();
}

// ===== 카테고리 네비 =====
function renderNav() {
  const nav = document.getElementById('category-nav');
  nav.innerHTML = CATEGORY_ORDER.map(catId => {
    const cat = CATEGORIES[catId];
    return `<a href="#cat-${catId}"><span class="dot" style="background:${cat.color}"></span>${cat.name}</a>`;
  }).join('');
}

// ===== 학년 필터 =====
function renderGradeFilter() {
  const wrap = document.getElementById('grade-filter');
  const chips = GRADE_FILTERS.map(f => {
    const isActive = f.id === activeGrade;
    return `<button class="filter-chip" type="button" role="radio" aria-pressed="${isActive}" data-grade="${f.id}">${f.name}</button>`;
  }).join('');
  wrap.innerHTML = `<span class="filter-label">학년</span>${chips}`;

  wrap.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      activeGrade = btn.dataset.grade;
      try { localStorage.setItem('activeGrade', activeGrade); } catch {}
      wrap.querySelectorAll('.filter-chip').forEach(b => {
        b.setAttribute('aria-pressed', b.dataset.grade === activeGrade ? 'true' : 'false');
      });
      renderAll();
    });
  });
}

// ===== 필터링 =====
function filterTools(tools) {
  const gradeFilter = GRADE_FILTERS.find(f => f.id === activeGrade);

  return tools.filter(t => {
    // 학년 필터
    if (gradeFilter && !gradeFilter.match(t.level || '')) return false;

    // 검색 필터
    if (searchQuery) {
      const haystack = [
        t.name, t.description, t.subcategory,
        ...(t.tags || []),
        t.level, t.target, t.activityType,
        CATEGORIES[t.category]?.name
      ].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(searchQuery)) return false;
    }

    return true;
  });
}

// ===== 전체 렌더링 =====
function renderAll() {
  const filtered = filterTools(allTools);
  renderFeatured(filtered);
  renderCategories(filtered);
}

// ===== 추천 도구 =====
function renderFeatured(tools) {
  const container = document.getElementById('featured');
  const featured = tools.filter(t => t.featured && t.available !== false);

  if (featured.length === 0) {
    container.innerHTML = '';
    return;
  }

  const cards = featured.slice(0, 6)
    .map(t => renderCard(t, CATEGORIES[t.category], { isFeatured: true }))
    .join('');

  container.innerHTML = `
    <section class="featured-section">
      <div class="featured-header">
        <h2 class="featured-title"><span class="star">★</span>추천 도구</h2>
        <span class="featured-subtitle">자주 쓰이거나 새로 추가된 도구</span>
      </div>
      <div class="card-grid">${cards}</div>
    </section>
  `;
}

// ===== 카테고리별 도구 =====
function renderCategories(tools) {
  const content = document.getElementById('content');

  if (tools.length === 0) {
    content.innerHTML = `<div class="empty-state">검색·필터 결과가 없습니다.</div>`;
    return;
  }

  const byCategory = {};
  CATEGORY_ORDER.forEach(cat => { byCategory[cat] = []; });

  tools.forEach(tool => {
    if (byCategory[tool.category]) {
      byCategory[tool.category].push(tool);
    } else {
      console.warn(`알 수 없는 카테고리: ${tool.category} (도구: ${tool.name})`);
    }
  });

  const sections = CATEGORY_ORDER
    .filter(catId => byCategory[catId].length > 0)
    .map(catId => renderCategorySection(catId, byCategory[catId]))
    .join('');

  content.innerHTML = sections || `<div class="empty-state">검색·필터 결과가 없습니다.</div>`;
}

// ===== 카테고리 섹션 =====
function renderCategorySection(catId, tools) {
  const cat = CATEGORIES[catId];

  // 하위 분류로 그룹화
  const subcats = {};
  let hasAnySubcategory = false;

  tools.forEach(tool => {
    const sub = (tool.subcategory || '').trim();
    if (sub) hasAnySubcategory = true;
    if (!subcats[sub]) subcats[sub] = [];
    subcats[sub].push(tool);
  });

  let cardsHtml;
  if (hasAnySubcategory) {
    const subOrder = Object.keys(subcats).sort((a, b) => {
      if (a === '') return 1;
      if (b === '') return -1;
      return a.localeCompare(b, 'ko');
    });

    cardsHtml = subOrder.map(subName => {
      const subTitle = subName ? `<h3 class="subcategory-name">${escape(subName)}</h3>` : '';
      const cards = subcats[subName].map(t => renderCard(t, cat)).join('');
      return `<div class="subcategory-group">${subTitle}<div class="card-grid">${cards}</div></div>`;
    }).join('');
  } else {
    cardsHtml = `<div class="card-grid">${tools.map(t => renderCard(t, cat)).join('')}</div>`;
  }

  return `
    <section class="category-section" id="cat-${catId}" style="--cat-color:${cat.color}">
      <header class="category-header">
        <h2 class="category-name">${cat.name}</h2>
        <span class="category-count">${tools.length}개</span>
      </header>
      <p class="category-description">${cat.description}</p>
      ${cardsHtml}
    </section>
  `;
}

// ===== 카드 한 개 =====
function renderCard(tool, cat, options = {}) {
  const { isFeatured = false } = options;
  const isAvailable = tool.available !== false;

  // 카드 클래스 조합
  const classes = ['tool-card'];
  if (!isAvailable) classes.push('coming-soon');
  if (isFeatured) classes.push('featured-card');

  // 준비 중 배지
  const statusBadge = !isAvailable
    ? `<span class="status-badge">준비 중</span>`
    : '';

  // 활동 유형 배지
  const activityPill = tool.activityType
    ? `<span class="activity-pill">${escape(tool.activityType)}</span>`
    : '';

  // 레벨 / 태그
  const level = tool.level ? `<span class="level">${escape(tool.level)}</span>` : '';
  const tags = (tool.tags || [])
    .map(t => `<span class="tag">${escape(t)}</span>`)
    .join('');

  // 메이커 추가 정보 (난이도·소요시간)
  let makerInfo = '';
  if (tool.category === 'maker' && (tool.difficulty || tool.duration)) {
    const items = [];
    if (tool.difficulty) {
      const f = Math.max(0, Math.min(3, tool.difficulty));
      const stars = '★'.repeat(f) + '☆'.repeat(3 - f);
      items.push(`<span class="info-item"><span class="difficulty-stars">${stars}</span> 난이도</span>`);
    }
    if (tool.duration) {
      items.push(`<span class="info-item">⏱ ${escape(tool.duration)}</span>`);
    }
    makerInfo = `<div class="maker-info">${items.join('')}</div>`;
  }

  // 교사용 정보 (토글 ON일 때만)
  let teacherInfoHtml = '';
  if (teacherMode) {
    const rows = [];
    if (tool.target) {
      rows.push(`<div class="teacher-row"><span class="label">대상</span><span class="value">${escape(tool.target)}</span></div>`);
    }
    if (tool.sessions) {
      rows.push(`<div class="teacher-row"><span class="label">차시</span><span class="value">${escape(tool.sessions)}</span></div>`);
    }
    if (Array.isArray(tool.materials) && tool.materials.length > 0) {
      const mats = tool.materials.map(escape).join(', ');
      rows.push(`<div class="teacher-row"><span class="label">준비물</span><span class="value">${mats}</span></div>`);
    }
    if (rows.length > 0) {
      teacherInfoHtml = `
        <div class="teacher-info">
          <div class="teacher-info-title">수업용 정보</div>
          ${rows.join('')}
        </div>
      `;
    }
  }

  // 준비 중이면 <a> 대신 <div>로 — 클릭 방지
  const tag = isAvailable ? 'a' : 'div';
  const hrefAttr = isAvailable ? `href="${escape(tool.path)}"` : '';
  const ariaAttr = !isAvailable ? `role="article" aria-label="${escape(tool.name)} (준비 중)"` : '';

  return `
    <${tag} class="${classes.join(' ')}" ${hrefAttr} ${ariaAttr} style="--cat-color:${cat.color}">
      <div class="card-header-row">
        <span class="card-cat-label">${cat.name}</span>
        ${statusBadge}
      </div>
      <h3 class="card-title">${escape(tool.name)}</h3>
      <p class="card-description">${escape(tool.description || '')}</p>
      <div class="card-meta">${level}${activityPill}${tags}</div>
      ${makerInfo}
      ${teacherInfoHtml}
    </${tag}>
  `;
}

// ===== 검색 =====
function setupSearch() {
  const input = document.getElementById('search');
  input.addEventListener('input', () => {
    searchQuery = input.value.trim().toLowerCase();
    renderAll();
  });
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

// ===== 실행 =====
document.addEventListener('DOMContentLoaded', init);
