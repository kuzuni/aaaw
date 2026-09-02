'use strict';
/* «특전 ↔ 장비옵션 중복 사장» 자동 대조 게이트 (T24 신설)
   사용: node tools/verifyPerkGearDup.js          (신규 중복이 있으면 exit 1)
         node tools/verifyPerkGearDup.js --list   (중복 아닌 공유 키까지 전부 덤프)

   왜 필요한가 — 기존 게이트 3개가 이 축을 전혀 덮지 않는다:
     - tools/verifyPlanConst.js (T16) = PLAN↔엔진 경제·적 상수 48항목
     - tools/verifyOptText.js   (T17) = 설명문↔엔진 상수 (숫자가 «맞게 적혔는가»)
     - tools/verifySaturation.js(T19) = 포화. 단 **장비 GOPT 126칸 안에서만** 본다
                                        (계열 내부 + 계열 간). 특전은 파싱조차 하지 않는다.
   그런데 §11.6 옵션표는 설계 제약상 «기존 엔진 동사만 재사용» 해서 만들었다(T6). 그 결과
   **102종 특전이 쓰는 px 키를 장비 옵션이 그대로 다시 쓴다** — 같은 불리언을 두 번 켜거나
   같은 확률 카운터를 두 번 올린다. 둘 다 «나중에 얻은 쪽의 효과가 0» 이다.
   T19 게이트가 counterWave 를 ALLOW 하며 적은 사유 «대검 계열 단독이라 계열 간 누적도 없다» 는
   장비끼리만 보면 맞지만, 전설 특전 l_counterWave 가 같은 키를 올리므로 **특전축에서는 틀렸다.**

   방식:
     ① pkk 기저확률표 추출 — sim.js 의 `pkk(p, B*px.KEY)` 전수에서 KEY→B.
     ② PERKS 파싱 — add('id',등급,ap,u) 에서 ap 가 건드리는 px 키와 그 방식(bool/inc)·u 플래그.
     ③ GOPT 126칸 파싱 — 옵션 인덱스(→ 요구 등급/강화)와 px 키·방식.
     ④ 교차 대조:
        (a) 불리언 완전중복 — 특전과 옵션이 같은 키를 `=true`/`=1` 로 켠다 → 나중 것 효과 0.
        (b) 확률 포화 — 계열이 그 키를 이미 1.0 이상으로 올려 놓으면 특전 실효 0(부분이면 낭비율).
     ⑤ **채점 하니스 실측** — 실험1·2·앵커 C/A/B 는 전부 `typeIdx 0`(mkBuild 기본값, T20 등재)이라
        장착 계열이 확정되어 있다. 그 5개 구성 각각에서 «지금 실제로 죽어 있는 특전» 을 뽑는다.
        여기 걸린 것은 이론상 조합이 아니라 **채점표 점수에 이미 반영된 값**이다.
   KNOWN 에 등재된 «주인 승인 대기 중인 기존 건» 은 실패로 세지 않는다(승인 전까지 게이트가
   계속 빨갛지 않게). 사유 없이 추가 금지 — T19 게이트와 같은 규약이다. */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SIM = fs.readFileSync(path.join(root, 'sim.js'), 'utf8');
const lines = SIM.split('\n');
const LIST = process.argv.includes('--list');

/* ── 승인 대기 중이라 지금은 못 고치는 기존 건 ── */
const KNOWN = {
  'bool|m_wave4|greatsword|4': 'T24 / 승인 대기 19번',
  'bool|l_execute|greatsword|7': 'T24 / 승인 대기 19번',
  'bool|m_axe3|axe|4': 'T24 / 승인 대기 19번',
  'bool|m_arrow4|bow|4': 'T24 / 승인 대기 19번',
  'bool|l_fullHpCrit|bow|7': 'T24 / 승인 대기 19번',
  'bool|m_guard|helmet|7': 'T24 / 승인 대기 19번',
  'bool|m_bolt3|hood|4': 'T24 / 승인 대기 19번',
  'bool|l_rage|robe|7': 'T24 / 승인 대기 19번',
  'bool|l_backDmg|gauntlet|7': 'T24 / 승인 대기 19번',
  'bool|l_killAspd|leather|6': 'T24 / 승인 대기 19번',
  'bool|m_clone|handwrap|6': 'T24 / 승인 대기 19번',
  'bool|m_execKill|handwrap|7': 'T24 / 승인 대기 19번',
  'bool|l_evadeCrit|sandal|7': 'T24 / 승인 대기 19번',
  'bool|l_counterChain|boots|7': 'T24 / 승인 대기 19번',
  'bool|r_lastStand|greave|7': 'T24 / 승인 대기 19번',
  'bool|l_overheal|pendant|7': 'T24 / 승인 대기 19번',
  'bool|m_sage|amulet|5': 'T24 / 승인 대기 19번',
  'bool|m_spear200|beads|4': 'T24 / 승인 대기 19번',
  'bool|m_procX2|beads|7': 'T24 / 승인 대기 19번',
  'prob|l_counterWave|greatsword': 'T24 / 승인 대기 19번 — 기저 1.0 이라 대검 옵6 하나로 이미 확정',
  'prob|l_thorns|chain': 'T24 / 승인 대기 19번 — T14(승인 12번)의 사슬갑옷 포화가 특전에도 그대로 번진다',
};

const RN = ['일반', '희귀', '전설', '신화'];
/* 옵션 인덱스 → 요구 등급·강화 (GT.optCount 의 역함수) */
const OPTREQ = ['희귀0강', '영웅0강', '전설0강', '신화0강', '신화+3강', '신화+6강', '신화+9강'];

let fail = 0;
const bad = k => { if (!KNOWN[k]) { fail++; return '🔴'; } return '🔵'; };

/* ── ① pkk 기저확률표 ─────────────────────────────── */
const BASE = {};
for (const m of SIM.matchAll(/pkk\(p,\s*([0-9.]+)\s*\*\s*px\.([A-Za-z0-9_]+)\)/g)) BASE[m[2]] = Number(m[1]);

/* ── ② PERKS 파싱 ─────────────────────────────────── */
const pStart = lines.findIndex(l => /^function mkPerks\(\)/.test(l));
const pEnd = lines.findIndex(l => /^const PERKS\s*=/.test(l));
if (pStart < 0 || pEnd < 0) { console.error('✗ mkPerks 블록을 찾지 못했다'); process.exit(1); }
const PERKS = [];
for (let i = pStart; i < pEnd; i++) {
  const m = lines[i].match(/^\s*add\('([^']+)',\s*(\d)\s*,/);
  if (!m) continue;
  const keys = {};
  for (const mm of lines[i].matchAll(/p\.px\.([A-Za-z0-9_]+)\s*(\+\+|\+=|=\s*(?:true|1)\b)/g))
    keys[mm[1]] = mm[2].startsWith('=') ? 'bool' : 'inc';
  PERKS.push({ id: m[1], r: Number(m[2]), uniq: /,\s*1\s*\)\s*;/.test(lines[i]), line: i + 1, keys });
}
if (PERKS.length !== 117) { console.error(`✗ 특전이 117종이 아니다 (파싱 결과 ${PERKS.length}종). T48 로 늘어나는 중이라, 늘렸으면 이 숫자도 같이 올릴 것`); process.exit(1); }

/* ── ③ GOPT 파싱 ──────────────────────────────────── */
const gStart = lines.findIndex(l => /^const GOPT\s*=\s*\{/.test(l));
let gEnd = -1;
for (let i = gStart + 1; i < lines.length; i++) if (/^\};/.test(lines[i])) { gEnd = i; break; }
if (gStart < 0 || gEnd < 0) { console.error('✗ GOPT 블록을 찾지 못했다'); process.exit(1); }
const GOPT = {};
let cur = null;
for (let i = gStart + 1; i < gEnd; i++) {
  const ln = lines[i];
  const t = ln.match(/^\s{2}([a-z]+)\s*:\s*\[/);
  if (t) { cur = t[1]; GOPT[cur] = []; continue; }
  if (/^\s{2}\],/.test(ln)) { cur = null; continue; }
  if (!cur || !/\{\s*d:/.test(ln)) continue;
  const keys = {};
  for (const mm of ln.matchAll(/p\.px\.([A-Za-z0-9_]+)\s*(\+\+|\+=|=\s*(?:true|1)\b)/g))
    keys[mm[1]] = mm[2].startsWith('=') ? 'bool' : 'inc';
  GOPT[cur].push({ idx: GOPT[cur].length + 1, keys, d: (ln.match(/d:\s*'([^']*)'/) || [])[1] || '' });
}
const nCell = Object.values(GOPT).reduce((s, a) => s + a.length, 0);
if (nCell !== 126) { console.error(`✗ GOPT 가 126칸이 아니다 (파싱 결과 ${nCell}칸)`); process.exit(1); }

/* 계열 한글명 */
const TYNAME = {};
for (const m of SIM.matchAll(/([a-z]+):'([^']+)'/g)) if (GOPT[m[1]] && !TYNAME[m[1]]) TYNAME[m[1]] = m[2];
const ty2 = t => `${t}(${TYNAME[t] || '?'})`;

console.log('=== 특전 ↔ 장비옵션 중복 사장 대조 (T24 게이트) ===');
console.log(`  대상: 특전 ${PERKS.length}종 · GOPT ${nCell}칸 · pkk 확률 키 ${Object.keys(BASE).length}종\n`);

/* ── ④-a 불리언 완전중복 ──────────────────────────── */
console.log('[① 불리언 완전중복 — 특전과 옵션이 같은 px 를 켠다 → 나중 취득분 효과 0]');
let nBool = 0;
for (const ty in GOPT) for (const o of GOPT[ty]) for (const k in o.keys) {
  if (o.keys[k] !== 'bool') continue;
  for (const p of PERKS) {
    if (!p.keys[k]) continue;
    nBool++;
    const key = `bool|${p.id}|${ty}|${o.idx}`;
    console.log(`  ${bad(key)} ${p.id} (${RN[p.r]}${p.uniq ? ',단발' : ''}) ↔ ${ty2(ty)} 옵${o.idx}[${OPTREQ[o.idx - 1]}] "${o.d}"  키=px.${k}`);
    if (KNOWN[key]) console.log(`        └ 등재됨: ${KNOWN[key]}`);
  }
}
if (!nBool) console.log('  없음');

/* ── ④-b 확률 포화 ────────────────────────────────── */
console.log('\n[② 확률키 포화 — 계열이 이미 1.0 이상 → 같은 키의 특전 실효 0]');
let nProb = 0;
for (const ty in GOPT) {
  const acc = {};
  for (const o of GOPT[ty]) for (const k in o.keys)
    if (o.keys[k] === 'inc') { (acc[k] = acc[k] || { n: 0, at: [] }).n++; acc[k].at.push(o.idx); }
  for (const k in acc) {
    const B = BASE[k];
    if (B === undefined) continue;
    const tot = B * acc[k].n;
    if (tot < 1 - 1e-9) continue;
    for (const p of PERKS) {
      if (p.keys[k] !== 'inc') continue;
      nProb++;
      const key = `prob|${p.id}|${ty}`;
      console.log(`  ${bad(key)} ${p.id} (${RN[p.r]}) ↔ ${ty2(ty)} 옵${acc[k].at.join('+')} : px.${k} 기저 ${B} × ${acc[k].n}칸 = ${(tot * 100).toFixed(0)}% (포화) → 특전 실효 0`);
      if (KNOWN[key]) console.log(`        └ 등재됨: ${KNOWN[key]}`);
    }
  }
}
if (!nProb) console.log('  없음');

/* ── ⑤ 채점 하니스 실측 ───────────────────────────── */
/* mkBuild(rar,plus,slot,typeIdx) 는 typeIdx 기본 0 이고 호출자 전원이 안 넘긴다(T20). */
const T0 = ['greatsword', 'helmet', 'plate', 'gauntlet', 'sandal', 'pendant'];
const optCount = (rar, plus) => { let n = rar; if (rar === 4) { if (plus >= 3) n++; if (plus >= 6) n++; if (plus >= 9) n++; } return n; };
const CFG = [
  { nm: '실험1 (전설0강·슬롯2)', rar: 3, plus: 0 },
  { nm: '실험2 (신화0강·슬롯0)', rar: 4, plus: 0 },
  { nm: '앵커C (전설0강·슬롯10)', rar: 3, plus: 0 },
  { nm: '앵커A (신화0강·슬롯15)', rar: 4, plus: 0 },
  { nm: '앵커B (신화+9강·슬롯50)', rar: 4, plus: 9 },
];
console.log('\n[③ 채점 하니스에서 실제로 죽어 있는 특전 — typeIdx 0 = ' + T0.map(ty2).join(' / ') + ']');
const deadAt = {};
for (const c of CFG) {
  const n = optCount(c.rar, c.plus);
  const on = {};                              /* 이 구성에서 장비가 켜 놓은 키 */
  for (const ty of T0) for (const o of (GOPT[ty] || [])) {
    if (o.idx > n) continue;
    for (const k in o.keys) {
      const e = (on[k] = on[k] || { bool: false, n: 0, src: [] });
      if (o.keys[k] === 'bool') e.bool = true; else e.n++;
      e.src.push(`${TYNAME[ty] || ty}옵${o.idx}`);
    }
  }
  const dead = [];
  for (const p of PERKS) for (const k in p.keys) {
    const e = on[k]; if (!e) continue;
    if (e.bool || p.keys[k] === 'bool') { dead.push(`${p.id}(${RN[p.r]}) ←${e.src.join('+')}`); continue; }
    const B = BASE[k];
    if (B !== undefined && B * e.n >= 1 - 1e-9) dead.push(`${p.id}(${RN[p.r]}) ←${e.src.join('+')}·확률포화`);
  }
  deadAt[c.nm] = dead;
  console.log(`  ${c.nm} 옵1~${n}: 사장 ${dead.length}종${dead.length ? ' — ' + dead.join(' · ') : ''}`);
}

/* ── 요약 ─────────────────────────────────────────── */
console.log('');
if (LIST) {
  console.log('[--list] 특전·장비가 공유하는 px 키 전체');
  const shared = {};
  for (const ty in GOPT) for (const o of GOPT[ty]) for (const k in o.keys) (shared[k] = shared[k] || new Set()).add(`${ty}옵${o.idx}`);
  for (const p of PERKS) for (const k in p.keys) if (shared[k]) console.log(`  px.${k}: ${p.id} ↔ ${[...shared[k]].join(',')}`);
  console.log('');
}
console.log(`불리언 완전중복 ${nBool}쌍 · 확률 포화 ${nProb}쌍 · 그중 신규 ${fail}건`);
if (fail) {
  console.log('→ 실패: 신규 중복은 KNOWN 에 사유와 함께 등재하거나(승인 대기) 수정해야 한다');
  process.exit(1);
}
console.log('→ 통과 (등재된 기존 건만 존재)');
