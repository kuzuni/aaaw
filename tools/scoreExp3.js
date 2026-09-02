#!/usr/bin/env node
/* 실험3 채점기 — `node sim.js 3` 원시 출력을 PLAN §7 목표 구간과 대조해 셀 적합률·구간 소계를 낸다.
 *
 * 왜 도구로 만드는가: R06~R11 이 매 회차 이 표를 손으로 셌고 그때마다 값이 어긋났다
 * (T13 = «101+ 를 아무도 안 셌다», R09 = «21~299 507/507» 재현 실패). 채점 기준이 PLAN §7 한 곳에
 * 적혀 있는데 세는 사람이 매번 달라서 생긴 오차라, 기준을 코드로 한 번만 적어 둔다.
 *
 * 사용:  node tools/scoreExp3.js <원시출력파일...>
 *        node sim.js 3 | node tools/scoreExp3.js -
 * 출력:  구간별 적합 셀 / 전체 셀, 채점표 v2 실험3 3점 환산, 이탈 챕터 목록.
 * 게이트가 아니다 — exit code 는 항상 0 (파일을 못 읽은 경우만 1).
 */
'use strict';
const fs = require('fs');

/* PLAN §7 목표 구간 (v2 채점표 실험3). [lo, hi] 는 시도 횟수 포함 범위.
 * w 는 «구간 전체» 배점이다 (챕터당이 아니다) — 1~20 은 v1 채점표의 1/1/2/1 을 그대로 옮겼고,
 * 21+ 는 그 모양(평범한 구간 1 · 벽 2)을 따라 붙였다. 구간 안에서는 셀 적합률에 비례 감점. */
const BANDS = [
  { name: '1~5',      from: 1,   to: 5,   lo: 1,  hi: 2,   w: 1, half: 'early' },
  { name: '6~9',      from: 6,   to: 9,   lo: 2,  hi: 5,   w: 1, half: 'early' },
  { name: '10 (벽)',  from: 10,  to: 10,  lo: 10, hi: 400, w: 2, half: 'early' },
  { name: '11~19',    from: 11,  to: 19,  lo: 3,  hi: 10,  w: 0.9, half: 'early' },
  { name: '20',       from: 20,  to: 20,  lo: 10, hi: 30,  w: 0.1, half: 'early' },
  { name: '21~49',    from: 21,  to: 49,  lo: 1,  hi: 20,  w: 1, half: 'late' },
  { name: '50~89',    from: 50,  to: 89,  lo: 1,  hi: 40,  w: 1, half: 'late' },
  { name: '90 (벽)',  from: 90,  to: 90,  lo: 30, hi: 400, w: 2, half: 'late' },
  { name: '91~299',   from: 91,  to: 299, lo: 1,  hi: 50,  w: 1, half: 'late' },
  { name: '300 (벽)', from: 300, to: 300, lo: 30, hi: 400, w: 2, half: 'late' },
];
/* 채점표 v2: 실험3 = 3점. «1~20 기존 기준 유지 + 21+ 목표 추가» 라고만 적혀 있고 두 덩어리의
 * 배점 비율은 주인이 정하지 않았다 → 여기서는 균등(1.5 / 1.5)으로 두고, 실제 측정한 구간의
 * 배점 합으로 정규화한다(EXP3_MAX=100 이면 300 벽 구간이 분모에서 빠진다).
 * ⚑ 이 배분은 도구의 기본값일 뿐 주인 확정이 아니다 — 구간별 적합률을 함께 찍는 이유다. */

function parse(txt) {
  const out = new Map();
  for (const line of txt.split('\n')) {
    const m = line.match(/^챕터\s+(\d+):\s*시도\s+(\d+)회/);
    if (m) out.set(Number(m[1]), { tries: Number(m[2]), failed: /회 실패/.test(line) });
  }
  return out;
}

function scoreRun(map, label) {
  const rows = [], strays = [];
  let eGot = 0, eMax = 0, lGot = 0, lMax = 0;
  for (const b of BANDS) {
    let cells = 0, fit = 0;
    for (let c = b.from; c <= b.to; c++) {
      const r = map.get(c);
      if (!r) continue;                       /* 안 돈 챕터는 분모에서 뺀다 (EXP3_MAX 로 잘린 구간) */
      cells++;
      const ok = !r.failed && r.tries >= b.lo && r.tries <= b.hi;
      if (ok) fit++; else strays.push({ c, tries: r.tries, lo: b.lo, hi: b.hi, failed: r.failed });
    }
    if (!cells) continue;
    const ratio = fit / cells;
    rows.push({ band: b.name, fit, cells, ratio, target: `${b.lo}~${b.hi}회`, w: b.w });
    if (b.half === 'early') { eGot += ratio * b.w; eMax += b.w; }
    else                    { lGot += ratio * b.w; lMax += b.w; }
  }
  const early = eMax ? eGot / eMax * 1.5 : 0;
  const late  = lMax ? lGot / lMax * 1.5 : 0;
  return { label, rows, strays, early, late, total: early + late, eGot, eMax, lGot, lMax };
}

const args = process.argv.slice(2);
if (!args.length) { console.error('사용: node tools/scoreExp3.js <원시출력파일...>  (또는 - 로 stdin)'); process.exit(1); }

const runs = [];
for (const f of args) {
  let txt;
  try { txt = f === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(f, 'utf8'); }
  catch (e) { console.error(`읽기 실패: ${f} — ${e.message}`); process.exit(1); }
  const map = parse(txt);
  if (!map.size) { console.error(`챕터 줄을 못 찾았다: ${f}`); continue; }
  runs.push(scoreRun(map, f === '-' ? '(stdin)' : f.replace(/^.*\//, '')));
}
if (!runs.length) process.exit(1);

for (const r of runs) {
  console.log(`\n=== ${r.label} ===`);
  console.log('| 구간 | 목표 | 적합/셀 | 적합률 | 배점 | 소계 |');
  console.log('|---|---|---|---|---|---|');
  for (const row of r.rows)
    console.log(`| ${row.band} | ${row.target} | ${row.fit}/${row.cells} | ${(row.ratio * 100).toFixed(0)}% | ${row.w} | ${(row.ratio * row.w).toFixed(2)} |`);
  console.log(`구간 배점 합: 1~20 ${r.eGot.toFixed(2)}/${r.eMax} · 21+ ${r.lGot.toFixed(2)}/${r.lMax}`);
  console.log(`실험3 환산(균등 1.5/1.5 기본값): 1~20 ${r.early.toFixed(2)} + 21+ ${r.late.toFixed(2)} = **${r.total.toFixed(2)}/3**`);
  if (r.strays.length) {
    const head = r.strays.slice(0, 24)
      .map(s => `${s.c}장 ${s.failed ? `${s.tries}회 실패` : `${s.tries}회`}(목표 ${s.lo}~${s.hi})`).join(' · ');
    console.log(`이탈 ${r.strays.length}개: ${head}${r.strays.length > 24 ? ' …' : ''}`);
  }
}

if (runs.length > 1) {
  const tot = runs.map(r => r.total).sort((a, b) => a - b);
  const mean = tot.reduce((s, x) => s + x, 0) / tot.length;
  const med = tot.length % 2 ? tot[(tot.length - 1) / 2] : (tot[tot.length / 2 - 1] + tot[tot.length / 2]) / 2;
  const e = runs.map(r => r.early), l = runs.map(r => r.late);
  const avg = a => a.reduce((s, x) => s + x, 0) / a.length;
  console.log(`\n=== ${runs.length}런 종합 ===`);
  console.log(`실험3 총점: 평균 ${mean.toFixed(2)} · 중앙값 ${med.toFixed(2)} · 범위 ${tot[0].toFixed(2)}~${tot[tot.length - 1].toFixed(2)} (/3)`);
  console.log(`  구간 평균: 1~20 ${avg(e).toFixed(2)}/1.5 · 21+ ${avg(l).toFixed(2)}/1.5`);
}
