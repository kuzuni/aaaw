'use strict';
/* 쉼터(🏕️) 게이트 — T46
 *
 * 감시 대상 3가지가 서로 다른 방향으로 어긋나기 쉬워 한 파일에 묶었다.
 *   ⓐ ⚑ 주인 확정(2026-09-02 16:4X · PLAN §7): **시뮬**의 가상 플레이어는 쉼터에서 항상 «🌟 경험치» 를 고른다.
 *      (체력 회복 분기 금지 — 전 실험 공통 측정 조건)
 *   ⓑ 그 정책은 **시뮬 전용**이다. 실제 게임(index.html)은 유저 자유 선택이라 두 선택지가 남아 있어야 한다.
 *      («정책 이식» 을 이유로 게임에서 회복 버튼을 지우는 반대 방향 회귀를 막는다)
 *   ⓒ 게임 쉼터는 PLAN §2.4 확정 스펙 — ⚑ 주인 확정(17:1X · T49) «❤️ 체력 260 회복(고정값)» vs «🌟 경험치 +26».
 *      구버전 «체력 50% / 즉시 레벨 업» 도, 그 앞 «최대체력 40% / 경험치 +10» 도 잔재 금지.
 *      두 값은 `REST_HEAL`·`REST_EXP` 로 sim.js·index.html 양쪽에 같은 이름·같은 값이어야 한다.
 *
 * 사용: node tools/verifyRestPolicy.js      (exit 0 = 통과, 1 = 불합격)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SIM = fs.readFileSync(path.join(ROOT, 'sim.js'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const PLAN = fs.readFileSync(path.join(ROOT, 'PLAN.md'), 'utf8');

let fail = 0, pass = 0;
const ok = m => { pass++; console.log('  ✓ ' + m); };
const bad = m => { fail++; console.log('  ✗ ' + m); };
/* 주석에 옛 코드가 인용돼 있으므로(수리 근거) 검사 전에 반드시 벗긴다 */
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/* ---------- ⓐ sim.js — 쉼터는 언제나 경험치 ---------- */
console.log('\n[①] sim.js 쉼터 분기 = 항상 «경험치» (주인 확정 16:4X · PLAN §7)');
const mSim = SIM.match(/if\(n\.type==='rest'\)\{([\s\S]*?)\}else if\(n\.type==='devil'\)/);
if (!mSim) {
  bad("sim.js 의 쉼터 분기(if(n.type==='rest'){…}else if(n.type==='devil'))를 찾지 못했다 — 게이트를 갱신할 것");
} else {
  const body = strip(mSim[1]);
  /gainExp\(G,\s*REST_EXP\)/.test(body)
    ? ok('쉼터에서 gainExp(G,REST_EXP) 를 준다 (PLAN §2.4 «🌟 경험치»)')
    : bad('쉼터에 gainExp(G,REST_EXP) 가 없다 — 경험치 선택 정책이 깨졌거나 수치를 상수 밖에 박았다');
  /* 회복 분기 = heal(...) 호출 (⚑ P1(T83) 로 restHp 예외가 사라져 이제 0 이어야 한다) */
  const heals = (body.match(/heal\s*\(/g) || []).length;
  const restHpHeal = 0;
  heals - restHpHeal === 0
    ? ok('쉼터에 체력 회복 분기가 없다')
    : bad(`쉼터에 체력 회복이 ${heals - restHpHeal}개 남아 있다 — 주인 확정 16:4X 위반(시뮬은 회복 선택 금지)`);
  /^\s*gainExp\(G,\s*REST_EXP\);\s*$/.test(body.replace(/\n\s*\n/g, '\n'))
    ? ok('경험치 지급이 무조건 실행된다 (체력 조건부 분기 없음)')
    : bad('쉼터 본문이 «무조건 gainExp» 형태가 아니다 — 조건부 선택이 남아 있는지 확인할 것');
  /p\.hp\s*<\s*p\.maxHp\s*\*\s*0\.6/.test(body)
    ? bad('폐지된 «체력 60% 미만이면 회복» 조건이 되돌아왔다 (주인 확정 16:4X 위반)')
    : ok('폐지된 «체력 60% 미만 → 회복» 조건 없음');
}

/* ---------- ⓑ index.html — 게임은 유저 자유 선택 ---------- */
console.log('\n[②] index.html 쉼터 = 유저 자유 선택 2택 (시뮬 정책의 오이식 방지)');
const mHtml = HTML.match(/function openRest\(\)\{([\s\S]*?)\n\}/);
if (!mHtml) {
  bad('index.html 의 openRest() 를 찾지 못했다 — 게이트를 갱신할 것');
} else {
  const body = mHtml[1];
  const code = strip(body);
  /id="rHeal"/.test(code) && /\$\('rHeal'\)\.onclick/.test(code)
    ? ok('❤️ 회복 버튼(rHeal)이 살아 있다 — 실제 게임은 유저가 고른다')
    : bad('❤️ 회복 버튼이 사라졌다 — 시뮬 전용 정책(16:4X)을 게임에 잘못 이식했다');
  /id="rExp"/.test(code) && /\$\('rExp'\)\.onclick/.test(code)
    ? ok('🌟 경험치 버튼(rExp)이 살아 있다')
    : bad('🌟 경험치 버튼이 없다');

  /* ---------- ⓒ PLAN §2.4 확정 스펙 ---------- */
  console.log('\n[③] index.html 쉼터가 PLAN §2.4 스펙과 일치 (구버전 잔재 금지)');
  /heal\(p2,\s*REST_HEAL\)/.test(code) && !/heal\(p2,\s*p2\.maxHp\s*\*/.test(code)
    ? ok('회복량 = REST_HEAL 고정값 (PLAN §2.4 · 최대체력 비율 아님)')
    : bad('회복량이 REST_HEAL 고정값이 아니다 (PLAN §2.4 — 주인 17:1X 로 «최대체력 40%» 는 폐기됐다)');
  /체력\s*\$\{fmt\(REST_HEAL\)\}\s*회복/.test(code)
    ? ok('회복 버튼이 회복량을 «실제 숫자» 로 표시한다 (PLAN §2.4)')
    : bad('회복 버튼이 회복량을 실제 숫자로 표시하지 않는다 (PLAN §2.4)');
  /gainExp\(REST_EXP\)/.test(code)
    ? ok('🌟 선택이 경험치 +REST_EXP 를 준다 (PLAN §2.4)')
    : bad('🌟 선택이 gainExp(REST_EXP) 가 아니다 — 구버전 «즉시 레벨 업»·«+10» 인지 확인할 것');
  /G\.player\.level\+\+/.test(code)
    ? bad('구버전 «즉시 레벨 업»(level++)이 남아 있다 — PLAN §2.4 는 «경험치 +10» 이다')
    : ok('구버전 «즉시 레벨 업»(level++) 잔재 없음');
  /즉시\s*레벨\s*업/.test(code)   /* 주석에는 «폐지» 근거로 인용돼 있으므로 주석 벗긴 code 로 본다 */
    ? bad('쉼터 문구에 구버전 «즉시 레벨 업» 이 남아 있다 (PLAN §2.4)')
    : ok('쉼터 문구에 «즉시 레벨 업» 없음');
  /체력\s*50%/.test(code)
    ? bad('쉼터 문구에 구버전 «체력 50% 회복» 이 남아 있다 (PLAN §2.4 = 40%)')
    : ok('쉼터 문구에 구버전 «체력 50%» 없음');
}

/* ---------- ⓕ 쉼터 보상 상수 REST_HEAL·REST_EXP — PLAN ↔ sim.js ↔ index.html ---------- */
console.log('\n[⑥] 쉼터 보상 «체력 260 / 경험치 +26» (주인 확정 17:1X · T49) — 3자 일치');
{
  const rd = src => {
    const m = src.match(/const REST_HEAL=(\d+),\s*REST_EXP=(\d+);/);
    return m ? { heal: +m[1], exp: +m[2] } : null;
  };
  const sv = rd(SIM), hv = rd(HTML);
  /* PLAN §2.4 는 개정 전 값을 취소선으로 남겨 두므로 «주인 확정» 뒤쪽만 읽는다 */
  const planLine = PLAN.split('\n').find(l => l.includes('쉼터 🏕️')) || '';
  const seg = planLine.slice(planLine.indexOf('주인 확정'));
  const pm = seg.match(/체력 (\d+) 회복/), pe = seg.match(/경험치 \+(\d+)/);
  if (!sv || !hv || !pm || !pe) {
    bad(`REST_HEAL/REST_EXP 를 못 읽었다 (sim ${!!sv} · index.html ${!!hv} · PLAN 회복 ${!!pm} · PLAN 경험치 ${!!pe}) — 게이트를 갱신할 것`);
  } else {
    sv.heal === hv.heal && sv.heal === +pm[1]
      ? ok(`회복량 ${sv.heal} 고정 — 3자 일치`)
      : bad(`회복량 불일치: PLAN ${pm[1]} · sim ${sv.heal} · index.html ${hv.heal}`);
    sv.exp === hv.exp && sv.exp === +pe[1]
      ? ok(`경험치 +${sv.exp} — 3자 일치`)
      : bad(`경험치 불일치: PLAN ${pe[1]} · sim ${sv.exp} · index.html ${hv.exp}`);
  }
}

/* ---------- ⓓ 🏕️ 쉼터 최대 체력 특전이 존재하지 않는가 (⚑ P1(T83)) ----------
   구 희귀 `r_restHp`(«쉼터에서 최대 체력 +15%»)는 새 132종에서 사라졌다 — «최대 체력 증가» 는
   주인 확정 금지축이다. 되살아나면 여기서 빨개진다. */
console.log('\n[④] 🏕️ 쉼터 최대 체력 증가 특전 — 금지축(존재 0)');
{
  const hits = [];
  if (/px\.restHp/.test(SIM)) hits.push('sim.js');
  if (/px\.restHp/.test(HTML)) hits.push('index.html');
  if (/r_restHp/.test(PLAN)) hits.push('PLAN.md');
  hits.length === 0
    ? ok('두 엔진·PLAN 어디에도 쉼터 최대 체력 특전이 없다')
    : bad('쉼터 최대 체력 증가가 되살아났다 (금지축): ' + hits.join(', '));
}

/* ---------- ⓔ PLAN 에 정책이 문서로 남아 있는가 ---------- */
console.log('\n[⑤] PLAN 문서 — 시뮬 쉼터 정책 조항 존속');
/시뮬 공통 정책[\s\S]{0,80}쉼터[\s\S]{0,40}경험치/.test(PLAN)
  ? ok('PLAN §7 에 «가상 플레이어는 쉼터에서 항상 경험치» 조항이 있다')
  : bad('PLAN §7 의 시뮬 쉼터 정책 조항이 사라졌다 (주인 확정 16:4X)');

console.log(`\n통과 ${pass} · 불합격 ${fail}`);
console.log(fail === 0 ? '→ 통과' : '→ 불합격');
process.exit(fail === 0 ? 0 : 1);
