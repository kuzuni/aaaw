#!/usr/bin/env node
/* ================================================================================
   verifyHitOrder — ⚑⚑⚑ T139 (워커 D · sess-0650-13410)

   **주인 확정 T121 3차 (2026-09-04 18:2X · ROUTINE 최상단 ⑤ · PLAN §3.2 `gainWard`) 의 한 줄**
     · «판정 순서 **회피 → 방어막 → 피해 무시 → 피해**»
     · «방어막으로 막은 공격은 «피격» 이 아니다(트리거·가시갑옷 없음)»
     · «피해 무시 — 회피 판정 «뒤»·방어막 «뒤» 에 굴린다 · 무시된 공격은 «피격» 이 아니다»

   ── 구멍을 먼저 증명했다 (T139 사본 실측) ──
   이 순서에 닿는 자는 하나뿐인데 **순서를 안 본다**. `verifyPerkOrder` 의 «판정 순서 = 회피 →
   방어막 → 피해 무시 → 피해» 묶음은 토큰 네 개를 나열해 두고 `n.includes(t)` 로 **있는지만** 본다
   (같은 파일의 `WIRE` 루프) — 네 층을 어떤 순서로 늘어놓아도 전부 초록이다.
   이웃 게이트도 마찬가지다: `verifyCombatConst` 의 방어막 실측은 «피해 무시» 특전을 안 준 채
   때리므로 두 층의 앞뒤를 못 가르고, `verifyT2` ⑯ 의 두 정규식은 `[\s\S]{0,200}` 로 **거리**만 볼 뿐
   `ign1` 선언과의 앞뒤를 안 본다.

   실제로 사본을 만들어 확인했다 — **방어막 분기를 `if(ign1||ign2)return;` 「뒤」로 한 칸 옮기면**
   (= 순서가 «회피 → 피해 무시 → 방어막» 이 된다) **두 엔진에 심어도 정적 게이트 25종의 통과 수가
   하나도 안 움직였고**(24 초록 · 🔴 `verifyScoreCriteria` 56/8 그대로) **T3 4스위트 290/290 도
   전부 초록이었다.** 그런데 게임은 달라진다 — «피해 무시»(20%)·«실드 방벽»(50%)이 먼저 굴러
   성공하면 방어막이 **안 깎인 채** 살아남으므로, 방어막 한 장이 막아 주는 타격 수가
   1장당 1회에서 1/(1−0.20) = **1.25회**(실드 방벽까지 있으면 1/(1−0.6) = **2.5회**)로 늘어난다.
   주인이 순서를 «확정» 이라고 못박은 자리가 조용히 유리한 쪽으로 뒤집혀도 아무도 못 잡는 상태였다.

   ── 그래서 이 게이트가 하는 일 ──
   문면 나열이 아니라 **① 네 층의 위치를 실제로 비교하고 ② 엔진을 굴려 순서를 잰다.**
   순서를 재는 열쇠는 **굴림 횟수**다 — `hitPlayer` 는 회피에서 1번, ign1 에서(특전이 있을 때만) 1번,
   ign2 에서(실드가 있고 특전이 있을 때만) 1번 굴린다. 방어막은 확률이 아니라 **장수 소모**라 굴림이 0번이다.
   따라서 «방어막 1장 + 피해 무시 특전» 을 들고 한 대 맞을 때
     · 주인 순서면 → 방어막이 먼저 막고 끝나므로 굴림은 **회피 1번뿐**이고 방어막이 **깎인다**
     · 순서가 뒤집히면 → 무시를 먼저 굴리므로 굴림이 **2번**이고 방어막이 **안 깎인다**
   이 두 숫자가 층의 앞뒤를 한 치도 없이 가른다.

   ⓐ 정적 층 위치 — 회피 < 방어막 < ign1 < ign2 < `if(ign1||ign2)` < 피해 계산 < 피격 트리거·가시갑옷 (두 엔진)
   ⓑ sim.js 실측 (순서) — 회피 > 방어막 · 방어막 > 피해 무시 · 방어막 > 실드 방벽 · 무시 > 피해
   ⓒ sim.js 실측 (조기 종료 · «피격» 아님) — 막힌·무시된·회피된 타격은 피격 트리거·가시갑옷·방어막 획득 0
   ⓓ ign1·ign2 를 각각 따로 굴린다 · 실드 방벽은 실드가 0 이면 굴리지 않는다
   ⓔ 두 엔진 1:1 — 네 층의 상대 순서와 문면이 `sim.js` ↔ `index.html` 에서 같다
   ⓕ 주인 문면 — ROUTINE 세 절 · PLAN §3.2 의 «회피 → 방어막 → 피해 무시 → 피해»

   ── 이 상수를 고쳐도 되는 때 ──
   **주인이 판정 순서를 새로 확정했을 때뿐이다.** 그때 ORDER 를 갱신하고 PROGRESS 에 주인 원문과
   함께 남긴다 — 순서를 고치는 것 자체가 diff 에 드러나는 것이 요점이다.

   사용: node tools/verifyHitOrder.js        (exit 0 = 통과, 1 = 불합격)
   음성: node tools/verifyHitOrder.js --self (심은 고장 11종 + 양성 대조군)
   ================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ── 주인 확정값 동결 (T121 3차 18:2X) ─────────────────────────────────────────── */
const FZ = {
  ign: 0.20,      /* 피해 무시 — 일반 20% */
  shWall: 0.50,   /* 실드 방벽 — 실드 > 0 일 때 50% */
  wardN: 0.10,    /* 피격 시 방어막 I — 10% */
};

/* 주인 순서 — 이 배열이 이 게이트의 동결 그 자체다 */
const ORDER = ['회피', '방어막', '피해 무시', '피해'];

/* 각 층을 소스에서 찾는 표식 (두 엔진 공통 문면) */
const MARK = {
  evade: 'if(Math.random()*100<effEvade(p)){',
  ward: 'if(p.ward>0){',
  ign1: 'const ign1=px.p_ignoreN&&pkk(p,PERK_IGN_N);',
  ign2: 'const ign2=p.sh>0&&px.p_shWallL&&pkk(p,PERK_SHWALL_L);',
  ignRet: 'if(ign1||ign2)',
  hadSh: 'const hadSh=p.sh>0;',
  dmg: 'let d=dmg*(1-effDef(p)/100);',
  trig: 'if(px.defHitBuff)',
  thorn: 'const thornM=px.p_thorns+(hadSh?px.g_thornSh:0);',
};

/* 주인 문면 */
const RULE_ORDER = /판정 순서 \*\*회피 → 방어막 → 피해 무시 → 피해\*\*/;
const RULE_WARDHIT = /방어막으로 막은 공격은 «피격» 아님/;
const RULE_IGNPOS = /회피 판정 «뒤»·방어막 «뒤» 에 굴림/;
const PLAN_ORDER = /`hitPlayer` 는 \*\*회피 → 방어막 → 피해 무시 → 피해\*\* 로 본다/;

/* ================================================================
   sim.js 를 CLI 디스패처 앞까지만 vm 에 올린다 (`verifyKillTrigger` 와 같은 수법).
   `Math` 를 샌드박스에 직접 넣어 **난수 스트림을 통제·계수**한다.
   ================================================================ */
const CUT = "const mode=process.argv[2]||'all';";
function loadSim(src, rng) {
  const at = src.indexOf(CUT);
  if (at < 0) return null;
  const M = Object.create(Math);
  M.random = () => { const v = rng.q.length > rng.n ? rng.q[rng.n] : rng.dflt; rng.n++; return v; };
  const ctx = {
    console: { log() {} }, process, Math: M, JSON, Number, String, Array,
    Set, Map, Object, Date, parseInt, parseFloat, isFinite, isNaN, require,
  };
  vm.createContext(ctx);
  try {
    vm.runInContext(src.slice(0, at) +
      '\n;globalThis.__H={PERKS,basePx,hitPlayer,effEvade,effDef,' +
      'PERK_IGN_N,PERK_SHWALL_L,PERK_WARD_N,PERK_SHREF_L};', ctx);
  } catch (e) { return null; }
  return ctx.__H || null;
}

/* 통제된 한 대 — 특전 `ids` 만 가진 맨몸 플레이어에게 `hitPlayer` 를 정확히 한 번 부른다.
   회피율은 90(엔진 상한)으로 고정해 **첫 굴림 값 하나로** 회피 성공·실패를 정한다:
   `rand*100 < 90` 이므로 0.10 이면 회피, 0.95 면 피격. */
function shot(H, o) {
  const p = {
    worldX: 0, dmg: 100, aspd: 1, critR: 0, critF: 150, def: 0, counter: 0, evade: 90, steal: 0,
    killHeal: 0, misfire: 0, goldMul: 1, walkMul: 1, healAmp: 0, repairAmp: 0, nextCrit: false,
    nextAtk: 0, ward: o.ward || 0, maxHp: 1e6, hp: 1e6, maxSh: 1e6, sh: 0, level: 1, exp: 0,
    critStk: 0, nhit: {}, collHpF: 1, atkTimer: 1, sureCrit: false, bsStk: 0, dash: false,
    buffs: { atk: [], aspd: [], critR: [], critF: [], def: [], evade: [] }, px: H.basePx(),
  };
  const nd = { type: 'wave', x: 0, done: false, enemies: [] };
  const src = { worldX: 120, hp: 1e12, maxHp: 1e12, dmg: 1, ranged: false, atkTimer: 1,
    stun: 0, slow: 0, wave: nd, dead: false, isBoss: false, exp: 0 };
  nd.enemies.push(src);
  const G = { chapter: 1, player: p, nodes: [nd], pprojs: [], projs: [], arrows: [], gold: 0,
    kills: 0, procN: 0, perkChances: 0, taken: [], overBoltCd: 0, autoBoltT: 3, autoSumT: 2,
    rampT: 3, stuns: 0, misses: 0, dead: false, cleared: true, t: 0, atkTries: 0, miss: 0, noPerk: true };
  p.G = G;
  for (const id of (o.perks || [])) {
    const k = H.PERKS.find(x => x.id === id);
    if (!k) return null;
    k.ap(p); G.taken.push(k);
  }
  if (o.sh !== undefined) p.sh = o.sh;
  if (o.hp !== undefined) p.hp = o.hp;
  p.evade = 90;                                     /* 특전이 회피를 올려도 상한이라 값이 같다 */
  const hp0 = p.hp, sh0 = p.sh, ward0 = p.ward;
  rng.n = 0; rng.q = o.q || []; rng.dflt = o.dflt === undefined ? 0.999 : o.dflt;
  H.hitPlayer(G, o.dmg === undefined ? 1000 : o.dmg, o.melee !== false, src);
  return {
    rolls: rng.n,                                   /* 이 한 대가 굴린 `Math.random` 횟수 */
    ward: p.ward, dWard: p.ward - ward0,
    hp: p.hp, dHp: hp0 - p.hp, sh: p.sh, dSh: sh0 - p.sh,
    refl: 1e12 - src.hp,                            /* 적이 가시갑옷·반사로 잃은 체력 */
    defBuffs: p.buffs.def.length,                   /* 피격 시 방어 버프 = «피격» 트리거가 굴었다는 증거 */
    dead: G.dead,
  };
}

/* 함수 본문만 잘라 온다 — `hitPlayer` 의 시작부터 «다음 최상위 function» 까지.
   **주석은 지운다** — 주석에 «return» 이나 표식 문자열이 들어 있어 위치 비교가 흔들리지 않게. */
function hitBody(src) {
  const sig = src.indexOf('function hitPlayer(');
  if (sig < 0) return '';
  const nx = src.indexOf('\nfunction ', sig + 10);
  return src.slice(sig, nx < 0 ? src.length : nx).replace(/\/\*[\s\S]*?\*\//g, '');
}
const norm = s => s.replace(/\s+/g, '');

/* ================================================================ */
const rng = { n: 0, q: [], dflt: 0.999 };
const R = [];
let QUIET = true;
const chk = (name, pass, detail) => {
  const x = { name, c: !!pass, d: detail == null ? '' : String(detail) };
  R.push(x);
  if (!QUIET) console.log(`  ${x.c ? '✓' : '✗'} ${x.name}${x.c ? '' : '  — ' + x.d}`);
};

function run(simSrc, htmSrc, routineSrc, planSrc, quiet) {
  R.length = 0; QUIET = !!quiet;
  const say = quiet ? () => {} : console.log;

  /* ================================================================
     ⓐ 정적 층 위치 — 두 엔진의 `hitPlayer` 본문에서 표식의 **인덱스**를 비교한다.
     `includes` 가 아니라 `indexOf` 를 쓰는 것이 이 절의 전부다.
     ================================================================ */
  say('\n=== ⓐ 정적 층 위치 «회피 < 방어막 < 피해 무시 < 피해» (두 엔진) ===');
  const engines = [['sim.js', simSrc], ['index.html', htmSrc]];
  const IDX = {};
  for (const [nm, src] of engines) {
    const body = norm(hitBody(src));
    const at = {};
    let allFound = true;
    for (const k of Object.keys(MARK)) {
      at[k] = body.indexOf(norm(MARK[k]));
      if (at[k] < 0) allFound = false;
    }
    IDX[nm] = at;
    chk(`${nm} hitPlayer 에 아홉 표식이 전부 있다`, allFound,
      Object.keys(MARK).filter(k => at[k] < 0).join(' · ') || '9/9');
    if (!allFound) continue;
    const lt = (a, b, why) => chk(`${nm} — ${why}`, at[a] >= 0 && at[b] >= 0 && at[a] < at[b],
      `${a}@${at[a]} ↔ ${b}@${at[b]}`);
    lt('evade', 'ward', '① 회피 판정이 방어막보다 «앞»');
    lt('ward', 'ign1', '② 방어막이 피해 무시(ign1)보다 «앞»  ← 주인 확정 순서의 핵심');
    lt('ward', 'ign2', '② 방어막이 실드 방벽(ign2)보다 «앞»');
    lt('ign1', 'ign2', '③ ign1·ign2 가 선언 순서대로 (둘 다 조기 종료 앞)');
    lt('ign2', 'ignRet', '③ 두 굴림이 끝난 뒤에 조기 종료를 본다');
    lt('ignRet', 'dmg', '④ 피해 무시 종료가 피해 계산보다 «앞»');
    lt('ward', 'dmg', '④ 방어막이 피해 계산보다 «앞»');
    lt('ignRet', 'hadSh', '⑤ 무시된 타격은 실드 반사 조건(hadSh)에도 안 닿는다');
    lt('dmg', 'trig', '⑥ 피격 트리거가 세 방어층 «뒤»');
    lt('dmg', 'thorn', '⑥ 가시갑옷이 세 방어층 «뒤»');
    /* 회피 분기는 `return;` 으로 끝나야 아래 층에 안 닿는다 */
    const evSeg = body.slice(at.evade, at.ward);
    chk(`${nm} — ⑦ 회피 분기가 return 으로 끝난다 (회피한 타격은 아래 층에 안 닿는다)`,
      /return;\}$/.test(evSeg) || /return;\}\s*$/.test(evSeg), evSeg.slice(-24));
  }
  /* 두 엔진의 층 순서가 서로 같다 */
  {
    const keys = ['evade', 'ward', 'ign1', 'ign2', 'ignRet', 'hadSh', 'dmg', 'trig', 'thorn'];
    const seq = nm => keys.slice().sort((a, b) => IDX[nm][a] - IDX[nm][b]).join('<');
    chk('두 엔진의 층 순서가 글자 그대로 같다 (sim.js ↔ index.html)',
      seq('sim.js') === seq('index.html'), `${seq('sim.js')}  ↔  ${seq('index.html')}`);
    chk('그 순서가 주인 확정 순서다 (회피 < 방어막 < 무시 < 피해 < 트리거)',
      seq('sim.js') === 'evade<ward<ign1<ign2<ignRet<hadSh<dmg<trig<thorn', seq('sim.js'));
  }

  const H = loadSim(simSrc, rng);
  chk('sim.js 엔진 로드 (hitPlayer·basePx·PERKS)', !!H, 'CLI 디스패처 앞까지 잘라 vm 에 올린다');
  if (!H) return finish();

  /* 동결 상수가 엔진과 같은가 — 아래 실측의 기대값이 이 셋에서 나온다 */
  chk(`피해 무시 확률 = ${FZ.ign}`, H.PERK_IGN_N === FZ.ign, H.PERK_IGN_N);
  chk(`실드 방벽 확률 = ${FZ.shWall}`, H.PERK_SHWALL_L === FZ.shWall, H.PERK_SHWALL_L);
  chk(`피격 시 방어막 I 확률 = ${FZ.wardN}`, H.PERK_WARD_N === FZ.wardN, H.PERK_WARD_N);

  /* 굴림 값 — 첫 칸이 회피, 그 뒤가 ign1·ign2 순서다 */
  const EV = 0.10, HIT = 0.95;          /* 회피율 90 기준: 10 < 90 회피 · 95 < 90 아님 = 피격 */
  const YES = 0.0, NO = 0.999;          /* pkk 성공 · 실패 */

  /* 꼬리 굴림 — 피해가 «끝까지 흐른» 근접 피격은 함수 끝의 반격 판정(`Math.random()*100<effCounter(p)`)을
     특전과 무관하게 한 번 굴린다. 방어 세 층에서 끊긴 타격에는 이 굴림이 없다.
     그래서 **꼬리 굴림의 유무 자체가 «층이 끝까지 흘렀는가» 의 증거**다 — 값을 박지 않고 여기서 잰다. */
  const TAIL = shot(H, { ward: 0, q: [HIT] }).rolls - 1;
  chk('맨몸 근접 피격이 끝까지 흐르면 꼬리 굴림(반격 판정)이 붙는다',
    TAIL === 1, `꼬리 ${TAIL}회 (기대 1 — 이 값이 아래 굴림 수의 기준이다)`);

  /* ================================================================
     ⓑ 실측 — 층의 앞뒤를 «굴림 횟수 + 방어막 소모» 로 가른다
     ================================================================ */
  say('\n=== ⓑ sim.js 실측 — 층의 앞뒤 (굴림 횟수가 순서를 가른다) ===');
  {
    /* ① 회피 > 방어막 — 피할 수 있었던 타격은 방어막을 깎지 않는다 */
    const a = shot(H, { ward: 3, q: [EV] });
    chk('① 회피에 성공하면 방어막이 안 깎인다 (회피가 «앞»)', a.ward === 3, `남은 장수 ${a.ward} (기대 3)`);
    chk('① 회피한 타격은 굴림이 회피 1번뿐이다 (아래 층에 안 닿는다)', a.rolls === 1, `굴림 ${a.rolls}회`);
    chk('① 회피한 타격은 체력·실드가 안 준다', a.dHp === 0 && a.dSh === 0, `체력 −${a.dHp} · 실드 −${a.dSh}`);

    /* ② 방어막 > 피해 무시 — 이 게이트의 핵심 두 줄 */
    const b = shot(H, { ward: 1, perks: ['p_ignoreN'], q: [HIT, YES] });
    chk('② ⚑ 방어막 1장 + 피해 무시(성공 굴림 대기) → **방어막이 먼저 깎인다**',
      b.ward === 0, `남은 장수 ${b.ward} (기대 0 — 1 이면 무시가 먼저 굴러 방어막을 아꼈다)`);
    chk('② ⚑ 그 타격의 굴림은 회피 1번뿐이다 (무시는 **굴리지도 않는다**)',
      b.rolls === 1, `굴림 ${b.rolls}회 (기대 1 — 2 면 순서가 뒤집혔다)`);
    chk('② 방어막이 막았으니 체력·실드가 안 준다', b.dHp === 0 && b.dSh === 0, `체력 −${b.dHp} · 실드 −${b.dSh}`);

    /* ③ 방어막 > 실드 방벽 (전설) — 실드가 있는 상태 */
    const c = shot(H, { ward: 1, sh: 1e6, perks: ['p_shWallL'], q: [HIT, YES] });
    chk('③ ⚑ 방어막 1장 + 실드 방벽(실드 있음) → 방어막이 먼저 깎인다',
      c.ward === 0, `남은 장수 ${c.ward} (기대 0)`);
    chk('③ ⚑ 그 타격의 굴림도 회피 1번뿐이다', c.rolls === 1, `굴림 ${c.rolls}회 (기대 1)`);

    /* ④ 방어막이 없을 때에야 무시를 굴린다 — 성공하면 피해 0 */
    const d = shot(H, { ward: 0, perks: ['p_ignoreN'], q: [HIT, YES] });
    chk('④ 방어막이 0 이면 피해 무시를 굴린다 (굴림 2회 = 회피 + 무시)', d.rolls === 2, `굴림 ${d.rolls}회`);
    chk('④ 무시에 성공하면 체력·실드가 안 준다', d.dHp === 0 && d.dSh === 0, `체력 −${d.dHp} · 실드 −${d.dSh}`);

    /* ⑤ 무시 > 피해 — 무시에 실패하면 피해가 끝까지 흐른다 */
    const e = shot(H, { ward: 0, perks: ['p_ignoreN'], q: [HIT, NO] });
    chk('⑤ 무시에 실패하면 피해가 들어간다 (층이 끝까지 흐른다)', e.dHp > 0, `체력 −${e.dHp}`);
    chk('⑤ 아무 방어층도 없는 맨몸 피격도 피해가 들어간다 (양성 대조)',
      shot(H, { q: [HIT] }).dHp > 0);
  }

  /* ================================================================
     ⓒ 조기 종료 — 막힌·무시된·회피된 타격은 «피격» 이 아니다
     ================================================================ */
  say('\n=== ⓒ 실측 — 막힌·무시된 타격은 «피격» 이 아니다 (트리거·가시갑옷 0) ===');
  {
    const TRIG = ['p_wardHitN', 'p_thornsN'];   /* 피격 시 방어막 I(10%) · 가시갑옷 +100% */
    /* 양성 대조군 먼저 — 정상 피격이면 이 셋이 실제로 굴러간다 */
    const ok = shot(H, { ward: 0, perks: TRIG, q: [HIT, YES, YES, YES, YES] });
    chk('양성 대조 — 정상 피격이면 가시갑옷이 되갚는다', ok.refl > 0, `반사 ${ok.refl}`);
    chk('양성 대조 — 정상 피격이면 «피격 시 방어막» 이 붙는다', ok.dWard > 0, `방어막 +${ok.dWard}`);

    const w = shot(H, { ward: 1, perks: TRIG, q: [HIT, YES, YES, YES, YES] });
    chk('① 방어막으로 막은 타격 — 가시갑옷 반사 0', w.refl === 0, `반사 ${w.refl}`);
    chk('① 방어막으로 막은 타격 — «피격 시 방어막» 이 안 붙는다 (장수가 1 → 0 뿐)',
      w.ward === 0, `남은 장수 ${w.ward} (기대 0)`);
    chk('① 방어막으로 막은 타격 — 피격 방어 버프 0건', w.defBuffs === 0, `${w.defBuffs}건`);

    const g = shot(H, { ward: 0, perks: TRIG.concat(['p_ignoreN']), q: [HIT, YES, YES, YES, YES] });
    chk('② 무시된 타격 — 가시갑옷 반사 0', g.refl === 0, `반사 ${g.refl}`);
    chk('② 무시된 타격 — «피격 시 방어막» 이 안 붙는다', g.dWard === 0, `방어막 +${g.dWard}`);
    chk('② 무시된 타격 — 체력·실드 불변', g.dHp === 0 && g.dSh === 0, `체력 −${g.dHp} · 실드 −${g.dSh}`);

    const v = shot(H, { ward: 2, perks: TRIG, q: [EV, YES, YES, YES, YES] });
    chk('③ 회피한 타격 — 가시갑옷 반사 0 · 방어막 장수 불변', v.refl === 0 && v.ward === 2,
      `반사 ${v.refl} · 장수 ${v.ward}`);
  }

  /* ================================================================
     ⓓ ign1·ign2 는 각각 따로 굴린다 · 실드 방벽의 실드 조건
     ================================================================ */
  say('\n=== ⓓ 실측 — 피해 무시·실드 방벽은 각각 따로 굴린다 (실드 조건 포함) ===');
  {
    const both = shot(H, { ward: 0, sh: 1e6, perks: ['p_ignoreN', 'p_shWallL'], q: [HIT, NO, NO] });
    chk('① 둘 다 있고 실드가 있으면 굴림 3회 + 꼬리 (회피 + 무시 + 방벽)',
      both.rolls === 3 + TAIL, `굴림 ${both.rolls}회 (기대 ${3 + TAIL})`);
    chk('① 둘 다 실패하면 피해가 들어간다', both.dHp + both.dSh > 0, `체력 −${both.dHp} · 실드 −${both.dSh}`);

    const b2 = shot(H, { ward: 0, sh: 1e6, perks: ['p_ignoreN', 'p_shWallL'], q: [HIT, NO, YES] });
    chk('① ign1 이 실패해도 ign2 가 성공하면 무시된다 (합쳐 한 번 굴리지 않는다)',
      b2.dHp === 0 && b2.dSh === 0, `체력 −${b2.dHp} · 실드 −${b2.dSh}`);

    const noSh = shot(H, { ward: 0, sh: 0, perks: ['p_shWallL'], q: [HIT, YES] });
    chk('② 실드가 0 이면 실드 방벽을 **굴리지 않는다** (회피 1회 + 꼬리뿐)',
      noSh.rolls === 1 + TAIL, `굴림 ${noSh.rolls}회 (기대 ${1 + TAIL})`);
    chk('② 실드가 0 이면 실드 방벽이 안 걸려 피해가 들어간다', noSh.dHp > 0, `체력 −${noSh.dHp}`);

    const hasSh = shot(H, { ward: 0, sh: 1e6, perks: ['p_shWallL'], q: [HIT, YES] });
    chk('② 실드가 있으면 실드 방벽을 굴린다 (굴림 2회 · 성공하면 실드도 안 준다)',
      hasSh.rolls === 2 && hasSh.dSh === 0, `굴림 ${hasSh.rolls}회 · 실드 −${hasSh.dSh}`);

    /* 방어막은 «확률» 이 아니라 «장수» 다 — 굴림이 0번인 것이 순서 측정의 전제다 */
    const wOnly = shot(H, { ward: 5, q: [HIT] });
    chk('③ 방어막 소모는 굴림이 0번이다 (확률이 아니라 장수 — 순서 측정의 전제)',
      wOnly.rolls === 1 && wOnly.ward === 4, `굴림 ${wOnly.rolls}회 · 장수 ${wOnly.ward}`);
    chk('③ 방어막은 한 대에 정확히 1장만 소모한다', wOnly.ward === 4, `5 → ${wOnly.ward}`);
  }

  /* ================================================================
     ⓔ 두 엔진 문면 1:1
     ================================================================ */
  say('\n=== ⓔ 두 엔진 문면 1:1 ===');
  {
    const s = norm(hitBody(simSrc)), h = norm(hitBody(htmSrc));
    for (const k of ['ign1', 'ign2', 'hadSh', 'dmg']) {
      const t = norm(MARK[k]);
      chk(`${k} 줄이 두 엔진에 글자 그대로 있다`, s.includes(t) && h.includes(t), MARK[k]);
    }
    chk('방어막 분기가 1장 소모 후 그 자리에서 끝난다 (두 엔진)',
      /if\(p\.ward>0\)\{p\.ward--;[^}]*return;\}/.test(s) && /if\(p\.ward>0\)\{p\.ward--;[^}]*return;\}/.test(h));
    chk('피해 무시가 두 엔진에서 조기 종료한다',
      /if\(ign1\|\|ign2\)(return;|\{[^}]*return;\})/.test(s) && /if\(ign1\|\|ign2\)(return;|\{[^}]*return;\})/.test(h));
  }

  /* ================================================================
     ⓕ 주인 문면
     ================================================================ */
  say('\n=== ⓕ 주인 문면 (ROUTINE · PLAN) ===');
  chk('ROUTINE «판정 순서 회피 → 방어막 → 피해 무시 → 피해»', RULE_ORDER.test(routineSrc));
  chk('ROUTINE «방어막으로 막은 공격은 «피격» 아님»', RULE_WARDHIT.test(routineSrc));
  chk('ROUTINE «피해 무시 — 회피 판정 «뒤»·방어막 «뒤» 에 굴림»', RULE_IGNPOS.test(routineSrc));
  chk('PLAN §3.2 «hitPlayer 는 회피 → 방어막 → 피해 무시 → 피해 로 본다»', PLAN_ORDER.test(planSrc));
  chk('동결 순서 배열이 주인 문면 그대로다', ORDER.join(' → ') === '회피 → 방어막 → 피해 무시 → 피해',
    ORDER.join(' → '));

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
  console.log('[음성 검사] 판정 순서를 몰래 뒤집은 사본에서 이 게이트가 빨개지는가');
  const WARD_S = '  if(p.ward>0){p.ward--;return;}\n';
  const WARD_H = '  if(p.ward>0){\n    p.ward--;\n    wardFx();\n    renderBuffBar();\n    return;\n  }\n';
  const IGN_S = '  if(ign1||ign2)return;\n';
  const IGN_H = "  if(ign1||ign2){ addText('\u{1F6AB}','#B9C6D4'); return; }\n";
  const EV = '  if(Math.random()*100<effEvade(p)){\n';
  const wardOf = s => (s === simSrc || s.indexOf('function hitPlayer(G,') >= 0 ? WARD_S : WARD_H);
  const ignOf = s => (s.indexOf('function hitPlayer(G,') >= 0 ? IGN_S : IGN_H);
  /* 방어막을 피해 무시 «뒤» 로 (= 이 게이트를 낳은 그 개조) */
  const wardAfterIgn = s => { const W = wardOf(s), I = ignOf(s);
    return s.includes(W) && s.includes(I) ? s.replace(W, '').replace(I, I + W) : s; };
  /* 방어막을 회피 «앞» 으로 */
  const wardBeforeEvade = s => { const W = wardOf(s);
    return s.includes(W) && s.includes(EV) ? s.replace(W, '').replace(EV, W + EV) : s; };
  /* 피해 무시를 회피 «앞» 으로 (세 줄을 통째로) */
  const ignBeforeEvade = s => {
    const I = ignOf(s);
    const blk = '  const ign1=px.p_ignoreN&&pkk(p,PERK_IGN_N);\n' +
                '  const ign2=p.sh>0&&px.p_shWallL&&pkk(p,PERK_SHWALL_L);\n' + I;
    return s.includes(blk) ? s.replace(blk, '').replace(EV, blk + EV) : s;
  };
  const both = f => [f, f, null, null];
  const cases = [
    ['⚑ 방어막을 피해 무시 «뒤» 로 옮기면 (주인 순서가 뒤집힌다)', ...both(wardAfterIgn)],
    ['⚑ 방어막을 회피 «앞» 으로 옮기면 (피할 수 있던 타격이 방어막을 깎는다)', ...both(wardBeforeEvade)],
    ['⚑ 피해 무시를 회피 «앞» 으로 옮기면 (주인 «회피 뒤» 위반)', ...both(ignBeforeEvade)],
    ['방어막의 조기 종료를 지우면 (막힌 타격이 다시 «피격» 이 된다)',
      ...both(s => s.replace(/if\(p\.ward>0\)\{(\s*)p\.ward--;/g, 'if(p.ward>0){$1p.ward--;/*noret*/')
        .replace(/p\.ward--;\/\*noret\*\/(\s*)return;/g, 'p.ward--;$1'))],
    ['피해 무시의 조기 종료를 지우면 (무시된 타격이 다시 피해를 준다)',
      ...both(s => s.replace('if(ign1||ign2)return;', 'if(false)return;')
        .replace("if(ign1||ign2){ addText('\u{1F6AB}','#B9C6D4'); return; }",
                 "if(false){ addText('\u{1F6AB}','#B9C6D4'); return; }"))],
    ['실드 방벽의 «실드 > 0» 조건을 지우면 (실드가 없어도 50% 무시)',
      ...both(s => s.replace('const ign2=p.sh>0&&px.p_shWallL&&pkk(p,PERK_SHWALL_L);',
        'const ign2=px.p_shWallL&&pkk(p,PERK_SHWALL_L);'))],
    ['ign1·ign2 를 «한 번만» 굴리게 합치면 (주인 «각각 따로» 위반)',
      ...both(s => s.replace('const ign2=p.sh>0&&px.p_shWallL&&pkk(p,PERK_SHWALL_L);',
        'const ign2=!ign1&&p.sh>0&&px.p_shWallL&&pkk(p,PERK_SHWALL_L);'))],
    ['방어막이 한 대에 두 장 나가면',
      ...both(s => s.replace(/if\(p\.ward>0\)\{(\s*)p\.ward--;/g, 'if(p.ward>0){$1p.ward-=2;'))],
    ['피해 무시 확률을 20 → 30% 로 올리면 (동결 상수 이탈)',
      s => s.replace('PERK_IGN_N=0.20', 'PERK_IGN_N=0.30'), null, null, null],
    ['index.html 에서만 방어막을 무시 뒤로 옮기면 (두 엔진이 갈라진다)',
      null, wardAfterIgn, null, null],
    ['ROUTINE 에서 «회피 → 방어막 → 피해 무시 → 피해» 를 지우면',
      null, null, s => s.replace('판정 순서 **회피 → 방어막 → 피해 무시 → 피해**',
        '판정 순서 **회피 → 피해 무시 → 방어막 → 피해**'), null],
    ['PLAN §3.2 의 순서만 바꾸면',
      null, null, null, s => s.replace('`hitPlayer` 는 **회피 → 방어막 → 피해 무시 → 피해** 로 본다',
        '`hitPlayer` 는 **회피 → 피해 무시 → 방어막 → 피해** 로 본다')],
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

console.log('=== 피격 판정 순서 게이트 (T139 · 주인 확정 T121 3차 18:2X) ===');
const bad = run(simSrc, htmSrc, routineSrc, planSrc, false);
console.log(`\n[피격 판정 순서 게이트] 대조 ${R.length}항목 · 통과 ${R.length - bad} · 불합격 ${bad}` +
  (bad ? '' : ' → 통과 (회피 → 방어막 → 피해 무시 → 피해 — 위치 비교 + 굴림 횟수 실측)'));
process.exit(bad ? 1 : 0);
