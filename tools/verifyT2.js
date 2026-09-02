'use strict';
/* T2 이식 게이트 — index.html ↔ sim.js 1:1 대조
 *
 * ROUTINE §2 T2 완료 게이트: 「node --check 급 문법 검사 + 특전 102종 전수 존재 확인」.
 * 그 위에, T8·T9·T11·T12·T16 이 반복해서 겪은 「두 파일이 조용히 벌어진다」를 막기 위해
 * 특전 ap 본문·px 키 집합·대표 수식까지 문자열로 대조한다.
 *
 * 사용: node tools/verifyT2.js      (exit 0 = 통과, 1 = 불합격)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SIM = fs.readFileSync(path.join(ROOT, 'sim.js'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let fail = 0, pass = 0;
const ok = m => { pass++; console.log('  ✓ ' + m); };
const bad = m => { fail++; console.log('  ✗ ' + m); };

/* ---------- 공통 파서 ---------- */
/* `add('id',r,<ap>[,1]);` 를 괄호 깊이를 세어 안전하게 쪼갠다 (ap 본문에 콤마가 들어간다) */
function splitTop(src) {
  const parts = []; let d = 0, cur = '', q = null;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) { cur += ch; if (ch === q && src[i - 1] !== '\\') q = null; continue; }
    if (ch === "'" || ch === '"') { q = ch; cur += ch; continue; }
    if ('([{'.includes(ch)) d++;
    if (')]}'.includes(ch)) d--;
    if (ch === ',' && d === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}
const norm = s => s.replace(/\s+/g, '');

function simPerks() {
  const body = SIM.slice(SIM.indexOf('function mkPerks()'), SIM.indexOf('const PERKS=mkPerks()'));
  const out = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('add(')) continue;
    let inner = line.slice(4);
    const ci = inner.indexOf('); //');
    inner = ci >= 0 ? inner.slice(0, ci) : inner.replace(/\);\s*$/, '');
    const parts = splitTop(inner);
    const id = parts[0].trim().slice(1, -1);
    const r = +parts[1].trim();
    const apParts = parts.slice(2);
    let u = false;
    if (apParts.length > 1 && apParts[apParts.length - 1].trim() === '1') { u = true; apParts.pop(); }
    out.push({ id, r, ap: apParts.join(',').trim(), u });
  }
  return out;
}

function htmlPerks() {
  const m = HTML.match(/const PERKS=\[[\s\S]*?\n\];/);
  if (!m) return null;
  const out = [];
  for (const raw of m[0].split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('{id:')) continue;
    const inner = line.replace(/^\{/, '').replace(/\},?$/, '');
    const parts = splitTop(inner);
    const get = k => {
      const p = parts.find(x => x.trim().startsWith(k + ':'));
      return p === undefined ? undefined : p.trim().slice(k.length + 1).trim();
    };
    const idRaw = get('id');
    out.push({
      id: idRaw.slice(1, -1),
      r: +get('r'),
      ic: (get('ic') || '').slice(1, -1),
      tx: (get('tx') || '').slice(1, -1),
      ap: get('ap'),
      u: get('u') === '1',
    });
  }
  return out;
}

/* ---------- ① index.html 스크립트 문법 ---------- */
console.log('\n[① index.html <script> 문법 검사]');
const sm = HTML.match(/<script>([\s\S]*)<\/script>/);
if (!sm) { bad('<script> 블록을 찾지 못했다'); }
else {
  try { new vm.Script(sm[1]); ok('파싱 성공 (node --check 상당)'); }
  catch (e) { bad('구문 오류: ' + e.message); }
}

/* ---------- ② 특전 102종 전수 대조 ---------- */
console.log('\n[② 특전 102종 — id·등급·고유·ap 본문 전수 대조]');
const S = simPerks(), H = htmlPerks();
if (!H) { bad('index.html 에서 const PERKS=[...] 를 찾지 못했다'); }
else {
  if (S.length === 102) ok(`sim.js mkPerks() = ${S.length}종`);
  else bad(`sim.js mkPerks() 가 ${S.length}종 (102 이어야 함)`);
  if (H.length === S.length) ok(`index.html PERKS = ${H.length}종`);
  else bad(`index.html PERKS = ${H.length}종 (sim ${S.length}종과 다름)`);

  const cnt = r => [S.filter(x => x.r === r).length, H.filter(x => x.r === r).length];
  const RN = ['일반', '희귀', '전설', '신화'];
  for (let r = 0; r < 4; r++) {
    const [a, b] = cnt(r);
    if (a === b) ok(`${RN[r]} ${a}종 일치`);
    else bad(`${RN[r]} 개수 불일치 — sim ${a} vs index ${b}`);
  }

  const hm = new Map(H.map(x => [x.id, x]));
  let miss = [], rdiff = [], udiff = [], apdiff = [];
  for (const s of S) {
    const h = hm.get(s.id);
    if (!h) { miss.push(s.id); continue; }
    if (h.r !== s.r) rdiff.push(`${s.id}(sim ${s.r} vs index ${h.r})`);
    if (h.u !== s.u) udiff.push(`${s.id}(sim u=${s.u} vs index u=${h.u})`);
    if (norm(h.ap) !== norm(s.ap)) apdiff.push(`${s.id}\n      sim  : ${s.ap}\n      index: ${h.ap}`);
  }
  const extra = H.filter(x => !S.find(s => s.id === x.id)).map(x => x.id);
  miss.length ? bad(`index.html 에 없는 특전 ${miss.length}종: ${miss.join(' ')}`) : ok('누락 특전 0');
  extra.length ? bad(`sim.js 에 없는 특전 ${extra.length}종: ${extra.join(' ')}`) : ok('잉여 특전 0');
  rdiff.length ? bad(`등급 불일치 ${rdiff.length}건: ${rdiff.join(' ')}`) : ok('등급 전수 일치');
  udiff.length ? bad(`고유(u) 불일치 ${udiff.length}건: ${udiff.join(' ')}`) : ok('고유 플래그 전수 일치');
  apdiff.length ? bad(`ap 본문 불일치 ${apdiff.length}건:\n    ` + apdiff.join('\n    ')) : ok('ap 본문 102종 전수 일치');

  /* 표시 텍스트가 PLAN §3 표에서 온 것인지 (빈 tx·아이콘 누락 검출) */
  const noTx = H.filter(x => !x.tx || !x.ic).map(x => x.id);
  noTx.length ? bad(`표시 텍스트·아이콘 누락 ${noTx.length}종: ${noTx.join(' ')}`) : ok('표시 텍스트·아이콘 102종 전부 존재');
}

/* ---------- ③ px 키 집합 ---------- */
console.log('\n[③ px(특전 효과) 키 집합 대조]');
function pxKeys(src) {
  const set = new Set(); let m;
  const re = /(?:px|p\.px)\.([A-Za-z_][A-Za-z0-9_]*)/g;
  while ((m = re.exec(src))) set.add(m[1]);
  return set;
}
{
  const a = pxKeys(SIM), b = pxKeys(HTML);
  const onlyS = [...a].filter(x => !b.has(x)).sort();
  const onlyH = [...b].filter(x => !a.has(x)).sort();
  onlyS.length ? bad(`index.html 이 구현하지 않은 효과 ${onlyS.length}개: ${onlyS.join(' ')}`) : ok(`sim.js 효과 ${a.size}개 전부 index.html 에 존재`);
  onlyH.length ? bad(`sim.js 에 없는 구버전 잔재 효과 ${onlyH.length}개: ${onlyH.join(' ')}`) : ok('구버전 잔재 효과 0');
}

/* ---------- ④ 대표 수식 대조 ---------- */
console.log('\n[④ 대표 수식 대조 (ROUTINE §2 T2 «대표 수식 5개 이상»)]');
const FORMULAS = [
  ['pkk 폭풍의 힘 배수', /procX2\?1\.22:1/, /procX2\?1\.22:1/],
  ['effDef 상한', /Math\.min\(80,p\.def\+bsum\(p,'def'\)\)/, /Math\.min\(80,p\.def\+bsum\(p,'def'\)\)/],
  ['effEvade 상한·최후의 저항', /lastStand&&p\.hp<=p\.maxHp\*0\.10\)?e?\+?=?40[\s\S]{0,40}Math\.min\(90/, /lastStand&&p\.hp<=p\.maxHp\*0\.10\)\s*e\+=40;?\s*return Math\.min\(90/],
  ['effDmg 격노 배수', /rage&&p\.sh<=0\)m?\s*\*=\s*1\.5/, /rage&&p\.sh<=0\)\s*m\*=1\.5/],
  ['처형(execute) 배수', /execute&&e\.hp<=e\.maxHp\*0\.5\)d\*=2\.2/, /execute&&e\.hp<=e\.maxHp\*0\.5\)\s*d\*=2\.2/],
  ['배후(backDmg) 배수', /front&&e!==front\)d\*=3\.2/, /front&&e!==front\)\s*d\*=3\.2/],
  ['처형자(execKill) 임계', /execKill&&!e\.isBoss&&e\.hp>0&&e\.hp<=e\.maxHp\*0\.25/, /execKill&&!e\.isBoss&&e\.hp>0&&e\.hp<=e\.maxHp\*0\.25/],
  ['수호의 결정 감쇄', /guardCrystal&&p\.sh>0\)d\*=0\.62/, /guardCrystal&&p\.sh>0\)\s*d\*=0\.62/],
  ['부활 회복률', /revive--;p\.hp=p\.maxHp\*0\.07;p\.sh=p\.maxSh\*0\.07/, /revive--;[\s\S]{0,40}p\.hp=p\.maxHp\*0\.07;\s*p\.sh=p\.maxSh\*0\.07/],
  ['가시(thorns) 확률·계수', /thorns&&src&&src\.hp>0&&pkk\(p,0\.60\*px\.thorns\)/, /thorns&&src&&src\.hp>0&&pkk\(p,0\.60\*px\.thorns\)/],
  ['반격 피해 계수', /effDmg\(p\)\*0\.7\*\(1\+px\.counterX\)/, /effDmg\(p\)\*0\.7\*\(1\+px\.counterX\)/],
  ['추가타(extraHit) 확률·배수', /extraHit&&pkk\(p,0\.75\*px\.extraHit\)&&e\.hp>0\)dealDmg\(G,e,2\.3\)/, /extraHit&&pkk\(p,0\.75\*px\.extraHit\)&&e\.hp>0\)\s*dealPlayerDamage\(e,2\.3/],
  ['분신(clone) 계수', /clone&&e\.hp>0\)dealDmg\(G,e,0\.37\)/, /clone&&e\.hp>0\)\s*dealPlayerDamage\(e,0\.37/],
  ['초과회복→실드 계수', /overheal\)\s*p\.sh=Math\.min\(p\.maxSh,p\.sh\+over\*7\)/, /overheal\)\s*p\.sh=Math\.min\(p\.maxSh,p\.sh\+over\*7\)/],
  ['뇌신 주기', /autoBoltT=2\.4/, /autoBoltT=2\.4/],
  ['등급 굴림 확률', /r<0\.15\?3\s*:\s*r<0\.40\?2\s*:\s*r<0\.70\?1\s*:\s*0/, /r<0\.15\?3\s*:\s*r<0\.40\?2\s*:\s*r<0\.70\?1\s*:\s*0/],
  ['👼 전설이상 신화 비율', /legendOnly\)\s*return Math\.random\(\)<0\.375\?3:2/, /legendOnly\)\s*return Math\.random\(\)<0\.375\?3:2/],
  ['경험치 요구식', /expNeed:lv=>4\+2\*lv/, /expNeed=lv=>4\+2\*lv/],
];
for (const [name, reSim, reHtml] of FORMULAS) {
  const a = reSim.test(SIM), b = reHtml.test(HTML);
  if (a && b) ok(name);
  else if (!a && !b) bad(`${name} — 양쪽 다 파싱 실패 (코드 모양이 바뀌었다 — 게이트를 갱신할 것)`);
  else bad(`${name} — ${a ? 'index.html' : 'sim.js'} 쪽에서 찾지 못했다`);
}

/* ---------- ⑤ 주인 지시 이행 (index.html 관측 가능 동작) ---------- */
console.log('\n[⑤ 주인 지시 이행 — 배포 빌드에서 관측되는 동작]');
const DIRECTIVES = [
  ['웨이브 전멸 실드 무료충전 폐지 (06:5X·08:5X)', () => !/wave\.done=true;[\s\S]{0,120}p\.sh=p\.maxSh/.test(HTML)],
  ['특전 선택지 등급 통일 — 등급은 1번만 굴린다 (06:2X)', () => {
    const m = HTML.match(/function rollPerks\(n\)\{[\s\S]*?\n\}/);
    return !!m && (m[0].match(/rollRarity\(\)/g) || []).length === 1 && /const rar=rollRarity\(\)/.test(m[0]);
  }],
  ['🔮 전지의 눈 = 4택', () => /rollPerks\(G\.player\.px\.choice4\?4:3\)/.test(HTML)],
  ['챕터 종료 보스 킬 = 특전 스킵 (06:3X)', () => /G\.cleared=true/.test(HTML) && /lev>0\s*&&\s*!G\.over\s*&&\s*!G\.cleared/.test(HTML)],
  ['레벨업 회복·최대치 보정 없음 (06:4X)', () => {
    const m = HTML.match(/function gainExp\(n\)\{[\s\S]*?\n\}/);
    return !!m && !/maxHp|maxSh|p\.hp=|p\.sh=/.test(m[0]);
  }],
  ['흡혈 증가 특전 0종 (07:1X)', () => !/ap:p=>p\.steal\+=/.test(HTML)],
  ['스탯 그리드에서 흡혈 행 제거 — 7종 (07:1X)', () => {
    const m = HTML.match(/const STAT_DEFS=\[[\s\S]*?\n\];/) || HTML.match(/\n\/\* =+ 스탯[\s\S]*?\n\];/);
    return !/\{ic:'🩸',lb:'흡혈'/.test(HTML);
  }],
  ['소환은 도끼·화살·번개·검기·창 5종만 — 메테오 잔재 0 (PLAN §3.0)', () => !/meteor/i.test(HTML)],
  ['다연발 = 순차 연사 50~70ms (08:3X)', () => /function volley\(/.test(HTML) && /k\*\(50\+Math\.random\(\)\*20\)/.test(HTML)],
];
for (const [name, fn] of DIRECTIVES) {
  let r;
  try { r = fn(); } catch (e) { r = false; }
  r ? ok(name) : bad(name);
}

/* ---------- ⑥ 특전 102종 실행 (예외 0) ---------- */
console.log('\n[⑥ 특전 102종 ap 실행 — 런타임 예외 검출]');
if (H) {
  const sandbox = {
    Math, console,
    heal: (p, a) => { p.hp = Math.min(p.maxHp, p.hp + a); },
    G: { perkChances: 3, legendOnly: false, overBoltCd: 0 },
  };
  vm.createContext(sandbox);
  let thrown = [];
  const mkP = () => {
    const px = {};
    for (const k of pxKeys(SIM)) px[k] = 0;
    return { maxHp: 300, hp: 300, maxSh: 240, sh: 240, dmg: 30, aspd: 1, critR: 5, critF: 200,
      def: 5, counter: 10, evade: 8, steal: 0, killHeal: 0, misfire: 0, goldMul: 1, walkMul: 1,
      healAmp: 0, px, G: sandbox.G };
  };
  for (const h of H) {
    try {
      const f = vm.runInContext('(' + h.ap + ')', sandbox);
      f(mkP());
    } catch (e) { thrown.push(`${h.id}: ${e.message}`); }
  }
  thrown.length ? bad(`ap 실행 예외 ${thrown.length}건:\n    ` + thrown.join('\n    ')) : ok('102종 전부 예외 없이 적용됨');
}

/* ---------- 결과 ---------- */
console.log(`\n통과 ${pass} · 불합격 ${fail}`);
console.log(fail === 0 ? '→ 통과' : '→ 불합격');
process.exit(fail === 0 ? 0 : 1);
