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

/* ---------- ⑦ TUNE 상수 대조 (적 성장·벽·보스·경제·챕터 상한) ---------- */
console.log('\n[⑦ TUNE 상수 — sim.js ↔ index.html 값 대조]');
function tuneConsts(src) {
  const m = src.match(/const TUNE\s*=\s*\{([\s\S]*?)\n\};/);
  if (!m) return null;
  const body = m[1].replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const out = {};
  for (const mm of body.matchAll(/([A-Za-z_]\w*)\s*:\s*(-?\d+(?:\.\d+)?)\s*(?=,|$)/gm)) out[mm[1]] = Number(mm[2]);
  return out;
}
const TS = tuneConsts(SIM), TH = tuneConsts(HTML);
if (!TS || !TH) bad(`TUNE 리터럴 파싱 실패 (${!TS ? 'sim.js' : ''}${!TS && !TH ? ' / ' : ''}${!TH ? 'index.html' : ''}) — 게이트를 갱신할 것`);
else {
  /* index.html 은 장비·다이아 경제가 아직 없으므로 sim 쪽에만 있는 키가 있을 수 있다 — 공통 키만 값 대조하되,
     아래 필수 키는 index.html 에 반드시 존재해야 한다 (없으면 이식 누락). */
  /* ⚑ T35: 단일 성장률 eHpG·eDmgG 폐기 → 구간별 성장률 배열(아래에서 따로 대조) · 실드 기본치 pSh0 신설 */
  const MUST = ['eBaseHp','eBaseDmg','wallHp','wallDmg','wall2Hp','wall2Dmg','waveHp','waveDmg',
                'wall3Hp','wall3Dmg','wall4Hp','wall4Dmg','bossHp','bossDmg','maxChapter',
                'pAtk0','pHp0','pSh0','pAspd0','pCrit0',
                'goldKillBase','goldKillPer','goldClearPer','goldGrowth','expKill','expBoss'];
  const missing = MUST.filter(k => !(k in TH));
  const diff = MUST.filter(k => k in TH && TS[k] !== TH[k]).map(k => `${k} sim=${TS[k]} html=${TH[k]}`);
  missing.length ? bad(`index.html TUNE 누락 ${missing.length}개: ${missing.join(' ')}`) : ok(`필수 TUNE 상수 ${MUST.length}개 전부 존재`);
  diff.length ? bad(`TUNE 값 불일치 ${diff.length}건: ${diff.join(' / ')}`) : ok(`TUNE 값 ${MUST.length}개 전수 일치 (보스 ×${TS.bossHp}·×${TS.bossDmg}, 챕터 ${TS.maxChapter})`);
  if (TS.bossHp === 8 && TS.bossDmg === 1.8) ok('보스 = HP ×8 · DMG ×1.8 (주인 확정 상수, 07:3X)');
  else bad(`보스 배수가 주인 확정값이 아니다 — HP ×${TS.bossHp} · DMG ×${TS.bossDmg} (확정: ×8 · ×1.8)`);
  if (TS.maxChapter === 300) ok('챕터 상한 300 (PLAN §2.4)'); else bad(`챕터 상한이 ${TS.maxChapter} (확정: 300)`);
  if (TH.pAtk0 === 25 && TH.pHp0 === 150 && TH.pSh0 === 250) ok('노템 기본치 공 25 · 체 150 · 실드 250 (주인 확정, PLAN §11.5-a)');
  else bad(`노템 기본치가 주인 확정값이 아니다 — 공 ${TH.pAtk0}(25) · 체 ${TH.pHp0}(150) · 실 ${TH.pSh0}(250)`);
}
/* 구간별 성장률(PLAN §11.7) — 배열 문자열과 적용 함수를 함께 본다 */
{
  const seg = (src, k) => { const m = src.match(new RegExp(k + ':\\s*(\\[\\[[^\\n]*?\\]\\])\\s*,')); return m ? norm(m[1]) : null; };
  for (const k of ['eHpSeg', 'eDmgSeg']) {
    const a = seg(SIM, k), b = seg(HTML, k);
    if (!a || !b) bad(`${k} 파싱 실패 (${!a ? 'sim.js' : 'index.html'}) — 단일 상수 시대의 게이트가 남아 있으면 갱신할 것`);
    else if (a !== b) bad(`${k} 불일치 — sim ${a} vs index ${b}`);
    else ok(`${k} 구간별 성장률 일치 (${a.slice(0, 46)}…)`);
  }
  const FN = [['segRate', /function segRate\([\s\S]*?\n(?=function|const)/], ['segGrow', /function segGrow\(seg,cache,c\)\{[\s\S]*?\n\}/], ['enemyStats', /function enemyStats\(c,w\)\{[\s\S]*?\n\}/]];
  for (const [nm, re] of FN) {
    const a = SIM.match(re), b = HTML.match(re);
    if (!a || !b) { bad(`${nm}() — ${!a ? 'sim.js' : 'index.html'} 에서 찾지 못했다`); continue; }
    const strip = s => norm(s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''));
    strip(a[0]) === strip(b[0]) ? ok(`${nm}() 본문 1:1`) : bad(`${nm}() 본문이 두 파일에서 다르다`);
  }
}

/* ---------- ⑧ chapterLayout — 두 파일이 같은 배치를 내놓는가 + 주인 확정 제약 ---------- */
console.log('\n[⑧ 챕터 레이아웃 — 1:1 동일 + 주인 확정 제약 (PLAN §2.4, 14:2X)]');
function loadLayout(src, label) {
  const mul = src.split('\n').find(l => l.startsWith('function mulberry'));
  const lines = src.split('\n');
  const a = lines.findIndex(l => l.startsWith('const LAYOUT_MAXENEMY'));
  const b = lines.findIndex((l, i) => i > a && l === '}');
  if (!mul || a < 0 || b < 0) return null;
  const code = mul + '\nconst clamp=(v,x,y)=>Math.max(x,Math.min(y,v));\n' + lines.slice(a, b + 1).join('\n') + '\n;chapterLayout';
  try { return vm.runInNewContext(code, { Math }); } catch (e) { return null; }
}
const LS = loadLayout(SIM), LH = loadLayout(HTML);
if (!LS || !LH) bad(`chapterLayout 추출 실패 (${!LS ? 'sim.js' : ''}${!LS && !LH ? ' / ' : ''}${!LH ? 'index.html' : ''}) — 게이트를 갱신할 것`);
else {
  const key = L => L.map(n => n.t === 'wave' ? 'w' + n.size : n.t[0]).join('>');
  let mism = [], viol = [], maxE = 0, minE = 1e9;
  for (let c = 1; c <= 300; c++) {
    const A = LS(c), B = LH(c);
    if (key(A) !== key(B)) { if (mism.length < 3) mism.push(`ch${c}: sim=${key(A)} html=${key(B)}`); else mism.push(''); }
    const cnt = t => A.filter(n => n.t === t).length;
    const tot = A.filter(n => n.t === 'wave').reduce((s, n) => s + n.size, 0);
    minE = Math.min(minE, tot); maxE = Math.max(maxE, tot);
    const why = [];
    if (tot > 100) why.push(`적 ${tot}마리>100`);
    if (cnt('devil') !== 1) why.push(`악마 ${cnt('devil')}개≠1`);
    if (cnt('angel') !== 1) why.push(`천사 ${cnt('angel')}개≠1`);
    if (cnt('rest') < 1 || cnt('rest') > 4) why.push(`쉼터 ${cnt('rest')}개(1~4 밖)`);
    if (cnt('boss') !== 1 || A[A.length - 1].t !== 'boss') why.push('보스 배치 이상');
    if (why.length && viol.length < 3) viol.push(`ch${c}: ${why.join(', ')}`);
    else if (why.length) viol.push('');
  }
  const nm = mism.filter(Boolean);
  mism.length ? bad(`두 파일 레이아웃 불일치 ${mism.length}챕터: ${nm.join(' / ')}`) : ok('챕터 1~300 레이아웃 전수 동일 (sim.js ↔ index.html)');
  const nv = viol.filter(Boolean);
  viol.length ? bad(`주인 확정 제약 위반 ${viol.length}챕터: ${nv.join(' / ')}`) : ok(`제약 4종 전수 만족 — 적 총수 ${minE}~${maxE}(≤100) · 쉼터 1~4 · 악마 1 · 천사 1`);
  /* 가중치 배치 폐기 흔적: 45/30/25 잔재가 남아 있으면 안 된다 */
  const legacy = /r<0\.45\?'rest'/;
  (legacy.test(SIM) || legacy.test(HTML)) ? bad('폐기된 가중치(45/30/25) 배치 코드가 남아 있다') : ok('가중치(45/30/25) 배치 잔재 0');
}

/* ---------- ⑨ GT 장비 상수 대조 (PLAN §11.5-a) ---------- */
console.log('\n[⑨ GT 장비 상수 — sim.js ↔ index.html 값 대조]');
function gtConsts(src) {
  const i = src.indexOf('const GT={');
  if (i < 0) return null;
  /* 리터럴의 끝 = 들여쓰기 없는 `};` */
  const end = src.indexOf('\n};', i);
  if (end < 0) return null;
  const body = src.slice(i, end).replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const out = {};
  /* GT 리터럴의 숫자 값은 전부 최상위 키다 (types/typeName/rarName 은 객체·문자열) — 한 줄에 여러 개 올 수 있다 */
  for (const mm of body.matchAll(/([A-Za-z_]\w*)\s*:\s*(-?\d+(?:\.\d+)?)\s*(?=[,\n])/g)) out[mm[1]] = Number(mm[2]);
  return out;
}
{
  const GS = gtConsts(SIM), GH = gtConsts(HTML);
  if (!GS || !GH) bad(`GT 리터럴 파싱 실패 (${!GS ? 'sim.js' : ''}${!GS && !GH ? ' / ' : ''}${!GH ? 'index.html' : ''}) — 게이트를 갱신할 것`);
  else {
    /* 주인 확정 상수(§11.2·§11.5)는 값까지 못박는다. T35 로 등비 생성(atkUnit/hpUnit/rarStep/slotG)은 폐기됐다 */
    const MUST = ['plusStep','slotLvMax','slotStep','slotCostBase','slotCostG',
                  'evenStep','evenPer','pullCost','dailyGem','iapGem','legendToMythPlus'];
    const missing = MUST.filter(k => !(k in GH));
    const diff = MUST.filter(k => k in GH && GS[k] !== GH[k]).map(k => `${k} sim=${GS[k]} html=${GH[k]}`);
    missing.length ? bad(`index.html GT 누락 ${missing.length}개: ${missing.join(' ')}`) : ok(`GT 상수 ${MUST.length}개 전부 존재`);
    diff.length ? bad(`GT 값 불일치 ${diff.length}건: ${diff.join(' / ')}`) : ok(`GT 값 ${MUST.length}개 전수 일치 (plusStep ${GS.plusStep} · 슬롯 +${GS.slotStep * 100}%/렙·상한 ${GS.slotLvMax} · 슬롯비용 ${GS.slotCostBase}×${GS.slotCostG}^L)`);
    if (GH.slotLvMax === 150 && GH.slotStep === 0.01 && GH.plusStep === 0.13) ok('주인 확정 성장 상수 — 슬롯 1렙당 +1% · 상한 150 · 강화 1렙당 +13% (PLAN §11.4·§11.5-a)');
    else bad(`주인 확정 성장 상수 위반 — slotStep ${GH.slotStep}(0.01) · slotLvMax ${GH.slotLvMax}(150) · plusStep ${GH.plusStep}(0.13)`);
    if (GH.pullCost === 400 && GH.dailyGem === 2500 && GH.iapGem === 12000) ok('주인 확정 경제 상수 — 뽑기 400 · 일일 2500 · IAP 12000 (PLAN §11.2·§11.5)');
    else bad(`주인 확정 경제 상수 위반 — 뽑기 ${GH.pullCost}(400) · 일일 ${GH.dailyGem}(2500) · IAP ${GH.iapGem}(12000)`);
    if (GH.legendToMythPlus === 10) ok('전설 +10강 → 신화 0강 변환 임계 10 (PLAN §11.3)');
    else bad(`전설→신화 변환 임계가 ${GH.legendToMythPlus} (확정: 10)`);
  }
  /* ⚑ T35 주인 확정: 등급별 «절대 기여표» 3종(공/체/실)을 배열 값으로 직접 대조한다.
     종전 «등비 생성식 문자열 대조» 는 rarStep 폐기로 대상 소멸 — PLAN §11.5-a 표와도 맞춘다. */
  {
    const PLAN = fs.readFileSync(path.join(ROOT, 'PLAN.md'), 'utf8');
    const arr = (src, k) => {
      const m = src.match(new RegExp('\\n\\s*' + k + '\\s*:\\s*\\[([^\\]]*)\\]'));
      return m ? m[1].split(',').map(x => Number(x.trim())) : null;
    };
    for (const [k, nm] of [['atk', '공격력'], ['hp', '체력'], ['sh', '실드']]) {
      const a = arr(SIM, k), b = arr(HTML, k);
      if (!a || !b) { bad(`GT.${k} 등급별 기여 배열 파싱 실패 (${!a ? 'sim.js' : 'index.html'})`); continue; }
      if (a.length !== 5 || b.length !== 5) { bad(`GT.${k} 배열 길이가 5가 아니다 (sim ${a.length} / index ${b.length})`); continue; }
      const d = a.map((v, i) => v === b[i] ? null : `${i}: sim=${v} html=${b[i]}`).filter(Boolean);
      if (d.length) { bad(`GT.${k}(${nm}) 등급별 기여 불일치: ${d.join(' / ')}`); continue; }
      const planMiss = a.filter(v => !PLAN.includes(String(v.toFixed(3))) && !PLAN.includes(String(v)));
      planMiss.length ? bad(`GT.${k}(${nm}) 값 ${planMiss.join(',')} 이 PLAN §11.5-a 표에 없다`)
        : ok(`GT.${k} 등급별 기여 5칸 일치 + PLAN §11.5-a 표와 대조 (${nm} 일반 ${a[0]} → 신화 ${a[4]})`);
    }
  }
  const DERIV = [
    ['GT.slotMul (가산 +1%/렙 · 상한 강제)', /GT\.slotMul=L=>1\+GT\.slotStep\*Math\.min\(L,GT\.slotLvMax\)/],
    ['GT.slotCost', /GT\.slotCost=L=>Math\.floor\(GT\.slotCostBase\*Math\.pow\(GT\.slotCostG,L\)\)/],
  ];
  for (const [nm, re] of DERIV) {
    const a = re.test(SIM), b = re.test(HTML);
    if (a && b) ok(nm);
    else if (!a && !b) bad(`${nm} — 양쪽 다 파싱 실패 (게이트를 갱신할 것)`);
    else bad(`${nm} — ${a ? 'index.html' : 'sim.js'} 쪽에서 찾지 못했다`);
  }
  /* 옵션 개수 규칙: 일반0·희귀1·영웅2·전설3·신화4 + 신화 +3/+6/+9 에서 1개씩 (최대 7) */
  const optRe = /GT\.optCount=\(rar,plus\)=>\{[\s\S]*?\n\};/;
  const sa = SIM.match(optRe), ha = HTML.match(optRe);
  if (sa && ha && norm(sa[0]) === norm(ha[0])) ok('GT.optCount 본문 1:1 (신화 +3/+6/+9 옵션 추가)');
  else bad('GT.optCount 본문이 두 파일에서 다르다');
}

/* ---------- ⑩ GOPT 18계열 × 7옵션 = 126칸 전수 대조 ---------- */
console.log('\n[⑩ GOPT 18계열 옵션표 — 설명문 126칸 + ap 본문 전수 대조 (PLAN §11.6)]');
function goptTable(src) {
  const i = src.indexOf('const GOPT={');
  if (i < 0) return null;
  const end = src.indexOf('\n};', i);
  if (end < 0) return null;
  const body = src.slice(i + 'const GOPT={'.length, end);
  const out = {};
  /* `type:[ ... ],` 블록을 괄호 깊이로 쪼갠다 */
  const re = /^\s{2}([a-z]+):\[/gm;
  let m;
  while ((m = re.exec(body))) {
    const start = m.index + m[0].length;
    let d = 1, j = start, q = null;
    while (j < body.length && d > 0) {
      const ch = body[j];
      if (q) { if (ch === q && body[j - 1] !== '\\') q = null; }
      else if (ch === "'" || ch === '"') q = ch;
      else if (ch === '[') d++;
      else if (ch === ']') d--;
      j++;
    }
    const inner = body.slice(start, j - 1);
    const opts = [];
    for (const part of splitTop(inner)) {
      const t = part.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').trim();   /* 계열 주석 제거 */
      if (!t.startsWith('{')) continue;
      const dm = t.match(/^\{\s*d:\s*'((?:[^'\\]|\\.)*)'\s*,\s*ap:\s*([\s\S]*)\}$/);
      if (!dm) { opts.push({ d: null, ap: t }); continue; }
      opts.push({ d: dm[1], ap: dm[2].trim() });
    }
    out[m[1]] = opts;
  }
  return out;
}
{
  const OS = goptTable(SIM), OH = goptTable(HTML);
  if (!OS || !OH) bad(`GOPT 파싱 실패 (${!OS ? 'sim.js' : ''}${!OS && !OH ? ' / ' : ''}${!OH ? 'index.html' : ''}) — 게이트를 갱신할 것`);
  else {
    const ts = Object.keys(OS), th = Object.keys(OH);
    ts.length === 18 ? ok('sim.js GOPT 18계열') : bad(`sim.js GOPT 가 ${ts.length}계열 (18 이어야 함)`);
    const missT = ts.filter(t => !th.includes(t));
    const extraT = th.filter(t => !ts.includes(t));
    missT.length ? bad(`index.html 에 없는 계열 ${missT.length}개: ${missT.join(' ')}`) : ok('18계열 전부 index.html 에 존재');
    extraT.length ? bad(`sim.js 에 없는 계열 ${extraT.length}개: ${extraT.join(' ')}`) : ok('잉여 계열 0');
    let cells = 0, dDiff = [], apDiff = [], nCnt = [];
    for (const t of ts) {
      const a = OS[t], b = OH[t] || [];
      if (a.length !== 7) nCnt.push(`${t}=${a.length}`);
      if (b.length !== a.length) { dDiff.push(`${t}: 옵션 수 sim ${a.length} vs index ${b.length}`); continue; }
      for (let i = 0; i < a.length; i++) {
        cells++;
        if (a[i].d !== b[i].d) dDiff.push(`${t}[${i + 1}] 설명 sim«${a[i].d}» vs index«${b[i].d}»`);
        if (norm(a[i].ap) !== norm(b[i].ap)) apDiff.push(`${t}[${i + 1}] ap sim«${a[i].ap}» vs index«${b[i].ap}»`);
      }
    }
    nCnt.length ? bad(`7옵션이 아닌 계열: ${nCnt.join(' ')}`) : ok('18계열 전부 7옵션 (신화 +9강이 옵션의 끝 — PLAN §11.1)');
    dDiff.length ? bad(`설명문 불일치 ${dDiff.length}칸:\n    ` + dDiff.slice(0, 8).join('\n    ')) : ok(`설명문 ${cells}칸 전수 일치`);
    apDiff.length ? bad(`ap 본문 불일치 ${apDiff.length}칸:\n    ` + apDiff.slice(0, 8).join('\n    ')) : ok(`ap 본문 ${cells}칸 전수 일치`);

    /* PLAN §11.6 표의 설명문과도 대조 — T8·T9·T11·T12 계열(표↔엔진 불일치) 재발 방지 */
    const PLAN = fs.readFileSync(path.join(ROOT, 'PLAN.md'), 'utf8');
    let planMiss = [];
    for (const t of ts) for (const o of OS[t]) if (o.d && !PLAN.includes(o.d)) planMiss.push(`${t}: ${o.d}`);
    planMiss.length ? bad(`PLAN §11.6 표에 없는 설명문 ${planMiss.length}칸:\n    ` + planMiss.slice(0, 8).join('\n    '))
      : ok('126칸 설명문 전부 PLAN §11.6 표에 존재');
  }
}

/* ---------- ⑪ 장비 엔진 함수 본문 + 영구강화 폐지 ---------- */
console.log('\n[⑪ 장비 엔진 함수 1:1 + 영구강화 4종 폐지 (PLAN §11.4)]');
{
  const FNS = [
    ['gachaPull (확률·50천장·10피티)', /function gachaPull\(st\)\{[\s\S]*?\n\}/],
    ['fuseAll (3→1 · 전설 +강 · +10강 신화 변환)', /function fuseAll\(inv,equipped\)\{[\s\S]*?\n\}/],
    ['autoEquip', /function autoEquip\(inv\)\{[\s\S]*?\n\}/],
    ['buildPower (기본치 + 6부위 × 슬롯 × 강화 × 균등보너스)', /function buildPower\(b\)\{[\s\S]*?\n\}/],
    ['evenBonus (균등 보너스)', /const evenBonus=b=>[^\n]*/],
    ['gearScore (신화0 > 전설9 일관)', /const gearScore=g=>[^;]*/],
  ];
  for (const [nm, re] of FNS) {
    const a = SIM.match(re), b = HTML.match(re);
    if (!a || !b) { bad(`${nm} — ${!a ? 'sim.js' : 'index.html'} 에서 찾지 못했다`); continue; }
    /* 주석은 제거하고 코드만 비교 */
    const strip = s => norm(s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''));
    strip(a[0]) === strip(b[0]) ? ok(nm) : bad(`${nm} — 본문이 두 파일에서 다르다\n      sim  : ${strip(a[0]).slice(0, 160)}\n      index: ${strip(b[0]).slice(0, 160)}`);
  }
  /* 뽑기 확률 리터럴은 주인 확정값이라 따로 못박는다 (PLAN §11.2) */
  const RAR = /r<0\.1\?4\s*:\s*r<2\.1\?3\s*:\s*r<12\.1\?2\s*:\s*r<42\.1\?1\s*:\s*0/;
  (RAR.test(SIM) && RAR.test(HTML)) ? ok('뽑기 확률 신화 0.1 / 전설 2 / 영웅 10 / 희귀 30 / 일반 57.9%')
    : bad('뽑기 확률 리터럴이 주인 확정값과 다르다 (PLAN §11.2)');
  /* 영구강화 폐지 — UP_DEFS·save.up 잔재가 남아 있으면 안 된다 */
  !/UP_DEFS/.test(HTML) ? ok('영구강화 UP_DEFS 잔재 0 (PLAN §11.4 폐지)') : bad('index.html 에 UP_DEFS 가 남아 있다');
  !/save\.up\b/.test(HTML) ? ok('save.up{} 잔재 0 (저장 포맷 v2 교체)') : bad('index.html 에 save.up 이 남아 있다');
  /* 장비가 실제로 전투 스탯에 연결됐는가 */
  /function playerBase\(\)\{[\s\S]{0,220}buildPower\(/.test(HTML) ? ok('playerBase() 가 buildPower(장비) 로 전투 스탯을 만든다')
    : bad('playerBase() 가 장비와 연결돼 있지 않다');
  /* ⚑ T35 주인 확정: 실드는 독립 스탯이다 — `maxHp*0.8` 파생이 되살아나면 잡는다 */
  const SH_DERIV = /max(Sh|Hp)\s*[:=][^\n]*max(Hp|Sh)\s*\*\s*0\.8/;
  const noCmt = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');   /* 주석의 «폐기» 설명이 오탐되지 않게 */
  const shOK = /maxSh:\s*pw\.sh\s*,\s*sh:\s*pw\.sh/.test(HTML) && !SH_DERIV.test(noCmt(HTML)) && !SH_DERIV.test(noCmt(SIM));
  shOK ? ok('실드 = 독립 스탯 (maxSh = pw.sh · `maxHp*0.8` 파생 잔재 0 — PLAN §11.5-a)')
    : bad('실드가 독립 스탯이 아니다 — `maxHp*0.8` 파생이 남아 있거나 maxSh 가 pw.sh 가 아니다');
  /for\(const pt of GT\.parts\)\{[\s\S]{0,200}GT\.optCount\(g\.rar,g\.plus\)[\s\S]{0,120}tbl\[i\]\.ap\(p\)/.test(HTML)
    ? ok('계열 옵션이 전투 시작 시 적용된다 (상위 등급 = 하위 옵션 포함)')
    : bad('계열 옵션 적용 루프가 index.html 에 없다');
}

/* ---------- ⑫ 모바일 viewport (주인 긴급 지시 14:4X · T40) ---------- */
/* 왜 게이트인가 — 원인이 «한 줄이 없는 것» 이라 T2 전면 재작성에서 조용히 사라지기 쉽다.
   주인이 핸드폰 크롬에서 UI 축소로 직접 관측한 회귀라 재발 비용이 크다. PLAN §2.1. */
console.log('\n[⑫ 모바일 viewport — PLAN §2.1, 주인 긴급 지시]');
{
  const mv = HTML.match(/<meta\s+name=["']viewport["']\s+content=["']([^"']+)["']\s*\/?>/i);
  if (!mv) bad('viewport 메타가 없다 — 모바일이 데스크톱 폭으로 렌더 후 축소한다 (PLAN §2.1)');
  else {
    const c = mv[1].replace(/\s+/g, '');
    const need = [['width=device-width', 'width=device-width'], ['initial-scale=1', 'initial-scale=1'], ['viewport-fit=cover', 'viewport-fit=cover']];
    const miss = need.filter(([, t]) => !c.includes(t)).map(([n]) => n);
    miss.length ? bad(`viewport 메타에 필수 항목 누락: ${miss.join(' · ')} (현재 "${mv[1]}")`)
                : ok(`viewport 메타 확정값 존재 — "${mv[1]}"`);
  }
  /* 프레임이 모바일에서 실제로 꽉 차는가 = 주소창을 뺀 높이(dvh) 기준이어야 한다.
     100vh 만 쓰면 크롬 모바일에서 하단 5탭이 화면 밖으로 잘린다. */
  const fr = HTML.match(/#frame\{[\s\S]*?\}/);
  if (!fr) bad('#frame 규칙을 찾지 못했다 — 게이트를 갱신할 것');
  else if (!/100dvh/.test(fr[0])) bad('#frame 이 100vh 만 쓴다 — 모바일 크롬에서 주소창 높이만큼 하단이 잘린다 (100dvh 병기 필요)');
  else ok('#frame 높이가 100dvh 병기 — 모바일에서 주소창 제외 실높이를 채운다');
}

/* ---------- 결과 ---------- */
console.log(`\n통과 ${pass} · 불합격 ${fail}`);
console.log(fail === 0 ? '→ 통과' : '→ 불합격');
process.exit(fail === 0 ? 0 : 1);
