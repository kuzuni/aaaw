#!/usr/bin/env node
/* ================================================================================
   verifyGearOptTrigger — ⚑⚑⚑ T137 (워커 C · sess-0435-28835)

   **주인 확정 T124 ③ (2026-09-04 19:2X~20:3X · ROUTINE 최상단) 의 «발동 조건» 두 절**
     · «**가시갑옷 옵션은 특전 가시갑옷과 가산**(실드 > 0 일 때만 +12%씩)»
     · «**«체력 50% 미만일 때 회피 시 회복» 은 회피 성공 순간 체력 비율로 판정**»
   그리고 같은 절의 «같은 옵션이 여러 부위에 있으면 **각각 따로 합산·발동**» 중
   **«발동» 쪽 절반**(합산 쪽은 T135 `verifyGearOptAgg` 가 본다).

   ── 구멍을 먼저 증명했다 (T137 사본 실측) ──
   T135 가 «이 축은 전투를 돌려야 잡힌다» 며 남긴 자리다. 실제로 사본을 만들어 확인했다 —
   **다음 두 개조를 두 엔진에 심어도 정적 게이트 22종·T3 4스위트(249)가 숫자 하나 안 움직였다**:
     ⓐ `const hadSh=p.sh>0;` 한 줄을 **실드 흡수 뒤로** 옮긴다
        → 조건이 «피격 «전» 실드가 있었나» 에서 «피격 «후» 실드가 남았나» 로 조용히 뒤집힌다.
          실드가 이 타격으로 **전부 소진되는 순간**(= 실드가 가장 절실한 순간)에만 가시 +72% 가
          사라지므로 눈으로도 안 보인다. `verifyPerkOrder` 의 두 정규식은
          `const thornM=px.p_thorns+(hadSh?px.g_thornSh:0)` 문면만 보므로 그대로 초록이다.
        → 덤으로 T121 «실드 반사»(`p_shRefL&&hadSh`)까지 같이 뒤집힌다.
     ⓒ 회피 회복의 `for(let i=0;i<px.g_evHeal;i++)` 를 `if(px.g_evHeal)` 로 바꾼다
        → 주인 «부위마다 각각 따로 발동» 이 **6번 → 1번**이 된다.
          `verifyGearOptAgg` 는 `px.g_evHeal===6` 이라는 **카운터 값**만 보지 굴림 횟수는 안 본다
          (도끼 6번은 보는데 회복 6번은 «발동» 축이라 안 본다). `verifyOptText` 는 설명문 ↔ 상수
          대조라 «몇 번 굴리나» 를 모른다. T3 `battle` 은 회피·저체력 상황을 안 만든다.

   ── 그래서 이 게이트가 하는 일 ──
   문면 대조가 아니라 **실제 전투 동사를 굴려서 재는 것**이다.
   `sim.js` 의 진짜 `hitPlayer` 를 vm 에 올리고 `Math.random` 을 갈아끼워
   피격 1회·회피 1회를 통제된 난수로 돌린 뒤 **반사량·회복량·굴림 횟수**를 센다.

   ⓐ 가시갑옷 — 실드가 있으면 `받은 피해 × (특전 배율 + 0.72)`, 실드가 0 이면 `× 특전 배율`
   ⓑ **실드가 이 타격으로 전부 소진돼도 발동한다** (조건 시점 = 피격 «전») ← 위 ⓐ 개조를 잡는 자리
   ⓒ **가산이지 곱연산이 아니다** — 특전 3종(+600%) + 장비 +72% = ×6.72 (곱연산이면 ×10.32)
   ⓓ 근접 피격만 — 원거리는 반사 0 · 실드 조건은 **장비분에만** 걸린다(특전분은 실드 0 에서도 그대로)
   ⓔ 회피 회복 — 체력 49% 는 발동 · **50% 는 발동 안 함**(«미만») · 51% 안 함
   ⓕ **부위마다 따로 굴린다** — 풀셋에서 정확히 6번, 1부위면 1번 (굴림 수를 직접 센다)
   ⓖ 확률 30% 임계(0.29 발동 · 0.30 안 함) · 회복량 = 최대 체력의 10% × 성공 횟수
   ⓗ **회피 분기 안에서만 발동한다** — 회피 실패(피격)면 굴림 0회
   ⓘ 두 엔진 구조 대조 — `hadSh` 선언이 실드 흡수보다 **앞**이고, 회피 회복 줄이 회피 분기 «안» ·
      체력 차감보다 «앞» 이며, 세 줄의 문면이 `sim.js` ↔ `index.html` 1:1
   ⓙ GOPT 문구 — 두 옵션이 세 세트·6부위에 주인 문면 그대로 실려 있다
   ⓚ ROUTINE 에 주인 원문 두 절이 살아 있다

   ── 이 상수를 고쳐도 되는 때 ──
   **주인이 발동 조건을 새로 확정했을 때뿐이다.** 그때 FZ 를 갱신하고 PROGRESS 에 주인 원문과
   함께 남긴다 — 조건을 고치는 것 자체가 diff 에 드러나는 것이 요점이다.

   사용: node tools/verifyGearOptTrigger.js        (exit 0 = 통과, 1 = 불합격)
   음성: node tools/verifyGearOptTrigger.js --self (심은 고장 10종 + 양성 대조군)
   ================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ── 주인 확정값 동결 (T124 ③) ───────────────────────────────────────────────── */
const FZ = {
  thornPart: 0.12,   /* 부위당 «실드가 있을 때 가시갑옷 +12%» */
  thornFull: 0.72,   /* 풀셋 6부위 = +72% (주인 참고표) */
  perkThorn: 6.0,    /* 특전 가시갑옷 +100/+200/+300 = +600% (가산) */
  evHpGate: 0.50,    /* «체력 50% 미만일 때» */
  evChance: 0.30,    /* «30% 확률로» */
  evHealF: 0.10,     /* «체력 10% 회복» */
  parts: 6,          /* 풀셋 부위 수 = 굴림 횟수 */
};
const T_HPSH = 1, T_EVADE = 2;   /* GT.types 순서 = [치명, 체력실드, 회피] */

/* 주인 문면 (ROUTINE) */
const RULE_THORN = /가시갑옷 옵션은 특전 가시갑옷과 가산\(실드 > 0 일 때만 \+12%씩\)/;
const RULE_EVHEAL = /«체력 50% 미만일 때 회피 시 회복» 은 회피 성공 순간 체력 비율로 판정/;

/* 두 엔진 공통 문면 — 여기가 갈라지면 게임과 시뮬이 다른 플레이어를 만든다 */
const LINE_HADSH = 'const hadSh=p.sh>0;';
const LINE_THORNM = 'const thornM=px.p_thorns+(hadSh?px.g_thornSh:0);';
const LINE_EVHEAL = 'if(p.hp<p.maxHp*0.50) for(let i=0;i<px.g_evHeal;i++) if(pkk(p,0.30))';
const OPT_THORN = '실드가 있을 때 가시갑옷 +12%';
const OPT_EVHEAL = '체력 50% 미만일 때 회피 시 30% 확률로 체력 10% 회복';

/* ================================================================
   sim.js 를 CLI 디스패처 앞까지만 vm 에 올린다 (`verifyGearOptAgg` 와 같은 수법).
   `Math` 를 샌드박스에 직접 넣어 **난수 스트림을 통제·계수**하는 것이 이 게이트의 실측 수법이다.
   ================================================================ */
const CUT = 'const mode=process.argv[2]||';
function loadSim(src, rng) {
  const at = src.indexOf(CUT);
  if (at < 0) return null;
  const M = Object.create(Math);
  M.random = () => { const v = rng.fn(rng.n); rng.n++; return v; };
  const m = { exports: {} };
  try {
    vm.runInNewContext(
      src.slice(0, at) + '\nmodule.exports={hitPlayer,mkPlayer,mkBuild,GT,GOPT,PERKS,effDef,effEvade};',
      { module: m, exports: m.exports, process, console: { log() {} }, require, Math: M });
  } catch (e) { return null; }
  return m.exports;
}

/* 통제된 한 방 — 세트 ti 풀셋 신화+9강을 입히고 `hitPlayer` 를 정확히 한 번 부른다.
   `nodes` 가 비어 있어 도끼·투사체는 대상이 없다(발동은 하되 부수 효과가 측정을 흐리지 않는다). */
function shot(A, ti, o) {
  const b = A.mkBuild(4, 9, 0, ti);
  if (o.parts) for (const pt of A.GT.parts) if (!o.parts.includes(pt)) delete b.eq[pt];
  const G = { chapter: 1, player: null, nodes: [], projs: [], taken: [], t: 0, dead: false, gold: 0 };
  G.player = A.mkPlayer(b, G);
  const p = G.player;
  if (o.perks) for (const id of o.perks) { const k = A.PERKS.find(x => x.id === id); if (k) k.ap(p); }
  if (o.shF !== undefined) p.sh = p.maxSh * o.shF;
  if (o.sh !== undefined) p.sh = o.sh;
  if (o.hpF !== undefined) p.hp = p.maxHp * o.hpF;
  const hp0 = p.hp;
  const src = { hp: 1e9 };
  o.rng.n = 0; o.rng.fn = o.roll;
  A.hitPlayer(G, o.dmg === undefined ? 1 : o.dmg, o.melee !== false, src);
  return {
    refl: 1e9 - src.hp,                       /* 적이 반사로 잃은 체력 */
    base: (o.dmg === undefined ? 1 : o.dmg) * (1 - A.effDef(p) / 100),
    healF: (p.hp - hp0) / p.maxHp,             /* 최대 체력 대비 회복 비율 */
    rolls: o.rng.n,                            /* 이 한 방이 굴린 `Math.random` 횟수 */
    px: p.px,
  };
}
const near = (a, b, eps) => Math.abs(a - b) <= (eps === undefined ? 1e-9 : eps) * Math.max(1, Math.abs(b));

/* 함수 본문만 잘라 온다 (열/닫 괄호 세기 없이 «다음 최상위 function» 까지) */
function fnBody(src, sig) {
  const a = src.indexOf(sig);
  if (a < 0) return '';
  const b = src.indexOf('\nfunction ', a + sig.length);
  return src.slice(a, b < 0 ? src.length : b);
}
const squash = s => s.replace(/[ \t]+/g, ' ');

/* ================================================================ */
const R = [];
const chk = (name, pass, detail) => R.push({ name, c: !!pass, d: detail });

function run(simSrc, htmSrc, routineSrc, quiet) {
  R.length = 0;
  const say = quiet ? () => {} : console.log;
  const rng = { n: 0, fn: () => 0 };
  const A = loadSim(simSrc, rng);
  chk('sim.js 엔진 로드 (hitPlayer·mkPlayer·GOPT)', !!A, 'CLI 디스패처 앞까지 잘라 vm 에 올린다');
  if (!A) return finish(say, quiet);

  const NEVER = () => 0.999;   /* 모든 확률 굴림 실패 (회피도 실패) */
  const ALWAYS = () => 0;      /* 모든 확률 굴림 성공 (회피도 성공) */

  /* ===== ⓐ 가시갑옷 = 특전 + (실드가 있을 때만) 장비 +72% ===== */
  say('\n=== ⓐ 가시갑옷 «특전과 가산 · 실드 > 0 일 때만» (sim.js hitPlayer 실측) ===');
  {
    const P3 = ['p_thornsN', 'p_thornsR', 'p_thornsL'];   /* +100 +200 +300 = +600% */
    const s1 = shot(A, T_HPSH, { rng, roll: NEVER, shF: 1, dmg: 10000 });
    chk('실드가 남아 있는 근접 피격 → 반사 = 받은 피해 × 0.72',
      near(s1.refl, s1.base * FZ.thornFull), `반사 ${s1.refl} · 기대 ${s1.base * FZ.thornFull}`);
    const s2 = shot(A, T_HPSH, { rng, roll: NEVER, sh: 0, dmg: 10000 });
    chk('실드가 0 인 근접 피격 → 장비분이 안 붙는다 (반사 0)',
      near(s2.refl, 0), `반사 ${s2.refl} (기대 0 — 특전 없음)`);
    /* ⓑ 조건 시점 — 실드가 이 타격으로 «전부 소진» 돼도 발동한다 (피격 «전» 상태로 본다) */
    const s3 = shot(A, T_HPSH, { rng, roll: NEVER, sh: 100, dmg: 10000 });
    chk('⚑ 실드가 이 타격으로 전부 소진돼도 발동한다 (조건 시점 = 피격 «전»)',
      near(s3.refl, s3.base * FZ.thornFull), `반사 ${s3.refl} · 기대 ${s3.base * FZ.thornFull} (0 이면 hadSh 가 흡수 «뒤» 로 밀린 것)`);
    /* ⓒ 가산이지 곱연산이 아니다 */
    const s4 = shot(A, T_HPSH, { rng, roll: NEVER, shF: 1, dmg: 10000, perks: P3 });
    const add = s4.base * (FZ.perkThorn + FZ.thornFull);
    const mul = s4.base * FZ.perkThorn * (1 + FZ.thornFull);
    chk(`특전 가시(+600%) + 장비(+72%) = ×${FZ.perkThorn + FZ.thornFull} 가산`,
      near(s4.refl, add), `반사 ${s4.refl} · 가산 ${add} · 곱연산이면 ${mul}`);
    chk('곱연산 값과 실제로 다르다 (가산·곱연산이 우연히 같지 않은 표본)',
      !near(add, mul) && !near(s4.refl, mul), `가산 ${add} ↔ 곱연산 ${mul}`);
    /* ⓓ 실드 조건은 장비분에만 · 근접에만 */
    const s5 = shot(A, T_HPSH, { rng, roll: NEVER, sh: 0, dmg: 10000, perks: P3 });
    chk('실드가 0 이어도 특전 가시(+600%)는 그대로 발동한다 (조건은 장비분에만)',
      near(s5.refl, s5.base * FZ.perkThorn), `반사 ${s5.refl} · 기대 ${s5.base * FZ.perkThorn}`);
    const s6 = shot(A, T_HPSH, { rng, roll: NEVER, shF: 1, dmg: 10000, melee: false, perks: P3 });
    chk('원거리 피격은 가시갑옷이 발동하지 않는다 (근접 전용)',
      near(s6.refl, 0), `반사 ${s6.refl} (기대 0)`);
    /* 옵션 축 자체의 값 — 1부위 +12% · 풀셋 +72% */
    const one = shot(A, T_HPSH, { rng, roll: NEVER, sh: 0, parts: [A.GT.parts[0]] });
    chk(`1부위 = +${FZ.thornPart * 100}% · 풀셋 = +${FZ.thornFull * 100}%`,
      near(one.px.g_thornSh, FZ.thornPart) && near(s1.px.g_thornSh, FZ.thornFull),
      `1부위 ${one.px.g_thornSh} · 풀셋 ${s1.px.g_thornSh}`);
  }

  /* ===== ⓔ~ⓗ 회피 회복 «회피 성공 순간 체력 비율로 판정» ===== */
  say('\n=== ⓔ 저체력 회피 회복 — 조건·굴림 횟수·확률·회복량 (sim.js hitPlayer 실측) ===');
  {
    /* 회피 세트 풀셋의 회피 분기 굴림 = 회피 1 + 도끼 6 + 회복 6 = 13 (조건 미달이면 7) */
    const base = 1 + FZ.parts;                       /* 회피 판정 1 + 회피 시 도끼 6 */
    const full = base + FZ.parts;                    /* + 저체력 회복 6 */
    const lo = shot(A, T_EVADE, { rng, roll: ALWAYS, hpF: 0.10 });
    chk(`체력 10% 회피 → 회복을 ${FZ.parts}번 굴린다 (굴림 ${full}회)`,
      lo.rolls === full, `굴림 ${lo.rolls}회 (기대 ${full} = 회피1 + 도끼${FZ.parts} + 회복${FZ.parts})`);
    chk(`체력 10% 회피 · 전부 성공 → 최대 체력의 ${FZ.evHealF * 100}% × ${FZ.parts} 회복`,
      near(lo.healF, FZ.evHealF * FZ.parts, 1e-9), `회복 ${(lo.healF * 100).toFixed(4)}% (기대 ${FZ.evHealF * FZ.parts * 100}%)`);
    const e49 = shot(A, T_EVADE, { rng, roll: ALWAYS, hpF: 0.49 });
    chk('체력 49% → 발동한다', e49.rolls === full, `굴림 ${e49.rolls}회 (기대 ${full})`);
    const e50 = shot(A, T_EVADE, { rng, roll: ALWAYS, hpF: 0.50 });
    chk('⚑ 체력 정확히 50% → 발동하지 않는다 («미만» 이므로)',
      e50.rolls === base && near(e50.healF, 0), `굴림 ${e50.rolls}회 (기대 ${base}) · 회복 ${e50.healF}`);
    const e51 = shot(A, T_EVADE, { rng, roll: ALWAYS, hpF: 0.51 });
    chk('체력 51% → 발동하지 않는다',
      e51.rolls === base && near(e51.healF, 0), `굴림 ${e51.rolls}회 (기대 ${base})`);
    /* ⓕ 부위마다 따로 — 1부위면 1번 */
    const p1 = shot(A, T_EVADE, { rng, roll: ALWAYS, hpF: 0.10, parts: [A.GT.parts[0]] });
    chk('⚑ 1부위만 끼면 정확히 1번 굴린다 (부위마다 따로 발동)',
      p1.px.g_evHeal === 1 && p1.rolls === 3 && near(p1.healF, FZ.evHealF, 1e-9),
      `g_evHeal ${p1.px.g_evHeal} · 굴림 ${p1.rolls}회(기대 3 = 회피1+도끼1+회복1) · 회복 ${(p1.healF * 100).toFixed(4)}%`);
    chk(`⚑ 풀셋은 1부위의 정확히 ${FZ.parts}배로 굴린다`,
      lo.rolls - base === (p1.rolls - 2) * FZ.parts,
      `풀셋 회복 굴림 ${lo.rolls - base} ↔ 1부위 ${p1.rolls - 2} × ${FZ.parts}`);
    /* ⓖ 확률 임계 30% */
    const justIn = shot(A, T_EVADE, { rng, roll: n => (n === 0 ? 0 : FZ.evChance - 0.01), hpF: 0.10 });
    chk(`확률 임계 — 굴림값 ${FZ.evChance - 0.01} 이면 발동한다`,
      justIn.rolls === full && justIn.healF > 0, `굴림 ${justIn.rolls} · 회복 ${(justIn.healF * 100).toFixed(2)}%`);
    const justOut = shot(A, T_EVADE, { rng, roll: n => (n === 0 ? 0 : FZ.evChance), hpF: 0.10 });
    chk(`확률 임계 — 굴림값 ${FZ.evChance} 이면 발동하지 않는다 (경계는 «미만»)`,
      justOut.rolls === full && near(justOut.healF, 0), `굴림 ${justOut.rolls} · 회복 ${justOut.healF}`);
    /* ⓗ 회피 분기 안에서만 */
    const miss = shot(A, T_EVADE, { rng, roll: NEVER, hpF: 0.10, dmg: 1 });
    chk('⚑ 회피에 실패(피격)하면 회복을 한 번도 굴리지 않는다 («회피 시» 트리거)',
      near(miss.healF, 0), `회복 ${miss.healF} (기대 0)`);
  }

  /* ===== ⓘ 두 엔진 구조 대조 ===== */
  say('\n=== ⓘ 두 엔진 구조 — 조건이 평가되는 «자리» 가 같다 ===');
  {
    const E = [['sim.js', fnBody(simSrc, 'function hitPlayer(G,dmg,isMelee,src){')],
               ['index.html', fnBody(htmSrc, 'function hitPlayer(dmg,isMelee,src){')]];
    for (const [nm, body] of E) {
      chk(`${nm} hitPlayer 본문을 찾았다`, body.length > 500, `${body.length}자`);
      if (body.length <= 500) continue;
      const iHad = body.indexOf(LINE_HADSH);
      const iAbs = body.indexOf('p.sh-=ab');
      const iThorn = body.indexOf(LINE_THORNM);
      const iHp = body.indexOf('p.hp-=d');
      const iEv = squash(body).indexOf(LINE_EVHEAL);
      const iEvIf = body.indexOf('if(Math.random()*100<effEvade(p))');
      chk(`${nm} — «${LINE_HADSH}» 가 실드 흡수(p.sh-=ab)보다 **앞**에 있다`,
        iHad >= 0 && iAbs >= 0 && iHad < iAbs,
        `hadSh@${iHad} · 흡수@${iAbs} (뒤로 밀리면 조건이 «실드가 남았나» 로 뒤집힌다)`);
      chk(`${nm} — 가시 합산식이 «${LINE_THORNM}» 그대로다`, iThorn >= 0, '가산식 문면');
      chk(`${nm} — 가시 합산이 실드 흡수 «뒤» 에서 계산된다 (thornBase 는 흡수 앞 값)`,
        iThorn > iAbs, `thornM@${iThorn} · 흡수@${iAbs}`);
      chk(`${nm} — 회피 회복 줄이 «${LINE_EVHEAL}» 그대로다`, iEv >= 0, '조건·굴림·확률 한 줄');
      chk(`${nm} — 회피 회복 줄이 회피 분기 «안» 이고 체력 차감보다 «앞» 이다`,
        iEvIf >= 0 && iEv > 0 && iEvIf < iEv && (iHp < 0 || iEv < squash(body).indexOf('p.hp-=d')),
        `회피if@${iEvIf} · 회복@${iEv} · 체력차감@${iHp}`);
    }
    chk('두 엔진의 `hadSh` 선언 문면이 1:1', E.every(([, b]) => b.includes(LINE_HADSH)));
    chk('두 엔진의 가시 합산식 문면이 1:1', E.every(([, b]) => b.includes(LINE_THORNM)));
    chk('두 엔진의 회피 회복 조건·굴림 문면이 1:1', E.every(([, b]) => squash(b).includes(LINE_EVHEAL)));
    chk('두 엔진 다 `hadSh` 를 실드 반사(p_shRefL)에서도 같은 변수로 쓴다 (조건 시점 공유)',
      E.every(([, b]) => /p_shRefL&&hadSh&&src&&pkk\(p,PERK_SHREF_L\)/.test(b.replace(/\s+/g, ''))));
  }

  /* ===== ⓙ GOPT 문구 — 두 옵션이 각자 세트의 6부위에 주인 문면 그대로 ===== */
  say('\n=== ⓙ 옵션 문구 (두 엔진 · 6부위) ===');
  {
    /* 주석·PLAN 인용과 섞이지 않게 **GOPT 항목 자리**(`{d:'…'`)만 센다 */
    const cnt = (src, txt) => (src.split(`{d:'${txt}'`).length - 1);
    for (const [nm, src] of [['sim.js', simSrc], ['index.html', htmSrc]]) {
      chk(`${nm} — «${OPT_THORN}» 이 GOPT 에 ${FZ.parts}칸 (체력실드 세트 6부위)`,
        cnt(src, OPT_THORN) === FZ.parts, `${cnt(src, OPT_THORN)}칸`);
      chk(`${nm} — «${OPT_EVHEAL}» 이 GOPT 에 ${FZ.parts}칸 (회피 세트 6부위)`,
        cnt(src, OPT_EVHEAL) === FZ.parts, `${cnt(src, OPT_EVHEAL)}칸`);
    }
    /* sim.js 는 실제 GOPT 객체로 «어느 세트의 어느 부위인지» 까지 본다 */
    const has = (ti, txt) => A.GT.parts.filter(pt => (A.GOPT[A.GT.types[pt][ti]] || []).some(o => o.d === txt)).length;
    chk(`sim.js GOPT — «${OPT_THORN}» 은 체력실드 세트 ${FZ.parts}부위에만 있다`,
      has(T_HPSH, OPT_THORN) === FZ.parts && has(0, OPT_THORN) === 0 && has(T_EVADE, OPT_THORN) === 0,
      `치명 ${has(0, OPT_THORN)} · 체력실드 ${has(T_HPSH, OPT_THORN)} · 회피 ${has(T_EVADE, OPT_THORN)}`);
    chk(`sim.js GOPT — «${OPT_EVHEAL}» 은 회피 세트 ${FZ.parts}부위에만 있다`,
      has(T_EVADE, OPT_EVHEAL) === FZ.parts && has(0, OPT_EVHEAL) === 0 && has(T_HPSH, OPT_EVHEAL) === 0,
      `치명 ${has(0, OPT_EVHEAL)} · 체력실드 ${has(T_HPSH, OPT_EVHEAL)} · 회피 ${has(T_EVADE, OPT_EVHEAL)}`);
  }

  /* ===== ⓚ ROUTINE 주인 문면 ===== */
  say('\n=== ⓚ ROUTINE 주인 원문 (T124 ③) ===');
  chk('«가시갑옷 옵션은 특전 가시갑옷과 가산(실드 > 0 일 때만 +12%씩)» 이 살아 있다', RULE_THORN.test(routineSrc));
  chk('««체력 50% 미만일 때 회피 시 회복» 은 회피 성공 순간 체력 비율로 판정» 이 살아 있다', RULE_EVHEAL.test(routineSrc));

  return finish(say, quiet);
}

function finish(say, quiet) {
  const bad = R.filter(x => !x.c).length;
  if (!quiet) for (const r of R) say(`  ${r.c ? '✓' : '🔴'} ${r.name}${r.d ? `  — ${r.d}` : ''}`);
  say(`\n[T137 장비 옵션 발동 조건 게이트] 대조 ${R.length}항목 · 통과 ${R.length - bad} · 불합격 ${bad}` +
      (bad ? '' : ' → 통과 (가시갑옷 실드 조건·가산 · 저체력 회피 회복 부위별 굴림 — 두 엔진)'));
  return bad;
}

/* ================================================================ */
const simSrc = rd('sim.js');
const htmSrc = rd('index.html');
const routineSrc = rd('docs/ROUTINE.md');

if (process.argv.includes('--self')) {
  console.log('⚑ 음성 검사 — 심은 고장이 실제로 빨개지는가 (죽은 검사 색출)');
  /* [이름, sim.js 개조, index.html 개조] — 둘 중 하나만 바꾸면 나머지는 원본 그대로 */
  const cases = [
    ['`hadSh` 를 실드 흡수 «뒤» 로 옮기면 (sim — 조건이 «실드가 남았나» 로 뒤집힌다)',
      s => s.replace(/\n  const hadSh=p\.sh>0;[^\n]*\n/, '\n')
            .replace('if(p.sh>0){const ab=Math.min(p.sh,d);p.sh-=ab;d-=ab;}',
                     'if(p.sh>0){const ab=Math.min(p.sh,d);p.sh-=ab;d-=ab;}\n  const hadSh=p.sh>0;'), null],
    ['`hadSh` 를 실드 흡수 «뒤» 로 옮기면 (게임)',
      null, s => s.replace(/\n  const hadSh=p\.sh>0;[^\n]*\n/, '\n')
                  .replace('    const ab=Math.min(p.sh,d); p.sh-=ab; d-=ab;',
                           '    const ab=Math.min(p.sh,d); p.sh-=ab; d-=ab;\n  const hadSh=p.sh>0;')],
    ['가시 장비분의 실드 조건을 없애면 (sim)',
      s => s.replace('const thornM=px.p_thorns+(hadSh?px.g_thornSh:0);',
                     'const thornM=px.p_thorns+px.g_thornSh;'), null],
    ['가시 장비분을 특전과 «곱연산» 으로 바꾸면 (sim)',
      s => s.replace('const thornM=px.p_thorns+(hadSh?px.g_thornSh:0);',
                     'const thornM=px.p_thorns*(hadSh?1+px.g_thornSh:1);'), null],
    ['가시갑옷이 원거리에도 걸리면 (sim)',
      s => s.replace('if(thornM&&isMelee&&src)reflect', 'if(thornM&&src)reflect'), null],
    ['회피 회복의 «체력 50% 미만» 조건을 없애면 (sim)',
      s => s.replace('if(p.hp<p.maxHp*0.50) for(let i=0;i<px.g_evHeal;i++)',
                     'for(let i=0;i<px.g_evHeal;i++)'), null],
    ['회피 회복 조건을 «50% 이하» 로 바꾸면 (sim — 경계 한 칸)',
      s => s.replace('if(p.hp<p.maxHp*0.50) for', 'if(p.hp<=p.maxHp*0.50) for'), null],
    ['회피 회복을 부위마다가 아니라 «한 번만» 굴리면 (sim)',
      s => s.replace('for(let i=0;i<px.g_evHeal;i++) if(pkk(p,0.30))',
                     'if(px.g_evHeal) if(pkk(p,0.30))'), null],
    ['회피 회복을 부위마다가 아니라 «한 번만» 굴리면 (게임)',
      null, s => s.replace('for(let i=0;i<px.g_evHeal;i++) if(pkk(p,0.30))',
                           'if(px.g_evHeal) if(pkk(p,0.30))')],
    ['회복 확률·회복량을 30%/10% 에서 60%/20% 로 바꾸면 (sim)',
      s => s.replace('if(pkk(p,0.30))heal(p,p.maxHp*0.10)', 'if(pkk(p,0.60))heal(p,p.maxHp*0.20)'), null],
    ['ROUTINE 에서 주인 «회피 성공 순간 체력 비율» 절을 지우면',
      null, null],
  ];
  let caught = 0, noopN = 0;
  const real = console.log;
  for (const [nm, fsim, fhtm] of cases) {
    const mS = fsim ? fsim(simSrc) : simSrc;
    const mH = fhtm ? fhtm(htmSrc) : htmSrc;
    const mR = (!fsim && !fhtm) ? routineSrc.replace(RULE_EVHEAL, '(지워짐)') : routineSrc;
    const noop = (fsim && mS === simSrc) || (fhtm && mH === htmSrc) || (!fsim && !fhtm && mR === routineSrc);
    let bad = 0;
    if (!noop) { try { bad = run(mS, mH, mR, true); } catch (e) { bad = 1; } } else noopN++;
    const ok = !noop && bad > 0;
    if (ok) caught++;
    real(`  ${ok ? '✓' : '✗'} ${nm} → ${ok ? `빨개진다 (${bad}건)`
      : noop ? '🔴 돌연변이가 원본을 안 바꾼다 (문자열이 낡았다 = 죽은 검사)' : '🔴 안 잡힌다 (죽은 검사)'}`);
  }
  let base = 0; try { base = run(simSrc, htmSrc, routineSrc, true); } catch (e) { base = 1; }
  real(`  ${base === 0 ? '✓' : '✗'} 양성 대조군: 원본이 통과한다 (오탐 ${base}건)`);
  real(`\n[음성 검사] ${caught}/${cases.length} · no-op ${noopN} · 오탐 ${base}`);
  process.exit(caught === cases.length && noopN === 0 && base === 0 ? 0 : 1);
}

console.log('⚑⚑⚑ T137 게이트 — 장비 옵션의 «발동 조건» (주인 확정 T124 ③: 가시갑옷 실드 조건·가산 · 저체력 회피 회복)');
process.exit(run(simSrc, htmSrc, routineSrc) ? 1 : 0);
