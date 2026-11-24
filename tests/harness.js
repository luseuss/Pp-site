// 시험 도우미: 사이트 파일을 임시 폴더에 복사해서 작은 웹서버로 열고, 가짜 GitHub 를 붙여 줍니다.
// (실제 저장소 파일과 GitHub 는 건드리지 않아요)
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const REPO = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json' };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

// 사용자가 대표 영상을 골라 둔 실제 works.js 에서 그 줄만 뺀, 시험의 기본 영상 목록
const stripFeatured = (t) => t.replace(/\n\s*featured: true,/g, '');
const evalWorks = (t) => new Function(`${t}\nreturn WORKS;`)();
const evalSite = (t) => new Function(`${t}\nreturn SITE;`)();

async function start() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-site-'));
  fs.cpSync(REPO, dir, { recursive: true, filter: (s) => !/[\\/](\.git|tests|node_modules|videos)([\\/]|$)/.test(s) });
  const baseWorks = stripFeatured(fs.readFileSync(path.join(REPO, 'works.js'), 'utf8'));
  const baseSite = fs.readFileSync(path.join(REPO, 'site.js'), 'utf8');
  const baseIndex = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  fs.writeFileSync(path.join(dir, 'works.js'), baseWorks);

  const server = http.createServer((req, res) => {
    const p = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html');
    const file = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p;
    if (!file.startsWith(dir) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});

  const h = {
    dir, base, browser, baseWorks, baseSite, baseIndex,
    setFile(name, text) { fs.writeFileSync(path.join(dir, name), text); },
    reset() { h.setFile('works.js', baseWorks); h.setFile('site.js', baseSite); },
    // 사이트 열기 (오류는 page.errs 에 모음)
    async site(vw = 1100, vh = 900, opts = {}) {
      const page = await browser.newPage({ viewport: { width: vw, height: vh }, ...opts });
      page.errs = [];
      page.on('pageerror', (e) => page.errs.push(e.message));
      await page.goto(`${base}/index.html`);
      return page;
    },
    // 관리 페이지 + 가짜 GitHub (파일별 sha 확인, 저장 내용은 puts 에 쌓임)
    async admin(o = {}) {
      const ctx = await browser.newContext({ viewport: { width: 1100, height: 1000 } });
      const p = await ctx.newPage();
      p.errs = [];
      p.on('pageerror', (e) => p.errs.push(e.message));
      p.on('dialog', (d) => d.dismiss());
      const files = {
        'works.js': { text: o.works ?? baseWorks, sha: 'w1' },
        'site.js': { text: o.site ?? baseSite, sha: 's1' },
        'index.html': { text: o.index ?? baseIndex, sha: 'i1' },
      };
      const puts = []; let n = 0;
      await p.route('https://api.github.com/**', async (route) => {
        const req = route.request();
        const file = (req.url().match(/contents\/([^?]+)/) || [])[1];
        const json = (status, body) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
        const f = files[file];
        if (req.method() === 'GET') return f ? json(200, { sha: f.sha, content: Buffer.from(f.text).toString('base64'), encoding: 'base64' }) : json(404, {});
        const body = JSON.parse(req.postData());
        if ((f && body.sha !== f.sha) || (!f && body.sha)) return json(409, {});
        const text = Buffer.from(body.content, 'base64').toString('utf8');
        const sha = `v${++n}`;
        files[file] = { text, sha };
        puts.push({ file, body, text });
        return json(200, { content: { sha } });
      });
      await p.goto(`${base}/admin.html`);
      await p.waitForSelector('.item');
      return { p, puts, files, ctx };
    },
    async close() { await browser.close(); server.close(); fs.rmSync(dir, { recursive: true, force: true }); },
  };
  return h;
}

// 관리 페이지 공통 동작
const token = async (p) => { await p.evaluate(() => { document.querySelector('#settings').open = true; }); await p.locator('#s-token').fill('github_pat_T'); };
const saved = (p) => p.waitForFunction(() => /저장했어요|취소/.test(document.querySelector('#msg').textContent));
const msgOf = (p) => p.locator('#msg').textContent();

module.exports = { REPO, start, evalWorks, evalSite, stripFeatured, token, saved, msgOf };
