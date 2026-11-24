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
      const st = await sp.locator('#filter-status').textContent();
      const vis = await sp.locator('.card:not([hidden])').count();
      check('A11Y filter announces result count (live region)', new RegExp(`영상 ${vis}개$`).test(st) && (await sp.locator('#filter-status').getAttribute('aria-live')) === 'polite', st);
      await btns.nth(0).click();
      check('A11Y "all" filter announced', /^전체 영상 \d+개$/.test(await sp.locator('#filter-status').textContent()));
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
};
