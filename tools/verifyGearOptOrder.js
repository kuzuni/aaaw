#!/usr/bin/env node
/* ================================================================================
   verifyGearOptOrder — ⚑⚑⚑ T141 (워커 A · sess-0607-6812)

   **주인 확정 T124 ② (2026-09-04 19:2X~20:0X · ROUTINE 최상단)** — «부위별 순서 셔플»

     | 부위 | 1 일반 | 2 희귀 | 3 영웅 | 4 전설 | 5 신화 | 6 +3강 |
     | 무기 | a | b | c | d | e | **f** |   | 장갑 | d | e | a | b | c | **f** |
     | 투구 | b | c | d | e | a | **f** |   | 신발 | e | a | b | c | d | **f** |
     | 갑옷 | c | d | e | a | b | **f** |   | 목걸이 | a | b | c | d | e | **f** |

   그리고 주인이 손수 붙인 조건 세 줄:
     · «치명 시 도끼는 무조건 6번째» → f 는 **전 부위 6번(신화 +3강) 고정**, a~e 만 부위별로 돈다
     · «a~e 는 5칸 순환이라 다섯 부위까지는 서로 다르고 여섯째(목걸이)는 무기와 같다»
     · «세 세트 모두 같은 표를 쓴다» (⚑ 20:0X 주인 확정)
     · 7·8번째(신화 +6/+9강)는 세 세트·전 부위 공통 — ⚑ T145 로 7 = «흡혈 +8%» · 8 = «공격력 +10%»

   ── 구멍을 먼저 증명했다 (T141 사본 실측) ──
   **이 표를 지키는 게이트가 한 줄도 없었다.** 옵션 «순서» 를 보는 자리가 세 곳 있는데 셋 다 못 잡는다:
     · `verifyGearOptAgg` ⓔ 는 «세트 안 6부위가 **같은 6옵션**을 쓴다» 를 `.sort()` 해서 비교한다 —
       집합만 본다. 순서를 어떻게 섞어도 초록이다. f 도 «부위마다 같은가» 만 보지
       **그 자리가 6번인가** 는 옆 단언(6번째가 «도끼» 인가)이 문구로만 본다.
     · `verifyOptText` ① 은 PLAN §11.6 **전개표** ↔ `node sim.js table` 덤프를 줄 단위로 맞춘다 —
       엔진과 전개표는 잇지만, 전개표를 낳은 **부위별 순서 표(a~f)** 는 아무도 안 읽는다.
       즉 엔진과 전개표를 **같이** 흔들면 통과한다.
     · `verifyT2` ⑩ 은 GOPT 144칸을 두 엔진 사이에서만 대조한다 — 둘이 같기만 하면 된다.
   사본으로 확인했다 — `sim.js`·`index.html`·PLAN 전개표 세 곳에서 **투구와 갑옷의 순서를 통째로 맞바꾸면**
   (투구 c·d·e·a·b / 갑옷 b·c·d·e·a — 주인 표 위반) **정적 게이트 24종의 통과 수가 하나도 안 움직였다.**
   순열은 옵션 집합을 보존하므로 «집합만 보는» 단언은 원리적으로 이 계열을 못 잡는다.

   ── 그래서 이 게이트가 하는 일 ──
   **주인 표를 정본으로 삼아 삼각형을 닫는다.**
     ⓐ ROUTINE 의 주인 표(6부위 × 6칸) ↔ PLAN §11.6 «부위별 순서» 표 — 옮겨 적으며 생긴 드리프트
     ⓑ PLAN 의 «세트 옵션 6개(a~f)» 표 × «부위별 순서» 표 = 기대 144칸 ↔ 두 엔진 GOPT 전수
        (verifyOptText 가 엔진 ↔ 전개표를 이미 이었으므로, 이 한 변이 닫히면 네 문서가 한 바퀴 돈다)
     ⓒ 주인이 말로 붙인 성질 넷을 **엔진에서 직접** 재확인 —
        f 6번 고정 · a~e 5칸 순환(부위 i = 무기를 i 칸 돌린 것) · 앞 5부위 서로 다름 + 목걸이 = 무기 ·
        세 세트가 같은 순서 표 · 7번 = 흡혈 +8% · 8번 = 공격력 +10%
     ⓓ ROUTINE 에 주인 문면이 살아 있다

   ── 이 표를 고쳐도 되는 때 ──
   **주인이 «다른 순서를 원한다» 고 한 줄 준 때뿐이다**(ROUTINE T124 ② 말미에 그렇게 적혀 있다).
   그때 ROUTINE 표 → PLAN 두 표 → 두 엔진 순서로 고치면 이 게이트가 나머지를 강제한다.

   사용: node tools/verifyGearOptOrder.js        (exit 0 = 통과, 1 = 불합격)
   음성: node tools/verifyGearOptOrder.js --self (심은 고장 8종 + 양성 대조군)
   ================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* 주인 표기 ↔ 엔진 키 */
const SETS = [['치명', 0], ['체력실드', 1], ['회피', 2]];
const PARTS = [['무기', 'weapon'], ['투구', 'helm'], ['갑옷', 'armor'],
               ['장갑', 'glove'], ['신발', 'boot'], ['목걸이', 'neck']];
const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'];
/* 7·8번 칸은 글자가 아니라 문구다 — 8번은 표에 «공 +10%», 엔진에 «공격력 +10%» 로 적힌다.
   ⚑ T145 (주인 확정 2026-09-05 16:4X «7번째 꺼는 흡혈로 해야 할 거 같은데 8퍼로») — 7번이
   «공격력 +10%» 에서 «흡혈 +8%» 로 갈라졌다(표·엔진 문구가 같다). 8번은 그대로다. */
const PLUS_CELL = '공 +10%';
const PLUS_OPT = '공격력 +10%';
const STEAL_CELL = '흡혈 +8%';
const STEAL_OPT = '흡혈 +8%';

/* ROUTINE 주인 문면 — 표를 지우고 순서를 흔드는 경로를 막는다 */
const RULE_SIX = /치명 시 도끼는 무조건 6번째/;
const RULE_ROT = /a~e 는 5칸 순환이라 다섯 부위까지는 서로 다르고 여섯째\(목걸이\)는 무기와 같다/;
const RULE_SAME = /세 세트 모두 같은 표를 쓴다/;

/* ================================================================
   마크다운 표 파서 — «머리줄이 정확히 이 칸들로 시작하는 표» 의 본문 줄을 돌려준다.
   (구분줄 `|---|` 은 건너뛰고, 표가 끝나면 멈춘다)
   ================================================================ */
function mdTable(src, headCells) {
  const L = src.split('\n');
  for (let i = 0; i < L.length; i++) {
    const c = cells(L[i]);
    if (!c || c.length < headCells.length) continue;
    if (!headCells.every((h, k) => c[k] === h)) continue;
    const rows = [];
    for (let j = i + 2; j < L.length; j++) {          /* +2 = 구분줄 건너뜀 */
      const r = cells(L[j]);
      if (!r) break;
      rows.push(r);
    }
    return rows;
  }
  return null;
}
function cells(line) {
  const t = (line || '').trim();
  if (!t.startsWith('|') || !t.endsWith('|')) return null;
  if (/^\|[\s:|-]+\|$/.test(t)) return null;           /* 구분줄 */
  return t.slice(1, -1).split('|').map(s => s.trim());
}
/* 표 칸의 강조·주석을 벗긴다 — 주인 표는 `**f**` 처럼 굵게 쓴 자리가 있다 */
const bare = s => String(s).replace(/\*\*/g, '').replace(/~~/g, '').trim();

/* ── ROUTINE 주인 «부위별 순서 셔플» 표 (6칸) ── */
function routineOrder(src) {
  const rows = mdTable(src, ['부위', '1 일반', '2 희귀', '3 영웅', '4 전설', '5 신화', '6 +3강']);
  if (!rows) return null;
  const out = {};
  for (const r of rows) {
    const pn = bare(r[0]);
    const pt = (PARTS.find(p => p[0] === pn) || [])[1];
    if (!pt) continue;
    out[pt] = r.slice(1, 7).map(bare);
  }
  return Object.keys(out).length === PARTS.length ? out : null;
}
/* ── PLAN §11.6 «부위별 순서» 표 (8칸 — 7번 «흡혈 +8%» · 8번 «공 +10%» 포함) ── */
function planOrder(src) {
  const rows = mdTable(src, ['부위', '1 일반', '2 희귀', '3 영웅', '4 전설', '5 신화', '6 +3강', '7 +6강', '8 +9강']);
  if (!rows) return null;
  const out = {};
  for (const r of rows) {
    const pn = bare(r[0]);
    const pt = (PARTS.find(p => p[0] === pn) || [])[1];
    if (!pt) continue;
    out[pt] = r.slice(1, 9).map(bare);
  }
  return Object.keys(out).length === PARTS.length ? out : null;
}
/* ── PLAN §11.6 «세트 옵션 6개 (a~f)» 표 → {세트: {a: 설명문, …}} ── */
function planLetters(src) {
  const rows = mdTable(src, ['세트', 'a', 'b', 'c', 'd', 'e', 'f']);
  if (!rows) return null;
  const out = {};
  for (const r of rows) {
    const sn = bare(r[0]);
    if (!SETS.some(s => s[0] === sn)) continue;
    const m = {};
    LETTERS.forEach((L, k) => { m[L] = bare(r[k + 1]); });
    out[sn] = m;
  }
  return Object.keys(out).length === SETS.length ? out : null;
}

/* ── 엔진에서 GT·GOPT 만 잘라 온다 (verifyGearOptAgg.loadOpt 와 같은 방식) ── */
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
  if (!gt || !gopt) return null;
  try {
    return vm.runInNewContext(`${gt}\n${gopt}\n;({GT,GOPT})`, { Math, JSON, process: { env: {} } });
  } catch (e) { return null; }
}

/* ================================================================ */
const R = [];
const chk = (name, pass, detail) => R.push({ name, c: !!pass, d: detail });

function run(simSrc, htmSrc, planSrc, routineSrc, quiet) {
  R.length = 0;
  const say = quiet ? () => {} : console.log;

  const rOrd = routineOrder(routineSrc);
  const pOrd = planOrder(planSrc);
  const pLet = planLetters(planSrc);
  chk('ROUTINE 주인 «부위별 순서 셔플» 표를 읽었다 (6부위 × 6칸)', !!rOrd, '표가 사라졌거나 머리줄이 바뀌었다 — 주인 지시가 통째로 없어진 것이다');
  chk('PLAN §11.6 «부위별 순서» 표를 읽었다 (6부위 × 8칸)', !!pOrd, '표가 사라졌거나 머리줄이 바뀌었다');
  chk('PLAN §11.6 «세트 옵션 6개 (a~f)» 표를 읽었다 (3세트 × 6칸)', !!pLet, '표가 사라졌거나 머리줄이 바뀌었다');
  if (!rOrd || !pOrd || !pLet) return finish(say, quiet);

  const E = [['sim.js', loadOpt(simSrc)], ['index.html', loadOpt(htmSrc)]];
  for (const [nm, X] of E) if (!X) chk(`${nm} 에서 GT·GOPT 추출`, false, '블록을 못 찾았다 — 엔진 구조가 바뀌었으면 loadOpt 를 함께 고칠 것');
  if (E.some(([, X]) => !X)) return finish(say, quiet);

  /* ===== ⓐ ROUTINE 주인 표 ↔ PLAN 표 ===== */
  say('\n=== ⓐ 주인 표(ROUTINE) ↔ PLAN §11.6 «부위별 순서» ===');
  for (const [pn, pt] of PARTS) {
    const a = rOrd[pt], b = pOrd[pt].slice(0, 6);
    chk(`${pn} — 주인 표와 PLAN 이 같다 (${a.join('·')})`, a.join('|') === b.join('|'),
        `ROUTINE «${a.join('·')}» ≠ PLAN «${b.join('·')}»`);
  }
  {
    const off7 = PARTS.filter(([, pt]) => pOrd[pt][6] !== STEAL_CELL).map(x => x[0]);
    chk(`PLAN 표의 7번째가 «${STEAL_CELL}» 다 — 6부위 전수 (⚑ 주인 확정 T145)`, off7.length === 0, off7.join(', '));
    const off8 = PARTS.filter(([, pt]) => pOrd[pt][7] !== PLUS_CELL).map(x => x[0]);
    chk(`PLAN 표의 8번째가 «${PLUS_CELL}» 다 — 6부위 전수`, off8.length === 0, off8.join(', '));
  }

  /* ===== ⓑ 두 표의 곱 = 기대 144칸 ↔ 두 엔진 GOPT 전수 ===== */
  say('\n=== ⓑ (세트 옵션 a~f) × (부위별 순서) = GOPT 144칸 ===');
  const want = {};                                    /* {세트키: {부위: [8칸 설명문]}} */
  for (const [sn] of SETS) {
    want[sn] = {};
    for (const [, pt] of PARTS) {
      want[sn][pt] = pOrd[pt].map(c => (c === PLUS_CELL ? PLUS_OPT : c === STEAL_CELL ? STEAL_OPT : pLet[sn][c]));
    }
  }
  for (const [nm, X] of E) {
    for (const [sn, ti] of SETS) {
      const off = [];
      for (const [pn, pt] of PARTS) {
        const tbl = X.GOPT[X.GT.types[pt][ti]] || [];
        want[sn][pt].forEach((w, k) => {
          const got = tbl[k] && tbl[k].d;
          if (got !== w) off.push(`${pn} ${k + 1}번 — 표 «${w}» ≠ 엔진 «${got === undefined ? '(없음)' : got}»`);
        });
      }
      chk(`${nm} ${sn} 세트 — 6부위 × 8칸이 표대로다`, off.length === 0,
          off.length ? `${off.length}칸 어긋남 — ${off.slice(0, 3).join(' / ')}` : '48칸');
    }
  }

  /* ===== ⓒ 주인이 말로 붙인 성질을 엔진에서 직접 ===== */
  say('\n=== ⓒ 주인 조건 — f 6번 고정 · a~e 5칸 순환 · 세 세트 같은 표 ===');
  /* ⚠ 문구 → 글자 역매핑은 쓰지 않는다 — 한 세트 안에 **같은 문구가 두 칸** 있다
     (치명 a·d = «치명타 확률 +5» · 체력실드 b·d = «최대 실드 +12%» · 회피 b·e = «최대 실드 +10%»).
     역매핑을 쓰면 a 가 d 로 접혀 순서가 없는 값이 된다. 그래서 아래는 전부
     **엔진 문구끼리의 회전 대조**다 — 중복이 있어도 «부위 i = 무기를 i 칸 돌린 것» 은 그대로 판정된다. */
  const engRow = (X, ti, pt) => (X.GOPT[X.GT.types[pt][ti]] || []).map(x => (x && x.d) || '(없음)');
  const rot = (arr, k) => arr.map((_, i) => arr[(i + k) % 5]);
  for (const [nm, X] of E) {
    const rotOK = [];                                  /* 세트별 «전 부위가 회전이다» 결과 */
    for (const [sn, ti] of SETS) {
      const row = {}; for (const [, pt] of PARTS) row[pt] = engRow(X, ti, pt);
      const letters = pt => pOrd[pt].slice(0, 6).join('');   /* 표기용 — 판정은 문구로 한다 */
      /* ⓒ-1 f(도끼)는 전 부위 6번 (주인 «도끼는 무조건 6번째») */
      const f6 = row.weapon[5];
      const badF = PARTS.filter(([, pt]) => row[pt][5] !== f6 || !/도끼/.test(row[pt][5])).map(x => x[0]);
      chk(`${nm} ${sn} — f(도끼)가 전 부위 6번째다`, badF.length === 0,
          badF.length ? `${badF.join(', ')} 의 6번째가 «${f6}» 가 아니다` : `«${f6}» × 6부위`);
      /* ⓒ-2 a~e 5칸 순환 — 부위 i 는 무기 순서를 i 칸 돌린 것 */
      const base = row.weapon.slice(0, 5);
      const badR = PARTS.filter(([, pt], i) => row[pt].slice(0, 5).join('§') !== rot(base, i % 5).join('§')).map(x => x[0]);
      rotOK.push(badR.length === 0);
      chk(`${nm} ${sn} — a~e 가 5칸 순환이다 (부위 i = 무기를 i 칸 회전)`, badR.length === 0,
          badR.length ? `${badR.join(', ')} 가 회전이 아니다` : PARTS.map(([pn, pt]) => pn + ':' + letters(pt)).join(' '));
      /* ⓒ-3 앞 5부위는 서로 다르고 목걸이 = 무기 (주인 위임 기본값 문면 그대로) */
      const five = PARTS.slice(0, 5).map(([, pt]) => row[pt].slice(0, 5).join('§'));
      chk(`${nm} ${sn} — 앞 다섯 부위의 순서가 서로 다르다`, new Set(five).size === 5,
          `서로 다른 순서 ${new Set(five).size}/5`);
      chk(`${nm} ${sn} — 목걸이가 무기와 같다`, row.neck.join('§') === row.weapon.join('§'),
          `목걸이 «${row.neck.slice(0, 3).join(' · ')}…» · 무기 «${row.weapon.slice(0, 3).join(' · ')}…»`);
      /* ⓒ-4 세트 안 6부위가 표의 여섯 옵션만 쓴다 (미등록 문구 0) */
      const known = new Set(Object.values(pLet[sn]));
      const unk = PARTS.filter(([, pt]) => row[pt].slice(0, 6).some(d => !known.has(d))).map(x => x[0]);
      chk(`${nm} ${sn} — 6부위가 표의 여섯 옵션만 쓴다 (미등록 문구 0)`, unk.length === 0, unk.join(', '));
    }
    /* ⓒ-5 세 세트가 같은 순서 표를 쓴다 (주인 20:0X 확정) — 세 세트가 다 «부위 i = i 칸 회전» 이면
       세 세트의 순서 표는 정의상 같은 표다(글자는 세트마다 다른 문구를 가리킬 뿐이다). */
    chk(`${nm} — 세 세트가 같은 순서 표를 쓴다 (셋 다 «부위 i = 무기 i 칸 회전»)`, rotOK.every(Boolean),
        SETS.map(([sn], i) => `${sn} ${rotOK[i] ? 'OK' : '✗'}`).join(' · '));
    /* ⓒ-6 7번 = 흡혈 +8% · 8번 = 공격력 +10% (18종 전수 · ⚑ T145 로 갈라졌다) */
    const types = PARTS.flatMap(([, pt]) => X.GT.types[pt]);
    const bad7 = types.filter(t => !X.GOPT[t] || X.GOPT[t][6].d !== STEAL_OPT);
    chk(`${nm} — 7번째가 «${STEAL_OPT}» 다 (18종 전수 · ⚑ 주인 확정 T145)`, bad7.length === 0, bad7.join(', ') || `${types.length}종`);
    const bad8 = types.filter(t => !X.GOPT[t] || X.GOPT[t][7].d !== PLUS_OPT);
    chk(`${nm} — 8번째가 «${PLUS_OPT}» 다 (18종 전수)`, bad8.length === 0, bad8.join(', ') || `${types.length}종`);
  }

  /* ===== ⓓ ROUTINE 주인 문면 ===== */
  say('\n=== ⓓ 주인 문면이 ROUTINE 에 살아 있다 ===');
  chk('«치명 시 도끼는 무조건 6번째»', RULE_SIX.test(routineSrc), '문장이 사라졌다 — f 자리를 푸는 경로다');
  chk('«a~e 는 5칸 순환 … 여섯째(목걸이)는 무기와 같다»', RULE_ROT.test(routineSrc), '문장이 사라졌다');
  chk('«세 세트 모두 같은 표를 쓴다»', RULE_SAME.test(routineSrc), '문장이 사라졌다');

  return finish(say, quiet);
}

function finish(say, quiet) {
  if (!quiet) for (const x of R) say(`  ${x.c ? '✓' : '✗'} ${x.name}${x.c ? '' : '  — ' + x.d}`);
  return R.filter(x => !x.c).length;
}

/* ================================================================ */
const simSrc = rd('sim.js');
const htmSrc = rd('index.html');
const planSrc = rd('PLAN.md');
const routineSrc = rd('docs/ROUTINE.md');

/* 사본에서 «투구 ↔ 갑옷» 처럼 한 쌍의 순서를 통째로 맞바꾸는 돌연변이.
   순열이라 옵션 «집합» 은 그대로다 — 집합만 보는 종전 게이트가 못 잡던 바로 그 모양이다. */
function swapParts(src, A, B, only) {
  let out = src;
  for (const st of (only || ['crit', 'hpsh', 'evade'])) {
    const grab = (s, key) => {
      const i = s.indexOf(key + ':[');
      if (i < 0) return null;
      const j = s.indexOf('\n  ],', i);
      if (j < 0) return null;
      const txt = s.slice(i, j + 4);
      const nl = txt.indexOf('\n');
      return { i, j: j + 4, head: txt.slice(0, nl), body: txt.slice(nl + 1) };
    };
    const a = grab(out, `${st}_${A}`), b = grab(out, `${st}_${B}`);
    if (!a || !b || a.i >= b.i) return src;
    out = out.slice(0, b.i) + b.head + '\n' + a.body + out.slice(b.j);
    out = out.slice(0, a.i) + a.head + '\n' + b.body + out.slice(a.j);
  }
  return out;
}
/* PLAN 전개표에서도 같은 두 부위 행의 옵션 칸을 맞바꾼다 (엔진과 «같이» 흔드는 사본) */
function swapPlanRows(src, A, B) {
  const L = src.split('\n');
  const idx = {};
  L.forEach((l, n) => {
    const m = l.match(/^\| (\S+) \| (치명|체력실드|회피) (\S+) \| (치명|체력실드|회피) \|/);
    if (m && (m[1] === A || m[1] === B)) (idx[m[2]] = idx[m[2]] || {})[m[1]] = n;
  });
  for (const st of Object.keys(idx)) {
    const a = idx[st][A], b = idx[st][B];
    if (a === undefined || b === undefined) continue;
    const ca = L[a].split(' | '), cb = L[b].split(' | ');
    const ta = ca.slice(3), tb = cb.slice(3);
    L[a] = ca.slice(0, 3).concat(tb).join(' | ');
    L[b] = cb.slice(0, 3).concat(ta).join(' | ');
  }
  return L.join('\n');
}

if (process.argv.includes('--self')) {
  /* 음성 검사 — 심은 고장을 이 게이트가 실제로 잡는가.
     T126 규약: 돌연변이가 no-op(치환이 안 먹음)이면 그것부터 빨갛게 떨어뜨린다. */
  console.log('[음성 검사] 주인 «부위별 순서» 표를 몰래 흔든 사본에서 이 게이트가 빨개지는가');
  const cases = [
    ['두 엔진 + PLAN 전개표를 «같이» 흔들어 투구·갑옷 순서를 맞바꾸면 (T141 이 증명한 그 구멍)',
      s => swapParts(s, 'helm', 'armor'), s => swapParts(s, 'helm', 'armor'),
      s => swapPlanRows(s, '투구', '갑옷'), null],
    ['sim.js 에서만 신발·목걸이 순서를 맞바꾸면 (두 엔진이 갈라진다)',
      s => swapParts(s, 'boot', 'neck'), null, null, null],
    ['index.html 에서만 무기·장갑 순서를 맞바꾸면',
      null, s => swapParts(s, 'weapon', 'glove'), null, null],
    ['치명 세트에서 f(도끼)를 5번 자리로 당기면 (주인 «무조건 6번째» 위반)',
      s => s.replace("{d:'치명타 피해 +25', ap:p=>p.critF+=25},\n    {d:'치명타 시 50% 확률로 도끼 1개', ap:p=>p.px.g_critAxe++},",
                     "{d:'치명타 시 50% 확률로 도끼 1개', ap:p=>p.px.g_critAxe++},\n    {d:'치명타 피해 +25', ap:p=>p.critF+=25},"),
      s => s.replace("{d:'치명타 피해 +25', ap:p=>p.critF+=25},\n    {d:'치명타 시 50% 확률로 도끼 1개', ap:p=>p.px.g_critAxe++},",
                     "{d:'치명타 시 50% 확률로 도끼 1개', ap:p=>p.px.g_critAxe++},\n    {d:'치명타 피해 +25', ap:p=>p.critF+=25},"),
      null, null],
    ['회피 세트만 다른 순서를 쓰게 하면 (주인 «세 세트 모두 같은 표» 위반)',
      s => swapParts(s, 'helm', 'armor', ['evade']),
      s => swapParts(s, 'helm', 'armor', ['evade']), null, null],
    ['PLAN 의 부위별 순서 표에서 투구 행만 고치면 (주인 표와 갈라진다)',
      null, null, s => s.replace('| 투구 | b | c | d | e | a | f | 흡혈 +8% | 공 +10% |',
                                 '| 투구 | c | d | e | a | b | f | 흡혈 +8% | 공 +10% |'), null],
    ['PLAN 의 세트 옵션(a~f) 표에서 치명 c 를 바꾸면 (문자표 ↔ 엔진)',
      null, null, s => s.replace('| 치명 | 치명타 확률 +5 | 치명타 피해 +20 | 반격률 +10 |',
                                 '| 치명 | 치명타 확률 +5 | 치명타 피해 +20 | 반격률 +12 |'), null],
    ['ROUTINE 에서 «치명 시 도끼는 무조건 6번째» 를 지우면',
      null, null, null, s => s.replace('치명 시 도끼는 무조건 6번째', '도끼 자리는 부위마다 자유')],
  ];
  let caught = 0, noop = 0;
  for (const [why, mS, mH, mP, mR] of cases) {
    const s2 = mS ? mS(simSrc) : simSrc;
    const h2 = mH ? mH(htmSrc) : htmSrc;
    const p2 = mP ? mP(planSrc) : planSrc;
    const r2 = mR ? mR(routineSrc) : routineSrc;
    if ((mS && s2 === simSrc) || (mH && h2 === htmSrc) || (mP && p2 === planSrc) || (mR && r2 === routineSrc)) {
      console.log(`  ✗ 음성 «${why}» — 치환이 안 먹었다 (no-op · 심을 자리가 사라졌으면 이 케이스를 고칠 것)`);
      noop++; continue;
    }
    const bad = run(s2, h2, p2, r2, true);
    console.log(`  ${bad > 0 ? '✓' : '✗'} 음성 «${why}» — ${bad > 0 ? `${bad}항목 빨강` : '전부 초록 (게이트가 못 잡는다)'}`);
    if (bad > 0) caught++;
  }
  const clean = run(simSrc, htmSrc, planSrc, routineSrc, true);
  console.log(`  ${clean === 0 ? '✓' : '✗'} 양성 대조군 (원본) — ${clean === 0 ? '전부 초록' : `${clean}항목 빨강`}`);
  const ok = caught === cases.length && noop === 0 && clean === 0;
  console.log(`\n[음성 검사] 심은 고장 ${caught}/${cases.length} 검출 · no-op ${noop} · 양성 ${clean === 0 ? 'OK' : 'NG'} → ${ok ? '통과' : '불합격'}`);
  process.exit(ok ? 0 : 1);
}

console.log('[T141 장비 옵션 «부위별 순서» 게이트 — 주인 확정 T124 ②]');
const bad = run(simSrc, htmSrc, planSrc, routineSrc, false);
console.log(`\n[T141 장비 옵션 부위별 순서 게이트] 대조 ${R.length}항목 · 통과 ${R.length - bad} · 불합격 ${bad}` +
            (bad === 0 ? ' → 통과 (ROUTINE 주인 표 ↔ PLAN 두 표 ↔ 두 엔진 GOPT 144칸)' : ''));
process.exit(bad ? 1 : 0);
