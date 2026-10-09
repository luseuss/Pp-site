/*
  관리 페이지 동작 (admin.html)
  1) GitHub 의 works.js(영상) · site.js(소개·연락처)를 불러와서 화면에 보여주고
  2) 수정한 내용을 각 파일 형식으로 만들어서
  3) GitHub API 로 저장(커밋)해요. (토큰이 있어야 저장 가능, 바뀐 파일만 저장)
*/
(() => {
  'use strict';

  const KEY = 'pp-admin-v1';
  const DEFAULTS = { owner: 'luseuss', repo: 'Pp-site', branch: 'claude/portfolio-site-creation-p3kzl1', token: '', remember: false };
  const WORKS_FILE = 'works.js';
  const SITE_FILE = 'site.js';

  const $ = (sel, el = document) => el.querySelector(sel);
  const list = $('#list');
  const linksEl = $('#links');
  const tpl = $('#row-tpl');
  const linkTpl = $('#link-tpl');
  const msg = $('#msg');
  const dirtyEl = $('#dirty');

  let settings = { ...DEFAULTS };
  let items = [];                                      // 화면에서 편집 중인 영상 목록
  let site = { about: '', email: '', links: [] };      // 화면에서 편집 중인 소개·연락처
  let baseline = { works: '', site: '' };              // 불러온/저장한 직후의 내용(JSON) — 변경 여부 비교용
  let remote = { works: null, site: null };            // { sha, text } GitHub 에 있는 파일

  // ---------- 유틸 ----------
  // script.js 의 getYouTubeId 와 같은 규칙 (관리 페이지는 script.js 를 불러오지 않아서 따로 둠)
  function getYouTubeId(url) {
    try {
      const u = new URL(url);
      if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null;
      const v = u.searchParams.get('v');
      if (v) return v;
      const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/);
      if (m) return m[1];
    } catch (e) { /* 주소가 아님 */ }
    return null;
  }

  // script.js 의 isHttpUrl / isEmail 과 같은 규칙
  const isHttpUrl = (u) => /^https?:\/\//i.test(String(u || '').trim());
  const isEmail = (e) => /^[^\s@?&#<>"']+@[^\s@?&#<>"']+\.[^\s@?&#<>"']+$/.test(String(e || '').trim());

  const b64decode = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));
  const b64encode = (str) => {
    let bin = '';
    new TextEncoder().encode(str).forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin);
  };

  function setMsg(text, kind = '') {
    msg.textContent = text;
    msg.className = kind;
  }

  // ---------- 설정 (저장소/토큰) ----------
  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved) settings = { ...DEFAULTS, ...saved };
    } catch (e) { /* 저장소를 못 쓰면 기본값 */ }
    $('#s-owner').value = settings.owner;
    $('#s-repo').value = settings.repo;
    $('#s-branch').value = settings.branch;
    $('#s-token').value = settings.token;
    $('#s-remember').checked = settings.remember;
  }

  function readSettings() {
    settings = {
      owner: $('#s-owner').value.trim(),
      repo: $('#s-repo').value.trim(),
      branch: $('#s-branch').value.trim(),
      token: $('#s-token').value.trim(),
      remember: $('#s-remember').checked,
    };
    try {
      // 토큰은 "기억하기"를 체크했을 때만 저장
      localStorage.setItem(KEY, JSON.stringify({ ...settings, token: settings.remember ? settings.token : '' }));
    } catch (e) { /* 무시 */ }
  }

  // ---------- GitHub API ----------
  function explain(status, file) {
    if (status === 401) return '토큰이 올바르지 않거나 만료됐어요. 연결 설정에서 토큰을 확인하세요.';
    if (status === 403) return '권한이 없어요. 토큰의 Contents 권한이 "Read and write"인지, 이 저장소가 선택됐는지 확인하세요.';
    if (status === 404) return '저장소·브랜치 이름을 찾을 수 없어요. 연결 설정을 확인하세요. (비공개 저장소면 토큰이 필요해요)';
    if (status === 409 || status === 422) return `그사이 다른 곳에서 ${file} 가 바뀌었어요. "되돌리기"로 새로 불러온 뒤 다시 시도하세요.`;
    return `GitHub 오류 (${status})`;
  }

  async function api(method, file, body) {
    const { owner, repo, branch, token } = settings;
    const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${file}`;
    const url = method === 'GET' ? `${base}?ref=${encodeURIComponent(branch)}` : base;
    const res = await fetch(url, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      cache: 'no-store',
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = new Error(explain(res.status, file));
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  async function fetchRemote(file) {
    const data = await api('GET', file);
    return { sha: data.sha, text: b64decode(data.content) };
  }

  // ---------- works.js 읽기/쓰기 ----------
  // works.js 파일 내용(자바스크립트)에서 WORKS 목록을 꺼낸다.
  // 내 저장소의 파일이고 사이트도 같은 파일을 그대로 실행하므로 같은 수준의 신뢰예요.
  function parseWorks(text) {
    const works = new Function(`${text}\nreturn WORKS;`)();
    if (!Array.isArray(works)) throw new Error('works.js 형식이 올바르지 않아요.');
    return works;
  }

  const KNOWN = ['order', 'url', 'src', 'thumb', 'title', 'meta', 'tags'];
  const orderOf = (w) => (typeof w.order === 'number' ? w.order : Infinity);

  // "MV, AMV" 같은 글자 → ["MV","AMV"] (빈 칸 제거, 대소문자 다른 중복 제거)
  function parseTags(value) {
    const seen = new Set();
    return String(value).split(',').map((t) => t.trim()).filter((t) => {
      const k = t.toLowerCase();
      if (!t || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function fromWorks(works) {
    // 사이트(script.js)와 같은 규칙으로 정렬해서 보여준다
    return works
      .map((w, i) => ({ w, i }))
      .sort((a, b) => (orderOf(a.w) - orderOf(b.w)) || (a.i - b.i))
      .map(({ w }) => ({
        type: w.src && !w.url ? 'mp4' : 'youtube',
        url: w.url || '',
        src: w.src || '',
        thumb: w.thumb || '',
        title: w.title || '',
        meta: w.meta || '',
        tags: parseTags(Array.isArray(w.tags) ? w.tags.join(',') : (w.tags || '')),
        extra: Object.fromEntries(Object.entries(w).filter(([k]) => !KNOWN.includes(k))),
      }));
  }

  // 화면 목록 → works.js 에 넣을 객체 목록 (순서 번호는 위치대로 1,2,3…)
  function toWorks() {
    return items.map((it, i) => {
      const o = { order: i + 1 };
      if (it.type === 'mp4') {
        o.src = it.src.trim();
        if (it.thumb.trim()) o.thumb = it.thumb.trim();
      } else {
        o.url = it.url.trim();
      }
      o.title = it.title.trim();
      o.meta = it.meta.trim();
      if (it.tags.length) o.tags = [...it.tags];
      return { ...o, ...it.extra };
    });
  }

  const FALLBACK_HEADER = `/*
  ★ 작업물 목록 — 영상 추가/수정/삭제/순서 변경은 admin.html(관리 페이지)에서 하세요 ★
  직접 고칠 때는 아래 목록에 { } 한 덩어리를 복사해 쓰고, order 번호가 작을수록 앞에 나와요.
  (줄 맨 앞에 // 를 붙이면 숨겨져요.)
*/

`;

  const EXAMPLE = `
  // ▼ 직접 올린 mp4 예시 (쓰려면 앞의 // 를 지우고 파일 이름을 맞추세요)
  // {
  //   order: 4,
  //   src: "videos/my-work.mp4",
  //   thumb: "thumbs/my-work.jpg",   // 썸네일은 없어도 돼요
  //   title: "작품 제목",
  //   meta: "2026 · 모션 그래픽",
  // },
`;

  // 기존 works.js 의 맨 위 설명 주석은 그대로 두고, 목록 부분만 새로 만든다
  function buildText(works, oldText) {
    const at = oldText ? oldText.indexOf('const WORKS = [') : -1;
    const header = at > 0 ? oldText.slice(0, at) : FALLBACK_HEADER;
    const key = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k));
    const blocks = works.map((w) => {
      const keys = [...KNOWN.filter((k) => k in w), ...Object.keys(w).filter((k) => !KNOWN.includes(k))];
      const lines = keys.map((k) => `    ${key(k)}: ${JSON.stringify(w[k])},`);
      return `  {\n${lines.join('\n')}\n  },`;
    });
    return `${header}const WORKS = [\n${blocks.join('\n')}\n${EXAMPLE}];\n`;
  }

  // ---------- site.js 읽기/쓰기 (소개 · 연락처) ----------
  function parseSite(text) {
    const s = new Function(`${text}\nreturn SITE;`)();
    if (!s || typeof s !== 'object') throw new Error('site.js 형식이 올바르지 않아요.');
    return {
      about: String(s.about || ''),
      email: String(s.email || ''),
      links: (Array.isArray(s.links) ? s.links : []).map((l) => ({ label: String((l && l.label) || ''), url: String((l && l.url) || '') })),
    };
  }

  // 화면 → 저장할 내용 (소개는 줄 끝 공백 정리, 이름·주소가 모두 빈 링크 줄은 버림)
  function toSite() {
    return {
      about: site.about.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trimEnd()).join('\n').trim(),
      email: site.email.trim(),
      links: site.links
        .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
        .filter((l) => l.label || l.url),
    };
  }

  const SITE_HEADER = `/*
  ★ 소개 · 연락처 — 관리 페이지(admin.html)에서 고치거나, 여기를 직접 고쳐도 돼요 ★
  about: 소개 글 (따옴표 한 줄이 화면의 한 줄), email: 이메일, links: 링크 목록 (label=이름, url=주소)
*/

`;

  // 기존 site.js 의 맨 위 설명 주석은 그대로 두고, 내용 부분만 새로 만든다
  function buildSiteText(s, oldText) {
    const at = oldText ? oldText.indexOf('const SITE = {') : -1;
    const header = at > 0 ? oldText.slice(0, at) : SITE_HEADER;
    const q = JSON.stringify;
    const aboutLines = s.about ? s.about.split('\n') : [];
    const about = aboutLines.length
      ? `[\n${aboutLines.map((l) => `    ${q(l)},`).join('\n')}\n  ].join("\\n")`
      : '""';
    const links = s.links.length
      ? `[\n${s.links.map((l) => `    { label: ${q(l.label)}, url: ${q(l.url)} },`).join('\n')}\n  ]`
      : '[]';
    return `${header}const SITE = {\n  about: ${about},\n  email: ${q(s.email)},\n  links: ${links},\n};\n`;
  }

  // ---------- 화면: 공통 ----------
  const snapWorks = () => JSON.stringify(toWorks());
  const snapSite = () => JSON.stringify(toSite());

  function isDirty() {
    return {
      // 아직 불러오기 전(baseline 이 비어 있고 내용도 없음)에는 변경 없음으로 본다
      works: items.length > 0 || baseline.works !== '' ? snapWorks() !== baseline.works : false,
      site: baseline.site !== '' ? snapSite() !== baseline.site : false,
    };
  }

  function updateDirty() {
    const d = isDirty();
    const on = d.works || d.site;
    const what = [d.works && '영상', d.site && '소개·연락처'].filter(Boolean).join(', ');
    dirtyEl.textContent = on ? `● 저장 안 된 변경이 있어요 (${what})` : '변경 없음';
    dirtyEl.className = on ? 'on' : '';
    $('#reload').disabled = !on;
    $('#tab-works').dataset.dirty = String(d.works);
    $('#tab-site').dataset.dirty = String(d.site);
  }

  function showTab(name) {
    ['works', 'site'].forEach((n) => {
      $(`#panel-${n}`).hidden = n !== name;
      $(`#tab-${n}`).setAttribute('aria-selected', String(n === name));
    });
  }

  // ---------- 화면: 영상 ----------
  function updatePreview(li, it) {
    const box = $('.thumb', li);
    box.textContent = '';
    let src = '';
    if (it.type === 'youtube') {
      const id = getYouTubeId(it.url);
      if (id) src = `https://img.youtube.com/vi/${encodeURIComponent(id)}/mqdefault.jpg`;
    } else if (it.thumb.trim()) {
      src = it.thumb.trim();
    }
    if (src) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = src;
      img.onerror = () => { box.textContent = '미리보기 없음'; };
      box.appendChild(img);
    } else {
      box.textContent = it.type === 'youtube' ? '주소를 넣으면 썸네일이 보여요' : '썸네일 없음';
    }
  }

  function render() {
    list.textContent = '';
    items.forEach((it, i) => {
      const li = tpl.content.firstElementChild.cloneNode(true);
      $('.num', li).textContent = i + 1;

      const bind = (sel, prop, onChange) => {
        const el = $(sel, li);
        el.value = it[prop];
        el.addEventListener('input', () => { it[prop] = el.value; onChange && onChange(); updateDirty(); });
      };
      const sync = () => {
        $('.g-url', li).hidden = it.type !== 'youtube';
        $('.g-src', li).hidden = it.type !== 'mp4';
        $('.g-thumb', li).hidden = it.type !== 'mp4';
        updatePreview(li, it);
      };
      const type = $('.f-type', li);
      type.value = it.type;
      type.addEventListener('change', () => { it.type = type.value; sync(); updateDirty(); });
      bind('.f-url', 'url', () => updatePreview(li, it));
      bind('.f-src', 'src');
      bind('.f-thumb', 'thumb', () => updatePreview(li, it));
      bind('.f-title', 'title');
      bind('.f-meta', 'meta');
      const tagsInput = $('.f-tags', li);
      tagsInput.value = it.tags.join(', ');
      tagsInput.addEventListener('input', () => { it.tags = parseTags(tagsInput.value); updateDirty(); });
      tagsInput.addEventListener('change', refreshChips);   // 입력을 마쳤을 때 다른 영상의 버튼 목록도 갱신
      sync();

      const up = $('.up', li), down = $('.down', li);
      up.disabled = i === 0;
      down.disabled = i === items.length - 1;
      up.addEventListener('click', () => move(i, -1));
      down.addEventListener('click', () => move(i, 1));
      $('.del', li).addEventListener('click', () => { items.splice(i, 1); render(); });

      list.appendChild(li);
    });
    refreshChips();
    updateDirty();
  }

  // 지금까지 쓴 모든 카테고리 (처음 쓴 표기 그대로)
  function allTags() {
    const map = new Map();
    items.forEach((it) => it.tags.forEach((t) => { if (!map.has(t.toLowerCase())) map.set(t.toLowerCase(), t); }));
    return [...map.values()];
  }

  // 각 영상 아래에 "이미 쓴 카테고리" 버튼을 만든다. 누르면 그 영상에 붙였다 뗐다 해요.
  function refreshChips() {
    const tags = allTags();
    [...list.children].forEach((li, i) => {
      const it = items[i];
      const box = $('.chips', li);
      box.textContent = '';
      tags.forEach((t) => {
        const on = it.tags.some((x) => x.toLowerCase() === t.toLowerCase());
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.textContent = t;
        b.setAttribute('aria-pressed', String(on));
        b.addEventListener('click', () => {
          it.tags = on ? it.tags.filter((x) => x.toLowerCase() !== t.toLowerCase()) : [...it.tags, t];
          $('.f-tags', li).value = it.tags.join(', ');
          refreshChips();
          updateDirty();
        });
        box.appendChild(b);
      });
    });
  }

  function move(i, d) {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    render();
  }

  // ---------- 화면: 소개 · 연락처 ----------
  function renderSitePanel() {
    $('#f-about').value = site.about;
    $('#f-email').value = site.email;
    renderLinks();
  }

  function renderLinks() {
    linksEl.textContent = '';
    site.links.forEach((l, i) => {
      const li = linkTpl.content.firstElementChild.cloneNode(true);
      const label = $('.l-label', li), url = $('.l-url', li);
      label.value = l.label;
      url.value = l.url;
      label.addEventListener('input', () => { l.label = label.value; updateDirty(); });
      url.addEventListener('input', () => { l.url = url.value; updateDirty(); });
      // 주소 칸을 벗어날 때, https:// 를 빼고 적었으면 자동으로 붙여 준다
      url.addEventListener('change', () => {
        const v = url.value.trim();
        if (v && !/^[a-z][a-z0-9+.-]*:/i.test(v) && !v.startsWith('//')) {
          l.url = `https://${v}`;
          url.value = l.url;
          updateDirty();
        }
      });
      const up = $('.up', li), down = $('.down', li);
      up.disabled = i === 0;
      down.disabled = i === site.links.length - 1;
      up.addEventListener('click', () => moveLink(i, -1));
      down.addEventListener('click', () => moveLink(i, 1));
      $('.del', li).addEventListener('click', () => { site.links.splice(i, 1); renderLinks(); updateDirty(); });
      linksEl.appendChild(li);
    });
  }

  function moveLink(i, d) {
    const j = i + d;
    if (j < 0 || j >= site.links.length) return;
    [site.links[i], site.links[j]] = [site.links[j], site.links[i]];
    renderLinks();
    updateDirty();
  }

  // ---------- 검사 ----------
  // 문제가 있으면 { tab, text } 를 돌려준다
  function validate() {
    for (let i = 0; i < items.length; i++) {
      const it = items[i], n = `${i + 1}번 영상`;
      if (it.type === 'youtube' && !getYouTubeId(it.url.trim())) return { tab: 'works', text: `${n}: YouTube 주소를 읽을 수 없어요.` };
      if (it.type === 'mp4' && !it.src.trim()) return { tab: 'works', text: `${n}: mp4 파일 경로를 적어 주세요.` };
      if (!it.title.trim()) return { tab: 'works', text: `${n}: 제목을 적어 주세요.` };
    }
    const s = toSite();
    if (s.email && !isEmail(s.email)) return { tab: 'site', text: '이메일 주소가 올바르지 않아요. (예: name@example.com)' };
    for (let i = 0; i < s.links.length; i++) {
      const l = s.links[i], n = `${i + 1}번 링크`;
      if (!l.label) return { tab: 'site', text: `${n}: 이름을 적어 주세요. (예: Instagram)` };
      if (!isHttpUrl(l.url)) return { tab: 'site', text: `${n}: 주소는 https:// 로 시작해야 해요.` };
    }
    return null;
  }

  // ---------- 불러오기 / 저장 ----------
  // GitHub 에서 읽고, 안 되면 사이트에 올라간 파일로 대신 읽는다 (보기/코드 복사용)
  async function loadText(file) {
    try {
      return { ...(await fetchRemote(file)), note: '' };
    } catch (e) {
      try {
        const res = await fetch(`${file}?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        return { sha: '', text: await res.text(), note: e.message };
      } catch (e2) {
        return { sha: '', text: '', failed: true, note: e.message, status: e.status };
      }
    }
  }

  async function load() {
    readSettings();
    setMsg('불러오는 중…');
    const problems = [];

    // 영상 (works.js)
    const w = await loadText(WORKS_FILE);
    items = [];
    baseline.works = '';
    remote.works = null;
    if (w.failed) {
      problems.push(`works.js 를 불러오지 못했어요. (${w.note})`);
    } else {
      remote.works = { sha: w.sha, text: w.text };
      try {
        items = fromWorks(parseWorks(w.text));
        baseline.works = snapWorks();
      } catch (e) {
        items = [];
        problems.push(`works.js 를 읽는 중 오류가 났어요: ${e.message}`);
      }
      if (w.note) problems.push(`GitHub 에서 불러오지 못해서 사이트의 파일을 보여 줘요. (${w.note})`);
    }

    // 소개 · 연락처 (site.js) — 아직 파일이 없으면(404) 빈 상태로 시작하고, 저장하면 새로 만들어요
    const s = await loadText(SITE_FILE);
    site = { about: '', email: '', links: [] };
    remote.site = null;
    if (s.failed && s.status === 404 && !w.failed) {
      remote.site = { sha: '', text: '' };
    } else if (s.failed) {
      problems.push(`site.js 를 불러오지 못했어요. (${s.note})`);
    } else {
      remote.site = { sha: s.sha, text: s.text };
      try {
        site = parseSite(s.text);
      } catch (e) {
        problems.push(`site.js 를 읽는 중 오류가 났어요: ${e.message}`);
        remote.site = null;
      }
    }
    baseline.site = remote.site ? snapSite() : '';

    render();
    renderSitePanel();
    updateDirty();
    if (problems.length) setMsg([...new Set(problems)].join(' '), 'err');
    else setMsg(`영상 ${items.length}개와 소개·연락처를 불러왔어요.`);
  }

  // 한 파일을 저장 (최신 버전을 다시 받아 충돌을 확인한 뒤 커밋). 저장했으면 true.
  async function saveFile(file, key, build, snap, message) {
    let latest = null;
    try {
      latest = await fetchRemote(file);
    } catch (e) {
      // site.js 가 아직 없으면(404) 새로 만든다. 그 외 오류는 그대로 보여준다.
      if (!(e.status === 404 && key === 'site' && remote.site && !remote.site.sha)) throw e;
    }
    if (latest && remote[key] && remote[key].sha && latest.sha !== remote[key].sha &&
        !confirm(`불러온 뒤에 다른 곳에서 ${file} 가 바뀌었어요.\n내 화면의 내용으로 덮어쓸까요?`)) {
      return false;
    }
    const text = build(latest && latest.text);
    const res = await api('PUT', file, {
      message,
      content: b64encode(text),
      ...(latest ? { sha: latest.sha } : {}),
      branch: settings.branch,
    });
    remote[key] = { sha: res.content.sha, text };
    baseline[key] = snap();
    return true;
  }

  async function save() {
    readSettings();
    const problem = validate();
    if (problem) {
      showTab(problem.tab);
      return setMsg(problem.text, 'err');
    }
    if (!settings.token) {
      $('#settings').open = true;
      return setMsg('저장하려면 연결 설정에 토큰이 필요해요. (토큰 없이 쓰려면 "코드 보기·복사")', 'err');
    }
    const d = isDirty();
    if (!d.works && !d.site) return setMsg('저장할 변경이 없어요.');

    const btn = $('#save');
    btn.disabled = true;
    setMsg('저장하는 중…');
    const saved = [];
    const cancelled = [];
    try {
      if (d.works) {
        const ok = await saveFile(WORKS_FILE, 'works', (old) => buildText(toWorks(), old), snapWorks, '관리 페이지에서 작업물 수정');
        (ok ? saved : cancelled).push('영상');
      }
      if (d.site) {
        const ok = await saveFile(SITE_FILE, 'site', (old) => buildSiteText(toSite(), old), snapSite, '관리 페이지에서 소개·연락처 수정');
        (ok ? saved : cancelled).push('소개·연락처');
      }
      updateDirty();
      if (cancelled.length) {
        setMsg(`${saved.length ? `${saved.join(', ')}은(는) 저장했어요. ` : ''}${cancelled.join(', ')} 저장은 취소했어요. "되돌리기"로 새로 불러올 수 있어요.`, 'err');
      } else {
        setMsg(`저장했어요! (${saved.join(', ')}) 1~2분 뒤 사이트에 반영돼요. (새로고침은 Ctrl+Shift+R)`, 'ok');
      }
    } catch (e) {
      updateDirty();
      setMsg(`${saved.length ? `${saved.join(', ')}은(는) 저장했지만 ` : ''}저장하지 못했어요. ${e.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  // 만들어진 코드를 보여주고(토큰 없이 직접 붙여넣을 때), 복사 버튼으로 복사
  function showCode() {
    $('#code').value = buildText(toWorks(), remote.works && remote.works.text);
    $('#code-site').value = buildSiteText(toSite(), remote.site && remote.site.text);
    const box = $('#codebox');
    box.hidden = false;
    box.open = true;
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    setMsg('아래에서 파일별 "복사"를 누르세요. 해당 파일의 내용을 전부 지우고 붙여넣어 저장하면 돼요.');
  }

  async function copyArea(id, name) {
    const area = $(id);
    try {
      await navigator.clipboard.writeText(area.value);
      setMsg(`${name} 코드를 복사했어요. ${name} 의 내용을 전부 지우고 붙여넣은 뒤 저장하세요.`, 'ok');
    } catch (e) {
      area.select();
      setMsg('아래 코드를 직접 선택해서 복사하세요. (Ctrl+A → Ctrl+C)');
    }
  }

  // ---------- 시작 ----------
  $('#tab-works').addEventListener('click', () => showTab('works'));
  $('#tab-site').addEventListener('click', () => showTab('site'));
  $('#add').addEventListener('click', () => {
    items.push({ type: 'youtube', url: '', src: '', thumb: '', title: '', meta: `${new Date().getFullYear()} · `, tags: [], extra: {} });
    render();
    const last = list.lastElementChild;
    if (last) { $('.f-url', last).focus(); last.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  });
  $('#add-link').addEventListener('click', () => {
    site.links.push({ label: '', url: '' });
    renderLinks();
    updateDirty();
    const last = linksEl.lastElementChild;
    if (last) $('.l-label', last).focus();
  });
  $('#f-about').addEventListener('input', (e) => { site.about = e.target.value; updateDirty(); });
  $('#f-email').addEventListener('input', (e) => { site.email = e.target.value; updateDirty(); });
  $('#save').addEventListener('click', save);
  $('#copy').addEventListener('click', showCode);
  $('#copy-works').addEventListener('click', () => copyArea('#code', 'works.js'));
  $('#copy-site').addEventListener('click', () => copyArea('#code-site', 'site.js'));
  $('#reload').addEventListener('click', () => {
    if (confirm('저장하지 않은 변경을 버리고 다시 불러올까요?')) load();
  });
  ['#s-owner', '#s-repo', '#s-branch', '#s-token', '#s-remember'].forEach((s) =>
    $(s).addEventListener('change', readSettings));
  window.addEventListener('beforeunload', (e) => {
    if (dirtyEl.classList.contains('on')) { e.preventDefault(); e.returnValue = ''; }
  });

  loadSettings();
  load();
})();
