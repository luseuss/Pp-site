/*
  ★ 사이트 정보 (이름 · 첫 화면 · 소개 · 연락처) — 관리 페이지(admin.html)에서 고치거나, 여기를 직접 고쳐도 돼요 ★

  [이름]
    name:    사이트 이름이에요. 맨 위 로고, 브라우저 탭 제목, 맨 아래 © 문구에 쓰여요.
    tagline: 탭 제목에서 이름 뒤에 붙는 설명이에요. (예: "MaRu_2 | 영상 편집 포트폴리오")

  [효과]
    animations: true 이면 움직임(첫 화면 등장, 스크롤 나타나기, 카드 효과)이 켜지고, false 면 모두 꺼져요.
                (방문자가 운영체제에서 "동작 줄이기"를 켜 두었으면 true 여도 자동으로 꺼져요.)

  [첫 화면]
    hero.eyebrow: 제목 위의 작은 글씨   hero.title: 큰 제목 (따옴표 한 줄이 화면의 한 줄)
    hero.lead:    제목 아래 한 줄 소개   hero.button: 버튼 글자 (누르면 작업물로 이동)
    비워 두면("") 그 부분은 화면에서 사라져요.

  [메뉴와 섹션]
    nav:      맨 위 메뉴 글자 (about=소개, work=작업물, contact=연락). 비우면 그 메뉴만 사라져요.
    sections: 소개·작업물·연락 영역마다 show(true/false)와 title(영역 제목).
              show: false 로 하면 그 영역과 메뉴 링크가 사이트에서 사라져요.

  [소개]
    about: 소개 글이에요. 따옴표 한 줄이 화면의 한 줄이에요.
           빈 줄을 넣고 싶으면 "" 를 한 줄 적으세요.
    aboutImage: 소개 옆에 보이는 이미지 경로예요. (예: "images/logo.png", 비우면 안 보여요)

  [연락처]
    email: 이메일이에요. 비워 두면(email: "") 화면에서 안 보여요.
    links: 링크 목록이에요. 위에 적을수록 먼저 나와요.
           label 은 화면에 보이는 이름, url 은 https:// 로 시작하는 주소예요.
           줄 맨 앞에 // 를 붙이면 숨겨져요.

  [주의]
    - 따옴표(" ")와 줄 끝의 쉼표(,)는 지우지 마세요.
    - 글 안에 큰따옴표(")를 쓰고 싶으면 앞에 \ 를 붙여 \" 로 쓰세요.
*/

const SITE = {
  name: "MaRu_2",
  tagline: "영상 편집 포트폴리오",
  animations: true,
  hero: {
    eyebrow: "VIDEO EDITOR",
    title: [
      "소리가 주는 감동을",
      "시각적으로 표현하자",
    ].join("\n"),
    lead: "mv,amv",
    button: "works ↓",
  },
  nav: { about: "소개", work: "작업물", contact: "연락" },
  sections: {
    about: { show: true, title: "About" },
    work: { show: true, title: "Work" },
    contact: { show: true, title: "Contact" },
  },
  about: [
    "‘소리가 주는 감동을",
    "시각적으로 표현하는 디자이너’",
    "모션 그래픽 디자이너 MaRu_2 입니다.",
    "(after effects,photoshop,premiere)",
    "2026 ~",
  ].join("\n"),
  aboutImage: "images/logo.png",
  email: "marue2mv@gmail.com",
  links: [
    { label: "Instagram", url: "https://www.instagram.com/ma_ru_o2/" },
    { label: "YouTube", url: "https://www.youtube.com/@Ma_Ru_O2" },
    { label: "X", url: "https://x.com/Emaru0000" },
  ],
};
