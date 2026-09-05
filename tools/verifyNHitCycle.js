#!/usr/bin/env node
/* ================================================================================
   verifyNHitCycle — ⚑⚑⚑ T143 (워커 A · sess-0705-20328)

   **주인 확정 T121 (2026-09-04 16:0X ① · 16:2X ⑤ · ⚑ 17:3X 정정)** 의 «N타마다» 특전 11종이
   «주인이 명시한 대로» 세는가를 **실제로 굴려서** 잰다.

     ⓐ 주기 (⚑ 17:3X 주인 정정 «3타 화살 시리즈는 2타로, 4타 시리즈는 3타로»)
        화살 **2타** · 도끼 **3타** · 번개 **3타** · 창 **3타** · 회복 **5타**
     ⓑ «N타» 의 뜻 — «**평타 횟수**(빗나감 포함 · 반격·소환 제외)»
     ⓒ 카운터 분리 — «같은 이름의 I/II/III 는 **서로 다른 특전**이라 … **N타 소환은 각자 카운터**»
     ⓓ 발수 — 표시 문구의 «화살 1개 / 2개 / 3개» 가 그대로 발사 인자다 (I=1 · II=2 · III=3)
     ⓔ 회복 — «**5타**마다 체력 **6%** 회복» · 최대 체력 기준 · 회복 증폭 적용

   ── 구멍을 먼저 증명했다 (T143 사본 실측 2벌) ──
   이 축을 재는 게이트가 **한 줄도 없었다.** 닿는 자는 한 곳뿐인데 그것도 «값» 만 본다:
     · `verifyPerkOrder` — `PERK_NHIT_ARROW:'2'` 처럼 **상수의 값**과 특전표의 **설명문**만 대조한다.
       그 상수를 «누가 · 언제 · 어떤 카운터로» 쓰는지는 안 본다. `NHIT_PERKS` 표·`procNHit`·
       호출 지점은 어느 게이트의 정규식에도 등장하지 않는다(`grep -rn "PERK_NHIT\|NHIT_PERKS\|procNHit" tools/`
       가 이 파일 이전에는 `verifyPerkOrder` 의 상수표 한 줄뿐이었다).
   그래서 사본 두 벌로 확인했다 — 두 엔진에서
     ① 카운터 키를 `p.nhit[t[0]]` → `p.nhit.all` **하나로 합치고**(주인 «각자 카운터» 위반),
        동시에 III 의 발수를 `fireArrows(p,3)` → `fireArrows(p,1)` 로 깎았더니
     ② `procNHit(p)` 를 `playerStrike` 에서 떼어 **`procOnAttack` 안으로 옮겼더니**
        (`procOnAttack` 은 `summonHit` 에서도 불린다 — 즉 **소환 적중이 평타로 세어진다**.
         주인 «반격·소환 제외» 위반)
   **두 벌 모두 정적 게이트 26종의 통과 수가 글자 하나 안 움직였다**
   (25 초록 · `verifyScoreCriteria` 56/8 그대로 · `verifyT2` 426). 주인이 두 번 정정까지 한 조항이
   조용히 뒤집혀도 아무도 못 잡는 상태였다.
   (② 는 사본을 만들 때 `procNHit` 에 `p.nhit` 가드를 넣어야 한다 — 안 넣으면 `verifySummonChain`
    의 **부분 틀**이 `undefined` 를 읽고 **크래시**한다. 크래시는 단언이 아니라 사고라
    «잡았다» 로 치지 않는다. 가드를 넣은 정상 모양 사본에서는 26종 전부 초록이었다.)

   ── 그래서 이 게이트가 하는 일 ──
   ① 표 — 두 엔진 `NHIT_PERKS` 11행이 1:1이고, 각 행의 **주기 상수**·**발사 동사**·**발수**가
      그 특전의 표시 문구(«2타마다 무작위 적에게 화살 3개»)와 글자 그대로 맞는다.
      주기 상수 5종의 값이 주인 17:3X 정정값(2·3·3·3·5)이다.
   ② 호출 지점 — `procNHit` 호출이 두 엔진에서 **`playerStrike` 안 딱 한 곳**이고
      **조건 없이** 불린다(= 빗나감도 1타). `procOnAttack`·`doCounter`·`summonHit`·
      `hitPlayer`·`procOnRanged` 어디에도 없다(= 반격·소환 제외).
   ③ 카운터 — `procNHit` 이 **행 키로** 인덱싱해 세고(공유 키 금지), 발동하면 그 키만 0 이 된다.
   ④ 실측 — `sim.js` 의 진짜 `playerStrike`·`doCounter`·`summonHit` 를 vm 에서 굴려
      주기·리셋·발수·빗나감 포함·반격/소환 제외·카운터 분리·5타 회복을 **센다**.
   ⑤ ROUTINE 에 주인 문면 3종이 살아 있다.

   ── 이 게이트를 고쳐도 되는 때 ──
   **주인이 «N타» 규칙을 새로 확정했을 때뿐이다.** 그때 아래 표·기대값을 갱신하고
   PROGRESS 에 주인 원문과 함께 남긴다 — 고치는 것 자체가 diff 에 드러나는 것이 요점이다.

   사용: node tools/verifyNHitCycle.js        (exit 0 = 통과, 1 = 불합격)
   음성: node tools/verifyNHitCycle.js --self (심은 고장 10종 + 양성 대조군)
   ================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ── 주인 확정표 (ROUTINE T121 ① · ⑤ · ⚑ 17:3X 정정) ─────────────────────────
   [px 키, 주기 상수 이름, 주기 값, 발사 동사, 발수, 문구의 소환 이름] */
const WANT = [
  ['p_nArrowN', 'PERK_NHIT_ARROW', 2, 'fireArrows', 1, '화살'],
  ['p_nArrowR', 'PERK_NHIT_ARROW', 2, 'fireArrows', 2, '화살'],
  ['p_nArrowL', 'PERK_NHIT_ARROW', 2, 'fireArrows', 3, '화살'],
  ['p_nAxeN',   'PERK_NHIT_AXE',   3, 'fireAxe',    1, '도끼'],
  ['p_nAxeR',   'PERK_NHIT_AXE',   3, 'fireAxe',    2, '도끼'],
  ['p_nAxeL',   'PERK_NHIT_AXE',   3, 'fireAxe',    3, '도끼'],
  ['p_nBoltN',  'PERK_NHIT_BOLT',  3, 'fireBolts',  1, '번개'],
  ['p_nBoltR',  'PERK_NHIT_BOLT',  3, 'fireBolts',  2, '번개'],
  ['p_nBoltL',  'PERK_NHIT_BOLT',  3, 'fireBolts',  3, '번개'],
  ['p_nSpearL', 'PERK_NHIT_SPEAR', 3, 'fireSpear',  1, '창'],
  ['p_nHealN',  'PERK_NHIT_HEAL',  5, 'heal',       0, '회복'],
];
const NHEAL_F = 0.06;          /* 5타 회복 — 최대 체력의 6% (⚑ 18:0X 재정정) */

/* «N타» 를 세면 안 되는 자리 — 반격·소환·피격 경로 */
const FORBIDDEN_FN = ['procOnAttack', 'doCounter', 'summonHit', 'hitPlayer', 'procOnRanged'];

/* ROUTINE 주인 문면 — 규칙을 지우고 동작을 뒤집는 경로를 막는다 */
const RULE_NHIT  = /«N타» = \*\*평타 횟수\*\*\(빗나감 포함 · 반격·소환 제외\)/;
const RULE_OWN   = /N타 소환은 각자 카운터/;
const RULE_FIX3X = /3타 화살 시리즈는 2타로, 4타 시리즈는 3타로/;

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
      '\n;globalThis.__K={PERKS,basePx,playerStrike,doCounter,summonHit,procNHit,NHIT_PERKS,' +
      'PERK_NHIT_ARROW,PERK_NHIT_AXE,PERK_NHIT_BOLT,PERK_NHIT_SPEAR,PERK_NHIT_HEAL,' +
      'PERK_NHEAL_F,ENEMY_EVADE,R_BOLT};', ctx);
  } catch (e) { return null; }
  const K = ctx.__K || (ctx.globalThis && ctx.globalThis.__K);
  return K ? { K, M } : null;
}

/* 웨이브 1개(적 `n` 마리) + 특전 `ids` 만 가진 플레이어. 적은 안 죽게 체력을 크게 준다. */
function arena(K, ids, n) {
  const nd = { type: 'wave', x: 0, done: false, enemies: [] };
  for (let j = 0; j < (n || 3); j++)
    nd.enemies.push({ worldX: 100 + j * 40, hp: 1e15, maxHp: 1e15, dmg: 1, ranged: false,
      atkTimer: 1, stun: 0, slow: 0, wave: nd, dead: false, isBoss: false, exp: 0 });
  const p = {
    worldX: 0, dmg: 100, aspd: 1, critR: 0, critF: 150, def: 0, counter: 0, evade: 0, steal: 0,
    killHeal: 0, misfire: 0, goldMul: 1, walkMul: 1, healAmp: 0, repairAmp: 0, nextCrit: false,
    nextAtk: 0, ward: 0, maxHp: 1e6, hp: 1, maxSh: 0, sh: 0, level: 1, exp: 0, critStk: 0,
    nhit: {}, collHpF: 1, atkTimer: 1, sureCrit: false, bsStk: 0, dash: false,
    buffs: { atk: [], aspd: [], critR: [], critF: [], def: [], evade: [] }, px: K.basePx(),
  };
  const G = { chapter: 1, player: p, nodes: [nd], pprojs: [], arrows: [], gold: 0, kills: 0,
    procN: 0, perkChances: 0, taken: [], overBoltCd: 0, autoBoltT: 3, autoSumT: 2, rampT: 3,
    stuns: 0, misses: 0, dead: false, cleared: true, t: 0, atkTries: 0, miss: 0, noPerk: true };
  p.G = G;
  for (const id of ids) {
    const k = K.PERKS.find(x => x.id === id);
    if (!k) return null;
    k.ap(p); G.taken.push(k);
  }
  return { G, p, nd };
}

/* ================================================================ */
const R = [];
let QUIET = true;
const chk = (name, pass, detail) => {
  const x = { name, c: !!pass, d: detail == null ? '' : String(detail) };
  R.push(x);
  if (!QUIET) console.log(`  ${x.c ? '✓' : '✗'} ${x.name}${x.c ? '' : '  — ' + x.d}`);
};

/* 소스에서 함수 본문 하나를 잘라낸다 (중괄호 균형). 못 찾으면 null. */
function bodyOf(src, name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{').exec(src);
  if (!m) return null;
  let i = m.index + m[0].length, depth = 1;
  for (; i < src.length && depth > 0; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
  }
  return src.slice(m.index + m[0].length, i - 1);
}

/* `NHIT_PERKS` 표를 소스에서 파싱한다 → [{key, cst, verb, cnt, raw}] */
function parseTable(src) {
  const m = /const NHIT_PERKS\s*=\s*\[([\s\S]*?)\n\];/.exec(src);
  if (!m) return null;
  const rows = [];
  const re = /\[\s*'(p_[A-Za-z]+)'\s*,\s*([A-Z_]+)\s*,\s*p\s*=>\s*([A-Za-z]+)\(\s*p\s*,\s*([^)]*?)\s*\)\s*\]/g;
  let x;
  while ((x = re.exec(m[1]))) rows.push({ key: x[1], cst: x[2], verb: x[3], arg: x[4], raw: x[0] });
  return rows;
}

/* 특전 표시 문구를 두 엔진에서 뽑는다 → {id: 문구} */
function perkText(simSrc, htmSrc) {
  /* `index.html` 은 굵게 표시(`<b>`)가 섞여 있다 — verifyPerkOrder 와 같은 방식으로 벗긴다 */
  const strip = t => t.replace(/<\/?b>/g, '').replace(/\s+/g, ' ').trim();
  const s = {}, h = {};
  for (const m of simSrc.matchAll(/\{id:'(p_[A-Za-z]+)',\s*g:\d,\s*nm:'([^']*)',\s*d:'([^']*)'/g)) s[m[1]] = { nm: m[2], tx: strip(m[3]) };
  for (const m of htmSrc.matchAll(/\{id:'(p_[A-Za-z]+)',\s*g:\d,\s*nm:'([^']*)',\s*ic:'[^']*',\s*tx:'([^']*)'/g)) h[m[1]] = { nm: m[2], tx: strip(m[3]) };
  return { s, h };
}

function run(simSrc, htmSrc, routineSrc, quiet) {
  R.length = 0;
  QUIET = !!quiet;
  const say = quiet ? () => {} : console.log;

  /* ---------- ① 표 대조 — 주인 표 ↔ 두 엔진 NHIT_PERKS ↔ 특전 문구 ---------- */
  say('\n=== ① ⚑ «N타마다» 표 — 주인 확정 주기·발수 ↔ 두 엔진 NHIT_PERKS ↔ 특전 문구 ===');
  const tS = parseTable(simSrc), tH = parseTable(htmSrc);
  const TX = perkText(simSrc, htmSrc);
  if (!tS || !tH) {
    chk('두 엔진에서 NHIT_PERKS 표를 찾는다', false,
      `sim ${tS ? tS.length + '행' : '없음'} · index ${tH ? tH.length + '행' : '없음'} — 표 이름/모양이 바뀌었다. 게이트를 함께 고칠 것`);
    return finish(say, quiet);
  }
  chk(`sim.js NHIT_PERKS 가 ${WANT.length}행이고 주인 표와 순서까지 같다`,
    tS.map(r => r.key).join() === WANT.map(w => w[0]).join(), `${tS.length}행 · ${tS.map(r => r.key).join()}`);
  chk('index.html NHIT_PERKS 가 같은 수·같은 순서다 (두 엔진 1:1)',
    tH.map(r => r.key).join() === tS.map(r => r.key).join(), `${tH.length}행`);

  for (let i = 0; i < WANT.length; i++) {
    const [key, cst, cyc, verb, cnt, kind] = WANT[i];
    const rs = tS[i], rh = tH[i];
    if (!rs || !rh) { chk(`${key} 행이 두 엔진에 있다`, false, `sim ${!!rs} · index ${!!rh}`); continue; }
    chk(`${key} — 주기 상수가 ${cst} 다 (두 엔진 같은 이름)`,
      rs.cst === cst && rh.cst === cst, `sim ${rs.cst} · index ${rh.cst}`);
    chk(`${key} — 발사 동사가 ${verb} 다 (두 엔진 같은 동사)`,
      rs.verb === verb && rh.verb === verb, `sim ${rs.verb} · index ${rh.verb}`);
    if (kind === '회복') {
      chk(`${key} — 회복량이 «최대 체력 × PERK_NHEAL_F» 다 (최대 체력 기준 · 주인 «체력 6%»)`,
        /^p\.maxHp\*PERK_NHEAL_F$/.test(rs.arg.replace(/\s/g, '')) &&
        /^p\.maxHp\*PERK_NHEAL_F$/.test(rh.arg.replace(/\s/g, '')), `sim «${rs.arg}» · index «${rh.arg}»`);
    } else {
      chk(`${key} — 발수가 ${cnt} 다 (두 엔진 같은 인자)`,
        rs.arg.trim() === String(cnt) && rh.arg.trim() === String(cnt), `sim «${rs.arg}» · index «${rh.arg}»`);
    }
    /* 문구 ↔ 배선 — «N타마다 … M개» 가 표의 [주기, 발수] 와 글자 그대로 맞는가 */
    const ts = TX.s[key], th = TX.h[key];
    if (!ts || !th) { chk(`${key} — 두 엔진 특전표에 문구가 있다`, false, `sim ${!!ts} · index ${!!th}`); continue; }
    for (const [who, t] of [['sim.js', ts], ['index.html', th]]) {
      const mc = /^(\d+)타마다/.exec(t.tx);
      chk(`${key} — ${who} 문구의 «N타» 가 ${cyc} 다 (주기 상수와 같은 수)`,
        !!mc && +mc[1] === cyc, `문구 «${t.tx}»`);
      if (kind !== '회복') {
        const mn = new RegExp(kind + '\\s*(\\d+)\\s*(?:개|회|발)').exec(t.tx);
        chk(`${key} — ${who} 문구의 «${kind} N개» 가 ${cnt} 다 (발사 인자와 같은 수)`,
          !!mn && +mn[1] === cnt, `문구 «${t.tx}»`);
      } else {
        chk(`${key} — ${who} 문구가 «최대 체력 ${NHEAL_F * 100}% 회복» 이다`,
          new RegExp('체력\\s*' + NHEAL_F * 100 + '%').test(t.tx), `문구 «${t.tx}»`);
      }
    }
  }

  /* 주기 상수 5종의 값 (⚑ 17:3X 주인 정정) — 두 엔진 같은 이름·같은 값 */
  const CYC = {};
  for (const w of WANT) CYC[w[1]] = w[2];
  for (const [cst, val] of Object.entries(CYC)) {
    for (const [who, src] of [['sim.js', simSrc], ['index.html', htmSrc]]) {
      const m = new RegExp(cst + '\\s*=\\s*(\\d+)').exec(src);
      chk(`${who} ${cst} = ${val} (⚑ 17:3X 주인 정정)`, !!m && +m[1] === val, m ? m[1] : '못 찾음');
    }
  }
  for (const [who, src] of [['sim.js', simSrc], ['index.html', htmSrc]]) {
    const m = /PERK_NHEAL_F\s*=\s*([\d.]+)/.exec(src);
    chk(`${who} PERK_NHEAL_F = ${NHEAL_F} (주인 «체력 6%»)`, !!m && +m[1] === NHEAL_F, m ? m[1] : '못 찾음');
  }

  /* ---------- ② 호출 지점 — «평타 전용 · 빗나감 포함» ---------- */
  say('\n=== ② ⚑ 호출 지점 — «N타» = 평타 횟수(빗나감 포함 · 반격·소환 제외) ===');
  for (const [who, src] of [['sim.js', simSrc], ['index.html', htmSrc]]) {
    const calls = [...src.matchAll(/procNHit\s*\(/g)].length;
    chk(`${who} — procNHit 호출이 딱 1곳이다 (정의 1개 + 호출 1개)`,
      calls === 2, `${calls}회 등장 (정의 포함)`);
    const ps = bodyOf(src, 'playerStrike');
    if (!ps) { chk(`${who} — playerStrike 본문을 찾는다`, false, '함수 모양이 바뀌었다'); continue; }
    chk(`${who} — 그 한 곳이 playerStrike 안이다 (평타 전용)`, /procNHit\s*\(/.test(ps), '없다');
    /* 조건 없이 불려야 «빗나감도 1타» 다 — 호출 줄이 if/&&/?: 뒤에 붙어 있으면 안 된다 */
    const line = (ps.split('\n').find(l => /procNHit\s*\(/.test(l)) || '').trim();
    chk(`${who} — 조건 없이 불린다 (빗나감도 1타 — 주인 «빗나감 포함»)`,
      /^procNHit\s*\(\s*p\s*\)\s*;$/.test(line), `호출 줄 «${line}»`);
    for (const fn of FORBIDDEN_FN) {
      const b = bodyOf(src, fn);
      if (b == null) { chk(`${who} — ${fn} 본문을 찾는다`, false, '함수가 없다/이름이 바뀌었다'); continue; }
      chk(`${who} — ${fn} 안에서는 안 센다 (반격·소환·피격 제외)`, !/procNHit\s*\(/.test(b), '호출이 있다');
    }
  }

  /* ---------- ③ 카운터 분리 — «I/II/III 는 각자 카운터» ---------- */
  say('\n=== ③ ⚑ 카운터 분리 — «같은 이름의 I/II/III 는 서로 다른 특전이라 각자 카운터» ===');
  for (const [who, src] of [['sim.js', simSrc], ['index.html', htmSrc]]) {
    const b = bodyOf(src, 'procNHit');
    if (b == null) { chk(`${who} — procNHit 본문을 찾는다`, false, '함수가 없다'); continue; }
    const nb = b.replace(/\s+/g, '');
    chk(`${who} — 카운터를 «행 키» 로 인덱싱해 읽는다 (공유 키 금지)`,
      /const\s*c=\(p\.nhit\[t\[0\]\]\|\|0\)\+1;/.test(nb), `본문 «${nb.slice(0, 120)}»`);
    chk(`${who} — 발동하면 그 행 키만 0 이 된다 (다른 특전 카운터를 안 건드린다)`,
      /p\.nhit\[t\[0\]\]=0;/.test(nb), '리셋이 행 키가 아니다');
    chk(`${who} — 안 걸리면 그 행 키만 올린다`, /elsep\.nhit\[t\[0\]\]=c;/.test(nb), '누적이 행 키가 아니다');
    const shared = /p\.nhit\.[A-Za-z_$][\w$]*/.exec(nb);
    chk(`${who} — 공유 카운터(리터럴 속성)를 쓰지 않는다`, !shared, shared ? `«${shared[0]}»` : '');
  }

  /* ---------- ④ 실측 — sim.js 엔진을 그대로 굴려서 센다 ---------- */
  say('\n=== ④ ⚑ 실측 — sim.js 의 진짜 playerStrike·doCounter·summonHit 로 센다 ===');
  const L = loadSim(simSrc);
  if (!L) { chk('sim.js 전투 함수 적재', false, 'vm 적재 실패 — 함수 이름이나 CLI 디스패처 위치가 바뀌었다. 게이트를 함께 고칠 것'); return finish(say, quiet); }
  const { K, M } = L;
  const HIT = () => 0.5;    /* 치명 굴림 통과 못 함 · 회피(0.5 < 0.10 거짓) 안 걸림 = 반드시 적중 */
  const MISS = () => 0.05;  /* 회피(0.05 < 0.10 참) = 반드시 빗나감 */

  /* ⓐ 주기 2 · 리셋 — 2타마다 화살 1발 */
  {
    M.random = HIT;
    const a = arena(K, ['p_nArrowN'], 3);
    if (!a) { chk('특전 id 확인', false, 'p_nArrowN 을 못 찾았다'); return finish(say, quiet); }
    const seen = [];
    for (let i = 0; i < 6; i++) { K.playerStrike(a.G, a.nd.enemies[0]); seen.push(a.G.pprojs.length); }
    chk('2타 화살 I — 1타에는 안 나가고 2타에 1발 (주기 2)', seen[0] === 0 && seen[1] === 1, `누적 ${seen.join('·')}`);
    chk('2타 화살 I — 3타에 그대로, 4타에 또 1발 (발동 뒤 카운터가 0 으로 리셋)',
      seen[2] === 1 && seen[3] === 2, `누적 ${seen.join('·')}`);
    chk('2타 화살 I — 6타까지 정확히 3발 (2·4·6)', seen[5] === 3, `누적 ${seen.join('·')}`);
  }

  /* ⓑ 발수 I/II/III */
  {
    M.random = HIT;
    for (const [id, cnt] of [['p_nArrowN', 1], ['p_nArrowR', 2], ['p_nArrowL', 3]]) {
      const a = arena(K, [id], 3);
      K.playerStrike(a.G, a.nd.enemies[0]);
      K.playerStrike(a.G, a.nd.enemies[0]);
      chk(`${id} — 2타에 화살 ${cnt}발 (문구의 발수 그대로)`, a.G.pprojs.length === cnt, `${a.G.pprojs.length}발`);
    }
  }

  /* ⓒ 카운터 분리 — 셋 다 가지면 2타에 1+2+3 = 6발이 «한꺼번에» */
  {
    M.random = HIT;
    const a = arena(K, ['p_nArrowN', 'p_nArrowR', 'p_nArrowL'], 3);
    K.playerStrike(a.G, a.nd.enemies[0]);
    const at1 = a.G.pprojs.length;
    K.playerStrike(a.G, a.nd.enemies[0]);
    chk('I·II·III 를 같이 가지면 1타에는 0발 (셋 다 자기 카운터 · 공유 카운터면 여기서 터진다)',
      at1 === 0, `${at1}발`);
    chk('I·II·III 를 같이 가지면 2타에 1+2+3 = 6발 (각자 카운터 — 주인 명시)',
      a.G.pprojs.length === 6, `${a.G.pprojs.length}발`);
  }

  /* ⓓ 주기가 다른 특전이 섞여도 서로 안 밀린다 — 화살(2) + 도끼(3) 를 6타 */
  {
    M.random = HIT;
    const a = arena(K, ['p_nArrowN', 'p_nAxeN'], 3);
    for (let i = 0; i < 6; i++) K.playerStrike(a.G, a.nd.enemies[0]);
    const arrow = a.G.pprojs.filter(x => x.type === 'parrow').length;
    const axe = a.G.pprojs.filter(x => x.type === 'axe').length;
    chk('화살(2타)+도끼(3타) 를 6타 — 화살 3발 · 도끼 2발 (주기가 서로 안 섞인다)',
      arrow === 3 && axe === 2, `화살 ${arrow} · 도끼 ${axe}`);
  }

  /* ⓔ 빗나감 포함 — 두 번 다 빗맞아도 2타째에 화살이 나간다 */
  {
    M.random = MISS;
    const a = arena(K, ['p_nArrowN'], 3);
    K.playerStrike(a.G, a.nd.enemies[0]);
    K.playerStrike(a.G, a.nd.enemies[0]);
    chk('빗나감도 1타로 센다 — 평타 2회가 전부 빗맞아도 화살 1발 (주인 «빗나감 포함»)',
      a.G.miss === 2 && a.G.pprojs.length === 1, `빗맞음 ${a.G.miss} · 화살 ${a.G.pprojs.length}`);
  }

  /* ⓕ 반격 제외 */
  {
    M.random = HIT;
    const a = arena(K, ['p_nArrowN'], 3);
    for (let i = 0; i < 8; i++) K.doCounter(a.G, a.nd.enemies[0]);
    chk('반격은 «N타» 를 안 센다 — 반격 8회에도 화살 0발 · 카운터 0 (주인 «반격 제외»)',
      a.G.pprojs.length === 0 && !a.p.nhit.p_nArrowN, `화살 ${a.G.pprojs.length} · 카운터 ${a.p.nhit.p_nArrowN || 0}`);
  }

  /* ⓖ 소환 제외 — 소환 적중(summonHit)은 procOnAttack 을 거치지만 평타가 아니다 */
  {
    M.random = HIT;
    const a = arena(K, ['p_nArrowN'], 3);
    for (let i = 0; i < 8; i++) K.summonHit(a.G, a.nd.enemies[0], 0.3);
    chk('소환 적중은 «N타» 를 안 센다 — 8회에도 화살 0발 · 카운터 0 (주인 «소환 제외»)',
      a.G.pprojs.length === 0 && !a.p.nhit.p_nArrowN, `화살 ${a.G.pprojs.length} · 카운터 ${a.p.nhit.p_nArrowN || 0}`);
  }

  /* ⓗ 5타 회복 — 4타에는 0 · 5타에 최대 체력 6% */
  {
    M.random = HIT;
    const a = arena(K, ['p_nHealN'], 3);
    a.p.hp = 1;
    for (let i = 0; i < 4; i++) K.playerStrike(a.G, a.nd.enemies[0]);
    const at4 = a.p.hp;
    K.playerStrike(a.G, a.nd.enemies[0]);
    const gained = a.p.hp - at4;
    chk('5타 회복 — 4타까지는 회복 0 (주기 5)', at4 === 1, `체력 ${at4}`);
    chk(`5타 회복 — 5타에 최대 체력의 ${NHEAL_F * 100}% 회복 (최대 체력 기준)`,
      Math.abs(gained - a.p.maxHp * NHEAL_F) < 1e-6, `회복량 ${gained} · 기대 ${a.p.maxHp * NHEAL_F}`);
  }

  /* ⓘ 창 — 3타에 창 1개 (관통형) */
  {
    M.random = HIT;
    const a = arena(K, ['p_nSpearL'], 3);
    for (let i = 0; i < 3; i++) K.playerStrike(a.G, a.nd.enemies[0]);
    const sp = a.G.pprojs.filter(x => x.type === 'spear').length;
    chk('3타 창 — 3타에 창 1개', sp === 1, `${sp}개`);
  }

  /* ⓙ 특전이 없으면 카운터 자체가 안 돈다 (다른 축이 몰래 굴리지 않는다) */
  {
    M.random = HIT;
    const a = arena(K, [], 3);
    for (let i = 0; i < 6; i++) K.playerStrike(a.G, a.nd.enemies[0]);
    chk('특전이 없으면 소환이 하나도 안 나간다 (대조군)', a.G.pprojs.length === 0, `${a.G.pprojs.length}발`);
  }

  /* ---------- ⑤ ROUTINE 주인 문면 ---------- */
  say('\n=== ⑤ ROUTINE 주인 문면 (지우면 규칙 근거가 사라진다) ===');
  chk('ROUTINE 에 «N타 = 평타 횟수(빗나감 포함 · 반격·소환 제외)» 가 있다', RULE_NHIT.test(routineSrc));
  chk('ROUTINE 에 «N타 소환은 각자 카운터» 가 있다', RULE_OWN.test(routineSrc));
  chk('ROUTINE 에 ⚑ 17:3X 정정 «3타 화살 시리즈는 2타로, 4타 시리즈는 3타로» 가 있다', RULE_FIX3X.test(routineSrc));

  return finish(say, quiet);
}

function finish(say, quiet) {
  const bad = R.filter(x => !x.c).length;
  if (!quiet && bad) { say('\n--- 불합격 ---'); for (const x of R) if (!x.c) say(`  ✗ ${x.name} — ${x.d}`); }
  return bad;
}

/* ================================================================ */
const simSrc = rd('sim.js');
const htmSrc = rd('index.html');
const routineSrc = rd('docs/ROUTINE.md');

if (process.argv.includes('--self')) {
  /* 음성 검사 — 심은 고장을 이 게이트가 실제로 잡는가.
     T126 규약: 돌연변이가 no-op(치환이 안 먹음)이면 그것부터 빨갛게 떨어뜨린다. */
  console.log('[음성 검사] «N타마다» 규약을 몰래 뒤집은 사본에서 이 게이트가 빨개지는가');
  const both = f => [f, f, null];
  const guard = s => s.replace(/function procNHit\(p\)\{\s*\n?\s*const px=p\.px;/,
    'function procNHit(p){\n  const px=p.px; if(!p.nhit)p.nhit={};');
  const cases = [
    ['카운터를 하나로 합치면 (주인 «각자 카운터» 위반)',
      ...both(s => s.replace(/p\.nhit\[t\[0\]\]/g, 'p.nhit.all'))],
    ['발동해도 카운터를 리셋하지 않으면 (한 번 차면 매 타마다 터진다)',
      ...both(s => s.replace(/p\.nhit\[t\[0\]\]=0;/g, ''))],
    ['III 의 발수를 3 → 1 로 깎으면 (문구 «화살 3개» 와 어긋난다)',
      ...both(s => s.replace(/'p_nArrowL',PERK_NHIT_ARROW,p=>fireArrows\(p,3\)/g,
        "'p_nArrowL',PERK_NHIT_ARROW,p=>fireArrows(p,1)"))],
    ['화살 주기를 2 → 3 으로 되돌리면 (⚑ 17:3X 주인 정정 이전 값)',
      ...both(s => s.replace(/PERK_NHIT_ARROW=2/g, 'PERK_NHIT_ARROW=3'))],
    ['도끼 주기를 3 → 4 로 되돌리면 (⚑ 17:3X 주인 정정 이전 값)',
      ...both(s => s.replace(/PERK_NHIT_AXE=3/g, 'PERK_NHIT_AXE=4'))],
    ['procNHit 을 procOnAttack 으로 옮기면 (소환 적중이 평타로 세어진다 — 주인 «소환 제외» 위반)',
      ...both(s => guard(s
        .replace(/\n(\s*)procNHit\(p\);\n\}/, '\n}')
        .replace(/function procOnAttack\((G,e|e)\)\{/, 'function procOnAttack($1){\n  procNHit(G.player);')))],
    ['반격에서도 세면 (주인 «반격 제외» 위반)',
      ...both(s => guard(s.replace(/function doCounter\(G,src,depth\)\{/, 'function doCounter(G,src,depth){\n  procNHit(G.player);')
        .replace(/function doCounter\(src,depth\)\{/, 'function doCounter(src,depth){\n  procNHit(G.player);')))],
    ['빗맞은 평타를 안 세면 (주인 «빗나감 포함» 위반)',
      ...both(s => s.replace(/\n(\s*)procNHit\(p\);/, '\n$1if(crit!==false)procNHit(p);'))],
    ['5타 회복을 «최대 체력» 이 아니라 고정값으로 바꾸면',
      ...both(s => s.replace(/p=>heal\(p,p\.maxHp\*PERK_NHEAL_F\)/g, 'p=>heal(p,100)'))],
    ['ROUTINE 에서 «N타 소환은 각자 카운터» 를 지우면',
      null, null, s => s.replace('N타 소환은 각자 카운터', 'N타 소환은 공용 카운터')],
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

console.log('=== «N타마다» 카운터 규약 게이트 (T143 · 주인 확정 T121 16:0X·16:2X·⚑ 17:3X) ===');
const bad = run(simSrc, htmSrc, routineSrc, false);
console.log(`\n[«N타마다» 게이트] 대조 ${R.length}항목 · 통과 ${R.length - bad} · 불합격 ${bad}` +
  (bad ? '' : ' → 통과 (주기·발수·리셋·빗나감 포함·반격/소환 제외·카운터 분리를 sim.js 엔진에서 실제로 굴려서 잰다)'));
process.exit(bad ? 1 : 0);
