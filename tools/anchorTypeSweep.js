#!/usr/bin/env node
'use strict';
/* 앵커 계열 조합 전수 스윕 (T23 진단 도구 — 게이트 아님, exit 는 항상 0)
 *
 * 왜 필요한가: PLAN §11.7 의 앵커 A·B·C 는 «모든 부위 <등급> <강화>강 + 슬롯 균등 <L>렙» 로만
 * 정의돼 있고 **계열(종류)을 지정하지 않는다.** 부위마다 종류가 3개라 한 앵커는 점이 아니라
 * 3^6 = 729개 빌드의 집합이다. 그런데 `sim.js` 의 `exp5_anchor()` 는 `mkBuild(rar,plus,slot)` 를
 * typeIdx 없이 불러 늘 729개 중 1개(전부 첫 종류)만 잰다 (T20).
 * 이 도구는 그 집합 전체를 재서 «앵커가 실제로 몇 %의 조합에서 성립하는가» 를 낸다.
 *
 * 사용법:
 *   node tools/anchorTypeSweep.js            # 앵커 A(챕터 90) 전수, 조합당 20판
 *   ANCHOR=C node tools/anchorTypeSweep.js   # 앵커 C(챕터 30)
 *   ANCHOR=B N=10 node tools/anchorTypeSweep.js
 *   SAMPLE=60 node tools/anchorTypeSweep.js  # 729 중 무작위 60개만 (빠른 확인)
 * 환경변수: ANCHOR=A|B|C · N=조합당 판수 · SAMPLE=표본 조합 수(0=전수) · SEED=표본 시드
 *
 * `sim.js` 는 한 글자도 건드리지 않는다 — 소스에서 실행 디스패치 블록만 떼고 함수를 빌려 쓴다.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'sim.js');
const src = fs.readFileSync(SRC, 'utf8').replace(/const mode\s*=\s*process\.argv\[2\][\s\S]*$/, '');
if (/process\.argv\[2\]/.test(src)) { console.error('sim.js 의 실행 디스패치 블록을 못 떼어냈다 — 도구의 정규식을 고칠 것'); process.exit(1); }
const sim = new Function(src + '\nreturn {runChapter,GT,buildPower,evenBonus};')();
const { runChapter, GT, buildPower, evenBonus } = sim;

/* PLAN §11.7 앵커 3점 (등급·강화·슬롯·과녁 챕터) — sim.js 의 ANCHORS 와 같은 값 */
const ANCHORS = {
  C: { rar: 3, plus: 0, slot: 10, at: 30 },
  A: { rar: 4, plus: 0, slot: 15, at: 90 },
  B: { rar: 4, plus: 9, slot: 50, at: 300 },
};
/* 주인 확정 «겨우 클리어» 의 판정 밴드 (승인 대기 10번에서 다투는 값 — 여기선 T6 제안값을 그대로 쓴다) */
const BAND = [2, 10];

function buildWithIdx(rar, plus, slotLv, idx) {
  const eq = {}, slots = {};
  GT.parts.forEach((pt, i) => {
    eq[pt] = { part: pt, type: GT.types[pt][idx[i]], rar, plus: plus || 0 };
    slots[pt] = slotLv || 0;
  });
  return { eq, slots };
}
const idxOf = n => { const a = [0, 0, 0, 0, 0, 0]; let v = n; for (let i = 5; i >= 0; i--) { a[i] = v % 3; v = (v - a[i]) / 3; } return a; };
const nameOf = a => a.map((v, i) => GT.typeName[GT.types[GT.parts[i]][v]]).join('/');

const id = (process.env.ANCHOR || 'A').toUpperCase();
const A = ANCHORS[id];
if (!A) { console.error(`ANCHOR 는 A·B·C 중 하나여야 한다 (받은 값: ${id})`); process.exit(1); }
const N = parseInt(process.env.N || '20', 10);
const SAMPLE = parseInt(process.env.SAMPLE || '0', 10);

let combos = [];
for (let n = 0; n < 729; n++) combos.push(n);
if (SAMPLE > 0 && SAMPLE < 729) {
  let s = parseInt(process.env.SEED || '20260902', 10) | 0;
  const rnd = () => { s = (s * 1103515245 + 12345) | 0; return ((s >>> 0) % 1e6) / 1e6; };
  for (let i = combos.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [combos[i], combos[j]] = [combos[j], combos[i]]; }
  combos = combos.slice(0, SAMPLE);
  /* 조합 0(= 현행 하니스가 재는 유일한 조합)은 비교 기준이라 표본에서 빠지면 안 된다 */
  if (!combos.includes(0)) combos[combos.length - 1] = 0;
}

console.log(`=== 앵커 ${id} 계열 조합 스윕 (${GT.rarName[A.rar]} +${A.plus}강 · 슬롯 균등 ${A.slot}렙 · 과녁 챕터 ${A.at}) ===`);
console.log(`  조합 ${combos.length}${SAMPLE ? `/729 (무작위 표본)` : '개 전수'} × ${N}판 = ${combos.length * N}판`);
const pw0 = buildPower(buildWithIdx(A.rar, A.plus, A.slot, [0, 0, 0, 0, 0, 0]));
console.log(`  기준 전투력(계열 무관 — 등급·강화·슬롯만 반영): 공 ${pw0.atk.toExponential(3)} · 체 ${pw0.hp.toExponential(3)}`);

const res = [];
for (const n of combos) {
  const idx = idxOf(n);
  const b = buildWithIdx(A.rar, A.plus, A.slot, idx);
  let w = 0;
  for (let i = 0; i < N; i++) if (runChapter(A.at, b, {}).clear) w++;
  res.push({ n, idx, rate: w / N * 100 });
}
res.sort((a, b) => a.rate - b.rate);
const rates = res.map(x => x.rate);
const cnt = f => res.filter(f).length;
const pct = k => (k / res.length * 100).toFixed(1) + '%';
const q = p => rates[Math.min(rates.length - 1, Math.floor(p * rates.length))];

console.log(`\n  [분포] 0%: ${cnt(x => x.rate === 0)} (${pct(cnt(x => x.rate === 0))})`
  + ` · 0<r<${BAND[0]}%: ${cnt(x => x.rate > 0 && x.rate < BAND[0])}`
  + ` · ${BAND[0]}~${BAND[1]}%(과녁): ${cnt(x => x.rate >= BAND[0] && x.rate <= BAND[1])} (${pct(cnt(x => x.rate >= BAND[0] && x.rate <= BAND[1]))})`
  + ` · ${BAND[1]}~50%: ${cnt(x => x.rate > BAND[1] && x.rate < 50)}`
  + ` · 50~99%: ${cnt(x => x.rate >= 50 && x.rate < 100)}`
  + ` · 100%: ${cnt(x => x.rate === 100)} (${pct(cnt(x => x.rate === 100))})`);
console.log(`  [분위] p05 ${q(0.05).toFixed(1)}% · p25 ${q(0.25).toFixed(1)}% · p50 ${q(0.50).toFixed(1)}% · p75 ${q(0.75).toFixed(1)}% · p95 ${q(0.95).toFixed(1)}% · 평균 ${(rates.reduce((a, b) => a + b, 0) / res.length).toFixed(1)}%`);
console.log(`  [하위 5] ${res.slice(0, 5).map(x => `${nameOf(x.idx)} ${x.rate.toFixed(0)}%`).join(' | ')}`);
console.log(`  [상위 5] ${res.slice(-5).map(x => `${nameOf(x.idx)} ${x.rate.toFixed(0)}%`).join(' | ')}`);
const base = res.find(x => x.n === 0);
console.log(`  [현행 하니스가 재는 1조합] ${nameOf([0, 0, 0, 0, 0, 0])} → ${base.rate.toFixed(1)}%  (전체 ${res.length}개 중 낮은 쪽에서 ${res.indexOf(base) + 1}번째)`);
console.log(`\n  [부위별 계열 한계효과 — 그 계열을 낀 조합들의 평균 클리어율]`);
GT.parts.forEach((pt, i) => {
  const row = [0, 1, 2].map(v => {
    const a = res.filter(x => x.idx[i] === v);
    return { ty: GT.typeName[GT.types[pt][v]], m: a.length ? a.reduce((p, c) => p + c.rate, 0) / a.length : NaN };
  }).sort((a, b) => b.m - a.m);
  console.log(`   ${GT.partName[pt]}: ` + row.map(r => `${r.ty} ${r.m.toFixed(1)}%`).join(' · ') + `  (최대−최소 ${(row[0].m - row[2].m).toFixed(1)}%p)`);
});
