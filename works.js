/*
  ★ 작업물 목록 — 영상을 추가/수정/삭제할 때는 이 파일만 고치면 돼요 ★

  [YouTube 영상 추가]
    아래 목록에 한 줄(중괄호 { } 한 덩어리)을 복사해서 붙이고,
    url 에 유튜브 주소를 "그대로" 붙여 넣으세요. 썸네일은 자동으로 나와요.
    (youtu.be/..., youtube.com/watch?v=..., youtube.com/shorts/... 다 가능)

  [내 mp4 파일 추가]
    1) 영상 파일을 videos/ 폴더에 넣어요.   예) videos/my-work.mp4
    2) (선택) 썸네일 이미지를 thumbs/ 폴더에 넣어요.   예) thumbs/my-work.jpg
    3) 아래 예시 중 "src" 줄을 복사해서 쓰세요.

  [순서]
    영상마다 order 번호를 적어요. 번호가 작을수록 사이트에서 앞에 나와요.
      order: 1  → 맨 앞,  order: 2  → 그다음 ...
    순서를 바꾸고 싶으면 숫자만 바꾸면 돼요. 파일 안에서 위치는 상관없어요.
    새 영상을 맨 앞에 넣고 싶다면? 기존 번호를 밀 필요 없이 order: 0 (또는 -1)을 쓰세요.
    order 를 안 적은 영상은 맨 뒤에 나와요. (번호가 같으면 파일에 적힌 순서대로)

  [카테고리]
    영상마다 tags 에 카테고리를 적으면, 사이트에 "전체 / MV / AMV" 버튼이 자동으로 생겨요.
      tags: ["MV"],           → MV 에만 나와요
      tags: ["MV", "AMV"],    → 둘 다에 나와요 (여러 개 가능)
    tags 를 안 적은 영상은 "전체"에서만 보여요. 아무 영상에도 tags 가 없으면 버튼 줄이 안 보여요.
    (관리 페이지에서는 쉼표로 적거나 이미 쓴 카테고리를 눌러서 붙일 수 있어요.)

  [잠깐 숨기기]
    줄 맨 앞에 // 를 붙이면 숨겨지고, 지우면 다시 보여요. (Ctrl+/ 로도 돼요)

  [주의]
    - 한 덩어리가 끝나면 맨 뒤에 쉼표(,)를 꼭 붙이세요.
    - 따옴표(" ")는 지우지 마세요.
    - 제목 안에 큰따옴표(")를 쓰고 싶으면 앞에 \ 를 붙여 \" 로 쓰세요.
*/

const WORKS = [
  {
    order: 1,
    url: "https://youtu.be/GRSXjWZKfgw",
    title: "[Maru_2]【Ado】好きでいて[motion Graphics]",
    meta: "2026 · typo,motion graphics,합작",
    tags: ["MV"],
  },
  {
    order: 2,
    url: "https://youtu.be/QUdiDIH1u-g",
    title: "[Maru_2] ryo (supercell) / メルト CPK! Remix (初音ミク ver.) [motion Graphics]",
    meta: "2026 · typo,motion graphics",
    tags: ["MV"],
  },
  {
    order: 3,
    url: "https://youtu.be/d2Ha2hTR_Ic",
    title: "[Maru_2] Bol4- 'Find You' [motion Graphics]",
    meta: "2026 · typo,motion graphics",
    tags: ["MV"],
  },

  // ▼ 직접 올린 mp4 예시 (쓰려면 앞의 // 를 지우고 파일 이름을 맞추세요)
  // {
  //   order: 4,
  //   src: "videos/my-work.mp4",
  //   thumb: "thumbs/my-work.jpg",   // 썸네일은 없어도 돼요
  //   title: "작품 제목",
  //   meta: "2026 · 모션 그래픽",
  // },
];
