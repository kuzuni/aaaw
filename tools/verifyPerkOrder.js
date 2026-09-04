#!/usr/bin/env node
/* ⚑⚑⚑ T96 게이트 — «특전 = 고정 10종 · 순서 획득» (주인 확정 2026-09-03)
 *
 * 이 게이트가 132종 시절의 특전 게이트 10종을 통째로 대체한다
 * (verifyPerkFire·verifyPerkFireHtml·verifyPerkEffect·verifyPerkEffectHtml·verifyPerkEngineParity·
 *  verifyCommonFreeze·verifyCollector·verifyPerkGearDup·verifyPerkPolicy·verifyHarness — 전부 대상 소멸).
 *
 * 보는 것은 셋이다:
 *   ① **3자 대조 (정적)** — PLAN §3.1 표 ↔ sim.js ↔ index.html 의 id·순서·수치·표시 텍스트가 같은가.
 *   ② **3택 1 (실행)** — ⚑⚑⚑ T117 로 «순서대로 하나씩» 이 «3장 중 1장» 으로 바뀌었다:
 *        제시 3장(남은 것이 3 미만이면 그만큼) · 카드 안 중복 0 · 이미 얻은 것 제외 · 무작위 ·
 *        시뮬 측정 정책(제시 3장 중 §3.1 표 순서가 가장 앞선 것) · 한 런 상한(PERK_PICKS)에서 멈춤.
 *   ③ **폐지분 (구조)** — 등급·새로고침·전지의 눈이 정말 사라졌는가(⚑ T117 로 «선택창» 만 돌아왔다) +
 *        소환 연쇄 기대값 B = 0.
 *
 * 사용: node tools/verifyPerkOrder.js        (exit 0 = 통과, 1 = 불합격)
 *      node tools/verifyPerkOrder.js --self  (음성 검사 — 일부러 깨뜨린 사본이 전부 빨개지는지)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const R = [];
const chk = (n, c, d) => { R.push({ n, c }); console.log(`  ${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); return c; };

/* ---------- 주인 확정표 (ROUTINE ⑦ · PLAN §3.1) — 이 배열이 이 게이트의 기준이다.
   ⚑⚑⚑ T104 (주인 확정 2026-09-03) — 순서 재정렬 + 1번 특전 «생명 흡수» → «회피 시 회복» 으로 교체.
   ⚑⚑⚑ T109 (주인 확정 2026-09-03 18:5X) — **2·3번 ↔ 6·7번 교체**. 주인 원문 «2번 3번을 6번 7번과 위치를 교체».
     효과·수치·id 는 한 글자도 안 바뀌고 순서만 바뀐다: 반격률·반격 시 창이 6·7 로 내려가고 공격력·회피율이 2·3 으로 올라온다.
   ⚑⚑⚑ T108 (주인 확정 2026-09-03 18:4X) — 소환 3종(창·화살·도끼)이 **확정 발동**이 됐다(`PERK_SUMMON_CH` 0.50 → 1.00).
     그래서 표시 문면에서 «50% 확률로» 를 걷어냈다 — «반격 시 창 1개» 식. 소환 데미지·발수·트리거 자리는 그대로. ---------- */
/* ⚑⚑⚑ T119 (주인 확정 2026-09-04 13:0X · 13:2X 정정) — 풀이 32종이 되고 등급이 부활했다.
   기존 10종 = 일반(수치 불변) · 신규 22종(일반 5 · 희귀 8 · 전설 9). 이 배열이 이 게이트의 기준이고
   PLAN §3.1 표·sim.js mkPerks()·index.html PERKS 셋을 여기에 대조한다. g: 0 일반 · 1 희귀 · 2 전설.
   ⚑⚑⚑ T121 (주인 확정 2026-09-04 16:0X · 16:2X ⑤ · 16:3X 재정정) — 풀 32 → **66종**(일반 30 · 희귀 20 · 전설 16).
     ⓐ 기존 5종의 **수치가 내려갔다**: 공격력 +20% → +15% · 회피율/반격률/치확 +10 → +8 · 치피 +50 → +30.
       사다리 «기준 플레이어» 의 특전이라 기준이 약해지지만 **적 스탯 재적합은 없다**(T120 ④ 상시 규칙).
     ⓑ 신규 34종(일반 15 · 희귀 12 · 전설 7)이 각 등급 «기존 것 뒤에» 붙는다. 같은 이름의 I/II/III 는
       **서로 다른 특전**이라 한 판에 여럿 얻을 수 있고 각각 따로 굴린다(즉사·스턴·N타 소환).
     ⓒ id 는 종전 규약대로 등급 접미 N/R/L 을 쓴다 — 이 게이트의 id regex 가 `p_[A-Za-z]+`(숫자 없음)라
       «II» 를 `2` 로 적으면 그 행이 통째로 안 보인다(실제로 한 번 걸렸다: 66종이 60종으로 읽혔다). */
const WANT = [
  { id: 'p_evadeHeal', g: 0, nm: '회피 시 회복', tx: '회피 시 8% 확률로 최대 체력 6% 회복' },
  { id: 'p_atk', g: 0, nm: '공격력 증가', tx: '공격력 +15%' },
  { id: 'p_evade', g: 0, nm: '회피율 증가', tx: '회피율 +8' },
  { id: 'p_arrowEv', g: 0, nm: '회피 시 화살', tx: '회피 시 33% 확률로 화살 1개' },
  { id: 'p_axeHit', g: 0, nm: '피격 시 도끼', tx: '피격 시 33% 확률로 도끼 1개' },
  { id: 'p_counter', g: 0, nm: '반격률 증가', tx: '반격률 +8' },
  { id: 'p_spearCt', g: 0, nm: '반격 시 창', tx: '반격 시 창 1개' },
  { id: 'p_critR', g: 0, nm: '치명타 확률 증가', tx: '치명타 확률 +8' },
  { id: 'p_critF', g: 0, nm: '치명타 피해 증가', tx: '치명타 피해 +30' },
  { id: 'p_def', g: 0, nm: '방어력 증가', tx: '방어력 +8%' },
  { id: 'p_killSpearN', g: 0, nm: '처치 시 창', tx: '처치 시 33% 확률로 창 1개' },
  { id: 'p_killBoltN', g: 0, nm: '처치 시 번개', tx: '처치 시 33% 확률로 보이는 적 전부에게 번개 1회씩' },
  { id: 'p_killArrowN', g: 0, nm: '처치 시 화살', tx: '처치 시 33% 확률로 화살 3개' },
  { id: 'p_killAxeN', g: 0, nm: '처치 시 도끼', tx: '처치 시 33% 확률로 도끼 2개' },
  { id: 'p_thornsN', g: 0, nm: '가시갑옷', tx: '가시갑옷 +100%' },
  { id: 'p_killEvBuff', g: 0, nm: '처치 시 회피 버프', tx: '처치 시 2초간 회피율 +40' },
  { id: 'p_collAtk', g: 0, nm: '수집가·공격', tx: '보유 특전 하나당 공격력 +4%' },
  { id: 'p_collCrit', g: 0, nm: '수집가·치명', tx: '보유 특전 하나당 치명타 확률 +2' },
  { id: 'p_killAtkStk', g: 0, nm: '처치 시 공격력 스택', tx: '처치 시 33% 확률로 공격력 +1%(이 판 동안 누적)' },
  { id: 'p_killEvStk', g: 0, nm: '처치 시 회피 스택', tx: '처치 시 33% 확률로 회피율 +1(이 판 동안 누적)' },
  { id: 'p_killHealN', g: 0, nm: '처치 시 회복', tx: '처치 시 33% 확률로 최대 체력 6% 회복' },
  { id: 'p_collHp', g: 0, nm: '수집가·체력', tx: '보유 특전 하나당 최대 체력 +7%' },
  { id: 'p_critStack', g: 0, nm: '치명 스택', tx: '평타 적중마다 치명타 확률 +1(치명타 시 초기화)' },
  { id: 'p_aspdAtk', g: 0, nm: '공격 시 공속 버프', tx: '공격 시 공격속도 +7% 7초(중첩)' },
  { id: 'p_execEvN', g: 0, nm: '회피 시 즉사', tx: '회피 시 5% 확률로 그 적 즉사' },
  { id: 'p_stunCritN', g: 0, nm: '치명타 시 스턴', tx: '치명타 시 10% 확률로 3초 스턴' },
  { id: 'p_nArrowN', g: 0, nm: '2타 화살', tx: '2타마다 무작위 적에게 화살 1개' },
  { id: 'p_nAxeN', g: 0, nm: '3타 도끼', tx: '3타마다 무작위 적에게 도끼 1개' },
  { id: 'p_nBoltN', g: 0, nm: '3타 번개', tx: '3타마다 무작위 적에게 번개 1회' },
  { id: 'p_nHealN', g: 0, nm: '5타 회복', tx: '5타마다 최대 체력 6% 회복' },
  { id: 'p_evadeStun', g: 0, nm: '회피 시 스턴', tx: '회피 시 30% 확률로 공격한 적 3초 스턴' },
  { id: 'p_ctCritN', g: 0, nm: '반격 치명', tx: '반격 시 치명타 확률 +20' },
  { id: 'p_ctDmgN', g: 0, nm: '반격 강화', tx: '반격 데미지 +30%' },
  { id: 'p_killSureCrit', g: 0, nm: '처치 시 확정 치명', tx: '처치 시 다음 공격은 반드시 치명타' },
  { id: 'p_cleaveN', g: 0, nm: '관통 베기', tx: '공격 시 33% 확률로 바로 뒤 적도 같은 데미지' },
  /* ⚑⚑⚑ T121 3차 신규 일반 4종 (주인 확정 18:2X) */
  { id: 'p_ignoreN', g: 0, nm: '피해 무시', tx: '피격 시 20% 확률로 그 피격 데미지 무시' },
  { id: 'p_noShAtk', g: 0, nm: '실드 없을 때 공격력', tx: '실드가 0 인 동안 공격력 +50%' },
  { id: 'p_noShAspd', g: 0, nm: '실드 없을 때 공속', tx: '실드가 0 인 동안 공격속도 +30%' },
  { id: 'p_wardHitN', g: 0, nm: '피격 시 방어막', tx: '피격 시 10% 확률로 방어막 1장' },
  { id: 'p_fullHp', g: 1, nm: '풀피 적 강타', tx: '체력이 가득 찬 적 공격 시 데미지 +100%' },
  { id: 'p_repairUp', g: 1, nm: '수리 증폭', tx: '실드 수리량 +100%' },
  { id: 'p_healUp', g: 1, nm: '회복 증폭', tx: '체력 회복량 +100%' },
  { id: 'p_thornsR', g: 1, nm: '가시갑옷', tx: '가시갑옷 +200%' },
  { id: 'p_killSpearR', g: 1, nm: '처치 시 창', tx: '처치 시 66% 확률로 창 1개' },
  { id: 'p_killBoltR', g: 1, nm: '처치 시 번개', tx: '처치 시 66% 확률로 보이는 적 전부에게 번개 1회씩' },
  { id: 'p_killArrowR', g: 1, nm: '처치 시 화살', tx: '처치 시 66% 확률로 화살 3개' },
  { id: 'p_killAxeR', g: 1, nm: '처치 시 도끼', tx: '처치 시 66% 확률로 도끼 2개' },
  { id: 'p_healRepair', g: 1, nm: '회복 시 수리', tx: '체력 회복 시 같은 양만큼 실드 수리' },
  { id: 'p_killRepair', g: 1, nm: '처치 시 수리', tx: '처치 시 66% 확률로 최대 실드 6% 수리' },
  { id: 'p_critFR', g: 1, nm: '치명타 피해 증가 II', tx: '치명타 피해 +60' },
  { id: 'p_execEvR', g: 1, nm: '회피 시 즉사 II', tx: '회피 시 10% 확률로 그 적 즉사' },
  { id: 'p_stunCritR', g: 1, nm: '치명타 시 스턴 II', tx: '치명타 시 20% 확률로 3초 스턴' },
  { id: 'p_nArrowR', g: 1, nm: '2타 화살 II', tx: '2타마다 무작위 적에게 화살 2개' },
  { id: 'p_nAxeR', g: 1, nm: '3타 도끼 II', tx: '3타마다 무작위 적에게 도끼 2개' },
  { id: 'p_nBoltR', g: 1, nm: '3타 번개 II', tx: '3타마다 무작위 적에게 번개 2회' },
  { id: 'p_critRR', g: 1, nm: '치명타 확률 증가 II', tx: '치명타 확률 +16' },
  { id: 'p_counterR', g: 1, nm: '반격률 증가 II', tx: '반격률 +16' },
  { id: 'p_atkR', g: 1, nm: '공격력 증가 II', tx: '공격력 +30%' },
  { id: 'p_evadeR', g: 1, nm: '회피율 증가 II', tx: '회피율 +16' },
  { id: 'p_killDash', g: 1, nm: '처치 시 대시', tx: '처치 시 같은 웨이브의 다음 적까지 대시' },
  { id: 'p_berserkStk', g: 1, nm: '버서커', tx: '처치 시 스택 1 · 평타마다 1 소모하고 그 공격 +100%' },
  { id: 'p_ctCritR', g: 1, nm: '반격 치명 II', tx: '반격 시 치명타 확률 +40' },
  { id: 'p_ctDmgR', g: 1, nm: '반격 강화 II', tx: '반격 데미지 +60%' },
  { id: 'p_cleaveR', g: 1, nm: '관통 베기 II', tx: '공격 시 66% 확률로 바로 뒤 적도 같은 데미지' },
  /* ⚑⚑⚑ T121 3차 신규 희귀 7종 (주인 확정 17:5X · 18:0X · 18:2X · 18:4X) */
  { id: 'p_arrowEvR', g: 1, nm: '회피 시 화살 II', tx: '회피 시 66% 확률로 화살 1개' },
  { id: 'p_axeHitR', g: 1, nm: '피격 시 도끼 II', tx: '피격 시 66% 확률로 도끼 1개' },
  { id: 'p_evHealR', g: 1, nm: '회피 시 회복 II', tx: '회피 시 15% 확률로 최대 체력 6% 회복' },
  { id: 'p_evRepairR', g: 1, nm: '회피 시 수리', tx: '회피 시 15% 확률로 최대 실드 6% 수리' },
  { id: 'p_defR', g: 1, nm: '방어력 증가 II', tx: '방어력 +16%' },
  { id: 'p_wardHitR', g: 1, nm: '피격 시 방어막 II', tx: '피격 시 20% 확률로 방어막 1장' },
  { id: 'p_critSpearR', g: 1, nm: '치명 시 창', tx: '치명타 시 33% 확률로 창 1개' },
  { id: 'p_killSpearL', g: 2, nm: '처치 시 창', tx: '처치 시 창 1개' },
  { id: 'p_killBoltL', g: 2, nm: '처치 시 번개', tx: '처치 시 보이는 적 전부에게 번개 1회씩' },
  { id: 'p_overkill', g: 2, nm: '오버킬 회복', tx: '처치 시 남은 데미지만큼 체력 회복' },
  { id: 'p_killArrowL', g: 2, nm: '처치 시 화살', tx: '처치 시 화살 3개' },
  { id: 'p_killAxeL', g: 2, nm: '처치 시 도끼', tx: '처치 시 도끼 2개' },
  { id: 'p_berserk', g: 2, nm: '광전사', tx: '공격력 300% 가 되는 대신 치명타 확률 0%' },
  { id: 'p_nobleEye', g: 2, nm: '귀족의 눈', tx: '다음 특전부터 최소 희귀 이상만 나온다' },
  { id: 'p_spearAvatar', g: 2, nm: '창의 화신', tx: '내가 쏘는 모든 화살이 창으로 바뀐다' },
  { id: 'p_thornsL', g: 2, nm: '가시갑옷', tx: '가시갑옷 +300%' },
  { id: 'p_giant', g: 2, nm: '거인의 힘', tx: '공격력 +200% 대신 공격속도 2/3' },
  { id: 'p_execEvL', g: 2, nm: '회피 시 즉사 III', tx: '회피 시 15% 확률로 그 적 즉사' },
  { id: 'p_stunCritL', g: 2, nm: '치명타 시 스턴 III', tx: '치명타 시 30% 확률로 3초 스턴' },
  { id: 'p_nArrowL', g: 2, nm: '2타 화살 III', tx: '2타마다 무작위 적에게 화살 3개' },
  { id: 'p_nAxeL', g: 2, nm: '3타 도끼 III', tx: '3타마다 무작위 적에게 도끼 3개' },
  { id: 'p_nBoltL', g: 2, nm: '3타 번개 III', tx: '3타마다 무작위 적에게 번개 3회' },
  { id: 'p_nSpearL', g: 2, nm: '3타 창', tx: '3타마다 창 1개' },
  { id: 'p_cleaveL', g: 2, nm: '관통 베기 III', tx: '공격 시 바로 뒤 적도 같은 데미지' },
  /* ⚑⚑⚑ T121 3차 신규 전설 11종 (주인 확정 17:5X · 18:0X · 18:2X) */
  { id: 'p_critSpearL', g: 2, nm: '치명 시 창', tx: '치명타 시 66% 확률로 창 1개' },
  { id: 'p_critBoltL', g: 2, nm: '치명 시 번개', tx: '치명타 시 66% 확률로 보이는 적 전부에게 번개 1회씩' },
  { id: 'p_arrowEvL', g: 2, nm: '회피 시 화살 III', tx: '회피 시 화살 1개' },
  { id: 'p_axeHitL', g: 2, nm: '피격 시 도끼 III', tx: '피격 시 도끼 1개' },
  { id: 'p_spearEvL', g: 2, nm: '회피 시 창', tx: '회피 시 33% 확률로 창 1개' },
  { id: 'p_spearHitL', g: 2, nm: '피격 시 창', tx: '피격 시 33% 확률로 창 1개' },
  { id: 'p_evRepairL', g: 2, nm: '회피 시 수리 II', tx: '회피 시 25% 확률로 최대 실드 6% 수리' },
  { id: 'p_defL', g: 2, nm: '방어력 증가 III', tx: '방어력 +24%' },
  { id: 'p_shWallL', g: 2, nm: '실드 방벽', tx: '실드가 있으면 피격 시 50% 확률로 데미지 무시' },
  { id: 'p_shRefL', g: 2, nm: '실드 반사', tx: '실드가 있으면 피격 시 50% 확률로 그 데미지를 반사' },
  { id: 'p_wardHitL', g: 2, nm: '피격 시 방어막 III', tx: '피격 시 30% 확률로 방어막 1장' },
];
const GRADE_NAME = ['일반', '희귀', '전설'];
const GRADE_N = [39, 32, 28];        /* 주인 확정 등급별 개수 (⚑ T121 3차 — 17:5X~18:4X 로 22종 더 · 합 99) */
const GRADE_RATE = [60, 25, 15];     /* ⚑ 13:2X 주인 정정 (처음 50/30/20) */
/* ⚑ T104 — `PERK_STEAL` 은 폐기됐다(특전에서 흡혈 축이 사라졌다). 자리에 `PERK_EVHEAL_CH`·`PERK_EVHEAL_F` 신설.
   ⚑ T119 — 신규 22종이 쓰는 상수 9종 추가(두 엔진 같은 이름·같은 값). */
const CONST = { PERK_ATK_M: '1.15', PERK_DEF_M: '1.08', PERK_EVADE_A: '8', PERK_COUNTER_A: '8',
  PERK_CRITR_A: '8', PERK_CRITF_A: '30', PERK_EVHEAL_CH: '0.08', PERK_EVHEAL_F: '0.06', PERK_SUMMON_CH: '1.00',
  PERK_KILL_N: '0.33', PERK_KILL_R: '0.66', PERK_KILL_L: '1.00',
  PERK_THORN_N: '1.00', PERK_THORN_R: '2.00', PERK_THORN_L: '3.00',
  PERK_AMP: '1.00', PERK_FULLHP_A: '1.00', PERK_BERSERK_M: '3.00',
  /* ⚑ T121 신규 상수 22종 — 두 엔진 같은 이름·같은 값 (주인 확정 16:0X ① · 16:2X ⑤) */
  PERK_KILLEV_A: '40', PERK_KILLEV_T: '2',
  PERK_COLL_ATK: '0.04', PERK_COLL_CRIT: '2', PERK_COLL_HP: '0.07',
  PERK_KSTACK_CH: '0.33', PERK_KSTACK_ATK: '0.01', PERK_KSTACK_EV: '1',
  PERK_KHEAL_CH: '0.33', PERK_KHEAL_F: '0.06',
  PERK_KREPAIR_CH: '0.66', PERK_KREPAIR_F: '0.06',
  PERK_CSTACK_A: '1', PERK_ASPDATK_A: '0.07', PERK_ASPDATK_T: '7',
  PERK_EXEC_N: '0.05', PERK_EXEC_R: '0.10', PERK_EXEC_L: '0.15',
  PERK_STUNC_N: '0.10', PERK_STUNC_R: '0.20', PERK_STUNC_L: '0.30', PERK_STUNC_T: '3',
  PERK_NHEAL_F: '0.06',
  PERK_CRITF_R: '60', PERK_CRITR_R: '16', PERK_COUNTER_R: '16', PERK_EVADE_R: '16', PERK_ATK_R: '1.30',
  PERK_GIANT_M: '3.00', PERK_GIANT_ASPD: '2/3',
  /* ⚑ 17:3X 주인 정정 — 화살 3타 → 2타 · 도끼/번개/창/회복 4타 → 3타 */
  PERK_NHIT_ARROW: '2', PERK_NHIT_AXE: '3', PERK_NHIT_BOLT: '3', PERK_NHIT_SPEAR: '3', PERK_NHIT_HEAL: '5',
  /* ⚑ T121 2차 신규 상수 9종 (주인 확정 16:5X · 17:0X · 17:4X) */
  PERK_EVSTUN_CH: '0.30', PERK_CTCRIT_N: '20', PERK_CTCRIT_R: '40',
  PERK_CTDMG_N: '1.30', PERK_CTDMG_R: '1.60', PERK_BSTK_M: '2.00', DASH_MUL: '5',
  PERK_CLEAVE_N: '0.33', PERK_CLEAVE_R: '0.66', PERK_CLEAVE_L: '1.00',
  /* ⚑ T121 3차 신규 상수 20종 (주인 확정 17:5X · 18:0X · 18:1X · 18:2X · 18:4X) */
  PERK_SUMMON_N: '0.33', PERK_SUMMON_R: '0.66', PERK_SUMMON_L: '1.00', PERK_SUMMON_SP: '0.33',
  PERK_CRITSP_R: '0.33', PERK_CRITSP_L: '0.66', PERK_CRITBOLT_L: '0.66',
  PERK_EVHEAL_R: '0.15', PERK_EVREP_R: '0.15', PERK_EVREP_L: '0.25', PERK_EVREP_F: '0.06',
  PERK_DEF_R: '1.16', PERK_DEF_L: '1.24', PERK_IGN_N: '0.20',
  PERK_SHWALL_L: '0.50', PERK_SHREF_L: '0.50', PERK_NOSH_ATK: '1.50', PERK_NOSH_ASPD: '1.30',
  PERK_WARD_N: '0.10', PERK_WARD_R: '0.20', PERK_WARD_L: '0.30' };

function run(simSrc, htmSrc, planSrc) {
  R.length = 0;
  const strip = s => s.replace(/<\/?b>/g, '').replace(/\s+/g, ' ').trim();

  /* ===== ① 3자 대조 ===== */
  console.log('\n=== ① 3자 대조 — PLAN §3.1 ↔ sim.js ↔ index.html ===');
  const simRows = [...simSrc.matchAll(/\{id:'(p_[A-Za-z]+)',\s*g:(\d),\s*nm:'([^']*)',\s*d:'([^']*)'/g)]
    .map(m => ({ id: m[1], g: +m[2], nm: m[3], tx: strip(m[4]) }));
  const htmRows = [...htmSrc.matchAll(/\{id:'(p_[A-Za-z]+)',\s*g:(\d),\s*nm:'([^']*)',\s*ic:'([^']*)',\s*tx:'([^']*)'/g)]
    .map(m => ({ id: m[1], g: +m[2], nm: m[3], ic: m[4], tx: strip(m[5]) }));
  /* ⚑ T119 — PLAN §3.1 표는 «| # | sim id | 등급 | 특전 | 효과 | 구현 |» 6열이다 */
  const planRows = [...planSrc.matchAll(/^\| (\d+) \| (p_[A-Za-z]+) \| (일반|희귀|전설) \| ([^|]+?) \| ([^|]+?) \|/gm)]
    .map(m => ({ n: +m[1], id: m[2], g: GRADE_NAME.indexOf(m[3]), nm: m[4].trim(), tx: strip(m[5]) }));
  const want = WANT.map(w => w.id), wantG = WANT.map(w => w.g);
  const N = WANT.length;
  chk(`sim.js 특전이 ${N}종이고 주인 표와 순서까지 같다`, simRows.map(r => r.id).join() === want.join(),
    `${simRows.length}종`);
  chk('index.html 특전이 같은 수·같은 순서다', htmRows.map(r => r.id).join() === want.join(), `${htmRows.length}종`);
  chk(`PLAN §3.1 표가 ${N}행이고 번호·id 가 순서대로다`,
    planRows.length === N && planRows.every((r, i) => r.n === i + 1 && r.id === want[i]), `${planRows.length}행`);
  /* ⚑ T119 등급 — 세 곳(주인 표·sim.js·index.html·PLAN)이 같은 등급을 매기고, 등급별 개수가 15/8/9 인가 */
  chk('sim.js 의 등급이 주인 표와 같다', simRows.map(r => r.g).join() === wantG.join(),
    simRows.map(r => r.g).join('') || '-');
  chk('index.html 의 등급이 주인 표와 같다', htmRows.map(r => r.g).join() === wantG.join(),
    htmRows.map(r => r.g).join('') || '-');
  chk('PLAN §3.1 표의 등급이 주인 표와 같다', planRows.map(r => r.g).join() === wantG.join(),
    planRows.map(r => r.g).join('') || '-');
  const cnt = g => WANT.filter(w => w.g === g).length;
  chk('⚑ T121 등급별 개수 = 일반 39 · 희귀 32 · 전설 28 (합 99)',
    [0, 1, 2].every(g => cnt(g) === GRADE_N[g]) && N === 99, `${[0, 1, 2].map(cnt).join('/')} = ${N}`);
  const planTxBad = planRows.filter((r, i) => WANT[i] && !(r.nm === WANT[i].nm && r.tx.replace(/\*/g, '') === WANT[i].tx));
  chk('PLAN 표의 이름·효과 문장이 주인 확정 문면 그대로다', planRows.length === N && planTxBad.length === 0,
    planTxBad.map(r => r.id).join(',') || `${N}/${N}`);
  const simTxBad = simRows.filter((r, i) => WANT[i] && !(r.nm === WANT[i].nm && r.tx === WANT[i].tx));
  chk('sim.js 설명문(d)이 주인 문면과 글자까지 같다', simRows.length === N && simTxBad.length === 0,
    simTxBad.map(r => `${r.id}«${r.tx}»`).join(' · ') || `${N}/${N}`);
  /* index.html 의 표시 텍스트(tx)가 주인 문면과 글자까지 같은가 — <b> 태그를 걷어내고 본다 */
  const txBad = htmRows.filter((h, i) => WANT[i] && !(h.tx === WANT[i].tx && h.nm === WANT[i].nm));
  chk('index.html 표시 텍스트가 주인 문면과 글자까지 같다', htmRows.length === N && txBad.length === 0,
    txBad.map(h => `${h.id}«${h.tx}»`).join(' · ') || `${N}/${N}`);
  /* ⚑ T119 등급 굴림 확률 — 두 엔진 + PLAN 문면이 60/25/15 로 같은가 */
  const rateOf = src => (src.match(/PERK_GRADE_RATE\s*=\s*\[(\d+),\s*(\d+),\s*(\d+)\]/) || []).slice(1).map(Number);
  chk('⚑ T119 등급 굴림 확률 PERK_GRADE_RATE 가 두 엔진에서 60/25/15 로 같다',
    rateOf(simSrc).join() === GRADE_RATE.join() && rateOf(htmSrc).join() === GRADE_RATE.join(),
    `sim ${rateOf(simSrc).join('/')} · game ${rateOf(htmSrc).join('/')}`);
  chk('⚑ T119 PLAN §3.0 문면도 «일반 60% / 희귀 25% / 전설 15%» 다',
    /일반 60% \/ 희귀 25% \/ 전설 15%/.test(planSrc) && /PERK_GRADE_RATE = \[60,25,15\]/.test(planSrc));
  /* 엔진 상수 — 두 파일이 같은 이름·같은 값이고 확정표와 일치 */
  let cBad = [];
  for (const k in CONST) {
    /* ⚑ T121 — 값에 «2/3»(거인의 힘 공속) 같은 분수 리터럴이 생겼다. `[0-9.]+` 로만 읽으면 앞의 `2` 만
       집어 와서 «sim 2 / 기대 2/3» 으로 헛되이 빨개진다 — 분수도 한 값으로 읽는다. */
    const g = s => (s.match(new RegExp(k + '=([0-9.]+(?:/[0-9.]+)?)')) || [])[1];
    if (g(simSrc) !== CONST[k] || g(htmSrc) !== CONST[k]) cBad.push(`${k}(sim ${g(simSrc)} / game ${g(htmSrc)} / 기대 ${CONST[k]})`);
  }
  chk(`엔진 상수 ${Object.keys(CONST).length}종이 두 파일에서 같고 확정값이다`, cBad.length === 0, cBad.join(' · ') || Object.keys(CONST).length + '종');

  /* ===== ② 3택 1 — 제시·중복·상한·시뮬 정책 (실행 단언 · ⚑⚑⚑ T117) =====
     T96 의 «표 앞에서부터 순서대로» 단언은 3택 복구로 대상이 사라졌다. 그 자리에 주인 지시 ① 의 네 조항
     (제시 3장 · 중복 0 · 아직 안 얻은 것만 · 남은 것이 3 미만이면 그만큼)과 시뮬 측정 정책을 넣는다. */
  console.log('\n=== ② 3택 1 — 제시·중복·상한·시뮬 정책 (⚑ T117) ===');
  const S = loadSim(simSrc);
  const b = S.mkBuild(1, 0, 0);
  chk('제시 장수 상수 PERK_OFFER = 3', S.PERK_OFFER === 3, `PERK_OFFER=${S.PERK_OFFER}`);
  const htmOffer = (htmSrc.match(/const PERK_OFFER\s*=\s*(\d+)/) || [])[1];
  chk('두 엔진의 PERK_OFFER 가 같다', Number(htmOffer) === S.PERK_OFFER, `sim ${S.PERK_OFFER} / html ${htmOffer}`);
  /* ⓐ offerPerks 를 직접 두들긴다 — 남은 풀 크기별로 «몇 장 · 중복 · 이미 얻은 것 섞임» 을 전수로 본다. */
  {
    let cntBad = 0, dupBad = 0, takenBad = 0, poolBad = 0;
    for (let t = 0; t <= S.PERKS.length; t++) {
      const taken = S.PERKS.slice(0, t);
      for (let i = 0; i < 300; i++) {
        const off = S.offerPerks(taken);
        if (off.length !== Math.min(S.PERK_OFFER, S.PERKS.length - t)) cntBad++;
        if (new Set(off).size !== off.length) dupBad++;
        if (off.some(p => taken.indexOf(p) >= 0)) takenBad++;
        if (off.some(p => S.PERKS.indexOf(p) < 0)) poolBad++;
      }
    }
    chk('⚑ 제시 장수 = min(3, 남은 것) — 남은 것이 3 미만이면 남은 만큼만 (0이면 0장)', cntBad === 0, `위반 ${cntBad}건`);
    chk('⚑ 같은 카드 3장 안에 중복이 없다', dupBad === 0, `위반 ${dupBad}건`);
    chk('⚑ 이미 얻은 특전은 절대 제시되지 않는다', takenBad === 0, `위반 ${takenBad}건`);
    chk('⚑ 제시는 언제나 풀(PERKS) 안에서만 나온다', poolBad === 0, `위반 ${poolBad}건`);
    /* 무작위인가 — 「고정 3장」으로 퇴화하면 여기서 잡힌다(순서 지급으로 되돌아간 형태) */
    const seen = new Set();
    for (let i = 0; i < 400; i++) seen.add(S.offerPerks([]).map(p => p.id).sort().join());
    chk('⚑ 제시가 실제로 무작위다 (같은 3장으로 고정되지 않는다)', seen.size > 5, `서로 다른 조합 ${seen.size}종`);
  }
  /* ⓑ 시뮬 측정 정책 — ⚑⚑⚑ T119 로 «표 순서만» 에서 **«등급 높은 것 우선 · 같은 등급이면 표 순서»** 로 바뀌었다
     (주인 지시 13:0X ② — «실제 유저가 좋은 것을 고르는 것의 근사»). */
  {
    let polBad = 0, sawMixed = 0;
    for (let i = 0; i < 2000; i++) {
      const off = S.offerPerks(S.PERKS.filter(() => Math.random() < 0.3), false);
      if (!off.length) continue;
      if (new Set(off.map(p => p.g)).size > 1) sawMixed++;
      const want = off.slice().sort((x, y) => (y.g - x.g) || (S.PERKS.indexOf(x) - S.PERKS.indexOf(y)))[0];
      if (S.simPickPerk(off) !== want) polBad++;
    }
    chk('⚑ T119 시뮬 정책 = 등급 높은 것 우선 · 같은 등급이면 표 순서 우선', polBad === 0, `위반 ${polBad}건`);
    chk('⚑ 그 판정이 실제로 갈리는 표본이 있었다 (등급이 섞인 3장)', sawMixed > 200, `등급 섞인 제시 ${sawMixed}회`);
  }
  /* ⓑ-2 ⚑ T119 등급 굴림 분포 — 60/25/15 (풀이 넉넉할 때) · 귀족의 눈이면 62.5/37.5 */
  {
    const roll = (noble, iter) => {
      const c = [0, 0, 0];
      for (let i = 0; i < iter; i++) for (const p of S.offerPerks([], noble)) c[p.g]++;
      const t = c[0] + c[1] + c[2];
      return c.map(x => x / t * 100);
    };
    const d = roll(false, 20000), tol = 1.2;
    chk('⚑ T119 등급 굴림 실측이 60 / 25 / 15 다 (±1.2%p · 6만 장)',
      GRADE_RATE.every((r, g) => Math.abs(d[g] - r) <= tol), d.map(x => x.toFixed(2) + '%').join(' / '));
    const dn = roll(true, 20000);
    chk('⚑ T119 귀족의 눈 = 일반 0% · 희귀 62.5% · 전설 37.5% (재정규화 25:15)',
      dn[0] === 0 && Math.abs(dn[1] - 62.5) <= tol && Math.abs(dn[2] - 37.5) <= tol,
      dn.map(x => x.toFixed(2) + '%').join(' / '));
    /* 등급이 비면 남은 등급으로 재정규화 — 전설·희귀를 다 얻은 뒤에는 일반만 나온다(귀족의 눈이어도) */
    const noLeg = S.PERKS.filter(p => p.g !== 0);
    let onlyN = true;
    for (let i = 0; i < 400; i++) for (const p of S.offerPerks(noLeg, true)) if (p.g !== 0) onlyN = false;
    chk('⚑ T119 희귀·전설이 다 떨어지면 일반으로 되돌아간다 (귀족의 눈이어도 · 재정규화)', onlyN);
    const noCommon = S.PERKS.filter(p => p.g === 0);
    let noneCommon = true;
    for (let i = 0; i < 400; i++) for (const p of S.offerPerks(noCommon, false)) if (p.g === 0) noneCommon = false;
    chk('⚑ T119 일반이 다 떨어지면 희귀·전설로 재정규화된다', noneCommon);
  }
  /* ⓒ 챕터를 실제로 굴려서 — 중복 0 · 상한 · «순서 지급이 아니다» */
  let dupRun = 0, over = 0, maxN = 0, runs = 0, fixedOrder = 0, variety = new Set();
  for (let i = 0; i < 200; i++) {
    const r = S.runChapter(20, b);
    runs++;
    maxN = Math.max(maxN, r.taken.length);
    if (r.taken.length > S.PERK_PICKS) over++;
    if (new Set(r.taken).size !== r.taken.length) dupRun++;
    if (r.taken.every((id, k) => id === S.PERKS[k].id)) fixedOrder++;
    variety.add(r.taken.join());
  }
  chk('한 판에서 같은 특전을 두 번 얻지 않는다', dupRun === 0, `위반 ${dupRun}판`);
  chk('한 판 획득이 한 런 상한(PERK_PICKS)을 넘지 않는다', over === 0, `한 판 최대 획득 ${maxN}개 (상한 ${S.PERK_PICKS})`);
  chk('⚑ T117 획득 목록이 «표 앞에서부터 고정» 이 아니다 (순서 지급 회귀 방지)',
    fixedOrder < runs, `${runs}판 중 표 순서와 완전히 같은 판 ${fixedOrder}판 · 서로 다른 획득열 ${variety.size}종`);
  /* ⚑ 상한은 «한 챕터의 경험치 예산» 으로는 도달하지 않는다(실측 최대 8~9종) — 지급 동사를 직접
     15번 불러 «상한에서 멈추는가» 를 잰다. 챕터 실행으로만 재면 이 검사가 조용히 죽는다(음성 검사로 확인). */
  {
    const Gx = { taken: [], player: null, perkChances: 0 };
    const px = S.mkPlayer(S.mkBuild(1, 0, 0), Gx); Gx.player = px; px.G = Gx;
    let nulls = 0;
    for (let i = 0; i < 15; i++) if (!S.grantNextPerk(Gx)) nulls++;
    chk('⚑ 지급 동사를 15번 불러도 상한(PERK_PICKS)에서 멈춘다', Gx.taken.length === S.PERK_PICKS && nulls === 15 - S.PERK_PICKS,
      `획득 ${Gx.taken.length}종 · 빈 지급 ${nulls}회 · 기회 ${Gx.perkChances}회`);
    chk('⚑ 그 획득분에 중복이 없다',
      new Set(Gx.taken).size === Gx.taken.length, Gx.taken.map(x => x.id).join('>'));
    /* ⚑ 풀 크기 = 상한(10) 인 동안은 «상한을 지웠는가» 를 실측으로 구별할 수 없다(풀이 마르면 어차피 멈춘다).
       그래서 상한 가드가 두 엔진에 **문장으로** 살아 있는지 함께 본다 — 풀을 늘리는 순간 실측 차이가 생기는 자리다. */
    chk('⚑ 한 런 획득 상한 가드가 두 엔진에 살아 있다 (PERK_PICKS)',
      /G\.taken\.length>=PERK_PICKS\)return null;/.test(simSrc) && /perkOrderN\(\)<PERK_PICKS/.test(htmSrc));
  }
  /* ===== ②-b PERK_PICKS 분리 (⚑ 주인 방향 2026-09-03 · T102) =====
     «풀 크기(PERKS.length)» 와 «한 런 획득 수(PERK_PICKS)» 를 분리해 뒀는지 본다.
     지금은 둘 다 10 이라 동작이 불변이어야 하고(그 «동일성» 자체를 단언), 두 엔진이 같은 값을 써야 한다.
     ⚑ T107 로 «PERK_PICKS = 챕터 레벨업 횟수» 전제는 폐기됐다 — 한 판에 실제로 얻는 수는 그 챕터의
     경험치가 정한다(1~5 = 6 · 15 = 7 · 28 = 8 · 38+ = 9 · 게이트 `verifyChapterFixed` ⓓ 가 실측).
     여기서 PERK_PICKS 가 지키는 것은 «풀 크기 = 한 런 상한 = 10» 이라는 주인 확정 구성뿐이다. */
  console.log('\n=== ②-b PERK_PICKS 분리 — 풀 크기 ↔ 한 런 획득 수 (⚑ T102) ===');
  const htmPicks = (htmSrc.match(/const PERK_PICKS\s*=\s*(\d+)/) || [])[1];
  chk('sim.js 에 PERK_PICKS 상수가 있다', typeof S.PERK_PICKS === 'number', `PERK_PICKS=${S.PERK_PICKS}`);
  chk('index.html 에 PERK_PICKS 상수가 있다', htmPicks !== undefined, `PERK_PICKS=${htmPicks}`);
  chk('두 엔진의 PERK_PICKS 가 같다', htmPicks !== undefined && Number(htmPicks) === S.PERK_PICKS,
    `sim ${S.PERK_PICKS} / html ${htmPicks}`);
  chk('풀 크기 ≥ 한 런 획득 수 (풀이 모자라면 순번 지급이 깨진다)', S.PERKS.length >= S.PERK_PICKS,
    `풀 ${S.PERKS.length} ≥ 획득 ${S.PERK_PICKS}`);
  /* ⚑⚑⚑ T119 — «풀 = 획득 수 = 10» 이던 T102 의 등식이 드디어 갈라졌다(풀 32 · 한 런 상한 10).
     이제 이 자리가 지키는 것은 «풀이 상한보다 넉넉한가» 다 — 풀을 도로 줄이면 빨개진다. */
  chk('⚑ T121 풀 99종 · 한 런 상한 10 (T102 가 예고한 분리가 더 벌어졌다)',
    S.PERKS.length === 99 && S.PERK_PICKS === 10, `풀 ${S.PERKS.length} · 획득 ${S.PERK_PICKS}`);
  chk('⚑ T117 풀 ≥ 제시 장수 (풀이 3보다 작으면 남은 만큼만 제시된다 — ⓐ 가 실측)',
    S.PERKS.length >= S.PERK_OFFER, `풀 ${S.PERKS.length} ≥ 제시 ${S.PERK_OFFER}`);
  /* ⚑ T107 — 종전엔 «보스 전 공급으로 오르는 레벨 + 악마 앞당김 1 = PERK_PICKS» 를 못 박았지만,
     적 수가 챕터마다 달라져 그 항등식이 사라졌다. 남은 단언은 주인 확정 «풀 10종 · 한 런 상한 10» 이다
     (챕터별 실제 획득 수는 `verifyChapterFixed` ⓓ 가 표와 대조한다 — 여기서 두 번 재지 않는다). */
  chk('⚑ PERK_PICKS 가 주인 확정 «한 런 상한 10» 과 같다', S.PERK_PICKS === 10,
    `PERK_PICKS=${S.PERK_PICKS} · 풀 99종 · 챕터별 실제 획득 6~9 (T107)`);
  /* 수치 — 획득 순서대로 하나씩 붙이며 실효 스탯 변화를 잰다.
     ⚑ T104 — 순서가 바뀌었고, 1번 특전은 스탯을 안 건드리는 트리거형(회피 시 회복)이라 스탯 델타 0 이다. */
  const G0 = { taken: [], player: null, perkChances: 0 };
  const p = S.mkPlayer(S.mkBuild(-1, 0, 0), G0); G0.player = p; p.G = G0;
  const before = { dmg: p.dmg, evade: p.evade, counter: p.counter, critR: p.critR, critF: p.critF, def: p.def, steal: p.steal };
  const deltas = [];
  for (const perk of S.PERKS) {
    const a = { dmg: p.dmg, evade: p.evade, counter: p.counter, critR: p.critR, critF: p.critF, def: p.def, steal: p.steal };
    perk.ap(p);
    deltas.push({ id: perk.id, pre: a, d: Object.fromEntries(Object.entries(a).map(([k, v]) => [k, +(p[k] - v).toFixed(6)])) });
  }
  const dOf = id => deltas.find(x => x.id === id).d;
  chk('① 회피 시 회복은 스탯을 안 건드린다 (트리거형 · px.p_evadeHeal 만 세운다)',
    Object.values(dOf('p_evadeHeal')).every(v => v === 0));
  chk('② 반격률 +8 (⚑ T121 하향 — 종전 +10)', dOf('p_counter').counter === 8);
  chk('④⑤⑦ 소환 3종은 스탯을 안 건드린다 (트리거형)',
    ['p_spearCt', 'p_arrowEv', 'p_axeHit'].every(id => Object.values(dOf(id)).every(v => v === 0)));
  /* ⚑ T119 — 신규 22종 중 «스탯을 직접 올리는» 것은 광전사(공격력 ×3) 하나뿐이고 나머지는 전부 트리거형·px 형이다 */
  /* ⚑ 델타는 «앞 특전까지 다 붙인 뒤» 의 값에서 재므로 기준은 그 시점의 dmg 다(2번 공격력 +20% 가 이미 걸려 있다) */
  {
    const bz = deltas.find(x => x.id === 'p_berserk');
    chk('⚑ T119 광전사가 공격력을 ×3 으로 만든다 (그 시점 값에 곱연산 = 장비·특전 합산 뒤)',
      Math.abs(bz.d.dmg - bz.pre.dmg * 2) < 1e-6 * bz.pre.dmg + 1e-6,
      `${bz.pre.dmg.toFixed(3)} → ${(bz.pre.dmg + bz.d.dmg).toFixed(3)} (×3)`);
  }
  /* ⚑⚑⚑ T121 — «스탯을 직접 올리는» 신규는 광전사 말고도 6종이 더 생겼다: 희귀 «II» 5종과 거인의 힘.
     나머지 신규는 전부 트리거형·px 형이라 획득 순간의 스탯 델타가 0 이어야 한다 — 그 경계를 여기서 지킨다.
     (수집가 3종은 «획득 순간» 이 아니라 실효 스탯에서 매번 세므로 여기서도 델타 0 이다 — ③-c 가 따로 잰다.) */
  const STAT_PERKS = ['p_berserk', 'p_critFR', 'p_critRR', 'p_counterR', 'p_atkR', 'p_evadeR', 'p_giant', 'p_defR', 'p_defL'];
  {
    const bad = WANT.slice(10).filter(w => STAT_PERKS.indexOf(w.id) < 0 && !Object.values(dOf(w.id)).every(v => v === 0));
    chk('⚑ T121 스탯 직접 상승 9종 말고는 획득 순간 스탯을 안 건드린다 (트리거·px·증폭·수집가형)',
      bad.length === 0, bad.map(w => w.id).join(',') || `${WANT.length - 10 - STAT_PERKS.length}종 델타 0`);
    chk('⚑ T121 희귀 «II» 4종 — 치확 +16 · 반격 +16 · 회피 +16 · 공격력 +30%',
      dOf('p_critRR').critR === 16 && dOf('p_counterR').counter === 16 && dOf('p_evadeR').evade === 16 &&
      Math.abs(dOf('p_atkR').dmg - deltas.find(x => x.id === 'p_atkR').pre.dmg * 0.30) < 1e-6 * deltas.find(x => x.id === 'p_atkR').pre.dmg + 1e-6,
      `+${dOf('p_critRR').critR}/+${dOf('p_counterR').counter}/+${dOf('p_evadeR').evade}/+${dOf('p_atkR').dmg.toFixed(3)}`);
    chk('⚑ T121 희귀 치명타 피해 증가 II = +60 (가산 · 기본 150 → 210)', dOf('p_critFR').critF === 60,
      `+${dOf('p_critFR').critF}`);
    const gi = deltas.find(x => x.id === 'p_giant');
    chk('⚑ T121 거인의 힘 — 공격력 ×3 (그 시점 값에 곱연산)',
      Math.abs(gi.d.dmg - gi.pre.dmg * 2) < 1e-6 * gi.pre.dmg + 1e-6,
      `${gi.pre.dmg.toFixed(3)} → ${(gi.pre.dmg + gi.d.dmg).toFixed(3)} (×3)`);
  }
  chk('⑥ 공격력 +15% 가 기본치에 곱연산이다 (⚑ T121 하향 — 종전 +20%)', Math.abs(dOf('p_atk').dmg - before.dmg * 0.15) < 1e-6, `+${dOf('p_atk').dmg.toFixed(3)} (기본 ${before.dmg})`);
  chk('⑦ 회피율 +8 (⚑ T121 하향 — 종전 +10)', dOf('p_evade').evade === 8);
  chk('⑧ 치명타 확률 +8 (⚑ T121 하향 — 종전 +10)', dOf('p_critR').critR === 8);
  chk('⑨ 치명타 피해 +30 (⚑ T121 하향 — 종전 +50)', dOf('p_critF').critF === 30);
  chk('⑩ 방어력 +8% 가 기본치에 곱연산이다 (⚑ 18:2X 하향 — 종전 +10%)', Math.abs(dOf('p_def').def - before.def * 0.08) < 1e-6, `+${dOf('p_def').def.toFixed(3)} (기본 ${before.def})`);
  /* ⚑ T104 — 특전에서 흡혈 축이 사라졌다: 어느 특전도 `p.steal` 을 안 건드린다 (엔진의 steal 스탯은 남는다). */
  chk('⚑ T104 — 특전이 p.steal 을 건드리지 않는다 (특전에서 흡혈 축 폐기)',
    S.PERKS.every(pk => dOf(pk.id).steal === 0));
  /* 회피 시 회복은 «실드를 안 채운다» — heal 의 noBoost 경로(true)를 실제로 타는지 본다.
     `if(px.p_evadeHeal&&pkk(p,...))heal(p,p.maxHp*...,true);` 형태를 두 엔진에서 찾아 확인한다. */
  const evHealRe = /if\(px\.p_evadeHeal\s*&&\s*pkk\(p\s*,\s*(?:PERK_EVHEAL_CH|0?\.08)\s*\)\)\s*(?:\{[^}]*)?heal\(p\s*,\s*p\.maxHp\s*\*\s*(?:PERK_EVHEAL_F|0?\.06)\s*,\s*true\s*\)/;
  chk('⚑ T104 ① 회피 시 회복이 회피 분기에서 noBoost=true 로 회복한다 (sim.js)', evHealRe.test(simSrc));
  chk('⚑ T104 ① 회피 시 회복이 회피 분기에서 noBoost=true 로 회복한다 (index.html)', evHealRe.test(htmSrc));

  /* ===== ③ 폐지분 + 소환 연쇄 ===== */
  console.log('\n=== ③ 폐지분 (등급·선택창·새로고침) · 소환 연쇄 B ===');
  const both = [['sim.js', simSrc], ['index.html', htmSrc]];
  const deadTokens = ['RARITY_P', 'rollRarity', 'rollPerks', 'perkPool', 'rarityLock', 'refreshLeft', 'refreshBonus'];
  for (const [nm, src] of both) {
    const hit = deadTokens.filter(t => new RegExp('\\b' + t + '\\b').test(src));
    chk(`${nm} 에 등급·선택창·새로고침 코드가 남아 있지 않다`, hit.length === 0, hit.join(',') || '0건');
  }
  /* 주석에 «폐지됐다» 고 적는 것은 괜찮다 — 실제 버튼·핸들러·CSS 가 사라졌는지만 본다 */
  chk('index.html 에 새로고침 버튼·핸들러·CSS 가 없다',
    !/id="refBtn"/.test(htmSrc) && !/#refBtn\{/.test(htmSrc) && !/getElementById\('refBtn'\)/.test(htmSrc));
  chk('⚑ T117·T119 제시·확정 동사가 두 엔진에 한 벌씩 있다 (offerPerks(taken,noble) · pickPerk)',
    /function offerPerks\(taken,noble\)\{/.test(simSrc) && /function offerPerks\(taken,noble\)\{/.test(htmSrc) &&
    /function pickPerk\(G,perk\)\{/.test(simSrc) && /function pickPerk\(perk\)\{/.test(htmSrc));
  /* ⚑ T117 악마 = «즉시 3택 1». 두 엔진 모두 비용을 낸 «뒤» 특전이 붙고, 전설 풀 뽑기는 없다.
     시뮬은 유저가 없으므로 정책 동사(grantNextPerk)로 대신 고르고, 게임은 같은 3장을 카드로 띄운다. */
  const devilSim = simSrc.slice(simSrc.indexOf("n.type==='devil'"), simSrc.indexOf('SIM_ANGEL_POLICY'));
  const devilHtm = htmSrc.slice(htmSrc.indexOf('function openDevil'), htmSrc.indexOf('function openAngel'));
  chk('악마도 같은 획득 경로를 쓴다 (전설 확정 폐기 · ⚑ T117 3택)',
    /payDevilCost\([^)]*\)[\s\S]{0,200}grantNextPerk\(/.test(devilSim) &&
    /payDevilCost\([^)]*\)[\s\S]{0,900}pickPerk\(/.test(devilHtm) &&
    /offerPerks\(/.test(devilHtm) &&
    !/perkPool|pick\(pool\)/.test(devilSim + devilHtm));
  /* ⚑ 소환 연쇄 기대값 B — 새 10종의 소환 3종은 트리거가 «피격/회피/반격» 이라
     소환 «적중» 이 새 소환을 낳지 않는다. 즉 «공격 시»·«치명타 시» 축에 특전 소환이 0건이어야 한다. */
  const atkAxis = simSrc.slice(simSrc.indexOf('function procOnAttack'), simSrc.indexOf('function doCounter'));
  const critAxis = simSrc.slice(simSrc.indexOf('if(crit){'), simSrc.indexOf('if(px.execKill'));
  /* ⚑⚑⚑ T121 — 이 축에 특전이 «생겼다»(공격 시 공속 버프 · 치명타 시 스턴 3종). 셋 다 소환이 아니라서
     B 는 그대로 0 이지만, 종전 단언은 «특전 키가 한 개도 없을 것» 이라 소환이든 아니든 빨개졌다.
     이제 재는 것은 «그 줄이 소환을 부르는가» 다 — 특전 키가 있는 줄에 `fire*` 가 붙으면 B > 0 이 된다.
     (그 축에 소환을 붙일 땐 이 게이트를 고치지 말고 `verifySummonChain` 으로 B 를 다시 재야 한다.) */
  /* ⚑⚑⚑ T121 3차 (주인 확정 17:5X · 18:4X) — «치명타 시» 축에 **소환이 처음 붙었다**: 치명 시 창(희귀 33 ·
     전설 66)·치명 시 번개(전설 66). 소환 적중도 «공격» 이라(T45) 소환 → 치명타 → 새 소환 연쇄가 생긴다.
     여기서는 «그 축에 있는 특전 소환이 주인 확정 3종뿐인가» 만 못 박고, 연쇄 기대값 B 는
     `verifySummonChain` ⑥ 이 잰다(주인 지시: 넘으면 값을 깎지 말고 승인 대기에 등재). */
  const sumOf = src => src.split('\n').filter(l => /px\.p_[A-Za-z]+/.test(l) && /\bfire[A-Z]/.test(l))
    .map(l => (l.match(/px\.(p_[A-Za-z]+)/) || [])[1]);
  const atkNonSummon = atkAxis.split('\n').filter(l => /px\.p_[A-Za-z]+/.test(l) && !/\bfire[A-Z]/.test(l))
    .map(l => (l.match(/px\.(p_[A-Za-z]+)/) || [])[1]);
  chk('⚑ «공격 시»(procOnAttack) 축에는 여전히 특전 **소환**이 없다 (그 축의 B = 0)',
    sumOf(atkAxis).length === 0,
    sumOf(atkAxis).join(',') || `공격 축 B = 0 (소환 아닌 특전 ${atkNonSummon.length}종: ${atkNonSummon.join(',') || '없음'})`);
  const CRIT_SUMMON = ['p_critSpearR', 'p_critSpearL', 'p_critBoltL'];
  const critHtm = htmSrc.slice(htmSrc.indexOf('if(crit){'), htmSrc.indexOf('if(px.execKill'));
  chk('⚑ T121 3차 «치명타 시» 축의 특전 소환이 주인 확정 3종뿐이다 (창 33/66 · 번개 66 · B 는 verifySummonChain ⑥)',
    sumOf(critAxis).join() === CRIT_SUMMON.join() && sumOf(critHtm).join() === CRIT_SUMMON.join(),
    `sim [${sumOf(critAxis).join(',')}] · game [${sumOf(critHtm).join(',')}]`);
  /* ===== ⚑⚑⚑ T121 ⑥ 용어 통일 — «기절» 이 아니라 «스턴» (주인 지시 2026-09-04 16:4X) =====
     주인 원문 취지: «스턴으로 해야 이해하기 쉬울 것 같다». 유저에게 보이는 글자 전부가 대상이다 —
     특전 이름·설명, 카드·인포 팝업, 전투 중 팝 문구, 장비 옵션 문구, PLAN §3.0/§3.1 문면.
     엔진 이름(`applyStun`·`e.stun`·`STUN_BOSS_MUL`)은 이미 stun 이라 그대로 둔다.
     ⚑ 주인이 «한 파일에 두 표기가 섞이지 않게 정적 단언 1개» 를 직접 지시했다 — 이 자리가 그것이다.
     따옴표 안의 문자열과 PLAN 본문만 보므로, 게이트 소스의 주석에 남은 «기절» 은 대상이 아니다. */
  console.log('\n=== ③-d ⚑ T121 ⑥ 용어 «스턴» 통일 (유저 노출 문자열에 «기절» 0건) ===');
  {
    const userStrings = src => {
      const out = [];
      for (const m of src.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)) out.push(m[1] || m[2] || '');
      return out;
    };
    for (const [nm, src] of both) {
      const hits = userStrings(src).filter(t => t.includes('기절'));
      chk(`${nm} 의 유저 노출 문자열에 «기절» 이 0건이다`, hits.length === 0,
        hits.slice(0, 3).map(t => `«${t.slice(0, 40)}»`).join(' · ') || '0건');
    }
    const planHits = planSrc.split('\n').filter(l => l.includes('기절'));
    chk('PLAN 문면에도 «기절» 이 0건이다', planHits.length === 0,
      planHits.slice(0, 2).map(l => l.trim().slice(0, 50)).join(' · ') || '0건');
    /* 반대 방향 — «스턴» 이 실제로 쓰이고 있는가(전부 지워 버린 것이 아니라 갈아탄 것인가) */
    chk('두 엔진과 PLAN 이 «스턴» 을 실제로 쓴다 (지운 게 아니라 갈아탄 것)',
      both.every(([, src]) => userStrings(src).some(t => t.includes('스턴'))) && /스턴/.test(planSrc));
  }

  /* ⚑⚑⚑ T119 — 새로 생긴 «처치 시» 축은 `onKill` 에 있고, 그 축의 연쇄 기대값은
     `tools/verifySummonChain.js` ⑤ 가 따로 잰다(여기서 두 번 재지 않는다). 여기서는 «네 소환이 그 자리에 있는가» 만 본다. */
  console.log('\n=== ③-b ⚑ T119 신규 22종의 엔진 키·수치 대조 ===');
  const killAxis = s => s.slice(s.indexOf('function onKill'), s.indexOf('function onKill') + 2600);
  for (const [nm, src] of both) {
    const k = killAxis(src);
    const hit = ['p_killSpear&&pkk(p,px.p_killSpear)', 'p_killBolt&&pkk(p,px.p_killBolt)',
      'p_killArrow&&pkk(p,px.p_killArrow)', 'p_killAxe&&pkk(p,px.p_killAxe)']
      .filter(t => k.replace(/\s+/g, '').includes(t.replace(/\s+/g, '')));
    chk(`${nm} onKill 에 처치 시 소환 4종이 있다 (창·번개·화살·도끼)`, hit.length === 4, `${hit.length}/4`);
    chk(`${nm} 처치 시 소환의 발수가 확정표대로다 (창 1 · 번개 전원 · 화살 3 · 도끼 2)`,
      /fireSpear\(p,1\)/.test(k) && /fireBoltsAll\(p,e\.wave\)/.test(k) && /fireArrows\(p,3\)/.test(k) && /fireAxe\(p,2\)/.test(k));
    /* ⚑ 처치 시 번개의 대상은 «죽은 적이 속한 웨이브» 다 — 여기서 frontNode 를 다시 부르면 한 웨이브를
       전멸시킨 순간 연쇄가 대기 웨이브를 지나 보스까지 즉사시킨다(T119 실측 · T44 «관통형은 발사 시점의
       노드만» 과 같은 축). 그래서 «인자로 받는가» 를 단언한다 — frontNode 폴백만 남으면 빨개진다. */
    chk(`${nm} 처치 시 번개가 «죽은 적의 웨이브» 를 인자로 받는다 (대기 웨이브·보스 즉사 차단)`,
      /function fireBoltsAll\(p,\s*node\)/.test(src) && /fireBoltsAll\(p,e\.wave\)/.test(k));
    chk(`${nm} 오버킬 회복이 초과분을 그대로 회복한다 («힐» 이라 noBoost 아님)`,
      /p_overkill&&over>0\)\s*heal\(p,\s*over\)/.test(k.replace(/\s+/g, ' ').replace(/\( /g, '(')) || /p_overkill\s*&&\s*over\s*>\s*0\)\s*heal\(p,\s*over\)/.test(k));
    chk(`${nm} 가시갑옷이 «근접 피격 · 받은 피해 × 배율» 로 반사한다`,
      /px\.p_thorns&&isMelee&&src\)\s*reflect\((?:G,)?src,\s*thornBase\*px\.p_thorns/.test(src.replace(/\s+/g, '')
        .replace('px.p_thorns&&isMelee&&src)reflect(', 'px.p_thorns&&isMelee&&src) reflect(').replace(/\s+/g, '')) ||
      /p_thorns&&isMelee&&src\)\s*reflect\([^)]*thornBase\s*\*\s*px\.p_thorns/.test(src));
    /* ⚑ T121 — effCritR 이 한 줄 화살표에서 블록으로 바뀌었다(수집가·치명 + 치명 스택이 합쳐진다).
       그래도 «광전사면 즉시 0» 이 맨 앞이어야 «치명타 시» 트리거까지 함께 죽는다 — 두 모양 다 받는다. */
    chk(`${nm} 광전사가 effCritR 을 0 으로 고정한다`,
      /p_berserk\s*\?\s*0\s*:/.test(src) || /if\s*\(\s*px\.p_berserk\s*\)\s*return 0\s*;/.test(src));
    chk(`${nm} 창의 화신이 fireArrows 안에서 fireSpear 로 갈아탄다`,
      /p_spearAvatar\)\s*\{?\s*fireSpear\(p,n\);\s*return;/.test(src.replace(/\s+/g, ' ')));
    chk(`${nm} 풀피 적 강타가 dealDmg 의 가산 보너스 풀에 +100% 를 더한다`,
      /full&&px\.p_fullHp\)\s*addBonus\+=PERK_FULLHP_A/.test(src.replace(/\s+/g, '')));
    chk(`${nm} «보이는 적 전부» 가 현재 웨이브(frontNode)의 생존 적이다`,
      /function fireBoltsAll/.test(src) && /frontNode\(/.test(killAxisAll(src)));
  }

  const bad = R.filter(x => !x.c).length;
  console.log(`\n[T96·T117 특전 3택 게이트] 통과 ${R.length - bad} · 불합격 ${bad}`);
  return bad;
}

/* sim.js 를 모드 실행 없이 로드한다 (맨 아래 러너를 잘라 내고 필요한 것만 내보낸다) */
/* fireBoltsAll 본문만 잘라 온다 — «보이는 적» 의 정의(frontNode)가 그 안에 있는지 보기 위함 */
function killAxisAll(src) { const i = src.indexOf('function fireBoltsAll'); return i < 0 ? '' : src.slice(i, i + 400); }
function loadSim(src) {
  const body = src.replace(/const mode=process\.argv[\s\S]*$/, 'module.exports={runChapter,PERKS,PERK_PICKS,PERK_OFFER,PERK_GRADE_RATE,offerPerks,simPickPerk,pickPerk,mkBuild,mkPlayer,grantNextPerk,TUNE};');
  const m = { exports: {} };
  vm.runInNewContext(body, { module: m, exports: m.exports, process, console: { log() {} }, require });
  return m.exports;
}

const simSrc = fs.readFileSync(path.join(ROOT, 'sim.js'), 'utf8');
const htmSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const planSrc = fs.readFileSync(path.join(ROOT, 'PLAN.md'), 'utf8');

if (process.argv.includes('--self')) {
  /* 음성 검사 — 일부러 깨뜨린 사본마다 «빨개지는지» 만 본다. 통과하면 그 항목이 죽은 검사라는 뜻이다. */
  const cases = [
    ['sim 표 순서(id)를 흐트러뜨리면', s => s.replace("{id:'p_evade'", "{id:'zz_evade'"), null, null],
    ['sim 공격력 배수를 1.30 으로', s => s.replace('PERK_ATK_M=1.20', 'PERK_ATK_M=1.30'), null, null],
    /* ⚑ T108 신설 — 소환 3종이 다시 «50% 확률» 로 돌아가는 세 갈래 (상수 · 두 엔진 불일치 · 문면 잔재) */
    ['⚑ T108 소환 확률을 50% 로 되돌리면', s => s.replace('PERK_SUMMON_CH=1.00', 'PERK_SUMMON_CH=0.50'), null, null],
    ['⚑ T108 게임만 소환 확률이 다르면', null, s => s.replace('PERK_SUMMON_CH=1.00', 'PERK_SUMMON_CH=0.50'), null],
    ['⚑ T108 표시 문면에 «50% 확률로» 가 되살아나면', null, s => s.replace('tx:\'반격 시 창 <b>1개</b>\'', 'tx:\'반격 시 <b>50%</b> 확률로 창 <b>1개</b>\''), null],
    /* ⚑ T109 신설 — 순서를 T104 것으로 되돌리는 경우(2·3 ↔ 6·7 교체 취소) */
    ['⚑ T109 순서를 T104 것으로 되돌리면 (2·3 ↔ 6·7)',
      s => s.replace("{id:'p_atk',     g:0,nm:'공격력 증가'", "{id:'p_ATKTMP',  g:0,nm:'공격력 증가'")
             .replace("{id:'p_counter', g:0,nm:'반격률 증가'", "{id:'p_atk',     g:0,nm:'반격률 증가'")
             .replace("{id:'p_ATKTMP',  g:0,nm:'공격력 증가'", "{id:'p_counter', g:0,nm:'공격력 증가'"), null, null],
    ['game 치명타 피해를 +40 으로', null, s => s.replace('PERK_CRITF_A=50', 'PERK_CRITF_A=40'), null],
    ['game 표시 텍스트를 바꾸면', null, s => s.replace('회피율 <b>+10</b>', '회피율 <b>+20</b>'), null],
    ['PLAN 표의 효과를 바꾸면', null, null, s => s.replace('| 공격력 **+20%** |', '| 공격력 **+30%** |')],
    ['등급 굴림을 되살리면', s => s + '\nfunction rollRarity(){return 0;}\n', null, null],
    ['새로고침을 되살리면', null, s => s.replace('function pickPerk(perk){', 'function pickPerk(perk){ G.refreshLeft=1;'), null],
    /* ⚑ T117 신설 — 3택의 네 조항과 시뮬 정책이 각각 죽지 않았는지 */
    ['⚑ T117 제시가 «이미 얻은 것» 을 섞으면',
      s => s.replace('const cand=PERKS.filter(p=>taken.indexOf(p)<0&&out.indexOf(p)<0);', 'const cand=PERKS.filter(p=>out.indexOf(p)<0);'), null, null],
    ['⚑ T117 같은 3장 안에서 중복을 허용하면',
      s => s.replace('const cand=PERKS.filter(p=>taken.indexOf(p)<0&&out.indexOf(p)<0);', 'const cand=PERKS.filter(p=>taken.indexOf(p)<0);'), null, null],
    /* ⚑ T119 신설 — 등급 체제가 죽지 않았는지 */
    ['⚑ T119 등급 확률을 50/30/20 으로 되돌리면', s => s.replace('PERK_GRADE_RATE=[60,25,15]', 'PERK_GRADE_RATE=[50,30,20]'), null, null],
    ['⚑ T119 게임만 등급 확률이 다르면', null, s => s.replace('PERK_GRADE_RATE=[60,25,15]', 'PERK_GRADE_RATE=[50,30,20]'), null],
    ['⚑ T119 귀족의 눈이 일반을 안 빼면', s => s.replace('if(noble&&(w[1]||w[2])) w[0]=0;', ''), null, null],
    ['⚑ T119 등급 재정규화를 없애면 (빈 등급도 굴린다)',
      s => s.replace('const w=PERK_GRADE_RATE.map((r,g)=>(cand.some(p=>p.g===g)?r:0));', 'const w=PERK_GRADE_RATE.slice();'), null, null],
    ['⚑ T119 한 특전의 등급을 올리면 (일반 → 전설)', s => s.replace("{id:'p_thornsN',   g:0,", "{id:'p_thornsN',   g:2,"), null, null],
    ['⚑ T119 PLAN 표의 등급을 바꾸면', null, null, s => s.replace('| 15 | p_thornsN | 일반 |', '| 15 | p_thornsN | 희귀 |')],
    ['⚑ T119 처치 시 소환을 onKill 에서 빼면', s => s.replace('if(px.p_killAxe&&pkk(p,px.p_killAxe))fireAxe(p,2);', ''), null, null],
    ['⚑ T119 게임만 처치 시 화살 발수가 다르면', null, s => s.replace('if(px.p_killArrow&&pkk(p,px.p_killArrow)) fireArrows(p,3);', 'if(px.p_killArrow&&pkk(p,px.p_killArrow)) fireArrows(p,2);'), null],
    ['⚑ T119 오버킬 회복이 회복 증폭을 안 타게 하면 (noBoost=true)', s => s.replace('if(px.p_overkill&&over>0)heal(p,over);', 'if(px.p_overkill&&over>0)heal(p,over,true);'), null, null],
    ['⚑ T119 가시갑옷이 원거리에도 걸리면', s => s.replace('if(px.p_thorns&&isMelee&&src)reflect', 'if(px.p_thorns&&src)reflect'), null, null],
    ['⚑ T119 광전사가 치확을 0 으로 안 만들면', s => s.replace("const effCritR=p=>p.px.p_berserk?0:p.critR+bsum(p,'critR');", "const effCritR=p=>p.critR+bsum(p,'critR');"), null, null],
    ['⚑ T119 창의 화신이 화살을 그대로 쏘면', s => s.replace('if(px.p_spearAvatar){fireSpear(p,n);return;}', ''), null, null],
    ['⚑ T119 풀피 적 강타 계수를 +50% 로 내리면', s => s.replace('PERK_FULLHP_A=1.00', 'PERK_FULLHP_A=0.50'), null, null],
    ['⚑ T119 처치 시 소환 확률을 33 → 40% 로 올리면', s => s.replace('PERK_KILL_N=0.33', 'PERK_KILL_N=0.40'), null, null],
    ['⚑ T119 가시갑옷 배율을 +100 → +150% 로 올리면', s => s.replace('PERK_THORN_N=1.00', 'PERK_THORN_N=1.50'), null, null],
    ['⚑ T119 풀을 31종으로 줄이면', s => s.replace("    {id:'p_thornsL',   g:2,nm:'가시갑옷',         d:'가시갑옷 +300%',                  ap:p=>{p.px.p_thornsL=1;p.px.p_thorns+=PERK_THORN_L;}},\n", ''), null, null],
    ['⚑ T117 제시 장수를 1장으로 줄이면', s => s.replace('const PERK_OFFER=3;', 'const PERK_OFFER=1;'), null, null],
    ['⚑ T117 게임만 제시 장수가 다르면', null, s => s.replace('const PERK_OFFER=3;', 'const PERK_OFFER=2;'), null],
    ['⚑ T119 시뮬 정책이 «표 순서 뒤쪽» 을 고르면',
      s => s.replace('if(p.g>b.g||(p.g===b.g&&PERKS.indexOf(p)<PERKS.indexOf(b))) b=p;',
                     'if(p.g>b.g||(p.g===b.g&&PERKS.indexOf(p)>PERKS.indexOf(b))) b=p;'), null, null],
    ['⚑ T119 시뮬 정책이 «낮은 등급 우선» 이면',
      s => s.replace('if(p.g>b.g||(p.g===b.g&&PERKS.indexOf(p)<PERKS.indexOf(b))) b=p;',
                     'if(p.g<b.g||(p.g===b.g&&PERKS.indexOf(p)<PERKS.indexOf(b))) b=p;'), null, null],
    ['⚑ T119 시뮬 정책이 등급을 무시하면 (표 순서만)',
      s => s.replace('if(p.g>b.g||(p.g===b.g&&PERKS.indexOf(p)<PERKS.indexOf(b))) b=p;',
                     'if(PERKS.indexOf(p)<PERKS.indexOf(b)) b=p;'), null, null],
    ['⚑ T117 순서 지급으로 되돌리면 (3택 폐기)',
      s => s.replace('return pickPerk(G,simPickPerk(offer));', 'return pickPerk(G,PERKS[G.taken.length]);'), null, null],
    ['⚑ T117 한 런 상한 가드를 게임에서 지우면',
      null, s => s.replace('return perkOrderN()<PERK_PICKS && perksLeftN()>0;', 'return perksLeftN()>0;'), null],
    ['⚑ T117 게임 악마가 3택 대신 딴 짓을 하면',
      null, s => s.replace('offer.forEach((p,i)=>{ $(\'perkPick\'+i).onclick=()=>{ AU.play(\'click\'); pickPerk(p); renderStatsGrid(); updateBars(); closeOverlay(); }; });', ''), null],
    ['⚑ T104 회피 시 회복이 회복 증폭을 타게 하면 (noBoost=true 제거)',
      s => s.replace('heal(p,p.maxHp*PERK_EVHEAL_F,true)', 'heal(p,p.maxHp*PERK_EVHEAL_F)'), null, null],
    ['«공격 시» 축에 특전 소환을 달면', s => s.replace('  if(px.c_waveAtk', '  if(px.p_axeHit&&pkk(p,0.5))fireAxe(p,1);\n  if(px.c_waveAtk')
      .replace('function procOnAttack(G,e){\n  const p=G.player,px=p.px;', 'function procOnAttack(G,e){\n  const p=G.player,px=p.px;\n  if(px.p_axeHit&&pkk(p,0.5))fireAxe(p,1);'), null, null],
    ['특전을 11종으로 늘리면', s => s.replace("  ];\n}\nconst PERKS=mkPerks();", "    {id:'p_zzz', nm:'x', d:'x', ap:p=>p.px.p_zzz=1},\n  ];\n}\nconst PERKS=mkPerks();"), null, null],
    ['악마가 앞당김 대신 딴 짓을 하면', s => s.replace('            grantNextPerk(G);', '            /* nothing */'), null, null],
    ['한 런 획득 상한을 없애면', s => s.replace('if(G.taken.length>=PERK_PICKS)return null;', ''), null, null],
    ['PERK_PICKS 를 챕터 레벨업 횟수와 다르게 하면', s => s.replace('const PERK_PICKS=10;', 'const PERK_PICKS=7;'), null, null],
  ];
  let caught = 0;
  const quiet = console.log;
  for (const [nm, fs_, fh, fp] of cases) {
    console.log = () => {};
    let bad = 0;
    try { bad = run(fs_ ? fs_(simSrc) : simSrc, fh ? fh(htmSrc) : htmSrc, fp ? fp(planSrc) : planSrc); }
    catch (e) { bad = 1; }
    console.log = quiet;
    const ok = bad > 0;
    if (ok) caught++;
    console.log(`  ${ok ? '✓' : '✗'} ${nm} → ${ok ? '빨개진다' : '🔴 안 잡힌다 (죽은 검사)'}`);
  }
  console.log(`\n[음성 검사] ${caught}/${cases.length}`);
  process.exit(caught === cases.length ? 1 : 0);   /* 음성 검사는 «전부 잡히면» exit 1 이 정상이다 */
}

console.log('⚑⚑⚑ T96·T117 게이트 — 특전 고정 10종 · 3택 1 획득');
process.exit(run(simSrc, htmSrc, planSrc) ? 1 : 0);
