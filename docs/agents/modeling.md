# 건물 모델링 지침 (5단계)

사용자가 제재소(`src/render/models/sawmill.ts`)와 박스 트럭 시안을 보고 "지금도 좋다"고 확정했다(2026-10-13). 나머지 건물을 **같은 스타일로** 손으로 그린다. 반드시 `sawmill.ts`를 먼저 끝까지 읽고 그 문법과 밀도를 따른다.

## 방식

- three.js 기본 도형을 코드로 조합한다. `Kit`(`models/kit.ts`)의 `box`, `cyl`, `cone`, `blob`, `dome`, `capsule`, `prism`, `barrel`만 쓴다. 새 지오메트리 클래스나 텍스처, 외부 파일은 쓰지 않는다.
- 공용 부품은 `models/parts.ts`에 있다: `gableRoof`, `flatRoof`, `framedWindow`, `barnDoor`, `rollerDoor`, `log`, `bush`. 지붕·창·문은 되도록 이것을 써서 건물끼리 같은 모양이 되게 한다.
- 색은 `buildingPalette(theme, typeId)`의 `wall`, `roof`, `accent`, `trim`과 `theme.props`, `itemColor(theme, itemId)`만 쓴다. 색 숫자를 코드에 직접 적지 않는다. 창은 `kit.materials.window`, 등은 `kit.materials.lamp`(밤에 켜진다).

## 고칠 수 있는 파일

- 자기 그룹 폴더(`src/render/models/tier1|tier2|tier3/`) 안의 파일만 만들고 고친다. 건물 하나에 파일 하나(`<typeId>.ts`), 그리고 그 폴더의 `index.ts`에서 `registry.register('building.<typeId>', factory)`로 등록한다.
- `kit.ts`, `parts.ts`, `theme.ts`, `sawmill.ts`, `buildings.ts`, `models/index.ts` 등 폴더 밖의 파일은 고치지 않는다. 바꿔야 할 것이 있으면 최종 보고에 적는다. 같은 그룹 안에서 되풀이되는 부품은 그 폴더에 `shared.ts`를 만들어 둔다.
- git 커밋·push는 하지 않는다. 메인 에이전트가 한다.

## 부지 틀과 지켜야 할 자리

원점은 부지 한가운데 바닥, +z가 앞(마당·도로 쪽), +y가 위. 부지는 가로 16 × 세로 14.

- 건물이 차지해도 되는 범위: x −7.6 ~ 6.0, z −6.9 ~ 2.1. 높이는 굴뚝·탑 포함 9 이하.
- 비워 둘 곳: 앞마당 z > 2.2 전체(재고 더미와 지게차 자리). 오른쪽 뒤 폐기물 더미 자리 (x 6.95, z −3.4) 둘레 반지름 1.2. 즉 x > 6.0에는 아무것도 두지 않는다.
- 반환값은 `kit.group(parts.flat(), { ...BUILDING_ANCHORS, smoke: [...] })`. `BUILDING_ANCHORS`는 `models/buildings.ts`에서 가져와 그대로 쓴다. 굴뚝이 있으면 연기 나오는 점을 `smoke`에 넣고, 없으면 빈 배열.

## 스타일 (제재소에서 읽어 낼 것)

- 장난감처럼 통통한 비율. 모서리는 둥글게(`r` 0.03~0.3). 기초 슬래브(높이 0.3) 위에 돌 받침을 두른 벽.
- 지붕은 두껍고 처마가 나온다. 흰 테두리(`props.sign`)로 윤곽을 잡는다.
- 건물마다 **무엇을 만드는지 한눈에 알 수 있는 큰 상징** 하나(제재소의 톱날처럼 앞면에), 그리고 **공정이 보이는 장면** 하나(제재소의 톱 작업대처럼 열린 곳에 기계와 재료·완성품).
- 재료와 완성품은 레시피(`src/content/recipes.ts`)의 품목을 `itemColor`로 칠해 소품으로 놓는다.
- 작은 소품 두세 개(화분, 통, 상자, 등)로 마무리한다.
- 실루엣은 건물마다 달라야 한다. 지붕 모양(박공, 평지붕, 톱날, 둥근 지붕), 본채와 부속채의 배치, 탑·사일로·탱크·굴뚝으로 구분한다. 같은 그룹 안에서 같은 배치를 되풀이하지 않는다.
- 단계가 높을수록 크고 현대적이다: 1차는 작은 공방·제분소 느낌, 2차는 공장, 3차는 큰 공장, 4차는 유리가 많은 첨단 시설, 수제 공방은 작고 아늑한 목공방.
- 조각(메시) 수는 건물당 90~170개. 그보다 잘게 쪼개지 않는다.

## 확인

- **겹침·뜬 조각 자동 검사**: `npm run --silent audit:models -- building.<typeId>`. 서로 다른 색의 평평한 면이 같은 평면에서 겹치면 깜빡이고(`overlap`), 아무 데도 닿지 않는 조각은 떠 보인다(`floating`). 사용자가 이 두 가지를 직접 지적했다(2026-10-13). **자기 건물 전부가 `ok`로 나와야 끝난 것이다.** 겹친 면은 한쪽을 0.03 이상 내밀거나 들이고, 뜬 조각은 받침·팔을 달거나 붙인다. 장식 판은 바탕에서 0.03 이상 띄운다.

- `npx tsc --noEmit`가 통과해야 한다.
- 개발 서버가 `http://localhost:5187`에 이미 떠 있다(직접 띄우지 않는다). 모델 보기 화면: `/src/render/models.html#building.<typeId>&t=0.3`. `t=0.85`는 밤.
- 브라우저 창은 다른 에이전트와 함께 쓴다. **`tabs_create`로 자기 탭을 하나 만들고, 모든 브라우저 도구 호출에 그 `tabId`를 넣는다.** 다른 탭은 건드리지 않고, 창 크기를 바꾸지 않는다.
- 카메라는 `javascript_tool`로 옮긴다: `modelView.controls.autoRotate = false; modelView.camera.position.set(x, y, z); modelView.controls.target.set(x, y, z);` 다른 모델로 바꾸려면 `modelView.show('building.<typeId>')`. 파일을 고친 뒤에는 `location.reload()`.
- 건물마다 앞쪽 대각선과 반대쪽 대각선에서 한 장씩 스크린샷(`scale: 0.6`)을 찍어, 겹치거나 떠 있거나 파묻힌 조각이 없는지, 상징이 읽히는지 본다. 사용량을 아끼기 위해 스크린샷은 건물당 서너 장 이내로 한다.
- 스크린샷이 안 찍히면 `javascript_tool`로 크기(`#info`의 글)와 콘솔 오류만 확인하고 그 사실을 보고에 적는다.

## 최종 보고 (짧게)

그린 건물별로 한 줄(상징, 공정 장면, 조각 수), 폴더 밖에서 바꿔야 할 것, 확인하지 못한 것.
