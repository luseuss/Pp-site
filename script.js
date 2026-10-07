/*
  [수업 3] JavaScript = 웹페이지의 "움직임"
  1) works.js 의 목록을 읽어서 → 카드를 자동으로 만들고
  2) 카드를 클릭하면 → 팝업을 열고 → 영상을 넣어줘요.
  영상을 추가/수정할 때는 이 파일이 아니라 works.js 를 고치세요.
*/

const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');
const grid = document.getElementById('grid');

// 유튜브 주소에서 영상 ID만 뽑아내기 (여러 형태의 주소를 다 처리)
function getYouTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1);
    const v = u.searchParams.get('v');
    if (v) return v;
    const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/);
    if (m) return m[1];
  } catch (e) { /* 주소가 이상하면 아래에서 null 반환 */ }
  return null;
}

// 작업물 하나 → 카드(버튼) 하나 만들기
function buildCard(work) {
  const card = document.createElement('button');
  card.className = 'card';

  const thumb = document.createElement('div');
  thumb.className = 'thumb';

  let thumbSrc = work.thumb || '';

  if (work.url) {
    const id = getYouTubeId(work.url);
    if (!id) {
      console.warn('유튜브 주소를 읽을 수 없어요:', work.url);
      return null;
    }
    card.dataset.type = 'youtube';
    card.dataset.id = id;
    if (!thumbSrc) thumbSrc = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  } else if (work.src) {
    card.dataset.type = 'mp4';
    card.dataset.src = work.src;
  } else {
    console.warn('url 또는 src 가 없는 항목이에요:', work);
    return null;
  }

  if (thumbSrc) {
    const img = document.createElement('img');
    img.src = thumbSrc;
    img.alt = '';
    img.loading = 'lazy';
    thumb.appendChild(img);
  } else {
    thumb.classList.add('placeholder');
  }

  const play = document.createElement('span');
  play.className = 'play';
  play.textContent = '▶';
  thumb.appendChild(play);

  const title = document.createElement('h3');
  title.textContent = work.title || '';
  const meta = document.createElement('p');
  meta.textContent = work.meta || '';

  card.append(thumb, title, meta);
  card.addEventListener('click', () => openModal(card));
  return card;
}

// 목록 전체를 화면에 그리기
// order 번호가 작은 순서대로 정렬 (order 가 없으면 맨 뒤, 같으면 파일에 적힌 순서 유지)
if (typeof WORKS !== 'undefined') {
  const orderOf = (w) => (typeof w.order === 'number' ? w.order : Infinity);
  const sorted = WORKS
    .map((work, i) => ({ work, i }))
    .sort((a, b) => (orderOf(a.work) - orderOf(b.work)) || (a.i - b.i))
    .map((x) => x.work);

  sorted.forEach((work) => {
    const card = buildCard(work);
    if (card) grid.appendChild(card);
  });
}

// 팝업 열기: 카드의 data-type 에 따라 다른 플레이어를 만든다
function openModal(card) {
  const type = card.dataset.type;
  modalBody.innerHTML = '';

  if (type === 'youtube') {
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(card.dataset.id)}?autoplay=1&rel=0`;
    iframe.allow = 'autoplay; fullscreen';
    iframe.allowFullscreen = true;
    modalBody.appendChild(iframe);
  } else if (type === 'mp4') {
    const video = document.createElement('video');
    video.src = card.dataset.src;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    modalBody.appendChild(video);
  }

  modal.hidden = false;
  document.body.style.overflow = 'hidden'; // 뒤 화면 스크롤 막기
}

// 팝업 닫기: 안의 내용도 비워야 영상 소리가 멈춘다
function closeModal() {
  modal.hidden = true;
  modalBody.innerHTML = '';
  document.body.style.overflow = '';
}

// 닫기 버튼, 배경 클릭, ESC 키로 닫기
modal.querySelector('.modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });
