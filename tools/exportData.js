#!/usr/bin/env node
/* ⚑⚑⚑ T170 — 게임 수치 JSON 내보내기 (유니티 이식용)
 *
 * 주인 지시 (2026-09-06 KST 00:0X): «게임 수치를 JSON 으로 내보내는 도구 — 유니티는 코드가 아니라
 * 수치만 가져간다. sim.js·index.html 이 정본이므로 손으로 베끼지 않고 도구가 뽑는다.»
 *
 * 사용:
 *   node tools/exportData.js            data/*.json 을 전부 다시 쓴다
 *   node tools/exportData.js --check    다시 뽑아 커밋된 파일과 비교 (게이트용 · exit 1 = 드리프트)
 *
 * 규약 (주인 지시 ①):
 *  · 값은 **엔진에서 직접** 읽는다. sim.js 를 다른 게이트와 같은 방식으로 vm 컨텍스트에 올려
 *    (CLI 디스패처 앞에서 자른다) 실제 객체·함수를 호출해 뽑는다. 소스 문자열에서 «값» 을 긁지 않는다.
 *    ⚠ 예외 두 곳은 README 에 명기했다 — ⓐ `index.html` 에만 있는 UI 상수(브라우저 DOM 없이 못 올린다)
 *      ⓑ 이름 없는 전투 리터럴(132·74·105·440 …)은 엔진 **함수 객체의 소스**(`Function.toString()`)에서
 *      뽑는다. 둘 다 값이 바뀌면 재생성 결과가 바뀌므로 `--check` 드리프트 게이트는 그대로 작동한다.
 *  · 숫자는 그대로(반올림·재해석 금지) · 키는 영문 camelCase · 배열 순서 = 엔진 순서.
 *  · 파일마다 `_source`(= `sim.js@<blob SHA>`)와 `_generatedAt`.
 *    ⚑ 위임 — `_source` 의 SHA 는 «커밋 SHA» 가 아니라 **sim.js 내용의 git blob SHA** 다. 커밋 SHA 로 두면
 *      sim.js 와 무관한 커밋마다 `--check` 가 빨개져 게이트가 못 쓰게 된다(내용 해시는 sim.js 가 바뀔 때만
 *      움직인다 = 주인이 말한 «원본이 바뀌면 다시 뽑는다» 그 자체다). 다르게 원하시면 한 줄로 정정.
 *  · `--check` 는 `_generatedAt` 한 줄만 같은 자리에 놓고 비교한다(시각은 내용이 아니다 — README ⓒ).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------- 엔진 적재 (다른 게이트와 같은 수법 — CLI 디스패처를 잘라낸다) ---------- */
function loadSim(src) {
  const body = src.replace(/const mode=process\.argv[\s\S]*$/,
    /* eval 은 이 스크립트 스코프에서 도므로 최상위 const·function 을 전부 이름으로 집을 수 있다.
       («이름» 은 소스에서 모으고 «값» 은 여기서 읽는다 — 값 파싱 금지 규약.) */
    'module.exports={ get:n=>{ try{ return eval(n); }catch(e){ return undefined; } } };');
  const m = { exports: {} };
  vm.runInNewContext(body, { module: m, exports: m.exports, process, console: { log() {} }, require });
  return m.exports;
}

const SIM_SRC = rd('sim.js');
const HTML_SRC = rd('index.html');
const S = loadSim(SIM_SRC);
const G = n => S.get(n);

/* sim.js 내용의 git blob SHA (git 없이 계산 — `git hash-object sim.js` 와 같은 값) */
const blobSha = s => crypto.createHash('sha1')
  .update(Buffer.concat([Buffer.from(`blob ${Buffer.byteLength(s)}\0`), Buffer.from(s)])).digest('hex');
const SIM_SHA = blobSha(SIM_SRC);

/* ---------- 공통 도구 ---------- */
const GEN_KEY = '_generatedAt';
const HTML_SHA = blobSha(HTML_SRC);
const head = (extra, src) => Object.assign({ _source: src || `sim.js@${SIM_SHA}`, [GEN_KEY]: new Date().toISOString() }, extra || {});

/* 이름은 소스에서, 값은 엔진에서 — 대문자 상수 자동 수집 */
function constNames(re) {
  const out = [];
  for (const m of SIM_SRC.matchAll(/\b([A-Z][A-Z0-9_]{1,})\s*=/g)) if (re.test(m[1]) && out.indexOf(m[1]) < 0) out.push(m[1]);
  out.sort();
  return out;
}
function constMap(re) {
  const o = {};
  for (const n of constNames(re)) {
    const v = G(n);
    if (v === undefined || typeof v === 'function') continue;
    o[n] = v;
  }
  return o;
}

/* 엔진 함수 객체의 소스에서 «이름 없는 리터럴» 을 집는다 (README ⓑ — 값이 바뀌면 --check 가 잡는다) */
function litFrom(fnName, re, label) {
  const f = G(fnName);
  if (typeof f !== 'function') throw new Error(`엔진 함수 ${fnName} 없음`);
  const m = f.toString().match(re);
  if (!m) throw new Error(`${fnName} 에서 «${label}» 리터럴을 못 찾았다 — exportData.js 의 정규식을 고칠 것`);
  return Number(m[1]);
}
function litHtml(re, label) {
  const m = HTML_SRC.match(re);
  if (!m) throw new Error(`index.html 에서 «${label}» 을 못 찾았다 — exportData.js 의 정규식을 고칠 것`);
  return m[1];
}
/* `2/3`·`ENEMY_GAP-7` 처럼 식으로 적힌 상수는 두 엔진 공통 상수를 넣고 계산해 «값» 으로 뽑는다 */
function htmlNum(re, label) {
  const src = litHtml(re, label).trim();
  const v = vm.runInNewContext(src, { ENEMY_GAP: G('ENEMY_GAP'), NODE_GAP: G('NODE_GAP') });
  if (typeof v !== 'number' || !isFinite(v)) throw new Error(`index.html 의 «${label}» 이 숫자가 아니다: ${src}`);
  return v;
}

/* 특전·장비 옵션의 «효과» 를 실제 `ap()` 를 돌려 뽑는다 (문구 파싱이 아니라 동작 실측) */
const PROBE_STATS = ['dmg', 'maxHp', 'hp', 'maxSh', 'sh', 'aspd', 'critR', 'critF', 'counter',
  'def', 'evade', 'steal', 'repairAmp', 'walkMul', 'misfire', 'ward'];
function probeEffect(ap) {
  const base = G('basePx')();
  const touched = {};
  const px = new Proxy(base, {
    get: (t, k) => (k in t ? t[k] : 0),
    set: (t, k, v) => { t[k] = v; touched[k] = v; return true; },
  });
  const p = { px };
  for (const k of PROBE_STATS) p[k] = 0;
  p.dmg = 100; p.maxHp = 1000; p.hp = 1000; p.maxSh = 1000; p.sh = 1000; p.aspd = 1; p.walkMul = 1;
  const before = {}; for (const k of PROBE_STATS) before[k] = p[k];
  let err = null;
  try { ap(p); } catch (e) { err = String(e && e.message || e); }
  const stat = {};
  for (const k of PROBE_STATS) if (p[k] !== before[k]) stat[k] = { from: before[k], to: p[k] };
  const flags = {};
  for (const k of Object.keys(touched).sort()) flags[k] = touched[k];
  const o = {};
  if (Object.keys(stat).length) o.stat = stat;
  if (Object.keys(flags).length) o.px = flags;
  if (err) o._error = err;
  return o;
}

/* ---------- ① data/tune.json ---------- */
function buildTune() {
  const T = G('TUNE');
  const tune = {};
  for (const k of Object.keys(T)) if (typeof T[k] !== 'function') tune[k] = T[k];
  const expNeed = G('TUNE').expNeed;
  const expNeedTable = [];
  for (let lv = 1; lv <= 30; lv++) expNeedTable.push({ level: lv, need: expNeed(lv), cum: expNeedTable.length ? expNeedTable[lv - 2].cum + expNeed(lv) : expNeed(lv) });
  return head({
    _note: '적 난이도 노브(기저·구간 성장률·벽)와 플레이어 기본치·경제 상수. 단위: 배수(무단위) · 골드/경험치는 점수.',
    tune,
    expNeedTable,
    goldFormula: {
      kill: 'goldKill(c) = (goldKillBase + goldKillPer*c) * goldGrowth^(c-1) * rand(1,1.8)',
      clear: 'goldClear(c) = goldClearPer * c * goldGrowth^(c-1)',
      expNeed: 'expNeed(lv) = 5*lv + 1',
    },
  });
}

/* ---------- ② data/enemies.json ---------- */
function buildEnemies() {
  const T = G('TUNE'), enemyStats = G('enemyStats'), chapterLayout = G('chapterLayout');
  const chapterEnemyCount = G('chapterEnemyCount'), chapterWaveSizes = G('chapterWaveSizes');
  const WAVES = G('LAYOUT_WAVES');
  const chapters = [];
  for (let c = 1; c <= T.maxChapter; c++) {
    const layout = chapterLayout(c);
    const waves = [];
    let wi = 0, ranged = 0;
    const nodes = layout.map(nd => {
      if (nd.t !== 'wave') return { t: nd.t };
      const st = enemyStats(c, wi);
      waves.push({ w: wi, size: nd.size, hp: st.hp, dmg: st.dmg });
      wi++;
      ranged += nd.ranged.filter(Boolean).length;
      return { t: 'wave', size: nd.size, ranged: nd.ranged.slice() };
    });
    const bst = enemyStats(c, wi);
    chapters.push({
      c,
      enemyCount: chapterEnemyCount(c),
      waveSizes: chapterWaveSizes(c),
      rangedCount: ranged,
      nodes,
      waves,
      boss: { w: wi, hp: bst.hp * T.bossHp, dmg: bst.dmg * T.bossDmg, baseHp: bst.hp, baseDmg: bst.dmg },
    });
  }
  return head({
    _note: '챕터 1~' + T.maxChapter + ' 전수. nodes = 노드 순서(챕터 시드 고정 · wave/rest/devil/angel/boss). '
      + 'waves[].hp/dmg = 그 웨이브 일반 적 1마리 스탯(정수 반올림 뒤 값). boss = 그 챕터 보스(= 마지막 웨이브 인덱스 스탯 × bossHp/bossDmg).',
    layout: {
      waves: WAVES, rests: G('LAYOUT_RESTS'), maxEnemy: G('LAYOUT_MAXENEMY'),
      enemyCurve: G('ENEMY_CURVE'), rangedCurve: G('RANGED_CURVE'),
      nodeGap: G('NODE_GAP'), nodeGapEvent: G('NODE_GAP_EVENT'), enemyGap: G('ENEMY_GAP'),
    },
    walls: {
      wallAt10: { hp: T.wallHp, dmg: T.wallDmg }, wallAt15: { hp: T.wall2Hp, dmg: T.wall2Dmg },
      wallAt90: { hp: T.wall3Hp, dmg: T.wall3Dmg }, wallFinal: { at: T.wall4At, hp: T.wall4Hp, dmg: T.wall4Dmg },
      waveIndex: { hp: T.waveHp, dmg: T.waveDmg },
    },
    boss: { hpMul: T.bossHp, dmgMul: T.bossDmg, sizeMul: 1.7, tripleHitMul: 2.2, tripleHitEvery: 3, stunMul: G('STUN_BOSS_MUL') },
    chapters,
  });
}

/* ---------- ③ data/perks.json ---------- */
function buildPerks() {
  const PERKS = G('PERKS'), NAME = G('PERK_GRADE_NAME');
  const perks = PERKS.map((p, i) => ({
    order: i, id: p.id, name: p.nm, desc: p.d, grade: p.g, gradeName: NAME[p.g],
    effect: probeEffect(p.ap),
  }));
  const byGrade = [0, 1, 2].map(g => perks.filter(p => p.grade === g).length);
  return head({
    _note: '특전 ' + perks.length + '종. order = §3.1 표 순서(= 시뮬 우선순위). effect 는 실제 ap() 를 '
      + '탐침 플레이어에 적용해 뽑은 «스탯 변화 + px 플래그» 다(문구 파싱 아님). 확률·계수의 정본은 constants 다.',
    count: perks.length, countByGrade: { 일반: byGrade[0], 희귀: byGrade[1], 전설: byGrade[2] },
    rules: {
      gradeRate: G('PERK_GRADE_RATE'), gradeName: NAME,
      offerPerLevel: G('PERK_OFFER'), picksPerRun: G('PERK_PICKS'),
      sameGradeOffer: true,                       /* T151 — 3장은 전부 같은 등급 */
      renormalizeWhenEmpty: true,                 /* 그 등급이 0장이면 남은 등급으로 재정규화 */
      devilGrade: G('PERK_DEVIL_GRADE'), devilOffer: 1, devilCostMaxHp: G('DEVIL_COST'),
      bossLevelUpGivesNoPerk: true,
    },
    constants: constMap(/^PERK_/),
    nHitPerks: (G('NHIT_PERKS') || []).map(x => (Array.isArray(x) ? x.slice(0, 2) : x)),
    perks,
  });
}

/* ---------- ④ data/gear.json ---------- */
function buildGear() {
  const GT = G('GT'), GOPT = G('GOPT');
  const opts = {};
  for (const ty of Object.keys(GOPT)) opts[ty] = GOPT[ty].map((o, i) => ({ slot: i + 1, desc: o.d, effect: probeEffect(o.ap) }));
  const optCount = [];
  for (let r = 0; r < GT.rarName.length; r++) {
    const row = { rar: r, rarName: GT.rarName[r], plus0: GT.optCount(r, 0) };
    if (r === GT.RAR_MYTH) { row.plus3 = GT.optCount(r, 3); row.plus6 = GT.optCount(r, 6); row.plus9 = GT.optCount(r, 9); }
    optCount.push(row);
  }
  const slotCost = [];
  for (let L = 0; L < GT.slotLvMax; L++) slotCost.push(GT.slotCost(L));
  return head({
    _note: '장비 4등급 × 6부위 × 3세트. atk/hp/sh = 그 등급 1부위의 0강·슬롯0 기여(절대값). '
      + '강화는 선형(plusStep 1레벨당 +211.11% = 19/9) · 슬롯은 1레벨당 +1% 가산(상한 150).',
    parts: GT.parts, partName: GT.partName, sets: GT.sets, setName: GT.setName,
    types: GT.types, typeName: GT.typeName,
    rarName: GT.rarName, rarLegend: GT.RAR_LEGEND, rarMyth: GT.RAR_MYTH,
    contribution: { atk: GT.atk, hp: GT.hp, sh: GT.sh },
    enhance: {
      plusStep: GT.plusStep,
      formula: 'mul = 1 + plusStep*plus  (선형 — 신화 무한 강화 때문에 복리 금지 · +9강 = ×20 정확)',
      legendToMythPlus: GT.legendToMythPlus,
      legendMaxPlus: GT.legendToMythPlus - 1,
      fuse: '같은 등급 3개 → 다음 등급 1개 (희귀 3 → 전설)',
    },
    slot: {
      step: GT.slotStep, lvMax: GT.slotLvMax, costBase: GT.slotCostBase, costG: GT.slotCostG,
      mulFormula: 'slotMul(L) = 1 + slotStep*min(L, lvMax)',
      costFormula: 'slotCost(L) = floor(costBase * costG^L)   (L = 현재 레벨 → L+1 로 올리는 비용)',
      evenStep: GT.evenStep, evenPer: GT.evenPer,
      evenFormula: 'evenBonus = 1 + evenStep*floor(min(6부위 슬롯레벨)/evenPer)',
      costTable: slotCost,
    },
    optionLadder: {
      _note: '7단 사다리 — 1 일반 · 2 희귀 · 3 전설 · 4 신화 · 5 신화+3강 · 6 신화+6강(도끼) · 7 신화+9강(흡혈 8%). '
        + '상위 등급은 하위 옵션을 전부 포함한다. 부위별로 a~e 5칸을 순환시켜 순서를 돌리고 f 는 고정.',
      maxCount: 7, optCount, options: opts,
    },
    summonRatio: { axe: G('R_AXE'), arrow: G('R_ARROW'), wave: G('R_WAVE'), bolt: G('R_BOLT'), spear: G('R_SPEAR') },
  });
}

/* ---------- ⑤ data/gacha.json ---------- */
function buildGacha() {
  const GT = G('GT');
  const boxes = {};
  for (const k of Object.keys(GT.boxes)) {
    const b = GT.boxes[k];
    boxes[k] = { key: b.key, name: b.name, cost: b.cost, rate: b.rate, cum: b.cum, pityMyth: b.pityM, pityLegend: b.pityL };
  }
  return head({
    _note: '뽑기 상자 3종. rate 순서 = 등급 인덱스(0 일반 · 1 희귀 · 2 전설 · 3 신화) · 단위 %. '
      + 'cum = 굴림 임계(높은 등급부터 누적 · toFixed(6)). pityMyth 0 = 천장 없음 · pityLegend 0 = 피티 없음.',
    boxes,
    tenPull: { count: 10, discount: 0, note: '10연차 = 1회 가격 ×10 (할인 없음 · 세 상자 공통)' },
    pityRule: '신화 상자는 50회 천장(누적 50회째 신화 확정) + 10회 피티(10회당 전설 이상 확정)가 겹친다 — '
      + '천장이 먼저 걸리면 피티 카운터도 같이 리셋된다(T125).',
    economy: { pullCost: GT.pullCost, dailyGem: GT.dailyGem, iapGem: GT.iapGem, runsPerDay: GT.runsPerDay },
  });
}

/* ---------- ⑥ data/combat.json ---------- */
function buildCombat() {
  const runChapter = 'runChapter';
  return head({
    _note: '전투 규칙 상수. 길이는 월드 px · 시간은 초. ⚑ move·range(근접/원거리)·projectile 속도·enemyAttack·caps 는 '
      + '엔진에 이름이 없는 리터럴이라 함수 객체 소스에서 뽑았다(README ⓑ) — 값이 바뀌면 --check 가 잡는다.',
    move: {
      playerSpeed: litFrom(runChapter, /worldX\+=(\d+(?:\.\d+)?)\*p\.walkMul/, '플레이어 전진 속도'),
      stopDistance: litFrom(runChapter, /if\(dist>(\d+(?:\.\d+)?)\)/, '정지 거리'),
      dashMul: G('DASH_MUL'),
    },
    range: {
      meleeEnemy: litFrom(runChapter, /if\(d<(\d+(?:\.\d+)?)\)\{\s*e\.atkTimer/, '근접 적 사거리'),
      rangedEnemyMax: litFrom(runChapter, /else if\(d<(\d+(?:\.\d+)?)&&d>\d/, '원거리 적 최대 사거리'),
      rangedEnemyMin: litFrom(runChapter, /else if\(d<\d+(?:\.\d+)?&&d>(\d+(?:\.\d+)?)\)/, '원거리 적 최소 사거리'),
      enemyGap: G('ENEMY_GAP'), nodeGap: G('NODE_GAP'), nodeGapEvent: G('NODE_GAP_EVENT'),
      spearReach: G('SPEAR_REACH'), waveReach: G('WAVE_REACH'), waveReachKing: G('WAVE_REACH_KING'),
    },
    pierce: { wave: G('WAVE_PIERCE'), waveBig: G('WAVE_PIERCE_BIG'), spear: G('SPEAR_PIERCE') },
    projectile: {
      axeSpeed: litFrom('fireAxe', /type:'axe'[^}]*spd:(\d+)/, '도끼 속도'),
      spearSpeed: litFrom('fireSpear', /type:'spear'[^}]*spd:(\d+)/, '창 속도'),
      enemyArrowSpeed: litFrom(runChapter, /a\.x-=(\d+(?:\.\d+)?)\*dt/, '적 화살 속도'),
      cap: G('PROJ_CAP'), procTickCap: G('PROC_TICK_CAP'),
    },
    enemyAttack: {
      meleeInterval: litFrom(runChapter, /e\.atkTimer\+=\(e\.isBoss\?\d+(?:\.\d+)?:(\d+(?:\.\d+)?)\)\*ivm/, '근접 적 공격 주기'),
      bossInterval: litFrom(runChapter, /e\.atkTimer\+=\(e\.isBoss\?(\d+(?:\.\d+)?):/, '보스 공격 주기'),
      rangedInterval: litFrom(runChapter, /e\.atkTimer\+=(\d+(?:\.\d+)?)\*ivm;G\.arrows/, '원거리 적 공격 주기'),
      slowMul: litFrom(runChapter, /const ivm=\(e\.slow>0\?(\d+(?:\.\d+)?):1\)/, '둔화 배수'),
      bossTripleHitEvery: 3, bossTripleHitMul: litFrom(runChapter, /e\.hits%3===0\)dm\*=(\d+(?:\.\d+)?)/, '보스 3타 강타'),
      evade: G('ENEMY_EVADE'),
    },
    stun: { boss: G('STUN_BOSS_MUL'), durations: [G('PERK_STUNC_T'), G('PERK_STUNC_T') * 2] },
    caps: {
      def: litFrom('effDef', /Math\.min\((\d+)/, '방어 상한'),
      evade: litFrom('effEvade', /Math\.min\((\d+)/, '회피 상한'),
    },
    events: { restHeal: G('REST_HEAL'), restExp: G('REST_EXP'), devilCostMaxHp: G('DEVIL_COST') },
    summonRatio: { axe: G('R_AXE'), arrow: G('R_ARROW'), wave: G('R_WAVE'), bolt: G('R_BOLT'), spear: G('R_SPEAR') },
  });
}

/* ---------- ⑦ data/ui.json ---------- */
function buildUi() {
  return head({
    _note: 'index.html 에만 있는 그리기 상수(밸런스 무관 · 월드 좌표를 안 바꾼다). '
      + '브라우저 DOM 없이 index.html 을 올릴 수 없어 이 파일만 소스에서 상수 이름으로 찾아 읽는다(README ⓐ).',
    camera: {
      zoom: htmlNum(/const CAM_ZOOM\s*=\s*([^;,]+)/, 'CAM_ZOOM'),
      playerX: htmlNum(/const CAM_PLAYER_X\s*=\s*([^;,]+)/, 'CAM_PLAYER_X'),
      _note: 'playerX = 플레이어 중심이 놓이는 프레임 폭 비율. zoom 은 그리기만 확대한다(월드 단위 불변).',
    },
    bars: {
      footBarW: htmlNum(/const FOOT_BAR_W\s*=\s*([^;,]+)/, 'FOOT_BAR_W'),
      enemyBarW: htmlNum(/const HPBAR_W\s*=\s*([^,;]+)/, 'HPBAR_W'),
      bossBarW: htmlNum(/HPBAR_W_BOSS\s*=\s*([^,;]+)/, 'HPBAR_W_BOSS'),
    },
    fx: {
      axeArc: htmlNum(/const AXE_ARC\s*=\s*([^;,]+)/, 'AXE_ARC'),
      popShield: litHtml(/const POP_SH\s*=\s*'([^']+)'/, 'POP_SH'),
      popHp: litHtml(/const POP_HP\s*=\s*'([^']+)'/, 'POP_HP'),
      popShieldDx: htmlNum(/POP_SH_DX\s*=\s*(-?[\d.]+)/, 'POP_SH_DX'),
      popShieldDy: htmlNum(/POP_SH_DY\s*=\s*(-?[\d.]+)/, 'POP_SH_DY'),
    },
    frame: { designWidth: 390, designHeight: 844, minWidth: 360 },
  }, `index.html@${HTML_SHA}`);
}

/* ---------- 쓰기 / 대조 ---------- */
const FILES = {
  'tune.json': buildTune,
  'enemies.json': buildEnemies,
  'perks.json': buildPerks,
  'gear.json': buildGear,
  'gacha.json': buildGacha,
  'combat.json': buildCombat,
  'ui.json': buildUi,
};

/* 기본은 2칸 들여쓰기. 다만 «한 줄 = 한 챕터» 처럼 행이 많은 배열은 한 줄로 눌러 파일이 붓지 않게 한다
   (420 챕터를 전부 펼치면 1 MB 가 넘는다 — 값은 그대로이고 줄바꿈만 다르다). */
const COMPACT = { chapters: true, costTable: true, expNeedTable: true };
function ser(o) {
  const marks = new Map();
  let n = 0;
  const walk = v => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out = {};
      for (const k of Object.keys(v)) {
        if (COMPACT[k] && Array.isArray(v[k])) { const tok = `@@CMP${n++}@@`; marks.set(tok, v[k]); out[k] = tok; }
        else out[k] = walk(v[k]);
      }
      return out;
    }
    return v;
  };
  let txt = JSON.stringify(walk(o), null, 2);
  for (const [tok, arr] of marks) {
    const m = txt.match(new RegExp(`^([ ]*)"[^"]+": "${tok}"`, 'm'));
    const pad = m ? m[1] : '  ';
    const body = arr.length ? `[\n${arr.map(r => pad + '  ' + JSON.stringify(r)).join(',\n')}\n${pad}]` : '[]';
    txt = txt.replace(`"${tok}"`, body);
  }
  return txt + '\n';
}
/* `_generatedAt` 은 «내용» 이 아니다 — 대조할 때만 같은 자리에 고정값을 놓는다 (README ⓒ) */
const norm = s => s.replace(/"_generatedAt": "[^"]*"/, '"_generatedAt": "<gen>"');

function main() {
  const check = process.argv.indexOf('--check') >= 0;
  if (!check) fs.mkdirSync(OUT, { recursive: true });
  let bad = 0;
  for (const [name, build] of Object.entries(FILES)) {
    const txt = ser(build());
    const p = path.join(OUT, name);
    if (check) {
      if (!fs.existsSync(p)) { console.log(`  ✗ ${name} — 커밋된 파일이 없다`); bad++; continue; }
      const cur = fs.readFileSync(p, 'utf8');
      if (norm(cur) === norm(txt)) console.log(`  ✓ ${name} — 드리프트 0 (${(txt.length / 1024).toFixed(1)} KB)`);
      else { console.log(`  ✗ ${name} — 엔진과 다르다. \`node tools/exportData.js\` 로 다시 뽑아 같이 커밋할 것`); bad++; }
    } else {
      fs.writeFileSync(p, txt);
      console.log(`  → data/${name}  (${(txt.length / 1024).toFixed(1)} KB)`);
    }
  }
  console.log(check ? `\n[exportData --check] 파일 ${Object.keys(FILES).length} · 드리프트 ${bad}`
    : `\n[exportData] sim.js@${SIM_SHA.slice(0, 12)} → data/*.json ${Object.keys(FILES).length}개`);
  process.exit(bad ? 1 : 0);
}
main();
