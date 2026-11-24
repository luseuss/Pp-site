// seo.js (검색·공유 구역을 만들고 읽는 도우미) 단위 시험 — 브라우저 없이 Node 로만
const SEO = require('../seo.js');

module.exports = async (h, check) => {
  const site = { name: 'MaRu_2', tagline: '영상 편집 포트폴리오' };
  const seo = { siteUrl: 'https://example.com/me', description: '설명 "따옴표" & <태그>', ogImage: 'images/og.png' };
  const block = SEO.buildSeoBlock(seo, site);
  check('U title follows "name | tagline"', block.includes('<title>MaRu_2 | 영상 편집 포트폴리오</title>') && SEO.pageTitle('A', '') === 'A' && SEO.pageTitle('', 'B') === 'B');
  check('U description is HTML-escaped', block.includes('content="설명 &quot;따옴표&quot; &amp; &lt;태그&gt;"'));
  check('U base URL gets trailing slash, og:image becomes absolute', block.includes('rel="canonical" href="https://example.com/me/"') && block.includes('og:image" content="https://example.com/me/images/og.png"'));
  check('U with image → large twitter card; without → summary + no image tags', block.includes('summary_large_image') && (() => { const b = SEO.buildSeoBlock({ ...seo, ogImage: '' }, site); return b.includes('"summary"') && !b.includes('og:image') && !b.includes('twitter:image'); })());
  check('U absolute image URL kept as is', SEO.buildSeoBlock({ ...seo, ogImage: 'https://cdn.x/a.png' }, site).includes('og:image" content="https://cdn.x/a.png"'));
  const parsed = SEO.parseSeo(`<head>\n${block}\n</head>`, '');
  check('U parse is the inverse of build (value + relative image path)', parsed.siteUrl === 'https://example.com/me/' && parsed.description === seo.description && parsed.ogImage === 'images/og.png', JSON.stringify(parsed));
  const html = `<html>\n<head>\n  <meta charset="utf-8" />\n${block}\n  <link rel="stylesheet" href="style.css" />\n</head></html>`;
  const again = SEO.replaceSeoBlock(html, SEO.buildSeoBlock({ ...seo, description: '새 $& $1 설명' }, site));
  check('U replace swaps only the block; "$" in text is safe', again.includes('새 $&amp; $1 설명') && again.includes('<meta charset="utf-8" />') && again.includes('<link rel="stylesheet"') && (again.match(/SEO:START/g) || []).length === 1);
  check('U replace with same content is a no-op', SEO.replaceSeoBlock(html, SEO.currentBlock(html)) === html);
  const legacy = '<html>\n<head>\n  <meta charset="utf-8" />\n  <title>옛 제목</title>\n  <meta name="description" content="옛 설명" />\n  <link rel="stylesheet" href="style.css" />\n</head></html>';
  const mig = SEO.replaceSeoBlock(legacy, block);
  check('U legacy file: old title/description removed, block inserted before stylesheet, indentation kept', !mig.includes('옛 제목') && !mig.includes('옛 설명') && mig.indexOf('SEO:START') < mig.indexOf('<link rel="stylesheet"') && mig.includes('\n  <link rel="stylesheet"'));
  check('U currentBlock is "" when absent', SEO.currentBlock(legacy) === '');
};
