# 영상 편집 포트폴리오

설치 없이 `index.html`을 브라우저로 열면 보입니다. (YouTube 재생은 Live Server 또는 배포 주소에서 확인)

## 파일 구조
- `works.js` — **영상 목록 (영상 추가/수정은 여기만!)**
- `index.html` — 이름, 소개, 연락처 등 글 내용
- `style.css` — 디자인
- `script.js` — 카드 자동 생성 + 영상 팝업 (보통 건드릴 일 없음)
- `images/` — 사이트에 쓰는 이미지(로고 등)
- `videos/` — 직접 올릴 mp4 (파일당 100MB 미만 권장)
- `thumbs/` — mp4용 썸네일 이미지

## 영상 추가하는 법
`works.js`의 목록에 한 덩어리를 복사해서 붙이고 값만 바꾸세요.
```js
{
  order: 1,                          // 순서 번호 (작을수록 앞)
  url: "https://youtu.be/영상ID",   // 유튜브 주소를 그대로 붙여넣기
  title: "작품 제목",
  meta: "2026 · 모션 그래픽",
},
```
mp4는 `url` 대신 `src: "videos/파일명.mp4"`, 썸네일은 `thumb: "thumbs/파일명.jpg"`(선택).
순서는 `order` 번호가 작을수록 앞입니다(번호 없으면 맨 뒤). 맨 앞에 넣으려면 `order: 0`. 숨기려면 줄 앞에 `//`.

## 배포 (무료)
GitHub Pages: Settings → Pages. 주소는 저장소 이름과 대소문자까지 같아야 합니다.
