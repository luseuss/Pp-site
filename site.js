/*
  ★ 소개 · 연락처 — 관리 페이지(admin.html)에서 고치거나, 여기를 직접 고쳐도 돼요 ★

  [소개]
    about: 소개 글이에요. 따옴표 한 줄이 화면의 한 줄이에요.
           빈 줄을 넣고 싶으면 "" 를 한 줄 적으세요.

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
  about: [
    "‘소리가 주는 감동을",
    "시각적으로 표현하는 디자이너’",
    "모션 그래픽 디자이너 MaRu_2 입니다.",
    "(after effects,photoshop,premiere)",
    "2026 ~",
  ].join("\n"),
  email: "marue2mv@gmail.com",
  links: [
    { label: "Instagram", url: "https://www.instagram.com/ma_ru_o2/" },
    { label: "YouTube", url: "https://www.youtube.com/@Ma_Ru_O2" },
    { label: "X", url: "https://x.com/Emaru0000" },
  ],
};
