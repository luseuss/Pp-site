/*
  관리 페이지 동작 (admin.html)
  1) GitHub 의 works.js 를 불러와서 화면에 목록으로 보여주고
  2) 수정한 목록을 works.js 형식으로 만들어서
  3) GitHub API 로 저장(커밋)해요. (토큰이 있어야 저장 가능)
*/
(() => {
  'use strict';

  const KEY = 'pp-admin-v1';
  const DEFAULTS = { owner: 'luseuss', repo: 'Pp-site', branch: 'claude/portfolio-site-creation-p3kzl1', token: '', remember: false };
  const FILE = 'works.js';

  const $ = (sel, el = document) => el.querySelector(sel);
  const list = $('#list');
  const tpl = $('#row-tpl');
  const msg = $('#msg');
  const dirtyEl = $('#dirty');

  let settings = { ...DEFAULTS };
  let items = [];        // 화면에서 편집 중인 목록
  let baseline = '';     // 불러온/저장한 직후의 목록(JSON) — 변경 여부 비교용
  let remote = null;     // { sha, text } GitHub 에 있는 works.js

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
  function explain(status) {
    if (status === 401) return '토큰이 올바르지 않거나 만료됐어요. 연결 설정에서 토큰을 확인하세요.';
    if (status === 403) return '권한이 없어요. 토큰의 Contents 권한이 "Read and write"인지, 이 저장소가 선택됐는지 확인하세요.';
    if (status === 404) return '저장소·브랜치 이름을 찾을 수 없어요. 연결 설정을 확인하세요. (비공개 저장소면 토큰이 필요해요)';
    if (status === 409 || status === 422) return '그사이 다른 곳에서 works.js 가 바뀌었어요. "되돌리기"로 새로 불러온 뒤 다시 시도하세요.';
    return `GitHub 오류 (${status})`;
  }

  async function api(method, body) {
    const { owner, repo, branch, token } = settings;
    const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${FILE}`;
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
      const err = new Error(explain(res.status));
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  async function fetchRemote() {
    const data = await api('GET');
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

  // ---------- 화면 ----------
  const snapshot = () => JSON.stringify(toWorks());

  function updateDirty() {
    const on = items.length > 0 || baseline !== '' ? snapshot() !== baseline : false;
    dirtyEl.textContent = on ? '● 저장 안 된 변경이 있어요' : '변경 없음';
    dirtyEl.className = on ? 'on' : '';
    $('#reload').disabled = !on;
  }

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

  function validate() {
    for (let i = 0; i < items.length; i++) {
      const it = items[i], n = `${i + 1}번 영상`;
      if (it.type === 'youtube' && !getYouTubeId(it.url.trim())) return `${n}: YouTube 주소를 읽을 수 없어요.`;
      if (it.type === 'mp4' && !it.src.trim()) return `${n}: mp4 파일 경로를 적어 주세요.`;
      if (!it.title.trim()) return `${n}: 제목을 적어 주세요.`;
    }
    return '';
  }

  // ---------- 불러오기 / 저장 ----------
  async function load() {
    readSettings();
    setMsg('불러오는 중…');
    let text = '';
    try {
      remote = await fetchRemote();
      text = remote.text;
    } catch (e) {
      // GitHub API 가 안 되면 사이트에 올라간 works.js 로 대신 불러온다 (보기/코드 복사용)
      try {
        text = await (await fetch(`${FILE}?t=${Date.now()}`, { cache: 'no-store' })).text();
        remote = { sha: '', text };
        setMsg(`GitHub 에서 불러오지 못해서 사이트의 works.js 를 보여 줘요. (${e.message})`, 'err');
      } catch (e2) {
        remote = null;
        items = [];
        baseline = '';
        render();
        setMsg(`works.js 를 불러오지 못했어요. (${e.message})`, 'err');
        return;
      }
    }
    try {
      items = fromWorks(parseWorks(text));
    } catch (e) {
      items = [];
      setMsg(`works.js 를 읽는 중 오류가 났어요: ${e.message}`, 'err');
      baseline = '';
      render();
      return;
    }
    baseline = snapshot();
    render();
    if (!msg.classList.contains('err')) setMsg(`${items.length}개의 영상을 불러왔어요.`);
  }

  async function save() {
    readSettings();
    const problem = validate();
    if (problem) return setMsg(problem, 'err');
    if (!settings.token) {
      $('#settings').open = true;
      return setMsg('저장하려면 연결 설정에 토큰이 필요해요. (토큰 없이 쓰려면 "코드 복사")', 'err');
    }
    const btn = $('#save');
    btn.disabled = true;
    setMsg('저장하는 중…');
    try {
      const latest = await fetchRemote();
      if (remote && remote.sha && latest.sha !== remote.sha &&
          !confirm('불러온 뒤에 다른 곳에서 works.js 가 바뀌었어요.\n내 화면의 내용으로 덮어쓸까요?')) {
        setMsg('저장을 취소했어요. "되돌리기"로 새로 불러올 수 있어요.', 'err');
        return;
      }
      const works = toWorks();
      const text = buildText(works, latest.text);
      const res = await api('PUT', {
        message: '관리 페이지에서 작업물 수정',
        content: b64encode(text),
        sha: latest.sha,
        branch: settings.branch,
      });
      remote = { sha: res.content.sha, text };
      baseline = snapshot();
      updateDirty();
      setMsg('저장했어요! 1~2분 뒤 사이트에 반영돼요. (새로고침은 Ctrl+Shift+R)', 'ok');
    } catch (e) {
      setMsg(`저장하지 못했어요. ${e.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function copyCode() {
    const text = buildText(toWorks(), remote && remote.text);
    const box = $('#codebox');
    box.hidden = false;
    box.open = true;
    const area = $('#code');
    area.value = text;
    try {
      await navigator.clipboard.writeText(text);
      setMsg('복사했어요. works.js 의 내용을 전부 지우고 붙여넣은 뒤 저장하세요.', 'ok');
    } catch (e) {
      area.select();
      setMsg('아래 코드를 직접 선택해서 복사하세요. (Ctrl+A → Ctrl+C)', '');
    }
  }

  // ---------- 시작 ----------
  $('#add').addEventListener('click', () => {
    items.push({ type: 'youtube', url: '', src: '', thumb: '', title: '', meta: `${new Date().getFullYear()} · `, tags: [], extra: {} });
    render();
    const last = list.lastElementChild;
    if (last) { $('.f-url', last).focus(); last.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  });
  $('#save').addEventListener('click', save);
  $('#copy').addEventListener('click', copyCode);
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
