'use strict';
/* 특전(§3 102종)·장비 옵션(§11.6 126칸) «설명문 ↔ 엔진 상수» 자동 대조 게이트 (T17 신설)
   사용: node tools/verifyOptText.js            (불일치가 있으면 exit 1)
         node tools/verifyOptText.js --list     (허용목록 포함 전 항목을 덤프)

   왜 필요한가: T8·T9·T11·T12 네 건이 전부 «설명문에 적힌 숫자와 엔진이 실제로 쓰는 상수가 다르다» 는
   같은 버그였다. 네 번 다 사람이 눈으로 126칸·102종을 훑어 잡았고, 그래서 네 번 다 일부를 놓쳤다
   (T8 이 12곳을 남겨 T11 이 됐고, T11 이 4곳을 남겨 T12 가 됐다).
   T16 게이트(tools/verifyPlanConst.js)는 경제·적 수치 48항목만 덮고 이 계열은 안 덮는다.

   ⚑ T42 로 «④ 산문» 이 붙었다: 표만 보던 종전 3단은 §3.0 산문의 «폭풍의 힘 = 2배» 가 §3.4 표·엔진(1.22)과
   어긋난 것을 통과시켰다(사람이 눈으로 잡았다). 표 밖 문장도 엔진 상수를 그대로 적는 자리다.
   ④ 의 자가 시험은 `node tools/verifyOptTextSelfTest.js` (음성 7 · 오탐 방지 3 · 양성 1).

   방식 4단:
     ① §11.6 표(PLAN) ↔ `node sim.js table` 덤프를 줄 단위 완전 일치 대조 — GOPT.d 가 PLAN 으로
        옮겨질 때 생기는 드리프트(T8·T11·T12 의 표면)를 100% 잡는다.
     ② GOPT 126칸: 각 옵션의 설명문 숫자가 그 옵션이 실제로 건드리는 엔진 상수에 존재하는지 대조.
     ③ PERKS 102종: PLAN §3.1~3.4 표의 «표시 텍스트» 숫자를 같은 방식으로 대조(T9 의 계열).
     ④ PLAN §3·§4·§11.6 의 **표 밖 문장**: 그 줄이 엔진 심볼(함수명·`px` 키·특전 id)을 이름으로 부를 때만,
        그 심볼의 숫자 집합과 문장의 숫자를 대조한다(앵커가 없는 줄은 서술문이므로 건드리지 않는다).
        §6·§7·§11.5-a 의 경제·난이도 수치는 verifyPlanConst(T16) 관할이라 여기서 두 번 보지 않는다.
   ②③④ 는 «설명문 숫자 n 이 엔진 숫자 집합 안에 n · n/100 · 1+n/100 · n/1000 중 하나로 존재하는가» 로 본다.
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
  /* ⚑ T124 — 'plate:7|1'(판금갑옷 «사망 시 1회 부활») 항목은 18계열 옵션표가 폐지되면서 대상이 사라져 지웠다. */
  'l_misfire|2': '«오사 데미지 2배» 의 2 는 p.misfire 에서 두 단계 떨어진 곳(화살에 friendly 플래그를 심고, 화살 처리부 sim.js:819 `e.hp-=a.dmg*2`)에 있어 자동 추적 밖이다. 수동 확인 완료 — 2배 일치',
};

/* ── ④ 산문 허용목록 (T42) ─ 키는 `산문:<앵커들>|<숫자>`, 값은 `{ctx, why}`.
   «폐기된 옛 수치를 인용한 정정 문구» 와 «엔진 상수가 아닌 관측치·수사» 만 등재한다. 사유(why) 없이 추가 금지.

   ⚑ ctx 가 핵심이다 — 숫자만으로 면제하면 «그 숫자로 드리프트한 진짜 오류» 까지 같이 통과한다.
   실제로 처음 구현에서 `m_procX2|2` 를 숫자만으로 면제했더니, T42 를 낳은 그 버그(«확률 1.22배» → «확률 2배»)를
   게이트가 그대로 통과시켰다(음성 테스트 ①이 잡았다). 그래서 면제는 «그 숫자가 이 문맥에 있을 때만» 으로 건다.
   ctx 는 숫자 주변 ±24자 안에 그대로 들어 있어야 하는 조각이며, 숫자를 포함시키는 것이 안전하다. */
const ALLOW_PROSE = {
  /* ⚑ P1(T83) — §3.0·§4 재작성으로 종전 8건(폐기된 4단 등급 확률·m_procX2 정정문·구 관측치 등)이 전부
     대상 소멸했다. 새 산문에는 아직 «엔진에 리터럴로 없는 인용 수치» 가 없어 비어 있는 것이 정상이다. */
  /* ⚑⚑⚑ T104 (주인 확정 2026-09-03) — §3.1 «회피 시 회복» 특전 산문에서 언급되는 두 숫자.
     · «4번 «회피 시 화살»» = 특전 순번 표기(같은 트리거 자리를 가리키는 참조). heal() 엔진 상수에 4는 없다.
     · «6% 는 최대 체력 기준» = 회복 비율 6%. 엔진에서는 `p.maxHp * PERK_EVHEAL_F` 로 상수를 쓰므로
       heal() 함수 본문에는 6 리터럴이 없다(회피 분기 호출부에 있고, verifyPerkOrder 가 그 자리를 대조한다). */
  '산문:heal()|6': { ctx: '6% 는', why: 'T104 § 3.1 · 회복 비율 6% (PERK_EVHEAL_F=0.06 · 회피 분기 호출부에서 곱한다)' },
};


/* ── sim.js 파싱 ─────────────────────────────────────────── */
function numsIn(s) {
  const out = [];
  const re = /(?<![A-Za-z_$][A-Za-z0-9_$]*)(\d+(?:\.\d+)?)/g;
  let m;
  while ((m = re.exec(s))) out.push(Number(m[1]));
  return out;
}
/* numsIn 과 같은 규칙이되 «어디에 있었는가»(문자 위치)까지 돌려준다 — ④ 산문 허용목록의 ctx 판정용 */
function numsWithIdx(s) {
  const out = [];
  const re = /(?<![A-Za-z_$][A-Za-z0-9_$]*)(\d+(?:\.\d+)?)/g;
  let m;
  while ((m = re.exec(s))) out.push({ n: Number(m[1]), at: m.index });
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
    /* 이름 붙은 상수도 값으로 푼다 — blockNums 와 같은 이유(T48) */
    for (const g of L.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) if (NAMED_CONST.has(g[1])) set.add(NAMED_CONST.get(g[1]));
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
/* 최상위 «이름 붙은 상수» → 값 (T48 신설).
   엔진이 숫자를 리터럴 대신 상수 이름으로 쓰면(`applyStun(G,e,sec*STUN_BOSS_MUL)`) 그 줄에 숫자가 없어
   설명문의 수치가 «엔진에 없다» 로 오판된다. 이름을 값으로 풀어서 같은 pool 에 넣는다.
   대상은 `const NAME=<숫자식>` 꼴의 대문자 상수뿐 — 임의 식은 풀지 않는다. */
const NAMED_CONST = (() => {
  const m = new Map();
  for (const L of SIMLINES) {
    if (!/^const\s/.test(L)) continue;
    for (const g of L.matchAll(/([A-Z][A-Z0-9_]{2,})\s*=\s*(-?[\d.]+(?:\s*[*/]\s*[\d.]+)*)/g)) {
      const v = g[2].split(/\s*([*/])\s*/).reduce((acc, tok, idx, arr) =>
        idx === 0 ? Number(tok) : (arr[idx - 1] === '*' ? acc * Number(tok) : arr[idx - 1] === '/' ? acc / Number(tok) : acc), 0);
      if (Number.isFinite(v)) m.set(g[1], v);
    }
  }
  return m;
})();
function blockNums(i, set) {
  let depth = 0;
  for (let j = i; j < Math.min(i + 6, SIMLINES.length); j++) {
    const L = SIMLINES[j];
    for (const n of numsIn(L)) set.add(n);
    for (const g of L.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) if (NAMED_CONST.has(g[1])) set.add(NAMED_CONST.get(g[1]));
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

/* ── ④ 산문 대조용 심볼 인덱스 (T42) ────────────────────────
   표 밖 문장에도 엔진 상수가 그대로 적힌다(«폭풍의 힘 확률 1.22배» 처럼). 표만 보던 종전 게이트는
   §3.0 산문의 «2배» 가 §3.4 표·엔진의 1.22 와 어긋난 것을 통과시켰다(T42 등재 사유).
   문장 전체의 숫자를 다 보면 오탐 천지라 «앵커» 로 좁힌다 —
   그 줄이 엔진 심볼(함수명·px 키·특전 id)을 직접 이름으로 부를 때만, 그 심볼의 숫자 집합과 대조한다.
   앵커가 없는 줄은 아예 건드리지 않는다(설명문이 아니라 서술문이므로). */
const FNNAMES = new Set(FN.keys());
const PXNAMES = new Set();
for (const m of SIM.matchAll(/px\.([A-Za-z0-9_]+)/g)) PXNAMES.add(m[1]);
const PERKIDS = new Map(perks.map(p => [p.id, p]));

/* 산문 대조 구간: 이 게이트가 관할하는 «효과 설명» 절만 본다(§3 특전 · §4 엔진 세부 · §11.6 옵션).
   §6·§7·§11.5-a 등 경제·난이도 수치는 verifyPlanConst(T16) 관할이라 여기서 두 번 보지 않는다. */
const PROSE_SECTIONS = [/^## 3\. /, /^### 3\./, /^## 4\. /, /^### 11\.6 /];
const SECTION_RE = /^#{2,4} /;

/* 문서 참조 표기 — 효과 수치가 아니므로 숫자 추출 전에 지운다 */
const DOCREF = [
  /§\s*\d+(?:\.\d+)?(?:-[a-zA-Z])?/g,   // §11.5-a
  /\b[TR]\d+\b/g,                        // T42 · R07
  /\d{4}-\d{2}-\d{2}/g,                  // 날짜
  /\b\d{1,2}:\d{2}X?\b/g,                // 07:3X (시각)
  /[A-Za-z0-9_./]+\.(?:js|html|md)\s*:\s*\d+/g, // sim.js:700
  /#[0-9A-Fa-f]{3,8}\b/g,                // 색상
  /\b\d+\s*(?:단계|종|칸|장|판|회차)\b/g,  // 문서 단위 수사
];

function anchorsOf(line) {
  const out = new Map(); // 표시용 이름 → 숫자 pool
  const addSym = (tok) => {
    if (PERKIDS.has(tok)) { out.set(tok, poolFor(PERKIDS.get(tok).ap)); return; }
    if (FNNAMES.has(tok)) { out.set(tok + '()', numsOfFn(tok, 1)); return; }
    if (PXNAMES.has(tok)) { out.set('px.' + tok, consumersOf(tok, 'px')); return; }
  };
  for (const m of line.matchAll(/`([^`]+)`/g))
    for (const tok of m[1].split(/[^A-Za-z0-9_$]+/)) if (tok) addSym(tok);
  for (const m of line.matchAll(/\b([cmrl]_[A-Za-z0-9_]+)\b/g)) addSym(m[1]);
  return out;
}

function auditProse() {
  const lines = PLAN.split('\n');
  const flagsP = [];
  let inScope = false;
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (SECTION_RE.test(L)) inScope = PROSE_SECTIONS.some(re => re.test(L));
    if (!inScope) continue;
    if (/^\s*\|/.test(L)) continue;          // 표는 ①②③ 몫
    const anc = anchorsOf(L);
    if (!anc.size) continue;
    proseLines++;
    /* 문서 참조 표기를 «같은 길이의 공백» 으로 지운다 — 인덱스가 원문 L 과 그대로 맞아야 ctx 를 뜰 수 있다 */
    let masked = L;
    for (const re of DOCREF) masked = masked.replace(re, m => ' '.repeat(m.length));
    const pool = new Set();
    for (const s of anc.values()) for (const n of s) pool.add(n);
    const akeyBase = `산문:${[...anc.keys()].join('+')}`;
    for (const { n, at } of numsWithIdx(masked)) {
      proseChecked++;
      const win = L.slice(Math.max(0, at - 24), at + 24);
      let usedKey = null;
      for (const k of [`${akeyBase}|${n}`, `산문:${i + 1}|${n}`]) {
        const e = ALLOW_PROSE[k];
        if (e && win.includes(e.ctx)) { usedKey = k; break; }
      }
      if (usedKey) { proseAllowed++; proseAllowUsed.add(usedKey); if (LIST) console.log(`  · 허용  ${usedKey.padEnd(34)} ${ALLOW_PROSE[usedKey].why}`); continue; }
      if (!explained(n, pool)) flagsP.push({ ln: i + 1, n, anc: [...anc.keys()], text: L, pool: [...pool].sort((a, b) => a - b) });
    }
  }
  return flagsP;
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
let proseChecked = 0, proseAllowed = 0, proseLines = 0;
const proseAllowUsed = new Set();
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
  /* ⚑ T124 — 표 머리글이 «계열» → «세트» 로 바뀌었다(3세트 × 6부위 재설계). */
  const hi = PLAN.split('\n').findIndex(l => l.startsWith('| 부위 | 종류 | 세트 | 옵션1'));
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
/* ④ 산문(표 밖 문장) 대조 — T42 */
const proseFlags = auditProse();

console.log('=== 특전·옵션 설명문 ↔ 엔진 상수 대조 (T17 게이트) ===');
console.log(`  대상: GOPT ${gopts.length}칸 · 특전 ${perks.length}종 · 대조한 숫자 ${checked}개(허용목록 ${allowed}개)`);
console.log(`  §11.6 표 ↔ 엔진 덤프: ${tableOk ? '완전 일치' : '불일치'}`);
for (const f of flags) {
  console.log(`  ✗ ${f.where} — 설명문의 «${f.n}» 이 엔진 상수에 없다`);
  console.log(`      설명문: ${f.text}`);
  console.log(`      엔진 숫자: ${f.pool.join(', ') || '(없음)'}`);
}
console.log(`  산문(§3·§4·§11.6 표 밖 문장): 앵커 있는 줄 ${proseLines}줄 · 대조한 숫자 ${proseChecked}개(허용목록 ${proseAllowed}개)`);
for (const f of proseFlags) {
  console.log(`  ✗ PLAN:${f.ln} 산문 — «${f.n}» 이 앵커(${f.anc.join(', ')})의 엔진 상수에 없다`);
  console.log(`      문장: ${f.text.trim().slice(0, 160)}`);
  console.log(`      엔진 숫자: ${f.pool.join(', ') || '(없음)'}`);
}
const proseAllowStale = Object.keys(ALLOW_PROSE).filter(k => !proseAllowUsed.has(k));
if (proseAllowStale.length) console.log(`  ⚠ 산문 허용목록 중 이번에 안 걸린 항목 ${proseAllowStale.length}개(문장이 바뀌었으면 지울 것): ${proseAllowStale.join(' · ')}`);
console.log(`\n불일치 ${flags.length}건 · 산문 불일치 ${proseFlags.length}건 · PLAN §3 누락 ${perkTextMissing}종 · 표 대조 ${tableOk ? 'OK' : 'NG'}`);
if (flags.length || proseFlags.length || perkTextMissing || !tableOk) {
  console.log('→ 실패: 설명문과 엔진이 어긋났다. 엔진이 옳으면 설명문을, 설명문이 옳으면 엔진을 고쳐라(엔진 수치 변경은 T1 회차 절차).');
  process.exit(1);
}
console.log('→ 통과');
