# vendor

Firebase JS SDK 10.12.2 compat 빌드(app, auth, firestore). npm 패키지 `firebase@10.12.2`에서 그대로 복사했다.
외부 CDN 대신 이 파일을 쓰고, 빌드할 때 sha384 무결성 값(SRI)을 자동으로 붙인다.
버전을 올릴 때는 npm에서 새 파일을 받아 폴더째 바꾸고 `tools/build_firebase.py`의 경로를 고친다.
