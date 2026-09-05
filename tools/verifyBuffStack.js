#!/usr/bin/env node
/* ================================================================================
   verifyBuffStack — ⚑⚑⚑ T148 (워커 A · sess-0906-25886)

   **버프가 «쌓이는가 / 갱신되는가»** 두 갈래를 **실제로 굴려서** 잰다. 주인 확정이 둘이다:

     ⓐ **무한 중첩이 기본** (2026-09-03 재설계 2차 ② · ROUTINE 802줄)
        주인 원문 «전투 중 버프 중첩 상한 전부 삭제 — 무한 중첩
        («최대 3중첩/5중첩» 전부 제거. 발동될 때마다 계속 쌓임, 각자 자기 시간 끝나면 빠짐)»
        → `addBuff(p,k,amt,dur)` — 호출부 33곳 전부가 이것을 쓴다.
     ⓑ **딱 한 곳만 «갱신형»** (T121 16:0X 표 · ROUTINE 165줄)
        주인 원문 «킬 시 2초간 회피율 +40% **(스택 아님)**»
        위임 «재발동 시 **시간만 갱신**(중첩 없음 · `buffs.evade` 단일 항목 교체)»
        → `refreshBuff(p,'evade',...,'p_killEvBuff')` — 호출부 **1곳뿐**이다.

   ── 구멍을 먼저 증명했다 (T148 사본 실측 · 정적 게이트 30종 전수) ──
   이 갈림을 재는 게이트가 **한 줄도** 없었다. `refreshBuff` 라는 이름이 `tools/` 전체에 한 번도
   안 나왔고, 닿는 자는 `verifyPerkOrder` 뿐인데 그것도 특전표의 **설명문**과 **상수의 값**
   (`PERK_KILLEV_A:'40'` · `PERK_ASPDATK_A:'0.07'`)만 본다 — «그 숫자가 쌓이는가 갱신되는가» 는 안 본다.
   그래서 두 엔진 사본에 고장을 하나씩 심고 정적 게이트 30종을 전수로 돌렸다
   (`verifyScoreCriteria` 는 원본에서도 exit 1 이라 기준선에 그대로 두고 diff 로만 봤다):

     · **B1** `p_killEvBuff` 를 `addBuff` 로 → **회피 +40 이 킬마다 무한 누적**(상한 90까지) ⇒ 통과 수 diff **0**
     · **B2** `p_aspdAtk` 를 `refreshBuff` 로 → **공속 +7% 가 한 겹으로 고정**(중첩 사망)   ⇒ 통과 수 diff **0**
     · **B3** `refreshBuff` 의 태그 제거 루프를 삭제 → **이름만 갱신형 · 실제로는 중첩**    ⇒ 통과 수 diff **0**
     · **B4** `refreshBuff` 가 태그를 안 보고 그 축을 통째로 비움 → **남의 버프까지 지운다**  ⇒ 통과 수 diff **0**
     · **B5** 태그 달린 버프가 시간 감소에서 빠짐 → **갱신형 버프가 영구가 된다**            ⇒ 통과 수 diff **0**

   다섯 개 전부 **30종 어느 게이트도 한 글자 안 움직였다**(exit 코드·통과 수 완전 동일).

   ── 그래서 이 게이트가 하는 일 ──
   문면 대조가 아니라 **실측 동결**이다.
     ① `sim.js` 의 진짜 `addBuff`·`refreshBuff`·`onKill`·`procOnAttack`·`bsum`·`effEvade`·`effAspd` 를
        vm 에 올려 «몇 겹 남는가 · 시간이 되돌아가는가 · 남의 태그가 살아남는가» 를 직접 센다.
     ② **시간 감소 루프를 소스에서 떼어내** 그대로 굴린다 — 재현하지 않고 진짜 코드를 돌린다.
     ③ `index.html` 의 같은 일곱 동사를 떼어내 **같은 표를 다시 잰다**(두 엔진 각각 실측).
     ④ 호출부 전수 — `refreshBuff` 호출은 두 엔진 각각 **정확히 1곳**이고 그것이 `p_killEvBuff` 다.
        나머지 버프 호출부는 전부 `addBuff` 다(특히 `p_aspdAtk`).
     ⑤ 두 엔진 문면 1:1 + 상수 일치 + ROUTINE 주인 원문 + PLAN §3.1·§3.0 표.

   ── 이 게이트를 고쳐도 되는 때 ──
   **주인이 «어느 버프가 갱신형인가» 를 새로 확정했을 때뿐이다.** 갱신형이 하나 늘면 ④ 가 빨개진다 —
   그때 주인 원문과 함께 목록을 늘리고 PROGRESS 에 남긴다(고치는 것 자체가 diff 에 드러나는 것이 요점).
   밸런스 수치(`PERK_KILLEV_A/T`·`PERK_ASPDATK_A/T`)는 **박지 않고 소스에서 읽는다** —
   주인이 값을 바꾸면 이 게이트는 그대로 초록이다(상시 규칙 «밸런스 조절 하지 마»).

   사용: node tools/verifyBuffStack.js        (exit 0 = 통과, 1 = 불합격)
   음성: node tools/verifyBuffStack.js --self (심은 고장 12종 + 양성 대조군)
   ================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ── ROUTINE 주인 원문 / PLAN 표 — 규칙을 지우고 동작을 뒤집는 경로를 막는다 ──── */
const RULE_INF = /전투 중 버프 중첩 상한 전부 삭제 — 무한 중첩/;
const RULE_INF2 = /발동될 때마다 계속 쌓임, 각자 자기 시간 끝나면 빠짐/;
const RULE_KILLEV_OWN = /킬 시 2초간 회피율 \+40% \(스택 아님\)/;
const RULE_KILLEV_DEL = /재발동 시 \*\*시간만 갱신\*\*\(중첩 없음 · `buffs\.evade` 단일 항목 교체\)/;
const RULE_ASPD_OWN = /공격 시 공격속도 \+7% 7초 \(스택형 · 중첩\)/;
const RULE_ASPD_DEL = /기존 버프 엔진\(무한 중첩\)/;
/* PLAN — §6 총칙 한 줄 + §3.1 두 행 */
const PLAN_INF = /\*\*버프 중첩 상한 전부 삭제 — 무한 중첩\*\* \(주인 확정\)/;
const PLAN_KILLEV = /\| p_killEvBuff \| 일반 \| 처치 시 회피 버프 \|[^|]*\|[^|]*\*\*갱신형\*\*\(중첩 아님 · 재발동 시 시간만 2초로 되돌린다\) \|/;
const PLAN_ASPD = /\| p_aspdAtk \| 일반 \| 공격 시 공속 버프 \|[^|]*\|[^|]*무한 중첩[^|]*\|/;

/* ── 두 엔진 공통 축 (공백 제거 후 대조) ──────────────────────────────────
   `index.html` 은 같은 자리에 표시 갱신(renderStatsGrid·renderBuffBar)과 아이콘용 인자(src·q)가
   붙어 있어 줄이 글자 그대로는 다르다. 그래서 «무엇을 어떻게 담는가» 만 남긴 정규식으로 묶는다. */
const AX = [
  ['`addBuff` 는 **밀어 넣기만** 한다 (상한 검사 없음 = 무한 중첩)',
    /functionaddBuff\(p,k,amt,dur(?:,src)?\)\{p\.buffs\[k\]\.push\(\{t:dur,amt/],
  ['`refreshBuff` 는 **같은 태그만** 지우고 하나를 넣는다 (시간만 갱신)',
    /constarr=p\.buffs\[k\];for\(leti=arr\.length-1;i>=0;i--\)if\(arr\[i\]\.tag===tag\)arr\.splice\(i,1\);arr\.push\(\{t:dur,amt,tag/],
  ['갱신형 호출부는 «처치 시 회피 버프» 하나 — 태그도 그 특전 id',
    /if\(px\.p_killEvBuff\)refreshBuff\(p,'evade',PERK_KILLEV_A,PERK_KILLEV_T,'p_killEvBuff'\);/],
  ['«공격 시 공속 버프» 는 중첩형이라 `addBuff` 를 쓴다',
    /if\(px\.p_aspdAtk\)addBuff\(p,'aspd',PERK_ASPDATK_A,PERK_ASPDATK_T(?:,'p_aspdAtk')?\);/],
  ['버프는 **자기 시간에 각각** 빠진다 (태그 유무를 가리지 않는다)',
    /for\(constkinp\.buffs\)\{constarr=p\.buffs\[k\];for\(leti=arr\.length-1;i>=0;i--\)\{arr\[i\]\.t-=dt;if\(arr\[i\]\.t<=0\)\{?arr\.splice\(i,1\);/],
  ['실효 회피 = 기저 + 버프 **합** (상한 90 은 엔진 규칙)',
    /lete=p\.evade\+bsum\(p,'evade'\);/],
  ['실효 공속 = 기저 × (1 + 버프 합) — 겹이 늘면 그만큼 곱이 커진다',
    /p\.aspd\*\(1\+bsum\(p,'aspd'\)\)/],
];

/* ================================================================
   `sim.js` 를 CLI 디스패처 앞까지만 vm 에 올려 버프 동사를 그대로 꺼낸다.
   ================================================================ */
const CUT = "const mode=process.argv[2]||'all';";
function loadSim(src) {
  const at = src.indexOf(CUT);
  if (at < 0) return null;
  const M = Object.create(Math);
  const ctx = {
    console: { log() {} }, process, Math: M, JSON, Number, String, Array,
    Set, Map, Object, Date, parseInt, parseFloat, isFinite, isNaN, require,
  };
  vm.createContext(ctx);
  try {
    vm.runInContext(src.slice(0, at) +
      '\n;globalThis.__K={PERKS,basePx,addBuff,refreshBuff,bsum,onKill,procOnAttack,' +
      'effEvade,effAspd,PERK_KILLEV_A,PERK_KILLEV_T,PERK_ASPDATK_A,PERK_ASPDATK_T};', ctx);
  } catch (e) { return null; }
  const K = ctx.__K || (ctx.globalThis && ctx.globalThis.__K);
  return K ? { K, M } : null;
}

/* 함수 하나를 통째로 떼어낸다 (중괄호 짝맞춤) */
function pluck(src, name) {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) return null;
  let i = src.indexOf('{', at), d = 0;
  if (i < 0) return null;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (d === 0) return src.slice(at, j + 1); }
  }
  return null;
}

/* ⚑ 시간 감소 루프를 **소스에서 그대로** 떼어낸다 — 재현하지 않고 진짜 코드를 굴린다.
   `for(const k in p.buffs)` 는 두 엔진에 여럿 있으므로 «`t-=dt` 를 품은 것» 만 고른다. */
function pluckTick(src) {
  const KEY = 'for(const k in p.buffs)';
  let from = 0;
  for (;;) {
    const at = src.indexOf(KEY, from);
    if (at < 0) return null;
    const b = src.indexOf('{', at);
    if (b < 0) return null;
    let d = 0, end = -1;
    for (let j = b; j < src.length; j++) {
      if (src[j] === '{') d++;
      else if (src[j] === '}') { d--; if (d === 0) { end = j + 1; break; } }
    }
    if (end < 0) return null;
    const blk = src.slice(at, end);
    if (blk.includes('t-=dt')) return blk;
    from = at + KEY.length;
  }
}
/* 떼어낸 루프를 `(p,dt)` 함수로 감싸 vm 에서 실행 (index.html 쪽은 `bc` 플래그를 쓴다) */
function mkTick(blk) {
  const ctx = { __f: null };
  vm.createContext(ctx);
  try {
    vm.runInContext(`__f=function(p,dt){ let bc=false;\n${blk}\nreturn bc; };`, ctx);
  } catch (e) { return null; }
  return ctx.__f;
}

/* `index.html` 에서 버프 동사를 떼어내 vm 에 올린다 — 게임 쪽도 **굴려서** 잰다. */
function loadHtm(src) {
  const num = k => { const m = src.match(new RegExp(k + '\\s*=\\s*([\\d.]+)')); return m ? +m[1] : NaN; };
  const need = ['addBuff', 'refreshBuff', 'bsum', 'effAspd', 'effEvade'];
  const body = [];
  for (const n of need) { const f = pluck(src, n); if (!f) return null; body.push(f); }
  const ctx = {
    Math, Object, Array,
    buffSeq: 0,
    renderStatsGrid() {}, renderBuffBar() {},
    PERK_NOSH_ASPD: num('PERK_NOSH_ASPD'),
  };
  vm.createContext(ctx);
  try {
    vm.runInContext(body.join('\n') +
      '\n;globalThis.__H={addBuff,refreshBuff,bsum,effAspd,effEvade};', ctx);
  } catch (e) { return null; }
  const H = ctx.__H || (ctx.globalThis && ctx.globalThis.__H);
  return H ? { H } : null;
}

/* ── 공통 플레이어 틀 (verifyCritStack 과 같은 모양) ─────────────────────── */
function mkP(px, over) {
  return Object.assign({
    worldX: 0, dmg: 100, aspd: 1, critR: 0, critF: 150, def: 0, counter: 0, evade: 0,
    steal: 0, killHeal: 0, misfire: 0, goldMul: 1, walkMul: 1, healAmp: 0, repairAmp: 0,
    nextCrit: false, nextAtk: 0, ward: 0, maxHp: 1e9, hp: 1e9, maxSh: 0, sh: 0,
    level: 1, exp: 0, critStk: 0, nhit: {}, collHpF: 1, atkTimer: 1,
    sureCrit: false, bsStk: 0, dash: false,
    buffs: { atk: [], aspd: [], critR: [], critF: [], def: [], evade: [] }, px,
  }, over || {});
}
/* 적 `n` 마리짜리 웨이브 하나 + 특전 `ids` 만 가진 플레이어 */
function arena(K, ids, n, over) {
  const nd = { type: 'wave', x: 0, done: false, enemies: [] };
  for (let j = 0; j < (n || 6); j++)
    nd.enemies.push({ worldX: 100 + j * 40, hp: 1e15, maxHp: 1e15, dmg: 1, ranged: false,
      atkTimer: 1, stun: 0, slow: 0, wave: nd, dead: false, isBoss: false, exp: 0 });
  const p = mkP(K.basePx(), over);
  const G = { chapter: 1, player: p, nodes: [nd], pprojs: [], arrows: [], gold: 0, kills: 0,
    procN: 0, perkChances: 0, taken: [], overBoltCd: 0, autoBoltT: 3, autoSumT: 2, rampT: 3,
    stuns: 0, misses: 0, dead: false, cleared: true, t: 0, atkTries: 0, miss: 0, noPerk: true };
  p.G = G;
  for (const id of ids) {
    const k = K.PERKS.find(x => x.id === id);
    if (!k) return null;
    k.ap(p); G.taken.push(k);
  }
  return { G, p, es: nd.enemies };
}

/* ================================================================ */
const R = [];
let QUIET = true;
const chk = (name, pass, detail) => {
  const x = { name, c: !!pass, d: detail == null ? '' : String(detail) };
  R.push(x);
  if (!QUIET) console.log(`  ${x.c ? '✓' : '✗'} ${x.name}${x.c ? '' : '  — ' + x.d}`);
};
const near = (a, b) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));
/* 부동소수 꼬리를 자른 표시용 숫자 (판정에는 쓰지 않는다) */
const nn = x => +(+x).toFixed(6);

function run(simSrc, htmSrc, routineSrc, planSrc, quiet) {
  R.length = 0;
  QUIET = !!quiet;
  const say = quiet ? () => {} : console.log;

  const L = loadSim(simSrc);
  if (!L) { chk('sim.js 버프 동사 적재', false, 'vm 적재 실패 — 함수 이름이나 CLI 디스패처 위치가 바뀌었다. 게이트를 함께 고칠 것'); return finish(); }
  const { K, M } = L;
  M.random = () => 0;                 /* 확률 트리거는 전부 «발동» 으로 고정 (갈림과 무관한 잡음 제거) */
  const S = simSrc.replace(/\s+/g, '');
  const H = htmSrc.replace(/\s+/g, '');
  const EV_A = +K.PERK_KILLEV_A, EV_T = +K.PERK_KILLEV_T;
  const AS_A = +K.PERK_ASPDATK_A, AS_T = +K.PERK_ASPDATK_T;

  /* ---------- ① 갱신형 `refreshBuff` — 같은 태그는 항상 한 겹 ---------- */
  say('\n=== ① ⚑ 갱신형 — 주인 «(스택 아님)» · 위임 «시간만 갱신 · 단일 항목 교체» ===');
  {
    chk(`상수를 소스에서 읽었다 (회피 +${EV_A} · ${EV_T}초 · 공속 +${AS_A} · ${AS_T}초 — 밸런스 값은 박지 않는다)`,
      [EV_A, EV_T, AS_A, AS_T].every(x => Number.isFinite(x) && x > 0), `${EV_A}/${EV_T}/${AS_A}/${AS_T}`);

    const p = mkP(K.basePx());
    for (let i = 0; i < 5; i++) K.refreshBuff(p, 'evade', EV_A, EV_T, 'p_killEvBuff');
    chk('같은 태그로 5번 발동 → 항목은 **1개** (중첩되지 않는다)', p.buffs.evade.length === 1, p.buffs.evade.length);
    chk(`버프 합도 한 겹치 (${EV_A} · ${5 * EV_A} 이 아니다)`, near(K.bsum(p, 'evade'), EV_A), K.bsum(p, 'evade'));
    chk('남은 항목에 태그가 붙어 있다', p.buffs.evade[0].tag === 'p_killEvBuff', p.buffs.evade[0].tag);
    chk(`남은 항목의 시간 = ${EV_T}초 (합쳐지지 않는다)`, near(p.buffs.evade[0].t, EV_T), p.buffs.evade[0].t);
  }

  /* ---------- ② «시간만» 갱신 — 흘러간 시간이 되돌아간다 ---------- */
  say('\n=== ② ⚑ «시간만 갱신» — 재발동이 남은 시간을 되돌린다 (수치는 그대로) ===');
  {
    const tick = mkTick(pluckTick(simSrc) || '');
    if (!tick) { chk('sim.js 버프 시간 감소 루프 적재', false, '루프를 못 떼어냈다 — 게이트를 함께 고칠 것'); }
    else {
      const p = mkP(K.basePx());
      K.refreshBuff(p, 'evade', EV_A, EV_T, 'p_killEvBuff');
      tick(p, EV_T * 0.5);
      chk(`${EV_T * 0.5}초 흐른 뒤 남은 시간 ${EV_T * 0.5}`, near(p.buffs.evade[0].t, EV_T * 0.5), p.buffs.evade[0].t);
      K.refreshBuff(p, 'evade', EV_A, EV_T, 'p_killEvBuff');
      chk(`재발동 → 시간이 ${EV_T} 로 되돌아간다`, near(p.buffs.evade[0].t, EV_T), p.buffs.evade[0].t);
      chk('재발동해도 항목은 여전히 1개', p.buffs.evade.length === 1, p.buffs.evade.length);
      chk(`재발동해도 수치는 ${EV_A} 그대로 (누적하지 않는다)`, near(p.buffs.evade[0].amt, EV_A), p.buffs.evade[0].amt);
      /* ⚑ 갱신형도 «자기 시간이 끝나면 빠진다» — 영구가 아니다 */
      tick(p, EV_T + 0.01);
      chk('갱신형 버프도 시간이 끝나면 **사라진다** (영구가 아니다)', p.buffs.evade.length === 0, p.buffs.evade.length);
    }
  }

  /* ---------- ③ 다른 태그·무태그와 공존 ---------- */
  say('\n=== ③ ⚑ 태그가 다르면 공존한다 — 갱신형이 남의 버프를 지우지 않는다 ===');
  {
    const p = mkP(K.basePx());
    K.refreshBuff(p, 'evade', EV_A, EV_T, 'p_killEvBuff');
    K.refreshBuff(p, 'evade', 15, 9, '다른태그');
    K.addBuff(p, 'evade', 8, 9);                       /* 태그 없는 중첩형 버프 (장비 옵션 계열) */
    chk('태그 2종 + 무태그 1개 = 항목 3개', p.buffs.evade.length === 3, p.buffs.evade.length);
    chk(`버프 합 = ${EV_A}+15+8 = ${EV_A + 23}`, near(K.bsum(p, 'evade'), EV_A + 23), K.bsum(p, 'evade'));
    K.refreshBuff(p, 'evade', EV_A, EV_T, 'p_killEvBuff');
    chk('내 태그를 다시 굴려도 항목은 여전히 3개 (남의 것은 안 지운다)', p.buffs.evade.length === 3, p.buffs.evade.length);
    chk('다른 태그 항목의 시간이 그대로다', near((p.buffs.evade.find(b => b.tag === '다른태그') || {}).t, 9),
      (p.buffs.evade.find(b => b.tag === '다른태그') || {}).t);
    chk('무태그(중첩형) 항목도 살아 있다', p.buffs.evade.filter(b => b.tag === undefined).length === 1,
      p.buffs.evade.filter(b => b.tag === undefined).length);
    /* 다른 축(aspd)은 애초에 건드리지 않는다 */
    K.addBuff(p, 'aspd', AS_A, AS_T);
    K.refreshBuff(p, 'evade', EV_A, EV_T, 'p_killEvBuff');
    chk('다른 축(aspd)의 버프는 손대지 않는다', p.buffs.aspd.length === 1, p.buffs.aspd.length);
  }

  /* ---------- ④ 중첩형 `addBuff` — 무한 중첩 ---------- */
  say('\n=== ④ ⚑ 무한 중첩 — 주인 «발동될 때마다 계속 쌓임» (상한 검사 없음) ===');
  {
    const p = mkP(K.basePx());
    for (let i = 0; i < 12; i++) K.addBuff(p, 'aspd', AS_A, AS_T);
    chk('12번 발동 → 12겹 (3중첩·5중첩 상한이 없다)', p.buffs.aspd.length === 12, p.buffs.aspd.length);
    chk(`버프 합 = ${nn(12 * AS_A)} (겹만큼 더해진다)`, near(K.bsum(p, 'aspd'), 12 * AS_A), K.bsum(p, 'aspd'));
    chk(`실효 공속 = 1 × (1 + ${nn(12 * AS_A)})`, near(K.effAspd(p), 1 * (1 + 12 * AS_A)), K.effAspd(p));
    chk('중첩형 항목에는 태그가 없다 (`refreshBuff` 가 잡을 수 없다)',
      p.buffs.aspd.every(b => b.tag === undefined), p.buffs.aspd.filter(b => b.tag !== undefined).length);
    /* 5번째 인자(구 `max`)를 넘겨도 무시된다 — 상한이 되살아나지 않는다 */
    const q = mkP(K.basePx());
    for (let i = 0; i < 7; i++) K.addBuff(q, 'atk', 0.05, 3, 2);
    chk('다섯째 인자(구 `max`)를 넘겨도 상한이 되살아나지 않는다 (7겹)', q.buffs.atk.length === 7, q.buffs.atk.length);
  }

  /* ---------- ⑤ 버프는 자기 시간에 **각각** 빠진다 ---------- */
  say('\n=== ⑤ ⚑ «각자 자기 시간 끝나면 빠짐» — 겹마다 따로 만료 ===');
  {
    const tick = mkTick(pluckTick(simSrc) || '');
    if (!tick) chk('sim.js 시간 감소 루프 적재 (⑤)', false, '루프를 못 떼어냈다');
    else {
      const p = mkP(K.basePx());
      K.addBuff(p, 'aspd', 0.10, 2);
      K.addBuff(p, 'aspd', 0.20, 5);
      K.refreshBuff(p, 'evade', EV_A, 4, 'p_killEvBuff');
      tick(p, 3);
      chk('3초 뒤 — 2초짜리는 빠지고 5초짜리만 남는다', p.buffs.aspd.length === 1, p.buffs.aspd.length);
      chk('남은 것이 5초짜리(+0.20)다', near(K.bsum(p, 'aspd'), 0.20), K.bsum(p, 'aspd'));
      chk('4초짜리 갱신형은 아직 살아 있다 (겹마다 따로 센다)', p.buffs.evade.length === 1, p.buffs.evade.length);
      tick(p, 1.5);
      chk('4.5초 뒤 — 갱신형이 빠졌다', p.buffs.evade.length === 0, p.buffs.evade.length);
      chk('5초짜리는 아직 남아 있다', p.buffs.aspd.length === 1, p.buffs.aspd.length);
      tick(p, 1);
      chk('5.5초 뒤 — 전부 빠졌다', p.buffs.aspd.length === 0, p.buffs.aspd.length);
    }
  }

  /* ---------- ⑥ 실동작 — 처치 시 회피 버프 (`onKill`) ---------- */
  say('\n=== ⑥ ⚑ 실동작 «처치 시 회피 버프» — 킬을 실제로 굴려서 잰다 ===');
  {
    const a = arena(K, ['p_killEvBuff'], 6);
    if (!a) { chk('특전 id 확인 (p_killEvBuff)', false, '못 찾았다'); return finish(); }
    chk('시작 회피 버프 0겹', a.p.buffs.evade.length === 0, a.p.buffs.evade.length);
    K.onKill(a.G, a.es[0], 0);
    chk(`킬 1회 → 회피 버프 1겹 (+${EV_A})`, a.p.buffs.evade.length === 1 && near(K.bsum(a.p, 'evade'), EV_A),
      `${a.p.buffs.evade.length}겹 / ${K.bsum(a.p, 'evade')}`);
    for (let i = 1; i < 5; i++) K.onKill(a.G, a.es[i], 0);
    chk('킬 5회 → 여전히 **1겹** (킬마다 쌓이지 않는다)', a.p.buffs.evade.length === 1, a.p.buffs.evade.length);
    chk(`실효 회피 = ${EV_A} (${5 * EV_A} 도 상한 90 도 아니다)`, near(K.effEvade(a.p), EV_A), K.effEvade(a.p));
    chk('그 항목의 태그가 `p_killEvBuff` 다', a.p.buffs.evade[0].tag === 'p_killEvBuff', a.p.buffs.evade[0].tag);
    /* 특전이 없으면 아예 안 걸린다 (대조군) */
    const b = arena(K, [], 6);
    for (let i = 0; i < 3; i++) K.onKill(b.G, b.es[i], 0);
    chk('특전이 없으면 회피 버프가 안 생긴다 (대조군)', b.p.buffs.evade.length === 0, b.p.buffs.evade.length);
  }

  /* ---------- ⑦ 실동작 — 공격 시 공속 버프 (`procOnAttack`) ---------- */
  say('\n=== ⑦ ⚑ 실동작 «공격 시 공속 버프» — 공격을 실제로 굴려서 잰다 (중첩형) ===');
  {
    const a = arena(K, ['p_aspdAtk'], 6);
    if (!a) { chk('특전 id 확인 (p_aspdAtk)', false, '못 찾았다'); return finish(); }
    K.procOnAttack(a.G, a.es[0]);
    chk(`공격 1회 → 공속 버프 1겹 (+${AS_A})`, a.p.buffs.aspd.length === 1 && near(K.bsum(a.p, 'aspd'), AS_A),
      `${a.p.buffs.aspd.length}겹 / ${K.bsum(a.p, 'aspd')}`);
    for (let i = 0; i < 7; i++) K.procOnAttack(a.G, a.es[0]);
    chk('공격 8회 → **8겹** (갱신형이 아니다)', a.p.buffs.aspd.length === 8, a.p.buffs.aspd.length);
    chk(`버프 합 = ${nn(8 * AS_A)}`, near(K.bsum(a.p, 'aspd'), 8 * AS_A), K.bsum(a.p, 'aspd'));
    chk('중첩형이라 태그가 없다', a.p.buffs.aspd.every(b => b.tag === undefined),
      a.p.buffs.aspd.filter(b => b.tag !== undefined).length);
    const b = arena(K, [], 6);
    for (let i = 0; i < 5; i++) K.procOnAttack(b.G, b.es[0]);
    chk('특전이 없으면 공속 버프가 안 생긴다 (대조군)', b.p.buffs.aspd.length === 0, b.p.buffs.aspd.length);
  }

  /* ---------- ⑧ 호출부 전수 — 갱신형은 **한 곳뿐** ---------- */
  say('\n=== ⑧ ⚑ 호출부 전수 — `refreshBuff` 는 두 엔진 각각 1곳, 나머지는 전부 `addBuff` ===');
  {
    for (const [label, src] of [['sim.js', simSrc], ['index.html', htmSrc]]) {
      const flat = src.replace(/\s+/g, '');
      const def = (flat.match(/functionrefreshBuff\(/g) || []).length;
      const all = (flat.match(/refreshBuff\(/g) || []).length;
      chk(`${label} — \`refreshBuff\` 정의가 1개`, def === 1, def);
      chk(`${label} — \`refreshBuff\` 호출부가 **정확히 1곳** (갱신형은 하나뿐)`, all - def === 1, all - def);
      chk(`${label} — 그 1곳이 «처치 시 회피 버프» 다`,
        /if\(px\.p_killEvBuff\)refreshBuff\(p,'evade',PERK_KILLEV_A,PERK_KILLEV_T,'p_killEvBuff'\);/.test(flat),
        '갱신형 호출부가 다른 것으로 바뀌었다');
      const adef = (flat.match(/functionaddBuff\(/g) || []).length;
      const aall = (flat.match(/addBuff\(/g) || []).length;
      chk(`${label} — \`addBuff\` 정의가 1개 · 호출부 ${aall - adef}곳 (전부 중첩형)`, adef === 1 && aall - adef >= 30,
        `${adef} / ${aall - adef}`);
      chk(`${label} — 두 동사 말고 \`p.buffs[*].push\` 를 직접 하는 자리가 없다 (우회 경로 차단)`,
        (flat.match(/p\.buffs\[[^\]]*\]\.push\(/g) || []).length === 1,
        (flat.match(/p\.buffs\[[^\]]*\]\.push\(/g) || []).length);
    }
  }

  /* ---------- ⑨ 게임 쪽(index.html)에서 같은 표를 다시 잰다 ---------- */
  say('\n=== ⑨ index.html — 같은 표를 게임 엔진에서 다시 잰다 ===');
  {
    const LH = loadHtm(htmSrc);
    if (!LH) chk('index.html 버프 동사 적재', false, 'vm 적재 실패 — 함수 이름이 바뀌었다. 게이트를 함께 고칠 것');
    else {
      const { H } = LH;
      const q = mkP({});
      for (let i = 0; i < 5; i++) H.refreshBuff(q, 'evade', EV_A, EV_T, 'p_killEvBuff');
      chk('게임 — 같은 태그 5번 → 1겹', q.buffs.evade.length === 1, q.buffs.evade.length);
      chk(`게임 — 버프 합 ${EV_A}`, near(H.bsum(q, 'evade'), EV_A), H.bsum(q, 'evade'));
      H.refreshBuff(q, 'evade', 15, 9, '다른태그');
      H.addBuff(q, 'evade', 8, 9, 'someOpt');
      chk('게임 — 태그 2종 + 무태그 = 3겹', q.buffs.evade.length === 3, q.buffs.evade.length);
      H.refreshBuff(q, 'evade', EV_A, EV_T, 'p_killEvBuff');
      chk('게임 — 재발동해도 남의 겹은 그대로 (3겹)', q.buffs.evade.length === 3, q.buffs.evade.length);
      chk(`게임 — 실효 회피 = ${EV_A}+15+8`, near(H.effEvade(q), EV_A + 23), H.effEvade(q));

      const r = mkP({});
      for (let i = 0; i < 12; i++) H.addBuff(r, 'aspd', AS_A, AS_T, 'p_aspdAtk');
      chk('게임 — `addBuff` 12번 → 12겹 (무한 중첩)', r.buffs.aspd.length === 12, r.buffs.aspd.length);
      chk(`게임 — 실효 공속 = 1 × (1 + ${nn(12 * AS_A)})`, near(H.effAspd(r), 1 * (1 + 12 * AS_A)), H.effAspd(r));

      const htick = mkTick(pluckTick(htmSrc) || '');
      if (!htick) chk('index.html 시간 감소 루프 적재', false, '루프를 못 떼어냈다 — 게이트를 함께 고칠 것');
      else {
        const s = mkP({});
        H.refreshBuff(s, 'evade', EV_A, EV_T, 'p_killEvBuff');
        H.addBuff(s, 'aspd', AS_A, AS_T, 'p_aspdAtk');
        htick(s, EV_T * 0.5);
        chk(`게임 — ${EV_T * 0.5}초 뒤 갱신형 남은 시간 ${EV_T * 0.5}`, near(s.buffs.evade[0].t, EV_T * 0.5), s.buffs.evade[0].t);
        H.refreshBuff(s, 'evade', EV_A, EV_T, 'p_killEvBuff');
        chk(`게임 — 재발동 → 시간 ${EV_T} 로 되돌아간다`, near(s.buffs.evade[0].t, EV_T), s.buffs.evade[0].t);
        htick(s, EV_T + 0.01);
        chk('게임 — 갱신형도 시간이 끝나면 사라진다', s.buffs.evade.length === 0, s.buffs.evade.length);
        chk('게임 — 더 긴 중첩형은 아직 남아 있다', s.buffs.aspd.length === 1, s.buffs.aspd.length);
      }
    }
  }

  /* ---------- ⑩ 두 엔진 문면 1:1 + 상수 ---------- */
  say('\n=== ⑩ 두 엔진(sim.js ↔ index.html) 같은 일곱 줄 ===');
  for (const [nm, re] of AX) {
    chk(`sim.js — ${nm}`, re.test(S), '못 찾았다');
    chk(`index.html — ${nm}`, re.test(H), '못 찾았다');
  }
  for (const [k, v] of [['PERK_KILLEV_A', EV_A], ['PERK_KILLEV_T', EV_T],
                        ['PERK_ASPDATK_A', AS_A], ['PERK_ASPDATK_T', AS_T]]) {
    const got = (htmSrc.match(new RegExp(k + '\\s*=\\s*([\\d.]+)')) || [])[1];
    chk(`두 엔진 상수 ${k} 가 같다 (= ${v})`, got !== undefined && +got === v, got);
  }

  /* ---------- ⑪ 주인 문면 ---------- */
  say('\n=== ⑪ ROUTINE 주인 원문 · PLAN 표 ===');
  chk('ROUTINE — 주인 «전투 중 버프 중첩 상한 전부 삭제 — 무한 중첩»', RULE_INF.test(routineSrc), '문면이 사라졌다');
  chk('ROUTINE — 주인 «발동될 때마다 계속 쌓임, 각자 자기 시간 끝나면 빠짐»', RULE_INF2.test(routineSrc), '문면이 사라졌다');
  chk('ROUTINE — 주인 «킬 시 2초간 회피율 +40% (스택 아님)»', RULE_KILLEV_OWN.test(routineSrc), '문면이 사라졌다');
  chk('ROUTINE — 위임 «재발동 시 시간만 갱신(중첩 없음 · buffs.evade 단일 항목 교체)»', RULE_KILLEV_DEL.test(routineSrc), '문면이 사라졌다');
  chk('ROUTINE — 주인 «공격 시 공격속도 +7% 7초 (스택형 · 중첩)»', RULE_ASPD_OWN.test(routineSrc), '문면이 사라졌다');
  chk('ROUTINE — 위임 «기존 버프 엔진(무한 중첩)»', RULE_ASPD_DEL.test(routineSrc), '문면이 사라졌다');
  chk('PLAN — «버프 중첩 상한 전부 삭제 — 무한 중첩 (주인 확정)» 총칙이 살아 있다', PLAN_INF.test(planSrc), '총칙이 바뀌었다');
  chk('PLAN §3.1 — p_killEvBuff 행에 «갱신형(중첩 아님 · 재발동 시 시간만 2초로 되돌린다)» 이 살아 있다',
    PLAN_KILLEV.test(planSrc), '표 행이 바뀌었다');
  chk('PLAN §3.1 — p_aspdAtk 행에 «무한 중첩» 이 살아 있다', PLAN_ASPD.test(planSrc), '표 행이 바뀌었다');

  return finish();
}

function finish() { return R.filter(x => !x.c).length; }

/* ================================================================ */
const simSrc = rd('sim.js');
const htmSrc = rd('index.html');
const routineSrc = rd('docs/ROUTINE.md');
const planSrc = rd('PLAN.md');

if (process.argv.includes('--self')) {
  /* 음성 검사 — 심은 고장을 이 게이트가 실제로 잡는가.
     T126 규약: 돌연변이가 no-op(치환이 안 먹음)이면 그것부터 빨갛게 떨어뜨린다. */
  console.log('[음성 검사] 갱신형↔중첩형을 몰래 뒤집은 사본에서 이 게이트가 빨개지는가');
  const S_KILLEV = "  if(px.p_killEvBuff)refreshBuff(p,'evade',PERK_KILLEV_A,PERK_KILLEV_T,'p_killEvBuff');";
  const H_KILLEV = "  if(px.p_killEvBuff) refreshBuff(p,'evade',PERK_KILLEV_A,PERK_KILLEV_T,'p_killEvBuff');";
  const S_ASPD = "  if(px.p_aspdAtk)addBuff(p,'aspd',PERK_ASPDATK_A,PERK_ASPDATK_T);";
  const H_ASPD = "  if(px.p_aspdAtk) addBuff(p,'aspd',PERK_ASPDATK_A,PERK_ASPDATK_T,'p_aspdAtk');";
  const RB = "  for(let i=arr.length-1;i>=0;i--) if(arr[i].tag===tag) arr.splice(i,1);";
  const S_TICK = "for(const k in p.buffs){const arr=p.buffs[k];for(let i=arr.length-1;i>=0;i--){arr[i].t-=dt;if(arr[i].t<=0)arr.splice(i,1);}}";
  const H_TICK = "    for(let i=arr.length-1;i>=0;i--){ arr[i].t-=dt; if(arr[i].t<=0){ arr.splice(i,1); bc=true; } }";
  const both = f => [f, f, null, null];
  const cases = [
    ['B1 `p_killEvBuff` 를 `addBuff` 로 바꾸면 (회피 +40 이 킬마다 무한 누적)',
      s => s.replace(S_KILLEV, "  if(px.p_killEvBuff)addBuff(p,'evade',PERK_KILLEV_A,PERK_KILLEV_T);"),
      s => s.replace(H_KILLEV, "  if(px.p_killEvBuff) addBuff(p,'evade',PERK_KILLEV_A,PERK_KILLEV_T,'p_killEvBuff');"), null, null],
    ['B2 `p_aspdAtk` 를 `refreshBuff` 로 바꾸면 (공속 +7% 가 한 겹으로 고정)',
      s => s.replace(S_ASPD, "  if(px.p_aspdAtk)refreshBuff(p,'aspd',PERK_ASPDATK_A,PERK_ASPDATK_T,'p_aspdAtk');"),
      s => s.replace(H_ASPD, "  if(px.p_aspdAtk) refreshBuff(p,'aspd',PERK_ASPDATK_A,PERK_ASPDATK_T,'p_aspdAtk');"), null, null],
    ['B3 `refreshBuff` 의 태그 제거 루프를 지우면 (이름만 갱신형 · 실제로는 중첩)',
      ...both(s => s.replace(RB, ''))],
    ['B4 `refreshBuff` 가 태그를 안 보고 그 축을 통째로 비우면 (남의 버프까지 지운다)',
      ...both(s => s.replace(RB, '  arr.length=0;'))],
    ['B5 태그 달린 버프가 시간 감소에서 빠지면 (갱신형이 영구가 된다)',
      s => s.replace(S_TICK, "for(const k in p.buffs){const arr=p.buffs[k];for(let i=arr.length-1;i>=0;i--){if(arr[i].tag)continue;arr[i].t-=dt;if(arr[i].t<=0)arr.splice(i,1);}}"),
      s => s.replace(H_TICK, "    for(let i=arr.length-1;i>=0;i--){ if(arr[i].tag) continue; arr[i].t-=dt; if(arr[i].t<=0){ arr.splice(i,1); bc=true; } }"), null, null],
    ['B6 `refreshBuff` 가 시간 대신 **수치를 누적**하면 (갱신이 아니라 강화)',
      ...both(s => s.replace("  arr.push({t:dur,amt,tag", "  amt=arr.length?amt*2:amt;\n  arr.push({t:dur,amt,tag"))],
    ['B7 갱신형 호출에서 태그 인자를 빼면 (태그가 없어 매번 새로 쌓인다)',
      s => s.replace(S_KILLEV, "  if(px.p_killEvBuff)refreshBuff(p,'evade',PERK_KILLEV_A,PERK_KILLEV_T);"),
      s => s.replace(H_KILLEV, "  if(px.p_killEvBuff) refreshBuff(p,'evade',PERK_KILLEV_A,PERK_KILLEV_T);"), null, null],
    ['B8 `addBuff` 에 중첩 상한 3 을 되살리면 (무한 중첩 위반)',
      s => s.replace("function addBuff(p,k,amt,dur){ p.buffs[k].push({t:dur,amt}); }",
        "function addBuff(p,k,amt,dur){ if(p.buffs[k].length>=3)p.buffs[k].shift(); p.buffs[k].push({t:dur,amt}); }"),
      s => s.replace("  p.buffs[k].push({t:dur,amt,src,q:++buffSeq});",
        "  if(p.buffs[k].length>=3) p.buffs[k].shift();\n  p.buffs[k].push({t:dur,amt,src,q:++buffSeq});"), null, null],
    ['B9 게임 쪽만 갱신형을 중첩형으로 바꾸면 (두 엔진 괴리)',
      null, s => s.replace(H_KILLEV, "  if(px.p_killEvBuff) addBuff(p,'evade',PERK_KILLEV_A,PERK_KILLEV_T,'p_killEvBuff');"), null, null],
    ['B10 `bsum` 이 합이 아니라 **최댓값**을 돌려주면 (중첩이 무의미해진다)',
      s => s.replace("const bsum=(p,k)=>{let s=0;for(const b of p.buffs[k])s+=b.amt;return s;};",
        "const bsum=(p,k)=>{let s=0;for(const b of p.buffs[k])s=Math.max(s,b.amt);return s;};"),
      s => s.replace("function bsum(p,k){ let s=0; for(const b of p.buffs[k]) s+=b.amt; return s; }",
        "function bsum(p,k){ let s=0; for(const b of p.buffs[k]) s=Math.max(s,b.amt); return s; }"), null, null],
    ['B11 ROUTINE 에서 주인 원문 «(스택 아님)» 을 지우면',
      null, null, s => s.replace('킬 시 2초간 회피율 +40% (스택 아님)', '킬 시 2초간 회피율 +40%'), null],
    ['B12 PLAN §3.1 에서 «갱신형(중첩 아님 …)» 을 지우면',
      null, null, null, s => s.replace('**갱신형**(중첩 아님 · 재발동 시 시간만 2초로 되돌린다)', '2초 버프')],
  ];
  let caught = 0, noop = 0;
  for (const [why, mS, mH, mR, mP] of cases) {
    const s2 = mS ? mS(simSrc) : simSrc;
    const h2 = mH ? mH(htmSrc) : htmSrc;
    const r2 = mR ? mR(routineSrc) : routineSrc;
    const p2 = mP ? mP(planSrc) : planSrc;
    if ((mS && s2 === simSrc) || (mH && h2 === htmSrc) || (mR && r2 === routineSrc) || (mP && p2 === planSrc)) {
      console.log(`  ✗ 음성 «${why}» — 치환이 안 먹었다 (no-op · 심을 자리가 사라졌으면 이 케이스를 고칠 것)`);
      noop++; continue;
    }
    const bad = run(s2, h2, r2, p2, true);
    if (bad > 0) { console.log(`  ✓ 음성 «${why}» → 불합격 ${bad}건`); caught++; }
    else console.log(`  ✗ 음성 «${why}» → 아무것도 안 잡혔다 (동결이 죽었다)`);
  }
  const base = run(simSrc, htmSrc, routineSrc, planSrc, true);
  base === 0 ? console.log(`  ✓ 양성 대조군 — 원본 ${R.length}항목 전부 통과 (오탐 0)`)
             : console.log(`  ✗ 양성 대조군 — 원본에서 ${base}건 불합격 (오탐)`);
  console.log(`\n[음성 검사] ${caught}/${cases.length} · no-op ${noop} · 오탐 ${base}`);
  process.exit(caught === cases.length && noop === 0 && base === 0 ? 0 : 1);
}

console.log('=== 갱신형 ↔ 중첩형 버프 게이트 (T148 · 주인 확정 2026-09-03 «무한 중첩» + T121 «스택 아님») ===');
const bad = run(simSrc, htmSrc, routineSrc, planSrc, false);
console.log(`\n[버프 중첩 게이트] 대조 ${R.length}항목 · 통과 ${R.length - bad} · 불합격 ${bad}` +
  (bad ? '' : ' → 통과 (갱신형은 한 곳뿐 · 태그 하나만 교체 · 나머지는 무한 중첩 · 겹마다 따로 만료를 실제로 굴려서 잰다)'));
process.exit(bad ? 1 : 0);
