# T70 원시 측정 — 악마 거래의 `perkHp` 소급 누락 (sess-1542-22183 / 워커 C · 2026-09-02T15:4X~15:5XZ)

> 수리 내용·게이트는 `docs/PROGRESS.md` 의 T70 행. 이 문서는 **숫자만** 남긴다.

## 1. 무엇이 빠져 있었나 (코드 대조)

| 경로 | `index.html` (게임) | `sim.js` (수리 전) |
|---|---|---|
| 레벨업 | `G.perkChances++; if(px.perkHp) applyPerkHp(1);` | `G.perkChances++;` + 소급 2줄 ✅ |
| **악마 거래** | `G.perkChances++; if(p.px.perkHp) applyPerkHp(1); takePerk(perk);` | **`G.perkChances++` 만** ❌ |
| 악마 풀이 비면 | `if(!pool.length) pool = 전설 풀` (폴백) | 폴백 없음 → 지불만 하고 특전 없음 ❌ |

PLAN §4: «악마/레벨업 **모두** `perkChances` 증가 → `perkHp` 소급 로직».
챕터 레이아웃은 주인 확정으로 **악마 정확히 1명/챕터** 이므로, 💗 `l_perkHp` 보유 런은 항상 정확히 1회분(최대 체력 +1.8%)을 못 받고 있었다.

## 2. 밸런스 영향 — 실험2 하니스 A/B (엔진 외 조건 동일)

명령: `SEED=7 EXP2_N=12000 EXP2_FULL=1 node sim.js 2` (챕터 11 · 하니스 «일반+4 6부위 · 슬롯 0렙» · 12,000판)

| 지표 | 수리 전 | 수리 후 | 차 |
|---|---|---|---|
| 전체 클리어율 | 64.6% | 64.1% | −0.5%p |
| `l_perkHp` 승률 | 68% (1093판) | 68% (1072판) | 0 (정수 자리 불변) |
| 일반 스프레드 | 27.8%p (c_rangeShield 83.1 / c_critHeal1 55.3) | 29.8%p (c_rangeShield 84.1 / c_healDef 54.3) | +2.0%p |
| 희귀 스프레드 | 28.9%p (r_wave 84.1 / r_critFBuff 55.2) | 29.5%p (r_wave 84.7 / r_critFBuff 55.2) | +0.6%p |
| 전설 스프레드 | 27.2%p (l_spear 82.7 / l_counterChain 55.5) | 28.1%p (l_spear 83.8 / l_stunCrit3 55.7) | +0.9%p |
| 신화 스프레드 | 38.9%p (m_rangeSpear 91.8 / m_gold2 53.0) | 37.7%p (m_clone 92.3 / m_gold2 54.7) | −1.2%p |

**판정: 전부 측정 노이즈 안.** 12,000판 클리어율의 표본오차는 ≈0.44%p(p=0.64), 두 측정의 차는 ≈0.62%p 이므로 −0.5%p 는 1σ 안이다.
스프레드의 최상·최하 «이름» 이 바뀐 것도 같은 이유다 — T1 R04 가 이미 실측한 대로 **1,200~12,000판에서 등급 내 스프레드는 특전 균형이 아니라 노이즈·천장 포화의 함수**다(PROGRESS T1 R04 ③).

**왜 이렇게 작나**: 한 판 = 한 챕터고 챕터당 악마는 1명이라, 빠져 있던 몫의 상한이 «최대 체력 +1.8% 1회» 다.
따라서 **T1 회차를 무효화할 크기가 아니다.** 다만 이 커밋 전후 수치를 섞지 않도록 R05 회차 로그에 «악마특전기회 반영» 을 표시할 것.

## 3. 게이트

- `node tools/verifyT2.js` — **448/448 통과** (㉟ 신설 14항목. 직전 434 + 14).
- 게이트 15종 전부 exit 0: verifyT2 · verifyCombatConst · verifyPlanConst · verifyOptText(+SelfTest) · verifyGearEcon · verifyHarness · verifyLegacyHtml · verifyPerkGearDup · verifyPerkPolicy · verifyPierceScope · verifyRestPolicy · verifySaturation · verifyScoreCriteria · verifyScoreExp3.
- `verifyHarness` 는 이 변경으로 **드리프트 허용치를 넘지 않았다**(재보정 불요).
- T3 헤드리스는 **재실행하지 않았다** — 이번 커밋에서 `index.html` 은 한 바이트도 안 바뀌었다(게이트 ㉟ 는 읽기만 한다). 직전 기록값(T68 시점 4스위트 **188/188**, pageerror 0)이 그대로 유효하다.

### 음성 테스트 (7/7 exit 1 · 무변조 양성 대조 exit 0)

리포 사본을 스크래치패드에 떠서 한 곳씩 되돌리고 `verifyT2` 를 돌렸다.

| # | 변조 | 결과 | 빨개진 항목 |
|---|---|---|---|
| N0 | 무변조(양성 대조) | exit 0 | — |
| N1 | sim 악마 경로를 `G.perkChances++` 로 되돌림 (**원 버그 재현**) | exit 1 | ①(증가 2곳) · ② |
| N2 | sim `grantPerkChance` 의 소급 줄 삭제 | exit 1 | ① · ④ · ⑤ + ㉝(px 사장) |
| N3 | sim 계수 0.018 → 0.02 | exit 1 | ① · ④ · ⑤ |
| N4 | 게임 악마 경로의 `applyPerkHp(1)` 제거 | exit 1 | ③ |
| N5 | 게임 `applyPerkHp` 계수 0.018 → 0.03 | exit 1 | ④ · ⑤ |
| N6 | sim 레벨업 경로를 `G.perkChances++` 로 되돌림 | exit 1 | ①(증가 2곳) · ② |
| N7 | sim 악마 풀 폴백 제거 | exit 1 | ⑥ |
