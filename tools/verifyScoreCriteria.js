#!/usr/bin/env node
'use strict';
/* ⚑⚑⚑ 밸런스 기준 게이트 — «난이도 사다리 7점» (주인 확정 2026-09-03 · T103 → ⚑ T153 로 영웅 칸 삭제)
 *
 * 무엇이 있었나. 이 게이트(T30 신설)는 채점표 v1~v5·사다리 7점·«비평가 2인 ≥8/10» 을 지키던 자였고,
 * T97 이 그것을 **과녁 2점**(표준 ch15 = 10% · 노장비 ch4 = 30%)으로 갈아엎었다.
 * **T103 에서 주인이 그 2점을 사다리 7점으로 다시 확정**했다 — 장비 등급과 슬롯 레벨을 함께 못박고,
 * 일곱 칸 전부를 같은 목표(클리어율 10%)로 재는 자다.
 *
 *   # | 빌드 (특전 10종 순서 획득)              | 목표 챕터
 *   1 | 노템 (장비 0 · 슬롯 0)                  |   5
 *   2 | 일반 풀셋 · 슬롯 0                       |  15
 *   3 | 희귀 풀셋 · 슬롯 5                       |  28
 *   4 | 전설 풀셋 · 슬롯 15                      |  70   (⚑ T153 — 영웅 칸 40 삭제)
 *   5 | 신화 풀셋 · 슬롯 25                      | 150
 *   6 | 신화 +9강 풀셋 · 슬롯 50                 | 380
 *   7 | 신화 +9강 풀셋 · 슬롯 100                | 420   (⚑ 주인 정정 — 종전 600 폐기)
 *   전부 클리어율 **10%** · 허용 오차 ±2%p · 과녁당 1,000판 이상 · 고정 시드 3벌.
 *
 *   ⓐ 문면      — PLAN §7·§11.7 과 docs/ROUTINE.md 에 일곱 칸·허용 오차·판수·시드 규약이 살아 있는가
 *   ⓑ 구현 대조 — 문면의 숫자가 sim.js 의 `EXP1_TARGETS`·`EXP1_TOL`·`EXP1_SCORE_N` 과 같은가
 *   ⓒ 하니스    — 일곱 칸의 실제 총 스탯이 주인 확정표(§11.7)와 같은가 (실행)
 *   ⓓ 실측      — **커밋된 엔진이 실제로 일곱 칸을 맞히는가** (고정 시드 300판 · 결정적이라 잡음 없음)
 *   ⓔ 폐기 확인 — 옛 채점(등급 과녁 [10,20,80]·등급 내 폭·사다리 «합격 2~10%»)이 되살아나지 않았는가
 *                 + **실험1 과 실험5 가 같은 표를 본다**(T103 이 표를 하나로 합쳤다 — 다시 갈라지면 빨개진다)
 *   ⓕ 러너      — tools/regress.js 의 고정 시드 ≥3벌 · 실험1 판정 허용치가 `EXP1_TOL` 과 같은 값인가
 *                 + 파서가 **칸 이름을 열거하지 않는다**(이름을 박으면 칸이 바뀔 때마다 표가 조용히 빈다 — 실제로 두 번 그랬다)
 *
 * ⚠ ⓓ 의 밴드(±5%p)는 허용 오차(±2%p)보다 넓다. 게이트는 «과녁을 맞혔나» 를 소수점까지 다시 채점하는 자리가
 *   아니라 **«난이도 곡선이 통째로 어긋나지 않았나»** 를 지키는 자리다 — 재적합 회차가 과녁 안에서 움직일
 *   여지를 남기되, 되돌림·오이식(예: 기저 복귀 → 초반 칸이 0%)은 즉시 빨개진다.
 *
 * 사용: node tools/verifyScoreCriteria.js        (exit 0 = 통과, 1 = 불일치)
 *      node tools/verifyScoreCriteria.js --self  (음성 검사 — 일부러 깨뜨려 빨개지는지 본다)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* 주인 확정값 — 이 상수들이 이 게이트의 기준이다 (PLAN §7.1 표와 1:1) */
/* ⚑⚑⚑ T153 (주인 확정 2026-09-05 18:1X) — «영웅 풀셋 · 슬롯 10 = 챕터 40» 칸이 **장비 등급 폐지로 삭제**됐다
   (8점 → **7점**). 남는 칸의 챕터·목표·스탯은 한 글자도 안 바뀌었고, 등급 인덱스만 한 칸씩 당겨졌다
   (전설 3 → 2 · 신화 4 → 3). 적 스탯은 건드리지 않는다(상시 규칙 — 표에서 칸만 뺐다). */
/* ⚑⚑⚑ T160 (주인 확정 2026-09-05 20:2X · 20:3X 정정 3건) — 과녁 챕터가 새 표로 바뀌었다.
   **빌드·슬롯·목표 클리어율·총 스탯은 한 칸도 안 바뀐다** — 움직인 것은 과녁 챕터뿐이고,
   맞추는 노브는 적 스탯(§6 기저 · §11.7 구간률)이다. 종전 표(T103·T153): 5·15·28·70·150·380·420. */
const RUNGS = [
  { k: 1, ch: 3,   rar: -1, plus: 0, slot: 0,   stat: [25, 150, 250] },
  { k: 2, ch: 7,   rar: 0,  plus: 0, slot: 0,   stat: [50, 250, 400] },
  { k: 3, ch: 15,  rar: 1,  plus: 0, slot: 5,   stat: [108.9, 543.4, 868.9] },
  { k: 4, ch: 30,  rar: 2,  plus: 0, slot: 15,  stat: [524.7, 2619.1, 4188.9] },
  { k: 5, ch: 60,  rar: 3,  plus: 0, slot: 25,  stat: [3742.2, 18703.1, 29921.9] },
  { k: 6, ch: 100, rar: 3,  plus: 9, slot: 50,  stat: [106912, 533475, 853125] },
  { k: 7, ch: 125, rar: 3,  plus: 9, slot: 100, stat: [190050, 948300, 1516500] },
];
const WANT = {
  rate: 10,          // 일곱 칸 공통 목표 클리어율
  tol: 2,            // 허용 오차 ±%p (주인 확정)
  minN: 1000,        // 과녁당 채점 판수 하한 (주인 확정 «1,000판 이상»)
  seeds: 3,          // 고정 시드 벌 수 하한 (PLAN §7 회귀 측정 규약 ①)
  band: 5,           // ⓓ 실측 허용 밴드 ±%p (허용 오차보다 넓다 — 위 ⚠ 주석)
  probeN: 300,       // ⓓ 실측 판수 (고정 시드라 결정적)
  probeSeed: 11,
};

const R = [];
const chk = (n, c, d) => { R.push({ n, c }); console.log(`  ${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); return c; };

function loadSim(src) {
  const body = src.replace(/const mode=process\.argv[\s\S]*$/,
    'module.exports={runChapter,mkBuild,buildPower,setSeed,TUNE,EXP1_TARGETS,LADDER,LADDER_OPTS,PERK_MODE_LADDER,PERK_MODE_PLAY,PERKS_BASE10};');
  const m = { exports: {} };
  vm.runInNewContext(body, { module: m, exports: m.exports, process, console: { log() {} }, require });
  return m.exports;
}

function run(simSrc, planSrc, routineSrc, regressSrc) {
  R.length = 0;

  /* ===== ⓐ 문면 — 기준이 문서에서 지워지지 않았는가 ===== */
  console.log('\n=== ⓐ 문면 (PLAN · ROUTINE) ===');
  for (const g of RUNGS)
    chk(`PLAN §7.1 · ${g.k}칸 (챕터 ${g.ch} = ${WANT.rate}%)`,
      new RegExp(`\\|\\s*${g.k}\\s*\\|[^|\\n]*\\|\\s*\\*\\*${g.ch}\\*\\*\\s*\\|\\s*\\*\\*${WANT.rate}%\\*\\*\\s*\\|`).test(planSrc));
  chk(`PLAN §7 · 허용 오차 ±${WANT.tol}%p`, new RegExp(`±\\s*${WANT.tol}\\s*%p`).test(planSrc));
  chk('PLAN §7 · 측정 판수 «1,000판 이상»', /1,?000판\s*이상/.test(planSrc));
  chk('PLAN §7 · 고정 시드 3벌', /고정\s*시드\s*3벌/.test(planSrc));
  /* ⚑ T160 — 문면 자를 새 표로 갈아끼웠다. 종전 두 줄은 «사다리 8점» 이라는 옛 낱말을 찾고 있었는데,
     그 낱말은 이력 문단에도 남아 있어 «표가 바뀌어도 초록» 이었다. 이제 **새 과녁 숫자**를 직접 본다. */
  chk('PLAN §7.1 제목이 새 과녁(사다리 7점 · T160)을 가리킨다', /### 7\.1[^\n]*사다리 7점/.test(planSrc));
  chk('PLAN §7.1 에 T160 새 과녁 7개가 문장으로도 적혀 있다', /3 · 7 · 15 · 30 · 60 · 100 · 125/.test(planSrc));
  chk('ROUTINE · T160 지시가 살아 있다 (새 사다리 7점)', /노템 \*\*3\*\*[\s\S]{0,200}신화9강\+슬롯 ?100 ?= ?125|노템 3 · 일반 7 · 희귀 15 · 전설 30 · 신화 60/.test(routineSrc));
  chk('ROUTINE · 6칸 (슬롯 50 = 챕터 100)', /\|\s*6\s*\|[^|\n]*\|\s*\*\*50\*\*\s*\|\s*\*\*100\*\*\s*\|/.test(routineSrc));
  chk('ROUTINE · 7칸 (슬롯 100 = 챕터 125)', /\|\s*7\s*\|[^|\n]*\|\s*\*\*100\*\*\s*\|\s*\*\*125\*\*\s*\|/.test(routineSrc));
  /* ⚑ T160 측정 조건 3종이 문면에 살아 있는가 (자가 조용히 바뀌는 것을 막는다) */
  chk('PLAN · 측정 조건 «기본 스탯 옛 값 20»(baseStats:legacy20)이 문면에 있다', /baseStats:'legacy20'|baseStats:`legacy20`|`baseStats:'legacy20'`/.test(planSrc));
  chk('PLAN · 측정 조건 «세트 옵션 끔»(gearOpts:false)이 문면에 있다', /gearOpts:false/.test(planSrc));

  /* ===== ⓑ 구현 대조 — 문면의 숫자 = 엔진의 상수 ===== */
  console.log('\n=== ⓑ 구현 대조 (PLAN 문면 ↔ sim.js 상수) ===');
  const tgt = (simSrc.match(/const EXP1_TARGETS=\[([\s\S]*?)\];/) || [])[1] || '';
  const rows = [...tgt.matchAll(/rar:(-?\d+),\s*plus:(\d+),\s*slot:(\d+),\s*at:(\d+),\s*want:(\d+)/g)]
    .map(g => ({ rar: +g[1], plus: +g[2], slot: +g[3], at: +g[4], want: +g[5] }));
  chk(`EXP1_TARGETS 가 사다리 ${RUNGS.length}점이다`, rows.length === RUNGS.length, `${rows.length}줄`);
  for (const g of RUNGS) {
    const r = rows.find(x => x.at === g.ch);
    chk(`${g.k}칸: 챕터 ${g.ch} · ${WANT.rate}% · 장비(rar ${g.rar} · ${g.plus}강 · 슬롯 ${g.slot})`,
      !!r && r.want === WANT.rate && r.rar === g.rar && r.slot === g.slot && r.plus === g.plus,
      r ? `at ${r.at} / want ${r.want} / rar ${r.rar} / plus ${r.plus} / slot ${r.slot}` : '해당 칸 없음');
  }
  const tol = +((simSrc.match(/const EXP1_TOL=(\d+)/) || [])[1]);
  const scoreN = +((simSrc.match(/const EXP1_SCORE_N=(\d+)/) || [])[1]);
  chk(`EXP1_TOL = ${WANT.tol} (PLAN 문면과 같다)`, tol === WANT.tol, `${tol}`);
  chk(`EXP1_SCORE_N ≥ ${WANT.minN} (주인 «1,000판 이상»)`, scoreN >= WANT.minN, `${scoreN}`);
  chk('판수 기본값이 EXP1_SCORE_N 에 배선돼 있다 (탐색용 EXP1_N 은 덮어쓰기만)',
    /EXP1_N\|\|String\(EXP1_SCORE_N\)/.test(simSrc));

  /* ===== ⓒⓓ 실행 — 하니스 정의와 과녁 실측 ===== */
  console.log('\n=== ⓒ 하니스 (주인 확정 스탯표 ↔ 실제 빌드) ===');
  const S = loadSim(simSrc);
  const near = (v, w) => Math.abs(v - w) <= Math.max(1, w * 0.005);
  const builds = RUNGS.map(g => S.mkBuild(g.rar, g.plus, g.slot));
  RUNGS.forEach((g, i) => {
    const p = S.buildPower(builds[i]);
    chk(`${g.k}칸 = 공 ${g.stat[0]} / 체 ${g.stat[1]} / 실 ${g.stat[2]}`,
      near(p.atk, g.stat[0]) && near(p.hp, g.stat[1]) && near(p.sh, g.stat[2]),
      `공 ${p.atk.toFixed(1)} / 체 ${p.hp.toFixed(1)} / 실 ${p.sh.toFixed(1)}`);
  });

  console.log(`\n=== ⓓ 실측 (시드 ${WANT.probeSeed} 고정 · 각 ${WANT.probeN}판 · 밴드 ±${WANT.band}%p · ⚑ T120 기준 플레이어) ===`);
  RUNGS.forEach((g, i) => {
    S.setSeed(WANT.probeSeed);
    let win = 0;
    /* ⚑⚑⚑ T120 (주인 확정 15:3X ①) — 사다리를 재는 자는 «기준 플레이어» 하나다:
       기존 일반 10종을 옛 순서대로 «되는 만큼» 자동 획득 · 3택 없음 · 신규 22종·등급 없음.
       3택·희귀·전설은 기준 위에 얹히는 유저 보너스라 이 자에 들어오지 않는다. */
    /* ⚑ T160 — 자는 이제 세 스위치다(`LADDER_OPTS`): base10 + 기본 스탯 옛 값 20 + 세트 옵션 끔.
       엔진의 상수를 그대로 가져다 쓴다 — 여기서 손으로 다시 적으면 «게이트만 딴 자로 재는» 일이 생긴다. */
    for (let j = 0; j < WANT.probeN; j++) if (S.runChapter(g.ch, builds[i], S.LADDER_OPTS).clear) win++;
    const rate = win / WANT.probeN * 100;
    chk(`${g.k}칸: 챕터 ${g.ch} 클리어율이 ${WANT.rate}±${WANT.band}%p 안이다`,
      Math.abs(rate - WANT.rate) <= WANT.band, `실측 ${rate.toFixed(1)}%`);
  });

  /* ===== ⓔ 폐기 확인 + 표 단일화 ===== */
  console.log('\n=== ⓔ 폐기된 옛 채점이 되살아나지 않았다 ===');
  chk('등급 과녁 [10,20,80] 이 없다', !/EXP1_TARGET\s*=\s*\[\s*10\s*,\s*20\s*,\s*80/.test(simSrc));
  chk('실험2 등급 내 폭 채점(EXP2_SCORE_RAR)이 없다', !/EXP2_SCORE_RAR/.test(simSrc));
  chk('등급 고정 측정(rarityLock)이 없다', !/rarityLock/.test(simSrc));
  chk('실험5 사다리 «합격 2~10%» 판정이 없다 (진단 전용)', !/합격\s*2~10%/.test(simSrc));
  chk('실험4 «기준①» 합격/불합격 판정이 없다', !/기준①\(정체\)[\s\S]{0,200}미만 ✓/.test(simSrc));
  chk('PLAN §7 머리가 옛 기준 폐기를 명시한다', /이\s*절의\s*«기준»\s*은\s*전부\s*폐기/.test(planSrc));
  chk('⚑ 실험1·실험5 가 같은 표를 본다 (T103 단일화 — LADDER 가 EXP1_TARGETS 에서 파생)',
    /const LADDER=EXP1_TARGETS\.map\(/.test(simSrc));
  const sameCh = S.LADDER.length === S.EXP1_TARGETS.length &&
    S.LADDER.every((L, i) => L.at === S.EXP1_TARGETS[i].at && L.rar === S.EXP1_TARGETS[i].rar);
  chk('실험5 사다리 칸이 실험1 과 같은 챕터·등급이다', sameCh,
    `실험5 ${S.LADDER.map(l => l.at).join('·')}`);

  /* ===== ⓖ 자(尺) 고정 — ⚑⚑⚑ T120 (주인 확정 2026-09-04 15:3X ①·④) =====
     주인이 «맞추라 한 적이 없는데 왜 맞췄노» 로 되돌린 뒤 확정한 상시 규칙이다:
     사다리를 재는 조건은 «기준 플레이어» 하나로 고정하고, 플레이어 쪽(3택·등급·신규 특전)이
     바뀌어도 적 스탯을 임의로 재적합하지 않는다. 이 절은 **그 자가 배선돼 있는지**를 본다 —
     자가 3택으로 슬쩍 돌아가면(실측 8칸이 통째로 어긋난다) 여기서 즉시 빨개진다. */
  console.log('\n=== ⓖ 사다리 자(尺) = «기준 플레이어» 고정 (T120) ===');
  chk('sim.js 에 `PERK_MODE_LADDER` 가 선언돼 있다', /const\s+PERK_MODE_PLAY\s*=\s*'3pick'\s*,\s*PERK_MODE_LADDER\s*=\s*'base10'/.test(simSrc));
  chk('`PERKS_BASE10` = 기존 일반 10종 (풀 앞머리 10개)', /const\s+PERKS_BASE10\s*=\s*PERKS\.slice\(0\s*,\s*10\)/.test(simSrc));
  chk('runChapter 가 perkMode 를 받고 기본값은 3택(게임 동작 불변)', /perkMode\s*:\s*opts\.perkMode\s*\|\|\s*PERK_MODE_PLAY/.test(simSrc));
  chk('grantNextPerk 가 base10 에서 표 순서대로 자동 획득한다 (3택 굴림 없음)',
    /G\.perkMode\s*===\s*PERK_MODE_LADDER[\s\S]{0,160}PERKS_BASE10\[G\.taken\.length\]/.test(simSrc));
  chk('실험1 의 기본 자가 PERK_MODE_LADDER 다 (EXP1_PERKMODE 는 참고표 전용 덮어쓰기)',
    /const\s+EXP1_PERKMODE\s*=\s*process\.env\.EXP1_PERKMODE\s*\|\|\s*PERK_MODE_LADDER/.test(simSrc));
  /* ⚑ T160 — 자가 세 스위치(`LADDER_OPTS`)로 늘어나 두 실험 다 그 상수를 통해 돈다.
     실험1 만 `EXP1_PERKMODE`(참고표 전용 덮어쓰기)를 위에 얹는다. */
  chk('실험1 실측이 그 자로 돈다 (LADDER_OPTS + 참고표 덮어쓰기)',
    /runChapter\(c,b,Object\.assign\(\{\},LADDER_OPTS,\{perkMode:EXP1_PERKMODE\}\)\)/.test(simSrc));
  chk('실험5(진단)도 같은 자로 돈다 (LADDER_OPTS 그대로)', /runChapter\(c,b,LADDER_OPTS\)/.test(simSrc));
  chk('⚑ T160 자가 한 곳에 모여 있다 — LADDER_OPTS = base10 + legacy20 + 세트 옵션 끔',
    /const LADDER_OPTS=\{perkMode:PERK_MODE_LADDER,\s*baseStats:'legacy20',\s*gearOpts:false\}/.test(simSrc));
  chk('⚑ T160 하니스 스위치 ⓐ 가 mkPlayer 에 배선돼 있다 (넷만 옛 값 20)',
    /G\.baseStats==='legacy20'[\s\S]{0,200}p\.critR=LADDER_BASE20[\s\S]{0,120}p\.evade=LADDER_BASE20/.test(simSrc));
  chk('⚑ T160 하니스 스위치 ⓑ 가 GOPT 적용부를 감싼다 (세트 옵션 끔)',
    /if\(!\(G&&G\.gearOpts===false\)\) for\(const pt of GT\.parts\)/.test(simSrc));
  /* 자 스위치가 게임 쪽으로 새면 «재려고 만든 것» 이 실제 동작이 된다 — index.html 에는 한 글자도 없어야 한다 */
  chk('⚑ T160 게임 배선은 그대로 — index.html 에 자 스위치가 없다',
    !/legacy20|gearOpts|LADDER_OPTS|LADDER_BASE20/.test(rd('index.html')));
  {
    const base10 = S.PERKS_BASE10 || [];
    const want10 = ['p_evadeHeal','p_atk','p_evade','p_arrowEv','p_axeHit','p_counter','p_spearCt','p_critR','p_critF','p_def'];
    chk('기준 10종이 주인이 적은 옛 순서 그대로다 (회복→공격력→회피율→화살→도끼→반격률→창→치확→치피→방어력)',
      base10.length === 10 && base10.every((p, i) => p.id === want10[i] && p.g === 0),
      base10.map(p => p.id).join('·'));
  }
  chk('ROUTINE 에 «임의 재적합 금지» 상시 규칙이 살아 있다',
    /임의로\s*재적합하지\s*않는다/.test(routineSrc));

  /* ===== ⓕ 러너 (tools/regress.js) ===== */
  console.log('\n=== ⓕ 회귀 러너 (tools/regress.js) ===');
  const defSeeds = ((regressSrc.match(/const DEFAULT_SEEDS\s*=\s*\[([^\]]*)\]/) || [])[1] || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  chk(`기본 시드가 ${WANT.seeds}벌 이상이다`, defSeeds.length >= WANT.seeds, defSeeds.join('·') || '없음');
  const jTol = +((regressSrc.match(/'1':\s*\(k,\s*v,\s*t\)\s*=>[^\n]*<=\s*(\d+)/) || [])[1]);
  chk(`실험1 판정 허용치 = EXP1_TOL(${WANT.tol})`, jTol === WANT.tol, `${jTol}`);
  const p1 = (regressSrc.match(/function parse1\(out\)\s*\{[\s\S]*?\n\}/) || [''])[0];
  chk('실험1 파서가 칸 이름을 열거하지 않는다 (표 모양으로 잡는다)',
    !!p1 && !/표준 장비|노장비|노템|신화/.test(p1) && /%p/.test(p1));
  chk('실험5 에 합격 판정이 붙지 않는다 (판정 자는 실험1 하나)', /'5':\s*\(\)\s*=>\s*''/.test(regressSrc));

  const bad = R.filter(x => !x.c).length;
  console.log(`\n[밸런스 기준 게이트] 대조 ${R.length}항목 · 통과 ${R.length - bad} · 불합격 ${bad}`);
  return bad;
}

const simSrc = rd('sim.js');
const planSrc = rd('PLAN.md');
const routineSrc = rd('docs/ROUTINE.md');
const regressSrc = rd('tools/regress.js');

if (process.argv.includes('--self')) {
  const cases = [
    ['허용 오차를 ±5%p 로 되돌리면', s => s.replace('const EXP1_TOL=2', 'const EXP1_TOL=5'), null, null, null],
    ['채점 판수를 300판으로 내리면', s => s.replace('const EXP1_SCORE_N=1000', 'const EXP1_SCORE_N=300'), null, null, null],
    /* ⚑ T160 — 과녁이 3·7·15·30·60·100·125 로 바뀌어 옛 문자열이 전부 죽었다. 새 표로 갈아끼운다. */
    ['7칸 과녁 챕터를 125 → 200 으로 옮기면', s => s.replace('slot:100, at:125', 'slot:100, at:200'), null, null, null],
    ['2칸 목표를 10 → 20% 로 바꾸면', s => s.replace('slot:0,   at:7,   want:10', 'slot:0,   at:7,   want:20'), null, null, null],
    ['3칸 슬롯을 5 → 0 으로 바꾸면 (하니스 조작)', s => s.replace('rar:1, plus:0, slot:5,   at:15', 'rar:1, plus:0, slot:0,   at:15'), null, null, null],
    /* ⚑ T160 신설 — 자 스위치 세 개를 하나씩 떼면 빨개지는가 */
    ['자에서 «기본 스탯 옛 값 20» 을 떼면', s => s.replace("baseStats:'legacy20', ", ''), null, null, null],
    ['자에서 «세트 옵션 끔» 을 떼면', s => s.replace(', gearOpts:false}', '}'), null, null, null],
    ['사다리에서 한 칸을 빼면', s => s.replace(/\{id:'전설 풀셋·슬롯15',[^\n]*\n/, ''), null, null, null],
    ['판수 기본값 배선을 끊으면', s => s.replace("EXP1_N||String(EXP1_SCORE_N)", "EXP1_N||'300'"), null, null, null],
    ['기저를 1.5배로 올려 곡선이 통째로 어긋나면',
      s => s.replace(/eBaseHp:([\d.]+), eBaseDmg:([\d.]+),/,
        (_, a, b) => `eBaseHp:${(+a * 1.5).toFixed(4)}, eBaseDmg:${(+b * 1.5).toFixed(4)},`), null, null, null],
    ['실험1·실험5 표를 다시 갈라 놓으면',
      s => s.replace('const LADDER=EXP1_TARGETS.map(',
        "const LADDER=[{id:'노템',rar:-1,plus:0,at:5,want:[25,150,250]}].concat(EXP1_TARGETS.slice(1).map("), null, null, null],
    ['사다리 «합격 2~10%» 판정을 되살리면', s => s.replace('진단 전용 — 기준 폐기', '합격 2~10%'), null, null, null],
    ['PLAN 에서 7칸 문면을 지우면', null, s => s.replace(/\*\*125\*\*\s*\|\s*\*\*10%\*\*/, '**125** | **12%**'), null, null],
    ['PLAN 에서 판수 규약을 지우면', null, s => s.replace(/1,000판 이상/g, '판수 자유'), null, null],
    ['ROUTINE 에서 7칸 문면을 지우면', null, null, s => s.replace('| 7 | 신화 +9강 풀셋 | **100** | **125** |', '| 7 | 신화 +9강 풀셋 | **100** | **420** |'), null],
    ['러너 시드를 1벌로 줄이면', null, null, null, s => s.replace('const DEFAULT_SEEDS = [11, 12, 13]', 'const DEFAULT_SEEDS = [11]')],
    ['러너 판정 허용치만 ±5 로 벌리면', null, null, null, s => s.replace('Math.abs(v - t) <= 2', 'Math.abs(v - t) <= 5')],
    ['러너 파서에 칸 이름을 다시 박으면', null, null, null,
      s => s.replace(/\/\^\\s\*\\\|\\s\*\(\[\^\|\]\+\?\)/, '/^\\s*\\|\\s*(표준 장비[^|]*?)')],
    /* ⚑⚑⚑ T120 ⓖ 음성 — 자(尺)가 3택으로 슬쩍 돌아가는 네 가지 길 */
    ['실험1 의 자를 3택으로 되돌리면', s => s.replace('process.env.EXP1_PERKMODE||PERK_MODE_LADDER', "process.env.EXP1_PERKMODE||PERK_MODE_PLAY"), null, null, null],
    ['실험1 실측에서 자(LADDER_OPTS) 배선을 떼면',
      s => s.replace('runChapter(c,b,Object.assign({},LADDER_OPTS,{perkMode:EXP1_PERKMODE}))', 'runChapter(c,b,{})'), null, null, null],
    ['runChapter 의 perkMode 기본값을 base10 으로 바꾸면 (게임 동작까지 자로 덮는다)',
      s => s.replace('perkMode:opts.perkMode||PERK_MODE_PLAY', 'perkMode:opts.perkMode||PERK_MODE_LADDER'), null, null, null],
    ['기준 10종 순서를 흔들면 (공격력 ↔ 반격률)',
      s => s.replace("const PERKS_BASE10=PERKS.slice(0,10);", "const PERKS_BASE10=PERKS.slice(0,10).slice().reverse();"), null, null, null],
    ['ROUTINE 에서 «임의 재적합 금지» 상시 규칙을 지우면', null, null,
      s => s.replace(/임의로\s*재적합하지\s*않는다/g, '필요하면 재적합한다'), null],
  ];
  let caught = 0;
  const quiet = console.log;
  for (const [nm, fs_, fp, fr, fg] of cases) {
    /* ⚑ T126 가드 — 돌연변이 문자열이 낡아 replace 가 no-op 이 되면 사본 = 원본이라
       게이트가 초록으로 «통과» 하고 이 음성 케이스는 아무것도 안 지키면서 숫자만 올린다.
       (verifyPerkOrder 의 «가시갑옷 근접» 케이스가 T124 뒤 실제로 그렇게 죽어 있었다.) */
    const mS = fs_ ? fs_(simSrc) : simSrc, mP = fp ? fp(planSrc) : planSrc;
    const mR = fr ? fr(routineSrc) : routineSrc, mG = fg ? fg(regressSrc) : regressSrc;
    const noop = (fs_ && mS === simSrc) || (fp && mP === planSrc)
              || (fr && mR === routineSrc) || (fg && mG === regressSrc);
    let bad = 0;
    if (!noop) {
      console.log = () => {};
      try { bad = run(mS, mP, mR, mG); } catch (e) { bad = 1; }
      console.log = quiet;
    }
    const ok = !noop && bad > 0;
    if (ok) caught++;
    console.log(`  ${ok ? '✓' : '✗'} ${nm} → ${ok ? '빨개진다'
      : noop ? '🔴 돌연변이가 원본을 안 바꾼다 (문자열이 낡았다 = 죽은 검사)' : '🔴 안 잡힌다 (죽은 검사)'}`);
  }
  console.log(`\n[음성 검사] ${caught}/${cases.length}`);
  process.exit(caught === cases.length ? 1 : 0);
}

console.log('⚑⚑⚑ T103 게이트 — 밸런스 기준 = 난이도 사다리 7점 (문면 · 구현 · 실측)');
process.exit(run(simSrc, planSrc, routineSrc, regressSrc) ? 1 : 0);
