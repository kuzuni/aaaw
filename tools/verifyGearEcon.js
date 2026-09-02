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

   ⚑ 특히 §11.3 의 «신화 +0강 > 전설 +9강» 은 **주인 확정 제약**인데,
   그 성립 여부가 `rarStep`·`plusStep` 이라는 **T1 튜닝 노브의 파생값**이다:
       신화0강 = unit                                (rarStep^0)
       전설9강 = unit / rarStep * (1 + plusStep*9)
       → 성립 조건: rarStep > 1 + plusStep*9   (현행 plusStep 0.12 → 하한 2.08)
   R10 이 이미 rarStep 을 10/30/60 으로 스윕했고, T22(승인 대기 17번)는 **155 → 2.86 하향**을
   제안하고 있다. 2.86 은 하한 2.08 까지 여유가 1.375배뿐이라, 다음 회차가 한 번 더 내리면
   주인 확정 제약이 **아무 경고 없이** 깨진다. 이 게이트가 그 순간 exit 1 로 막는다.

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

console.log('=== 장비 경제 동작 게이트 (T29) — §11.1~§11.4 규칙을 엔진을 실제로 굴려 확인 ===');

/* ---------------------------------------------------------------- */
console.log('\n[① §11.3 주인 확정 제약 — 신화 +0강 > 전설 +9강 (공/체 기여 기준)]');
{
  const m0a = GT.atk[4], m0h = GT.hp[4];
  const l9a = GT.atk[3] * (1 + GT.plusStep * 9), l9h = GT.hp[3] * (1 + GT.plusStep * 9);
  chk('공격력 기여', m0a > l9a, `신화0강 ${m0a.toExponential(3)} vs 전설9강 ${l9a.toExponential(3)} (여유 ${(m0a / l9a).toFixed(3)}배)`);
  chk('체력 기여',   m0h > l9h, `신화0강 ${m0h.toExponential(3)} vs 전설9강 ${l9h.toExponential(3)} (여유 ${(m0h / l9h).toFixed(3)}배)`);

  /* 노브 하한 — T1 이 rarStep·plusStep 을 만질 때 이 선을 넘으면 제약이 깨진다 */
  const floor = 1 + GT.plusStep * 9;
  const margin = GT.rarStep / floor;
  chk('노브 여유 (rarStep > 1 + plusStep*9)', GT.rarStep > floor,
      `rarStep ${GT.rarStep} · 하한 ${floor.toFixed(3)} (plusStep ${GT.plusStep}) → 여유 ${margin.toFixed(3)}배`);
  if (margin < 2) console.log(`     ⚠ 여유가 ${margin.toFixed(2)}배뿐이다 — rarStep 을 ${floor.toFixed(2)} 이하로 내리면 주인 확정 제약 위반이다.`);

  /* 실제 빌드로도 확인 (옵션·슬롯·균등보너스 전부 포함한 종합 전투력) */
  const pm = X.buildPower(X.mkBuild(4, 0, 0)), pl = X.buildPower(X.mkBuild(3, 9, 0));
  chk('풀셋 종합 전투력(슬롯 0렙)', pm.atk > pl.atk && pm.hp > pl.hp,
      `신화0강 공 ${pm.atk.toExponential(3)}/체 ${pm.hp.toExponential(3)} vs 전설9강 공 ${pl.atk.toExponential(3)}/체 ${pl.hp.toExponential(3)}`);
}

/* ---------------------------------------------------------------- */
console.log('\n[② §11.1 옵션 개수 — 등급별 + 신화 강화 보너스]');
{
  const byRar = [0, 1, 2, 3, 4].map(r => GT.optCount(r, 0));
  chk('등급별 0강 옵션 수', byRar.join('/') === '0/1/2/3/4', `일반0·희귀1·영웅2·전설3·신화4 → 실측 ${byRar.join('/')}`);
  const plusMap = [[0, 4], [2, 4], [3, 5], [5, 5], [6, 6], [8, 6], [9, 7], [12, 7], [50, 7]];
  const wrongP = plusMap.filter(([p, want]) => GT.optCount(4, p) !== want);
  chk('신화 +3/+6/+9 에서 1개씩 (+9 가 끝, 무한강화해도 7 고정)', wrongP.length === 0,
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
  for (let i = 0; i < N; i++) { st0.p50 = 0; st0.p10 = 0; nat[X.gachaPull(st0).rar]++; }
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
  for (let i = 1; i <= N; i++) {
    const g = X.gachaPull(st);
    parts.set(g.part + '|' + g.type, (parts.get(g.part + '|' + g.type) || 0) + 1);
    if (g.rar === 4) { const d = i - lastM; if (d > maxM) maxM = d; if (d === 50) hitM50++; lastM = i; }
    if (g.rar >= 3) { const d = i - lastL; if (d > maxL) maxL = d; if (d === 10) hitL10++; lastL = i; }
  }
  chk('50회 천장 (신화 간격 ≤ 50)', maxM <= 50, `최대 간격 ${maxM}회 · 정확히 50 에서 확정된 사례 ${hitM50.toLocaleString()}건`);
  chk('천장이 실제로 발동한다 (간격 50 사례 존재)', hitM50 > 0, `${hitM50}건`);
  chk('10회 전설 피티 (전설 이상 간격 ≤ 10)', maxL <= 10, `최대 간격 ${maxL}회 · 정확히 10 에서 확정된 사례 ${hitL10.toLocaleString()}건`);
  chk('피티가 실제로 발동한다 (간격 10 사례 존재)', hitL10 > 0, `${hitL10}건`);

  /* (c) 부위·종류 18종 균등 */
  const vals = [...parts.values()], exp = N / 18;
  const dev = Math.max(...vals.map(v => Math.abs(v - exp) / exp));
  chk('부위·종류 18종 균등 랜덤', parts.size === 18 && dev < (FAST ? 0.10 : 0.03),
      `${parts.size}종 · 기대 ${exp.toFixed(0)} · 최대 편차 ${(dev * 100).toFixed(2)}%`);

  /* (d) 겹침 이월 (주인 명시): 천장과 피티가 같은 회차에 걸리면 신화 우선 + 전설 확정은 다음 회차로 이월 */
  const s1 = X.newGacha(); s1.p50 = 49; s1.p10 = 9;
  const g1 = X.gachaPull(s1);
  chk('겹침: 천장 회차는 신화', g1.rar === 4, `등급 ${nm[g1.rar]}`);
  chk('겹침: 신화 나오면 p50 리셋', s1.p50 === 0, `p50=${s1.p50}`);
  chk('겹침: 전설 확정은 다음 뽑기로 이월 (p10 유지)', s1.p10 === 10, `p10=${s1.p10} (10 이어야 다음 회차가 전설 이상 확정)`);
  const g2 = X.gachaPull(s1);
  chk('이월된 전설 확정이 다음 회차에 실제로 나온다', g2.rar >= 3, `등급 ${nm[g2.rar]}`);

  /* (e) 자연 신화는 «전설 이상» 이므로 피티 카운터도 리셋 (겹침이 아닐 때) */
  let seen = false;
  for (let t = 0; t < 5000 && !seen; t++) {
    const s = X.newGacha(); s.p50 = 10; s.p10 = 3;
    const g = X.gachaPull(s);
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
