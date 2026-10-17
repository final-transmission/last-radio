# 최후의 무전 · Firebase 버전 설치 안내

claude.ai 로그인 없이 누구나 접속할 수 있는 버전입니다. 처음 한 번만 아래 순서대로 설정하면 됩니다. (약 15분)

## 1. Firebase 프로젝트 만들기
1. https://console.firebase.google.com 에 Google 계정으로 들어갑니다.
2. **프로젝트 만들기** → 이름(예: `last-radio`) 입력 → Google 애널리틱스는 꺼도 됩니다.

## 2. 로그인 기능 켜기
1. 왼쪽 메뉴 **빌드 → Authentication → 시작하기**
2. **로그인 방법** 탭 → **이메일/비밀번호** → 사용 설정 → 저장
   (게임 아이디는 내부에서 이메일 형식으로 바뀌어 저장되니, 진짜 이메일은 필요 없습니다.)

## 3. 데이터베이스 만들기
1. **빌드 → Firestore Database → 데이터베이스 만들기**
2. 위치는 `asia-northeast3 (서울)` 추천, **프로덕션 모드**로 시작
3. **규칙** 탭을 열고 내용을 전부 지운 뒤 `firestore.rules` 파일 내용을 붙여 넣고 **게시**

## 4. 웹 앱 등록하고 설정값 넣기
1. 프로젝트 개요 옆 ⚙️ **프로젝트 설정** → 아래 **내 앱** → `</>` (웹) 아이콘
2. 앱 닉네임 입력 → 등록 (Firebase 호스팅 체크는 안 해도 됨)
3. 화면에 나오는 `firebaseConfig = { ... }` 안의 값들을 복사해서
   `index.html` 위쪽의 `FIREBASE_CONFIG` 칸에 그대로 붙여 넣습니다.

```js
const FIREBASE_CONFIG = {
  apiKey: "AIza....",
  authDomain: "last-radio.firebaseapp.com",
  projectId: "last-radio",
  storageBucket: "last-radio.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
```
이 값은 공개되어도 괜찮은 값입니다. 데이터 보호는 3번의 규칙이 맡습니다.

## 5. 인터넷에 올리기 (GitHub Pages)
1. GitHub에서 새 저장소(Public) 만들기 → `index.html` 업로드
2. 저장소 **Settings → Pages** → Branch를 `main` / `/ (root)` 로 저장
3. 1~2분 뒤 `https://내아이디.github.io/저장소이름/` 주소로 접속됩니다.
4. Firebase 콘솔 **Authentication → 설정 → 승인된 도메인**에 `내아이디.github.io` 를 추가합니다. (안 하면 로그인이 막힙니다)

이 주소를 친구에게 보내면 claude.ai 로그인 없이 바로 가입하고 플레이할 수 있습니다.

## 알아둘 점
- 비밀번호는 Firebase 인증이 보관하고, 게임 데이터에는 저장되지 않습니다. 비밀번호는 6자 이상이어야 합니다.
- 로그인한 생존자는 게임 데이터를 서로 읽고 쓸 수 있습니다(약탈·쉘터 기능 때문). 계정 정보만 본인만 고칠 수 있습니다.
- Firebase 무료 요금제(Spark)로 친구들끼리 플레이하기에는 충분합니다. 사람이 아주 많아지면 하루 읽기 한도(5만 회)를 넘을 수 있습니다.
- claude.ai 아티팩트 버전의 캐릭터·대화 기록은 넘어오지 않습니다. 새로 가입해서 시작해 주세요.
