#!/usr/bin/env node
/* ================================================================================
   verifyGearOptAgg — ⚑⚑⚑ T135 (워커 D · sess-0350-533)

   **주인 확정 T124 ③ (2026-09-04 19:2X~20:3X · ROUTINE 최상단)**
     «**같은 옵션이 여러 부위에 있으면 각각 따로 합산·발동**한다 — 풀셋 +3강 이상이면
      «치명타 시 50% 도끼» 를 6번 굴린다 … 공격력 +10% 는 **가산 합산**
      (풀셋 +9강 = 12개 × 10% = +120% · 곱연산 아님)»
   그리고 주인이 그 귀결을 손수 적어 둔 **«풀셋 +9강 합산(참고)» 표**:
     치명 세트 치확 +60 · 치피 +270 · 반격률 +60 · 치명 시 도끼 50%×6 · 흡혈 +48% · 공격력 +60%
     체력실드 세트 체력 +60% · 실드 +144% · 방어 +48 · 실드 있을 때 가시 +72% · 피격 시 도끼 50%×6 · 흡혈 +48% · 공격력 +60%
     회피 세트 회피 +48 · 체력 +48% · 실드 +120% · 회피 시 도끼 50%×6 · 흡혈 +48% · 공격력 +60%
   ⚑ T145 (주인 확정 2026-09-05 16:4X «7번째 꺼는 흡혈로 해야 할 거 같은데 8퍼로») — 7번(신화 +6강) 칸이
     «공격력 +10%» → «흡혈 +8%» 로 바뀌면서 공격력 칸은 8번 하나(6부위)만 남았다: 풀셋 +9강 공격력 +120% → +60%,
     그 자리에 흡혈 8% × 6부위 = 48%. 주인 T124 참고표의 «+120%» 는 그 시절 수다(ROUTINE 에 표시를 붙여 뒀다).

   ── 구멍을 먼저 증명했다 (T135 사본 실측) ──
   **이 18개 숫자를 재는 게이트가 한 줄도 없었다.** 장비 옵션을 «실제로 걸어 본» 게이트가 없다:
     · `verifyGearEcon` 의 «사다리 풀셋 스탯»·«풀셋 종합 전투력» 은 `buildPower()` 를 부르는데
       그 함수는 **GOPT 를 아예 안 본다** — `GT.atk/hp/sh` × 슬롯 × 강화 × 균등보너스만 곱한다.
       즉 옵션이 통째로 사라져도 `verifyGearEcon` 50항목이 글자 하나 안 움직인다.
     · `verifyOptText` 는 **설명문 ↔ 엔진 상수** 대조다 — `{d:'치명타 확률 +5'}` 옆의 `p.critR+=5` 가
       맞는지는 보지만, 그 옵션이 **몇 부위에 몇 번 걸리는지**(= 주인이 말한 «각각 따로»)는 안 본다.
     · `mkPlayer` 를 부르는 게이트는 `verifyPerkOrder`·`verifyPierceScope` 등인데 전부 **노템이거나
       등급만 준 빌드**라 `GOPT` 경로가 사실상 안 돈다(`verifyPierceScope` 는 전설 풀셋을 만들지만
       창·검기 관통만 세지 옵션 합산은 안 본다).
   사본으로 확인했다 — `p.dmg*=1+p.px.g_atkP/100` 을 **부위마다 곱연산**(`1.1^12` = +214%)으로
   되돌리거나, 적용 루프를 «같은 문구는 한 번만» 으로 바꿔(치확 60 → 10) 두 엔진에 심어도
   **정적 게이트 20종의 통과 수가 전부 그대로**였다. 주인이 «곱연산 아님» 이라고 못박은 바로 그
   경로가 조용히 뒤집혀도 아무도 안 잡는 상태였다.

   ── 그래서 이 게이트가 하는 일 ──
   대조(«설명문과 상수가 맞나»)가 아니라 **실측 동결**(«주인이 적어 둔 그 합계가 실제로 나오나»)이다.
   ⓐ 두 엔진에서 `GT`·`GOPT`·`GT.optCount` 를 꺼내 **풀셋 신화+9강 3세트**의 옵션을 실제로 걸어
      효과 벡터를 뽑고, 주인 참고표(FROZEN_SET)와 대조한다
   ⓑ **«각각 따로 합산·발동»** — 1부위만 낀 것과 6부위 풀셋을 재서 **정확히 ×6** 인가
      (중복 제거·Set 적용으로 바뀌면 여기서 빨개진다)
   ⓒ **«가산 합산 · 곱연산 아님»** — `sim.js` 의 진짜 `mkPlayer` 를 돌려 풀셋 +9강의
      공/체/실이 `buildPower × (1 + 합/100)` 과 비트 단위로 맞는가, 그리고 부위별 곱연산
      (`1.1^12` 등)과 **다른가**
   ⓓ 옵션 사다리 8단(일반1 … 신화5 · +3/+6/+9 각 +1)과 «6번 = 도끼 · 7번 = 흡혈 +8% · 8번 = 공격력 +10%» 18종 전수
   ⓔ 세트 안 6부위가 **같은 6옵션의 순열**인가 (주인 «세트마다 옵션 6개를 부위 전부 같게»)
   ⓕ 두 엔진 일치 — 효과 벡터 전 세트 · 적용부 두 줄 문면
   ⓖ ROUTINE 에 주인 문면(«각각 따로 합산·발동» · «가산 합산» · 참고표)이 살아 있다

   ── 이 표를 고쳐도 되는 때 ──
   **주인이 옵션표·합산 규칙을 새로 확정했을 때뿐이다.** 그때 FROZEN_SET 을 새 값으로 갱신하고
   PROGRESS 에 주인 원문과 함께 남긴다 — 표를 고치는 것 자체가 diff 에 드러나는 것이 요점이다.

   사용: node tools/verifyGearOptAgg.js        (exit 0 = 통과, 1 = 불합격)
   음성: node tools/verifyGearOptAgg.js --self (심은 고장 8종 + 양성 대조군)
   ================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ── 주인 «풀셋 +9강 합산(참고)» 표 (ROUTINE T124 ③) ─────────────────────────
   키는 엔진의 실제 축 이름이다. `px.g_thornSh` 만 배수(0.72 = +72%)고 나머지는 주인 표기 그대로. */
/* ⚑⚑⚑ T153 (주인 확정 2026-09-05 18:1X) — «공격력 +10%» 칸이 삭제돼 `px.g_atkP` 는 **0** 이다
   (풀셋 +9강 공격력 +60% 소멸 — 주인 확정의 산술적 귀결 · 밸런스 조정 아님). 나머지 축은 그대로다. */
const FROZEN_SET = [
  ['치명', 0, { critR: 60, critF: 270, counter: 60, 'px.g_critAxe': 6, steal: 48, 'px.g_atkP': 0 }],
  ['체력실드', 1, { def: 48, 'px.g_hpP': 60, 'px.g_shP': 144, 'px.g_thornSh': 0.72, 'px.g_hitAxe': 6, steal: 48, 'px.g_atkP': 0 }],
  ['회피', 2, { evade: 48, 'px.g_hpP': 48, 'px.g_shP': 120, 'px.g_evAxe': 6, 'px.g_evHeal': 6, steal: 48, 'px.g_atkP': 0 }],
];
/* 옵션 개수 사다리 — [등급, 강화] → 개수 (PLAN §11.1 · T124 → ⚑ T153 로 영웅 폐지 + 끝 칸 삭제 = **7단**) */
const LADDER = [[0, 0, 1], [1, 0, 2], [2, 0, 3], [3, 0, 4], [3, 3, 5], [3, 6, 6], [3, 9, 7]];

/* ROUTINE 주인 문면 — 규칙을 지우고 합산을 뒤집는 경로를 막는다 */
const RULE_EACH = /같은 옵션이 여러 부위에 있으면 각각 따로 합산·발동/;
const RULE_ADD  = /공격력 \+10% 는 \*\*가산 합산\*\*/;
const RULE_TBL  = /풀셋 \+9강 합산\(참고\)/;

/* 두 엔진 공통 적용부 — 한 줄이라도 갈라지면 게임과 시뮬이 다른 플레이어를 만든다 */
const APPLY_LINES = [
  '    for(let i=0;i<n&&i<tbl.length;i++) tbl[i].ap(p);',
  '  p.dmg*=1+p.px.g_atkP/100; p.maxHp*=1+p.px.g_hpP/100; p.maxSh*=1+p.px.g_shP/100;',
];

/* ================================================================
   `GT` · `GT.optCount` · `GOPT` 블록만 잘라 vm 에서 돌린다.
   sim.js 는 CLI 디스패처가, index.html 은 DOM 이 통째 평가를 막는다 —
   verifyEnemyFreeze.loadEnemy 와 같은 «필요한 블록만» 방식.
   ================================================================ */
function loadOpt(src) {
  const L = src.split('\n');
  const cut = (startRe, endLine) => {
    const a = L.findIndex(l => startRe.test(l));
    if (a < 0) return null;
    const b = L.findIndex((l, i) => i > a && l === endLine);
    return b < 0 ? null : L.slice(a, b + 1).join('\n');
  };
  const gt = cut(/^const GT=\{/, '};');
  const gopt = cut(/^const GOPT=\{/, '};');
  const oc = cut(/^GT\.optCount=/, '};');
  /* ⚑ T153 — 등급 인덱스 상수(GT.RAR_LEGEND/RAR_MYTH)는 GT 리터럴 «뒤» 줄이라 따로 실어야
     optCount 가 신화를 알아본다(안 실으면 조용히 undefined 가 되어 벡터가 텅 빈다). */
  const rarLine = L.find(l => /^GT\.RAR_LEGEND=/.test(l)) || '';
  if (!gt || !gopt || !oc || !rarLine) return null;
  try {
    return vm.runInNewContext(`${gt}\n${rarLine}\n${oc}\n${gopt}\n;({GT,GOPT})`,
      { Math, JSON, process: { env: {} } });
  } catch (e) { return null; }
}

/* 옵션 `ap` 가 건드리는 축을 전부 기록하는 가짜 플레이어 (엔진의 어떤 필드든 0 에서 시작한다) */
function recorder() {
  const px = new Proxy({}, { get: (t, k) => (k in t ? t[k] : 0), set: (t, k, v) => { t[k] = v; return true; } });
  const p = new Proxy({ px }, {
    get: (t, k) => (k === 'px' ? px : (k in t ? t[k] : 0)),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  return { p, dump() {
    const o = {};
    for (const k of Object.keys(p)) if (k !== 'px' && p[k]) o[k] = p[k];
    for (const k of Object.keys(px)) if (px[k]) o['px.' + k] = px[k];
    return o;
  } };
}
/* 세트 ti 를 `parts` 개 부위에 rar/plus 로 껴서 나온 효과 벡터 */
function wear(X, ti, rar, plus, parts) {
  const { p, dump } = recorder();
  for (const pt of (parts || X.GT.parts)) {
    const tbl = X.GOPT[X.GT.types[pt][ti]];
    const n = X.GT.optCount(rar, plus);
    for (let i = 0; i < n && i < tbl.length; i++) tbl[i].ap(p);
  }
  return dump();
}
const near = (a, b) => Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 1e-12);
const vecEq = (g, w) => {
  const ks = new Set([...Object.keys(g), ...Object.keys(w)]);
  for (const k of ks) if (!near(g[k] || 0, w[k] || 0)) return false;
  return true;
};
const show = v => Object.keys(v).sort().map(k => `${k}=${v[k]}`).join(' · ') || '(빈 벡터)';

/* ================================================================ */
const R = [];
const chk = (name, pass, detail) => R.push({ name, c: !!pass, d: detail });

function run(simSrc, htmSrc, routineSrc, quiet) {
  R.length = 0;
  const say = quiet ? () => {} : console.log;

  const E = [['sim.js', loadOpt(simSrc)], ['index.html', loadOpt(htmSrc)]];
  for (const [nm, X] of E) if (!X) chk(`${nm} 에서 GT·GOPT·optCount 추출`, false, '블록을 못 찾았다 — 엔진 구조가 바뀌었으면 loadOpt 를 함께 고칠 것');
  if (E.some(([, X]) => !X)) return finish(say, quiet);

  /* ===== ⓐ 주인 참고표 실측 동결 (풀셋 신화+9강 × 3세트 × 2엔진) ===== */
  say('\n=== ⓐ 주인 «풀셋 +9강 합산(참고)» 표 실측 동결 ===');
  for (const [nm, X] of E) {
    for (const [sn, ti, want] of FROZEN_SET) {
      const got = wear(X, ti, X.GT.RAR_MYTH, 9);
      chk(`${nm} ${sn} 세트 풀셋 +9강 합산`, vecEq(got, want),
          `동결 «${show(want)}» ≠ 실측 «${show(got)}»`);
    }
  }

  /* ===== ⓑ «같은 옵션이 여러 부위에 있으면 각각 따로 합산·발동» ===== */
  say('\n=== ⓑ 부위마다 따로 걸린다 (1부위 → 6부위 = 정확히 ×6) ===');
  for (const [nm, X] of E) {
    for (const [sn, ti] of FROZEN_SET) {
      const one = wear(X, ti, X.GT.RAR_MYTH, 9, [X.GT.parts[0]]);
      const six = wear(X, ti, X.GT.RAR_MYTH, 9);
      const ks = new Set([...Object.keys(one), ...Object.keys(six)]);
      const off = [];
      for (const k of ks) if (!near(six[k] || 0, (one[k] || 0) * 6)) off.push(`${k} 1부위 ${one[k] || 0} → 6부위 ${six[k] || 0} (×6 이면 ${(one[k] || 0) * 6})`);
      chk(`${nm} ${sn} 세트 — 6부위가 1부위의 정확히 6배`, off.length === 0,
          off.length ? `${off.length}축 어긋남 — ${off.slice(0, 3).join(' / ')}` : `${ks.size}축 전부 ×6`);
    }
    /* 발동 옵션(도끼)은 «몇 번 굴리는가» 자체가 주인 문면이다 — 풀셋 +3강에서 이미 6이어야 한다 */
    for (const [sn, ti, want] of FROZEN_SET) {
      const axeKey = Object.keys(want).find(k => /Axe$/.test(k));
      const v3 = wear(X, ti, X.GT.RAR_MYTH, 6);   /* ⚑ T153 — 도끼 자리가 +3강 → +6강으로 밀렸다 */
      chk(`${nm} ${sn} 세트 — 풀셋 +6강에서 도끼를 6번 굴린다 (${axeKey} · ⚑ T153)`, near(v3[axeKey] || 0, 6),
          `${axeKey}=${v3[axeKey] || 0} (주인: «부위마다 따로 굴린다» — ⚑ T153 로 도끼 해금이 +3강 → +6강)`);
    }
  }

  /* ===== ⓒ «가산 합산 · 곱연산 아님» — 진짜 mkPlayer 로 끝까지 ===== */
  say('\n=== ⓒ 퍼센트 옵션은 가산 합산이다 (sim.js mkPlayer 실측) ===');
  {
    const CUT = 'const mode=process.argv[2]';
    const at = simSrc.indexOf(CUT);
    if (at < 0) chk('sim.js CLI 디스패처 경계', false, `«${CUT}» 를 못 찾았다 — 잘림 기준이 바뀌었다`);
    else {
      let api = null;
      try {
        const ctx = { console: { log() {} }, Math, Set, Map, JSON, process: { env: {} } };
        vm.createContext(ctx);
        vm.runInContext(simSrc.slice(0, at) + '\n;globalThis.__api={mkPlayer,buildPower,GT};', ctx);
        api = ctx.__api;
      } catch (e) { chk('sim.js 엔진 로드', false, String(e.message || e)); }
      if (api) {
        const X = E[0][1];
        for (const [sn, ti, want] of FROZEN_SET) {
          const build = { eq: {}, slots: {} };
          for (const pt of api.GT.parts) { build.eq[pt] = { rar: api.GT.RAR_MYTH, plus: 9, part: pt, type: api.GT.types[pt][ti] }; build.slots[pt] = 0; }
          const base = api.buildPower(build);
          const p = api.mkPlayer(build, { chapter: 1, player: null, nodes: [], taken: [], t: 0 });
          const AXES = [['공격력', 'dmg', 'g_atkP', base.atk], ['최대 체력', 'maxHp', 'g_hpP', base.hp], ['최대 실드', 'maxSh', 'g_shP', base.sh]];
          for (const [an, pk, xk, b] of AXES) {
            const pct = want['px.' + xk] || 0;
            const add = b * (1 + pct / 100);
            const mul = b * Math.pow(1.1, pct / 10);           /* 부위별 곱연산이었을 때의 값 */
            const got = pk === 'maxSh' ? p[pk] : p[pk];
            const okAdd = Math.abs(got - (pk === 'maxSh' ? Math.round(add) : add)) <= Math.max(1e-6, Math.abs(add) * 1e-12);
            chk(`${sn} 세트 ${an} = 장비치 × (1 + ${pct}/100) — 가산`, okAdd,
                `실측 ${got} ≠ 가산 ${pk === 'maxSh' ? Math.round(add) : add} (곱연산이면 ${mul.toFixed(3)})`);
            if (pct > 0) chk(`${sn} 세트 ${an} 이 부위별 곱연산이 아니다 (1.1^${pct / 10} 배 아님)`,
                Math.abs(got - mul) > Math.abs(b) * 1e-6, `실측 ${got} 이 곱연산값 ${mul.toFixed(3)} 과 같다 — 주인 «곱연산 아님» 위반`);
          }
        }
        /* 노템은 옵션이 0 이므로 기본치 그대로여야 한다 (가산식이 상수를 흘리지 않는지) */
        const nt = api.mkPlayer({ eq: {}, slots: {} }, { chapter: 1, player: null, nodes: [], taken: [], t: 0 });
        const nb = api.buildPower({ eq: {}, slots: {} });
        chk('노템은 옵션 0 — 공/체/실이 기본치 그대로', near(nt.dmg, nb.atk) && near(nt.maxHp, nb.hp) && near(nt.maxSh, Math.round(nb.sh)),
            `공 ${nt.dmg}/${nb.atk} · 체 ${nt.maxHp}/${nb.hp} · 실 ${nt.maxSh}/${Math.round(nb.sh)}`);
        void X;
      }
    }
  }

  /* ===== ⓓ 옵션 사다리 8단 + 6번 도끼 · 7·8번 공격력 (18종 전수) ===== */
  say('\n=== ⓓ 옵션 사다리 8단 · 6번 = 도끼 · 7번 = 흡혈 +8% · 8번 = 공격력 +10% ===');
  for (const [nm, X] of E) {
    const off = LADDER.filter(([r, pl, n]) => X.GT.optCount(r, pl) !== n)
                      .map(([r, pl, n]) => `등급${r}+${pl}강 → ${X.GT.optCount(r, pl)} (기대 ${n})`);
    chk(`${nm} 옵션 개수 사다리 8단 (1·2·3·4·5·6·7·8)`, off.length === 0,
        off.length ? off.join(' / ') : LADDER.map(x => x[2]).join('·'));
    const types = X.GT.parts.flatMap(pt => X.GT.types[pt]);
    const bad6 = types.filter(t => !/도끼/.test(X.GOPT[t][5].d));
    chk(`${nm} 6번째(⚑ T153 신화+6강) 옵션이 «도끼» 다 — 18종 전수`, bad6.length === 0,
        bad6.length ? `${bad6.length}종 — ${bad6.slice(0, 3).join(', ')}` : `${types.length}종`);
    /* ⚑⚑⚑ T153 — 맨 끝 «공격력 +10%» 칸이 삭제되면서 «흡혈 +8%» 가 마지막 7번(신화 +9강) 자리로 옮겨졌다 */
    const bad7 = types.filter(t => X.GOPT[t][6].d !== '흡혈 +8%');
    chk(`${nm} 7번째(신화+9강 · 마지막) 가 «흡혈 +8%» 다 — 18종 전수 (⚑ T145 → T153)`, bad7.length === 0,
        bad7.length ? `${bad7.length}종 — ${bad7.slice(0, 3).join(', ')}` : `${types.length}종`);
    const bad7ap = types.filter(t => !/p\.steal\s*\+=\s*8\b/.test(String(X.GOPT[t][6].ap)));
    chk(`${nm} 7번째 흡혈이 «p.steal += 8» 로 걸린다 — 18종 전수 (부위마다 가산)`, bad7ap.length === 0,
        bad7ap.length ? `${bad7ap.length}종 — ${bad7ap.slice(0, 3).join(', ')}` : `${types.length}종`);
    const nAtk = types.filter(t => X.GOPT[t].some(o => o.d === '공격력 +10%'));
    chk(`${nm} ⚑ T153 «공격력 +10%» 옵션이 한 칸도 없다 (주인 «신화 강화 +9 부분 현재 꺼 빼고»)`, nAtk.length === 0,
        nAtk.length ? `${nAtk.length}종에 남아 있다 — ${nAtk.slice(0, 3).join(', ')}` : `${types.length}종 × 0칸`);
    const badLen = types.filter(t => X.GOPT[t].length !== 7);
    chk(`${nm} 모든 종류가 옵션 7칸이다 (⚑ T153)`, badLen.length === 0, badLen.join(', ') || `${types.length}종 × 7칸`);
  }

  /* ===== ⓔ 세트 안 6부위 = 같은 6옵션의 순열 ===== */
  say('\n=== ⓔ 세트마다 옵션 6개를 부위 전부 같게 (순서만 셔플) ===');
  for (const [nm, X] of E) {
    for (const [sn, ti] of FROZEN_SET) {
      const sets = X.GT.parts.map(pt => X.GOPT[X.GT.types[pt][ti]].slice(0, 6).map(o => o.d).sort().join('|'));
      const same = sets.every(s => s === sets[0]);
      chk(`${nm} ${sn} 세트 — 6부위가 같은 6옵션을 쓴다`, same,
          same ? '6부위 동일' : `부위별 옵션 집합이 갈라졌다 — ${sets.map((s, i) => X.GT.parts[i] + ':' + s.slice(0, 24)).slice(0, 2).join(' / ')}`);
      const fixedF = X.GT.parts.every(pt => X.GOPT[X.GT.types[pt][ti]][5].d === X.GOPT[X.GT.types[X.GT.parts[0]][ti]][5].d);
      chk(`${nm} ${sn} 세트 — f(6번)는 전 부위 고정 (주인 «도끼는 무조건 6번째»)`, fixedF, fixedF ? '고정' : '부위마다 다르다');
    }
  }

  /* ===== ⓕ 두 엔진 일치 ===== */
  say('\n=== ⓕ sim.js ↔ index.html ===');
  {
    const [, S] = E[0], [, H] = E[1];
    const off = [];
    for (const [sn, ti] of FROZEN_SET) {
      for (const [r, pl] of LADDER.map(([a, b]) => [a, b])) {
        const a = wear(S, ti, r, pl), b = wear(H, ti, r, pl);
        if (!vecEq(a, b)) off.push(`${sn} 등급${r}+${pl}강 — sim «${show(a)}» ≠ html «${show(b)}»`);
      }
    }
    chk('두 엔진 효과 벡터 전 표본 동일 (3세트 × 사다리 8단)', off.length === 0,
        off.length ? `${off.length}칸 — ${off.slice(0, 2).join(' / ')}` : `${FROZEN_SET.length * LADDER.length}칸`);
    for (const ln of APPLY_LINES) {
      const inS = simSrc.includes(ln), inH = htmSrc.includes(ln);
      chk(`적용부 «${ln.trim().slice(0, 42)}…» 가 두 엔진에 그대로 있다`, inS && inH,
          `sim ${inS ? 'OK' : '✗'} · index.html ${inH ? 'OK' : '✗'} — 합산 경로가 갈라졌다`);
    }
  }

  /* ===== ⓖ ROUTINE 주인 문면 ===== */
  say('\n=== ⓖ 주인 문면이 ROUTINE 에 살아 있다 ===');
  chk('«같은 옵션이 여러 부위에 있으면 각각 따로 합산·발동»', RULE_EACH.test(routineSrc), '문장이 사라졌다 — 규칙을 지우고 합산을 뒤집는 경로다');
  chk('«공격력 +10% 는 가산 합산»', RULE_ADD.test(routineSrc), '문장이 사라졌다');
  chk('«풀셋 +9강 합산(참고)» 표', RULE_TBL.test(routineSrc), '주인이 적어 둔 참고표가 사라졌다 — 이 게이트의 동결 근거다');

  return finish(say, quiet);
}

function finish(say, quiet) {
  if (!quiet) for (const x of R) say(`  ${x.c ? '✓' : '✗'} ${x.name}${x.c ? '' : '  — ' + x.d}`);
  return R.filter(x => !x.c).length;
}

/* ================================================================ */
const simSrc = rd('sim.js');
const htmSrc = rd('index.html');
const routineSrc = rd('docs/ROUTINE.md');

if (process.argv.includes('--self')) {
  /* 음성 검사 — 심은 고장을 이 게이트가 실제로 잡는가.
     T126 규약: 돌연변이가 no-op(치환이 안 먹음)이면 그것부터 빨갛게 떨어뜨린다. */
  console.log('[음성 검사] 장비 옵션 합산을 몰래 뒤집은 사본에서 이 게이트가 빨개지는가');
  const MUL = 'p.dmg*=Math.pow(1.1,p.px.g_atkP/10); p.maxHp*=Math.pow(1.1,p.px.g_hpP/10); p.maxSh*=Math.pow(1.1,p.px.g_shP/10);';
  const DEDUP = '    {const seen=new Set();for(let i=0;i<n&&i<tbl.length;i++){if(seen.has(tbl[i].d))continue;seen.add(tbl[i].d);tbl[i].ap(p);}}';
  const cases = [
    ['퍼센트 옵션을 부위별 곱연산으로 되돌리면 (주인 «곱연산 아님» 위반 · +120% → +214%)',
      s => s.replace(APPLY_LINES[1].trim(), MUL), s => s.replace(APPLY_LINES[1].trim(), MUL), null],
    ['«같은 문구는 한 번만» 으로 중복을 없애면 (치확 60 → 10 · 도끼 6 → 1)',
      s => s.replace(APPLY_LINES[0], DEDUP), s => s.replace(APPLY_LINES[0], DEDUP), null],
    ['도끼를 누적이 아니라 대입으로 바꾸면 (6번 → 1번 굴림)',
      s => s.split('p.px.g_critAxe++').join('p.px.g_critAxe=1'),
      s => s.split('p.px.g_critAxe++').join('p.px.g_critAxe=1'), null],
    ['치명 무기 옵션 하나만 슬쩍 낮추면 (치피 +25 → +20)',
      s => s.replace("{d:'치명타 피해 +25', ap:p=>p.critF+=25},\n    {d:'치명타 시 50% 확률로 도끼 1개', ap:p=>p.px.g_critAxe++},\n    {d:'흡혈 +8%', ap:p=>p.steal+=8},\n  ],\n  crit_helm:",
                     "{d:'치명타 피해 +25', ap:p=>p.critF+=20},\n    {d:'치명타 시 50% 확률로 도끼 1개', ap:p=>p.px.g_critAxe++},\n    {d:'흡혈 +8%', ap:p=>p.steal+=8},\n  ],\n  crit_helm:"),
      s => s.replace("{d:'치명타 피해 +25', ap:p=>p.critF+=25},\n    {d:'치명타 시 50% 확률로 도끼 1개', ap:p=>p.px.g_critAxe++},\n    {d:'흡혈 +8%', ap:p=>p.steal+=8},\n  ],\n  crit_helm:",
                     "{d:'치명타 피해 +25', ap:p=>p.critF+=20},\n    {d:'치명타 시 50% 확률로 도끼 1개', ap:p=>p.px.g_critAxe++},\n    {d:'흡혈 +8%', ap:p=>p.steal+=8},\n  ],\n  crit_helm:"), null],
    ['방어 +8 을 특전처럼 곱연산 축으로 옮기면 (풀셋 +48 → 0)',
      s => s.split('ap:p=>p.def+=8').join('ap:p=>p.px.g_defM=(p.px.g_defM||1)*1.08'),
      s => s.split('ap:p=>p.def+=8').join('ap:p=>p.px.g_defM=(p.px.g_defM||1)*1.08'), null],
    ['옵션 사다리에서 +9강 한 칸을 없애면 (8단 → 7단)',
      s => s.replace('if(plus>=6)n++; if(plus>=9)n++;', 'if(plus>=6)n++;'),
      s => s.replace('if(plus>=6)n++; if(plus>=9)n++;', 'if(plus>=6)n++;'), null],
    ['index.html 만 흔들면 (두 엔진이 갈라진다)',
      null, s => s.split('ap:p=>p.evade+=8').join('ap:p=>p.evade+=6'), null],
    /* ⚑ T145 — 7번을 옛 «공격력 +10%» 로 되돌리는 경로 */
    ['7번(신화+6강)을 옛 «공격력 +10%» 로 되돌리면 (주인 확정 T145 위반 · 흡혈 48% → 0 · 공격력 +60% → +120%)',
      s => s.split("{d:'흡혈 +8%', ap:p=>p.steal+=8},").join("{d:'공격력 +10%', ap:p=>p.px.g_atkP+=10},"),
      s => s.split("{d:'흡혈 +8%', ap:p=>p.steal+=8},").join("{d:'공격력 +10%', ap:p=>p.px.g_atkP+=10},"), null],
    ['흡혈을 부위마다 가산이 아니라 대입으로 바꾸면 (풀셋 48 → 8)',
      s => s.split('ap:p=>p.steal+=8').join('ap:p=>p.steal=8'),
      s => s.split('ap:p=>p.steal+=8').join('ap:p=>p.steal=8'), null],
    ['ROUTINE 에서 «각각 따로 합산·발동» 문장을 지우면',
      null, null, s => s.replace('같은 옵션이 여러 부위에 있으면 각각 따로 합산·발동', '같은 옵션은 부위와 무관하게 한 번만 적용')],
  ];
  let caught = 0, noop = 0;
  for (const [why, mS, mH, mR] of cases) {
    const s2 = mS ? mS(simSrc) : simSrc;
    const h2 = mH ? mH(htmSrc) : htmSrc;
    const r2 = mR ? mR(routineSrc) : routineSrc;
    if ((mS && s2 === simSrc) || (mH && h2 === htmSrc) || (mR && r2 === routineSrc)) {
      console.log(`  ✗ 음성 «${why}» — 치환이 안 먹었다 (no-op · 심을 자리가 사라졌으면 이 케이스를 고칠 것)`);
      noop++; continue;
    }
    const bad = run(s2, h2, r2, true);
    if (bad > 0) { console.log(`  ✓ 음성 «${why}» → 불합격 ${bad}건`); caught++; }
    else console.log(`  ✗ 음성 «${why}» → 아무것도 안 잡혔다 (동결이 죽었다)`);
  }
  const base = run(simSrc, htmSrc, routineSrc, true);
  base === 0 ? console.log(`  ✓ 양성 대조군 — 원본 ${R.length}항목 전부 통과 (오탐 0)`)
             : console.log(`  ✗ 양성 대조군 — 원본에서 ${base}건 불합격 (오탐)`);
  console.log(`\n[음성 검사] ${caught}/${cases.length} · no-op ${noop} · 오탐 ${base}`);
  process.exit(caught === cases.length && noop === 0 && base === 0 ? 0 : 1);
}

console.log('[T135 장비 옵션 합산 게이트] 주인 «각각 따로 합산·발동 · 공격력 +10% 는 가산» 과 «풀셋 +9강 합산(참고)» 표를 지킨다');
const bad = run(simSrc, htmSrc, routineSrc, false);
console.log(`\n[장비 옵션 합산 게이트] 대조 ${R.length}항목 · 통과 ${R.length - bad} · 불합격 ${bad}`);
if (bad) {
  console.log('→ 실패: 장비 옵션 합산이 주인 참고표에서 움직였다.');
  console.log('  주인이 옵션표·합산 규칙을 새로 확정했다면 이 파일의 FROZEN_SET 을 갱신하고');
  console.log('  PROGRESS 에 주인 원문과 함께 남길 것. 지시가 없었다면 엔진을 되돌릴 것.');
  process.exit(1);
}
console.log('→ 통과 (풀셋 합산 3세트 × 2엔진 · 부위 ×6 · 가산 실측 · 사다리 7단 · 18종 전수 · 두 엔진 일치 · 주인 문면)');
