'use strict';
/* 꼬마기사 밸런스 시뮬레이터 — 게임 엔진과 동일한 수식 사용 */

const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* ---------- 튜닝 파라미터 (여기 숫자를 게임에 이식) ---------- */
const TUNE={
  /* ⚑⚑⚑ P3 R01 «일반 영점» (T85 · 2026-09-03 / 워커 C) — 주인 확정 P3 ①단계.
     «일반 특전만 뜨는 기준 플레이어(희귀 풀셋·챕터 30)가 10%» 를 **적 난이도 노브로만** 맞춘 값이다.
     구간별 성장률 표(§11.7)·벽 배수는 한 칸도 안 건드렸다 — 기저 배수 하나(×1.4925)로만 움직였으므로
     챕터 간 상대 난이도(사다리 모양·벽 예산 항등식)가 통째로 보존된다.
     26.82/4.986 → **40.0/7.44** (HP:DMG 비 5.379 유지). 8시드×300판 실측 —
     일반 78.3 → **8.4±1.3%**(과녁 10±5 ✓) · 희귀 72.7 → **20.7±2.1%**(과녁 20 ✓) ·
     전설 98.3 → **70.3±4.5%**(과녁 80, −9.7%p — ②단계 «전설 특전 수치» 몫).
     ⚑ 주인 «적 ×10 을 첫 시도값으로» 조항: ×10(268/49.9)은 **크게 지나친다** — ×1.5 에서 이미 일반이
       78 → 8% 다. 실측 적합값은 **×1.49**. 주인 원문대로 «10배는 출발점, 사다리가 성립하는 값으로 자유 조정».
     ⚠ ②③단계는 이 두 값을 **동결**한다(노브 교차 금지). 근거 `docs/balance/T85/raw.md`. */
  /* ⚑⚑⚑ T97 (2026-09-03 / 워커 C) — 주인 확정 과녁 2점에 재적합. 기저를 ×1.015 로만 올렸다(40.0/7.44 → 40.6/7.55).
     과녁 B(노장비·챕터 4)가 33.6% 라 목표 30±2 를 벗어나 있었고, 챕터 4 는 구간0(1~4)만 지나므로
     노브가 «기저» 아니면 «구간0 성장률» 뿐이다. 구간0 을 그대로 두고 기저만 올려 챕터 1~4 의 상대 형상을 보존했다.
     ⚠ 이 축은 매우 예민하다 — ×1.015 = 30.5% · ×1.020 = 24.2%(각 2,000판×3시드). 적 HP 가 정수 반올림이라
     «한 대 더 때려야 하나» 가 계단으로 바뀌는 탓이다. 0.5% 단위보다 잘게 움직이지 말 것. 근거 docs/balance/T97/raw.md. */
  /* ⚑⚑⚑ T120 (주인 확정 2026-09-04 15:3X) — «전(前) 기준» 복구. T119 가 3택·새 특전 조건으로 이 네 값을
     다시 맞춘 것(기저 ×1.3322 · 구간률 재절단)은 주인이 시킨 일이 아니라 **T114 완료 커밋 `f0ae9e0` 의 값으로
     되돌렸다**. 주인 원문: «맞추라 한 적이 없는데 왜 맞췄노. 전에 그 기준대로 밸런스 되야 하는데.»
     ⚑ 상시 규칙 — 특전·3택·등급 등 «플레이어 쪽» 이 바뀌어도 루틴은 이 네 값을 임의로 재적합하지 않는다.
     재적합은 주인이 «맞춰라» 라고 한 경우에만, 그리고 언제나 `PERK_MODE_LADDER`(기준 플레이어) 조건으로만 한다. */
  eBaseHp:49.283586, eBaseDmg:9.164809,
  /* ⚑ T35: 단일 성장률 `eHpG 1.185`·`eDmgG 1.08` 폐기 → PLAN §11.7 «구간별 성장률» 표.
     적 HP 는 플레이어 «공격력» 축, 적 DMG 는 «체력+실드» 축에서 주인 확정 스탯 사다리로부터 역산된 값이다.
     [하한, 성장률] — 챕터 c 에서 c+1 로 갈 때 적용할 배수를 c 로 찾는다.
     1~5 는 5→15 구간률을 앞으로, 260~300 은 120→260 구간률을 뒤로 연장한다 (PLAN §11.7 괄호 규정).
     ⚑ T1 R01 재적합 (주인 확정 15:1X: «성장률 표는 확정 지위 해제 → T1 자유 튜닝 노브, 사다리 7점이 유일한 과녁»).
     T35 초기값은 «플레이어 힘 선형» 가정의 역산이라 엔진의 초선형성을 못 담아 사다리가 1/7 이었다.
     구간별 난이도 지수 a 로 재적합 — 성장률 = 1 + a*(T35 초기율 - 1), a = 1.0/1.15/1.6/1.45/2.0/2.8,
     기저는 40/8 → 22.8/4.56 (×0.57). T47(expNeed 4+4*Lv)·T48 2·3단계(특전 132종)까지 합류한 트리에서 잰 최종값이다.
     근거·실측표 `docs/balance/resume-R01/raw.md`.
     ⚑ T1 R02 — 구간0(챕터 1~14)만 1.0718/1.0497 → 1.0292/1.0265 로 내리고 기저를 22.8/4.56 → 26.82/4.986 으로 올렸다.
     이것은 난이도 총량 변경이 **아니라** 아래 «벽 예산» 항등식을 만족시키는 재배치다 — 사다리 과녁 5·15 가 그대로 유지된다.
     ⚑ T1 R05 — 구간 15→30 하나를 **15→20(1.15) + 20→30(1.0096)** 둘로 쪼갰다. «벽 예산» 과 같은 종류의 재배치이고,
     항등식은 `x⁵·y¹⁰ = 1.0544¹⁵ = 2.2135` (실제 `1.15⁵·1.0096¹⁰ = 2.2129`, 잔차 0.03%) — 챕터 30 이후 누적이
     보존되므로 **사다리 과녁 7점이 전부 그대로다**(바뀌는 것은 챕터 16~29 뿐. 실측 7/7 유지).
     왜: 실험3 의 1~20 소계가 0.325/1.5 로 줄곧 바닥이었고 그중 구간 11~19·20 이 «시도 1회» 로 붙어 있었다.
     40시드 짝지음 실측 — 1~20 소계 **+0.023 ± 0.005 (t=4.21)** · 총점 1.274 → **1.384 (+0.110 ± 0.061)**.
     ⚠ 이 족(族)의 상한은 **x=1.1724**(그 위는 y<1 이라 챕터 20~30 에서 적이 약해진다). x=1.17 도 재 봤는데
     1~20 이 +0.024 로 x=1.15 의 +0.035(20시드)보다 낮다 — 구간 20 을 목표(10~30회) 위로 넘겨 버린다.
     ⚠ 위 R01·R02·R05 의 실측 근거는 **이력**이다 — 아래 T97 이 표 전체를 새 과녁 2점으로 갈아엎었고,
       그때 근거였던 사다리 7점·실험3 점수는 주인 지시로 폐기됐다(PLAN §7 머리).

     ⚑⚑⚑ T97 (2026-09-03 / 워커 C) — 주인 확정 과녁 2점(표준 ch15 = 10% · 노장비 ch4 = 30%)에 재적합.
     두 가지를 했다.
     ① **구간0 을 챕터 5 에서 쪼갰다** — [0,1.0292] → [0,1.0292] + **[5,1.122]**. 챕터 4 는 구간 [0,·] 만,
        챕터 15 는 [5,·] 를 10칸 지나므로 **두 과녁이 서로 다른 노브를 갖게 된다**(R05 의 15→20/20→30 분할과 같은 수법).
        분할 전에는 노브가 하나라 «A 를 맞추면 B 가 밀리는» 구조였다. 실측 gb: 1.118 = 20.5% · 1.120 = 14.3% ·
        **1.122 = 9.7%** · 1.124 = 5.1%(각 1,000판×3시드).
     ② **D(120~300) 보존 축척** — ①로 챕터 15 «위» 가 전부 HP ×2.406 · DMG ×2.471 만큼 통째로 올라간다.
        그대로 두면 후반이 통째로 밀려 상한 장비로도 챕터 300 을 못 깬다(≈ 챕터 316 난이도가 된다).
        그래서 **15 → 120 구간률의 로그만 같은 비율로 축소**했다 — HP λ=0.792 · DMG λ=0.735,
        120 위 두 구간과 벽 배수(10·15·90·300)는 **한 글자도 안 건드린다**.
        `Σ nᵢ·ln rᵢ`(15→120)가 정확히 `ln(shift)` 만큼 줄어 **D(120) 이 보존**되고, 그 위는 구간률이 그대로라
        **챕터 120~300 의 난이도가 T97 이전과 완전히 동일**하다(적 HP 실측 ch120 12250 · ch300 416386 불변).
        난이도 증가분은 챕터 15 의 ×2.40 에서 120 의 ×1.00 으로 잦아든다(ch30 ×2.04 · ch50 ×1.62 · ch100 ×1.08).
        상한 장비(신화+9·슬롯150)의 챕터 300 클리어율 **99.5%** 로 완주 가능성을 실측 확인했다.
        ⚠ 축척 구간을 300 까지로 넓히면(= D(300) 만 보존) 챕터 120~260 이 1.2~1.4배 무거워져 **F2P 정체 지점이
          챕터 202 → 193 으로 오히려 당겨진다**(실험3 시드 11 실측). 120 까지만 축척하면 **210** 으로 밀린다.
     ⚠ 두 과녁은 구간 15 «위» 와 **독립**이다(D(4)·D(15) 는 15 이후 구간률을 안 탄다) — ②는 과녁을 못 흔든다. */
  /* ⚑⚑⚑ T103 (2026-09-03 / 워커 B) — **난이도 사다리 8점 전면 재적합**.
     주인 확정 사다리(전부 «특전 10종 순서 획득 · 클리어율 10% ±2%p»):
       노템 5 · 일반 15 · 희귀+슬롯5 28 · 전설+슬롯15 70 ·   (⚑ T153 — 영웅 칸 40 삭제)
       신화+슬롯25 150 · 신화9강+슬롯50 380 · **신화9강+슬롯100 420**(⚑ 주인 정정 — 종전 600 폐기).
     ① **구간 경계를 과녁 챕터에 맞춰 새로 잘랐다** — 5·15·28·40·70·150·380·420.
        종전 경계(15/20/30/50/70/120/260)는 옛 사다리 7점 것이라 과녁과 어긋나 있었고, 그 상태로는
        구간 하나가 과녁 둘에 걸려 «하나를 맞추면 옆이 밀리는» 구조가 남는다. 경계를 과녁에 맞추면
        구간 k 가 과녁 k+1 만 담당하므로 **앞에서부터 순서대로** 자를 수 있다.
     ② 적합 방법(주인 지시 ⑤의 «권장 절차» 그대로) — 사다리 칸 각각에서 «적 HP·DMG 를 같은 배수 m 으로
        곱해 클리어율 10% 가 되는 m» 을 격자 주사로 재고(시드 11·12·13 각 1,500판),
        구간률 = `((m_{k+1}/m_k) · D_old(c_{k+1})/D_old(c_k) ÷ 구간 안 벽배수)^(1/n)` 로 다시 잘랐다.
        같은 m 을 HP·DMG 에 곱하므로 **챕터별 HP:DMG 비가 보존**된다.
     ③ 1→5 구간률은 옛 값을 그대로 두고 **기저만** 옮겼다(챕터 1~4 의 상대 형상 보존).
     ④ 10 벽 1.5/1.25 · 15 벽 비활성 · 90 벽 2.0/1.5 는 그대로다(70→150 구간률이 1 위라 예산이 남는다).
        **최종 벽(`wall4`)은 배수 1.0 = 꺼짐**이다 — 380→420 을 «150→380 률을 그대로 이어» 채우면
        잔차가 1 아래로 나오고, 주인 지시 ④가 «잔차가 1 아래면 벽을 끄고 률만으로 잇는다» 로 정해 두었다.
     ⚠ 적 HP·DMG 는 `Math.round` 라 초반 칸의 계단이 크다(2칸 챕터 15: 적 HP 51 → 52 가 14.5% → 5.5%).
        0.5% 단위보다 잘게 움직이지 말 것. 근거·실측표 `docs/balance/T103/result.md`. */
  eHpSeg:[[0,1.0292],[3,1.143045],[7,1.036216],[15,1.107449],[30,1.078482],[60,1.075168],[100,1.023029]],
  eDmgSeg:[[0,1.0265],[3,1.141544],[7,1.036216],[15,1.101885],[30,1.054227],[60,1.069589],[100,1.024943]],
  /* ⚑⚑ 「벽 예산」 — T1 R02 가 «사다리 유지 + 벽 존재» 를 동시에 만족시킨 방법 (T35 가 남긴 숙제의 답).
     T35 는 «구간별 성장률이 사다리 7점에서 역산된 값이라 벽을 얹으면 사다리가 어긋난다» 며 벽 4종을 전부 껐다.
     하지만 어긋나는 건 «혼동» 이 아니라 **예산**이다: 과녁 7개 중 5 만 벽 밖(c<10)이고 15·30·50·70·120·260 은 전부 벽 안이라
     고정할 식이 둘뿐이다 — D(5)=기저·g0^4 · D(15)=기저·g0^14·W. 나누면 **g0^10 · W = 상수** (HP 2.000 · DMG 1.624).
     즉 10챕터 벽 배수는 «구간0 성장률 10챕터분» 에서 빌려 오고, 빌린 만큼 기저를 올려 되갚으면 7점이 통째로 보존된다.
     15 이후 구간률을 안 건드리므로 위쪽 과녁 5개는 자동으로 따라온다. 실측 사다리 7/7 · 챕터 9→10 계단 ×1.54.
     ⚠ 예산은 유한하다 — W 를 더 올리면 g0 가 눌려 챕터 1~9 가 평평해지고 기저가 올라 1~4 가 무거워진다.
        실측 §7 1~20 적합 셀: 벽 끄기 29 · **W=1.5 → 36** · W=1.7 → 27(악화). 1.5 가 최적점이다.
     ⚠ 같은 이유로 15 벽(wall2)은 켤 수 없다 — 그건 과녁 «일반=15» 자체에 곱해지고 같은 예산을 나눠 쓴다.
     90·300 벽(wall3/4)은 과녁 120·260 에 직접 걸리므로, 켜려면 구간 70→120·120→260 지수를 같은 방식으로 재적합해야 한다.
     근거 `docs/balance/resume-R02/raw.md` · 스펙 개정 제안은 PROGRESS 승인 30번(T54). */
  wallHp:1.5, wallDmg:1.25,     // 10챕터 이상 벽 배수 (⚑ T1 R02 재산정 — 아래 «벽 예산» 주석)
  wall2Hp:1.0, wall2Dmg:1.0,    // 15챕터 이상 추가 배수 (임시 비활성 — T1 재산정)
  waveHp:0.15, waveDmg:0.08,    // 웨이브 인덱스당 (R03)
  wall3Hp:2.0, wall3Dmg:1.5,    // 90챕터 대형 벽 (⚑ T1 R03 켬 — 벽 예산: 구간 70→120 률을 3.30/3.38% → 1.88/2.54% 로 내려 D(120) 보존)
  wall4Hp:1.0, wall4Dmg:1.0,    // ⚑⚑⚑ T103 재적합 — 최종 벽 **꺼짐**. 380→420 을 «150→380 률 그대로» 이으면 과녁 420(10%)까지의 잔차가 HP 0.74·DMG 0.76 으로 1 아래라, 주인 지시 ④ 의 «잔차가 1 아래면 벽을 끄고 률만으로 잇는다» 를 그대로 이행했다. 되살리려면 380→420 구간률을 그만큼 내릴 것 (§6 «벽 예산» 항등식과 같은 재배치). slotCostG 1.6 의 짝 노브다
  wall4At:420,                  // ⚑⚑⚑ T103 (주인 정정 2026-09-03) — 최종 벽 위치 600 → 420. 배수는 위 줄대로 ×1.0(꺼짐)이라 지금은 «위치만 있는 벽» 이다. 10·15·90 벽은 위치·배수 그대로
  bossHp:8, bossDmg:1.8,        // 주인 확정 상수 (튜닝 노브 아님) — 5배수 챕터 추가 배수 폐기
  maxChapter:420,               // PLAN §2.4 (20 → 100 → 300 → 500 → 600 → ⚑⚑⚑ T103 주인 정정으로 420. 사다리 «신화9강+슬롯100 = 420» = 챕터 수 = 최종 벽 위치)
  /* 플레이어 기본치 (영구강화 4종 폐지 — 성장은 §11 장비 + 슬롯 강화가 전담)
     ⚑ T35 주인 확정(PLAN §11.5-a): 공 25 / 체 150 / 실드 250. 실드는 `maxHp*0.8` 파생이 아니라 독립 스탯이다. */
  /* ⚑ 주인 확정 2026-09-03 (ROUTINE «플레이어 기본 스탯») — 노브 아님. PLAN §2.3 표와 1:1.
     종전엔 치배·방어·반격·회피 넷이 mkPlayer 에 리터럴로 박혀 있어 PLAN 어디에도 값이 없었다
     (T27 «미문서 상수 4종» · 승인 대기 22번). 주인이 값을 확정하면서 그 안건이 종결됐고,
     넷을 여기로 끌어올려 «한 곳에서만 정의 → PLAN 과 대조» 가 가능해졌다(verifyCombatConst ①).
     ⚑⚑⚑ T123 주인 확정 2026-09-04 18:5X «치확 0% 반격 0% 방어력 0% 회피 0% 로 하기» —
     넷(pCrit0·pCounter0·pDef0·pEvade0)이 20 → 0 이 됐다. 공 25 / 체 150 / 실 250 / 공속 1.0 /
     치명타 피해 150% 는 그대로. 이제 특전을 얻기 전엔 회피·반격·치명 트리거가 한 번도 안 터지고
     특전으로만 자란다(주인이 알고 확정한 귀결 — ROUTINE 18:5X ②). */
  pAtk0:25, pHp0:150, pSh0:250, pAspd0:1.0, pCrit0:0, pCritF0:150, pCounter0:0, pDef0:0, pEvade0:0,
  goldKillBase:0.6, goldKillPer:0.10, goldClearPer:3,
  goldGrowth:1.22,              // 챕터당 골드 성장 배수 (R07: 1.185 → 1.22. 1.185 는 챕터 90 대형 벽에서 슬롯 13 에 갇혀 F2P·과금 둘 다 영구 정체했다 — 실험4 실측. eHpG 보다 높게 둬야 후반 벽에서 수입이 적 성장을 따라잡는다)
  expKill:3, expBoss:9,
  /* ⚑⚑⚑ T100 (주인 확정 2026-09-03) — `4+3*lv` → **`5*lv+1`**.
     주인 원문: «경험치 6으로 시작해야 하고 레벨업당 필요 경험치가 5씩 증가».
     Lv1→2 에 6, 그다음부터 +5 씩 (6·11·16·21·26·31·36·41·46·51) — 10레벨 누적 Σ(5L+1)=**285**.
     ⚑⚑⚑ T107 (주인 확정 17:3X) — T100 의 «고정 챕터 공급 286(=75×3+9+2×26) → 완주 = 특전 10개»
     항등식은 **폐기**됐다. 적 수가 챕터마다 다르므로(`chapterLayout` · N(c) = c ≤ 5 ? 17 : min(50, 17 + (c − 5)))
     보스 전 공급 = **(N−1)×3 + 52** 가 그 챕터의 특전 수를 정한다 — 실측 1~5=6 · 15=7 · 28=8 · 38+=9.
     상한 50 에서도 199 < 234(9레벨 누적)라 10번 특전은 어느 챕터에서도 안 나온다(주인 승인).
     `expKill:3` 은 주인 지시대로 그대로다. 실측 게이트 = `tools/verifyChapterFixed.js` ⓓ. */
  expNeed:lv=>5*lv+1,
};
TUNE.goldKill=c=>(TUNE.goldKillBase+TUNE.goldKillPer*c)*Math.pow(TUNE.goldGrowth,c-1)*rand(1,1.8);
TUNE.goldClear=c=>TUNE.goldClearPer*c*Math.pow(TUNE.goldGrowth,c-1);
/* 스윕용 오버라이드 (기본 동작 불변) — 예: TUNE_OVERRIDE='{"eHpG":1.22}' node sim.js 3 */
if(process.env.TUNE_OVERRIDE){
  const o=JSON.parse(process.env.TUNE_OVERRIDE);
  for(const k in o){ if(typeof o[k]==='object'&&o[k]) Object.assign(TUNE[k],o[k]); else TUNE[k]=o[k]; }
}

/* ---------- 챕터 레이아웃 (결정적) ---------- */
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

/* ---------- 시드 RNG (하니스 전용 · R11) ----------
   `SEED=<정수>` 를 주면 Math.random 을 결정적 스트림으로 갈아끼운다. SEED 미설정 시 동작은 종전과 완전히 동일하다.
   스트림을 둘로 나눈 이유: 실험4 «과금은 가속만» 기준(§7)을 재려면 F2P/과금이 같은 난수를 써야 하는데(공통난수),
   과금은 1일차에 뽑기를 30회 더 하므로 단일 스트림이면 그 시점부터 전투 난수까지 통째로 어긋나 비교가 무의미해진다.
   뽑기를 별도 스트림으로 빼면 «k번째 뽑기 결과» 가 두 계정에서 동일해져, 과금은 같은 뽑기 수열을 더 빨리 소비할 뿐이 된다. */
let RNG_GACHA=null;
function setSeed(s){ const m=mulberry(s|0); Math.random=()=>m(); RNG_GACHA=mulberry((s^0x9E3779B9)|0); }
const grand=()=>(RNG_GACHA||Math.random)();
/* ⚑ 악마의 거래 비용 (PLAN §2.4 · 주인 확정 2026-09-03 · T90) — «최대체력의 30% 를 **최대치에서** 깎는다».
   현재체력에서 깎던 종전 구현은 폐기 — 그 판 동안 최대체력 자체가 줄어든 채 진행한다.
   현재체력이 새 최대치를 넘으면 최대치로 클램프(위임 — 풀충전이 아니라 내림 클램프다).
   index.html 과 같은 이름·같은 값이어야 한다
   (게이트 tools/verifyDevilPolicy.js 가 두 엔진을 대조하고 실측으로도 단언한다). */
const DEVIL_COST=0.30;
function payDevilCost(p){
  p.maxHp=Math.max(1,p.maxHp-p.maxHp*DEVIL_COST);
  p.hp=Math.min(p.hp,p.maxHp);
  return p.maxHp;
}
/* ⚑ 주인 확정 제약 (PLAN §2.4, 2026-09-02 14:2X) — 전 챕터 공통:
   ① 적 총 수 ≤ LAYOUT_MAXENEMY ② 쉼터 고정 ③ 악마 정확히 1 ④ 천사 정확히 1.
   ⚑⚑⚑ T107 (주인 확정 2026-09-03 17:3X) — 상한 **80 → 50**. 주인 원문: «적 개수 50개 되면 더이상 안 올리기»
   (처음 76 이라 했다가 «50마리 넘으면 피로하다» 로 50 확정). T100 의 «전 챕터 76 고정» 은 폐기됐다.
   후반 난이도는 마릿수가 아니라 적 스탯으로 낸다는 조항은 그대로다. */
const LAYOUT_MAXENEMY=50;
/* ⚑ 고정 구성 — 웨이브 5개 · 쉼터 2 (전 챕터 동일). index.html 과 같은 값. */
const LAYOUT_WAVES=5, LAYOUT_RESTS=2;
/* ⚑⚑⚑ T107 (주인 확정 2026-09-03 17:3X) — **챕터별 적 수 곡선**. 주인 원문: «적수를 1챕터~5까지 17마리,
   6챕터부터 1 올라갈 때마다 1개씩 추가, 그리고 적 개수 50개 되면 더이상 안 올리기».
     N(c) = c ≤ 5 ? 17 : min(50, 17 + (c − 5))   — 챕터 6 = 18 · 7 = 19 · … · **38 부터 50 고정**
   «17» 은 **보스를 포함한 총 수**(위임 기본값)라 일반 적은 N − 1 이고 보스 1 은 항상 마지막이다.
   웨이브는 5개 그대로 두고 일반 적을 **최대한 균등 분배·나머지는 앞 웨이브부터** 나눈다
   (16 → 4·3·3·3·3 · 49 → 10·10·10·10·9 — 위임 기본값).
   ⚑ 적 «수» 는 여전히 난이도 노브가 아니다 — 이 곡선은 주인 확정 상수다(PLAN §7.3). */
const ENEMY_CURVE={early:17, from:6, cap:50};
function chapterEnemyCount(c){
  return c<ENEMY_CURVE.from ? ENEMY_CURVE.early
       : Math.min(ENEMY_CURVE.cap, ENEMY_CURVE.early+(c-(ENEMY_CURVE.from-1)));
}
function chapterWaveSizes(c){
  const n=chapterEnemyCount(c)-1, b=Math.floor(n/LAYOUT_WAVES), r=n%LAYOUT_WAVES, out=[];
  for(let i=0;i<LAYOUT_WAVES;i++) out.push(b+(i<r?1:0));   /* 나머지는 앞 웨이브부터 */
  return out;
}
/* ⚑⚑⚑ T114 (주인 확정 2026-09-04 03:4X) — **원거리 마릿수 곡선**. 주인 원문: «챕터 4까지는 원거리 아예 없고
   5부터 원거리 1마리씩 추가하고 30퍼 비율 될 때까지 한 마리씩 늘린 다음에 30퍼에서 플러스 마이너스 2로 묶으까?»
   T105 의 «각 적 40% 독립 굴림» 은 폐기됐다 — 이제 «마릿수 결정 → 자리 추첨» 두 단계다.
     굴림 대상 E(c) = 일반 적 − 웨이브 첫 마리 5 = N(c) − 6   (첫 마리 비원거리 규칙은 그대로)
     기준값   B(c) = round(0.30 · E(c))                        — 챕터 1~5 = 3 · 15 = 6 · 28 = 10 · 38+ = 13
     흔들림   j(c) ∈ {−2..+2} — 챕터 시드로 고른다 (이벤트 셔플 «뒤» · 자리 굴림 «앞» 에서 소비)
     원거리 수 R(c) = c ≤ 4 ? 0 : (c−4 ≤ B(c) ? c−4 : max(0, B(c)+j(c)))
   ⚑ 램프 구간(챕터 5~9)에는 흔들림을 태우지 않는다 — 주인 지시의 게이트 조건 ⓗ 가 «5~램프 끝 정확히 +1»
     을 요구하므로, 위임 원문의 `min(c−4, B+j)` 형태로는 램프 중간에 j=−2 가 들어가 +1 단조가 깨진다
     (실제로 챕터 7 이 3 → 2 로 내려갔다). 램프를 우선하고, 램프가 B 를 따라잡은 «뒤» 부터 B ± 2 로 묶는다.
     주인이 원문 형태를 원하시면 이 세 줄만 `Math.min(ramp, Math.max(0,B+jit))` 로 되돌리면 된다.
   ⚑ 이 상수·함수는 `chapterLayout` 안에서만 쓴다 — 웨이브 생성부에서 다시 굴리면 챕터별 고정이 깨진다. */
const RANGED_CURVE={zeroUntil:4, rate:0.30, jitter:2};
function chapterRangedPool(c){ return chapterEnemyCount(c)-1-LAYOUT_WAVES; }   /* E(c) = N − 1 − 웨이브 첫 마리 5 */
function chapterRangedBase(c){ return Math.round(RANGED_CURVE.rate*chapterRangedPool(c)); }
function chapterRangedCount(c,jit){
  if(c<=RANGED_CURVE.zeroUntil) return 0;
  const ramp=c-RANGED_CURVE.zeroUntil, B=chapterRangedBase(c);
  return ramp<=B ? ramp : Math.max(0,B+jit);
}
/* ⚑ 쉼터 보상 (PLAN §2.4 · 주인 확정 2026-09-02 17:1X · T49) — «❤️ 체력 260 회복(고정값)» vs «🌟 경험치 +26».
   고정값이라 최대체력 비율로 되돌리지 말 것. index.html 과 이름·값이 같아야 한다(게이트 verifyRestPolicy). */
const REST_HEAL=260, REST_EXP=26;
/* ⚑ 주인 확정 상수 (PLAN §2.3, 2026-09-02 15:4X) — 적 전원 회피율 10%.
   튜닝 노브가 아니다(TUNE 밖에 둔 이유). 적중률(명중) 스탯·특전·장비 옵션·버프는 이 게임에 존재 금지 —
   흡혈 증가 금지와 같은 축이라, 이 상수를 «뚫는» 수단을 추가하면 게이트(verifyT2 ⑲)가 빨개진다.
   적용 범위(주인 명시): 기본공격 · 소환(창/도끼/화살/번개/검기) · 반격.
   제외(위임 판단, PROGRESS T43 에 근거 등재): 가시 반사·오발 화살 — 플레이어가 겨눈 타격이 아니라
   적의 공격이 되돌아온 것이라 «적이 회피한다» 가 성립하지 않는다. */
const ENEMY_EVADE=0.10;
/* 스턴 상수 — 보스는 지속 1/3 (치명타 스턴으로 보스를 영구 스턴락하는 것 방지, 주인 명시).
   스턴 지속은 3초 또는 6초만 쓴다(PLAN §3.0 주인 확정). index.html 도 같은 값(게이트가 대조). */
const STUN_BOSS_MUL=1/3;
/* ⚑ 주인 확정(2026-09-03 · PLAN §3.0) — 소환 데미지는 고정 상수다. 튜닝으로 계수를 바꾸지 말 것
   (밸런스는 발동 확률 10% 단위·발수로만). 창·검기는 일직선 관통형이라 관통 마릿수도 여기서 못 박는다.
   ⚑⚑⚑ T118 (주인 확정 2026-09-04 12:4X «화살 → 공격력 30%, 도끼 → 공격력 50% 로 일단 바꾸셈»)
   — 화살 0.50 → 0.30 · 도끼 0.30 → 0.50 으로 **맞교환**. 검기·번개·창은 그대로. */
const R_AXE=0.50, R_ARROW=0.30, R_WAVE=0.50, R_BOLT=0.75, R_SPEAR=1.00;
const WAVE_PIERCE=2, WAVE_PIERCE_BIG=8, SPEAR_PIERCE=8;
/* ⚑⚑⚑ T163 (주인 확정 2026-09-05 22:1X «적들 간격이 더 좁아야 함. 지금의 절반으로») —
   웨이브 안 적 배치 간격 **88 → 44 (월드 px)**. 리터럴 88 을 쓰던 자리를 전부 이 상수로 묶는다.
   이건 **월드 단위**라 index.html 의 카메라 배율(그리기만 1.5배)과 별개다 — 화면에서는 66px 로 보인다.
   일직선 관통형(창·검기)의 사거리는 «간격 × 관통 마릿수» 로 묶어 **닿는 적 수가 그대로**이게 한다
   (창 8칸 · 큰 검기 8칸 · 검기 4칸(관통 2 라 여유 · 종전 340 = 3.86칸) · 검기왕 16칸(종전 1400 = 15.9칸)).
   index.html 도 같은 이름·같은 값(게이트가 두 파일을 대조한다). */
const ENEMY_GAP=44;
const SPEAR_REACH=ENEMY_GAP*SPEAR_PIERCE, WAVE_REACH=ENEMY_GAP*4, WAVE_REACH_KING=ENEMY_GAP*16;
/* ⚑⚑⚑ T155 ② (주인 확정 2026-09-05 18:5X) — 특전 카드·인포·툴팁·장비 옵션 문구에서 창·도끼·화살·번개·검기가
   나오면 괄호로 «(공격력의 N%)» 를 붙인다. N 은 **위 R_* 상수에서 읽는다** — 문구에 숫자를 적어 두지 않으므로
   T118 처럼 계수가 바뀌면 문구가 저절로 따라온다. 창은 관통 마릿수(SPEAR_PIERCE)도 같이 적는다.
   문구 하나에 소환이 둘이면(«모든 화살이 창으로 바뀐다» = 창의 화신) **결과가 되는 뒤쪽 하나**만 적는다:
   «(창 · 공격력의 100%)». 두 엔진 같은 이름·같은 결과(게이트가 두 엔진 문구를 대조한다). */
const SUMMON_R=[['도끼',R_AXE],['화살',R_ARROW],['번개',R_BOLT],['검기',R_WAVE],['창',R_SPEAR]];
function summonNote(d){
  const hit=SUMMON_R.filter(w=>d.indexOf(w[0])>=0);
  if(!hit.length)return d;
  const pct=r=>Math.round(r*100)+'%';
  if(hit.length>1){                                   /* 창의 화신 — 문구에서 더 뒤에 나오는 쪽이 결과다 */
    const w=hit.reduce((a,b)=>d.lastIndexOf(a[0])>d.lastIndexOf(b[0])?a:b);
    return d+' ('+w[0]+' · 공격력의 '+pct(w[1])+')';
  }
  return d+' (공격력의 '+pct(hit[0][1])+(hit[0][0]==='창'?' · '+SPEAR_PIERCE+'마리 관통':'')+')';
}
/* 특전 배열·장비 옵션표를 **제자리에서** 훑어 소환 문구에 데미지 표기를 붙인다(키 이름은 엔진마다 d/tx). */
function withSummonDmg(tbl,key){
  const list=Array.isArray(tbl)?tbl:Object.keys(tbl).reduce((a,k)=>a.concat(tbl[k]),[]);
  for(const o of list) if(o&&typeof o[key]==='string') o[key]=summonNote(o[key]);
  return tbl;
}
/* ⚑ T96 — 주기 소환·공속 램프·오버킬 회복·반격 연쇄·등급 확률 상수는 특전 132종과 함께 폐지됐다
   (새 10종에는 주기형 소환도 등급도 없다). 장비 옵션이 쓰는 `autoBolt`(3초 주기)만 남는다. */
/* ⚑ 주인 확정 — 방어막(ward)은 장수 상한이 없다(무한). 수치형 실드와 별개 축으로, 실드는 데미지를
   «흡수» 하고 방어막은 타격 «1회» 를 통째로 무효화한다. 한 장이 소모되는 순간 «방어막 방어» 트리거
   (🛡️❤️ 회복 · 🛡️💥 반사 · 🥅 창)가 굴러간다. */
function chapterLayout(c){
  /* ⚑⚑⚑ T107 (주인 확정 2026-09-03 17:3X) — 챕터별 적 수 곡선 위의 고정 구성. 제비뽑기는 «순서» 에만 남는다:
       웨이브 5개(크기는 `chapterWaveSizes(c)`) · 보스 1 → 적 **N(c)마리**(상한 LAYOUT_MAXENEMY 50)
       쉼터 2 (고정) · 악마 1 · 천사 1  — 이 넷은 전 챕터 동일이고 «순서» 만 챕터 시드로 섞인다.
     ⚑ 특전은 «그 챕터의 경험치가 주는 만큼» 이다(주인 «특전은 걍 되는 만큼으로 하셈»). 처치 3 · 보스 9 ·
       쉼터 26×2 · `expNeed = 5·Lv+1` 은 전부 불변이고, T100 의 «완주 = 정확히 10개» 항등식만 사라졌다:
         공급(보스 전) = (N−1)×3 + 52 → 챕터 1~5 = 100(특전 6) · 15 = 130(7) · 28 = 169(8) · 38+ = 199(9)
       레벨업마다 표 순서대로 한 장, 악마는 다음 순번을 앞당기고, 보스 처치 레벨업은 특전을 주지 않는다.
     ⚑ 적 «수» 는 난이도 노브가 아니다 — 난이도는 적 스탯(구간 성장률·벽 배수)으로만 만든다.
     게이트 `tools/verifyChapterFixed.js` 가 챕터 전수로 곡선·구성·특전 개수를 실측한다. */
  const rnd=mulberry(c*1013904223+77);
  const waveCount=LAYOUT_WAVES, sizes=chapterWaveSizes(c);
  const evs=['devil','angel'];                                  /* 악마 1 · 천사 1 */
  for(let i=0;i<LAYOUT_RESTS;i++) evs.push('rest');             /* 쉼터 2 고정 */
  for(let i=evs.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); const t=evs[i]; evs[i]=evs[j]; evs[j]=t; }
  const out=[];
  /* 웨이브 5 · 이벤트 4 — «웨이브 뒤 이벤트» 를 이벤트가 떨어질 때까지 반복하면 웨이브가 하나 남고,
     그 마지막 웨이브가 보스 직전에 붙는다(웨이브가 처음과 끝을 모두 차지한다). */
  for(let i=0;i<waveCount;i++){ out.push({t:'wave',size:sizes[i]}); if(i<evs.length) out.push({t:evs[i]}); }
  out.push({t:'boss'});
  /* ⚑⚑⚑ T105 (자리 고정) + ⚑⚑⚑ T114 (마릿수 곡선) — «같은 챕터 = 같은 원거리 자리·같은 마릿수».
     ① 마릿수를 먼저 정하고(`chapterRangedCount`) ② 그만큼을 굴림 대상에서 챕터 시드로 뽑는다.
     ⚑ 스트림 소비 순서를 지킬 것 — **이벤트 셔플이 끝난 뒤에** 굴린다. 그래야 챕터마다 이미 정해져 있는
       쉼터·악마·천사 순서가 한 챕터도 안 바뀐다(verifyT2 레이아웃 전수 대조가 그 불변을 지킨다).
     ⚑ 흔들림 j 는 램프 구간에서도 «항상 한 번» 소비한다 — 챕터마다 소비 수가 달라지면 자리 추첨이 밀린다.
     ⚑ 굴림 대상은 «웨이브 첫 마리를 뺀 일반 적» 이고 보스는 원거리가 아니다. */
  for(const nd of out) if(nd.t==='wave') nd.ranged=new Array(nd.size).fill(false);
  const jit=Math.floor(rnd()*(2*RANGED_CURVE.jitter+1))-RANGED_CURVE.jitter;
  const want=chapterRangedCount(c,jit);
  const pool=[];
  out.forEach((nd,i)=>{ if(nd.t==='wave') for(let j=1;j<nd.size;j++) pool.push([i,j]); });
  for(let i=pool.length-1;i>0;i--){ const k=Math.floor(rnd()*(i+1)); const t=pool[i]; pool[i]=pool[k]; pool[k]=t; }
  for(let q=0;q<want&&q<pool.length;q++){ const[i,j]=pool[q]; out[i].ranged[j]=true; }
  return out;
}
/* ⚑ T35: 구간별 성장률 누적 배수. 챕터 1 을 1.0 으로 두고 1→c 까지 각 스텝의 구간 배수를 곱한다.
   결과는 메모이즈한다 (실험3/4 가 챕터 300 까지 수만 번 호출한다). */
function segRate(seg,c){ let r=seg[0][1]; for(const s of seg){ if(c>=s[0]) r=s[1]; } return r; }
function segGrow(seg,cache,c){
  if(cache[c]!==undefined) return cache[c];
  let v=1; for(let k=1;k<c;k++) v*=segRate(seg,k);
  cache[c]=v; return v;
}
const _hpGrow={}, _dmgGrow={};
function enemyStats(c,w){
  let hp=TUNE.eBaseHp*segGrow(TUNE.eHpSeg,_hpGrow,c)*(1+TUNE.waveHp*w);
  let dmg=TUNE.eBaseDmg*segGrow(TUNE.eDmgSeg,_dmgGrow,c)*(1+TUNE.waveDmg*w);
  if(c>=10){hp*=TUNE.wallHp; dmg*=TUNE.wallDmg;}
  if(c>=15){hp*=TUNE.wall2Hp; dmg*=TUNE.wall2Dmg;}
  if(c>=90){hp*=TUNE.wall3Hp; dmg*=TUNE.wall3Dmg;}     /* 90 대형 벽 (PLAN §11.7) */
  if(c>=TUNE.wall4At){hp*=TUNE.wall4Hp; dmg*=TUNE.wall4Dmg;}  /* ⚑ T103 — 최종 벽 위치 420 (PLAN §11.7). 배수는 ×1.0 = 꺼짐. 리터럴 대신 `wall4At` 하나를 두 엔진이 같이 본다 */
  return {hp:Math.round(hp), dmg:Math.round(dmg)};
}

/* ---------- 특전 = 고정 10종 · 순서 획득 (⚑⚑⚑ 주인 확정 2026-09-03 · PLAN §3) ----------
   **132종 체제(등급·선택창·새로고침·전지의 눈)는 통째로 폐지됐다.** 레벨업할 때마다 아래 순서대로
   하나씩 자동으로 얻고, 10개를 다 얻은 뒤의 레벨업은 특전을 주지 않는다(위임 기본값).
   px 키 = 특전 id. 장비 계열 옵션(GOPT §11.6)이 쓰는 짧은 키(axe·wave·firstHit …)는 별도 네임스페이스로
   그대로 살아 있다 — 이번 전환에서 장비·스탯·경제는 한 줄도 안 바뀐다(주인 지시 ④).
   ⚑⚑⚑ T104 (주인 확정 2026-09-03) — 획득 순서 재정렬 + 1번 특전 효과 교체.
     ① 1번 특전이 «생명 흡수(준 피해 10% 회복)» → «회피 시 회복(10% 확률로 최대 체력 6% 회복)» 으로 바뀌었다.
        엔진의 `steal` 스탯은 남지만 특전이 더는 안 쓴다(게이트 «흡혈» 단언은 이 특전 기준으로 갈아끼웠다).
     ② 나머지 9종의 «효과·수치» 는 한 글자도 안 바뀐다 — 순서만 아래처럼 바뀐다.
   수치 해석(주인 위임 기본값 ⑦):
     · 회피 시 회복 = **회피 성공마다 굴려서**(⚑ T155 로 일반 33% · 최대 체력 12%) 회복(초과분 버림 · 실드 안 채움 · 트리거는
       «내가 적 공격을 회피한 순간» = 4번 «회피 시 화살» 과 같은 자리 · 4번보다 앞서 굴린다)
     · 확률형(회피·반격·치확)은 **+10** (기본 20 → 30) · 치명타 피해는 **+50** (기본 150 → 200)
     · 공격력 +20% · 방어력 +10% 는 **기본치에 곱연산**이고 장비 합산 «뒤» 에 걸린다
       (`mkPlayer` 가 장비 옵션을 먼저 다 적용한 뒤 특전이 붙으므로 획득 시점 곱이 곧 «장비 합산 뒤» 다)
     · 3·4·5 소환은 기존 엔진 그대로 1개 = 1발, 쿨다운 없음
   ⚑ 소환 연쇄 임계 B: 세 소환이 전부 «피격/회피/반격» 축이라 **소환 적중이 새 소환을 낳지 않는다** → B = 0.
   금지축(경제·이속·최대실드 증가·적중률·부활·분신·주기형 회복)은 그대로다.
   ⚑⚑⚑ T121 — «최대체력 증가» 는 금지축에서 빠졌다(주인 확정 16:0X · «수집가·체력»). 최대치만 오르고
   현재 체력은 그대로이며, 최대 «실드» 증가는 여전히 금지다.
   **적중률 금지는 유효**(흡혈 금지는 T96 에서 폐기됐고, T104 로 흡혈 축 자체가 특전에서 사라졌다). ---------- */
/* ⚑⚑⚑ T121 (주인 확정 2026-09-04 16:2X·16:3X) — 기존 일반 4종 하향. 사다리 «기준 플레이어» 의 특전이라
   기준 자체가 약해지지만 **적 스탯 재적합은 없다**(T120 ④ 상시 규칙 — 주인이 «맞춰라» 라고 할 때만).
   ⚑ 9번 치피는 T121 ② 로 +50 → +30. index.html 과 같은 이름·같은 값. */
/* ⚑⚑⚑ T155 (주인 확정 2026-09-05 18:5X · 19:1X 정정 «그거를 밸런스 조절한 건데») — «회피 시 회복» 3종 **교체**:
   일반 8%·6% → **33%·12%**(`PERK_EVHEAL_CH`·`PERK_EVHEAL_F`) · 희귀 II 15%·6% → **66%·12%**(`PERK_EVHEAL_R`) ·
   전설 III **100%·12%**(`PERK_EVHEAL_L` 신설). 회복량은 셋이 같은 `PERK_EVHEAL_F` 한 축을 쓴다.
   ⚑ 18:1X·18:2X 주인 재정정 — 1번 «회피 시 회복» 10 → 8% · 10번 «방어력 증가» +10 → +8% (T155 로 8 → 33).
   ⚑ 17:5X — `PERK_SUMMON_CH`(단일 100%)는 이제 «반격 시 창» 하나만 쓴다(주인 언급 없어 100% 유지).
   회피 시 화살·피격 시 도끼는 특전별 확률(PERK_SUMMON_N/R/L)로 쪼개졌다. */
const PERK_ATK_M=1.15, PERK_DEF_M=1.08, PERK_EVADE_A=8, PERK_COUNTER_A=8,
      PERK_CRITR_A=8, PERK_CRITF_A=30, PERK_EVHEAL_CH=0.33, PERK_EVHEAL_F=0.12, PERK_SUMMON_CH=1.00;
/* ⚑⚑⚑ T119 신규 상수 (주인 확정 2026-09-04 13:0X) — 신규 22종이 쓰는 수치. index.html 과 같은 이름·같은 값.
   처치 시 소환 확률 33/66/100 은 주인이 직접 정한 값이라 «10% 단위(5% 예외)» 규칙에서 제외된다
   (`verifyNumClean` 에 주인 확정으로 등재). 가시갑옷 배율은 «100% = 1배» (주인 정의). */
const PERK_KILL_N=0.33, PERK_KILL_R=0.66, PERK_KILL_L=1.00,
      PERK_THORN_N=1.00, PERK_THORN_R=2.00, PERK_THORN_L=3.00,
      PERK_AMP=1.00, PERK_FULLHP_A=1.00, PERK_BERSERK_M=3.00;
/* ⚑⚑⚑ T121 신규 상수 (주인 확정 2026-09-04 16:0X · 16:2X 보강) — 신규 34종이 쓰는 수치.
   index.html 과 같은 이름·같은 값. 주인이 직접 적은 값이라 «10% 단위(5% 예외)» 규칙 밖이다
   (`verifyNumClean` 에 주인 확정으로 등재). */
const PERK_KILLEV_A=40, PERK_KILLEV_T=2,                       /* 처치 시 회피 버프 — +40 · 2초 · 갱신형(중첩 아님) */
      PERK_COLL_ATK=0.04, PERK_COLL_CRIT=2, PERK_COLL_HP=0.07, /* 수집가 3종 — 보유 특전 1개당(자기 포함) */
      PERK_KSTACK_CH=0.33, PERK_KSTACK_ATK=0.01, PERK_KSTACK_EV=1,  /* 처치 시 스택 2종 — 이 판 동안 무한 누적 */
      PERK_KHEAL_CH=0.33, PERK_KHEAL_F=0.06,                   /* 처치 시 회복 — 33% · 최대 체력 6% */
      PERK_KREPAIR_CH=0.66, PERK_KREPAIR_F=0.06,               /* 처치 시 수리(희귀) — 66% · 최대 실드 6% */
      PERK_CSTACK_A=1,                                         /* 치명 스택 — 평타 적중마다 +1 · 치명타 시 0 */
      PERK_ASPDATK_A=0.07, PERK_ASPDATK_T=7,                   /* 공격 시 공속 +7% 7초 (중첩) */
      PERK_EXEC_N=0.05, PERK_EXEC_R=0.10, PERK_EXEC_L=0.15,    /* 회피 시 즉사 I/II/III — 각각 따로 굴린다 */
      PERK_STUNC_N=0.10, PERK_STUNC_R=0.20, PERK_STUNC_L=0.30, PERK_STUNC_T=3,  /* 치명타 시 스턴 I/II/III */
      PERK_NHEAL_F=0.06,                                       /* 5타 회복 — 최대 체력 6% (⚑ 18:0X 재정정) */
      PERK_CRITF_R=60, PERK_CRITR_R=16, PERK_COUNTER_R=16, PERK_EVADE_R=16, PERK_ATK_R=1.30,  /* 희귀 «II» 5종 */
      PERK_GIANT_M=3.00, PERK_GIANT_ASPD=2/3;                  /* 거인의 힘 — 공 ×3 · 공속 ×2/3 (둘 다 곱연산) */
/* ⚑⚑⚑ T121 2차 추가 상수 (주인 확정 16:5X · 17:0X · 17:2X · 17:4X) — 신규 11종이 쓰는 수치. */
const PERK_EVSTUN_CH=0.30,                                       /* 회피 시 스턴 — 30% · 3초(PERK_STUNC_T) */
      PERK_CTCRIT_N=20, PERK_CTCRIT_R=40,                        /* 반격 치명 I/II — 반격 타격에만 치확 가산 */
      PERK_CTDMG_N=1.30, PERK_CTDMG_R=1.60,                      /* 반격 강화 I/II — 반격 데미지 곱연산 */
      PERK_BSTK_M=2.00,                                          /* 버서커 — 스택 1 소모당 그 공격 ×2 (+100%) */
      DASH_MUL=5,                                                /* 처치 시 대시 — 이동 속도 배수(위임 기본값) */
      PERK_CLEAVE_N=0.33, PERK_CLEAVE_R=0.66, PERK_CLEAVE_L=1.00;/* 관통 베기 I/II/III — 셋 다 따로 굴린다 */
/* «N타마다» 주기 — 평타 횟수 기준(빗나감 포함 · 반격·소환 제외 · 특전마다 자기 카운터).
   ⚑ 17:3X 주인 정정 — 화살 3타 → **2타** · 도끼/번개/창/회복 4타 → **3타**. */
const PERK_NHIT_ARROW=2, PERK_NHIT_AXE=3, PERK_NHIT_BOLT=3, PERK_NHIT_SPEAR=3, PERK_NHIT_HEAL=5;
/* ⚑⚑⚑ T121 3차 추가 상수 (주인 확정 17:5X · 18:0X · 18:2X · 18:4X) — 신규 22종이 쓰는 수치.
   index.html 과 같은 이름·같은 값. 주인이 직접 적은 값이라 «10% 단위(5% 예외)» 규칙 밖이다
   (`verifyNumClean` 에 주인 확정으로 등재). */
const PERK_SUMMON_N=0.33, PERK_SUMMON_R=0.66, PERK_SUMMON_L=1.00, /* 회피 시 화살 · 피격 시 도끼 I/II/III */
      PERK_SUMMON_SP=0.33,                                       /* 회피 시 창 · 피격 시 창 (전설) */
      PERK_CRITSP_R=0.33, PERK_CRITSP_L=0.66, PERK_CRITBOLT_L=0.66, /* 치명 시 창(희귀 33 · 전설 66) · 치명 시 번개(전설 66) */
      PERK_EVHEAL_R=0.66, PERK_EVHEAL_L=1.00,                    /* 회피 시 회복 II/III — 66% · 100% · 최대 체력 12%(PERK_EVHEAL_F · ⚑ T155) */
      PERK_EVREP_R=0.15, PERK_EVREP_L=0.25, PERK_EVREP_F=0.06,    /* 회피 시 수리 I/II — 15/25% · 최대 실드 6% */
      PERK_DEF_R=1.16, PERK_DEF_L=1.24,                          /* 방어력 증가 II/III — 곱연산(상한 80 은 엔진 규칙) */
      PERK_IGN_N=0.20,                                           /* 피해 무시 — 피격 20% (회피·방어막 «뒤») */
      PERK_SHWALL_L=0.50, PERK_SHREF_L=0.50,                     /* 실드 방벽 · 실드 반사 — 실드 > 0 일 때 각 50% */
      PERK_NOSH_ATK=1.50, PERK_NOSH_ASPD=1.30,                   /* 실드 0 인 동안 공격력 +50% · 공속 +30% */
      PERK_WARD_N=0.10, PERK_WARD_R=0.20, PERK_WARD_L=0.30;      /* 피격 시 방어막 I/II/III — 스택형·장수 무제한 */
/* 등급 굴림 확률 — 일반 60 / 희귀 25 / 전설 15 (⚑ 13:2X 주인 정정 · 처음 50/30/20 폐기).
   «귀족의 눈» 은 여기서 일반을 빼고 재정규화한다(희귀 25/40 = 62.5% · 전설 15/40 = 37.5%). */
const PERK_GRADE_RATE=[60,25,15];
const PERK_GRADE_NAME=['일반','희귀','전설'];
/* 순서 고정 — 이 배열이 주인 표 1~10번이다. 게이트가 순서·수치를 대조한다.
   ⚑⚑⚑ T117 — 표 순서는 더 이상 «획득 순서» 가 아니라 ⓐ 카드 표시·문면의 정본 순서 ⓑ 시뮬 측정 정책의
   우선순위(제시 3장 중 이 표에서 앞선 것을 고른다)다. 실제 획득 순서는 3택 굴림과 유저 선택이 정한다.
   ⚑⚑⚑ T104 — 새 순서: 회피 시 회복 → 반격률 → 반격 시 창 → 회피 시 화살 → 피격 시 도끼 →
                          공격력 → 회피율 → 치확 → 치배 → 방어력 (주인 확정 2026-09-03). */
/* ⚑⚑⚑ T119 (주인 확정 2026-09-04 13:0X · 13:2X 정정) — 특전 풀 확장 + 등급 부활.
   기존 10종 = **일반** · 신규 22종(일반 5 · 희귀 8 · 전설 9) = **풀 32종**.
   `g` 0 = 일반 · 1 = 희귀 · 2 = 전설. 배열 순서 = 문면·카드의 정본 순서이자 **등급 안 시뮬 우선순위**다
   (시뮬 정책: 제시 3장 중 «등급 높은 것 우선 · 같은 등급이면 이 배열에서 앞선 것»).
   ⚑ 같은 이름·다른 등급의 «처치 시 X» 4계열은 **확률만 갱신(최댓값)** 한다 — 위임 기본값.
     주인이 33/66/100 을 «같은 효과의 등급별 확률» 로 적었으므로 상위 등급을 얻으면 그 효과가 세지는 것이고,
     따로 굴려 두 번 소환하지 않는다(가산을 원하시면 한 줄로 정정 — 그때는 소환 연쇄 B 가 크게 오른다).
     가시갑옷은 주인이 «가산 중첩(+100 +200 +300 = 최대 +600%)» 을 직접 못 박았으므로 그쪽만 가산이다. */
function mkPerks(){
  const kmax=(p,k,v)=>{ p.px[k]=Math.max(p.px[k]||0,v); };   /* 처치 시 소환 — 확률 최댓값 갱신 */
  return [
    /* ===== 일반 15종 (1~10 = 기존 10종 · 수치 불변) ===== */
    {id:'p_evadeHeal',g:0,nm:'회피 시 회복',      d:'회피 시 33% 확률로 최대 체력 12% 회복', ap:p=>p.px.p_evadeHeal=1},
    {id:'p_atk',     g:0,nm:'공격력 증가',        d:'공격력 +15%',                     ap:p=>{p.px.p_atk=1;p.dmg*=PERK_ATK_M;}},
    {id:'p_evade',   g:0,nm:'회피율 증가',        d:'회피율 +8',                       ap:p=>{p.px.p_evade=1;p.evade+=PERK_EVADE_A;}},
    {id:'p_arrowEv', g:0,nm:'회피 시 화살',       d:'회피 시 33% 확률로 화살 1개',      ap:p=>p.px.p_arrowEv=1},
    {id:'p_axeHit',  g:0,nm:'피격 시 도끼',       d:'피격 시 33% 확률로 도끼 1개',      ap:p=>p.px.p_axeHit=1},
    {id:'p_counter', g:0,nm:'반격률 증가',        d:'반격률 +8',                       ap:p=>{p.px.p_counter=1;p.counter+=PERK_COUNTER_A;}},
    {id:'p_spearCt', g:0,nm:'반격 시 창',         d:'반격 시 창 1개',                  ap:p=>p.px.p_spearCt=1},
    {id:'p_critR',   g:0,nm:'치명타 확률 증가',   d:'치명타 확률 +8',                  ap:p=>{p.px.p_critR=1;p.critR+=PERK_CRITR_A;}},
    {id:'p_critF',   g:0,nm:'치명타 피해 증가',   d:'치명타 피해 +30',                 ap:p=>{p.px.p_critF=1;p.critF+=PERK_CRITF_A;}},
    {id:'p_def',     g:0,nm:'방어력 증가',        d:'방어력 +8%',                      ap:p=>{p.px.p_def=1;p.def*=PERK_DEF_M;}},
    {id:'p_killSpearN',g:0,nm:'처치 시 창',       d:'처치 시 33% 확률로 창 1개',        ap:p=>{p.px.p_killSpearN=1;kmax(p,'p_killSpear',PERK_KILL_N);}},
    {id:'p_killBoltN', g:0,nm:'처치 시 번개',     d:'처치 시 33% 확률로 보이는 적 전부에게 번개 1회씩', ap:p=>{p.px.p_killBoltN=1;kmax(p,'p_killBolt',PERK_KILL_N);}},
    {id:'p_killArrowN',g:0,nm:'처치 시 화살',     d:'처치 시 33% 확률로 화살 3개',      ap:p=>{p.px.p_killArrowN=1;kmax(p,'p_killArrow',PERK_KILL_N);}},
    {id:'p_killAxeN',  g:0,nm:'처치 시 도끼',     d:'처치 시 33% 확률로 도끼 2개',      ap:p=>{p.px.p_killAxeN=1;kmax(p,'p_killAxe',PERK_KILL_N);}},
    {id:'p_thornsN',   g:0,nm:'가시갑옷',         d:'가시갑옷 +100%',                  ap:p=>{p.px.p_thornsN=1;p.px.p_thorns+=PERK_THORN_N;}},
    /* ===== ⚑⚑⚑ T121 신규 일반 15종 (주인 확정 16:0X ① · 마지막 «4타 회복» 은 16:2X ⑤) ===== */
    {id:'p_killEvBuff',g:0,nm:'처치 시 회피 버프',d:'처치 시 2초간 회피율 +40',        ap:p=>p.px.p_killEvBuff=1},
    {id:'p_collAtk',   g:0,nm:'수집가·공격',      d:'보유 특전 하나당 공격력 +4%',      ap:p=>p.px.p_collAtk=1},
    {id:'p_collCrit',  g:0,nm:'수집가·치명',      d:'보유 특전 하나당 치명타 확률 +2',  ap:p=>p.px.p_collCrit=1},
    {id:'p_killAtkStk',g:0,nm:'처치 시 공격력 스택',d:'처치 시 33% 확률로 공격력 +1%(이 판 동안 누적)', ap:p=>p.px.p_killAtkStk=1},
    {id:'p_killEvStk', g:0,nm:'처치 시 회피 스택',d:'처치 시 33% 확률로 회피율 +1(이 판 동안 누적)',  ap:p=>p.px.p_killEvStk=1},
    {id:'p_killHealN', g:0,nm:'처치 시 회복',     d:'처치 시 33% 확률로 최대 체력 6% 회복', ap:p=>p.px.p_killHealN=1},
    {id:'p_collHp',    g:0,nm:'수집가·체력',      d:'보유 특전 하나당 최대 체력 +7%',   ap:p=>p.px.p_collHp=1},
    {id:'p_critStack', g:0,nm:'치명 스택',        d:'평타 적중마다 치명타 확률 +1(치명타 시 초기화)', ap:p=>p.px.p_critStack=1},
    {id:'p_aspdAtk',   g:0,nm:'공격 시 공속 버프',d:'공격 시 공격속도 +7% 7초(중첩)',   ap:p=>p.px.p_aspdAtk=1},
    {id:'p_execEvN',   g:0,nm:'회피 시 즉사',     d:'회피 시 5% 확률로 그 적 즉사',     ap:p=>p.px.p_execEvN=1},
    {id:'p_stunCritN', g:0,nm:'치명타 시 스턴',   d:'치명타 시 10% 확률로 3초 스턴',    ap:p=>p.px.p_stunCritN=1},
    {id:'p_nArrowN',   g:0,nm:'2타 화살',         d:'2타마다 무작위 적에게 화살 1개',   ap:p=>p.px.p_nArrowN=1},
    {id:'p_nAxeN',     g:0,nm:'3타 도끼',         d:'3타마다 무작위 적에게 도끼 1개',   ap:p=>p.px.p_nAxeN=1},
    {id:'p_nBoltN',    g:0,nm:'3타 번개',         d:'3타마다 무작위 적에게 번개 1회',   ap:p=>p.px.p_nBoltN=1},
    {id:'p_nHealN',    g:0,nm:'5타 회복',         d:'5타마다 최대 체력 6% 회복',        ap:p=>p.px.p_nHealN=1},
    /* ===== ⚑⚑⚑ T121 2차 신규 일반 5종 (주인 확정 16:5X · 17:0X ×2 · 17:2X · 17:4X) ===== */
    {id:'p_evadeStun', g:0,nm:'회피 시 스턴',     d:'회피 시 30% 확률로 공격한 적 3초 스턴', ap:p=>p.px.p_evadeStun=1},
    {id:'p_ctCritN',   g:0,nm:'반격 치명',        d:'반격 시 치명타 확률 +20',          ap:p=>p.px.p_ctCritN=1},
    {id:'p_ctDmgN',    g:0,nm:'반격 강화',        d:'반격 데미지 +30%',                 ap:p=>p.px.p_ctDmgN=1},
    {id:'p_killSureCrit',g:0,nm:'처치 시 확정 치명',d:'처치 시 다음 공격은 반드시 치명타', ap:p=>p.px.p_killSureCrit=1},
    {id:'p_cleaveN',   g:0,nm:'관통 베기',        d:'공격 시 33% 확률로 바로 뒤 적도 같은 데미지', ap:p=>p.px.p_cleaveN=1},
    /* ===== ⚑⚑⚑ T121 3차 신규 일반 4종 (주인 확정 18:2X — 실드·방어막 축) ===== */
    {id:'p_ignoreN',   g:0,nm:'피해 무시',        d:'피격 시 20% 확률로 그 피격 데미지 무시', ap:p=>p.px.p_ignoreN=1},
    {id:'p_noShAtk',   g:0,nm:'실드 없을 때 공격력',d:'실드가 0 인 동안 공격력 +50%',    ap:p=>p.px.p_noShAtk=1},
    {id:'p_noShAspd',  g:0,nm:'실드 없을 때 공속', d:'실드가 0 인 동안 공격속도 +30%',   ap:p=>p.px.p_noShAspd=1},
    {id:'p_wardHitN',  g:0,nm:'피격 시 방어막',    d:'피격 시 10% 확률로 방어막 1장',     ap:p=>p.px.p_wardHitN=1},
    /* ===== 희귀 8종 ===== */
    {id:'p_fullHp',    g:1,nm:'풀피 적 강타',     d:'체력이 가득 찬 적 공격 시 데미지 +100%', ap:p=>p.px.p_fullHp=1},
    {id:'p_repairUp',  g:1,nm:'수리 증폭',        d:'실드 수리량 +100%',               ap:p=>{p.px.p_repairUp=1;p.repairAmp+=PERK_AMP;}},
    {id:'p_healUp',    g:1,nm:'회복 증폭',        d:'체력 회복량 +100%',               ap:p=>{p.px.p_healUp=1;p.healAmp+=PERK_AMP;}},
    {id:'p_thornsR',   g:1,nm:'가시갑옷',         d:'가시갑옷 +200%',                  ap:p=>{p.px.p_thornsR=1;p.px.p_thorns+=PERK_THORN_R;}},
    {id:'p_killSpearR',g:1,nm:'처치 시 창',       d:'처치 시 66% 확률로 창 1개',        ap:p=>{p.px.p_killSpearR=1;kmax(p,'p_killSpear',PERK_KILL_R);}},
    {id:'p_killBoltR', g:1,nm:'처치 시 번개',     d:'처치 시 66% 확률로 보이는 적 전부에게 번개 1회씩', ap:p=>{p.px.p_killBoltR=1;kmax(p,'p_killBolt',PERK_KILL_R);}},
    {id:'p_killArrowR',g:1,nm:'처치 시 화살',     d:'처치 시 66% 확률로 화살 3개',      ap:p=>{p.px.p_killArrowR=1;kmax(p,'p_killArrow',PERK_KILL_R);}},
    {id:'p_killAxeR',  g:1,nm:'처치 시 도끼',     d:'처치 시 66% 확률로 도끼 2개',      ap:p=>{p.px.p_killAxeR=1;kmax(p,'p_killAxe',PERK_KILL_R);}},
    /* ===== ⚑⚑⚑ T121 신규 희귀 12종 (앞 8종 = 16:0X ① · 뒤 4종 «II» = 16:2X ⑤) ===== */
    {id:'p_healRepair',g:1,nm:'회복 시 수리',     d:'체력 회복 시 같은 양만큼 실드 수리', ap:p=>p.px.p_healRepair=1},
    {id:'p_killRepair',g:1,nm:'처치 시 수리',     d:'처치 시 66% 확률로 최대 실드 6% 수리', ap:p=>p.px.p_killRepair=1},
    {id:'p_critFR',    g:1,nm:'치명타 피해 증가 II',d:'치명타 피해 +60',                ap:p=>{p.px.p_critFR=1;p.critF+=PERK_CRITF_R;}},
    {id:'p_execEvR',   g:1,nm:'회피 시 즉사 II',  d:'회피 시 10% 확률로 그 적 즉사',    ap:p=>p.px.p_execEvR=1},
    {id:'p_stunCritR', g:1,nm:'치명타 시 스턴 II',d:'치명타 시 20% 확률로 3초 스턴',    ap:p=>p.px.p_stunCritR=1},
    {id:'p_nArrowR',   g:1,nm:'2타 화살 II',      d:'2타마다 무작위 적에게 화살 2개',   ap:p=>p.px.p_nArrowR=1},
    {id:'p_nAxeR',     g:1,nm:'3타 도끼 II',      d:'3타마다 무작위 적에게 도끼 2개',   ap:p=>p.px.p_nAxeR=1},
    {id:'p_nBoltR',    g:1,nm:'3타 번개 II',      d:'3타마다 무작위 적에게 번개 2회',   ap:p=>p.px.p_nBoltR=1},
    {id:'p_critRR',    g:1,nm:'치명타 확률 증가 II',d:'치명타 확률 +16',                ap:p=>{p.px.p_critRR=1;p.critR+=PERK_CRITR_R;}},
    {id:'p_counterR',  g:1,nm:'반격률 증가 II',   d:'반격률 +16',                       ap:p=>{p.px.p_counterR=1;p.counter+=PERK_COUNTER_R;}},
    {id:'p_atkR',      g:1,nm:'공격력 증가 II',   d:'공격력 +30%',                      ap:p=>{p.px.p_atkR=1;p.dmg*=PERK_ATK_R;}},
    {id:'p_evadeR',    g:1,nm:'회피율 증가 II',   d:'회피율 +16',                       ap:p=>{p.px.p_evadeR=1;p.evade+=PERK_EVADE_R;}},
    /* ===== ⚑⚑⚑ T121 2차 신규 희귀 5종 (주인 확정 17:0X ×4 · 17:4X) ===== */
    {id:'p_killDash',  g:1,nm:'처치 시 대시',     d:'처치 시 같은 웨이브의 다음 적까지 대시', ap:p=>p.px.p_killDash=1},
    {id:'p_berserkStk',g:1,nm:'버서커',           d:'처치 시 스택 1 · 평타마다 1 소모하고 그 공격 +100%', ap:p=>p.px.p_berserkStk=1},
    {id:'p_ctCritR',   g:1,nm:'반격 치명 II',     d:'반격 시 치명타 확률 +40',          ap:p=>p.px.p_ctCritR=1},
    {id:'p_ctDmgR',    g:1,nm:'반격 강화 II',     d:'반격 데미지 +60%',                 ap:p=>p.px.p_ctDmgR=1},
    {id:'p_cleaveR',   g:1,nm:'관통 베기 II',     d:'공격 시 66% 확률로 바로 뒤 적도 같은 데미지', ap:p=>p.px.p_cleaveR=1},
    /* ===== ⚑⚑⚑ T121 3차 신규 희귀 7종 (주인 확정 17:5X · 18:0X · 18:2X · 18:4X) ===== */
    {id:'p_arrowEvR',  g:1,nm:'회피 시 화살 II',   d:'회피 시 66% 확률로 화살 1개',      ap:p=>p.px.p_arrowEvR=1},
    {id:'p_axeHitR',   g:1,nm:'피격 시 도끼 II',   d:'피격 시 66% 확률로 도끼 1개',      ap:p=>p.px.p_axeHitR=1},
    {id:'p_evHealR',   g:1,nm:'회피 시 회복 II',   d:'회피 시 66% 확률로 최대 체력 12% 회복', ap:p=>p.px.p_evHealR=1},
    {id:'p_evRepairR', g:1,nm:'회피 시 수리',      d:'회피 시 15% 확률로 최대 실드 6% 수리', ap:p=>p.px.p_evRepairR=1},
    {id:'p_defR',      g:1,nm:'방어력 증가 II',    d:'방어력 +16%',                      ap:p=>{p.px.p_defR=1;p.def*=PERK_DEF_R;}},
    {id:'p_wardHitR',  g:1,nm:'피격 시 방어막 II', d:'피격 시 20% 확률로 방어막 1장',     ap:p=>p.px.p_wardHitR=1},
    {id:'p_critSpearR',g:1,nm:'치명 시 창',        d:'치명타 시 33% 확률로 창 1개',       ap:p=>p.px.p_critSpearR=1},
    /* ===== 전설 9종 ===== */
    {id:'p_killSpearL',g:2,nm:'처치 시 창',       d:'처치 시 창 1개',                  ap:p=>{p.px.p_killSpearL=1;kmax(p,'p_killSpear',PERK_KILL_L);}},
    {id:'p_killBoltL', g:2,nm:'처치 시 번개',     d:'처치 시 보이는 적 전부에게 번개 1회씩', ap:p=>{p.px.p_killBoltL=1;kmax(p,'p_killBolt',PERK_KILL_L);}},
    {id:'p_overkill',  g:2,nm:'오버킬 회복',      d:'처치 시 남은 데미지만큼 체력 회복', ap:p=>p.px.p_overkill=1},
    {id:'p_killArrowL',g:2,nm:'처치 시 화살',     d:'처치 시 화살 3개',                ap:p=>{p.px.p_killArrowL=1;kmax(p,'p_killArrow',PERK_KILL_L);}},
    {id:'p_killAxeL',  g:2,nm:'처치 시 도끼',     d:'처치 시 도끼 2개',                ap:p=>{p.px.p_killAxeL=1;kmax(p,'p_killAxe',PERK_KILL_L);}},
    {id:'p_berserk',   g:2,nm:'광전사',           d:'공격력 300% 가 되는 대신 치명타 확률 0%', ap:p=>{p.px.p_berserk=1;p.dmg*=PERK_BERSERK_M;}},
    {id:'p_nobleEye',  g:2,nm:'귀족의 눈',        d:'다음 특전부터 최소 희귀 이상만 나온다', ap:p=>p.px.p_nobleEye=1},
    {id:'p_spearAvatar',g:2,nm:'창의 화신',       d:'내가 쏘는 모든 화살이 창으로 바뀐다', ap:p=>p.px.p_spearAvatar=1},
    {id:'p_thornsL',   g:2,nm:'가시갑옷',         d:'가시갑옷 +300%',                  ap:p=>{p.px.p_thornsL=1;p.px.p_thorns+=PERK_THORN_L;}},
    /* ===== ⚑⚑⚑ T121 신규 전설 7종 (주인 확정 16:0X ①) ===== */
    {id:'p_giant',     g:2,nm:'거인의 힘',        d:'공격력 +200% 대신 공격속도 2/3',  ap:p=>{p.px.p_giant=1;p.dmg*=PERK_GIANT_M;p.aspd*=PERK_GIANT_ASPD;}},
    {id:'p_execEvL',   g:2,nm:'회피 시 즉사 III', d:'회피 시 15% 확률로 그 적 즉사',   ap:p=>p.px.p_execEvL=1},
    {id:'p_stunCritL', g:2,nm:'치명타 시 스턴 III',d:'치명타 시 30% 확률로 3초 스턴',  ap:p=>p.px.p_stunCritL=1},
    {id:'p_nArrowL',   g:2,nm:'2타 화살 III',     d:'2타마다 무작위 적에게 화살 3개',  ap:p=>p.px.p_nArrowL=1},
    {id:'p_nAxeL',     g:2,nm:'3타 도끼 III',     d:'3타마다 무작위 적에게 도끼 3개',  ap:p=>p.px.p_nAxeL=1},
    {id:'p_nBoltL',    g:2,nm:'3타 번개 III',     d:'3타마다 무작위 적에게 번개 3회',  ap:p=>p.px.p_nBoltL=1},
    {id:'p_nSpearL',   g:2,nm:'3타 창',           d:'3타마다 창 1개',                  ap:p=>p.px.p_nSpearL=1},
    /* ===== ⚑⚑⚑ T121 2차 신규 전설 1종 (주인 확정 17:4X) ===== */
    {id:'p_cleaveL',   g:2,nm:'관통 베기 III',    d:'공격 시 바로 뒤 적도 같은 데미지', ap:p=>p.px.p_cleaveL=1},
    /* ===== ⚑⚑⚑ T121 3차 신규 전설 11종 (주인 확정 17:5X · 18:0X · 18:2X) ===== */
    {id:'p_critSpearL',g:2,nm:'치명 시 창',       d:'치명타 시 66% 확률로 창 1개',       ap:p=>p.px.p_critSpearL=1},
    {id:'p_critBoltL', g:2,nm:'치명 시 번개',      d:'치명타 시 66% 확률로 보이는 적 전부에게 번개 1회씩', ap:p=>p.px.p_critBoltL=1},
    {id:'p_arrowEvL',  g:2,nm:'회피 시 화살 III',  d:'회피 시 화살 1개',                 ap:p=>p.px.p_arrowEvL=1},
    {id:'p_axeHitL',   g:2,nm:'피격 시 도끼 III',  d:'피격 시 도끼 1개',                 ap:p=>p.px.p_axeHitL=1},
    {id:'p_spearEvL',  g:2,nm:'회피 시 창',        d:'회피 시 33% 확률로 창 1개',        ap:p=>p.px.p_spearEvL=1},
    {id:'p_spearHitL', g:2,nm:'피격 시 창',        d:'피격 시 33% 확률로 창 1개',        ap:p=>p.px.p_spearHitL=1},
    {id:'p_evRepairL', g:2,nm:'회피 시 수리 II',   d:'회피 시 25% 확률로 최대 실드 6% 수리', ap:p=>p.px.p_evRepairL=1},
    {id:'p_defL',      g:2,nm:'방어력 증가 III',   d:'방어력 +24%',                      ap:p=>{p.px.p_defL=1;p.def*=PERK_DEF_L;}},
    {id:'p_shWallL',   g:2,nm:'실드 방벽',         d:'실드가 있으면 피격 시 50% 확률로 데미지 무시', ap:p=>p.px.p_shWallL=1},
    {id:'p_shRefL',    g:2,nm:'실드 반사',         d:'실드가 있으면 피격 시 50% 확률로 그 데미지를 반사', ap:p=>p.px.p_shRefL=1},
    {id:'p_wardHitL',  g:2,nm:'피격 시 방어막 III',d:'피격 시 30% 확률로 방어막 1장',     ap:p=>p.px.p_wardHitL=1},
    /* ===== ⚑⚑⚑ T155 신규 전설 1종 (주인 확정 2026-09-05 18:5X · 19:1X 정정) =====
       «회피 시 회복» 축의 세 번째. I(일반 33%)·II(희귀 66%)와 **별개 특전**이라 같이 얻으면 각각 굴린다. */
    {id:'p_evHealL',   g:2,nm:'회피 시 회복 III',  d:'회피 시 최대 체력 12% 회복',        ap:p=>p.px.p_evHealL=1},
  ];
}
const PERKS=mkPerks();
withSummonDmg(PERKS,'d');   /* ⚑ T155 ② — 소환 문구에 «(공격력의 N%)» (상수에서 생성 · 제자리) */
/* ⚑ 주인 방향(2026-09-03) — 한 런에서 얻는 특전 수를 «풀 크기» 와 분리한다.
   지금은 풀도 10, 획득도 10 이라 `PERK_PICKS === PERKS.length` 이고 동작은 한 글자도 안 바뀐다.
   나중에 풀을 30 종으로 늘려도 «한 런 = 10개» 면 파워 총량이 그대로라 T102·T103 난이도를 다시
   안 잡아도 된다. 그래서 «10개를 다 얻으면 그만» 판정은 이제 `PERKS.length` 가 아니라 이 상수를 본다.
   ⚑ T107 로 «챕터 레벨업 횟수 = 10» 전제는 폐기됐다 — 한 판에 실제로 얻는 수는 그 챕터의 경험치가
   정하고(1~5 = 6 · 15 = 7 · 28 = 8 · 38+ = 9), PERK_PICKS 는 그 위에 걸리는 **한 런 상한**이다.
   index.html 과 같은 이름·같은 값(게이트 verifyPerkOrder 가 두 엔진과 챕터 곡선을 대조한다). */
const PERK_PICKS=10;
/* ⚑⚑⚑ T117 (주인 확정 2026-09-04 12:3X) — 레벨업 특전이 «3개 중 1개 선택» 으로 돌아왔다.
   주인 원문: «이제 밸런스 다 맞췄으니까 특전 3개 중 하나 선택하는 거로 돌려줘».
   T96 이 폐지했던 것 중 **선택창만** 돌아온다 — 등급·등장 확률·무료 새로고침·전지의 눈은 그대로 폐지다.
   레벨업마다 «아직 안 얻은» 특전 중 최대 3장을 판 난수로 뽑아 보여주고 하나를 고른다.
   남은 것이 3개 미만이면 남은 만큼만, 0개면 팝업 없이 레벨업만 한다(주인 지시 ①).
   index.html 과 같은 이름·같은 값·같은 동사(게이트 verifyPerkOrder 가 두 엔진을 대조한다). */
const PERK_OFFER=3;
/* 제시 카드 3장 — «아직 안 얻은 것만 · 한 장 안에서 중복 없음». 뽑기는 **판 난수**(전투 스트림)라
   시드 하니스(SEED=…)에서는 결정적이다(챕터 시드가 아니다 — 주인 지시 ① 시뮬 측정 정책).
   ⚑⚑⚑ T151 (주인 확정 2026-09-05 17:5X) — **3장은 전부 같은 등급이다.** 주인 원문: «특전 뜰 때 3개 다
   일반 혹은 희귀 혹은 전설로만 떠야 함. 섞어 뜨지 말고». 그래서 등급은 레벨업마다 **딱 한 번**
   `PERK_GRADE_RATE`(60/25/15)로 굴리고, 그 등급의 «아직 안 얻은» 특전 중 3장을 뽑는다(중복 없음).
   **T119 의 «카드 3장 각각 등급 굴림» 은 이 지시로 폐기됐다.**
   그 등급에 3장이 안 남았으면 남은 만큼(1~2장)만 보여주고, 아예 0장이면 그 등급의 가중치가 0 이라
   **남은 등급들로 재정규화돼 다시 굴린다**(예: 전설이 다 떨어지면 60:25 → 70.6:29.4).
   «귀족의 눈»(p_nobleEye)을 얻었으면 일반을 빼고 굴린다(희귀 62.5 / 전설 37.5 재정규화 —
   가중치를 그대로 두고 일반만 빼면 자동으로 25:15 = 62.5:37.5 가 된다). 희귀·전설이 다 떨어지면
   일반으로 되돌아간다(재정규화가 «남은 등급» 만 보므로 구조적으로 그렇게 된다).
   `noble` 을 인자로 받는 이유: index.html 은 `G.player.px`, sim.js 는 `G.player.px` 로 경로가 달라
   동사 안에서 플레이어를 찾지 않고 «귀족의 눈을 켰나» 한 비트만 받는다(두 엔진 같은 본문). */
function offerPerks(taken,noble){
  /* 아직 안 얻은 것 전체 — 이게 비면 팝업 없이 레벨업만 한다(주인 지시 ①). */
  const cand=PERKS.filter(p=>taken.indexOf(p)<0);
  if(!cand.length)return [];
  /* ① 등급 **1회 굴림**. 비어 있는 등급은 가중치 0 이 되어 남은 등급으로 자동 재정규화된다.
     귀족의 눈이면 일반(0)을 뺀다 — 희귀·전설이 하나라도 남아 있을 때만. */
  const w=PERK_GRADE_RATE.map((r,g)=>(cand.some(p=>p.g===g)?r:0));
  if(noble&&(w[1]||w[2])) w[0]=0;
  const tot=w[0]+w[1]+w[2];
  let r=Math.random()*tot, g=0;
  for(g=0;g<3;g++){ if(r<w[g])break; r-=w[g]; }
  if(g>2||!w[g]){ g=2; while(g>0&&!w[g])g--; }   /* 부동소수 잔여로 흘러넘친 경우만 — 빈 등급으로 떨어지지 않게 */
  /* ② 그 등급의 남은 특전에서 3장(중복 없음 · 부족하면 남은 만큼). 3장 전부 등급 g 다. */
  const pool=cand.filter(p=>p.g===g), out=[];
  for(let i=0;i<PERK_OFFER&&pool.length;i++) out.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  return out;
}
/* ⚑⚑⚑ T150 (주인 확정 2026-09-05 17:4X) — **악마의 거래는 3택이 아니다.**
   주인 원문: «악마 거래는 전설 꺼 1개만 두고 hp 소모되면서 가져가는 거로 되야 되는데 3개 특전 주네».
   악마는 «아직 안 얻은 **전설** 특전 중 무작위 1개» 한 장만 내놓는다 — 고르는 것이 없으므로
   시뮬 정책(`simPickPerk`)도 필요 없고, 시뮬은 게임과 **같은 무작위 1장**을 받는다(판 난수 · 시드 결정적).
   남은 전설이 없으면 null → 거래 불성립(카드도 비용도 없다 — 종전 «줄 특전이 없으면 성립 안 함» 그대로).
   등급 굴림(PERK_GRADE_RATE)·귀족의 눈은 여기에 걸리지 않는다 — 악마 몫은 원래 전설 고정이다.
   index.html 과 같은 이름·같은 본문(게이트 verifyDevilPolicy·verifyPerkOrder 가 두 엔진을 대조한다). */
const PERK_DEVIL_GRADE=2;
function offerDevilPerk(taken){
  const pool=PERKS.filter(p=>p.g===PERK_DEVIL_GRADE&&taken.indexOf(p)<0);
  if(!pool.length)return null;
  return pool[Math.floor(Math.random()*pool.length)];
}
/* ⚑ 시뮬 측정 정책 (재현성 · 주인 지시 13:0X ②): 가상 플레이어는 제시 3장 중 하나를 결정적으로 고른다.
   ⚑⚑⚑ T151 (주인 확정 2026-09-05 17:5X ②) — 3장이 **전부 같은 등급**이 되면서 T119 정책의 첫 절
   («등급 높은 것 우선»)은 **의미가 없어졌다**(비교가 구조적으로 한 번도 갈리지 않는다). 남는 것은
   두 번째 절 **«§3.1 표 순서가 앞선 것»** 뿐이고, 그래서 비교식에서 등급 항을 걷어냈다.
   실제 게임(index.html)은 유저 자유 선택이므로 이 함수를 쓰지 않는다 — 측정 조건 통일용이다. */
function simPickPerk(offer){
  let b=offer[0];
  for(const p of offer) if(PERKS.indexOf(p)<PERKS.indexOf(b)) b=p;
  return b;
}
/* 획득 확정 한 곳 — 레벨업·악마가 같은 동사를 거친다(index.html pickPerk 와 1:1). */
function pickPerk(G,perk){ perk.ap(G.player); G.taken.push(perk); applyCollHp(G.player,G.taken.length); return perk; }
/* ⚑⚑⚑ T121 수집가 3종 (주인 확정 16:0X ①) — «보유 특전 하나당» 이라 **자기 자신을 포함해** 특전을 얻을
   때마다 세 값이 다시 커진다. 공격력·치확은 실효 스탯(`effDmg`·`effCritR`)에서 매번 세므로 소급이 공짜지만,
   최대 체력은 저장 스탯이라 획득 시점에 한 번씩 다시 건다 — 그래서 이 동사가 따로 있다.
   주인 명시 «10/100 → 10/107 (최대치만)» 대로 **현재 체력은 건드리지 않는다**(실드도 무관).
   `collHpF` = 지금 걸려 있는 배수. 새 배수로 갈아끼우는 방식이라 몇 번을 불러도 이중으로 곱해지지 않는다. */
function perkCountOf(p){ return p.G&&p.G.taken?p.G.taken.length:0; }
function applyCollHp(p,n){
  if(!p.px.p_collHp)return;
  const f=1+PERK_COLL_HP*n;
  p.maxHp=p.maxHp/(p.collHpF||1)*f;
  p.collHpF=f;
}

/* ⚑⚑⚑ T120 (주인 확정 2026-09-04 15:3X) — **밸런스 자(尺) 고정: «기준 플레이어» 모드**.
   주인 확정 ① 원문 요지: 사다리(⚑ T153 로 7점)는 «기존 일반 10종을 §3.1 옛 순서대로 «되는 만큼» 자동 획득 ·
   3택 없음 · 신규 22종·등급 없음» 조건으로 잰다 — T114 가 8/8 을 낸 바로 그 조건이다.
   3택과 희귀·전설 특전은 **기준 위에 얹히는 유저 보너스**라 사다리 측정에 들어오지 않는다.
   ⚠ 이것은 **자(尺)만 고정하는 것**이다 — 실제 게임 동작(index.html)은 T117·T119 의 3택·등급 그대로다.
   `runChapter(c,b,{perkMode:PERK_MODE_LADDER})` 로 켠다. 기본값은 종전대로 3택(`PERK_MODE_PLAY`).
   `PERKS_BASE10` 은 «기존 10종» = 풀 앞머리 10개이고, 그 배열 순서가 곧 옛 획득 순서다
   (회복 → 공격력 → 회피율 → 화살 → 도끼 → 반격률 → 창 → 치확 → 치피 → 방어력). */
const PERK_MODE_PLAY='3pick', PERK_MODE_LADDER='base10';
const PERKS_BASE10=PERKS.slice(0,10);
/* ⚑⚑⚑ T160 (주인 확정 2026-09-05 20:2X · 20:3X 정정) — 재적합 자(尺)의 나머지 두 스위치.
   주인 «기준은 전에 그 밸런스 맞추던 방식으로 — 특전 10개 고정에, 치명 확률 어쩌구 그 옵션 있는
   기본 옵션에, 장비들은 옵션 없다 치고». `perkMode:'base10'` 이 첫째고 아래 둘이 나머지다.

   ⚠ **둘 다 «재는 자» 전용이다 — 게임 동작(index.html)은 한 글자도 안 바뀐다.**
   ⓐ `baseStats:'legacy20'` — 기본 스탯 넷(치확·반격·방어·회피)을 **옛 값 20** 으로 쓴다.
      게임의 실제 기본치는 T123 대로 `TUNE.pCrit0/pCounter0/pDef0/pEvade0 = 0` 이고 그건 그대로 둔다
      (`verifyCombatConst` ① 이 계속 0 을 대조한다). 자만 옛 값을 쓰는 이유는 주인이 «전에 맞추던 방식»
      으로 재라고 했기 때문이다. 나머지 기본치(공 25 · 체 150 · 실 250 · 공속 1.0 · 치피 150)는
      지금 값이 곧 옛 값이라 스위치가 필요 없다.
   ⓑ `gearOpts:false` — 장비의 **세트 옵션(GOPT)** 을 통째로 끈다. 등급·강화·슬롯의 공/체/실 기여
      (`buildPower`)만 남는다. `g_*` 축이 0 으로 남으므로 뒤의 퍼센트 합산도 저절로 무효다. */
const LADDER_BASE20=20;   /* 옛 기본 스탯 — 치확·반격·방어·회피 (주인 «전에 했던 수치») */

/* ================= 장비 시스템 (PLAN §11) ================= */
/* ⚑⚑⚑ T124 (주인 확정 2026-09-04 · 19:2X) — 장비 계열 재설계.
   18계열(부위마다 서로 다른 계열)이 폐지되고 **세트 3개 × 부위 6개**가 됐다.
   종류 이름 = «세트명 + 부위명»(치명 무기 · 체력실드 투구 … 회피 목걸이)이라 종류 수는 18 그대로지만
   **옵션은 세트 안 6부위가 공유**한다(상위 등급이 하위 옵션을 포함하는 규칙은 그대로).
   옵션 개수: 일반1 · 희귀2 · 전설3 · 신화4, 신화는 +3/+6/+9 강에서 1개씩 추가(최대 7 — ⚑ T153).
   — 종전 «일반 0개» 가 아니라 **일반부터 1개**다(주인 확정). */
const GT={
  parts:['weapon','helm','armor','glove','boot','neck'],
  partName:{weapon:'무기',helm:'투구',armor:'갑옷',glove:'장갑',boot:'신발',neck:'목걸이'},
  /* 세트 순서 = [치명, 체력실드, 회피] — `mkBuild(...,typeIdx=0)` 이 쓰는 기준 장비가 치명 세트다(T124 ④). */
  sets:['crit','hpsh','evade'],
  setName:{crit:'치명',hpsh:'체력실드',evade:'회피'},
  types:{
    weapon:['crit_weapon','hpsh_weapon','evade_weapon'], helm:['crit_helm','hpsh_helm','evade_helm'],
    armor:['crit_armor','hpsh_armor','evade_armor'],     glove:['crit_glove','hpsh_glove','evade_glove'],
    boot:['crit_boot','hpsh_boot','evade_boot'],         neck:['crit_neck','hpsh_neck','evade_neck'],
  },
  typeName:{crit_weapon:'치명 무기',crit_helm:'치명 투구',crit_armor:'치명 갑옷',
    crit_glove:'치명 장갑',crit_boot:'치명 신발',crit_neck:'치명 목걸이',
    hpsh_weapon:'체력실드 무기',hpsh_helm:'체력실드 투구',hpsh_armor:'체력실드 갑옷',
    hpsh_glove:'체력실드 장갑',hpsh_boot:'체력실드 신발',hpsh_neck:'체력실드 목걸이',
    evade_weapon:'회피 무기',evade_helm:'회피 투구',evade_armor:'회피 갑옷',
    evade_glove:'회피 장갑',evade_boot:'회피 신발',evade_neck:'회피 목걸이'},
  /* ⚑⚑⚑ T153 (주인 확정 2026-09-05 18:1X) — **«영웅» 등급 폐지.** 주인 «영웅 등급은 빼기».
     등급 인덱스가 한 칸씩 당겨졌다: 0 일반 · 1 희귀 · **2 전설** · **3 신화** (종전 2 영웅 · 3 전설 · 4 신화).
     남는 네 등급의 기여값은 «현재 절대값 그대로»(주인 위임) — 영웅 행만 뺐다.
     그래서 희귀 → 전설이 ×2 가 아니라 **×4** 점프다(주인 «등급마다 ×2» 는 영웅이 빠진 그 자리만 어긋난다 — 등재만). */
  rarName:['일반','희귀','전설','신화'],
  /* ⚑⚑⚑ T102 (주인 확정 2026-09-03) — 등급별 1부위 기여 (0강·슬롯 0렙). 등급 배수 재설계본이다.
     주인 원문: «일반에서 전설까지는 공체실 각각 2배씩 뛰고, 전설→신화는 6배, 신화→신화9강은 20배».
     ⚑ T153 — 인덱스 = 일반0 · 희귀1 · **전설2** · **신화3** (영웅 행 삭제 · 남는 값은 그대로).
     실드는 체력 파생이 아니라 독립 기여축이다.
     값은 «(풀셋 총 스탯 − 기본치) ÷ 6» 을 그대로 옮긴 것이다 — 역산·재해석 금지.
     검산(기본치 공25/체150/실250 + 6부위): 일반 50/250/400 · 희귀 100/500/800 ·
     전설 400/2000/3200 · 신화 2400/12000/19200 (PLAN §11.5-a·§11.7 표와 일치).
     ⚠ 신화+9강은 «장비 기여만» ×20 이라 47525/237150/379250 이고, 주인 표의 48000/240000/384000 과
       기본치(25/150/250)의 19배만큼 어긋난다 — 강화는 장비에만 걸리고 기본치는 불변이라는 두 확정
       조항의 산술적 귀결이며, 오차는 각각 −0.99% / −1.19% / −1.24% 다. 되돌리려면 «기본치도 강화된다»
       를 주인이 확정해야 한다(PROGRESS T102 행에 근거 등재). */
  atk:[4.167, 12.500,  62.500,  395.833],
  hp: [16.667, 58.333, 308.333, 1975.000],
  sh: [25.000, 91.667, 491.667, 3158.333],
  /* ⚑⚑⚑ T102 — 강화 1레벨당 +211.11% (= 19/9). 0.13 으로는 +9강이 ×2.17 이라 주인의 «신화→신화9강 ×20»
     이 안 나온다. **선형을 유지하는 이유는 신화 무한 강화다** — 복리(1.4^강)로 하면 +20강이 836배로
     폭주하지만 선형이면 43배다. 2.1111111111111111 은 19/9 와 비트 단위로 같은 double 이고
     `1 + plusStep*9 === 20` 이 정확히 성립한다(게이트가 실측 단언한다). */
  plusStep:2.1111111111111111,   // 강화 1레벨당 해당 장비 공/체/실 +211.11% (= 19/9 · 주인 확정 — 종전 0.13)
  slotLvMax:150,                 // 슬롯 레벨 상한 (주인 확정)
  slotStep:0.01,                 // 슬롯 1레벨당 공/체/실 +1% (가산 — 종전 `slotG 2.68` 등비 폐기)
  slotCostBase:600, slotCostG:1.6,   // 슬롯 강화 비용 = base*costG^L (⚑ T1 R03: 3.5 → 2.6 → 1.6 — 비평가 B 실측. 정상상태 슬롯레벨 L ≈ c*ln(goldGrowth)/ln(slotCostG) 라 2.6 이면 상한 150 이 챕터 431 에서야 닿는다 = 사문. 1.6 이면 챕터 300 부근에서 닿는다)
  /* R07: 150/5.5 → 600/4.2. T6 의 «costG < goldGrowth^6» 규칙은 틀렸다 — 5.5 는 그 규칙을 지키고도 실험4 가
     챕터 118 에서 40일 정체했다. 올바른 조건은 «슬롯 1렙이 벌어주는 챕터 수(ln slotG/ln eHpG = 5.808챕터) 동안의
     골드 증가분 goldGrowth^5.808 ≥ costG», 즉 costG ≤ 1.22^5.808 = 3.174 다.
     R09: 4.2 → 3.5 (T13·T15). R07 이 «4.2 는 이를 만족» 이라 적은 것은 계산 착오였다 — 4.2 > 3.174 라 위반이고,
     매 챕터 3.4% 씩 적에게 뒤처져 실험3 이 챕터 120 부터 무너지고 실험4 가 챕터 212 에서 영구 정체했다.
     3.5 는 적대비 0.990 으로 적자가 1/3.5 로 줄어 챕터 300 완주가 된다(워커 A T13 3런 + R09 6런 = 9런 재현).
     3.3 이하는 폭주(91~300 전부 시도 1회), 3.8 이상은 열화 시점이 밀릴 뿐 곡선이 같다 — 유효 구간 3.4~3.6.
     ⚠ 대가: 챕터 90 도달 시 슬롯이 14~15렙(=앵커 A 스펙)에서 16렙으로 올라가 90 대형 벽이 무너진다(R09 6런 0/6).
        slotCostBase 로 되돌리려면 3000 이 필요한데 그 지점에서 챕터 10~18 이 400회 상한에 막힌다 — 승인 대기 14번. */
  evenStep:0.05, evenPer:5,      // 6슬롯 전부 5N렙 → 공/체/실 +5%*N (PLAN §11.4 — T35 로 실드에도 적용)
  pullCost:400, dailyGem:2500, iapGem:12000,   // 주인 확정 상수
  /* 뽑기 확률·천장·피티 — 주인 확정 상수 (PLAN §11.2, 노브 아님).
     T65 전까지 이 세 값이 «gachaPull 의 누적 임계 리터럴» 과 «상점 안내문 문자열» 에 각각 손으로
     베껴져 있었다 — T8·T9·T11·T12 가 네 번 반복한 «설명문↔엔진 불일치» 와 같은 모양이다.
     이제 굴림도 안내문도 이 표 하나만 본다. 순서 = 등급 인덱스(0 일반 · 1 희귀 · 2 전설 · 3 신화), 단위 %.
     ⚑⚑⚑ T153 (주인 확정 2026-09-05 18:1X) — **상자가 3종**이 됐다. 주인 원문:
     «신화 0.8퍼 전설 4퍼로 뜨게 해 그 뽑기 상자. 그리고 희귀 상자·전설 상자도 놔줘.
      희귀 상자는 1회 뽑기 80다이아, 희귀 33.3퍼 일반 66.6퍼. 전설 상자는 전설 4퍼 일반 66퍼 나머지는 희귀.»
     위임 기본값(주인이 다르면 한 줄로 정정 — ROUTINE ⑤): ⓐ 전설 상자 가격 **200**(80 과 400 사이 · 미지정)
     ⓑ 신화 상자의 «영웅 10%» 몫은 희귀 30 을 유지한 채 **일반이 나머지(65.2)** 를 먹는다 ⓒ 희귀 33.3 + 일반 66.7
     (주인 «66.6» 은 합 100 이 되게 66.7 로 읽는다) ⓓ 천장·피티는 상자마다 다르다 —
     희귀 상자 없음 · 전설 상자 전설 피티만 · 신화 상자 종전 그대로(50회 천장 + 10회 피티 · T125 겹침 포함). */
  boxes:{
    rare:  {key:'rare',  name:'희귀 상자', cost:80,  rate:[66.7,33.3,0,0],   pityM:0, pityL:0},
    legend:{key:'legend',name:'전설 상자', cost:200, rate:[66,30,4,0],       pityM:0, pityL:10},
    /* 신화 상자의 확률·가격·천장은 **아래 종전 상수 4개가 정본**이다 — 여기 두 번 적으면
       T65 가 없앤 «같은 수치를 손으로 두 번 옮기다 어긋남» 이 되살아난다. GT 리터럴 바로 뒤에서 채운다. */
    myth:  {key:'myth',  name:'신화 상자'},
  },
  gachaRate:[65.2,30,4,0.8],
  pityMyth:50,                   // 50회 천장 (누적 50회째 신화 확정) — 신화 상자
  pityLegend:10,                 // 10회 피티 (10회당 전설 이상 확정) — 신화·전설 상자
  /* ⚑⚑⚑ T161 (주인 확정 2026-09-05 20:5X «전설 3강이 되면 3강 대신 신화로 바뀌게 하는 게 맞는 듯») —
     10 → **3**. 근거: 전설 +3강 풀셋 공 2,775 가 신화 0강 2,400 을 넘어서므로 넘기 직전에 변환한다.
     이로써 전설의 최대 강화는 **+2**(풀셋 공 1,983 < 신화 0강 2,400)이고 승인 대기 43번의 제약
     «신화 0강 > 전설 최대강» 이 다시 성립한다(게이트 `verifyGearEcon` ①-b). */
  legendToMythPlus:3,            // 전설 +3강 도달 시 신화 0강으로 변환 (전설 최대 = +2)
  runsPerDay:30,                 // (위임) 하루 플레이 판수 — 실험3/4 의 다이아 적립 환산 기준
};
/* 스윕용 오버라이드 — 예: GT_OVERRIDE='{"slotG":1.6}' node sim.js 5 */
if(process.env.GT_OVERRIDE){
  const o=JSON.parse(process.env.GT_OVERRIDE);
  for(const k in o){ if(Array.isArray(o[k])||typeof o[k]!=='object'||!o[k]) GT[k]=o[k]; else Object.assign(GT[k],o[k]); }
}
/* ⚑ T35: GT.atk/hp/sh 는 위 확정표를 그대로 쓴다 (파생 생성 없음). 슬롯은 «1렙당 +1% 가산 · 상한 150». */
GT.slotMul=L=>1+GT.slotStep*Math.min(L,GT.slotLvMax);
GT.slotCost=L=>Math.floor(GT.slotCostBase*Math.pow(GT.slotCostG,L));
GT.allTypes=[]; for(const pt of GT.parts) for(const ty of GT.types[pt]) GT.allTypes.push({part:pt,type:ty});
/* ⚑⚑⚑ T153 — 등급 인덱스를 리터럴(3·4)로 흩지 않는다. 영웅이 빠져 한 칸씩 당겨진 자리다. */
GT.RAR_LEGEND=2; GT.RAR_MYTH=3;
/* 신화 상자 = 종전 «그 뽑기 상자». 확률·가격·천장의 정본은 GT.gachaRate/pullCost/pityMyth/pityLegend 이고
   상자 표는 그것을 참조만 한다 (스윕 GT_OVERRIDE 도 그대로 탄다 — 오버라이드 뒤에 채우기 때문이다). */
GT.boxes.myth.rate=GT.gachaRate; GT.boxes.myth.cost=GT.pullCost;
GT.boxes.myth.pityM=GT.pityMyth; GT.boxes.myth.pityL=GT.pityLegend;
/* 뽑기 굴림 임계 — 상자마다 rate 를 «높은 등급부터» 누적한 값
   (toFixed(6) 로 부동소수 누적 오차를 끊는다 — 임계가 1ULP 라도 밀리면 시드 재현성이 깨진다). */
GT.mkCum=rate=>{ const c=[]; let a=0; for(let i=rate.length-1;i>=0;i--){ a=+(a+rate[i]).toFixed(6); c[i]=a; } return c; };
for(const k in GT.boxes){
  const b=GT.boxes[k];
  b.cum=GT.mkCum(b.rate);
  b.rarRoll=r=>{ for(let i=b.rate.length-1;i>0;i--) if(r<b.cum[i]) return i; return 0; };
}
GT.gachaCum=GT.boxes.myth.cum;                 /* 종전 이름 (신화 상자) */
GT.rarRoll=GT.boxes.myth.rarRoll;
/* 옵션 개수: 등급별 + 신화 강화 보너스 (⚑ T124 — 일반부터 1개 · 등급마다 +1)
   ⚑⚑⚑ T153 — 영웅이 빠져 **최대 8 → 7** 이다: 일반1 · 희귀2 · 전설3 · 신화4 + (+3/+6/+9 각 +1). */
GT.optCount=(rar,plus)=>{
  let n=rar+1;                                 // 일반1 희귀2 전설3 신화4
  if(rar===GT.RAR_MYTH){ if(plus>=3)n++; if(plus>=6)n++; if(plus>=9)n++; }
  return n;
};

/* ---- 3세트 × 6부위 옵션표 (PLAN §11.6 — ⚑⚑⚑ 주인 확정 T124 2026-09-04 19:2X) ----
   세트마다 옵션 6개(a~f)를 정해 **6부위가 그대로 공유**하고, 부위별로 a~e 만 5칸 순환시켜 순서를 돌린다.
   ⚑⚑⚑ T153 (주인 확정 2026-09-05 18:1X) — **사다리가 8칸 → 7칸**이 됐다. 주인 «옵션에서는 신화 강화 +9
   부분 현재 꺼 빼고 영웅서부터 하나씩 밀려서 채워주면 될 듯»: 맨 끝 «공격력 +10%» 을 빼면 배열은 그대로이고
   영웅 등급이 사라진 만큼 **해금 등급만 한 칸씩 당겨진다**. 새 사다리 =
     1 일반 a · 2 희귀 b · 3 전설 c · 4 신화 d · 5 신화+3 e · 6 신화+6 **f(도끼)** · 7 신화+9 **흡혈 8%**.
   f 는 여전히 «세트의 마지막 옵션 = 도끼 발동»(주인 «치명 시 도끼는 무조건 6번째» — 자리 번호가 아니라
   «a~f 중 마지막» 이라는 뜻으로 유지된다) 이고, 흡혈 8%(T145)는 맨 끝 칸으로 옮겨졌다.
   **«공격력 +10%» 옵션은 사라졌다** — 풀셋 +9강 공격력 +60% 도 함께 사라진다(등재만 · 밸런스 조정 아님).
   상위 등급은 하위 옵션을 전부 포함한다(종전 규칙 그대로).

     부위별 순서 — 무기 abcde · 투구 bcdea · 갑옷 cdeab · 장갑 deabc · 신발 eabcd · 목걸이 abcde (+ f 고정)
     세트 옵션 (⚑ 20:0X~20:3X 주인 정정 반영) —
                 치명 a 치확+5 · b 치피+20 · c 반격+10 · d 치확+5 · e 치피+25 · f 치명 시 50% 도끼
                 체력실드 a 체력+10% · b 실드+12% · c 방어+8% · d 실드+12% · e 실드 시 가시+12% · f 피격 시 50% 도끼
                 회피 a 회피+8 · b 실드+10% · c 저체력 회피 회복 · d 체력+8% · e 실드+10% · f 회피 시 50% 도끼
     세 세트 모두 **6번 자리(신화 +3강)가 «도끼 발동»** 이다(주인 20:0X 확정).

   위임 기본값(주인이 다르면 한 줄로 정정) —
   · «같은 옵션이 여러 부위에 있으면 각각 따로 합산·발동»(주인 명시). 스탯 옵션은 그냥 더하고,
     발동 옵션(도끼·회복)은 **부위 수만큼 따로 굴린다**(풀셋 +3강이면 6번).
   · «최대 체력 +8%»·«최대 실드 +10%» 는 **가산 합산**이다(곱연산 아님 — 주인 참고표의
     풀셋 +9강 합산 «체력 +48% · 실드 +180%» 가 가산이어야 나온다). 그래서 `ap` 는
     퍼센트를 `px.g_hpP/g_shP` 에 모으고 `mkPlayer` 가 마지막에 한 번 곱한다(`g_atkP` 축은 남겨 두되
     ⚑ T153 으로 **그것을 올리는 장비 옵션이 한 칸도 없다** — 풀셋 +9강 공격력 +60% 소멸).
   · ⚑ «흡혈 +8%»(마지막 7번 칸 · T145 → ⚑ T153 로 +6강 → **+9강** 자리) 는 **부위마다 가산** —
     풀셋 +9강이면 `p.steal` 8×6 = **48**(= 준 피해의 48%).
     엔진의 `steal` 축을 **그대로** 쓴다: 회복은 `dealDmg` 의 `heal(p,d*p.steal/100,true)` 한 곳이고
     `noBoost=true` 라 회복 증폭을 타지 않으며(종전 «준 피해의 n%» 문면 위임 그대로) 실드도 안 채운다.
   · «방어력 +8%» 는 방어 스탯(0~80 의 피해 감소율)에 **+8 을 더한다** — 풀셋 +48 (주인 참고표와 일치).
     특전 «방어력 증가»(곱연산 ×1.08)와 달리 가산인 이유도 같다(기본 방어 0 에서 곱연산은 0 이다).
   · «실드가 있을 때 가시갑옷 +12%» 는 특전 가시갑옷과 **가산**(피격 순간 실드가 있었을 때만 · +0.12 배). */
const GOPT={
  /* --- 치명 세트 --- */
  crit_weapon:[ /* 치명 무기 */
    {d:'치명타 확률 +5', ap:p=>p.critR+=5},
    {d:'치명타 피해 +20', ap:p=>p.critF+=20},
    {d:'반격률 +10', ap:p=>p.counter+=10},
    {d:'치명타 확률 +5', ap:p=>p.critR+=5},
    {d:'치명타 피해 +25', ap:p=>p.critF+=25},
    {d:'치명타 시 50% 확률로 도끼 1개', ap:p=>p.px.g_critAxe++},
    {d:'흡혈 +8%', ap:p=>p.steal+=8},
  ],
  crit_helm:[ /* 치명 투구 */
    {d:'치명타 피해 +20', ap:p=>p.critF+=20},
    {d:'반격률 +10', ap:p=>p.counter+=10},
    {d:'치명타 확률 +5', ap:p=>p.critR+=5},
    {d:'치명타 피해 +25', ap:p=>p.critF+=25},
    {d:'치명타 확률 +5', ap:p=>p.critR+=5},
    {d:'치명타 시 50% 확률로 도끼 1개', ap:p=>p.px.g_critAxe++},
    {d:'흡혈 +8%', ap:p=>p.steal+=8},
  ],
  crit_armor:[ /* 치명 갑옷 */
    {d:'반격률 +10', ap:p=>p.counter+=10},
    {d:'치명타 확률 +5', ap:p=>p.critR+=5},
    {d:'치명타 피해 +25', ap:p=>p.critF+=25},
    {d:'치명타 확률 +5', ap:p=>p.critR+=5},
    {d:'치명타 피해 +20', ap:p=>p.critF+=20},
    {d:'치명타 시 50% 확률로 도끼 1개', ap:p=>p.px.g_critAxe++},
    {d:'흡혈 +8%', ap:p=>p.steal+=8},
  ],
  crit_glove:[ /* 치명 장갑 */
    {d:'치명타 확률 +5', ap:p=>p.critR+=5},
    {d:'치명타 피해 +25', ap:p=>p.critF+=25},
    {d:'치명타 확률 +5', ap:p=>p.critR+=5},
    {d:'치명타 피해 +20', ap:p=>p.critF+=20},
    {d:'반격률 +10', ap:p=>p.counter+=10},
    {d:'치명타 시 50% 확률로 도끼 1개', ap:p=>p.px.g_critAxe++},
    {d:'흡혈 +8%', ap:p=>p.steal+=8},
  ],
  crit_boot:[ /* 치명 신발 */
    {d:'치명타 피해 +25', ap:p=>p.critF+=25},
    {d:'치명타 확률 +5', ap:p=>p.critR+=5},
    {d:'치명타 피해 +20', ap:p=>p.critF+=20},
    {d:'반격률 +10', ap:p=>p.counter+=10},
    {d:'치명타 확률 +5', ap:p=>p.critR+=5},
    {d:'치명타 시 50% 확률로 도끼 1개', ap:p=>p.px.g_critAxe++},
    {d:'흡혈 +8%', ap:p=>p.steal+=8},
  ],
  crit_neck:[ /* 치명 목걸이 */
    {d:'치명타 확률 +5', ap:p=>p.critR+=5},
    {d:'치명타 피해 +20', ap:p=>p.critF+=20},
    {d:'반격률 +10', ap:p=>p.counter+=10},
    {d:'치명타 확률 +5', ap:p=>p.critR+=5},
    {d:'치명타 피해 +25', ap:p=>p.critF+=25},
    {d:'치명타 시 50% 확률로 도끼 1개', ap:p=>p.px.g_critAxe++},
    {d:'흡혈 +8%', ap:p=>p.steal+=8},
  ],
  /* --- 체력실드 세트 --- */
  hpsh_weapon:[ /* 체력실드 무기 */
    {d:'최대 체력 +10%', ap:p=>p.px.g_hpP+=10},
    {d:'최대 실드 +12%', ap:p=>p.px.g_shP+=12},
    {d:'방어력 +8%', ap:p=>p.def+=8},
    {d:'최대 실드 +12%', ap:p=>p.px.g_shP+=12},
    {d:'실드가 있을 때 가시갑옷 +12%', ap:p=>p.px.g_thornSh+=0.12},
    {d:'피격 시 50% 확률로 도끼 1개', ap:p=>p.px.g_hitAxe++},
    {d:'흡혈 +8%', ap:p=>p.steal+=8},
  ],
  hpsh_helm:[ /* 체력실드 투구 */
    {d:'최대 실드 +12%', ap:p=>p.px.g_shP+=12},
    {d:'방어력 +8%', ap:p=>p.def+=8},
    {d:'최대 실드 +12%', ap:p=>p.px.g_shP+=12},
    {d:'실드가 있을 때 가시갑옷 +12%', ap:p=>p.px.g_thornSh+=0.12},
    {d:'최대 체력 +10%', ap:p=>p.px.g_hpP+=10},
    {d:'피격 시 50% 확률로 도끼 1개', ap:p=>p.px.g_hitAxe++},
    {d:'흡혈 +8%', ap:p=>p.steal+=8},
  ],
  hpsh_armor:[ /* 체력실드 갑옷 */
    {d:'방어력 +8%', ap:p=>p.def+=8},
    {d:'최대 실드 +12%', ap:p=>p.px.g_shP+=12},
    {d:'실드가 있을 때 가시갑옷 +12%', ap:p=>p.px.g_thornSh+=0.12},
    {d:'최대 체력 +10%', ap:p=>p.px.g_hpP+=10},
    {d:'최대 실드 +12%', ap:p=>p.px.g_shP+=12},
    {d:'피격 시 50% 확률로 도끼 1개', ap:p=>p.px.g_hitAxe++},
    {d:'흡혈 +8%', ap:p=>p.steal+=8},
  ],
  hpsh_glove:[ /* 체력실드 장갑 */
    {d:'최대 실드 +12%', ap:p=>p.px.g_shP+=12},
    {d:'실드가 있을 때 가시갑옷 +12%', ap:p=>p.px.g_thornSh+=0.12},
    {d:'최대 체력 +10%', ap:p=>p.px.g_hpP+=10},
    {d:'최대 실드 +12%', ap:p=>p.px.g_shP+=12},
    {d:'방어력 +8%', ap:p=>p.def+=8},
    {d:'피격 시 50% 확률로 도끼 1개', ap:p=>p.px.g_hitAxe++},
    {d:'흡혈 +8%', ap:p=>p.steal+=8},
  ],
  hpsh_boot:[ /* 체력실드 신발 */
    {d:'실드가 있을 때 가시갑옷 +12%', ap:p=>p.px.g_thornSh+=0.12},
    {d:'최대 체력 +10%', ap:p=>p.px.g_hpP+=10},
    {d:'최대 실드 +12%', ap:p=>p.px.g_shP+=12},
    {d:'방어력 +8%', ap:p=>p.def+=8},
    {d:'최대 실드 +12%', ap:p=>p.px.g_shP+=12},
    {d:'피격 시 50% 확률로 도끼 1개', ap:p=>p.px.g_hitAxe++},
    {d:'흡혈 +8%', ap:p=>p.steal+=8},
  ],
  hpsh_neck:[ /* 체력실드 목걸이 */
    {d:'최대 체력 +10%', ap:p=>p.px.g_hpP+=10},
    {d:'최대 실드 +12%', ap:p=>p.px.g_shP+=12},
    {d:'방어력 +8%', ap:p=>p.def+=8},
    {d:'최대 실드 +12%', ap:p=>p.px.g_shP+=12},
    {d:'실드가 있을 때 가시갑옷 +12%', ap:p=>p.px.g_thornSh+=0.12},
    {d:'피격 시 50% 확률로 도끼 1개', ap:p=>p.px.g_hitAxe++},
    {d:'흡혈 +8%', ap:p=>p.steal+=8},
  ],
  /* --- 회피 세트 --- */
  evade_weapon:[ /* 회피 무기 */
    {d:'회피 +8', ap:p=>p.evade+=8},
    {d:'최대 실드 +10%', ap:p=>p.px.g_shP+=10},
    {d:'체력 50% 미만일 때 회피 시 30% 확률로 체력 10% 회복', ap:p=>p.px.g_evHeal++},
    {d:'최대 체력 +8%', ap:p=>p.px.g_hpP+=8},
    {d:'최대 실드 +10%', ap:p=>p.px.g_shP+=10},
    {d:'회피 시 50% 확률로 도끼 1개', ap:p=>p.px.g_evAxe++},
    {d:'흡혈 +8%', ap:p=>p.steal+=8},
  ],
  evade_helm:[ /* 회피 투구 */
    {d:'최대 실드 +10%', ap:p=>p.px.g_shP+=10},
    {d:'체력 50% 미만일 때 회피 시 30% 확률로 체력 10% 회복', ap:p=>p.px.g_evHeal++},
    {d:'최대 체력 +8%', ap:p=>p.px.g_hpP+=8},
    {d:'최대 실드 +10%', ap:p=>p.px.g_shP+=10},
    {d:'회피 +8', ap:p=>p.evade+=8},
    {d:'회피 시 50% 확률로 도끼 1개', ap:p=>p.px.g_evAxe++},
    {d:'흡혈 +8%', ap:p=>p.steal+=8},
  ],
  evade_armor:[ /* 회피 갑옷 */
    {d:'체력 50% 미만일 때 회피 시 30% 확률로 체력 10% 회복', ap:p=>p.px.g_evHeal++},
    {d:'최대 체력 +8%', ap:p=>p.px.g_hpP+=8},
    {d:'최대 실드 +10%', ap:p=>p.px.g_shP+=10},
    {d:'회피 +8', ap:p=>p.evade+=8},
    {d:'최대 실드 +10%', ap:p=>p.px.g_shP+=10},
    {d:'회피 시 50% 확률로 도끼 1개', ap:p=>p.px.g_evAxe++},
    {d:'흡혈 +8%', ap:p=>p.steal+=8},
  ],
  evade_glove:[ /* 회피 장갑 */
    {d:'최대 체력 +8%', ap:p=>p.px.g_hpP+=8},
    {d:'최대 실드 +10%', ap:p=>p.px.g_shP+=10},
    {d:'회피 +8', ap:p=>p.evade+=8},
    {d:'최대 실드 +10%', ap:p=>p.px.g_shP+=10},
    {d:'체력 50% 미만일 때 회피 시 30% 확률로 체력 10% 회복', ap:p=>p.px.g_evHeal++},
    {d:'회피 시 50% 확률로 도끼 1개', ap:p=>p.px.g_evAxe++},
    {d:'흡혈 +8%', ap:p=>p.steal+=8},
  ],
  evade_boot:[ /* 회피 신발 */
    {d:'최대 실드 +10%', ap:p=>p.px.g_shP+=10},
    {d:'회피 +8', ap:p=>p.evade+=8},
    {d:'최대 실드 +10%', ap:p=>p.px.g_shP+=10},
    {d:'체력 50% 미만일 때 회피 시 30% 확률로 체력 10% 회복', ap:p=>p.px.g_evHeal++},
    {d:'최대 체력 +8%', ap:p=>p.px.g_hpP+=8},
    {d:'회피 시 50% 확률로 도끼 1개', ap:p=>p.px.g_evAxe++},
    {d:'흡혈 +8%', ap:p=>p.steal+=8},
  ],
  evade_neck:[ /* 회피 목걸이 */
    {d:'회피 +8', ap:p=>p.evade+=8},
    {d:'최대 실드 +10%', ap:p=>p.px.g_shP+=10},
    {d:'체력 50% 미만일 때 회피 시 30% 확률로 체력 10% 회복', ap:p=>p.px.g_evHeal++},
    {d:'최대 체력 +8%', ap:p=>p.px.g_hpP+=8},
    {d:'최대 실드 +10%', ap:p=>p.px.g_shP+=10},
    {d:'회피 시 50% 확률로 도끼 1개', ap:p=>p.px.g_evAxe++},
    {d:'흡혈 +8%', ap:p=>p.steal+=8},
  ],
};
withSummonDmg(GOPT,'d');    /* ⚑ T155 ② — 장비 옵션의 도끼 문구에도 «(공격력의 50%)» (상수에서 생성) */

/* ---- 뽑기 (PLAN §11.2) ---- */
function newGacha(){ return {p50:0,p10:0,pulls:0}; }
/* ⚑⚑⚑ T125 (주인 확정 2026-09-04 · 21:0X) — 뽑기 천장 겹침은 «이월» 이 아니라 **둘 다 지급**이다.
   신화 천장(누적 50회째)과 전설 피티(10회째)가 같은 회차에 걸리면 그 한 번이 **신화 1 + 전설 1 = 2개**를
   주고(비용은 1회분), 두 카운터는 각자 0 으로 리셋된다. 10연차 안에서 겹치면 결과가 **11개**로 뜬다.
   그래서 이 함수는 **배열**을 돌려준다(보통 1개 · 겹칠 때만 2개) — 호출부는 전부 배열로 받는다.
   위임 기본값: 그 회차의 자연 굴림은 종전대로 신화가 대체하고, **추가 1개는 전설 등급 고정**이다
   (피티의 «전설 이상» 은 신화가 이미 채웠으므로 보너스는 전설). 추가분의 종류도 일반 굴림과 같이 무작위다.
   종전 조항(«겹치면 신화 우선 · 전설 확정은 다음 뽑기로 이월»)은 폐지됐다. */
/* ⚑⚑⚑ T153 (주인 확정 2026-09-05 18:1X) — 상자가 3종이라 **어느 상자를 뽑았는지**를 받는다.
   `box` 는 `GT.boxes` 의 한 칸(기본 = 신화 상자 = 종전 «그 뽑기 상자»). 천장·피티는 상자마다 다르다:
   희귀 상자는 둘 다 0(없음) · 전설 상자는 전설 피티만 · 신화 상자는 종전 그대로(50 천장 + 10 피티).
   피티 카운터(p50·p10)는 **상자별로 따로** 센다 — 호출부가 상자별 `newGacha()` 상태를 준다. */
function gachaPull(st,box){
  box=box||GT.boxes.myth;
  st.pulls++; st.p50++; st.p10++;
  const pityM=box.pityM>0&&st.p50>=box.pityM, pityL=box.pityL>0&&st.p10>=box.pityL;
  let rar;
  if(pityM) rar=GT.RAR_MYTH;
  else{
    const r=grand()*100;
    rar = box.rarRoll(r);           /* 임계는 상자의 rate 에서 파생 — 리터럴로 되돌리지 말 것 (T65) */
    if(pityL&&rar<GT.RAR_LEGEND) rar=GT.RAR_LEGEND;
  }
  if(rar===GT.RAR_MYTH) st.p50=0;
  if(rar>=GT.RAR_LEGEND) st.p10=0;  /* 신화든 전설이든 전설 피티는 채워졌다 (겹침도 여기서 리셋된다) */
  const mk=r=>{ const t=GT.allTypes[Math.floor(grand()*GT.allTypes.length)];   /* 뽑기 스트림 (R11) */
    return {part:t.part,type:t.type,rar:r,plus:0}; };
  const out=[mk(rar)];
  if(pityM&&pityL) out.push(mk(GT.RAR_LEGEND));  /* 겹침 = 전설 1개 추가 지급 */
  return out;
}

/* ---- 합성 (PLAN §11.3) ---- */
const gearKey=g=>`${g.part}|${g.type}|${g.rar}|${g.plus}`;
/* 합성 산출물 규칙 — 자동(fuseAll)·수동(합성 화면) 둘 다 **이 함수 하나만** 쓴다.
   규칙을 두 곳에 적으면 T8·T9·T11·T12 계열(«같은 수치를 손으로 두 번 옮기다 어긋남») 이 재발한다.
   base = 재료 3개 중 최고 강화품(호출부가 정렬해서 넘긴다). */
function fuseMake(base){
  /* ⚑ T153 — 영웅이 빠져 «희귀 3개 → 전설» 이다(등급 인덱스만 당겨졌고 규칙은 그대로). */
  if(base.rar<GT.RAR_LEGEND) return {part:base.part,type:base.type,rar:base.rar+1,plus:0};
  if(base.rar===GT.RAR_LEGEND){
    const np=base.plus+1;
    return np>=GT.legendToMythPlus
      ? {part:base.part,type:base.type,rar:GT.RAR_MYTH,plus:0}            /* +3강 도달 → 신화 0강 변환 (⚑ T161) */
      : {part:base.part,type:base.type,rar:GT.RAR_LEGEND,plus:np};
  }
  return {part:base.part,type:base.type,rar:GT.RAR_MYTH,plus:base.plus+1};   /* 신화 무한 강화 */
}
/* inv: 배열. equipped: Set(장착 중인 객체) — 재료에서 제외 */
function fuseAll(inv,equipped){
  let did=true,count=0;
  while(did){
    did=false;
    const groups=new Map();
    for(const g of inv){
      if(equipped.has(g))continue;
      const k=`${g.part}|${g.type}|${g.rar}`;
      if(!groups.has(k))groups.set(k,[]);
      groups.get(k).push(g);
    }
    for(const [k,arr] of groups){
      if(arr.length<3)continue;
      arr.sort((a,b)=>b.plus-a.plus);          /* 재료 중 최고 강화 기준 */
      const mats=arr.slice(0,3), base=mats[0];
      const made=fuseMake(base);
      for(const m of mats){const i=inv.indexOf(m);inv.splice(i,1);}
      inv.push(made);count++;did=true;
      break;                                    /* 인벤이 바뀌었으니 재그룹화 */
    }
  }
  return count;
}
const gearScore=g=>g.rar*1000+g.plus;           /* 등급 우선, 같은 등급이면 강화 (신화0>전설9 제약과 일관) */
function autoEquip(inv){
  const eq={};
  for(const g of inv){ const b=eq[g.part]; if(!b||gearScore(g)>gearScore(b))eq[g.part]=g; }
  return eq;                                    /* {part: gear|undefined} */
}

/* ---- 빌드(계정 상태) → 전투 스탯 ---- */
/* build = {eq:{part:gear|null}, slots:{part:레벨}} */
function mkBuild(rar,plus,slotLv,typeIdx){
  const eq={},slots={};
  for(const pt of GT.parts){
    eq[pt] = rar<0?null:{part:pt,type:GT.types[pt][typeIdx||0],rar,plus:plus||0};
    slots[pt]=slotLv||0;
  }
  return {eq,slots};
}
const evenBonus=b=>1+GT.evenStep*Math.floor(Math.min(...GT.parts.map(pt=>b.slots[pt]||0))/GT.evenPer);
/* 진단용 평탄 빌드: 장비/옵션 없이 공/체만 직접 지정 (앵커 요구 전투력 역산 fit 모드) */
function flatBuild(atk,hp,sh){ const slots={}; for(const pt of GT.parts) slots[pt]=0; return {eq:{},slots,flat:{atk,hp,sh:sh===undefined?TUNE.pSh0:sh}}; }
function buildPower(b){
  if(b.flat)return b.flat;
  let atk=0,hp=0,sh=0;
  for(const pt of GT.parts){
    const g=b.eq[pt]; if(!g)continue;
    const m=GT.slotMul(b.slots[pt]||0)*(1+GT.plusStep*g.plus);
    atk+=GT.atk[g.rar]*m; hp+=GT.hp[g.rar]*m; sh+=GT.sh[g.rar]*m;
  }
  const ev=evenBonus(b);
  return {atk:(TUNE.pAtk0+atk)*ev, hp:(TUNE.pHp0+hp)*ev, sh:(TUNE.pSh0+sh)*ev};
}

/* ---------- 엔진 ---------- */
function _basePxLegacy(){
  return {
    c_aspdBuff:0,c_atkBuff:0,atkPerm:0,critChain:0,critFsmall:0,critHealS:0,
    killShield3:0,defHitBuff:0,shieldOnHit:0,hitHeal:0,evadeEvBuff:0,evadeAspd:0,evadeDef:0,
    hitCounterS:0,counterAtkS:0,counterDefS:0,healBoost2:0,healDefBuff:0,healShield3:0,firstHit:0,
    axe:0,arrow2:0,wave:0,atkBuffM:0,critFBuff:0,critReset:0,critHeal3:0,aspdKill:0,
    killCritBuff:0,killDefBuff:0,defBuff2:0,hitEvadeBuff:0,hitCounter:0,evadeHeal:0,evadeShield:0,
    evadeRush:0,counterX:0,counterAtkM:0,counterCrit:0,healShield5:0,healAtkBuff:0,lastStand:false,
    spear:0,bolt:0,atkBuffL:0,extraHit:0,critAtkBuff:0,critAspdBuff:0,killAspd:false,killShield10:0,
    thorns:0,evadeHitBuff:0,defBuffL:0,evadeCrit:false,evadeCounter:0,evadeAtkBuff:0,
    counterChain:false,counterHeal:0,counterWave:0,overheal:false,overBolt:false,
    fullHpCrit:false,rage:false,backDmg:false,execute:false,
    revive:0,clone:false,execKill:false,procX2:false,arsenal:0,guardCrystal:false,autoBolt:0,
    axeCount:0,arrowCount:0,spearMaster:0,boltCount:0,waveKing:0,sage:false,wallBuff:0,
    evadeAxe:0,
    /* ⚑ T48 1단계 — 신규 축 2개 (주인 15:5X): 스턴 · 빗맞음(onMiss) */
    stunHitS:0,stunHitL:0,stunCritM:0,stunCritL:0,stunLord:false,stunKill:false,stunAura:0,
    missAtk:0,missDef:0,missAspd:0,missReset:0,missRush:false,missSpear:0,
    /* ⚑ T48 2단계 — 원거리 피격 축 · 반사 확장 · 고중첩 변형 (주인 16:0X·16:1X·16:2X) */
    rangeShield:0,rangeThorns:0,rangeBolt:0,rangeSpear:0,thornsS:0,thornsKing:false,aspdStack10:0,
    /* ⚑⚑⚑ T124 장비 세트 옵션 축 (3세트 × 6부위 · 주인 확정 19:2X)
       — 퍼센트 합산 3개(공격력·최대 체력·최대 실드 · `mkPlayer` 가 마지막에 한 번 곱한다)
       + 발동 카운터 4개(치명 시 도끼 · 회피 시 도끼 · 피격 시 도끼 · 저체력 회피 회복 — 부위 수만큼 따로 굴린다)
       + 조건부 가시 배율 1개(실드가 있었을 때만 더해지는 가산 배율).
       ⚠ 위 «구 키» 들은 18계열 옵션표가 폐지되면서 GOPT 어디에서도 안 켜진다(전부 0 고정) —
         엔진 트리거 자리는 남겨 두되 새 옵션은 아래 `g_*` 축만 쓴다. */
    g_atkP:0,g_hpP:0,g_shP:0,g_critAxe:0,g_evAxe:0,g_hitAxe:0,g_evHeal:0,g_thornSh:0,
  };
}
/* 신 132종의 px 키 = 특전 id 그대로. 여기서 한 번에 0 으로 깔아 둔다 —
   특전을 추가·삭제해도 이 함수를 고칠 일이 없고, 오타 난 키가 조용히 `undefined` 로 도는 일도 없다. */
/* ⚑ T119 — 특전 id 말고도 «같은 이름·다른 등급» 계열이 모이는 합산 키 5개가 있다.
   `p_kill*` 넷은 확률 최댓값이고 `p_thorns` 는 가산 배율이다(주인이 가시갑옷만 가산으로 확정). */
const PERK_AGG_KEYS=['p_killSpear','p_killBolt','p_killArrow','p_killAxe','p_thorns'];
function basePx(){ const o=_basePxLegacy(); for(const k of PERKS) o[k.id]=0; for(const k of PERK_AGG_KEYS) o[k]=0; return o; }
function mkPlayer(build,G){
  const pw=buildPower(build);
  const maxHp=pw.hp;
  const p={G, worldX:0, atkTimer:0, nextAtk:0, nextCrit:false,
    dmg:pw.atk, aspd:TUNE.pAspd0, critR:TUNE.pCrit0, critF:TUNE.pCritF0,
    def:TUNE.pDef0, counter:TUNE.pCounter0, evade:TUNE.pEvade0, steal:0, killHeal:0, misfire:0, goldMul:1, walkMul:1, healAmp:0,
    maxHp, hp:maxHp, maxSh:pw.sh, sh:pw.sh,   /* ⚑ T35: 실드 독립 스탯 (`maxHp*0.8` 파생 폐기) */
    level:1, exp:0, ward:0, repairAmp:0,
    /* ⚑ T121 신규 상태 — 치명 스택(평타 적중 누적) · N타 카운터(특전마다 따로) · 수집가·체력이 지금 건 배수 */
    critStk:0, nhit:{}, collHpF:1,
    /* ⚑ T121 2차 — 처치 시 확정 치명 플래그 · 버서커 스택 · 처치 시 대시 중 여부 */
    sureCrit:false, bsStk:0, dash:false,
    buffs:{atk:[],aspd:[],critR:[],critF:[],def:[],evade:[]}, px:basePx()};
  /* ⚑ T160 하니스 스위치 ⓐ — 자가 `baseStats:'legacy20'` 이면 **넷만** 옛 값 20 으로 덮는다.
     ⚠ 위 리터럴(`critR:TUNE.pCrit0` …)은 그대로 둔다 — 게임 경로는 언제나 TUNE 을 읽고,
     `verifyCombatConst` ① 이 그 토큰을 두 엔진에서 대조한다(자 때문에 게임 배선을 바꾸지 않는다). */
  if(G&&G.baseStats==='legacy20'){ p.critR=LADDER_BASE20; p.def=LADDER_BASE20; p.counter=LADDER_BASE20; p.evade=LADDER_BASE20; }
  /* 장비 계열 옵션 적용 (PLAN §11.1 — 상위 등급은 하위 옵션 포함)
     ⚑ T160 하니스 스위치 ⓑ — 자가 `gearOpts:false` 면 세트 옵션을 통째로 건너뛴다(공/체/실 기여만 남는다). */
  if(!(G&&G.gearOpts===false)) for(const pt of GT.parts){
    const g=build.eq[pt]; if(!g)continue;
    const tbl=GOPT[g.type]; if(!tbl)continue;
    const n=GT.optCount(g.rar,g.plus);
    for(let i=0;i<n&&i<tbl.length;i++) tbl[i].ap(p);
  }
  /* ⚑ T124 — 세트 옵션의 퍼센트 축은 **가산 합산 뒤 한 번만** 곱한다(부위마다 곱연산으로 걸면 1.10^18 이 되어
     주인 수치와 어긋난다). ⚑⚑⚑ T153 — «공격력 +10%» 칸이 사라져 풀셋 +9강은 공 **+0%** ·
     체 +48% · 실 +180% 이고, 마지막 7번 자리가 «흡혈 +8%» ×6 = p.steal 48 이다. */
  p.dmg*=1+p.px.g_atkP/100; p.maxHp*=1+p.px.g_hpP/100; p.maxSh*=1+p.px.g_shP/100;
  p.hp=p.maxHp; p.sh=p.maxSh=Math.round(p.maxSh);
  return p;
}
const bsum=(p,k)=>{let s=0;for(const b of p.buffs[k])s+=b.amt;return s;};
/* ⚑ 주인 확정(2026-09-03) — 시간제 버프의 중첩 상한 전부 삭제(무한 중첩).
   발동될 때마다 계속 쌓이고 각자 자기 시간이 끝나면 빠진다. 넷째 인자까지만 읽으므로
   구 호출부가 넘기던 다섯째 인자(max)는 무시된다 — 표시 텍스트에서도 «최대 N중첩» 은 사라졌다. */
function addBuff(p,k,amt,dur){ p.buffs[k].push({t:dur,amt}); }
/* ⚑ T121 «갱신형» 버프 한 곳 — 같은 태그의 기존 항목을 지우고 새로 넣는다(중첩 없이 «시간만 갱신»).
   무한 중첩이 기본인 `addBuff` 와 달리 항상 1개만 남는다 — 주인 «스택 아님». index.html 과 1:1이고
   시간 감소는 종전 버프 틱이 그대로 처리한다(별도 타이머를 만들지 않는다). */
function refreshBuff(p,k,amt,dur,tag){
  const arr=p.buffs[k];
  for(let i=arr.length-1;i>=0;i--) if(arr[i].tag===tag) arr.splice(i,1);
  arr.push({t:dur,amt,tag});
}
const pkk=(p,ch)=>Math.random()<ch*(p.px.procX2?1.22:1);
/* ⚑ T121 수집가·공격 — «보유 특전 하나당 공격력 +4%»(곱연산). 실효 스탯에서 매번 세므로 소급된다. */
const effDmg=p=>{const px=p.px;let m=1+bsum(p,'atk');
  if(px.rage&&p.sh<=0)m*=1.5;                              /* 장비 옵션 */
  if(px.p_collAtk)m*=1+PERK_COLL_ATK*perkCountOf(p);
  /* ⚑ T121 3차 «실드 없을 때 공격력»(주인 확정 18:2X) — 실드가 0 인 동안만 곱연산, 실드가 다시 생기면 꺼진다 */
  if(px.p_noShAtk&&p.sh<=0)m*=PERK_NOSH_ATK;
  return p.dmg*m;};
/* ⚑ T121 3차 «실드 없을 때 공속» — 위와 같은 상시 조건부(곱연산) */
const effAspd=p=>p.aspd*(1+bsum(p,'aspd'))*(p.px.p_noShAspd&&p.sh<=0?PERK_NOSH_ASPD:1);
/* ⚑ T119 — 광전사(전설 6): 치명타 확률을 **0 으로 고정**한다(치확 +10 특전·버프·장비 옵션이 있어도 0).
   여기 한 자리에서 막으므로 «치명타 시» 트리거도 함께 죽는다 — 주인 문면 «치명타 확률 0%» 그대로. */
/* ⚑ T121 — 수집가·치명(보유 특전 하나당 +2, 가산)과 치명 스택(평타 적중 누적)이 여기서 합쳐진다.
   광전사는 종전대로 이 한 자리에서 전부 0 으로 눌러 «치명타 시» 트리거까지 함께 죽인다. */
const effCritR=p=>{const px=p.px;if(px.p_berserk)return 0;
  let c=p.critR+bsum(p,'critR');
  if(px.p_collCrit)c+=PERK_COLL_CRIT*perkCountOf(p);
  if(px.p_critStack)c+=p.critStk;
  return c;};
const effCritF=p=>p.critF+bsum(p,'critF');
const effDef=p=>Math.min(80,p.def+bsum(p,'def'));
const effEvade=p=>{const px=p.px;let e=p.evade+bsum(p,'evade');
  if(px.lastStand&&p.hp<=p.maxHp*0.10)e+=40;               /* 장비 옵션 */
  return Math.min(90,e);};
const effCounter=p=>p.counter;
/* ⚑ 실드 수리 한 곳 — 🔧 «실드 수리 효과 +100%»(r_repairAmp)가 여기 한 자리에서만 걸리므로
   특전이든 장비 옵션이든 수리는 전부 이 동사를 거친다. 시간 경과형 수리는 금지축이라 호출부가 없다. */
function repair(p,amt){ if(amt<=0)return; p.sh=Math.min(p.maxSh,p.sh+amt*(1+p.repairAmp)); }
function heal(p,amt,noBoost){
  const px=p.px;
  if(!noBoost){
    amt*=1+p.healAmp;
    if(px.healBoost2&&pkk(p,0.20*px.healBoost2)) amt+=p.maxHp*0.02;
  }
  const over=Math.max(0,p.hp+amt-p.maxHp);
  const before=p.hp;
  p.hp=Math.min(p.maxHp,p.hp+amt);
  /* ⚑ T121 희귀 «회복 시 수리» — «힐 시 같은 양만큼 실드도 수리»(수리 증폭은 `repair` 가 건다).
     «같은 양» = 실제로 체력에 들어간 회복량(최대치 초과분 제외 — 위임 기본값).
     주인 문면이 «회복 시» 라 증폭 분기 밖에 둔다: 회피 시 회복·생명 흡수 같은 `noBoost` 회복도 «회복» 이다. */
  if(px.p_healRepair&&p.hp>before)repair(p,p.hp-before);
  if(!noBoost){
    if(px.healDefBuff&&pkk(p,0.30*px.healDefBuff)) addBuff(p,'def',5*px.healDefBuff,3,3);
    if(px.healShield3&&pkk(p,0.20*px.healShield3)) repair(p,p.maxSh*0.03);
    if(px.healShield5&&pkk(p,0.30*px.healShield5)) repair(p,p.maxSh*0.08);
    if(px.healAtkBuff) addBuff(p,'atk',0.08,3);
    if(over>0){
      if(px.overheal) repair(p,over*7);   /* 장비 옵션 */
      if(px.overBolt&&p.G.overBoltCd<=0){ p.G.overBoltCd=0.12; fireBolts(p,true); }
    }
  }
}

/* 시뮬 전투 상태 */
function aliveList(G){const o=[];for(const n of G.nodes)for(const e of n.enemies)if(e.hp>0)o.push(e);return o;}
/* 지금 «필드 위에» 있는 적이 속한 노드 = 플레이어가 상대하고 있는 최전방 노드.
   주인 확정 보강(15:2X): 관통형(창·검기)은 이 노드의 적만 맞는다 — 다음 웨이브 대기분은 절대 맞지 않는다.
   두 엔진 다 챕터의 적을 시작할 때 한꺼번에 만들어 두므로(노드 간격 560px, 창 사거리 ENEMY_GAP×8=352px)
   필터가 없으면 창이 다음 웨이브까지 꿰뚫는다. 발사 시점의 노드를 투사체에 박아 두고 그것만 때린다. */
function frontNode(G){let b=null;for(const n of G.nodes)for(const e of n.enemies)if(e.hp>0&&(!b||e.worldX<b.worldX))b=e;return b?b.wave:null;}
function randTarget(G){
  const p=G.player;
  const pool=aliveList(G).filter(e=>{const d=e.worldX-p.worldX;return d>-30&&d<540;});
  return pool.length?pick(pool):null;
}
/* 💫👟·💫👑 «가장 가까운 적» — 처치한 자리에서 가장 가까운 생존 적 하나 */
function nearestTo(G,ref,except){
  let b=null,bd=1e9;
  for(const e of aliveList(G)){ if(e===except)continue; const d=Math.abs(e.worldX-ref); if(d<bd){bd=d;b=e;} }
  return b;
}
/* over = 이 처치에서 «초과된 데미지»(오버킬). 🩸 오버킬 힐 · 🔧⚡ 오버킬 수리가 이 값을 쓴다. */
function onKill(G,e,over){
  if(e.dead)return;e.dead=true;
  const p=G.player,px=p.px;
  G.kills++;
  G.gold+=Math.round(TUNE.goldKill(G.chapter)*p.goldMul);
  if(p.killHeal>0)heal(p,p.maxHp*p.killHeal);                                   /* 🍖 처치 시 체력 5% (주인 확정 상수) */
  if(px.killShield3)repair(p,p.maxSh*0.05*px.killShield3);                      /* 장비 옵션 (axe옵6·robe옵2) */
  if(px.killShield10)repair(p,p.maxSh*0.10*px.killShield10);                    /* 장비 옵션 (robe옵5·amulet옵6) */
  if(px.aspdKill)addBuff(p,'aspd',0.20*px.aspdKill,4);                          /* 장비 옵션 */
  if(px.killCritBuff&&pkk(p,0.30*px.killCritBuff))addBuff(p,'critR',14,4);      /* 장비 옵션 */
  if(px.killDefBuff)addBuff(p,'def',10*px.killDefBuff,3);                       /* 장비 옵션 */
  if(px.killAspd)p.aspd*=1.01;                                                  /* 장비 옵션 */
  /* ⚑⚑⚑ T119 처치 시 트리거 (주인 확정 2026-09-04 13:0X) — «내가 처치했을 때» 다:
     평타·반격·소환 적중·가시 반사로 죽인 경우 전부(소환 적중 = 공격 판정 §3.0 · 반사 처치도 «내 처치» 로 본다 — 위임).
     그래서 **처치 시 소환이 다시 처치를 낳는 연쇄**가 생긴다 — 임계 B 는 `verifySummonChain` ⑤ 가 잰다.
     확률은 «같은 이름·다른 등급» 중 **최댓값**(위임 기본값 — mkPerks 주석 참조). */
  if(px.p_killSpear&&pkk(p,px.p_killSpear))fireSpear(p,1);
  if(px.p_killBolt&&pkk(p,px.p_killBolt))fireBoltsAll(p,e.wave);   /* ⚑ 대상 = 죽은 적이 속한 웨이브 (대기 웨이브·보스로 넘어가지 않는다) */
  if(px.p_killArrow&&pkk(p,px.p_killArrow))fireArrows(p,3);
  if(px.p_killAxe&&pkk(p,px.p_killAxe))fireAxe(p,2);
  /* ⚑ T119 오버킬 회복 (전설 3) — 처치한 타격의 «초과분» 100% 만큼 체력 회복.
     최대치 초과분은 `heal` 의 클램프로 버려지고, 주인 문면대로 «힐» 이라 회복 증폭의 영향을 받는다(noBoost 아님). */
  if(px.p_overkill&&over>0)heal(p,over);
  /* ⚑⚑⚑ T121 처치 시 트리거 5종 (주인 확정 16:0X ①) — 위 T119 트리거와 같은 «내가 처치했을 때» 자리다.
     회피 버프만 «갱신형»(중첩 아님 — 재발동 시 시간만 2초로 되돌린다)이고, 스택 2종은 이 판 동안 무한 누적한다.
     공격력 스택은 곱연산이라 `p.dmg` 를 직접 키우고(장비 옵션 killAspd 와 같은 방식), 회피 스택은 가산이라
     `p.evade` 를 키운다 — 상한 90 은 `effEvade` 의 엔진 규칙이 그대로 자른다. */
  if(px.p_killEvBuff)refreshBuff(p,'evade',PERK_KILLEV_A,PERK_KILLEV_T,'p_killEvBuff');
  if(px.p_killAtkStk&&pkk(p,PERK_KSTACK_CH))p.dmg*=1+PERK_KSTACK_ATK;
  if(px.p_killEvStk&&pkk(p,PERK_KSTACK_CH))p.evade+=PERK_KSTACK_EV;
  if(px.p_killHealN&&pkk(p,PERK_KHEAL_CH))heal(p,p.maxHp*PERK_KHEAL_F);
  if(px.p_killRepair&&pkk(p,PERK_KREPAIR_CH))repair(p,p.maxSh*PERK_KREPAIR_F);
  /* ⚑⚑⚑ T121 2차 처치 시 트리거 3종 (주인 확정 17:0X ×2 · 17:2X)
     ⓐ 확정 치명 — «다음 공격은 치명타 확률 +100%». 플래그 1개라 켜져 있는 동안 다시 처치해도 그대로고
        (스택 아님 — 주인 명시) **다음 평타에서** 소모된다. 광전사의 «치확 0 고정» 보다 우선한다(그 한 방만).
     ⓑ 버서커 — 스택은 여기서만 쌓이고 소모는 평타에서 한 번에 1개씩(8스택이 한 방에 +800% 가 아니라
        여덟 번의 공격이 각각 +100% — 주인 명시).
     ⓒ 대시 — **같은 웨이브에 살아 있는 다음 적이 있을 때만**. 웨이브 마지막 적을 죽였을 때
        다음 웨이브 첫 적으로는 대시하지 않는다(주인 명시) — 그래서 `e.wave` 안에서만 찾는다. */
  if(px.p_killSureCrit)p.sureCrit=true;
  if(px.p_berserkStk)p.bsStk++;
  if(px.p_killDash&&e.wave&&e.wave.enemies.some(x=>x.hp>0))p.dash=true;
  /* 웨이브 전멸 실드 충전 폐지 (PLAN §2.3 주인 지시) — 실드 충전은 특전으로만 */
  if(e.isBoss)G.cleared=true;   /* 클리어 확정을 먼저 — 보스 경험치로 레벨업해도 특전 3택 없음 (PLAN §2.4 주인 지시) */
  gainExp(G,(e.isBoss?TUNE.expBoss:TUNE.expKill)+(px.sage?1:0));
}
function gainExp(G,n){
  const p=G.player;
  p.exp+=n;
  while(p.exp>=TUNE.expNeed(p.level)){p.exp-=TUNE.expNeed(p.level);p.level++;if(!G.cleared)grantNextPerk(G);}
}
/* ⚑ T48 1단계 — 스턴 메커니즘 (주인 15:5X · PLAN §3.0).
   적은 원래 제자리 고정이라 «정지» 할 것이 공격뿐이다 — 스턴 중엔 근접 타격도 화살도 나가지 않는다.
   갱신 규칙(위임): 이미 스턴 중이면 «더 긴 쪽» 을 남긴다(합산 금지 — 합산이면 저등급 연타로 영구 스턴락).
   보스는 STUN_BOSS_MUL(1/3) 배 지속(주인 명시). index.html 과 같은 동사·같은 상수. */
function applyStun(G,e,sec){
  if(!e||e.hp<=0)return;
  let s=sec;
  if(e.isBoss)s*=STUN_BOSS_MUL;
  e.stun=Math.max(e.stun||0,s);
  G.stuns=(G.stuns||0)+1;
}
/* ⚑ T48 1단계 — 빗맞음(onMiss) 트리거 (주인 15:5X · PLAN §3.0).
   «적 회피 10% 로 내 공격이 빗나갔을 때» 발동. 적중률 금지 규칙과 공존 — 빗맞음을 없애는 것이 아니라
   빗맞음에서 이득을 얻는 축이다. 호출 지점은 빗맞음이 실제로 일어나는 두 곳(dealDmg · doCounter)뿐. */
function procOnMiss(G,e){
  const p=G.player,px=p.px;
  G.misses=(G.misses||0)+1;
  /* 장비 옵션 축 (구 키 — 수치 종전 그대로) */
  if(px.missAtk)addBuff(p,'atk',0.10*px.missAtk,3);
  if(px.missDef)addBuff(p,'def',10*px.missDef,3);
  if(px.missAspd)addBuff(p,'aspd',0.12*px.missAspd,2);
  if(px.missReset&&pkk(p,0.30*px.missReset))p.atkTimer=0;
  if(px.missRush){p.atkTimer=0;p.nextAtk=Math.min(1.5,Math.max(p.nextAtk,1.0));}
  if(px.missSpear&&pkk(p,0.20*px.missSpear))fireSpear(p,1);
}
/* 횟수형 방어막 — «적 공격 1회를 완전히 막아주는 방어막 1장». 5장이면 5번 막는다.
   ⚑ 주인 확정으로 **장수 상한 없음**. 수치형 실드(p.sh)와 별개 축이라 서로 간섭하지 않는다. */
function gainWard(p,ch){ if(ch&&pkk(p,ch))p.ward++; }   /* 상한 없음 — 주인 확정 «무한» */
/* ⚑ T48 2단계 — 원거리 피격 트리거 (주인 16:1X · PLAN §3.0).
   «적의 원거리 공격(화살)에 맞았을 때» 발동하는 별개 축이다 — 일반 «피격 시» 트리거와 배타가 아니라
   원거리 피격은 둘 다 굴린다(주인 위임 기본값). 회피에 성공하면 «맞은» 것이 아니라 굴리지 않는다. */
/* dmg = 그 화살로 실제로 «받은 피해». 🏹🌵 는 이 값의 100% 를 되돌린다. */
function procOnRanged(G,src,dmg){
  const p=G.player,px=p.px;
  if(px.rangeShield&&pkk(p,0.10*px.rangeShield))repair(p,p.maxSh*0.04);                     /* 장비 옵션 */
  if(px.rangeThorns&&src&&src.hp>0&&pkk(p,0.30*px.rangeThorns))reflect(G,src,effDmg(p)*0.8);/* 장비 옵션 */
  if(px.rangeBolt&&pkk(p,0.30*px.rangeBolt))fireBolts(p,1);                                 /* 장비 옵션 */
  if(px.rangeSpear&&pkk(p,0.10*px.rangeSpear))fireSpear(p,1);                               /* 장비 옵션 */
}
/* 반사 한 곳 — 반사는 «플레이어가 겨눈 타격» 이 아니라 적 회피를 타지 않는다(주인 확정 T43 위임 판단). */
function reflect(G,src,amt){ if(!src||src.hp<=0||amt<=0)return; src.hp-=amt; if(src.hp<=0)onKill(G,src,-src.hp); }
function dealDmg(G,e,ratio,fromBasic){
  if(e.hp<=0)return false;
  const p=G.player,px=p.px;
  const full=e.hp>=e.maxHp-0.5, stunned=e.stun>0;
  let cr=effCritR(p);
  if(px.fullHpCrit&&full)cr=Math.max(cr,62);                 /* 장비 옵션 */
  if(fromBasic&&p.nextCrit)cr=100;
  /* ⚑ T121 2차 «처치 시 확정 치명» — `effCritR` 이 광전사 때문에 0 이어도 여기서 100 으로 덮는다.
     주인 명시: «광전사(치확 0 고정) 상태에서도 그 한 방은 0% → 100% 가 된다». 치명타 트리거도 정상 발동한다. */
  if(fromBasic&&p.sureCrit)cr=100;
  const crit=Math.random()*100<cr;
  if(fromBasic&&p.nextCrit)p.nextCrit=false;
  if(fromBasic&&p.sureCrit)p.sureCrit=false;
  /* ⚑ 적 회피 10% (PLAN §2.3 주인 확정). 판정을 치명타 굴림 «뒤» 에 두는 이유:
     빗맞아도 그 «공격» 은 일어난 것이라 nextCrit(여기) 과 nextAtk(playerStrike) 가 함께 소모된다 — 위임 기본값.
     여기가 유일한 빗맞음 지점이므로 «빗맞음 트리거» 축도 이 자리에 붙는다. */
  G.atkTries++;
  if(Math.random()<ENEMY_EVADE){G.miss++;procOnMiss(G,e);return false;}
  /* ⚑ T121 치명 스택 — «한 대 때릴 때마다 치명확률 +1, 치명타 뜨면 초기화». 위임 기본값대로
     **평타 적중**만 센다(빗맞음은 위에서 이미 빠졌고, 반격·소환 적중은 `fromBasic` 이 아니다).
     굴림은 이 위에서 이미 끝났으므로 여기서 올린 스택은 «다음 평타» 부터 효과가 있다. */
  if(fromBasic&&px.p_critStack)p.critStk=crit?0:p.critStk+PERK_CSTACK_A;
  let d=effDmg(p)*ratio*(crit?effCritF(p)/100:1)*rand(0.92,1.08);
  /* 가산 보너스 풀 — «+n%» 로 적히는 데미지 보너스는 서로 합연산 (주인 정정 16:3X).
     스택형(빗맞음·회피)은 «적중 1타당 1개» 소모하고, 몇 장이 쌓여 있든 한 타에 한 번만 붙는다. */
  let addBonus=0;
  if(full&&px.firstHit)addBonus+=0.20*px.firstHit;           /* 장비 옵션 */
  if(full&&px.p_fullHp)addBonus+=PERK_FULLHP_A;              /* ⚑ T119 희귀 1 풀피 적 강타 — 데미지 +100% (가산 보너스 풀) */
  if(px.backDmg){                                            /* 장비 옵션 (순수 배수) */
    let front=null;for(const en of aliveList(G))if(!front||en.worldX<front.worldX)front=en;
    if(front&&e!==front)d*=3.2;
  }
  if(addBonus)d*=1+addBonus;
  if(px.execute&&e.hp<=e.maxHp*0.5)d*=2.2;                   /* 장비 옵션 */
  e.hp-=d;
  /* ⑦ 생명 흡수 — «준 피해의 10% 회복». `noBoost=true` 로 부른다: 주인 문면이 «준 피해의 10%» 라
     회복 증폭(장비 회복량 +n%)을 타지 않고, «실드는 안 채움» 조항대로 오버킬 수리 분기도 안 탄다.
     초과분은 `heal` 의 maxHp 클램프로 그냥 버려진다 (위임 판단 — 문면을 그대로 옮긴 것). */
  if(p.steal>0)heal(p,d*p.steal/100,true);
  if(crit){
    /* 장비 옵션 축 (구 키) */
    if(px.critChain)addBuff(p,'critR',5*px.critChain,3);
    if(px.critFsmall)addBuff(p,'critF',20*px.critFsmall,3);
    if(px.critFBuff)addBuff(p,'critF',34*px.critFBuff,4);
    if(px.critAtkBuff)addBuff(p,'atk',0.15*px.critAtkBuff,4);
    if(px.critAspdBuff)addBuff(p,'aspd',0.25*px.critAspdBuff,3);
    if(px.critHealS&&pkk(p,0.20*px.critHealS))heal(p,p.maxHp*0.05);
    if(px.critHeal3&&pkk(p,0.30*px.critHeal3))heal(p,p.maxHp*0.04);
    if(px.critReset&&pkk(p,0.45*px.critReset))p.atkTimer=0;
    if(px.stunCritM&&pkk(p,0.15*px.stunCritM))applyStun(G,e,3);
    if(px.stunCritL&&pkk(p,0.35*px.stunCritL))applyStun(G,e,3);
    /* ⚑ T121 치명타 시 스턴 I/II/III — 셋은 서로 다른 특전이라 **각각 따로 굴린다**(주인 명시).
       지속 3초·보스 1/3 은 `applyStun` 의 엔진 규칙 그대로다. */
    if(px.p_stunCritN&&pkk(p,PERK_STUNC_N))applyStun(G,e,PERK_STUNC_T);
    if(px.p_stunCritR&&pkk(p,PERK_STUNC_R))applyStun(G,e,PERK_STUNC_T);
    if(px.p_stunCritL&&pkk(p,PERK_STUNC_L))applyStun(G,e,PERK_STUNC_T);
    /* ⚑⚑⚑ T121 3차 «치명 시 창»(희귀 33% · 전설 66%)·«치명 시 번개»(전설 66%) — 주인 확정 17:5X·18:4X.
       셋 다 따로 굴린다. 광전사면 치명타 자체가 안 뜨므로 함께 죽는다(«처치 시 확정 치명» 한 방은 예외).
       ⚑ 이 셋이 **«치명타 시» 축에 처음 붙는 소환**이라 소환 적중 → 치명타 → 새 소환 연쇄가 생긴다 —
       `verifySummonChain` ⑥ 이 그 B 를 따로 잰다(주인 지시: 넘으면 깎지 말고 승인 대기에 등재). */
    /* ⚑ 성능 가드 — 이 셋은 «소환 적중 → 치명타 → 새 소환» 으로 자기를 다시 부를 수 있는 첫 축이다
       (번개는 즉발이라 한 호출 안에서 재귀한다). 그래서 소환 적중 트리거와 **같은 틱 예산**(PROC_TICK_CAP)을
       쓴다 — 주인이 명시 허용한 성능 가드 그대로이고(PLAN §3.0), 예산을 넘겨도 데미지는 그대로 들어간다.
       특전이 하나도 없으면 예산을 건드리지 않는다(종전 동작 불변). */
    if((px.p_critSpearR||px.p_critSpearL||px.p_critBoltL)&&G.procN<PROC_TICK_CAP){
      G.procN++;
      if(px.p_critSpearR&&pkk(p,PERK_CRITSP_R))fireSpear(p,1);
      if(px.p_critSpearL&&pkk(p,PERK_CRITSP_L))fireSpear(p,1);
      if(px.p_critBoltL&&pkk(p,PERK_CRITBOLT_L))fireBoltsAll(p,e.wave);
    }
    /* ⚑⚑⚑ T124 치명 세트 f «치명타 시 50% 확률로 도끼 1개» — 부위마다 따로 굴린다(풀셋 +3강이면 6번).
       «치명타 시» 축의 소환이라 T121 의 창·번개와 같은 연쇄를 낳는다 → 같은 틱 예산을 쓴다. */
    if(px.g_critAxe&&G.procN<PROC_TICK_CAP){
      G.procN++;
      for(let i=0;i<px.g_critAxe;i++) if(pkk(p,0.50))fireAxe(p,1);
    }
    gainWard(p,0.12*px.wardCrit);                            /* 장비 옵션 */
  }
  if(px.execKill&&!e.isBoss&&e.hp>0&&e.hp<=e.maxHp*0.25)e.hp=0;                 /* 장비 옵션 */
  if(e.hp<=0)onKill(G,e,-e.hp);
  if(fromBasic)cleave(G,e,d);
  return crit;
}
/* ⚑⚑⚑ T121 2차 관통 베기 I/II/III (주인 확정 17:4X) — «공격 시 바로 뒤 적도 같은 데미지».
   ⓐ 대상 = «타겟 다음으로 가까운 살아 있는 적, 같은 웨이브» — 다음 웨이브로는 안 번진다(T44 와 같은 축).
   ⓑ 데미지 = 그 평타가 타겟에게 준 값 **그대로**(치명타면 치명 값) — 여기서 다시 굴리지 않는다.
   ⓒ 뒤 적의 회피 10% 는 **따로 굴린다**(주인 명시).
   ⓓ 셋은 서로 다른 특전이라 **각각 따로 굴리고**, 셋 다 있으면 한 공격에 뒤 적이 최대 3번 맞는다(주인 명시).
   ⓔ **평타에만** 걸리고(소환·반격 제외 — `fromBasic` 게이트) 발동 한 번은 뒤 적 1마리에게 1회씩이라
      «뒤의 뒤» 로 번지지 않는다(`dealDmg` 를 다시 부르지 않고 체력을 직접 깎는 이유다). */
function cleave(G,tgt,dmg){
  const p=G.player,px=p.px;
  if(!(px.p_cleaveN||px.p_cleaveR||px.p_cleaveL)||dmg<=0)return;
  let back=null;
  for(const e of aliveList(G)){
    if(e===tgt||e.wave!==tgt.wave)continue;
    if(e.worldX<=tgt.worldX)continue;                 /* «뒤» = 타겟보다 먼 쪽 */
    if(!back||e.worldX<back.worldX)back=e;
  }
  if(!back)return;
  const hit=()=>{
    if(back.hp<=0)return;
    G.atkTries++;
    if(Math.random()<ENEMY_EVADE){G.miss++;procOnMiss(G,back);return;}
    back.hp-=dmg;
    if(back.hp<=0)onKill(G,back,-back.hp);
  };
  if(px.p_cleaveN&&pkk(p,PERK_CLEAVE_N))hit();
  if(px.p_cleaveR&&pkk(p,PERK_CLEAVE_R))hit();
  if(px.p_cleaveL&&pkk(p,PERK_CLEAVE_L))hit();
}
/* ⚑ 주인 확정(2026-09-02 15:3X) — 소환 적중도 «공격» 이다: 소환(창/도끼/화살/번개/검기)이 적을 맞히면
   «공격 시 n%» 트리거를 굴린다(창이 창을 부르는 연쇄 허용). «치명타 시» 트리거는 `dealDmg` 안에 있어
   기본공격 전용이 아니었으므로 소환 적중에도 이미 걸린다 — 즉 이 규칙에서 새로 추가되는 것은 «공격 시» 쪽이다.
   **기본공격 전용으로 남는 것은 `nextCrit`/`nextAtk` 소모 · 분신 · 추가타 셋뿐**(PLAN §4, 주인 위임).
   확률·연쇄 자체에는 인위적 제한을 두지 않는다(세면 T1 이 수치로 잡는다). 아래 둘은 주인이 명시 허용한 **성능 가드**다:
     · `PROJ_CAP`      동시 활성 투사체 상한 — 초과분은 «즉발 판정» 으로 대체(데미지는 사라지지 않는다).
     · `PROC_TICK_CAP` 한 틱에 굴리는 소환 적중 트리거 수 상한 — 번개처럼 즉발로 꼬리를 무는 연쇄가
       한 틱 안에서 무한히 자라는 것을 막는다(상한을 넘겨도 데미지는 그대로, 트리거만 안 굴린다).
   index.html 도 같은 상수·같은 동사를 쓴다(게이트가 두 파일을 대조한다). */
const PROJ_CAP=200, PROC_TICK_CAP=200;
function summonHit(G,e,ratio){
  dealDmg(G,e,ratio);
  if(G.procN<PROC_TICK_CAP){G.procN++;procOnAttack(G,e);}
}
/* 소환 적중 한 곳 — 투사체 해석 지점이 세 군데(주 루프 · pushProj 오버플로 즉발 · 관통 즉발)라
   동사를 하나로 모았다. 소환 개조 특전은 새 10종 체제에 없다(도끼·화살·창 모두 «1개 = 1발»). */
function projHit(G,pr,e){
  summonHit(G,e,pr.type==='axe'?R_AXE:pr.ratio);
}
function pushProj(G,pr){
  if(G.pprojs.length<PROJ_CAP){G.pprojs.push(pr);return;}
  if(pr.hit){                                   /* 관통형(창·검기): 사거리 안 적을 앞에서부터 pierce 마리 */
    const list=aliveList(G).filter(e=>(!pr.node||e.wave===pr.node)&&e.worldX>=pr.x-16&&e.worldX<=pr.maxX)
                           .sort((a,b)=>a.worldX-b.worldX);   /* pr.node = 미스폰·대기 웨이브 피격 금지 (주인 15:2X · T44) */
    for(const e of list.slice(0,pr.pierce))projHit(G,pr,e);
  }else if(pr.tgt&&pr.tgt.hp>0)projHit(G,pr,pr.tgt);
}
/* ⚑ 소환 발사 5종 — 발수 n 을 인자로 받는다(특전 텍스트의 «도끼 2개 / 화살 2발 / 번개 2회» 가 그대로 인자다).
   데미지 계수는 주인 확정 상수(R_AXE …)로 못 박혀 있고, 장비 옵션의 발수 증가(구 키)는 여기서 곱해진다. */
function fireAxe(p,n){const G=p.G;n=(n||1)*(p.px.axeCount?3:1);
  for(let k=0;k<n;k++){const t=randTarget(G);if(t)pushProj(G,{type:'axe',x:p.worldX+14,tgt:t,ratio:R_AXE,spd:430});}}
function fireArrows(p,n){const G=p.G,px=p.px;n=n||2;
  if(px.arrowCount)n=Math.round(n*1.5);            /* 장비 «화살 3발로 증가» (기본 2발 → 3발) */
  /* ⚑⚑⚑ T119 창의 화신 (전설 8) — «내가 쏘는 모든 화살이 창으로 바뀐다». 발사 동사 한 곳에서 갈아탄다:
     특전 화살(회피 시·처치 시)도 장비 화살 옵션도 전부 이 함수를 거치므로 여기 한 줄이면 «모든 화살» 이다.
     발수는 그대로이고 창 데미지(R_SPEAR 100%)·8마리 관통을 그대로 쓴다(주인 문면). */
  if(px.p_spearAvatar){fireSpear(p,n);return;}
  for(let k=0;k<n;k++){const t=randTarget(G);if(t)pushProj(G,{type:'parrow',x:p.worldX+14,tgt:t,ratio:R_ARROW,spd:560});}}
/* 번개는 즉발(하늘에서 떨어진다) — 투사체를 만들지 않는다. 연쇄 개조는 새 10종 체제에 없다. */
function fireBolts(p,n){const G=p.G,px=p.px;n=(n||1)*(px.boltCount?2:1);
  for(let k=0;k<n;k++){
    const t=randTarget(G);if(!t)continue;
    summonHit(G,t,R_BOLT);
  }}
/* ⚑⚑⚑ T119 «보이는 적 전부에게 번개 1회씩» — 주인 위임: «보이는 적» = 현재 교전 중인 웨이브의 살아 있는 적 전부
   (적은 고정 배치라 «화면에 보이는» = 그 웨이브다). 회당 공격력 75%(R_BOLT) 는 종전 번개와 같다.
   ⚑ 대상 웨이브는 **인자로 받는다** — 처치 시 번개는 «죽은 적이 속한 웨이브» 를 때린다.
     여기서 `frontNode` 를 다시 부르면 한 웨이브를 전멸시킨 순간 최전방이 **다음 웨이브**로 넘어가,
     연쇄가 화면 밖 대기 웨이브를 지나 **보스까지 즉사**시킨다(실측: 챕터 1 이 6.8초에 «클리어» 되고
     레벨업이 보스 사후라 특전이 1장만 남았다). 이는 T44 «관통형은 발사 시점의 노드만 때린다 —
     다음 웨이브 대기분은 절대 맞지 않는다»(주인 15:2X · PLAN §2.3)와 같은 축의 규칙이다.
   ⚑ 대상은 발동 시점에 굳힌다 — 연쇄로 죽어도 자리가 밀리지 않는다. */
function fireBoltsAll(p,node){const G=p.G;const nd=node||frontNode(G);if(!nd)return;
  const list=nd.enemies.filter(e=>e.hp>0);
  for(const e of list) if(e.hp>0) summonHit(G,e,R_BOLT);}
function fireWave(p,n){const G=p.G,px=p.px;n=n||1;
  const big=false;                                 /* 거대 검기 개조 특전은 새 10종에 없다 */
  const pierce=big?WAVE_PIERCE_BIG:(px.waveKing?20:WAVE_PIERCE);
  const reach=big?ENEMY_GAP*WAVE_PIERCE_BIG:(px.waveKing?WAVE_REACH_KING:WAVE_REACH);   /* ⚑ T163 — 사거리 = 간격 × 관통 마릿수 */
  for(let k=0;k<n;k++)pushProj(G,{type:'wave',x:p.worldX+14,ratio:R_WAVE,spd:470,maxX:p.worldX+reach,hit:new Set(),pierce,node:frontNode(G)});}
/* 창 관통 상한 8마리 — PLAN §3.0 «일직선 최대 8마리». 장비 «창 데미지» 옵션(spearMaster)은 계수만 올리고 관통 수는 그대로. */
function fireSpear(p,n){const G=p.G;n=n||1;
  for(let k=0;k<n;k++)pushProj(G,{type:'spear',x:p.worldX+14,ratio:p.px.spearMaster?13.5:R_SPEAR,spd:520,maxX:p.worldX+SPEAR_REACH,hit:new Set(),pierce:SPEAR_PIERCE,node:frontNode(G)});}
/* e = 이번 «공격» 이 맞힌 적 (스턴 축이 대상을 알아야 한다). 소환 적중에서도 불린다. */
function procOnAttack(G,e){
  const p=G.player,px=p.px;
  /* 장비 옵션 축 (구 키 — 수치 종전 그대로) */
  if(px.atkPerm&&pkk(p,0.10*px.atkPerm))p.dmg*=1.01;
  if(px.c_atkBuff&&pkk(p,0.30*px.c_atkBuff))addBuff(p,'atk',0.05,3);
  if(px.c_aspdBuff&&pkk(p,0.30*px.c_aspdBuff))addBuff(p,'aspd',0.05,3);
  if(px.aspdStack10&&pkk(p,0.25*px.aspdStack10))addBuff(p,'aspd',0.05,4);
  if(px.atkBuffM&&pkk(p,0.30*px.atkBuffM))addBuff(p,'atk',0.14,4);
  if(px.atkBuffL&&pkk(p,0.25*px.atkBuffL))addBuff(p,'atk',0.35,5);
  if(px.axe&&pkk(p,0.05*px.axe))fireAxe(p,1);
  if(px.arrow2&&pkk(p,0.05*px.arrow2))fireArrows(p,2);
  if(px.wave&&pkk(p,0.05*px.wave))fireWave(p,1);
  if(px.spear&&pkk(p,0.05*px.spear))fireSpear(p,1);
  if(px.bolt&&pkk(p,0.05*px.bolt))fireBolts(p,1);
  if(px.arsenal&&pkk(p,0.05*px.arsenal))pick([fireAxe,fireArrows,fireBolts,fireWave,fireSpear])(p,1);
  /* ⚑ T121 «공격 시 공속 버프» — 확률 없이 확정 발동이고 중첩형이라 기존 버프 엔진(무한 중첩)을 그대로 쓴다.
     소환 적중도 «공격» 이므로(PLAN §3.0) 이 자리에 두면 소환 적중에서도 함께 발동한다 — 위임 기본값. */
  if(px.p_aspdAtk)addBuff(p,'aspd',PERK_ASPDATK_A,PERK_ASPDATK_T);
  gainWard(p,0.10*px.wardAtk);
}
function doCounter(G,src,depth){
  const p=G.player,px=p.px;
  if(!src||src.hp<=0)return;
  /* 반격도 «플레이어의 타격» 이라 적 회피 10% 를 탄다 (PLAN §2.3 주인 명시 3종 중 하나).
     빗맞으면 반격 연쇄(counterChain)도 끊긴다 — 위임 기본값. */
  G.atkTries++;
  if(Math.random()<ENEMY_EVADE){G.miss++;procOnMiss(G,src);return;}
  let cd=effDmg(p)*0.7*(1+px.counterX);                          /* counterX = 장비 옵션 */
  /* ⚑⚑⚑ T121 2차 반격 축 2개 (주인 확정 17:0X) — 반격은 종전에 «치명타가 없는 타격» 이었다.
     ⓐ 반격 치명 I/II — **반격 타격에만** 치확을 가산한다(가산 · 둘 다면 +60). 평타 치확·버프는 안 섞는다
        (주인 문면 «반격 시 그 반격이 치명타일 확률 +20%» = 반격 자체의 확률). 치명 배율은 `effCritF` 그대로.
     ⓑ 반격 강화 I/II — 반격 데미지 곱연산(둘 다면 ×1.30 × ×1.60 — 주인 명시). */
  const ctCr=(px.p_ctCritN?PERK_CTCRIT_N:0)+(px.p_ctCritR?PERK_CTCRIT_R:0);
  if(ctCr&&Math.random()*100<ctCr)cd*=effCritF(p)/100;
  if(px.p_ctDmgN)cd*=PERK_CTDMG_N;
  if(px.p_ctDmgR)cd*=PERK_CTDMG_R;
  src.hp-=cd;
  /* 장비 옵션 축 (구 키) */
  if(px.counterAtkS)addBuff(p,'atk',0.05*px.counterAtkS,3);
  if(px.counterDefS)addBuff(p,'def',10*px.counterDefS,3);
  if(px.counterAtkM)addBuff(p,'atk',0.14*px.counterAtkM,4);
  if(px.counterCrit)addBuff(p,'critR',14,3);
  if(px.counterHeal)heal(p,p.maxHp*0.04*px.counterHeal);
  if(px.counterWave&&pkk(p,1.0*px.counterWave))fireWave(p,1);
  /* ⑦ 반격 시 창 — 반격 1회당 창 1개, 확정 발동 (쿨다운 없음 · ⚑ T108 로 50% → 100% · T109 로 순번 3 → 7) */
  if(px.p_spearCt&&pkk(p,PERK_SUMMON_CH))fireSpear(p,1);
  if(src.hp<=0)onKill(G,src,-src.hp);
  /* 🔂 반격하면 반드시 두 번 더 반격 — 연쇄 상한 3회(T69 의 «무한 연쇄 금지» 는 유지) */
  else if(px.counterChain&&!depth)doCounter(G,src,1);
}
function hitPlayer(G,dmg,isMelee,src){
  const p=G.player,px=p.px;
  if(Math.random()*100<effEvade(p)){
    /* ===== 회피 시 ===== */
    /* 장비 옵션 축 (구 키) */
    if(px.evadeEvBuff)addBuff(p,'evade',8*px.evadeEvBuff,3);
    if(px.evadeAspd)addBuff(p,'aspd',0.10,2);
    if(px.evadeDef)addBuff(p,'def',10*px.evadeDef,3);
    if(px.evadeAtkBuff)addBuff(p,'atk',0.28*px.evadeAtkBuff,5);
    if(px.evadeRush&&p.nextAtk<1.5)p.nextAtk=Math.min(1.5,p.nextAtk+0.5*px.evadeRush);
    if(px.evadeCrit)p.nextCrit=true;
    if(px.evadeHeal&&pkk(p,0.15*px.evadeHeal))heal(p,p.maxHp*0.07);
    if(px.evadeShield&&pkk(p,0.15*px.evadeShield))repair(p,p.maxSh*0.10);
    if(px.evadeCounter&&pkk(p,1.0*px.evadeCounter))doCounter(G,src);
    if(px.evadeAxe&&pkk(p,0.10*px.evadeAxe))fireAxe(p,1);
    /* ⚑⚑⚑ T124 회피 세트 — b «회피 시 50% 확률로 도끼 1개» · c «체력 50% 미만일 때 회피 시 30% 확률로 체력 10% 회복».
       둘 다 부위마다 따로 굴린다. c 의 체력 조건은 **회피 성공 순간의 체력 비율**로 본다(주인 문면). */
    for(let i=0;i<px.g_evAxe;i++) if(pkk(p,0.50))fireAxe(p,1);
    if(p.hp<p.maxHp*0.50) for(let i=0;i<px.g_evHeal;i++) if(pkk(p,0.30))heal(p,p.maxHp*0.10);
    gainWard(p,0.10*px.wardEvade);
    /* ⚑⚑⚑ T104 (주인 확정) — 1번 특전 «회피 시 회복»: 회피 성공마다 굴려서 최대 체력 비율만큼 회복.
       ⚑⚑⚑ T155 (주인 확정 18:5X) — 33%·12% 로 교체되면서 위임이 «회복 증폭 적용» 으로 통일됐다:
       II·III 과 같이 `heal(...)`(증폭 분기)을 탄다. 실드를 채우는 분기(healShield3/5·overheal)는
       지금 장비 옵션에 없는 죽은 키라 «실드 안 채움» 은 그대로다. */
    if(px.p_evadeHeal&&pkk(p,PERK_EVHEAL_CH))heal(p,p.maxHp*PERK_EVHEAL_F);
    /* ④ 회피 시 화살 I/II/III — ⚑ 17:5X 주인 정정으로 I 이 100% → 33% 가 되고 II(66%)·III(100%)가 생겼다.
       셋은 서로 다른 특전이라 **각각 따로 굴린다**(전부 있으면 한 번의 회피에 최대 3발). */
    if(px.p_arrowEv &&pkk(p,PERK_SUMMON_N))fireArrows(p,1);
    if(px.p_arrowEvR&&pkk(p,PERK_SUMMON_R))fireArrows(p,1);
    if(px.p_arrowEvL&&pkk(p,PERK_SUMMON_L))fireArrows(p,1);
    /* ⚑ T121 3차 «회피 시 창»(전설 33%) — 회피 축의 창 소환 (⚑ 17:5X) */
    if(px.p_spearEvL&&pkk(p,PERK_SUMMON_SP))fireSpear(p,1);
    /* ⚑ T121 3차 «회피 시 회복 II»(⚑ T155 로 66%)·«회피 시 수리 I/II»(희귀 15% · 전설 25%).
       ⚑ T155 로 I·II·III 셋이 다 증폭 분기를 탄다(«회복 증폭 적용»). 수리는 `repair` 가 증폭을 건다. */
    if(px.p_evHealR  &&pkk(p,PERK_EVHEAL_R))heal(p,p.maxHp*PERK_EVHEAL_F);
    if(px.p_evHealL  &&pkk(p,PERK_EVHEAL_L))heal(p,p.maxHp*PERK_EVHEAL_F);   /* ⚑ T155 «회피 시 회복 III» — 확정 발동 */
    if(px.p_evRepairR&&pkk(p,PERK_EVREP_R))repair(p,p.maxSh*PERK_EVREP_F);
    if(px.p_evRepairL&&pkk(p,PERK_EVREP_L))repair(p,p.maxSh*PERK_EVREP_F);
    /* ⚑⚑⚑ T121 회피 시 즉사 I/II/III (주인 확정 16:0X ①) — 셋은 서로 다른 특전이라 **각각 따로 굴린다**
       (5+10+15 을 합쳐 한 번 굴리지 않는다 — 주인 명시). 근접·원거리 둘 다이고 **보스도 포함**한다
       (옛 «사신의 낫» 관례를 그대로 잇는 위임 기본값 — 아니면 주인이 한 줄로 정정).
       즉사도 «내 처치» 라 `onKill` 을 거치므로 처치 시 트리거·경험치·골드가 그대로 발동한다. */
    /* ⚑ T121 2차 «회피 시 스턴» (주인 확정 16:5X) — 근접·원거리 모두(원거리는 «쏜 적») · 보스 1/3 */
    if(src&&src.hp>0&&px.p_evadeStun&&pkk(p,PERK_EVSTUN_CH))applyStun(G,src,PERK_STUNC_T);
    if(src&&src.hp>0&&px.p_execEvN&&pkk(p,PERK_EXEC_N)){src.hp=0;onKill(G,src,0);}
    if(src&&src.hp>0&&px.p_execEvR&&pkk(p,PERK_EXEC_R)){src.hp=0;onKill(G,src,0);}
    if(src&&src.hp>0&&px.p_execEvL&&pkk(p,PERK_EXEC_L)){src.hp=0;onKill(G,src,0);}
    /* ☠️🌾 사신의 낫 — 회피 시 20% 확률로 그 적 즉사. **보스 포함**(주인 명시).
       게임에는 낫이 베는 전용 연출이 붙는다(일반 처치 연기와 구별). */
    return;
  }
  /* ===== 맞았다 ===== */
  /* ⚑⚑⚑ T121 3차 (주인 확정 18:2X) — 판정 순서는 **회피 → 방어막 → 피해 무시 → 피해** 다.
     ⓐ 횟수형 방어막(`ward`)은 이 타격 «1회» 를 통째로 막고 1장 소모한다.
     ⓑ 그 뒤 «피해 무시»(일반 20%)와 «실드 방벽»(전설 · 실드 > 0 일 때 50%)을 **각각 따로** 굴린다.
     ⓒ 주인이 «방어막으로 막은 공격은 «피격» 이 아니다(피격 트리거·가시갑옷 발동 없음)» 라고 못 박았고
        «피해 무시» 도 같은 문면이라, 막히거나 무시된 타격은 여기서 **그대로 끝난다** —
        피격 트리거·가시갑옷·원거리 피격 축·반격까지 전부 굴리지 않는다(종전엔 방어막도 피격으로 쳤다). */
  if(p.ward>0){p.ward--;return;}
  const ign1=px.p_ignoreN&&pkk(p,PERK_IGN_N);
  const ign2=p.sh>0&&px.p_shWallL&&pkk(p,PERK_SHWALL_L);
  if(ign1||ign2)return;
  const hadSh=p.sh>0;                             /* 실드 반사 조건 — 실드 흡수 «전» 상태로 본다 */
  let d=dmg*(1-effDef(p)/100);
  if(px.guardCrystal&&p.sh>0)d*=0.80;
  /* ⚑⚑⚑ T119 가시갑옷 (주인 정의: «근접 적이 나를 때리면 그 적이 때린 데미지만큼 자기가 맞는다. 100% = 1배»).
     위임 기본값 — 기준 데미지 = 이 공격이 **나에게 실제로 준 피해**(방어 적용 후 · 실드로 받은 양 포함 ·
     회피했거나 방어막에 무효화됐으면 0)라 실드 흡수 «앞» 값이다. 대상은 **근접 공격만**(원거리 화살 제외).
     반사는 «공격» 이 아니므로 `reflect` 를 거친다(적 회피 안 탐 · 치명타·소환 트리거 없음). 보스에게도 적용. */
  const thornBase=d;
  if(p.sh>0){const ab=Math.min(p.sh,d);p.sh-=ab;d-=ab;}
  const taken=d;                                  /* 체력으로 실제로 들어간 피해 (반사 계산의 기준은 «받은 피해» 원본) */
  if(d>0){
    p.hp-=d;
    if(p.hp<=0){
      if(px.revive>0){px.revive--;p.hp=p.maxHp*0.05;p.sh=p.maxSh*0.05;}
      else{p.hp=0;G.dead=true;return;}
    }
  }
  /* 🚑 체력이 30% 아래로 떨어지면 실드 30% 즉시 충전 (판당 1번) */
  /* 장비 옵션 축 (구 키) */
  if(px.defHitBuff)addBuff(p,'def',3*px.defHitBuff,3);
  if(px.defBuff2&&pkk(p,0.30*px.defBuff2))addBuff(p,'def',14,4);
  if(px.defBuffL&&pkk(p,0.20*px.defBuffL))addBuff(p,'def',15,4);
  if(px.wallBuff)addBuff(p,'def',5,4);
  if(px.hitEvadeBuff&&pkk(p,0.22*px.hitEvadeBuff))addBuff(p,'evade',14,3);
  if(px.evadeHitBuff&&pkk(p,0.30*px.evadeHitBuff))addBuff(p,'evade',15,3);
  if(px.shieldOnHit&&pkk(p,0.05*px.shieldOnHit))repair(p,p.maxSh*0.05);
  if(px.hitHeal&&pkk(p,0.15*px.hitHeal))heal(p,p.maxHp*0.02);
  if(px.thornsS&&pkk(p,0.30*px.thornsS))reflect(G,src,dmg*0.70);
  if(px.thorns&&pkk(p,0.60*px.thorns))reflect(G,src,dmg*1.5);
  if(px.thornsKing)reflect(G,src,dmg*1.5);
  /* ⚑ T119 가시갑옷 — 가산 중첩(+100/+200/+300 = 최대 +600%).
     ⚑ T124 체력실드 세트 e «실드가 있을 때 가시갑옷 +12%» 도 같은 축에 **가산**으로 얹힌다 —
     조건은 피격 «전» 에 실드가 있었는지(`hadSh` · 실드 반사와 같은 기준)로 본다. */
  const thornM=px.p_thorns+(hadSh?px.g_thornSh:0);
  if(thornM&&isMelee&&src)reflect(G,src,thornBase*thornM);
  /* ⚑⚑⚑ T121 3차 «실드 반사»(전설 · 주인 확정 18:2X) — 실드가 있으면 피격 시 50% 로 그 데미지를 그대로 되갚는다.
     반사량 = 그 공격이 준 피해(방어 적용 «후» · 실드로 받은 양 포함) × 100% = 가시갑옷과 같은 기준값이다.
     근접·원거리 둘 다(원거리는 쏜 적) · 피해는 그대로 받는다(무시와 별개) · 가시갑옷과 중복된다(둘 다 되갚음). */
  if(px.p_shRefL&&hadSh&&src&&pkk(p,PERK_SHREF_L))reflect(G,src,thornBase);
  gainWard(p,0.08*px.wardHit);
  /* ⚑⚑⚑ T121 3차 «피격 시 방어막» I/II/III (주인 확정 18:2X) — 스택형·장수 무제한, 셋 다 따로 굴린다. */
  gainWard(p,px.p_wardHitN?PERK_WARD_N:0);
  gainWard(p,px.p_wardHitR?PERK_WARD_R:0);
  gainWard(p,px.p_wardHitL?PERK_WARD_L:0);
  if(px.stunHitS&&src&&pkk(p,0.20*px.stunHitS))applyStun(G,src,3);
  if(px.stunHitL&&src&&pkk(p,0.55*px.stunHitL))applyStun(G,src,3);
  /* ⑤ 피격 시 도끼 I/II/III — ⚑ 17:5X 주인 정정으로 I 이 100% → 33% 가 되고 II(66%)·III(100%)가 생겼다.
     셋은 서로 다른 특전이라 각각 따로 굴린다. «피격 시 창»(전설 33%)도 같은 축이다. */
  if(px.p_axeHit &&pkk(p,PERK_SUMMON_N))fireAxe(p,1);
  if(px.p_axeHitR&&pkk(p,PERK_SUMMON_R))fireAxe(p,1);
  if(px.p_axeHitL&&pkk(p,PERK_SUMMON_L))fireAxe(p,1);
  if(px.p_spearHitL&&pkk(p,PERK_SUMMON_SP))fireSpear(p,1);
  /* ⚑⚑⚑ T124 체력실드 세트 f «피격 시 50% 확률로 도끼 1개» (주인 20:0X) — 부위마다 따로 굴린다(풀셋 +3강이면 6번) */
  for(let i=0;i<px.g_hitAxe;i++) if(pkk(p,0.50))fireAxe(p,1);
  /* 원거리 피격 축 — 위 «피격 시» 트리거를 전부 굴린 «뒤» 에 추가로 굴린다 (별개 축, 주인 16:1X) */
  if(!isMelee)procOnRanged(G,src,dmg);
  if(isMelee&&src&&src.hp>0){
    const cc=Math.random()*100<effCounter(p);
    const pc=(px.hitCounter&&pkk(p,0.30*px.hitCounter))||(px.hitCounterS&&pkk(p,0.20*px.hitCounterS));
    if(cc||pc)doCounter(G,src);
  }
  void taken;
}
function playerStrike(G,e){
  const p=G.player,px=p.px;
  let ratio=1;
  if(p.nextAtk>0){ratio*=1+p.nextAtk;p.nextAtk=0;}
  /* ⚑ T121 2차 버서커 — 평타 1회당 스택 1 소모, 그 공격만 ×2(+100%). 반격·소환은 소모하지도 쓰지도 않는다(위임). */
  if(px.p_berserkStk&&p.bsStk>0){p.bsStk--;ratio*=PERK_BSTK_M;}
  const crit=dealDmg(G,e,ratio,true);
  if(px.clone&&e.hp>0)dealDmg(G,e,0.25);                       /* 장비 옵션 */
  if(crit&&px.extraHit&&pkk(p,0.75*px.extraHit)&&e.hp>0)dealDmg(G,e,2.3);   /* 장비 옵션 */
  procOnAttack(G,e);
  procNHit(p);
}
/* ⚑⚑⚑ T121 «N타마다» 특전표 (주인 확정 16:0X ① · 16:2X ⑤) — [px 키, 주기 N, 발동].
   같은 이름의 I/II/III 는 **서로 다른 특전**이라 카운터도 각자 센다(주인 명시).
   «N타» = 평타 횟수다 — 빗나감도 세고(위임 기본값: `playerStrike` 한 번 = 1타) 반격·소환은 안 센다.
   그래서 호출 지점이 `playerStrike` 끝 한 곳뿐이다 (`procOnAttack` 은 소환 적중에서도 불려 자격이 없다). */
const NHIT_PERKS=[
  ['p_nArrowN',PERK_NHIT_ARROW,p=>fireArrows(p,1)],
  ['p_nArrowR',PERK_NHIT_ARROW,p=>fireArrows(p,2)],
  ['p_nArrowL',PERK_NHIT_ARROW,p=>fireArrows(p,3)],
  ['p_nAxeN',  PERK_NHIT_AXE,  p=>fireAxe(p,1)],
  ['p_nAxeR',  PERK_NHIT_AXE,  p=>fireAxe(p,2)],
  ['p_nAxeL',  PERK_NHIT_AXE,  p=>fireAxe(p,3)],
  ['p_nBoltN', PERK_NHIT_BOLT, p=>fireBolts(p,1)],
  ['p_nBoltR', PERK_NHIT_BOLT, p=>fireBolts(p,2)],
  ['p_nBoltL', PERK_NHIT_BOLT, p=>fireBolts(p,3)],
  ['p_nSpearL',PERK_NHIT_SPEAR,p=>fireSpear(p,1)],
  ['p_nHealN', PERK_NHIT_HEAL, p=>heal(p,p.maxHp*PERK_NHEAL_F)],
];
function procNHit(p){
  const px=p.px;
  for(const t of NHIT_PERKS){
    if(!px[t[0]])continue;
    const c=(p.nhit[t[0]]||0)+1;
    if(c>=t[1]){p.nhit[t[0]]=0;t[2](p);}else p.nhit[t[0]]=c;
  }
}

/* ---------- 특전 획득 = «3개 중 1개 선택» (⚑⚑⚑ 주인 확정 2026-09-04 12:3X · T117 · PLAN §2.4·§3) ----------
   레벨업할 때마다 «아직 안 얻은» 특전 중 최대 `PERK_OFFER`(3)장을 뽑아 보여주고 하나를 고른다.
   남은 것이 3개 미만이면 남은 만큼만, 0개면 아무것도 주지 않는다. 한 특전은 한 번만(중복 금지).
   등급·등장 확률·무료 새로고침·전지의 눈은 T96 대로 그대로 폐지 상태다.
   ⚑⚑⚑ T150 — **악마의 거래는 이 3택을 쓰지 않는다.** 악마는 «남은 전설 특전 중 무작위 1개» 한 장을
   내놓고(`offerDevilPerk`·`devilPerkFor`), 비용 = 최대 체력 30% 차감은 그대로다. 확정 동사(`pickPerk`)만 공유한다.
   시뮬은 유저 대신 `simPickPerk` 정책(표 순서 우선)으로 고른다. */
function grantPerkChance(G){ G.perkChances++; }
/* 3장을 제시하고 시뮬 정책으로 한 장을 골라 지급한다. 지급했으면 그 특전을, 줄 게 없으면 null. */
function grantNextPerk(G){
  grantPerkChance(G);   /* 레벨업·악마 = 특전 기회 1번 (PLAN §4) */
  if(G.noPerk)return null;   /* 진단용 «특전 미획득» 자 — 사다리 회귀 대조에만 쓴다 */
  if(G.taken.length>=PERK_PICKS)return null;     /* 한 런 획득 상한(=PERK_PICKS)을 다 채우면 더는 안 준다 */
  /* ⚑⚑⚑ T120 — «기준 플레이어» 자(尺): 기존 일반 10종을 옛 순서대로 «되는 만큼» 자동 획득한다.
     3택 굴림을 아예 거치지 않으므로 **난수를 한 번도 안 쓴다** — T114 가 8/8 을 낸 그 스트림과 같다. */
  if(G.perkMode===PERK_MODE_LADDER){
    const p=PERKS_BASE10[G.taken.length];
    return p?pickPerk(G,p):null;
  }
  /* ⚑ T117 — 남은 것 중 3장 (판 난수) · ⚑ T119 — 카드마다 등급 굴림 + 귀족의 눈 반영 */
  const offer=offerPerks(G.taken,!!G.player.px.p_nobleEye);
  if(!offer.length)return null;                  /* 풀이 다 떨어졌다 — 팝업 없이 레벨업만 (주인 지시 ①) */
  return pickPerk(G,simPickPerk(offer));
}
/* ⚑⚑⚑ T150 — 악마가 이번에 내놓을 특전 **한 장**. 없으면 null(거래 불성립 · 비용도 안 낸다).
   가드는 종전 악마 분기의 둘을 그대로 옮긴 것이다: ①noPerk(특전 미획득 측정 제외분) ②한 런 획득 상한.
   ⚑ T120 사다리 자(尺)에서는 3택도 전설 뽑기도 거치지 않고 base10 다음 장을 그대로 받는다 —
   그래야 «사다리 측정은 난수를 한 번도 안 쓴다» 는 T114 스트림 불변이 유지된다. */
function devilPerkFor(G){
  if(G.noPerk)return null;
  if(G.taken.length>=PERK_PICKS)return null;
  if(G.perkMode===PERK_MODE_LADDER)return PERKS_BASE10[G.taken.length]||null;
  return offerDevilPerk(G.taken);
}

/* ---------- 챕터 1회 실행 ---------- */
function runChapter(chapter,build,opts){
  opts=opts||{};
  const G={chapter,player:null,nodes:[],pprojs:[],arrows:[],gold:0,kills:0,procN:0,
    perkChances:0,taken:[],overBoltCd:0,autoBoltT:3,stuns:0,misses:0,
    dead:false,cleared:false,t:0,atkTries:0,miss:0,   /* 적 회피 10% 실측용 (PLAN §2.3) */
    noPerk:!!opts.noPerk,
    /* ⚑⚑⚑ T120 — 특전 획득 자(尺). 기본 = 게임과 같은 3택, 사다리 측정 = «기준 플레이어»(base10). */
    perkMode:opts.perkMode||PERK_MODE_PLAY,
    /* ⚑⚑⚑ T160 — 재적합 자의 나머지 두 스위치. 기본값은 «게임 그대로»(undefined) 라 안 넘기면 종전 동작이다. */
    baseStats:opts.baseStats,
    gearOpts:opts.gearOpts};
  const p=mkPlayer(build,G);G.player=p;p.G=G;
  const layout=chapterLayout(chapter);
  let x=560,wi=0;
  for(const node of layout){
    const nd={type:node.t,x,done:false,enemies:[]};
    if(node.t==='wave'){
      const st=enemyStats(chapter,wi);
      for(let j=0;j<node.size;j++){
        const ranged=node.ranged[j];   /* ⚑ T105 — 챕터 시드로 이미 정해져 있다 (여기서 다시 굴리지 말 것) */
        nd.enemies.push({worldX:x+j*ENEMY_GAP,hp:st.hp,maxHp:st.hp,dmg:st.dmg,ranged,
          atkTimer:rand(0.4,1.2),stun:0,slow:0,wave:nd,dead:false,isBoss:false,exp:0});
      }
      wi++;x+=(node.size-1)*ENEMY_GAP+560;
    }else if(node.t==='boss'){
      const st=enemyStats(chapter,wi);
      const bh=st.hp*TUNE.bossHp,bd=st.dmg*TUNE.bossDmg;   /* 챕터 무관 항상 동일 (PLAN §6 주인 확정) */
      nd.enemies.push({worldX:x+60,hp:bh,maxHp:bh,dmg:bd,ranged:false,
        atkTimer:1.2,stun:0,slow:0,wave:nd,dead:false,isBoss:true,hits:0});
    }else x+=470;
    G.nodes.push(nd);
  }
  const dt=1/30;
  const maxT=900;
  while(!G.dead&&!G.cleared&&G.t<maxT){
    G.t+=dt;
    G.procN=0;   /* 성능 가드: 소환 적중 트리거 예산은 틱마다 리셋 (PROC_TICK_CAP) */
    if(G.overBoltCd>0)G.overBoltCd-=dt;
    for(const k in p.buffs){const arr=p.buffs[k];for(let i=arr.length-1;i>=0;i--){arr[i].t-=dt;if(arr[i].t<=0)arr.splice(i,1);}}
    const alive=aliveList(G);
    if(!alive.length)break;
    /* 이벤트 */
    let ev=false;
    for(const n of G.nodes){
      if(!n.done&&(n.type==='rest'||n.type==='devil'||n.type==='angel')&&p.worldX>n.x-95){
        n.done=true;ev=true;
        if(n.type==='rest'){
          /* ⚑ 주인 확정(2026-09-02 16:4X · PLAN §7): 가상 플레이어는 쉼터에서 «항상 🌟 경험치» 를 고른다.
             체력 회복 분기는 시뮬에서 금지 — 전 실험(1~5·사다리·하니스) 공통 측정 조건.
             실제 게임(index.html)은 유저 자유 선택이므로 두 선택지를 그대로 둔다.
             ⚑ 주인 확정(17:1X · PLAN §2.4 · T49): 보상이 «체력 260 회복(고정값) vs 경험치 +26» 으로 개정됐다. */
          gainExp(G,REST_EXP);        /* SIM_REST_POLICY: 항상 경험치 (게이트 tools/verifyRestPolicy.js 가 감시) */
        }else if(n.type==='devil'){
          /* SIM_DEVIL_POLICY: ⚑ 주인 확정(2026-09-03 · PLAN §2.4 · T90) — 가상 플레이어는 악마 거래를 **항상 수락**한다
             (승인 대기 32번 종결. 쉼터 «항상 경험치» 와 같은 축의 측정 조건 통일 — 체력 조건부 수락은 폐기).
             실제 게임(index.html)은 유저 자유 선택이므로 두 선택지를 그대로 둔다. */
          /* ⚑⚑⚑ T150 (주인 확정 2026-09-05 17:4X) — 악마가 주는 것은 **«전설 특전 1개»** 다.
             T117 의 «즉시 3택 1» 은 폐기 — 고를 것이 없으니 카드 한 장을 받고 값을 치를 뿐이다.
             줄 전설이 남아 있을 때만 거래가 성립한다 — 없으면 카드도 비용도 없이 지나간다(위임 그대로).
             비용(최대체력 30% 차감)·«항상 수락» 정책은 T90 그대로다. */
          const dp=devilPerkFor(G);
          if(dp){
            payDevilCost(p);   /* 비용 = 최대체력의 30% 를 «최대치에서» 차감 (현재체력 차감 아님) */
            grantPerkChance(G);   /* 악마 = 특전 기회 1번 (PLAN §4 · 레벨업과 같은 셈) */
            pickPerk(G,dp);
          }
        }else{
          /* SIM_ANGEL_POLICY: ⚑ 주인 확정(2026-09-03 · PLAN §2.4 · T90) — 가상 플레이어는 천사에서
             **항상 왼쪽(무료 공격력 +5%)** 을 고른다. 광고 분기(+15%)는 시뮬에 존재 금지(측정 조건 통일). */
          p.dmg*=1.05;
        }
        break;
      }
    }
    if(ev)continue;
    /* 플레이어 */
    alive.sort((a,b)=>a.worldX-b.worldX);
    const tgt=alive[0];
    const dist=tgt.worldX-p.worldX;
    /* ⚑ T121 2차 «처치 시 대시» — 사거리(74px)에 닿을 때까지만 이동 속도 ×DASH_MUL. 데미지·무적 없고
       원거리 화살은 그대로 맞는다(주인 «대시 데미지 없음 · 빨리 가서 공격하는 느낌»). 닿으면 플래그가 꺼진다. */
    if(dist>74){p.worldX+=132*p.walkMul*(p.dash?DASH_MUL:1)*dt;p.atkTimer=Math.min(p.atkTimer,0.35);}
    else{p.dash=false;p.atkTimer-=dt*effAspd(p);if(p.atkTimer<=0){p.atkTimer+=1;playerStrike(G,tgt);}}
    if(p.px.autoBolt){G.autoBoltT-=dt;if(G.autoBoltT<=0){G.autoBoltT=3;fireBolts(p,p.px.autoBolt);}}   /* 장비 옵션 */
    /* ⚑ T96 — 주기형 자동 소환(⏰ 3종)·공속 램프(🎻)는 특전과 함께 폐지됐다.
       주기형 «공격» 축에 남는 것은 장비 옵션 `autoBolt`(위 3초) 하나뿐이다. */
    /* 적 */
    for(const e of alive){
      if(e.hp<=0)continue;
      /* ⚑ 스턴 (T48) — 남은 시간을 줄이고, 스턴 중이면 이번 틱 공격을 통째로 건너뛴다.
         공격 타이머는 흐르지 않는다(스턴이 풀리자마자 밀린 공격이 몰아치지 않게 — 위임 기본값). */
      if(e.stun>0){
        e.stun-=dt;
        /* ⛓️ 스턴이 끝난 적은 3초간 공격속도 -50% */
        continue;
      }
      if(e.slow>0)e.slow-=dt;
      const d=e.worldX-p.worldX;
      const ivm=(e.slow>0?2:1);                            /* 둔화 — 적 상태 축만 남는다 */
      if(!e.ranged){
        if(d<105){
          e.atkTimer-=dt;
          if(e.atkTimer<=0){
            e.atkTimer+=(e.isBoss?1.6:1.3)*ivm;
            let dm=e.dmg;
            if(e.isBoss){e.hits++;if(e.hits%3===0)dm*=2.2;}
            hitPlayer(G,dm,true,e);
            if(G.dead)break;
          }
        }
      }else if(d<440&&d>40){
        e.atkTimer-=dt;
        if(e.atkTimer<=0){e.atkTimer+=2.1*ivm;G.arrows.push({x:e.worldX-18,dmg:e.dmg,friendly:p.misfire>0&&Math.random()<p.misfire,src:e});}
      }
    }
    if(G.dead)break;
    /* 화살 */
    for(let i=G.arrows.length-1;i>=0;i--){
      const a=G.arrows[i];a.x-=330*dt;let hit=false;
      if(a.friendly){
        for(const e of alive){
          if(e!==a.src&&e.hp>0&&Math.abs(e.worldX-a.x)<16&&e.worldX<a.src.worldX){
            e.hp-=a.dmg*2;if(e.hp<=0)onKill(G,e,-e.hp);hit=true;break;
          }
        }
      }
      if(!hit&&a.x<=p.worldX+8){hitPlayer(G,a.dmg,false,a.src);hit=true;}
      if(hit||a.x<p.worldX-60)G.arrows.splice(i,1);
    }
    if(G.dead)break;
    /* 아군 투사체 */
    for(let i=G.pprojs.length-1;i>=0;i--){
      const pr=G.pprojs[i];pr.x+=pr.spd*dt;let done=false;
      if(pr.type==='spear'||pr.type==='wave'){
        for(const e of aliveList(G)){
          if(pr.node&&e.wave!==pr.node)continue;   /* 미스폰·대기 웨이브 피격 금지 (주인 15:2X) */
          if(!pr.hit.has(e)&&Math.abs(e.worldX-pr.x)<16){
            pr.hit.add(e);projHit(G,pr,e);
            if(pr.hit.size>=pr.pierce){done=true;break;}
          }
        }
        if(pr.x>pr.maxX)done=true;
      }else{
        if(!pr.tgt||pr.tgt.hp<=0)done=true;
        else if(pr.x>=pr.tgt.worldX-10){projHit(G,pr,pr.tgt);done=true;}
      }
      if(done)G.pprojs.splice(i,1);
    }
  }
  return {clear:G.cleared,time:G.t,gold:G.gold,taken:G.taken.map(t=>t.id),level:p.level,atkTries:G.atkTries,miss:G.miss};
}

/* ---------- 계정 진행 모델 (장비 + 슬롯 + 다이아) ---------- */
/* 실험3·4 가 공유하는 경제 코어. 한 판(=1 attempt) 마다 다이아 dailyGem/runsPerDay 적립. */
function newAccount(startGem){
  const slots={}; for(const pt of GT.parts) slots[pt]=0;
  return {gold:0, gem:startGem||0, inv:[], slots, gacha:newGacha(), eq:{}, pulls:0, fuses:0};
}
function accBuild(a){ return {eq:a.eq, slots:a.slots}; }
function accRefresh(a){
  a.fuses+=fuseAll(a.inv,new Set());     /* 장착 중 장비도 매번 재산정하므로 전체 대상으로 합성 후 재장착 */
  a.eq=autoEquip(a.inv);
}
function accPull(a){
  let n=0;
  /* ⚑ T125 — `gachaPull` 이 배열을 돌려준다(겹침 회차는 2개). `n` 은 «뽑은 횟수»(비용 기준)라 그대로 1씩 센다. */
  while(a.gem>=GT.pullCost){ a.gem-=GT.pullCost; for(const g of gachaPull(a.gacha)) a.inv.push(g); n++; a.pulls++; }
  if(n)accRefresh(a);
  return n;
}
function accBuySlots(a){
  /* 균등 보너스(§11.4) 유도: 항상 최저 레벨 슬롯부터 올린다 */
  let bought=0;
  for(;;){
    let lo=null;
    for(const pt of GT.parts) if(lo===null||a.slots[pt]<a.slots[lo]) lo=pt;
    if(a.slots[lo]>=GT.slotLvMax)break;          /* ⚑ T35: 슬롯 레벨 상한 150 (주인 확정) */
    const c=GT.slotCost(a.slots[lo]);
    if(a.gold<c)break;
    a.gold-=c; a.slots[lo]++; bought++;
  }
  return bought;
}
function accAttempt(a,chapter){
  const r=runChapter(chapter,accBuild(a),{});
  a.gold+=r.gold;
  if(r.clear)a.gold+=TUNE.goldClear(chapter);
  a.gem+=GT.dailyGem/GT.runsPerDay;
  accPull(a); accBuySlots(a);
  return r;
}
const slotStr=a=>GT.parts.map(pt=>a.slots[pt]).join('/');
function eqStr(a){
  return GT.parts.map(pt=>{const g=a.eq[pt];return g?`${GT.rarName[g.rar]}${g.plus?'+'+g.plus:''}`:'—';}).join('/');
}

/* ---------- 실험들 ---------- */
/* ⚑ T96 — 실험1·2 의 «하니스»(harness()/hCh(), 변별점 규칙 ①~⑤)는 등급 고정 실험과 함께 사라졌다.
   새 과녁 2점은 주인이 장비·챕터를 **직접 못박았으므로**(희귀 풀셋·슬롯0·챕터15 / 노장비·챕터4)
   «변별 구간에 앉도록 하니스를 재선정한다» 는 절차 자체가 성립하지 않는다 — 자가 고정이다.
   `tools/verifyHarness.js` 도 같은 이유로 대상이 사라졌다(T96 3단계 게이트 대개편 몫). */
/* ⚑⚑⚑ 실험1 = «난이도 사다리 7점» (주인 확정 2026-09-03 · T103 이 과녁 2점을 이 표로 갈아끼웠다
   · ⚑ T153 으로 영웅 칸이 빠져 8점 → **7점**) ----------
   **종전의 과녁 2점(표준 ch15 = 10% · 노장비 ch4 = 30%)은 주인 지시로 이 사다리에 흡수됐다.**
   주인 원문 사다리: 노템 5 · 일반 15 · 희귀+슬롯5 28 · 전설+슬롯15 70 ·   (⚑ T153 — 영웅 칸 40 삭제)
   신화+슬롯25 150 · 신화9강+슬롯50 380 · 신화9강+슬롯100 **420**(⚑ 주인 정정 — 종전 600 폐기).
   7칸 전부 **클리어율 10% · 허용 오차 ±2%p** 이고, 판수는 과녁당 1,000판 이상 · 고정 시드 3벌이다.
   자(尺)에 «등급 고정» 이 없다 — 특전은 순서 획득이라 런마다 같은 순서로 10종이 붙는다.
   ⚑ 종전엔 실험1(과녁)과 실험5(사다리)가 서로 다른 표를 봤다 — 이제 **표가 하나**이고 실험5 는
     같은 7칸을 «슬롯 0렙» 진단으로 다시 보는 자리로만 남는다.
   ⚠ 이 함수는 **재는 자일 뿐 맞추는 것은 TUNE** 이다(난이도 노브 = 구간 성장률·벽 배수·기저). */
/* ⚑⚑⚑ T160 (주인 확정 2026-09-05 20:2X · 20:3X 정정 3건) — 과녁 챕터를 새 표로 갈아끼웠다.
   주인 원문: «노템 3 · 일반 7 · 희귀 15 · 전설 30 · 신화 60 · 신화 9강 100 · 신화 9강 슬롯100 은 125 정도».
   빌드·슬롯은 **한 칸도 안 바뀐다**(20:3X «슬롯 그것도 전에 그 기준») — 움직인 것은 과녁 챕터뿐이고,
   맞추는 노브는 적 스탯(기저·구간률·벽)이다. 종전 표(5·15·28·70·150·380·420)는 이 표로 대체됐다. */
const EXP1_TARGETS=[
  {id:'노템(장비0·슬롯0)',        rar:-1,plus:0, slot:0,   at:3,   want:10},
  {id:'일반 풀셋(슬롯0)',          rar:0, plus:0, slot:0,   at:7,   want:10},
  {id:'희귀 풀셋·슬롯5',           rar:1, plus:0, slot:5,   at:15,  want:10},
  /* ⚑⚑⚑ T153 — «영웅 풀셋·슬롯10» 칸은 **장비 등급이 사라져 삭제**했다(8점 → 7점). */
  {id:'전설 풀셋·슬롯15',          rar:2, plus:0, slot:15,  at:30,  want:10},
  {id:'신화 풀셋·슬롯25',          rar:3, plus:0, slot:25,  at:60,  want:10},
  {id:'신화+9강 풀셋·슬롯50',      rar:3, plus:9, slot:50,  at:100, want:10},
  {id:'신화+9강 풀셋·슬롯100',     rar:3, plus:9, slot:100, at:125, want:10},
];
/* ⚑⚑⚑ T160 — 사다리 측정 조건(주인 확정 ②). 실험1·5 와 `fitLadder`·게이트가 **같은 이 상수**를 넘긴다.
   자를 한 곳에서만 정의해야 «어떤 도구는 옵션을 켠 채 쟀다» 가 안 생긴다. */
const LADDER_OPTS={perkMode:PERK_MODE_LADDER, baseStats:'legacy20', gearOpts:false};
/* 사다리 7칸의 확정 총 스탯 (주인 표 — 공/체/실. 진단 출력의 대조용이고 판정은 클리어율로만 한다)
   ⚑ T153 — 영웅 칸(챕터 40)이 빠졌다. 남은 칸의 값은 그대로다. */
/* ⚑ T160 — 빌드는 그대로이므로 값도 그대로다. 키(과녁 챕터)만 새 표로 옮겼다. */
const LADDER_STAT={3:[25,150,250], 7:[50,250,400], 15:[108.9,543.4,868.9],
  30:[524.7,2619.1,4188.9], 60:[3742.2,18703.1,29921.9], 100:[106912,533475,853125], 125:[190050,948300,1516500]};
const EXP1_TOL=2;                  // ±%p (주인 확정)
const EXP1_SCORE_N=1000;           // 과녁당 채점 판수 하한 (주인 확정 «1,000판 이상»)
/* ⚑⚑⚑ T120 — 실험1 은 **언제나 «기준 플레이어»(`PERK_MODE_LADDER`)로 잰다**. 이것이 주인 확정 ① 의 자다.
   `EXP1_PERKMODE=3pick` 는 «3택 조건이면 얼마나 되나» 를 같이 찍어 보는 **참고표 전용 진단 스위치**이고
   판정 자가 아니다(주인 확정 ③ — 참고표는 판정 아님). 기본값은 반드시 `PERK_MODE_LADDER` 여야 한다
   (게이트 `verifyScoreCriteria` ⓔ 가 이 배선을 소스에서 대조한다). */
const EXP1_PERKMODE=process.env.EXP1_PERKMODE||PERK_MODE_LADDER;
function exp1_targets(){
  const N=parseInt(process.env.EXP1_N||String(EXP1_SCORE_N),10);
  const span=parseInt(process.env.EXP1_SPAN||'0',10);   /* >0 이면 과녁 ±span 챕터도 함께 찍는다(탐색용) */
  const modeNm=EXP1_PERKMODE===PERK_MODE_LADDER?'기준 플레이어(일반 10종 옛 순서 자동 획득 · 3택 없음)':`참고(${EXP1_PERKMODE})`;
  console.log(`\n=== 실험1: 난이도 사다리 7점 (주인 확정 · 각 ${N}판 · ${modeNm} · 허용 ±${EXP1_TOL}%p) ===`);
  const rows=[];
  for(const T of EXP1_TARGETS){
    const b=mkBuild(T.rar,T.plus,T.slot);   /* rar<0 = 노장비 (사다리 «노템» 칸과 같은 자) */
    const pw=buildPower(b);
    const wt=LADDER_STAT[T.at];
    console.log(`\n  [${T.id}] → 과녁 챕터 ${T.at} · ${T.want}%`);
    console.log(`    스탯: 공 ${pw.atk.toFixed(1)} / 체 ${pw.hp.toFixed(1)} / 실 ${pw.sh.toFixed(1)}`+
      (wt?`  (확정표 ${wt.join('/')})`:''));
    for(let c=T.at-span;c<=T.at+span;c++){
      if(c<1)continue;
      let w=0;
      for(let i=0;i<N;i++) if(runChapter(c,b,Object.assign({},LADDER_OPTS,{perkMode:EXP1_PERKMODE})).clear)w++;   /* ⚑ T120 자 = 기준 플레이어 · ⚑ T160 기본 스탯 20 + 세트 옵션 끔 */
      const rate=w/N*100, d=rate-T.want, ok=Math.abs(d)<=EXP1_TOL;
      const tag=c===T.at?(ok?'   ← 과녁 ✓':`   ← 과녁 ✗(${T.want}±${EXP1_TOL}%)`):'';
      console.log(`    챕터 ${String(c).padStart(3)}: 클리어율 ${rate.toFixed(1)}%${tag}`);
      if(c===T.at) rows.push([T.id,T.at,T.want,rate,d,ok]);
    }
  }
  console.log(`\n  — 과녁 판정 —`);
  console.log('  | 조건 | 과녁 챕터 | 과녁 | 실측 | 편차 | 판정 |');
  console.log('  |---|---|---|---|---|---|');
  let pass=0;
  for(const [id,at,want,rate,d,ok] of rows){
    if(ok)pass++;
    console.log(`  | ${id} | ${at} | ${want}% | ${rate.toFixed(1)}% | ${(d>=0?'+':'')+d.toFixed(1)}%p | ${ok?'✓':'✗'} |`);
  }
  console.log(`  과녁 합격 ${pass}/${EXP1_TARGETS.length}`);
}
/* ⚑ 실험2(«등급 내 폭») 는 T96 에서 폐지됐다 — 등급이 사라져 «등급 안에서의 최상−최하» 라는
   측정 대상 자체가 없다. 특전이 고정 10종·순서 획득이라 «어떤 특전을 뽑았나» 라는 변량도 없다.
   모드 2 는 자리를 비워 두되(번호 재사용 금지 규약과 같은 취지) 왜 비었는지 말하고 끝낸다. */
function exp2_retired(){
  console.log('\n=== 실험2: 폐지 (T96 · 2026-09-03 주인 확정) ===');
  console.log('  등급·선택창이 사라져 «등급 내 폭» 은 측정 대상이 없다. 새 과녁은 실험1(난이도 사다리 7점)이다.');
}

function exp3_progression(){
  const MAXC=parseInt(process.env.EXP3_MAX||String(TUNE.maxChapter),10);
  /* ⚑ T75 — «하니스 재시도 상한» 과 «채점 목표 상한» 은 다른 숫자여야 한다 (종전엔 둘 다 400 이었다).
     같은 숫자였을 때 생긴 두 결함:
     ① 벽 목표 «30~400회» 가 실제로는 «30~399회» 였다 — 400 에 닿은 셀은 언제나 «400회 실패» 로 적혀
        `tools/scoreExp3.js` 가 무조건 부적합으로 세기 때문이다(목표 상한이 원리적으로 도달 불가능).
     ② 400 에서 끊긴 계정이 «401회면 뚫었을» 계정인지 «4,000회여도 못 뚫을» 계정인지 구별되지 않았다.
        벽을 올리면 그 뒤 챕터가 되레 쉬워지는 관측(재시도가 곧 수입)도 이 절단이 만든 착시다.
     그래서 상한을 목표 상한보다 넉넉히 위(1,000회)에 두고 «400 초과 = 진짜 목표 미달» 을 **관측**한다.
     채점 목표 400 은 `tools/scoreExp3.js` BANDS 에 그대로 있고, 두 숫자가 다시 같아지면
     게이트 `verifyScoreCriteria`(상한 대소 단언)와 `verifyScoreExp3` ⑧~⑪ 가 빨개진다.
     ⚠ 자(尺)를 고친 것이라 **T75 이전 회차의 실험3 총점과 직접 비교 금지** (T67 선례와 같은 취급). */
  const EXP3_TRY_LIMIT=1000;   // 하니스 재시도 상한 (채점 목표 상한 400 보다 반드시 커야 한다)
  const LIMIT=parseInt(process.env.EXP3_LIMIT||String(EXP3_TRY_LIMIT),10);
  console.log(`\n=== 실험3: 전체 진행 시뮬 (챕터 1→${MAXC}, 재시도 상한 ${LIMIT}회, 골드=슬롯강화 · 다이아=뽑기 자동) ===`);
  const a=newAccount(0);
  let total=0;
  for(let c=1;c<=MAXC;c++){
    let attempts=0,cleared=false;
    while(!cleared&&attempts<LIMIT){
      attempts++;total++;
      if(accAttempt(a,c).clear)cleared=true;
    }
    const pw=buildPower(accBuild(a));   /* R07 진단: 전투력이 챕터를 따라 자라는지(=성장 축이 살아있는지) 확인용 */
    console.log(`챕터 ${String(c).padStart(3)}: 시도 ${String(attempts).padStart(3)}회  슬롯 ${slotStr(a)}  장비 ${eqStr(a)}  뽑기 ${a.pulls}회  전투력 공${pw.atk.toExponential(2)}·체${pw.hp.toExponential(2)}  ${cleared?'':'** '+LIMIT+'회 실패 **'}`);
    if(!cleared)break;
  }
  console.log(`총 시도: ${total}  (환산 ${(total/GT.runsPerDay).toFixed(0)}일)`);
}
/* ---------- 실험4: F2P 일 단위 장비 진행 (PLAN §7) ---------- */
function exp4_gearProgress(){
  const DAYS=parseInt(process.env.EXP4_DAYS||'365',10);
  const IAP=process.env.EXP4_IAP==='1';
  const STUCK=parseInt(process.env.EXP4_STUCK||'40',10);
  console.log(`\n=== 실험4: 장비 진행 (하루 다이아 ${GT.dailyGem} · ${GT.runsPerDay}판/일 · ${DAYS}일${IAP?' · 과금 '+GT.iapGem+'다이아 1회':''}) ===`);
  const a=newAccount(IAP?GT.iapGem:0);
  let chap=1,total=0,tries=0,stuckFrom=-1,stuck=0;
  /* ⚑ T1 R02 — 합격 기준 ①(«20일=600판 연속 실패» 정체 없음)을 «추정» 이 아니라 «측정» 으로 판정하려고 신설했다.
     종전 출력은 30일 눈금뿐이라, 구간 평균이 임계의 75% 여도 그 안에서 600판 연속 실패가 있었는지 알 수 없었다
     (R02 비평가 2인이 독립적으로 같은 한계를 지적했다 — «①은 검증 자체가 불가능하다»). 챕터별 최장 연속 실패 판수를 센다. */
  let worstCh=0,worstTries=0;
  const marks=[1,3,7,14,30,60,90,120,150,180,240,300,365];
  /* ⚑ T1 R03(T59) — `chap <= maxChapter` 가드. 이게 없으면 계정이 콘텐츠가 없는 301+ 로 계속 올라가고,
     기준①(정체)이 «경제가 막혔다» 가 아니라 «게임이 끝났다» 를 재게 된다. R02 까지는 계정이 250~290 장에
     머물러 드러나지 않았는데, R03 이 곡선·경제를 풀자 실제로 넘어갔다(F2P 365일차 315·350·348장). */
  let doneDay=0;
  for(let d=1;d<=DAYS&&!doneDay;d++){
    for(let k=0;k<GT.runsPerDay;k++){
      total++;tries++;
      if(accAttempt(a,chap).clear){ if(tries>worstTries){worstTries=tries;worstCh=chap;} chap++; tries=0;
        if(chap>TUNE.maxChapter){ doneDay=d; break; } }
    }
    if(marks.includes(d)){
      const my=GT.parts.filter(pt=>a.eq[pt]&&a.eq[pt].rar===GT.RAR_MYTH).length;
      console.log(`  ${String(d).padStart(3)}일차: 챕터 ${String(chap-1).padStart(3)} 클리어  슬롯 ${slotStr(a)}  신화 ${my}/6  장비 ${eqStr(a)}  누적뽑기 ${a.pulls}`);
    }
    if(tries>GT.runsPerDay*STUCK){ stuckFrom=chap; stuck=tries; break; }   /* STUCK 일 넘게 한 챕터에 정체 = 막힘 (90·300 대형 벽은 원래 오래 걸리므로 기본 40일) */
  }
  const my=GT.parts.filter(pt=>a.eq[pt]&&a.eq[pt].rar===GT.RAR_MYTH).length;
  console.log(`최종: 챕터 ${chap-1} 클리어 · 슬롯 ${slotStr(a)} · 신화 부위 ${my}/6 · 뽑기 ${a.pulls}회 · 합성 ${a.fuses}회 · 총 ${total}판`
    +(doneDay?`  ★ 전 챕터(${TUNE.maxChapter}) 완주 — ${doneDay}일차`:''));
  /* ⚑ T1 R02 — 기준 ① 직접 판정. 마지막 챕터는 아직 클리어 전이라 진행 중 판수(tries)도 후보에 넣는다.
     ⚑ T1 R03(T59) — 완주한 런은 «진행 중» 이 없으므로 이 보정을 하지 않는다. */
  if(!doneDay&&tries>worstTries){worstTries=tries;worstCh=chap;}
  /* ⚑ T97 — 실험4 기준 ①②③ 은 주인 지시로 폐기됐다(«나머지 기준은 다 폐기»). 숫자는 계속 찍되 합격/불합격을 달지 않는다. */
  console.log(`[진단] 최장 연속 실패: 챕터 ${worstCh} 에서 ${worstTries}판(${(worstTries/GT.runsPerDay).toFixed(1)}일) — 참고 눈금 ${GT.runsPerDay*20}판(20일)`);
  if(stuckFrom>0)console.log(`** 정체 감지: 챕터 ${stuckFrom} 에서 ${stuck}판(${(stuck/GT.runsPerDay).toFixed(0)}일) 연속 실패 — 90·300 은 대형 벽이라 정상, 그 외 챕터면 경제가 막힌 것 **`);
}
/* ---------- 실험5: 스탯 사다리 (진단 전용 — 판정은 실험1 이 한다) ---------- */
/* ⚑⚑⚑ T103 (2026-09-03) — **표를 하나로 합쳤다.** 종전엔 실험1 이 «과녁 2점», 실험5 가 «옛 사다리 7점»
   이라는 서로 다른 표를 봤고, 실험5 쪽 `want` 스탯은 T102 이전 값이라 이미 낡아 있었다
   (전설 530/1000/2200 → 확정표 400/2000/3200 …). 이제 두 실험이 **같은 8칸**(`EXP1_TARGETS`)을 본다.
   차이는 자의 목적뿐이다:
     - 실험1 = **슬롯 포함 확정 사다리**(노템0 · 일반0 · 희귀5 · 전설15 · 신화25 · 9강50 · 9강100 — ⚑ T153 로 영웅10 삭제)로
       «클리어율 10% ±2%p» 를 **판정**한다.
     - 실험5 = 같은 8칸을 **슬롯 0렙**으로 다시 재는 **진단**이다 — «슬롯을 안 올리면 어디까지 가나» 를 본다.
       판정(✓/✗)을 붙이지 않는다 — 폐기된 옛 합격 구간을 되살리지 않기 위해서다(게이트가 그 문면을 감시한다).
     ⚠ **슬롯 0렙 관측은 희귀 위 칸부터 전부 0.0% 다** — 사다리가 슬롯 레벨에 크게 기대므로,
       슬롯을 하나도 안 올리면 **챕터 28 부근에서 멈춘다**(T103 실측: 노템 ch5 13.5% · 일반 ch15 8.5% ·
       희귀 ch28 0.5% · 그 위 전부 0.0%). 이 실험을 «시드가 물리는가» 같은 탐침으로 쓸 때는
       **포화하지 않은 칸(1·2칸)** 을 골라야 한다 — `verifySeedProtocol` 이 그렇게 하고 있다.
   ⚑⚑ 측정 조건 = **특전 순서 획득**(T96). 등급이 폐지돼 «일반 특전만 뜨는 런» 은 성립하지 않는다.
   ⚠ `noPerk` 옵션은 «특전 미획득» 을 따로 볼 때만 쓰는 진단용으로 남는다 — 채점에는 안 쓴다. */
const LADDER=EXP1_TARGETS.map(T=>({id:T.id, rar:T.rar, plus:T.plus, at:T.at, want:LADDER_STAT[T.at]}));
/* ⚑⚑ T87 (T74 잔여 «측정 규약화» · 2026-09-03) — 실험5 채점 판수 200 → 1,000.
   T80 이 실험2 에 한 것과 같은 조치이고, 이유도 같다 — «표본을 늘리면 점수가 잘 나와서» 가 아니라
   **200판에서는 7과녁 판정이 잡음에 잠긴다**. T74 실측: 신화+9강 칸이 재실행마다 2.5~9.0% 로 흔들려
   합격 구간(2~10%)의 경계를 혼자 넘나들었고, «7과녁 중 최소 1개가 잡음만으로 탈락할 확률 ≈ 22%» 라
   «사다리 n/7 유지» 라는 회귀 검사가 사실상 동전 던지기였다. 200판의 표준오차는 p=5% 에서 ±1.5%p
   (합격 폭 8%p 의 19%), 1,000판이면 ±0.7%p 로 절반 이하가 된다.
   판수는 하니스(장비·챕터)를 옮기는 것이 아니라 **같은 자로 더 오래 재는 것**이라 지표 조작이 아니고,
   PLAN §7 이 «진단 전용 무료 노브» 로 열어 둔 축이다. 비용은 1회당 11초 → 약 55초.
   EXP5_N: 탐색용으로 낮추는 것은 자유지만 **채점 원시 출력은 기본값(=상수)으로 돌린 것만 인정**한다.
   게이트 `verifyScoreCriteria`(PLAN 문면 ↔ 상수 ↔ 기본값 자리 · 하한 1,000)와 `verifySeedProtocol` 이 감시한다. */
const EXP5_SCORE_N=1000;   // 채점용 기본 판수 (PLAN §7 — 게이트 verifyScoreCriteria 가 감시)
function exp5_ladder(){
  const N=parseInt(process.env.EXP5_N||String(EXP5_SCORE_N),10);
  const only=process.env.EXP5_ONLY;                 /* '신화' 등으로 한 칸만 측정 */
  const span=parseInt(process.env.EXP5_SPAN||'0',10);   /* >0 이면 과녁 ±span 챕터도 함께 측정 */
  console.log(`\n=== 실험5: 스탯 사다리 (진단 전용 — 기준 폐기 · 각 챕터 ${N}판 · 슬롯 0렙 · ⚑ T120 기준 플레이어) ===`);
  const rows=[];
  for(const L of LADDER){
    if(only&&only!==L.id)continue;
    const b=mkBuild(L.rar,L.plus,0);
    const pw=buildPower(b);
    const dev=(v,w)=>((v/w-1)*100).toFixed(1).padStart(5)+'%';
    console.log(`\n  [${L.id}] 풀셋 ${L.plus?'+'+L.plus+'강':'0강'} → 과녁 챕터 ${L.at}`);
    console.log(`    스탯: 공 ${pw.atk.toFixed(1)} / 체 ${pw.hp.toFixed(1)} / 실 ${pw.sh.toFixed(1)}`+
                `  (확정표 ${L.want.join('/')} 대비 ${dev(pw.atk,L.want[0])}·${dev(pw.hp,L.want[1])}·${dev(pw.sh,L.want[2])})`);
    for(let c=L.at-span;c<=L.at+span;c++){
      if(c<1)continue;
      let w=0;
      for(let i=0;i<N;i++) if(runChapter(c,b,LADDER_OPTS).clear)w++;   /* ⚑ T120 사다리 자 = «기준 플레이어» · ⚑ T160 실험1 과 같은 LADDER_OPTS */
      const rate=w/N*100;
      const exp=rate>0?(100/rate).toFixed(1)+'회':'∞';
      const tag=c===L.at?'   ← 사다리 과녁 챕터 (슬롯 0렙 관측 — 판정은 실험1)':'';
      console.log(`    챕터 ${String(c).padStart(3)}: 클리어율 ${rate.toFixed(1)}%  (기대 재도전 ${exp})${tag}`);
      if(c===L.at) rows.push([L.id,L.at,rate]);
    }
  }
  console.log(`\n  — 사다리 요약 (진단 — 판정 없음. 유효 기준은 실험1 의 사다리 8점뿐) —`);
  console.log(`  | 칸 | 사다리 챕터 | 슬롯0 클리어율 |`);
  console.log(`  |---|---|---|`);
  for(const [id,at,rate] of rows)
    console.log(`  | ${id} | ${at} | ${rate.toFixed(1)}% |`);
}

/* ---------- 계열 옵션표 덤프 (PLAN §11.6 등재용) ---------- */
function dumpGearTable(){
  /* ⚑ T124 — 일반부터 옵션 1개 · «계열» 열은 «세트» 열이 됐다. 세트 → 부위 순으로 찍는다.
     ⚑⚑⚑ T153 — 영웅이 빠지고 «+9강 공격력 +10%» 이 사라져 **8단 → 7단**이다. */
  const step=['일반(1)','희귀(2)','전설(3)','신화(4)','신화+3(5)','신화+6(6)','신화+9(7)'];
  console.log('| 부위 | 종류 | 세트 | '+step.map((s,i)=>`옵션${i+1} · ${s}`).join(' | ')+' |');
  console.log('|---|---|---|'+step.map(()=>'---').join('|')+'|');
  for(const st of GT.sets) for(const pt of GT.parts){
    const ty=`${st}_${pt}`;
    console.log(`| ${GT.partName[pt]} | ${GT.typeName[ty]} | ${GT.setName[st]} | `+GOPT[ty].map(o=>o.d).join(' | ')+' |');
  }
}

/* ---------- fit: 앵커 챕터가 «겨우 클리어(≈5%)» 가 되는 요구 전투력 역산 (진단 전용) ---------- */
function fitAnchors(){
  const N=parseInt(process.env.FIT_N||'60',10);
  const CH=(process.env.FIT_CH||'30,90,300').split(',').map(Number);
  console.log(`\n=== fit: 앵커 챕터 요구 전투력 역산 (기준 공30/체300 의 배수 k, 클리어율 ≈5% 지점, ${N}판/평가) ===`);
  for(const c of CH){
    const rate=k=>{let w=0;const b=flatBuild(30*k,300*k);for(let i=0;i<N;i++)if(runChapter(c,b,{}).clear)w++;return w/N*100;};
    let lo=1,hi=1;
    while(rate(hi)<5&&hi<1e60)hi*=4;
    if(hi>1e60){console.log(`  챕터 ${c}: k>1e60 (역산 실패)`);continue;}
    lo=hi/4;
    for(let it=0;it<12;it++){const mid=Math.sqrt(lo*hi);if(rate(mid)<5)lo=mid;else hi=mid;}
    const k=Math.sqrt(lo*hi);
    console.log(`  챕터 ${String(c).padStart(3)}: k ≈ ${k.toExponential(3)}  (공격력 ${(30*k).toExponential(3)} · 체력 ${(300*k).toExponential(3)})`);
  }
}

const mode=process.argv[2]||'all';
if(process.env.SEED!==undefined&&process.env.SEED!=='') setSeed(Number(process.env.SEED));   /* R11: 하니스 시드 (미설정 시 종전과 동일) */
if(mode==='table'){ dumpGearTable(); process.exit(0); }
if(mode==='fit'){ fitAnchors(); process.exit(0); }
if(mode==='1'||mode==='all')exp1_targets();
if(mode==='2')exp2_retired();   /* 폐지 — 'all' 에서 빠진다 */
if(mode==='3'||mode==='all')exp3_progression();
if(mode==='4'||mode==='all')exp4_gearProgress();
if(mode==='5'||mode==='all')exp5_ladder();
