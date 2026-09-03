#!/usr/bin/env node
'use strict';
/* ⚑⚑⚑ 밸런스 기준 게이트 — «난이도 과녁 2점» (주인 확정 2026-09-03 · T97 이 다시 만들었다)
 *
 * 무엇이 있었나. 이 게이트(T30 신설)는 «PLAN §7 채점표 문면 ↔ sim.js 실험1~5 하니스·판정 임계 ↔
 * tools/scoreExp3.js BANDS» 를 73항목까지 대조하던 자(尺) 감시기였다. 그 자가 재던 것 — 스탯 사다리 7점 ·
 * 채점표 v1~v5 · 실험1 등급 과녁 · 실험2 등급 내 폭 · 실험3 진행 곡선 목표 · 실험4 기준 ①②③ ·
 * «비평가 2인 각 ≥8/10» — 이 **전부 주인 지시로 폐기**됐다(«방금 말한 게 기준이고 나머지 기준은 다 폐기»).
 * T96 이 그 항목들을 걷어 «문면이 지워지지 않았는가» 만 보는 은퇴 상태로 두었고, **T97 이 여기까지 왔다.**
 *
 * 지금 보는 것 — 유효한 기준은 과녁 2점뿐이고, 이 게이트는 그 2점을 **문면·구현·실측 세 겹으로** 지킨다.
 *   A 표준 장비(희귀 풀셋 6부위 · 슬롯 0렙) + 특전 10종 순서 획득 → 챕터 15 클리어율 **10%**
 *   B 노장비(장비 0 · 슬롯 0)             + 특전 10종 순서 획득 → 챕터  4 클리어율 **30%**
 *   허용 오차 ±2%p · 과녁당 1,000판 이상 · 고정 시드 3벌.
 *
 *   ⓐ 문면      — PLAN §7·§11.7 과 docs/ROUTINE.md 에 두 과녁·허용 오차·판수·시드 규약이 살아 있는가
 *   ⓑ 구현 대조 — 문면의 숫자가 sim.js 의 `EXP1_TARGETS`·`EXP1_TOL`·`EXP1_SCORE_N` 과 같은가
 *   ⓒ 하니스    — «표준 장비»·«노장비» 의 실제 스탯이 PLAN §11.7 표(100/500/800 · 25/150/250)와 같은가 (실행)
 *   ⓓ 실측      — **커밋된 엔진이 실제로 두 과녁을 맞히는가** (고정 시드 300판 · 결정적이라 잡음 없음)
 *   ⓔ 폐기 확인 — 옛 채점(등급 과녁 [10,20,80]·등급 내 폭·사다리 합격 판정·실험4 기준①)이 되살아나지 않았는가
 *   ⓕ 러너      — tools/regress.js 의 고정 시드 ≥3벌 · 실험1 판정 허용치가 `EXP1_TOL` 과 같은 값인가
 *
 * ⚠ ⓓ 의 밴드(±5%p)는 허용 오차(±2%p)보다 넓다. 게이트는 «과녁을 맞혔나» 를 소수점까지 다시 채점하는 자리가
 *   아니라 **«난이도 곡선이 통째로 어긋나지 않았나»** 를 지키는 자리다 — 재적합 회차가 과녁 안에서 움직일
 *   여지를 남기되, 되돌림·오이식(예: 성장률 표 복귀 → 챕터 15 가 100%)은 즉시 빨개진다.
 *
 * 사용: node tools/verifyScoreCriteria.js        (exit 0 = 통과, 1 = 불일치)
 *      node tools/verifyScoreCriteria.js --self  (음성 검사 — 일부러 깨뜨려 빨개지는지 본다)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* 주인 확정값 — 이 상수들이 이 게이트의 기준이다 */
const WANT = {
  A: { ch: 15, rate: 10, rar: 1, slot: 0 },     // 표준 장비(희귀 풀셋 · 슬롯 0)
  B: { ch: 4, rate: 30, rar: -1, slot: 0 },     // 노장비
  tol: 2,            // 허용 오차 ±%p (주인 확정)
  minN: 1000,        // 과녁당 채점 판수 하한 (주인 확정 «1,000판 이상»)
  seeds: 3,          // 고정 시드 벌 수 하한 (PLAN §7 회귀 측정 규약 ①)
  stat: { A: [100, 500, 800], B: [25, 150, 250] },   // PLAN §11.7 표 (희귀 풀셋 / 노템)
  band: 5,           // ⓓ 실측 허용 밴드 ±%p (허용 오차보다 넓다 — 위 ⚠ 주석)
  probeN: 300,       // ⓓ 실측 판수 (고정 시드라 결정적)
  probeSeed: 11,
};

const R = [];
const chk = (n, c, d) => { R.push({ n, c }); console.log(`  ${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); return c; };

function loadSim(src) {
  const body = src.replace(/const mode=process\.argv[\s\S]*$/,
    'module.exports={runChapter,mkBuild,buildPower,setSeed,TUNE};');
  const m = { exports: {} };
  vm.runInNewContext(body, { module: m, exports: m.exports, process, console: { log() {} }, require });
  return m.exports;
}

function run(simSrc, planSrc, routineSrc, regressSrc) {
  R.length = 0;

  /* ===== ⓐ 문면 — 기준이 문서에서 지워지지 않았는가 ===== */
  console.log('\n=== ⓐ 문면 (PLAN · ROUTINE) ===');
  chk(`PLAN §7 · 과녁 A (챕터 ${WANT.A.ch} = ${WANT.A.rate}%)`,
    new RegExp(`챕터\\s*${WANT.A.ch}\\s*\\**\\s*클리어율\\s*\\**\\s*${WANT.A.rate}\\s*%`).test(planSrc));
  chk(`PLAN §7 · 과녁 B (챕터 ${WANT.B.ch} = ${WANT.B.rate}%)`,
    new RegExp(`챕터\\s*${WANT.B.ch}\\s*\\**\\s*클리어율\\s*\\**\\s*${WANT.B.rate}\\s*%`).test(planSrc));
  chk(`PLAN §7 · 허용 오차 ±${WANT.tol}%p`, new RegExp(`±\\s*${WANT.tol}\\s*%p`).test(planSrc));
  chk('PLAN §7 · 측정 판수 «1,000판 이상»', /1,?000판\s*이상/.test(planSrc));
  chk('PLAN §7 · 고정 시드 3벌', /고정\s*시드\s*3벌/.test(planSrc));
  chk('PLAN §11.7 · 사다리 7점 폐기 표시', /사다리\s*7점은\s*폐기/.test(planSrc));
  chk(`ROUTINE · 과녁 A (챕터 ${WANT.A.ch} = ${WANT.A.rate}%)`,
    new RegExp(`챕터\\s*${WANT.A.ch}\\s*\\**\\s*클리어율\\s*\\**\\s*${WANT.A.rate}\\s*%`).test(routineSrc));
  chk(`ROUTINE · 과녁 B (챕터 ${WANT.B.ch} = ${WANT.B.rate}%)`,
    new RegExp(`챕터\\s*${WANT.B.ch}\\s*\\**\\s*클리어율\\s*\\**\\s*${WANT.B.rate}\\s*%`).test(routineSrc));
  chk('ROUTINE · 폐기 목록(채점표·비평가 게이트)', /채점표\s*v1~v5[\s\S]{0,80}비평가/.test(routineSrc));

  /* ===== ⓑ 구현 대조 — 문면의 숫자 = 엔진의 상수 ===== */
  console.log('\n=== ⓑ 구현 대조 (PLAN 문면 ↔ sim.js 상수) ===');
  const tgt = (simSrc.match(/const EXP1_TARGETS=\[([\s\S]*?)\];/) || [])[1] || '';
  const rows = [...tgt.matchAll(/rar:(-?\d+),\s*plus:(\d+),\s*slot:(\d+),\s*at:(\d+),\s*want:(\d+)/g)]
    .map(g => ({ rar: +g[1], plus: +g[2], slot: +g[3], at: +g[4], want: +g[5] }));
  chk('EXP1_TARGETS 가 과녁 2점이다', rows.length === 2, `${rows.length}줄`);
  for (const [k, w] of [['A', WANT.A], ['B', WANT.B]]) {
    const r = rows.find(x => x.at === w.ch);
    chk(`과녁 ${k}: 챕터 ${w.ch} · 목표 ${w.rate}% · 장비(rar ${w.rar} · 슬롯 ${w.slot} · 0강)`,
      !!r && r.want === w.rate && r.rar === w.rar && r.slot === w.slot && r.plus === 0,
      r ? `at ${r.at} / want ${r.want} / rar ${r.rar} / slot ${r.slot} / plus ${r.plus}` : '해당 과녁 없음');
  }
  const tol = +((simSrc.match(/const EXP1_TOL=(\d+)/) || [])[1]);
  const scoreN = +((simSrc.match(/const EXP1_SCORE_N=(\d+)/) || [])[1]);
  chk(`EXP1_TOL = ${WANT.tol} (PLAN 문면과 같다)`, tol === WANT.tol, `${tol}`);
  chk(`EXP1_SCORE_N ≥ ${WANT.minN} (주인 «1,000판 이상»)`, scoreN >= WANT.minN, `${scoreN}`);
  chk('판수 기본값이 EXP1_SCORE_N 에 배선돼 있다 (탐색용 EXP1_N 은 덮어쓰기만)',
    /EXP1_N\|\|String\(EXP1_SCORE_N\)/.test(simSrc));

  /* ===== ⓒⓓ 실행 — 하니스 정의와 과녁 실측 ===== */
  console.log('\n=== ⓒ 하니스 (PLAN §11.7 스탯표 ↔ 실제 빌드) ===');
  const S = loadSim(simSrc);
  const near = (v, w) => Math.abs(v - w) <= Math.max(1, w * 0.005);
  const bA = S.mkBuild(WANT.A.rar, 0, WANT.A.slot), bB = S.mkBuild(WANT.B.rar, 0, WANT.B.slot);
  for (const [k, b, w] of [['A 표준 장비(희귀 풀셋·슬롯0)', bA, WANT.stat.A], ['B 노장비(장비0·슬롯0)', bB, WANT.stat.B]]) {
    const p = S.buildPower(b);
    chk(`${k} = 공 ${w[0]} / 체 ${w[1]} / 실 ${w[2]}`,
      near(p.atk, w[0]) && near(p.hp, w[1]) && near(p.sh, w[2]),
      `공 ${p.atk.toFixed(1)} / 체 ${p.hp.toFixed(1)} / 실 ${p.sh.toFixed(1)}`);
  }

  console.log(`\n=== ⓓ 실측 (시드 ${WANT.probeSeed} 고정 · 각 ${WANT.probeN}판 · 밴드 ±${WANT.band}%p) ===`);
  for (const [k, b, w] of [['A', bA, WANT.A], ['B', bB, WANT.B]]) {
    S.setSeed(WANT.probeSeed);
    let win = 0;
    for (let i = 0; i < WANT.probeN; i++) if (S.runChapter(w.ch, b).clear) win++;
    const rate = win / WANT.probeN * 100;
    chk(`과녁 ${k}: 챕터 ${w.ch} 클리어율이 ${w.rate}±${WANT.band}%p 안이다`,
      Math.abs(rate - w.rate) <= WANT.band, `실측 ${rate.toFixed(1)}%`);
  }

  /* ===== ⓔ 폐기 확인 — 옛 채점이 되살아나지 않았는가 ===== */
  console.log('\n=== ⓔ 폐기된 옛 채점이 되살아나지 않았다 ===');
  chk('등급 과녁 [10,20,80] 이 없다', !/EXP1_TARGET\s*=\s*\[\s*10\s*,\s*20\s*,\s*80/.test(simSrc));
  chk('실험2 등급 내 폭 채점(EXP2_SCORE_RAR)이 없다', !/EXP2_SCORE_RAR/.test(simSrc));
  chk('등급 고정 측정(rarityLock)이 없다', !/rarityLock/.test(simSrc));
  chk('실험5 사다리 «합격 2~10%» 판정이 없다 (진단 전용)', !/합격\s*2~10%/.test(simSrc));
  chk('실험4 «기준①» 합격/불합격 판정이 없다', !/기준①\(정체\)[\s\S]{0,200}미만 ✓/.test(simSrc));
  chk('PLAN §7 머리가 옛 기준 폐기를 명시한다', /이\s*절의\s*«기준»\s*은\s*전부\s*폐기/.test(planSrc));

  /* ===== ⓕ 러너 (tools/regress.js) ===== */
  console.log('\n=== ⓕ 회귀 러너 (tools/regress.js) ===');
  const defSeeds = ((regressSrc.match(/const DEFAULT_SEEDS\s*=\s*\[([^\]]*)\]/) || [])[1] || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  chk(`기본 시드가 ${WANT.seeds}벌 이상이다`, defSeeds.length >= WANT.seeds, defSeeds.join('·') || '없음');
  const jTol = +((regressSrc.match(/'1':\s*\(k,\s*v,\s*t\)\s*=>[^\n]*<=\s*(\d+)/) || [])[1]);
  chk(`실험1 판정 허용치 = EXP1_TOL(${WANT.tol})`, jTol === WANT.tol, `${jTol}`);
  chk('실험1 파서가 새 판정표(과녁 2점) 행을 읽는다', /표준 장비\[\^\|\]/.test(regressSrc) || /표준 장비/.test(regressSrc));
  chk('실험5 에 합격 판정이 붙지 않는다 (기준 폐기)', /'5':\s*\(\)\s*=>\s*''/.test(regressSrc));

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
    ['과녁 챕터를 15 → 13 으로 옮기면', s => s.replace('at:15, want:10', 'at:13, want:10'), null, null, null],
    ['과녁 목표를 10 → 20% 로 바꾸면', s => s.replace('at:15, want:10', 'at:15, want:20'), null, null, null],
    ['표준 장비를 전설 풀셋으로 바꾸면', s => s.replace("rar:1, plus:0, slot:0, at:15", "rar:3, plus:0, slot:0, at:15"), null, null, null],
    ['판수 기본값 배선을 끊으면', s => s.replace("EXP1_N||String(EXP1_SCORE_N)", "EXP1_N||'300'"), null, null, null],
    ['성장률 표를 T97 이전으로 되돌리면 (챕터 15 가 다시 100%)',
      s => s.replace('[[0,1.0292],[5,1.122],[15,1.1288],[20,1.0083],[30,1.0488],[50,1.0625],[70,1.0163],[120,1.0133],[260,1.0049]]',
        '[[0,1.0292],[15,1.15],[20,1.0096],[30,1.0565],[50,1.0724],[70,1.0188],[120,1.0154],[260,1.0056]]')
        .replace('[[0,1.0265],[5,1.122],[15,1.1244],[20,1.008],[30,1.0292],[50,1.0289],[70,1.0213],[120,1.012],[260,1.0047]]',
          '[[0,1.0265],[15,1.15],[20,1.0096],[30,1.0349],[50,1.0345],[70,1.0254],[120,1.0143],[260,1.0056]]'), null, null, null],
    ['기저를 크게 올려 노장비 과녁이 무너지면', s => s.replace('eBaseHp:40.6, eBaseDmg:7.55', 'eBaseHp:48.0, eBaseDmg:9.0'), null, null, null],
    ['사다리 «합격 2~10%» 판정을 되살리면', s => s.replace('진단 전용 — 기준 폐기', '합격 2~10%'), null, null, null],
    ['PLAN 에서 과녁 A 문면을 지우면', null, s => s.replace(/챕터 15 클리어율 10%/g, '챕터 15 클리어율 12%'), null, null],
    ['PLAN 에서 판수 규약을 지우면', null, s => s.replace(/1,000판 이상/g, '판수 자유'), null, null],
    ['ROUTINE 에서 과녁 B 문면을 지우면', null, null, s => s.replace(/챕터 4 클리어율 30%/g, '챕터 4 클리어율 40%'), null],
    ['러너 시드를 1벌로 줄이면', null, null, null, s => s.replace('const DEFAULT_SEEDS = [11, 12, 13]', 'const DEFAULT_SEEDS = [11]')],
    ['러너 판정 허용치만 ±5 로 벌리면', null, null, null, s => s.replace('Math.abs(v - t) <= 2', 'Math.abs(v - t) <= 5')],
  ];
  let caught = 0;
  const quiet = console.log;
  for (const [nm, fs_, fp, fr, fg] of cases) {
    console.log = () => {};
    let bad = 0;
    try {
      bad = run(fs_ ? fs_(simSrc) : simSrc, fp ? fp(planSrc) : planSrc,
        fr ? fr(routineSrc) : routineSrc, fg ? fg(regressSrc) : regressSrc);
    } catch (e) { bad = 1; }
    console.log = quiet;
    const ok = bad > 0;
    if (ok) caught++;
    console.log(`  ${ok ? '✓' : '✗'} ${nm} → ${ok ? '빨개진다' : '🔴 안 잡힌다 (죽은 검사)'}`);
  }
  console.log(`\n[음성 검사] ${caught}/${cases.length}`);
  process.exit(caught === cases.length ? 1 : 0);
}

console.log('⚑⚑⚑ T97 게이트 — 밸런스 기준 = 난이도 과녁 2점 (문면 · 구현 · 실측)');
process.exit(run(simSrc, planSrc, routineSrc, regressSrc) ? 1 : 0);
