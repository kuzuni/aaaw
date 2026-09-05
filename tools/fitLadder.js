'use strict';
/* 사다리 역측정 진단기 (T35 신설)
   사용: node tools/fitLadder.js            (기본 120판/평가)
         N=300 node tools/fitLadder.js      (표본 늘리기)

   왜 필요한가 — `node sim.js 5` 는 «확정 과녁 챕터의 클리어율» 만 알려준다. 그래서 과녁을 놓쳤을 때
   «얼마나·어느 방향으로» 놓쳤는지가 안 보이고, 특히 **어느 구간의 성장률이 문제인지**를 못 짚는다.
   이 도구는 반대로 «각 등급이 실제로 클리어율 5% 가 되는 챕터» 를 이분 탐색으로 찾아서,
   PLAN §11.7 이 배정한 구간 길이와 실측 구간 길이의 «비율» 을 낸다.
   비율이 1.0 이면 그 구간 성장률은 맞고, 3.24 면 그 구간이 확정표의 3.24배만큼 완만하다는 뜻이다
   (= 성장률을 `현행률^3.24` 로 올려야 확정 과녁에 맞는다).

   ⚠ 이 도구는 «진단» 전용이다 — 여기서 나온 성장률은 §11.7 주인 확정표를 덮어쓰는 근거가 아니라,
      T1 이 주인에게 «확정표대로면 이렇게 어긋난다» 를 보고할 때 쓰는 수치다.

   sim.js 는 require 하면 CLI 디스패처가 실험을 돌려버리므로, 다른 게이트와 같은 방식으로
   `const mode=process.argv[2]` 앞까지 잘라 vm 컨텍스트에서 평가한다. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(root, 'sim.js'), 'utf8');
const CUT = "const mode=process.argv[2]||'all';";
const at = SRC.indexOf(CUT);
if (at < 0) throw new Error(`sim.js 에서 CLI 디스패처(«${CUT}») 를 못 찾았다 — 잘림 기준이 바뀌었다`);

const ctx = { console: { log() {} }, process, Math, JSON, Number, String, Array, Set, Map, Object, Date,
              parseInt, parseFloat, isFinite, isNaN, require };
vm.createContext(ctx);
vm.runInContext(SRC.slice(0, at) + '\n;globalThis.__X={mkBuild,buildPower,runChapter,LADDER,LADDER_OPTS,EXP1_TARGETS,TUNE,GT};', ctx);
const X = ctx.__X || ctx.globalThis.__X;

const N = parseInt(process.env.N || '120', 10);
const HI = parseInt(process.env.HI || String(X.TUNE.maxChapter), 10);
/* ⚑⚑⚑ T160 — 이 진단기가 **자를 안 쓰고 있었다**: `runChapter(c,b,{})` 는 게임 조건(3택 특전 · 기본 스탯 0 ·
   장비 세트 옵션 켬)이라, 사다리 과녁과 대조하는 «실측 챕터» 가 통째로 딴 빌드의 것이었다.
   실험1·실험5·`verifyScoreCriteria` 가 쓰는 것과 **같은 `LADDER_OPTS`** 를 넘긴다
   (base10 + 기본 스탯 옛 값 20 + 세트 옵션 끔 — 주인 확정 측정 조건 ②). */
const rate = (c, b) => { let w = 0; for (let i = 0; i < N; i++) if (X.runChapter(c, b, X.LADDER_OPTS).clear) w++; return w / N * 100; };

console.log(`=== 사다리 역측정 (각 등급이 클리어율 5% 가 되는 챕터 · ${N}판/평가 · 탐색 상한 ${HI}) ===\n`);
console.log('| 상태 | 확정 과녁 | 실측 5% 챕터 | 차 |');
console.log('|---|---|---|---|');
/* ⚑ T103 — 사다리 칸이 **슬롯 레벨까지** 포함하도록 주인이 확정했다(희귀+5 · 전설+15 … 9강+100 — ⚑ T153 로 영웅 칸 삭제).
   종전엔 `mkBuild(rar, plus, 0)` 으로 슬롯을 0 으로 눌러 재고 있었으니 «확정 과녁 대비 몇 챕터»
   라는 이 도구의 결론이 통째로 딴 빌드의 것이었다. 이제 `EXP1_TARGETS` 의 슬롯을 그대로 쓴다. */
const out = [];
for (const L of X.EXP1_TARGETS) {
  const b = X.mkBuild(L.rar, L.plus, L.slot);
  if (rate(1, b) < 5) { console.log(`| ${L.id} | ${L.at} | <1 | — |`); out.push([L.id, L.at, 0, true]); continue; }
  let lo = 1, hi = HI;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (rate(mid, b) >= 5) lo = mid; else hi = mid - 1; }
  const capped = lo >= HI;
  console.log(`| ${L.id} | ${L.at} | ${lo}${capped ? ' (상한)' : ''} | ${lo - L.at >= 0 ? '+' : ''}${lo - L.at} |`);
  out.push([L.id, L.at, lo, capped]);
}

console.log('\n구간별 «확정표가 배정한 챕터 수» vs «실측 필요 챕터 수»:');
console.log('| 구간 | 확정 | 실측 | 비율 | 필요 성장률(현행률^비율) |');
console.log('|---|---|---|---|---|');
const SEG = X.TUNE.eHpSeg;
for (let i = 1; i < out.length; i++) {
  const [id0, at0, f0] = out[i - 1], [id1, at1, f1, cap1] = out[i];
  const ratio = (f1 - f0) / (at1 - at0);
  /* 이 구간을 지배하는 성장률 = 확정 과녁 at0 이 속한 구간의 배수 */
  let g = SEG[0][1]; for (const s of SEG) if (at0 >= s[0]) g = s[1];
  const need = Math.pow(g, ratio);
  console.log(`| ${id0}→${id1} | ${at1 - at0} | ${f1 - f0}${cap1 ? '↑' : ''} | ${ratio.toFixed(2)}배 | ${((g - 1) * 100).toFixed(2)}% → ${((need - 1) * 100).toFixed(2)}% |`);
}
console.log('\n(«실측» 에 ↑ 가 붙으면 탐색 상한에 걸린 값이라 실제로는 더 크다. HI=<챕터> 로 상한을 올릴 수 있다.)');
