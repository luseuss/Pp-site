/*
  관리 페이지 동작 (admin.html)
  1) GitHub 의 works.js(영상) · site.js(이름·첫 화면·소개·연락처)를 불러와서 화면에 보여주고
  2) 수정한 내용을 각 파일 형식으로 만들어서
  3) GitHub API 로 저장(커밋)해요. (토큰이 있어야 저장 가능, 바뀐 파일만 저장)
*/
(() => {
  'use strict';

  const KEY = 'pp-admin-v1';
  const DEFAULTS = { owner: 'luseuss', repo: 'Pp-site', branch: 'claude/portfolio-site-creation-p3kzl1', token: '', remember: false };
  const WORKS_FILE = 'works.js';
  const SITE_FILE = 'site.js';
  const INDEX_FILE = 'index.html';                     // 검색·공유 정보(<head>)는 여기에 들어가요
  const DEFAULT_BASE = /^https?:$/.test(location.protocol) ? new URL('.', location.href).href : 'https://maru2.pages.dev/';

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const list = $('#list');
  const linksEl = $('#links');
  const tpl = $('#row-tpl');
  const linkTpl = $('#link-tpl');
  const msg = $('#msg');
  const dirtyEl = $('#dirty');

  let settings = { ...DEFAULTS };
  let items = [];                                      // 화면에서 편집 중인 영상 목록
  let site = emptySite();                              // 화면에서 편집 중인 사이트 정보 (이름·첫 화면·소개·연락처)
  let baseline = { works: '', site: '' };              // 불러온/저장한 직후의 내용(JSON) — 변경 여부 비교용
  let remote = { works: null, site: null, index: null };            // { sha, text } GitHub 에 있는 파일
  const pendingUploads = new Map();                    // 아직 GitHub 에 안 올린 이미지: 경로 → { blob }
  const previews = new Map();                          // 미리보기용: 경로 → blob 주소 (사이트에 올라가기 전에도 보이게)

  // 사이트 정보의 기본값 = 지금 사이트에 보이는 문구.
  // 옛 site.js 처럼 이 값들이 없는 파일을 불러와도 문구가 비워지지 않도록 이 값으로 채워요.
  const SITE_DEFAULTS = {
    name: 'MaRu_2',
    tagline: '영상 편집 포트폴리오',
    hero: { eyebrow: 'VIDEO EDITOR', title: '소리가 주는 감동을\n시각적으로 표현하자', lead: 'mv,amv', button: 'works ↓' },
    nav: { about: '소개', work: '작업물', contact: '연락' },
    sections: { about: { show: true, title: 'About' }, work: { show: true, title: 'Work' }, contact: { show: true, title: 'Contact' } },
    aboutImage: 'images/logo.png',
    animations: true,
    heroMotion: true,
    heroFade: true,
    tilt: true,
    // 검색·공유 정보: site.js 가 아니라 index.html 에 저장돼요 (검색 로봇·메신저 앱은 자바스크립트를 실행하지 않아서)
    seo: {
      siteUrl: 'https://maru2.pages.dev/',
      description: '소리가 주는 감동을 시각적으로 표현하는 모션 그래픽 디자이너 MaRu_2의 영상 편집 포트폴리오입니다.',
      ogImage: 'images/og.png',
    },
  };
  const SECTION_KEYS = ['about', 'work', 'contact'];
  function emptySite() {
    return {
      name: '', tagline: '', animations: true, heroMotion: true, heroFade: true, tilt: true, hero: { eyebrow: '', title: '', lead: '', button: '' },
      nav: { about: '', work: '', contact: '' },
      sections: { about: { show: true, title: '' }, work: { show: true, title: '' }, contact: { show: true, title: '' } },
      about: '', aboutImage: '', email: '', links: [],
      seo: { siteUrl: '', description: '', ogImage: '' },
    };
  }
  // site.js 가 아직 없을 때의 시작 상태: 이름·첫 화면은 지금 문구, 나머지는 빈칸
  function newSite() {
    return structuredClone({ ...emptySite(), ...SITE_DEFAULTS, about: '', email: '', links: [] });
  }

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

  // 이미지 경로: images/a.png 같은 상대 경로(.. 와 맨 앞 / 불가) 또는 http(s):// 주소만 허용 (script.js 와 같은 규칙)
  const isSafeImage = (p) => {
    const v = String(p || '').trim();
    return /^https?:\/\/\S+$/i.test(v) || (/^[\p{L}\p{N}_\-./%]+$/u.test(v) && !v.includes('..') && !v.startsWith('/'));
  };

  const b64decode = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));
  const b64encode = (str) => {
    let bin = '';
    new TextEncoder().encode(str).forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin);
  };

  // ---------- 이미지: 줄이기 / 올릴 목록에 담기 ----------
  const IMG_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
  const MAX_UPLOAD = 5 * 1024 * 1024;   // 올릴 파일 한 개 최대 크기

  // 브라우저 내장 FileReader 로 base64 변환 (큰 문자열을 직접 이어 붙이지 않아 메모리를 덜 써요)
  const blobToB64 = (blob) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
    fr.onerror = () => reject(new Error('이미지를 읽을 수 없어요.'));
    fr.readAsDataURL(blob);
  });

  // 큰 이미지는 긴 변이 maxSide 이하가 되게 줄이고(png·webp 는 투명 유지), gif 는 움직임을 지키려고 그대로 올려요.
  async function prepareImage(file, maxSide) {
    const ext = IMG_EXT[file.type];
    if (!ext) throw new Error('png, jpg, webp, gif 이미지만 올릴 수 있어요.');
    if (file.size > 20 * 1024 * 1024) throw new Error('이미지가 너무 커요. (20MB 이하만 가능해요)');
    if (ext === 'gif') {
      if (file.size > MAX_UPLOAD) throw new Error('gif 는 5MB 이하만 올릴 수 있어요.');
      return { blob: file, ext };
    }
    let bmp;
    try { bmp = await createImageBitmap(file); } catch (e) { throw new Error('이미지를 읽을 수 없어요. 다른 파일을 골라 주세요.'); }
    let blob = file;
    let canvas = null;
    try {
      const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
      if (scale < 1 || file.size > 1.5 * 1024 * 1024) {
        canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bmp.width * scale));
        canvas.height = Math.max(1, Math.round(bmp.height * scale));
        canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
        const out = await new Promise((resolve) => canvas.toBlob(resolve, file.type, 0.88));
        if (out && out.size < file.size) blob = out;   // 줄였는데 더 커지면 원본 유지
      }
    } finally {
      if (bmp.close) bmp.close();                       // 디코딩된 이미지 메모리 반납
      if (canvas) { canvas.width = 0; canvas.height = 0; }   // 캔버스 메모리 반납 (일부 브라우저는 이래야 풀려요)
    }
    if (blob.size > MAX_UPLOAD) throw new Error('이미지가 아직 너무 커요. 더 작은 이미지를 골라 주세요.');
    return { blob, ext };
  }

  // 이미지를 줄여서 "올릴 목록"에 담고 경로를 돌려준다. (실제 업로드는 GitHub에 저장할 때)
  async function stageImage(file, folder, maxSide) {
    const { blob, ext } = await prepareImage(file, maxSide);
    const base = (file.name || '').replace(/\.[^.]*$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'image';
    const path = `${folder}/${base}-${Date.now().toString(36)}.${ext}`;
    pendingUploads.set(path, { blob });
    previews.set(path, URL.createObjectURL(blob));
    return { path, bytes: blob.size };
  }
  const kb = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);
  const previewSrc = (path) => previews.get(path) || path;

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
      if (it.type === 'mp4') o.src = it.src.trim();
      else o.url = it.url.trim();
      if (it.thumb.trim()) o.thumb = it.thumb.trim();   // 비우면 YouTube 는 자동 썸네일
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
    const str = (v, fallback) => (typeof v === 'string' ? v : fallback);   // 값이 없을(undefined) 때만 기본값
    const h = s.hero && typeof s.hero === 'object' ? s.hero : {};
    return {
      name: str(s.name, SITE_DEFAULTS.name),
      tagline: str(s.tagline, SITE_DEFAULTS.tagline),
      animations: typeof s.animations === 'boolean' ? s.animations : SITE_DEFAULTS.animations,
      heroMotion: typeof s.heroMotion === 'boolean' ? s.heroMotion : SITE_DEFAULTS.heroMotion,
      heroFade: typeof s.heroFade === 'boolean' ? s.heroFade : SITE_DEFAULTS.heroFade,
      tilt: typeof s.tilt === 'boolean' ? s.tilt : SITE_DEFAULTS.tilt,
      hero: {
        eyebrow: str(h.eyebrow, SITE_DEFAULTS.hero.eyebrow),
        title: str(h.title, SITE_DEFAULTS.hero.title),
        lead: str(h.lead, SITE_DEFAULTS.hero.lead),
        button: str(h.button, SITE_DEFAULTS.hero.button),
      },
      nav: Object.fromEntries(SECTION_KEYS.map((k) => [k, str(s.nav && s.nav[k], SITE_DEFAULTS.nav[k])])),
      sections: Object.fromEntries(SECTION_KEYS.map((k) => {
        const c = (s.sections && s.sections[k]) || {};
        return [k, { show: typeof c.show === 'boolean' ? c.show : true, title: str(c.title, SITE_DEFAULTS.sections[k].title) }];
      })),
      about: String(s.about || ''),
      aboutImage: str(s.aboutImage, SITE_DEFAULTS.aboutImage),
      email: String(s.email || ''),
      links: (Array.isArray(s.links) ? s.links : []).map((l) => ({ label: String((l && l.label) || ''), url: String((l && l.url) || '') })),
      seo: structuredClone(SITE_DEFAULTS.seo),   // 실제 값은 index.html 에서 읽어요 (load)
    };
  }

  // 여러 줄 글: 줄 끝 공백 정리, 앞뒤 빈 줄 제거
  const cleanLines = (t) => t.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trimEnd()).join('\n').trim();

  // 화면 → 저장할 내용 (이름 칸들은 앞뒤 공백 정리, 이름·주소가 모두 빈 링크 줄은 버림)
  function toSite() {
    return {
      name: site.name.trim(),
      tagline: site.tagline.trim(),
      animations: !!site.animations,
      heroMotion: !!site.heroMotion,
      heroFade: !!site.heroFade,
      tilt: !!site.tilt,
      hero: {
        eyebrow: site.hero.eyebrow.trim(),
        title: cleanLines(site.hero.title),
        lead: site.hero.lead.trim(),
        button: site.hero.button.trim(),
      },
      nav: Object.fromEntries(SECTION_KEYS.map((k) => [k, site.nav[k].trim()])),
      sections: Object.fromEntries(SECTION_KEYS.map((k) => [k, { show: !!site.sections[k].show, title: site.sections[k].title.trim() }])),
      about: cleanLines(site.about),
      aboutImage: site.aboutImage.trim(),
      email: site.email.trim(),
      links: site.links
        .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
        .filter((l) => l.label || l.url),
      seo: {
        siteUrl: site.seo.siteUrl.trim(),
        description: site.seo.description.replace(/\s+/g, ' ').trim(),
        ogImage: site.seo.ogImage.trim(),
      },
    };
  }

  const SITE_HEADER = `/*
  ★ 사이트 정보 (이름 · 첫 화면 · 소개 · 연락처) — 관리 페이지(admin.html)에서 고치거나, 여기를 직접 고쳐도 돼요 ★
  name/tagline: 사이트 이름과 탭 제목 설명, animations: 애니메이션 켜기/끄기, heroMotion: 첫 화면 배경 파동, heroFade/tilt: 스크롤 흐려지기·마우스 기울기, hero: 첫 화면 문구, nav/sections: 메뉴와 영역(보이기·제목),
  about/aboutImage: 소개 글과 이미지,
  email: 이메일, links: 링크 목록 (label=이름, url=주소). 따옴표 한 줄이 화면의 한 줄이에요.
*/

`;

  // 기존 site.js 의 맨 위 설명 주석은 그대로 두고, 내용 부분만 새로 만든다
  function buildSiteText(s, oldText) {
    const at = oldText ? oldText.indexOf('const SITE = {') : -1;
    const header = at > 0 ? oldText.slice(0, at) : SITE_HEADER;
    const q = JSON.stringify;
    // 여러 줄 글 → ["줄1", "줄2"].join("\n")  (파일에서 읽고 고치기 쉽게)
    const multi = (text, pad) => {
      const lines = text ? text.split('\n') : [];
      return lines.length ? `[\n${lines.map((l) => `${pad}  ${q(l)},`).join('\n')}\n${pad}].join("\\n")` : '""';
    };
    const links = s.links.length
      ? `[\n${s.links.map((l) => `    { label: ${q(l.label)}, url: ${q(l.url)} },`).join('\n')}\n  ]`
      : '[]';
    return `${header}const SITE = {
  name: ${q(s.name)},
  tagline: ${q(s.tagline)},
  animations: ${s.animations ? 'true' : 'false'},
  heroMotion: ${s.heroMotion ? 'true' : 'false'},
  heroFade: ${s.heroFade ? 'true' : 'false'},
  tilt: ${s.tilt ? 'true' : 'false'},
  hero: {
    eyebrow: ${q(s.hero.eyebrow)},
    title: ${multi(s.hero.title, '    ')},
    lead: ${q(s.hero.lead)},
    button: ${q(s.hero.button)},
  },
  nav: { ${SECTION_KEYS.map((k) => `${k}: ${q(s.nav[k])}`).join(', ')} },
  sections: {
${SECTION_KEYS.map((k) => `    ${k}: { show: ${s.sections[k].show}, title: ${q(s.sections[k].title)} },`).join('\n')}
  },
  about: ${multi(s.about, '  ')},
  aboutImage: ${q(s.aboutImage)},
  email: ${q(s.email)},
  links: ${links},
};
`;
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

  // 지금 화면에서 더 이상 쓰지 않는 이미지는 메모리에서 놓아 준다 (올릴 목록 + 미리보기용 blob 주소)
  function gcImages() {
    const used = new Set([...items.map((it) => it.thumb.trim()), site.aboutImage.trim(), site.seo.ogImage.trim()]);
    for (const [path, url] of previews) {
      if (!used.has(path)) { URL.revokeObjectURL(url); previews.delete(path); }
    }
    for (const path of pendingUploads.keys()) {
      if (!used.has(path)) pendingUploads.delete(path);
    }
  }

  function updateDirty() {
    gcImages();
    const d = isDirty();
    const on = d.works || d.site;
    const what = [d.works && '영상', d.site && '사이트 정보'].filter(Boolean).join(', ');
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
    if (it.thumb.trim()) {
      src = previewSrc(it.thumb.trim());
    } else if (it.type === 'youtube') {
      const id = getYouTubeId(it.url);
      if (id) src = `https://img.youtube.com/vi/${encodeURIComponent(id)}/mqdefault.jpg`;
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
        $('.l-thumb', li).textContent = it.type === 'youtube' ? '썸네일 이미지 (선택 · 비우면 YouTube 썸네일을 자동으로 써요)' : '썸네일 이미지 (선택)';
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
      // 썸네일 이미지 올리기 / 지우기
      const thumbInput = $('.f-thumb', li), thumbFile = $('.file-thumb', li);
      $('.up-thumb', li).addEventListener('click', () => thumbFile.click());
      thumbFile.addEventListener('change', async () => {
        const f = thumbFile.files[0];
        thumbFile.value = '';
        if (!f) return;
        try {
          const { path, bytes } = await stageImage(f, 'thumbs', 800);
          it.thumb = path;
          thumbInput.value = path;
          updatePreview(li, it);
          updateDirty();
          setMsg(`썸네일 이미지를 준비했어요. (${kb(bytes)}) 저장할 때 같이 올라가요.`, 'ok');
        } catch (e) { setMsg(e.message, 'err'); }
      });
      $('.clr-thumb', li).addEventListener('click', () => { it.thumb = ''; thumbInput.value = ''; updatePreview(li, it); updateDirty(); });
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
    $('#f-name').value = site.name;
    $('#f-tagline').value = site.tagline;
    $('#f-anim').checked = site.animations;
    $('#f-hero-motion').checked = site.heroMotion;
    $('#f-hero-fade').checked = site.heroFade;
    $('#f-tilt').checked = site.tilt;
    $('#f-eyebrow').value = site.hero.eyebrow;
    $('#f-hero-title').value = site.hero.title;
    $('#f-lead').value = site.hero.lead;
    $('#f-button').value = site.hero.button;
    $('#f-about').value = site.about;
    $('#f-about-image').value = site.aboutImage;
    updateAboutPreview();
    $('#f-seo-url').value = site.seo.siteUrl;
    $('#f-seo-desc').value = site.seo.description;
    $('#f-seo-image').value = site.seo.ogImage;
    updateSharePreview();
    $('#f-email').value = site.email;
    $$('.secrow[data-sec]').forEach((row) => {
      const k = row.dataset.sec;
      $('.s-show', row).checked = site.sections[k].show;
      $('.s-nav', row).value = site.nav[k];
      $('.s-title', row).value = site.sections[k].title;
    });
    renderLinks();
  }

  function updateAboutPreview() {
    const box = $('#about-prev');
    box.textContent = '';
    const path = site.aboutImage.trim();
    if (!path) { box.textContent = '이미지 없음'; return; }
    const img = document.createElement('img');
    img.alt = '';
    img.src = previewSrc(path);
    img.style.objectFit = 'contain';
    img.onerror = () => { box.textContent = '미리보기 없음'; };
    box.appendChild(img);
  }

  // 검색·공유 미리보기 카드 + 글자 수
  function updateSharePreview() {
    const s = toSite();
    const count = $('#seo-count');
    count.textContent = `${s.seo.description.length}자`;
    count.classList.toggle('warn', s.seo.description.length > 300);
    const box = $('#share-preview');
    box.textContent = '';
    const pic = document.createElement('div');
    pic.className = 'pic';
    const path = s.seo.ogImage;
    if (path) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = previewSrc(path);
      img.onerror = () => { pic.textContent = '미리보기 없음'; };
      pic.appendChild(img);
    } else pic.textContent = '이미지 없음';
    const txt = document.createElement('div');
    txt.className = 'txt';
    const host = document.createElement('small');
    try { host.textContent = new URL(SEO.normalizeBase(s.seo.siteUrl)).hostname; } catch (e) { host.textContent = ''; }
    const title = document.createElement('b');
    title.textContent = SEO.pageTitle(s.name, s.tagline);
    const desc = document.createElement('span');
    desc.textContent = s.seo.description;
    txt.append(host, title, desc);
    box.append(pic, txt);
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
    for (let i = 0; i < items.length; i++) {
      const t = items[i].thumb.trim();
      if (t && !isSafeImage(t)) return { tab: 'works', text: `${i + 1}번 영상: 썸네일 경로가 올바르지 않아요. (예: thumbs/my-work.jpg)` };
    }
    const s = toSite();
    if (s.aboutImage && !isSafeImage(s.aboutImage)) return { tab: 'site', text: '소개 이미지 경로가 올바르지 않아요. (예: images/logo.png)' };
    if (s.seo.siteUrl && !/^https?:\/\/\S+$/i.test(s.seo.siteUrl)) return { tab: 'site', text: '검색·공유의 사이트 주소는 https:// 로 시작해야 해요. (예: https://maru2.pages.dev/)' };
    if (s.seo.ogImage && !isSafeImage(s.seo.ogImage)) return { tab: 'site', text: '공유 미리보기 이미지 경로가 올바르지 않아요. (예: images/og.png)' };
    if (s.seo.description.length > 300) return { tab: 'site', text: '검색·공유 설명이 너무 길어요. (300자 이하, 80~150자를 권장해요)' };
    if (!s.name) return { tab: 'site', text: '사이트 이름을 적어 주세요. (맨 위 로고와 탭 제목에 쓰여요)' };
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
    pendingUploads.clear();
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

    // 사이트 정보 (site.js) — 아직 파일이 없으면(404) 빈 상태로 시작하고, 저장하면 새로 만들어요
    const s = await loadText(SITE_FILE);
    site = emptySite();
    remote.site = null;
    if (s.failed && s.status === 404 && !w.failed) {
      remote.site = { sha: '', text: '' };
      site = newSite();
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

    // 검색·공유 정보 (index.html 의 SEO 구역)
    const ix = await loadText(INDEX_FILE);
    remote.index = null;
    if (ix.failed) {
      problems.push(`index.html 을 불러오지 못했어요. 검색·공유 정보는 저장되지 않아요. (${ix.note})`);
    } else {
      remote.index = { sha: ix.sha, text: ix.text };
      site.seo = SEO.parseSeo(ix.text, DEFAULT_BASE);
      if (!SEO.currentBlock(ix.text)) site.seo.ogImage = SITE_DEFAULTS.seo.ogImage;   // 옛 index.html: 기본 공유 이미지
    }
    baseline.site = remote.site ? snapSite() : '';

    render();
    renderSitePanel();
    updateDirty();
    if (problems.length) setMsg([...new Set(problems)].join(' '), 'err');
    else setMsg(`영상 ${items.length}개와 사이트 정보를 불러왔어요.`);
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
    const text = build(latest && latest.text);
    if (latest && text === latest.text) {               // 파일 내용이 이미 같으면 올리지 않아요 (예: 검색·공유 정보만 바꾼 경우)
      remote[key] = { sha: latest.sha, text };
      baseline[key] = snap();
      return true;
    }
    if (latest && remote[key] && remote[key].sha && latest.sha !== remote[key].sha &&
        !confirm(`불러온 뒤에 다른 곳에서 ${file} 가 바뀌었어요.\n내 화면의 내용으로 덮어쓸까요?`)) {
      return false;
    }
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

  // index.html 의 검색·공유 구역만 최신 파일 위에서 바꿔 저장 (다른 부분은 건드리지 않아요). 올렸으면 true.
  async function saveIndex() {
    if (!remote.index) return false;
    const latest = await fetchRemote(INDEX_FILE);
    const s = toSite();
    const text = SEO.replaceSeoBlock(latest.text, SEO.buildSeoBlock(s.seo, { name: s.name, tagline: s.tagline }));
    remote.index = { sha: latest.sha, text: latest.text };
    if (text === latest.text) return false;
    const res = await api('PUT', INDEX_FILE, { message: '관리 페이지에서 검색·공유 정보 수정', content: b64encode(text), sha: latest.sha, branch: settings.branch });
    remote.index = { sha: res.content.sha, text };
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
      // 이미지: 아직 안 올렸고 지금도 쓰이는 것만 먼저 올린다 (글이 가리키는 파일이 먼저 있어야 해서)
      const used = new Set([...items.map((it) => it.thumb.trim()), site.aboutImage.trim(), site.seo.ogImage.trim()]);
      const todo = [...pendingUploads].filter(([path]) => used.has(path));
      for (const [path, up] of todo) {
        await api('PUT', path, { message: '관리 페이지에서 이미지 올리기', content: await blobToB64(up.blob), branch: settings.branch });
        pendingUploads.delete(path);
      }
      if (todo.length) saved.push(`이미지 ${todo.length}개`);
      if (d.works) {
        const ok = await saveFile(WORKS_FILE, 'works', (old) => buildText(toWorks(), old), snapWorks, '관리 페이지에서 작업물 수정');
        (ok ? saved : cancelled).push('영상');
      }
      if (d.site) {
        const ok = await saveFile(SITE_FILE, 'site', (old) => buildSiteText(toSite(), old), snapSite, '관리 페이지에서 사이트 정보 수정');
        (ok ? saved : cancelled).push('사이트 정보');
        if (ok && await saveIndex()) saved.push('검색·공유 정보');
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
    const s = toSite();
    $('#code-seo').value = SEO.buildSeoBlock(s.seo, { name: s.name, tagline: s.tagline });
    const box = $('#codebox');
    box.hidden = false;
    box.open = true;
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const pend = pendingUploads.size ? ` (이미지 ${pendingUploads.size}개는 코드 복사로 올릴 수 없어요. 토큰을 넣고 "GitHub에 저장"을 쓰거나, 이미지 파일을 저장소의 해당 폴더에 직접 넣으세요.)` : '';
    setMsg(`아래에서 파일별 "복사"를 누르세요. 해당 파일의 내용을 전부 지우고 붙여넣어 저장하면 돼요.${pend}`);
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
  // 입력칸 → site 값 연결 (칸 id 와 site 안의 위치)
  [
    ['#f-name', (v) => { site.name = v; }],
    ['#f-tagline', (v) => { site.tagline = v; }],
    ['#f-eyebrow', (v) => { site.hero.eyebrow = v; }],
    ['#f-hero-title', (v) => { site.hero.title = v; }],
    ['#f-lead', (v) => { site.hero.lead = v; }],
    ['#f-button', (v) => { site.hero.button = v; }],
    ['#f-about', (v) => { site.about = v; }],
    ['#f-about-image', (v) => { site.aboutImage = v; updateAboutPreview(); }],
  ].forEach(([sel, set]) => $(sel).addEventListener('input', (e) => { set(e.target.value); updateDirty(); }));

  $('#f-anim').addEventListener('change', (e) => { site.animations = e.target.checked; updateDirty(); });
  $('#f-hero-motion').addEventListener('change', (e) => { site.heroMotion = e.target.checked; updateDirty(); });
  $('#f-hero-fade').addEventListener('change', (e) => { site.heroFade = e.target.checked; updateDirty(); });
  $('#f-tilt').addEventListener('change', (e) => { site.tilt = e.target.checked; updateDirty(); });

  // 메뉴와 섹션 (보이기 / 메뉴 글자 / 영역 제목)
  $$('.secrow[data-sec]').forEach((row) => {
    const k = row.dataset.sec;
    $('.s-show', row).addEventListener('change', (e) => { site.sections[k].show = e.target.checked; updateDirty(); });
    $('.s-nav', row).addEventListener('input', (e) => { site.nav[k] = e.target.value; updateDirty(); });
    $('.s-title', row).addEventListener('input', (e) => { site.sections[k].title = e.target.value; updateDirty(); });
  });

  // 소개 이미지 올리기 / 없애기
  $('#up-about').addEventListener('click', () => $('#file-about').click());
  $('#file-about').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const { path, bytes } = await stageImage(f, 'images', 640);
      site.aboutImage = path;
      $('#f-about-image').value = path;
      updateAboutPreview();
      updateDirty();
      setMsg(`소개 이미지를 준비했어요. (${kb(bytes)}) 저장할 때 같이 올라가요.`, 'ok');
    } catch (err) { setMsg(err.message, 'err'); }
  });
  $('#clr-about').addEventListener('click', () => { site.aboutImage = ''; $('#f-about-image').value = ''; updateAboutPreview(); updateDirty(); });
  $('#f-email').addEventListener('input', (e) => { site.email = e.target.value; updateDirty(); });

  // 검색·공유 정보
  [
    ['#f-seo-url', (v) => { site.seo.siteUrl = v; }],
    ['#f-seo-desc', (v) => { site.seo.description = v; }],
    ['#f-seo-image', (v) => { site.seo.ogImage = v; }],
  ].forEach(([sel, set]) => $(sel).addEventListener('input', (e) => { set(e.target.value); updateSharePreview(); updateDirty(); }));
  ['#f-name', '#f-tagline'].forEach((sel) => $(sel).addEventListener('input', updateSharePreview));
  $('#up-seo').addEventListener('click', () => $('#file-seo').click());
  $('#file-seo').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      if (f.type !== 'image/png' && f.type !== 'image/jpeg') throw new Error('공유 미리보기 이미지는 png 또는 jpg 만 쓸 수 있어요. (카톡·X 등이 webp·gif 는 못 읽는 경우가 있어요)');
      const { path, bytes } = await stageImage(f, 'images', 1200);
      site.seo.ogImage = path;
      $('#f-seo-image').value = path;
      updateSharePreview();
      updateDirty();
      setMsg(`공유 이미지를 준비했어요. (${kb(bytes)}) 저장할 때 같이 올라가요.`, 'ok');
    } catch (err) { setMsg(err.message, 'err'); }
  });
  $('#clr-seo').addEventListener('click', () => { site.seo.ogImage = ''; $('#f-seo-image').value = ''; updateSharePreview(); updateDirty(); });
  $('#save').addEventListener('click', save);
  $('#copy').addEventListener('click', showCode);
  $('#copy-works').addEventListener('click', () => copyArea('#code', 'works.js'));
  $('#copy-site').addEventListener('click', () => copyArea('#code-site', 'site.js'));
  $('#copy-seo').addEventListener('click', () => copyArea('#code-seo', 'index.html 의 검색·공유 구역'));
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
