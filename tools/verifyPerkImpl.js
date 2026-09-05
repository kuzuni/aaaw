#!/usr/bin/env node
/* 🔧 T162 게이트 — «PLAN §3.1 표의 6열(«구현» 열)» 전수 대조 (신설 2026-09-05)
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────────────
 * §3.1 표는 6열이다: `| # | sim id | 등급 | 특전 | 효과 | 구현 |`.
 * 여기까지 닿던 게이트는 둘뿐이었고 **둘 다 6열을 안 봤다**:
 *   · `verifyPerkOrder` — 번호·id·등급·이름(4열)·효과(5열)까지만 대조한다(정규식이 5열에서 끊긴다).
 *   · `verifyPlanProse`(T157 신설) — §3.1 의 **표 밖 산문**만 본다.
 * 그래서 6열은 무주공산이었다. 이 열은 특전 100행 전부의 **엔진 함수명·상수명·대입식·기본치**를 들고 있어서,
 * 여기가 드리프트하면 다음 워커가 «PLAN 이 확정 스펙» 이라며 **엔진을 옛 값으로 되돌린다**.
 * 실증(T162 착수 전 · §0-5 재검증 세션): 6열에만 10행분 돌연변이(`hitPlayer`→`hurtPlayer` 개명 ·
 * `PERK_EVHEAL_CH=0.33`→0.08 · `p.dmg *= 1.15`→1.20 · `p.evade += 8`→10 · `p.critF += 30`→50)를 심었는데
 * **정적 33종이 전부 초록 그대로**였다.
 *
 * ── 무엇을 보는가 (6절) ────────────────────────────────────────────────────
 *   §A 구조 — 100행 · 6열 존재 · 토큰 전수 분류(미분류 0) · 선언표에 죽은 항목 0
 *   §B 이름 — 백틱 식별자·호출 머리·상수 이름이 두 엔진에 전부 실재한다
 *   §C 수치 — 호출 리터럴은 글자 그대로, 상수를 쓰는 자리는 **두 엔진 상수값**과 대조
 *   §D 실행 — «획득 시» 대입식은 두 엔진의 `ap(p)` 를 **실제로 굴려** 델타를 잰다(+ PLAN 에 없는 추가 변경 0)
 *   §E 정합 — «기본 X → Y» 가 엔진 기본치와 맞는가 · «N번» 참조가 같은 축을 가리키는가 · 합산 산술이 맞는가
 *   §F 자기검사(`--self`) — 사본 돌연변이 전종이 빨개지는가 · no-op 0
 *
 * 사용: node tools/verifyPerkImpl.js        (exit 0 = 통과, 1 = 불합격)
 *      node tools/verifyPerkImpl.js --self  (음성 검사)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const R = [];
const chk = (n, c, d) => { R.push({ n, c }); console.log(`  ${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); return c; };

/* ══════════════════════════════════════════════════════════════════════════
   선언표 ①  6열 백틱 토큰의 분류·기대
   ── «미분류 0» 규약: 아래 표에 없는 토큰이 6열에 나타나면 §A-3 이 빨개진다.
      6열을 고칠 때 이 표도 같이 고치라는 뜻이고, 반대로 **여기 있는데 6열에 없는 항목**(죽은 선언)도
      §A-4 에서 불합격이다(T157 «죽은 면제 = 불합격» 규약 이식).
   ══════════════════════════════════════════════════════════════════════════ */

/* ⓐ bare 식별자 — 두 엔진에 그 이름이 실재해야 한다 (함수·필드·플래그·인자명) */
const IDENT = ['hitPlayer', 'doCounter', 'onKill', 'effDmg', 'effCritR', 'effEvade', 'applyCollHp',
  'dealDmg', 'fromBasic', 'procOnAttack', 'playerStrike', 'procNHit', 'effCritF', 'cleave',
  'effAspd', 'ward', 'repair', 'heal', 'noBoost'];

/* ⓑ 호출 토큰 — mode 'lit' = 두 엔진에 **글자 그대로** 있어야 한다(공백 무시),
                 mode 'nm'  = 시그니처가 두 엔진에서 다르거나 인자가 상수라 **이름만** 본다.
   ⚑ `applyStun` 은 시그니처가 다르다(sim `applyStun(G,e,sec)` · game `applyStun(e,sec)`) — 'nm'.
   ⚑ 인자가 숫자인데 'nm' 인 자리는 그 숫자를 반드시 선언표 ②(NUMMAP)가 받는다(§A-4 가 강제). */
const CALLS = {
  "pkk(PERK_EVHEAL_CH=0.33)": 'nm', "heal(p, p.maxHp*PERK_EVHEAL_F)": 'nm',
  "pkk(PERK_SUMMON_N)": 'nm', "pkk(px.p_killSpear)": 'nm',
  "fireArrows(p,1)": 'lit', "fireArrows(p,3)": 'lit', "fireArrows(p,n)": 'nm',
  "fireAxe(p,1)": 'lit', "fireAxe(p,2)": 'lit',
  "fireSpear(p,1)": 'lit', "fireSpear(p,n)": 'nm',
  "fireBolts(p,1)": 'lit', "fireBoltsAll(p)": 'nm', "fireBoltsAll(p, e.wave)": 'nm',
  "reflect(src, 받은피해 × px.p_thorns)": 'nm',
  "refreshBuff(p,'evade',40,2,'p_killEvBuff')": 'nm',
  "pkk(0.33)": 'nm', "pkk(0.05)": 'nm', "pkk(0.66)": 'nm',
  "heal(p, p.maxHp*0.06)": 'nm', "heal(p, over)": 'nm', "onKill(e,over)": 'nm',
  "addBuff(p,'aspd',0.07,7)": 'nm', "applyStun(e,3)": 'nm', "applyStun(src,3)": 'nm',
  "gainWard(p,0.10)": 'nm', "repair(p, …)": 'nm', "repair(p, p.maxSh*0.06)": 'nm',
  "offerPerks(taken, noble)": 'nm',
};

/* ⓒ 상수 토큰 — 백틱 안이 `NAME` 이거나 `NAME = 값`. 두 엔진에 같은 값으로 실재해야 하고,
      PLAN 이 값을 병기했으면 그 값과도 같아야 한다. */
const CONST_TOK = ['R_ARROW', 'R_AXE', 'R_BOLT', 'PERK_KILL_N', 'PERK_KILL_R', 'STUN_BOSS_MUL',
  'PERK_FULLHP_A', 'DASH_MUL', 'SPEAR_PIERCE', 'PERK_EVHEAL_L',
  'PERK_THORN_N = 1.00', 'PERK_THORN_R = 2.00', 'PERK_THORN_L = 3.00',
  'PERK_COLL_CRIT = 2', 'PERK_KILL_L = 1.00'];

/* ⓓ 그 밖의 코드 조각 — 두 엔진에서 «값» 으로 확인하거나(NUMMAP), 실행으로 확인한다(§D). */
const OTHER_TOK = ['×(1+0.04·n)', '+2·n', '+1', 'src.hp = 0; onKill(...)', 'cd *= 1.30', '+1.00',
  'p.dash', 'p.critStk = 0'];

/* ══════════════════════════════════════════════════════════════════════════
   선언표 ②  NUMMAP — 6열이 적은 «수치» ↔ 두 엔진 상수(또는 리터럴)의 대조표.
   각 항목: { r: 행번호, s: 6열에 반드시 들어 있어야 할 문자열, k: 엔진 상수명, v: 기대값,
              f: (선택) 상수값 → 기대 표기 변환 }
   `k` 가 없으면 `lit`(두 엔진 소스에 그 문자열이 그대로 있어야 한다).
   PLAN 이 흔들리면 `s` 가 안 잡혀 빨강 · 엔진이 흔들리면 상수값이 어긋나 빨강 — 양쪽을 다 묶는다.
   ══════════════════════════════════════════════════════════════════════════ */
const NUM = [
  { r: 4, s: '발당 **30%**', k: 'R_ARROW', v: 0.30 },
  { r: 5, s: '개당 **50%**', k: 'R_AXE', v: 0.50 },
  { r: 12, s: '(75%)', k: 'R_BOLT', v: 0.75 },
  { r: 16, s: "refreshBuff(p,'evade',40,", k: 'PERK_KILLEV_A', v: 40 },
  { r: 16, s: ",40,2,'p_killEvBuff')", k: 'PERK_KILLEV_T', v: 2 },
  { r: 17, s: '1+0.04·n', k: 'PERK_COLL_ATK', v: 0.04 },
  { r: 18, s: '+2·n', k: 'PERK_COLL_CRIT', v: 2 },
  { r: 19, s: 'pkk(0.33)', k: 'PERK_KSTACK_CH', v: 0.33 },
  { r: 19, s: 'p.dmg *= 1.01', k: 'PERK_KSTACK_ATK', v: 0.01, f: x => `p.dmg *= ${(1 + x).toFixed(2)}` },
  { r: 20, s: 'pkk(0.33)', k: 'PERK_KSTACK_CH', v: 0.33 },
  { r: 20, s: 'p.evade += 1', k: 'PERK_KSTACK_EV', v: 1 },
  { r: 20, s: '상한 **90**', k: null, v: 'Math.min(90,' },
  { r: 21, s: 'pkk(0.33)', k: 'PERK_KHEAL_CH', v: 0.33 },
  { r: 21, s: 'p.maxHp*0.06', k: 'PERK_KHEAL_F', v: 0.06 },
  { r: 22, s: '10/100 → 10/107', k: 'PERK_COLL_HP', v: 0.07, f: x => `10/100 → 10/${Math.round(100 * (1 + x))}` },
  { r: 23, s: '`+1`', k: 'PERK_CSTACK_A', v: 1 },
  { r: 24, s: "addBuff(p,'aspd',0.07,", k: 'PERK_ASPDATK_A', v: 0.07 },
  { r: 24, s: ",0.07,7)", k: 'PERK_ASPDATK_T', v: 7 },
  { r: 25, s: 'pkk(0.05)', k: 'PERK_EXEC_N', v: 0.05 },
  { r: 26, s: 'applyStun(e,3)', k: 'PERK_STUNC_T', v: 3 },
  { r: 30, s: 'p.maxHp*0.06', k: 'PERK_NHEAL_F', v: 0.06 },
  { r: 31, s: 'applyStun(src,3)', k: 'PERK_STUNC_T', v: 3 },
  { r: 32, s: '둘 다면 +60', k: 'PERK_CTCRIT_N+PERK_CTCRIT_R', v: 60 },
  { r: 33, s: 'cd *= 1.30', k: 'PERK_CTDMG_N', v: 1.30 },
  { r: 33, s: '×1.30 × ×1.60', k: 'PERK_CTDMG_R', v: 1.60 },
  { r: 35, s: '뒤 적 회피 10%', k: 'ENEMY_EVADE', v: 0.10 },
  { r: 37, s: '×1.50', k: 'PERK_NOSH_ATK', v: 1.50 },
  { r: 38, s: '×1.30', k: 'PERK_NOSH_ASPD', v: 1.30 },
  { r: 39, s: 'gainWard(p,0.10)', k: 'PERK_WARD_N', v: 0.10 },
  { r: 40, s: '`+1.00`', k: 'PERK_FULLHP_A', v: 1.00 },
  { r: 43, s: '최대 +600%', k: 'PERK_THORN_N+PERK_THORN_R+PERK_THORN_L', v: 6.00, f: x => `최대 +${Math.round(x * 100)}%` },
  { r: 49, s: 'pkk(0.66)', k: 'PERK_KREPAIR_CH', v: 0.66 },
  { r: 49, s: 'p.maxSh*0.06', k: 'PERK_KREPAIR_F', v: 0.06 },
  { r: 51, s: '5% 와 10%', k: 'PERK_EXEC_N', v: 0.05 },
  { r: 51, s: '5% 와 10%', k: 'PERK_EXEC_R', v: 0.10 },
  { r: 60, s: '사거리 74px', k: null, v: 'dist>74' },
  { r: 60, s: 'DASH_MUL`(5)', k: 'DASH_MUL', v: 5 },
  { r: 61, s: '각각 +100%', k: 'PERK_BSTK_M', v: 2.00, f: x => `각각 +${Math.round((x - 1) * 100)}%` },
  { r: 65, s: 'I(33%)·III(100%)', k: 'PERK_SUMMON_N', v: 0.33 },
  { r: 65, s: 'I(33%)·III(100%)', k: 'PERK_SUMMON_L', v: 1.00 },
  { r: 67, s: '(33%)·전설 III(100%)', k: 'PERK_EVHEAL_CH', v: 0.33 },
  { r: 67, s: '(33%)·전설 III(100%)', k: 'PERK_EVHEAL_L', v: 1.00 },
  { r: 69, s: '상한 80', k: null, v: 'Math.min(80,' },
  { r: 71, s: '«치명 시 창»(66%)', k: 'PERK_CRITSP_L', v: 0.66 },
  { r: 78, s: '희귀 25/40 = **62.5%**', k: 'PERK_GRADE_RATE[1]', v: 25 },
  { r: 78, s: '전설 15/40 = **37.5%**', k: 'PERK_GRADE_RATE[2]', v: 15 },
  { r: 79, s: '창 데미지 100%', k: 'R_SPEAR', v: 1.00 },
  { r: 79, s: '8마리 관통', k: 'SPEAR_PIERCE', v: 8 },
  { r: 82, s: '(5+10+15 합산 아님)', k: 'PERK_EXEC_L', v: 0.15 },
  { r: 87, s: '**8마리** 관통', k: 'SPEAR_PIERCE', v: 8 },
  { r: 89, s: '희귀(33%)', k: 'PERK_CRITSP_R', v: 0.33 },
  { r: 90, s: '공격력 **75%**', k: 'R_BOLT', v: 0.75 },
  { r: 90, s: '`fireBoltsAll(p, e.wave)`', k: 'PERK_CRITBOLT_L', v: 0.66 },
  { r: 93, s: '**8마리** 관통', k: 'SPEAR_PIERCE', v: 8 },
  { r: 95, s: '희귀(15%)', k: 'PERK_EVREP_R', v: 0.15 },
  { r: 97, s: '«피해 무시»(20%)', k: 'PERK_IGN_N', v: 0.20 },
  { r: 97, s: '실드 > 0 조건', k: 'PERK_SHWALL_L', v: 0.50 },
  { r: 98, s: '× 100%', k: 'PERK_SHREF_L', v: 0.50 },
  { r: 100, s: '확률 **1.00**', k: 'PERK_EVHEAL_L', v: 1.00 },
  { r: 100, s: 'I(33%)·II(66%)', k: 'PERK_EVHEAL_CH', v: 0.33 },
  { r: 100, s: 'I(33%)·II(66%)', k: 'PERK_EVHEAL_R', v: 0.66 },
];

/* 선언표 ③ — «기본 X → Y» 를 적은 행: 엔진 기본치 상수와 그 행의 증가량 */
const BASE = [
  { r: 3, tune: 'pEvade0' }, { r: 6, tune: 'pCounter0' },
  { r: 8, tune: 'pCrit0' }, { r: 9, tune: 'pCritF0' },
];

const CUT = "const mode=process.argv[2]||'all';";

/* ── 엔진 로더 ───────────────────────────────────────────────────────────── */
function loadSim(src) {
  const at = src.indexOf(CUT);
  if (at < 0) return null;
  const ctx = { console: { log() {} }, process, Math: Object.create(Math), JSON, Number, String,
    Array, Set, Map, Object, Date, parseInt, parseFloat, isFinite, isNaN, require };
  vm.createContext(ctx);
  try { vm.runInContext(src.slice(0, at) + '\n;globalThis.__K={PERKS,basePx,TUNE};', ctx); }
  catch (e) { return null; }
  return ctx.__K || null;
}
/* index.html 은 통째로 못 올린다(DOM). 특전 상수 블록 + `const PERKS=[…];` 만 떼어 vm 에 올린다. */
function loadHtm(src) {
  const a = src.indexOf('const PERKS=[');
  const b = src.indexOf('\n];', a);
  if (a < 0 || b < 0) return null;
  const consts = [...src.matchAll(/^const ((?:PERK_|R_|DASH_|SPEAR_|STUN_|ENEMY_|WAVE_)[\s\S]*?);$/gm)]
    .map(m => m[0]);
  const ctx = { Math, Object, Array, console: { log() {} } };
  vm.createContext(ctx);
  /* ⚑ 선언을 **한 줄씩** 올린다 — 한 덩어리로 올리면 이 목록 밖 상수를 참조하는 줄 하나가
     전체를 무너뜨린다(T163 이 `SPEAR_REACH=ENEMY_GAP*SPEAR_PIERCE` 를 넣었을 때 실제로 났다).
     못 올린 줄이 정말 필요했다면 바로 아래 PERKS 평가가 실패해 null 이 되므로 조용히 넘어가지 않는다. */
  for (const c of consts) { try { vm.runInContext(c, ctx); } catch (e) { /* 이 게이트가 안 쓰는 선언 */ } }
  try { vm.runInContext(src.slice(a, b + 3) + '\n;globalThis.__H={PERKS};', ctx); }
  catch (e) { return null; }
  return ctx.__H || null;
}

/* 소스에서 상수 값을 읽는다 — `NAME=1.00` / `NAME = 1.00` / 분수 `2/3` / 배열 `[60,25,15]` 첨자 */
function constVal(src, name) {
  const idx = name.match(/^([A-Z_0-9]+)\[(\d+)\]$/);
  if (idx) {
    const m = src.match(new RegExp(idx[1] + '\\s*=\\s*\\[([^\\]]*)\\]'));
    if (!m) return null;
    const v = m[1].split(',')[+idx[2]];
    return v === undefined ? null : Number(v);
  }
  if (name.includes('+')) {                                   /* 합산 기대 — 항끼리 더한다 */
    let s = 0;
    for (const k of name.split('+')) { const v = constVal(src, k.trim()); if (v === null) return null; s += v; }
    return s;
  }
  /* `NAME=1.00`(상수 선언)과 `name:0,`(TUNE 객체 리터럴) 둘 다 읽는다 — 기본치는 후자다.
     ⚑ `:` 형태는 **객체 키 자리**(`{`·`,`·줄머리 뒤)만 받는다 — 안 그러면 삼항 연산자
     `p.sh<=0?PERK_NOSH_ASPD:1` 의 «:1» 을 선언으로 잘못 읽는다(실제로 한 번 걸렸다). */
  const NUMLIT = '([0-9.]+(?:\\s*/\\s*[0-9.]+)?)';
  const m = src.match(new RegExp('(?:^|[^A-Za-z0-9_])' + name + '\\s*=\\s*' + NUMLIT))
    || src.match(new RegExp('(?:^|[{,])\\s*' + name + '\\s*:\\s*' + NUMLIT, 'm'));
  if (!m) return null;
  const t = m[1].replace(/\s+/g, '');
  return t.includes('/') ? Number(t.split('/')[0]) / Number(t.split('/')[1]) : Number(t);
}

const near = (a, b) => a !== null && b !== null && Math.abs(a - b) < 1e-9;
const nows = s => s.replace(/\s+/g, '');
const word = (src, w) => new RegExp('(?:^|[^A-Za-z0-9_$])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9_$])').test(src);

/* 실행용 기준 플레이어 — 엔진 기본치가 아니라 «움직임이 눈에 띄는» 값을 쓴다(곱연산 확인용) */
const FIELDS = ['dmg', 'evade', 'counter', 'critR', 'critF', 'def', 'aspd', 'healAmp', 'repairAmp',
  'hp', 'maxHp', 'sh', 'maxSh', 'collHpF', 'critStk', 'ward'];
/* ⚑ 모든 필드가 **0 이 아니어야** 한다 — 0 이면 곱연산 돌연변이(`p.def *= 1.24` → 1.20)가
   0×1.24 = 0×1.20 으로 똑같이 나와 게이트가 초록이 된다(자기검사에서 실제로 걸렸다). */
function mkP(basePx) {
  return { dmg: 100, aspd: 1.7, critR: 3, critF: 150, def: 11, counter: 4, evade: 5, healAmp: 0.5,
    repairAmp: 0.5, hp: 1000, maxHp: 1000, sh: 100, maxSh: 100, collHpF: 1, critStk: 2, ward: 1,
    nhit: {}, px: Object.assign({}, basePx) };
}

/* ══════════════════════════════════════════════════════════════════════════ */
function run(planSrc, simSrc, htmSrc) {
  R.length = 0;
  const rows = [...planSrc.matchAll(/^\| (\d+) \| (p_[A-Za-z]+) \| (일반|희귀|전설) \| ([^|]+?) \| ([^|]+?) \| ([^|]+?) \|\s*$/gm)]
    .map(m => ({ n: +m[1], id: m[2], nm: m[4].trim(), ef: m[5].trim(), im: m[6].trim() }));
  const byN = {}; rows.forEach(r => (byN[r.n] = r));

  /* ===== §A 구조 ===== */
  console.log('\n=== §A 구조 — 6열 파싱·토큰 전수 분류 ===');
  chk('§3.1 표가 100행이고 6열(«구현» 열)이 전부 채워져 있다',
    rows.length === 100 && rows.every(r => r.im.length > 0), `${rows.length}행`);
  /* 토큰도 수치도 없는 행은 «〃»(윗행과 같은 자리)나 «I/II/III»(같은 축의 다른 등급) 참조여야 한다 —
     그 둘도 아니면 그 행의 구현은 아무 데도 안 적혀 있다는 뜻이다. */
  const noTok = rows.filter(r => !/`[^`]+`/.test(r.im) && !/[0-9]/.test(r.im) && !/〃|\bI\b|\bII\b|\bIII\b/.test(r.im));
  chk('6열이 코드·수치·«〃»·«I/II/III» 참조 중 하나는 갖는다 (구현이 아무 데도 없는 행 0)',
    noTok.length === 0, noTok.map(r => r.n).join(',') || `${rows.length}행`);

  /* 토큰 전수 분류 */
  const tokUse = new Map();
  for (const r of rows) for (const t of r.im.matchAll(/`([^`]+)`/g)) {
    if (!tokUse.has(t[1])) tokUse.set(t[1], []);
    tokUse.get(t[1]).push(r.n);
  }
  const isAssign = t => /^p\.[A-Za-z]+\s*(\*=|\+=|=)\s*[0-9.]+(\s*\/\s*[0-9.]+)?$/.test(t);
  const cls = t => IDENT.includes(t) ? 'ident'
    : (CALLS[t] ? 'call' : (CONST_TOK.includes(t) ? 'const'
      : (isAssign(t) ? 'assign' : (OTHER_TOK.includes(t) ? 'other' : null))));
  const unknown = [...tokUse.keys()].filter(t => cls(t) === null);
  chk(`6열 백틱 토큰 ${tokUse.size}종이 전부 분류표에 있다 (미분류 0 — 새 토큰은 여기서 걸린다)`,
    unknown.length === 0, unknown.map(t => `«${t}»`).join(' ') || `${tokUse.size}종`);

  /* 죽은 선언 = 불합격 (T157 규약 이식) */
  const dead = [];
  for (const t of IDENT) if (!tokUse.has(t)) dead.push(`IDENT:${t}`);
  for (const t of Object.keys(CALLS)) if (!tokUse.has(t)) dead.push(`CALLS:${t}`);
  for (const t of CONST_TOK) if (!tokUse.has(t)) dead.push(`CONST_TOK:${t}`);
  for (const t of OTHER_TOK) if (!tokUse.has(t)) dead.push(`OTHER_TOK:${t}`);
  for (const e of NUM) if (!byN[e.r]) dead.push(`NUM:행${e.r}`);
  for (const e of BASE) if (!byN[e.r]) dead.push(`BASE:행${e.r}`);
  chk('선언표에 죽은 항목이 없다 (6열에서 사라진 토큰을 표가 계속 들고 있지 않다)',
    dead.length === 0, dead.join(' · ') || `${IDENT.length + Object.keys(CALLS).length + CONST_TOK.length + OTHER_TOK.length}종 + NUM ${NUM.length} + BASE ${BASE.length}`);

  /* ===== §B 이름 — 두 엔진 실재 ===== */
  console.log('\n=== §B 이름 — 백틱 식별자·호출 머리·상수가 두 엔진에 실재한다 ===');
  const missId = IDENT.filter(t => !word(simSrc, t) || !word(htmSrc, t));
  chk(`bare 식별자 ${IDENT.length}종이 두 엔진에 전부 있다`, missId.length === 0,
    missId.join(',') || `${IDENT.length}종`);
  const heads = [...new Set(Object.keys(CALLS).map(t => t.slice(0, t.indexOf('('))))];
  const missFn = heads.filter(f => !(word(simSrc, f) && word(htmSrc, f)));
  chk(`호출 머리(함수명) ${heads.length}종이 두 엔진에 전부 있다`, missFn.length === 0,
    missFn.join(',') || heads.join(','));
  const cBad = [];
  for (const t of CONST_TOK) {
    const [nm, want] = t.split('=').map(s => s.trim());
    const sv = constVal(simSrc, nm), hv = constVal(htmSrc, nm);
    if (sv === null || hv === null) { cBad.push(`${nm}(없음 sim=${sv} game=${hv})`); continue; }
    if (!near(sv, hv)) { cBad.push(`${nm}(sim ${sv} ≠ game ${hv})`); continue; }
    if (want !== undefined && !near(sv, Number(want))) cBad.push(`${nm}(엔진 ${sv} ≠ PLAN 병기 ${want})`);
  }
  chk(`백틱 상수 ${CONST_TOK.length}종이 두 엔진에 같은 값 · PLAN 병기값과도 같다`, cBad.length === 0,
    cBad.join(' · ') || `${CONST_TOK.length}종`);

  /* ===== §C 수치 — 호출 리터럴 · NUMMAP ===== */
  console.log('\n=== §C 수치 — 호출 리터럴(글자 그대로) · 6열 수치 ↔ 엔진 상수 ===');
  const sN = nows(simSrc), hN = nows(htmSrc);
  /* ⚑ «소스 어딘가에 그 문자열이 있다» 로는 부족하다 — 같은 호출이 여러 특전에 쓰여서,
     한 자리를 흔들어도 다른 자리 덕에 초록이 된다(자기검사에서 실제로 걸렸다).
     그래서 **그 행의 px 앵커와 같은 줄**에 그 호출이 있는지를 본다. */
  const anchors = id => [id, id.replace(/[NRL]$/, '')];
  const litLine = (src, anc, call) => src.split('\n').some(l =>
    anc.some(a => new RegExp('(?:^|[^A-Za-z0-9_$])' + a + '(?![A-Za-z0-9_$])').test(l)) && nows(l).includes(nows(call)));
  const litBad = []; let litCnt = 0;
  for (const r of rows) for (const t of r.im.matchAll(/`([^`]+)`/g)) {
    if (CALLS[t[1]] !== 'lit') continue;
    litCnt++;
    const anc = anchors(r.id);
    const s = litLine(simSrc, anc, t[1]), h = litLine(htmSrc, anc, t[1]);
    if (!s || !h) litBad.push(`행${r.n} ${r.id} «${t[1]}»(sim ${s ? 'O' : 'X'} / game ${h ? 'O' : 'X'})`);
  }
  chk(`«글자 그대로» 호출 ${litCnt}건이 두 엔진의 **그 특전 자리에** 그대로 있다`, litBad.length === 0,
    litBad.join(' · ') || `${litCnt}건 × 2엔진`);
  const numBad = [];
  for (const e of NUM) {
    const row = byN[e.r];
    if (!row) { numBad.push(`행${e.r}(행 없음)`); continue; }
    if (!row.im.includes(e.s)) { numBad.push(`행${e.r} PLAN 에 «${e.s}» 없음`); continue; }
    if (e.k === null) {
      if (!sN.includes(nows(e.v)) || !hN.includes(nows(e.v)))
        numBad.push(`행${e.r} 엔진에 «${e.v}» 없음(sim ${sN.includes(nows(e.v))} / game ${hN.includes(nows(e.v))})`);
      continue;
    }
    const sv = constVal(simSrc, e.k), hv = constVal(htmSrc, e.k);
    if (!near(sv, hv)) { numBad.push(`행${e.r} ${e.k}(sim ${sv} ≠ game ${hv})`); continue; }
    if (!near(sv, e.v)) { numBad.push(`행${e.r} ${e.k}(엔진 ${sv} ≠ PLAN ${e.v})`); continue; }
    /* 파생 표기(«10/100 → 10/107» 처럼 상수에서 계산되는 문면)는 계산 결과가 6열에 있어야 한다 */
    if (e.f && !row.im.includes(e.f(sv))) numBad.push(`행${e.r} 파생 문면 «${e.f(sv)}» 가 6열에 없다`);
  }
  chk(`6열 수치 ${NUM.length}건이 두 엔진 상수값과 같다 (PLAN·sim·game 3자)`, numBad.length === 0,
    numBad.join(' · ') || `${NUM.length}건`);

  /* ===== §D 실행 — «획득 시» 대입식을 굴려서 잰다 ===== */
  console.log('\n=== §D 실행 — 두 엔진 `ap(p)` 를 굴려 6열 대입식과 대조 ===');
  const K = loadSim(simSrc), Hh = loadHtm(htmSrc);
  if (!chk('두 엔진의 특전 배열을 vm 에 올렸다 (각 100종)',
    !!K && !!Hh && K.PERKS.length === 100 && Hh.PERKS.length === 100,
    `sim ${K ? K.PERKS.length : 'X'} · game ${Hh ? Hh.PERKS.length : 'X'}`)) return R;

  const apBad = [], extraBad = [];
  let apRows = 0, apAsg = 0;
  for (const r of rows) {
    if (!/획득 시/.test(r.im)) continue;
    const ms = [...r.im.matchAll(/`p\.([A-Za-z]+)\s*(\*=|\+=|=)\s*([0-9.]+(?:\s*\/\s*[0-9.]+)?)`/g)];
    if (!ms.length) continue;
    apRows++; apAsg += ms.length;
    for (const [tag, arr] of [['sim', K.PERKS], ['game', Hh.PERKS]]) {
      const perk = arr.find(p => p.id === r.id);
      if (!perk || typeof perk.ap !== 'function') { apBad.push(`행${r.n} ${r.id}[${tag}] ap 없음`); continue; }
      const p = mkP(K.basePx()), before = {};
      for (const f of FIELDS) before[f] = p[f];
      try { perk.ap(p); } catch (e) { apBad.push(`행${r.n} ${r.id}[${tag}] ap 예외 ${e.message}`); continue; }
      for (const m of ms) {
        const f = m[1], op = m[2], lit = m[3].replace(/\s+/g, '');
        const v = lit.includes('/') ? Number(lit.split('/')[0]) / Number(lit.split('/')[1]) : Number(lit);
        const want = op === '*=' ? before[f] * v : op === '+=' ? before[f] + v : v;
        if (!(Math.abs(p[f] - want) < 1e-9))
          apBad.push(`행${r.n} ${r.id}[${tag}] p.${f} ${op} ${m[3]} → 기대 ${want} 실제 ${p[f]}`);
      }
      const claimed = ms.map(m => m[1]);
      const extra = FIELDS.filter(f => Math.abs(p[f] - before[f]) > 1e-9 && !claimed.includes(f));
      if (extra.length) extraBad.push(`행${r.n} ${r.id}[${tag}] ${extra.map(f => `${f} ${before[f]}→${p[f]}`).join(', ')}`);
    }
  }
  chk(`«획득 시» 대입식 ${apAsg}건(${apRows}행)이 두 엔진 실행 델타와 정확히 같다`, apBad.length === 0,
    apBad.join(' · ') || `${apAsg}건 × 2엔진`);
  chk('두 엔진이 PLAN 에 없는 스탯을 몰래 바꾸지 않는다 (추가 변경 0)', extraBad.length === 0,
    extraBad.join(' · ') || `${apRows}행`);

  /* ===== §E 정합 — 기본치 · 행 번호 참조 · 합산 산술 ===== */
  console.log('\n=== §E 정합 — «기본 X → Y» · «N번» 참조 · 합산 산술 ===');
  const baseBad = [];
  for (const e of BASE) {
    const r = byN[e.r];
    const m = r && r.im.match(/기본 ([0-9.]+) → ([0-9.]+)/);
    if (!m) { baseBad.push(`행${e.r} «기본 X → Y» 문면이 없다`); continue; }
    const X = Number(m[1]), Y = Number(m[2]);
    const sv = constVal(simSrc, e.tune), hv = constVal(htmSrc, e.tune);
    if (!near(sv, hv)) { baseBad.push(`행${e.r} TUNE.${e.tune}(sim ${sv} ≠ game ${hv})`); continue; }
    if (!near(X, sv)) { baseBad.push(`행${e.r} «기본 ${X}» ≠ 엔진 TUNE.${e.tune} = ${sv}`); continue; }
    const am = r.im.match(/`p\.[A-Za-z]+\s*\+=\s*([0-9.]+)`/);
    if (!am) { baseBad.push(`행${e.r} 증가량 대입식이 없다`); continue; }
    if (!near(Y, X + Number(am[1]))) baseBad.push(`행${e.r} «→ ${Y}» ≠ ${X} + ${am[1]} = ${X + Number(am[1])}`);
  }
  chk(`«기본 X → Y» ${BASE.length}행의 X 가 엔진 기본치이고 Y = X + 증가량이다`, baseBad.length === 0,
    baseBad.join(' · ') || `${BASE.length}행`);

  /* «N번과 …» 참조 — 가리키는 행이 같은 축(이름이 서로의 접두)인가 */
  const refBad = []; let refCnt = 0;
  for (const r of rows) {
    for (const m of r.im.matchAll(/([0-9]+(?:·[0-9]+)*)\s*번(?=과|와)/g)) {
      for (const t of m[1].split('·')) {
        refCnt++;
        const tgt = byN[+t];
        if (!tgt) { refBad.push(`행${r.n} → ${t}번(없는 행)`); continue; }
        if (!(tgt.nm.startsWith(r.nm) || r.nm.startsWith(tgt.nm)))
          refBad.push(`행${r.n}«${r.nm}» → ${t}번«${tgt.nm}»(다른 축)`);
      }
    }
  }
  chk(`6열의 «N번» 참조 ${refCnt}건이 전부 같은 축의 행을 가리킨다`, refBad.length === 0,
    refBad.join(' · ') || `${refCnt}건`);

  /* 참조를 낀 «X → Y» 합산 산술 (예: 50번 «9번과 함께면 150 → Y») */
  const sumBad = []; let sumCnt = 0;
  for (const r of rows) {
    const m = r.im.match(/([0-9]+)번과 함께면 ([0-9.]+) → ([0-9.]+)/);
    if (!m) continue;
    sumCnt++;
    const tgt = byN[+m[1]], X = Number(m[2]), Y = Number(m[3]);
    const inc = s => { const a = s && s.im.match(/`p\.[A-Za-z]+\s*\+=\s*([0-9.]+)`/); return a ? Number(a[1]) : NaN; };
    const want = X + inc(r) + inc(tgt);
    if (!near(Y, want)) sumBad.push(`행${r.n} «${X} → ${Y}» ≠ ${X}+${inc(r)}+${inc(tgt)} = ${want}`);
  }
  chk(`참조 합산 산술 ${sumCnt}건이 맞다 (자기 증가량 + 참조 행 증가량)`, sumBad.length === 0,
    sumBad.join(' · ') || `${sumCnt}건`);

  return R;
}

/* ══════════════════════════════════════════════════════════════════════════
   §F 자기검사 — 사본을 일부러 깨뜨려 이 게이트가 정말 빨개지는지 본다.
   ══════════════════════════════════════════════════════════════════════════ */
const MUT = [
  /* ── PLAN 6열을 흔든다 (드리프트 = 실제로 일어난 사고 유형) ── */
  { t: 'PLAN', d: '함수명 개명 (hitPlayer → hurtPlayer)', f: s => s.replace('`hitPlayer`(회피 분기) → `pkk(PERK_EVHEAL_CH=0.33)`', '`hurtPlayer`(회피 분기) → `pkk(PERK_EVHEAL_CH=0.33)`') },
  { t: 'PLAN', d: '상수 병기값 (PERK_EVHEAL_CH 0.33 → 0.08)', f: s => s.replace('pkk(PERK_EVHEAL_CH=0.33)', 'pkk(PERK_EVHEAL_CH=0.08)') },
  { t: 'PLAN', d: '대입식 값 (p.dmg *= 1.15 → 1.20)', f: s => s.replace('`p.dmg *= 1.15`', '`p.dmg *= 1.20`') },
  { t: 'PLAN', d: '대입식 값 (p.evade += 8 → 10)', f: s => s.replace('`p.evade += 8`', '`p.evade += 10`') },
  { t: 'PLAN', d: '대입식 값 (p.critF += 30 → 50)', f: s => s.replace('`p.critF += 30`', '`p.critF += 50`') },
  { t: 'PLAN', d: '대입식 연산자 (p.def *= 1.08 → +=)', f: s => s.replace('`p.def *= 1.08`', '`p.def += 1.08`') },
  { t: 'PLAN', d: '희귀 대입식 (p.dmg *= 1.30 → 1.20)', f: s => s.replace('`p.dmg *= 1.30`', '`p.dmg *= 1.20`') },
  { t: 'PLAN', d: '전설 대입식 (p.def *= 1.24 → 1.20)', f: s => s.replace('`p.def *= 1.24`', '`p.def *= 1.20`') },
  { t: 'PLAN', d: '소환 발수 (fireArrows(p,3) → (p,2))', f: s => s.replace('`fireArrows(p,3)`', '`fireArrows(p,2)`') },
  { t: 'PLAN', d: '소환 발수 (fireAxe(p,2) → (p,3))', f: s => s.replace('`fireAxe(p,2)`', '`fireAxe(p,3)`') },
  { t: 'PLAN', d: '버프 수치 (refreshBuff … 40,2 → 30,2)', f: s => s.replace("`refreshBuff(p,'evade',40,2,'p_killEvBuff')`", "`refreshBuff(p,'evade',30,2,'p_killEvBuff')`") },
  { t: 'PLAN', d: '수집가 계수 (1+0.04·n → 0.05·n)', f: s => s.replace('`×(1+0.04·n)`', '`×(1+0.05·n)`') },
  { t: 'PLAN', d: '즉사 확률 (pkk(0.05) → pkk(0.10))', f: s => s.replace('`pkk(0.05)`', '`pkk(0.10)`') },
  { t: 'PLAN', d: '공속 버프 (0.07,7 → 0.10,7)', f: s => s.replace("`addBuff(p,'aspd',0.07,7)`", "`addBuff(p,'aspd',0.10,7)`") },
  { t: 'PLAN', d: '방어막 확률 (gainWard(p,0.10) → 0.20)', f: s => s.replace('`gainWard(p,0.10)`', '`gainWard(p,0.20)`') },
  { t: 'PLAN', d: '가시 합계 (최대 +600% → +500%)', f: s => s.replace('최대 +600%', '최대 +500%') },
  { t: 'PLAN', d: '기본치 (기본 0 → 8 을 20 → 28 로 되돌림)', f: s => s.replace('(기본 0 → 8 · ⚑ T121 하향 — 종전 +10)', '(기본 20 → 28 · ⚑ T121 하향 — 종전 +10)') },
  { t: 'PLAN', d: '행 번호 참조 (15·80 → 15·32)', f: s => s.replace('15·80 번과', '15·32 번과') },
  { t: 'PLAN', d: '참조 합산 (150 → 240 을 210 으로)', f: s => s.replace('9번과 함께면 150 → 240', '9번과 함께면 150 → 210') },
  { t: 'PLAN', d: '6열을 통째로 비운다(1행)', f: s => s.replace('| `hitPlayer`(회피 분기) → `pkk(PERK_EVHEAL_CH=0.33)` 시 `heal(p, p.maxHp*PERK_EVHEAL_F)` — **회복 증폭 적용**(⚑ T155 교체 — 종전 8%·6%·noBoost) |', '|  |') },
  { t: 'PLAN', d: '분류표에 없는 토큰을 6열에 심는다', f: s => s.replace('`fireBolts(p,1)`', '`fireLaser(p,1)`') },
  /* ── 엔진을 흔든다 (PLAN 은 그대로인데 구현이 옛 값으로 돌아간 형태) ── */
  { t: 'SIM', d: 'sim 상수 (PERK_ATK_M 1.15 → 1.20)', f: s => s.replace('PERK_ATK_M=1.15', 'PERK_ATK_M=1.20') },
  { t: 'SIM', d: 'sim 상수 (PERK_CRITF_A 30 → 50)', f: s => s.replace('PERK_CRITF_A=30', 'PERK_CRITF_A=50') },
  { t: 'SIM', d: 'sim 상수 (PERK_KHEAL_F 0.06 → 0.08)', f: s => s.replace('PERK_KHEAL_F=0.06', 'PERK_KHEAL_F=0.08') },
  { t: 'SIM', d: 'sim 소환 발수 (fireArrows(p,3) → (p,2))', f: s => s.replace('fireArrows(p,3)', 'fireArrows(p,2)') },
  { t: 'SIM', d: 'sim 기본치 (pCrit0 0 → 20)', f: s => s.replace('pCrit0:0,', 'pCrit0:20,') },
  { t: 'SIM', d: 'sim 함수명 개명 (procNHit → procNhits)', f: s => s.replace(/procNHit/g, 'procNhits') },
  { t: 'SIM', d: 'sim 회피 상한 (min(90 → 95)', f: s => s.replace('Math.min(90,e)', 'Math.min(95,e)') },
  { t: 'SIM', d: 'sim ap 에서 대입을 뺀다 (p_evade)', f: s => s.replace('ap:p=>{p.px.p_evade=1;p.evade+=PERK_EVADE_A;}', 'ap:p=>{p.px.p_evade=1;}') },
  { t: 'SIM', d: 'sim ap 이 몰래 다른 스탯도 만진다', f: s => s.replace('ap:p=>{p.px.p_atk=1;p.dmg*=PERK_ATK_M;}', 'ap:p=>{p.px.p_atk=1;p.dmg*=PERK_ATK_M;p.critR+=5;}') },
  { t: 'HTM', d: 'game 상수 (PERK_DEF_M 1.08 → 1.10)', f: s => s.replace('PERK_DEF_M=1.08', 'PERK_DEF_M=1.10') },
  { t: 'HTM', d: 'game 상수 (PERK_EVHEAL_CH 0.33 → 0.08)', f: s => s.replace('PERK_EVHEAL_CH=0.33', 'PERK_EVHEAL_CH=0.08') },
  { t: 'HTM', d: 'game 상수 (PERK_WARD_N 0.10 → 0.15)', f: s => s.replace('PERK_WARD_N=0.10', 'PERK_WARD_N=0.15') },
  { t: 'HTM', d: 'game 소환 발수 (fireAxe(p,2) → (p,1))', f: s => s.replace('fireAxe(p,2)', 'fireAxe(p,1)') },
  { t: 'HTM', d: 'game 기본치 (pCritF0 150 → 180)', f: s => s.replace('pCritF0:150', 'pCritF0:180') },
  { t: 'HTM', d: 'game 함수명 개명 (gainWard → giveWard)', f: s => s.replace(/gainWard/g, 'giveWard') },
  { t: 'HTM', d: 'game 방어 상한 (min(80 → 90)', f: s => s.replace('Math.min(80,', 'Math.min(90,') },
  { t: 'HTM', d: 'game ap 대입값을 리터럴 옛 값으로', f: s => s.replace('ap:p=>{p.px.p_atk=1; p.dmg*=PERK_ATK_M;}', 'ap:p=>{p.px.p_atk=1; p.dmg*=1.20;}') },
];

function selfTest(plan, sim, htm) {
  console.log('\n=== §F 자기검사 — 사본 돌연변이가 전부 빨개지는가 ===');
  const quiet = f => { const o = console.log; console.log = () => {}; try { return f(); } finally { console.log = o; } };
  let ok = 0, noop = 0, fail = [];
  for (const m of MUT) {
    const p = m.t === 'PLAN' ? m.f(plan) : plan;
    const s = m.t === 'SIM' ? m.f(sim) : sim;
    const h = m.t === 'HTM' ? m.f(htm) : htm;
    const src = m.t === 'PLAN' ? plan : m.t === 'SIM' ? sim : htm;
    const mut = m.t === 'PLAN' ? p : m.t === 'SIM' ? s : h;
    if (mut === src) { noop++; fail.push(`${m.t}«${m.d}» — no-op(치환이 안 걸렸다)`); continue; }
    const res = quiet(() => run(p, s, h));
    const red = res.some(x => !x.c);
    if (red) ok++; else fail.push(`${m.t}«${m.d}» — 초록(구멍)`);
  }
  console.log(`  돌연변이 ${MUT.length}종 · 빨강 ${ok} · no-op ${noop} · 실패 ${fail.length}`);
  for (const f of fail) console.log(`    ✗ ${f}`);
  return { ok, noop, fail };
}

/* ── main ─────────────────────────────────────────────────────────────────── */
const plan = fs.readFileSync(path.join(ROOT, 'PLAN.md'), 'utf8');
const sim = fs.readFileSync(path.join(ROOT, 'sim.js'), 'utf8');
const htm = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

if (process.argv.includes('--self')) {
  const r = selfTest(plan, sim, htm);
  const good = r.fail.length === 0 && r.noop === 0 && r.ok === MUT.length;
  console.log(`\n${good ? '✅ 음성 검사 통과' : '❌ 음성 검사 불합격'} — ${r.ok}/${MUT.length}`);
  process.exit(good ? 0 : 1);
}

console.log('🔧 T162 — PLAN §3.1 표 6열(«구현» 열) 전수 대조');
run(plan, sim, htm);
const pass = R.filter(x => x.c).length;
console.log(`\n${pass === R.length ? '✅ 통과' : '❌ 불합격'} — ${pass}/${R.length}`);
process.exit(pass === R.length ? 0 : 1);
