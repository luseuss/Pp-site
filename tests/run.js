// 전체 시험 실행:  node tests/run.js   (처음에는 tests 폴더에서 npm install)
const { start } = require('./harness');
const files = ['seo.unit.test.js', 'site.test.js', 'admin.test.js'];

(async () => {
  let ok = 0, bad = 0;
  const check = (name, cond, extra = '') => { cond ? ok++ : bad++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : `   >> ${extra}`}`); };
  const only = process.argv[2];   // 예: node tests/run.js admin  → 이름에 admin 이 든 파일만
  const h = await start();
  try {
    for (const f of files.filter((x) => !only || x.includes(only))) {
      console.log(`\n=== ${f} ===`);
      await require(`./${f}`)(h, check);
    }
  } catch (e) {
    bad++; console.error('TEST CRASH', e);
  } finally {
    await h.close();
  }
  console.log(`\n${ok} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
})();
