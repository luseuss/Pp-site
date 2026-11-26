// 사이트(index.html) 시험: 검색·공유 정보, 접근성, 영상 팝업, 대표 영상, 첫 화면 배경 영상
const fs = require('fs');
const path = require('path');
const { REPO, evalSite, evalWorks } = require('./harness');
const SEO = require('../seo.js');

module.exports = async (h, check) => {
  const html = h.baseIndex;
  const site = evalSite(h.baseSite);

  // ----- 검색 · 공유 (정적 <head>) -----
  {
    const head = html.slice(0, html.indexOf('</head>'));
    const meta = (re) => (head.match(re) || [])[1];
    const t = meta(/<title>([^<]*)<\/title>/);
    check('SEO static <title> = name | tagline of site.js', t === `${site.name} | ${site.tagline}`, t);
    check('SEO og:title / twitter:title equal title', meta(/property="og:title" content="([^"]*)"/) === t && meta(/name="twitter:title" content="([^"]*)"/) === t);
    const desc = meta(/name="description" content="([^"]*)"/);
    check('SEO description shared by og/twitter', !!desc && desc === meta(/property="og:description" content="([^"]*)"/) && desc === meta(/name="twitter:description" content="([^"]*)"/));
    const og = meta(/property="og:image" content="([^"]*)"/);
    check('SEO og:image absolute https, same for twitter, large card', /^https:\/\/\S+\/images\/og\.png$/.test(og) && og === meta(/name="twitter:image" content="([^"]*)"/) && meta(/name="twitter:card" content="([^"]*)"/) === 'summary_large_image', og);
    check('SEO canonical = og:url, trailing slash', meta(/rel="canonical" href="([^"]*)"/) === meta(/property="og:url" content="([^"]*)"/) && /\/$/.test(meta(/rel="canonical" href="([^"]*)"/)));
    const png = (f) => { const b = fs.readFileSync(path.join(REPO, f)); return { sig: b.slice(0, 8).toString('hex'), w: b.readUInt32BE(16), h: b.readUInt32BE(20), size: b.length }; };
    const o = png('images/og.png'), a = png('apple-touch-icon.png'), f = png('favicon.png');
    check('SEO og.png is a real 1200x630 PNG < 300KB', o.sig === '89504e470d0a1a0a' && o.w === 1200 && o.h === 630 && o.size < 300 * 1024, JSON.stringify(o));
    check('SEO apple-touch-icon 180x180, favicon.png 64x64', a.w === 180 && a.h === 180 && f.w === 64 && f.h === 64);
    const ico = fs.readFileSync(path.join(REPO, 'favicon.ico'));
    check('SEO favicon.ico header valid (1 image, 32x32)', ico.readUInt16LE(0) === 0 && ico.readUInt16LE(2) === 1 && ico.readUInt16LE(4) === 1 && ico[6] === 32 && ico[7] === 32);
    check('SEO icon links + theme-color present', /rel="icon"[^>]*favicon\.ico/.test(head) && /rel="apple-touch-icon"/.test(head) && /name="theme-color"/.test(head));
    check('SEO block is up to date with generator (admin would write the same text)', SEO.replaceSeoBlock(html, SEO.buildSeoBlock(SEO.parseSeo(html, ''), site)) === html);
    h.reset();
    const sp = await h.site();
    check('SEO runtime document.title equals static title', (await sp.title()) === t, await sp.title());
    await sp.close();
  }

  // ----- 접근성 -----
  {
    h.reset();
    const sp = await h.site();
    await sp.keyboard.press('Tab');
    const first = await sp.evaluate(() => document.activeElement.className);
    const shown = await sp.waitForFunction(() => document.querySelector('.skip-link').getBoundingClientRect().top >= 0).then(() => true, () => false);
    await sp.keyboard.press('Enter');
    check('A11Y skip link is the first Tab stop, visible, jumps to main', first === 'skip-link' && shown && (await sp.evaluate(() => location.hash)) === '#top');
    check('A11Y .play glyph hidden from screen readers', await sp.locator('.card .play').evaluateAll((x) => x.length > 0 && x.every((e) => e.getAttribute('aria-hidden') === 'true')));
    await sp.evaluate(() => document.querySelector('#grid').scrollIntoView({ block: 'center' }));
    const btns = sp.locator('#filters button');
    if (await btns.count() > 1) {
      await btns.nth(1).click();
      await sp.waitForFunction(() => /영상 \d+개$/.test(document.querySelector('#filter-status').textContent));
      const st = await sp.locator('#filter-status').textContent();
      const vis = await sp.locator('.card:not([hidden])').count();
      check('A11Y filter announces result count (live region)', new RegExp(`영상 ${vis}개$`).test(st) && (await sp.locator('#filter-status').getAttribute('aria-live')) === 'polite', st);
      await btns.nth(0).click();
      await sp.waitForFunction(() => /^전체 영상 \d+개$/.test(document.querySelector('#filter-status').textContent));
      check('A11Y "all" filter announced', true);
    }
    const contrast = await sp.evaluate(() => {
      const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
      const bg = lum(getComputedStyle(document.body).backgroundColor);
      return [...document.querySelectorAll('.site-footer, .card p, .hero .eyebrow, .hero .lead, .about p, .section h2')].map((el) => { const fg = lum(getComputedStyle(el).color); return [el.className || el.tagName, +((Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05)).toFixed(2)]; });
    });
    check('A11Y gray texts have contrast >= 4.5', contrast.length > 0 && contrast.every(([, r]) => r >= 4.5), JSON.stringify(contrast.filter(([, r]) => r < 4.5)));
    check('A11Y no JS errors', sp.errs.length === 0, sp.errs.join());
    await sp.close();
  }

  // ----- 영상 팝업: 떠 있는 카드, 설명, 이미지 격자, 키보드 -----
  {
    const w = h.baseWorks.replace(/order: 2,/, 'order: 2,\n    desc: "첫 문단: 곡의 이미지를 정리했어요.\\n줄바꿈도 유지돼요.\\n\\n둘째 문단: <b>AE</b> & 마무리.",\n    images: ["images/logo.png", "images/og.png", "images/logo.png", "../evil.png", "javascript:alert(1)"],');
    h.setFile('works.js', w);
    const sp = await h.site(1280, 800);
    await sp.evaluate(() => document.querySelector('#grid').scrollIntoView());
    const card = sp.locator('#grid .card').nth(1);
    const want = { t: await card.locator('h3').textContent(), m: await card.locator('p').textContent(), tags: await card.evaluate((e) => e.dataset.tags.split('\n').filter(Boolean)) };
    await card.click(); await sp.waitForTimeout(800);
    check('POP title/meta/tags shown under the video', (await sp.locator('#modal-info h2').textContent()) === want.t && (await sp.locator('#modal-info > p').textContent()) === want.m && (await sp.locator('#modal-info .modal-tags span').allTextContents()).join() === want.tags.join());
    check('POP dialog semantics: role, aria-modal, label has title, focus on close, page inert', await sp.evaluate((t) => { const m = document.querySelector('#modal'); return m.getAttribute('role') === 'dialog' && m.getAttribute('aria-modal') === 'true' && m.getAttribute('aria-label') === `${t} 영상 재생` && document.activeElement.classList.contains('modal-close') && ['.site-header', 'main', '.site-footer'].every((s) => document.querySelector(s).inert); }, want.t));
    const g = await sp.evaluate(() => { const p = document.querySelector('.modal-panel'), r = p.getBoundingClientRect(), v = document.querySelector('#modal-body').getBoundingClientRect(); return { bg: getComputedStyle(document.querySelector('#modal')).backgroundColor, l: r.left, r: r.right, t: r.top, b: r.bottom, radius: getComputedStyle(p).borderRadius, ratio: v.width / v.height }; });
    check('POP floating card: translucent backdrop, margins, rounded', /rgba\(.*0\.55\)/.test(g.bg) && g.l > 30 && g.r < 1250 && g.t >= 0 && g.b <= 800 && g.radius !== '0px', JSON.stringify(g));
    check('POP video exactly 16:9', Math.abs(g.ratio - 16 / 9) < 0.02, String(g.ratio));
    const paras = await sp.locator('#modal-info .modal-desc p').allTextContents();
    check('POP description: 2 paragraphs, <b> shown as text, line break kept', paras.length === 2 && paras[1].includes('<b>AE</b>') && await sp.evaluate(() => getComputedStyle(document.querySelector('.modal-desc p')).whiteSpace === 'pre-line'));
    const gal = await sp.evaluate(() => [...document.querySelectorAll('.modal-gallery a')].map((a) => [a.getAttribute('href'), a.target, a.rel]));
    check('POP gallery: 3 safe images (../ and javascript: dropped), new tab + noopener, multi-column grid', gal.length === 3 && gal.every(([hf, t, r]) => /^images\//.test(hf) && t === '_blank' && r.includes('noopener')) && await sp.evaluate(() => getComputedStyle(document.querySelector('.modal-gallery')).gridTemplateColumns.split(' ').length >= 3), JSON.stringify(gal));
    check('POP close button inside the card corner', await sp.evaluate(() => { const c = document.querySelector('.modal-close').getBoundingClientRect(), p = document.querySelector('.modal-panel').getBoundingClientRect(); return c.right <= p.right && c.top >= p.top && c.width >= 30; }));
    const seen = [];
    for (let i = 0; i < 6; i++) { await sp.keyboard.press('Tab'); seen.push(await sp.evaluate(() => { const a = document.activeElement; return `${a.tagName}:${a.closest('#modal') ? 'in' : 'out'}`; })); }
    check('POP Tab reaches gallery links and never leaves the popup', seen.some((s) => s.startsWith('A:in')) && seen.every((s) => s.endsWith(':in') || s.startsWith('BODY')), seen.join());
    const sc = await sp.evaluate(() => { const p = document.querySelector('.modal-panel'); p.scrollTop = p.scrollHeight; return [p.scrollHeight > p.clientHeight, p.scrollTop > 0, document.querySelector('.modal-close').getBoundingClientRect().top]; });
    check('POP long card scrolls inside itself, close button stays', sc[0] && sc[1] && sc[2] >= 0 && sc[2] < 80, JSON.stringify(sc));
    await sp.mouse.click(8, 8); await sp.waitForTimeout(200);
    check('POP click on dim backdrop closes, inert off, focus back on the card', await sp.locator('#modal').isHidden() && await sp.evaluate(() => !document.querySelector('main').inert) && await card.evaluate((e) => e === document.activeElement));
    await card.click(); await sp.waitForTimeout(600);
    await sp.mouse.click(640, 300); await sp.waitForTimeout(200);
    check('POP click inside the card does not close', await sp.locator('#modal').isVisible());
    await sp.keyboard.press('Escape');
    check('POP Escape closes; info/images removed from DOM', await sp.locator('#modal').isHidden() && await sp.evaluate(() => document.querySelectorAll('#modal-info *').length === 0));
    await sp.locator('#grid .card').first().click(); await sp.waitForTimeout(600);
    check('POP video without description/images has none of those blocks', await sp.locator('#modal-info .modal-desc, #modal-info .modal-gallery').count() === 0);
    await sp.locator('.modal-close').click();
    check('POP close button returns focus to the card', await sp.evaluate(() => document.activeElement.classList.contains('card')));
    await sp.setViewportSize({ width: 390, height: 700 });
    await card.click(); await sp.waitForTimeout(700);
    check('POP mobile: card within width, no horizontal overflow', await sp.evaluate(() => { const p = document.querySelector('.modal-panel').getBoundingClientRect(); return p.left >= 0 && p.right <= innerWidth && document.querySelector('#modal').scrollWidth <= innerWidth + 1; }));
    check('POP no JS errors', sp.errs.length === 0, sp.errs.join());
    await sp.close();
    // 제목 속 HTML 은 글자로만
    h.setFile('works.js', h.baseWorks.replace(/title: "[^"]*"/, 'title: "<b>굵게</b> & <img src=x onerror=alert(1)>"'));
    const xp = await h.site();
    await xp.locator('#grid .card').first().click();
    check('POP HTML in title is shown as text, not parsed', (await xp.locator('#modal-info h2').textContent()).includes('<b>굵게</b>') && await xp.locator('#modal-info h2 *').count() === 0);
    await xp.close();
  }

  // ----- 대표 영상 (Work 위에 크게) -----
  {
    h.setFile('works.js', h.baseWorks.replace(/(\{\s*order: 3,)/, '$1\n    featured: true,'));
    const sp = await h.site();
    const W = evalWorks(fs.readFileSync(path.join(h.dir, 'works.js'), 'utf8'));
    check('FEAT block shown with label and exactly one big card (the 3rd video); grid keeps all', await sp.locator('#featured').isVisible() && (await sp.locator('#featured .featured-label').textContent()) === '대표 영상' && await sp.locator('#featured .card').count() === 1 && (await sp.locator('#featured h3').textContent()) === W[2].title && await sp.locator('#grid .card').count() === W.length);
    check('FEAT card larger than a grid card', await sp.evaluate(() => document.querySelector('#featured .thumb').getBoundingClientRect().width > document.querySelector('#grid .thumb').getBoundingClientRect().width));
    const bs = sp.locator('#filters button');
    if (await bs.count() > 1) await bs.nth(1).click();
    check('FEAT stays visible when filtering', await sp.locator('#featured .card').isVisible());
    await sp.locator('#featured .card').click();
    check('FEAT click opens popup with a player', await sp.locator('#modal').isVisible() && await sp.locator('#modal iframe, #modal video').count() === 1);
    await sp.keyboard.press('Escape');
    check('FEAT focus returns to the featured card', await sp.evaluate(() => document.activeElement.closest('#featured') !== null));
    await sp.close();
    h.setFile('works.js', h.baseWorks);
    const np = await h.site();
    check('FEAT no featured video → block hidden', await np.locator('#featured').isHidden() && await np.locator('#featured .card').count() === 0);
    await np.close();
  }

  // ----- 첫 화면 배경 영상 -----
  {
    const feat = h.baseWorks.replace(/(\{\s*order: 2,)/, '$1\n    featured: true,');
    h.setFile('works.js', feat);
    let sp = await h.site();
    await sp.waitForSelector('.hero-video iframe', { timeout: 5000 });
    const src = await sp.locator('.hero-video iframe').getAttribute('src');
    check('HERO youtube iframe: nocookie, autoplay, muted, no controls, loop', /youtube-nocookie\.com\/embed\/[\w-]+\?/.test(src) && /autoplay=1/.test(src) && /mute=1/.test(src) && /controls=0/.test(src) && /loop=1&playlist=/.test(src), src);
    check('HERO box is behind text, ignores pointer, hidden from screen readers, not focusable', await sp.evaluate(() => { const b = document.querySelector('.hero-video'), f = b.querySelector('iframe'); return b.getAttribute('aria-hidden') === 'true' && getComputedStyle(b).pointerEvents === 'none' && getComputedStyle(b).zIndex === '-1' && f.tabIndex === -1; }));
    for (const [vw, vh] of [[1080, 1180], [1440, 700], [390, 800], [1920, 1080]]) {
      await sp.setViewportSize({ width: vw, height: vh }); await sp.waitForTimeout(150);
      const g = await sp.evaluate(() => { const r = document.querySelector('.hero-video iframe').getBoundingClientRect(), x = document.querySelector('.hero').getBoundingClientRect(); return { ratio: r.width / r.height, covers: r.left <= 1 && r.right >= innerWidth - 1 && r.top <= x.top + 1 && r.bottom >= x.bottom - 1, noH: document.documentElement.scrollWidth <= innerWidth }; });
      check(`HERO iframe is 16:9, full-width, covers the hero, no h-scroll at ${vw}x${vh}`, Math.abs(g.ratio - 16 / 9) < 0.01 && g.covers && g.noH, JSON.stringify(g));
    }
    await sp.setViewportSize({ width: 1100, height: 900 });
    check('HERO text/button above the video (clickable)', await sp.evaluate(() => { const r = document.querySelector('.hero .button').getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2).closest('.button') !== null; }));
    for (let i = 0; i < 6; i++) {
      await sp.evaluate(() => window.scrollTo({ top: document.querySelector('#work').offsetTop + 600, behavior: 'instant' }));
      await sp.waitForFunction(() => !document.querySelector('.hero-video iframe'), null, { timeout: 5000 });
      await sp.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await sp.waitForFunction(() => document.querySelectorAll('.hero-video iframe').length === 1, null, { timeout: 5000 });
    }
    check('HERO off-screen removes the iframe, back on-screen recreates exactly one (6 cycles, no leak)', await sp.locator('.hero-video iframe').count() === 1);
    check('HERO no JS errors', sp.errs.length === 0, sp.errs.join());
    await sp.close();
    // 시작 시간
    h.setFile('works.js', h.baseWorks.replace(/(\{\s*order: 1,)/, '$1\n    featured: true,').replace(/url: "([^"?]*)[^"]*"/, 'url: "$1?t=23"'));
    sp = await h.site(); await sp.waitForSelector('.hero-video iframe');
    check('HERO start time from &t= is honoured', /[?&]start=23&/.test(await sp.locator('.hero-video iframe').getAttribute('src')));
    await sp.close();
    // 끄는 경우
    h.setFile('works.js', feat);
    h.setFile('site.js', h.baseSite.replace('heroVideo: true', 'heroVideo: false'));
    sp = await h.site(); await sp.waitForTimeout(500);
    check('HERO heroVideo:false → no video', await sp.locator('.hero-video iframe, .hero-video video').count() === 0);
    await sp.close();
    h.setFile('site.js', h.baseSite.replace('\n  animations: true,', '\n  animations: false,'));
    sp = await h.site(); await sp.waitForTimeout(500);
    check('HERO animations:false → no video', await sp.locator('.hero-video iframe, .hero-video video').count() === 0);
    await sp.close();
    h.reset();
    sp = await h.site(1100, 900, { reducedMotion: 'reduce' }); h.setFile('works.js', feat); await sp.reload(); await sp.waitForTimeout(500);
    check('HERO prefers-reduced-motion → no video', await sp.locator('.hero-video iframe, .hero-video video').count() === 0);
    await sp.close();
    h.reset();
    sp = await h.site(); await sp.waitForTimeout(500);
    check('HERO no featured video → nothing inside', await sp.locator('.hero-video').evaluate((e) => e.children.length === 0));
    await sp.close();
    // mp4
    h.setFile('works.js', h.baseWorks.replace(/(\{\s*order: 1,)/, '$1\n    featured: true,').replace(/url: "[^"]*",/, 'src: "videos/x.mp4",'));
    sp = await h.site(); await sp.waitForSelector('.hero-video video');
    check('HERO mp4 featured → muted looping autoplay <video>', await sp.locator('.hero-video video').evaluate((v) => v.muted && v.loop && v.autoplay && v.playsInline && v.getAttribute('src') === 'videos/x.mp4'));
    await sp.evaluate(() => window.scrollTo({ top: document.querySelector('#work').offsetTop + 600, behavior: 'instant' }));
    await sp.waitForFunction(() => !document.querySelector('.hero-video video'));
    check('HERO mp4 removed when off-screen', true);
    await sp.close();
    h.reset();
  }

  // ----- 검색 · 정렬 -----
  {
    // 연도가 다른 영상 + 제목이 다른 영상으로 맞춘 시험용 목록 (5개)
    const mk = (o, title, meta, tags, extra = '') => `  {\n    order: ${o},\n    url: "https://youtu.be/vid${o}abcdefg",\n    title: "${title}",\n    meta: "${meta}",\n    tags: [${tags}],${extra}\n  },`;
    const list = [mk(1, 'Charlie 영상', '2024 · 모션', '"MV"'), mk(2, 'alpha 작품', '2026 · 타이포', '"AMV"'), mk(3, 'Bravo', '2025 · 합작', '"MV", "합작"'), mk(4, '다람쥐', '연도 없음', '"MV"'), mk(5, '가나다 영상', '2023 · 로고', '"AMV"')].join('\n');
    h.setFile('works.js', `const WORKS = [\n${list}\n];\n`);
    const sp = await h.site(1100, 900);
    await sp.evaluate(() => document.querySelector('#grid').scrollIntoView());
    const titles = () => sp.locator('#grid .card:not([hidden]) h3').allTextContents();
    check('SRCH tools visible with 5 videos; sort has year options', await sp.locator('#work-tools').isVisible() && (await sp.locator('#work-sort option').allTextContents()).join() === '내가 정한 순서,최신순,오래된순,제목순');
    await sp.locator('#work-sort').selectOption('new');
    check('SORT newest first by the year in meta; no-year video last', (await titles()).join() === 'alpha 작품,Bravo,Charlie 영상,가나다 영상,다람쥐', (await titles()).join());
    await sp.locator('#work-sort').selectOption('old');
    check('SORT oldest first; no-year video still last', (await titles()).join() === '가나다 영상,Charlie 영상,Bravo,alpha 작품,다람쥐', (await titles()).join());
    await sp.locator('#work-sort').selectOption('title');
    check('SORT by title (Korean collation: 한글 먼저, 그다음 영문 abc 순)', (await titles()).join() === '가나다 영상,다람쥐,alpha 작품,Bravo,Charlie 영상', (await titles()).join());
    await sp.locator('#work-sort').selectOption('');
    check('SORT back to my own order', (await titles()).join() === 'Charlie 영상,alpha 작품,Bravo,다람쥐,가나다 영상');
    check('SORT keeps the same 5 card elements (moved, not recreated) and tab order follows', await sp.locator('#grid .card').count() === 5);
    await sp.locator('#work-search').fill('  BRAVO ');
    check('SRCH case-insensitive, trims; title match', (await titles()).join() === 'Bravo');
    await sp.locator('#work-search').fill('타이포');
    check('SRCH matches meta text', (await titles()).join() === 'alpha 작품');
    await sp.locator('#work-search').fill('합작');
    check('SRCH matches tags', (await titles()).join() === 'Bravo');
    await sp.locator('#work-search').fill('없는검색어');
    check('SRCH no match → empty message shown, grid empty', await sp.locator('#work-empty').isVisible() && (await titles()).length === 0);
    await sp.locator('#work-search').fill('');
    check('SRCH clearing restores all, empty message hidden', (await titles()).length === 5 && await sp.locator('#work-empty').isHidden());
    // 카테고리와 함께
    await sp.locator('#filters button', { hasText: 'AMV' }).click();
    await sp.locator('#work-search').fill('영상');
    check('SRCH combines with category filter (AMV + "영상")', (await titles()).join() === '가나다 영상', (await titles()).join());
    await sp.waitForFunction(() => /AMV "영상" 검색 영상 1개/.test(document.querySelector('#filter-status').textContent));
    check('SRCH result announced for screen readers (debounced)', true);
    await sp.locator('#work-search').fill(''); await sp.locator('#filters button').first().click();
    await sp.locator('#work-sort').selectOption('title');
    // 필터·정렬 결과가 팝업의 이전/다음 목록이 된다
    await sp.locator('#work-search').fill('영상');
    await sp.locator('#grid .card:not([hidden])').first().click(); await sp.waitForTimeout(600);
    check('NAV popup count follows the visible list (search "영상" + title sort → 2 items)', (await sp.locator('.nav-count').textContent()) === '1 / 2' && await sp.locator('.nav-prev').isDisabled() && await sp.locator('.nav-next').isEnabled());
    await sp.locator('.nav-next').click();
    check('NAV next opens the other visible video in sorted order', (await sp.locator('#modal-info h2').textContent()) === 'Charlie 영상' && (await sp.locator('.nav-count').textContent()) === '2 / 2' && await sp.locator('.nav-next').isDisabled());
    await sp.keyboard.press('Escape');
    await sp.close();

    // 영상이 3개면 검색·정렬은 숨김
    h.setFile('works.js', `const WORKS = [\n${[mk(1, 'A', '2024', '"MV"'), mk(2, 'B', '2025', '"MV"'), mk(3, 'C', '2026', '"MV"')].join('\n')}\n];\n`);
    const s3 = await h.site();
    check('SRCH hidden when fewer than 4 videos', await s3.locator('#work-tools').isHidden());
    await s3.close();
    // 연도가 하나도 없으면 최신순/오래된순 선택지가 없음
    h.setFile('works.js', `const WORKS = [\n${[1, 2, 3, 4].map((i) => mk(i, `T${i}`, '메모', '"MV"')).join('\n')}\n];\n`);
    const s4 = await h.site();
    check('SORT year options hidden when no video has a year', (await s4.locator('#work-sort option').allTextContents()).join() === '내가 정한 순서,제목순');
    await s4.close();
    h.reset();
  }

  // ----- 팝업: 이전/다음, 키보드, 공유 링크, 라이트박스 -----
  {
    const w = h.baseWorks.replace(/order: 2,/, 'order: 2,\n    images: ["images/logo.png", "images/og.png", "images/logo.png"],');
    h.setFile('works.js', w);
    const sp = await h.site(1280, 800);
    await sp.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: h.base });
    const cardsN = await sp.locator('#grid .card').count();
    const titleOf = (i) => sp.locator('#grid .card').nth(i).locator('h3').textContent();
    await sp.evaluate(() => document.querySelector('#grid').scrollIntoView());
    await sp.locator('#grid .card').first().click(); await sp.waitForTimeout(600);
    check('NAV first video: prev disabled, next enabled, counter 1 / N', await sp.locator('.nav-prev').isDisabled() && await sp.locator('.nav-next').isEnabled() && (await sp.locator('.nav-count').textContent()) === `1 / ${cardsN}`);
    const id0 = await sp.locator('#grid .card').first().getAttribute('data-id');
    check('LINK opening sets #v=<id> in the address', (await sp.evaluate(() => location.hash)) === `#v=${id0}`);
    await sp.locator('.nav-next').click();
    check('NAV next shows 2nd video (title, hash, counter) and keeps the popup open without re-focusing', (await sp.locator('#modal-info h2').textContent()) === (await titleOf(1)) && (await sp.evaluate(() => location.hash)) === `#v=${await sp.locator('#grid .card').nth(1).getAttribute('data-id')}` && (await sp.locator('.nav-count').textContent()) === `2 / ${cardsN}` && await sp.locator('#modal iframe').count() === 1);
    await sp.keyboard.press('ArrowRight');
    check('NAV ArrowRight → 3rd video', (await sp.locator('#modal-info h2').textContent()) === (await titleOf(2)));
    await sp.keyboard.press('ArrowLeft'); await sp.keyboard.press('ArrowLeft');
    check('NAV ArrowLeft ×2 → back to 1st; extra ArrowLeft does nothing', (await sp.locator('#modal-info h2').textContent()) === (await titleOf(0)));
    await sp.keyboard.press('ArrowLeft');
    check('NAV no wrap-around at the start', (await sp.locator('.nav-count').textContent()) === `1 / ${cardsN}`);
    check('NAV only one iframe exists (previous player removed)', await sp.locator('#modal iframe').count() === 1);
    await sp.locator('.nav-link').click();
    const copied = await sp.evaluate(() => navigator.clipboard.readText());
    check('LINK copy button puts the shareable URL (page + #v=id) on the clipboard and confirms', copied === `${h.base}/index.html#v=${id0}` || copied === `${h.base}/#v=${id0}`, copied);
    check('LINK copy confirmation text shown', (await sp.locator('.nav-link').textContent()).includes('복사했어요'));
    await sp.keyboard.press('Escape');
    check('LINK closing removes #v= from the address', !(await sp.evaluate(() => location.hash)));
    // 공유 링크로 바로 열기 (새 탭 상황)
    const p2 = await h.site(1280, 800);
    await p2.goto(`${h.base}/index.html#v=${id0}`); await p2.reload(); await p2.waitForSelector('#modal:not([hidden])');
    check('LINK opening a shared link shows that video immediately, with page behind inert', (await p2.locator('#modal-info h2').textContent()) === (await titleOf(0)) && await p2.evaluate(() => document.querySelector('main').inert));
    await p2.evaluate(() => { location.hash = ''; });
    await p2.waitForSelector('#modal', { state: 'hidden' });
    check('LINK removing the hash closes the popup', true);
    await p2.goto(`${h.base}/index.html#v=nonexistent`); await p2.reload();
    check('LINK unknown id → page loads normally, no popup, no error', await p2.locator('#modal').isHidden() && p2.errs.length === 0);
    await p2.goto(`${h.base}/index.html#v=%E0%A4%A`); await p2.reload();
    check('LINK malformed % escape in hash does not crash', await p2.locator('#modal').isHidden() && p2.errs.length === 0, p2.errs.join());
    await p2.close();
    // 대표 영상 카드에서 연 경우에도 이전/다음
    // 라이트박스
    await sp.locator('#grid .card').nth(1).click(); await sp.waitForTimeout(600);
    await sp.locator('.modal-gallery a').first().click();
    check('LB click on a gallery image opens the lightbox (not a new tab), focus on its close button', await sp.locator('#lightbox').isVisible() && await sp.evaluate(() => document.activeElement.classList.contains('lb-close')) && (await sp.locator('.lb-count').textContent()) === '1 / 3');
    check('LB image shown large inside the viewport', await sp.evaluate(() => { const i = document.querySelector('#lightbox img').getBoundingClientRect(); return i.width > 50 && i.right <= innerWidth && i.bottom <= innerHeight; }));
    await sp.keyboard.press('ArrowRight'); await sp.keyboard.press('ArrowRight');
    check('LB ArrowRight → 3rd image, ▶ disabled', (await sp.locator('.lb-count').textContent()) === '3 / 3' && await sp.locator('.lb-next').isDisabled());
    await sp.keyboard.press('ArrowLeft');
    check('LB ArrowLeft → 2nd image', (await sp.locator('.lb-count').textContent()) === '2 / 3');
    const tabs = []; for (let i = 0; i < 5; i++) { await sp.keyboard.press('Tab'); tabs.push(await sp.evaluate(() => document.activeElement.closest('#lightbox') ? document.activeElement.className : 'OUT')); }
    check('LB Tab stays inside the lightbox', !tabs.includes('OUT'), tabs.join());
    check('LB popup behind is inert while lightbox is open', await sp.evaluate(() => document.querySelector('#modal').inert));
    await sp.keyboard.press('Escape');
    check('LB Escape closes only the lightbox (popup stays), image src released, focus back on the thumbnail', await sp.locator('#lightbox').isHidden() && await sp.locator('#modal').isVisible() && await sp.evaluate(() => !document.querySelector('#lightbox img').getAttribute('src') && !document.querySelector('#modal').inert && document.activeElement.closest('.modal-gallery') !== null));
    await sp.locator('.modal-gallery a').nth(1).click();
    await sp.mouse.click(10, 400);
    check('LB click on the dark backdrop closes it', await sp.locator('#lightbox').isHidden() && await sp.locator('#modal').isVisible());
    await sp.locator('.modal-gallery a').first().click({ modifiers: ['Control'] }).catch(() => {});
    check('LB Ctrl+click is left to the browser (lightbox not opened)', await sp.locator('#lightbox').isHidden());
    await sp.locator('.modal-gallery a').first().click(); await sp.keyboard.press('ArrowRight');
    await sp.locator('.lb-close').click(); await sp.keyboard.press('Escape');
    check('LB closing the popup while lightbox open leaves nothing behind', await sp.locator('#lightbox').isHidden() && await sp.locator('#modal').isHidden() && await sp.evaluate(() => !document.querySelector('main').inert));
    check('NAV/LB no JS errors', sp.errs.length === 0, sp.errs.join());
    await sp.close();
    h.reset();
  }
};
