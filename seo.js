/*
  검색 · 공유 정보(SEO) 도우미 — index.html 의 <head> 안, 아래 두 주석 사이를 만들고 읽어요.

      <!-- SEO:START ... -->  ...  <!-- SEO:END -->

  이 정보(탭 제목, 검색 설명, 링크 공유 미리보기)는 검색 로봇과 카톡·인스타 같은 앱이
  "자바스크립트를 실행하지 않고" 읽기 때문에, site.js 가 아니라 index.html 에 직접 들어가야 해요.
  관리 페이지(admin.html)가 이 파일의 함수로 그 부분만 다시 만들어요. (사이트 자체는 이 파일을 불러오지 않아요.)
*/
(function (root) {
  'use strict';

  const START = '<!-- SEO:START (검색·공유 정보 — 관리 페이지의 "검색·공유"에서 고쳐요. 이 두 주석 사이는 자동으로 다시 만들어져요) -->';
  const END = '<!-- SEO:END -->';
  const MARK_START = '<!-- SEO:START';

  const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const unescAttr = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const escText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 탭 제목: script.js 가 만드는 document.title 과 같은 규칙 ("이름 | 설명")
  function pageTitle(name, tagline) {
    const n = String(name || '').trim(), t = String(tagline || '').trim();
    return n ? (t ? `${n} | ${t}` : n) : t;
  }

  // 사이트 주소는 항상 맨 끝이 / 로 끝나게 맞춘다
  function normalizeBase(url) {
    const u = String(url || '').trim();
    return u && !u.endsWith('/') ? `${u}/` : u;
  }

  // 이미지 경로 → 절대 주소 (공유 미리보기는 절대 주소여야 해요). 이미 http(s) 주소면 그대로.
  function absoluteUrl(path, base) {
    const p = String(path || '').trim();
    if (!p) return '';
    if (/^https?:\/\//i.test(p)) return p;
    try { return new URL(p, normalizeBase(base)).href; } catch (e) { return p; }
  }

  // seo = { siteUrl, description, ogImage }, site = { name, tagline } → <head> 에 넣을 HTML 조각
  function buildSeoBlock(seo, site) {
    const title = pageTitle(site.name, site.tagline);
    const base = normalizeBase(seo.siteUrl);
    const desc = String(seo.description || '').trim();
    const image = absoluteUrl(seo.ogImage, base);
    const L = [];
    const add = (s) => L.push(`  ${s}`);
    L.push(`  ${START}`);
    add(`<title>${escText(title)}</title>`);
    if (desc) add(`<meta name="description" content="${escAttr(desc)}" />`);
    if (base) add(`<link rel="canonical" href="${escAttr(base)}" />`);
    add('<meta property="og:type" content="website" />');
    if (site.name) add(`<meta property="og:site_name" content="${escAttr(site.name)}" />`);
    add(`<meta property="og:title" content="${escAttr(title)}" />`);
    if (desc) add(`<meta property="og:description" content="${escAttr(desc)}" />`);
    if (base) add(`<meta property="og:url" content="${escAttr(base)}" />`);
    if (image) add(`<meta property="og:image" content="${escAttr(image)}" />`);
    add('<meta property="og:locale" content="ko_KR" />');
    add(`<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`);
    add(`<meta name="twitter:title" content="${escAttr(title)}" />`);
    if (desc) add(`<meta name="twitter:description" content="${escAttr(desc)}" />`);
    if (image) add(`<meta name="twitter:image" content="${escAttr(image)}" />`);
    L.push(`  ${END}`);
    return L.join('\n');
  }

  // index.html 의 SEO 구역(없으면 옛 title/description)에서 값을 읽는다
  function parseSeo(html, fallbackBase) {
    const m = (re) => { const r = html.match(re); return r ? unescAttr(r[1]) : ''; };
    const siteUrl = m(/<link\s+rel="canonical"\s+href="([^"]*)"/) || normalizeBase(fallbackBase || '');
    const description = m(/<meta\s+name="description"\s+content="([^"]*)"/);
    let ogImage = m(/<meta\s+property="og:image"\s+content="([^"]*)"/);
    if (ogImage && siteUrl && ogImage.startsWith(siteUrl)) ogImage = ogImage.slice(siteUrl.length);   // 같은 사이트면 경로만
    return { siteUrl, description, ogImage };
  }

  // 현재 SEO 구역의 글자(주석 포함) 그대로. 없으면 ''.
  function currentBlock(html) {
    const a = html.indexOf(MARK_START);
    const b = html.indexOf(END);
    if (a < 0 || b < a) return '';
    const lineStart = html.lastIndexOf('\n', a) + 1;
    return html.slice(lineStart, b + END.length);
  }

  // index.html 에서 SEO 구역만 새 조각으로 바꾼다. (구역이 없으면 옛 <title>·description 을 지우고 새로 넣는다.)
  function replaceSeoBlock(html, block) {
    const cur = currentBlock(html);
    if (cur) return html.replace(cur, () => block);
    // 지울 줄의 앞 공백과 줄바꿈 하나만 지운다 (다음 줄의 들여쓰기를 먹지 않도록 \s* 는 쓰지 않아요)
    let out = html.replace(/[ \t]*<title>[\s\S]*?<\/title>[ \t]*\r?\n?/, '').replace(/[ \t]*<meta\s+name="description"[^>]*>[ \t]*\r?\n?/, '');
    const anchor = out.search(/[ \t]*<link\s+rel="stylesheet"/);
    if (anchor >= 0) return `${out.slice(0, anchor)}${block}\n${out.slice(anchor)}`;
    const head = out.indexOf('</head>');
    return head >= 0 ? `${out.slice(0, head)}${block}\n${out.slice(head)}` : `${out}\n${block}\n`;
  }

  const api = { buildSeoBlock, parseSeo, currentBlock, replaceSeoBlock, pageTitle, normalizeBase, absoluteUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;   // Node (시험·초기 생성용)
  else root.SEO = api;                                                           // 브라우저 (관리 페이지)
})(typeof window !== 'undefined' ? window : globalThis);
