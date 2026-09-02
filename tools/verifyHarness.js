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

   ⚑ 정본 규칙 = **«변별점 규칙»** (주인 확정 2026-09-02 15:1X · 승인 25번 3안 채택 · PLAN §7).
   종전 T5 규칙(«하니스 = 그 챕터 도달 시점 관측 중앙값»)은 이 규칙으로 **개정**됐다 —
   규칙이 둘이라 충돌했고(T31), 코드는 처음부터 변별점 쪽으로 돌고 있었다.
   T5 의 «경제 노브를 바꾼 라운드마다 재보정» 조항만 그대로 살아 있다(기준이 «중앙값» → «변별점» 으로 바뀐 것).

   재는 것 3가지:
     ① 변별력(정본 ①②③) — 하니스가 바닥/천장 포화면 실험1·2 는 측정 자체가 무의미하다 (T7 재발 방지).
        실험1: 등급 4단 전부 1~99% 비포화 + 인접 ≥2%p 분리 · 실험2: 전체 클리어율 15~85% 안, 목표 밴드 60~70%.
     ② 재보정 감시(정본 ④) — 하니스 값이 기준선 측정 당시와 다르거나, 경제·난이도 노브가 바뀌어
        하니스가 등재 밴드를 이탈했으면 위반. **T26(R09 가 slotCostG 4.2→3.5 를 바꾸고 재보정을 빠뜨림)이
        사람 눈으로만 잡혔던 그 사고는 이제 ①②가 함께 잡는다** — 노브를 바꾸면 하니스 클리어율이 밴드를 벗어나기 때문이다.
     ③ 참고 지표(정본 ⑤ · **위반 아님**) — 하니스 클리어율 vs «실험3 도달 시점 실제 계정» 클리어율 중앙값의 괴리.
        3안 채택에 따라 점수/통과 판정에서 빠지고 표시만 한다. 실험3 곡선이 §7 목표에 들어올수록 저절로 줄어든다.
   ①② 의 등재 기준선은 아래 BASELINE 에 있다(T31 재보정, 2026-09-02). 하니스나 경제 노브를 건드린 회차는
   이 게이트로 재측정하고 `--rebase` 로 BASELINE 을 갱신할 것.

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

/* ---------------- 등재 기준선 (T46 재보정, 2026-09-02 «시뮬 쉼터 = 항상 경험치» 반영 후 측정) ----------------
   ⚑ 재보정 사유: 주인 확정 16:4X 로 시뮬의 쉼터 회복 선택(최대체력 40%)이 사라졌다(PLAN §7 · T46).
      챕터당 쉼터 1~4개의 회복이 통째로 빠져 두 하니스가 함께 내려갔다 — 하니스 자체는 그대로 두고
      (정본 ①②: 실험1 4단 비포화·인접 ≥2%p · 두 하니스 15~85% · 실험2 60~70%±8 전부 유지) rate/gap 만 갱신했다.
      직전 등재값은 T31 재보정분 6: 52.7/-27.7 · 8: 66.3/30.5 (실험1 사다리 11.3/39.3/77.7/87.0).
   har  : 기준선을 잴 때의 하니스 값. 소스와 다르면 «재보정됨 → 기준선 갱신 필요» 로 위반(②).
   rate : 그때 잰 하니스 전체 클리어율(%). 여기서 DRIFT_TOL 이상 벗어나면 «경제·난이도 노브가 움직였다
          → 정본 ④ 재보정 의무» 로 위반(②). T26 이 이 항목이다.
   gap  : 하니스 클리어율 − 실측 도달시점 중앙값 클리어율 (%p). **참고 지표(③)라 위반 판정에 안 쓴다.** */
/* ⚑ 재보정 2 (T43, 2026-09-02T08:4XZ / 워커 B) — 사유: 주인 확정 «적 전원 회피 10%»(PLAN §2.3) 반영으로
   실질 DPS 가 10% 내려갔다. T31 이 08:0XZ 에 박은 기준선(6: 52.7 · 8: 66.3)이 그 즉시 낡았고
   챕터 6 이 −13.0%p 로 DRIFT_TOL(±12%p)을 넘겨 ②가 빨개졌다 — 정본 ④ 가 지시하는 «--rebase» 를 수행.
   **하니스 자체는 다시 고르지 않았다**: 재측정에서 변별력 ①②③ 5항목이 전부 통과했다
   (실험1 39.7% · 실험2 55.0% 둘 다 변별 구간 15~85% 안, 사다리 4단 비포화·인접 ≥2%p 유지).
   ⚠ T43 시점 55.0% 로 밴드 하단 경계였던 것은 **T45(소환 적중 트리거)로 62.3% 가 되어 해소**됐다
   (같은 날 두 지시가 반대 방향으로 민 결과다). 다음에 이 규모의 엔진 변경(성장률·벽)이 또 오면
   기준선 갱신이 아니라 **하니스 재선정**이 맞다 — 강화 축은 +1강당 약 13%p 다. */
/* ⚑ 재보정 5 = **하니스 재선정** (T47, 2026-09-02 / 워커 D) — 사유: 주인 확정 «레벨업 필요 경험치
   4+2*Lv → 4+4*Lv»(PLAN §2.4). 같은 챕터에서 얻는 특전 수가 줄어 T46 이 고른 두 하니스가 함께 내려갔다:
   챕터6(일반+2) 24.3 → 10.7% = 변별 구간 15~85% 아래 · 챕터8(일반+9) 73.3 → 41.0% = 목표 밴드 60~70% 밖.
   정본 ② 대로 둘 다 다시 골랐다 — **실험1 일반+2 → 일반+4**(30.7% · 사다리 8.3/21.7/40.7/61.7, 포화 0) ·
   **실험2 일반+9 → 일반+10**(게이트 300판 60.3% · 채점 1200판 58.5%. 일반+11 은 300판 73.0% 로 밴드 초과).
   종전 등재: 6 = 24.3/-21.5 · 8(일반+9) = 73.3/51.3. 실측표는 sim.js 두 하니스 주석과 PROGRESS T47 행. */
const BASELINE = {
  /* T45(소환 적중 = 공격 트리거)까지 반영한 재측정 — 정본 ④. T43(회피 10%)와 T45 가 반대 방향으로 밀어
     실험2 는 66.3 → 55.0(T43) → 77.7(T45) → 62.3%(둘 다)로 돌아왔다. 하니스는 둘 다 유지가 맞다
     (일반+6 은 44.3%, 일반+8 은 67.7% — 일반+7 62.3% 가 목표 밴드 정중앙). 종전 등재: 6 = 39.7/-24.7 · 8 = 55.0/29.5. */
  /* T46(시뮬 쉼터 = 항상 «🌟 경험치» · 주인 확정 16:4X) 반영 후 재측정 — 정본 ④.
     챕터당 쉼터 1~4개의 «최대체력 40% 회복» 이 통째로 빠져 두 하니스가 함께 내려갔다:
     챕터6 39.7 → 24.3% · 챕터8(일반+7) 62.3 → 46.0%.
     **실험1 하니스는 유지**(24.3% 는 변별 구간 15~85% 안, 사다리 4단 비포화·간격 12.0/21.7/18.0%p).
     **실험2 하니스는 46.0% 로 목표 밴드를 이탈해 정본 ② 대로 다시 골랐다** — 일반+7 46.0% ·
     일반+8 58.0% · **일반+9 73.3%**(이 게이트 300판 기준). 채점이 실제로 도는 1200판(`node sim.js 2`)
     에서는 일반+8 56.4% · **일반+9 69.3%** 라 +9 만 목표 밴드 60~70% 안이다 → 일반+9 슬롯0 채택.
     종전 등재: 6 = 39.7/-19.5 · 8(일반+7) = 62.3/32.3. */
  /* T49(쉼터 보상 «체력 260 / 경험치 +26» · 주인 확정 17:1X) 반영 후 재측정 — 정본 ④.
     경험치가 +10 → +26 이라 레벨(=특전)이 빨리 붙어 두 하니스가 다시 올라갔다:
     챕터6 24.3 → 23.7%(변별 구간 안 → 구성 유지) · 챕터8 일반+9 73.3 → 80.7%(밴드 이탈).
     정본 ② 대로 한 단계 내려 **일반+8 슬롯0 채택** — 게이트 300판 65.0% · 채점 1200판 66.1% 로
     둘 다 목표 밴드 60~70% 안이다(일반+7 은 1200판 52.2% 로 낮다). 종전 등재: 6 = 24.3/-21.5 · 8(일반+9) = 73.3/51.3. */
  /* T47 최종 측정은 T49(쉼터 260/26)까지 들어온 트리에서 다시 잡았다 — 쉼터 경험치 +26 이 특전 획득을
     조금 되돌려 두 하니스가 30.7 → 36.0% · 60.3 → 62.3% 로 올라왔다(둘 다 밴드 안, 하니스 구성은 유지).
     사다리 일반 12.3 / 희귀 25.7 / 전설 51.7 / 신화 66.7%. */
  6: { har: { rar: 0, plus: 4, slot: 0 }, rate: 36.0, gap: 0.8 },
  8: { har: { rar: 0, plus: 10, slot: 0 }, rate: 62.3, gap: 10.2 },
};
const DRIFT_TOL = 12.0;   /* %p — 이만큼 밴드에서 밀리면 재보정하라는 뜻 (시드 잡음 ±3%p 대비 충분히 크게) */
const FLOOR = 1.0, CEIL = 99.0;   /* 등급별 클리어율이 이 밖이면 포화(측정 불능) */
const BAND_LO = 15.0, BAND_HI = 85.0;      /* 정본 ① 변별 구간 (두 하니스 공통) */
const E2_LO = 60.0, E2_HI = 70.0, E2_TOL = 8.0;  /* 정본 ② 실험2 목표 밴드 + 허용치 */

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

/* 실험1 사다리는 ①(변별력)과 --rebase 양쪽이 쓰므로 한 번만 잰다. */
const LADDER_NAMES = ['일반', '희귀', '전설', '신화'];
const ladder = (() => {
  const h = H[6], hb = mkBuild(h.rar, h.plus, h.slot);
  return [0, 1, 2, 3].map(lock => rateOf(6, hb, { rarityLock: lock }));
})();

if (REBASE) {
  console.log('\n--rebase — 아래를 BASELINE 에 그대로 넣어라 (재보정 사유·실측표를 PROGRESS 에 함께 적을 것):');
  for (const ch of [6, 8]) {
    const h = H[ch], r = result[ch];
    console.log(`  ${ch}: { har: { rar: ${h.rar}, plus: ${h.plus}, slot: ${h.slot} }, rate: ${r.hRate.toFixed(1)}, gap: ${r.gap.toFixed(1)} },`);
  }
  console.log(`  ※ 참고 — 실험1 사다리 ${ladder.map((r, i) => `${LADDER_NAMES[i]} ${r.toFixed(1)}%`).join(' · ')}`);
  console.log('  ※ 정본 규칙(PLAN §7)은 ② 실험2 60~70% · ③ 실험1 4단 비포화+인접 ≥2%p 다. 밴드 밖 값을 기준선으로 박지 말 것 — 하니스를 다시 고르는 게 맞다.');
  process.exit(0);
}

/* ---------------- ① 변별력 = 정본 규칙 ①②③ (T7 재발 방지) ---------------- */
console.log('\n[① 변별력 — 정본 «변별점 규칙» ①②③ (하니스가 포화면 실험1·2 는 측정 자체가 무의미하다)]');
{
  const sat = LADDER_NAMES.filter((nm, i) => ladder[i] <= FLOOR || ladder[i] >= CEIL);
  chk('실험1 등급 4단 전부 비포화',
      sat.length === 0,
      ladder.map((r, i) => `${LADDER_NAMES[i]} ${r.toFixed(1)}%`).join(' · ') +
      `  (허용 ${FLOOR}~${CEIL}%` + (sat.length ? ` · 포화 [${sat.join(',')}]` : '') + ')');
  chk('실험1 사다리 인접 간격이 잡음 이상(각 ≥ 2%p 분리)',
      ladder.every((r, i) => i === 0 || Math.abs(r - ladder[i - 1]) >= 2.0),
      ladder.map((r, i) => i ? `${LADDER_NAMES[i - 1]}→${LADDER_NAMES[i]} ${(r - ladder[i - 1]).toFixed(1)}%p` : '').filter(Boolean).join(' · '));
}
chk(`실험1 하니스가 변별 구간 안(전체 클리어율 ${BAND_LO}~${BAND_HI}%)`,
    result[6].hRate > BAND_LO && result[6].hRate < BAND_HI,
    `${result[6].hRate.toFixed(1)}%`);
chk(`실험2 하니스가 변별 구간 안(전체 클리어율 ${BAND_LO}~${BAND_HI}%)`,
    result[8].hRate > BAND_LO && result[8].hRate < BAND_HI,
    `${result[8].hRate.toFixed(1)}%`);
chk(`실험2 하니스가 목표 밴드 ${E2_LO}~${E2_HI}% 안(허용 ±${E2_TOL}%p)`,
    result[8].hRate >= E2_LO - E2_TOL && result[8].hRate <= E2_HI + E2_TOL,
    `${result[8].hRate.toFixed(1)}%  — 정본 ② 는 «변별력 최대인 60~70% 지점». 벗어났으면 하니스를 다시 골라라(강화 축이 +1강당 약 13%)`);

/* ---------------- ② 재보정 감시 = 정본 ④ (T26 재현 방지) ---------------- */
console.log('\n[② 재보정 감시 — 하니스가 기준선과 같은가 · 노브가 움직여 밴드를 이탈했나 (정본 ④)]');
for (const ch of [6, 8]) {
  const base = BASELINE[ch], r = result[ch];
  const sameHar = base.har.rar === H[ch].rar && base.har.plus === H[ch].plus && base.har.slot === H[ch].slot;
  const hs = h => `${GT.rarName[h.rar]}${h.plus ? '+' + h.plus : ''}·슬롯${h.slot}`;
  if (!sameHar) {
    chk(`챕터 ${ch} 기준선 유효성`, false,
        `하니스가 기준선 측정 당시(${hs(base.har)})와 다르다(현재 ${hs(H[ch])}) ` +
        `— 재보정했다면 \`--rebase\` 로 기준선을 갱신하고 PROGRESS 에 사유를 남겨라`);
    continue;
  }
  const drift = r.hRate - base.rate;
  const pass = Math.abs(drift) <= DRIFT_TOL + (FAST ? 5 : 0);
  chk(`챕터 ${ch} 하니스 클리어율이 등재값 ${base.rate}% 근처(±${DRIFT_TOL}%p)`, pass,
      `현재 ${r.hRate.toFixed(1)}% (${drift >= 0 ? '+' : ''}${drift.toFixed(1)}%p)` + (pass ? '' :
      ` — 경제·난이도 노브가 움직였다는 뜻이다. 정본 ④ 는 «노브를 바꾼 회차마다 재보정» 을 요구한다: ` +
      `하니스를 다시 고르고 \`--rebase\` 로 기준선을 갱신하라 (T26 이 이 사고였다)`));
}

/* ---------------- ③ 참고 지표 = 정본 ⑤ (위반 판정 없음) ---------------- */
console.log('\n[③ 참고 지표 — 도달 시점 실제 계정과의 괴리 (정본 ⑤ · 위반 아님 · 승인 25번 3안)]');
for (const ch of [6, 8]) {
  const base = BASELINE[ch], r = result[ch];
  const d = r.gap - base.gap;
  console.log(`  · 챕터 ${ch}: 괴리 ${r.gap.toFixed(1)}%p (등재 ${base.gap}%p, ${d >= 0 ? '+' : ''}${d.toFixed(1)}%p) ` +
              `— 하니스 ${r.hRate.toFixed(1)}% vs 도달시점 계정 중앙값 ${r.obsRate.toFixed(1)}% · ` +
              `슬롯 하니스 ${H[ch].slot}렙 vs 실측 중앙값 ${r.obsSlot}렙`);
}
console.log('  ※ 이 괴리는 하니스 결함이 아니라 «실험3 진행 곡선이 §7 목표 미달» 의 그림자다 — 실험3 이 목표에 들면 저절로 줄어든다.');

console.log(`\n통과 ${ok} · 위반 ${bad}`);
if (bad) { console.log('→ 실패'); process.exit(1); }
console.log('→ 통과 (정본 «변별점 규칙» ①②③④ 준수 · ⑤ 괴리는 참고 지표)');
