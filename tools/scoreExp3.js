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

/* ⚑ T67 수리 (T1 R05) — 파싱이 «어디까지 돌기로 했나»(헤더의 상한)까지 읽는다.
   종전에는 맵에 없는 챕터를 전부 «안 돈 챕터» 로 보고 분모에서 뺐는데, 실패로 런이 끊긴 뒤의
   미도달 챕터까지 같이 빠져서 «일찍 죽을수록 남은 구간의 적합률만 남아 점수가 오르는» 역전이 생겼다.
   상한(EXP3_MAX)은 설정이고 조기 사망은 결과다 — 둘을 구별해야 자(尺)가 단조로워진다. */
/* ⚑ T75 수리 — «하니스 재시도 상한» 은 «채점 목표 상한»(벽 400회)보다 커야 이 자가 성립한다.
   같은 숫자였을 때는 400 에 닿은 셀이 언제나 «400회 실패» 로 적혀 목표 상한이 도달 불가능했고,
   «401회면 뚫었을 계정» 과 «4,000회여도 못 뚫을 계정» 이 한 칸에 뭉개졌다. sim.js 가 헤더에
   상한을 적어 주므로(«재시도 상한 N회») 옛 원시 출력도 여기서 판별해 경고한다. */
const HI_MAX = Math.max(...BANDS.map(b => b.hi));

function parse(txt) {
  const out = new Map();
  let maxc = 0, failedAt = 0, limit = 0;
  const h = txt.match(/실험3:[^\n]*챕터\s*1\s*→\s*(\d+)/);
  if (h) maxc = Number(h[1]);
  const hl = txt.match(/재시도 상한\s*(\d+)\s*회/);
  if (hl) limit = Number(hl[1]);
  for (const line of txt.split('\n')) {
    const m = line.match(/^챕터\s+(\d+):\s*시도\s+(\d+)회/);
    if (m) {
      const c = Number(m[1]), failed = /회 실패/.test(line);
      out.set(c, { tries: Number(m[2]), failed });
      if (failed && !failedAt) failedAt = c;
    }
  }
  /* 헤더를 못 읽은 예전 원시 출력은 «돈 챕터의 최대값» 을 상한으로 본다 (그 경우 미도달 판정이 없다). */
  if (!maxc) maxc = out.size ? Math.max(...out.keys()) : 0;
  /* 헤더에 상한이 없는 옛 출력은 «실패 셀의 시도 횟수» 가 곧 그때의 상한이다 (T75 이전 = 400). */
  if (!limit) for (const r of out.values()) if (r.failed) { limit = r.tries; break; }
  return { map: out, maxc, failedAt, limit };
}

function scoreRun(run, label) {
  const { map, maxc, failedAt, limit } = run;
  const rows = [], strays = [];
  let eGot = 0, eMax = 0, lGot = 0, lMax = 0, unreached = 0;
  for (const b of BANDS) {
    let cells = 0, fit = 0;
    for (let c = b.from; c <= Math.min(b.to, maxc); c++) {   /* 분모 = «돌기로 한» 챕터 전부 */
      const r = map.get(c);
      if (!r) {
        /* 맵에 없다 = 런이 그 앞에서 끊겼다. 실패로 끊겼으면 미도달도 «부적합 셀» 이다
           (분모에서 빼면 일찍 죽는 쪽이 유리해진다 — T67). 실패 없이 끊긴 건 있을 수 없지만
           방어적으로 그때만 분모에서 뺀다. */
        if (!failedAt) continue;
        cells++; unreached++;
        if (strays.length < 400) strays.push({ c, tries: 0, lo: b.lo, hi: b.hi, failed: false, unreached: true });
        continue;
      }
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
  return { label, rows, strays, early, late, total: early + late, eGot, eMax, lGot, lMax, unreached, failedAt, maxc, limit };
}

const args = process.argv.slice(2);
if (!args.length) { console.error('사용: node tools/scoreExp3.js <원시출력파일...>  (또는 - 로 stdin)'); process.exit(1); }

const runs = [];
for (const f of args) {
  let txt;
  try { txt = f === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(f, 'utf8'); }
  catch (e) { console.error(`읽기 실패: ${f} — ${e.message}`); process.exit(1); }
  const run = parse(txt);
  if (!run.map.size) { console.error(`챕터 줄을 못 찾았다: ${f}`); continue; }
  runs.push(scoreRun(run, f === '-' ? '(stdin)' : f.replace(/^.*\//, '')));
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
  if (r.failedAt) console.log(`⚑ 런 조기 종료: 챕터 ${r.failedAt} 에서 실패 — 이후 ${r.unreached}칸을 «미도달(부적합)» 로 센다 (상한 ${r.maxc})`);
  /* ⚑ T75 — 재시도 상한이 목표 상한 이하인 원시 출력은 벽 구간을 «원리적으로» 통과시킬 수 없다. */
  if (r.limit && r.limit <= HI_MAX)
    console.log(`⚠ 이 원시 출력의 재시도 상한(${r.limit}회)이 채점 목표 상한(${HI_MAX}회) 이하다 — 벽 구간은 절대 적합이 될 수 없고 «느리지만 결국 클리어» 가 «영구 정체» 와 구별되지 않는다 (T75). 상한을 목표 상한보다 크게 두고 다시 재라.`);
  if (r.strays.length) {
    const head = r.strays.filter(s => !s.unreached).slice(0, 24)
      .map(s => `${s.c}장 ${s.failed ? `${s.tries}회 실패` : `${s.tries}회`}(목표 ${s.lo}~${s.hi})`).join(' · ');
    console.log(`이탈 ${r.strays.length}개(그중 미도달 ${r.unreached}): ${head}${r.strays.length > 24 ? ' …' : ''}`);
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
