#!/usr/bin/env node
/* ================================================================================
   verifyCritStack — ⚑⚑⚑ T149 (워커 B · sess-0820-4831)

   **주인 확정 T121 (2026-09-04 16:0X · 17:0X · ROUTINE «신규 주인 지시» 표)** 의
   «치명타 확률이 어디서 어떻게 합쳐지는가» 두 축을 **실제로 굴려서** 잰다.

     ⓐ 일반 «치명 스택» (16:0X)
        주인 원문 «한 대 때릴 때마다 치명확률 +1%, 치명타 뜨면 초기화 후 다시 쌓음»
        위임 기본값 «**평타 적중**마다 +1 · 치명타 발생 시 0 · 소환·반격 제외»
     ⓑ 일반 «반격 치명» / 희귀 «반격 치명 II» (17:0X)
        주인 원문 «반격 시 그 반격이 치명타일 확률 +20%» / «+40%»
        위임 기본값 «**반격 타격에만** 치확 +20 가산» · «가산»(둘 다면 +60)

   ── 구멍을 먼저 증명했다 (T149 사본 실측 · 정적 게이트 30종 전수) ──
   이 두 문장을 **동작으로** 재는 게이트가 한 줄도 없었다. 두 특전에 닿는 자는 둘뿐인데
   둘 다 글자만 본다:
     · `verifyPerkOrder` — 특전표의 **id·등급·순서·설명문**과 상수 `PERK_CSTACK_A: '1'` 만 본다.
       그 특전이 **언제 오르고 언제 0 이 되는지**는 안 본다.
     · `verifyNumClean` — 33/66 같은 «숫자의 출처» 만 본다.
   그래서 두 엔진에 고장을 **하나씩** 심고 정적 게이트 30종을 전수로 돌렸다
   (`verifyPerRunRandom` 은 판마다 다른 난수 통계를 찍을 뿐 «통과 43 · 불합격 0» 이 고정이라 잡음이다):

     · **S1** 스택 갱신을 적 회피 판정 «위» 로 한 칸 올린다 → **빗맞아도 스택이 쌓인다**  ⇒ 통과 수 diff **0**
     · **S2** `fromBasic` 가드를 뺀다 → **반격·소환 적중도 스택을 올린다**                ⇒ 통과 수 diff **0**
     · **S3** `crit?0:` 를 뺀다 → **치명타가 떠도 초기화하지 않는다(무한 누적)**          ⇒ 통과 수 diff **0**
     · **S5** `ctCr` 에 `effCritR(p)` 를 더한다 → **반격 치명이 평타 치확을 섞는다**      ⇒ 통과 수 diff **0**
     · S4 스택이 «그 평타» 부터 걸리게 한다 → `verifyKillTrigger` 가 **부수적으로** 2건
     · S6 광전사가 치명 스택만은 못 막게 한다 → `verifyPerkOrder` 가 **부수적으로** 2건
   S4·S6 을 잡은 둘은 **이 축을 보는 게이트가 아니다**(확정 치명 축 · 광전사 0 고정 축을 재다가 걸린 것).
   그 조항이 바뀌면 이 축이 소리 없이 빈다 — 그래서 여기서 **정면으로 다시** 못박는다.

   ── 그래서 이 게이트가 하는 일 ──
   문면 대조가 아니라 **실측 동결**이다.
     ① `sim.js` 의 진짜 `dealDmg`·`doCounter`·`summonHit`·`effCritR` 를 vm 에 올리고
        `Math.random` 을 **대본(queue)** 으로 갈아끼워 스택이 언제 오르고 언제 0 이 되는지 직접 센다.
     ② `index.html` 의 `effCritR`·`bsum`·`perkCountOf` 를 떼어내 **같은 표를 다시 잰다**.
     ③ 게임 쪽 `dealPlayerDamage`·`doCounter` 는 함수 본문을 떼어내 **네 자리의 앞뒤(인덱스)**를 비교한다 —
        `includes` 로 «있는지» 만 보면 순열 전체가 통과하기 때문이다(T139 가 같은 수법으로 데인 자리다).
     ④ 두 엔진 문면 1:1 + ROUTINE 주인 원문 + PLAN §3.1 표.

   ── 이 게이트를 고쳐도 되는 때 ──
   **주인이 이 두 특전의 규칙을 새로 확정했을 때뿐이다.** 그때 아래 상수·기대값을 갱신하고
   PROGRESS 에 주인 원문과 함께 남긴다 — 고치는 것 자체가 diff 에 드러나는 것이 요점이다.
   밸런스 수치(치확 기저·`PERK_CSTACK_A`·`PERK_CTCRIT_*`)는 **박지 않고 소스에서 읽는다** —
   주인이 값을 바꾸면 이 게이트는 그대로 초록이다(상시 규칙 «밸런스 조절 하지 마»).

   사용: node tools/verifyCritStack.js        (exit 0 = 통과, 1 = 불합격)
   음성: node tools/verifyCritStack.js --self (심은 고장 12종 + 양성 대조군)
   ================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ── ROUTINE 주인 원문 — 규칙을 지우고 동작을 뒤집는 경로를 막는다 ──────────── */
const RULE_STACK_OWN = /한 대 때릴 때마다 치명확률 \+1%, 치명타 뜨면 초기화 후 다시 쌓음/;
const RULE_STACK_DEL = /\*\*평타 적중\*\*마다 \+1 · 치명타 발생 시 0 · 소환·반격 제외/;
const RULE_CTCRIT_N = /반격 시 그 반격이 치명타일 확률 \*\*\+20%\*\*/;
const RULE_CTCRIT_DEL = /반격 타격에만 치확 \+20 가산/;
const RULE_CTCRIT_R = /반격 시 치명타일 확률 \*\*\+40%\*\*/;
/* PLAN §3.1 표 — 두 행이 살아 있고 «제외» 3종·«가산» 이 적혀 있는가 */
const PLAN_STACK = /\| p_critStack \| 일반 \| 치명 스택 \|[^|]*\|[^|]*반격·소환·빗맞음 제외 \|/;
const PLAN_CTCRIT = /\| p_ctCritN \| 일반 \| 반격 치명 \|[^|]*\|[^|]*가산\*\*\(둘 다면 \+60\) \|/;

/* ── 두 엔진 공통 축 (공백 제거 후 대조) ──────────────────────────────────
   `index.html` 은 같은 자리에 연출 호출(addText·sparks·AU.play)이 붙어 있어 줄이 글자 그대로는
   다르다. 그래서 «무엇을 언제 하는가» 만 남긴 정규식으로 묶는다. */
const AX = [
  ['치명 스택 갱신 — 평타(`fromBasic`/`basic`)만 · 치명타면 0 · 아니면 +PERK_CSTACK_A',
    /if\((?:fromBasic|basic)&&px\.p_critStack\)p\.critStk=crit\?0:p\.critStk\+PERK_CSTACK_A;/],
  ['`effCritR` 이 스택을 **가산**으로 더한다',
    /if\(px\.p_critStack\)c\+=p\.critStk;/],
  ['광전사(치확 0 고정)가 스택 가산 **앞**에서 통째로 0 을 돌려준다',
    /if\(px\.p_berserk\)return0;letc=p\.critR\+bsum\(p,'critR'\);/],
  ['평타 치확 굴림은 `effCritR` 한 자리에서만 시작한다',
    /letcr=effCritR\(p\);/],
  ['반격 치명 확률 = 두 특전의 **가산** (평타 치확을 섞지 않는다)',
    /constctCr=\(px\.p_ctCritN\?PERK_CTCRIT_N:0\)\+\(px\.p_ctCritR\?PERK_CTCRIT_R:0\);/],
  ['반격 치명의 배율은 `effCritF` 그대로',
    /Math\.random\(\)\*100<ctCr\)?;?(?:constctCrit=[^;]*;)?(?:if\(ctCrit\))?cd\*=effCritF\(p\)\/100;/],
];

/* ================================================================
   `sim.js` 를 CLI 디스패처 앞까지만 vm 에 올려 전투 함수를 그대로 꺼낸다.
   `Math` 는 프로토타입 사본을 넘겨(호스트 `Math.random` 오염 방지) 굴림을 우리가 고정한다.
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
      '\n;globalThis.__K={PERKS,basePx,dealDmg,doCounter,summonHit,effCritR,effCritF,effDmg,' +
      'PERK_CSTACK_A,PERK_CTCRIT_N,PERK_CTCRIT_R,ENEMY_EVADE};', ctx);
  } catch (e) { return null; }
  const K = ctx.__K || (ctx.globalThis && ctx.globalThis.__K);
  return K ? { K, M } : null;
}

/* `index.html` 에서 함수를 통째로 떼어내 vm 에 올린다 — 게임 쪽 치확 합성도 **굴려서** 잰다. */
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
function loadHtm(src) {
  const num = k => { const m = src.match(new RegExp(k + '\\s*=\\s*([\\d.]+)')); return m ? +m[1] : NaN; };
  const need = ['bsum', 'perkOrderN', 'perkCountOf', 'effCritR', 'effCritF'];
  const body = [];
  for (const n of need) { const f = pluck(src, n); if (!f) return null; body.push(f); }
  const ctx = {
    G: { perksTaken: [] }, PERKS: [], Math, Object, Array,
    PERK_COLL_CRIT: num('PERK_COLL_CRIT'),
  };
  vm.createContext(ctx);
  try { vm.runInContext(body.join('\n') + '\n;globalThis.__H={effCritR,effCritF};', ctx); }
  catch (e) { return null; }
  const H = ctx.__H || (ctx.globalThis && ctx.globalThis.__H);
  return H ? { H, ctx } : null;
}

/* ── 공통 플레이어 틀 ─────────────────────────────────────────────────── */
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
  for (let j = 0; j < (n || 3); j++)
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

/* 대본(queue) 난수 — 앞에서부터 꺼내 쓰고 다 쓰면 0.5 를 돌려준다.
   `dealDmg` 는 굴림이 «치명 → 적 회피 → 데미지 요동 → 트리거» 순이라 앞의 둘만 대본으로 잡으면 된다. */
function script(M, arr) { let i = 0; M.random = () => (i < arr.length ? arr[i++] : 0.5); }
const HIT = 0.5;          /* 적 회피 10% 를 안 타는 값 */
const MISS = 0.01;        /* 적 회피 10% 를 타는 값 */
const NOCRIT = 0.999999;  /* 치확이 100 미만이면 치명타가 안 뜨는 값 */
const CRIT = 0;           /* 치확이 0 초과이면 반드시 치명타가 뜨는 값 */

/* ================================================================ */
const R = [];
let QUIET = true;
const chk = (name, pass, detail) => {
  const x = { name, c: !!pass, d: detail == null ? '' : String(detail) };
  R.push(x);
  if (!QUIET) console.log(`  ${x.c ? '✓' : '✗'} ${x.name}${x.c ? '' : '  — ' + x.d}`);
};
const near = (a, b) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));

function run(simSrc, htmSrc, routineSrc, planSrc, quiet) {
  R.length = 0;
  QUIET = !!quiet;
  const say = quiet ? () => {} : console.log;

  const L = loadSim(simSrc);
  if (!L) { chk('sim.js 전투 함수 적재', false, 'vm 적재 실패 — 함수 이름이나 CLI 디스패처 위치가 바뀌었다. 게이트를 함께 고칠 것'); return finish(); }
  const { K, M } = L;
  const S = simSrc.replace(/\s+/g, '');
  const H = htmSrc.replace(/\s+/g, '');
  const A = +K.PERK_CSTACK_A, CN = +K.PERK_CTCRIT_N, CR = +K.PERK_CTCRIT_R;

  /* 평타 한 대 — 치명타 여부·빗맞음 여부를 대본으로 정한다 */
  const basic = (a, e, opt) => {
    script(M, [(opt && opt.crit) ? CRIT : NOCRIT, (opt && opt.miss) ? MISS : HIT]);
    return K.dealDmg(a.G, e, 1, true);
  };

  /* ---------- ① 치명 스택 — «평타 적중마다 +1» ---------- */
  say('\n=== ① ⚑ 치명 스택 — 주인 «한 대 때릴 때마다 치명확률 +1%» (평타 적중만) ===');
  {
    chk(`상수 PERK_CSTACK_A 를 소스에서 읽었다 (= ${A} · 밸런스 값은 박지 않는다)`,
      Number.isFinite(A) && A > 0, A);

    const a = arena(K, ['p_critStack'], 3);
    if (!a) { chk('특전 id 확인', false, 'p_critStack 를 못 찾았다'); return finish(); }
    chk('시작 스택 0', a.p.critStk === 0, a.p.critStk);
    basic(a, a.es[0]);
    chk(`평타 적중 1회 → 스택 ${A}`, near(a.p.critStk, A), a.p.critStk);
    for (let i = 0; i < 4; i++) basic(a, a.es[0]);
    chk(`평타 적중 5회 → 스택 ${5 * A} (한 대당 딱 하나)`, near(a.p.critStk, 5 * A), a.p.critStk);
    chk(`실효 치확 = 기저 + 스택 (가산 · ${5 * A})`, near(K.effCritR(a.p), 5 * A), K.effCritR(a.p));

    /* 기저 치확이 있어도 가산 */
    const b = arena(K, ['p_critStack'], 3, { critR: 7 });
    for (let i = 0; i < 3; i++) basic(b, b.es[0]);
    chk(`기저 치확 7 + 스택 ${3 * A} = ${7 + 3 * A} (가산 · 곱이 아니다)`,
      near(K.effCritR(b.p), 7 + 3 * A), K.effCritR(b.p));

    /* 특전이 없으면 안 오른다 */
    const c = arena(K, [], 3);
    for (let i = 0; i < 5; i++) basic(c, c.es[0]);
    chk('특전이 없으면 스택이 안 오른다 (대조군)', c.p.critStk === 0, c.p.critStk);
    chk('특전이 없으면 실효 치확도 기저 그대로', near(K.effCritR(c.p), 0), K.effCritR(c.p));
  }

  /* ---------- ② 빗맞음은 세지 않는다 (S1) ---------- */
  say('\n=== ② ⚑ 빗맞음 제외 — 위임 «평타 **적중**마다» (적 회피 10% 를 탄 타격은 안 센다) ===');
  {
    const a = arena(K, ['p_critStack'], 3);
    for (let i = 0; i < 3; i++) basic(a, a.es[0]);
    const before = a.p.critStk, m0 = a.G.miss;
    for (let i = 0; i < 5; i++) basic(a, a.es[0], { miss: true });
    chk('빗맞음 5회가 실제로 빗맞았다 (대본이 먹었다)', a.G.miss - m0 === 5, a.G.miss - m0);
    chk('빗맞음은 스택을 **한 칸도** 올리지 않는다', near(a.p.critStk, before), `${before} → ${a.p.critStk}`);
    basic(a, a.es[0]);
    chk(`빗맞음 뒤 적중 1회는 정상적으로 +${A}`, near(a.p.critStk, before + A), a.p.critStk);
    /* 빗맞음이 스택을 0 으로 만들지도 않는다 */
    chk('빗맞음이 스택을 초기화하지도 않는다', a.p.critStk > 0, a.p.critStk);
  }

  /* ---------- ③ 치명타가 뜨면 0 (S3) ---------- */
  say('\n=== ③ ⚑ 치명타 시 초기화 — 주인 «치명타 뜨면 초기화 후 다시 쌓음» ===');
  {
    const a = arena(K, ['p_critStack'], 3, { critR: 50 });
    for (let i = 0; i < 4; i++) basic(a, a.es[0]);
    chk(`치명타 전 스택 ${4 * A}`, near(a.p.critStk, 4 * A), a.p.critStk);
    const crit = basic(a, a.es[0], { crit: true });
    chk('치명타가 실제로 떴다 (대본이 먹었다)', crit === true, crit);
    chk('치명타가 뜨면 스택이 **0**', a.p.critStk === 0, a.p.critStk);
    basic(a, a.es[0]);
    chk(`초기화 뒤 «다시 쌓는다» — 적중 1회 → ${A}`, near(a.p.critStk, A), a.p.critStk);
    /* 치명타는 초기화만 하고 그 자리에서 +1 을 얹지 않는다 */
    const b = arena(K, ['p_critStack'], 3, { critR: 50 });
    basic(b, b.es[0], { crit: true });
    chk('첫 타가 치명타면 스택은 0 (초기화만 · +1 을 얹지 않는다)', b.p.critStk === 0, b.p.critStk);
  }

  /* ---------- ④ 굴림이 갱신보다 앞 — «다음 평타» 부터 (S4) ---------- */
  say('\n=== ④ ⚑ 스택은 «다음 평타» 부터 — 굴림이 갱신 앞이라 그 타격에는 안 걸린다 ===');
  {
    /* 임계 근처 값 하나로 «그 평타 / 다음 평타» 를 가른다:
       치확이 0 이면 r=0.005 도 치명타가 아니고, 스택이 1 이면 0.5 < 1 이라 치명타다. */
    const eps = A / 200;                       /* 스택 한 칸의 절반 (%) → 난수 값 */
    const a = arena(K, ['p_critStack'], 3);
    script(M, [eps, HIT]);
    const c1 = K.dealDmg(a.G, a.es[0], 1, true);
    chk('첫 평타는 **스택 0** 으로 굴린다 (그 타격에는 아직 안 걸린다)', c1 === false, c1);
    chk(`첫 평타 뒤 스택 ${A}`, near(a.p.critStk, A), a.p.critStk);
    script(M, [eps, HIT]);
    const c2 = K.dealDmg(a.G, a.es[0], 1, true);
    chk(`둘째 평타는 스택 ${A} 로 굴린다 (같은 난수인데 치명타가 뜬다)`, c2 === true, c2);
    chk('그 치명타가 스택을 0 으로 되돌린다', a.p.critStk === 0, a.p.critStk);
  }

  /* ---------- ⑤ 반격·소환 적중은 세지 않는다 (S2) ---------- */
  say('\n=== ⑤ ⚑ 소환·반격 제외 — 위임 «소환·반격 제외» (`fromBasic` 축) ===');
  {
    const a = arena(K, ['p_critStack'], 3);
    for (let i = 0; i < 3; i++) basic(a, a.es[0]);
    const before = a.p.critStk;

    script(M, [HIT]);                       /* 반격도 적 회피를 탄다 — 첫 굴림이 그것 */
    K.doCounter(a.G, a.es[1]);
    chk('반격 적중은 스택을 올리지 않는다', near(a.p.critStk, before), `${before} → ${a.p.critStk}`);

    script(M, [NOCRIT, HIT]);
    K.summonHit(a.G, a.es[1], 1);
    chk('소환 적중은 스택을 올리지 않는다', near(a.p.critStk, before), `${before} → ${a.p.critStk}`);

    /* 소환·반격이 스택을 **초기화** 하지도 않는다 — 치명타를 강제해도 마찬가지 */
    script(M, [CRIT, HIT]);
    K.summonHit(a.G, a.es[1], 1);
    chk('소환 적중은 스택을 초기화하지도 않는다', near(a.p.critStk, before), a.p.critStk);

    basic(a, a.es[0]);
    chk(`평타만 다시 +${A}`, near(a.p.critStk, before + A), a.p.critStk);
  }

  /* ---------- ⑥ 광전사 — 치확 0 고정이 스택도 함께 죽인다 (S6) ---------- */
  say('\n=== ⑥ ⚑ 광전사(치확 0 고정) — 스택이 쌓여 있어도 실효 치확은 0 (T119 주인 확정) ===');
  {
    const a = arena(K, ['p_berserk', 'p_critStack'], 3);
    for (let i = 0; i < 6; i++) basic(a, a.es[0]);
    chk('광전사여도 스택 카운터 자체는 오른다 (막는 자리는 `effCritR` 한 곳)',
      near(a.p.critStk, 6 * A), a.p.critStk);
    chk('그런데 실효 치확은 **0** — 광전사가 스택 가산 앞에서 통째로 막는다',
      near(K.effCritR(a.p), 0), K.effCritR(a.p));
    const crit = basic(a, a.es[0], { crit: true });
    chk('그래서 치명타가 한 번도 안 뜬다 (CRIT 대본으로 굴려도)', crit === false, crit);
  }

  /* ---------- ⑦ 반격 치명 — 격리와 가산 (S5) ---------- */
  say('\n=== ⑦ ⚑ 반격 치명 I/II — 주인 «반격 시 그 반격이 치명타일 확률 +20% / +40%» ===');
  {
    chk(`상수 PERK_CTCRIT_N / _R 를 소스에서 읽었다 (= ${CN} / ${CR})`,
      Number.isFinite(CN) && Number.isFinite(CR) && CN > 0 && CR > 0, `${CN} / ${CR}`);

    /* 반격 한 대의 피해를 재서 치명타 여부를 가른다 (치명타면 ×effCritF/100) */
    const counter = (ids, over, r) => {
      const a = arena(K, ids, 3, over);
      if (!a) return null;
      const e = a.es[1], hp0 = e.hp;
      script(M, r === undefined ? [HIT] : [HIT, r]);
      K.doCounter(a.G, e);
      const lost = hp0 - e.hp;
      const plain = K.effDmg(a.p) * 0.7;
      return { a, lost, plain, crit: lost > plain * 1.01 };
    };

    /* 특전이 없으면 반격은 치명타가 없는 타격이다 */
    const n0 = counter(['p_critStack'], undefined, undefined);
    chk('반격 치명 특전이 없으면 반격은 **치명타가 없다** (굴림 자체가 없다)',
      n0 && !n0.crit && near(n0.lost, n0.plain), n0 && `${n0.lost} vs ${n0.plain}`);

    /* I 만 — 임계는 CN */
    const iIn = counter(['p_ctCritN'], undefined, (CN - 0.1) / 100);
    const iOut = counter(['p_ctCritN'], undefined, (CN + 0.1) / 100);
    chk(`반격 치명 I — 난수 ${CN - 0.1}% 에서 치명타`, iIn && iIn.crit, iIn && iIn.lost);
    chk(`반격 치명 I — 난수 ${CN + 0.1}% 에서 치명타 아님 (임계 = ${CN})`, iOut && !iOut.crit, iOut && iOut.lost);
    chk('반격 치명의 배율은 `effCritF` 그대로',
      iIn && near(iIn.lost, iIn.plain * (150 / 100)), iIn && `${iIn.lost} vs ${iIn.plain * 1.5}`);

    /* II 만 · I+II 가산 */
    const rIn = counter(['p_ctCritR'], undefined, (CR - 0.1) / 100);
    const rOut = counter(['p_ctCritR'], undefined, (CR + 0.1) / 100);
    chk(`반격 치명 II — 임계 = ${CR}`, rIn && rIn.crit && rOut && !rOut.crit,
      rIn && rOut && `${rIn.crit} / ${rOut.crit}`);
    const bIn = counter(['p_ctCritN', 'p_ctCritR'], undefined, (CN + CR - 0.1) / 100);
    const bOut = counter(['p_ctCritN', 'p_ctCritR'], undefined, (CN + CR + 0.1) / 100);
    chk(`I + II = **가산** ${CN} + ${CR} = ${CN + CR} (곱·최대값이 아니다)`,
      bIn && bIn.crit && bOut && !bOut.crit, bIn && bOut && `${bIn.crit} / ${bOut.crit}`);

    /* 격리 — 평타 치확이 아무리 높아도 반격 치명률은 안 변한다 */
    const hiNo = counter([], { critR: 90 }, 0);
    chk('평타 치확 90 이어도 반격 치명 특전이 없으면 반격은 치명타가 아니다 (격리 · 난수 0)',
      hiNo && !hiNo.crit, hiNo && hiNo.lost);
    const hiIn = counter(['p_ctCritN'], { critR: 90 }, (CN - 0.1) / 100);
    const hiOut = counter(['p_ctCritN'], { critR: 90 }, (CN + 0.1) / 100);
    chk(`평타 치확 90 + 반격 치명 I → 임계는 여전히 ${CN} (평타 치확이 안 섞인다)`,
      hiIn && hiIn.crit && hiOut && !hiOut.crit, hiIn && hiOut && `${hiIn.crit} / ${hiOut.crit}`);

    /* 격리 — 쌓인 치명 스택도 반격에 새어들지 않는다 */
    {
      const a = arena(K, ['p_critStack', 'p_ctCritN'], 3);
      for (let i = 0; i < 50; i++) basic(a, a.es[0]);
      chk(`반격 격리 대조 — 평타 스택이 ${50 * A} 까지 쌓였다`, near(a.p.critStk, 50 * A), a.p.critStk);
      const e = a.es[1], hp0 = e.hp;
      script(M, [HIT, (CN + 0.1) / 100]);
      K.doCounter(a.G, e);
      const plain = K.effDmg(a.p) * 0.7;
      chk(`스택 ${50 * A} 가 쌓여 있어도 반격 임계는 ${CN} 그대로 (치명타 아님)`,
        near(hp0 - e.hp, plain), `${hp0 - e.hp} vs ${plain}`);
      const stk = a.p.critStk;
      script(M, [HIT, (CN - 0.1) / 100]);
      K.doCounter(a.G, e);
      chk('반격이 치명타로 떠도 평타 스택은 초기화되지 않는다 (반격은 `fromBasic` 이 아니다)',
        near(a.p.critStk, stk), `${stk} → ${a.p.critStk}`);
    }
  }

  /* ---------- ⑧ 게임 쪽(index.html) 치확 합성 — 같은 표를 다시 잰다 ---------- */
  say('\n=== ⑧ index.html 의 `effCritR` 를 떼어내 **같은 표**를 다시 잰다 ===');
  {
    const L2 = loadHtm(htmSrc);
    if (!L2) chk('index.html 적재', false, '`effCritR`·`bsum`·`perkCountOf` 를 못 떼어냈다. 게이트를 함께 고칠 것');
    else {
      const HF = L2.H;
      const px = k => Object.assign({}, ...k.map(n => ({ [n]: 1 })));
      let same = true, bad = '';
      for (let n = 0; n <= 12; n++) {
        const q = mkP(px(['p_critStack']), { critR: 7, critStk: n * A });
        const w = mkP(K.basePx(), { critR: 7, critStk: n * A });
        w.px.p_critStack = 1;
        const hv = HF.effCritR(q), sv = K.effCritR(w);
        if (!near(hv, sv) || !near(hv, 7 + n * A)) { same = false; bad = `n=${n}: html ${hv} · sim ${sv} · 기대 ${7 + n * A}`; break; }
      }
      chk('index.html 도 «기저 + 스택» 가산 표가 sim.js 와 한 칸도 다르지 않다 (n 0~12 · 실제로 굴려서)', same, bad);

      const q0 = mkP({}, { critR: 7, critStk: 40 });
      chk('index.html — 특전이 없으면 스택이 치확에 안 붙는다', near(HF.effCritR(q0), 7), HF.effCritR(q0));

      const qb = mkP(px(['p_critStack', 'p_berserk']), { critR: 90, critStk: 40 });
      chk('index.html — 광전사면 스택이 쌓여 있어도 실효 치확 0', near(HF.effCritR(qb), 0), HF.effCritR(qb));
    }
  }

  /* ---------- ⑨ 판정 자리의 «앞뒤» — 인덱스로 비교한다 ---------- */
  say('\n=== ⑨ 판정 자리의 앞뒤 (`includes` 가 아니라 **인덱스 비교** — T139 가 데인 자리) ===');
  {
    const order = (label, src, fnName, marks) => {
      const body = fnName ? pluck(src, fnName) : src;
      if (!body) { chk(`${label} — 본문 적재`, false, `${fnName} 를 못 떼어냈다`); return null; }
      const flat = body.replace(/\s+/g, '');
      const at = marks.map(([nm, re]) => [nm, flat.search(re)]);
      for (const [nm, i] of at) if (i < 0) { chk(`${label} — «${nm}» 를 찾지 못했다`, false, nm); return null; }
      return at;
    };
    const MK = [
      ['치확 산정 (`effCritR`)', /letcr=effCritR\(p\)/],
      ['치명타 굴림', /constcrit=Math\.random\(\)\*100<cr;/],
      ['적 회피(빗맞음) 판정', /Math\.random\(\)<ENEMY_EVADE/],
      ['치명 스택 갱신', /px\.p_critStack\)p\.critStk=/],
    ];
    for (const [label, src, fn] of [['sim.js `dealDmg`', simSrc, 'dealDmg'],
                                    ['index.html `dealPlayerDamage`', htmSrc, 'dealPlayerDamage']]) {
      const at = order(label, src, fn, MK);
      if (!at) continue;
      const [cr, roll, miss, stk] = at.map(x => x[1]);
      chk(`${label} — 치확 산정이 치명타 굴림 **앞**`, cr < roll, `${cr} < ${roll}`);
      chk(`${label} — 치명타 굴림이 스택 갱신 **앞** (그래서 «다음 평타» 부터 걸린다)`, roll < stk, `${roll} < ${stk}`);
      chk(`${label} — 적 회피 판정이 스택 갱신 **앞** (그래서 빗맞음은 안 센다)`, miss < stk, `${miss} < ${stk}`);
    }
    /* 반격 안에는 평타 치확이 들어오지 않는다 */
    for (const [label, src, fn] of [['sim.js `doCounter`', simSrc, 'doCounter'],
                                    ['index.html `doCounter`', htmSrc, 'doCounter']]) {
      const body = pluck(src, fn);
      if (!body) { chk(`${label} — 본문 적재`, false, `${fn} 를 못 떼어냈다`); continue; }
      const flat = body.replace(/\s+/g, '');
      chk(`${label} — 반격 본문이 \`effCritR\` 를 부르지 않는다 (평타 치확 격리)`,
        !/effCritR\(/.test(flat), '반격이 평타 치확을 섞고 있다');
      chk(`${label} — 반격 본문이 \`p.critStk\` 를 건드리지 않는다`,
        !/p\.critStk/.test(flat), '반격이 평타 스택을 건드리고 있다');
      chk(`${label} — 반격 치확은 두 상수의 가산뿐`,
        /constctCr=\(px\.p_ctCritN\?PERK_CTCRIT_N:0\)\+\(px\.p_ctCritR\?PERK_CTCRIT_R:0\);/.test(flat), 'ctCr 정의가 바뀌었다');
    }
    /* 소환 적중은 `fromBasic` 없이 부른다 */
    chk('sim.js — `summonHit` 는 `dealDmg` 를 `fromBasic` 없이 부른다',
      /functionsummonHit\(G,e,ratio\)\{dealDmg\(G,e,ratio\);/.test(S), 'summonHit 가 평타로 세어지고 있다');
  }

  /* ---------- ⑩ 두 엔진 문면 1:1 ---------- */
  say('\n=== ⑩ 두 엔진(sim.js ↔ index.html) 같은 여섯 줄 ===');
  for (const [nm, re] of AX) {
    chk(`sim.js — ${nm}`, re.test(S), '못 찾았다');
    chk(`index.html — ${nm}`, re.test(H), '못 찾았다');
  }
  chk('두 엔진 상수 PERK_CSTACK_A 가 같다',
    (htmSrc.match(/PERK_CSTACK_A\s*=\s*([\d.]+)/) || [])[1] === String(A),
    (htmSrc.match(/PERK_CSTACK_A\s*=\s*([\d.]+)/) || [])[1]);
  chk('두 엔진 상수 PERK_CTCRIT_N / _R 가 같다',
    (htmSrc.match(/PERK_CTCRIT_N\s*=\s*([\d.]+)/) || [])[1] === String(CN) &&
    (htmSrc.match(/PERK_CTCRIT_R\s*=\s*([\d.]+)/) || [])[1] === String(CR),
    `${(htmSrc.match(/PERK_CTCRIT_N\s*=\s*([\d.]+)/) || [])[1]} / ${(htmSrc.match(/PERK_CTCRIT_R\s*=\s*([\d.]+)/) || [])[1]}`);

  /* ---------- ⑪ 주인 문면 ---------- */
  say('\n=== ⑪ ROUTINE 주인 원문 · PLAN §3.1 표 ===');
  chk('ROUTINE — 주인 원문 «한 대 때릴 때마다 치명확률 +1%, 치명타 뜨면 초기화 후 다시 쌓음»',
    RULE_STACK_OWN.test(routineSrc), '문면이 사라졌다');
  chk('ROUTINE — 위임 «**평타 적중**마다 +1 · 치명타 발생 시 0 · 소환·반격 제외»',
    RULE_STACK_DEL.test(routineSrc), '문면이 사라졌다');
  chk('ROUTINE — 주인 원문 «반격 시 그 반격이 치명타일 확률 +20%»',
    RULE_CTCRIT_N.test(routineSrc), '문면이 사라졌다');
  chk('ROUTINE — 위임 «반격 타격에만 치확 +20 가산»',
    RULE_CTCRIT_DEL.test(routineSrc), '문면이 사라졌다');
  chk('ROUTINE — 주인 원문 «반격 시 치명타일 확률 +40%» (II)',
    RULE_CTCRIT_R.test(routineSrc), '문면이 사라졌다');
  chk('PLAN §3.1 — 치명 스택 행에 «반격·소환·빗맞음 제외» 가 살아 있다',
    PLAN_STACK.test(planSrc), '표 행이 바뀌었다');
  chk('PLAN §3.1 — 반격 치명 행에 «가산(둘 다면 +60)» 이 살아 있다',
    PLAN_CTCRIT.test(planSrc), '표 행이 바뀌었다');

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
  console.log('[음성 검사] 치명 스택·반격 치명을 몰래 뒤집은 사본에서 이 게이트가 빨개지는가');
  const S_SIM = '  if(fromBasic&&px.p_critStack)p.critStk=crit?0:p.critStk+PERK_CSTACK_A;';
  const S_HTM = '  if(basic&&px.p_critStack) p.critStk=crit?0:p.critStk+PERK_CSTACK_A;';
  const MISS_SIM = '  if(Math.random()<ENEMY_EVADE){G.miss++;procOnMiss(G,e);return false;}';
  const MISS_HTM = '  if(Math.random()<ENEMY_EVADE){\n    G.miss++;';
  const both = f => [f, f, null, null];
  const cases = [
    ['S1 스택 갱신을 적 회피 판정 «위» 로 올리면 (빗맞아도 쌓인다)',
      s => s.replace(S_SIM + '\n', '').replace(MISS_SIM, S_SIM + '\n' + MISS_SIM),
      s => s.replace(S_HTM + '\n', '').replace(MISS_HTM, S_HTM + '\n' + MISS_HTM), null, null],
    ['S2 `fromBasic` 가드를 빼면 (반격·소환 적중도 쌓인다)',
      s => s.replace(S_SIM, '  if(px.p_critStack)p.critStk=crit?0:p.critStk+PERK_CSTACK_A;'),
      s => s.replace(S_HTM, '  if(px.p_critStack) p.critStk=crit?0:p.critStk+PERK_CSTACK_A;'), null, null],
    ['S3 `crit?0:` 를 빼면 (치명타가 떠도 초기화하지 않는다)',
      s => s.replace(S_SIM, '  if(fromBasic&&px.p_critStack)p.critStk=p.critStk+PERK_CSTACK_A;'),
      s => s.replace(S_HTM, '  if(basic&&px.p_critStack) p.critStk=p.critStk+PERK_CSTACK_A;'), null, null],
    ['S4 스택이 «그 평타» 부터 걸리게 하면 (굴림 앞으로 당긴다)',
      s => s.replace('  let cr=effCritR(p);', '  let cr=effCritR(p)+((fromBasic&&px.p_critStack)?PERK_CSTACK_A:0);'),
      s => s.replace('  let cr=effCritR(p);', '  let cr=effCritR(p)+((basic&&px.p_critStack)?PERK_CSTACK_A:0);'), null, null],
    ['S5 반격 치확에 평타 치확을 섞으면 (격리 위반)',
      ...both(s => s.replace('  const ctCr=(px.p_ctCritN?PERK_CTCRIT_N:0)+(px.p_ctCritR?PERK_CTCRIT_R:0);',
        '  const ctCr=effCritR(p)+(px.p_ctCritN?PERK_CTCRIT_N:0)+(px.p_ctCritR?PERK_CTCRIT_R:0);'))],
    ['S6 광전사가 치명 스택만은 못 막게 하면',
      s => s.replace('const effCritR=p=>{const px=p.px;if(px.p_berserk)return 0;',
        'const effCritR=p=>{const px=p.px;if(px.p_berserk)return px.p_critStack?p.critStk:0;'),
      s => s.replace('  const px=p.px; if(px.p_berserk) return 0;',
        '  const px=p.px; if(px.p_berserk) return px.p_critStack?p.critStk:0;'), null, null],
    ['S7 스택을 치확에 **곱**으로 붙이면 (가산이 아니다)',
      s => s.replace('  if(px.p_critStack)c+=p.critStk;', '  if(px.p_critStack)c*=1+p.critStk/100;'),
      s => s.replace('  if(px.p_critStack) c+=p.critStk;', '  if(px.p_critStack) c*=1+p.critStk/100;'), null, null],
    ['S8 반격 치명 I·II 를 가산이 아니라 **최대값**으로 묶으면',
      ...both(s => s.replace('(px.p_ctCritN?PERK_CTCRIT_N:0)+(px.p_ctCritR?PERK_CTCRIT_R:0)',
        'Math.max(px.p_ctCritN?PERK_CTCRIT_N:0,px.p_ctCritR?PERK_CTCRIT_R:0)'))],
    ['S9 반격 치명 배율을 `effCritF` 가 아니라 고정 2배로 바꾸면',
      s => s.replace('if(ctCr&&Math.random()*100<ctCr)cd*=effCritF(p)/100;', 'if(ctCr&&Math.random()*100<ctCr)cd*=2;'),
      s => s.replace('  if(ctCrit) cd*=effCritF(p)/100;', '  if(ctCrit) cd*=2;'), null, null],
    ['S10 반격이 평타 스택을 초기화하게 하면',
      s => s.replace('  if(px.p_ctDmgN)cd*=PERK_CTDMG_N;', '  if(px.p_critStack)p.critStk=0;\n  if(px.p_ctDmgN)cd*=PERK_CTDMG_N;'),
      s => s.replace('  if(px.p_ctDmgN) cd*=PERK_CTDMG_N;', '  if(px.p_critStack) p.critStk=0;\n  if(px.p_ctDmgN) cd*=PERK_CTDMG_N;'), null, null],
    ['S11 ROUTINE 에서 주인 원문 «치명타 뜨면 초기화 후 다시 쌓음» 을 지우면',
      null, null, s => s.replace('한 대 때릴 때마다 치명확률 +1%, 치명타 뜨면 초기화 후 다시 쌓음', '치명확률이 오른다'), null],
    ['S12 PLAN §3.1 에서 «반격·소환·빗맞음 제외» 를 지우면',
      null, null, null, s => s.replace(' · 반격·소환·빗맞음 제외 |', ' |')],
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

console.log('=== 치명 스택 · 반격 치명 게이트 (T149 · 주인 확정 T121 16:0X·17:0X) ===');
const bad = run(simSrc, htmSrc, routineSrc, planSrc, false);
console.log(`\n[치명 스택 게이트] 대조 ${R.length}항목 · 통과 ${R.length - bad} · 불합격 ${bad}` +
  (bad ? '' : ' → 통과 (평타 적중만 · 치명타 시 0 · 소환/반격/빗맞음 제외 · 반격 치명 격리를 실제로 굴려서 잰다)'));
process.exit(bad ? 1 : 0);
