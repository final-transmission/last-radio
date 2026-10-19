# 아티팩트용 최후의-무전.html → Firebase용 firebase/index.html 로 변환
import sys
src, out = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()
def R(a, b, cnt=1):
    global s
    assert s.count(a) == cnt, (s.count(a), a[:80])
    s = s.replace(a, b)

# 1) 문서 머리
R('<title>최후의 무전</title>', '''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>최후의 무전</title>''')
R('<style>\n', '<style>\n  [hidden] { display: none !important; }\n  #loginCard details, #linkCard { display: none !important; }\n', 1)
R('</style>', '</style>\n</head>\n<body>')
R('<script>\n(function(){', '''__VENDOR_SCRIPTS__
<script>
// ===== 여기에 Firebase 콘솔의 웹 앱 설정값을 붙여 넣으세요 =====
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBUpeY6j0w4Qxtc9bhSNW9xKpDCDDod7PA",
  authDomain: "the-final-transmission.firebaseapp.com",
  projectId: "the-final-transmission",
  storageBucket: "the-final-transmission.firebasestorage.app",
  messagingSenderId: "343046904246",
  appId: "1:343046904246:web:271ab4bf18de9d44aa8917",
  measurementId: "G-9P0JWB7CC2"
};
// ==============================================================
</script>
<script>
(function(){''')
import time, os
BUILD_ID = time.strftime('%Y%m%d%H%M%S')
# 새 버전이 올라오면 열려 있는 화면에 새로고침 안내를 띄운다 (version.txt를 3분마다 확인)
UPDATE_NOTICE = """<div id="updateBar" hidden style="position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:50;background:#d1a32b;color:#17140d;padding:10px 14px;border-radius:4px;box-shadow:0 6px 18px rgba(0,0,0,.35);font:700 14px 'Noto Sans KR',sans-serif;display:flex;gap:10px;align-items:center;max-width:calc(100vw - 32px)">
  <span>📻 새 버전이 나왔어요. 새로고침해 주세요.</span>
  <button type="button" id="updateReload" style="background:#17140d;color:#f3e6b8;border:none;border-radius:3px;padding:6px 10px;font:inherit;cursor:pointer">새로고침</button>
</div>
<script>
(function(){
  var BUILD_ID = '__BUILD_ID__';
  function check(){
    fetch('version.txt?t=' + Date.now(), { cache: 'no-store' }).then(function(r){ return r.ok ? r.text() : ''; }).then(function(v){
      v = (v || '').trim();
      if (v && v !== BUILD_ID) document.getElementById('updateBar').hidden = false;
    }).catch(function(){});
  }
  document.getElementById('updateReload').addEventListener('click', function(){ location.reload(); });
  setInterval(check, 180000);
  // 다른 탭·앱에 갔다가 돌아왔을 때 새 버전이 있으면 바로 새로고침한다 (옛 화면이 새 기록을 덮어쓰지 않도록)
  document.addEventListener('visibilitychange', function(){
    if (document.hidden) return;
    fetch('version.txt?t=' + Date.now(), { cache: 'no-store' }).then(function(r){ return r.ok ? r.text() : ''; }).then(function(v){
      v = (v || '').trim();
      if (v && v !== BUILD_ID) location.reload();
    }).catch(function(){});
  });
})();
</script>
""".replace("__BUILD_ID__", BUILD_ID)
s = s.rstrip() + '\n' + UPDATE_NOTICE + '</body>\n</html>\n'
open(os.path.join(os.path.dirname(os.path.abspath(out)), 'version.txt'), 'w').write(BUILD_ID + '\n')

# 2) 저장소: claude 공유 DB → Firestore
R("    try { db = await claude.use('db'); } catch(e) { db = null; }", """    try {
      if (!FIREBASE_CONFIG.projectId) throw new Error('no config');
      if (!firebase.apps.length) { firebase.initializeApp(FIREBASE_CONFIG); firebase.firestore().settings({ ignoreUndefinedProperties: true });__EMULATOR__ }
      db = firebase.firestore();
    } catch(e) { db = null; }""")
s = s.replace("claude.ai에 로그인되어 있는지 확인해보세요.", "index.html의 FIREBASE_CONFIG 설정을 확인해보세요.")

# 3) 계정: 비밀번호 해시 대신 Firebase 인증(이메일/비밀번호)
R("""      const snap = await db.doc('accounts/' + docId(id)).get();
      const acc = snap && snap.exists ? snap.data() : null;
      if (!acc || acc.hash !== await pwHash(acc.salt, pw)) { authMsg('아이디 또는 비밀번호가 맞지 않아요.'); return; }
      $('loginPw').value = '';
      const k = acc.key || docId(acc.name);
      saveSession(id, acc.name, k);
      await enterGame(k, acc.name, id);
    } catch(e) { authMsg('로그인하지 못했어요. 잠시 후 다시 시도해보세요.'); }""", """      await firebase.auth().signInWithEmailAndPassword(fbEmail(id), pw);
      $('loginPw').value = '';
      await enterFromAuth(firebase.auth().currentUser);
    } catch(e) {
      const c = e && e.code || '';
      authMsg(/wrong-password|user-not-found|invalid-credential|invalid-login/.test(c) ? '아이디 또는 비밀번호가 맞지 않아요.' : c === 'auth/too-many-requests' ? '시도가 너무 많아요. 잠시 후 다시 시도해보세요.' : '로그인하지 못했어요. 잠시 후 다시 시도해보세요.');
    }""")
R("    if (pw.length < 4) { authMsg('비밀번호는 4자 이상이어야 해요.'); return; }", "    if (pw.length < 6) { authMsg('비밀번호는 6자 이상이어야 해요.'); return; }")
R('placeholder="비밀번호 (4자 이상)" maxlength="64" autocomplete="new-password" aria-label="비밀번호">\n      <div style="height:8px"></div>\n      <input type="password" id="suPw2"',
  'placeholder="비밀번호 (6자 이상)" maxlength="64" autocomplete="new-password" aria-label="비밀번호">\n      <div style="height:8px"></div>\n      <input type="password" id="suPw2"')
R("비밀번호는 그대로 저장하지 않고 암호화(해시)해서 저장하지만, 다른 사이트에서 쓰는 비밀번호는 쓰지 마세요.", "비밀번호는 Firebase 인증이 안전하게 보관해요. 게임 데이터에는 저장되지 않아요.")
R("""      const key = 'acct-' + docId(id);
      const err = await createAccount(id, pw, name, key);
      if (err) { authMsg(err); return; }
      $('suPw').value = ''; $('suPw2').value = '';
      saveSession(id, name, key);
      await enterGame(key, name, id);
    } catch(e) { authMsg('등록하지 못했어요. 잠시 후 다시 시도해보세요.'); }""", """      signingUp = true;
      const cred = await firebase.auth().createUserWithEmailAndPassword(fbEmail(id), pw);
      const uid = cred.user.uid, key = 'uid-' + uid;
      await db.doc('users/' + uid).set({ id, name, key, createdAt: Date.now() });
      $('suPw').value = ''; $('suPw2').value = '';
      signingUp = false;
      myLoginId = id;
      await enterGame(key, name, uid);
    } catch(e) {
      signingUp = false;
      const c = e && e.code || '';
      authMsg(c === 'auth/email-already-in-use' ? '이미 있는 아이디예요.' : c === 'auth/weak-password' ? '비밀번호가 너무 약해요. 6자 이상으로 정해주세요.' : c === 'auth/operation-not-allowed' ? 'Firebase 콘솔에서 이메일/비밀번호 로그인을 켜 주세요.' : '등록하지 못했어요. 잠시 후 다시 시도해보세요.');
    }""")
R("  function loadSession() {", """  // Firebase 인증은 이메일 형식이 필요해서 아이디를 영문 이메일로 바꿔 쓴다
  function fbEmail(id) { return docId(id).slice(1) + '@survivors.game'; }
  let signingUp = false;
  async function enterFromAuth(user) {
    if (!user || myDoc) return;
    await ensureDb();
    const snap = await db.doc('users/' + user.uid).get();
    if (!snap.exists) return;
    const u = snap.data();
    myLoginId = u.id;
    await enterGame(u.key, u.name, user.uid);
  }
  function loadSession() {""")
R("        const ar = db.doc('accounts/' + docId(myDoc.account)), as = await ar.get();", "        const ar = db.doc('users/' + myDoc.account), as = await ar.get();")
R("    clearSession();\n", "    clearSession();\n    try { firebase.auth().signOut(); } catch(e) {}\n")
R("""  const session = loadSession();
  const saved = loadSavedName();
  if (session) enterGame(session.key || docId(session.name), session.name, session.id);
  else if (saved) { $('nameInput').value = saved; enterGame(docId(saved), saved, null); }""", """  (async () => {
    await ensureDb();
    if (!db) { authMsg('Firebase에 연결하지 못했어요. index.html의 FIREBASE_CONFIG 설정을 확인해보세요.'); return; }
    firebase.auth().onAuthStateChanged(user => { if (user && !signingUp) enterFromAuth(user).catch(() => {}); });
  })();""")
# 4) 보안: Firebase 라이브러리는 저장소에 넣어 둔 파일을 무결성 검사와 함께 불러온다 (외부 CDN이 바뀌어도 영향 없음)
import hashlib, base64, re
EMU = os.environ.get('LR_EMULATOR') == '1'
root = os.path.dirname(os.path.abspath(out))
tags = []
for name in ['app', 'auth', 'firestore']:
    rel = 'vendor/firebase-10.12.2/firebase-%s-compat.js' % name
    data = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', rel), 'rb').read()
    sri = 'sha384-' + base64.b64encode(hashlib.sha384(data).digest()).decode()
    tags.append('<script src="%s" integrity="%s"></script>' % (rel, sri))
R('__VENDOR_SCRIPTS__', '\n'.join(tags))
R('__EMULATOR__', " firebase.firestore().useEmulator('127.0.0.1', 8085); firebase.auth().useEmulator('http://127.0.0.1:9099');" if EMU else '')
# 클릭재킹 방지: 다른 사이트의 iframe 안에서는 화면을 숨기고 맨 위 창으로 빠져나간다
R('<meta charset="utf-8">', '''<meta charset="utf-8">
__CSP__
<meta name="referrer" content="strict-origin-when-cross-origin">
<style id="antiClickjack">html{display:none !important}</style>
<script>if (window.self === window.top) { var ack = document.getElementById('antiClickjack'); ack.parentNode.removeChild(ack); } else { try { window.top.location = window.self.location.href; } catch (e) {} }</script>''')
# 콘텐츠 보안 정책: 페이지 안의 스크립트는 해시가 맞는 것만, 외부 스크립트는 같은 사이트 것만 실행된다
hashes = []
for m in re.finditer(r'<script>(.*?)</script>', s, re.S):
    hashes.append("'sha256-" + base64.b64encode(hashlib.sha256(m.group(1).encode('utf-8')).digest()).decode() + "'")
local = ' http://127.0.0.1:* ws://127.0.0.1:*' if EMU else ''
# apis.google.com: Firebase 인증이 로그인 유지용으로 불러오는 스크립트, www.google.com: Firestore 연결 확인용 이미지
csp = ("default-src 'self'; script-src 'self' https://apis.google.com " + ' '.join(hashes) + "; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
       "font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://www.google.com; "
       "connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com https://*.firebaseio.com wss://*.firebaseio.com" + local + "; "
       "frame-src https://*.firebaseapp.com; object-src 'none'; base-uri 'self'; form-action 'self'")
R('__CSP__', '<meta http-equiv="Content-Security-Policy" content="' + csp + '">')
open(out, 'w', encoding='utf-8').write(s)
print('ok')
