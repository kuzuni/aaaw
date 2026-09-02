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

/* ── ① 등급 등장 확률 (PLAN §3.0 ↔ rollRarity) ────── */
const rr = grab(/return r<([\d.]+)\?3:r<([\d.]+)\?2:r<([\d.]+)\?1:0;/, 'rollRarity 의 등급 임계값');
const tMyth = +rr[1], tLeg = +rr[2], tRare = +rr[3];
const simRar = { 신화: tMyth, 전설: tLeg - tMyth, 희귀: tRare - tLeg, 일반: 1 - tRare };
const rarLine = planLine('등급 등장 확률', '§3.0 등급 등장 확률');
const rarNums = rarLine.match(/일반 ([\d.]+)% \/ 희귀 ([\d.]+)% \/ 전설 ([\d.]+)% \/ 신화 ([\d.]+)%/);
if (!rarNums) { console.log('\n🔴 PLAN §3.0 등급 확률 문장의 형식이 바뀌었다'); process.exit(1); }
const planRar = { 일반: +rarNums[1] / 100, 희귀: +rarNums[2] / 100, 전설: +rarNums[3] / 100, 신화: +rarNums[4] / 100 };
for (const k of ['일반', '희귀', '전설', '신화']) check(`등급 확률 ${k}`, planRar[k] * 100, simRar[k] * 100, '%');
const sum = Object.values(planRar).reduce((a, b) => a + b, 0);
cmp.push({ nm: '등급 확률 합계', planV: +(sum * 100).toFixed(4), simV: 100, unit: '%', ok: Math.abs(sum - 1) < 1e-9 });

/* ── ② 👼 전설 이상 제한(legendOnly) 의 신화 비율 ─── */
const lo = grab(/if\(G\.legendOnly\)return Math\.random\(\)<([\d.]+)\?3:2;/, 'rollRarity 의 legendOnly 분기');
const loLine = planLine('신화 37.5%', '§3.0 legendOnly 신화 비율');
check('legendOnly 신화 비율', +(loLine.match(/신화 ([\d.]+)%/)[1]), +lo[1] * 100, '%');

/* ── ③ 선택지 수 (기본 / 🔮 전지의 눈) ────────────── */
const ch4 = grab(/opts=rollPerks\(G,p\.px\.choice4\?(\d+):(\d+)\);/, 'perkChoice 의 선택지 수');
const ch4Line = planLine('레벨업 → 특전', '§2.4 선택지 수');
check('선택지 수 기본', +(ch4Line.match(/특전 (\d+)개 중 1개/)[1]), +ch4[2], '개');
check('선택지 수 🔮', +(ch4Line.match(/전지의 눈 보유 시 (\d+)개/)[1]), +ch4[1], '개');

/* ── ④ 등급통일 · 고유 제외 (구조 검사) ───────────── */
const rpBody = grab(/function rollPerks\(G,n\)\{[\s\S]*?\n\}/, 'rollPerks 본문')[0];
const rollsOnce = (rpBody.match(/rollRarity\(G\)/g) || []).length === 1;
const filtersOne = /PERKS\.filter\(x=>x\.r===rar&&/.test(rpBody);
cmp.push({ nm: '등급통일(선택지당 굴림 1회)', planV: '1회', simV: rollsOnce ? '1회' : '여러 번', unit: '', ok: rollsOnce && filtersOne, txt: true });
const uniqOk = /!\(x\.u&&G\.taken\.includes\(x\)\)/.test(rpBody) && /!\(y\.u&&G\.taken\.includes\(y\)\)/.test(SIM);
cmp.push({ nm: '고유(u) 특전 선택지 제외', planV: '제외', simV: uniqOk ? '제외' : '미제외', unit: '', ok: uniqOk, txt: true });

/* ── ⑤ 😈 악마 이벤트 ─────────────────────────────── */
const dv = grab(/const rar=Math\.random\(\)<([\d.]+)\?3:2;/, '악마 이벤트의 신화 확률');
const dvHp = grab(/p\.hp=Math\.max\(1,p\.hp-p\.maxHp\*([\d.]+)\);/, '악마 이벤트의 체력 지불');
const dvLine = planLine('악마 😈', '§2.4 악마 이벤트');
check('악마 신화 확률', +(dvLine.match(/(\d+)% 확률로 신화/)[1]), +dv[1] * 100, '%');
check('악마 체력 지불', +(dvLine.match(/최대 체력의 (\d+)% 지불/)[1]), +dvHp[1] * 100, '%');

/* ── ⑥ 🏕️ 쉼터 이벤트 ────────────────────────────── */
const rsHeal = grab(/else gainExp\(G,(\d+)\);/, '쉼터의 경험치 보상');
const rsAmt = grab(/if\(p\.hp<p\.maxHp\*[\d.]+\)heal\(p,p\.maxHp\*([\d.]+)\);/, '쉼터의 회복량');
const rsLine = planLine('쉼터 🏕️', '§2.4 쉼터 이벤트');
check('쉼터 회복량', +(rsLine.match(/최대체력의 (\d+)%/)[1]), +rsAmt[1] * 100, '%');
check('쉼터 경험치', +(rsLine.match(/경험치 \+(\d+)/)[1]), +rsHeal[1], '');

/* ── ⑦ 😇 천사 이벤트 (무료분) ────────────────────── */
const ag = grab(/\}else\{p\.dmg\*=([\d.]+);\}/, '천사 이벤트의 공격력 배수');
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
