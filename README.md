# 영상 편집 포트폴리오

설치 없이 `index.html`을 브라우저로 열면 보입니다.

## 파일 구조
- `index.html` — 내용(뼈대)
- `style.css` — 디자인
- `script.js` — 영상 팝업 동작
- `videos/` — 직접 올릴 mp4 (파일당 100MB 미만 권장)
- `thumbs/` — mp4용 썸네일 이미지

## 영상 추가하는 법
`index.html`의 `<button class="card" ...>` 블록을 복사해서 값만 바꾸세요.
- YouTube: `data-id`에 주소의 `v=` 뒤 글자
- mp4: `data-src="videos/파일명.mp4"`

## 배포 (무료)
GitHub Pages / Netlify / Vercel 에 이 폴더를 올리면 공개 주소가 생깁니다.
