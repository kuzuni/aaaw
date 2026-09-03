'use strict';
/* «특전 선택 정책 · 이벤트 정책» ↔ PLAN 대조 게이트 (T25 신설)
   사용: node tools/verifyPerkPolicy.js         (불일치가 있으면 exit 1)
         node tools/verifyPerkPolicy.js --list  (일치 항목까지 전부 덤프)

   왜 필요한가 — 기존 게이트 4개가 이 축을 한 항목도 덮지 않는다:
     - tools/verifyPlanConst.js  (T16) = PLAN↔엔진 경제·적 수치 48항목 (TUNE/GT 만 본다)
     - tools/verifyOptText.js    (T17) = 설명문 숫자 ↔ 엔진 상수 (특전·옵션 «표시 텍스트»)
     - tools/verifySaturation.js (T19) = 장비 GOPT 126칸의 효과 포화
     - tools/verifyPerkGearDup.js(T24) = 특전 ↔ 장비옵션 px 키 중복
   즉 **«특전이 어떻게 뽑히는가»(등급 굴림·등급통일·고유 제외·선택지 수)와
   «이벤트가 무엇을 주는가»(쉼터/악마/천사)** 는 어느 게이트도 파싱하지 않는다.
   실제로 T25 가 이 축을 처음 훑자마자 PLAN §3.0 의 등급 확률이 «일반 35%»(네 값 합 105%)로
   틀려 있는 것이 나왔다 — T9·T16·T21 과 같은 «PLAN↔엔진 불일치» 계열의 6번째 사례이고,
   이 축은 **T2 가 index.html 로 이식할 때 곧바로 게임 동작이 되는 값**이라 파급이 크다.

   방식: sim.js 소스에서 정책 상수를 정규식으로 뽑고(모양이 바뀌면 즉시 실패),
         PLAN.md 의 해당 문장에서 문서값을 뽑아 1:1 대조한다.
   KNOWN 에 등재된 «주인 판단 대기 중이라 지금은 못 맞추는 차이» 는 실패로 세지 않는다
   (T19·T24 게이트와 같은 규약 — 사유 없이 추가 금지). */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SIM = fs.readFileSync(path.join(root, 'sim.js'), 'utf8');
const PLAN = fs.readFileSync(path.join(root, 'PLAN.md'), 'utf8');
const HTML = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const LIST = process.argv.includes('--list');

/* ── 주인 판단 대기라 지금은 «불일치» 로 세지 않는 기존 차이 ── */
const KNOWN = [
  { nm: '무료 새로고침 1회',
    detail: 'PLAN §2.4 는 레벨업마다 무료 새로고침 1회(🎲 보유 시 +1)를 준다고 적었는데 엔진 perkChoice() 에는 새로고침이 아예 없다',
    why: 'T25 / 승인 대기 20번 — 반영하면 밸런스가 크게 움직인다(실측 챕터8 클리어율 68.0% → 76.2%)' },
  { nm: 'r_refresh 무효과',
    detail: "희귀 특전 r_refresh 의 ap 가 빈 함수(p=>{}) 라 엔진에서 효과가 정확히 0 이다",
    why: 'T25 / 승인 대기 20번 — 위 «새로고침 미구현» 의 직접 귀결. 실험2 의 무료 대조군으로는 유용하다' },
  { nm: '선택 정책 = 균등 랜덤',
    detail: 'perkChoice() 가 pick(opts) 로 선택지 중 하나를 균등 랜덤 선택한다(= 아무렇게나 고르는 플레이어). PLAN 에는 선택 정책 문구가 없다',
    why: 'T25 / 승인 대기 20번 — 실험2 의 특전별 기여도 측정에는 이 정책이 옳지만(무편향), 실험3 진행 곡선은 실제 플레이어보다 약한 봇을 기준으로 튜닝하게 된다' },
];

/* ── 헬퍼 ─────────────────────────────────────────── */
const cmp = [];
function grab(re, what) {                    /* sim.js 에서 상수 추출 — 모양이 바뀌면 즉시 실패 */
  const m = SIM.match(re);
  if (!m) { console.log(`\n🔴 엔진 파싱 실패: ${what}`); console.log(`   (sim.js 의 해당 코드 모양이 바뀌었다 — 게이트를 함께 갱신할 것)`); process.exit(1); }
  return m;
}
function planLine(needle, what) {
  const line = PLAN.split('\n').find(l => l.includes(needle));
  if (line === undefined) { console.log(`\n🔴 PLAN 파싱 실패: ${what} («${needle}» 를 못 찾음)`); process.exit(1); }
  return line;
}
function check(nm, planV, simV, unit) {
  const ok = Math.abs(planV - simV) < 1e-9;                 /* 0.70-0.40 같은 부동소수 오차 흡수 */
  cmp.push({ nm, planV, simV: +simV.toFixed(6), unit: unit || '', ok });
}

/* ── ① 등급 등장 확률 (PLAN §3.0 ↔ rollRarity) ──────
   ⚑ P1(T83) — 신화 폐지로 3단이 됐다. 엔진은 상수 배열 `RARITY_P=[일반,희귀,전설]` 하나만 본다. */
const rp = grab(/const RARITY_P=\[([\d.]+),([\d.]+),([\d.]+)\];/, 'RARITY_P 등급 확률 배열');
const simRar = { 일반: +rp[1], 희귀: +rp[2], 전설: +rp[3] };
const rarLine = planLine('등급 등장 확률', '§3.0 등급 등장 확률');
const rarNums = rarLine.match(/일반 ([\d.]+)% \/ 희귀 ([\d.]+)% \/ 전설 ([\d.]+)%/);
if (!rarNums) { console.log('\n🔴 PLAN §3.0 등급 확률 문장의 형식이 바뀌었다'); process.exit(1); }
const planRar = { 일반: +rarNums[1] / 100, 희귀: +rarNums[2] / 100, 전설: +rarNums[3] / 100 };
for (const k of ['일반', '희귀', '전설']) check(`등급 확률 ${k}`, planRar[k] * 100, simRar[k] * 100, '%');
const sum = Object.values(planRar).reduce((a, b) => a + b, 0);
cmp.push({ nm: '등급 확률 합계', planV: +(sum * 100).toFixed(4), simV: 100, unit: '%', ok: Math.abs(sum - 1) < 1e-9 });
/* 굴림이 그 배열을 실제로 쓰는가 (숫자를 다시 손으로 적어 두면 배열만 고쳐도 안 바뀐다) */
const rrBody = grab(/function rollRarity\(G\)\{[\s\S]*?\n\}/, 'rollRarity 본문')[0];
const usesArr = /RARITY_P\[2\]/.test(rrBody) && /RARITY_P\[1\]/.test(rrBody) && !/0\.\d/.test(rrBody);
cmp.push({ nm: '굴림이 RARITY_P 를 쓴다', planV: '배열', simV: usesArr ? '배열' : '리터럴', unit: '', ok: usesArr, txt: true });

/* ── ② 신화 등급 폐지 (특전 축) ───────────────────
   ⚑ 주인 확정 — 특전 등급은 3단이다. 장비의 신화 등급은 별개이므로 «특전» 쪽만 본다. */
{
  const mythPerk = /add\('m_/.test(SIM) || /id:'m_/.test(HTML);
  const legendOnly = /legendOnly/.test(SIM) || /legendOnly/.test(HTML);
  cmp.push({ nm: '신화 특전 0종', planV: '0종', simV: mythPerk ? '남아 있다' : '0종', unit: '', ok: !mythPerk, txt: true });
  cmp.push({ nm: '👼 전설이상 제한 폐지', planV: '없음', simV: legendOnly ? '남아 있다' : '없음', unit: '', ok: !legendOnly, txt: true });
}

/* ── ③ 선택지 수 — ⚑ 3개 고정 (🔮 전지의 눈 삭제) ── */
const ch3 = grab(/opts=rollPerks\(G,(\d+)\);/, 'perkChoice 의 선택지 수');
const ch3Line = planLine('레벨업 → 특전', '§2.4 선택지 수');
check('선택지 수 기본', +(ch3Line.match(/특전 \*\*(\d+)개 중 1개/)[1]), +ch3[1], '개');
{
  const c4 = /choice4/.test(SIM) || /choice4/.test(HTML);
  cmp.push({ nm: '🔮 전지의 눈 폐지', planV: '없음', simV: c4 ? '남아 있다' : '없음', unit: '', ok: !c4, txt: true });
}

/* ── ④ 등급통일 · 획득 중복 금지 (구조 검사) ─────────
   ⚑ 주인 확정 «획득 중복 금지» — 고유 플래그(u)가 아니라 **전 특전**이 taken 에서 빠진다. */
const rpBody = grab(/function rollPerks\(G,n\)\{[\s\S]*?\n\}/, 'rollPerks 본문')[0];
const rollsOnce = (rpBody.match(/rollRarity\(G\)/g) || []).length === 1;
const filtersOne = /perkPool\(G,rar\)/.test(rpBody);
cmp.push({ nm: '등급통일(선택지당 굴림 1회)', planV: '1회', simV: rollsOnce ? '1회' : '여러 번', unit: '', ok: rollsOnce && filtersOne, txt: true });
const poolBody = grab(/const perkPool=\(G,rar\)=>[^\n]*/, 'perkPool 정의')[0];
const uniqSim = /x\.r===rar&&!G\.taken\.includes\(x\)/.test(poolBody) && !/x\.u/.test(poolBody);
const uniqHtml = /p\.r===rar && !G\.perksTaken\.includes\(p\)/.test(HTML) && !/\bp\.u&&/.test(HTML);
cmp.push({ nm: '획득 중복 금지(전 특전 고유)', planV: '전부 제외', simV: (uniqSim && uniqHtml) ? '전부 제외' : '일부만', unit: '', ok: uniqSim && uniqHtml, txt: true });

/* ── ⑤ 😈 악마 이벤트 — ⚑ 전설 확정 ─────────────────
   ⚑ 주인 확정(2026-09-03 · T90): 비용은 «현재체력 차감» 이 아니라 «최대체력의 30% 를 최대치에서» 깎는 것이고,
   그 값은 두 엔진 공통 상수 `DEVIL_COST` 로 산다(옛 리터럴 `p.hp=Math.max(1,p.hp-p.maxHp*0.30)` 는 폐기).
   여기서는 PLAN 문면 ↔ 상수만 대조하고, «최대치에서 깎는가·항상 수락인가» 는 tools/verifyDevilPolicy.js 가 본다. */
const dvHp = grab(/const DEVIL_COST=([\d.]+);/, '악마 거래 비용 상수 DEVIL_COST');
const dvLine = planLine('악마 😈', '§2.4 악마 이벤트');
check('악마 최대체력 지불', +(dvLine.match(/최대 체력의 (\d+)% 지불/)[1]), +dvHp[1] * 100, '%');
{
  const simLeg = /let pool=perkPool\(G,2\);/.test(SIM);
  const htmlLeg = /let pool=perkPool\(2\);/.test(HTML);
  const noMyth = !/Math\.random\(\)<0\.15\?3:2/.test(SIM) && !/Math\.random\(\)<0\.15\?3:2/.test(HTML);
  cmp.push({ nm: '악마 = 전설 확정', planV: '전설 확정', simV: (simLeg && htmlLeg && noMyth) ? '전설 확정' : '어긋남', unit: '', ok: simLeg && htmlLeg && noMyth, txt: true });
}

/* ── ⑥ 🏕️ 쉼터 이벤트 ──────────────────────────────
   ⚑ 주인 확정(2026-09-02 16:4X · PLAN §7): **시뮬**의 가상 플레이어는 쉼터에서 항상 «🌟 경험치» 를 고른다.
   그래서 회복 분기는 sim.js 에서 사라졌고(T46), 회복량 40% 는 «유저가 고르는» index.html 에만 남는다.
   따라서 경험치는 sim.js 로, 회복량은 index.html 로 대조한다 (둘 다 과녁은 PLAN §2.4 한 줄). */
/* ⚑ 주인 확정 17:1X(T49)로 보상이 «체력 260 고정 회복 vs 경험치 +26» 이 됐고, 두 값은 양쪽 엔진의
   `REST_HEAL`·`REST_EXP` 상수로 산다. PLAN §2.4 줄은 개정 전 값을 취소선으로 남겨 두므로
   «주인 확정» 뒤쪽만 읽는다(안 그러면 폐기된 40%·+10 을 과녁으로 삼는다). */
const rsC = grab(/const REST_HEAL=(\d+),\s*REST_EXP=(\d+);/, '쉼터 보상 상수 REST_HEAL·REST_EXP');
grab(/if\(n\.type==='rest'\)\{[\s\S]*?gainExp\(G,REST_EXP\);/, '쉼터가 REST_EXP 를 주는 코드');
const rsHtml = HTML.match(/const REST_HEAL=(\d+),\s*REST_EXP=(\d+);/);
if (!rsHtml) { console.log('\n🔴 엔진 파싱 실패: index.html 의 REST_HEAL/REST_EXP (게이트를 함께 갱신할 것)'); process.exit(1); }
const rsLine = planLine('쉼터 🏕️', '§2.4 쉼터 이벤트');
const rsSeg = rsLine.slice(rsLine.indexOf('주인 확정'));
check('쉼터 회복량(고정값)', +(rsSeg.match(/체력 (\d+) 회복/)[1]), +rsC[1], '');
check('쉼터 경험치', +(rsSeg.match(/경험치 \+(\d+)/)[1]), +rsC[2], '');
check('쉼터 보상 sim ↔ index.html (회복)', +rsC[1], +rsHtml[1], '');
check('쉼터 보상 sim ↔ index.html (경험치)', +rsC[2], +rsHtml[2], '');

/* ── ⑦ 😇 천사 이벤트 (무료분) ────────────────────── */
/* ⚑ T90 — 천사 분기에 시뮬 정책 주석(SIM_ANGEL_POLICY «항상 왼쪽 무료 +5%»)이 붙으면서 한 줄이 아니게 됐다.
   «이벤트 루프를 빠져나가기 직전의 p.dmg 배수» 라는 자리로 잡는다. */
const ag = grab(/p\.dmg\*=([\d.]+);\s*\}\s*break;/, '천사 이벤트의 공격력 배수');
const agLine = planLine('천사 😇', '§2.4 천사 이벤트');
check('천사 무료 공격력', +(agLine.match(/공격력 \+(\d+)% \(무료\)/)[1]), (+ag[1] - 1) * 100, '%');

/* ── 출력 ─────────────────────────────────────────── */
console.log('=== 특전 선택 정책 · 이벤트 정책 ↔ PLAN 대조 (T25 게이트) ===');
let bad = 0;
for (const c of cmp) {
  if (!c.ok) bad++;
  if (!c.ok || LIST) {
    const p = c.txt ? c.planV : `${c.planV}${c.unit}`;
    const s = c.txt ? c.simV : `${c.simV}${c.unit}`;
    console.log(`  ${c.ok ? '✓' : '🔴'} ${c.nm}: PLAN ${p} ↔ 엔진 ${s}`);
  }
}
console.log('');
console.log('[등재된 기존 차이 — 주인 판단 대기라 실패로 세지 않는다]');
for (const k of KNOWN) { console.log(`  🔵 ${k.nm} — ${k.detail}`); console.log(`        └ 등재됨: ${k.why}`); }
console.log('');
console.log(`대조 ${cmp.length}항목 · 일치 ${cmp.length - bad} · 불일치 ${bad} · 등재된 기존 차이 ${KNOWN.length}건`);
if (bad) { console.log('→ 실패: PLAN 과 엔진 중 옳은 쪽으로 맞추고, 못 맞추면 KNOWN 에 사유와 함께 등재할 것'); process.exit(1); }
console.log('→ 통과');
