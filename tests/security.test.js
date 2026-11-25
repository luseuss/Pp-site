// 보안 시험: _headers / <meta> CSP 가 실제로 걸려 있고, 걸린 상태에서도 사이트와 관리 페이지가 정상 동작하는지
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { REPO, parseHeaders, evalWorks, token, saved } = require('./harness');

const csp = (s) => Object.fromEntries(String(s).split(';').map((d) => d.trim()).filter(Boolean).map((d) => { const [k, ...v] = d.split(/\s+/); return [k, v.sort().join(' ')]; }));
// 모든 페이지에서 CSP 위반 이벤트를 모아요
const watch = (page) => page.addInitScript(() => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
});

module.exports = async (h, check) => {
  const rules = parseHeaders(path.join(REPO, '_headers'));
  const headersFor = (p) => Object.assign({}, ...rules.filter(([pat]) => pat === '/*' || pat === p).map(([, hs]) => hs));
  const html = (f) => fs.readFileSync(path.join(REPO, f), 'utf8');
  const metaCsp = (f) => (html(f).match(/http-equiv="Content-Security-Policy" content="([^"]*)"/) || [])[1];

  // ----- 설정 자체 -----
  for (const [p, f] of [['/', 'index.html'], ['/index.html', 'index.html'], ['/admin', 'admin.html'], ['/admin.html', 'admin.html']]) {
    const hs = headersFor(p);
    check(`SEC _headers ${p}: nosniff, no framing, referrer policy, permissions policy, CSP with frame-ancestors none`, hs['x-content-type-options'] === 'nosniff' && hs['x-frame-options'] === 'DENY' && !!hs['referrer-policy'] && /camera=\(\)/.test(hs['permissions-policy'] || '') && /frame-ancestors 'none'/.test(hs['content-security-policy'] || ''), JSON.stringify(hs));
    const header = csp(hs['content-security-policy'] || ''), meta = csp(metaCsp(f) || '');
    delete header['frame-ancestors'];   // meta 에서는 못 쓰는 지시어
    check(`SEC ${f}: <meta> CSP equals the _headers CSP (so GitHub Pages is protected too)`, JSON.stringify(header) === JSON.stringify(meta) && Object.keys(meta).length > 5, `${JSON.stringify(header)} vs ${JSON.stringify(meta)}`);
  }
  const siteCsp = csp(headersFor('/')['content-security-policy']);
  check('SEC site CSP: no unsafe-inline/unsafe-eval for scripts, object-src none, base-uri self', !/unsafe/.test(siteCsp['script-src']) && siteCsp['object-src'] === "'none'" && siteCsp['base-uri'] === "'self'" && siteCsp['connect-src'] === "'self'");
  const adminCsp = csp(headersFor('/admin')['content-security-policy']);
  check('SEC admin CSP: connects only to itself + api.github.com, no framing of others', adminCsp['connect-src'] === "'self' https://api.github.com".split(' ').sort().join(' ') && adminCsp['frame-src'] === "'none'");
  const inline = (html('index.html').match(/<script>([^<]*)<\/script>/) || [])[1];
  const hash = `'sha256-${crypto.createHash('sha256').update(inline || '').digest('base64')}'`;
  check('SEC the one inline script in index.html is allowed by its hash (change it → update the CSP hash)', !!inline && siteCsp['script-src'].includes(hash), hash);
  check('SEC index.html has no other inline script / style attribute', (html('index.html').match(/<script>/g) || []).length === 1 && !/\sstyle=|<style|onclick=|onerror=|onload=/.test(html('index.html')));

  // ----- 헤더가 실제 응답에 붙는지 + CSP 가 진짜로 일하는지 -----
  {
    const sp = await h.browser.newPage();
    const res = await sp.goto(`${h.base}/`);
    const rh = res.headers();
    check('SEC served response carries the CSP and the other headers', /frame-ancestors 'none'/.test(rh['content-security-policy'] || '') && rh['x-frame-options'] === 'DENY' && rh['x-content-type-options'] === 'nosniff');
    await watch(sp); await sp.reload();
    await sp.evaluate(() => { const s = document.createElement('script'); s.textContent = 'window.__pwned = 1'; document.head.appendChild(s); });
    await sp.evaluate(() => { const i = document.createElement('iframe'); i.src = 'https://evil.example/'; document.body.appendChild(i); });
    await sp.evaluate(() => { const i = document.createElement('img'); i.src = 'http://evil.example/x.png'; document.body.appendChild(i); });
    await sp.waitForTimeout(300);
    const v = await sp.evaluate(() => ({ pwned: window.__pwned || 0, csp: window.__csp }));
    check('SEC injected inline script / foreign iframe / http image are blocked by the CSP', v.pwned === 0 && v.csp.some((x) => x.startsWith('script-src')) && v.csp.some((x) => x.startsWith('frame-src')) && v.csp.some((x) => x.startsWith('img-src')), JSON.stringify(v));
    await sp.close();
  }

  // ----- CSP 가 걸린 채로 사이트가 정상인지 (위반 0건) -----
  {
    const w = h.baseWorks.replace(/(\{\s*order: 2,)/, '$1\n    featured: true,\n    desc: "설명",\n    images: ["images/logo.png", "images/og.png"],');
    h.setFile('works.js', w);
    const sp = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
    sp.errs = []; sp.on('pageerror', (e) => sp.errs.push(e.message));
    await watch(sp);
    await sp.goto(`${h.base}/`);
    await sp.waitForSelector('.hero-video iframe');
    check('SEC (site under CSP) js class set by the hashed inline script, content rendered', await sp.evaluate(() => document.documentElement.classList.contains('js') && !!document.querySelector('h1').textContent.trim() && document.querySelectorAll('#grid .card').length > 0));
    await sp.evaluate(() => document.querySelector('#grid').scrollIntoView());
    await sp.locator('#grid .card').first().click(); await sp.waitForTimeout(600);
    await sp.keyboard.press('Escape');
    await sp.locator('#grid .card').nth(1).click(); await sp.waitForTimeout(800);
    check('SEC (site under CSP) popup + gallery images + hero video work', await sp.locator('#modal iframe').count() === 1 && await sp.locator('.modal-gallery img').count() === 2 && await sp.locator('.hero-video iframe, .hero-video video').count() >= 0);
    await sp.keyboard.press('Escape');
    const v = await sp.evaluate(() => window.__csp);
    check('SEC (site under CSP) zero CSP violations during normal use', v.length === 0 && sp.errs.length === 0, JSON.stringify(v) + sp.errs.join());
    await sp.close();
    h.reset();
  }

  // ----- CSP 가 걸린 채로 관리 페이지가 정상인지 (읽기·미리보기·저장) -----
  {
    // 관리 페이지는 /admin(깔끔한 주소)으로 열어서 헤더 규칙까지 확인해요
    const ctx = await h.browser.newContext({ viewport: { width: 1100, height: 1000 } });
    const p = await ctx.newPage();
    p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); p.on('dialog', (d) => d.dismiss());
    await watch(p);
    const puts = [];
    const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    const files = { 'works.js': { text: h.baseWorks, sha: 'w1' }, 'site.js': { text: h.baseSite, sha: 's1' }, 'index.html': { text: h.baseIndex, sha: 'i1' } };
    await p.route('https://api.github.com/**', async (route) => {
      const req = route.request(), file = (req.url().match(/contents\/([^?]+)/) || [])[1];
      const json = (s, b) => route.fulfill({ status: s, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(b) });
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      const f = files[file];
      if (req.method() === 'GET') return f ? json(200, { sha: f.sha, content: Buffer.from(f.text).toString('base64'), encoding: 'base64' }) : json(404, {});
      const body = JSON.parse(req.postData()); puts.push({ file, text: Buffer.from(body.content, 'base64').toString('utf8') });
      files[file] = { text: puts[puts.length - 1].text, sha: `n${puts.length}` }; return json(200, { content: { sha: `n${puts.length}` } });
    });
    const res = await p.goto(`${h.base}/admin`);
    check('SEC /admin is served with its CSP and no-store', /connect-src 'self' https:\/\/api\.github\.com/.test(res.headers()['content-security-policy'] || '') && res.headers()['cache-control'] === 'no-store');
    await p.waitForSelector('.item');
    await token(p);
    const png = fs.readFileSync(path.join(REPO, 'images/og.png'));
    await p.locator('.item').first().locator('.file-gal').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: png });
    await p.waitForFunction(() => /작업 과정 이미지 1장을 준비/.test(document.querySelector('#msg').textContent));
    check('SEC (admin under CSP) blob preview of an uploaded image renders', await p.locator('.item').first().locator('.galcell img').evaluate((i) => i.complete && i.naturalWidth > 0 || i.src.startsWith('blob:')));
    await p.locator('.f-desc').first().fill('CSP 아래에서 저장');
    await p.locator('#tab-site').click(); await p.locator('#f-seo-desc').fill('설명 바꿈'); await p.locator('#tab-works').click();
    await p.locator('#save').click(); await saved(p);
    check('SEC (admin under CSP) save works: image, works.js and index.html written', puts.some((x) => /^images\//.test(x.file)) && puts.some((x) => x.file === 'works.js' && evalWorks(x.text)[0].desc === 'CSP 아래에서 저장') && puts.some((x) => x.file === 'index.html' && x.text.includes('설명 바꿈') && x.text.includes('Content-Security-Policy')), puts.map((x) => x.file).join());
    const v = await p.evaluate(() => window.__csp);
    check('SEC (admin under CSP) zero CSP violations (parse via new Function allowed only here)', v.length === 0 && p.errs.length === 0, JSON.stringify(v) + p.errs.join());
    await ctx.close();
  }
};
