'use strict';
/* «효과 포화» 자동 대조 게이트 (T19 신설)
   사용: node tools/verifySaturation.js          (신규 포화가 있으면 exit 1)
         node tools/verifySaturation.js --list   (포화 아닌 항목까지 전부 덤프)

   왜 필요한가: T14 가 «사슬갑옷 옵2(가시 60%) + 옵5(+60%p) = 120% → 100% 에서 잘린다» 를 잡았는데,
   그 검사는 **한 계열 안에서만** 중복 키를 봤다. 그래서 «부위가 다른 두 계열이 같은 px 키를 올리는»
   경우는 구조적으로 볼 수 없었고, 실제로 그 축에 미등재 건이 하나 더 있었다(T19 — 장궁 옵5 + 건틀릿 옵6).
   기존 게이트 두 개는 이 축을 전혀 덮지 않는다:
     - tools/verifyPlanConst.js (T16) = PLAN↔엔진 경제·적 상수 48항목
     - tools/verifyOptText.js   (T17) = 설명문↔엔진 상수 (숫자가 «맞게 적혔는가»)
   포화는 숫자가 **맞게 적혀 있어도** 발생한다 — 60% 도 75% 도 엔진 상수 그대로인데 합치면 100% 를 넘는다.
   그래서 T17 게이트는 통과하면서 효과는 버려진다. 이 게이트가 그 사각을 덮는다.

   방식:
     ① pkk 기저확률표 추출 — sim.js 의 `pkk(p, B*px.KEY)` 전수에서 KEY→B 를 뽑는다.
     ② GOPT 126칸에서 각 옵션이 ++ 하는 px 키와 그 옵션의 인덱스(→ 요구 등급/강화)를 뽑는다.
     ③ 계열 내부 누적: 신화+9(옵1~7 전부)에서 B × 중복수 > 1.0 이면 포화.
     ④ 계열 간 누적: 부위별로 1계열만 장착 가능하므로 «부위별 최대치» 를 합산해 > 1.0 이면 포화.
     ⑤ m_procX2(×1.22) 동반 시에만 1.0 을 넘는 키는 🟡 경고(포화 자체는 아님).
     ⑥ 상한 스탯(effDef 80 · effEvade 90)의 장비 기여 여유분 보고.
   KNOWN 에 등재된 «주인 승인 대기 중인 기존 건» 은 실패로 세지 않는다(승인 전까지 게이트가 계속
   빨갛지 않게). ALLOW 는 «설계상 확정(기저 1.0)» 처럼 포화가 정상인 항목. 둘 다 사유 없이 추가 금지. */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SIM = fs.readFileSync(path.join(root, 'sim.js'), 'utf8');
const LIST = process.argv.includes('--list');

/* ── 승인 대기 중이라 지금은 못 고치는 기존 포화 ── */
const KNOWN = {
  'series|chain|thorns': 'T14 / 승인 대기 12번 — 사슬갑옷 옵2(60%)+옵5(+60%p)=120%. 주인이 3안 중 하나를 고르면 해소',
  'cross|extraHit': 'T19 / 승인 대기 15번 — 장궁 옵5 + 건틀릿 옵6 이 둘 다 «치명타 시 75% 확률 추가타»=150%. 주인이 3안 중 하나를 고르면 해소',
};
/* ── 포화가 설계상 정상인 항목 ── */
const ALLOW = {
  'proc|counterWave': '기저 1.0 = 설명문도 «반격 시 검기 발사(확정)» 라 확정이 의도다. procX2 분만 버려지며 이는 확정형 옵션의 일반 성질(대검 계열 단독이라 계열 간 누적도 없다). ⚑ 단 이 사유는 **장비끼리만** 맞다 — 전설 특전 l_counterWave 가 같은 키를 올려 그쪽은 실효 0 이다(T24 / 승인 대기 19번, tools/verifyPerkGearDup.js 가 잡는다)',
  'proc|evadeCounter': '기저 1.0 = «회피 시 반격(확정)». 위와 같은 사유',
};

/* ── ① pkk 기저확률표 ─────────────────────────────── */
const BASE = {};
for (const m of SIM.matchAll(/pkk\(p,\s*([0-9.]+)\s*\*\s*px\.([A-Za-z0-9_]+)\)/g)) {
  const [, b, k] = m;
  if (BASE[k] !== undefined && BASE[k] !== Number(b)) {
    console.error(`✗ pkk 기저확률이 한 키에 두 값: px.${k} = ${BASE[k]} / ${b}`);
    process.exit(1);
  }
  BASE[k] = Number(b);
}

/* ── ② GOPT 파싱 ──────────────────────────────────── */
const lines = SIM.split('\n');
const gStart = lines.findIndex(l => /^const GOPT\s*=\s*\{/.test(l));
if (gStart < 0) { console.error('✗ GOPT 블록을 찾지 못했다'); process.exit(1); }
let gEnd = -1;
for (let i = gStart + 1; i < lines.length; i++) if (/^\};/.test(lines[i])) { gEnd = i; break; }
if (gEnd < 0) { console.error('✗ GOPT 블록의 끝을 찾지 못했다'); process.exit(1); }

const series = {};   // type -> [{d, keys:[...]}]
let cur = null;
for (let i = gStart + 1; i < gEnd; i++) {
  const L = lines[i];
  const open = L.match(/^\s{2}([a-z]+):\s*\[/);
  if (open) { cur = open[1]; series[cur] = []; continue; }
  if (cur && /^\s{2}\],?\s*$/.test(L)) { cur = null; continue; }
  if (!cur) continue;
  const o = L.match(/\{\s*d:\s*'([^']*)'\s*,\s*ap:(.*?)\}\s*,?\s*(\/\*[\s\S]*)?$/);
  if (!o) continue;
  const keys = [...o[2].matchAll(/p\.px\.([A-Za-z0-9_]+)\s*(?:\+\+|=)/g)].map(x => x[1]);
  series[cur].push({ d: o[1], keys });
}

/* 부위·이름표 (GT 에서 그대로 뽑는다 — 하드코딩 금지) */
function grabObj(name) {
  const s = SIM.indexOf(`  ${name}:{`);
  if (s < 0) return null;
  let depth = 0, i = SIM.indexOf('{', s);
  for (let j = i; j < SIM.length; j++) {
    if (SIM[j] === '{') depth++;
    else if (SIM[j] === '}') { depth--; if (!depth) return SIM.slice(i, j + 1); }
  }
  return null;
}
const typesSrc = grabObj('types');
const partOf = {}, PARTS = [];
if (typesSrc) {
  for (const m of typesSrc.matchAll(/([a-z]+):\s*\[([^\]]*)\]/g)) {
    PARTS.push(m[1]);
    for (const t of m[2].matchAll(/'([a-z]+)'/g)) partOf[t[1]] = m[1];
  }
}
const nameSrc = grabObj('typeName');
const typeName = {};
if (nameSrc) for (const m of nameSrc.matchAll(/([a-z]+):\s*'([^']*)'/g)) typeName[m[1]] = m[2];
const nm = t => `${typeName[t] || t}(${t})`;

/* 옵션 인덱스 → 요구 등급/강화 (GT.optCount 규칙: 등급 n개 + 신화 +3/+6/+9 에 1개씩) */
const reqOf = i => ['희귀', '영웅', '전설', '신화 0강', '신화 +3강', '신화 +6강', '신화 +9강'][i] || `옵${i + 1}`;

const nSeries = Object.keys(series).length;
const nOpt = Object.values(series).reduce((a, b) => a + b.length, 0);
console.log('=== 효과 포화 대조 (T19 게이트) ===');
console.log(`  대상: ${nSeries}계열 ${nOpt}칸 · pkk 확률 키 ${Object.keys(BASE).length}종`);
if (nSeries !== 18 || nOpt !== 126) {
  console.error(`✗ 계열/칸 수가 18계열 126칸이 아니다 (${nSeries}/${nOpt}) — 파싱이 깨졌거나 스펙이 바뀌었다`);
  process.exit(1);
}

const bad = [];   // 신규 포화
const known = []; // 등재된 기존 포화
const warn = [];

/* ── ③ 계열 내부 누적 ─────────────────────────────── */
console.log('\n[① 계열 내부 누적 — 신화 +9강(옵1~7 전부) 기준]');
for (const s of Object.keys(series)) {
  const cnt = {}, at = {};
  series[s].forEach((o, i) => o.keys.forEach(k => { cnt[k] = (cnt[k] || 0) + 1; (at[k] = at[k] || []).push(i); }));
  for (const k of Object.keys(cnt)) {
    if (cnt[k] < 2 || BASE[k] === undefined) continue;
    const eff = BASE[k] * cnt[k];
    const where = at[k].map(i => `옵${i + 1}(${reqOf(i)})`).join(' + ');
    const line = `${nm(s)} px.${k} ×${cnt[k]} → ${(BASE[k] * 100).toFixed(1)}% × ${cnt[k]} = ${(eff * 100).toFixed(1)}%  [${where}]`;
    if (eff > 1.0000001) {
      const id = `series|${s}|${k}`;
      if (KNOWN[id]) { known.push(`${line}\n        └ 등재됨: ${KNOWN[id]}`); }
      else bad.push({ id, line: `${line}  ⚠버려짐 ${((eff - 1) * 100).toFixed(1)}%p` });
    } else if (LIST) console.log(`     ${line}`);
  }
}
if (!LIST) console.log('     (포화분만 아래 요약에 표시 — 전체는 --list)');

/* ── ④ 계열 간 누적 (부위별 1계열) ────────────────── */
console.log('\n[② 계열 간 동시 장착 누적 — 부위마다 1계열만 장착 가능]');
const owners = {};
for (const s of Object.keys(series)) {
  const cnt = {}, at = {};
  series[s].forEach((o, i) => o.keys.forEach(k => { cnt[k] = (cnt[k] || 0) + 1; (at[k] = at[k] || []).push(i); }));
  for (const k of Object.keys(cnt)) (owners[k] = owners[k] || []).push({ s, n: cnt[k], part: partOf[s], at: at[k] });
}
for (const k of Object.keys(owners)) {
  const os = owners[k];
  if (BASE[k] === undefined) continue;
  const byPart = {};
  for (const o of os) if (!byPart[o.part] || byPart[o.part].n < o.n) byPart[o.part] = o;
  const chosen = Object.values(byPart);
  if (chosen.length < 2) continue;                       // 계열 간이 아니면 ① 이 이미 봤다
  const tot = chosen.reduce((a, b) => a + b.n, 0);
  const eff = BASE[k] * tot;
  const who = chosen.map(o => `${nm(o.s)} 옵${o.at.map(i => i + 1).join('·')}(${o.at.map(reqOf).join('·')})`).join(' + ');
  const line = `px.${k} ×${tot} → ${(BASE[k] * 100).toFixed(1)}% × ${tot} = ${(eff * 100).toFixed(1)}%  [${who}]`;
  if (eff > 1.0000001) {
    const id = `cross|${k}`;
    if (KNOWN[id]) known.push(`${line}\n        └ 등재됨: ${KNOWN[id]}`);
    else bad.push({ id, line: `${line}  ⚠버려짐 ${((eff - 1) * 100).toFixed(1)}%p` });
  } else if (LIST) console.log(`     ${line}`);
}
if (!LIST) console.log('     (포화분만 아래 요약에 표시 — 전체는 --list)');

/* ── ⑤ procX2 경계 ────────────────────────────────── */
for (const k of Object.keys(owners)) {
  if (BASE[k] === undefined) continue;
  const byPart = {};
  for (const o of owners[k]) if (!byPart[o.part] || byPart[o.part].n < o.n) byPart[o.part] = o;
  const tot = Object.values(byPart).reduce((a, b) => a + b.n, 0);
  const e1 = BASE[k] * tot, e2 = e1 * 1.22;
  if (e1 <= 1.0000001 && e2 > 1.0000001 && !ALLOW[`proc|${k}`]) {
    warn.push(`px.${k}: ${(e1 * 100).toFixed(1)}% → m_procX2 동반 ${(e2 * 100).toFixed(1)}% (초과 ${((e2 - 1) * 100).toFixed(1)}%p 는 버려진다)`);
  }
}

/* ── ⑥ 상한 스탯 여유분 ───────────────────────────── */
console.log('\n[③ 상한 스탯 — 장비만으로 상한에 닿는가]');
const capChk = [
  { stat: 'def', cap: 80, base: 5, re: /p\.def\s*\+=\s*([0-9.]+)/g },
  { stat: 'evade', cap: 90, base: 8, re: /p\.evade\s*\+=\s*([0-9.]+)/g },
];
for (const c of capChk) {
  const perPart = {};
  /* 설명문이 아니라 ap 소스(`p.def+=n`)를 직접 훑어 계열별 합을 낸다 */
  const sums = {};
  let curS = null;
  for (let i = gStart + 1; i < gEnd; i++) {
    const L = lines[i];
    const open = L.match(/^\s{2}([a-z]+):\s*\[/); if (open) { curS = open[1]; sums[curS] = 0; continue; }
    if (curS && /^\s{2}\],?\s*$/.test(L)) { curS = null; continue; }
    if (!curS) continue;
    for (const m of L.matchAll(c.re)) sums[curS] += Number(m[1]);
  }
  for (const s of Object.keys(sums)) {
    const p = partOf[s];
    if (!perPart[p] || perPart[p].v < sums[s]) perPart[p] = { v: sums[s], s };
  }
  const tot = Object.values(perPart).reduce((a, b) => a + b.v, 0);
  const best = Object.values(perPart).filter(x => x.v > 0).map(x => `${nm(x.s)} +${x.v}`).join(' + ') || '없음';
  const reach = c.base + tot;
  console.log(`     ${c.stat}: 기본 ${c.base} + 장비 최대 ${tot} = ${reach} / 상한 ${c.cap} → 여유 ${c.cap - reach}  [${best}]`);
  if (reach > c.cap) bad.push({ id: `cap|${c.stat}`, line: `${c.stat} 이 장비만으로 상한 ${c.cap} 초과 (${reach}) — 초과분이 통째로 버려진다` });
}

/* ── 요약 ─────────────────────────────────────────── */
console.log('');
if (known.length) { console.log('[등재된 기존 포화 — 주인 승인 대기라 실패로 세지 않는다]'); known.forEach(l => console.log(`  🔵 ${l}`)); }
if (warn.length) { console.log('[🟡 procX2 경계 — 포화는 아니나 procX2 분이 버려지는 키]'); warn.forEach(l => console.log(`  🟡 ${l}`)); }
if (bad.length) {
  console.log('\n[🔴 신규 포화]');
  bad.forEach(b => console.log(`  🔴 ${b.line}\n     (해소했으면 KNOWN 또는 ALLOW 에 사유와 함께 등재: '${b.id}')`));
  console.log(`\n신규 포화 ${bad.length}건 → 실패`);
  process.exit(1);
}
console.log(`신규 포화 0건 · 등재된 기존 포화 ${known.length}건 · procX2 경계 ${warn.length}건`);
console.log('→ 통과');
