/*
  [수업 3] JavaScript = 웹페이지의 "움직임"
  1) works.js 의 목록을 읽어서 → 카드를 자동으로 만들고
  2) 카드를 클릭하면 → 팝업을 열고 → 영상을 넣어줘요.
  영상은 works.js, 소개·연락처는 site.js 를 읽어요. (고칠 때는 이 파일이 아니라 관리 페이지나 그 파일을 고치세요.)
*/

// 애니메이션을 끄는 경우: 관리 페이지에서 껐거나(site.js 의 animations: false), 운영체제에서 "동작 줄이기"를 켠 사람
const root = document.documentElement;
if ((typeof SITE !== 'undefined' && SITE.animations === false) || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
  root.classList.add('no-anim');
}
// 첫 화면 배경 움직임만 따로 끄는 경우 (관리 페이지의 효과 → 첫 화면 배경)
if (typeof SITE !== 'undefined' && SITE.heroMotion === false) root.classList.add('no-hero-motion');
// 스크롤하면 제목 흐려지기 / 마우스 기울기를 따로 끄는 경우
if (typeof SITE !== 'undefined' && SITE.heroFade === false) root.classList.add('no-hero-fade');
if (typeof SITE !== 'undefined' && SITE.tilt === false) root.classList.add('no-tilt');
let featuredWork = null;   // 대표 영상(featured: true) — 첫 화면 배경 재생에도 써요
const animationsOn = () => !root.classList.contains('no-anim');

const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');
const modalInfo = document.getElementById('modal-info');
const grid = document.getElementById('grid');
const featuredEl = document.getElementById('featured');
const workTools = document.getElementById('work-tools');
const workSearch = document.getElementById('work-search');
const workSort = document.getElementById('work-sort');
const workEmpty = document.getElementById('work-empty');
const filtersEl = document.getElementById('filters');
const filterStatus = document.getElementById('filter-status');
const aboutEl = document.getElementById('about-text');
const contactEl = document.getElementById('contact-body');

// ---------- 소개 · 연락처 (site.js 의 SITE 로 채우기) ----------
// 링크는 http(s):// 로 시작하는 것만 허용 (javascript: 같은 위험한 주소 차단)
const isHttpUrl = (u) => /^https?:\/\//i.test(String(u || '').trim());
// 이메일: 공백, @ 이외의 특수문자(? & # < > 따옴표)가 들어간 주소는 걸러낸다
const isEmail = (e) => /^[^\s@?&#<>"']+@[^\s@?&#<>"']+\.[^\s@?&#<>"']+$/.test(String(e || '').trim());

// 이미지 경로: images/a.png 같은 상대 경로(.. 와 맨 앞 / 불가) 또는 http(s):// 주소만 허용
const isSafeImage = (p) => {
  const v = String(p || '').trim();
  return /^https?:\/\/\S+$/i.test(v) || (/^[\p{L}\p{N}_\-./%]+$/u.test(v) && !v.includes('..') && !v.startsWith('/'));
};

// 값이 글자(빈 글자 포함)일 때만 덮어쓰고, 비어 있으면 그 요소를 숨긴다. (SITE 에 값이 없으면 index.html 기본 글자를 그대로 둠)
function setText(el, value) {
  if (!el || typeof value !== 'string') return;
  el.textContent = value;
  el.hidden = value.trim() === '';
}

function renderSite() {
  if (typeof SITE === 'undefined') return;

  // 이름: 로고 · 탭 제목 · 푸터
  const name = typeof SITE.name === 'string' ? SITE.name.trim() : '';
  if (name) {
    const logo = document.querySelector('.logo');
    if (logo) logo.textContent = name;
    const tagline = typeof SITE.tagline === 'string' ? SITE.tagline.trim() : '';
    document.title = tagline ? `${name} | ${tagline}` : name;
    const footer = document.querySelector('.site-footer');
    if (footer) footer.textContent = `© ${new Date().getFullYear()} ${name}`;
  }

  // 첫 화면
  const hero = SITE.hero || {};
  setText(document.querySelector('.hero .eyebrow'), hero.eyebrow);
  setText(document.querySelector('.hero h1'), hero.title);     // 줄바꿈은 CSS(white-space: pre-line)로 보여줘요
  setText(document.querySelector('.hero .lead'), hero.lead);
  setText(document.querySelector('.hero .button'), hero.button);

  // 메뉴 글자 · 섹션 제목 · 섹션 보이기/숨기기 (끈 섹션은 메뉴 링크도 같이 사라져요)
  const nav = SITE.nav || {};
  const sections = SITE.sections || {};
  ['about', 'work', 'contact'].forEach((key) => {
    const section = document.getElementById(key);
    const cfg = sections[key] || {};
    const show = cfg.show !== false;
    if (section) {
      section.hidden = !show;
      setText(section.querySelector(':scope > h2'), cfg.title);
    }
    const link = document.querySelector(`[data-nav="${key}"]`);
    if (link) {
      if (typeof nav[key] === 'string') link.textContent = nav[key];
      link.hidden = !show || link.textContent.trim() === '';
    }
  });
  // 작업물 섹션이 꺼져 있으면 "작업물로 이동" 버튼도 숨긴다
  const heroButton = document.querySelector('.hero .button');
  if (heroButton && (SITE.sections || {}).work && SITE.sections.work.show === false) heroButton.hidden = true;

  // 소개 옆 이미지 (비우면 숨김, 값이 없으면 index.html 기본 이미지 유지)
  const aboutImg = document.getElementById('about-img');
  if (aboutImg && typeof SITE.aboutImage === 'string') {
    const src = SITE.aboutImage.trim();
    if (src && isSafeImage(src)) {
      aboutImg.src = src;
      aboutImg.alt = name ? `${name} 소개 이미지` : '소개 이미지';
      aboutImg.hidden = false;
    } else {
      aboutImg.hidden = true;
    }
  }

  if (aboutEl) aboutEl.textContent = SITE.about || '';   // 줄바꿈은 CSS(white-space: pre-line)로 보여줘요

  if (!contactEl) return;
  contactEl.textContent = '';

  const email = String(SITE.email || '').trim();
  if (isEmail(email)) {
    const p = document.createElement('p');
    const a = document.createElement('a');
    a.href = `mailto:${email}`;
    a.textContent = email;
    p.appendChild(a);
    contactEl.appendChild(p);
  }

  const links = (Array.isArray(SITE.links) ? SITE.links : []).filter((l) => l && l.label && isHttpUrl(l.url));
  if (links.length) {
    const p = document.createElement('p');
    links.forEach((l, i) => {
      if (i > 0) p.append(' · ');
      const a = document.createElement('a');
      a.href = l.url.trim();
      a.textContent = l.label;
      a.target = '_blank';
      a.rel = 'noopener';
      p.appendChild(a);
    });
    contactEl.appendChild(p);
  }
}
renderSite();

// 유튜브 주소에서 영상 ID만 뽑아내기 (여러 형태의 주소를 다 처리)
function getYouTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1);
    const v = u.searchParams.get('v');
    if (v) return v;
    const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/);
    if (m) return m[1];
  } catch (e) { /* 주소가 이상하면 아래에서 null 반환 */ }
  return null;
}

// work.tags (["MV","AMV"] 또는 "MV, AMV") → 깨끗한 배열
function getTags(work) {
  const raw = Array.isArray(work.tags) ? work.tags : (typeof work.tags === 'string' ? work.tags.split(',') : []);
  return raw.map((t) => String(t).trim()).filter(Boolean);
}

// 작업물 하나 → 카드(버튼) 하나 만들기
function buildCard(work) {
  const card = document.createElement('button');
  card.className = 'card';
  card.dataset.images = (Array.isArray(work.images) ? work.images : []).map((s) => String(s).trim()).filter(isSafeImage).join('\n');   // 작업 과정 이미지 (안전한 경로만)
  card.dataset.desc = typeof work.desc === 'string' ? work.desc : '';   // 팝업에 보여줄 작업 과정·설명
  card.dataset.tags = getTags(work).join('\n');   // 팝업에 보여줄 카테고리 (원래 표기)
  card.searchText = [work.title, work.meta, ...getTags(work)].filter((s) => typeof s === 'string').join(' ').toLowerCase();   // 검색용
  const yr = String(work.meta || '').match(/(?:^|\D)((?:19|20)\d\d)(?!\d)/);
  card.dataset.year = yr ? yr[1] : '';   // 최신순/오래된순 정렬용 (설명(meta)에 적은 연도)
  card.tagKeys = new Set(getTags(work).map((t) => t.toLowerCase())); // 필터에서 쓰는 카테고리 (대소문자 구분 X)

  const thumb = document.createElement('div');
  thumb.className = 'thumb';

  let thumbSrc = work.thumb || '';

  if (work.url) {
    const id = getYouTubeId(work.url);
    if (!id) {
      console.warn('유튜브 주소를 읽을 수 없어요:', work.url);
      return null;
    }
    card.dataset.type = 'youtube';
    card.dataset.id = id;
    if (!thumbSrc) thumbSrc = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  } else if (work.src) {
    card.dataset.type = 'mp4';
    card.dataset.src = work.src;
  } else {
    console.warn('url 또는 src 가 없는 항목이에요:', work);
    return null;
  }

  if (thumbSrc) {
    const img = document.createElement('img');
    img.src = thumbSrc;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    thumb.appendChild(img);
  } else {
    thumb.classList.add('placeholder');
  }

  const play = document.createElement('span');
  play.className = 'play';
  play.textContent = '▶';
  play.setAttribute('aria-hidden', 'true');   // 장식이라 스크린리더는 건너뛰어요 (카드 이름은 제목이 맡아요)
  thumb.appendChild(play);

  const title = document.createElement('h3');
  title.textContent = work.title || '';
  const meta = document.createElement('p');
  meta.textContent = work.meta || '';

  card.append(thumb, title, meta);
  return card;
}

// 목록 전체를 화면에 그리기
// order 번호가 작은 순서대로 정렬 (order 가 없으면 맨 뒤, 같으면 파일에 적힌 순서 유지)
if (typeof WORKS !== 'undefined') {
  const orderOf = (w) => (typeof w.order === 'number' ? w.order : Infinity);
  const sorted = WORKS
    .map((work, i) => ({ work, i }))
    .sort((a, b) => (orderOf(a.work) - orderOf(b.work)) || (a.i - b.i))
    .map((x) => x.work);

  // 대표 영상: featured: true 인 첫 영상을 크게 보여준다 (격자에도 그대로 남아요)
  const feat = sorted.find((w) => w.featured === true);
  const featCard = feat && featuredEl ? buildCard(feat) : null;
  if (featCard) {
    featCard.classList.add('featured-card');
    const label = document.createElement('p');
    label.className = 'featured-label';
    label.textContent = '대표 영상';
    featuredEl.append(label, featCard);
    featuredEl.hidden = false;
    featuredWork = feat;
  }

  const cards = [];
  const labels = new Map();   // 카테고리 이름 (처음 나온 표기 그대로, 나온 순서대로)
  sorted.forEach((work) => {
    const card = buildCard(work);
    if (!card) return;
    card.dataset.pos = String(cards.length);   // 내가 정한 순서 (정렬을 "기본"으로 되돌릴 때)
    grid.appendChild(card);
    cards.push(card);
    getTags(work).forEach((t) => { if (!labels.has(t.toLowerCase())) labels.set(t.toLowerCase(), t); });
  });

  // 지금 조건(카테고리 + 검색)에 맞는 카드만 보이게 한다
  const buttons = [];
  let activeKey = '', query = '', statusTimer = 0;
  const apply = (animate, announce = animate) => {
    cards.forEach((c) => { c.hidden = !((activeKey === '' || c.tagKeys.has(activeKey)) && (!query || c.searchText.includes(query))); });
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.key === activeKey)));
    const shown = cards.filter((c) => !c.hidden);
    cards.filter((c) => c.hidden).forEach((c) => c.classList.remove('pop'));   // 숨겨진 카드는 효과 표시도 정리
    if (workEmpty) workEmpty.hidden = shown.length > 0 || cards.length === 0;
    // 스크린리더에 결과를 알려 준다 (처음 화면이 그려질 때는 말하지 않음, 타이핑 중에는 잠깐 기다렸다가)
    if (announce && filterStatus) {
      clearTimeout(statusTimer);
      statusTimer = setTimeout(() => { filterStatus.textContent = `${activeKey ? labels.get(activeKey) : '전체'}${query ? ` "${query}" 검색` : ''} 영상 ${shown.length}개`; }, query ? 400 : 0);
    }
    if (animate && animationsOn()) {
      shown.forEach((c, i) => {
        c.classList.remove('pop');
        void c.offsetWidth;   // 같은 애니메이션을 다시 시작하기 위한 트릭
        c.style.setProperty('--d', `${Math.min(i, 8) * 60}ms`);
        c.classList.add('pop');   // 끝나면 아래의 animationend 처리(한 곳)가 지워줘요
      });
    }
  };

  // 카테고리가 하나라도 있으면 "전체 / MV / AMV …" 버튼을 만든다
  if (labels.size > 0) {
    [['', '전체'], ...labels].forEach(([key, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'filter';
      b.dataset.key = key;
      b.textContent = label;
      buttons.push(b);
      filtersEl.appendChild(b);
    });
    // 버튼마다가 아니라 한 곳에서 클릭을 처리 (리스너 수를 늘리지 않음)
    filtersEl.addEventListener('click', (e) => {
      const b = e.target.closest('.filter');
      if (b) { activeKey = b.dataset.key; apply(true); }
    });
    filtersEl.hidden = false;
  }

  // 검색 · 정렬: 영상이 4개 이상일 때만 (적을 땐 필요 없어요)
  if (cards.length >= 4 && workTools && workSearch && workSort) {
    const hasYear = cards.some((c) => c.dataset.year);
    [['', '내가 정한 순서'], ...(hasYear ? [['new', '최신순'], ['old', '오래된순']] : []), ['title', '제목순']].forEach(([v, text]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = text;
      workSort.appendChild(o);
    });
    const yearOf = (c) => (c.dataset.year ? Number(c.dataset.year) : null);
    const pos = (c) => Number(c.dataset.pos);
    const sorters = {
      '': (a, b) => pos(a) - pos(b),
      title: (a, b) => a.querySelector('h3').textContent.localeCompare(b.querySelector('h3').textContent, 'ko') || pos(a) - pos(b),
      // 연도가 없는 영상은 최신순/오래된순 모두 맨 뒤
      new: (a, b) => (yearOf(b) ?? -Infinity) - (yearOf(a) ?? -Infinity) || pos(a) - pos(b),
      old: (a, b) => (yearOf(a) ?? Infinity) - (yearOf(b) ?? Infinity) || pos(a) - pos(b),
    };
    workSort.addEventListener('change', () => {
      [...cards].sort(sorters[workSort.value] || sorters['']).forEach((c) => grid.appendChild(c));   // 카드를 새로 만들지 않고 자리만 옮겨요
      if (filterStatus) filterStatus.textContent = `정렬: ${workSort.options[workSort.selectedIndex].text}`;
    });
    workSearch.addEventListener('input', () => { query = workSearch.value.trim().toLowerCase(); apply(false, true); });
    workTools.hidden = false;
  }
  apply(false);
}

// 카드 클릭은 grid 한 곳에서 처리 (카드마다 리스너를 달지 않음)
const onCardClick = (e) => {
  const card = e.target.closest('.card');
  if (card) openModal(card);
};
grid.addEventListener('click', onCardClick);
if (featuredEl) featuredEl.addEventListener('click', onCardClick);
// 카드의 "나타나기" 효과가 끝나면 효과 표시(.pop)를 한 곳에서 지운다
grid.addEventListener('animationend', (e) => {
  if (e.target.classList) e.target.classList.remove('pop');
});

// 팝업 안의 영상이 쓰던 자원을 확실히 놓아 준다 (iframe 은 빈 페이지로 바꾼 뒤 제거, video 는 멈추고 주소를 비움)
function clearModal() {
  modalBody.querySelectorAll('iframe').forEach((f) => { f.src = 'about:blank'; });
  modalBody.querySelectorAll('video').forEach((v) => { v.pause(); v.removeAttribute('src'); v.load(); });
  modalBody.textContent = '';
  if (modalInfo) modalInfo.textContent = '';
}

// 팝업이 열려 있는 동안 뒤쪽(메뉴·본문·푸터)은 키보드·스크린리더가 못 건드리게 잠근다 (inert)
const setBehindInert = (on) => document.querySelectorAll('.site-header, main, .site-footer').forEach((el) => { el.inert = on; });
const closeBtn = modal.querySelector('.modal-close');
let lastFocus = null;   // 팝업을 열기 전에 포커스가 있던 곳 (닫을 때 돌아가려고)
let currentKey = '';    // 지금 팝업에 열린 영상의 구분값 (유튜브 id 또는 mp4 경로)
let copyTimer = 0;
const navPrev = modal.querySelector('.nav-prev'), navNext = modal.querySelector('.nav-next');
const navCount = modal.querySelector('.nav-count'), navLink = modal.querySelector('.nav-link');
const keyOf = (card) => (card.dataset.type === 'youtube' ? card.dataset.id : card.dataset.src) || '';
const hashFor = (key) => `#v=${encodeURIComponent(key)}`;
// 이전/다음은 "지금 화면에 보이는 목록"(카테고리·검색·정렬이 반영된 순서) 기준
const visibleCards = () => [...grid.querySelectorAll('.card:not([hidden])')];
const setHash = (h) => { try { history.replaceState(null, '', h || `${location.pathname}${location.search}`); } catch (e) { /* 막힌 환경: 주소 갱신만 건너뜀 */ } };

function updateNav() {
  const list = visibleCards();
  const i = list.findIndex((c) => keyOf(c) === currentKey);
  const many = i >= 0 && list.length > 1;
  navPrev.hidden = navNext.hidden = navCount.hidden = !many;
  if (many) {
    navPrev.disabled = i === 0;
    navNext.disabled = i === list.length - 1;
    navCount.textContent = `${i + 1} / ${list.length}`;
  }
  clearTimeout(copyTimer);
  navLink.textContent = '링크 복사';
}
function step(d) {
  const list = visibleCards();
  const i = list.findIndex((c) => keyOf(c) === currentKey);
  if (i < 0 || !list[i + d]) return;
  openModal(list[i + d]);
}

// 팝업 열기: 카드의 data-type 에 따라 다른 플레이어를 만든다
function openModal(card) {
  const type = card.dataset.type;
  const wasHidden = modal.hidden;   // 이미 열려 있으면(이전/다음) 열기 처리는 건너뛰고 내용만 바꾼다
  clearModal();

  if (type === 'youtube') {
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(card.dataset.id)}?autoplay=1&rel=0`;
    iframe.allow = 'autoplay; fullscreen';
    iframe.allowFullscreen = true;
    modalBody.appendChild(iframe);
  } else if (type === 'mp4') {
    const video = document.createElement('video');
    video.src = card.dataset.src;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    modalBody.appendChild(video);
  }

  // 영상 아래 작품 설명: 제목 · 설명 · 카테고리 (모두 textContent 로만 넣어요)
  const title = card.querySelector('h3'), meta = card.querySelector('p');
  const titleText = title ? title.textContent : '';
  if (modalInfo) {
    if (titleText) { const h = document.createElement('h2'); h.textContent = titleText; modalInfo.appendChild(h); }
    if (meta && meta.textContent) { const m = document.createElement('p'); m.textContent = meta.textContent; modalInfo.appendChild(m); }
    const tags = (card.dataset.tags || '').split('\n').filter(Boolean);
    if (tags.length) {
      const ul = document.createElement('div');
      ul.className = 'modal-tags';
      tags.forEach((t) => { const s = document.createElement('span'); s.textContent = t; ul.appendChild(s); });
      modalInfo.appendChild(ul);
    }
  }
  // 작업 과정 · 설명: 빈 줄마다 문단으로 나눠서 글자로만 넣는다
  const desc = (card.dataset.desc || '').replace(/\r\n?/g, '\n').trim();
  if (modalInfo && desc) {
    const box = document.createElement('div');
    box.className = 'modal-desc';
    desc.split(/\n{2,}/).forEach((para) => { const p = document.createElement('p'); p.textContent = para.trim(); box.appendChild(p); });
    modalInfo.appendChild(box);
  }
  // 작업 과정 이미지: 격자로. 팝업을 열 때만 만들고 닫으면 지워요 (이미지는 화면에 가까워질 때 불러와요)
  const imgs = (card.dataset.images || '').split('\n').filter(Boolean);
  if (modalInfo && imgs.length) {
    const gal = document.createElement('div');
    gal.className = 'modal-gallery';
    imgs.forEach((src, i) => {
      const a = document.createElement('a');
      a.href = src; a.target = '_blank'; a.rel = 'noopener';   // 누르면 원본을 새 탭에서
      const im = document.createElement('img');
      im.src = src; im.alt = `${titleText} 작업 과정 이미지 ${i + 1}`; im.loading = 'lazy'; im.decoding = 'async';
      a.appendChild(im); gal.appendChild(a);
    });
    modalInfo.appendChild(gal);
  }
  modal.setAttribute('aria-label', titleText ? `${titleText} 영상 재생` : '영상 재생');

  currentKey = keyOf(card);
  updateNav();
  setHash(hashFor(currentKey));   // 주소에 #v=… 를 붙여서, 이 주소를 보내면 이 영상이 바로 열려요
  if (wasHidden) {
    lastFocus = document.activeElement;
    setBehindInert(true);
    modal.hidden = false;
    document.body.style.overflow = 'hidden'; // 뒤 화면 스크롤 막기
    closeBtn.focus({ preventScroll: true }); // 키보드·스크린리더 사용자가 팝업 안으로 들어오게
  } else {
    modal.querySelector('.modal-panel').scrollTop = 0;
  }
}

// 팝업 닫기: 안의 내용도 비워야 영상 소리가 멈춘다
function closeModal() {
  closeLightbox();
  modal.hidden = true;
  clearModal();
  currentKey = '';
  clearTimeout(copyTimer);
  if (location.hash.startsWith('#v=')) setHash('');
  setBehindInert(false);
  document.body.style.overflow = '';
  // 열기 전에 있던 곳(영상 카드)으로 포커스를 돌려보낸다. 그 카드가 사라졌거나 숨겨졌으면 건너뜀
  if (lastFocus && lastFocus.isConnected && !lastFocus.closest('[hidden]')) lastFocus.focus({ preventScroll: true });
  lastFocus = null;
}

// 닫기 버튼, 배경 클릭, ESC 키로 닫기
modal.querySelector('.modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
navPrev.addEventListener('click', () => step(-1));
navNext.addEventListener('click', () => step(1));
navLink.addEventListener('click', async () => {
  const url = `${location.origin}${location.pathname}${hashFor(currentKey)}`;
  let ok = false;
  try { await navigator.clipboard.writeText(url); ok = true; } catch (e) { /* 클립보드가 막힘: 아래에서 주소를 직접 보여줘요 */ }
  if (!ok) { window.prompt('아래 주소를 복사하세요 (Ctrl+C)', url); return; }
  navLink.textContent = '복사했어요 ✓';
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => { navLink.textContent = '링크 복사'; }, 1800);
});

// 작업 과정 이미지 크게 보기 (라이트박스)
const lightbox = document.getElementById('lightbox');
const lbImg = lightbox.querySelector('img'), lbCount = lightbox.querySelector('.lb-count');
const lbPrev = lightbox.querySelector('.lb-prev'), lbNext = lightbox.querySelector('.lb-next'), lbClose = lightbox.querySelector('.lb-close');
let lbList = [], lbIdx = 0, lbFrom = null;
function showLightbox(i) {
  lbIdx = i;
  const a = lbList[i];
  lbImg.src = a.getAttribute('href');
  lbImg.alt = (a.querySelector('img') || {}).alt || '';
  lbCount.textContent = `${i + 1} / ${lbList.length}`;
  lbPrev.disabled = i === 0;
  lbNext.disabled = i === lbList.length - 1;
  lbPrev.hidden = lbNext.hidden = lbList.length < 2;
}
function openLightbox(i, from) {
  lbList = [...modalInfo.querySelectorAll('.modal-gallery a')];
  if (!lbList[i]) return;
  lbFrom = from;
  showLightbox(i);
  lightbox.hidden = false;
  modal.inert = true;   // 뒤의 팝업은 잠가서 키보드가 새어 나가지 않게
  lbClose.focus({ preventScroll: true });
}
function closeLightbox() {
  if (lightbox.hidden) return;
  lightbox.hidden = true;
  lbImg.removeAttribute('src');   // 큰 이미지 메모리를 놓아 준다
  lbList = [];
  modal.inert = false;
  if (lbFrom && lbFrom.isConnected) lbFrom.focus({ preventScroll: true });
  lbFrom = null;
}
lbClose.addEventListener('click', closeLightbox);
lbPrev.addEventListener('click', () => showLightbox(lbIdx - 1));
lbNext.addEventListener('click', () => showLightbox(lbIdx + 1));
lightbox.addEventListener('click', (e) => { if (e.target === lightbox || e.target.tagName === 'FIGURE') closeLightbox(); });
modalInfo.addEventListener('click', (e) => {
  const a = e.target.closest('.modal-gallery a');
  if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;   // Ctrl/Cmd+클릭은 새 탭으로 (원래 동작)
  e.preventDefault();
  openLightbox([...modalInfo.querySelectorAll('.modal-gallery a')].indexOf(a), a);
});

document.addEventListener('keydown', (e) => {
  if (!lightbox.hidden) {   // 이미지 크게 보기가 열려 있으면 그쪽이 먼저
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft' && !lbPrev.disabled && !lbPrev.hidden) showLightbox(lbIdx - 1);
    else if (e.key === 'ArrowRight' && !lbNext.disabled && !lbNext.hidden) showLightbox(lbIdx + 1);
    else if (e.key === 'Tab') {
      const f = [lbClose, lbPrev, lbNext].filter((b) => !b.disabled && !b.hidden);
      const i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
    return;
  }
  if (modal.hidden) return;
  if (e.key === 'Escape') { closeModal(); return; }
  // ← → 로 이전/다음 작품 (영상 컨트롤이나 입력칸에 포커스가 있을 땐 그쪽 동작을 우선)
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.altKey && !e.ctrlKey && !e.metaKey && !/^(VIDEO|INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
    step(e.key === 'ArrowLeft' ? -1 : 1);
    return;
  }
  if (e.key !== 'Tab') return;
  // 팝업 안에서만 Tab 이 돌게: 처음/끝에서 반대쪽으로 넘겨 준다
  const f = [...modal.querySelectorAll('button:not([hidden]):not(:disabled), a[href], iframe, video[controls], [tabindex]:not([tabindex="-1"])')];
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  else if (!modal.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
});


// ---------- 애니메이션: 스크롤하면 나타나기 · 현재 섹션 표시 · 헤더 그림자 ----------
(function initAnimations() {
  if (!animationsOn()) return;

  // 1) 화면에 들어올 때 부드럽게 나타나기. 한꺼번에 들어오는 것들은 차례로(80ms 간격).
  const targets = [...document.querySelectorAll('.section > h2, .about-img, .about-text, .filters, .card, #contact-body > p')];
  targets.forEach((el) => el.classList.add('reveal'));
  if ('IntersectionObserver' in window) {
    let remaining = targets.length;
    const io = new IntersectionObserver((entries) => {
      entries.filter((e) => e.isIntersecting).forEach((e, i) => {
        e.target.style.setProperty('--d', `${Math.min(i, 6) * 80}ms`);
        e.target.classList.add('in');
        io.unobserve(e.target);
        if (--remaining === 0) io.disconnect();   // 모두 나타났으면 관찰자 정리
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    targets.forEach((el) => io.observe(el));
  } else {
    targets.forEach((el) => el.classList.add('in'));   // 오래된 브라우저: 그냥 보여준다
  }

  // 2) 지금 보고 있는 섹션의 메뉴에 밑줄 (첫 화면에서는 없음)
  const links = [...document.querySelectorAll('.site-header nav a[data-nav]')];
  const watch = [document.querySelector('.hero'), ...['about', 'work', 'contact'].map((k) => document.getElementById(k))].filter(Boolean);
  if ('IntersectionObserver' in window && links.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.filter((e) => e.isIntersecting).forEach((e) => {
        links.forEach((a) => a.classList.toggle('active', a.dataset.nav === e.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    watch.forEach((el) => spy.observe(el));
  }

  // 3) 첫 화면 배경 파동: 화면 밖이거나 탭이 가려져 있으면 멈춰서 배터리·CPU 를 아낀다
  const heroEl = document.querySelector('.hero');
  if (heroEl && !root.classList.contains('no-hero-motion')) {
    let heroSeen = true;
    const sync = () => heroEl.classList.toggle('bg-paused', document.hidden || !heroSeen);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => { heroSeen = entries[entries.length - 1].isIntersecting; sync(); }).observe(heroEl);
    }
    document.addEventListener('visibilitychange', sync);
  }

  // 3-2) 대표 영상을 첫 화면 글자 뒤에서 소리 없이 재생.
  //      화면 밖이거나 탭이 가려지면 영상 자체를 없애서(iframe/video 제거) 메모리·데이터·배터리를 아끼고, 다시 보이면 새로 만든다.
  const videoBox = heroEl && heroEl.querySelector('.hero-video');
  const saveData = navigator.connection && navigator.connection.saveData;
  if (videoBox && featuredWork && !(typeof SITE !== 'undefined' && SITE.heroVideo === false) && !saveData) {
    let heroSeen = true;
    let player = null;
    const start = () => {
      let el;
      if (featuredWork.url) {
        const id = getYouTubeId(featuredWork.url);
        if (!id) return;
        // 주소에 시작 시간(&t=23)이 있으면 그 지점부터 재생
        let start = 0;
        try { start = parseInt(new URL(featuredWork.url).searchParams.get('t'), 10) || 0; } catch (e) { /* 주소가 아님 */ }
        el = document.createElement('iframe');
        el.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${start > 0 ? `start=${start}&` : ''}autoplay=1&mute=1&controls=0&loop=1&playlist=${encodeURIComponent(id)}&playsinline=1&modestbranding=1&rel=0&disablekb=1&iv_load_policy=3`;
        el.allow = 'autoplay; encrypted-media';
        el.referrerPolicy = 'strict-origin-when-cross-origin';
        el.addEventListener('load', () => { if (player === el) heroEl.classList.add('has-video'); });
      } else {
        el = document.createElement('video');
        el.muted = true; el.loop = true; el.autoplay = true; el.playsInline = true;
        el.src = featuredWork.src;
        el.addEventListener('playing', () => { if (player === el) heroEl.classList.add('has-video'); });
      }
      el.tabIndex = -1;
      player = el;
      videoBox.appendChild(el);
    };
    const stop = () => {
      if (!player) return;
      if (player.tagName === 'IFRAME') player.src = 'about:blank';
      else { player.pause(); player.removeAttribute('src'); player.load(); }
      player.remove();
      player = null;
      heroEl.classList.remove('has-video');
    };
    const sync = () => { if (!document.hidden && heroSeen) { if (!player) start(); } else stop(); };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => { heroSeen = entries[entries.length - 1].isIntersecting; sync(); }).observe(heroEl);
    }
    document.addEventListener('visibilitychange', sync);
    sync();
  }

  // 4) 스크롤하면 맨 위 메뉴에 그림자
  const header = document.querySelector('.site-header');
  if (header) {
    let scrolled = false;
    const onScroll = () => {
      const now = window.scrollY > 8;
      if (now !== scrolled) { scrolled = now; header.classList.toggle('scrolled', now); }   // 바뀔 때만 DOM 을 건드림
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
})();


// ---------- 버튼 · 영상 카드: 마우스를 따라 살짝 기울어지기 ----------
// 마우스가 올라가 있는 동안에만 pointermove 를 듣고, 벗어나면 바로 해제해요. (평소에는 리스너·계산이 전혀 없음)
// 터치 기기, 애니메이션 끔, "동작 줄이기", 관리 페이지에서 끈 경우에는 아예 시작하지 않아요.
(function initTilt() {
  if (!animationsOn() || root.classList.contains('no-tilt')) return;
  if (!window.matchMedia || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const MAX = 6;            // 최대 기울기(도)
  let el = null, raf = 0, last = null;

  const apply = () => {
    raf = 0;
    if (!el || !last) return;
    const r = el.getBoundingClientRect();
    const x = (last.clientX - r.left) / r.width - 0.5;    // -0.5 ~ 0.5
    const y = (last.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--rx', `${(-y * MAX).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${(x * MAX).toFixed(2)}deg`);
  };
  const onMove = (e) => { last = e; if (!raf) raf = requestAnimationFrame(apply); };

  const end = () => {
    document.removeEventListener('pointermove', onMove);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (el) { el.classList.remove('tilting'); el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); }
    el = null; last = null;                                // 참조를 놓아 줘요
  };

  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest ? e.target.closest('.card, .hero .button') : null;
    if (!t || t === el) return;
    if (el) end();                                          // 이전 것이 숨겨지는 등으로 정리 못 했다면 먼저 정리
    el = t;
    t.classList.add('tilting');
    document.addEventListener('pointermove', onMove, { passive: true });
    onMove(e);
  });
  document.addEventListener('pointerout', (e) => {
    if (!el) return;
    if (e.relatedTarget && el.contains(e.relatedTarget)) return;   // 같은 카드 안에서 움직이는 중
    end();
  });
})();

// 주소에 #v=영상 이 있으면 (공유받은 링크) 그 영상을 바로 연다. 같은 탭에서 주소만 바뀌어도 따라간다.
function openFromHash() {
  const m = location.hash.match(/^#v=(.+)$/);
  if (!m) { if (!modal.hidden && currentKey) closeModal(); return; }
  let key = '';
  try { key = decodeURIComponent(m[1]); } catch (e) { return; }
  if (modal.hidden || key !== currentKey) {
    const card = [...grid.querySelectorAll('.card'), ...(featuredEl ? featuredEl.querySelectorAll('.card') : [])].find((c) => keyOf(c) === key);
    if (card) openModal(card);
  }
}
window.addEventListener('hashchange', openFromHash);
openFromHash();
