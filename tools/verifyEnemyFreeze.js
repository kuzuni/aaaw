#!/usr/bin/env node
/* ================================================================================
   verifyEnemyFreeze — ⚑⚑⚑ T132 (워커 A · sess-0305-25176)

   **주인 상시 규칙 (ROUTINE 최상단 · 2026-09-04 20:5X)**
     «적 스탯(기저·구간률·벽)은 주인이 «맞춰라» 라고 명시하기 전까지 한 글자도 건드리지 않는다.
      재적합·미세 조정 전부 하지 않는다.»

   이 규칙은 주인이 **실제로 어긴 것을 되돌리며** 세운 규칙이다 — T119 가 3택·새 특전 조건으로
   적 스탯을 다시 맞췄고, 주인이 «맞추라 한 적이 없는데 왜 맞췄노» 로 T120 에서 전부 되돌렸다.
   그런데 **그 규칙을 지키는 게이트가 한 줄도 없었다.**

   ── 구멍을 먼저 증명했다 (T132 사본 실측) ──
   `TUNE.eBaseHp 50.174688 → 44` · `eBaseDmg 9.330519 → 8.1` · `wallHp 1.5 → 1.8` · `wallDmg 1.25 → 1.40`
   을 **두 엔진 + PLAN §6 문면까지 같이** 바꾼 사본(= 실제 «재적합» 이 하는 모양 그대로)에서:
     · 정적 게이트 19종의 결과가 **원본과 글자 하나 다르지 않았다** (18 초록 · verifyScoreCriteria 56/8)
     · `verifyPlanConst` 는 PLAN↔엔진 **일치**만 보므로 둘을 같이 고치면 초록이다
     · `verifyScoreCriteria` ⓖ 는 **자(尺)의 배선**(perkMode·PERKS_BASE10)만 보지 적 스탯은 안 본다
     · `verifyScoreCriteria` ⓓ 실측 8칸은 이미 **전부 0.0%** 로 바닥에 붙어 있어(승인 대기 52번)
       적을 어느 쪽으로 흔들어도 «0.0%» 그대로다 — **불합격 8건이 글자 하나 안 움직인다**
   즉 지금 리포는 «적 스탯이 조용히 바뀌어도 아무도 못 잡는» 상태였다.

   ── 그래서 이 게이트가 하는 일 ──
   PLAN 대조(«둘이 서로 맞나»)가 아니라 **동결**(«주인이 확정한 그 값 그대로인가»)이다.
   ⓐ 적 스탯 노브 21개를 두 엔진에서 꺼내 아래 FROZEN 표와 대조
   ⓑ `enemyStats(c,w)` 를 **실제로 돌려** 44개 표본(구간 경계 8개·벽 4개 전후 · w=0/3)의
      HP·DMG 를 동결값과 대조 — 상수를 안 건드리고 **수식을 재구성**해도(웨이브 항 제거·
      벽 임계 이동·새 배수 추가) 여기서 빨개진다
   ⓒ 두 엔진이 같은 값을 낸다 (한쪽만 흔드는 경우)
   ⓓ ROUTINE 에 상시 규칙 문면이 살아 있다 (규칙을 지우고 고치는 경로)

   ── 이 표를 고쳐도 되는 때 ──
   **주인이 «맞춰라» 라고 명시했을 때뿐이다.** 그때는 이 파일의 FROZEN 표를 새 값으로 갱신하고
   PROGRESS 에 «주인 지시 원문 + 바뀐 값» 을 남긴다. 표를 고치는 것 자체가 diff 에 드러나는 것이
   이 게이트의 요점이다 — 조용히 바뀌는 것만 막는다.

   음성 검사: `node tools/verifyEnemyFreeze.js --self` (심은 고장 7종 + 양성 대조군)
   ================================================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ================================================================
   동결표 — 주인 확정 적 스탯 (PLAN §6 «확정값» · §11.7 구간표 · T103 재적합이 마지막)
   ⚠ 주인의 «맞춰라» 명시 없이 이 표를 고치는 것은 상시 규칙 위반이다.
   ================================================================ */
const FROZEN = {
  /* ⚑⚑⚑ T168 재적합 (주인 확정 2026-09-05 23:4X — «보스 체력 4배 · 공격력 1.5배 … 그 기준으로 밸런스
     잡아 봐». 상시 규칙의 명시 예외이고, 보스 배수 교체가 그 근거다).
     보스가 ×8·×1.8 → ×4·×1.5 로 약해져 사다리 7칸이 통째로 위로 떴다(94.7 / 90.7 / 73.8 / 47.2 /
     23.7 / 23.5 / 22.3%). T160 과 같은 자·같은 절차로 **기저와 구간률만** 다시 잘랐다 —
     구간 경계(3·7·15·30·60·100)와 벽은 한 글자도 안 움직였다
     (10 벽 1.5/1.25 · 15 벽 꺼짐 · 90 벽 2.0/1.5 · 최종 벽 꺼짐 · 위치 420).
     ⚑ 1칸(챕터 3)은 정수 반올림 계단이 커서 공통 배수로 10% 를 못 짚는다(12.7% ↔ 7.1%) —
     **HP 기저만 ×1.010** 올리고 그만큼을 `3→7` HP 률에서 뺐다(챕터 7 이상 불변 · 실측 10.7%).
     종전 동결값(T160): 기저 49.283586 / 9.164809 · HP 률 3→7 = 1.143045.
     종전 동결값(T103): 기저 50.174688 / 9.330519 · 경계 5·15·28·40·70·150·380. */
  eBaseHp: 60.74137,  eBaseDmg: 11.183669,     /* 기저 (§6 확정값 · ⚑ T168) */
  waveHp: 0.15,       waveDmg: 0.08,           /* 웨이브 인덱스당 */
  wallHp: 1.5,        wallDmg: 1.25,           /* 10챕터 벽 */
  wall2Hp: 1,         wall2Dmg: 1,             /* 15챕터 벽 (꺼짐) */
  wall3Hp: 2,         wall3Dmg: 1.5,           /* 90챕터 대형 벽 */
  wall4Hp: 1,         wall4Dmg: 1,             /* 최종 벽 (꺼짐 — T103) */
  wall4At: 420,                                /* 최종 벽 위치 (T103 주인 정정 600 → 420) */
  eHpSeg:  [[0,1.0292],[3,1.127299],[7,1.034852],[15,1.105925],[30,1.075893],[60,1.075349],[100,1.022512]],
  eDmgSeg: [[0,1.0265],[3,1.128623],[7,1.034852],[15,1.100368],[30,1.051697],[60,1.069769],[100,1.024425]],
};

/* 동작 동결 — enemyStats(c,w) 실측 [챕터, 웨이브, HP, DMG].
   ⚑ T160 — 표본 챕터는 새 구간 경계(3·7·15·30·60·100)와 벽(10·15·90·420) **직전·직후**를 다 덮는다:
   상수를 그대로 두고 임계만 옮겨도(예: c>=10 → c>=12) 여기서 걸리게 하려는 것. */
const FROZEN_STATS = [
  [1,0,61,11],[1,3,88,14],[2,0,63,11],[2,3,91,14],[3,0,64,12],[3,3,93,15],
  [6,0,92,17],[6,3,134,21],[7,0,104,19],[7,3,151,24],[9,0,111,20],[9,3,161,25],
  [10,0,173,26],[10,3,250,33],[14,0,198,30],[14,3,287,38],[15,0,205,31],[15,3,297,39],
  [29,0,839,120],[29,3,1217,149],[30,0,928,132],[30,3,1346,164],[59,0,7744,569],[59,3,11228,706],
  [60,0,8331,599],[60,3,12080,742],[89,0,68493,4233],[89,3,99316,5249],[90,0,147309,6792],[90,3,213598,8422],
  [99,0,283252,12463],[99,3,410716,15454],[100,0,304595,13333],[100,3,441663,16532],[124,0,519714,23792],[124,3,753586,29503],
  [125,0,531414,24374],[125,3,770551,30223],[200,0,2822047,148912],[200,3,4091968,184651],[300,0,26146017,1663211],[300,3,37911725,2062382],
  [419,0,369782836,29382411],[419,3,536185112,36434189],[420,0,378107387,30100076],[420,3,548255712,37324094],
  [500,0,2244337897,207482305],[500,3,3254289950,257278059],
];

/* ROUTINE 상시 규칙 문면 — 규칙을 지우고 스탯을 고치는 경로를 막는다 */
const RULE_RE = /적\s*스탯\(기저·구간률·벽\)은\s*주인이\s*«맞춰라»\s*라고\s*명시하기\s*전까지\s*한\s*글자도\s*건드리지\s*않는다/;

/* ================================================================
   두 엔진에서 `TUNE` 과 `enemyStats` 를 꺼낸다.
   sim.js 는 하단 CLI 디스패처가 있고 index.html 은 HTML 이라 통째 평가가 안 된다 —
   `const TUNE={` … `};` 블록과 `function segRate` … `enemyStats` 끝 블록만 잘라 vm 에서 돌린다
   (verifyChapterFixed 의 loadLayout 과 같은 방식).
   ================================================================ */
function loadEnemy(src) {
  const lines = src.split('\n');
  const t0 = lines.findIndex(l => l.startsWith('const TUNE={'));
  const t1 = lines.findIndex((l, i) => i > t0 && l === '};');
  const s0 = lines.findIndex((l, i) => i > t1 && l.startsWith('function segRate'));
  const e0 = lines.findIndex((l, i) => i > s0 && l.startsWith('function enemyStats'));
  const e1 = lines.findIndex((l, i) => i > e0 && l === '}');
  if (t0 < 0 || t1 < 0 || s0 < 0 || e0 < 0 || e1 < 0) return null;
  const code = lines.slice(t0, t1 + 1).join('\n') + '\n' +
               lines.slice(s0, e1 + 1).join('\n') + '\n;({enemyStats,TUNE})';
  try { return vm.runInNewContext(code, { Math }); } catch (e) { return null; }
}

const R = [];
function chk(name, pass, detail) { R.push({ name, c: !!pass, d: detail }); }

function run(simSrc, htmSrc, routineSrc, quiet) {
  R.length = 0;
  const say = quiet ? () => {} : console.log;

  const E = [['sim.js', loadEnemy(simSrc)], ['index.html', loadEnemy(htmSrc)]];
  for (const [nm, X] of E) {
    if (!X) { chk(`${nm} 에서 TUNE·enemyStats 추출`, false, '블록을 못 찾았다 — 엔진 구조가 바뀌었으면 loadEnemy 를 함께 고칠 것'); }
  }
  if (E.some(([, X]) => !X)) return finish(say, quiet);

  /* ===== ⓐ 노브 동결 ===== */
  say('\n=== ⓐ 적 스탯 노브 동결 (두 엔진 × 21개) ===');
  for (const [nm, X] of E) {
    for (const k of Object.keys(FROZEN)) {
      const want = FROZEN[k], got = X.TUNE[k];
      const same = Array.isArray(want)
        ? Array.isArray(got) && got.length === want.length &&
          got.every((s, i) => Array.isArray(s) && s.length === 2 && s[0] === want[i][0] && s[1] === want[i][1])
        : got === want;
      chk(`${nm} TUNE.${k}`, same, `동결 ${JSON.stringify(want)} ≠ 실제 ${JSON.stringify(got)}`);
    }
  }

  /* ===== ⓑ 동작 동결 — 상수를 안 건드리고 수식을 바꿔도 잡는다 ===== */
  say(`\n=== ⓑ enemyStats 실측 동결 (표본 ${FROZEN_STATS.length}개 · 구간 경계·벽 전후) ===`);
  for (const [nm, X] of E) {
    const off = [];
    for (const [c, w, hp, dmg] of FROZEN_STATS) {
      let g; try { g = X.enemyStats(c, w); } catch (e) { off.push(`c${c}w${w} 예외 ${e.message}`); continue; }
      if (g.hp !== hp || g.dmg !== dmg) off.push(`c${c}w${w} 동결 ${hp}/${dmg} ≠ 실제 ${g.hp}/${g.dmg}`);
    }
    chk(`${nm} 적 HP·DMG 가 동결값 그대로다`, off.length === 0,
        off.length ? `${off.length}칸 어긋남 — ${off.slice(0, 3).join(' / ')}${off.length > 3 ? ' …' : ''}` : `${FROZEN_STATS.length}칸 전부 일치`);
  }

  /* ===== ⓒ 두 엔진 일치 (한쪽만 흔드는 경우) ===== */
  say('\n=== ⓒ 두 엔진이 같은 적을 낸다 ===');
  {
    const [, S] = E[0], [, H] = E[1];
    const off = [];
    for (const [c, w] of FROZEN_STATS) {
      const a = S.enemyStats(c, w), b = H.enemyStats(c, w);
      if (a.hp !== b.hp || a.dmg !== b.dmg) off.push(`c${c}w${w} sim ${a.hp}/${a.dmg} ≠ html ${b.hp}/${b.dmg}`);
    }
    chk('sim.js ↔ index.html 적 스탯 전 표본 동일', off.length === 0,
        off.length ? `${off.length}칸 — ${off.slice(0, 3).join(' / ')}` : `${FROZEN_STATS.length}칸`);
  }

  /* ===== ⓓ 상시 규칙 문면 ===== */
  say('\n=== ⓓ 주인 상시 규칙이 ROUTINE 에 살아 있다 ===');
  chk('ROUTINE 최상단 «적 스탯 … 한 글자도 건드리지 않는다» 문면', RULE_RE.test(routineSrc),
      '규칙 문장이 사라졌다 — 규칙을 지우고 스탯을 고치는 경로다');

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
  console.log('[음성 검사] 적 스탯을 몰래 흔든 사본에서 이 게이트가 빨개지는가');
  const both = (a, b) => [s => s.split(a).join(b), s => s.split(a).join(b)];
  const cases = [
    ['기저 HP·DMG 를 재적합하듯 두 엔진 다 바꾸면 (PLAN 까지 같이 고쳐도 여기선 걸린다)',
      s => s.replace('eBaseHp:60.74137, eBaseDmg:11.183669', 'eBaseHp:44.000000, eBaseDmg:8.100000'),
      s => s.replace('eBaseHp:60.74137, eBaseDmg:11.183669', 'eBaseHp:44.000000, eBaseDmg:8.100000'), null],
    ['10챕터 벽 배수를 올리면',
      s => s.replace('wallHp:1.5, wallDmg:1.25', 'wallHp:1.8, wallDmg:1.40'),
      s => s.replace('wallHp:1.5, wallDmg:1.25', 'wallHp:1.8, wallDmg:1.40'), null],
    /* ⚑ T160 — 경계가 3·7·15·30·60·100 으로 다시 잘려 옛 «[28,…]» 자리가 사라졌다. 새 경계로 갈아끼운다.
       ⚑ T168 — 경계는 그대로고 률만 바뀌었다(30→60 HP 7.8482% → 7.5893%). 심는 값도 같이 옮긴다. */
    ['구간 성장률 한 칸만 «미세 조정» 하면 (30→60 HP 7.5893% → 7.0%)',
      s => s.replace('[30,1.075893]', '[30,1.070000]'),
      s => s.replace('[30,1.075893]', '[30,1.070000]'), null],
    ['최종 벽 위치를 옮기면 (420 → 400)',
      s => s.replace('wall4At:420', 'wall4At:400'),
      s => s.replace('wall4At:420', 'wall4At:400'), null],
    ['상수는 그대로 두고 **수식만** 재구성하면 — 웨이브 항 제거',
      s => s.replace('*(1+TUNE.waveHp*w);', ';').replace('*(1+TUNE.waveDmg*w);', ';'),
      s => s.replace('*(1+TUNE.waveHp*w);', ';').replace('*(1+TUNE.waveDmg*w);', ';'), null],
    ['상수는 그대로 두고 **벽 임계만** 옮기면 (c>=10 → c>=12)',
      s => s.replace('if(c>=10){hp*=TUNE.wallHp;', 'if(c>=12){hp*=TUNE.wallHp;'),
      s => s.replace('if(c>=10){hp*=TUNE.wallHp;', 'if(c>=12){hp*=TUNE.wallHp;'), null],
    ['index.html 만 흔들면 (두 엔진이 갈라진다)',
      null, s => s.replace('eBaseHp:60.74137', 'eBaseHp:52.000000'), null],
    ['ROUTINE 에서 상시 규칙 문장을 지우면',
      null, null, s => s.replace(/적 스탯\(기저·구간률·벽\)은 주인이 «맞춰라» 라고 명시하기 전까지 한 글자도 건드리지 않는다/, '적 스탯은 상황에 맞게 조정한다')],
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
  /* 양성 대조군 — 원본은 전부 초록이어야 한다(오탐 0) */
  const base = run(simSrc, htmSrc, routineSrc, true);
  base === 0 ? console.log(`  ✓ 양성 대조군 — 원본 ${R.length}항목 전부 통과 (오탐 0)`)
             : console.log(`  ✗ 양성 대조군 — 원본에서 ${base}건 불합격 (오탐)`);
  console.log(`\n[음성 검사] ${caught}/${cases.length} · no-op ${noop} · 오탐 ${base}`);
  process.exit(caught === cases.length && noop === 0 && base === 0 ? 0 : 1);
}

console.log('[T132 적 스탯 동결 게이트] 주인 상시 규칙 «맞춰라 하기 전까지 한 글자도» 를 지킨다');
const bad = run(simSrc, htmSrc, routineSrc, false);
console.log(`\n[적 스탯 동결 게이트] 대조 ${R.length}항목 · 통과 ${R.length - bad} · 불합격 ${bad}`);
if (bad) {
  console.log('→ 실패: 적 스탯이 동결값에서 움직였다. 주인의 «맞춰라» 지시가 있었다면 이 파일의');
  console.log('  FROZEN/FROZEN_STATS 를 새 값으로 갱신하고 PROGRESS 에 주인 원문과 함께 남길 것.');
  console.log('  지시가 없었다면 엔진을 되돌릴 것 (T119 → T120 과 같은 사고다).');
  process.exit(1);
}
console.log('→ 통과 (적 스탯 노브 21개 × 2엔진 · 실측 표본 44칸 · 두 엔진 일치 · 상시 규칙 문면)');
