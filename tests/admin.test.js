// 관리 페이지(admin.html) 시험: 가짜 GitHub 로 저장 내용을 확인해요
const fs = require('fs');
const path = require('path');
const { REPO, evalWorks, evalSite, token, saved, msgOf } = require('./harness');
const SEO = require('../seo.js');

module.exports = async (h, check) => {
  // ----- 검색 · 공유 -----
  {
    h.reset();
    let { p, puts, files, ctx } = await h.admin();
    await p.locator('#tab-site').click();
    const v0 = await Promise.all(['#f-seo-url', '#f-seo-desc', '#f-seo-image'].map((s) => p.locator(s).inputValue()));
    const want = SEO.parseSeo(h.baseIndex, '');
    check('ADM-SEO loads values from index.html', v0[0] === want.siteUrl && v0[1] === want.description && v0[2] === 'images/og.png', JSON.stringify(v0));
    check('ADM-SEO clean state, preview card shows title/description, char counter', (await p.locator('#dirty').textContent()) === '변경 없음' && (await p.locator('#share-preview').textContent()).includes(want.description) && (await p.locator('#seo-count').textContent()) === `${want.description.length}자`);
    await token(p);
    const tricky = '새 설명 "따옴표" & <태그> $& $1 끝';
    await p.locator('#f-seo-desc').fill(tricky);
    check('ADM-SEO editing marks site dirty and updates the preview', (await p.locator('#dirty').textContent()).includes('사이트 정보') && (await p.locator('#share-preview span').textContent()) === tricky);
    await p.locator('#save').click(); await saved(p);
    const rest = (s) => s.replace(SEO.currentBlock(s), '');
    check('ADM-SEO only index.html saved (site.js unchanged → no PUT), rest of file untouched, text escaped round trip', puts.length === 1 && puts[0].file === 'index.html' && SEO.parseSeo(puts[0].text, '').description === tricky && rest(puts[0].text) === rest(h.baseIndex), puts.map((x) => x.file).join());
    await p.locator('#save').click();
    check('ADM-SEO saving again with no change → no extra PUT', puts.length === 1 && (await msgOf(p)).includes('저장할 변경이 없어요'));
    await p.locator('#f-seo-url').fill('maru2.pages.dev'); await p.locator('#save').click();
    check('ADM-SEO invalid site URL blocked', (await msgOf(p)).includes('https://') && puts.length === 1);
    await p.locator('#f-seo-url').fill('https://example.com/me'); await p.locator('#f-seo-image').fill('../x.png'); await p.locator('#save').click();
    check('ADM-SEO unsafe image path blocked', (await msgOf(p)).includes('공유 미리보기 이미지') && puts.length === 1);
    await p.locator('#f-seo-image').fill('images/og.png'); await p.locator('#f-seo-desc').fill('가'.repeat(301)); await p.locator('#save').click();
    check('ADM-SEO too long description blocked', (await msgOf(p)).includes('너무 길어요') && puts.length === 1);
    await p.locator('#f-seo-desc').fill('짧은 설명'); await p.locator('#clr-seo').click(); await p.locator('#save').click(); await saved(p);
    const t2 = puts[1].text;
    check('ADM-SEO URL normalised (trailing slash); no image → no og:image, summary card', t2.includes('rel="canonical" href="https://example.com/me/"') && !t2.includes('og:image') && t2.includes('twitter:card" content="summary"'));
    const png = fs.readFileSync(path.join(REPO, 'images/og.png'));
    await p.locator('#file-seo').setInputFiles({ name: 'My Share.PNG', mimeType: 'image/png', buffer: png });
    await p.waitForFunction(() => /공유 이미지를 준비/.test(document.querySelector('#msg').textContent));
    const ip = await p.locator('#f-seo-image').inputValue();
    await p.locator('#save').click(); await saved(p);
    const k = puts.length;
    check('ADM-SEO upload: image PUT first, then index.html with absolute og:image on the new address', /^images\/my-share-[a-z0-9]+\.png$/.test(ip) && puts[k - 2].file === ip && puts[k - 1].file === 'index.html' && puts[k - 1].text.includes(`og:image" content="https://example.com/me/${ip}"`));
    await p.locator('#f-name').fill('새이름'); await p.locator('#save').click(); await saved(p);
    check('ADM-SEO name change updates the title in index.html and site.js', puts.slice(k).some((x) => x.file === 'site.js') && puts[puts.length - 1].file === 'index.html' && puts[puts.length - 1].text.includes('<title>새이름 | 영상 편집 포트폴리오</title>'));
    await p.locator('#copy').click();
    const code = await p.locator('#code-seo').inputValue();
    check('ADM-SEO code view contains the SEO block', code.startsWith('  <!-- SEO:START') && code.trimEnd().endsWith('<!-- SEO:END -->'));
    check('ADM-SEO no JS errors', p.errs.length === 0, p.errs.join());
    await ctx.close();
    // 옛 index.html
    const legacy = h.baseIndex.replace(SEO.currentBlock(h.baseIndex), '  <title>MaRu_2 | 영상 편집 포트폴리오</title>\n  <meta name="description" content="옛 설명" />');
    ({ p, puts, files, ctx } = await h.admin({ index: legacy }));
    await p.locator('#tab-site').click();
    check('ADM-SEO legacy index: reads old description, default image, fallback base URL', (await p.locator('#f-seo-desc').inputValue()) === '옛 설명' && (await p.locator('#f-seo-image').inputValue()) === 'images/og.png' && /^https?:\/\//.test(await p.locator('#f-seo-url').inputValue()));
    await token(p); await p.locator('#f-seo-desc').fill('새 설명'); await p.locator('#save').click(); await saved(p);
    check('ADM-SEO legacy index: block created, no duplicate title/description', puts.length === 1 && (puts[0].text.match(/<title>/g) || []).length === 1 && (puts[0].text.match(/name="description"/g) || []).length === 1 && !puts[0].text.includes('옛 설명'));
    await ctx.close();
    // 외부 수정 보존
    ({ p, puts, files, ctx } = await h.admin());
    await token(p); await p.locator('#tab-site').click();
    files['index.html'] = { text: h.baseIndex.replace('</body>', '<!-- 외부 수정 --></body>'), sha: 'i2' };
    await p.locator('#f-seo-desc').fill('충돌 시험'); await p.locator('#save').click(); await saved(p);
    check('ADM-SEO external edit to index.html preserved (only the block replaced)', puts.length === 1 && puts[0].text.includes('<!-- 외부 수정 -->') && puts[0].text.includes('충돌 시험') && puts[0].body.sha === 'i2');
    await ctx.close();
  }

  // ----- 효과 체크박스 (첫 화면 배경 영상) -----
  {
    let { p, puts, ctx } = await h.admin();
    await p.locator('#tab-site').click();
    check('ADM-FX heroVideo checkbox loaded on, clean', await p.locator('#f-hero-video').isChecked() && (await p.locator('#dirty').textContent()) === '변경 없음');
    await token(p); await p.locator('#f-hero-video').uncheck(); await p.locator('#save').click(); await saved(p);
    const S = evalSite(puts.find((x) => x.file === 'site.js').text);
    check('ADM-FX saves heroVideo:false, other effects untouched', S.heroVideo === false && S.tilt === true && S.heroFade === true && S.animations === true);
    await ctx.close();
    ({ p, puts, ctx } = await h.admin({ site: h.baseSite.replace('  heroVideo: true,\n', '') }));
    await p.locator('#tab-site').click();
    check('ADM-FX legacy site.js (no heroVideo) → on by default, not dirty', await p.locator('#f-hero-video').isChecked() && (await p.locator('#dirty').textContent()) === '변경 없음');
    await token(p); await p.locator('#f-email').fill('q5@maru2.work'); await p.locator('#save').click(); await saved(p);
    check('ADM-FX saving a legacy file writes heroVideo:true', evalSite(puts.find((x) => x.file === 'site.js').text).heroVideo === true);
    await ctx.close();
  }

  // ----- 영상: 대표 영상 / 설명 / 이미지 격자 -----
  {
    let { p, puts, ctx } = await h.admin();
    const n = await p.locator('.item').count();
    check('ADM-WORK featured checkbox per video, none checked initially', await p.locator('.f-featured').count() === n && await p.locator('.f-featured:checked').count() === 0);
    await token(p);
    await p.locator('.f-featured').nth(1).check(); await p.locator('.f-featured').nth(2).check();
    check('ADM-WORK only one featured (last pick wins), marks videos dirty', await p.locator('.f-featured:checked').count() === 1 && await p.locator('.f-featured').nth(2).isChecked() && (await p.locator('#dirty').textContent()).includes('영상'));
    await p.locator('.f-desc').first().fill('  작업 과정 "따옴표"\n\n\n둘째 문단 \\ 역슬래시  ');
    await p.locator('#save').click(); await saved(p);
    let W = evalWorks(puts[puts.length - 1].text);
    check('ADM-WORK saved: exactly one featured:true (3rd), desc cleaned and kept', puts.length === 1 && puts[0].file === 'works.js' && W.filter((w) => w.featured === true).length === 1 && W[2].featured === true && W[0].desc === '작업 과정 "따옴표"\n\n\n둘째 문단 \\ 역슬래시', JSON.stringify(W.map((w) => [w.featured, w.desc])));
    await p.locator('.f-featured').nth(2).uncheck(); await p.locator('.f-desc').first().fill('');
    await p.locator('#save').click(); await p.waitForTimeout(600);
    W = evalWorks(puts[puts.length - 1].text);
    check('ADM-WORK unchecking / emptying removes the featured and desc keys', puts.length === 2 && !/featured|desc:/.test(puts[1].text));
    await ctx.close();

    // 이미지 격자
    const base = h.baseWorks.replace(/order: 2,/, 'order: 2,\n    images: ["images/logo.png", "images/og.png", "images/logo.png", "../evil.png", "javascript:alert(1)"],');
    ({ p, puts, ctx } = await h.admin({ works: base }));
    const row = p.locator('.item').nth(1);
    const order = () => row.locator('.galcell img').evaluateAll((a) => a.map((i) => i.getAttribute('src')));
    check('ADM-GAL grid shows the stored paths as cells, clean state', await row.locator('.galcell').count() === 5 && (await p.locator('#dirty').textContent()) === '변경 없음');
    await token(p);
    await row.locator('.galcell').nth(1).locator('.gr').click();
    const o1 = await order();
    check('ADM-GAL ▶ moves an image back, marks dirty; first ◀ / last ▶ disabled', o1[1] === 'images/logo.png' && o1[2] === 'images/og.png' && (await p.locator('#dirty').textContent()).includes('영상') && await row.locator('.galcell').first().locator('.gl').isDisabled() && await row.locator('.galcell').last().locator('.gr').isDisabled());
    await p.locator('#save').click();
    check('ADM-GAL saving with an unsafe path is blocked with a message', (await msgOf(p)).includes('작업 과정 이미지 경로가 올바르지 않아요') && puts.length === 0, await msgOf(p));
    await row.locator('.galcell').nth(4).locator('.gdel').click(); await row.locator('.galcell').nth(3).locator('.gdel').click();
    check('ADM-GAL delete removes cells', await row.locator('.galcell').count() === 3);
    const png = fs.readFileSync(path.join(REPO, 'images/og.png'));
    await row.locator('.file-gal').setInputFiles([{ name: 'step 1.PNG', mimeType: 'image/png', buffer: png }, { name: 'step2.png', mimeType: 'image/png', buffer: png }]);
    await p.waitForFunction(() => /작업 과정 이미지 2장을 준비/.test(document.querySelector('#msg').textContent));
    const o2 = await order();
    check('ADM-GAL two uploads appended with previews', o2.length === 5 && o2.slice(3).every((s) => /^blob:/.test(s)));
    await row.locator('.galcell').nth(4).locator('.gdel').click();   // 하나는 다시 지움 → 올리지 않아야 함
    await p.locator('#save').click(); await saved(p);
    const img = puts.filter((x) => /^images\/step-1/.test(x.file));
    W = evalWorks(puts[puts.length - 1].text);
    check('ADM-GAL order: exactly 1 image PUT (deleted one never uploaded), then works.js', puts.length === 2 && img.length === 1 && puts[1].file === 'works.js', puts.map((x) => x.file).join());
    check('ADM-GAL images array saved in the new order incl. uploaded path; other videos untouched', JSON.stringify(W[1].images) === JSON.stringify(['images/logo.png', 'images/logo.png', 'images/og.png', img[0].file]) && !('images' in W[0]) && !('images' in W[2]), JSON.stringify(W[1].images));
    for (let i = 0; i < 4; i++) await row.locator('.galcell .gdel').first().click();
    await p.locator('#save').click(); await p.waitForTimeout(600);
    check('ADM-GAL deleting all removes the images key', !('images' in evalWorks(puts[puts.length - 1].text)[1]));
    check('ADM-WORK no JS errors', p.errs.length === 0, p.errs.join());
    await ctx.close();
  }
};
