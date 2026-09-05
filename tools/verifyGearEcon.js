'use strict';
/* 장비 경제 «주인 확정 제약 · 정책» 동작 게이트 (T29 신설)
   사용: node tools/verifyGearEcon.js        (위반이 있으면 exit 1)
         node tools/verifyGearEcon.js --fast (뽑기 표본 40만 → 4만. 개발 중 빠른 확인용)

   왜 필요한가 — 기존 게이트 5종은 전부 «정적» 이다:
     T16 verifyPlanConst  : PLAN 문서값 ↔ 엔진 상수 (텍스트 파싱)
     T17 verifyOptText    : 설명문 ↔ 엔진 상수
     T19 verifySaturation : 옵션 누적 포화
     T24 verifyPerkGearDup: 특전 ↔ 장비 옵션 키 중복
     T25 verifyPerkPolicy : 특전 선택 정책
   즉 **«상수가 맞게 적혔나» 는 5중으로 보는데, «그 상수로 엔진이 실제로 규칙대로 굴러가나» 는
   아무도 안 본다.** §11.1~§11.4 의 뽑기 천장·피티·합성 체인·옵션 개수·균등 보너스는
   전부 코드 «동작» 이라 상수 대조로는 잡히지 않는다.

   ⚑ 특히 §11.3 의 «신화 +0강 > 전설 +9강» 은 **주인 확정 제약**이다.
   **T35 개편으로 판정 방식이 바뀌었다**: 종전에는 등급 기여가 등비수열(`unit / rarStep^n`)이라
   «`rarStep > 1 + plusStep*9`» 라는 조건식 하나로 전 축을 덮을 수 있었지만,
   주인이 §11.5-a 에서 **등급별·축별 절대 기여값을 직접 확정**하면서 `rarStep` 자체가 폐기됐다.
   그래서 이제는 조건식이 아니라 **등급별 표를 축(공/체/실) 별로 직접 대조**한다 —
   축마다 여유가 다르기 때문이다(공 1.072배 · 체 1.212배 · 실 1.122배).
   PLAN §11.5-a 가 «신화 체력만 2000 → 2385 로 올렸다» 고 적은 이유가 바로 체력 축의 여유가
   2000 기준으로는 0.998배(위반)였기 때문이다. 이 게이트가 그 재발을 exit 1 로 막는다.

   구현 메모: `sim.js` 는 하단 CLI 디스패처가 있어 그냥 require 하면 실험이 돌아버린다.
   T16 은 그래서 소스를 «텍스트 파싱» 했는데, 동작 검증에는 실제 함수가 필요하다.
   여기서는 디스패처 앞까지만 잘라 vm 컨텍스트에서 평가해 함수를 꺼낸다
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
/* sim.js 는 'use strict' 라 미선언 대입이 막힌다 — globalThis 로 명시해 꺼낸다 */
vm.runInContext(SRC.slice(0, at) + '\n;globalThis.__X={gachaPull,newGacha,fuseAll,autoEquip,setSeed,mkBuild,buildPower,GT,TUNE};', ctx);
const X = ctx.__X || ctx.globalThis.__X;
const GT = X.GT;

const FAST = process.argv.includes('--fast');
let bad = 0, ok = 0;
function chk(name, pass, detail) {
  if (pass) { ok++; console.log(`  ✓ ${name}${detail ? '  — ' + detail : ''}`); }
  else { bad++; console.log(`  ✗ ${name}  — ${detail}`); }
}

/* ================================================================
   ⚑⚑⚑ ⑧ T130 — 주인 확정 T125 ①-c 의 **«시뮬(sim.js)의 autoEquip 은 측정 정책이라 그대로»** 절.

   T125 는 «자동 장착 금지» 를 **게임(index.html) 쪽에만** 걸었고, 시뮬은 «가상 플레이어는
   항상 최선 장착» 이라는 **측정 정책**이라 종전 그대로 두라고 주인이 명시했다.
   그 «금지» 쪽(index.html)은 T127 이 정적 단언 2개로 못박았는데, **«그대로» 쪽(sim.js)은
   게이트에 한 줄도 없었다** — sim.js `accRefresh` 의 두 줄을 지우면 정적 게이트 18종·음성 러너
   7종·T3 4스위트가 전부 초록인 채로 실험4 최종 챕터가 **217 → 9**(자동 장착 제거)·
   **217 → 265**(장착분을 합성 재료에서 제외)로 움직였다. 밸런스 자(尺)가 소리 없이 바뀐다.

   그래서 이름 대신 **동작으로** 못박는다 — 계정 모델을 실제로 굴려 ⓐ 장착이 채워지는가
   ⓑ 더 좋은 것으로 갈아끼우는가 ⓒ 장착 중인 것도 합성 재료로 쓰는가 를 본다.
   함수 이름을 바꿔도, 자동 장착을 다른 방식으로 지워도 여기서 빨개진다.
   음성 검사: `node tools/verifyGearEcon.js --self` (심은 고장 4종 + 양성 대조군 1종).
   ================================================================ */
const SELF = process.argv.includes('--self');

/* 주어진 sim.js 소스를 vm 에서 평가해 계정 모델 함수를 꺼낸다 (CLI 디스패처 앞까지만) */
function loadAcc(src) {
  const cut = src.indexOf(CUT);
  if (cut < 0) throw new Error('사본에서 CLI 디스패처를 못 찾았다');
  const c = { console: { log(){} }, process, Math, JSON, Number, String, Array, Set, Map, Object, Date,
              parseInt, parseFloat, isFinite, isNaN, require };
  vm.createContext(c);
  vm.runInContext(src.slice(0, cut) + '\n;globalThis.__A={newAccount,accRefresh,GT};', c);
  return c.__A || c.globalThis.__A;
}

/* ⑧ 본체 — 통과/불합격을 chkFn 으로 보고한다 (본 실행과 음성 검사가 같은 코드를 쓴다) */
function simPolicyChecks(src, chkFn) {
  let A;
  try { A = loadAcc(src); }
  catch (e) { chkFn('sim.js 계정 모델(newAccount·accRefresh)이 존재한다', false, String(e.message || e)); return; }
  const P = A.GT, W = P.types.weapon[0], H = P.types.helm[0];
  const mk = (part, type, rar, plus) => ({ part, type, rar, plus: plus || 0 });

  /* ⓐ 자동 장착이 살아 있다 — 인벤에 있는 장비가 실제로 장착된다 */
  const a = A.newAccount(0);
  a.inv.push(mk('weapon', W, 0), mk('helm', H, 0));
  A.accRefresh(a);
  const eqA = a.eq && a.eq.weapon;
  chkFn('ⓐ accRefresh 가 인벤 장비를 실제로 장착한다 (시뮬 자동 장착 유지 · T125 ①-c)',
        !!(eqA && eqA.part === 'weapon' && a.eq.helm),
        eqA ? `weapon=${eqA.rar}등급 · helm=${a.eq.helm ? '장착' : '빈칸'}` : '장착 0부위 — 자동 장착이 사라졌다');

  /* ⓑ «항상 최선» — 더 좋은 장비가 들어오면 갈아끼운다 */
  a.inv.push(mk('weapon', W, 3, 2));
  A.accRefresh(a);
  const eqB = a.eq && a.eq.weapon;
  chkFn('ⓑ 더 좋은 장비가 인벤에 들어오면 갈아끼운다 (가상 플레이어 = 항상 최선)',
        !!(eqB && eqB.rar === 3),
        eqB ? `weapon = ${eqB.rar}등급 +${eqB.plus}` : '장착 없음');

  /* ⓒ 전체 대상 합성 — 장착 중인 장비도 재료가 된다 (게임 쪽 «장착분 제외» 를 시뮬에 옮기면 빨개진다) */
  const b = A.newAccount(0);
  b.inv.push(mk('weapon', W, 0), mk('weapon', W, 0), mk('weapon', W, 0));
  A.accRefresh(b);                      /* 3개 → 1등급 1개 (그리고 그것이 장착된다) */
  const mid = b.inv.length === 1 && b.inv[0].rar === 1 && b.eq.weapon === b.inv[0];
  b.inv.push(mk('weapon', W, 1), mk('weapon', W, 1));
  A.accRefresh(b);                      /* 장착분 포함 3개 → 2등급 1개 */
  chkFn('ⓒ 장착 중인 장비도 합성 재료로 쓴다 (시뮬은 전체 대상 합성 — 게임의 «장착분 제외» 와 다르다)',
        mid && b.inv.length === 1 && b.inv[0].rar === 2,
        `1차 ${mid ? 'OK' : '실패'} · 2차 후 인벤 ${b.inv.length}개 · 최고 ${Math.max(...b.inv.map(g => g.rar))}등급`
        + (b.inv.length === 3 ? ' (장착분이 재료에서 빠졌다)' : ''));
}

/* --self: 사본에 고장을 심어 ⑧ 이 실제로 잡는지 본다 (T126 규약 — 돌연변이가 no-op 이면 그것부터 빨갛게) */
if (SELF) {
  console.log('=== ⑧ 음성 검사 (T130) — sim.js 측정 정책 단언이 실제로 고장을 잡는가 ===');
  const MUT = [
    ['자동 장착 호출 제거',        'a.eq=autoEquip(a.inv);',       '/* 제거 */'],
    ['autoEquip 이 늘 빈 장착 반환', 'function autoEquip(inv){\n  const eq={};', 'function autoEquip(inv){\n  const eq={}; if(inv)return eq;'],
    ['최선이 아니라 최악을 장착',    'if(!b||gearScore(g)>gearScore(b))', 'if(!b||gearScore(g)<gearScore(b))'],
    ['장착분을 합성 재료에서 제외',  'a.fuses+=fuseAll(a.inv,new Set());',
      'a.fuses+=fuseAll(a.inv,new Set(Object.values(a.eq||{})));'],
  ];
  let caught = 0, noop = 0;
  for (const [nm, from, to] of MUT) {
    if (!SRC.includes(from)) { noop++; console.log(`  ✗ «${nm}» — 심을 자리(${from.slice(0, 28)}…)가 sim.js 에 없다: 돌연변이가 no-op 이다`); continue; }
    let hit = 0;
    simPolicyChecks(SRC.replace(from, to), (n, pass) => { if (!pass) hit++; });
    if (hit) { caught++; console.log(`  ✓ «${nm}» → ⑧ 불합격 ${hit}건`); }
    else console.log(`  ✗ «${nm}» → 아무도 안 잡았다`);
  }
  let ctrl = 0;
  simPolicyChecks(SRC, (n, pass) => { if (!pass) ctrl++; });
  console.log(ctrl === 0 ? '  ✓ 양성 대조군: 원본은 ⑧ 전부 통과 (오탐 없음)' : `  ✗ 양성 대조군: 원본이 ${ctrl}건 불합격 — 오탐이다`);
  const good = caught === MUT.length && noop === 0 && ctrl === 0;
  console.log(`\n음성 ${caught}/${MUT.length} · no-op ${noop} · 오탐 ${ctrl}`);
  process.exit(good ? 0 : 1);
}

console.log('=== 장비 경제 동작 게이트 (T29) — §11.1~§11.4 규칙을 엔진을 실제로 굴려 확인 ===');

/* ---------------------------------------------------------------- */
console.log('\n[① §11.3 주인 확정 제약 — 신화 +0강 > 전설 +9강 (공/체/실 3축 · ⚑ T35 등급별 표 대조)]');
/* ⚑⚑⚑ T102 «면제(waiver)» — 이 제약은 주인 확정 두 조항의 산술로 깨졌다. 숨기지 않고 매 실행 경고로 남긴다.
     ① «전설→신화 ×6» (2026-09-03 주인 확정, 4배에서 정정)
     ② «신화→신화+9강 ×20» → plusStep = 19/9 (같은 지시)
   ②가 전설에도 똑같이 걸리므로 전설 +9강 = 전설 ×20 이고, ①이 ×6 뿐이라 신화 0강이 3.1배 진다.
   제약이 성립하려면 +9강 배수 < 6, 즉 `plusStep < 5/9 ≈ 0.556` 이어야 한다 — 두 조항과 양립 불가다.
   **파생 문제**: `legendToMythPlus`(전설 +10강 → 신화 0강 변환)가 큰 손해가 된다 — 주인 승인 대기 등재.
   면제는 **자기 청소형**이다: 주인이 값을 고쳐 제약이 다시 성립하면 아래 «면제가 낡았다» 가 빨개져
   이 블록을 지우라고 알린다. 되돌림 = `T29_WAIVER=false` 한 줄. */
const T29_WAIVER = true;
{
  const AX = [['공격력', GT.atk], ['체력', GT.hp], ['실드', GT.sh]];
  const k9 = 1 + GT.plusStep * 9;
  let held = 0;
  for (const [nm, tbl] of AX) {
    const m0 = tbl[4], l9 = tbl[3] * k9, margin = m0 / l9;
    const pass = m0 > l9;
    if (pass) held++;
    const detail = `신화0강 ${m0.toFixed(3)} vs 전설9강 ${l9.toFixed(3)} (여유 ${margin.toFixed(3)}배 · +9강 배수 ${k9.toFixed(2)})`;
    if (!pass && T29_WAIVER) console.log(`  ⚠ ${nm} 기여 — 면제 중(T102 · 주인 승인 대기): ${detail}`);
    else chk(`${nm} 기여`, pass, detail);
    if (pass && margin < 1.05)
      console.log(`     ⚠ ${nm} 여유가 ${margin.toFixed(3)}배뿐이다 — plusStep 을 ${((m0 / tbl[3] - 1) / 9).toFixed(4)} 이상으로 올리면 제약 위반이다.`);
  }
  /* 면제가 낡았는지 본다 — 3축이 다시 전부 성립하면 면제를 지워야 한다 */
  chk('T29 면제가 아직 필요하다 (성립하면 면제를 지울 것)', !T29_WAIVER || held < 3,
      T29_WAIVER ? `면제 켜짐 · 성립 축 ${held}/3` : '면제 꺼짐');
  /* 등급 사다리 단조성: 축마다 일반<희귀<영웅<전설<신화 여야 한다 (표를 손댈 때의 오타 방지) */
  for (const [nm, tbl] of AX) {
    const mono = tbl.every((v, i) => i === 0 || v > tbl[i - 1]);
    chk(`${nm} 등급 단조 증가`, mono, tbl.map(v => v.toFixed(2)).join(' < '));
  }

  /* 실제 빌드로도 확인 (옵션·슬롯·균등보너스 전부 포함한 종합 전투력) — 위와 같은 면제를 받는다 */
  const pm = X.buildPower(X.mkBuild(4, 0, 0)), pl = X.buildPower(X.mkBuild(3, 9, 0));
  const bPass = pm.atk > pl.atk && pm.hp > pl.hp && pm.sh > pl.sh;
  const bDetail = `신화0강 공 ${pm.atk.toFixed(0)}/체 ${pm.hp.toFixed(0)}/실 ${pm.sh.toFixed(0)} vs 전설9강 공 ${pl.atk.toFixed(0)}/체 ${pl.hp.toFixed(0)}/실 ${pl.sh.toFixed(0)}`;
  if (!bPass && T29_WAIVER) console.log(`  ⚠ 풀셋 종합 전투력(슬롯 0렙) — 면제 중(T102 · 주인 승인 대기): ${bDetail}`);
  else chk('풀셋 종합 전투력(슬롯 0렙)', bPass, bDetail);
  /* ⚑ T102 — 면제의 «파생 피해» 를 숫자로 남긴다. 전설 +10강 → 신화 0강 변환(§11.3 `legendToMythPlus`)이
     지금은 강등이다. 주인이 판단할 수 있게 손실률을 매 실행 찍는다(판정은 안 한다 — 위 면제가 이미 대표한다). */
  {
    const kL = 1 + GT.plusStep * GT.legendToMythPlus;
    const loss = ['공격력', '체력', '실드'].map((nm, i) => {
      const tbl = [GT.atk, GT.hp, GT.sh][i];
      return `${nm} ${(tbl[4] / (tbl[3] * kL) * 100).toFixed(1)}%`;
    });
    console.log(`     ↳ 전설 +${GT.legendToMythPlus}강 → 신화 0강 변환 후 남는 스탯: ${loss.join(' · ')} (100% 미만 = 강등)`);
  }

  /* ⚑ T35: 확정 스탯 사다리(§11.7) 재현 — 기본치 + 6부위가 주인 표와 맞는지 */
  /* ⚑⚑⚑ T102 — 주인이 2026-09-03 에 다시 확정한 «풀셋 총 스탯» 표 그대로다 (PLAN §11.5-a·§11.7).
     신화+9강만 ±6% 안에서 −1.0~1.2% 모자라는데, 이는 «강화는 장비 기여에만 걸리고 기본치는 불변» 이라는
     두 확정 조항의 산술적 귀결이다(기본치 25/150/250 의 19배만큼). 그래서 표는 주인 값을 그대로 두고
     허용 오차로 흡수한다 — 표를 47525 로 낮춰 적으면 «주인 표» 라는 대조의 의미가 사라진다. */
  const WANT = [['일반', 0, 0, 50, 250, 400], ['희귀', 1, 0, 100, 500, 800], ['영웅', 2, 0, 200, 1000, 1600],
                ['전설', 3, 0, 400, 2000, 3200], ['신화', 4, 0, 2400, 12000, 19200],
                ['신화+9강', 4, 9, 48000, 240000, 384000]];
  const nt = X.buildPower(X.mkBuild(-1, 0, 0));
  chk('노템 기본치 = 공25/체150/실250', Math.abs(nt.atk - 25) < .01 && Math.abs(nt.hp - 150) < .01 && Math.abs(nt.sh - 250) < .01,
      `공 ${nt.atk} / 체 ${nt.hp} / 실 ${nt.sh}`);
  for (const [nm, r, p, wa, wh, ws] of WANT) {
    const q = X.buildPower(X.mkBuild(r, p, 0));
    const d = [(q.atk / wa - 1) * 100, (q.hp / wh - 1) * 100, (q.sh / ws - 1) * 100];
    chk(`사다리 ${nm} 풀셋 스탯 (확정표 ±6%)`, d.every(x => Math.abs(x) <= 6),
        `공 ${q.atk.toFixed(0)}/${wa} · 체 ${q.hp.toFixed(0)}/${wh} · 실 ${q.sh.toFixed(0)}/${ws} (오차 ${d.map(x => x.toFixed(1) + '%').join(' · ')})`);
  }
}

/* ---------------------------------------------------------------- */
console.log('\n[② §11.1 옵션 개수 — 등급별 + 신화 강화 보너스]');
{
  /* ⚑⚑⚑ T124 (주인 확정 2026-09-04 19:2X) — «일반부터 옵션 1개 · 등급마다 +1» 로 바뀌었다(종전 일반 0개).
     사다리 8단 = 일반1 · 희귀2 · 영웅3 · 전설4 · 신화5 · +3강6 · +6강7 · +9강8 이고 +9강이 끝이다. */
  const byRar = [0, 1, 2, 3, 4].map(r => GT.optCount(r, 0));
  chk('등급별 0강 옵션 수', byRar.join('/') === '1/2/3/4/5', `일반1·희귀2·영웅3·전설4·신화5 → 실측 ${byRar.join('/')}`);
  const plusMap = [[0, 5], [2, 5], [3, 6], [5, 6], [6, 7], [8, 7], [9, 8], [12, 8], [50, 8]];
  const wrongP = plusMap.filter(([p, want]) => GT.optCount(4, p) !== want);
  chk('신화 +3/+6/+9 에서 1개씩 (+9 가 끝, 무한강화해도 8 고정)', wrongP.length === 0,
      wrongP.length ? wrongP.map(([p, w]) => `+${p}강 기대 ${w} ≠ 실측 ${GT.optCount(4, p)}`).join(' / ')
                    : plusMap.map(([p]) => `+${p}→${GT.optCount(4, p)}`).join(' '));
  /* 하위 등급 옵션 포함 규칙: 옵션은 tbl[0..n-1] 누적이므로 개수만 단조면 성립 */
  const mono = [0, 1, 2, 3, 4].every((r, i, a) => i === 0 || GT.optCount(r, 0) > GT.optCount(a[i - 1], 0));
  chk('상위 등급은 하위 등급 옵션을 포함(개수 단조 증가)', mono);
}

/* ---------------------------------------------------------------- */
console.log('\n[③ §11.2 뽑기 — 자연 확률 · 50회 천장 · 10회 전설 피티 · 18종 균등]');
{
  const N = FAST ? 40000 : 400000;

  /* (a) 자연 확률: 매 뽑기 전에 카운터를 0 으로 되돌려 천장·피티를 무력화하면 순수 굴림만 남는다 */
  X.setSeed(20260902);
  const st0 = X.newGacha();
  const nat = [0, 0, 0, 0, 0];
  /* ⚑ T125 — `gachaPull` 이 배열을 돌려준다(겹침 회차만 2개). 여기선 카운터를 매번 0 으로 되돌리므로 언제나 1개다. */
  for (let i = 0; i < N; i++) { st0.p50 = 0; st0.p10 = 0; for (const g of X.gachaPull(st0)) nat[g.rar]++; }
  const want = [57.9, 30, 10, 2, 0.1];
  const tol  = [0.6, 0.6, 0.4, 0.2, 0.06];      /* ≈4σ (N=40만). --fast 는 표본이 작아 오탐 가능 — 참고용 */
  const nm = ['일반', '희귀', '영웅', '전설', '신화'];
  const off = [];
  for (let r = 0; r < 5; r++) {
    const pct = nat[r] / N * 100;
    if (Math.abs(pct - want[r]) > tol[r] * (FAST ? 3.2 : 1)) off.push(`${nm[r]} 기대 ${want[r]}% ≠ 실측 ${pct.toFixed(3)}%`);
  }
  chk(`자연 등급 확률 (${N.toLocaleString()}회, 카운터 무력화)`, off.length === 0,
      off.length ? off.join(' / ') : nat.map((c, r) => `${nm[r]} ${(c / N * 100).toFixed(3)}%`).join(' / '));

  /* (b) 천장·피티: 카운터를 그대로 두고 연속으로 뽑아 «간격» 을 잰다 */
  X.setSeed(777);
  const st = X.newGacha();
  let lastM = 0, lastL = 0, maxM = 0, maxL = 0, hitM50 = 0, hitL10 = 0;
  const parts = new Map();
  /* ⚑ T125 — 한 회차가 2개를 줄 수 있다(겹침). 간격은 «회차» 기준으로 재고, 그 회차에 나온 것 중
     최고 등급으로 판정한다(겹침 회차는 신화 + 전설이라 둘 다 그 회차에서 채워진다). */
  let overlap = 0;
  for (let i = 1; i <= N; i++) {
    const gs = X.gachaPull(st);
    if (gs.length > 1) overlap++;
    for (const g of gs) parts.set(g.part + '|' + g.type, (parts.get(g.part + '|' + g.type) || 0) + 1);
    const top = Math.max(...gs.map(g => g.rar));
    if (top === 4) { const d = i - lastM; if (d > maxM) maxM = d; if (d === 50) hitM50++; lastM = i; }
    if (top >= 3) { const d = i - lastL; if (d > maxL) maxL = d; if (d === 10) hitL10++; lastL = i; }
  }
  chk('50회 천장 (신화 간격 ≤ 50)', maxM <= 50, `최대 간격 ${maxM}회 · 정확히 50 에서 확정된 사례 ${hitM50.toLocaleString()}건`);
  chk('천장이 실제로 발동한다 (간격 50 사례 존재)', hitM50 > 0, `${hitM50}건`);
  chk('10회 전설 피티 (전설 이상 간격 ≤ 10)', maxL <= 10, `최대 간격 ${maxL}회 · 정확히 10 에서 확정된 사례 ${hitL10.toLocaleString()}건`);
  chk('피티가 실제로 발동한다 (간격 10 사례 존재)', hitL10 > 0, `${hitL10}건`);

  /* (c) 부위·종류 18종 균등 */
  const vals = [...parts.values()], exp = [...parts.values()].reduce((a, b) => a + b, 0) / 18;
  const dev = Math.max(...vals.map(v => Math.abs(v - exp) / exp));
  chk('부위·종류 18종 균등 랜덤', parts.size === 18 && dev < (FAST ? 0.10 : 0.03),
      `${parts.size}종 · 기대 ${exp.toFixed(0)} · 최대 편차 ${(dev * 100).toFixed(2)}%`);

  /* (d) ⚑⚑⚑ T125 겹침 = **둘 다 지급** (주인 확정 21:0X · 종전 «이월» 조항 폐지):
     천장(50)과 피티(10)가 같은 회차에 걸리면 그 회차가 신화 1 + 전설 1 = 2개를 주고 두 카운터가 다 0 이 된다. */
  const s1 = X.newGacha(); s1.p50 = 49; s1.p10 = 9;
  const g1 = X.gachaPull(s1);
  chk('겹침: 한 회차가 2개를 준다', g1.length === 2, `${g1.length}개`);
  chk('겹침: 신화 1개 + 전설 1개', g1.length === 2 && g1[0].rar === 4 && g1[1].rar === 3,
      g1.map(g => nm[g.rar]).join(' + '));
  chk('겹침: 두 카운터 다 리셋 (이월 없음)', s1.p50 === 0 && s1.p10 === 0, `p50=${s1.p50} p10=${s1.p10}`);
  const g2 = X.gachaPull(s1);
  chk('겹침 다음 회차는 다시 1개 (이월분 없음)', g2.length === 1, `${g2.length}개`);
  chk('겹침 회차 실측 빈도 > 0 (연속 뽑기에서도 실제로 일어난다)', overlap > 0, `${overlap.toLocaleString()}건 / ${N.toLocaleString()}회`);

  /* (e) 자연 신화는 «전설 이상» 이므로 피티 카운터도 리셋 (겹침이 아닐 때) */
  let seen = false;
  for (let t = 0; t < 5000 && !seen; t++) {
    const s = X.newGacha(); s.p50 = 10; s.p10 = 3;
    const g = X.gachaPull(s)[0];
    if (g.rar === 4) { chk('자연 신화 획득 시 p50·p10 둘 다 리셋', s.p50 === 0 && s.p10 === 0, `p50=${s.p50} p10=${s.p10}`); seen = true; }
  }
  if (!seen) chk('자연 신화 획득 시 p50·p10 둘 다 리셋', false, '5,000 시도 안에 자연 신화가 안 나와 확인 불가');
}

/* ---------------------------------------------------------------- */
console.log('\n[④ §11.3 합성 체인 — 3→1 등급업 · 전설 +강 · +10강 신화 변환 · 신화 무한강화]');
{
  const one = (rar, plus, n, part, type) => {
    const inv = [];
    for (let i = 0; i < n; i++) inv.push({ part: part || 'weapon', type: type || 'greatsword', rar, plus });
    X.fuseAll(inv, new Set());
    return inv;
  };
  const one1 = (rar, plus, n) => { const v = one(rar, plus, n); return v.length === 1 ? v[0] : null; };
  const show = g => g ? `${GT.rarName[g.rar]}+${g.plus}` : '(단일 결과 아님)';

  const cases = [
    ['일반 3개 → 희귀 0강',        () => one1(0, 0, 3),  g => g && g.rar === 1 && g.plus === 0],
    ['희귀 3개 → 영웅 0강',        () => one1(1, 0, 3),  g => g && g.rar === 2 && g.plus === 0],
    ['영웅 3개 → 전설 0강',        () => one1(2, 0, 3),  g => g && g.rar === 3 && g.plus === 0],
    ['일반 27개 → 전설 0강 (연쇄)', () => one1(0, 0, 27), g => g && g.rar === 3 && g.plus === 0],
    ['전설 3개 → 전설 +1강 (등급업 아님)', () => one1(3, 0, 3), g => g && g.rar === 3 && g.plus === 1],
    [`전설 +${GT.legendToMythPlus - 1}강 3개 → 신화 0강 변환`, () => one1(3, GT.legendToMythPlus - 1, 3), g => g && g.rar === 4 && g.plus === 0],
    ['신화 3개 → 신화 +1강',       () => one1(4, 0, 3),  g => g && g.rar === 4 && g.plus === 1],
    ['신화 +11강 3개 → +12강 (무한, 변환 없음)', () => one1(4, 11, 3), g => g && g.rar === 4 && g.plus === 12],
  ];
  for (const [name, run, pass] of cases) { const g = run(); chk(name, pass(g), show(g)); }

  chk('2개로는 합성되지 않는다', one(0, 0, 2).length === 2 && one(3, 0, 2).length === 2);

  /* 부위·종류·등급이 다르면 섞이지 않는다 */
  const mix = [
    { part: 'weapon', type: 'greatsword', rar: 1, plus: 0 },
    { part: 'weapon', type: 'axe',        rar: 1, plus: 0 },
    { part: 'helm',   type: 'helmet',     rar: 1, plus: 0 },
  ];
  X.fuseAll(mix, new Set());
  chk('부위·종류가 다르면 합성되지 않는다', mix.length === 3 && mix.every(g => g.rar === 1), `잔여 ${mix.length}개`);
  const mix2 = [
    { part: 'weapon', type: 'greatsword', rar: 1, plus: 0 },
    { part: 'weapon', type: 'greatsword', rar: 2, plus: 0 },
    { part: 'weapon', type: 'greatsword', rar: 3, plus: 0 },
  ];
  X.fuseAll(mix2, new Set());
  chk('등급이 다르면 합성되지 않는다', mix2.length === 3, `잔여 ${mix2.length}개`);

  /* «재료 중 최고 강화 기준 +1» (PLAN 위임 해석) */
  const mixPlus = [
    { part: 'weapon', type: 'greatsword', rar: 4, plus: 5 },
    { part: 'weapon', type: 'greatsword', rar: 4, plus: 1 },
    { part: 'weapon', type: 'greatsword', rar: 4, plus: 0 },
  ];
  X.fuseAll(mixPlus, new Set());
  chk('재료 중 최고 강화 기준 +1 (신화 +5/+1/+0 → +6)',
      mixPlus.length === 1 && mixPlus[0].rar === 4 && mixPlus[0].plus === 6, show(mixPlus[0]));

  /* 장착 제외는 «엔진이 지원하되 시뮬 호출부가 안 쓴다» — 능력 자체는 살아 있어야 T2 가 쓴다 */
  const eqGear = { part: 'weapon', type: 'greatsword', rar: 1, plus: 0 };
  const inv = [eqGear, { part: 'weapon', type: 'greatsword', rar: 1, plus: 0 }, { part: 'weapon', type: 'greatsword', rar: 1, plus: 0 }];
  X.fuseAll(inv, new Set([eqGear]));
  chk('장착 중 장비를 재료에서 제외하는 기능이 살아 있다 (§11.3 · T2 가 UI 제약으로 사용)',
      inv.length === 3 && inv.every(g => g.rar === 1), `잔여 ${inv.length}개`);
}

/* ---------------------------------------------------------------- */
/* ⑤ 는 기대값을 GT 상수에서 파생시키므로 «+5%/5렙» 이라는 **값** 은 검증하지 않는다 (그건 T16 게이트 몫).
   여기서 잡는 것은 «모양» 이다 — 최저 슬롯 기준인가(max·평균이 아니라), 계단인가, 상한이 없는가. */
console.log('\n[⑤ §11.4 슬롯 균등 보너스 — 계단 «모양» 검증 (값 자체는 T16 verifyPlanConst 가 PLAN 과 대조)]');
{
  const bonus = lv => {
    const slots = {}; GT.parts.forEach((pt, i) => slots[pt] = lv[i]);
    return X.buildPower({ eq: {}, slots }).atk / X.TUNE.pAtk0;
  };
  const P = GT.evenPer, S = GT.evenStep;
  const cases = [
    [[0, 0, 0, 0, 0, 0], 1],
    [[P - 1, 9, 9, 9, 9, 9], 1],                       /* 한 슬롯이라도 모자라면 보너스 없음 */
    [[P, P, P, P, P, P], 1 + S],
    [[P, 99, 99, 99, 99, 99], 1 + S],                  /* 최저 슬롯 기준 */
    [[2 * P, 2 * P, 2 * P, 2 * P, 2 * P, 2 * P], 1 + 2 * S],
    [[10 * P, 10 * P, 10 * P, 10 * P, 10 * P, 10 * P], 1 + 10 * S],   /* 무한(상한 없음) */
  ];
  const wrong = cases.filter(([lv, want]) => Math.abs(bonus(lv) - want) > 1e-9);
  chk(`균등 보너스 계단 (+${(S * 100).toFixed(0)}% × floor(min/${P}), 상한 없음)`, wrong.length === 0,
      wrong.length ? wrong.map(([lv, w]) => `슬롯 ${lv.join('/')} 기대 ×${w.toFixed(2)} ≠ 실측 ×${bonus(lv).toFixed(3)}`).join(' / ')
                   : cases.map(([lv, w]) => `${lv.join('/')}→×${w.toFixed(2)}`).join('  '));
}

/* ----------------------------------------------------------------
   ⚑ T63 — «다음 단계» 안내문이 주인 확정 슬롯 상한(GT.slotLvMax)을 넘겨 광고하면 안 된다.
   왜 게이트인가: 균등 보너스는 «5의 배수마다 +5%» 로 상한이 없는데(위 ⑤가 그걸 단언한다)
   슬롯 레벨 자체는 주인 확정 상한 150 이 있다. 두 규칙이 만나는 자리가 이 안내문 한 줄이고,
   실제로 mn=150 에서 «6슬롯 전부 Lv.155 이면 +155%» 라는 도달 불가능한 문구가 떴다.
   같은 화면의 슬롯 팝업은 «상한 Lv.150» 으로 끊는데 이 줄만 안 끊은 «형제 코드 불일치» 라
   눈으로는 다시 놓치기 쉽다. index.html 의 그 식을 그대로 꺼내 0~상한 전 구간에서 굴린다.
   ---------------------------------------------------------------- */
console.log('\n[⑦ ⚑ T63 슬롯 균등 보너스 안내문 — 주인 확정 상한 Lv.' + GT.slotLvMax + ' 밖을 광고하지 않는다]');
{
  const HTML = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const m = HTML.match(/const nextEven=\(Math\.floor\(mn\/GT\.evenPer\)\+1\)\*GT\.evenPer;/);
  chk('index.html 이 다음 단계 레벨을 nextEven 한 곳에서 계산한다', !!m,
      m ? '식 1개' : '`const nextEven=…` 을 못 찾았다 — T63 수정이 되돌려졌거나 식이 흩어졌다');
  const guard = /nextEven>GT\.slotLvMax\s*\?\s*`\(슬롯 상한 Lv\.\$\{GT\.slotLvMax\} — 균등 보너스 최대\)`/.test(HTML);
  chk('상한에 닿으면 «슬롯 상한 Lv.150 — 균등 보너스 최대» 로 끊는다', guard,
      guard ? '가드 있음' : '상한 가드가 없다 — mn=150 에서 «Lv.155 이면 +155%» 가 다시 뜬다');
  /* 0~상한 전 구간에서 «광고되는 레벨» 이 상한을 넘지 않는지 실제로 굴린다 */
  const advertise = mn => {
    const nextEven = (Math.floor(mn / GT.evenPer) + 1) * GT.evenPer;
    return nextEven > GT.slotLvMax ? null : nextEven;     /* null = 상한 문구로 끊긴다 */
  };
  const over = [];
  for (let mn = 0; mn <= GT.slotLvMax; mn++) { const a = advertise(mn); if (a !== null && a > GT.slotLvMax) over.push(`${mn}→${a}`); }
  chk(`슬롯 0~${GT.slotLvMax} 전수: 광고 레벨이 상한을 넘는 칸 0개`, over.length === 0,
      over.length ? `위반 ${over.length}칸: ${over.slice(0, 6).join(', ')}` : `상한 근처 실측 — 149→150 · 150→«상한 문구»`);
  /* 되돌림 감지: 가드를 빼면 mn=150 이 155 를 광고한다는 사실 자체를 못박아 둔다 */
  const naive = (Math.floor(GT.slotLvMax / GT.evenPer) + 1) * GT.evenPer;
  chk('가드 없는 옛 식은 실제로 상한을 넘는다 (이 게이트가 지키는 대상이 실재함을 확인)', naive > GT.slotLvMax,
      `가드 없으면 최저슬롯 ${GT.slotLvMax} → «Lv.${naive}» 광고`);
}

/* ---------------------------------------------------------------- */
console.log('\n[⑧ ⚑ T130 시뮬 측정 정책 — T125 ①-c «시뮬의 autoEquip 은 그대로» (동작으로 확인)]');
simPolicyChecks(SRC, chk);

/* ---------------------------------------------------------------- */
console.log('\n[⑥ §11.5 경제 정합 (참고 출력 — 판정 아님)]');
{
  const perDay = GT.dailyGem / GT.pullCost;
  console.log(`  하루 뽑기 ${perDay.toFixed(2)}회 (다이아 ${GT.dailyGem} / ${GT.pullCost}) · 천장 50회 = ${(50 / perDay).toFixed(1)}일`);
  console.log(`  과금 1회 ${GT.iapGem} 다이아 = ${(GT.iapGem / GT.pullCost).toFixed(0)}회 = 무료 ${(GT.iapGem / GT.dailyGem).toFixed(1)}일치`);
}

console.log(`\n통과 ${ok} · 위반 ${bad}`);
if (bad) { console.log('→ 실패: §11 규칙이 엔진에서 깨졌다. 노브(rarStep·plusStep·legendToMythPlus·evenStep/evenPer)를 바꿨다면 되돌리거나 PLAN 과 함께 맞출 것.'); process.exit(1); }
console.log('→ 통과');
