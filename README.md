# Warehouse Tycoon

창고를 소재로 한 웹 기반 3D 방치형 타이쿤 게임이다. 섬의 빈 부지에 공장을 짓고, 트럭·화물선·화물기로 원자재를 들여와 가공하고, 같은 수단으로 내다 판다.

- 원자재 7종에서 시작해 1차~4차 가공품과 수제품까지 만든다. 건물은 21종, 부지는 59칸이다.
- 차량이 실제로 물품을 나른다. 건물 사이의 거리와 물품의 무게가 운송 시간에 영향을 준다.
- 자동 모드를 켜면 가장 싼 것부터 알아서 사고 짓는다.
- 한국어와 영어를 지원하고, 브라우저에 자동 저장된다.

## 실행

```bash
npm install
npm run dev
```

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입 검사 후 `dist/`에 빌드 |
| `npm test` | 테스트 |
| `npm run typecheck` | 타입 검사 |
| `npm run sim -- --hours 10 --auto --seed 1` | 화면 없이 돌려 밸런스 보고서 출력 (`--timeline`을 붙이면 새 건물·해금을 모두 나열) |

## 조작

- 오른쪽 버튼 드래그로 회전, 휠 버튼 드래그로 이동, 휠로 확대·축소.
- 빈 부지를 누르면 건물을 고르는 창이 뜬다. 건물을 누르면 아래 패널에 업그레이드가 나온다.
- 건물이나 출하장·부두·활주로에 마우스를 올리면 재고와 초당 처리량이 보인다.
- 오른쪽 통계 카드에서 건물별 가동률을 보고, "상세 통계"에서 모자란 재료와 품목별 판매 수익을 본다.
- 건물을 두 번 눌러 그대로 끌면 다른 부지로 옮긴다. 다른 건물 위에 놓으면 자리를 맞바꾼다.
- 위쪽 막대에서 속도(정지, 1배, 2배, 4배), 자동 모드, 언어, 저장, 설정을 바꾼다.

## 구조

`src/` 아래는 `contracts`(공용 타입) ← `core` ← `content`(품목·건물·밸런스 수치) ← `sim`(게임 로직) ← `app` 순서로 의존한다. `render`(three.js 화면)와 `ui`(패널)는 로직을 직접 부르지 않고 스냅샷만 읽는다. 설계와 밸런스 기록은 [PLAN.md](PLAN.md)와 [docs/balance-buildings.md](docs/balance-buildings.md)에 있다.

개발 서버를 켠 채 `/src/render/models.html`을 열면 3D 모델을 하나씩 돌려 볼 수 있다.

## 박물관 전시

[Vive Museum](https://github.com/BranKein/vive-museum)이 `deploy/exhibit.json`(제목·설명 한영, 기술 스택, 썸네일 경로, PC 권장 여부)과 `deploy/site.json`의 `subdomain`을 읽어 이 게임을 전시한다. 썸네일은 `deploy/thumbnail.jpg`. 배포 워크플로가 끝나면 박물관에 다시 빌드하라는 신호(`repository_dispatch`)를 보낸다. 토큰(`MUSEUM_DISPATCH_TOKEN`, 없으면 `INFRA_REPO_TOKEN`)에 vive-museum의 Contents 쓰기 권한이 없으면 이 단계는 경고만 남기고 넘어간다.

## 검색 노출

`index.html`에 제목·설명(한국어와 영어를 함께), canonical, 공유 카드(`public/og.jpg`), VideoGame 구조화 데이터, 첫 화면이 그려지기 전까지 보이는 소개 블록이 있다. `public/robots.txt`와 `public/sitemap.xml`도 함께 배포된다. 빌드할 때 환경 변수 `GOOGLE_SITE_VERIFICATION`, `NAVER_SITE_VERIFICATION`이 있으면 Google Search Console·네이버 서치어드바이저 소유 확인 메타 태그를 넣는다. 배포 워크플로는 저장소 변수(`vars`)에서 같은 이름으로 읽는다. 없으면 태그를 넣지 않는다.
