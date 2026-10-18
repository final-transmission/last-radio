# 테스트

Firebase 에뮬레이터(인증 + Firestore)에서 보안 규칙과 실제 게임 화면을 검증한다.

```
npm i --legacy-peer-deps firebase-tools@14 @firebase/rules-unit-testing@4 firebase@11 playwright
# 1) 보안 규칙 단위 테스트 (허용/차단 68건)
cp ../firestore.rules . && npx firebase emulators:exec --only firestore --project demo-lr "node rules.test.mjs"
# 2) 실제 화면 종단 테스트 (가입·무전·교환·쉘터·메모·XSS·백업/복원·CSP·클릭재킹)
LR_EMULATOR=1 python3 ../tools/build_firebase.py ../src/game.html site/index.html && cp -r ../vendor site/
SITE=$PWD/site npx firebase emulators:exec --only firestore,auth --project the-final-transmission "node e2e.mjs"
```
firebase.json에 firestore(8085)·auth(9099) 에뮬레이터 포트를 지정해 둔다.
