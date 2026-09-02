'use strict';
/* 특전(§3 102종)·장비 옵션(§11.6 126칸) «설명문 ↔ 엔진 상수» 자동 대조 게이트 (T17 신설)
   사용: node tools/verifyOptText.js            (불일치가 있으면 exit 1)
         node tools/verifyOptText.js --list     (허용목록 포함 전 항목을 덤프)

   왜 필요한가: T8·T9·T11·T12 네 건이 전부 «설명문에 적힌 숫자와 엔진이 실제로 쓰는 상수가 다르다» 는
   같은 버그였다. 네 번 다 사람이 눈으로 126칸·102종을 훑어 잡았고, 그래서 네 번 다 일부를 놓쳤다
   (T8 이 12곳을 남겨 T11 이 됐고, T11 이 4곳을 남겨 T12 가 됐다).
   T16 게이트(tools/verifyPlanConst.js)는 경제·적 수치 48항목만 덮고 이 계열은 안 덮는다.

   방식 3단:
     ① §11.6 표(PLAN) ↔ `node sim.js table` 덤프를 줄 단위 완전 일치 대조 — GOPT.d 가 PLAN 으로
        옮겨질 때 생기는 드리프트(T8·T11·T12 의 표면)를 100% 잡는다.
     ② GOPT 126칸: 각 옵션의 설명문 숫자가 그 옵션이 실제로 건드리는 엔진 상수에 존재하는지 대조.
     ③ PERKS 102종: PLAN §3.1~3.4 표의 «표시 텍스트» 숫자를 같은 방식으로 대조(T9 의 계열).
   ②③ 은 «설명문 숫자 n 이 엔진 숫자 집합 안에 n · n/100 · 1+n/100 · n/1000 중 하나로 존재하는가» 로 본다.
   숫자가 아닌 표기(개수·명수 등 엔진에 안 나타나는 수사)는 아래 ALLOW 에 사유와 함께 등재해 통과시킨다.
   → ALLOW 에 없는 새 불일치가 뜨면 그건 실제 드리프트이거나 새 수사(그때 ALLOW 에 사유를 적어 추가)다. */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const SIMPATH = path.join(root, 'sim.js');
const SIM = fs.readFileSync(SIMPATH, 'utf8');
const PLAN = fs.readFileSync(path.join(root, 'PLAN.md'), 'utf8');
const SIMLINES = SIM.split('\n');
const LIST = process.argv.includes('--list');

/* ── 허용목록: «설명문 숫자인데 엔진 상수로 나타나지 않는 것이 정상» 인 항목 ──
   키는 `<항목ID>|<숫자>`. 값은 사유(사람이 읽는 근거). 사유 없이 추가 금지. */
const ALLOW = {
  'plate:7|1': '«사망 시 1회 부활» 의 1 = 부활 횟수 자체(px.revive 카운터)라 상수로 나타날 곳이 없다. 수동 확인: sim.js 의 revive 처리는 카운터를 1 감소시킬 뿐 배수 상수가 없다',
  'l_misfire|2': '«오사 데미지 2배» 의 2 는 p.misfire 에서 두 단계 떨어진 곳(화살에 friendly 플래그를 심고, 화살 처리부 sim.js:819 `e.hp-=a.dmg*2`)에 있어 자동 추적 밖이다. 수동 확인 완료 — 2배 일치',
};

/* ── sim.js 파싱 ─────────────────────────────────────────── */
function numsIn(s) {
  const out = [];
  const re = /(?<![A-Za-z_$][A-Za-z0-9_$]*)(\d+(?:\.\d+)?)/g;
  let m;
  while ((m = re.exec(s))) out.push(Number(m[1]));
  return out;
}
function pxKeysIn(s) {
  const out = new Set();
  const re = /px\.([A-Za-z0-9_]+)/g;
  let m;
  while ((m = re.exec(s))) out.add(m[1]);
  return out;
}

/* basePx() 블록(단순 0 초기화 나열)은 상수 출처가 아니므로 제외 */
const basePxStart = SIMLINES.findIndex(l => l.includes('function basePx()'));
let basePxEnd = basePxStart;
while (basePxEnd < SIMLINES.length && !SIMLINES[basePxEnd].startsWith('}')) basePxEnd++;

/* 최상위 함수명 → 본문 숫자 (소비부가 fireAxe(p) 처럼 함수를 부르면 그 안의 상수가 실제 값이다) */
const FN = new Map();
{
  let cur = null, buf = [];
  for (const L of SIMLINES) {
    const m = L.match(/^function ([A-Za-z0-9_]+)\(/);
    if (m) { if (cur) FN.set(cur, buf); cur = m[1]; buf = []; }
    if (cur) buf.push(L);
  }
  if (cur) FN.set(cur, buf);
}
const fnNums = new Map();
function numsOfFn(name, depth) {
  const ck = `${name}@${depth}`;
  if (fnNums.has(ck)) return fnNums.get(ck);
  const set = new Set();
  fnNums.set(ck, set);
  const body = FN.get(name);
  if (!body) return set;
  for (const L of body) {
    for (const n of numsIn(L)) set.add(n);
    if (depth > 0) for (const c of callsIn(L)) for (const n of numsOfFn(c, depth - 1)) set.add(n);
  }
  return set;
}
function callsIn(s) {
  const out = [];
  const re = /\b([A-Za-z0-9_]+)\s*\(/g;
  let m;
  while ((m = re.exec(s))) if (FN.has(m[1])) out.push(m[1]);
  return out;
}

/* 소비부: 키가 등장하는 줄부터 중괄호가 닫힐 때까지(최대 6줄)를 한 덩어리로 본다.
   `if(px.backDmg){` 처럼 상수가 다음 줄에 있는 경우를 놓치지 않기 위함. */
function blockNums(i, set) {
  let depth = 0;
  for (let j = i; j < Math.min(i + 6, SIMLINES.length); j++) {
    const L = SIMLINES[j];
    for (const n of numsIn(L)) set.add(n);
    for (const c of callsIn(L)) for (const n of numsOfFn(c, 1)) set.add(n);
    for (const ch of L) { if (ch === '{') depth++; else if (ch === '}') depth--; }
    if (j > i && depth <= 0) break;
    if (j === i && depth <= 0) break;
  }
}

/* 상태 키(px 계열 또는 p·G 직속 필드) → 그 키를 «소비» 하는 곳의 숫자 집합 */
const keyNums = new Map();
function consumersOf(key, kind) {
  const ck = `${kind}:${key}`;
  if (keyNums.has(ck)) return keyNums.get(ck);
  const re = kind === 'px'
    ? new RegExp(`px\\.${key}(?![A-Za-z0-9_])`)
    : new RegExp(`(?<!px)\\.${key}(?![A-Za-z0-9_])`);
  const set = new Set();
  keyNums.set(ck, set);
  for (let i = 0; i < SIMLINES.length; i++) {
    if (i >= basePxStart && i <= basePxEnd) continue;
    const L = SIMLINES[i];
    if (!re.test(L)) continue;
    /* 정의부(add(...) / {d:...,ap:...})는 그 자체가 대조 대상이라 숫자 출처로 쓰지 않는다.
       단 ap 안에 직접 상수를 쓰는 경우(p.dmg*=1.06)는 항목별로 따로 더한다. */
    if (/^\s*add\('/.test(L) || /^\s*\{d:/.test(L)) continue;
    blockNums(i, set);
  }
  return set;
}

/* PERKS: add('id', r, ap, u) */
const perks = [];
for (const L of SIMLINES) {
  const m = L.match(/^\s*add\('([a-zA-Z0-9_]+)'\s*,\s*(\d)\s*,\s*(.*)$/);
  if (m) perks.push({ id: m[1], rar: Number(m[2]), ap: m[3] });
}

/* GOPT: series:[ {d:'...', ap:...}, ... ] */
const gopts = [];
{
  const gi = SIM.indexOf('const GOPT={');
  const gEnd = SIM.indexOf('\n};', gi);
  const blk = SIM.slice(gi, gEnd);
  let series = null;
  for (const L of blk.split('\n')) {
    const sm = L.match(/^\s*([a-zA-Z0-9_]+)\s*:\s*\[/);
    if (sm) { series = sm[1]; continue; }
    const om = L.match(/^\s*\{d:'([^']*)'\s*,\s*ap:(.*?)\}\s*,?\s*$/);
    if (om && series) gopts.push({ series, idx: gopts.filter(x => x.series === series).length + 1, d: om[1], ap: om[2] });
  }
}

/* PLAN §3.1~3.4 특전 표: | id | 표시 텍스트 | */
const planPerkText = new Map();
for (const L of PLAN.split('\n')) {
  const m = L.match(/^\|\s*([cmrl]_[A-Za-z0-9_]+)\s*\|\s*(.+?)\s*\|\s*$/);
  if (m) planPerkText.set(m[1], m[2]);
}

/* ── 대조 ─────────────────────────────────────────────────── */
function explained(n, pool) {
  for (const c of pool) {
    if (Math.abs(c - n) < 1e-9) return true;
    if (Math.abs(c - n / 100) < 1e-12) return true;
    if (Math.abs(c - (1 + n / 100)) < 1e-12) return true;
    if (Math.abs(c - (1 - n / 100)) < 1e-12) return true;
    if (Math.abs(c - n / 1000) < 1e-12) return true;
    if (Math.abs(c * 100 - n) < 1e-9) return true;
  }
  return false;
}
function stateKeysIn(s) {
  const out = new Set();
  const re = /(?:^|[^A-Za-z0-9_.])[pG]\.(?:G\.)?([A-Za-z0-9_]+)/g;
  let m;
  while ((m = re.exec(s))) if (m[1] !== 'px' && m[1] !== 'G') out.add(m[1]);
  return out;
}
function poolFor(apText) {
  const body = apText.replace(/^p\s*=>\s*/, '');
  const pool = new Set(numsIn(body));
  for (const c of callsIn(body)) for (const n of numsOfFn(c, 1)) pool.add(n);
  for (const k of pxKeysIn(apText)) for (const n of consumersOf(k, 'px')) pool.add(n);
  for (const k of stateKeysIn(apText)) for (const n of consumersOf(k, 'st')) pool.add(n);
  return pool;
}

const flags = [];
let checked = 0, allowed = 0;
function audit(itemId, text, apText, where) {
  const pool = poolFor(apText);
  for (const n of numsIn(text)) {
    checked++;
    const key = `${itemId}|${n}`;
    if (ALLOW[key]) { allowed++; if (LIST) console.log(`  · 허용  ${key.padEnd(24)} ${ALLOW[key]}`); continue; }
    if (!explained(n, pool)) {
      flags.push({ itemId, n, text, where, pool: [...pool].sort((a, b) => a - b) });
    }
  }
}

/* ① §11.6 표 ↔ 엔진 덤프 완전 일치 */
let tableOk = true;
{
  const dump = execFileSync(process.execPath, [SIMPATH, 'table'], { encoding: 'utf8' }).trim().split('\n');
  const hi = PLAN.split('\n').findIndex(l => l.startsWith('| 부위 | 종류 | 계열 | 옵션1'));
  const planRows = hi < 0 ? [] : PLAN.split('\n').slice(hi, hi + dump.length);
  if (hi < 0) { tableOk = false; console.log('  ✗ §11.6 표 머리글을 PLAN 에서 못 찾았다'); }
  else for (let i = 0; i < dump.length; i++) {
    if ((planRows[i] || '').trim() !== dump[i].trim()) {
      tableOk = false;
      console.log(`  ✗ §11.6 표 ${i + 1}번째 줄이 엔진 덤프와 다르다`);
      console.log(`      PLAN : ${(planRows[i] || '(없음)').slice(0, 120)}`);
      console.log(`      엔진 : ${dump[i].slice(0, 120)}`);
    }
  }
}

/* ② GOPT 126칸 */
for (const o of gopts) audit(`${o.series}:${o.idx}`, o.d, o.ap, `§11.6 ${o.series} 옵션${o.idx}`);
/* ③ PERKS 102종 (PLAN §3 표시 텍스트) */
let perkTextMissing = 0;
for (const p of perks) {
  const t = planPerkText.get(p.id);
  if (!t) { perkTextMissing++; console.log(`  ⚠ PLAN §3 에 특전 «${p.id}» 행이 없다`); continue; }
  audit(p.id, t.replace(/^[^ ]*\s/, ''), p.ap, `§3 ${p.id}`);
}

console.log('=== 특전·옵션 설명문 ↔ 엔진 상수 대조 (T17 게이트) ===');
console.log(`  대상: GOPT ${gopts.length}칸 · 특전 ${perks.length}종 · 대조한 숫자 ${checked}개(허용목록 ${allowed}개)`);
console.log(`  §11.6 표 ↔ 엔진 덤프: ${tableOk ? '완전 일치' : '불일치'}`);
for (const f of flags) {
  console.log(`  ✗ ${f.where} — 설명문의 «${f.n}» 이 엔진 상수에 없다`);
  console.log(`      설명문: ${f.text}`);
  console.log(`      엔진 숫자: ${f.pool.join(', ') || '(없음)'}`);
}
console.log(`\n불일치 ${flags.length}건 · PLAN §3 누락 ${perkTextMissing}종 · 표 대조 ${tableOk ? 'OK' : 'NG'}`);
if (flags.length || perkTextMissing || !tableOk) {
  console.log('→ 실패: 설명문과 엔진이 어긋났다. 엔진이 옳으면 설명문을, 설명문이 옳으면 엔진을 고쳐라(엔진 수치 변경은 T1 회차 절차).');
  process.exit(1);
}
console.log('→ 통과');
