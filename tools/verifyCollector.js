#!/usr/bin/env node
/* ================================================================================
   verifyCollector — ⚑⚑⚑ T144 (워커 B · sess-0720-20212)

   **주인 확정 T121 (2026-09-04 16:0X · ROUTINE «신규 주인 지시» ① 표)** 의 «수집가» 3종이
   주인이 적은 규약 그대로 도는가를 **두 엔진에서 실제로 굴려서** 잰다.

     | 일반 | 수집가·공격 | 보유 특전 하나당 공격력 +4% | 자기 자신 포함 · 특전을 얻을 때마다
     |                                                재계산 · 곱연산 ×(1+0.04·n) |
     | 일반 | 수집가·치명 | 보유 특전 하나당 치명타 확률 +2% | 가산 |
     | 일반 | 수집가·체력 | 보유 특전 하나당 최대 체력 +7% (10/100 → 10/107 — 최대치만)
     |                                                | 현재 체력 불변 · 곱연산 · 실드 무관 |

   즉 주인이 한 줄에 못박은 조건이 여섯이다 — **① 자기 자신 포함 ② 얻을 때마다 재계산(소급)
   ③ 공격은 곱연산 ④ 치명은 가산 ⑤ 체력은 최대치만(현재 체력 불변) ⑥ 실드 무관.**

   ── 구멍을 먼저 증명했다 (T144 사본 실측 · 정적 게이트 26종) ──
   `perkCountOf` 를 `tools/` 전체에서 grep 하면 **0건**이고 `tools/t3/` 에서도 «수집가» 는 **0건**이다.
   닿는 자는 `verifyPerkOrder`(id·등급·순서·설명문과 `PERK_COLL_*` 상수값)와 `verifyNumClean`
   (표시 숫자 규칙) 둘뿐인데 **둘 다 «그 특전이 무슨 일을 하는지» 는 안 본다.**
   그래서 사본 9벌을 만들어 26종을 전부 돌렸다 — **8벌이 통과 수 한 개도 안 움직였다**:

     · n 에서 자기 자신을 뺀다 (`perkCountOf` → `n-1`)              → 26종 변화 0
     · 수집가·체력이 **현재 체력도 같이** 올린다 (주인 «최대치만» 위반) → 26종 변화 0
     · 수집가·치명을 가산 → **곱연산**으로                            → 26종 변화 0
     · 수집가·공격을 곱연산 → **가산**으로                            → 26종 변화 0
     · 소급을 없앤다 (`effDmg` 에서 첫 계산값으로 굳힌다 · 두 엔진 같은 문면) → 26종 변화 0
     · index.html 만 세는 자를 `perkOrderN()` → `G.perksTaken.length`
       (천사의 축복 한 번에 수집가가 한 칸 오른다 = 두 엔진 괴리)      → 26종 변화 0
     · `applyCollHp` 의 «갈아끼우기» 를 «곱하기» 로 (부를 때마다 이중 곱) → 26종 변화 0
     · 수집가·체력을 **실드에도** 건다 (주인 «실드 무관» 위반)         → 26종 변화 0

   유일하게 걸린 한 벌(«ap 본문에서 획득 시점 수로 굳힌다»)도 `verifyT2` 의 «두 엔진 `ap` 본문
   문자열 일치» 에 **우연히** 걸린 것이다 — 두 엔진이 세는 동사가 원래 다르기 때문이고(sim 은
   `G.taken`, 게임은 `perkOrderN()`), 같은 고장을 한 줄 아래(`effDmg`)에 같은 문면으로 심으면
   그것도 26종을 통과한다(위 목록 5번째 줄).

   ── 그래서 이 게이트가 하는 일 ──
   문면 대조가 아니라 **실측 동결**이다. 두 엔진을 **둘 다 굴린다**:
     ① `sim.js` — CLI 디스패처 앞까지 vm 에 올려 진짜 `pickPerk`·`applyCollHp`·`effDmg`·`effCritR`
        를 꺼내 특전을 한 장씩 실제로 주면서 값을 잰다.
     ② `index.html` — `perkOrderN`·`perkCountOf`·`applyCollHp`·`effDmg`·`effCritR`·`bsum` 을
        소스에서 통째로 떼어내 vm 에 올려 **같은 표**를 다시 잰다(문면이 아니라 결과로 묶는다).
        여기서 «천사의 축복(PERKS 밖 항목)은 안 센다» 도 실제로 목록에 섞어 확인한다.
     ③ 두 엔진의 축 정규식·상수·획득 시 재계산 호출 자리
     ④ ROUTINE 주인 문면 6줄

   숫자는 **소스에서 읽는다**(`PERK_COLL_ATK` 등) — 다만 주인이 표에 적은 값과 같은지도 함께 본다.

   ── 이 게이트를 고쳐도 되는 때 ──
   **주인이 수집가 3종의 규칙을 새로 확정했을 때뿐이다.** 그때 아래 `OWNER` 값과 기대표를 갱신하고
   PROGRESS 에 주인 원문과 함께 남긴다 — 고치는 것 자체가 diff 에 드러나는 것이 요점이다.

   사용: node tools/verifyCollector.js        (exit 0 = 통과, 1 = 불합격)
   음성: node tools/verifyCollector.js --self (심은 고장 14종 + 양성 대조군)
   ================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ── 주인 확정값 (ROUTINE T121 ① 표) ─────────────────────────────────────── */
const OWNER = { atk: 0.04, crit: 2, hp: 0.07 };

/* ROUTINE 주인 문면 — 규칙을 지우고 동작을 뒤집는 경로를 막는다 */
const RULES = [
  ['«보유 특전 하나당 공격력 +4%»', /보유 특전 하나당 공격력 \+4%/],
  ['«자기 자신 포함 · 특전을 얻을 때마다 재계산 · 곱연산»', /자기 자신 포함 · 특전을 얻을 때마다 재계산 · 곱연산/],
  ['«보유 특전 하나당 치명타 확률 +2%» · 위임 «가산»', /보유 특전 하나당 치명타 확률 \+2%\s*\|\s*가산/],
  ['«보유 특전 하나당 최대 체력 +7%»', /보유 특전 하나당 최대 체력 \+7%/],
  ['«10/100 → 10/107 — 최대치만»', /10\/100 → 10\/107 — 최대치만/],
  ['«현재 체력 불변 · 곱연산 · 실드 무관»', /현재 체력 불변 · 곱연산 · 실드 무관/],
];

/* ── 두 엔진 공통 축 (공백 제거 후 대조) ─────────────────────────────────
   `index.html` 은 같은 자리에 주석·공백이 달라 줄이 글자 그대로는 다르다.
   그래서 «무엇을 어떻게 세는가» 만 남긴 정규식으로 묶는다. */
const AX = [
  ['수집가·공격 — 곱연산 ×(1+0.04·n)', /if\(px\.p_collAtk\)m\*=1\+PERK_COLL_ATK\*perkCountOf\(p\);/],
  ['수집가·치명 — 가산 +2·n',          /if\(px\.p_collCrit\)c\+=PERK_COLL_CRIT\*perkCountOf\(p\);/],
  ['수집가·체력 — 최대 체력만 갈아끼운다', /p\.maxHp=p\.maxHp\/\(p\.collHpF\|\|1\)\*f;p\.collHpF=f;/],
  ['수집가·체력 — 배수는 1+0.07·n',    /constf=1\+PERK_COLL_HP\*n;/],
  ['수집가·체력 — 특전이 없으면 아무것도 안 한다', /if\(!p\.px\.p_collHp\)return;/],
  ['획득 확정 자리에서 최대 체력을 다시 건다', /applyCollHp\(G\.player,(?:G\.taken\.length|perkOrderN\(\))\);/],
];

/* ================================================================
   `sim.js` 를 CLI 디스패처 앞까지만 vm 에 올려 필요한 동사를 그대로 꺼낸다.
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
      '\n;globalThis.__S={PERKS,basePx,pickPerk,applyCollHp,perkCountOf,effDmg,effCritR,' +
      'PERK_COLL_ATK,PERK_COLL_CRIT,PERK_COLL_HP,PERK_ATK_M};', ctx);
  } catch (e) { return null; }
  return ctx.__S || (ctx.globalThis && ctx.globalThis.__S) || null;
}

/* ================================================================
   `index.html` 에서 함수를 통째로 떼어내 vm 에 올린다 — 게임 쪽도 **굴려서** 잰다.
   ================================================================ */
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
  const need = ['bsum', 'perkOrderN', 'perkCountOf', 'applyCollHp', 'effDmg', 'effCritR'];
  const body = [];
  for (const n of need) { const f = pluck(src, n); if (!f) return null; body.push(f); }
  const ctx = {
    G: { perksTaken: [] }, PERKS: [],
    PERK_COLL_ATK: num('PERK_COLL_ATK'), PERK_COLL_CRIT: num('PERK_COLL_CRIT'),
    PERK_COLL_HP: num('PERK_COLL_HP'), PERK_NOSH_ATK: num('PERK_NOSH_ATK'),
    Math, Object, Array,
    renderStatsGrid() { ctxHit.stats++; },   /* 게임 쪽 applyCollHp 는 스탯 그리드를 다시 그린다 */
  };
  const ctxHit = { stats: 0 };
  ctx.__hit = ctxHit;
  vm.createContext(ctx);
  try {
    vm.runInContext(body.join('\n') +
      '\n;globalThis.__H={perkOrderN,perkCountOf,applyCollHp,effDmg,effCritR};', ctx);
  } catch (e) { return null; }
  const H = ctx.__H || (ctx.globalThis && ctx.globalThis.__H);
  return H ? { H, ctx } : null;
}

/* ── 두 엔진 공통 플레이어 틀 ─────────────────────────────────────────── */
function mkP(px, over) {
  return Object.assign({
    worldX: 0, dmg: 100, aspd: 1, critR: 0, critF: 150, def: 0, counter: 0, evade: 0,
    steal: 0, killHeal: 0, misfire: 0, goldMul: 1, walkMul: 1, healAmp: 0, repairAmp: 0,
    nextCrit: false, nextAtk: 0, ward: 0, maxHp: 1000, hp: 1000, maxSh: 500, sh: 500,
    level: 1, exp: 0, critStk: 0, nhit: {}, collHpF: 1, atkTimer: 0,
    sureCrit: false, bsStk: 0, dash: false,
    buffs: { atk: [], aspd: [], critR: [], critF: [], def: [], evade: [] }, px,
  }, over || {});
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

function run(simSrc, htmSrc, routineSrc, quiet) {
  R.length = 0;
  QUIET = !!quiet;
  const say = quiet ? () => {} : console.log;

  const S1 = loadSim(simSrc);
  if (!S1) { chk('sim.js 적재', false, 'vm 적재 실패 — 동사 이름이나 CLI 디스패처 위치가 바뀌었다. 게이트를 함께 고칠 것'); return finish(); }
  const L2 = loadHtm(htmSrc);
  if (!L2) { chk('index.html 적재', false, 'effDmg·effCritR·applyCollHp·perkOrderN 을 못 떼어냈다. 게이트를 함께 고칠 것'); return finish(); }
  const { H, ctx } = L2;
  const S = simSrc.replace(/\s+/g, '');
  const Hs = htmSrc.replace(/\s+/g, '');

  /* 소스에서 읽은 계수 (박지 않는다) */
  const cA = S1.PERK_COLL_ATK, cC = S1.PERK_COLL_CRIT, cH = S1.PERK_COLL_HP;

  /* sim.js 에서 특전을 실제로 한 장씩 주는 판 */
  const NON = ['p_evade', 'p_counter', 'p_arrowEv', 'p_axeHit', 'p_spearCt'];   /* 공/치/체를 안 건드리는 특전 */
  function sim(ids, over) {
    const p = mkP(S1.basePx(), over);
    const G = { player: p, taken: [] };
    p.G = G;
    for (const id of ids) {
      const k = S1.PERKS.find(x => x.id === id);
      if (!k) return null;
      S1.pickPerk(G, k);
    }
    return { p, G };
  }
  /* index.html 쪽 같은 판 — ap 본문은 verifyT2 가 두 엔진 1:1 로 묶으므로 여기선 px 만 세운다 */
  function htm(flags, n, over) {
    const px = {};
    for (const k of ['p_collAtk', 'p_collCrit', 'p_collHp', 'p_critStack', 'p_berserk', 'rage', 'p_noShAtk'])
      px[k] = flags[k] ? 1 : 0;
    const p = mkP(px, over);
    ctx.PERKS.length = 0; ctx.G.perksTaken.length = 0;
    for (let i = 0; i < n; i++) { const q = { id: 'x' + i }; ctx.PERKS.push(q); ctx.G.perksTaken.push(q); }
    return p;
  }

  /* ---------- ① 수집가·공격 — 자기 자신 포함 · 곱연산 · 소급 ---------- */
  say('\n=== ① 수집가·공격 — «보유 특전 하나당 +4% · 자기 자신 포함 · 곱연산» ===');
  chk(`계수 PERK_COLL_ATK = ${OWNER.atk} (주인 표 «+4%»)`, near(cA, OWNER.atk), cA);
  {
    const a0 = sim([]);
    chk('수집가가 없으면 공격력이 안 움직인다 (대조군)', a0 && near(S1.effDmg(a0.p), 100), a0 && S1.effDmg(a0.p));

    /* 자기 자신 포함 — 수집가 한 장만 가진 순간 이미 n=1 이다 */
    const a1 = sim(['p_collAtk']);
    chk(`수집가 한 장만 = n 1 → ×${(1 + cA).toFixed(2)} (자기 자신 포함 — 주인 명시)`,
      a1 && near(S1.effDmg(a1.p), 100 * (1 + cA)), a1 && S1.effDmg(a1.p));

    /* 소급 ⓐ — 수집가를 먼저 얻고 나중에 더 얻는다 */
    for (const k of [1, 2, 3, 4, 5]) {
      const a = sim(['p_collAtk'].concat(NON.slice(0, k - 1)));
      chk(`수집가 먼저 · 특전 ${k}장 → 공격력 ×(1+${cA}·${k})`,
        a && near(S1.effDmg(a.p), 100 * (1 + cA * k)), a && S1.effDmg(a.p));
    }
    /* 소급 ⓑ — 이미 여러 장 가진 뒤에 수집가를 얻어도 그 자리에서 전부 세어진다 */
    const b = sim(NON.slice(0, 4).concat(['p_collAtk']));
    chk('특전 4장 뒤에 수집가를 얻어도 n 5 로 바로 걸린다 (소급)',
      b && near(S1.effDmg(b.p), 100 * (1 + cA * 5)), b && S1.effDmg(b.p));

    /* 곱연산 — 공격력 +15% 특전과 «곱해진다»(가산이면 값이 다르다) */
    const c = sim(['p_atk', 'p_collAtk'].concat(NON.slice(0, 2)));
    const want = 100 * S1.PERK_ATK_M * (1 + cA * 4);
    const addWrong = 100 * S1.PERK_ATK_M * (1 + cA * 4) === 100 * (S1.PERK_ATK_M + cA * 4);
    chk(`공격력 +15% 특전과 «곱연산» (가산이 아니다 — 주인 명시)`,
      c && near(S1.effDmg(c.p), want) && !addWrong, c && `${S1.effDmg(c.p)} (기대 ${want})`);

    /* 게임 엔진도 같은 표 */
    let same = true, bad = '';
    for (let n = 0; n <= 8; n++) {
      const p = htm({ p_collAtk: 1 }, n);
      const got = H.effDmg(p), w = 100 * (1 + cA * n);
      if (!near(got, w)) { same = false; bad = `n=${n} ${got}≠${w}`; break; }
    }
    chk('index.html 도 같은 표 (n 0~8 · 실제로 굴려서)', same, bad);
    chk('index.html — 수집가가 없으면 안 움직인다', near(H.effDmg(htm({}, 8)), 100), H.effDmg(htm({}, 8)));
  }

  /* ---------- ② 수집가·치명 — 가산 ---------- */
  say('\n=== ② 수집가·치명 — «보유 특전 하나당 치명타 확률 +2 · 가산» ===');
  chk(`계수 PERK_COLL_CRIT = ${OWNER.crit} (주인 표 «+2»)`, near(cC, OWNER.crit), cC);
  {
    for (const k of [1, 3, 5]) {
      const a = sim(['p_collCrit'].concat(NON.slice(0, k - 1)));
      chk(`특전 ${k}장 → 치확 0 + ${cC}·${k}`, a && near(S1.effCritR(a.p), cC * k), a && S1.effCritR(a.p));
    }
    /* 가산 — 기저 치확이 있어도 «더한다»(곱연산이면 값이 다르다) */
    const b = sim(['p_collCrit'].concat(NON.slice(0, 3)), { critR: 30 });
    chk(`기저 치확 30 + 특전 4장 → 30+${cC}·4 = ${30 + cC * 4} (곱연산이 아니다 — 주인 «가산»)`,
      b && near(S1.effCritR(b.p), 30 + cC * 4), b && S1.effCritR(b.p));
    /* 나중에 얻어도 소급 */
    const c = sim(NON.slice(0, 4).concat(['p_collCrit']));
    chk('특전 4장 뒤에 얻어도 n 5 로 바로 걸린다 (소급)',
      c && near(S1.effCritR(c.p), cC * 5), c && S1.effCritR(c.p));

    let same = true, bad = '';
    for (let n = 0; n <= 8; n++) {
      const got = H.effCritR(htm({ p_collCrit: 1 }, n, { critR: 30 })), w = 30 + cC * n;
      if (!near(got, w)) { same = false; bad = `n=${n} ${got}≠${w}`; break; }
    }
    chk('index.html 도 같은 표 (기저 30 · n 0~8 · 실제로 굴려서)', same, bad);
  }

  /* ---------- ③ 수집가·체력 — 최대치만 · 현재 체력 불변 · 실드 무관 ---------- */
  say('\n=== ③ 수집가·체력 — «최대 체력 +7%/장 · 10/100 → 10/107 (최대치만) · 실드 무관» ===');
  chk(`계수 PERK_COLL_HP = ${OWNER.hp} (주인 표 «+7%»)`, near(cH, OWNER.hp), cH);
  {
    /* 주인이 표에 직접 적은 예시 그대로 */
    const ex = sim(['p_collHp'], { maxHp: 100, hp: 10, maxSh: 0, sh: 0 });
    chk(`주인 예시 «10/100 → 10/107» (n 1)`,
      ex && near(ex.p.maxHp, 100 * (1 + cH)) && ex.p.hp === 10,
      ex && `${ex.p.hp}/${ex.p.maxHp}`);

    for (const k of [1, 2, 4, 6]) {
      const a = sim(['p_collHp'].concat(NON.slice(0, k - 1)), { maxHp: 1000, hp: 250 });
      chk(`특전 ${k}장 → 최대 체력 1000×(1+${cH}·${k}) · 곱누적(1.07^${k})이 아니다`,
        a && near(a.p.maxHp, 1000 * (1 + cH * k)), a && a.p.maxHp);
      chk(`특전 ${k}장 — 현재 체력 250 그대로 (주인 «최대치만»)`, a && a.p.hp === 250, a && a.p.hp);
    }
    /* 실드 무관 */
    const s = sim(['p_collHp'].concat(NON.slice(0, 3)), { maxSh: 500, sh: 320 });
    chk('최대 실드 500 그대로 (주인 «실드 무관»)', s && s.p.maxSh === 500, s && s.p.maxSh);
    chk('현재 실드 320 그대로', s && s.p.sh === 320, s && s.p.sh);

    /* 소급 — 나중에 얻어도 이미 가진 수만큼 즉시 */
    const c = sim(NON.slice(0, 4).concat(['p_collHp']), { maxHp: 1000, hp: 250 });
    chk('특전 4장 뒤에 얻어도 n 5 로 바로 걸린다 (소급)',
      c && near(c.p.maxHp, 1000 * (1 + cH * 5)), c && c.p.maxHp);

    /* 갈아끼우기 — 몇 번을 불러도 이중으로 곱해지지 않는다 */
    const d = sim(['p_collHp'].concat(NON.slice(0, 2)), { maxHp: 1000, hp: 250 });
    const before = d && d.p.maxHp;
    if (d) for (let i = 0; i < 5; i++) S1.applyCollHp(d.p, d.G.taken.length);
    chk('같은 n 으로 여러 번 불러도 값이 안 변한다 (갈아끼우기 · 이중 곱 없음)',
      d && near(d.p.maxHp, before) && near(d.p.maxHp, 1000 * (1 + cH * 3)), d && `${before} → ${d.p.maxHp}`);
    /* 특전이 없으면 아무것도 안 한다 */
    const e = sim(NON.slice(0, 3), { maxHp: 1000 });
    if (e) S1.applyCollHp(e.p, 3);
    chk('수집가·체력이 없으면 applyCollHp 가 아무것도 안 한다 (대조군)', e && e.p.maxHp === 1000, e && e.p.maxHp);

    /* 게임 엔진도 같은 표 */
    let same = true, bad = '';
    for (let n = 0; n <= 8; n++) {
      const p = htm({ p_collHp: 1 }, n, { maxHp: 1000, hp: 250, maxSh: 500, sh: 320 });
      H.applyCollHp(p, n);
      if (!near(p.maxHp, 1000 * (1 + cH * n)) || p.hp !== 250 || p.maxSh !== 500 || p.sh !== 320) {
        same = false; bad = `n=${n} ${p.hp}/${p.maxHp} sh ${p.sh}/${p.maxSh}`; break;
      }
    }
    chk('index.html 도 같은 표 (n 0~8 · 현재 체력·실드 불변 · 실제로 굴려서)', same, bad);
  }

  /* ---------- ④ 셋은 서로 독립 ---------- */
  say('\n=== ④ 셋을 다 가지면 각각 따로 걸린다 ===');
  {
    const a = sim(['p_collAtk', 'p_collCrit', 'p_collHp'].concat(NON.slice(0, 2)),
      { maxHp: 1000, hp: 250, critR: 0 });
    const n = 5;
    chk(`n ${n} — 공격력 ×(1+${cA}·${n})`, a && near(S1.effDmg(a.p), 100 * (1 + cA * n)), a && S1.effDmg(a.p));
    chk(`n ${n} — 치확 +${cC}·${n}`, a && near(S1.effCritR(a.p), cC * n), a && S1.effCritR(a.p));
    chk(`n ${n} — 최대 체력 ×(1+${cH}·${n})`, a && near(a.p.maxHp, 1000 * (1 + cH * n)), a && a.p.maxHp);
    chk(`n ${n} — 현재 체력 250 그대로`, a && a.p.hp === 250, a && a.p.hp);
  }

  /* ---------- ⑤ 세는 자 = «진짜 특전» 수 (천사의 축복은 안 센다) ---------- */
  say('\n=== ⑤ 세는 자 — 게임의 «축복»(PERKS 밖 획득물)은 n 에 안 들어간다 ===');
  {
    ctx.PERKS.length = 0; ctx.G.perksTaken.length = 0;
    const real = [];
    for (let i = 0; i < 4; i++) { const q = { id: 'r' + i }; real.push(q); ctx.PERKS.push(q); ctx.G.perksTaken.push(q); }
    chk('진짜 특전 4장 → perkOrderN() 4', H.perkOrderN() === 4, H.perkOrderN());
    ctx.G.perksTaken.push({ ic: '😇', tx: '천사의 축복' });      /* PERKS 에 없는 획득물 */
    chk('천사의 축복을 목록에 넣어도 perkOrderN() 은 4 (길이는 5)',
      H.perkOrderN() === 4 && ctx.G.perksTaken.length === 5, `${H.perkOrderN()} / ${ctx.G.perksTaken.length}`);
    chk('perkCountOf 가 perkOrderN 과 같은 값을 돌려준다 (길이가 아니다)',
      H.perkCountOf({}) === 4, H.perkCountOf({}));
    const p = mkP({ p_collAtk: 1 });
    chk('축복이 섞여 있어도 수집가·공격은 4장으로 센다',
      near(H.effDmg(p), 100 * (1 + cA * 4)), H.effDmg(p));
    chk('index.html perkOrderN 이 PERKS 소속으로 거른다 (문면)',
      /functionperkOrderN\(\)\{letn=0;for\(constqofG\.perksTaken\)if\(PERKS\.includes\(q\)\)n\+\+;returnn;\}/.test(Hs));
    chk('index.html perkCountOf 가 perkOrderN 을 쓴다 (문면)',
      /functionperkCountOf\(p\)\{returnperkOrderN\(\);\}/.test(Hs));
    /* sim.js 는 `G.taken` 에 특전만 넣는다 — push 자리가 pickPerk 한 곳 */
    const pushN = (simSrc.match(/\.taken\.push\(/g) || []).length;
    chk('sim.js — G.taken 에 넣는 자리가 pickPerk 한 곳뿐 (특전 외 항목이 못 섞인다)', pushN === 1, `${pushN}곳`);
    /* 두 엔진 모두 획득 확정 자리에서 applyCollHp 를 한 번 부른다 */
    for (const [who, src] of [['sim.js', simSrc], ['index.html', htmSrc]]) {
      const n = (src.match(/applyCollHp\(G\.player,/g) || []).length;
      chk(`${who} — 획득 확정 자리의 applyCollHp 호출이 정확히 1곳`, n === 1, `${n}곳`);
    }
  }

  /* ---------- ⑥ 두 엔진 축·상수 ---------- */
  say('\n=== ⑥ 두 엔진(sim.js ↔ index.html) 일치 ===');
  for (const [nm, re] of AX) {
    const a = re.test(S), b = re.test(Hs);
    chk(`${nm} — 두 엔진 모두`, a && b, `sim.js ${a ? 'OK' : '없음'} · index.html ${b ? 'OK' : '없음'}`);
  }
  for (const [nm, val] of [['PERK_COLL_ATK', OWNER.atk], ['PERK_COLL_CRIT', OWNER.crit], ['PERK_COLL_HP', OWNER.hp]]) {
    const re = new RegExp(nm + '=([\\d.]+)');
    const a = S.match(re), b = Hs.match(re);
    chk(`상수 ${nm} = ${val} — 두 엔진 같은 값`,
      !!a && !!b && near(+a[1], val) && near(+b[1], val),
      `sim.js ${a ? a[1] : '없음'} · index.html ${b ? b[1] : '없음'}`);
  }
  /* 판정 순서 — 수집가·공격은 «장비 rage» 뒤·«실드 없을 때 공격력» 앞의 곱 사슬 한 칸이다.
     자리가 바뀌면 곱하는 대상이 달라져 값이 어긋난다. */
  for (const [who, src] of [['sim.js', S], ['index.html', Hs]]) {
    const iM = src.indexOf('letm=1+bsum(p,\'atk\');');
    const iC = src.indexOf('if(px.p_collAtk)m*=1+PERK_COLL_ATK*perkCountOf(p);');
    const iR = src.indexOf('returnp.dmg*m;');
    chk(`${who} — 수집가·공격이 effDmg 의 배수 사슬 안에 있다 (p.dmg 에 직접 안 건다)`,
      iM >= 0 && iC > iM && iR > iC, `${iM}/${iC}/${iR}`);
  }

  /* ---------- ⑦ ROUTINE 주인 문면 ---------- */
  say('\n=== ⑦ ROUTINE 주인 문면 ===');
  for (const [nm, re] of RULES) chk(`ROUTINE ${nm}`, re.test(routineSrc));

  return finish();
}

function finish() { return R.filter(x => !x.c).length; }

/* ================================================================ */
const simSrc = rd('sim.js');
const htmSrc = rd('index.html');
const routineSrc = rd('docs/ROUTINE.md');

if (process.argv.includes('--self')) {
  /* 음성 검사 — 심은 고장을 이 게이트가 실제로 잡는가.
     T126 규약: 돌연변이가 no-op(치환이 안 먹음)이면 그것부터 빨갛게 떨어뜨린다. */
  console.log('[음성 검사] 수집가 3종을 몰래 뒤집은 사본에서 이 게이트가 빨개지는가');
  const both = f => [f, f, null];
  const cases = [
    ['n 에서 자기 자신을 뺀다 (주인 «자기 자신 포함» 위반)',
      s => s.replace(/function perkCountOf\(p\)\{ return p\.G&&p\.G\.taken\?p\.G\.taken\.length:0; \}/,
        'function perkCountOf(p){ return Math.max(0,(p.G&&p.G.taken?p.G.taken.length:0)-1); }'),
      s => s.replace(/function perkCountOf\(p\)\{ return perkOrderN\(\); \}/,
        'function perkCountOf(p){ return Math.max(0,perkOrderN()-1); }'), null],
    ['수집가·체력이 현재 체력도 같이 올린다 (주인 «최대치만» 위반)',
      ...both(s => s.replace(/p\.maxHp=p\.maxHp\/\(p\.collHpF\|\|1\)\*f;/,
        'p.maxHp=p.maxHp/(p.collHpF||1)*f;p.hp=p.hp/(p.collHpF||1)*f;'))],
    ['수집가·체력을 실드에도 건다 (주인 «실드 무관» 위반)',
      ...both(s => s.replace(/p\.collHpF=f;/, 'p.maxSh=p.maxSh/(p.collHpF||1)*f;p.collHpF=f;'))],
    ['수집가·치명을 가산 → 곱연산으로',
      ...both(s => s.replace(/c\+=PERK_COLL_CRIT\*perkCountOf\(p\)/,
        'c*=1+PERK_COLL_CRIT*perkCountOf(p)/100'))],
    ['수집가·공격을 곱연산 → 가산으로',
      ...both(s => s.replace(/m\*=1\+PERK_COLL_ATK\*perkCountOf\(p\)/, 'm+=PERK_COLL_ATK*perkCountOf(p)'))],
    ['소급을 없앤다 — effDmg 에서 첫 계산값으로 굳힌다 (두 엔진 같은 문면)',
      ...both(s => s.replace(/if\(px\.p_collAtk\) ?m\*=1\+PERK_COLL_ATK\*perkCountOf\(p\);/,
        'if(px.p_collAtk){if(p.collAtkN==null)p.collAtkN=perkCountOf(p);m*=1+PERK_COLL_ATK*p.collAtkN;}'))],
    ['applyCollHp 의 «갈아끼우기» 를 «곱하기» 로 (부를 때마다 이중 곱)',
      ...both(s => s.replace(/p\.maxHp=p\.maxHp\/\(p\.collHpF\|\|1\)\*f;/, 'p.maxHp=p.maxHp*f;'))],
    ['수집가·체력의 배수를 곱누적(1.07^n)으로',
      ...both(s => s.replace(/const f=1\+PERK_COLL_HP\*n;/, 'const f=Math.pow(1+PERK_COLL_HP,n);'))],
    ['획득 확정 자리의 재계산을 지운다 (수집가·체력만 소급이 죽는다)',
      s => s.replace(/applyCollHp\(G\.player,G\.taken\.length\);/, '/* 제거 */'),
      s => s.replace(/applyCollHp\(G\.player,perkOrderN\(\)\);/, '/* 제거 */'), null],
    ['index.html 만 세는 자를 perkOrderN() → G.perksTaken.length (축복이 한 칸 올린다)',
      null, s => s.replace(/function perkCountOf\(p\)\{ return perkOrderN\(\); \}/,
        'function perkCountOf(p){ return G.perksTaken.length; }'), null],
    ['index.html perkOrderN 의 PERKS 필터를 지운다',
      null, s => s.replace(/function perkOrderN\(\)\{ let n=0; for\(const q of G\.perksTaken\) if\(PERKS\.includes\(q\)\) n\+\+; return n; \}/,
        'function perkOrderN(){ return G.perksTaken.length; }'), null],
    ['계수 하나만 흔든다 (sim.js PERK_COLL_HP 0.07 → 0.05)',
      s => s.replace('PERK_COLL_HP=0.07', 'PERK_COLL_HP=0.05'), null, null],
    ['수집가·공격을 p.dmg 에 직접 건다 (배수 사슬 밖 — 다른 배수와 순서가 어긋난다)',
      ...both(s => s.replace(/if\(px\.p_collAtk\) ?m\*=1\+PERK_COLL_ATK\*perkCountOf\(p\);/, '/* 제거 */')
        .replace(/ap:p=>p\.px\.p_collAtk=1\}/, 'ap:p=>{p.px.p_collAtk=1;p.dmg*=1.04;}}'))],
    ['ROUTINE 에서 «현재 체력 불변 · 곱연산 · 실드 무관» 을 지운다',
      null, null, s => s.replace('현재 체력 불변 · 곱연산 · 실드 무관', '현재 체력도 같이 오른다')],
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

console.log('=== 수집가 3종 게이트 (T144 · 주인 확정 T121 16:0X ①) ===');
const bad = run(simSrc, htmSrc, routineSrc, false);
console.log(`\n[수집가 게이트] 대조 ${R.length}항목 · 통과 ${R.length - bad} · 불합격 ${bad}` +
  (bad ? '' : ' → 통과 (자기 포함 · 소급 · 곱/가산 · 최대치만 · 실드 무관을 두 엔진에서 실제로 굴려서 잰다)'));
process.exit(bad ? 1 : 0);
