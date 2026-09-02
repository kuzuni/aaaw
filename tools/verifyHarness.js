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
        실험1: 등급 3단 전부 1~99% 비포화 + 인접 ≥2%p 분리 · 실험2: 전체 클리어율 15~85% 안, 목표 밴드 60~70%.
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
/* ⚑ T1 R01 — 하니스에 «챕터» 축이 생겼다(`hCh('EXP1_CH',N)`). 여기서도 소스에서 읽어 자동 추종한다.
   ⚠ 두 하니스가 **같은 챕터에 앉을 수 있으므로**(R01 은 둘 다 챕터 11) 키를 챕터 번호로 잡으면 서로 덮어쓴다 —
   실험 번호(e1/e2)를 키로 쓴다. */
function readCh(env) {
  const m = SRC.match(new RegExp(`hCh\\('${env}',\\s*(\\d+)\\s*\\)`));
  if (!m) throw new Error(`sim.js 에서 hCh('${env}',…) 기본 챕터를 못 찾았다 — 하니스 선언 형태가 바뀌었다`);
  return +m[1];
}
const EXPS = [
  { k: 'e1', n: 1, ch: readCh('EXP1_CH'), h: readHarness('EXP1_GEAR') },
  { k: 'e2', n: 2, ch: readCh('EXP2_CH'), h: readHarness('EXP2_GEAR') },
];
const H = { e1: EXPS[0].h, e2: EXPS[1].h };

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
     사다리 일반 12.3 / 희귀 25.7 / 전설 51.7 / 신화 66.7%. 종전 등재: 6 = 24.3/-21.5 · 8 = 65.0/42.5. */
  /* ⚑ 재보정 (T1 재개 R01, 2026-09-02 / 워커 C) — 사유: R01 이 난이도 곡선을 사다리 7점에 재적합했다
     (기저 40/8 → 26/5.2 · 구간별 성장률 재적합). 두 하니스가 함께 100.0% 천장 포화가 됐고,
     **강화 축으로는 다시 고를 수 없었다** — 챕터 6 에서 미장착 2.3% ↔ 일반+0 99.7% 로 절벽이라
     변별 구간(15~85%)에 앉을 값이 그 챕터에는 존재하지 않는다. 그래서 «챕터» 축을 새로 열어 재선정했다.
     ⚠ 아래 등재값은 **T47(expNeed 4+4*Lv)·T48 2·3단계(특전 132종)까지 합류한 최종 트리에서 잰 값**이다
     (리베이스 전 트리의 잠정값 42.0 / 64.7 은 폐기 — 합류 후 다시 골랐다).
       실험1 = **챕터 13 · 일반+1 · 슬롯0** (혼합 23.7% · 사다리 6.3 / 12.0 / 35.0 / 67.3%, 포화 0)
       실험2 = **챕터 11 · 일반+1 · 슬롯3** (게이트 300판 64.7% · 채점 1200판 62.6 / 63.8%)
     ⚠ 실험2 는 강화 축만으로는 밴드에 못 앉는다 — 챕터 11 에서 일반+1 = 1200판 58.7%(밴드 아래) ·
       일반+2 = 300판 73.3%(밴드 위)로 **두 값 사이에 강화 단계가 없다**. 슬롯(레벨당 +1%)이 남은 유일한 미세 축이라 그것으로 채웠다.
     ⚠ 챕터 축은 «번호가 크면 어렵다» 가 성립하지 않는다(T28 — `chapterLayout` 제비뽑기가 지배):
       챕터 10 은 일반+1 로 99.5% 인데 챕터 11 은 같은 하니스로 58.7% 다. 반드시 실측으로 고를 것.
     종전 등재: 챕터6 일반+4 = 36.0/0.8 · 챕터8 일반+10 = 62.3/10.2. */
  /* ⚑⚑ 재보정 (T72, 2026-09-03 / 워커 D) — 사유 두 가지가 한 번에 왔다.
     ① 주인 확정 «플레이어 기본 스탯»(치확 5→20 · 치배 200→150 · 반격 10→20 · 방어 5→20 · 회피 8→20, PLAN §2.3).
     ② 주인 확정 «밸런스 기준점»: 실험 하니스의 **표준 장비 = 희귀 풀셋**(공 100/체 500/실 800).
     ①로 플레이어가 크게 세져 종전 두 하니스가 89.3% · 99.3% 로 함께 포화했고, ②로 «일반 등급 + 강화»
     픽스처 자체가 폐기됐다(장비가 고정 → 강화 축 소멸). 남은 조절 축은 챕터, 미세 축은 슬롯이다.
       실험1 = **챕터 30 · 희귀 풀셋 · 슬롯 0** (52.3% · 사다리 13.7 / 47.0 / 68.0 / 78.7%, 포화 0 · 인접 33.3·21.0·10.7%p)
       실험2 = **챕터 30 · 희귀 풀셋 · 슬롯 5** (65.0% — 목표 밴드 60~70% 정중앙)
     ⚠ 두 축 다 단조가 아니다. 챕터: 26=93.7 · 28=80.7 · 30=52.0 · 33=29.5. 슬롯(챕터 30):
       0=52.3 · 3=53.7 · 4=51.7 · 5=65.0 · 6=76.3 · 7=69.3. 레벨당 +1% 가 시드별 챕터 배치의
       계단보다 작아서다 — 반드시 이 게이트의 시드 12벌로 실측해 고를 것.
     ⚠ 참고 지표(정본 ⑤) 괴리가 -47.5/-34.8%p 로 커졌다: 챕터 30 도달 시점 실계정은 이미 슬롯 9렙이라
       거의 100% 클리어한다. 이건 하니스 결함이 아니라 «실험3 진행 곡선이 §7 목표 미달» 의 그림자다(정본 ⑤).
     종전 등재: 챕터13 일반+3 = 30.7/-31.7 · 챕터11 일반+4 = 64.7/38.0. */
  /* ⚑ 재보정 (T78, 2026-09-02 / 워커 D) — 사유: 주인 확정 «소환 연쇄 임계 ≤ 0.8» 을 맞추느라
     「공격 시」 소환 6종의 발동 확률을 5% 로 통일하고 신화 발수를 3/3/2 로 내렸다(최악 조합 B 12.108 → 0.769).
     소환 연쇄가 초임계에서 수렴으로 바뀌면서 두 하니스가 함께 내려갔다 —
     실험1 52.3 → 38.3%(변별 구간 15~85% 안 · 사다리 4단 비포화, 간격 18.0/28.7/10.0%p → **하니스 구성 유지**) ·
     실험2 65.0 → 62.7%(목표 밴드 60~70% 정중앙 → 구성 유지). 즉 **재선정 없이 기준선만 갱신**한다.
     종전 등재: e1 = 52.3/-47.5 · e2 = 65.0/-34.8. */
  /* ⚑ 재보정 (T82, 2026-09-02 / 워커 C) — 사유: 주인 확정 «처치 시 체력 5% 회복» 을 기준점으로
     킬힐·킬실드 축 4종을 읽히는 체급으로 올렸다(c_killHeal2 0.37 → 5% · c_killShield3 0.5 → 5% ·
     l_killHeal5 0.55 → 10% · l_killShield10 0.75 → 10%). 두 하니스가 함께 올라갔다 —
     실험1 38.3 → 55.0%(변별 구간 15~85% 안 · 4단 비포화 → **하니스 구성 유지**) ·
     실험2 62.7 → 70.3%(목표 밴드 60~70% 의 허용치 ±8%p 안 → 구성 유지). 즉 **재선정 없이 기준선만 갱신**한다.
     ⚠ 사다리가 «일반 43.3% > 희귀 30.7%» 로 뒤집혔다 — 킬 회복 축이 일반·전설에만 있어서다.
       ①의 «인접 ≥2%p 분리» 는 절대값이라 이 역전을 못 잡는다. 판정은 주인 확정 등급 과녁(15/25/35/45)의 몫이고,
       난이도 상향만으로는 못 고친다(T82 실측: 기저 ×1.2 에서 일반 25.3% ↔ 희귀 4.7%). 근거 `docs/balance/T82/`.
     ⚑ 등재값은 **리베이스로 T1 회귀2 R02(신화 등급 총량 하향)가 합류한 트리에서 다시 잰 것**이다
     (T82 단독 트리의 잠정값 55.0 / 70.3 은 폐기 — 합류 후 51.3 / 66.7 로 다시 골랐다. 둘 다 밴드 안이라 구성은 유지).
     합류 트리 사다리: 일반 43.3 · 희귀 30.3 · 전설 76.7 · 신화 47.0%.
     종전 등재: e1 = 38.3/-61.5 · e2 = 62.7/-37.2. */
  e1: { ch: 30, har: { rar: 1, plus: 0, slot: 0 }, rate: 51.3, gap: -48.7 },
  e2: { ch: 30, har: { rar: 1, plus: 0, slot: 5 }, rate: 66.7, gap: -33.3 },
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
console.log('소스 하니스: ' + EXPS.map(e =>
  `실험${e.n} 챕터${e.ch}·${GT.rarName[e.h.rar]}${e.h.plus ? '+' + e.h.plus : ''} 6부위·슬롯 ${e.h.slot}렙`).join(' · '));

console.log('\n[실험3 경제 코어로 «도달 시점» 계정 채집]');
const snap = collect([...new Set(EXPS.map(e => e.ch))]);

const result = {};
for (const e of EXPS) {
  const ch = e.ch, h = e.h;
  const hb = mkBuild(h.rar, h.plus, h.slot);
  const hRate = rateOf(ch, hb);
  const rows = snap[ch].map(sn => ({ sn, r: rateOf(ch, { eq: sn.eq, slots: sn.slots }) }));
  const obsRate = med(rows.map(x => x.r));
  const obsSlot = med([].concat(...snap[ch].map(s => s.slotLv)));
  const obsRar = med([].concat(...snap[ch].map(s => s.rar)));
  result[e.k] = { hRate, obsRate, obsSlot, obsRar, gap: hRate - obsRate, slotGap: h.slot - obsSlot };

  console.log(`\n[챕터 ${ch} — 실험${e.n} 하니스]`);
  console.log(`  하니스 클리어율 ${hRate.toFixed(1)}%  (전투력 공 ${buildPower(hb).atk.toFixed(3)})`);
  console.log(`  실측 도달시점 계정 클리어율: 중앙값 ${obsRate.toFixed(1)}%  ` +
              `[${rows.map(x => x.r.toFixed(1)).join(' ')}]`);
  console.log(`  실측 부위별 등급 중앙값 ${obsRar >= 0 ? GT.rarName[Math.round(obsRar)] : '미장착'}(${obsRar}) · 슬롯 중앙값 ${obsSlot}렙`);
}

/* 실험1 사다리는 ①(변별력)과 --rebase 양쪽이 쓰므로 한 번만 잰다. */
const LADDER_NAMES = ['일반', '희귀', '전설'];   /* ⚑ P1(T83) — 특전 신화 등급 폐지 */
const ladder = (() => {
  const e = EXPS[0], hb = mkBuild(e.h.rar, e.h.plus, e.h.slot);
  return [0, 1, 2].map(lock => rateOf(e.ch, hb, { rarityLock: lock }));   /* ⚑ P1(T83) 등급 3단 (신화 폐지) */
})();

if (REBASE) {
  console.log('\n--rebase — 아래를 BASELINE 에 그대로 넣어라 (재보정 사유·실측표를 PROGRESS 에 함께 적을 것):');
  for (const e of EXPS) {
    const h = e.h, r = result[e.k];
    console.log(`  ${e.k}: { ch: ${e.ch}, har: { rar: ${h.rar}, plus: ${h.plus}, slot: ${h.slot} }, rate: ${r.hRate.toFixed(1)}, gap: ${r.gap.toFixed(1)} },`);
  }
  console.log(`  ※ 참고 — 실험1 사다리 ${ladder.map((r, i) => `${LADDER_NAMES[i]} ${r.toFixed(1)}%`).join(' · ')}`);
  console.log('  ※ 정본 규칙(PLAN §7)은 ② 실험2 60~70% · ③ 실험1 4단 비포화+인접 ≥2%p 다. 밴드 밖 값을 기준선으로 박지 말 것 — 하니스를 다시 고르는 게 맞다.');
  process.exit(0);
}

/* ---------------- ① 변별력 = 정본 규칙 ①②③ (T7 재발 방지) ---------------- */
console.log('\n[① 변별력 — 정본 «변별점 규칙» ①②③ (하니스가 포화면 실험1·2 는 측정 자체가 무의미하다)]');
{
  const sat = LADDER_NAMES.filter((nm, i) => ladder[i] <= FLOOR || ladder[i] >= CEIL);
  chk('실험1 등급 3단 전부 비포화',
      sat.length === 0,
      ladder.map((r, i) => `${LADDER_NAMES[i]} ${r.toFixed(1)}%`).join(' · ') +
      `  (허용 ${FLOOR}~${CEIL}%` + (sat.length ? ` · 포화 [${sat.join(',')}]` : '') + ')');
  chk('실험1 사다리 인접 간격이 잡음 이상(각 ≥ 2%p 분리)',
      ladder.every((r, i) => i === 0 || Math.abs(r - ladder[i - 1]) >= 2.0),
      ladder.map((r, i) => i ? `${LADDER_NAMES[i - 1]}→${LADDER_NAMES[i]} ${(r - ladder[i - 1]).toFixed(1)}%p` : '').filter(Boolean).join(' · '));
}
chk(`실험1 하니스가 변별 구간 안(전체 클리어율 ${BAND_LO}~${BAND_HI}%)`,
    result.e1.hRate > BAND_LO && result.e1.hRate < BAND_HI,
    `${result.e1.hRate.toFixed(1)}%`);
chk(`실험2 하니스가 변별 구간 안(전체 클리어율 ${BAND_LO}~${BAND_HI}%)`,
    result.e2.hRate > BAND_LO && result.e2.hRate < BAND_HI,
    `${result.e2.hRate.toFixed(1)}%`);
chk(`실험2 하니스가 목표 밴드 ${E2_LO}~${E2_HI}% 안(허용 ±${E2_TOL}%p)`,
    result.e2.hRate >= E2_LO - E2_TOL && result.e2.hRate <= E2_HI + E2_TOL,
    `${result.e2.hRate.toFixed(1)}%  — 정본 ② 는 «변별력 최대인 60~70% 지점». 벗어났으면 하니스를 다시 골라라(강화 축 +1강 · 챕터 축 ±1챕터)`);

/* ---------------- ② 재보정 감시 = 정본 ④ (T26 재현 방지) ---------------- */
console.log('\n[② 재보정 감시 — 하니스가 기준선과 같은가 · 노브가 움직여 밴드를 이탈했나 (정본 ④)]');
for (const e of EXPS) {
  const base = BASELINE[e.k], r = result[e.k], ch = e.ch;
  const hs = (h, c) => `챕터${c}·${GT.rarName[h.rar]}${h.plus ? '+' + h.plus : ''}·슬롯${h.slot}`;
  const sameHar = base.har.rar === e.h.rar && base.har.plus === e.h.plus && base.har.slot === e.h.slot && base.ch === ch;
  if (!sameHar) {
    chk(`실험${e.n} 기준선 유효성`, false,
        `하니스가 기준선 측정 당시(${hs(base.har, base.ch)})와 다르다(현재 ${hs(e.h, ch)}) ` +
        `— 재보정했다면 \`--rebase\` 로 기준선을 갱신하고 PROGRESS 에 사유를 남겨라`);
    continue;
  }
  const drift = r.hRate - base.rate;
  const pass = Math.abs(drift) <= DRIFT_TOL + (FAST ? 5 : 0);
  chk(`실험${e.n}(챕터 ${ch}) 하니스 클리어율이 등재값 ${base.rate}% 근처(±${DRIFT_TOL}%p)`, pass,
      `현재 ${r.hRate.toFixed(1)}% (${drift >= 0 ? '+' : ''}${drift.toFixed(1)}%p)` + (pass ? '' :
      ` — 경제·난이도 노브가 움직였다는 뜻이다. 정본 ④ 는 «노브를 바꾼 회차마다 재보정» 을 요구한다: ` +
      `하니스를 다시 고르고 \`--rebase\` 로 기준선을 갱신하라 (T26 이 이 사고였다)`));
}

/* ---------------- ③ 참고 지표 = 정본 ⑤ (위반 판정 없음) ---------------- */
console.log('\n[③ 참고 지표 — 도달 시점 실제 계정과의 괴리 (정본 ⑤ · 위반 아님 · 승인 25번 3안)]');
for (const e of EXPS) {
  const base = BASELINE[e.k], r = result[e.k];
  const d = r.gap - base.gap;
  console.log(`  · 실험${e.n}(챕터 ${e.ch}): 괴리 ${r.gap.toFixed(1)}%p (등재 ${base.gap}%p, ${d >= 0 ? '+' : ''}${d.toFixed(1)}%p) ` +
              `— 하니스 ${r.hRate.toFixed(1)}% vs 도달시점 계정 중앙값 ${r.obsRate.toFixed(1)}% · ` +
              `슬롯 하니스 ${e.h.slot}렙 vs 실측 중앙값 ${r.obsSlot}렙`);
}
console.log('  ※ 이 괴리는 하니스 결함이 아니라 «실험3 진행 곡선이 §7 목표 미달» 의 그림자다 — 실험3 이 목표에 들면 저절로 줄어든다.');

console.log(`\n통과 ${ok} · 위반 ${bad}`);
if (bad) { console.log('→ 실패'); process.exit(1); }
console.log('→ 통과 (정본 «변별점 규칙» ①②③④ 준수 · ⑤ 괴리는 참고 지표)');
