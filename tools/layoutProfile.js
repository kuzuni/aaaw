#!/usr/bin/env node
'use strict';
/* 챕터 레이아웃 프로파일 (R12 진단 도구 — 게이트 아님, exit 는 항상 0)
 *
 * 왜 필요한가: `chapterLayout(c)` 는 챕터 번호만으로 시드된 고정 제비뽑기라 챕터마다
 * **적 마릿수 40~60 (×1.5)** 와 **쉼터 1~4회** 가 무작위로 정해진다. 이 요철은 `TUNE` 의
 * 어떤 전역 노브로도 못 없앤다(«구조적 발견» 3번). 그런데 채점표의 여러 항목이 «인접 챕터끼리의
 * 난이도 순서» 를 요구한다 — 실험5 의 «과녁 다음 챕터 2% 이하»·«직전 2개 50% 이상» 이 그렇다.
 * 이 도구는 레이아웃 표와 실측 클리어율을 나란히 찍어 «그 순서가 난이도가 아니라 제비뽑기로
 * 정해지고 있는지» 를 눈으로 확인할 수 있게 한다.
 *
 * 사용법:
 *   node tools/layoutProfile.js                    # 챕터 1~20 레이아웃 표만 (측정 없음, 즉시)
 *   FROM=85 TO=95 node tools/layoutProfile.js      # 그 구간 레이아웃 표
 *   FROM=85 TO=95 BUILD=A N=150 node tools/layoutProfile.js   # 앵커 A 빌드로 클리어율까지 측정
 * 환경변수: FROM · TO · BUILD=A|B|C (주면 측정 수행) · N=챕터당 판수(기본 150) · SEED
 *
 * `sim.js` 는 한 글자도 건드리지 않는다 — 소스에서 실행 디스패치 블록만 떼고 함수를 빌려 쓴다.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'sim.js');
const src = fs.readFileSync(SRC, 'utf8').replace(/const mode\s*=\s*process\.argv\[2\][\s\S]*$/, '');
if (/process\.argv\[2\]/.test(src)) { console.error('sim.js 의 실행 디스패치 블록을 못 떼어냈다 — 도구의 정규식을 고칠 것'); process.exit(1); }
const sim = new Function(src + '\nreturn {runChapter,chapterLayout,mkBuild,buildPower,setSeed};')();
const { runChapter, chapterLayout, mkBuild, setSeed } = sim;

/* PLAN §11.7 앵커 3점 — sim.js 의 ANCHORS 와 같은 값 */
const BUILDS = { C: [3, 0, 10], A: [4, 0, 15], B: [4, 9, 50] };

const FROM = parseInt(process.env.FROM || '1', 10);
const TO   = parseInt(process.env.TO   || '20', 10);
const N    = parseInt(process.env.N    || '150', 10);
const BUILD = process.env.BUILD;
if (process.env.SEED) setSeed(Number(process.env.SEED));

/* chapterLayout 은 {t:'wave',size} / {t:'rest'|'devil'|'angel'} / {t:'boss'} 배열을 돌려준다.
 * 여기서는 그 배열을 되짚어 «적 마릿수·쉼터·악마·천사» 로 요약한다 (레이아웃 규칙을 복제하지 않는다). */
function profile(c) {
  const out = chapterLayout(c);
  let waves = 0, size = 0, rest = 0, devil = 0, angel = 0;
  for (const e of out) {
    if (e.t === 'wave') { waves++; size = e.size; }
    else if (e.t === 'rest') rest++;
    else if (e.t === 'devil') devil++;
    else if (e.t === 'angel') angel++;
  }
  return { waves, size, total: waves * size, rest, devil, angel };
}

const b = BUILD ? mkBuild(...BUILDS[BUILD]) : null;
if (BUILD && !b) { console.error(`BUILD 는 A·B·C 중 하나여야 한다 (받은 값: ${BUILD})`); process.exit(1); }

console.log(`\n=== 챕터 레이아웃 프로파일 (챕터 ${FROM}~${TO}${BUILD ? ` · 앵커 ${BUILD} 빌드로 ${N}판씩 측정` : ' · 레이아웃만'}) ===\n`);
console.log(`| 챕터 | 웨이브 | 적 마릿수 | 쉼터 | 악마 | 천사 |${BUILD ? ' 클리어율 |' : ''}`);
console.log(`|---|---|---|---|---|---|${BUILD ? '---|' : ''}`);

const rows = [];
for (let c = FROM; c <= TO; c++) {
  const p = profile(c);
  let rate = null;
  if (b) { let w = 0; for (let i = 0; i < N; i++) if (runChapter(c, b, {}).clear) w++; rate = w / N * 100; }
  rows.push({ c, ...p, rate });
  console.log(`| ${c} | ${p.waves}×${p.size} | **${p.total}** | ${p.rest} | ${p.devil} | ${p.angel} |` +
              (b ? ` ${rate.toFixed(1)}% |` : ''));
}

/* 요약: 마릿수가 난이도 순서를 뒤집고 있는지 — 인접 쌍에서 «뒤 챕터가 더 쉬운» 역전을 센다. */
if (b) {
  const inv = [];
  for (let i = 1; i < rows.length; i++)
    if (rows[i].rate > rows[i - 1].rate + 0.01) inv.push(rows[i]);
  console.log(`\n인접 역전(뒤 챕터가 더 쉬움) ${inv.length}건${inv.length ? ': ' + inv.map(r =>
    `${r.c - 1}장 ${rows[rows.indexOf(r) - 1].rate.toFixed(1)}%(적 ${rows[rows.indexOf(r) - 1].total}) → ${r.c}장 ${r.rate.toFixed(1)}%(적 ${r.total})`).join(' · ') : ''}`);
  const withRate = rows.filter(r => r.rate > 0);
  if (withRate.length > 2) {
    /* 마릿수와 클리어율(로그)의 순위상관 — 챕터 번호가 아니라 마릿수가 난이도를 끄는지 본다 */
    const rank = (arr, key, dir) => { const s = [...arr].sort((x, y) => dir * (x[key] - y[key])); return arr.map(r => s.indexOf(r) + 1); };
    const a1 = rank(withRate, 'total', 1), a2 = rank(withRate, 'rate', 1);
    const n = withRate.length;
    const d2 = a1.reduce((s, v, i) => s + (v - a2[i]) ** 2, 0);
    console.log(`적 마릿수 ↔ 클리어율 순위상관(스피어만): ${(1 - 6 * d2 / (n * (n * n - 1))).toFixed(2)}  (n=${n}, 음수일수록 «많으면 어렵다»)`);
  }
}
console.log('');
