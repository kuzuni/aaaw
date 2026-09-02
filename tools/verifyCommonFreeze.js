'use strict';
/* ⚑⚑ 일반 44종 동결 게이트 (주인 지시 2026-09-03 — P1 이식 완료 시 신설)
   사용: node tools/verifyCommonFreeze.js        (한 글자라도 어긋나면 exit 1)
         node tools/verifyCommonFreeze.js --list (해석된 숫자 대조표를 전부 찍는다)

   주인 원문:
     «게이트 신설: docs/perk-redesign.md 일반 44종의 표시 텍스트·수치 ↔ PLAN §3.1 ↔ sim.js ↔ index.html
      4자 대조, 한 글자라도 다르면 exit 1. 밸런스 회차가 일반 특전을 만지면 이 게이트가 빨개진다.
      perk-redesign.md 의 일반 절은 주인만 고칠 수 있다(워커 수정 금지).»

   왜 4자인가 — 일반 44종은 **밸런싱의 절대 기준**이다(주인 확정: 일반만 뜨는 플레이어의 클리어율 10% 를
   적 난이도로 맞추고, 그 뒤 난이도를 동결한 채 희귀·전설만 특전 수치로 맞춘다). 기준자가 흔들리면
   그 위에서 잰 모든 값이 무의미해진다. 그래서 네 곳 중 하나만 움직여도 즉시 빨개져야 한다.

   대조 방식:
     ① 정본(docs/perk-redesign.md 일반 44) ↔ PLAN §3.1 표시 텍스트 — **문자 완전 일치**
     ② 정본 ↔ index.html 의 `ic` + `tx`(<b> 태그를 걷어낸 것) — **문자 완전 일치**
     ③ 정본 ↔ sim.js — sim 에는 표시 텍스트가 없다. 그래서 **수치**로 댄다:
        특전 id 가 나오는 엔진 줄들의 숫자(+ 소환 상수·관통 상수)를 모아, 정본 문장의 숫자가 전부
        그 안에서 설명되는지 본다. 설명 못 하는 숫자는 KNOWN_UNRESOLVED 에 사유와 함께 등재된 것만 허용.
     ④ 개수 44 · 등급 0(일반) · id 순서까지 세 파일이 같은가.

   ⚠ 이 게이트가 빨개지면 «게이트를 고친다» 가 아니라 «일반 특전을 되돌린다» 가 정답이다.
     정본 문서의 일반 절은 주인 전용이다 — 워커가 고치면 안 된다. */

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const DOC = fs.readFileSync(path.join(root, 'docs/perk-redesign.md'), 'utf8');
const PLAN = fs.readFileSync(path.join(root, 'PLAN.md'), 'utf8');
const SIM = fs.readFileSync(path.join(root, 'sim.js'), 'utf8');
const HTML = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const LIST = process.argv.includes('--list');

let bad = 0, okN = 0;
const fail = m => { bad++; console.log('  ❌ ' + m); };
const pass = m => { okN++; console.log('  ✓ ' + m); };

const COMMON_N = 44;

/* ── ① 정본에서 일반 44줄을 뽑는다 ───────────────────────── */
function docCommon() {
  const out = [];
  let inSec = false;
  for (const L of DOC.split('\n')) {
    if (/^## 일반/.test(L)) { inSec = true; continue; }
    if (/^## /.test(L)) { inSec = false; continue; }
    if (!inSec) continue;
    const m = L.trim().match(/^(\d+)\.\s+(.*)$/);
    if (!m) continue;
    let t = m[2].trim();
    if (t.startsWith('~~')) continue;                      /* 삭제 표시된 줄 */
    t = t.replace(/\s*\(⚑[^)]*\)\s*$/, '');                /* 메타 주석 «(⚑ 주인 확정 상수 …)» 제거 */
    out.push(t);
  }
  return out;
}

/* ── PLAN §3.1 행 ────────────────────────────────────────── */
function planCommon() {
  const out = [];
  let inSec = false;
  for (const L of PLAN.split('\n')) {
    if (/^### 3\.1/.test(L)) { inSec = true; continue; }
    if (/^### /.test(L)) { inSec = false; continue; }
    if (!inSec) continue;
    const m = L.match(/^\| (c_\w+) \| (.*?) \| (.*?) \|$/);
    if (m) out.push({ id: m[1], tx: m[2].trim() });
  }
  return out;
}

/* ── index.html PERKS 의 일반 ────────────────────────────── */
function htmlCommon() {
  const out = [];
  const m = HTML.match(/const PERKS=\[[\s\S]*?\n\];/);
  if (!m) return out;
  for (const x of m[0].matchAll(/\{id:'(c_\w+)', r:(\d), ic:'([^']*)', tx:'((?:[^'\\]|\\')*)'/g)) {
    const plain = x[4].replace(/<\/?b>/g, '').replace(/\\'/g, "'");
    out.push({ id: x[1], r: +x[2], tx: `${x[3]} ${plain}` });
  }
  return out;
}

/* ── sim.js mkPerks 의 일반 id 순서 ──────────────────────── */
function simCommonIds() {
  const body = SIM.slice(SIM.indexOf('function mkPerks()'), SIM.indexOf('const PERKS=mkPerks()'));
  return [...body.matchAll(/add\('(c_\w+)',\s*0/g)].map(x => x[1]);
}

const doc = docCommon(), plan = planCommon(), html = htmlCommon(), simIds = simCommonIds();

/* ── ④ 개수·순서 ─────────────────────────────────────────── */
console.log('=== ① 개수·id 순서 — 정본 / PLAN §3.1 / sim.js / index.html ===');
{
  const n = [doc.length, plan.length, simIds.length, html.length];
  n.every(v => v === COMMON_N)
    ? pass(`네 곳 모두 일반 ${COMMON_N}종`)
    : fail(`일반 특전 개수가 어긋난다 — 정본 ${n[0]} · PLAN ${n[1]} · sim.js ${n[2]} · index.html ${n[3]} (${COMMON_N} 이어야 한다)`);
  const a = plan.map(x => x.id).join(','), b = simIds.join(','), c = html.map(x => x.id).join(',');
  (a === b && b === c)
    ? pass('id 목록과 순서가 PLAN·sim.js·index.html 에서 완전히 같다')
    : fail('id 목록/순서가 세 파일에서 다르다 — PLAN↔sim ' + (a === b) + ' · sim↔index ' + (b === c));
  html.every(x => x.r === 0)
    ? pass('index.html 의 44종이 전부 등급 0(일반)이다')
    : fail('index.html 에 등급이 일반이 아닌 c_ 특전이 있다');
}

/* ── ②③ 표시 텍스트 문자 완전 일치 ──────────────────────── */
console.log('\n=== ② 표시 텍스트 — 정본 ↔ PLAN §3.1 ↔ index.html (문자 완전 일치) ===');
{
  let diff = 0;
  const n = Math.min(doc.length, plan.length, html.length);
  for (let i = 0; i < n; i++) {
    const d = doc[i], p = plan[i].tx, h = html[i].tx;
    if (d !== p) { diff++; fail(`${plan[i].id}: 정본 ≠ PLAN §3.1\n      정본 «${d}»\n      PLAN «${p}»`); }
    else if (d !== h) { diff++; fail(`${plan[i].id}: 정본 ≠ index.html\n      정본 «${d}»\n      게임 «${h}»`); }
    else if (LIST) console.log(`    ✓ ${plan[i].id.padEnd(16)} ${d}`);
  }
  if (!diff) pass(`일반 ${n}종의 표시 텍스트가 세 곳에서 한 글자까지 같다`);
}

/* ── ④ sim.js 수치 대조 ─────────────────────────────────── */
/* 정본 문장의 숫자가 엔진에서 설명되는가. 설명 못 하는 것은 아래에 사유와 함께 등재된 것만 허용한다.
   («방어막 1장» 의 1 처럼 엔진이 `p.ward++` 로 쓰는 값은 리터럴로 존재하지 않는다 — 그런 부류다.) */
const KNOWN_UNRESOLVED = {
  'c_axeHit|1': '«도끼 1개» — fireAxe(p,1) 의 1 은 인자로 들어가지만 정본의 «1개» 와 같은 값이라 중복 표기다',
  'c_wardHit|1': '«방어막 1장» — 엔진은 p.ward++ 라 1 이 리터럴로 없다',
  'c_wardEvade|1': '«방어막 1장» — p.ward++',
  'c_wardKill|1': '«방어막 1장» — p.ward++',
  'c_wardEmpty|1': '«방어막 1장» — p.ward++',
  'c_evadeStack|1': '«공격 1타당 1스택 소모» — 엔진은 p.evStk-- 라 1 이 리터럴로 없다 (💢 빗맞음 스택과 같은 구조)',
  'c_collDef|1': '«보유한 특전 1개당» 의 1 은 단위 낱말이다 — 엔진은 d+=2*perkN(p) 로 «1개당» 을 곱셈으로 표현한다',
  'c_collEvade|1': '위와 같음 — e+=2*perkN(p)',
  'c_collCounter|1': '위와 같음 — p.counter+(… ? 2*perkN(p) : 0)',
};

console.log('\n=== ③ sim.js 수치 대조 — 정본 문장의 숫자가 엔진에서 설명되는가 ===');
{
  /* 소환 상수·관통 상수는 특전 줄에 리터럴로 없고 상수로 들어간다 — 호출하는 함수에 따라 풀에 넣어 준다. */
  const C = {};
  for (const m of SIM.matchAll(/const (R_AXE|R_ARROW|R_WAVE|R_BOLT|R_SPEAR|WAVE_PIERCE|WAVE_PIERCE_BIG|SPEAR_PIERCE|REAPER_CH|ASPD_RAMP_AMT)=([\d.]+)/g)) C[m[1]] = +m[2];
  for (const m of SIM.matchAll(/(R_AXE|R_ARROW|R_WAVE|R_BOLT|R_SPEAR)=([\d.]+)/g)) C[m[1]] = +m[2];
  for (const m of SIM.matchAll(/(WAVE_PIERCE|WAVE_PIERCE_BIG|SPEAR_PIERCE)=(\d+)/g)) C[m[1]] = +m[2];
  for (const m of SIM.matchAll(/(REAPER_CH)=([\d.]+)/g)) C[m[1]] = +m[2];
  const FIRE = { fireAxe: ['R_AXE'], fireArrows: ['R_ARROW'], fireWave: ['R_WAVE', 'WAVE_PIERCE'], fireBolts: ['R_BOLT'], fireSpear: ['R_SPEAR', 'SPEAR_PIERCE'] };

  const simLines = SIM.split('\n');
  let unresolvedNew = 0, checked = 0;
  for (const { id } of plan) {
    /* add() 줄도 본다 — 스탯을 직접 바꾸는 6종(🍖 killHeal 등)은 계수가 거기에만 있다.
       그 줄의 등급 숫자 0 이 풀에 섞이지만 «0» 은 정본 문장에 안 나오므로 무해하다. */
    const lines = simLines.filter(L => new RegExp("px\\." + id + "\\b|add\\('" + id + "'").test(L));
    const pool = new Set();
    for (const L0 of lines) {
      /* ⚠ 주석을 반드시 걷어낸다 — 엔진 줄 끝의 «/* 🪓 20% 확률로 도끼 1개 *​/» 같은 설명이 풀에 섞이면
         엔진 수치를 바꿔도 주석의 옛 숫자가 그것을 설명해 버려 이 게이트가 조용히 통과한다(음성 시험 ③). */
      const L = L0.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/, ' ');
      for (const m of L.matchAll(/(?<![A-Za-z_$][A-Za-z0-9_$]*)(\d+(?:\.\d+)?)/g)) pool.add(+m[1]);
      for (const fn in FIRE) if (L.includes(fn + '(')) for (const k of FIRE[fn]) if (C[k] !== undefined) pool.add(C[k]);
      if (/REAPER_CH/.test(L) && C.REAPER_CH !== undefined) pool.add(C.REAPER_CH);
      if (/ASPD_RAMP_AMT/.test(L) && C.ASPD_RAMP_AMT !== undefined) pool.add(C.ASPD_RAMP_AMT);
    }
    /* 조건부 패시브(실드 유무·저체력·수집가)는 실효 스탯 함수 안에 있고 그 줄도 위에서 잡힌다 */
    const want = [...doc[plan.indexOf(plan.find(x => x.id === id))].matchAll(/(\d+(?:\.\d+)?)/g)].map(x => +x[1]);
    const explained = n => [...pool].some(c =>
      Math.abs(c - n) < 1e-9 || Math.abs(c - n / 100) < 1e-12 ||
      Math.abs(c - (1 + n / 100)) < 1e-12 || Math.abs(c * 100 - n) < 1e-9);
    const missing = want.filter(n => !explained(n));
    checked += want.length;
    for (const n of missing) {
      const key = `${id}|${n}`;
      if (KNOWN_UNRESOLVED[key]) { if (LIST) console.log(`    · 허용 ${key.padEnd(22)} ${KNOWN_UNRESOLVED[key]}`); continue; }
      unresolvedNew++;
      fail(`${id}: 정본 문장의 «${n}» 을 sim.js 에서 설명하지 못한다 — 엔진 수치가 정본과 어긋났거나(되돌릴 것) 새 표현이면 KNOWN_UNRESOLVED 에 사유와 함께 등재할 것\n      정본 «${doc[plan.findIndex(x => x.id === id)]}»\n      엔진 풀 [${[...pool].sort((a, b) => a - b).join(', ')}]`);
    }
    if (LIST && !missing.length) console.log(`    ✓ ${id.padEnd(16)} 숫자 ${want.length}개 전부 설명됨`);
  }
  unresolvedNew === 0
    ? pass(`정본 문장의 숫자 ${checked}개가 전부 sim.js 엔진 수치로 설명된다 (등재 예외 ${Object.keys(KNOWN_UNRESOLVED).length}건)`)
    : fail(`설명되지 않는 숫자 ${unresolvedNew}건 — 일반 44종은 주인 동결 목록이다`);
}

console.log(`\n결과: ${okN} 통과 · ${bad} 실패`);
if (bad) console.log('→ 실패: **게이트를 고치지 말고 일반 특전을 되돌려라.** `docs/perk-redesign.md` 의 일반 절은 주인 전용이다.');
process.exit(bad ? 1 : 0);
