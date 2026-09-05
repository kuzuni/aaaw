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
    /* ⚑ T96 — 가드가 둘이 됐다: ①noPerk(특전 미획득 측정 제외분) ②줄 특전이 남아 있는가.
       ②는 «조건부 수락» 이 아니라 «거래 대상이 없으면 거래가 성립하지 않는다» 다(주인 위임 기본값).
       체력·자원을 보는 조건이 되살아나면 아래 두 검사가 잡는다. */
    /* ⚑ T102 — 「남았나」 기준이 PERKS.length(풀)에서 PERK_PICKS(한 런 획득 상한)로 바뀌었다.
       ⚑⚑⚑ T150 — 그 두 가드가 `devilPerkFor(G)` 안으로 옮겨 갔다(«내놓을 한 장이 있나» 한 물음으로 합쳐졌다).
       분기에 남는 조건은 «카드가 나왔나(dp)» 하나뿐이어야 한다 — 체력·자원 조건이 되살아나면 아래 두 검사가 잡는다. */
    /const\s+dp=devilPerkFor\(G\);/.test(body) && /if\(dp\)\{/.test(body)
      ? ok('수락 조건은 «devilPerkFor 가 한 장을 내놨나» 하나뿐 (체력 조건 없음)')
      : bad('«const dp=devilPerkFor(G); if(dp){» 형태가 아니다 — 조건부 수락이 되살아났는지 확인할 것');
    /pickPerk\(G,dp\)/.test(body)
      ? ok('악마도 레벨업과 같은 확정 동사(pickPerk)를 쓴다 — ⚑ T150 전설 1장')
      : bad('악마가 pickPerk 를 안 쓴다 — 지급 경로가 갈라졌는지 확인할 것');
    /grantNextPerk\(/.test(body)
      ? bad('⚑ T150 위반 — 악마가 폐기된 3택 지급 동사(grantNextPerk)로 되돌아갔다')
      : ok('폐기된 3택 지급 동사(grantNextPerk) 없음 (⚑ T150)');
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
    /payDevilCost\(G\.player\)|payDevilCost\(p\)/.test(b)
      ? ok('수락 시 payDevilCost 를 거친다 (sim.js 와 같은 동사)')
      : bad('수락 처리가 payDevilCost 를 안 쓴다');
    /* ⚑⚑⚑ T150 (주인 확정 2026-09-05 17:4X) — 악마가 주는 것이 «즉시 3택 1» → **«전설 특전 1개»** 가 됐다.
       ⓐ 제시 = offerDevilPerk(전설 1장) ⓑ 확정 = 공용 동사 pickPerk. 3택 동사(offerPerks)는 여기 있으면 안 된다.
       그리고 **굴림은 지불 «전» 한 번뿐**이어야 한다 — 수락 뒤 다시 굴리면
       PLAN §2.4 «지불하기 전에 카드로 먼저 보여줌» 이 거짓말이 된다. */
    const devilOfferN = (b.match(/offerDevilPerk\s*\(/g) || []).length;
    const offerN = (b.match(/offerPerks\s*\(/g) || []).length;
    (devilOfferN === 1 && offerN === 0 && /pickPerk\(perk\)/.test(b))
      ? ok('게임 악마 = 전설 1장 — 굴림은 지불 전 한 번(offerDevilPerk)뿐이고 확정은 공용 동사(pickPerk)다')
      : bad(`게임 악마가 «미리 보여준 전설 1장 그대로» 가 아니다 (offerDevilPerk ${devilOfferN}곳 · offerPerks ${offerN}곳 · pickPerk ${/pickPerk\(perk\)/.test(b)})`);
    (/perkPick/.test(b) || /perkCardHTML\([^)]*,\s*'pick'\)/.test(b))
      ? bad('⚑ T150 위반 — 악마 팝업에 고를 수 있는 카드(pick)가 있다. 악마는 1장 제시라 고르기가 없다')
      : ok('악마 팝업에 «고르는» 카드가 없다 — 3택 폐기 (⚑ T150)');
    /nextPerk\(\)|grantNextPerk\(\)/.test(b)
      ? bad('게임 악마에 폐기된 «다음 순번 앞당김»(nextPerk/grantNextPerk)이 남아 있다 — T150 으로 전설 1장이 됐다')
      : ok('폐기된 «다음 순번 앞당김» 잔재 없음 (⚑ T117 → T150)');
    /p\.hp\s*=\s*Math\.max\(\s*1\s*,\s*p\.hp\s*-\s*cost\s*\)/.test(b)
      ? bad('폐기된 «현재체력에서 cost 차감» 이 되살아났다 (주인 확정 위반)')
      : ok('현재체력 직접 차감 없음');
    /최대\s*체력의\s*30%\s*지불/.test(b)
      ? ok('버튼 문면 «최대 체력의 30% 지불» (PLAN §2.4)')
      : bad('악마 지불 버튼 문면이 PLAN §2.4 와 다르다');
    /최대\s*체력이\s*줄어든\s*채/.test(b)
      ? ok('«최대 체력이 줄어든 채 진행» 안내가 버튼에 있다 (주인 확정 문면)')
      : bad('최대치가 줄어든다는 안내가 버튼에 없다 — 플레이어가 현재체력 차감으로 오해한다');
    /* ⚑ T150 — 버튼 안내가 «3장 중 하나» 로 되돌아가면 화면이 규칙과 어긋난다 */
    /전설\s*특전\s*1개를\s*획득/.test(b)
      ? ok('버튼 안내 «위 전설 특전 1개를 획득» (⚑ T150)')
      : bad('악마 지불 버튼 안내가 «전설 특전 1개» 가 아니다');
    /장\s*중\s*하나/.test(b)
      ? bad('⚑ T150 위반 — 버튼 안내에 «N장 중 하나» 가 남아 있다 (3택 문면)')
      : ok('«N장 중 하나» 3택 문면 없음');
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

/* ---------- ⑨ ⚑⚑⚑ T150 — 악마 = «전설 특전 1개» (3택 폐기) 정적 단언 ----------
   주인 확정 2026-09-05 17:4X: «악마 거래는 전설 꺼 1개만 두고 hp 소모되면서 가져가는 거로 되야 되는데
   3개 특전 주네». 되돌아가기 쉬운 방향이 둘이라 둘 다 못 박는다:
     ⓐ 3택 동사(offerPerks)가 악마 경로로 돌아오는 것
     ⓑ «1장» 은 지키되 등급 제한(전설)이 풀려 아무 등급이나 나오는 것
   아래 술어들은 ⑪ 음성 검사가 돌연변이 소스에 그대로 다시 돌린다. */
const T150 = [
  ['sim.js 에 offerDevilPerk(taken) 가 있다 (전설 1장 제시 동사)',
    (s, h, p) => /function offerDevilPerk\(taken\)\{/.test(s)],
  ['index.html 에 offerDevilPerk(taken) 가 있다',
    (s, h, p) => /function offerDevilPerk\(taken\)\{/.test(h)],
  ['두 엔진 offerDevilPerk 본문이 글자까지 동일',
    (s, h, p) => {
      const rx = /function offerDevilPerk\(taken\)\{([\s\S]*?)\n\}/;
      const a = s.match(rx), b = h.match(rx);
      return !!(a && b && a[1].replace(/\s+/g, ' ').trim() === b[1].replace(/\s+/g, ' ').trim());
    }],
  ['악마 등급 상수 PERK_DEVIL_GRADE = 2 (전설) 두 엔진 동일',
    (s, h, p) => {
      const rx = /const\s+PERK_DEVIL_GRADE\s*=\s*(\d+)\s*;/;
      const a = s.match(rx), b = h.match(rx);
      return !!(a && b && a[1] === '2' && b[1] === '2');
    }],
  ['offerDevilPerk 가 «전설 등급만 · 아직 안 얻은 것만» 으로 후보를 거른다 (두 엔진)',
    (s, h, p) => [s, h].every(src => {
      const m = src.match(/function offerDevilPerk\(taken\)\{([\s\S]*?)\n\}/);
      if (!m) return false;
      const b = m[1].replace(/\s+/g, '');
      return /PERKS\.filter\(p=>p\.g===PERK_DEVIL_GRADE&&taken\.indexOf\(p\)<0\)/.test(b);
    })],
  ['offerDevilPerk 가 후보 중 **무작위 1장**을 준다 (3장 아님 · 표 첫 번째 아님)',
    (s, h, p) => [s, h].every(src => {
      const m = src.match(/function offerDevilPerk\(taken\)\{([\s\S]*?)\n\}/);
      if (!m) return false;
      const b = m[1].replace(/\s+/g, '');
      return /returnpool\[Math\.floor\(Math\.random\(\)\*pool\.length\)\];/.test(b) && !/PERK_OFFER/.test(b);
    })],
  ['남은 전설이 없으면 null 을 준다 (거래 불성립 · 비용 없음)',
    (s, h, p) => [s, h].every(src => {
      const m = src.match(/function offerDevilPerk\(taken\)\{([\s\S]*?)\n\}/);
      return !!m && /if\(!pool\.length\)returnnull;/.test(m[1].replace(/\s+/g, ''));
    })],
  ['sim.js 악마 분기가 devilPerkFor → payDevilCost → pickPerk 순이고 3택(offerPerks)이 없다',
    (s, h, p) => {
      const m = s.match(/\}else if\(n\.type==='devil'\)\{([\s\S]*?)\n\s*\}else\{/);
      if (!m) return false;
      const b = m[1];
      return /devilPerkFor\(G\)[\s\S]{0,200}payDevilCost\(p\)[\s\S]{0,200}pickPerk\(G,dp\)/.test(b)
        && !/offerPerks\(/.test(b) && !/grantNextPerk\(/.test(b);
    }],
  ['sim.js devilPerkFor 가 사다리 자(base10)에서는 난수를 안 쓴다 (T114 스트림 불변)',
    (s, h, p) => {
      const m = s.match(/function devilPerkFor\(G\)\{([\s\S]*?)\n\}/);
      if (!m) return false;
      const b = m[1].replace(/\s+/g, '');
      return /G\.perkMode===PERK_MODE_LADDER\)returnPERKS_BASE10\[G\.taken\.length\]\|\|null;/.test(b)
        && /if\(G\.noPerk\)returnnull;/.test(b) && /G\.taken\.length>=PERK_PICKS\)returnnull;/.test(b);
    }],
  ['index.html openDevil 이 offerDevilPerk 한 번만 굴리고 3택(offerPerks)을 안 쓴다',
    (s, h, p) => {
      const m = h.match(/function openDevil\(\)\{([\s\S]*?)\n\}/);
      if (!m) return false;
      const b = m[1];
      return (b.match(/offerDevilPerk\s*\(/g) || []).length === 1 && !/offerPerks\s*\(/.test(b);
    }],
  ['index.html 악마 팝업에 카드가 «고르기» 가 아니다 (static 1장 · perkPick 없음)',
    (s, h, p) => {
      const m = h.match(/function openDevil\(\)\{([\s\S]*?)\n\}/);
      if (!m) return false;
      const b = m[1];
      return !/perkPick/.test(b) && !/perkCardHTML\([^)]*,\s*'pick'\)/.test(b)
        && (b.match(/perkCardHTML\(perk,0,'static'\)/g) || []).length >= 1;
    }],
  ['PLAN §2.4 악마 줄이 «전설 특전 1개» 이고 «3택» 이 아니다',
    (s, h, p) => {
      const line = (p.match(/^.*\*\*악마 😈\*\*.*$/m) || [''])[0];
      return /주는\s*것\s*=\s*«전설\s*특전\s*1개»/.test(line) && !/즉시\s*3택\s*1»\*\*/.test(line);
    }],
  ['PLAN §3.0 «악마의 거래» 줄이 «전설 특전 1개» 다',
    (s, h, p) => /- \*\*악마의 거래 = «전설 특전 1개»\*\*/.test(p)],
];
console.log('\n[⑨] ⚑⚑⚑ T150 — 악마 = 전설 특전 1개 (3택 폐기)');
const t150run = (s, h, p) => T150.filter(t => { try { return !t[1](s, h, p); } catch (e) { return true; } }).length;
for (const [nm, fn] of T150) { let r = false; try { r = !!fn(SIMC, HTMLC, PLAN); } catch (e) { r = false; } r ? ok(nm) : bad(nm); }

/* ---------- ⑩ 실행 단언 — offerDevilPerk 가 실제로 «전설만 · 안 얻은 것만 · 1장» 을 준다 ---------- */
console.log('\n[⑩] 실행 단언 — offerDevilPerk 실측 (vm)');
if (CTX) {
  vm.runInContext(';globalThis.__D2={offerDevilPerk,devilPerkFor,PERKS,PERK_DEVIL_GRADE,PERK_PICKS,PERKS_BASE10,PERK_MODE_LADDER};', CTX);
  const D2 = CTX.__D2 || CTX.globalThis.__D2;
  const legend = D2.PERKS.filter(p => p.g === 2);
  legend.length > 0
    ? ok(`전설 특전 풀 ${legend.length}종 (악마가 뽑는 범위)`)
    : bad('전설 특전이 한 종도 없다 — 악마가 줄 것이 사라졌다');
  /* ⓐ 1000회 굴려 전부 전설이고 «이미 얻은 것» 은 절대 안 나온다 */
  {
    const taken = legend.slice(0, 3);         /* 전설 3종을 이미 얻은 상태 */
    const seen = new Set();
    let badG = 0, dup = 0;
    for (let i = 0; i < 1000; i++) {
      const q = D2.offerDevilPerk(taken);
      if (!q || q.g !== 2) badG++;
      else if (taken.indexOf(q) >= 0) dup++;
      else seen.add(q.id);
    }
    badG === 0 ? ok('1000회 전부 «전설»(g=2) 1장 — 일반·희귀가 섞이지 않는다')
               : bad(`1000회 중 ${badG}회가 전설이 아니거나 빈손 — 등급 제한이 풀렸다`);
    dup === 0 ? ok('이미 얻은 전설은 한 번도 안 나온다 (중복 금지)')
              : bad(`이미 얻은 전설이 ${dup}회 나왔다`);
    seen.size === legend.length - 3
      ? ok(`남은 전설 ${seen.size}종이 골고루 나온다 (표 첫 번째 고정이 아니다 — 무작위)`)
      : bad(`남은 전설 ${legend.length - 3}종 중 ${seen.size}종만 나왔다 — 무작위가 아니거나 후보가 좁다`);
  }
  /* ⓑ 전설을 다 얻으면 null (거래 불성립 · 비용 없음) */
  D2.offerDevilPerk(legend) === null
    ? ok('전설을 다 얻으면 null — 거래 불성립(비용도 안 낸다)')
    : bad('전설을 다 얻었는데도 카드가 나온다 — 거래 불성립 규칙이 깨졌다');
  /* ⓒ devilPerkFor 가드 — noPerk · 획득 상한 · 사다리 자 */
  D2.devilPerkFor({ noPerk: true, taken: [], perkMode: 0 }) === null
    ? ok('devilPerkFor: noPerk 측정(실험5 사다리)에서는 null')
    : bad('devilPerkFor 가 noPerk 측정에서도 카드를 준다');
  D2.devilPerkFor({ noPerk: false, taken: new Array(D2.PERK_PICKS).fill(legend[0]), perkMode: 0 }) === null
    ? ok(`devilPerkFor: 한 런 획득 상한(${D2.PERK_PICKS})을 채우면 null`)
    : bad('devilPerkFor 가 획득 상한을 넘어서도 카드를 준다');
  {
    const g = { noPerk: false, taken: [], perkMode: D2.PERK_MODE_LADDER };
    D2.devilPerkFor(g) === D2.PERKS_BASE10[0]
      ? ok('devilPerkFor: 사다리 자(base10)에서는 난수 없이 다음 순번을 준다 (T114 스트림 불변)')
      : bad('사다리 자에서 base10 다음 순번이 아니다 — 측정 스트림이 오염된다');
  }
}

/* ---------- ⑪ 음성 — T150 을 되돌리면 ⑨ 가 빨개진다 ---------- */
console.log('\n[⑪] 음성 검사 — 3택 복귀·등급 제한 해제를 잡는가');
{
  const cases = [
    ['악마가 3택(offerPerks)으로 되돌아가면 (게임)',
      null, h => h.replace("const perk=offerDevilPerk(G.perksTaken);", "const perk=offerPerks(G.perksTaken,false)[0];"), null],
    ['악마 카드를 다시 고르게 만들면 (perkPick)',
      null, h => h.replace("${perkCardHTML(perk,0,'static')}\n      <div class=\"ov-foot\">", "${perkCardHTML(perk,0,'pick')}\n      <div class=\"ov-foot\">"), null],
    ['offerDevilPerk 의 등급 제한을 풀면 (아무 등급이나 1장)',
      s => s.replace('PERKS.filter(p=>p.g===PERK_DEVIL_GRADE&&taken.indexOf(p)<0)', 'PERKS.filter(p=>taken.indexOf(p)<0)'), null, null],
    ['악마 등급을 전설이 아닌 것으로 바꾸면',
      s => s.replace('const PERK_DEVIL_GRADE=2;', 'const PERK_DEVIL_GRADE=1;'), null, null],
    ['offerDevilPerk 가 무작위 대신 표 첫 번째를 주면',
      s => s.replace('return pool[Math.floor(Math.random()*pool.length)];', 'return pool[0];'), null, null],
    ['남은 전설이 없어도 거래가 성립하면 (null 반환 삭제)',
      s => s.replace('  if(!pool.length)return null;\n', ''), null, null],
    ['sim.js 악마가 3택 지급 동사(grantNextPerk)로 되돌아가면',
      s => s.replace('const dp=devilPerkFor(G);', 'const dp=null; grantNextPerk(G);'), null, null],
    ['사다리 자에서도 난수를 굴리게 하면 (T114 스트림 오염)',
      s => s.replace('  if(G.perkMode===PERK_MODE_LADDER)return PERKS_BASE10[G.taken.length]||null;\n', ''), null, null],
    ['두 엔진 offerDevilPerk 본문이 갈라지면',
      null, h => h.replace('const pool=PERKS.filter(p=>p.g===PERK_DEVIL_GRADE&&taken.indexOf(p)<0);',
                           'const pool=PERKS.filter(p=>p.g===PERK_DEVIL_GRADE&&taken.indexOf(p)<0).slice(0,3);'), null],
    ['PLAN §3.0 을 «즉시 3택 1» 로 되돌리면',
      null, null, p => p.replace('- **악마의 거래 = «전설 특전 1개»**', '- **악마의 거래 = «즉시 3택 1»**')],
    ['PLAN §2.4 악마 줄을 3택으로 되돌리면',
      null, null, p => p.replace('**⚑⚑⚑ 주는 것 = «전설 특전 1개»**', '**⚑⚑⚑ 주는 것 = «즉시 3택 1»**')],
  ];
  let caught = 0;
  for (const [nm, fs_, fh, fp] of cases) {
    const mS = fs_ ? fs_(SIMC) : SIMC, mH = fh ? fh(HTMLC) : HTMLC, mP = fp ? fp(PLAN) : PLAN;
    /* 돌연변이 문자열이 사라지면 replace 가 no-op 이 되어 «음성이 조용히 죽는다» — 그 자리에서 떨어뜨린다 */
    const noop = (fs_ && mS === SIMC) || (fh && mH === HTMLC) || (fp && mP === PLAN);
    if (noop) { bad(`음성 «${nm}» 이 no-op 이다 — 돌연변이 대상 문자열이 소스에서 사라졌다`); continue; }
    t150run(mS, mH, mP) > 0 ? (caught++, ok(`음성 «${nm}» → 빨강 ✓`)) : bad(`음성 «${nm}» 을 못 잡는다`);
  }
  console.log(`  · 음성 ${caught}/${cases.length} 검출`);
}

console.log(`\n=== 악마·천사 이벤트 게이트: 통과 ${pass} · 실패 ${fail} ===`);
process.exit(fail ? 1 : 0);
