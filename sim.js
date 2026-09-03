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
  eBaseHp:40.6, eBaseDmg:7.55,
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
     ② **D(300) 보존 축척** — ①로 챕터 15 «위» 가 전부 HP ×2.406 · DMG ×2.471 만큼 통째로 올라간다.
        그대로 두면 챕터 300 이 상한 장비로도 못 깨진다(≈ 챕터 316 난이도가 된다). 그래서 15 이후 **모든 구간률의
        로그를 같은 비율로 축소**했다 — HP λ=0.8667 · DMG λ=0.8392, 벽 배수(10·15·90·300)는 그대로 둔다.
        `Σ nᵢ·ln rᵢ` 가 정확히 `ln(shift)` 만큼 줄어 **D(300) 이 보존**되고(실측 416386 → 416367, 0.005%),
        구간 간 상대 형상(어디가 가파른가)도 보존된다. 난이도 증가분은 챕터 15 의 ×2.40 에서 300 의 ×1.00 까지
        매끄럽게 잦아든다(ch50 ×1.87 · ch100 ×1.44 · ch200 ×1.16). 상한 장비(신화+9·슬롯150)의 챕터 300
        클리어율 **99.5%** 로 완주 가능성을 실측 확인했다.
     ⚠ 두 과녁은 구간 15 «위» 와 **독립**이다(D(4)·D(15) 는 15 이후 구간률을 안 탄다) — ②는 과녁을 못 흔든다. */
  eHpSeg:[[0,1.0292],[5,1.122],[15,1.1288],[20,1.0083],[30,1.0488],[50,1.0625],[70,1.0163],[120,1.0133],[260,1.0049]],
  eDmgSeg:[[0,1.0265],[5,1.122],[15,1.1244],[20,1.008],[30,1.0292],[50,1.0289],[70,1.0213],[120,1.012],[260,1.0047]],
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
  wall4Hp:3.2, wall4Dmg:1.8,    // 300챕터 최종 벽 (⚑ T1 R03 켬 — 260 위에는 과녁이 없어 벽 예산 제약이 «완전히» 없다. slotCostG 1.6 의 짝 노브 — 계정이 부유해진 만큼 최종 벽을 올려 30~400회 대역에 되돌린다)
  bossHp:8, bossDmg:1.8,        // 주인 확정 상수 (튜닝 노브 아님) — 5배수 챕터 추가 배수 폐기
  maxChapter:300,               // PLAN §2.4 (§11 도입으로 20 → 100 → 주인 추가 지시로 300)
  /* 플레이어 기본치 (영구강화 4종 폐지 — 성장은 §11 장비 + 슬롯 강화가 전담)
     ⚑ T35 주인 확정(PLAN §11.5-a): 공 25 / 체 150 / 실드 250. 실드는 `maxHp*0.8` 파생이 아니라 독립 스탯이다. */
  /* ⚑ 주인 확정 2026-09-03 (ROUTINE «플레이어 기본 스탯») — 노브 아님. PLAN §2.3 표와 1:1.
     종전엔 치배·방어·반격·회피 넷이 mkPlayer 에 리터럴로 박혀 있어 PLAN 어디에도 값이 없었다
     (T27 «미문서 상수 4종» · 승인 대기 22번). 주인이 값을 확정하면서 그 안건이 종결됐고,
     넷을 여기로 끌어올려 «한 곳에서만 정의 → PLAN 과 대조» 가 가능해졌다(verifyCombatConst ①). */
  pAtk0:25, pHp0:150, pSh0:250, pAspd0:1.0, pCrit0:20, pCritF0:150, pCounter0:20, pDef0:20, pEvade0:20,
  goldKillBase:0.6, goldKillPer:0.10, goldClearPer:3,
  goldGrowth:1.22,              // 챕터당 골드 성장 배수 (R07: 1.185 → 1.22. 1.185 는 챕터 90 대형 벽에서 슬롯 13 에 갇혀 F2P·과금 둘 다 영구 정체했다 — 실험4 실측. eHpG 보다 높게 둬야 후반 벽에서 수입이 적 성장을 따라잡는다)
  expKill:3, expBoss:9,
  /* ⚑⚑ T96 4단계 (주인 확정 2026-09-03) — `4+4*lv` → **`4+3*lv`**.
     10레벨까지 누적 Σ(4+3L)=205 가 고정 챕터의 경험치 공급 205 와 정확히 같아지게 고른 값이다
     (종전 4+4L 이면 260 이 필요해 적 50 상한 안에서는 10개를 절대 못 모은다 — 주인 지시 ②). */
  expNeed:lv=>4+3*lv,
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
/* ⚑ 주인 확정 제약 (PLAN §2.4, 2026-09-02 14:2X) — 전 300 챕터 공통:
   ① 적 총 수 ≤ 50 ② 쉼터 1~4 ③ 악마 정확히 1 ④ 천사 정확히 1.
   ⚑⚑ T96 (주인 확정 2026-09-03 ③) — 상한 **100 → 50**. 챕터 1~300 레이아웃이 이 상한으로 다시 만들어진다.
   `chapterLayout` 이 시드 결정적이라 상수 하나로 전 구간이 재생성된다 — 챕터 1~300 실측:
   적 총 수 **40~50마리**(웨이브 4개×10=40 또는 4×12=48 또는 5×10=50 · 종전 상한 100 에서는 60까지 갔다),
   웨이브 4개 161챕터 · 5개 139챕터, 쉼터 1~2개, 악마 1·천사 1 은 전 챕터 그대로다.
   후반 난이도는 마릿수가 아니라 적 스탯으로 낸다는 주인 조항은 그대로다. */
const LAYOUT_MAXENEMY=50;
/* ⚑ 고정 구성 (주인 확정 2026-09-03) — 웨이브 4 × 12마리 + 보스 1 = 적 49 · 쉼터 2. index.html 과 같은 값. */
const LAYOUT_WAVES=4, LAYOUT_WAVE_SIZE=12, LAYOUT_RESTS=2;
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
   기절 지속은 3초 또는 6초만 쓴다(PLAN §3.0 주인 확정). index.html 도 같은 값(게이트가 대조). */
const STUN_BOSS_MUL=1/3;
/* ⚑ 주인 확정(2026-09-03 · PLAN §3.0) — 소환 데미지는 고정 상수다. 튜닝으로 계수를 바꾸지 말 것
   (밸런스는 발동 확률 10% 단위·발수로만). 창·검기는 일직선 관통형이라 관통 마릿수도 여기서 못 박는다. */
const R_AXE=0.30, R_ARROW=0.50, R_WAVE=0.50, R_BOLT=0.75, R_SPEAR=1.00;
const WAVE_PIERCE=2, WAVE_PIERCE_BIG=8, SPEAR_PIERCE=8;
/* ⚑ T96 — 주기 소환·공속 램프·오버킬 회복·반격 연쇄·등급 확률 상수는 특전 132종과 함께 폐지됐다
   (새 10종에는 주기형 소환도 등급도 없다). 장비 옵션이 쓰는 `autoBolt`(3초 주기)만 남는다. */
/* ⚑ 주인 확정 — 방어막(ward)은 장수 상한이 없다(무한). 수치형 실드와 별개 축으로, 실드는 데미지를
   «흡수» 하고 방어막은 타격 «1회» 를 통째로 무효화한다. 한 장이 소모되는 순간 «방어막 방어» 트리거
   (🛡️❤️ 회복 · 🛡️💥 반사 · 🥅 창)가 굴러간다. */
function chapterLayout(c){
  /* ⚑⚑⚑ T96 4단계 (주인 확정 2026-09-03) — «특전 10개를 얻을 정도의 적 개수로만 챕터를 구성해라».
     **전 챕터 동일 고정 구성**이고 제비뽑기는 «순서» 에만 남는다:
       웨이브 4 × 12마리 = 48 · 보스 1 → 적 **49마리**(상한 LAYOUT_MAXENEMY 50 이내)
       쉼터 2 (고정 — 종전 1~4 변동 폐지) · 악마 1 · 천사 1
     공급 = 48×3 + 9(보스) + 2×26(쉼터) = **205** = 필요 Σ(4+3·L), L=1..10 = **205**
     → 완주하면 정확히 10번 레벨업 = 특전 10개. 중간에 죽으면 그만큼 덜 얻는다(의도).
     ⚑ 적 «수» 는 더 이상 난이도 노브가 아니다 — 난이도는 적 스탯(구간 성장률·벽 배수)으로만 만든다.
     ⚑ 덤: 챕터마다 적 수·쉼터 수가 흔들리던 것이 사라져 인접 챕터 난이도 역전(T28)이 구조적으로 없어진다.
     게이트 `tools/verifyChapterFixed.js` 가 챕터 1~300 전수로 이 구성과 «완주 = 특전 10개» 를 실측한다. */
  const rnd=mulberry(c*1013904223+77);
  const waveCount=LAYOUT_WAVES, size=LAYOUT_WAVE_SIZE;
  const evs=['devil','angel'];                                  /* 악마 1 · 천사 1 */
  for(let i=0;i<LAYOUT_RESTS;i++) evs.push('rest');             /* 쉼터 2 고정 */
  for(let i=evs.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); const t=evs[i]; evs[i]=evs[j]; evs[j]=t; }
  const out=[];
  /* 웨이브 4 · 이벤트 4 를 번갈아 깔고 마지막이 보스다 — «웨이브 뒤 이벤트» 를 4번 반복하면
     웨이브가 정확히 4개(48마리)가 된다. 종전엔 보스 앞에 웨이브를 하나 더 붙여 5웨이브(60마리)였다. */
  for(let i=0;i<evs.length;i++){ out.push({t:'wave',size}); out.push({t:evs[i]}); }
  out.push({t:'boss'});
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
  if(c>=300){hp*=TUNE.wall4Hp; dmg*=TUNE.wall4Dmg;}    /* 300 최종 벽 (PLAN §11.7) */
  return {hp:Math.round(hp), dmg:Math.round(dmg)};
}

/* ---------- 특전 = 고정 10종 · 순서 획득 (⚑⚑⚑ 주인 확정 2026-09-03 · PLAN §3) ----------
   **132종 체제(등급·선택창·새로고침·전지의 눈)는 통째로 폐지됐다.** 레벨업할 때마다 아래 순서대로
   하나씩 자동으로 얻고, 10개를 다 얻은 뒤의 레벨업은 특전을 주지 않는다(위임 기본값).
   px 키 = 특전 id. 장비 계열 옵션(GOPT §11.6)이 쓰는 짧은 키(axe·wave·firstHit …)는 별도 네임스페이스로
   그대로 살아 있다 — 이번 전환에서 장비·스탯·경제는 한 줄도 안 바뀐다(주인 지시 ④).
   수치 해석(주인 위임 기본값 ⑦):
     · 확률형(회피·반격·치확)은 **+10** (기본 20 → 30) · 치명타 피해는 **+50** (기본 150 → 200)
     · 공격력 +20% · 방어력 +10% 는 **기본치에 곱연산**이고 장비 합산 «뒤» 에 걸린다
       (`mkPlayer` 가 장비 옵션을 먼저 다 적용한 뒤 특전이 붙으므로 획득 시점 곱이 곧 «장비 합산 뒤» 다)
     · 생명 흡수 = 준 피해의 10% 를 체력으로 회복(초과분 버림 · 실드는 안 채움 → `heal(...,true)`)
     · 8·9·10 소환은 기존 엔진 그대로 1개 = 1발, 쿨다운 없음
   ⚑ 소환 연쇄 임계 B: 세 소환이 전부 «피격/회피/반격» 축이라 **소환 적중이 새 소환을 낳지 않는다** → B = 0.
   금지축(경제·이속·최대체력/최대실드 증가·적중률·부활·분신·주기형 회복)은 그대로다.
   **흡혈 금지는 폐기됐다**(주인 확정 ⑥ — 7번이 최신 확정. 적중률 금지는 유효). ---------- */
const PERK_ATK_M=1.20, PERK_DEF_M=1.10, PERK_EVADE_A=10, PERK_COUNTER_A=10,
      PERK_CRITR_A=10, PERK_CRITF_A=50, PERK_STEAL=10, PERK_SUMMON_CH=0.50;
/* 순서 고정 — 이 배열의 순서가 곧 획득 순서다(주인 표 1~10번). 게이트가 순서·수치를 대조한다. */
function mkPerks(){
  return [
    {id:'p_atk',     nm:'공격력 증가',        d:'공격력 +20%',                     ap:p=>{p.px.p_atk=1;p.dmg*=PERK_ATK_M;}},
    {id:'p_evade',   nm:'회피율 증가',        d:'회피율 +10',                      ap:p=>{p.px.p_evade=1;p.evade+=PERK_EVADE_A;}},
    {id:'p_counter', nm:'반격률 증가',        d:'반격률 +10',                      ap:p=>{p.px.p_counter=1;p.counter+=PERK_COUNTER_A;}},
    {id:'p_critR',   nm:'치명타 확률 증가',   d:'치명타 확률 +10',                 ap:p=>{p.px.p_critR=1;p.critR+=PERK_CRITR_A;}},
    {id:'p_critF',   nm:'치명타 피해 증가',   d:'치명타 피해 +50',                 ap:p=>{p.px.p_critF=1;p.critF+=PERK_CRITF_A;}},
    {id:'p_def',     nm:'방어력 증가',        d:'방어력 +10%',                     ap:p=>{p.px.p_def=1;p.def*=PERK_DEF_M;}},
    {id:'p_steal',   nm:'생명 흡수',          d:'준 피해의 10% 회복',              ap:p=>{p.px.p_steal=1;p.steal+=PERK_STEAL;}},
    {id:'p_axeHit',  nm:'피격 시 도끼',       d:'피격 시 50% 확률로 도끼 1개',     ap:p=>p.px.p_axeHit=1},
    {id:'p_arrowEv', nm:'회피 시 화살',       d:'회피 시 50% 확률로 화살 1개',     ap:p=>p.px.p_arrowEv=1},
    {id:'p_spearCt', nm:'반격 시 창',         d:'반격 시 50% 확률로 창 1개',       ap:p=>p.px.p_spearCt=1},
  ];
}
const PERKS=mkPerks();

/* ================= 장비 시스템 (PLAN §11) ================= */
/* 등급 5 · 부위 6 · 부위당 종류 3 (=18계열). 장착 시 공/체 상승 + 계열 옵션.
   옵션 개수: 일반0 · 희귀1 · 영웅2 · 전설3 · 신화4, 신화는 +3/+6/+9 강에서 1개씩 추가(최대 7). */
const GT={
  parts:['weapon','helm','armor','glove','boot','neck'],
  partName:{weapon:'무기',helm:'투구',armor:'갑옷',glove:'장갑',boot:'신발',neck:'목걸이'},
  types:{
    weapon:['greatsword','axe','bow'], helm:['helmet','crown','hood'],
    armor:['plate','chain','robe'],    glove:['gauntlet','leather','handwrap'],
    boot:['sandal','boots','greave'],  neck:['pendant','amulet','beads'],
  },
  typeName:{greatsword:'대검',axe:'전투도끼',bow:'장궁',helmet:'투구',crown:'왕관',hood:'두건',
    plate:'판금갑옷',chain:'사슬갑옷',robe:'로브',gauntlet:'건틀릿',leather:'가죽장갑',handwrap:'핸드랩',
    sandal:'샌들',boots:'부츠',greave:'장화',pendant:'펜던트',amulet:'부적',beads:'구슬목걸이'},
  rarName:['일반','희귀','영웅','전설','신화'],
  /* ⚑ T35 — 등급별 1부위 기여 (0강·슬롯 0렙). PLAN §11.5-a 주인 확정표를 그대로 옮긴 값이다.
     종전의 «기준값 ÷ rarStep^n» 등비 생성(`atkUnit`·`hpUnit`·`rarStep 155`)은 전면 폐기 — 역산 금지.
     인덱스 = 일반0 · 희귀1 · 영웅2 · 전설3 · 신화4. 실드는 체력 파생이 아니라 독립 기여축이다.
     검산(기본치 공25/체150/실250 + 6부위): 일반 50/250/400 · 희귀 100/500/800 · 영웅 200/700/1300 ·
     전설 530/1000/2200 · 신화 1200/2385/5000 · 신화+9강 2575/5000/10558 (PLAN §11.7 사다리표와 일치). */
  atk:[4.167, 12.500,  29.167,  84.167, 195.833],
  hp: [16.667, 58.333,  91.667, 141.667, 372.500],
  sh: [25.000, 91.667, 175.000, 325.000, 791.667],
  plusStep:0.13,                 // 강화 1레벨당 해당 장비 공/체/실 +13% (주인 확정 — 종전 0.12)
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
     이제 굴림도 안내문도 이 배열 하나만 본다. 순서 = 등급 인덱스(0 일반 … 4 신화), 단위 %. */
  gachaRate:[57.9,30,10,2,0.1],
  pityMyth:50,                   // 50회 천장 (누적 50회째 신화 확정)
  pityLegend:10,                 // 10회 피티 (10회당 전설 이상 확정)
  legendToMythPlus:10,           // 전설 +10강 도달 시 신화 0강으로 변환
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
/* 뽑기 굴림 임계 — gachaRate 를 «높은 등급부터» 누적한 값. 종전 리터럴(0.1/2.1/12.1/42.1)과 비트 단위로 같다
   (toFixed(6) 로 부동소수 누적 오차를 끊는다 — 임계가 1ULP 라도 밀리면 시드 재현성이 깨진다). */
GT.gachaCum=(()=>{ const c=[]; let a=0; for(let i=GT.gachaRate.length-1;i>=0;i--){ a=+(a+GT.gachaRate[i]).toFixed(6); c[i]=a; } return c; })();
GT.rarRoll=r=>{ for(let i=GT.gachaRate.length-1;i>0;i--) if(r<GT.gachaCum[i]) return i; return 0; };
/* 옵션 개수: 등급별 + 신화 강화 보너스 */
GT.optCount=(rar,plus)=>{
  let n=rar;                                   // 일반0 희귀1 영웅2 전설3 신화4
  if(rar===4){ if(plus>=3)n++; if(plus>=6)n++; if(plus>=9)n++; }
  return n;
};

/* ---- 18계열 옵션표 (PLAN §11.6 초안 — 기존 엔진 동사만 재사용) ----
   각 계열 7단계, 상위 등급은 하위 옵션을 전부 포함하고 하나 더 얹는다. */
const GOPT={
  /* 무기 */
  greatsword:[ /* 검기 계열 */
    {d:'공격력 +6%',            ap:p=>p.dmg*=1.06},
    {d:'공격 시 5% 확률 검기 발사', ap:p=>p.px.wave++},
    {d:'공격 시 30% 확률 공격력 +14% 4초', ap:p=>p.px.atkBuffM++},
    {d:'검기 관통 20·사거리 1400', ap:p=>p.px.waveKing=1},
    {d:'공격 시 25% 확률 공격력 +35% 5초', ap:p=>p.px.atkBuffL++},
    {d:'반격 시 검기 발사(확정)', ap:p=>p.px.counterWave++},
    {d:'체력 50% 이하 적에게 피해 2.2배', ap:p=>p.px.execute=true},
  ],
  axe:[ /* 도끼 계열 */
    {d:'공격력 +6%',            ap:p=>p.dmg*=1.06},
    {d:'공격 시 5% 확률 도끼 발사', ap:p=>p.px.axe++},
    {d:'치명타 확률 +6',        ap:p=>p.critR+=6},
    {d:'도끼 3개로 증가',       ap:p=>p.px.axeCount=1},
    {d:'도끼 발동 확률 +5%',   ap:p=>p.px.axe++},
    {d:'처치 시 실드 충전',      ap:p=>p.px.killShield3++},
    {d:'최대 체력 적 첫 타격 피해 +20%', ap:p=>p.px.firstHit++},
  ],
  bow:[ /* 화살 계열 */
    {d:'공격력 +6%',            ap:p=>p.dmg*=1.06},
    {d:'공격 시 5% 확률 화살 2발', ap:p=>p.px.arrow2++},
    {d:'치명타 배율 +30',       ap:p=>p.critF+=30},
    {d:'화살 3발로 증가',       ap:p=>p.px.arrowCount=1},
    {d:'치명타 시 75% 확률 추가타', ap:p=>p.px.extraHit++},
    {d:'화살 발동 확률 +5%',   ap:p=>p.px.arrow2++},
    {d:'최대 체력 적에게 치명타 확률 62', ap:p=>p.px.fullHpCrit=true},
  ],
  /* 투구 */
  helmet:[ /* 방어 계열 */
    {d:'방어 +6',               ap:p=>p.def+=6},
    {d:'피격 시 방어 +3 3초(누적)', ap:p=>p.px.defHitBuff++},
    {d:'방어 +8',               ap:p=>p.def+=8},
    {d:'피격 시 30% 확률 방어 +14 4초', ap:p=>p.px.defBuff2++},
    {d:'피격 시 방어 +5 4초(누적)', ap:p=>p.px.wallBuff++},
    {d:'피격 시 20% 확률 방어 +15 4초', ap:p=>p.px.defBuffL++},
    {d:'실드가 있으면 받는 피해 20% 감소', ap:p=>p.px.guardCrystal=true},
  ],
  crown:[ /* 치명타 확률 계열 */
    {d:'치명타 확률 +6',        ap:p=>p.critR+=6},
    {d:'치명타 시 치명 확률 +5 3초(누적)', ap:p=>p.px.critChain++},
    {d:'치명타 확률 +8',        ap:p=>p.critR+=8},
    {d:'처치 시 30% 확률 치명 확률 +14 4초', ap:p=>p.px.killCritBuff++},
    {d:'치명타 시 45% 확률 공격 즉시 재장전', ap:p=>p.px.critReset++},
    {d:'치명타 확률 +10',       ap:p=>p.critR+=10},
    {d:'치명타 시 공격력 +15% 4초', ap:p=>p.px.critAtkBuff++},
  ],
  hood:[ /* 번개 계열 */
    {d:'치명타 배율 +25',       ap:p=>p.critF+=25},
    {d:'공격 시 5% 확률 번개 1회', ap:p=>p.px.bolt++},
    {d:'치명타 시 치명 배율 +34 4초', ap:p=>p.px.critFBuff++},
    {d:'번개 2회로 증가',       ap:p=>p.px.boltCount=1},
    {d:'3초마다 번개 자동 발사', ap:p=>p.px.autoBolt++},
    {d:'치명타 시 공격속도 +25% 3초', ap:p=>p.px.critAspdBuff++},
    {d:'공격 시 5% 확률 소환 무작위 발사', ap:p=>p.px.arsenal++},
  ],
  /* 갑옷 */
  plate:[ /* 체력·피격 계열 */
    {d:'최대 체력 +8%',         ap:p=>{const a=p.maxHp*0.08;p.maxHp+=a;heal(p,a,true);}},
    {d:'피격 시 15% 확률 체력 2% 회복', ap:p=>p.px.hitHeal++},
    {d:'최대 체력 +10%',        ap:p=>{const a=p.maxHp*0.10;p.maxHp+=a;heal(p,a,true);}},
    {d:'피격 시 22% 확률 회피 +14 3초', ap:p=>p.px.hitEvadeBuff++},
    {d:'최대 체력 +12%',        ap:p=>{const a=p.maxHp*0.12;p.maxHp+=a;heal(p,a,true);}},
    {d:'피격 시 5% 확률 실드 5% 충전', ap:p=>p.px.shieldOnHit++},
    {d:'사망 시 1회 부활',       ap:p=>p.px.revive++},
  ],
  chain:[ /* 가시 계열 */
    {d:'방어 +5',               ap:p=>p.def+=5},
    {d:'피격 시 60% 확률 가시 반사', ap:p=>p.px.thorns++},
    {d:'방어 +7',               ap:p=>p.def+=7},
    {d:'피격 시 방어 +3 3초(누적)', ap:p=>p.px.defHitBuff++},
    {d:'가시 반사 확률 +60%',   ap:p=>p.px.thorns++},
    {d:'최대 체력 +10%',        ap:p=>{const a=p.maxHp*0.10;p.maxHp+=a;heal(p,a,true);}},
    {d:'피격 시 30% 확률 회피 +15 3초', ap:p=>p.px.evadeHitBuff++},
  ],
  robe:[ /* 실드 계열 */
    {d:'최대 실드 +15%',        ap:p=>p.maxSh*=1.15},
    {d:'처치 시 실드 소량 충전', ap:p=>p.px.killShield3++},
    {d:'최대 실드 +20%',        ap:p=>p.maxSh*=1.20},
    {d:'회복 시 30% 확률 실드 8% 충전', ap:p=>p.px.healShield5++},
    {d:'처치 시 실드 충전 강화', ap:p=>p.px.killShield10++},
    {d:'최대 실드 +25%',        ap:p=>p.maxSh*=1.25},
    {d:'실드가 0일 때 공격력 1.5배', ap:p=>p.px.rage=true},
  ],
  /* 장갑 */
  gauntlet:[ /* 치명타 배율 계열 */
    {d:'치명타 배율 +30',       ap:p=>p.critF+=30},
    {d:'치명타 시 치명 배율 +20 3초', ap:p=>p.px.critFsmall++},
    {d:'치명타 배율 +40',       ap:p=>p.critF+=40},
    {d:'치명타 시 30% 확률 체력 4% 회복', ap:p=>p.px.critHeal3++},
    {d:'치명타 배율 +50',       ap:p=>p.critF+=50},
    {d:'치명타 시 75% 확률 추가타', ap:p=>p.px.extraHit++},
    {d:'뒤쪽 적에게 피해 3.2배',   ap:p=>p.px.backDmg=true},
  ],
  leather:[ /* 공격속도 계열 */
    {d:'공격속도 +8%',          ap:p=>p.aspd*=1.08},
    {d:'공격 시 30% 확률 공속 +5% 3초', ap:p=>p.px.c_aspdBuff++},
    {d:'공격속도 +10%',         ap:p=>p.aspd*=1.10},
    {d:'처치 시 공속 +20% 4초',  ap:p=>p.px.aspdKill++},
    {d:'공격속도 +12%',         ap:p=>p.aspd*=1.12},
    {d:'처치마다 공속 영구 +1%', ap:p=>p.px.killAspd=true},
    {d:'공속 +35%·이동속도 +35%', ap:p=>{p.aspd*=1.35;p.walkMul+=0.35;}},
  ],
  handwrap:[ /* 연타·분신 계열 */
    {d:'공격력 +5%',            ap:p=>p.dmg*=1.05},
    {d:'공격 시 30% 확률 공격력 +5% 3초', ap:p=>p.px.c_atkBuff++},
    {d:'공격력 +7%',            ap:p=>p.dmg*=1.07},
    {d:'공격 시 10% 확률 공격력 영구 +1%', ap:p=>p.px.atkPerm++},
    {d:'공격력 +9%',            ap:p=>p.dmg*=1.09},
    {d:'기본공격마다 분신 추가타', ap:p=>p.px.clone=true},
    {d:'체력 25% 이하 적 즉사(보스 제외)', ap:p=>p.px.execKill=true},
  ],
  /* 신발 (주인 예시 계열 그대로) */
  sandal:[ /* 회피 계열 */
    {d:'회피 +7',               ap:p=>p.evade+=7},
    {d:'회피 시 10% 확률 도끼 1개 발사', ap:p=>p.px.evadeAxe++},
    {d:'회피 +8',               ap:p=>p.evade+=8},
    {d:'회피 시 공격력 +28% 5초', ap:p=>p.px.evadeAtkBuff++},
    {d:'회피 시 15% 확률 체력 7% 회복', ap:p=>p.px.evadeHeal++},
    {d:'회피 시 회피 +8 3초(누적)', ap:p=>p.px.evadeEvBuff++},
    {d:'회피 시 다음 공격 치명타 확정', ap:p=>p.px.evadeCrit=true},
  ],
  boots:[ /* 반격 계열 */
    {d:'반격 확률 +7',          ap:p=>p.counter+=7},
    {d:'반격 시 공격력 +5% 3초', ap:p=>p.px.counterAtkS++},
    {d:'반격 확률 +8',          ap:p=>p.counter+=8},
    {d:'반격 시 공격력 +14% 4초', ap:p=>p.px.counterAtkM++},
    {d:'반격 피해 +100%',        ap:p=>p.px.counterX++},
    {d:'반격 시 체력 4% 회복',   ap:p=>p.px.counterHeal++},
    {d:'반격 시 연쇄 반격(확정)', ap:p=>p.px.counterChain=true},
  ],
  greave:[ /* 체력 계열 */
    {d:'최대 체력 +8%',         ap:p=>{const a=p.maxHp*0.08;p.maxHp+=a;heal(p,a,true);}},
    {d:'처치 시 체력 0.5% 회복', ap:p=>p.killHeal+=0.005},
    {d:'최대 체력 +10%',        ap:p=>{const a=p.maxHp*0.10;p.maxHp+=a;heal(p,a,true);}},
    {d:'회복량 +20%',           ap:p=>p.healAmp+=0.2},
    {d:'최대 체력 +12%',        ap:p=>{const a=p.maxHp*0.12;p.maxHp+=a;heal(p,a,true);}},
    {d:'처치 시 체력 +0.8% 추가 회복', ap:p=>p.killHeal+=0.008},
    {d:'체력 10% 이하 시 회피 +40', ap:p=>p.px.lastStand=true},
  ],
  /* 목걸이 */
  pendant:[ /* 회복 계열 */
    {d:'회복량 +15%',           ap:p=>p.healAmp+=0.15},
    {d:'회복 시 30% 확률 방어 +5 3초', ap:p=>p.px.healDefBuff++},
    {d:'회복량 +20%',           ap:p=>p.healAmp+=0.20},
    {d:'회복 시 20% 확률 실드 3% 충전', ap:p=>p.px.healShield3++},
    {d:'회복 시 공격력 +8% 3초', ap:p=>p.px.healAtkBuff++},
    {d:'회복 시 20% 확률 추가 회복', ap:p=>p.px.healBoost2++},
    {d:'과회복분의 7배가 실드로 전환', ap:p=>p.px.overheal=true},
  ],
  amulet:[ /* 처치 계열 */
    {d:'골드 획득 +30%',        ap:p=>p.goldMul+=0.3},
    {d:'처치 시 방어 +10 3초',   ap:p=>p.px.killDefBuff++},
    {d:'골드 획득 +40%',        ap:p=>p.goldMul+=0.4},
    {d:'처치 시 30% 확률 치명 확률 +14 4초', ap:p=>p.px.killCritBuff++},
    {d:'획득 경험치 +1',        ap:p=>p.px.sage=true},
    {d:'처치 시 실드 충전 강화', ap:p=>p.px.killShield10++},
    {d:'골드 획득 2배',          ap:p=>p.goldMul*=2},
  ],
  beads:[ /* 창 계열 */
    {d:'공격력 +5%',            ap:p=>p.dmg*=1.05},
    {d:'공격 시 5% 확률 창 발사', ap:p=>p.px.spear++},
    {d:'치명타 확률 +6',        ap:p=>p.critR+=6},
    {d:'창 피해 13.5배·관통',    ap:p=>p.px.spearMaster=1},
    {d:'창 발동 확률 +5%',    ap:p=>p.px.spear++},
    {d:'적 화살 30% 확률 오발',  ap:p=>p.misfire+=0.30},
    {d:'모든 발동 확률 1.22배',  ap:p=>p.px.procX2=true},
  ],
};

/* ---- 뽑기 (PLAN §11.2) ---- */
function newGacha(){ return {p50:0,p10:0,pulls:0}; }
function gachaPull(st){
  st.pulls++; st.p50++; st.p10++;
  const pityM=st.p50>=GT.pityMyth, pityL=st.p10>=GT.pityLegend;
  let rar;
  if(pityM) rar=4;
  else{
    const r=grand()*100;
    rar = GT.rarRoll(r);            /* 임계는 GT.gachaRate 에서 파생 — 리터럴로 되돌리지 말 것 (T65) */
    if(pityL&&rar<3) rar=3;
  }
  if(rar===4){
    st.p50=0;
    /* 50천장과 10피티가 겹치면 신화 우선 · 전설 확정은 다음 뽑기로 이월(p10 유지) */
    if(!(pityM&&pityL)) st.p10=0;
  }else if(rar===3) st.p10=0;
  const t=GT.allTypes[Math.floor(grand()*GT.allTypes.length)];   /* 뽑기 스트림 (R11) */
  return {part:t.part,type:t.type,rar,plus:0};
}

/* ---- 합성 (PLAN §11.3) ---- */
const gearKey=g=>`${g.part}|${g.type}|${g.rar}|${g.plus}`;
/* 합성 산출물 규칙 — 자동(fuseAll)·수동(합성 화면) 둘 다 **이 함수 하나만** 쓴다.
   규칙을 두 곳에 적으면 T8·T9·T11·T12 계열(«같은 수치를 손으로 두 번 옮기다 어긋남») 이 재발한다.
   base = 재료 3개 중 최고 강화품(호출부가 정렬해서 넘긴다). */
function fuseMake(base){
  if(base.rar<3) return {part:base.part,type:base.type,rar:base.rar+1,plus:0};
  if(base.rar===3){
    const np=base.plus+1;
    return np>=GT.legendToMythPlus
      ? {part:base.part,type:base.type,rar:4,plus:0}            /* +10강 도달 → 신화 0강 변환 */
      : {part:base.part,type:base.type,rar:3,plus:np};
  }
  return {part:base.part,type:base.type,rar:4,plus:base.plus+1};   /* 신화 무한 강화 */
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
  };
}
/* 신 132종의 px 키 = 특전 id 그대로. 여기서 한 번에 0 으로 깔아 둔다 —
   특전을 추가·삭제해도 이 함수를 고칠 일이 없고, 오타 난 키가 조용히 `undefined` 로 도는 일도 없다. */
function basePx(){ const o=_basePxLegacy(); for(const k of PERKS) o[k.id]=0; return o; }
function mkPlayer(build,G){
  const pw=buildPower(build);
  const maxHp=pw.hp;
  const p={G, worldX:0, atkTimer:0, nextAtk:0, nextCrit:false,
    dmg:pw.atk, aspd:TUNE.pAspd0, critR:TUNE.pCrit0, critF:TUNE.pCritF0,
    def:TUNE.pDef0, counter:TUNE.pCounter0, evade:TUNE.pEvade0, steal:0, killHeal:0, misfire:0, goldMul:1, walkMul:1, healAmp:0,
    maxHp, hp:maxHp, maxSh:pw.sh, sh:pw.sh,   /* ⚑ T35: 실드 독립 스탯 (`maxHp*0.8` 파생 폐기) */
    level:1, exp:0, ward:0, repairAmp:0,
    buffs:{atk:[],aspd:[],critR:[],critF:[],def:[],evade:[]}, px:basePx()};
  /* 장비 계열 옵션 적용 (PLAN §11.1 — 상위 등급은 하위 옵션 포함) */
  for(const pt of GT.parts){
    const g=build.eq[pt]; if(!g)continue;
    const tbl=GOPT[g.type]; if(!tbl)continue;
    const n=GT.optCount(g.rar,g.plus);
    for(let i=0;i<n&&i<tbl.length;i++) tbl[i].ap(p);
  }
  p.hp=p.maxHp; p.sh=p.maxSh=Math.round(p.maxSh);
  return p;
}
const bsum=(p,k)=>{let s=0;for(const b of p.buffs[k])s+=b.amt;return s;};
/* ⚑ 주인 확정(2026-09-03) — 시간제 버프의 중첩 상한 전부 삭제(무한 중첩).
   발동될 때마다 계속 쌓이고 각자 자기 시간이 끝나면 빠진다. 넷째 인자까지만 읽으므로
   구 호출부가 넘기던 다섯째 인자(max)는 무시된다 — 표시 텍스트에서도 «최대 N중첩» 은 사라졌다. */
function addBuff(p,k,amt,dur){ p.buffs[k].push({t:dur,amt}); }
const pkk=(p,ch)=>Math.random()<ch*(p.px.procX2?1.22:1);
const effDmg=p=>{const px=p.px;let m=1+bsum(p,'atk');
  if(px.rage&&p.sh<=0)m*=1.5;                              /* 장비 옵션 */
  return p.dmg*m;};
const effAspd=p=>p.aspd*(1+bsum(p,'aspd'));
const effCritR=p=>p.critR+bsum(p,'critR');
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
  p.hp=Math.min(p.maxHp,p.hp+amt);
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
   두 엔진 다 챕터의 적을 시작할 때 한꺼번에 만들어 두므로(노드 간격 560px, 창 사거리 88×8=704px)
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
  const crit=Math.random()*100<cr;
  if(fromBasic&&p.nextCrit)p.nextCrit=false;
  /* ⚑ 적 회피 10% (PLAN §2.3 주인 확정). 판정을 치명타 굴림 «뒤» 에 두는 이유:
     빗맞아도 그 «공격» 은 일어난 것이라 nextCrit(여기) 과 nextAtk(playerStrike) 가 함께 소모된다 — 위임 기본값.
     여기가 유일한 빗맞음 지점이므로 «빗맞음 트리거» 축도 이 자리에 붙는다. */
  G.atkTries++;
  if(Math.random()<ENEMY_EVADE){G.miss++;procOnMiss(G,e);return false;}
  let d=effDmg(p)*ratio*(crit?effCritF(p)/100:1)*rand(0.92,1.08);
  /* 가산 보너스 풀 — «+n%» 로 적히는 데미지 보너스는 서로 합연산 (주인 정정 16:3X).
     스택형(빗맞음·회피)은 «적중 1타당 1개» 소모하고, 몇 장이 쌓여 있든 한 타에 한 번만 붙는다. */
  let addBonus=0;
  if(full&&px.firstHit)addBonus+=0.20*px.firstHit;           /* 장비 옵션 */
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
    gainWard(p,0.12*px.wardCrit);                            /* 장비 옵션 */
  }
  if(px.execKill&&!e.isBoss&&e.hp>0&&e.hp<=e.maxHp*0.25)e.hp=0;                 /* 장비 옵션 */
  if(e.hp<=0)onKill(G,e,-e.hp);
  return crit;
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
  for(let k=0;k<n;k++){const t=randTarget(G);if(t)pushProj(G,{type:'parrow',x:p.worldX+14,tgt:t,ratio:R_ARROW,spd:560});}}
/* 번개는 즉발(하늘에서 떨어진다) — 투사체를 만들지 않는다. 연쇄 개조는 새 10종 체제에 없다. */
function fireBolts(p,n){const G=p.G,px=p.px;n=(n||1)*(px.boltCount?2:1);
  for(let k=0;k<n;k++){
    const t=randTarget(G);if(!t)continue;
    summonHit(G,t,R_BOLT);
  }}
function fireWave(p,n){const G=p.G,px=p.px;n=n||1;
  const big=false;                                 /* 거대 검기 개조 특전은 새 10종에 없다 */
  const pierce=big?WAVE_PIERCE_BIG:(px.waveKing?20:WAVE_PIERCE);
  const reach=big?88*SPEAR_PIERCE:(px.waveKing?1400:340);
  for(let k=0;k<n;k++)pushProj(G,{type:'wave',x:p.worldX+14,ratio:R_WAVE,spd:470,maxX:p.worldX+reach,hit:new Set(),pierce,node:frontNode(G)});}
/* 창 관통 상한 8마리 — PLAN §3.0 «일직선 최대 8마리». 장비 «창 데미지» 옵션(spearMaster)은 계수만 올리고 관통 수는 그대로. */
function fireSpear(p,n){const G=p.G;n=n||1;
  for(let k=0;k<n;k++)pushProj(G,{type:'spear',x:p.worldX+14,ratio:p.px.spearMaster?13.5:R_SPEAR,spd:520,maxX:p.worldX+88*SPEAR_PIERCE,hit:new Set(),pierce:SPEAR_PIERCE,node:frontNode(G)});}
/* e = 이번 «공격» 이 맞힌 적 (기절 축이 대상을 알아야 한다). 소환 적중에서도 불린다. */
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
  gainWard(p,0.10*px.wardAtk);
}
function doCounter(G,src,depth){
  const p=G.player,px=p.px;
  if(!src||src.hp<=0)return;
  /* 반격도 «플레이어의 타격» 이라 적 회피 10% 를 탄다 (PLAN §2.3 주인 명시 3종 중 하나).
     빗맞으면 반격 연쇄(counterChain)도 끊긴다 — 위임 기본값. */
  G.atkTries++;
  if(Math.random()<ENEMY_EVADE){G.miss++;procOnMiss(G,src);return;}
  const cd=effDmg(p)*0.7*(1+px.counterX);                        /* counterX = 장비 옵션 */
  src.hp-=cd;
  /* 장비 옵션 축 (구 키) */
  if(px.counterAtkS)addBuff(p,'atk',0.05*px.counterAtkS,3);
  if(px.counterDefS)addBuff(p,'def',10*px.counterDefS,3);
  if(px.counterAtkM)addBuff(p,'atk',0.14*px.counterAtkM,4);
  if(px.counterCrit)addBuff(p,'critR',14,3);
  if(px.counterHeal)heal(p,p.maxHp*0.04*px.counterHeal);
  if(px.counterWave&&pkk(p,1.0*px.counterWave))fireWave(p,1);
  /* ⑩ 반격 시 창 — 반격 1회당 50% 확률로 창 1개 (쿨다운 없음) */
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
    gainWard(p,0.10*px.wardEvade);
    /* ⑨ 회피 시 화살 — 회피 1회당 50% 확률로 화살 1발 */
    if(px.p_arrowEv&&pkk(p,PERK_SUMMON_CH))fireArrows(p,1);
    /* ☠️🌾 사신의 낫 — 회피 시 20% 확률로 그 적 즉사. **보스 포함**(주인 명시).
       게임에는 낫이 베는 전용 연출이 붙는다(일반 처치 연기와 구별). */
    return;
  }
  /* ===== 맞았다 ===== */
  /* 횟수형 방어막 — 이 타격 «1회» 를 통째로 무효화하고 1장 소모한다 (수치형 실드보다 먼저).
     «데미지 완전 무효» 라 방어력·실드·체력을 아예 건드리지 않지만, «맞은 사건» 자체는 일어난 것이라
     아래 피격 트리거들은 그대로 굴린다(주인 원문이 «그 타격 데미지 완전 무효» 이므로 — 위임 판단). */
  const warded=p.ward>0;
  if(warded){
    p.ward--;
    /* ===== 방어막 방어 트리거 ===== */
  }
  const nulled=warded;
  let d=nulled?0:dmg*(1-effDef(p)/100);
  if(!nulled&&px.guardCrystal&&p.sh>0)d*=0.80;
  if(!nulled&&p.sh>0){const ab=Math.min(p.sh,d);p.sh-=ab;d-=ab;}
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
  gainWard(p,0.08*px.wardHit);
  if(px.stunHitS&&src&&pkk(p,0.20*px.stunHitS))applyStun(G,src,3);
  if(px.stunHitL&&src&&pkk(p,0.55*px.stunHitL))applyStun(G,src,3);
  /* ⑧ 피격 시 도끼 — 피격 1회당 50% 확률로 도끼 1개 */
  if(px.p_axeHit&&pkk(p,PERK_SUMMON_CH))fireAxe(p,1);
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
  const crit=dealDmg(G,e,ratio,true);
  if(px.clone&&e.hp>0)dealDmg(G,e,0.25);                       /* 장비 옵션 */
  if(crit&&px.extraHit&&pkk(p,0.75*px.extraHit)&&e.hp>0)dealDmg(G,e,2.3);   /* 장비 옵션 */
  procOnAttack(G,e);
}

/* ---------- 특전 획득 = «순서대로 자동» (⚑⚑⚑ 주인 확정 2026-09-03 · PLAN §2.4·§3) ----------
   레벨업할 때마다 `PERKS` 배열의 다음 순번을 하나 준다. **선택창·등급 굴림·새로고침·전지의 눈은 없다.**
   10개를 다 얻은 뒤의 레벨업은 특전을 주지 않는다(위임 기본값 — 반복 획득을 원하시면 한 줄로 정정).
   악마의 거래도 같은 동사를 거친다(«다음 순번을 하나 앞당겨 준다» — 위임 기본값). */
function grantPerkChance(G){ G.perkChances++; }
/* 다음 순번 특전 1개를 지급한다. 지급했으면 그 특전을, 남은 게 없으면 null 을 돌려준다. */
function grantNextPerk(G){
  grantPerkChance(G);   /* 레벨업·악마 = 특전 기회 1번 (PLAN §4) */
  if(G.noPerk)return null;   /* 진단용 «특전 미획득» 자 — 사다리 회귀 대조에만 쓴다 */
  if(G.taken.length>=PERKS.length)return null;   /* 10개를 다 얻으면 더는 안 준다 */
  const perk=PERKS[G.taken.length];              /* ⚑ 순서 = 배열 순서. 무작위·중복이 존재하지 않는다 */
  perk.ap(G.player);
  G.taken.push(perk);
  return perk;
}

/* ---------- 챕터 1회 실행 ---------- */
function runChapter(chapter,build,opts){
  opts=opts||{};
  const G={chapter,player:null,nodes:[],pprojs:[],arrows:[],gold:0,kills:0,procN:0,
    perkChances:0,taken:[],overBoltCd:0,autoBoltT:3,stuns:0,misses:0,
    dead:false,cleared:false,t:0,atkTries:0,miss:0,   /* 적 회피 10% 실측용 (PLAN §2.3) */
    noPerk:!!opts.noPerk};
  const p=mkPlayer(build,G);G.player=p;p.G=G;
  const layout=chapterLayout(chapter);
  let x=560,wi=0;
  for(const node of layout){
    const nd={type:node.t,x,done:false,enemies:[]};
    if(node.t==='wave'){
      const st=enemyStats(chapter,wi);
      for(let j=0;j<node.size;j++){
        const ranged=Math.random()<0.4&&j>0;
        nd.enemies.push({worldX:x+j*88,hp:st.hp,maxHp:st.hp,dmg:st.dmg,ranged,
          atkTimer:rand(0.4,1.2),stun:0,slow:0,wave:nd,dead:false,isBoss:false,exp:0});
      }
      wi++;x+=(node.size-1)*88+560;
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
          /* ⚑ T96 — «전설 확정» 은 등급과 함께 사라졌다. 악마는 **다음 순번 특전을 하나 앞당겨 준다**
             (주인 위임 기본값 — 특전이 순서 고정이라 «전설 확정» 이 의미를 잃었다).
             줄 특전이 남아 있을 때만 거래가 성립한다 — 10개를 다 얻었으면 비용도 안 내고 지나간다(위임).
             비용(최대체력 30% 차감)·«항상 수락» 정책은 T90 그대로다. */
          if(!G.noPerk&&G.taken.length<PERKS.length){
            payDevilCost(p);   /* 비용 = 최대체력의 30% 를 «최대치에서» 차감 (현재체력 차감 아님) */
            grantNextPerk(G);
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
    if(dist>74){p.worldX+=132*p.walkMul*dt;p.atkTimer=Math.min(p.atkTimer,0.35);}
    else{p.atkTimer-=dt*effAspd(p);if(p.atkTimer<=0){p.atkTimer+=1;playerStrike(G,tgt);}}
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
        /* ⛓️ 기절이 끝난 적은 3초간 공격속도 -50% */
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
  while(a.gem>=GT.pullCost){ a.gem-=GT.pullCost; a.inv.push(gachaPull(a.gacha)); n++; a.pulls++; }
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
/* ⚑⚑⚑ 실험1 = «난이도 과녁 2점» (주인 확정 2026-09-03 · T96/T97 국면의 1순위 과녁) ----------
   **종전의 «등급 강제 클리어율(일반 10 · 희귀 20 · 전설 80)» 은 등급이 폐지되어 측정 대상이 사라졌다.**
   주인이 그 자리에 놓은 새 과녁은 딱 두 점이다 (원문 «15챕터 정도에서 승리 확률 10%,
   노장비로는 4스테이지 정도까지가 승리 확률 30%»):
     ① 표준 장비(희귀 풀셋 · 슬롯 0) + 특전 순서 획득 → **챕터 15 클리어율 ≈ 10%**
     ② 노장비(장비 0 · 슬롯 0)   + 특전 순서 획득 → **챕터 4  클리어율 ≈ 30%**
   허용 오차 **±2%p** · 판수는 과녁당 1,000판 이상(주인 위임 기본값 · 기존 회귀 측정 규약 그대로).
   자(尺)에 «등급 고정» 이 없다 — 특전은 순서 획득이라 런마다 같은 순서로만 붙는다.
   ⚠ 이 함수는 **재는 자일 뿐 맞추는 것은 T97** 이다(난이도 노브 = TUNE 구간 성장률·벽 배수·적 수). */
const EXP1_TARGETS=[
  {id:'표준 장비(희귀 풀셋·슬롯0)', rar:1, plus:0, slot:0, at:15, want:10},
  {id:'노장비(장비0·슬롯0)',        rar:-1,plus:0, slot:0, at:4,  want:30},
];
const EXP1_TOL=2;                  // ±%p (주인 확정)
const EXP1_SCORE_N=1000;           // 과녁당 채점 판수 하한 (주인 확정 «1,000판 이상»)
function exp1_targets(){
  const N=parseInt(process.env.EXP1_N||String(EXP1_SCORE_N),10);
  const span=parseInt(process.env.EXP1_SPAN||'0',10);   /* >0 이면 과녁 ±span 챕터도 함께 찍는다(탐색용) */
  console.log(`\n=== 실험1: 난이도 과녁 2점 (주인 확정 · 각 ${N}판 · 특전 순서 획득 · 허용 ±${EXP1_TOL}%p) ===`);
  const rows=[];
  for(const T of EXP1_TARGETS){
    const b=mkBuild(T.rar,T.plus,T.slot);   /* rar<0 = 노장비 (사다리 «노템» 칸과 같은 자) */
    const pw=buildPower(b);
    console.log(`\n  [${T.id}] → 과녁 챕터 ${T.at} · ${T.want}%`);
    console.log(`    스탯: 공 ${pw.atk.toFixed(1)} / 체 ${pw.hp.toFixed(1)} / 실 ${pw.sh.toFixed(1)}`);
    for(let c=T.at-span;c<=T.at+span;c++){
      if(c<1)continue;
      let w=0;
      for(let i=0;i<N;i++) if(runChapter(c,b).clear)w++;
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
  console.log('  등급·선택창이 사라져 «등급 내 폭» 은 측정 대상이 없다. 새 과녁은 실험1(난이도 과녁 2점)이다.');
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
      const my=GT.parts.filter(pt=>a.eq[pt]&&a.eq[pt].rar===4).length;
      console.log(`  ${String(d).padStart(3)}일차: 챕터 ${String(chap-1).padStart(3)} 클리어  슬롯 ${slotStr(a)}  신화 ${my}/6  장비 ${eqStr(a)}  누적뽑기 ${a.pulls}`);
    }
    if(tries>GT.runsPerDay*STUCK){ stuckFrom=chap; stuck=tries; break; }   /* STUCK 일 넘게 한 챕터에 정체 = 막힘 (90·300 대형 벽은 원래 오래 걸리므로 기본 40일) */
  }
  const my=GT.parts.filter(pt=>a.eq[pt]&&a.eq[pt].rar===4).length;
  console.log(`최종: 챕터 ${chap-1} 클리어 · 슬롯 ${slotStr(a)} · 신화 부위 ${my}/6 · 뽑기 ${a.pulls}회 · 합성 ${a.fuses}회 · 총 ${total}판`
    +(doneDay?`  ★ 전 챕터(${TUNE.maxChapter}) 완주 — ${doneDay}일차`:''));
  /* ⚑ T1 R02 — 기준 ① 직접 판정. 마지막 챕터는 아직 클리어 전이라 진행 중 판수(tries)도 후보에 넣는다.
     ⚑ T1 R03(T59) — 완주한 런은 «진행 중» 이 없으므로 이 보정을 하지 않는다. */
  if(!doneDay&&tries>worstTries){worstTries=tries;worstCh=chap;}
  /* ⚑ T97 — 실험4 기준 ①②③ 은 주인 지시로 폐기됐다(«나머지 기준은 다 폐기»). 숫자는 계속 찍되 합격/불합격을 달지 않는다. */
  console.log(`[진단] 최장 연속 실패: 챕터 ${worstCh} 에서 ${worstTries}판(${(worstTries/GT.runsPerDay).toFixed(1)}일) — 참고 눈금 ${GT.runsPerDay*20}판(20일)`);
  if(stuckFrom>0)console.log(`** 정체 감지: 챕터 ${stuckFrom} 에서 ${stuck}판(${(stuck/GT.runsPerDay).toFixed(0)}일) 연속 실패 — 90·300 은 대형 벽이라 정상, 그 외 챕터면 경제가 막힌 것 **`);
}
/* ---------- 실험5: 스탯 사다리 7점 검증 (⚑ T35 — PLAN §11.7 주인 확정 과녁) ---------- */
/* 종전의 앵커 3점(C=30 · A=90 · B=300)은 주인이 폐기했다. 유일한 과녁은 아래 «등급별 스탯 사다리» 다:
   노템 5 · 일반 15 · 희귀 30 · 영웅 50 · 전설 70 · 신화 120 · 신화+9강 260 (전부 슬롯 0렙).
   ~~합격 구간은 §7 T6 제안 기준을 그대로 승계한다 — 과녁 챕터 클리어율 2~10%~~ → **폐기**(아래 T97).
   ⚑⚑ 측정 조건 = **특전 순서 획득**(T96 · 2026-09-03). 종전의 «일반 특전만 뜨는 런»(승인 38번 A안)은
   등급이 폐지되어 성립하지 않는다 — 이제 모든 런이 같은 순서로 같은 10종을 받으므로 자가 하나뿐이다.
   ⚠ `noPerk` 옵션은 «특전 미획득» 을 따로 볼 때만 쓰는 진단용으로 남는다 — 채점에는 안 쓴다.
   ⚑⚑⚑ T97 (2026-09-03) — **사다리 7점은 주인 지시로 폐기됐다**(«방금 말한 게 기준이고 나머지 기준은 다 폐기»).
      유효한 기준은 실험1 의 과녁 2점뿐이다. 이 실험은 «장비 등급별로 어디까지 가나» 를 보는 **진단 전용**으로 남는다 —
      합격 구간 2~10% 판정을 출력에서 뺐다(폐기된 기준으로 ✓/✗ 를 찍으면 다음 워커가 그것을 과녁으로 착각한다).
      ⚠ 새 과녁이 «희귀 풀셋 = 챕터 15» 로 못박아 아래 표의 «희귀 = 30» 과는 애초에 양립하지 않는다.
      아래 `at` 은 **폐기된 옛 과녁 챕터**이고, 지금은 «그 챕터에서 몇 %인가» 를 보는 관측 지점일 뿐이다. */
const LADDER=[
  {id:'노템',      rar:-1, plus:0, at:5,   want:[25,150,250]},
  {id:'일반',      rar:0,  plus:0, at:15,  want:[50,250,400]},
  {id:'희귀',      rar:1,  plus:0, at:30,  want:[100,500,800]},
  {id:'영웅',      rar:2,  plus:0, at:50,  want:[200,700,1300]},
  {id:'전설',      rar:3,  plus:0, at:70,  want:[530,1000,2200]},
  {id:'신화',      rar:4,  plus:0, at:120, want:[1200,2385,5000]},
  {id:'신화+9강',  rar:4,  plus:9, at:260, want:[2600,5000,10000]},
];
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
  console.log(`\n=== 실험5: 스탯 사다리 (진단 전용 — 기준 폐기 · 각 챕터 ${N}판 · 슬롯 0렙 · 특전 순서 획득) ===`);
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
      for(let i=0;i<N;i++) if(runChapter(c,b).clear)w++;   /* ⚑ T96 — 사다리 자 = «특전 순서 획득» */
      const rate=w/N*100;
      const exp=rate>0?(100/rate).toFixed(1)+'회':'∞';
      const tag=c===L.at?'   ← 옛 과녁 챕터 (기준 폐기 · 관측 지점)':'';
      console.log(`    챕터 ${String(c).padStart(3)}: 클리어율 ${rate.toFixed(1)}%  (기대 재도전 ${exp})${tag}`);
      if(c===L.at) rows.push([L.id,L.at,rate]);
    }
  }
  console.log(`\n  — 사다리 요약 (진단 — 판정 없음. 유효 기준은 실험1 의 과녁 2점뿐) —`);
  console.log(`  | 상태 | 옛 과녁 챕터 | 클리어율 |`);
  console.log(`  |---|---|---|`);
  for(const [id,at,rate] of rows)
    console.log(`  | ${id} | ${at} | ${rate.toFixed(1)}% |`);
}

/* ---------- 계열 옵션표 덤프 (PLAN §11.6 등재용) ---------- */
function dumpGearTable(){
  const step=['희귀(1)','영웅(2)','전설(3)','신화(4)','신화+3(5)','신화+6(6)','신화+9(7)'];
  console.log('| 부위 | 종류 | 계열 | '+step.map((s,i)=>`옵션${i+1} · ${s}`).join(' | ')+' |');
  console.log('|---|---|---|'+step.map(()=>'---').join('|')+'|');
  const line={greatsword:'검기',axe:'도끼 소환',bow:'화살 소환',helmet:'방어',crown:'치명타 확률',hood:'번개 소환',
    plate:'체력·피격',chain:'가시 반사',robe:'실드',gauntlet:'치명타 배율',leather:'공격속도',handwrap:'연타·분신',
    sandal:'회피',boots:'반격',greave:'체력',pendant:'회복',amulet:'처치',beads:'창 소환'};
  for(const pt of GT.parts) for(const ty of GT.types[pt])
    console.log(`| ${GT.partName[pt]} | ${GT.typeName[ty]} | ${line[ty]} | `+GOPT[ty].map(o=>o.d).join(' | ')+' |');
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
