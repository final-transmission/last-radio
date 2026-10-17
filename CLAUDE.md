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
푸시 후 1~2분 뒤 GitHub Pages에 반영된다. 같은 원본으로 claude.ai 아티팩트(https://claude.ai/artifact/VAfyFZvbWHwJxMn3UGZbMF)도 갱신할 수 있다.

## 사용자 선호
한국어로, 최소한의 말로 핵심만 답한다.
