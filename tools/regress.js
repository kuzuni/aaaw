#!/usr/bin/env node
/* tools/regress.js — 회귀 측정 러너 (T87 · T74 가 «규약화» 로 남긴 몫)
 *
 * 왜 있나. R01~R05 내내 실험1·2·5 회귀 수치가 **무시드 1벌**로 적혀 회차 간 비교가 성립하지 않았다
 * (T74: 실험1 희귀 칸이 재실행마다 14.7~21.0% · 실험5 신화+9강이 2.5~9.0%). 실제로 R05 초판 문서
 * 한 절에 서로 다른 두 런의 숫자가 섞여 들어간 사고까지 났다. PLAN §7 «회귀 측정 규약» 3조를
 * 사람이 매번 손으로 지키는 대신 이 러너가 대신 지킨다 —
 *   ① 고정 시드 3벌 이상으로 돌리고 ② 채점 판수 기본값(상수)을 그대로 쓰고
 *   ③ 시드별 원시값과 평균·폭을 **회차 문서에 그대로 붙일 수 있는 표**로 찍는다.
 *
 * 사용:
 *   node tools/regress.js                      # 시드 11·12·13 · 실험1·5
 *   REGRESS_EXP=1,2,5 node tools/regress.js    # 실험2(12,000판 × 시드 수)까지 — 오래 걸린다
 *   REGRESS_SEEDS=21,22,23,24 node tools/regress.js
 *   REGRESS_RAW=<디렉터리> node tools/regress.js  # 시드별 원시 출력을 그 디렉터리에 저장(규약 ③ 용)
 *
 * 이 파일은 **측정 도구**다 — 엔진 수치를 한 글자도 건드리지 않는다(밸런스 영향 0).
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/* 규약 ① — 고정 시드 3벌 (게이트 verifySeedProtocol 가 «기본 시드 ≥3벌» 을 소스에서 읽어 확인한다) */
const DEFAULT_SEEDS = [11, 12, 13];
const SEEDS = (process.env.REGRESS_SEEDS || DEFAULT_SEEDS.join(','))
  .split(',').map(s => s.trim()).filter(Boolean).map(Number);
const EXPS = (process.env.REGRESS_EXP || '1,5').split(',').map(s => s.trim()).filter(Boolean);
const RAWDIR = process.env.REGRESS_RAW || '';
const ROOT = path.join(__dirname, '..');

if (SEEDS.length < 3) {
  console.error(`✗ 시드가 ${SEEDS.length}벌이다 — PLAN §7 회귀 측정 규약 ① 은 3벌 이상을 요구한다.`);
  process.exit(1);
}
if (RAWDIR) fs.mkdirSync(RAWDIR, { recursive: true });

function run(exp, seed) {
  const env = Object.assign({}, process.env, { SEED: String(seed) });
  /* 판수는 **주지 않는다** — 규약 ② 대로 채점 기본값(EXP2_SCORE_N·EXP5_SCORE_N)이 그대로 쓰이게 둔다. */
  delete env.EXP2_N; delete env.EXP5_N; delete env.EXP5_ONLY; delete env.EXP5_SPAN;
  const t0 = Date.now();
  const out = execFileSync(process.execPath, ['sim.js', exp], { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 1 << 28 });
  const sec = ((Date.now() - t0) / 1000).toFixed(0);
  if (RAWDIR) fs.writeFileSync(path.join(RAWDIR, `exp${exp}-seed${seed}.txt`), out);
  console.error(`  · 실험${exp} 시드 ${seed} — ${sec}s`);
  return out;
}

/* ---------- 파서 (원시 출력에서 «그대로» 뽑는다 — 규약 ③) ---------- */
const num = s => Number(s);

function parse1(out) {
  const m = {};
  for (const g of out.matchAll(/^\s*\|\s*(일반|희귀|전설)\s*\|\s*(\d+)%\s*\|\s*([\d.]+)%\s*\|/gm))
    m[g[1]] = { target: num(g[2]), v: num(g[3]) };
  const mix = out.match(/^혼합: 클리어 ([\d.]+)%/m);
  if (mix) m['혼합'] = { target: null, v: num(mix[1]) };
  return m;
}
function parse5(out) {
  const m = {};
  for (const g of out.matchAll(/^\s*\|\s*(노템|일반|희귀|영웅|전설|신화\+9강|신화)\s*\|\s*(\d+)\s*\|\s*([\d.]+)%\s*\|/gm))
    m[`${g[1]}(ch${g[2]})`] = { target: null, v: num(g[3]) };
  return m;
}
function parse2(out) {
  const m = {};
  const all = out.match(/^전체 클리어율: ([\d.]+)%/m);
  if (all) m['전체 클리어율'] = { target: null, v: num(all[1]) };
  for (const g of out.matchAll(/^\s*(일반|희귀|전설): 최상 \S+ [\d.]+% \/ 최하 \S+ [\d.]+% → 폭 ([\d.]+)%p/gm))
    m[`${g[1]} 폭`] = { target: null, v: num(g[2]) };
  return m;
}
const PARSE = { '1': parse1, '2': parse2, '5': parse5 };
const JUDGE = {
  '1': (k, v, t) => (t === null ? '' : (Math.abs(v - t) <= 5 ? '✓' : '✗')),          // 과녁 ±5%p
  '2': (k, v) => (k.endsWith(' 폭') ? (v < 25 ? '✓' : '✗') : ''),                     // 등급 내 폭 <25%p
  '5': (k, v) => (v >= 2 && v <= 10 ? '✓' : '✗'),                                     // 사다리 합격 2~10%
};
const TITLE = { '1': '실험1 등급 과녁', '2': '실험2 등급 내 폭', '5': '실험5 스탯 사다리' };

/* ---------- 실행 ---------- */
console.error(`# 회귀 측정 (시드 ${SEEDS.join('·')} · 실험 ${EXPS.join('·')})`);
const md = [];
md.push(`### 회귀 측정 — 시드 ${SEEDS.join(' · ')} 고정 (PLAN §7 규약 ①②③ · \`tools/regress.js\`)`);
md.push('');
let passLine = [];
for (const exp of EXPS) {
  if (!PARSE[exp]) { console.error(`  ! 실험${exp} 은 이 러너가 파싱하지 않는다 — 건너뛴다`); continue; }
  const per = SEEDS.map(s => PARSE[exp](run(exp, s)));
  const keys = [...new Set(per.flatMap(o => Object.keys(o)))];
  md.push(`**${TITLE[exp]}**`);
  md.push('');
  md.push(`| 칸 | ${SEEDS.map(s => `시드 ${s}`).join(' | ')} | 평균 | 폭 | 판정(평균) |`);
  md.push(`|---|${SEEDS.map(() => '---').join('|')}|---|---|---|`);
  let pass = 0, judged = 0;
  for (const k of keys) {
    const vs = per.map(o => (o[k] ? o[k].v : NaN)).filter(Number.isFinite);
    if (!vs.length) continue;
    const mean = vs.reduce((a, b) => a + b, 0) / vs.length;
    const span = Math.max(...vs) - Math.min(...vs);
    const t = (per.find(o => o[k]) || {})[k].target ?? null;
    const j = JUDGE[exp](k, mean, t);
    if (j) { judged++; if (j === '✓') pass++; }
    md.push(`| ${k}${t !== null ? ` (과녁 ${t}%)` : ''} | ${per.map(o => (o[k] ? o[k].v.toFixed(1) : '—')).join(' | ')} | **${mean.toFixed(1)}** | ${span.toFixed(1)}%p | ${j || '—'} |`);
  }
  if (judged) { md.push(''); md.push(`합격 **${pass}/${judged}** (시드 ${SEEDS.length}벌 평균 기준)`); passLine.push(`${TITLE[exp]} ${pass}/${judged}`); }
  md.push('');
}
md.push(`※ 위 수치는 러너가 원시 출력에서 그대로 뽑은 것이다 — 회차 문서에 붙일 때 다시 돌린 런의 값을 섞지 말 것(PLAN §7 규약 ③).`);
console.log(md.join('\n'));
if (passLine.length) console.error(`\n요약: ${passLine.join(' · ')}`);
