/*
  [수업 3] JavaScript = 웹페이지의 "움직임"
  "카드를 클릭하면 → 팝업을 열고 → 영상을 넣어줘"를 담당해요.
*/

const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');

// 팝업 열기: 카드의 data-type 에 따라 다른 플레이어를 만든다
function openModal(card) {
  const type = card.dataset.type;

  if (type === 'youtube') {
    modalBody.innerHTML =
      `<iframe src="https://www.youtube.com/embed/${card.dataset.id}?autoplay=1&rel=0"
         allow="autoplay; fullscreen" allowfullscreen></iframe>`;
  } else if (type === 'mp4') {
    modalBody.innerHTML =
      `<video src="${card.dataset.src}" controls autoplay playsinline></video>`;
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

// 모든 카드에 클릭 기능 달기
document.querySelectorAll('.card').forEach((card) => {
  card.addEventListener('click', () => openModal(card));
});

// 닫기 버튼, 배경 클릭, ESC 키로 닫기
modal.querySelector('.modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });
