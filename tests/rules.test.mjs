import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, updateDoc, collection, addDoc, getDocs } from 'firebase/firestore';
import fs from 'fs';
const env = await initializeTestEnvironment({ projectId: 'demo-lr', firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 } });
let pass = 0, fail = 0; const bad = [];
async function t(name, p) { try { await p; pass++; } catch (e) { fail++; bad.push(name + ' :: ' + (e && e.message || e).slice(0, 160)); } }
const ok = (n, p) => t('OK ' + n, assertSucceeds(p));
const no = (n, p) => t('NO ' + n, assertFails(p));
const A = env.authenticatedContext('alice').firestore(), B = env.authenticatedContext('bob').firestore(), ADM = env.authenticatedContext('adm').firestore(), ANON = env.unauthenticatedContext().firestore();
const surv = (name, extra = {}) => Object.assign({ name, hp: 100, day: 5, party: '', bio: '', epitaph: null, key: '' }, extra);
const now = Date.now();
// users
await ok('alice users', setDoc(doc(A, 'users/alice'), { id: 'alice1', name: '앨리스', key: 'uid-alice', createdAt: now }));
await ok('bob users', setDoc(doc(B, 'users/bob'), { id: 'bob1', name: '밥', key: 'uid-bob', createdAt: now }));
await ok('adm users', setDoc(doc(ADM, 'users/adm'), { id: 'AKDMA0528', name: '관리', key: 'uid-adm', createdAt: now }));
await no('bob writes alice users', setDoc(doc(B, 'users/alice'), { id: 'x', name: 'x', key: 'uid-alice' }));
await no('users wrong key', setDoc(doc(A, 'users/alice'), { id: 'alice1', name: '앨리스', key: 'uid-bob' }));
await no('anon read survivors', getDoc(doc(ANON, 'survivors/uid-alice')));
// survivors
await ok('alice own survivor', setDoc(doc(A, 'survivors/uid-alice'), surv('앨리스')));
await ok('bob own survivor', setDoc(doc(B, 'survivors/uid-bob'), surv('밥')));
await no('bob edits alice', setDoc(doc(B, 'survivors/uid-alice'), surv('앨리스', { hp: 1 })));
await no('alice hp 999', setDoc(doc(A, 'survivors/uid-alice'), surv('앨리스', { hp: 999 })));
await no('alice long name', setDoc(doc(A, 'survivors/uid-alice'), surv('x'.repeat(40))));
await ok('admin revives alice', setDoc(doc(ADM, 'survivors/uid-alice'), surv('앨리스', { hp: 100 })));
await ok('bob reads alice', getDoc(doc(B, 'survivors/uid-alice')));
await ok('alice log', setDoc(doc(A, 'survivors/uid-alice/private/log'), { entries: [] }));
await no('bob writes alice log', setDoc(doc(B, 'survivors/uid-alice/private/log'), { entries: [] }));
await no('bob reads alice log', getDoc(doc(B, 'survivors/uid-alice/private/log')));
await ok('admin writes alice log', setDoc(doc(ADM, 'survivors/uid-alice/private/log'), { entries: [{ t: 1 }] }));
await no('bob deletes alice', deleteDoc(doc(B, 'survivors/uid-alice')));
// avatars
await ok('alice avatar', setDoc(doc(A, 'avatars/uid-alice'), { data: 'data:image/jpeg;base64,AAAA', ts: now }));
await no('alice avatar svg', setDoc(doc(A, 'avatars/uid-alice'), { data: 'data:image/svg+xml;base64,AAAA', ts: now }));
await no('bob writes alice avatar', setDoc(doc(B, 'avatars/uid-alice'), { data: 'data:image/jpeg;base64,AAAA', ts: now }));
await no('alice avatar huge', setDoc(doc(A, 'avatars/uid-alice'), { data: 'data:image/jpeg;base64,' + 'A'.repeat(80000), ts: now }));
// chat
const msg = (key, text = '안녕', ts = now) => ({ author: '앨리스', authorKey: key, text, ts, loc: 'dtla', day: 5 });
let r1; await t('OK radio create', (async () => { r1 = await assertSucceeds(addDoc(collection(A, 'radio'), msg('uid-alice'))); })());
await no('radio fake author', addDoc(collection(A, 'radio'), msg('uid-bob')));
await no('radio long text', addDoc(collection(A, 'radio'), msg('uid-alice', 'x'.repeat(300))));
await ok('radio ch', addDoc(collection(A, 'radio-ch100.1'), msg('uid-alice')));
await ok('talk', addDoc(collection(A, 'talk-dtla-street'), msg('uid-alice')));
await ok('shelter chat', addDoc(collection(A, 'shelter-u616263'), msg('uid-alice')));
await no('random coll', addDoc(collection(A, 'foo'), msg('uid-alice')));
await no('radio update', updateDoc(doc(A, 'radio/' + r1.id), { text: '수정' }));
await no('bob deletes alice recent radio', deleteDoc(doc(B, 'radio/' + r1.id)));
await ok('read radio', getDocs(collection(B, 'radio')));
let old; await env.withSecurityRulesDisabled(async c => { const r = await addDoc(collection(c.firestore(), 'radio'), msg('uid-alice', '옛날', now - 4 * 864e5)); old = r.id; });
await ok('bob prunes old radio', deleteDoc(doc(B, 'radio/' + old)));
await ok('alice deletes own', deleteDoc(doc(A, 'radio/' + r1.id)));
let r2 = await addDoc(collection(A, 'radio'), msg('uid-alice'));
await ok('admin deletes radio', deleteDoc(doc(ADM, 'radio/' + r2.id)));
// memos
const mm = await addDoc(collection(A, 'memos'), { loc: 'dtla', text: '메모', author: '앨리스', authorKey: 'uid-alice', day: 5, ts: now, ink: 'pen', surface: 'paper' });
await no('memo fake author', addDoc(collection(B, 'memos'), { loc: 'dtla', text: '메모', author: '밥', authorKey: 'uid-alice', day: 5, ts: now }));
await no('bob deletes alice memo', deleteDoc(doc(B, 'memos/' + mm.id)));
await ok('alice deletes own memo', deleteDoc(doc(A, 'memos/' + mm.id)));
// trades
const tr = { fromKey: 'uid-alice', from: '앨리스', loc: 'dtla', spot: null, give: { id: 'beans', n: 2 }, want: { id: 'water', n: 1 }, status: 'open', ts: now };
await no('trade fake from', addDoc(collection(B, 'trades'), tr));
const td = await addDoc(collection(A, 'trades'), tr);
await no('bob changes give', setDoc(doc(B, 'trades/' + td.id), Object.assign({}, tr, { give: { id: 'ammo', n: 99 } })));
await no('bob cancels alice trade', setDoc(doc(B, 'trades/' + td.id), Object.assign({}, tr, { status: 'cancel', claimed: true })));
await no('bob accepts as alice', setDoc(doc(B, 'trades/' + td.id), Object.assign({}, tr, { status: 'done', acceptKey: 'uid-alice', acceptName: 'x', doneTs: now, claimed: false })));
await ok('bob accepts', setDoc(doc(B, 'trades/' + td.id), Object.assign({}, tr, { status: 'done', acceptKey: 'uid-bob', acceptName: '밥', doneTs: now, claimed: false })));
await no('bob re-accepts done', setDoc(doc(B, 'trades/' + td.id), Object.assign({}, tr, { status: 'done', acceptKey: 'uid-bob', acceptName: '밥2', doneTs: now, claimed: false })));
await ok('alice claims', setDoc(doc(A, 'trades/' + td.id), Object.assign({}, tr, { status: 'done', acceptKey: 'uid-bob', acceptName: '밥', doneTs: now, claimed: true })));
await ok('gift trade', addDoc(collection(A, 'trades'), Object.assign({}, tr, { want: { id: '', n: 0 } })));
await no('want 0 with item', addDoc(collection(A, 'trades'), Object.assign({}, tr, { want: { id: 'water', n: 0 } })));
const td2 = await addDoc(collection(A, 'trades'), tr);
await ok('alice cancels own', setDoc(doc(A, 'trades/' + td2.id), Object.assign({}, tr, { status: 'cancel', claimed: true })));
// shelters
await ok('alice creates shelter', setDoc(doc(A, 'shelters/s1'), { name: '피난처', founder: '앨리스', founderKey: 'uid-alice', notice: '', policy: 'open', invited: [], storage: {}, createdAt: now }));
await no('alice not member yet', setDoc(doc(A, 'shelters/s1'), { name: '피난처', notice: 'x', storage: { beans: 99 } }));
await setDoc(doc(A, 'survivors/uid-alice'), surv('앨리스', { party: '피난처' }));
await ok('alice member updates', setDoc(doc(A, 'shelters/s1'), { name: '피난처', founder: '앨리스', founderKey: 'uid-alice', notice: '공지', policy: 'open', invited: [], storage: { beans: 3 }, createdAt: now }));
await no('alice renames shelter', setDoc(doc(A, 'shelters/s1'), { name: '다른곳', storage: {} }));
await no('bob outsider updates', setDoc(doc(B, 'shelters/s1'), { name: '피난처', storage: {} }));
await ok('admin updates shelter', setDoc(doc(ADM, 'shelters/s1'), { name: '피난처', founder: '앨리스', founderKey: 'uid-alice', storage: { beans: 3 }, kicked: ['uid-bob'] }));
// graves
await ok('own grave', addDoc(collection(A, 'graves'), { loc: 'dtla', name: '앨리스', key: 'uid-alice', epitaph: '안녕', turned: false, days: 3, kills: 1, day: 5, ts: now }));
await no('fake grave', addDoc(collection(B, 'graves'), { loc: 'dtla', name: '앨리스', key: 'uid-alice', epitaph: '', ts: now }));
// notices
await no('alice notice', addDoc(collection(A, 'notices'), { title: 'x', body: 'y', ts: now }));
await ok('admin notice', addDoc(collection(ADM, 'notices'), { title: 'x', body: 'y', ts: now }));
// world & region events
await ok('world state', setDoc(doc(A, 'world/state'), { v: 1, tick: 5, r: { dtla: { z: 70 } } }));
await no('world extra key', setDoc(doc(A, 'world/state'), { v: 1, tick: 5, r: {}, hack: 1 }));
await no('world other doc', setDoc(doc(A, 'world/other'), { v: 1, tick: 5, r: {} }));
await ok('world frontier open', setDoc(doc(A, 'world/state'), { v: 1, tick: 5, r: {}, f: { open: 1, names: ['a'], ts: 1 } }));
await no('world frontier close', setDoc(doc(A, 'world/state'), { v: 1, tick: 6, r: {}, f: { open: 0, names: [], ts: 1 } }));
await no('world frontier drop', setDoc(doc(A, 'world/state'), { v: 1, tick: 6, r: {} }));
await no('world frontier too far', setDoc(doc(A, 'world/state'), { v: 1, tick: 6, r: {}, f: { open: 9, names: [], ts: 1 } }));
await ok('merchant sale', setDoc(doc(A, 'merchantSales/la-10'), { by: 'uid-alice', name: '앨리스', day: 10, ts: 1 }));
await no('merchant sale again', setDoc(doc(B, 'merchantSales/la-10'), { by: 'uid-bob', name: '밥', day: 10, ts: 2 }));
await no('merchant sale as other', setDoc(doc(B, 'merchantSales/la-11'), { by: 'uid-alice', name: '밥', day: 11, ts: 2 }));
await ok('npc claim', setDoc(doc(A, 'npcClaims/c1'), { by: 'uid-alice', name: '사라 킴', kind: 'journalist', ts: 1 }));
await no('npc claim taken', setDoc(doc(B, 'npcClaims/c1'), { by: 'uid-bob', name: '사라 킴', kind: 'journalist', ts: 2 }));
await no('npc claim delete other', deleteDoc(doc(B, 'npcClaims/c1')));
await ok('npc claim delete own', deleteDoc(doc(A, 'npcClaims/c1')));
const ev = { kind: 'noise', loc: 'dtla', a: 15, day: 5, ts: now, cid: 'abc', by: 'uid-alice' };
const e1 = await assertSucceeds(addDoc(collection(A, 'regionEvents'), ev)).catch(e => { bad.push('OK regionEvent ' + e.message); return null; }); if (e1) pass++; else fail++;
await no('region a=100', addDoc(collection(A, 'regionEvents'), Object.assign({}, ev, { a: 100 })));
await no('region bad kind', addDoc(collection(A, 'regionEvents'), Object.assign({}, ev, { kind: 'nuke' })));
await no('region fake by', addDoc(collection(A, 'regionEvents'), Object.assign({}, ev, { by: 'uid-bob' })));
if (e1) await ok('bob deletes region event', deleteDoc(doc(B, 'regionEvents/' + e1.id)));
// errors
await ok('error create', addDoc(collection(A, 'errors'), { msg: 'boom', src: 'x', line: 1, stack: 's', ua: 'u', key: 'uid-alice', name: 'a', ts: now }));
await no('alice reads errors', getDocs(collection(A, 'errors')));
await ok('admin reads errors', getDocs(collection(ADM, 'errors')));
// misc collections denied
await no('accounts coll', setDoc(doc(A, 'accounts/x'), { a: 1 }));
console.log('PASS', pass, 'FAIL', fail); bad.forEach(b => console.log('  ✗', b));
await env.cleanup();
