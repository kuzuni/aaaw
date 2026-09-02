'use strict';
/* 실험1·2 하니스 «대표성 + 변별력» 동작 게이트 (T31 신설)
   사용: node tools/verifyHarness.js          (위반이 있으면 exit 1)
         node tools/verifyHarness.js --fast   (시드 12→6 · 판수 300→120. 개발 중 빠른 확인용)
         node tools/verifyHarness.js --rebase (기준선 재측정용 — 현재 수치를 BASELINE 형식으로 출력만 한다)

   왜 필요한가 — 기존 게이트 6종이 한 항목도 덮지 않는 축이다:
     T16 verifyPlanConst  : PLAN 문서값 ↔ 엔진 상수      (정적)
     T17 verifyOptText    : 설명문 ↔ 엔진 상수            (정적)
     T19 verifySaturation : 옵션 누적 포화                (정적)
     T24 verifyPerkGearDup: 특전 ↔ 장비 옵션 키 중복      (정적)
     T25 verifyPerkPolicy : 특전 선택 정책                (정적)
     T29 verifyGearEcon   : 뽑기·합성·슬롯 규칙이 굴러가나 (동작)
     T27 verifyCombatConst: 전투 코어 상수 ↔ 문서        (정적)
     T33 verifyScoreCriteria : 폐지된 동작이 배포 빌드에 남았나 (정적)
   즉 «엔진이 규칙대로 구르나» 까지는 보는데, **«그 엔진을 어떤 지점에서 재고 있나»(측정 설정)**
   는 아무도 안 본다. 채점표 10점 중 실험1·2 몫(v2 기준 3점)이 전부 이 두 하니스 한 줄에 달려 있는데도.

   ⚑ T5 는 주인 승인 규칙이다: **«하니스 = 실험3 관측, 그 챕터 도달 시점 중앙값»**,
   그리고 «경제 노브를 바꾼 라운드마다 재보정». 그런데 이 규칙에는 게이트가 없어서
   T26(R09 가 slotCostG 4.2→3.5 를 바꾸고 실험1 하니스 재보정을 빠뜨림)이 사람 눈으로만 잡혔다.
   이 게이트는 그 규칙을 매번 실측해 자동으로 대조한다.

   재는 것 3가지:
     ① 변별력  — 하니스가 바닥/천장 포화면 실험1·2 는 측정 자체가 무의미하다 (T7 재발 방지).
     ② 대표성  — 하니스 클리어율 vs «실험3 도달 시점 실제 계정» 클리어율 중앙값의 괴리.
     ③ T5 문자 그대로 — 하니스 슬롯 레벨 = 실측 도달 시점 슬롯 레벨 중앙값 (T26 이 이것 하나였다).
   ②③ 의 «현재 알려진 괴리» 는 아래 BASELINE 에 등재돼 있다(T31). 기준선 이내면 통과,
   악화되면 exit 1. 하니스나 경제 노브를 건드린 회차는 이 게이트로 재측정하고 BASELINE 을 갱신할 것.

   구현 메모: sim.js 는 하단 CLI 디스패처 때문에 require 하면 실험이 돌아버린다.
   T29 와 같은 방식으로 디스패처 앞까지 잘라 vm 컨텍스트에서 평가한다
   (`const mode=process.argv[2]` 줄이 잘림 기준 — sim.js 에서 이 줄을 바꾸면 여기도 고칠 것). */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(root, 'sim.js'), 'utf8');
const CUT = "const mode=process.argv[2]||'all';";
const at = SRC.indexOf(CUT);
if (at < 0) throw new Error(`sim.js 에서 CLI 디스패처(«${CUT}») 를 못 찾았다 — 잘림 기준이 바뀌었다`);

const ctx = { console: { log(){} }, process, Math, JSON, Number, String, Array, Set, Map, Object, Date,
              parseInt, parseFloat, isFinite, isNaN, require };
vm.createContext(ctx);
vm.runInContext(SRC.slice(0, at) +
  '\n;globalThis.__X={newAccount,accAttempt,accBuild,runChapter,mkBuild,buildPower,setSeed,GT,TUNE};', ctx);
const X = ctx.__X || ctx.globalThis.__X;
const { newAccount, accAttempt, accBuild, runChapter, mkBuild, buildPower, setSeed, GT } = X;

const FAST = process.argv.includes('--fast');
const REBASE = process.argv.includes('--rebase');
const SEEDS = FAST ? 6 : 12;
const RUNS  = FAST ? 120 : 300;

/* ---------------- 하니스 정의: sim.js 소스에서 실제 기본값을 읽어온다 ---------------- */
/* 소스를 파싱하는 이유 — 하니스가 바뀌면 이 게이트가 «바뀐 값» 으로 자동 재측정해야 하기 때문이다.
   여기에 값을 베껴 두면 T26 과 똑같이 «게이트만 옛날 값» 이 되는 실패를 재생산한다. */
function readHarness(env) {
  const m = SRC.match(new RegExp(`harness\\(\\s*'${env}'\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*\\)`));
  if (!m) throw new Error(`sim.js 에서 harness('${env}',…) 기본값을 못 찾았다 — 하니스 선언 형태가 바뀌었다`);
  return { rar: +m[1], plus: +m[2], slot: +m[3] };
}
const H = { 6: readHarness('EXP1_GEAR'), 8: readHarness('EXP2_GEAR') };

/* ---------------- 등재 기준선 (T31, 2026-09-02 측정) ----------------
   gap  : 하니스 클리어율 − 실측 도달시점 중앙값 클리어율 (%p). 이보다 GAP_TOL 이상 커지면 위반.
   slot : 하니스 슬롯 − 실측 슬롯 중앙값 (렙). 이보다 커지면 위반 (T5 문자 그대로).
   har  : 기준선을 잴 때의 하니스 값. 소스와 다르면 «재보정됨 → 기준선 갱신 필요» 로 위반.
   floorRungs : 실험1 사다리에서 «이미 바닥 포화로 등재된» 등급. 여기 없는 등급이 새로 포화되면 위반. */
const BASELINE = {
  6: { har: { rar: 3, plus: 0, slot: 1 }, gap: 20.3, slot: 0, floorRungs: ['일반'] },
  8: { har: { rar: 4, plus: 0, slot: 0 }, gap: 66.0, slot: -2 },
};
const GAP_TOL = 5.0;      /* %p — 시드 잡음 여유 */
const FLOOR = 1.0, CEIL = 99.0;   /* 등급별 클리어율이 이 밖이면 포화(측정 불능) */
const EXP2_LO = 15.0, EXP2_HI = 85.0;  /* 실험2 전체 클리어율 변별 구간 */

let bad = 0, ok = 0;
function chk(name, pass, detail) {
  if (pass) { ok++; console.log(`  ✓ ${name}${detail ? '  — ' + detail : ''}`); }
  else { bad++; console.log(`  ✗ ${name}  — ${detail}`); }
}
const med = v => { const b = [...v].sort((x, y) => x - y); const n = b.length; return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2; };

/* ---------------- 실측: 실험3 경제 코어를 굴려 «도달 시점» 계정을 채집 ---------------- */
/* 실험3 과 완전히 같은 경로(accAttempt)를 쓴다 — 하니스가 대표해야 하는 대상이 바로 그 계정이다. */
function collect(marks) {
  const snap = {}; for (const c of marks) snap[c] = [];
  const maxC = Math.max(...marks);
  for (let s = 1; s <= SEEDS; s++) {
    setSeed(s);
    const a = newAccount(0);
    for (let c = 1; c <= maxC; c++) {
      if (marks.includes(c)) {
        const b = accBuild(a);
        snap[c].push({
          seed: s,
          eq: JSON.parse(JSON.stringify(b.eq)),
          slots: { ...b.slots },
          rar: GT.parts.map(pt => (b.eq[pt] ? b.eq[pt].rar : -1)),
          slotLv: GT.parts.map(pt => b.slots[pt] || 0),
        });
      }
      let t = 0, cl = false;
      while (!cl && t < 400) { t++; cl = accAttempt(a, c).clear; }
      if (!cl) { console.log(`  ⚠ 시드 ${s}: 챕터 ${c} 400회 실패 — 이 시드는 이후 마크에서 빠진다`); break; }
    }
  }
  return snap;
}
function rateOf(ch, b, opt) {
  setSeed(9000 + ch);           /* 빌드끼리 같은 난수열로 짝지어 비교(공통난수) */
  let w = 0;
  for (let i = 0; i < RUNS; i++) if (runChapter(ch, b, opt || {}).clear) w++;
  return w / RUNS * 100;
}

console.log(`=== 실험1·2 하니스 대표성·변별력 게이트 (T31) — 시드 ${SEEDS} · 판수 ${RUNS}${FAST ? ' [fast]' : ''} ===`);
console.log(`소스 하니스: 실험1 ${GT.rarName[H[6].rar]}${H[6].plus ? '+' + H[6].plus : ''} 6부위·슬롯 ${H[6].slot}렙 · ` +
            `실험2 ${GT.rarName[H[8].rar]}${H[8].plus ? '+' + H[8].plus : ''} 6부위·슬롯 ${H[8].slot}렙`);

console.log('\n[실험3 경제 코어로 «도달 시점» 계정 채집]');
const snap = collect([6, 8]);

const result = {};
for (const ch of [6, 8]) {
  const h = H[ch], base = BASELINE[ch];
  const hb = mkBuild(h.rar, h.plus, h.slot);
  const hRate = rateOf(ch, hb);
  const rows = snap[ch].map(sn => ({ sn, r: rateOf(ch, { eq: sn.eq, slots: sn.slots }) }));
  const obsRate = med(rows.map(x => x.r));
  const obsSlot = med([].concat(...snap[ch].map(s => s.slotLv)));
  const obsRar = med([].concat(...snap[ch].map(s => s.rar)));
  result[ch] = { hRate, obsRate, obsSlot, obsRar, gap: hRate - obsRate, slotGap: h.slot - obsSlot };

  console.log(`\n[챕터 ${ch} — 실험${ch === 6 ? 1 : 2} 하니스]`);
  console.log(`  하니스 클리어율 ${hRate.toFixed(1)}%  (전투력 공 ${buildPower(hb).atk.toFixed(3)})`);
  console.log(`  실측 도달시점 계정 클리어율: 중앙값 ${obsRate.toFixed(1)}%  ` +
              `[${rows.map(x => x.r.toFixed(1)).join(' ')}]`);
  console.log(`  실측 부위별 등급 중앙값 ${obsRar >= 0 ? GT.rarName[Math.round(obsRar)] : '미장착'}(${obsRar}) · 슬롯 중앙값 ${obsSlot}렙`);
}

if (REBASE) {
  console.log('\n--rebase — 아래를 BASELINE 에 그대로 넣어라 (등재 사유를 PROGRESS 에 함께 적을 것):');
  for (const ch of [6, 8]) {
    const h = H[ch], r = result[ch];
    const fr = BASELINE[ch].floorRungs ? `, floorRungs: ${JSON.stringify(BASELINE[ch].floorRungs)}` : '';
    console.log(`  ${ch}: { har: { rar: ${h.rar}, plus: ${h.plus}, slot: ${h.slot} }, gap: ${r.gap.toFixed(1)}, slot: ${r.slotGap}${fr} },`);
  }
  console.log('  ※ floorRungs 는 자동 산출이 아니다 — ① 출력의 등급별 클리어율을 보고 직접 판단해 적을 것.');
  process.exit(0);
}

/* ---------------- ① 변별력 (T7 재발 방지) ---------------- */
console.log('\n[① 변별력 — 하니스가 바닥/천장 포화면 실험1·2 는 측정 자체가 무의미하다]');
{
  const h = H[6], hb = mkBuild(h.rar, h.plus, h.slot);
  const names = ['일반', '희귀', '전설', '신화'];
  const rs = [0, 1, 2, 3].map(lock => rateOf(6, hb, { rarityLock: lock }));
  const reg = BASELINE[6].floorRungs || [];
  const newSat = names.filter((nm, i) => (rs[i] <= FLOOR && !reg.includes(nm)) || rs[i] >= CEIL);
  chk('실험1 등급 4단에 신규 포화 없음',
      newSat.length === 0,
      rs.map((r, i) => `${names[i]} ${r.toFixed(1)}%`).join(' · ') +
      `  (허용 ${FLOOR}~${CEIL}% · 등재된 바닥 포화 [${reg.join(',') || '없음'}]` +
      (newSat.length ? ` · 신규 포화 [${newSat.join(',')}]` : '') + ')');
  chk('실험1 사다리 인접 간격이 잡음 이상(각 ≥ 2%p 분리)',
      rs.every((r, i) => i === 0 || Math.abs(r - rs[i - 1]) >= 2.0),
      rs.map((r, i) => i ? `${names[i - 1]}→${names[i]} ${(r - rs[i - 1]).toFixed(1)}%p` : '').filter(Boolean).join(' · '));
}
chk('실험2 하니스가 변별 구간 안(전체 클리어율 15~85%)',
    result[8].hRate > EXP2_LO && result[8].hRate < EXP2_HI,
    `${result[8].hRate.toFixed(1)}%`);

/* ---------------- ② 대표성 (하니스 ↔ 실측 괴리) ---------------- */
console.log('\n[② 대표성 — 하니스 클리어율 vs 실험3 도달시점 실제 계정 클리어율]');
for (const ch of [6, 8]) {
  const base = BASELINE[ch], r = result[ch];
  const sameHar = base.har.rar === H[ch].rar && base.har.plus === H[ch].plus && base.har.slot === H[ch].slot;
  if (!sameHar) {
    chk(`챕터 ${ch} 기준선 유효성`, false,
        `하니스가 기준선 측정 당시(${GT.rarName[base.har.rar]}·슬롯${base.har.slot})와 다르다(현재 ${GT.rarName[H[ch].rar]}·슬롯${H[ch].slot}) ` +
        `— T5 재보정이 일어났다면 \`--rebase\` 로 기준선을 갱신하고 PROGRESS 에 사유를 남겨라`);
    continue;
  }
  chk(`챕터 ${ch} 괴리 ${r.gap.toFixed(1)}%p ≤ 등재 기준선 ${base.gap}%p + 허용 ${GAP_TOL}%p`,
      r.gap <= base.gap + GAP_TOL,
      `하니스 ${r.hRate.toFixed(1)}% vs 실측 중앙값 ${r.obsRate.toFixed(1)}%` +
      (!FAST && r.gap <= base.gap - GAP_TOL ? '  ⇧ 기준선보다 개선됨 — --rebase 로 기준선을 조여라' : ''));
}

/* ---------------- ③ T5 문자 그대로 (슬롯 = 도달 시점 중앙값) ---------------- */
console.log('\n[③ T5 주인 승인 규칙 — 하니스 슬롯 = 실험3 도달 시점 관측 중앙값]');
for (const ch of [6, 8]) {
  const base = BASELINE[ch], r = result[ch];
  if (base.har.slot !== H[ch].slot) { console.log(`  · 챕터 ${ch}: 하니스 슬롯이 바뀌었다 — ② 에서 이미 위반 처리`); continue; }
  const pass = r.slotGap === base.slot;
  chk(`챕터 ${ch} 슬롯 하니스 ${H[ch].slot}렙 vs 실측 중앙값 ${r.obsSlot}렙`,
      pass,
      pass ? `차 ${r.slotGap}렙 = 등재값` :
      `차가 ${base.slot}렙 → ${r.slotGap}렙 으로 바뀌었다 — T5 는 «경제 노브를 바꾼 라운드마다 재보정» 을 요구한다. ` +
      `재보정했다면 \`--rebase\` 로 기준선을 갱신하라 (T26 이 이 항목 하나였다)`);
}

console.log(`\n통과 ${ok} · 위반 ${bad}`);
if (bad) { console.log('→ 실패'); process.exit(1); }
console.log('→ 통과 (등재된 기존 괴리 이내)');
