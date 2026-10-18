# 최후의 무전 (The Final Transmission)

LA 좀비 아포칼립스 생존 웹게임. GitHub Pages(https://final-transmission.github.io/last-radio/)로 배포되고 저장소는 Firebase(Firestore + 이메일/비밀번호 인증)를 쓴다.

## 파일
- `src/game.html` — 게임 원본. claude.ai 아티팩트 형식(doctype/head 없음, `claude.use('db')` 사용). **기능 수정은 항상 여기서 한다.**
- `tools/build_firebase.py` — 원본을 Firebase용 페이지로 변환한다 (FIREBASE_CONFIG 포함).
- `index.html` — 변환 결과물. 직접 고치지 말고 다시 빌드한다.
- `firestore.rules` — Firestore 보안 규칙. 바꾸면 사용자가 Firebase 콘솔 규칙 탭에 직접 붙여 넣어야 한다.

## 수정 후 배포
```
python3 tools/build_firebase.py src/game.html index.html
git add -A && git commit -m "..." && git push origin main
```
푸시 후 1~2분 뒤 GitHub Pages에 반영된다. claude.ai 아티팩트는 더 이상 갱신하지 않는다.

## 보안
- `firestore.rules`: 내 캐릭터(`uid-` + 인증 uid)만 고치고, 관리자(akdma0528)는 예외. 바꾸면 사용자가 콘솔에 다시 붙여 넣어야 한다.
- 새 기능이 남의 문서를 직접 쓰면 규칙에 막힌다. 그런 경우는 공유 문서(쉘터 `kicked`처럼)에 기록하고 당사자 화면이 스스로 처리하게 한다.
- 빌드가 CSP(인라인 스크립트 해시), 클릭재킹 방지, Firebase SDK(`vendor/`) 무결성 값을 자동으로 넣는다.
- 테스트: `tests/README.md` (에뮬레이터 규칙 테스트 + 종단 테스트). 규칙·저장 구조를 바꾸면 돌린다.

## 패치 노트
기능을 바꿔 배포할 때마다 `src/game.html`의 `PATCH_NOTES` 맨 위(오늘 날짜 항목)에 한 줄씩 추가한다. 안내 탭(📜)의 게임 안내 문구도 바뀐 기능에 맞춰 고친다.

## 사용자 선호
한국어로, 최소한의 말로 핵심만 답한다.
