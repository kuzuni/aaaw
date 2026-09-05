#!/usr/bin/env node
/* ================================================================================
   verifyKillTrigger — ⚑⚑⚑ T138 (워커 D · sess-0450-15839)

   **주인 확정 T121 2차 (2026-09-04 17:0X · 17:2X · ROUTINE «신규 주인 지시» 표)** 의
   처치-트리거 3특전이 «주인이 명시한 대로» 도는가를 **실제로 굴려서** 잰다.

     ⓐ 일반 «처치 시 확정 치명» (17:2X)
        «적 처치 시 다음 공격은 치명타 확률 +100% (스택 아님) ·
         **광전사(치확 0 고정) 상태에서도 그 한 방은 0% → 100%** 가 된다 — 주인 명시»
     ⓑ 희귀 «처치 시 대시» (17:0X)
        «적 처치 시 다음 적까지 바로 대시 ·
         **웨이브 마지막 적 → 다음 웨이브 첫 적으로는 대시하지 않는다**»
     ⓒ 희귀 «버서커» (17:0X)
        «적 처치 시 스택 +1 · 한 번 때릴 때마다 스택 1 소모하며 그 공격 +100%
         (**8스택이라고 +800% 를 한 번에 쓰는 게 아니라 8번의 공격이 각각 +100%**)»

   ── 구멍을 먼저 증명했다 (T138 사본 실측) ──
   이 세 문장을 재는 게이트가 **한 줄도 없었다.** 세 특전에 닿는 자는 두 곳뿐인데 둘 다 동작을 안 본다:
     · `verifyPerkOrder` — 특전표의 **id·등급·순서·설명문**만 본다(`p_killSureCrit`·`p_killDash`·
       `p_berserkStk` 세 줄이 목록에 있는지). 그 특전이 **무슨 일을 하는지**는 안 본다.
     · `verifyCombatConst` — 이동속도 정규식이 `(p.dash?DASH_MUL:1)` 를 **선택적으로 읽고 넘어간다**
       (`(?:...)?`). 대시 배수가 사라져도 «기본 속도 상수» 단언은 그대로 초록이다.
     · `verifySummonChain` 은 플레이어 틀에 `sureCrit/bsStk/dash` 필드를 만들기만 하고 단언은 없다.
   그래서 사본으로 확인했다 — 두 엔진에서
     ⓐ `if(fromBasic&&p.sureCrit)cr=100;` 한 줄을 지우고(광전사면 확정 치명이 죽는다)
     ⓑ 대시의 `&&e.wave&&e.wave.enemies.some(x=>x.hp>0)` 조건을 지워도(웨이브 마지막 적에서도 대시)
   **정적 게이트 21종의 통과 수가 글자 하나 안 움직였다**(20 초록 · `verifyScoreCriteria` 56/8 그대로 ·
   `verifyT2` 426 · T3 `battle` 57/57 도 초록). 주인이 «주인 명시» 라고 두 번 못박은 조항이
   조용히 뒤집혀도 아무도 못 잡는 상태였다.

   ── 그래서 이 게이트가 하는 일 ──
   문면 대조가 아니라 **실측 동결**이다. `sim.js` 의 진짜 `onKill`·`dealDmg`·`playerStrike`·
   `doCounter`·`summonHit` 를 vm 에서 그대로 굴려서 재고, `index.html` 은 같은 축의 문면·상수로 묶는다.
     ① 확정 치명 — 광전사 + 확정 치명 조합에서 **처치 직후 첫 평타의 치명률이 100%**,
        그 다음 평타는 **0%**(스택 아님 · 한 방만), 광전사만 있으면 0%,
        **소환·반격은 쓰지도 소모하지도 않는다**(`fromBasic` 축)
     ② 대시 — 같은 웨이브에 생존 적이 있을 때만 `p.dash` 가 켜지고,
        **웨이브 마지막 적을 죽였을 때는 다음 웨이브에 적이 남아 있어도 안 켜진다**(주인 명시),
        사거리에 닿으면 꺼지고, 이동 배수는 `DASH_MUL`, 대시 자체엔 데미지가 없다
     ③ 버서커 — 처치마다 스택 +1 · **평타 1회당 딱 1개** 소모하며 그 공격만 ×`PERK_BSTK_M`,
        스택이 3이면 **세 번의 공격이 각각 ×2**(한 방에 ×8 이 아니다 — 주인 명시),
        반격·소환은 스택을 소모하지 않는다
     ④ 두 엔진(`sim.js` ↔ `index.html`) 이 같은 여섯 줄·같은 두 상수를 쓴다 + 판정 순서
        (`effCritR` → 확정 치명 덮어쓰기 → 치명 굴림 → 소모)가 두 엔진 모두 그대로다
     ⑤ ROUTINE 에 주인 문면 3종이 살아 있다

   ── 이 게이트를 고쳐도 되는 때 ──
   **주인이 이 세 특전의 규칙을 새로 확정했을 때뿐이다.** 그때 아래 상수·기대값을 갱신하고
   PROGRESS 에 주인 원문과 함께 남긴다 — 고치는 것 자체가 diff 에 드러나는 것이 요점이다.

   사용: node tools/verifyKillTrigger.js        (exit 0 = 통과, 1 = 불합격)
   음성: node tools/verifyKillTrigger.js --self (심은 고장 10종 + 양성 대조군)
   ================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ── 주인 확정값 (ROUTINE T121 2차) ───────────────────────────────────────── */
const BSTK_M = 2.00;      /* 버서커 — 스택 1 소모당 그 공격 ×2 (+100%) */
const DASH_M = 5;         /* 처치 시 대시 — 이동 속도 배수 (위임 기본값) */
const SURE_CR = 100;      /* 확정 치명 — 그 한 방의 치명타 확률 (%) */

/* ROUTINE 주인 문면 — 규칙을 지우고 동작을 뒤집는 경로를 막는다 */
const RULE_SURE = /광전사\(치확 0 고정\) 상태에서도 그 한 방은 0% → 100%/;
const RULE_DASH = /웨이브 마지막 적 → 다음 웨이브 첫 적으로는 대시하지 않는다/;
const RULE_BSTK = /8스택이라고 \+800% 를 한 번에 쓰는 게 아니라/;

/* ── 두 엔진 공통 축 (공백 제거 후 대조) ──────────────────────────────────
   `index.html` 은 같은 자리에 UI 호출(addText·renderStatsGrid)이 붙어 있어 줄이 글자 그대로는
   다르다. 그래서 «무엇을 언제 하는가» 만 남긴 정규식으로 묶는다 — 이름을 바꾸거나 조건을
   빼면 여기서 빨개진다. */
const AX = [
  ['처치 → 확정 치명 플래그',   /if\(px\.p_killSureCrit\)\{?\s*p\.sureCrit=true;/],
  ['처치 → 버서커 스택 +1',     /if\(px\.p_berserkStk\)\{?\s*p\.bsStk\+\+;/],
  ['처치 → 대시 (같은 웨이브 생존 적이 있을 때만)',
    /if\(px\.p_killDash&&e\.wave&&e\.wave\.enemies\.some\(x=>x\.hp>0\)\)p\.dash=true;/],
  ['확정 치명이 치확을 100 으로 덮어쓴다 (평타만)',
    /if\((?:fromBasic|basic)&&p\.sureCrit\)cr=100;/],
  ['확정 치명은 그 한 방에서 소모된다 (평타만)',
    /if\((?:fromBasic|basic)&&p\.sureCrit\)p\.sureCrit=false;/],
  ['버서커는 평타 1회당 스택 1 소모 · 그 공격만 ×PERK_BSTK_M',
    /if\(px\.p_berserkStk&&p\.bsStk>0\)\{\s*p\.bsStk--;\s*ratio\*=PERK_BSTK_M;/],
  ['대시는 이동 속도에만 붙는다 (데미지·무적 없음)',
    /p\.worldX\+=132\*p\.walkMul\*\(p\.dash\?DASH_MUL:1\)\*dt/],
];

/* ================================================================
   `sim.js` 를 CLI 디스패처 앞까지만 vm 에 올려 전투 함수를 그대로 꺼낸다.
   `Math` 는 프로토타입 사본을 넘겨(호스트 `Math.random` 오염 방지) 굴림을 우리가 고정한다.
   ================================================================ */
const CUT = "const mode=process.argv[2]||'all';";
function loadSim(src) {
  const at = src.indexOf(CUT);
  if (at < 0) return null;
  const M = Object.create(Math);            /* Math.random 대입이 호스트로 새지 않게 */
  const ctx = {
    console: { log() {} }, process, Math: M, JSON, Number, String, Array,
    Set, Map, Object, Date, parseInt, parseFloat, isFinite, isNaN, require,
  };
  vm.createContext(ctx);
  try {
    vm.runInContext(src.slice(0, at) +
      '\n;globalThis.__K={PERKS,basePx,onKill,dealDmg,playerStrike,doCounter,summonHit,' +
      'effCritR,effDmg,PERK_BSTK_M,DASH_MUL,ENEMY_EVADE};', ctx);
  } catch (e) { return null; }
  const K = ctx.__K || (ctx.globalThis && ctx.globalThis.__K);
  return K ? { K, M } : null;
}

/* 웨이브 `waves` 개(각 `n` 마리) 를 가진 전장 + 특전 `ids` 만 가진 플레이어 */
function arena(K, ids, waves, n) {
  const nodes = [];
  for (let w = 0; w < (waves || 1); w++) {
    const nd = { type: 'wave', x: w * 500, done: false, enemies: [] };
    for (let j = 0; j < (n || 2); j++)
      nd.enemies.push({ worldX: 100 + w * 500 + j * 40, hp: 1e15, maxHp: 1e15, dmg: 1,
        ranged: false, atkTimer: 1, stun: 0, slow: 0, wave: nd, dead: false, isBoss: false, exp: 0 });
    nodes.push(nd);
  }
  const p = {
    worldX: 0, dmg: 100, aspd: 1, critR: 0, critF: 150, def: 0, counter: 0, evade: 0, steal: 0,
    killHeal: 0, misfire: 0, goldMul: 1, walkMul: 1, healAmp: 0, repairAmp: 0, nextCrit: false,
    nextAtk: 0, ward: 0, maxHp: 1e9, hp: 1e9, maxSh: 0, sh: 0, level: 1, exp: 0, critStk: 0,
    nhit: {}, collHpF: 1, atkTimer: 1, sureCrit: false, bsStk: 0, dash: false,
    buffs: { atk: [], aspd: [], critR: [], critF: [], def: [], evade: [] }, px: K.basePx(),
  };
  const G = { chapter: 1, player: p, nodes, pprojs: [], arrows: [], gold: 0, kills: 0, procN: 0,
    perkChances: 0, taken: [], overBoltCd: 0, autoBoltT: 3, autoSumT: 2, rampT: 3, stuns: 0,
    misses: 0, dead: false, cleared: true, t: 0, atkTries: 0, miss: 0, noPerk: true };
  p.G = G;
  for (const id of ids) {
    const k = K.PERKS.find(x => x.id === id);
    if (!k) return null;
    k.ap(p); G.taken.push(k);
  }
  return { G, p, nodes };
}
/* 적 하나를 «내가 죽였다» 로 처리 */
const slay = (K, G, e) => { e.hp = 0; K.onKill(G, e, 0); };

/* ================================================================ */
const R = [];
let QUIET = true;
const chk = (name, pass, detail) => {
  const x = { name, c: !!pass, d: detail == null ? '' : String(detail) };
  R.push(x);
  if (!QUIET) console.log(`  ${x.c ? '✓' : '✗'} ${x.name}${x.c ? '' : '  — ' + x.d}`);
};

function run(simSrc, htmSrc, routineSrc, quiet) {
  R.length = 0;
  QUIET = !!quiet;
  const say = quiet ? () => {} : console.log;

  const L = loadSim(simSrc);
  if (!L) { chk('sim.js 전투 함수 적재', false, 'vm 적재 실패 — 함수 이름이나 CLI 디스패처 위치가 바뀌었다. 게이트를 함께 고칠 것'); return finish(say, quiet); }
  const { K, M } = L;
  const S = simSrc.replace(/\s+/g, '');
  const H = htmSrc.replace(/\s+/g, '');

  /* ---------- ① 확정 치명 (주인 17:2X «광전사여도 그 한 방은 0% → 100%») ---------- */
  say('\n=== ① ⚑ 처치 시 확정 치명 — «광전사(치확 0 고정) 상태에서도 그 한 방은 0% → 100%» ===');
  {
    M.random = Math.random;                       /* 실측 구간은 진짜 난수로 */
    const N = 4000;
    /* 광전사만 — 치명타가 한 번도 안 떠야 한다 (대조군) */
    let base = 0, baseTry = 0;
    for (let i = 0; i < N; i++) {
      const a = arena(K, ['p_berserk'], 1, 2); if (!a) { chk('특전 id 확인', false, 'p_berserk 를 못 찾았다'); return finish(say, quiet); }
      slay(K, a.G, a.nodes[0].enemies[0]);
      const c = K.dealDmg(a.G, a.nodes[0].enemies[1], 1, true);
      if (a.G.miss === 0) { baseTry++; if (c) base++; }
    }
    chk('대조군 — 광전사만 있으면 처치 뒤 평타의 치명률이 0% (치확 0 고정이 살아 있다)',
      base === 0, `${base}/${baseTry} 회 치명`);

    /* 광전사 + 확정 치명 — 처치 직후 첫 평타는 반드시 치명타 */
    let s1 = 0, t1 = 0, s2 = 0, t2 = 0, flagOn = 0, flagKeep = 0;
    for (let i = 0; i < N; i++) {
      const a = arena(K, ['p_berserk', 'p_killSureCrit'], 1, 3); if (!a) { chk('특전 id 확인', false, 'p_killSureCrit 를 못 찾았다'); return finish(say, quiet); }
      const es = a.nodes[0].enemies;
      slay(K, a.G, es[0]);
      if (a.p.sureCrit) flagOn++;
      slay(K, a.G, es[1]);                        /* 두 번 죽여도 «스택 아님» — 플래그는 하나 */
      if (a.p.sureCrit) flagKeep++;
      const m0 = a.G.miss;
      const c1 = K.dealDmg(a.G, es[2], 1, true);
      if (a.G.miss === m0) { t1++; if (c1) s1++; }
      const m1 = a.G.miss;
      const c2 = K.dealDmg(a.G, es[2], 1, true);  /* 두 번째 평타 — 이미 소모됐다 */
      if (a.G.miss === m1) { t2++; if (c2) s2++; }
    }
    chk('처치하면 확정 치명 플래그가 켜진다', flagOn === N, `${flagOn}/${N}`);
    chk('두 번 처치해도 플래그는 하나 (스택 아님 — 주인 명시)', flagKeep === N, `${flagKeep}/${N}`);
    chk(`처치 직후 첫 평타의 치명률 = ${SURE_CR}% (광전사의 «치확 0 고정» 을 덮는다 — 주인 명시)`,
      t1 > 0 && s1 === t1, `${s1}/${t1} 회 치명`);
    chk('그 다음 평타는 다시 0% (한 방만 · 스택 아님)', t2 > 0 && s2 === 0, `${s2}/${t2} 회 치명`);

    /* 소환·반격은 «평타» 가 아니다 — 쓰지도 소모하지도 않는다 */
    let sumCrit = 0, sumKeep = 0;
    for (let i = 0; i < N; i++) {
      const a = arena(K, ['p_berserk', 'p_killSureCrit'], 1, 3);
      const es = a.nodes[0].enemies;
      slay(K, a.G, es[0]);
      if (K.dealDmg(a.G, es[2], 1)) sumCrit++;    /* fromBasic 없음 = 소환·반격 경로 */
      if (a.p.sureCrit) sumKeep++;
    }
    chk('소환·반격 적중은 확정 치명을 쓰지 않는다 (평타 축 · 치명률 0%)', sumCrit === 0, `${sumCrit}/${N} 회 치명`);
    chk('소환·반격 적중은 확정 치명을 소모하지 않는다 (다음 평타를 위해 남는다)', sumKeep === N, `${sumKeep}/${N}`);
  }

  /* ---------- ② 처치 시 대시 (주인 17:0X «다음 웨이브 첫 적으로는 대시하지 않는다») ---------- */
  say('\n=== ② ⚑ 처치 시 대시 — «웨이브 마지막 적 → 다음 웨이브 첫 적으로는 대시하지 않는다» ===');
  {
    const a1 = arena(K, ['p_killDash'], 1, 3);
    if (!a1) { chk('특전 id 확인', false, 'p_killDash 를 못 찾았다'); return finish(say, quiet); }
    slay(K, a1.G, a1.nodes[0].enemies[0]);
    chk('같은 웨이브에 생존 적이 있으면 대시한다', a1.p.dash === true, `dash=${a1.p.dash}`);

    const a2 = arena(K, ['p_killDash'], 1, 1);
    slay(K, a2.G, a2.nodes[0].enemies[0]);
    chk('웨이브 마지막 적을 죽이면 대시하지 않는다 (같은 웨이브에 남은 적이 없다)',
      a2.p.dash === false, `dash=${a2.p.dash}`);

    /* ⚑ 주인 명시의 핵심 — 다음 «웨이브» 에 적이 잔뜩 있어도 넘어가지 않는다 */
    const a3 = arena(K, ['p_killDash'], 2, 4);
    for (const e of a3.nodes[0].enemies.slice(1)) e.hp = 0;   /* 첫 웨이브엔 한 마리만 남았다 */
    slay(K, a3.G, a3.nodes[0].enemies[0]);
    chk('다음 웨이브에 적이 4마리 남아 있어도 대시하지 않는다 (주인 명시)',
      a3.p.dash === false, `dash=${a3.p.dash} · 다음 웨이브 생존 ${a3.nodes[1].enemies.filter(x => x.hp > 0).length}마리`);

    /* 대시가 없는 플레이어는 언제나 안 켜진다 (특전 축이 맞는가) */
    const a4 = arena(K, [], 1, 3);
    slay(K, a4.G, a4.nodes[0].enemies[0]);
    chk('특전이 없으면 대시하지 않는다', a4.p.dash === false, `dash=${a4.p.dash}`);

    chk(`대시 이동 배수 DASH_MUL = ${DASH_M}`, K.DASH_MUL === DASH_M, `엔진 ${K.DASH_MUL}`);
    chk('대시는 사거리(74px)에 닿으면 꺼진다 (도착하면 평타로 돌아온다)',
      /else\{p\.dash=false;p\.atkTimer-=dt\*effAspd\(p\)/.test(S), '해제 자리를 못 찾았다');
    /* 대시 구간이 데미지·무적을 만들지 않는가 — 이동 한 줄뿐이어야 한다 */
    const mv = simSrc.match(/if\(dist>74\)\{[^\n]*\}/);
    chk('대시 구간에 데미지·무적이 없다 (주인 «대시 데미지 없음»)',
      !!mv && !/dealDmg|applyStun|invuln|fire(?:Axe|Arrows|Bolts|Wave|Spear)/.test(mv[0]),
      mv ? mv[0].slice(0, 90) : '이동 분기를 못 찾았다');
  }

  /* ---------- ③ 버서커 (주인 17:0X «8스택이 한 방에 +800% 가 아니다») ---------- */
  say('\n=== ③ ⚑ 버서커 — «8스택이라고 +800% 를 한 번에 쓰는 게 아니라 8번의 공격이 각각 +100%» ===');
  {
    chk(`버서커 배수 PERK_BSTK_M = ${BSTK_M.toFixed(2)} (스택 1 소모당 그 공격 +100%)`,
      K.PERK_BSTK_M === BSTK_M, `엔진 ${K.PERK_BSTK_M}`);

    /* 굴림 고정 — Math.random()=0.5 면 rand(0.92,1.08)=1.0 · 치명 0% · 적 회피(10%) 없음 */
    M.random = () => 0.5;
    const KILLS = 3;
    const hits = ids => {
      const a = arena(K, ids, 1, 8);
      const es = a.nodes[0].enemies;
      for (let i = 0; i < KILLS; i++) slay(K, a.G, es[i]);
      const stk = a.p.bsStk;
      const out = [];
      for (let i = 0; i < KILLS + 2; i++) {         /* 스택 수보다 두 번 더 때린다 */
        const tgt = es[KILLS + 3];
        const before = tgt.hp;
        K.playerStrike(a.G, tgt);
        out.push(before - tgt.hp);
      }
      return { stk, out, p: a.p, G: a.G, es };
    };
    const on = hits(['p_berserkStk']);
    const off = hits([]);
    chk(`처치 ${KILLS}번 → 스택 ${KILLS}개`, on.stk === KILLS, `bsStk=${on.stk}`);
    chk('특전이 없으면 스택이 안 쌓인다', off.stk === 0, `bsStk=${off.stk}`);
    const unit = off.out[0];
    const ratios = on.out.map(d => d / unit);
    const want = [BSTK_M, BSTK_M, BSTK_M, 1, 1];
    const near = (a, b) => Math.abs(a - b) < 1e-9;
    chk(`평타 ${KILLS}회가 각각 ×${BSTK_M.toFixed(2)} · 그 뒤 두 번은 ×1 (한 방에 ×${Math.pow(BSTK_M, KILLS)} 이 아니다 — 주인 명시)`,
      ratios.length === want.length && ratios.every((r, i) => near(r, want[i])),
      ratios.map(r => '×' + r.toFixed(3)).join(' · '));
    chk('평타 1회당 스택은 딱 1개만 소모된다 (스택을 한 번에 털지 않는다)',
      on.p.bsStk === 0 && off.out.every(d => near(d, unit)),
      `남은 스택 ${on.p.bsStk} · 대조군 ${off.out.map(d => (d / unit).toFixed(3)).join('/')}`);

    /* 반격·소환은 스택을 건드리지 않는다 (위임 기본값 — 두 엔진 같은 자리) */
    const b = arena(K, ['p_berserkStk'], 1, 6);
    for (let i = 0; i < KILLS; i++) slay(K, b.G, b.nodes[0].enemies[i]);
    const src = b.nodes[0].enemies[KILLS + 1];
    K.doCounter(b.G, src, 0);
    chk('반격은 버서커 스택을 소모하지 않는다', b.p.bsStk === KILLS, `bsStk=${b.p.bsStk}`);
    K.summonHit(b.G, b.nodes[0].enemies[KILLS + 2], 0.75);
    chk('소환 적중은 버서커 스택을 소모하지 않는다', b.p.bsStk === KILLS, `bsStk=${b.p.bsStk}`);
    M.random = Math.random;
  }

  /* ---------- ④ 두 엔진 일치 · 판정 순서 ---------- */
  say('\n=== ④ 두 엔진(sim.js ↔ index.html) 일치 · 판정 순서 ===');
  for (const [nm, re] of AX) {
    const a = re.test(S), b = re.test(H);
    chk(`${nm} — 두 엔진 모두`, a && b,
      `sim.js ${a ? 'OK' : '없음'} · index.html ${b ? 'OK' : '없음'}`);
  }
  for (const [nm, val, re] of [
    ['PERK_BSTK_M', BSTK_M, /PERK_BSTK_M=([\d.]+)/],
    ['DASH_MUL', DASH_M, /DASH_MUL=(\d+)/],
  ]) {
    const a = S.match(re), b = H.match(re);
    chk(`상수 ${nm} = ${val} — 두 엔진 같은 값`,
      !!a && !!b && +a[1] === val && +b[1] === val,
      `sim.js ${a ? a[1] : '없음'} · index.html ${b ? b[1] : '없음'}`);
  }
  /* 순서: effCritR(0 고정) → 확정 치명 덮어쓰기 → 치명 굴림 → 소모.
     덮어쓰기가 굴림 뒤로 가거나 effCritR 앞으로 가면 «광전사여도 100%» 가 죽는다. */
  for (const [who, src] of [['sim.js', S], ['index.html', H]]) {
    const iC = src.indexOf('letcr=effCritR(p);');
    const iS = src.search(/if\((?:fromBasic|basic)&&p\.sureCrit\)cr=100;/);
    const iR = src.indexOf('constcrit=Math.random()*100<cr;');
    const iX = src.search(/if\((?:fromBasic|basic)&&p\.sureCrit\)p\.sureCrit=false;/);
    chk(`${who} — 판정 순서: effCritR → 확정 치명 덮어쓰기 → 치명 굴림 → 소모`,
      iC >= 0 && iS > iC && iR > iS && iX > iR, `${iC}/${iS}/${iR}/${iX}`);
  }

  /* ---------- ⑤ ROUTINE 주인 문면 ---------- */
  say('\n=== ⑤ ROUTINE 주인 문면 ===');
  chk('ROUTINE «광전사(치확 0 고정) 상태에서도 그 한 방은 0% → 100%»', RULE_SURE.test(routineSrc));
  chk('ROUTINE «웨이브 마지막 적 → 다음 웨이브 첫 적으로는 대시하지 않는다»', RULE_DASH.test(routineSrc));
  chk('ROUTINE «8스택이라고 +800% 를 한 번에 쓰는 게 아니라»', RULE_BSTK.test(routineSrc));

  return finish(say, quiet);
}

function finish() {   /* 항목은 chk 가 그 자리에서 찍는다 — 여기선 불합격 수만 돌려준다 */
  return R.filter(x => !x.c).length;
}

/* ================================================================ */
const simSrc = rd('sim.js');
const htmSrc = rd('index.html');
const routineSrc = rd('docs/ROUTINE.md');

if (process.argv.includes('--self')) {
  /* 음성 검사 — 심은 고장을 이 게이트가 실제로 잡는가.
     T126 규약: 돌연변이가 no-op(치환이 안 먹음)이면 그것부터 빨갛게 떨어뜨린다. */
  console.log('[음성 검사] 처치-트리거 3특전을 몰래 뒤집은 사본에서 이 게이트가 빨개지는가');
  const both = f => [f, f, null];
  const cases = [
    ['확정 치명이 광전사를 못 덮게 하면 (주인 «0% → 100%» 위반)',
      ...both(s => s.replace(/\n\s*if\((?:fromBasic|basic)&&p\.sureCrit\) ?cr=100;/g, '\n  /* 제거 */'))],
    ['확정 치명을 평타 밖(소환·반격)에서도 쓰게 하면',
      ...both(s => s.replace(/if\((fromBasic|basic)&&p\.sureCrit\) ?cr=100;/g, 'if(p.sureCrit)cr=100;'))],
    ['확정 치명을 소모하지 않으면 (한 방이 아니라 계속 치명)',
      ...both(s => s.replace(/if\((?:fromBasic|basic)&&p\.sureCrit\) ?p\.sureCrit=false;/g, '/* 제거 */'))],
    ['확정 치명을 스택으로 바꾸면 (플래그가 아니라 누적)',
      ...both(s => s.replace(/if\(px\.p_killSureCrit\)(\{?) ?p\.sureCrit=true;/g, 'if(px.p_killSureCrit)$1 p.sureCrit=(p.sureCrit||0)+1;'))],
    ['대시의 «같은 웨이브 생존 적» 조건을 지우면 (마지막 적에서도 대시)',
      ...both(s => s.replace(/if\(px\.p_killDash&&e\.wave&&e\.wave\.enemies\.some\(x=>x\.hp>0\)\)/g, 'if(px.p_killDash)'))],
    ['대시를 «다음 웨이브 첫 적» 까지 넓히면 (주인 명시 위반)',
      ...both(s => s.replace(/e\.wave&&e\.wave\.enemies\.some\(x=>x\.hp>0\)/g,
        'e.wave&&G.nodes.some(nd=>nd.enemies&&nd.enemies.some(x=>x.hp>0))'))],
    ['버서커가 스택을 안 소모하면 (한 번 쌓으면 계속 ×2)',
      ...both(s => s.replace(/\{ ?p\.bsStk--; ?ratio\*=PERK_BSTK_M;/g, '{ ratio*=PERK_BSTK_M;'))],
    ['버서커가 스택을 한 방에 다 쓰면 (3스택 = ×8 — 주인 «한 번에 +800% 가 아니다» 위반)',
      ...both(s => s.replace(/\{ ?p\.bsStk--; ?ratio\*=PERK_BSTK_M;/g,
        '{ ratio*=Math.pow(PERK_BSTK_M,p.bsStk); p.bsStk=0;'))],
    ['index.html 만 흔들면 (두 엔진이 갈라진다)',
      null, s => s.replace('DASH_MUL=5,', 'DASH_MUL=3,'), null],
    ['ROUTINE 에서 «다음 웨이브 첫 적으로는 대시하지 않는다» 를 지우면',
      null, null, s => s.replace('웨이브 마지막 적 → 다음 웨이브 첫 적으로는 대시하지 않는다',
        '다음 웨이브 첫 적으로도 대시한다')],
  ];
  let caught = 0, noop = 0;
  for (const [why, mS, mH, mR] of cases) {
    const s2 = mS ? mS(simSrc) : simSrc;
    const h2 = mH ? mH(htmSrc) : htmSrc;
    const r2 = mR ? mR(routineSrc) : routineSrc;
    if ((mS && s2 === simSrc) || (mH && h2 === htmSrc) || (mR && r2 === routineSrc)) {
      console.log(`  ✗ 음성 «${why}» — 치환이 안 먹었다 (no-op · 심을 자리가 사라졌으면 이 케이스를 고칠 것)`);
      noop++; continue;
    }
    const bad = run(s2, h2, r2, true);
    if (bad > 0) { console.log(`  ✓ 음성 «${why}» → 불합격 ${bad}건`); caught++; }
    else console.log(`  ✗ 음성 «${why}» → 아무것도 안 잡혔다 (동결이 죽었다)`);
  }
  const base = run(simSrc, htmSrc, routineSrc, true);
  base === 0 ? console.log(`  ✓ 양성 대조군 — 원본 ${R.length}항목 전부 통과 (오탐 0)`)
             : console.log(`  ✗ 양성 대조군 — 원본에서 ${base}건 불합격 (오탐)`);
  console.log(`\n[음성 검사] ${caught}/${cases.length} · no-op ${noop} · 오탐 ${base}`);
  process.exit(caught === cases.length && noop === 0 && base === 0 ? 0 : 1);
}

console.log('=== 처치-트리거 3특전 게이트 (T138 · 주인 확정 T121 2차 17:0X·17:2X) ===');
const bad = run(simSrc, htmSrc, routineSrc, false);
console.log(`\n[처치-트리거 게이트] 대조 ${R.length}항목 · 통과 ${R.length - bad} · 불합격 ${bad}` +
  (bad ? '' : ' → 통과 (확정 치명 · 대시 · 버서커를 sim.js 엔진에서 실제로 굴려서 잰다)'));
process.exit(bad ? 1 : 0);
