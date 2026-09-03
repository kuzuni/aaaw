'use strict';
/* 악마·천사 이벤트 게이트 — T90 (⚑ 주인 확정 2026-09-03 · PLAN §2.4)
 *
 * 주인 확정 2건이 서로 다른 방향으로 되돌아가기 쉬워 한 파일에 묶었다.
 *   ⓐ **거래 비용 = 최대체력 차감** — «최대체력의 30% 를 **최대치에서**» 깎는다.
 *      현재체력에서 깎던 종전 구현(`p.hp -= p.maxHp*0.30`)은 폐기다. 그 판 동안 최대체력이 줄어든 채
 *      진행하고, 현재체력이 새 최대치를 넘으면 최대치로 클램프한다(위임).
 *      두 엔진(sim.js·index.html)이 같은 상수(`DEVIL_COST`)·같은 동사(`payDevilCost`)를 써야 한다.
 *   ⓑ **시뮬 이벤트 정책** — 밸런스 시뮬의 가상 플레이어는 **악마 = 항상 수락 · 천사 = 항상 왼쪽(무료 +5%)**.
 *      쉼터 «항상 경험치»(T46 · verifyRestPolicy)와 같은 축의 측정 조건 통일이다.
 *      («체력 65% 초과일 때만 수락» 하던 조건부 정책은 폐기 — 승인 대기 32번이 이 답으로 종결됐다)
 *   ⓒ 그 정책은 **시뮬 전용**이다. 실제 게임은 유저 자유 선택이라 악마 2택(지불/지나감)·천사 2택(무료/광고)이
 *      그대로 남아 있어야 한다 (정책을 «이식» 한다며 게임에서 선택지를 지우는 반대 방향 회귀 차단).
 *
 * 정적 대조 + **실행 단언**(vm 으로 sim.js 를 굴려 실제 수치·실제 호출 횟수를 본다).
 * 사용: node tools/verifyDevilPolicy.js      (exit 0 = 통과, 1 = 불합격)
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
/* 주석에 «폐기된 옛 코드» 가 근거로 인용돼 있으므로 검사 전에 반드시 벗긴다 */
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const SIMC = strip(SIM), HTMLC = strip(HTML);

/* ---------- ① 비용 상수 DEVIL_COST = 0.30, 두 엔진 동일 ---------- */
console.log('\n[①] 거래 비용 상수 (PLAN §2.4 «최대 체력의 30%»)');
{
  const rx = /const\s+DEVIL_COST\s*=\s*([0-9.]+)\s*;/;
  const a = SIMC.match(rx), b = HTMLC.match(rx);
  if (!a) bad('sim.js 에 const DEVIL_COST 가 없다 — 비용이 리터럴로 흩어졌는지 확인할 것');
  else if (a[1] !== '0.30') bad(`sim.js DEVIL_COST = ${a[1]} — 주인 확정 0.30 이 아니다`);
  else ok('sim.js DEVIL_COST = 0.30');
  if (!b) bad('index.html 에 const DEVIL_COST 가 없다');
  else if (b[1] !== '0.30') bad(`index.html DEVIL_COST = ${b[1]} — 주인 확정 0.30 이 아니다`);
  else ok('index.html DEVIL_COST = 0.30');
  (a && b && a[1] === b[1]) ? ok('두 엔진 비용 상수 일치') : bad('두 엔진 비용 상수가 다르다 (sim ↔ index.html)');
}

/* ---------- ② payDevilCost — «최대치에서» 깎는 동사 (두 엔진 동일 본문) ---------- */
console.log('\n[②] payDevilCost = 최대치 차감 + 현재체력 클램프 (현재체력 차감 폐기)');
{
  const rx = /function\s+payDevilCost\(p\)\{([\s\S]*?)\n\}/;
  const bodies = {};
  for (const [nm, src] of [['sim.js', SIMC], ['index.html', HTMLC]]) {
    const m = src.match(rx);
    if (!m) { bad(`${nm} 에 payDevilCost() 가 없다 — 비용 처리가 한 동사로 모여 있지 않다`); continue; }
    const body = m[1].replace(/\s+/g, ' ').trim();
    bodies[nm] = body;
    /* 최대치 차감 */
    /p\.maxHp\s*=\s*Math\.max\(\s*1\s*,\s*p\.maxHp\s*-\s*p\.maxHp\s*\*\s*DEVIL_COST\s*\)/.test(body)
      ? ok(`${nm}: 최대체력에서 DEVIL_COST 만큼 깎는다 (하한 1)`)
      : bad(`${nm}: «p.maxHp = max(1, p.maxHp - p.maxHp*DEVIL_COST)» 형태가 아니다 — 최대치 차감이 깨졌다`);
    /* 현재체력 클램프 — «내림» 이라 Math.min 으로 쓴다.
       `p.hp=p.maxHp` 형태로 쓰면 뜻은 같아도 verifyLegacyHtml ③(«풀충전은 특전 안에서만»)이 빨개진다. */
    /p\.hp\s*=\s*Math\.min\(\s*p\.hp\s*,\s*p\.maxHp\s*\)/.test(body)
      ? ok(`${nm}: 현재체력이 새 최대치를 넘으면 내림 클램프한다`)
      : bad(`${nm}: «p.hp = Math.min(p.hp, p.maxHp)» 클램프가 없다 (주인 확정 위임 조항)`);
    /* 현재체력 직접 차감 금지 — 이것이 폐기된 옛 동작이다 */
    /p\.hp\s*=\s*Math\.max\(\s*1\s*,\s*p\.hp\s*-/.test(body)
      ? bad(`${nm}: 폐기된 «현재체력 차감» 이 payDevilCost 안에 되살아났다`)
      : ok(`${nm}: 현재체력을 직접 깎지 않는다`);
  }
  if (bodies['sim.js'] && bodies['index.html'])
    bodies['sim.js'] === bodies['index.html']
      ? ok('두 엔진 payDevilCost 본문이 글자까지 동일')
      : bad(`두 엔진 payDevilCost 본문이 다르다 — sim «${bodies['sim.js']}» / html «${bodies['index.html']}»`);
}

/* ---------- ③ sim.js 악마 분기 = 항상 수락 ---------- */
console.log('\n[③] sim.js 악마 = 항상 수락 (SIM_DEVIL_POLICY · 승인 32번 종결)');
{
  const m = SIMC.match(/\}else if\(n\.type==='devil'\)\{([\s\S]*?)\n\s*\}else\{/);
  if (!m) bad("sim.js 의 악마 분기(else if(n.type==='devil'))를 찾지 못했다 — 게이트를 갱신할 것");
  else {
    const body = m[1];
    /payDevilCost\(p\)/.test(body)
      ? ok('악마 분기가 payDevilCost(p) 한 동사를 거친다')
      : bad('악마 분기가 payDevilCost 를 안 쓴다 — 비용 계산이 다시 흩어졌다');
    /if\(!G\.noPerk\)\{/.test(body)
      ? ok('수락 조건은 noPerk 가드 하나뿐 (특전 미획득 측정 제외분)')
      : bad('«if(!G.noPerk){» 형태의 무조건 수락이 아니다 — 조건부 수락이 되살아났는지 확인할 것');
    /p\.hp\s*>\s*p\.maxHp\s*\*\s*0\.65/.test(body)
      ? bad('폐기된 «체력 65% 초과일 때만 수락» 조건이 되돌아왔다 (주인 확정 2026-09-03 위반)')
      : ok('폐기된 «체력 65% 초과» 조건 없음');
    /p\.hp\s*[-=]/.test(body)
      ? bad('악마 분기가 현재체력을 직접 만진다 — 비용은 최대치에서만 깎아야 한다')
      : ok('악마 분기가 현재체력을 직접 만지지 않는다');
  }
}

/* ---------- ④ sim.js 천사 = 항상 왼쪽(무료 +5%) ---------- */
console.log('\n[④] sim.js 천사 = 항상 왼쪽 무료 +5% (SIM_ANGEL_POLICY)');
{
  const m = SIMC.match(/\}else\{\s*p\.dmg\*=([0-9.]+);\s*\}\s*break;/);
  if (!m) bad('sim.js 의 천사 분기(else{ p.dmg*=… })를 찾지 못했다 — 게이트를 갱신할 것');
  else m[1] === '1.05'
    ? ok('천사 = p.dmg *= 1.05 (무료 축복 = 왼쪽 선택지)')
    : bad(`천사 배수가 ${m[1]} — 주인 확정 «왼쪽(무료 +5%)» = 1.05 가 아니다`);
  /* 광고 분기(+15%)는 시뮬에 존재 금지 */
  /1\.15/.test(SIMC.slice(Math.max(0, SIMC.indexOf("n.type==='devil'")), SIMC.indexOf("n.type==='devil'") + 1600))
    ? bad('시뮬 이벤트 처리 근방에 1.15(광고 축복) 가 있다 — 시뮬은 항상 왼쪽이어야 한다')
    : ok('시뮬에 광고 축복(+15%) 분기 없음');
}

/* ---------- ⑤ index.html = 유저 자유 선택 유지 ---------- */
console.log('\n[⑤] index.html = 유저 자유 선택 2택 유지 (시뮬 정책의 오이식 방지)');
{
  const d = HTMLC.match(/function openDevil\(\)\{([\s\S]*?)\n\}/);
  if (!d) bad('index.html 의 openDevil() 를 찾지 못했다');
  else {
    const b = d[1];
    /id="dYes"/.test(b) && /id="dNo"/.test(b)
      ? ok('악마 2택(지불 dYes / 지나감 dNo) 유지')
      : bad('악마 선택지가 2택이 아니다 — 시뮬 정책(항상 수락)을 게임에 잘못 이식했는지 확인할 것');
    /payDevilCost\(p\)/.test(b)
      ? ok('수락 시 payDevilCost(p) 를 거친다 (sim.js 와 같은 동사)')
      : bad('수락 처리가 payDevilCost 를 안 쓴다');
    /p\.hp\s*=\s*Math\.max\(\s*1\s*,\s*p\.hp\s*-\s*cost\s*\)/.test(b)
      ? bad('폐기된 «현재체력에서 cost 차감» 이 되살아났다 (주인 확정 위반)')
      : ok('현재체력 직접 차감 없음');
    /최대\s*체력의\s*30%\s*지불/.test(b)
      ? ok('버튼 문면 «최대 체력의 30% 지불» (PLAN §2.4)')
      : bad('악마 지불 버튼 문면이 PLAN §2.4 와 다르다');
    /최대\s*체력이\s*줄어든\s*채/.test(b)
      ? ok('«최대 체력이 줄어든 채 진행» 안내가 버튼에 있다 (주인 확정 문면)')
      : bad('최대치가 줄어든다는 안내가 버튼에 없다 — 플레이어가 현재체력 차감으로 오해한다');
  }
  const a = HTMLC.match(/function openAngel\(\)\{([\s\S]*?)\n\}/);
  if (!a) bad('index.html 의 openAngel() 를 찾지 못했다');
  else {
    const b = a[1];
    /id="aFree"/.test(b) && /id="aAd"/.test(b)
      ? ok('천사 2택(무료 aFree / 광고 aAd) 유지 — 게임은 자유 선택')
      : bad('천사 선택지가 2택이 아니다 — 시뮬 정책을 게임에 잘못 이식했다');
    /bless\(1\.05\)/.test(b) && /bless\(1\.15\)/.test(b)
      ? ok('무료 +5% · 광고 +15% 배수 유지 (PLAN §2.4)')
      : bad('천사 축복 배수(1.05 / 1.15)가 PLAN §2.4 와 다르다');
  }
}

/* ---------- ⑥ PLAN §2.4 문면 대조 ---------- */
console.log('\n[⑥] PLAN §2.4 문면 (주인 확정 원문)');
{
  const line = (PLAN.match(/^.*\*\*악마 😈\*\*.*$/m) || [''])[0];
  const ang = (PLAN.match(/^.*\*\*천사 😇\*\*.*$/m) || [''])[0];
  /최대체력에서/.test(line)
    ? ok('PLAN: 지불은 «최대체력에서» 깎는다고 적혀 있다')
    : bad('PLAN §2.4 악마 줄에 «최대체력에서» 문면이 없다');
  /최대체력\s*자체가\s*30%\s*줄어든/.test(line)
    ? ok('PLAN: «그 판 동안 최대체력 자체가 30% 줄어든 채 진행»')
    : bad('PLAN §2.4 에 «최대체력이 줄어든 채 진행» 문면이 없다');
  /악마\s*항상\s*수락/.test(line)
    ? ok('PLAN: 시뮬 정책 «악마 항상 수락»')
    : bad('PLAN §2.4 에 시뮬 «악마 항상 수락» 정책이 없다');
  /항상\s*왼쪽/.test(ang)
    ? ok('PLAN: 시뮬 정책 «천사 항상 왼쪽(무료 +5%)»')
    : bad('PLAN §2.4 에 시뮬 «천사 항상 왼쪽» 정책이 없다');
}

/* ---------- ⑦ 실행 단언 — payDevilCost 실측 ---------- */
console.log('\n[⑦] 실행 단언 — payDevilCost 가 실제로 최대치를 깎는다 (vm)');
const vm = require('vm');
const CUT = "const mode=process.argv[2]||'all';";
const at = SIM.indexOf(CUT);
let CTX = null;
if (at < 0) bad('sim.js 에서 CLI 디스패처를 못 찾았다 — 잘림 기준이 바뀌었다');
else {
  const ctx = { console: { log() {} }, process, Math, JSON, Number, String, Array, Set, Map, Object, Date, parseInt, parseFloat, isFinite, isNaN, require };
  vm.createContext(ctx);
  vm.runInContext(SIM.slice(0, at) + '\n;globalThis.__D={payDevilCost,DEVIL_COST,runChapter,flatBuild,setSeed};', ctx);
  CTX = ctx;
  const D = ctx.__D || ctx.globalThis.__D;
  /* (1) 풀피 — 최대치 1000 → 700, 현재체력도 클램프로 700 */
  {
    const p = { maxHp: 1000, hp: 1000 };
    D.payDevilCost(p);
    (Math.abs(p.maxHp - 700) < 1e-9 && Math.abs(p.hp - 700) < 1e-9)
      ? ok('풀피 1000/1000 → 700/700 (최대치 −30% · 현재체력 클램프)')
      : bad(`풀피 결과가 700/700 이 아니다 — ${p.hp}/${p.maxHp}`);
  }
  /* (2) ⚑ 핵심 — 현재체력이 낮으면 «현재체력은 한 점도 안 깎인다».
         옛 구현이라면 100 − 300 = 1 이 됐다. 이 항목이 주인 확정의 실질이다. */
  {
    const p = { maxHp: 1000, hp: 100 };
    D.payDevilCost(p);
    (Math.abs(p.maxHp - 700) < 1e-9 && Math.abs(p.hp - 100) < 1e-9)
      ? ok('저체력 100/1000 → 100/700 (현재체력 불변 — 옛 구현이면 1 이 됐다)')
      : bad(`저체력 결과가 100/700 이 아니다 — ${p.hp}/${p.maxHp} (현재체력 차감이 남아 있다)`);
  }
  /* (3) 하한 — 최대치가 0 이하로 내려가지 않는다 */
  {
    const p = { maxHp: 1, hp: 1 };
    D.payDevilCost(p);
    (p.maxHp >= 1 && p.hp >= 0)
      ? ok(`하한 유지 — 최대치 ${p.maxHp.toFixed(3)} (0 이하로 안 떨어진다)`)
      : bad(`최대치가 ${p.maxHp} 로 떨어졌다 — 하한 1 이 깨졌다`);
  }
}

/* ---------- ⑧ 실행 단언 — 시뮬은 악마를 «항상» 수락한다 ---------- */
console.log('\n[⑧] 실행 단언 — 챕터를 굴리면 악마 수락이 판마다 정확히 1회 (vm 스파이)');
if (CTX) {
  const D = CTX.__D || CTX.globalThis.__D;
  const real = D.payDevilCost;
  let calls = 0;
  /* sim.js 의 최상위 function 선언은 vm 전역 속성이라, 전역을 갈아 끼우면 runChapter 안의 호출이 스파이로 온다 */
  CTX.payDevilCost = p => { calls++; return real(p); };
  D.setSeed(20260903);
  const N = 40;
  const build = D.flatBuild(4000, 40000, 20000);   /* 챕터 1 을 확실히 완주하는 과잉 빌드 */
  let cleared = 0;
  for (let i = 0; i < N; i++) if (D.runChapter(1, build, {}).clear) cleared++;
  CTX.payDevilCost = real;
  cleared === N
    ? ok(`대조군 성립 — ${N}판 전부 완주(악마 노드를 반드시 지난다)`)
    : bad(`${N}판 중 ${cleared}판만 완주 — 빌드를 더 키워 대조군을 다시 세울 것`);
  calls === N
    ? ok(`악마 수락 ${calls}/${N}판 = 100% (항상 수락 — 조건부였다면 100% 가 안 된다)`)
    : bad(`악마 수락이 ${calls}/${N}판 — «항상 수락» 정책 위반(조건부 수락이 남아 있다)`);
  /* noPerk(특전 미획득 측정)는 여전히 건너뛴다 — 실험5 사다리의 정본 */
  calls = 0;
  CTX.payDevilCost = p => { calls++; return real(p); };
  for (let i = 0; i < 10; i++) D.runChapter(1, build, { noPerk: true });
  CTX.payDevilCost = real;
  calls === 0
    ? ok('noPerk 측정(실험5 사다리)에서는 악마 거래를 건너뛴다 — 0회')
    : bad(`noPerk 측정에서 악마 거래가 ${calls}회 일어났다 — 특전 미획득 조건이 오염된다`);
}

console.log(`\n=== 악마·천사 이벤트 게이트: 통과 ${pass} · 실패 ${fail} ===`);
process.exit(fail ? 1 : 0);
