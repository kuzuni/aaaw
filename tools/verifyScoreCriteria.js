#!/usr/bin/env node
'use strict';
/* T30 게이트 — «채점 기준·측정 설정» 축 (PLAN §7 문면 ↔ sim.js 하니스/판정 ↔ tools/scoreExp3.js)
 *
 * 왜 필요한가:
 *   기존 게이트 6종은 전부 «게임이 어떤 숫자로 굴러가는가» 를 본다.
 *     verifyPlanConst(T16) 경제·적 상수 · verifyOptText(T17) 설명문 숫자 ·
 *     verifySaturation(T19) 효과 포화 · verifyPerkGearDup(T24) px 키 중복 ·
 *     verifyPerkPolicy(T25) 특전 선택 정책 · verifyGearEcon(T29) 장비 경제 동작.
 *   **«그 게임을 어떤 잣대로 재고 채점하는가» 는 한 항목도 검사되지 않는다.**
 *   T21 이 이 사각지대를 이미 지적했다("기존 게이트 3종은 하니스 문구를 한 항목도 검사하지 않는다",
 *   `grep -c 'EXP2_GEAR|하니스' tools/verifyPlanConst.js` = 0). 그 뒤로도 게이트는 안 생겼다.
 *   측정 설정이 어긋나면 밸런스가 옳아도 점수가 틀린다 — T13(101+ 를 아무도 안 셌다) ·
 *   T21(실험2 하니스 문면 불일치) · T26(하니스 재보정 누락) 이 전부 이 축에서 났다.
 *
 * 대조 대상: PLAN §7 (문서) ↔ sim.js 의 실험1~5 하니스·판정 임계 ↔ tools/scoreExp3.js 의 BANDS.
 * 파싱 실패는 조용한 통과가 아니라 즉시 실패로 처리한다 (T25 의 교훈).
 *
 * 사용: node tools/verifyScoreCriteria.js      (exit 0 = 통과, 1 = 불일치)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PLAN = fs.readFileSync(path.join(ROOT, 'PLAN.md'), 'utf8');
const SIM = fs.readFileSync(path.join(ROOT, 'sim.js'), 'utf8');
const SCORE3 = fs.readFileSync(path.join(ROOT, 'tools', 'scoreExp3.js'), 'utf8');

const RAR = ['일반', '희귀', '영웅', '전설', '신화'];

const rows = [];       /* {name, plan, impl, ok, note} */
const parseFails = [];

/** PLAN 에서 정규식 1개를 뽑는다. 못 찾으면 파싱 실패로 등재(조용한 통과 금지). */
function pick(src, label, re, group) {
  const m = src.match(re);
  if (!m) { parseFails.push(label); return null; }
  return group === undefined ? m : m[group];
}
function cmp(name, plan, impl, note) {
  if (plan === null || impl === null) return;      /* 파싱 실패는 위에서 이미 등재 */
  rows.push({ name, plan: String(plan), impl: String(impl), ok: String(plan) === String(impl), note });
}

/* PLAN §7 하니스 표기: «<등급>[+<강화>] 6부위 · 슬롯 <N>렙» (T31 이 +강 표기를 추가했다).
   그룹 1=등급 · 2=강화(없으면 undefined → 0강) · 3=슬롯. */
const HAR_RE = /장비 «(전설|신화|영웅|희귀|일반)(?:\+(\d+))? 6부위 · 슬롯 (\d+)렙»/g;

/* ─────────── 실험1 (등급 사다리) ─────────── */
{
  const planH = pick(PLAN, 'PLAN 실험1 하니스', /실험1 \(등급 사다리\)[\s\S]*?장비 «([^»]+)»(?![\s\S]{0,400}?실험1 \(등급 사다리\))/, 1);
  /* 문면은 취소선으로 옛 값이 함께 남아 있다 — «마지막» 하니스 표기가 현행이다. */
  /* T31: 하니스 표기에 «+강» 이 붙을 수 있다(«일반+2 6부위 · 슬롯 0렙») — 없으면 0강으로 읽는다. */
  const allH = [...PLAN.matchAll(HAR_RE)];
  const e1sec = PLAN.slice(PLAN.indexOf('실험1 (등급 사다리)'), PLAN.indexOf('실험2 (특전별 기여도)'));
  const e1m = [...e1sec.matchAll(HAR_RE)].pop();
  if (!e1m) parseFails.push('PLAN 실험1 하니스');
  const simE1 = pick(SIM, 'sim 실험1 하니스', /harness\('EXP1_GEAR',\s*(\d+),\s*(\d+),\s*(\d+)\)/);
  if (e1m && simE1) {
    cmp('실험1 하니스 등급', e1m[1], RAR[Number(simE1[1])]);
    cmp('실험1 하니스 슬롯', e1m[3], simE1[3]);
    cmp('실험1 하니스 강화', e1m[2] || '0', simE1[2], 'PLAN 문면에 +강 표기가 없으면 0강');
  }
  const e1ch = pick(e1sec, 'PLAN 실험1 챕터', /실험1 \(등급 사다리\)\*\*:\s*챕터(\d+)/, 1);
  /* ⚑ T1 R01: 측정 챕터가 리터럴에서 `hCh('EXP1_CH',N)` 기본값으로 옮겨졌다(하니스에 «챕터» 축 신설). */
  const simE1ch = pick(SIM, 'sim 실험1 챕터', /hCh\('EXP1_CH',\s*(\d+)\s*\)/, 1);
  cmp('실험1 측정 챕터', e1ch, simE1ch);
  const e1n = pick(e1sec, 'PLAN 실험1 판수', /(\d+)판씩/, 1);
  const simE1n = pick(SIM, 'sim 실험1 판수', /let wins=0,times=0,n=(\d+);/, 1);
  cmp('실험1 판수', e1n, simE1n);
}

/* ─────────── 실험2 (특전별 기여도) ─────────── */
{
  const e2sec = PLAN.slice(PLAN.indexOf('실험2 (특전별 기여도)'), PLAN.indexOf('실험3 (진행 곡선)'));
  const e2m = [...e2sec.matchAll(HAR_RE)].pop();
  if (!e2m) parseFails.push('PLAN 실험2 하니스');
  const simE2 = pick(SIM, 'sim 실험2 하니스', /harness\('EXP2_GEAR',\s*(\d+),\s*(\d+),\s*(\d+)\)/);
  if (e2m && simE2) {
    cmp('실험2 하니스 등급', e2m[1], RAR[Number(simE2[1])]);
    cmp('실험2 하니스 슬롯', e2m[3], simE2[3]);
    cmp('실험2 하니스 강화', e2m[2] || '0', simE2[2], 'PLAN 문면에 +강 표기가 없으면 0강');
  }
  const e2ch = pick(e2sec, 'PLAN 실험2 챕터', /챕터(\d+)에서 (\d+)판/);
  const simE2ch = pick(SIM, 'sim 실험2 챕터', /hCh\('EXP2_CH',\s*(\d+)\s*\)/, 1);
  /* ⚑ T80: 채점 판수가 리터럴에서 이름 붙은 상수 `EXP2_SCORE_N` 으로 옮겨졌다.
     상수 값만 보면 «상수는 12000 인데 기본값은 다른 리터럴» 인 우회를 놓치므로 **두 자리를 같이 본다**:
     ① 선언 `const EXP2_SCORE_N=<값>` ② 그 값이 실제로 기본값 자리에 쓰이는가(`EXP2_N||String(EXP2_SCORE_N)`). */
  const simE2n = pick(SIM, 'sim 실험2 판수', /const EXP2_SCORE_N\s*=\s*(\d+)\s*;/, 1);
  const usesConst = /N\s*=\s*parseInt\(process\.env\.EXP2_N\s*\|\|\s*String\(EXP2_SCORE_N\)\s*,\s*10\)/.test(SIM);
  cmp('실험2 판수 기본값이 EXP2_SCORE_N 을 쓴다', 'yes', usesConst ? 'yes' : 'no',
      'EXP2_N 미지정 시 상수가 그대로 채점 판수가 되어야 한다 (리터럴 우회 차단)');
  if (e2ch) { cmp('실험2 측정 챕터', e2ch[1], simE2ch); cmp('실험2 판수', e2ch[2], simE2n); }
  /* 주인 확정 하한 (2026-09-03 «①측정은 12,000판 이상») — PLAN·엔진이 사이좋게 같이 내려가는 것도 막는다. */
  const EXP2_N_FLOOR = 12000;
  if (simE2n !== null)
    rows.push({ name: '실험2 판수 주인 확정 하한(≥12000)', plan: `≥${EXP2_N_FLOOR}`, impl: String(simE2n),
                ok: Number(simE2n) >= EXP2_N_FLOOR, note: '2026-09-03 주인 지시 ① — 1,200판에서는 신화 칸이 잡음만으로 25%p 를 넘어 측정 자체가 불가' });
  const e2sp = pick(e2sec, 'PLAN 실험2 스프레드 임계', /(\d+)%p 이상\)이면/, 1);
  const simE2sp = pick(SIM, 'sim 실험2 스프레드 임계', /sp<(\d+)\?'OK':'초과'/, 1);
  cmp('실험2 스프레드 임계(%p)', e2sp, simE2sp);
  const e2min = pick(e2sec, 'PLAN 실험2 표본 하한', /표본 (\d+)판 미만/, 1);
  const simE2min = pick(SIM, 'sim 실험2 표본 하한', /if\(s\.n>=(\d+)\)rows\.push/, 1);
  cmp('실험2 표본 하한(판)', e2min, simE2min);
}

/* ─────────── 실험3 (진행 곡선) — PLAN §7 목표 ↔ tools/scoreExp3.js BANDS ─────────── */
{
  /* PLAN 1~20 구간 (불릿) */
  const want = [];
  const b1 = pick(PLAN, 'PLAN 실험3 1~5', /챕터 1~5:\s*각 (\d+)~(\d+)회/);
  if (b1) want.push({ name: '1~5', lo: b1[1], hi: b1[2] });
  const b2 = pick(PLAN, 'PLAN 실험3 6~9', /챕터 6~9:\s*각 (\d+)~(\d+)회/);
  if (b2) want.push({ name: '6~9', lo: b2[1], hi: b2[2] });
  const b3 = pick(PLAN, 'PLAN 실험3 10', /챕터 10:\s*\*\*(\d+)회 이상 \(벽\)\*\* — 하지만 (\d+)회 안에는/);
  if (b3) want.push({ name: '10 (벽)', lo: b3[1], hi: b3[2] });
  const b4 = pick(PLAN, 'PLAN 실험3 11~19', /챕터 11~19:\s*각 (\d+)~(\d+)회/);
  if (b4) want.push({ name: '11~19', lo: b4[1], hi: b4[2] });
  const b5 = pick(PLAN, 'PLAN 실험3 20', /챕터 20:\s*(\d+)~(\d+)회/);
  if (b5) want.push({ name: '20', lo: b5[1], hi: b5[2] });
  /* PLAN 21+ 구간 (한 줄) */
  const b6 = pick(PLAN, 'PLAN 실험3 21~49', /챕터 21~49 각 \*\*(\d+)~(\d+)회\*\*/);
  if (b6) want.push({ name: '21~49', lo: b6[1], hi: b6[2] });
  const b7 = pick(PLAN, 'PLAN 실험3 50~89', /50~89 각 \*\*(\d+)~(\d+)회\*\*/);
  if (b7) want.push({ name: '50~89', lo: b7[1], hi: b7[2] });
  const b8 = pick(PLAN, 'PLAN 실험3 90', /\*\*90 = (\d+)~(\d+)회\(대형 벽\)\*\*/);
  if (b8) want.push({ name: '90 (벽)', lo: b8[1], hi: b8[2] });
  const b9 = pick(PLAN, 'PLAN 실험3 91~299', /91~299 각 \*\*(\d+)~(\d+)회\*\*/);
  if (b9) want.push({ name: '91~299', lo: b9[1], hi: b9[2] });
  const b10 = pick(PLAN, 'PLAN 실험3 300', /\*\*300 = (\d+)~(\d+)회\(최종 벽\)\*\*/);
  if (b10) want.push({ name: '300 (벽)', lo: b10[1], hi: b10[2] });

  /* scoreExp3.js BANDS */
  const got = new Map();
  for (const m of SCORE3.matchAll(/\{\s*name:\s*'([^']+)',\s*from:\s*(\d+),\s*to:\s*(\d+),\s*lo:\s*(\d+),\s*hi:\s*(\d+)/g))
    got.set(m[1], { from: m[2], to: m[3], lo: m[4], hi: m[5] });
  if (got.size !== 10) parseFails.push(`scoreExp3.js BANDS 10개를 못 읽었다 (읽은 개수 ${got.size})`);
  for (const w of want) {
    const g = got.get(w.name);
    if (!g) { parseFails.push(`scoreExp3.js BANDS 에 '${w.name}' 없음`); continue; }
    cmp(`실험3 구간 ${w.name} 하한`, w.lo, g.lo);
    cmp(`실험3 구간 ${w.name} 상한`, w.hi, g.hi);
  }
  /* ⚑ T75 — 종전 이 자리는 «EXP3_LIMIT 기본값 == 벽 목표 상한(400)» 을 요구했다. 그게 결함의 원인이었다:
     둘이 같으면 400 에 닿은 셀이 언제나 «400회 실패» 라 목표 «30~400» 이 실제로는 «30~399» 이고,
     «401회면 뚫었을 계정» 과 «영구 정체» 가 한 칸에 뭉개진다. 이제 요구는 **엄격히 크다** 로 뒤집힌다.
     T80 선례대로 두 자리를 같이 본다 — ① 이름 붙은 상수 선언 ② 그 상수가 실제로 기본값 자리에 쓰이는가.
     (값만 보면 «상수는 1000, 기본값 자리엔 400 리터럴» 우회를 놓친다.)
     ③ 헤더가 상한을 찍는지도 본다 — 채점기가 «옛 자로 잰 원시 출력» 을 판별하는 근거가 그 한 줄이다. */
  const simTryLimit = pick(SIM, 'sim EXP3_TRY_LIMIT', /const EXP3_TRY_LIMIT\s*=\s*(\d+)\s*;/, 1);
  const usesTryConst = /LIMIT=parseInt\(process\.env\.EXP3_LIMIT\|\|String\(EXP3_TRY_LIMIT\),10\)/.test(SIM);
  cmp('실험3 재시도 상한 기본값이 EXP3_TRY_LIMIT 을 쓴다', 'yes', usesTryConst ? 'yes' : 'no',
    '리터럴로 되돌리면 상수만 바꿔 둔 채 실제 상한은 400 인 상태가 된다');
  const printsLimit = /실험3: 전체 진행 시뮬 \(챕터 1→\$\{MAXC\}, 재시도 상한 \$\{LIMIT\}회,/.test(SIM);
  cmp('실험3 원시 출력 헤더가 재시도 상한을 찍는다', 'yes', printsLimit ? 'yes' : 'no',
    '이 표기가 없으면 채점기가 «옛 자(상한 400)로 잰 출력» 을 구별하지 못한다');
  /* 채점 목표 상한은 scoreExp3 BANDS 중 최대(= 벽 구간 400). PLAN 의 «400회 안에는 뚫려야» 와도 대조한다. */
  const hiMax = got.size ? Math.max(...[...got.values()].map(g => Number(g.hi))) : null;
  if (b3) cmp('실험3 벽 목표 상한(PLAN↔BANDS)', b3[2], hiMax === null ? null : String(hiMax));
  if (simTryLimit && hiMax !== null)
    rows.push({ name: '실험3 재시도 상한 > 채점 목표 상한', plan: `>${hiMax}`, impl: simTryLimit,
      ok: Number(simTryLimit) > hiMax,
      note: '같거나 작으면 벽 목표가 원리적으로 도달 불가능하고 «느리지만 결국 클리어» 가 관측되지 않는다 (T75)' });
  const simMax = pick(SIM, 'sim maxChapter 기본', /EXP3_MAX\|\|String\(TUNE\.maxChapter\)/) ? 'TUNE.maxChapter' : null;
  cmp('실험3 기본 최대 챕터', 'TUNE.maxChapter', simMax, '전 구간 채점 가능 여부 — 잘라 돌리려면 EXP3_MAX 명시');
}

/* ─────────── 실험4 (장비 진행) ─────────── */
{
  const e4 = PLAN.slice(PLAN.indexOf('T6 제안 합격 기준 — 실험4'), PLAN.indexOf('T6 제안 합격 기준 — 실험5'));
  const st = pick(e4, 'PLAN 실험4 기준① 임계', /«(\d+)일\((\d+)판\) 연속 실패»/);
  const simStuck = pick(SIM, 'sim EXP4_STUCK 기본값', /EXP4_STUCK\|\|'(\d+)'/, 1);
  const simRpd = pick(SIM, 'sim runsPerDay', /runsPerDay:(\d+)/, 1);
  if (st && simStuck && simRpd) {
    cmp('실험4 기준① 정체 임계(일)', st[1], simStuck);
    cmp('실험4 기준① 정체 임계(판)', st[2], String(Number(simStuck) * Number(simRpd)));
  }
  const marks = pick(SIM, 'sim 실험4 marks', /const marks=\[([\d,]+)\];/, 1);
  const e4mono = pick(e4, 'PLAN 실험4 기준② 일차', /([\d·]+)일차 도달 챕터가 단조증가/, 1);
  if (marks && e4mono) {
    const set = new Set(marks.split(',').map(s => s.trim()));
    const need = e4mono.split('·');
    cmp('실험4 기준② 관측 일차', need.join('·'), need.filter(d => set.has(d)).join('·'),
      '기준②가 요구하는 일차가 marks 에 전부 있어야 관측된다');
  }
}

/* ─────────── 실험5 (⚑ T35: 앵커 3점 → 스탯 사다리 7점) ─────────── */
{
  /* PLAN §11.7 «주인 확정 스탯 사다리» 표 7행을 그대로 읽어 sim.js 의 LADDER 와 대조한다.
     종전에는 §7 산문(«앵커 C = 전설 풀셋 …»)을 파싱했는데, 주인이 확정한 것은 산문이 아니라 §11.7 표다. */
  const t = PLAN.slice(PLAN.indexOf('⚑ 주인 확정 스탯 사다리'));
  const want = [...t.matchAll(/\|\s*(노템|일반 풀셋|희귀 풀셋|영웅 풀셋|전설 풀셋|신화 풀셋|신화 \+9강 풀셋)\s*\|\s*([\d,]+)\s*\|\s*([\d,]+)\s*\|\s*([\d,]+)\s*\|\s*([\d,]+)\s*\|/g)];
  if (want.length !== 7) parseFails.push(`PLAN §11.7 사다리 7행을 못 읽었다 (읽은 개수 ${want.length})`);
  const got = [...SIM.matchAll(/\{id:'([^']+)',\s*rar:(-?\d+),\s*plus:(\d+),\s*at:(\d+),\s*want:\[([\d.]+),([\d.]+),([\d.]+)\]\}/g)];
  if (got.length !== 7) parseFails.push(`sim.js LADDER 7점을 못 읽었다 (읽은 개수 ${got.length})`);
  const n = s => String(s).replace(/,/g, '');
  if (want.length === 7 && got.length === 7) for (let i = 0; i < 7; i++) {
    const w = want[i], g = got[i], nm = w[1].replace(' 풀셋', '').replace(' ', '');
    cmp(`실험5 사다리 ${nm} 이름`, nm, g[1]);
    cmp(`실험5 사다리 ${nm} 과녁 챕터`, n(w[2]), g[4]);
    cmp(`실험5 사다리 ${nm} 목표 스탯`, [w[3], w[4], w[5]].map(n).join('/'), [g[5], g[6], g[7]].join('/'));
  }
  /* 합격 밴드의 과녁 목록(§7 기준 문장) ↔ LADDER.at */
  const at = pick(PLAN, 'PLAN 실험5 과녁 챕터', /과녁 챕터\(([\d·]+)\) 클리어율/, 1);
  if (at && got.length === 7) cmp('실험5 과녁 챕터 목록', at, got.map(g => g[4]).join('·'));
  /* ⚑ T87 — 채점 판수도 실험2 와 같은 방식으로 못박는다(PLAN 문면 ↔ 상수 ↔ 기본값 자리).
     200판에서는 사다리 7과녁 중 최소 1개가 잡음만으로 탈락할 확률이 ≈22% 라 «n/7 유지» 가 동전 던지기였다(T74). */
  const e5n = pick(PLAN, 'PLAN 실험5 판수', /측정 판수는 과녁당 (\d+)판/, 1);
  const simE5n = pick(SIM, 'sim 실험5 판수', /const EXP5_SCORE_N\s*=\s*(\d+)\s*;/, 1);
  const usesE5 = /N\s*=\s*parseInt\(process\.env\.EXP5_N\s*\|\|\s*String\(EXP5_SCORE_N\)\s*,\s*10\)/.test(SIM);
  cmp('실험5 판수 기본값이 EXP5_SCORE_N 을 쓴다', 'yes', usesE5 ? 'yes' : 'no',
      'EXP5_N 미지정 시 상수가 그대로 채점 판수가 되어야 한다 (리터럴 우회 차단)');
  cmp('실험5 판수', e5n, simE5n);
  const EXP5_N_FLOOR = 1000;
  if (simE5n !== null)
    rows.push({ name: '실험5 판수 하한(≥1000)', plan: `≥${EXP5_N_FLOOR}`, impl: String(simE5n),
                ok: Number(simE5n) >= EXP5_N_FLOOR, note: 'T87 — PLAN·엔진이 사이좋게 같이 내려가는 것도 막는다' });
}

/* ─────────── 등재된 기존 차이 (KNOWN) ─────────── */
const KNOWN = [
  { name: '실험4 기준① 정체 임계(일)', why: 'T30 / 승인 대기 — T6 가 «90·300 벽이 걸린다» 를 이유로 엔진 임계만 20일→40일로 올리고 PLAN §7 기준① 문면(20일·600판)은 그대로 뒀다. 벽 예외를 코드로 넣는 대신 임계를 2배로 늘린 탓에, 벽이 아닌 챕터의 600~1200판 정체가 «정체 감지 0» 으로 조용히 합격 처리된다' },
  { name: '실험4 기준① 정체 임계(판)', why: '위와 같은 건 (600판 ↔ 1200판)' },
  /* ⚑ T35: «실험5 앵커 B 측정 구간» 항목은 앵커 3점 폐기로 소멸 — 사다리 7점에는 측정 구간 개념이 없다. */
];

/* ─────────── 출력 ─────────── */
console.log('=== PLAN §7 채점 기준 ↔ 구현 대조 (T30 게이트) ===\n');
let bad = 0, known = 0;
const pad = (s, n) => String(s) + ' '.repeat(Math.max(0, n - [...String(s)].reduce((w, c) => w + (c.charCodeAt(0) > 0x1100 ? 2 : 1), 0)));
for (const r of rows) {
  const k = r.ok ? null : KNOWN.find(x => x.name === r.name);
  const mark = r.ok ? '  ' : (k ? '🔵' : '❌');
  if (!r.ok) { if (k) known++; else bad++; }
  console.log(`${mark} ${pad(r.name, 30)} PLAN ${pad(r.plan, 12)} 구현 ${r.impl}`);
  if (r.note && !r.ok) console.log(`        └ ${r.note}`);
  if (k) console.log(`        └ 등재됨: ${k.why}`);
}
if (parseFails.length) {
  console.log('\n❌ 파싱 실패 (조용한 통과 방지 — 문서나 코드 모양이 바뀌었다):');
  for (const f of parseFails) console.log(`   - ${f}`);
}
console.log(`\n대조 ${rows.length}항목 · 일치 ${rows.length - bad - known} · 신규 불일치 ${bad} · 등재된 기존 차이 ${known} · 파싱 실패 ${parseFails.length}`);
if (bad || parseFails.length) { console.log('→ 실패'); process.exit(1); }
console.log('→ 통과');
