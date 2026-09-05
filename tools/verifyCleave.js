#!/usr/bin/env node
/* ================================================================================
   verifyCleave — ⚑⚑⚑ T142 (워커 C · sess-0635-7421)

   **주인 확정 T121 2차 (2026-09-04 17:4X · ROUTINE 최상단) «관통 베기» I/II/III 의 발동 규칙.**
   주인이 표에 직접 적은 조항은 여섯이고, 그중 둘은 «주인 명시» 로 못박혀 있다:

     ① 확률 — I 33% · II 66% · III 항상
     ② «**전부 따로 굴린다** — 셋 다 있으면 셋 다 터져 **바로 뒤 적이 한 공격에 최대 3번**
        데미지를 받는다» (주인 명시)
     ③ «바로 뒤» = **타겟 다음으로 가까운 살아 있는 적(같은 웨이브)**
     ④ 데미지 = **그 평타가 타겟에게 준 값 그대로**(치명타면 치명 값)
     ⑤ 뒤 적의 회피 10% 는 **따로 굴림** · 뒤 적 처치도 «**처치**» 판정
     ⑥ **평타에만** · 각 발동은 뒤 적 1마리에게 1회씩(**뒤의 뒤로 번지지 않음**) · 소환·반격은 대상 아님

   ── 구멍을 먼저 증명했다 (T142 사본 실측) ──
   착수 시점 이 특전 3종에 닿는 자는 셋뿐인데 **아무도 굴려 보지 않는다**:
     · `verifyPerkOrder` — id·등급·이름·설명문만 본다(«33% 확률로 바로 뒤 적도 같은 데미지» 라는 «글자»).
     · `verifyNumClean`  — 33/66 이 주인 등재분이라는 «숫자 출처» 만 본다.
     · `verifyT2` ⑩     — `procOnMiss` 호출이 세 곳(dealDmg·doCounter·cleave)이라는 «개수» 만 센다.
   그래서 두 엔진에 아래 개조를 심고 정적 게이트 26종을 전수로 돌렸더니 **통과 수가 한 개도 안 움직였다**:
     S1 «셋을 한 번만 굴린다» — 세 줄을 `Math.max` 확률 한 번으로 합친다.
        → 주인 ② 의 «최대 3번» 이 «최대 1번» 이 된다. 문면·개수·상수는 전부 그대로라 아무도 못 본다.
     S2 «방향 필터 제거» — `if(e.worldX<=tgt.worldX)continue;` 한 줄을 지운다.
        → 주인 ③ 의 «바로 뒤» 가 «가장 가까운 아무나» 가 된다(앞 적도 맞는다).
     S3 «웨이브 필터 제거» — `e.wave!==tgt.wave` 를 지운다.
        → 다음 웨이브 대기분으로 번진다(T44 «관통형은 지금 필드의 노드만» 과 같은 종류의 사고).
     S6 «데미지 반감» — `back.hp-=dmg` → `back.hp-=dmg*0.5`.
        → 주인 ④ 의 «값 그대로» 가 죽는다.
   (S4 «평타 전용 해제» 는 `verifySummonChain` 이, S5 «뒤 적 회피 굴림 제거» 는 `verifyT2` ⑩ 이
    각각 **부수적으로** 잡는다 — 둘 다 «관통 베기를 보는 검사» 가 아니라 연쇄 상수·호출 개수를 세다가
    걸린 것이라, 여기서도 정면으로 다시 잰다.)

   ── 그래서 이 게이트가 하는 일 ──
   문면 대조가 아니라 **실제로 굴려서 재는 것**이다(T137 `verifyGearOptTrigger` 의 수법).
   `sim.js` 의 진짜 `cleave`·`dealDmg`·`onKill` 을 vm 에 올리고 `Math.random` 을 **대본(queue)** 으로
   갈아끼워, 적을 원하는 자리에 세운 뒤 한 방을 때리고 **누가 몇 번 얼마나 맞았는지**를 직접 센다.

   ⓐ 상수 3종(0.33/0.66/1.00) 두 엔진 일치 + ROUTINE 주인 문면 2절
   ⓑ **셋 다 따로 굴린다** — 셋 보유·전부 성공이면 뒤 적이 정확히 3번 맞는다(1·2개면 1·2번),
      하나가 실패해도 **나머지는 굴린다**(N 실패·R·L 성공 = 2번) ← S1 을 잡는 자리
   ⓒ 확률 임계 — 0.32 발동 / 0.33 안 함 · 0.65 / 0.66 · III 는 0.999 에서도 발동
   ⓓ **«바로 뒤» 1마리** — 뒤에 둘이면 가까운 쪽만 · 앞 적은 안 맞는다 · 앞이 더 가까워도 뒤가 맞는다
   ⓔ **같은 웨이브만** — 다른 웨이브의 더 가까운 적이 있어도 같은 웨이브 것이 맞는다
   ⓕ **데미지는 값 그대로** — `cleave(G,tgt,777)` = 정확히 777 · `dealDmg` 경유 치명타면 타겟 감소분과 같다
   ⓖ **뒤 적 회피는 따로 굴린다** — 회피하면 hp 불변·`miss` +1·`atkTries` +1, 셋 중 하나만 회피하면 2번분
   ⓗ **뒤 적 처치도 «처치» 판정** — `onKill` 이 돌아 `kills`·골드·처치 트리거가 발동하고, **한 번만** 죽는다
   ⓘ **뒤의 뒤로 안 번진다** — 3마리 일렬에서 셋 다 터져도 세 번째는 안 맞는다
   ⓙ **평타에만** — `fromBasic=false`(소환·반격 적중)면 아무도 안 맞는다 + 두 엔진 호출부 문면
   ⓚ 두 엔진 `cleave` 본문 구조 1:1 (방향·웨이브 필터 · 회피 굴림 · onKill · 세 줄 굴림)

   ── 이 상수를 고쳐도 되는 때 ──
   **주인이 관통 베기 규칙을 새로 확정했을 때뿐이다.** 그때 FZ 를 갱신하고 PROGRESS 에 주인 원문과
   함께 남긴다 — 규칙을 고치는 것 자체가 diff 에 드러나는 것이 요점이다.

   사용: node tools/verifyCleave.js        (exit 0 = 통과, 1 = 불합격)
   음성: node tools/verifyCleave.js --self (심은 고장 12종 + 양성 대조군)
   ================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ── 주인 확정값 동결 (T121 2차 · 17:4X) ─────────────────────────────────────── */
const FZ = {
  chN: 0.33,      /* 관통 베기   I  — 공격 시 33% */
  chR: 0.66,      /* 관통 베기  II  — 공격 시 66% */
  chL: 1.00,      /* 관통 베기 III  — 공격 시 항상 */
  evade: 0.10,    /* 뒤 적의 회피 10% (따로 굴림) */
  maxHits: 3,     /* 셋 다 있으면 한 공격에 최대 3번 (주인 명시) */
};

/* 주인 문면 (ROUTINE) — 지워지면 이 게이트의 근거가 사라진 것이므로 같이 빨개진다 */
const RULE_TARGET = /«바로 뒤» = 타겟 다음으로 가까운 살아 있는 적\(같은 웨이브\)/;
const RULE_TRIPLE = /\*\*전부 따로 굴린다\*\* — 셋 다 있으면 셋 다 터져 \*\*바로 뒤 적이 한 공격에 최대 3번\*\*/;

/* 두 엔진 공통 구조 — 여기가 갈라지면 게임과 시뮬이 다른 플레이어를 만든다.
   (공백을 접어서 비교하므로 `index.html` 쪽의 들여쓰기 차이는 무시된다) */
const STRUCT = [
  ['보유 가드', /if\(!\(px\.p_cleaveN\|\|px\.p_cleaveR\|\|px\.p_cleaveL\)\|\|dmg<=0\) ?return;/],
  ['웨이브 필터', /if\(e===tgt\|\|e\.wave!==tgt\.wave\) ?continue;/],
  ['방향 필터', /if\(e\.worldX<=tgt\.worldX\) ?continue;/],
  ['가장 가까운 뒤', /if\(!back\|\|e\.worldX<back\.worldX\) ?back=e;/],
  ['이미 죽었으면 건너뜀', /if\(back\.hp<=0\) ?return;/],
  ['뒤 적 회피 굴림', /if\(Math\.random\(\)<ENEMY_EVADE\)\{/],
  ['뒤 적 처치 판정', /if\(back\.hp<=0\) ?onKill\(back,-back\.hp\);|if\(back\.hp<=0\)onKill\(G,back,-back\.hp\);/],
  ['I 굴림', /if\(px\.p_cleaveN&&pkk\(p,PERK_CLEAVE_N\)\) ?hit\(\);/],
  ['II 굴림', /if\(px\.p_cleaveR&&pkk\(p,PERK_CLEAVE_R\)\) ?hit\(\);/],
  ['III 굴림', /if\(px\.p_cleaveL&&pkk\(p,PERK_CLEAVE_L\)\) ?hit\(\);/],
];

/* ================================================================
   sim.js 를 CLI 디스패처 앞까지만 vm 에 올린다 (`verifyGearOptTrigger` 와 같은 수법).
   `Math` 를 샌드박스에 직접 넣어 **난수 스트림을 대본으로 통제·계수**하는 것이 이 게이트의 실측 수법이다.
   ================================================================ */
const CUT = 'const mode=process.argv[2]||';
const EXPORTS = '\nmodule.exports={cleave,dealDmg,onKill,aliveList,mkPlayer,mkBuild,PERKS,' +
  'PERK_CLEAVE_N,PERK_CLEAVE_R,PERK_CLEAVE_L,ENEMY_EVADE};';

function loadSim(src, rng) {
  const at = src.indexOf(CUT);
  if (at < 0) return null;
  const M = Object.create(Math);
  /* 대본이 남아 있으면 그것을 쓰고, 떨어지면 `dflt`(기본 실패값)로 채운다.
     굴림 횟수를 세는 것 자체가 검사 항목이라 카운터를 여기 둔다. */
  M.random = () => { rng.n++; return rng.q.length ? rng.q.shift() : rng.dflt; };
  const m = { exports: {} };
  try {
    vm.runInNewContext(src.slice(0, at) + EXPORTS,
      { module: m, exports: m.exports, process, console: { log() {} }, require, Math: M });
  } catch (e) { return null; }
  return m.exports;
}

/* ── 무대 세우기 ────────────────────────────────────────────────────────────────
   장비 없는 플레이어(`mkBuild(-1,…)`) — 장비 옵션이 굴림 스트림에 끼어들면 측정이 흐려진다.
   적은 `startChapter` 가 만드는 것과 같은 모양으로 직접 세운다(웨이브 = 노드 객체). */
function mkEnemy(x, nd, hp) {
  return { worldX: x, hp, maxHp: hp, dmg: 1, ranged: false, atkTimer: 1,
           stun: 0, slow: 0, wave: nd, dead: false, isBoss: false, exp: 0 };
}
function scene(A, o) {
  const nodes = [];
  const mkNode = xs => {
    const nd = { type: 'battle', x: 0, done: false, enemies: [] };
    for (const x of xs) nd.enemies.push(mkEnemy(x, nd, o.hp === undefined ? 1e9 : o.hp));
    nodes.push(nd); return nd;
  };
  mkNode(o.xs);
  if (o.xs2) mkNode(o.xs2);
  const G = { chapter: 1, player: null, nodes, projs: [], taken: [], t: 0,
              dead: false, gold: 0, kills: 0, atkTries: 0, miss: 0, procN: 0 };
  G.player = A.mkPlayer(A.mkBuild(-1, 0, 0, 0), G);
  for (const id of (o.perks || [])) { const k = A.PERKS.find(x => x.id === id); if (k) k.ap(G.player); }
  return G;
}
/* 한 방 — 대본 `q` 를 깔고 `cleave` 를 정확히 한 번 부른다. 반환값은 «누가 얼마나 잃었나». */
function cut(A, rng, G, tgt, dmg, q, dflt) {
  rng.q = q.slice(); rng.n = 0; rng.dflt = dflt === undefined ? 0.999 : dflt;
  const before = new Map();
  for (const nd of G.nodes) for (const e of nd.enemies) before.set(e, e.hp);
  A.cleave(G, tgt, dmg);
  const lost = [];
  for (const nd of G.nodes) for (const e of nd.enemies) lost.push(before.get(e) - e.hp);
  return { lost, rolls: rng.n, kills: G.kills, miss: G.miss, tries: G.atkTries };
}
const CL3 = ['p_cleaveN', 'p_cleaveR', 'p_cleaveL'];
const HIT = 0;      /* pkk 성공 (0 < 어떤 확률이든) · 회피 굴림에서는 «회피 성공» */
const NOEV = 0.5;   /* 회피 굴림 실패 (0.5 >= 0.10) — 즉 «맞는다» */

/* 함수 본문만 잘라 온다 (다음 최상위 function 까지) */
function fnBody(src, sig) {
  const a = src.indexOf(sig);
  if (a < 0) return '';
  const b = src.indexOf('\nfunction ', a + sig.length);
  return src.slice(a, b < 0 ? src.length : b);
}

/* ================================================================ */
const R = [];
let QUIET = false;
const chk = (name, pass, detail) => {
  R.push({ name, c: !!pass, d: detail });
  if (!QUIET) console.log(`  ${pass ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

function run(simSrc, htmSrc, routineSrc, quiet) {
  R.length = 0;
  QUIET = !!quiet;
  const say = quiet ? () => {} : console.log;
  const rng = { n: 0, q: [], dflt: 0.999 };
  const A = loadSim(simSrc, rng);
  chk('sim.js 엔진 로드 (cleave·dealDmg·onKill)', !!A, 'CLI 디스패처 앞까지 잘라 vm 에 올린다');
  if (!A) return finish(say, quiet);

  /* ===== ⓐ 상수 동결 + 두 엔진 일치 + 주인 문면 ===== */
  say('\n=== ⓐ 확률 상수 (주인 확정 17:4X: I 33% · II 66% · III 항상) ===');
  {
    chk(`sim.js PERK_CLEAVE_N = ${FZ.chN}`, A.PERK_CLEAVE_N === FZ.chN, String(A.PERK_CLEAVE_N));
    chk(`sim.js PERK_CLEAVE_R = ${FZ.chR}`, A.PERK_CLEAVE_R === FZ.chR, String(A.PERK_CLEAVE_R));
    chk(`sim.js PERK_CLEAVE_L = ${FZ.chL}`, A.PERK_CLEAVE_L === FZ.chL, String(A.PERK_CLEAVE_L));
    const g = (s, k) => { const m = s.match(new RegExp(k + '\\s*=\\s*([0-9.]+)')); return m ? Number(m[1]) : NaN; };
    for (const [k, v] of [['PERK_CLEAVE_N', FZ.chN], ['PERK_CLEAVE_R', FZ.chR], ['PERK_CLEAVE_L', FZ.chL]])
      chk(`index.html ${k} = ${v} (두 엔진 일치)`, g(htmSrc, k) === v, String(g(htmSrc, k)));
    chk('ROUTINE 에 주인 «바로 뒤 = 타겟 다음으로 가까운 살아 있는 적(같은 웨이브)» 이 살아 있다',
      RULE_TARGET.test(routineSrc));
    chk('ROUTINE 에 주인 «전부 따로 굴린다 … 한 공격에 최대 3번» 이 살아 있다',
      RULE_TRIPLE.test(routineSrc));
  }

  /* ===== ⓑ 셋 다 «따로» 굴린다 (주인 명시) ===== */
  say('\n=== ⓑ 셋은 서로 다른 특전이라 각각 따로 굴린다 (sim.js cleave 실측) ===');
  {
    const D = 100;
    const one = (perks, q) => {
      const G = scene(A, { xs: [0, 88], perks });
      return cut(A, rng, G, G.nodes[0].enemies[0], D, q);
    };
    /* 대본은 [pkk, 회피] 쌍이 특전 수만큼 이어진다 */
    const r3 = one(CL3, [HIT, NOEV, HIT, NOEV, HIT, NOEV]);
    chk(`셋 다 보유 · 전부 성공 → 뒤 적이 ${FZ.maxHits}번 맞는다 (${FZ.maxHits}×${D})`,
      r3.lost[1] === D * FZ.maxHits, `뒤 적 손실 ${r3.lost[1]} · 기대 ${D * FZ.maxHits}`);
    chk('그 한 방이 굴린 난수 = 6회 (pkk 3 + 뒤 적 회피 3)', r3.rolls === 6, `${r3.rolls}회`);
    chk('타겟 자신은 cleave 로 안 맞는다 (손실 0)', r3.lost[0] === 0, `타겟 손실 ${r3.lost[0]}`);

    const r1 = one(['p_cleaveN'], [HIT, NOEV]);
    chk('I 만 보유 → 1번', r1.lost[1] === D && r1.rolls === 2, `손실 ${r1.lost[1]} · 굴림 ${r1.rolls}`);
    const r2 = one(['p_cleaveN', 'p_cleaveR'], [HIT, NOEV, HIT, NOEV]);
    chk('I·II 보유 → 2번', r2.lost[1] === D * 2 && r2.rolls === 4, `손실 ${r2.lost[1]} · 굴림 ${r2.rolls}`);

    /* ⚑ S1(«한 번만 굴린다») 을 잡는 자리 — 하나가 실패해도 나머지 둘은 그대로 굴린다 */
    const rMiss = one(CL3, [0.9, HIT, NOEV, HIT, NOEV]);
    chk('⚑ I 이 실패해도 II·III 은 그대로 굴린다 → 2번 (한 번만 굴리면 여기서 0~1번이 된다)',
      rMiss.lost[1] === D * 2 && rMiss.rolls === 5, `손실 ${rMiss.lost[1]} · 굴림 ${rMiss.rolls}`);
    const rMid = one(CL3, [HIT, NOEV, 0.9, HIT, NOEV]);
    chk('⚑ 가운데(II)만 실패해도 I·III 은 그대로 → 2번',
      rMid.lost[1] === D * 2 && rMid.rolls === 5, `손실 ${rMid.lost[1]} · 굴림 ${rMid.rolls}`);
    chk('아무도 안 보유하면 굴리지도 않는다 (난수 0회)', one([], []).rolls === 0);
  }

  /* ===== ⓒ 확률 임계 ===== */
  say('\n=== ⓒ 확률 임계 — 주인 표의 33 / 66 / 항상 ===');
  {
    const D = 100;
    const at = (id, v) => {
      const G = scene(A, { xs: [0, 88], perks: [id] });
      return cut(A, rng, G, G.nodes[0].enemies[0], D, [v, NOEV]).lost[1];
    };
    chk('I: 난수 0.32 → 발동', at('p_cleaveN', 0.32) === D);
    chk(`I: 난수 ${FZ.chN} → 안 함 (경계는 «미만»)`, at('p_cleaveN', FZ.chN) === 0);
    chk('II: 난수 0.65 → 발동', at('p_cleaveR', 0.65) === D);
    chk(`II: 난수 ${FZ.chR} → 안 함`, at('p_cleaveR', FZ.chR) === 0);
    chk('III: 난수 0.999 에서도 발동 (항상)', at('p_cleaveL', 0.999) === D);
  }

  /* ===== ⓓ 대상 = «바로 뒤» 한 마리 ===== */
  say('\n=== ⓓ 대상 = «타겟 다음으로 가까운 살아 있는 적» 한 마리 (주인 17:4X) ===');
  {
    const D = 100, P = ['p_cleaveL'], q = [HIT, NOEV];
    /* 뒤에 둘 — 가까운 쪽만 */
    let G = scene(A, { xs: [0, 88, 176], perks: P });
    let r = cut(A, rng, G, G.nodes[0].enemies[0], D, q);
    chk('뒤에 둘이면 가까운 쪽만 맞는다', r.lost[1] === D && r.lost[2] === 0, `[${r.lost}]`);
    /* ⚑ S2 를 잡는 자리 — 앞 적은 안 맞는다 */
    G = scene(A, { xs: [0, -88], perks: P });
    r = cut(A, rng, G, G.nodes[0].enemies[0], D, q);
    chk('⚑ 앞(worldX 가 작은) 적만 있으면 아무도 안 맞는다', r.lost[1] === 0 && r.rolls === 0, `[${r.lost}] 굴림 ${r.rolls}`);
    G = scene(A, { xs: [0, -10, 200], perks: P });
    r = cut(A, rng, G, G.nodes[0].enemies[0], D, q);
    chk('⚑ 앞 적이 훨씬 가까워도 «뒤» 적이 맞는다 (거리가 아니라 방향이 먼저)',
      r.lost[1] === 0 && r.lost[2] === D, `[${r.lost}]`);
    /* 죽은 적은 «살아 있는 적» 이 아니다 */
    G = scene(A, { xs: [0, 88, 176], perks: P });
    G.nodes[0].enemies[1].hp = 0;
    r = cut(A, rng, G, G.nodes[0].enemies[0], D, q);
    chk('죽은 적은 건너뛰고 그 다음 적이 맞는다', r.lost[2] === D, `[${r.lost}]`);
    /* 뒤가 아예 없으면 굴리지 않는다 */
    G = scene(A, { xs: [0], perks: P });
    r = cut(A, rng, G, G.nodes[0].enemies[0], D, q);
    chk('뒤에 아무도 없으면 굴리지 않는다 (난수 0회)', r.rolls === 0, `굴림 ${r.rolls}`);
  }

  /* ===== ⓔ 같은 웨이브만 ===== */
  say('\n=== ⓔ 같은 웨이브 안에서만 — 다음 웨이브 대기분으로 안 번진다 ===');
  {
    const D = 100, P = ['p_cleaveL'], q = [HIT, NOEV];
    /* ⚑ S3 를 잡는 자리 — 다른 웨이브에 «더 가까운» 뒤 적을 둔다 */
    let G = scene(A, { xs: [0, 500], xs2: [44], perks: P });
    let r = cut(A, rng, G, G.nodes[0].enemies[0], D, q);
    chk('⚑ 다른 웨이브의 더 가까운 적이 있어도 같은 웨이브의 먼 적이 맞는다',
      r.lost[1] === D && r.lost[2] === 0, `[${r.lost}] (웨이브2 가 맞으면 S3)`);
    G = scene(A, { xs: [0], xs2: [88], perks: P });
    r = cut(A, rng, G, G.nodes[0].enemies[0], D, q);
    chk('⚑ 같은 웨이브에 뒤가 없으면 아무도 안 맞는다 (다음 웨이브에 있어도)',
      r.lost[1] === 0 && r.rolls === 0, `[${r.lost}] 굴림 ${r.rolls}`);
  }

  /* ===== ⓕ 데미지 = 그 평타가 타겟에게 준 값 «그대로» ===== */
  say('\n=== ⓕ 데미지는 타겟이 받은 값 그대로 (치명타면 치명 값 · 주인 17:4X) ===');
  {
    /* ⚑ S6 를 잡는 자리 — 임의의 값을 그대로 통과시킨다 */
    for (const D of [777, 1, 123456.75]) {
      const G = scene(A, { xs: [0, 88], perks: ['p_cleaveL'] });
      const r = cut(A, rng, G, G.nodes[0].enemies[0], D, [HIT, NOEV]);
      chk(`cleave(dmg=${D}) → 뒤 적이 정확히 ${D} 잃는다 (배수·재굴림 없음)`,
        r.lost[1] === D, `손실 ${r.lost[1]}`);
    }
    /* `dealDmg` 경유 — 치명타를 강제해 «치명 값 그대로» 를 본다.
       dealDmg 의 난수 = [치명 굴림, 적 회피, 데미지 흔들림 rand] … 그 뒤에 cleave 대본이 이어진다. */
    const G = scene(A, { xs: [0, 88], perks: ['p_cleaveL'], hp: 1e12 });
    const p = G.player; p.nextCrit = true;              /* 다음 평타는 치명타 확정 */
    const tgt = G.nodes[0].enemies[0], back = G.nodes[0].enemies[1];
    rng.q = [0, NOEV, 0.5, /* cleave: */ HIT, NOEV]; rng.n = 0; rng.dflt = 0.5;
    const h0 = tgt.hp, b0 = back.hp;
    const crit = A.dealDmg(G, tgt, 1, true);
    const dT = h0 - tgt.hp, dB = b0 - back.hp;
    chk('⚑ dealDmg(치명타 강제) → 뒤 적 손실 = 타겟 손실 (치명 값 그대로)',
      crit === true && dT > 0 && dB === dT, `치명 ${crit} · 타겟 ${dT} · 뒤 ${dB}`);
    /* dmg<=0 이면 발동 자체가 없다 */
    const G2 = scene(A, { xs: [0, 88], perks: ['p_cleaveL'] });
    const r2 = cut(A, rng, G2, G2.nodes[0].enemies[0], 0, [HIT, NOEV]);
    chk('dmg 가 0 이면 굴리지도 않는다', r2.rolls === 0 && r2.lost[1] === 0, `굴림 ${r2.rolls}`);
  }

  /* ===== ⓖ 뒤 적의 회피 10% 는 «따로» 굴린다 ===== */
  say(`\n=== ⓖ 뒤 적 회피 ${FZ.evade * 100}% 는 따로 굴린다 (주인 17:4X) ===`);
  {
    const D = 100;
    chk(`sim.js ENEMY_EVADE = ${FZ.evade}`, A.ENEMY_EVADE === FZ.evade, String(A.ENEMY_EVADE));
    let G = scene(A, { xs: [0, 88], perks: ['p_cleaveL'] });
    let r = cut(A, rng, G, G.nodes[0].enemies[0], D, [HIT, 0.05]);   /* 0.05 < 0.10 = 회피 */
    chk('⚑ 뒤 적이 회피하면 hp 불변 · miss +1 · atkTries +1',
      r.lost[1] === 0 && r.miss === 1 && r.tries === 1, `손실 ${r.lost[1]} · miss ${r.miss} · tries ${r.tries}`);
    G = scene(A, { xs: [0, 88], perks: ['p_cleaveL'] });
    r = cut(A, rng, G, G.nodes[0].enemies[0], D, [HIT, FZ.evade]);   /* 0.10 은 «미만» 이 아니다 */
    chk(`회피 경계 — 난수 ${FZ.evade} 은 회피가 아니다 (맞는다)`, r.lost[1] === D, `손실 ${r.lost[1]}`);
    /* 셋 중 하나만 회피 */
    G = scene(A, { xs: [0, 88], perks: CL3 });
    r = cut(A, rng, G, G.nodes[0].enemies[0], D, [HIT, NOEV, HIT, 0.05, HIT, NOEV]);
    chk('셋 중 가운데 발동만 회피 → 2번분만 들어간다 (발동마다 따로 굴린다)',
      r.lost[1] === D * 2 && r.miss === 1 && r.tries === 3, `손실 ${r.lost[1]} · miss ${r.miss} · tries ${r.tries}`);
  }

  /* ===== ⓗ 뒤 적 처치도 «처치» 판정 ===== */
  say('\n=== ⓗ 뒤 적 처치도 «처치» 판정 (주인 17:4X) ===');
  {
    let G = scene(A, { xs: [0, 88], perks: ['p_cleaveL'], hp: 50 });
    const gold0 = G.gold;
    let r = cut(A, rng, G, G.nodes[0].enemies[0], 100, [HIT, NOEV]);
    chk('⚑ 뒤 적을 죽이면 kills +1 (onKill 을 탄다)', r.kills === 1, `kills ${r.kills}`);
    chk('처치 보상(골드)도 들어온다', G.gold > gold0, `${gold0} → ${G.gold}`);
    chk('죽은 적에 dead 표시가 선다', G.nodes[0].enemies[1].dead === true);
    /* 처치 트리거가 실제로 도는지 — 「처치 시 33% 확률로 최대 체력 6% 회복」 특전을 얹어 본다.
       cleave 대본 뒤의 굴림(골드 흔들림·트리거 확률)은 기본값 0 = 전부 성공으로 채운다. */
    G = scene(A, { xs: [0, 88], perks: ['p_cleaveL', 'p_killHealN'], hp: 50 });
    G.player.hp = G.player.maxHp * 0.5;
    const hp0 = G.player.hp;
    cut(A, rng, G, G.nodes[0].enemies[0], 100, [HIT, NOEV], 0);
    chk('⚑ 처치 트리거가 실제로 발동한다 (처치 시 회복 특전으로 확인)',
      G.player.hp > hp0, `hp ${hp0} → ${G.player.hp}`);
    /* 한 적은 한 번만 죽는다 — 셋 다 터져도 onKill 은 한 번 */
    G = scene(A, { xs: [0, 88], perks: CL3, hp: 100 });
    r = cut(A, rng, G, G.nodes[0].enemies[0], 100, [HIT, NOEV, HIT, NOEV, HIT, NOEV]);
    chk('⚑ 첫 발동이 죽이면 남은 발동은 건너뛴다 (hp 가 음수로 안 내려간다)',
      G.nodes[0].enemies[1].hp === 0, `hp ${G.nodes[0].enemies[1].hp}`);
    chk('한 적은 한 번만 죽는다 (kills = 1)', r.kills === 1, `kills ${r.kills}`);
    /* 죽은 뒤의 두 발동은 «공격 시도» 자체를 안 한다 — 회피도 안 굴린다(= atkTries 가 안 는다).
       (난수 총량은 onKill 의 골드 흔들림까지 섞이므로 여기서는 시도 수로 잰다) */
    chk('죽은 뒤의 발동은 공격 시도조차 안 한다 (atkTries = 1)',
      r.tries === 1 && r.miss === 0, `tries ${r.tries} · miss ${r.miss}`);
  }

  /* ===== ⓘ 뒤의 뒤로 안 번진다 ===== */
  say('\n=== ⓘ 각 발동은 뒤 적 1마리에게 1회씩 — «뒤의 뒤» 로 안 번진다 (주인 17:4X) ===');
  {
    const G = scene(A, { xs: [0, 88, 176, 264], perks: CL3 });
    const r = cut(A, rng, G, G.nodes[0].enemies[0], 100, [HIT, NOEV, HIT, NOEV, HIT, NOEV]);
    chk('⚑ 4마리 일렬 · 셋 다 터져도 손실은 «바로 뒤» 한 마리에만 몰린다',
      r.lost[1] === 300 && r.lost[2] === 0 && r.lost[3] === 0, `[${r.lost}]`);
    chk('굴림도 3쌍(6회)에서 멈춘다 (번지면 더 굴린다)', r.rolls === 6, `${r.rolls}회`);
  }

  /* ===== ⓙ 평타에만 ===== */
  say('\n=== ⓙ 평타에만 걸린다 — 소환·반격 적중은 대상이 아니다 (주인 17:4X) ===');
  {
    const mk = () => {
      const G = scene(A, { xs: [0, 88], perks: ['p_cleaveL'], hp: 1e12 });
      return [G, G.nodes[0].enemies[0], G.nodes[0].enemies[1]];
    };
    let [G, tgt, back] = mk();
    rng.q = [0.99, NOEV, 0.5]; rng.n = 0; rng.dflt = 0.5;
    let b0 = back.hp; A.dealDmg(G, tgt, 1, false);
    chk('⚑ dealDmg(fromBasic=false) → 뒤 적은 안 맞는다', back.hp === b0, `손실 ${b0 - back.hp}`);
    [G, tgt, back] = mk();
    rng.q = [0.99, NOEV, 0.5, HIT, NOEV]; rng.n = 0; rng.dflt = 0.5;
    b0 = back.hp; A.dealDmg(G, tgt, 1, true);
    chk('dealDmg(fromBasic=true) → 뒤 적이 맞는다 (같은 무대에서 갈린다)', back.hp < b0, `손실 ${b0 - back.hp}`);
    /* 두 엔진 호출부가 평타 분기 «안» 이다 */
    chk('sim.js 호출부 = `if(fromBasic)cleave(G,e,d);`', /if\(fromBasic\)cleave\(G,e,d\);/.test(simSrc));
    chk('index.html 호출부 = `if(basic) cleave(e,d);`', /if\(basic\) ?cleave\(e,d\);/.test(htmSrc));
    /* 정의부(`function cleave(`)를 뺀 «부르는 곳» 이 하나뿐이어야 한다 —
       둘째 호출부가 생기면 평타 가드를 우회하는 길이 열린 것이다. */
    const nCall = s => (s.match(/(?<!function )\bcleave\(/g) || []).length;
    chk('sim.js 에서 cleave 를 부르는 곳은 한 군데뿐 (평타 분기)', nCall(simSrc) === 1, `${nCall(simSrc)}곳`);
    chk('index.html 에서 cleave 를 부르는 곳은 한 군데뿐 (평타 분기)', nCall(htmSrc) === 1, `${nCall(htmSrc)}곳`);
  }

  /* ===== ⓚ 두 엔진 구조 1:1 ===== */
  say('\n=== ⓚ 두 엔진 `cleave` 본문 구조 대조 ===');
  {
    const bS = fnBody(simSrc, 'function cleave(G,tgt,dmg){');
    const bH = fnBody(htmSrc, 'function cleave(tgt,dmg){');
    chk('sim.js `cleave` 본문을 찾았다', bS.length > 0);
    chk('index.html `cleave` 본문을 찾았다', bH.length > 0);
    for (const [nm, re] of STRUCT) {
      chk(`sim.js: ${nm}`, re.test(bS.replace(/[ \t]+/g, ' ')));
      chk(`index.html: ${nm}`, re.test(bH.replace(/[ \t]+/g, ' ')));
    }
  }

  return finish(say, quiet);
}

function finish(say, quiet) {
  const bad = R.filter(x => !x.c).length;
  if (!quiet) {
    if (bad) { console.log('\n[불합격 목록]'); for (const x of R) if (!x.c) console.log(`  ✗ ${x.name}${x.d ? ' — ' + x.d : ''}`); }
    console.log(`\n통과 ${R.length - bad} · 불합격 ${bad}`);
    console.log(bad ? '→ 불합격' : '→ 통과');
  }
  return bad;
}

/* ================================================================ */
const simSrc = rd('sim.js');
const htmSrc = rd('index.html');
const routineSrc = rd('docs/ROUTINE.md');

if (process.argv.includes('--self')) {
  console.log('⚑ 음성 검사 — 심은 고장이 실제로 빨개지는가 (죽은 검사 색출)');
  const R3S = '  if(px.p_cleaveN&&pkk(p,PERK_CLEAVE_N))hit();\n' +
              '  if(px.p_cleaveR&&pkk(p,PERK_CLEAVE_R))hit();\n' +
              '  if(px.p_cleaveL&&pkk(p,PERK_CLEAVE_L))hit();';
  const R3H = '  if(px.p_cleaveN&&pkk(p,PERK_CLEAVE_N)) hit();\n' +
              '  if(px.p_cleaveR&&pkk(p,PERK_CLEAVE_R)) hit();\n' +
              '  if(px.p_cleaveL&&pkk(p,PERK_CLEAVE_L)) hit();';
  const ONE = '  const ch=Math.max(px.p_cleaveN?PERK_CLEAVE_N:0,px.p_cleaveR?PERK_CLEAVE_R:0,' +
              'px.p_cleaveL?PERK_CLEAVE_L:0);\n  if(pkk(p,ch))hit();';
  /* [이름, sim.js 개조, index.html 개조] — 둘 중 하나만 바꾸면 나머지는 원본 그대로 */
  const cases = [
    ['S1 셋을 «한 번만» 굴리면 (sim — 주인 «최대 3번» 이 죽는다)',
      s => s.replace(R3S, ONE), null],
    ['S1 셋을 «한 번만» 굴리면 (게임)',
      null, s => s.replace(R3H, ONE)],
    ['S2 «바로 뒤» 방향 필터를 지우면 (sim — 앞 적도 맞는다)',
      s => s.replace(/\n    if\(e\.worldX<=tgt\.worldX\)continue;[^\n]*/, ''), null],
    ['S2 «바로 뒤» 방향 필터를 지우면 (게임)',
      null, s => s.replace(/\n    if\(e\.worldX<=tgt\.worldX\) continue;[^\n]*/, '')],
    ['S3 같은 웨이브 필터를 지우면 (sim — 다음 웨이브 대기분으로 번진다)',
      s => s.replace('if(e===tgt||e.wave!==tgt.wave)continue;', 'if(e===tgt)continue;'), null],
    ['S3 같은 웨이브 필터를 지우면 (게임)',
      null, s => s.replace('if(e===tgt||e.wave!==tgt.wave) continue;', 'if(e===tgt) continue;')],
    ['S6 데미지를 «그대로» 가 아니라 반으로 주면 (sim)',
      s => s.replace('    back.hp-=dmg;\n', '    back.hp-=dmg*0.5;\n'), null],
    ['S5 뒤 적의 회피를 안 굴리면 (sim — 주인 «따로 굴림» 이 죽는다)',
      s => s.replace(/\n    if\(Math\.random\(\)<ENEMY_EVADE\)\{G\.miss\+\+;procOnMiss\(G,back\);return;\}/, ''), null],
    ['S7 뒤 적 처치가 «처치» 판정을 안 타면 (sim)',
      s => s.replace('    if(back.hp<=0)onKill(G,back,-back.hp);\n', ''), null],
    ['S4 평타 전용 가드를 풀면 (sim — 소환·반격 적중에도 걸린다)',
      s => s.replace('  if(fromBasic)cleave(G,e,d);', '  cleave(G,e,d);'), null],
    ['S8 «이미 죽었으면 건너뜀» 을 지우면 (sim — 한 적이 두 번 죽는다)',
      s => s.replace('    if(back.hp<=0)return;\n', ''), null],
    ['S9 확률을 33/66 이 아니라 50/50 으로 바꾸면 (sim)',
      s => s.replace('PERK_CLEAVE_N=0.33, PERK_CLEAVE_R=0.66', 'PERK_CLEAVE_N=0.50, PERK_CLEAVE_R=0.50'), null],
    ['S10 뒤 적 후보를 «가장 먼» 쪽으로 바꾸면 (sim)',
      s => s.replace('if(!back||e.worldX<back.worldX)back=e;', 'if(!back||e.worldX>back.worldX)back=e;'), null],
    ['ROUTINE 에서 주인 «최대 3번» 절을 지우면', null, null],
  ];
  let caught = 0, noopN = 0;
  const real = console.log;
  for (const [nm, fsim, fhtm] of cases) {
    const mS = fsim ? fsim(simSrc) : simSrc;
    const mH = fhtm ? fhtm(htmSrc) : htmSrc;
    const mR = (!fsim && !fhtm) ? routineSrc.replace(RULE_TRIPLE, '(지워짐)') : routineSrc;
    const noop = (fsim && mS === simSrc) || (fhtm && mH === htmSrc) || (!fsim && !fhtm && mR === routineSrc);
    let bad = 0;
    if (!noop) { try { bad = run(mS, mH, mR, true); } catch (e) { bad = 1; } } else noopN++;
    const ok = !noop && bad > 0;
    if (ok) caught++;
    real(`  ${ok ? '✓' : '✗'} ${nm} → ${ok ? `빨개진다 (${bad}건)`
      : noop ? '🔴 돌연변이가 원본을 안 바꾼다 (문자열이 낡았다 = 죽은 검사)' : '🔴 안 잡힌다 (죽은 검사)'}`);
  }
  let base = 0; try { base = run(simSrc, htmSrc, routineSrc, true); } catch (e) { base = 1; }
  real(`  ${base === 0 ? '✓' : '✗'} 양성 대조군: 원본이 통과한다 (오탐 ${base}건)`);
  real(`\n[음성 검사] ${caught}/${cases.length} · no-op ${noopN} · 오탐 ${base}`);
  process.exit(caught === cases.length && noopN === 0 && base === 0 ? 0 : 1);
}

console.log('⚑⚑⚑ T142 게이트 — 관통 베기 I/II/III 의 발동 규칙 (주인 확정 T121 2차 · 17:4X)');
process.exit(run(simSrc, htmSrc, routineSrc) ? 1 : 0);
