/**
 * tests/test.mjs
 * himawari 保育日誌システム — ユニットテスト
 * 実行: node tests/test.mjs
 */
import assert from 'assert/strict';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('✅', name);
    passed++;
  } catch (e) {
    console.error('❌', name + ':', e.message);
    failed++;
  }
}
async function testAsync(name, fn) {
  try {
    await fn();
    console.log('✅', name);
    passed++;
  } catch (e) {
    console.error('❌', name + ':', e.message);
    failed++;
  }
}

// ================================================================
// SECTION 1: 純粋関数 — esc(), toFSVal/fromFSVal, getUserGrade
// ================================================================

function esc(s){if(!s)return '';return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');}

test('esc: < > をエスケープする', () => {
  assert.equal(esc('<b>test</b>'), '&lt;b&gt;test&lt;/b&gt;');
});
test('esc: & をエスケープする', () => {
  assert.equal(esc('A & B'), 'A &amp; B');
});
test('esc: 改行を <br> に変換する', () => {
  assert.equal(esc('line1\nline2'), 'line1<br>line2');
});
test('esc: null を空文字として返す', () => {
  assert.equal(esc(null), '');
});
test('esc: undefined を空文字として返す', () => {
  assert.equal(esc(undefined), '');
});

function toFSVal(v){
  if(v===null||v===undefined) return {nullValue:null};
  if(typeof v==='boolean') return {booleanValue:v};
  if(typeof v==='number') return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};
  if(typeof v==='string') return {stringValue:v};
  if(Array.isArray(v)) return {arrayValue:{values:v.length?v.map(toFSVal):[]}};
  if(typeof v==='object') return {mapValue:{fields:toFSFields(v)}};
  return {stringValue:String(v)};
}
function toFSFields(obj){
  const f={};
  for(const [k,v] of Object.entries(obj)) if(v!==undefined) f[k]=toFSVal(v);
  return f;
}
function fromFSVal(v){
  if(!v) return null;
  if('nullValue' in v) return null;
  if('booleanValue' in v) return v.booleanValue;
  if('integerValue' in v) return parseInt(v.integerValue);
  if('doubleValue' in v) return v.doubleValue;
  if('stringValue' in v) return v.stringValue;
  if('arrayValue' in v) return (v.arrayValue.values||[]).map(fromFSVal);
  if('mapValue' in v) return fromFSFields(v.mapValue.fields||{});
  return null;
}
function fromFSFields(fields){ const o={}; for(const [k,v] of Object.entries(fields)) o[k]=fromFSVal(v); return o; }
function fromFSDoc(doc){ return doc.fields?fromFSFields(doc.fields):{}; }

test('toFSVal: string', () => {
  assert.deepEqual(toFSVal('hello'), {stringValue:'hello'});
});
test('toFSVal: integer', () => {
  assert.deepEqual(toFSVal(42), {integerValue:'42'});
});
test('toFSVal: boolean true', () => {
  assert.deepEqual(toFSVal(true), {booleanValue:true});
});
test('toFSVal: null', () => {
  assert.deepEqual(toFSVal(null), {nullValue:null});
});
test('toFSVal: array', () => {
  const r=toFSVal(['a','b']);
  assert.equal(r.arrayValue.values.length, 2);
  assert.equal(r.arrayValue.values[0].stringValue, 'a');
});
test('toFSVal/fromFSVal ラウンドトリップ: string', () => {
  assert.equal(fromFSVal(toFSVal('園長')), '園長');
});
test('toFSVal/fromFSVal ラウンドトリップ: integer', () => {
  assert.equal(fromFSVal(toFSVal(99)), 99);
});
test('toFSVal/fromFSVal ラウンドトリップ: object', () => {
  const obj={name:'田中',role:'senior',pin:'1234'};
  assert.deepEqual(fromFSVal(toFSVal(obj)), obj);
});
test('fromFSDoc: fields なし→空オブジェクト', () => {
  assert.deepEqual(fromFSDoc({}), {});
});

// ================================================================
// SECTION 2: getUserGrade / getOrderedUsers
// ================================================================

function getUserGrade(u){
  if(u.grade!==undefined&&u.grade!==null) return u.grade;
  if(['senior','middle','junior','sesame'].includes(u.role)) return u.role;
  return null;
}
function getOrderedUsers(users, loginOrder){
  if(!loginOrder) return null;
  const remaining=[...users];
  const res=[];
  loginOrder.forEach(uid=>{ const i=remaining.findIndex(u=>u.id===uid); if(i!==-1)res.push(remaining.splice(i,1)[0]); });
  return [...res,...remaining];
}

const sampleUsers=[
  {id:'u1',name:'園長',role:'principal'},
  {id:'u2',name:'田中',role:'senior'},
  {id:'u3',name:'鈴木',role:'middle'},
];

test('getUserGrade: grade フィールドがあればそれを返す', () => {
  assert.equal(getUserGrade({grade:'senior',role:'head_teacher'}), 'senior');
});
test('getUserGrade: grade なし→role が年齢クラスならそれを返す', () => {
  assert.equal(getUserGrade({role:'middle'}), 'middle');
});
test('getUserGrade: 管理職は null を返す', () => {
  assert.equal(getUserGrade({role:'principal'}), null);
});
test('getUserGrade: grade=null→role にフォールバック', () => {
  assert.equal(getUserGrade({grade:null,role:'junior'}), 'junior');
});
test('getOrderedUsers: loginOrder が null→null を返す', () => {
  assert.equal(getOrderedUsers(sampleUsers, null), null);
});
test('getOrderedUsers: loginOrder に従って並び替え', () => {
  const ordered=getOrderedUsers(sampleUsers,['u3','u1','u2']);
  assert.equal(ordered[0].id,'u3');
  assert.equal(ordered[1].id,'u1');
  assert.equal(ordered[2].id,'u2');
});
test('getOrderedUsers: order にないユーザーは末尾に追加', () => {
  const ordered=getOrderedUsers(sampleUsers,['u2']);
  assert.equal(ordered[0].id,'u2');
  assert.equal(ordered.length, 3);
});

// ================================================================
// SECTION 3: isAdmin() — STEP5修正確認
// ================================================================

function isAdmin(u){return u&&['principal','vice_principal'].includes(u.role);}

test('isAdmin: principal は管理者', () => {
  assert.ok(isAdmin({role:'principal'}));
});
test('isAdmin: vice_principal は管理者', () => {
  assert.ok(isAdmin({role:'vice_principal'}));
});
test('isAdmin: head_teacher は管理者でない (STEP5修正)', () => {
  assert.ok(!isAdmin({role:'head_teacher'}));
});
test('isAdmin: senior は管理者でない', () => {
  assert.ok(!isAdmin({role:'senior'}));
});
test('isAdmin: null は管理者でない', () => {
  assert.ok(!isAdmin(null));
});

// ================================================================
// SECTION 4: canViewEntry() — 主任は自分の記録のみ
// ================================================================

function canViewEntry(u,entry){
  return u&&(['principal','vice_principal'].includes(u.role)||entry.staff===u.name);
}

const eOwn={staff:'田中',date:'2026-01-01'};
const eOther={staff:'鈴木',date:'2026-01-02'};

test('canViewEntry: principal は全員の記録を閲覧可', () => {
  assert.ok(canViewEntry({role:'principal',name:'園長'},eOther));
});
test('canViewEntry: vice_principal は全員の記録を閲覧可', () => {
  assert.ok(canViewEntry({role:'vice_principal',name:'副園長'},eOther));
});
test('canViewEntry: head_teacher は自分の記録のみ (STEP5修正)', () => {
  assert.ok(canViewEntry({role:'head_teacher',name:'田中'},eOwn));
  assert.ok(!canViewEntry({role:'head_teacher',name:'田中'},eOther));
});
test('canViewEntry: senior は自分の記録のみ', () => {
  assert.ok(canViewEntry({role:'senior',name:'田中'},eOwn));
  assert.ok(!canViewEntry({role:'senior',name:'田中'},eOther));
});

// ================================================================
// SECTION 5: Bug① 修正 — addUser/deleteUser の即時ローカル更新
// ================================================================

function makeMockEnv(){
  const store={};
  const ls={
    getItem: k=>store[k]??null,
    setItem: (k,v)=>{store[k]=v;},
    removeItem: k=>{delete store[k];},
    _store: store
  };
  let users=[
    {id:'u1',name:'園長',role:'principal',pin:'1234'},
    {id:'u2',name:'田中',role:'senior',pin:'2222'},
  ];
  let rlCalled=0, rtCalled=0;
  function saveLocal(){ ls.setItem('ls_users',JSON.stringify(users)); }
  function renderLoginUsers(){ rlCalled++; }
  function renderUsersTable(){ rtCalled++; }

  // FIXED addUser
  async function addUser_fixed(name,role,grade,pin,fsSetMock){
    if(!name) return;
    if(users.find(u=>u.name===name)) return;
    const u={id:'u'+Date.now(),name,role,pin:pin||'1234',grade:grade||null};
    await fsSetMock(u);
    users.push(u);
    saveLocal(); renderUsersTable(); renderLoginUsers();
  }

  // FIXED deleteUser
  async function deleteUser_fixed(uid, fsDeleteMock){
    const u=users.find(x=>x.id===uid);
    if(!u) return;
    await fsDeleteMock(uid);
    users=users.filter(x=>x.id!==uid);
    saveLocal(); renderUsersTable(); renderLoginUsers();
  }

  return {
    ls, getUsers:()=>users,
    getRlCalled:()=>rlCalled, getRtCalled:()=>rtCalled,
    addUser_fixed, deleteUser_fixed
  };
}

await testAsync('Bug①: addUser 後に users 配列にユーザーが追加される', async () => {
  const env=makeMockEnv();
  await env.addUser_fixed('新田','junior',null,'5678',async ()=>{});
  assert.equal(env.getUsers().length, 3);
  assert.ok(env.getUsers().find(u=>u.name==='新田'));
});

await testAsync('Bug①: addUser 後に renderLoginUsers() が呼ばれる', async () => {
  const env=makeMockEnv();
  await env.addUser_fixed('テスト太郎','middle',null,'1111',async ()=>{});
  assert.ok(env.getRlCalled()>0, 'renderLoginUsers が呼ばれていない');
});

await testAsync('Bug①: addUser 後に ls_users が更新される', async () => {
  const env=makeMockEnv();
  await env.addUser_fixed('テスト花子','free',null,'2222',async ()=>{});
  const stored=JSON.parse(env.ls.getItem('ls_users'));
  assert.ok(stored.find(u=>u.name==='テスト花子'));
});

await testAsync('Bug①: deleteUser 後に users 配列からユーザーが削除される', async () => {
  const env=makeMockEnv();
  await env.deleteUser_fixed('u2',async ()=>{});
  assert.equal(env.getUsers().length, 1);
  assert.ok(!env.getUsers().find(u=>u.id==='u2'));
});

await testAsync('Bug①: deleteUser 後に renderLoginUsers() が呼ばれる', async () => {
  const env=makeMockEnv();
  await env.deleteUser_fixed('u2',async ()=>{});
  assert.ok(env.getRlCalled()>0, 'renderLoginUsers が呼ばれていない');
});

await testAsync('Bug①: deleteUser 後に ls_users が更新される', async () => {
  const env=makeMockEnv();
  await env.deleteUser_fixed('u2',async ()=>{});
  const stored=JSON.parse(env.ls.getItem('ls_users'));
  assert.ok(!stored.find(u=>u.id==='u2'));
});

// ================================================================
// SECTION 6: Bug② 修正 — init() saveLocal 競合防止
// ================================================================

function makeInitEnv(fsUsersResult, fsEntriesResult){
  const store={};
  const ls={
    getItem:k=>store[k]??null,
    setItem:(k,v)=>{store[k]=v;},
    removeItem:k=>{delete store[k];},
    _store:store
  };
  let users=[];
  let entries=[];

  function loadLocal(){
    const u=ls.getItem('ls_users');
    if(u) users=JSON.parse(u);
  }
  function saveLocal(){
    ls.setItem('ls_users',JSON.stringify(users));
    ls.setItem('ls_entries',JSON.stringify(entries));
  }
  async function initDefaultUsersDb(){
    users=[{id:'u1',name:'園長',role:'principal',pin:'1234'}];
    // ★注意: initDefaultUsersDb内ではsaveLocalを呼ばない
  }

  // 修正後の init() ロジック
  async function init_fixed(){
    loadLocal();
    try{
      const fu=await fsUsersResult();
      if(fu.length){ users=fu; saveLocal(); }
      else if(!users.length){ await initDefaultUsersDb(); }
      const fe=await fsEntriesResult();
      if(fe.length){ entries=fe; if(fu.length) saveLocal(); }  // Bug②修正
    }catch(_){}
  }

  // バグのある init() ロジック（比較用）
  async function init_buggy(){
    loadLocal();
    try{
      const fu=await fsUsersResult();
      if(fu.length){ users=fu; saveLocal(); }
      else if(!users.length){ await initDefaultUsersDb(); }
      const fe=await fsEntriesResult();
      if(fe.length){ entries=fe; saveLocal(); }  // バグ: 無条件saveLocal
    }catch(_){}
  }

  return {ls, getUsers:()=>users, init_fixed, init_buggy};
}

const fullEntries=[{id:1,date:'2026-01-01',staff:'田中',content:'日誌'}];
const fullUsers=[
  {id:'u1',name:'園長',role:'principal',pin:'1234'},
  {id:'u2',name:'田中',role:'senior',pin:'2222'},
];

await testAsync('Bug②[再現]: BUGGYバージョン—users失敗時にentriesのsaveLocalがls_usersを汚染する', async () => {
  const env=makeInitEnv(async ()=>[], async ()=>fullEntries);
  await env.init_buggy();
  const stored=JSON.parse(env.ls.getItem('ls_users')||'[]');
  // バグがある場合はu1のみ
  assert.equal(stored.length, 1, 'BUGGYバージョンではu1のみが保存される');
  assert.equal(stored[0].id,'u1');
});

await testAsync('Bug②[修正]: users取得失敗時にls_usersを書かない', async () => {
  const env=makeInitEnv(async ()=>[], async ()=>fullEntries);
  await env.init_fixed();
  const stored=env.ls.getItem('ls_users');
  assert.equal(stored, null, '修正後はusers取得失敗時にls_usersを書かない');
});

await testAsync('Bug②[修正]: 既存のls_usersはFirestore失敗でも保持される', async () => {
  const env=makeInitEnv(async ()=>[], async ()=>fullEntries);
  env.ls.setItem('ls_users',JSON.stringify(fullUsers));
  await env.init_fixed();
  const stored=JSON.parse(env.ls.getItem('ls_users'));
  assert.equal(stored.length, 2, '既存2ユーザーが保持される');
});

await testAsync('Bug②[修正]: users取得成功時はentriesも含めて保存する', async () => {
  const env=makeInitEnv(async ()=>fullUsers, async ()=>fullEntries);
  await env.init_fixed();
  const storedUsers=JSON.parse(env.ls.getItem('ls_users'));
  const storedEntries=JSON.parse(env.ls.getItem('ls_entries'));
  assert.equal(storedUsers.length, 2, '2ユーザーが保存される');
  assert.equal(storedEntries.length, 1, 'entriesも保存される');
});

await testAsync('Bug②[修正]: 複数タブ競合—一方がusers失敗でもls_usersを汚染しない', async () => {
  // Tab A: 正常に全データ取得
  const envA=makeInitEnv(async ()=>fullUsers, async ()=>fullEntries);
  await envA.init_fixed();
  assert.equal(JSON.parse(envA.ls.getItem('ls_users')).length, 2);

  // Tab B: users取得失敗、しかしlocalStorageにTab Aのデータがある
  const envB=makeInitEnv(async ()=>[], async ()=>fullEntries);
  envB.ls.setItem('ls_users', envA.ls.getItem('ls_users'));
  await envB.init_fixed();
  const storedB=JSON.parse(envB.ls.getItem('ls_users'));
  assert.equal(storedB.length, 2, 'Tab Bはls_usersを2ユーザーのまま保持');
});

// ================================================================
// SECTION 7: STEP4 — 自動ログアウト定数と条件
// ================================================================

const AUTO_LOGOUT_MINUTES = 30;

test('STEP4: AUTO_LOGOUT_MINUTES が 30 分に設定されている', () => {
  assert.equal(AUTO_LOGOUT_MINUTES, 30);
});
test('STEP4: 30分未満の hidden では自動ログアウトしない', () => {
  const elapsed = 29 * 60 * 1000; // 29分
  const isMobile = true;
  const shouldLogout = isMobile && elapsed >= AUTO_LOGOUT_MINUTES * 60 * 1000;
  assert.ok(!shouldLogout);
});
test('STEP4: 30分以上の hidden でスマホでは自動ログアウトする', () => {
  const elapsed = 31 * 60 * 1000; // 31分
  const isMobile = true;
  const shouldLogout = isMobile && elapsed >= AUTO_LOGOUT_MINUTES * 60 * 1000;
  assert.ok(shouldLogout);
});
test('STEP4: PCでは30分以上でも自動ログアウトしない', () => {
  const elapsed = 60 * 60 * 1000; // 60分
  const isMobile = false; // PC
  const shouldLogout = isMobile && elapsed >= AUTO_LOGOUT_MINUTES * 60 * 1000;
  assert.ok(!shouldLogout);
});

// ================================================================
// SECTION 8: STEP3 — pollData ユーザーマージロジック
// ================================================================

function mergeUsers(nu, localUsers){
  if(nu.length >= localUsers.length){
    return nu; // 全置換
  } else {
    // ローカルにある未取得ユーザーを保持
    const merged=[...nu];
    localUsers.forEach(lu=>{ if(!merged.find(u=>u.id===lu.id)) merged.push(lu); });
    return merged;
  }
}

test('STEP3: Firestoreの方が多い場合は全置換', () => {
  const nu=[{id:'u1'},{id:'u2'},{id:'u3'}];
  const local=[{id:'u1'},{id:'u2'}];
  const result=mergeUsers(nu,local);
  assert.equal(result.length, 3);
});
test('STEP3: Firestoreの方が少ない場合はローカルユーザーを保持', () => {
  const nu=[{id:'u1'}];
  const local=[{id:'u1'},{id:'u2'},{id:'u3'}];
  const result=mergeUsers(nu,local);
  assert.equal(result.length, 3);
  assert.ok(result.find(u=>u.id==='u2'));
  assert.ok(result.find(u=>u.id==='u3'));
});
test('STEP3: 同数の場合は全置換（Firestoreのデータを優先）', () => {
  const nu=[{id:'u1',name:'更新済み'},{id:'u2'}];
  const local=[{id:'u1',name:'旧'},{id:'u2'}];
  const result=mergeUsers(nu,local);
  assert.equal(result.find(u=>u.id==='u1').name,'更新済み');
});

// ================================================================
// SECTION 9: STEP3 — confirmEntry fetch-first パターン
// ================================================================

await testAsync('STEP3: confirmEntry — 既にFirestoreで確認済みなら追加確認しない', async () => {
  const myId='admin1';
  const existingConfs=[{userId:myId,confirmedAt:'2026-01-01T00:00:00Z'}];
  // Firestoreから取得した最新データに自分が既に含まれている
  const fresh={confirmations:existingConfs};
  const alreadyConfirmed=(fresh.confirmations||[]).find(c=>c.userId===myId);
  assert.ok(alreadyConfirmed, '既確認を検出できる');
});

await testAsync('STEP3: confirmEntry — Firestore最新データと自分の確認をマージする', async () => {
  const myId='admin1';
  const otherId='admin2';
  const baseConf=[{userId:otherId,confirmedAt:'2026-01-01T00:00:00Z'}];
  const fresh={confirmations:baseConf};
  const newConf=[...fresh.confirmations,{userId:myId,confirmedAt:new Date().toISOString()}];
  assert.equal(newConf.length, 2);
  assert.ok(newConf.find(c=>c.userId===myId));
  assert.ok(newConf.find(c=>c.userId===otherId));
});

// ================================================================
// SUMMARY
// ================================================================
console.log('\n' + '='.repeat(52));
console.log(`テスト結果: ${passed} 件成功 / ${passed + failed} 件実行`);
if(failed === 0){
  console.log('🎉 全テスト合格！');
  process.exit(0);
} else {
  console.error(`⚠️  ${failed} 件失敗`);
  process.exit(1);
}
