import { chromium } from 'playwright';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection } from 'firebase/firestore';
import fs from 'fs';
import http from 'http';
import path from 'path';
const SITE = process.env.SITE, PROJECT = 'the-final-transmission';
// 정적 서버 (5050: 게임, 5051: 다른 사이트에서 iframe으로 삽입 시도)
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.txt': 'text/plain' };
http.createServer((q, s) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); }); }).listen(5050);
http.createServer((q, s) => { s.writeHead(200, { 'content-type': 'text/html' }); s.end('<html><body><h1>evil</h1><iframe id="f" src="http://127.0.0.1:5050/" width="800" height="600"></iframe></body></html>'); }).listen(5051);
const env = await initializeTestEnvironment({ projectId: PROJECT, firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 } });
const admin = async (fn) => { let out; await env.withSecurityRulesDisabled(async c => { out = await fn(c.firestore()); }); return out; };
// 캐릭터는 공개 문서(survivors)와 내 상태(private/state) 중 저장 번호가 큰 쪽이 최신
const cur = (k) => admin(async db => { const a = (await getDoc(doc(db, 'survivors/' + k))).data(), b = (await getDoc(doc(db, 'survivors/' + k + '/private/state'))).data(); return !a || !b ? a || b : (+b.rev || 0) > (+a.rev || 0) ? b : a; });
const edit = async (k, fn) => { const d = await cur(k); fn(d); d.rev = (+d.rev || 0) + 1; d.sess = 'admin'; await admin(async db => { await setDoc(doc(db, 'survivors/' + k), d); await setDoc(doc(db, 'survivors/' + k + '/private/state'), d); }); };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const results = []; const ok = (n, v, extra = '') => { results.push((v ? '✔ ' : '✘ ') + n + (extra ? ' — ' + extra : '')); };
const csp = [], pageErrs = [];
async function player(id, name) {
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
  const p = await ctx.newPage();
  p.on('console', m => { const t = m.text(); if (/Content Security Policy|Refused to/.test(t)) csp.push(id + ': ' + t.slice(0, 200)); });
  p.on('pageerror', e => pageErrs.push(id + ': ' + e.message));
  await p.goto('http://127.0.0.1:5050/');
  await p.evaluate(() => document.addEventListener('securitypolicyviolation', e => { window.__csp = (window.__csp || []).concat(e.violatedDirective + ' ' + e.blockedURI); }));
  await p.click('#authTabSignup'); await p.fill('#suId', id); await p.fill('#suPw', 'abcdef12'); await p.fill('#suPw2', 'abcdef12'); await p.fill('#suName', name); await p.click('#signupBtn');
  await p.waitForSelector('#actionsCard', { state: 'visible', timeout: 20000 });
  // 새 소식 팝업은 테스트 동작을 가리지 않게 바로 닫는다
  await p.evaluate(() => setInterval(() => { const b = document.querySelector('#popupBox'); if (b && !b.hidden) document.querySelector('#popupClose').click(); }, 300));
  await p.waitForTimeout(1500);
  return { p, ctx };
}
const skip = async (p, min) => { await p.evaluate((m) => { const o = Date.now; Date.now = () => o() + m * 60000; }, min); await p.waitForTimeout(2500); };
try {
  const A = await player('alice1', '앨리스'), B = await player('bob1', '밥'), C = await player('akdma0528', '관리자');
  const closePops = async () => { for (const P of [A, B, C]) await P.p.evaluate(() => { const b = document.querySelector('#popupBox'); if (b && !b.hidden) document.querySelector('#popupClose').click(); }).catch(() => {}); await A.p.waitForTimeout(300); };
  const users = await admin(async db => (await getDocs(collection(db, 'users'))).docs.map(d => Object.assign({ uid: d.id }, d.data())));
  const ua = users.find(u => u.id === 'alice1'), ub = users.find(u => u.id === 'bob1');
  ok('세 명 가입·캐릭터 생성', users.length === 3 && (await admin(async db => (await getDocs(collection(db, 'survivors'))).size)) === 3);
  // 같은 거리로 옮기고 물자 지급 → 새로고침
  for (const u of [ua, ub]) await edit(u.key, d => { d.loc = 'dtla'; d.spot = null; d.visited = ['dtla']; d.inv = { beans: 5, water: 5, scrap: 2, fuel: 2 }; d.busy = null; d.event = null; });
  await A.p.reload(); await B.p.reload();
  await A.p.waitForSelector('#actionsCard', { state: 'visible', timeout: 20000 }); await B.p.waitForSelector('#actionsCard', { state: 'visible', timeout: 20000 });
  await A.p.waitForTimeout(2000);
  // 1) 무전
  await A.p.fill('#chatInput', 'e2e 무전 테스트'); await A.p.click('#chatBtn'); await B.p.waitForTimeout(2500);
  ok('무전 송수신', (await B.p.textContent('#chatLog')).includes('e2e 무전 테스트'));
  // 3) 남의 캐릭터 고치기 시도 (브라우저에서 직접)
  const hack = await B.p.evaluate(async (k) => { try { await firebase.firestore().doc('survivors/' + k).set({ name: 'x', hp: 1 }); return 'written'; } catch (e) { return e.code; } }, ua.key);
  ok('남의 캐릭터 수정 차단', hack === 'permission-denied', hack);
  const hack2 = await B.p.evaluate(async () => { try { await firebase.firestore().collection('notices').add({ title: 'x', body: 'y', ts: Date.now() }); return 'written'; } catch (e) { return e.code; } });
  ok('일반 유저 공지 차단', hack2 === 'permission-denied', hack2);
  // 4) 물물교환
  await closePops();
  await A.p.click('#commTalk'); await B.p.click('#commTalk'); await A.p.waitForTimeout(1200);
  await A.p.selectOption('#tgGive', 'beans'); await A.p.selectOption('#tgWant', 'water'); await A.p.click('#tgPost'); await B.p.waitForTimeout(2500);
  const acc = await B.p.$('button[data-taccept]');
  ok('교환 제안이 상대에게 보임', !!acc);
  if (acc) { await acc.click(); await B.p.waitForTimeout(2500); await A.p.waitForTimeout(2000); }
  const tr = await admin(async db => (await getDocs(collection(db, 'trades'))).docs.map(d => d.data()));
  ok('교환 성사·수령 (트랜잭션)', tr.length >= 1 && tr[0].status === 'done' && tr[0].claimed === true, JSON.stringify(tr.map(t => [t.status, t.claimed])));
  const invA = (await cur(ua.key)).inv, invB = (await cur(ub.key)).inv;
  ok('교환 물건 이동', invA.water >= 6 && invB.beans >= 6, 'A water ' + invA.water + ' / B beans ' + invB.beans);
  // 4-2) 그냥 주기 (받을 것: 없음)
  await A.p.selectOption('#tgGive', 'beans'); await A.p.selectOption('#tgWant', '__none'); await A.p.click('#tgPost'); await B.p.waitForTimeout(2500);
  const gb = await B.p.$('button[data-taccept]');
  ok('나눔 제안이 받기 버튼으로 보임', !!gb && (await gb.textContent()).includes('받기'));
  if (gb) { await gb.click(); await B.p.waitForTimeout(2500); await A.p.waitForTimeout(2000); }
  const tr2 = await admin(async db => (await getDocs(collection(db, 'trades'))).docs.map(d => d.data()).filter(t => t.want && t.want.id === ''));
  const invB2 = (await cur(ub.key)).inv;
  ok('나눔 성사', tr2.length === 1 && tr2[0].status === 'done' && tr2[0].claimed === true && invB2.beans >= 7, JSON.stringify(tr2.map(t => [t.status, t.claimed])) + ' B beans ' + invB2.beans);
  const wantOpts = await A.p.$$eval('#tgWant option', os => os.map(o => o.value));
  ok('받을 것 목록이 상대 배낭 물건으로 제한', wantOpts.includes('__none') && wantOpts.includes('beans') && !wantOpts.includes('vaccine'), wantOpts.join(','));
  // 2) 조사 → 저장
  await A.p.click('.spot[data-spot="0"]'); await A.p.click('button[data-point="0"]'); await skip(A.p, 5);
  const aDoc = await cur(ua.key);
  ok('조사 후 저장(내 캐릭터)', aDoc && !aDoc.busy && Object.keys(aDoc.searched || {}).length > 0);
  await closePops();
  // 5) 쉘터: 만들기·합류·창고·내보내기
  for (const P of [A.p, B.p]) { await P.click('#tabBtnShelter'); await P.fill('#partyInput', '피난처'); await P.click('#partyBtn'); await P.waitForTimeout(2000); }
  const sh = await admin(async db => (await getDocs(collection(db, 'shelters'))).docs.map(d => d.data()));
  ok('쉘터 생성', sh.length === 1 && sh[0].name === '피난처');
  await A.p.waitForTimeout(1500);
  const kb = await A.p.$('#shelterMemberList button[data-kick]');
  ok('대장 화면에 내보내기 버튼', !!kb);
  if (kb) { await kb.click(); await A.p.click('#shelterMemberList button[data-kick]'); await A.p.waitForTimeout(3000); await B.p.waitForTimeout(2000); }
  const bDoc = await cur(ub.key);
  ok('내보내진 사람이 스스로 쉘터를 나감', bDoc.party === '', 'party=' + bDoc.party);
  await B.p.fill('#partyInput', '피난처'); await B.p.click('#partyBtn'); await B.p.waitForTimeout(1500);
  ok('내보내진 쉘터 재가입 차단', (await B.p.textContent('#partyMsg')).includes('내보내진'));
  await closePops();
  // 9) 쉘터 창고 넣기 (트랜잭션 + 회원 확인 규칙)
  await A.p.click('#tabBtnShelter'); await A.p.waitForTimeout(800);
  await A.p.selectOption('#storageItem', 'i:beans').catch(() => {}); await A.p.waitForTimeout(300);
  const stIn = await A.p.$('button[data-st="beans"][data-dir="in"]');
  ok('창고 넣기 버튼', !!stIn);
  if (stIn) { await stIn.click(); await A.p.waitForTimeout(2000); }
  const shs = await admin(async db => (await getDocs(collection(db, 'shelters'))).docs.map(d => d.data()));
  ok('쉘터 창고에 들어감', shs[0] && shs[0].storage && shs[0].storage.beans >= 1, JSON.stringify(shs[0] && shs[0].storage));
  const hack3 = await B.p.evaluate(async (id) => { try { await firebase.firestore().doc('shelters/' + id).set({ name: '피난처', storage: { beans: 999 } }); return 'written'; } catch (e) { return e.code; } }, (await admin(async db => (await getDocs(collection(db, 'shelters'))).docs[0].id)));
  ok('쉘터 밖 사람의 창고 조작 차단', hack3 === 'permission-denied', hack3);
  // 10) 메모 남기기
  await edit(ua.key, d => { d.items = { paper: 2, pages: 0, pencil: 1, pen: 0 }; });
  await A.p.reload(); await A.p.waitForSelector('#actionsCard', { state: 'visible', timeout: 20000 }); await A.p.waitForTimeout(1500);
  await A.p.fill('#memoInput', 'e2e 메모'); await A.p.click('#memoBtn'); await A.p.waitForTimeout(1500);
  ok('메모 남기기', (await admin(async db => (await getDocs(collection(db, 'memos'))).docs.map(d => d.data().text))).includes('e2e 메모'));
  // 11) XSS: 악성 이름·소개를 가진 캐릭터가 남의 화면에서 실행되지 않는지
  await edit(ub.key, d => { d.name = '<img src=x onerror="window.__xss=1">'; d.bio = '<script>window.__xss=2</script>'; d.zombieKills = '<img src=y onerror="window.__xss=3">'; });
  await A.p.click('#tabBtnBoard'); await A.p.waitForTimeout(2500);
  const x = await A.p.evaluate(() => window.__xss || 0);
  ok('악성 이름·소개 실행 안 됨 (XSS)', x === 0, 'xss=' + x);
  await edit(ub.key, d => { d.name = '밥'; d.bio = ''; });
  // 6) 관리자: 공지·백업·복원·오류 기록
  await C.p.click('#tabBtnGuide'); await C.p.fill('#noticeTitle', 'e2e 공지'); await C.p.fill('#noticeBody', '내용'); await C.p.click('#noticeBtn'); await C.p.waitForTimeout(1500);
  ok('관리자 공지 등록', (await admin(async db => (await getDocs(collection(db, 'notices'))).size)) === 1);
  await closePops();
  await C.p.click('#tabBtnAdmin'); await C.p.waitForTimeout(800);
  const [dl] = await Promise.all([C.p.waitForEvent('download', { timeout: 20000 }), C.p.click('#backupBtn')]);
  const file = await dl.path(); const bk = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok('백업 내보내기', bk.app === 'last-radio' && Object.keys(bk.data.survivors).length === 3, 'survivors ' + Object.keys(bk.data.survivors).length + ', logs ' + Object.keys(bk.logs).length);
  // 복원 테스트: 앨리스 체력을 망가뜨린 뒤 백업으로 되돌리기
  await edit(ua.key, d => { d.hp = 3; });
  C.p.once('dialog', d => d.accept());
  await C.p.setInputFiles('#restoreInput', file); await C.p.waitForTimeout(4000);
  const msg = await C.p.textContent('#adminMsg'); const hpBack = (await cur(ua.key)).hp;
  ok('백업에서 복원', /복원 완료/.test(msg) && !/실패/.test(msg) && hpBack === bk.data.survivors[ua.key].hp, msg + ' / hp ' + hpBack);
  // 아이템 지급: 관리자가 앨리스에게 백신 2개, 전체 배포로 생수 3개
  C.p.once('dialog', d => d.accept());
  await C.p.selectOption('#giftItem', 'i:vaccine'); await C.p.fill('#giftQty', '2');
  await C.p.check('#giftTargets input[data-gk="' + ua.key + '"]'); await C.p.click('#giftBtn'); await C.p.waitForTimeout(2500);
  C.p.once('dialog', d => d.accept());
  await C.p.selectOption('#giftItem', 'i:water'); await C.p.fill('#giftQty', '3'); await C.p.click('#giftAllBtn'); await C.p.waitForTimeout(4000);
  const gA = (await cur(ua.key)), gB = (await cur(ub.key));
  ok('관리자 아이템 지급', (+gA.inv.vaccine || 0) >= 2 && (+gB.inv.water || 0) >= 3 && !(+gB.inv.vaccine), 'A vaccine ' + gA.inv.vaccine + ' water ' + gA.inv.water + ' / B water ' + gB.inv.water + ' · ' + await C.p.textContent('#adminMsg'));
  const aLog = await A.p.evaluate(() => [...document.querySelectorAll('#myLog .txt')].slice(0, 6).map(x => x.textContent).join(' | '));
  ok('지급 받은 사람 일지', /관리자에게서/.test(aLog), aLog.slice(0, 160));
  await C.p.click('#errLoadBtn'); await C.p.waitForTimeout(1500);
  await closePops();
  // 문의 게시판: 앨리스가 글을 올리고 관리자가 답변
  await A.p.click('#tabBtnAsk'); await A.p.fill('#askText', 'e2e 버그 제보'); await A.p.click('#askBtn'); await A.p.waitForTimeout(2000);
  C.p.once('dialog', d => d.accept('확인했어요'));
  await C.p.click('#tabBtnAsk'); await C.p.waitForTimeout(1500); await C.p.click('button[data-askreply]'); await C.p.waitForTimeout(2000);
  const reps = await admin(async db => (await getDocs(collection(db, 'reports'))).docs.map(d => d.data()));
  ok('문의 게시판 글·답변', reps.length === 1 && reps[0].reply === '확인했어요' && reps[0].status === 'done', JSON.stringify(reps).slice(0, 160));
  await closePops();
  // 친구: 앨리스가 밥에게 신청 → 밥 수락 → 반지 1개씩으로 배우자
  await A.p.click('#tabBtnChar'); await A.p.click('#friendCard button[data-frv="find"]'); await A.p.waitForTimeout(500);
  await A.p.click('#friendBody button[data-fradd="' + ub.key + '"]'); await A.p.waitForTimeout(2000);
  const fid = 'f_' + [ua.key, ub.key].sort().join('_');
  let fd = await admin(async db => (await getDoc(doc(db, 'friends/' + fid))).data());
  ok('친구 신청', fd && fd.st === 'wait' && fd.from === ua.key, JSON.stringify(fd));
  await B.p.click('#tabBtnChar'); await B.p.waitForTimeout(800);
  const dot = await B.p.isVisible('#friendDot');
  await B.p.click('#friendCard button[data-frv="req"]'); await B.p.waitForTimeout(500); await B.p.click('#friendBody button[data-frok]'); await B.p.waitForTimeout(2000);
  fd = await admin(async db => (await getDoc(doc(db, 'friends/' + fid))).data());
  ok('친구 수락 (알림 점 표시)', fd && fd.st === 'ok' && dot, JSON.stringify(fd) + ' dot ' + dot);
  for (const u of [ua, ub]) await edit(u.key, d => { d.inv = Object.assign({}, d.inv, { ring: 1 });  });
  await A.p.waitForTimeout(2500); await B.p.waitForTimeout(500);
  await A.p.click('#friendCard button[data-frv="list"]'); await A.p.waitForTimeout(500);
  await A.p.evaluate(() => { document.querySelector('#friendBody details').open = true; });
  await A.p.selectOption('#friendBody select[data-frsel]', 'spouse');
  A.p.once('dialog', d => d.accept());
  await A.p.click('#friendBody button[data-frrel]'); await A.p.waitForTimeout(2500);
  fd = await admin(async db => (await getDoc(doc(db, 'friends/' + fid))).data());
  ok('배우자 신청 (반지 맡김)', fd.req && fd.req.type === 'spouse' && fd.req.ring === 1, JSON.stringify(fd.req) + ' ' + await A.p.textContent('#friendMsg'));
  await B.p.click('#friendCard button[data-frv="list"]'); await B.p.waitForTimeout(800); await B.p.click('#friendBody button[data-frrel-ok]'); await B.p.waitForTimeout(3000);
  fd = await admin(async db => (await getDoc(doc(db, 'friends/' + fid))).data());
  const sA = await cur(ua.key), sB = await cur(ub.key);
  ok('배우자 성사 (반지 소모)', fd.rel === 'spouse' && !fd.req && !(+sA.inv.ring) && !(+sB.inv.ring) && sA.spouse === ub.key && sB.spouse === ua.key, JSON.stringify([fd.rel, sA.inv.ring, sB.inv.ring, sA.spouse, sB.spouse]));
  // 무기 분해: 야구방망이 → 고철 1
  const scrap0 = +sA.inv.scrap || 0;
  A.p.once('dialog', d => d.accept());
  await A.p.click('#scrapList button[data-scrap="야구방망이"]'); await A.p.waitForTimeout(2000);
  const sA2 = await cur(ua.key);
  ok('무기 분해', !sA2.weapons.includes('야구방망이') && (+sA2.inv.scrap || 0) === scrap0 + 1, JSON.stringify([sA2.weapons, sA2.inv.scrap]));
  await closePops();
  // 생존자끼리: 구조 요청 → 응급치료(보상) · 동행 · 묘비 꽃
  await edit(ub.key, d => { d.hp = 30; d.loc = 'dtla'; d.busy = null; d.event = null; });
  await edit(ua.key, d => { d.inv = Object.assign({}, d.inv, { bandage: 3, green_herb: 2 }); d.loc = 'dtla'; d.busy = null; d.event = null; });
  await A.p.reload(); await B.p.reload(); await A.p.waitForTimeout(2500); await B.p.waitForTimeout(500);
  await A.p.click('#tabBtnPlay').catch(() => {}); await B.p.click('#tabBtnPlay').catch(() => {});
  await B.p.click('#nearBox button[data-nsos="on"]'); await B.p.waitForTimeout(3000);
  const sosVis = await A.p.isVisible('#nearBox .sos-tag');
  await A.p.selectOption('#nearMed', 'green_herb'); await A.p.click('#nearBox button[data-nheal="' + ub.key + '"]'); await A.p.waitForTimeout(3500);
  const hB = await cur(ub.key), hA = await cur(ua.key);
  ok('구조 요청·응급치료·보상', sosVis && hB.hp >= 40 && (+hA.inv.coin || 0) >= 3 && !(+hA.inv.green_herb > 1), 'sos ' + sosVis + ' B hp ' + hB.hp + ' A coin ' + hA.inv.coin + ' herb ' + hA.inv.green_herb);
  await A.p.click('#nearBox button[data-nparty="' + ub.key + '"]'); await B.p.waitForTimeout(3000);
  await B.p.click('#nearBox button[data-ninv][data-ok]'); await A.p.waitForTimeout(3500);
  const pA = await cur(ua.key), pB = await cur(ub.key);
  ok('동행 신청·수락', pA.buddy && pA.buddy.key === ub.key && pB.buddy && pB.buddy.key === ua.key, JSON.stringify([pA.buddy, pB.buddy]));
  const gid = await admin(async db => { await setDoc(doc(db, 'graves/gtest'), { key: ub.key, name: '밥', loc: 'dtla', epitaph: '', turned: false, days: 1, kills: 0, day: 1, ts: Date.now() }); return 'gtest'; });
  await A.p.waitForTimeout(2000); await A.p.click('#tabBtnComm').catch(() => {}); await A.p.waitForTimeout(500);
  await A.p.evaluate((g) => { const b = document.querySelector('button[data-flower="' + g + '"]'); if (b) b.click(); }, gid); await A.p.waitForTimeout(3000);
  const gd = await admin(async db => (await getDoc(doc(db, 'graves/gtest'))).data());
  const bLog = await B.p.evaluate(() => [...document.querySelectorAll('#myLog .txt')].slice(0, 6).map(x => x.textContent).join(' | '));
  ok('묘비 꽃 (받는 사람 일지)', gd.flowers === 1 && /꽃을 놓고/.test(bLog), 'flowers ' + gd.flowers + ' / ' + bLog.slice(0, 160));
  await closePops();
  // 저장 실패 경고: 연결이 끊기면 15초 뒤 경고, 다시 연결되면 사라진다
  await B.p.click('#tabBtnPlay').catch(() => {});
  await B.p.evaluate(() => firebase.firestore().disableNetwork());
  await B.p.click('#restBtn'); await B.p.waitForTimeout(17000);
  const warnOn = await B.p.isVisible('#saveWarn'), warnTxt = await B.p.textContent('#saveWarnText');
  await B.p.evaluate(() => firebase.firestore().enableNetwork()); await B.p.waitForTimeout(4000);
  const warnOff = !(await B.p.isVisible('#saveWarn')), bSt = await cur(ub.key);
  ok('저장 실패 경고 표시·해제', warnOn && warnOff && bSt.busy && /휴식/.test(bSt.busy.label), warnTxt + ' / off ' + warnOff + ' / ' + JSON.stringify(bSt.busy && bSt.busy.label));
  // 공개 문서는 남에게 보이는 게 안 바뀌면 바로 쓰지 않는다 (읽기 절약)
  const pubB = await admin(async db => (await getDoc(doc(db, 'survivors/' + ub.key))).data());
  ok('공개 문서 쓰기 줄이기', (+pubB.rev || 0) < (+bSt.rev || 0), 'pub ' + pubB.rev + ' / state ' + bSt.rev);
  // 같은 아이디로 두 번째 기기: 두 번째 기기에서 휴식을 시작하면, 첫 기기가 그 기록을 덮어쓰지 않아야 한다
  { const ctx2 = await browser.newContext({ viewport: { width: 400, height: 800 } }); const A2 = await ctx2.newPage();
    A2.on('pageerror', e => pageErrs.push('A2: ' + e.message));
    await A2.goto('http://127.0.0.1:5050/'); await A2.click('#authTabLogin').catch(() => {}); await A2.fill('#loginId', 'alice1'); await A2.fill('#loginPw', 'abcdef12'); await A2.click('#loginBtn');
    await A2.waitForSelector('#actionsCard', { state: 'visible', timeout: 20000 }); await A2.evaluate(() => setInterval(() => { const b = document.querySelector('#popupBox'); if (b && !b.hidden) document.querySelector('#popupClose').click(); }, 300)); await A2.waitForTimeout(1500);
    await A2.click('#tabBtnPlay').catch(() => {}); await A2.click('#restBtn'); await A2.waitForTimeout(2500);
    await A.p.click('#tabBtnPlay').catch(() => {}); await A.p.click('#forageBtn').catch(() => {}); await A.p.waitForTimeout(2500);
    const sv = await cur(ua.key);
    ok('다른 기기 기록을 덮어쓰지 않음', sv.busy && /휴식/.test(sv.busy.label), JSON.stringify(sv.busy && sv.busy.label) + ' rev ' + sv.rev);
    await ctx2.close(); }
  const errs = await admin(async db => (await getDocs(collection(db, 'errors'))).docs.map(d => d.data().msg));
  ok('오류 기록 (권한·저장 오류 없음)', !errs.some(m => /permission|saveDoc/i.test(m)), JSON.stringify(errs).slice(0, 300));
  const ws = await admin(async db => (await getDoc(doc(db, 'world/state'))).data());
  ok('지역 상태 문서 저장', ws && ws.tick > 0 && Object.keys(ws.r).length === 131, Object.keys(ws.r).length);
  // 7) 클릭재킹: 다른 사이트 iframe 안에서 열기
  const E = await browser.newPage();
  await E.goto('http://localhost:5051/'); await E.waitForTimeout(2500);
  const fr = E.frames().find(f => f.url().startsWith('http://127.0.0.1:5050'));
  const hidden = fr ? await fr.evaluate(() => getComputedStyle(document.documentElement).display === 'none').catch(() => true) : true;
  ok('iframe 삽입 시 화면 숨김', E.url().startsWith('http://127.0.0.1:5050') || hidden, 'top=' + E.url() + ' hidden=' + hidden);
  // 8) CSP 위반 없음
  const v = [];
  for (const P of [A.p, B.p, C.p]) v.push(...(await P.evaluate(() => window.__csp || [])));
  ok('CSP 위반 없음', !v.length && !csp.length, JSON.stringify(v.concat(csp)).slice(0, 400));
  ok('페이지 오류 없음', !pageErrs.length, JSON.stringify(pageErrs).slice(0, 400));
} catch (e) { results.push('✘ 시나리오 오류: ' + e.message.slice(0, 300)); }
console.log(results.join('\n'));
await browser.close(); await env.cleanup(); process.exit(0);
