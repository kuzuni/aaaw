'use strict';
/* T2 이식 게이트 — index.html ↔ sim.js 1:1 대조
 *
 * ROUTINE §2 T2 완료 게이트: 「node --check 급 문법 검사 + 특전 전수 존재 확인」(개수는 PERK_TOTAL).
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

/* ---------- ② 특전 전수 대조 (T48 로 102 → 117종) ---------- */
/* ⚑ 개수는 더 이상 고정이 아니다 — 주인 확정(16:0X): «등급당 30~40 까지 허용, 단 등급 간 개수는 골고루».
   그래서 «102 인가» 가 아니라 «두 파일이 같은가 + 등급별 편차 ≤ PERK_RAR_GAP» 을 본다.
   T48 최종 목표는 각 등급 33종(총 132)이고 지금은 1단계(스턴·빗맞음 축)까지 반영된 상태다. */
const PERK_TOTAL = 132, PERK_RAR_GAP = 6;
console.log(`\n[② 특전 ${PERK_TOTAL}종 — id·등급·고유·ap 본문 전수 대조]`);
const S = simPerks(), H = htmlPerks();
if (!H) { bad('index.html 에서 const PERKS=[...] 를 찾지 못했다'); }
else {
  if (S.length === PERK_TOTAL) ok(`sim.js mkPerks() = ${S.length}종`);
  else bad(`sim.js mkPerks() 가 ${S.length}종 (${PERK_TOTAL} 이어야 함 — 특전을 늘렸으면 이 게이트의 PERK_TOTAL 도 같이 올릴 것)`);
  if (H.length === S.length) ok(`index.html PERKS = ${H.length}종`);
  else bad(`index.html PERKS = ${H.length}종 (sim ${S.length}종과 다름)`);

  const cnt = r => [S.filter(x => x.r === r).length, H.filter(x => x.r === r).length];
  const RN = ['일반', '희귀', '전설', '신화'];
  for (let r = 0; r < 4; r++) {
    const [a, b] = cnt(r);
    if (a === b) ok(`${RN[r]} ${a}종 일치`);
    else bad(`${RN[r]} 개수 불일치 — sim ${a} vs index ${b}`);
  }

  /* ⚑ 주인 확정 16:0X — 등급 간 개수가 골고루여야 한다(일반만 잔뜩 금지). 위임 기준: 최다−최소 ≤ 6종 */
  {
    const ns = [0, 1, 2, 3].map(r => S.filter(x => x.r === r).length);
    const gap = Math.max(...ns) - Math.min(...ns);
    if (gap <= PERK_RAR_GAP) ok(`등급별 개수 편차 ${gap}종 (${ns.join('/')}) ≤ ${PERK_RAR_GAP}`);
    else bad(`등급별 개수 편차 ${gap}종 (${ns.join('/')}) — 최다·최소 차가 ${PERK_RAR_GAP}종을 넘었다 (주인 확정 16:0X «등급 간 골고루»)`);
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
  apdiff.length ? bad(`ap 본문 불일치 ${apdiff.length}건:\n    ` + apdiff.join('\n    ')) : ok(`ap 본문 ${S.length}종 전수 일치`);

  /* 표시 텍스트가 PLAN §3 표에서 온 것인지 (빈 tx·아이콘 누락 검출) */
  const noTx = H.filter(x => !x.tx || !x.ic).map(x => x.id);
  noTx.length ? bad(`표시 텍스트·아이콘 누락 ${noTx.length}종: ${noTx.join(' ')}`) : ok(`표시 텍스트·아이콘 ${H.length}종 전부 존재`);
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
  ['경험치 요구식', /expNeed:lv=>4\+4\*lv/, /expNeed=lv=>4\+4\*lv/],
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

/* ---------- ⑥ 특전 전수 실행 (예외 0) ---------- */
console.log(`\n[⑥ 특전 ${PERK_TOTAL}종 ap 실행 — 런타임 예외 검출]`);
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
  thrown.length ? bad(`ap 실행 예외 ${thrown.length}건:\n    ` + thrown.join('\n    ')) : ok(`${PERK_TOTAL}종 전부 예외 없이 적용됨`);
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
    ['fuseMake (합성 산출물 규칙 — 자동·수동 공용)', /function fuseMake\(base\)\{[\s\S]*?\n\}/],
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

/* ---------- ⑬ 인게임 UI 2건 + 챕터 이동 UI (주인 지시 07:0X · T36) ---------- */
console.log('\n[⑬ 인게임 UI — 발동 중 버프 아이콘 · 얻은 특전 미리보기 줄 · 챕터 300 이동 (PLAN §2.3, T36)]');
{
  /* (1) 버프 아이콘 — 마크업 위치: 챕터 표시(#chapHud)보다 아래에 놓여야 한다 */
  if (!/<div id="buffBar"><\/div>/.test(HTML)) bad('#buffBar 가 없다 — 발동 중 버프 아이콘 표시 자리가 사라졌다 (주인 지시 07:0X)');
  else ok('#buffBar 마크업 존재');
  {
    const chapTop = (HTML.match(/#chapHud\{[^}]*top:(\d+)px/) || [])[1];
    const buffTop = (HTML.match(/#buffBar\{[^}]*top:(\d+)px/) || [])[1];
    /* 챕터 블록(제목 24px + 진행도 바)의 실측 높이가 42px 이라 top 차이가 그 이상이어야 겹치지 않는다.
       (헤드리스 실측: #chapHud top 64 → bottom 106) */
    if (!chapTop || !buffTop) bad('#chapHud / #buffBar 의 top 을 읽지 못했다 — 게이트를 갱신할 것');
    else if (+buffTop - +chapTop < 42) bad(`버프 아이콘이 챕터 표시와 겹친다 — #chapHud top ${chapTop}px(높이 42px) · #buffBar top ${buffTop}px (주인 지시: 챕터 표시보다 아래)`);
    else ok(`버프 아이콘 위치 = 챕터 표시(top ${chapTop}px·높이 42px)보다 아래·왼쪽 (top ${buffTop}px)`);
  }
  if (/#buffBar\{[^}]*left:\d+px/.test(HTML)) ok('버프 아이콘이 화면 왼쪽 정렬');
  else bad('#buffBar 가 왼쪽 정렬이 아니다 (주인 지시: 화면 왼쪽 위)');
  /* 블록 안으로 범위를 좁힌다 — 열어 두면 뒤쪽 .pv-ic 의 --bc 테두리가 잡혀 오탐 통과한다 */
  {
    const blk = HTML.match(/\.buff-ic\{[^}]*\}/);
    if (blk && /border:[^;]*var\(--bc/.test(blk[0])) ok('버프 아이콘 등급색 테두리 (--bc)');
    else bad('.buff-ic 에 등급색 테두리가 없다 (주인 지시: 등급색 테두리 포함)');
  }
  if (/\.buff-ic \.cnt\{[\s\S]*?right:-?\d+px;\s*top:-?\d+px/.test(HTML)) ok('중첩 수 뱃지가 아이콘 오른쪽 위');
  else bad('.buff-ic .cnt 가 아이콘 오른쪽 위가 아니다 (주인 지시: 아이콘 오른쪽 위에 중첩 수)');

  /* (2) 버프 → 특전 추적: addBuff 가 src 를 받고, 모든 호출부가 자기 px 키를 넘긴다 */
  const ab = HTML.match(/function addBuff\(([^)]*)\)\{[\s\S]*?\n\}/);
  if (!ab) bad('addBuff() 를 찾지 못했다 — 게이트를 갱신할 것');
  else {
    /* sim.js 는 표시가 없어 5인자다. index 는 6번째 표시 전용 인자(src)만 더 받는다 — 앞 5인자는 같아야 한다. */
    const simAb = SIM.match(/function addBuff\(([^)]*)\)/);
    const hi = ab[1].split(',').map(s => s.trim()), si = simAb ? simAb[1].split(',').map(s => s.trim()) : [];
    if (si.length && hi.slice(0, si.length).join(',') === si.join(',') && hi.length === si.length + 1 && hi[si.length] === 'src')
      ok(`addBuff 인자 = sim.js ${si.length}인자 + 표시 전용 src (수치·판정 무관)`);
    else bad(`addBuff 인자가 «sim 5인자 + src» 가 아니다 — sim(${si.join(',')}) vs index(${hi.join(',')})`);
    if (/\{t:dur,amt,src,q:\+\+buffSeq\}/.test(ab[0])) ok('버프 객체가 src(특전 키)와 q(발동 순번)를 기록');
    else bad('addBuff 가 src/q 를 기록하지 않는다 — 아이콘이 «어느 특전인지»·«오래된 것이 위» 를 잃는다');
  }
  {
    const lines = HTML.split('\n').filter(l => l.includes('addBuff(p,') && !l.includes('function addBuff'));
    const wrong = [];
    for (const l of lines) {
      const g = l.match(/if\(px\.([A-Za-z0-9_]+)/);
      const a = l.match(/addBuff\(p,[^)]*,'([A-Za-z0-9_]+)'\)/);
      if (!g || !a || g[1] !== a[1]) wrong.push(l.trim().slice(0, 90));
    }
    if (!lines.length) bad('addBuff 호출부를 하나도 찾지 못했다 — 게이트를 갱신할 것');
    else if (wrong.length) bad(`addBuff 호출부 ${wrong.length}건이 자기 px 키를 src 로 넘기지 않는다:\n    ` + wrong.slice(0, 5).join('\n    '));
    else ok(`addBuff 호출부 ${lines.length}건 전부 자기 px 키를 src 로 넘긴다`);
  }
  /* sim.js 는 손대지 않았다 — 표시용 인자가 시뮬로 새면 밸런스가 갈라진다 */
  if (/addBuff\([^)]*,'[A-Za-z0-9_]+'\)/.test(SIM)) bad('sim.js 에 표시 전용 src 인자가 새어 들어갔다 — 시뮬은 5인자여야 한다');
  else ok('sim.js addBuff 는 5인자 그대로 (표시 인자가 시뮬로 새지 않았다)');

  /* (3) 렌더러가 존재하고, 등급색·중첩수·소멸 처리를 한다 */
  const rb = HTML.match(/function renderBuffBar\(\)\{[\s\S]*?\n\}/);
  if (!rb) bad('renderBuffBar() 가 없다');
  else {
    /rarity/i.test(rb[0]) && /RARITY\[/.test(rb[0]) ? ok('버프 아이콘이 특전 등급색(RARITY)을 쓴다') : bad('renderBuffBar 가 RARITY 등급색을 쓰지 않는다');
    /g\.n>1/.test(rb[0]) ? ok('중첩 2 이상일 때만 중첩 수 뱃지') : bad('renderBuffBar 에 중첩 수 뱃지가 없다');
    /sort\(\(a,b\)=>a\.q-b\.q\)/.test(rb[0]) ? ok('버프 아이콘이 오래된 순(q)으로 세로 정렬') : bad('renderBuffBar 가 발동 순서로 정렬하지 않는다 (주인 지시: 오래된 것이 위)');
  }
  if (/if\(bc\)\{\s*renderStatsGrid\(\);\s*renderBuffBar\(\);/.test(HTML)) ok('버프 만료 시 아이콘 제거 (버프 타이머에서 재렌더)');
  else bad('버프가 끝나도 아이콘이 갱신되지 않는다 (주인 지시: 버프가 끝나면 아이콘 제거)');

  /* (4) 얻은 특전 미리보기 줄 — Info 버튼 «행» 의 왼쪽 끝 */
  /* 닫는 </div> 는 자기 줄에 있다 — 줄 안에서 닫히는 자식(#perkStrip)에서 끊기면 안 된다 */
  const foot = HTML.match(/<div id="hudFoot">[\s\S]*?\n\s*<\/div>/);
  if (!foot) bad('#hudFoot 을 찾지 못했다');
  else if (!/id="perkStrip"/.test(foot[0])) bad('#perkStrip 이 Info 버튼 행 안에 없다 (주인 지시: 📘 Info 버튼이 있는 행의 왼쪽 끝부터)');
  else if (foot[0].indexOf('perkStrip') > foot[0].indexOf('infoBtn')) bad('#perkStrip 이 Info 버튼보다 오른쪽에 있다 (주인 지시: 행의 왼쪽 끝)');
  else ok('#perkStrip 이 Info 버튼 행의 왼쪽 끝');
  const rp = HTML.match(/function renderPerkStrip\(\)\{[\s\S]*?\n\}/);
  if (!rp) bad('renderPerkStrip() 이 없다');
  else {
    /for\(const pk of G\.perksTaken\)/.test(rp[0]) ? ok('미리보기 줄이 획득 순서(G.perksTaken)를 따른다') : bad('renderPerkStrip 이 획득 순서를 따르지 않는다');
    /RARITY\[o\.pk\.r\]\.cc/.test(rp[0]) ? ok('미리보기 아이콘에 등급색') : bad('미리보기 줄에 등급색이 없다 (주인 지시: 등급색 포함)');
    /c>1\?/.test(rp[0]) ? ok('중복 획득은 아이콘 1개 + 개수 뱃지') : bad('중복 획득 개수 뱃지가 없다');
    /pv-more">\+\$\{more\}/.test(rp[0]) ? ok('한 줄을 넘치면 최신 것만 남기고 «+N» 으로 합침') : bad('넘침 처리(«+N»)가 없다');
    /slice\(order\.length-\(cap-1\)\)/.test(rp[0]) ? ok('넘칠 때 «최신 것들» 이 보인다') : bad('넘칠 때 최신이 아니라 앞쪽이 남는다 (주인 지시: 최신 것들이 보이게)');
  }
  /* 특전을 얻는 두 경로(레벨업·천사의 축복) 모두에서 줄이 갱신돼야 한다 */
  const tp = HTML.match(/function takePerk\(perk\)\{[\s\S]*?\n\}/);
  (tp && /renderPerkStrip\(\)/.test(tp[0])) ? ok('takePerk 가 미리보기 줄을 갱신') : bad('takePerk 후 미리보기 줄이 갱신되지 않는다');
  /천사의 축복[\s\S]{0,120}renderPerkStrip\(\)/.test(HTML) ? ok('천사의 축복도 미리보기 줄에 반영') : bad('천사의 축복 획득 시 미리보기 줄이 갱신되지 않는다');

  /* (5) T36 — 챕터 300 이동 UI */
  /function openChapterJump\(\)/.test(HTML) ? ok('T36 — 챕터 이동 팝업(숫자 입력·±10·최신 해금) 존재') : bad('T36 미해소 — 챕터 300 인데 점프 수단이 없다');
  /\$\('lobbyChapName'\)\.onclick=openChapterJump/.test(HTML) ? ok('T36 — 챕터 제목을 눌러 이동 팝업') : bad('챕터 제목이 이동 팝업을 열지 않는다');
  /holdRepeat\(\$\('chPrev'\),-1\); holdRepeat\(\$\('chNext'\),1\)/.test(HTML) ? ok('T36 — ◀▶ 길게 누르면 연속 이동') : bad('◀▶ 연속 이동(길게 누르기)이 없다');
  {
    const hr = HTML.match(/function holdRepeat\(btn,d\)\{[\s\S]*?\n\}/);
    (hr && /Math\.max\(45,iv\*0\.72\)/.test(hr[0])) ? ok('연속 이동이 가속한다 (300ms → 45ms)') : bad('holdRepeat 가 가속하지 않는다 — 300챕터를 넘기기 어렵다');
  }
  {
    const cs = HTML.match(/function chapStep\(d\)\{[\s\S]*?\n\}/);
    (cs && /clamp\(save\.selChapter\+d,1,save\.maxChapter\)/.test(cs[0])) ? ok('챕터 이동이 해금 범위(1~maxChapter)를 넘지 않는다') : bad('챕터 이동이 해금 범위를 넘을 수 있다');
  }
}

/* ---------- ⑭ 합성(대장간) 화면 — 수동 3칸 선택 (참고: docs/ref/장비 합성 업글창.jpg · T2 5단계) ---------- */
/* 왜 게이트인가 — 수동 합성은 «산출물 규칙» 을 화면이 한 번 더 계산한다. 그 규칙을 두 곳에 적으면
   T8·T9·T11·T12 계열(«같은 규칙을 손으로 두 번 옮기다 어긋남») 이 그대로 재발한다.
   여기서는 문자열 대조가 아니라 **두 파일의 fuseMake 를 실제로 실행해** 전 등급·강화 조합을 비교한다. */
console.log('\n[⑭ 합성 화면 — 수동 3칸 선택 (PLAN §11.3, 스크린샷 구도)]');
{
  /* (1) 화면·구성 요소 존재 */
  const NEED = [
    ['#forge 화면', /<div id="forge" class="screen">/],
    ['결과 미리보기 슬롯 #fgResult', /id="fgResult"/],
    ['재료 3칸 컨테이너 #fgMats', /id="fgMats"/],
    ['자동 합성 버튼 #fgAuto', /id="fgAuto"/],
    ['수동 합성 버튼 #fgFuse', /id="fgFuse"/],
    ['인벤 그리드 #fgGrid', /id="fgGrid"/],
    ['뒤로 버튼 #fgBack', /id="fgBack"/],
  ];
  for (const [nm, re] of NEED) re.test(HTML) ? ok(nm) : bad(`${nm} 이(가) 없다 — 합성 화면 구도가 깨졌다`);
  /* (2) showScreen 이 forge 를 알고 렌더한다 */
  const ss = HTML.match(/function showScreen\(n\)\{[\s\S]*?\n\}/);
  (ss && /'forge'/.test(ss[0]) && /renderForge\(\)/.test(ss[0]))
    ? ok('showScreen 이 forge 화면을 켜고 renderForge 를 부른다')
    : bad('showScreen 이 forge 를 다루지 않는다 — 합성 화면이 열리지 않는다');
  /* (3) 재료는 정확히 3칸이고, 3개가 찼을 때만 합성 버튼이 열린다 */
  const rf = HTML.match(/function renderForge\(\)\{[\s\S]*?\n\}/);
  if (!rf) bad('renderForge 가 없다');
  else {
    /\[0,1,2\]\.map/.test(rf[0]) ? ok('재료 칸이 정확히 3칸 (PLAN §11.3 «3개 → 1개»)') : bad('재료 칸이 3칸이 아니다');
    /\$\('fgFuse'\)\.disabled\s*=\s*mats\.length!==3/.test(rf[0])
      ? ok('재료 3개가 다 차야만 «합성» 이 활성화된다') : bad('재료가 3개가 아닌데도 합성이 가능하다');
    /mats\.length===3/.test(rf[0]) ? ok('결과 미리보기는 3개가 찼을 때만 실제 산출물을 보여준다') : bad('결과 미리보기 조건이 없다');
    /fgKey\(g\)!==lock/.test(rf[0]) ? ok('첫 재료와 다른 부위·종류·등급은 재료로 못 고른다')
      : bad('아무 장비나 재료로 섞을 수 있다 — PLAN §11.3 «같은 부위+종류+등급» 위반');
  }
  /* (4) 수동 합성이 fuseMake 를 쓴다 (규칙 중복 구현 금지) */
  const ff = HTML.match(/\$\('fgFuse'\)\.onclick=\(\)=>\{[\s\S]*?\n\};/);
  if (!ff) bad('#fgFuse 핸들러가 없다');
  else {
    /fuseMake\(base\)/.test(ff[0]) ? ok('수동 합성이 fuseMake() 하나만 쓴다 (자동과 규칙 공유)')
      : bad('수동 합성이 산출물 규칙을 따로 계산한다 — 자동(fuseAll)과 갈라진다');
    /sort\(\(a,b\)=>b\.plus-a\.plus\)\[0\]/.test(ff[0]) ? ok('재료 중 최고 강화품이 base (fuseAll 과 같은 기준)')
      : bad('base 선택 기준이 fuseAll 과 다르다');
    /save\.fuses\+\+/.test(ff[0]) ? ok('수동 합성도 합성 횟수(save.fuses)를 센다') : bad('수동 합성이 합성 횟수에 안 잡힌다');
    /autoEquipBest\(\)/.test(ff[0]) ? ok('합성 후 상위품 자동 장착 (재료가 장착분이어도 알몸이 되지 않는다)')
      : bad('합성 후 자동 장착이 없다 — 장착분을 재료로 쓰면 그 부위가 빈다');
  }
  /* (5) ⚑ 행동 대조 — 두 파일의 fuseMake 를 실제로 실행해 전 조합 비교 */
  const grab = (src, re) => { const m = src.match(re); return m ? m[0] : null; };
  const fmS = grab(SIM, /function fuseMake\(base\)\{[\s\S]*?\n\}/);
  const fmH = grab(HTML, /function fuseMake\(base\)\{[\s\S]*?\n\}/);
  if (!fmS || !fmH) bad('fuseMake 를 두 파일에서 찾지 못했다 — 게이트를 갱신할 것');
  else {
    const L2M = (SIM.match(/legendToMythPlus\s*:\s*(\d+)/) || [])[1];
    if (!L2M) bad('GT.legendToMythPlus 를 sim.js 에서 읽지 못했다');
    else {
      const mk = body => { const c = { GT: { legendToMythPlus: +L2M } }; vm.createContext(c); vm.runInContext(body + '\nfuseMake', c); return c.fuseMake; };
      const a = mk(fmS), b = mk(fmH);
      let diff = 0, n = 0;
      for (let rar = 0; rar <= 4; rar++) for (let plus = 0; plus <= 14; plus++) {
        const base = { part: 'weapon', type: 'greatsword', rar, plus };
        n++;
        if (JSON.stringify(a(base)) !== JSON.stringify(b(base))) diff++;
      }
      diff === 0 ? ok(`fuseMake 실행 대조 ${n}조합(등급 5 × 강화 0~14) 전부 동일`)
        : bad(`fuseMake 산출물이 두 파일에서 ${diff}/${n} 조합 다르다`);
      /* 주인 확정 규칙 3개를 산출물로 직접 못박는다 */
      const r1 = JSON.stringify(a({ part: 'weapon', type: 'greatsword', rar: 1, plus: 0 }));
      r1.includes('"rar":2') ? ok('일반~영웅 3개 → 다음 등급 (PLAN §11.3)') : bad(`등급업 규칙 위반 — ${r1}`);
      const r2 = a({ part: 'weapon', type: 'greatsword', rar: 3, plus: 0 });
      (r2.rar === 3 && r2.plus === 1) ? ok('전설 3개 → 등급업이 아니라 +1강 (PLAN §11.3)') : bad(`전설 합성 규칙 위반 — ${JSON.stringify(r2)}`);
      const r3 = a({ part: 'weapon', type: 'greatsword', rar: 3, plus: +L2M - 1 });
      (r3.rar === 4 && r3.plus === 0) ? ok(`전설 +${+L2M - 1} 합성 → 신화 0강 변환 (PLAN §11.3)`) : bad(`+${L2M}강 신화 변환 규칙 위반 — ${JSON.stringify(r3)}`);
      const r4 = a({ part: 'weapon', type: 'greatsword', rar: 4, plus: 9 });
      (r4.rar === 4 && r4.plus === 10) ? ok('신화는 무한 강화 (변환 없음 — PLAN §11.3)') : bad(`신화 무한강화 규칙 위반 — ${JSON.stringify(r4)}`);
    }
  }
  /* (6) 인벤 칸 구도 — 스크린샷의 등급색 타일 + 부위 태그 (장비 탭·합성 화면 공용 함수) */
  const ic = HTML.match(/function invCellHTML\(g,o\)\{[\s\S]*?\n\}/);
  if (!ic) bad('invCellHTML 공용 함수가 없다 — 장비 탭과 합성 화면의 칸 구도가 갈라진다');
  else {
    /class="ptag"/.test(ic[0]) ? ok('인벤 칸에 부위 태그 (스크린샷 좌상단 라벨)') : bad('인벤 칸에 부위 태그가 없다');
    /background:linear-gradient\(\$\{GT\.rarColor\[g\.rar\]\}/.test(ic[0]) ? ok('인벤 칸이 등급색 타일 (스크린샷 구도 — 테두리만이 아니다)')
      : bad('인벤 칸이 등급색 배경 타일이 아니다');
    /isEquipped\(g\)\?'<span class="eqm">장착<\/span>'/.test(ic[0]) ? ok('장착 중인 칸에 «장착» 띠') : bad('«장착» 표시가 없다');
  }
  (/\$\('invGrid'\)\.innerHTML[^\n]*invCellHTML/.test(HTML) && /\$\('fgGrid'\)\.innerHTML[^\n]*[\s\S]{0,400}invCellHTML/.test(HTML))
    ? ok('장비 탭·합성 화면이 같은 invCellHTML 을 쓴다') : bad('두 화면이 인벤 칸을 따로 그린다 — 구도가 갈라진다');
}

/* ---------- ⑮ 장비 아이콘 — 인라인 SVG 18종 (참고: docs/ref/캐릭터 장비.jpg · T2 6단계) ---------- */
/* 왜 게이트인가 — 아이콘은 «18계열이 화면에서 서로 구별되는가» 라는 요구를 지고 있다.
   계열이 늘거나(장비 확장) 아이콘 하나를 지우면 그 칸이 조용히 빈 사각형이 되는데,
   렌더 결과가 아니라 데이터라서 문법 검사(①)에도 안 걸린다. 여기서 18종 전수 + 마크업 유효성 +
   중복 0 + «이모지로 되돌아가지 않았는가» 를 본다. */
console.log('\n[⑮ 장비 아이콘 — 인라인 SVG 18종 (스크린샷 구도, 이모지 폐지)]');
{
  /* (1) 이모지로 되돌아가지 않았는가 */
  /GT\.typeIcon\s*=/.test(HTML) ? bad('GT.typeIcon(이모지 표) 가 되살아났다 — 6단계에서 SVG 로 교체된 항목이다')
    : ok('이모지 아이콘 표(GT.typeIcon) 폐지 상태 유지');
  /GT\.typeSvg\s*=\s*\{/.test(HTML) ? ok('GT.typeSvg — 인라인 SVG 아이콘 표 존재') : bad('GT.typeSvg 가 없다 — 장비 칸이 빈다');
  /function gearIcon\(t\)\{/.test(HTML) ? ok('gearIcon(type) — 아이콘 1개를 그리는 공용 함수')
    : bad('gearIcon() 공용 함수가 없다 — 화면마다 아이콘 마크업이 갈라진다');
  /\.gicon\{[^}]*width:1em[^}]*height:1em/.test(HTML)
    ? ok('.gicon 크기가 1em — 칸의 font-size 가 그대로 크기 노브(인벤 22 · 결과 30 · 재료 19px)')
    : bad('.gicon 이 1em 크기가 아니다 — 칸마다 아이콘 크기가 어긋난다');
  /* (2) 아이콘을 쓰는 6개 지점이 전부 gearIcon 을 부른다 (한 곳이라도 빠지면 그 화면만 옛 표기) */
  {
    const SITES = [
      ['장착 슬롯 카드(slotCardHTML)', /function slotCardHTML\(pt\)\{[\s\S]*?\n\}/],
      ['인벤 칸(invCellHTML)', /function invCellHTML\(g,o\)\{[\s\S]*?\n\}/],
      ['합성 재료·결과 칸(renderForge)', /function renderForge\(\)\{[\s\S]*?\n\}/],
      ['장비 세부 팝업(openGearDetail)', /function openGearDetail\(u\)\{[\s\S]*?\n\}/],
    ];
    for (const [nm, re] of SITES) {
      const m = HTML.match(re);
      if (!m) { bad(`${nm} 을(를) 찾지 못했다 — 게이트를 갱신할 것`); continue; }
      /gearIcon\(/.test(m[0]) ? ok(`${nm} 이 gearIcon() 을 쓴다`) : bad(`${nm} 이 아이콘을 그리지 않는다`);
    }
    /뽑기[\s\S]{0,4000}?gearIcon\(g\.type\)/.test(HTML) ? ok('뽑기 결과 목록도 gearIcon() 을 쓴다')
      : bad('뽑기 결과에 장비 아이콘이 없다');
  }
  /* (3) 18계열 전수 + 마크업 유효성 + 중복 0 — GT.typeSvg 를 실제로 평가해서 본다 */
  {
    const mSvg = HTML.match(/GT\.typeSvg=\{[\s\S]*?\n\};/);
    const mName = HTML.match(/typeName:\{[\s\S]*?\},/);
    if (!mSvg || !mName) bad('GT.typeSvg / GT.typeName 을 읽지 못했다 — 게이트를 갱신할 것');
    else {
      const ctx = { GT: {} }; vm.createContext(ctx);
      vm.runInContext(mSvg[0], ctx);
      vm.runInContext('NAMES=({' + mName[0].replace(/^typeName:\{/, '').replace(/\},$/, '') + '})', ctx);
      const svg = ctx.GT.typeSvg, names = Object.keys(ctx.NAMES);
      const miss = names.filter(t => !svg[t]);
      const extra = Object.keys(svg).filter(t => !names.includes(t));
      names.length === 18 ? ok('계열 18종 (PLAN §11 — 부위 6 × 종류 3)') : bad(`계열이 18종이 아니다 (${names.length}종)`);
      miss.length === 0 ? ok('18계열 전부 아이콘이 있다') : bad(`아이콘 없는 계열 ${miss.length}종: ${miss.join(',')}`);
      extra.length === 0 ? ok('존재하지 않는 계열의 아이콘 없음') : bad(`계열에 없는 아이콘 ${extra.join(',')}`);
      /* 마크업 유효성 — 태그 짝이 맞고, 좌표가 24×24 뷰박스를 벗어나지 않는가 */
      let broke = 0, spill = 0, emo = 0;
      for (const t of names) {
        const s = svg[t] || '';
        const stack = [];
        for (const m of s.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
          if (m[3] === '/') continue;                       /* 자기 완결 태그 */
          if (m[1] === '/') { if (stack.pop() !== m[2]) { broke++; break; } }
          else stack.push(m[2]);
        }
        if (stack.length) broke++;
        for (const d of s.matchAll(/\sd="([^"]*)"/g))
          for (const n of d[1].match(/-?\d+(\.\d+)?/g) || []) if (+n < -0.5 || +n > 24.5) { spill++; break; }
        if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s)) emo++;
      }
      broke === 0 ? ok('아이콘 18종 마크업 태그 짝 정상') : bad(`태그 짝이 맞지 않는 아이콘 ${broke}종`);
      spill === 0 ? ok('아이콘 좌표가 24×24 뷰박스 안') : bad(`뷰박스를 벗어난 아이콘 ${spill}종 — 칸에서 잘린다`);
      emo === 0 ? ok('아이콘 마크업에 이모지 잔재 없음') : bad(`이모지가 남은 아이콘 ${emo}종`);
      const uniq = new Set(names.map(t => norm(svg[t] || '')));
      uniq.size === names.length ? ok(`아이콘 18종이 서로 다르다 (중복 0 — 계열 구별 가능)`)
        : bad(`같은 그림을 쓰는 계열이 있다 (서로 다른 그림 ${uniq.size}종/${names.length}종)`);
      /* 부위별 3종이 같은 부위 안에서도 갈라지는지 — 무기 3종이 같으면 «구별» 요구가 깨진다 */
      const mParts = HTML.match(/types:\{[\s\S]*?\},\n/);
      if (mParts) {
        vm.runInContext('TYPES=({' + mParts[0].replace(/^types:\{/, '').replace(/\},\n$/, '') + '})', ctx);
        let dup = 0;
        for (const pt of Object.keys(ctx.TYPES)) {
          const set = new Set(ctx.TYPES[pt].map(t => norm(svg[t] || '')));
          if (set.size !== ctx.TYPES[pt].length) dup++;
        }
        dup === 0 ? ok('부위 6곳 모두 종류 3개가 서로 다른 그림') : bad(`같은 부위 안에서 그림이 겹치는 부위 ${dup}곳`);
      }
    }
  }
  /* (4) 표시 전용 — sim.js 는 아이콘을 모른다 (엔진 무관 = T1 회차 무효 사유 아님) */
  /typeSvg|gearIcon/.test(SIM) ? bad('sim.js 에 아이콘이 새어 들어갔다 — 표시 메타는 게임 전용이다')
    : ok('sim.js 무관 (표시 전용 메타 — 밸런스 영향 0)');
}

/* ---------- ⑯ 특전 선택 화면 구도 (참고: docs/ref/perks.jpg · T2 6단계) ---------- */
/* 스크린샷 구도의 두 축: ①특전 아이콘이 «등급색 팔각 메달리온» 안에 든다(맨 이모지 금지)
   ②무료 새로고침은 밑줄 텍스트가 아니라 주황 버튼 + 그 아래 «남은 횟수» 줄이다. */
console.log('\n[⑯ 특전 선택 화면 — 등급 메달리온 · 새로고침 버튼 (스크린샷 구도)]');
{
  const icCss = HTML.match(/\.perk-card \.ic\{[^}]*\}/);
  if (!icCss) bad('.perk-card .ic 규칙이 없다');
  else {
    /clip-path:polygon/.test(icCss[0]) ? ok('특전 아이콘이 팔각 메달리온 (스크린샷 구도)')
      : bad('특전 아이콘이 맨 이모지다 — 스크린샷의 메달리온 구도가 아니다');
    /var\(--pc/.test(icCss[0]) ? ok('메달리온 바탕이 등급색(--pc)') : bad('메달리온이 등급색을 쓰지 않는다');
    /width:46px;\s*height:46px/.test(icCss[0]) ? ok('메달리온이 정사각(46px) — 팔각이 찌그러지지 않는다')
      : bad('메달리온 가로·세로가 어긋난다');
  }
  const refCss = HTML.match(/#refBtn\{[^}]*\}/);
  (refCss && /linear-gradient\(#FFCB4D,#F5A623\)/.test(refCss[0]))
    ? ok('무료 새로고침이 주황 버튼 (스크린샷의 Refresh Free)')
    : bad('무료 새로고침이 주황 버튼이 아니다 — 밑줄 텍스트 구도로 되돌아갔다');
  /<button id="refBtn">/.test(HTML) ? ok('#refBtn 이 ghost-btn(밑줄 텍스트) 클래스를 쓰지 않는다')
    : bad('#refBtn 이 여전히 밑줄 텍스트 버튼이다');
  /<div id="refLeft">남은 횟수: <b>\$\{G\.refreshLeft\}<\/b><\/div>/.test(HTML)
    ? ok('버튼 아래 «남은 횟수» 줄 (스크린샷의 Remain : N)') : bad('«남은 횟수» 줄이 없다');
  /G\.refreshLeft<=0\)\{ rb\.style\.display='none'; \$\('refLeft'\)\.style\.display='none'; \}/.test(HTML)
    ? ok('횟수가 0 이면 버튼과 «남은 횟수» 줄이 함께 사라진다')
    : bad('횟수 소진 시 두 요소가 함께 숨겨지지 않는다 — 0 인데 줄만 남는다');
}

/* ---------- ⑰ UI 아이콘 — 스탯 그리드 7 + 하단 5탭 (참고: docs/ref/메인 게임화면.jpg · 메인로비.jpg · T2 7단계) ---------- */
/* 왜 게이트인가 — ⑮ 와 같은 이유다. 아이콘이 «데이터» 라서 한 칸이 비어도 문법 검사에 안 걸린다.
   여기에 더해 이 표는 **스탯 그리드·하단 탭·버프바 폴백 3곳이 공유**하므로, 키가 하나 어긋나면
   한 화면만 조용히 폴백(spark)으로 바뀐다 — 사람 눈으로는 «그냥 그런 아이콘» 으로 보인다. */
console.log('\n[⑰ UI 아이콘 — 스탯 7 · 하단 탭 5 (인라인 SVG, 이모지 폐지)]');
{
  /* (1) 공용 표·공용 함수 — 그리는 곳이 한 군데인가 */
  /const UI_SVG=\{/.test(HTML) ? ok('UI_SVG — UI 인라인 SVG 아이콘 표 존재') : bad('UI_SVG 가 없다 — 스탯·탭 아이콘이 빈다');
  /function uiIcon\(k\)\{/.test(HTML) ? ok('uiIcon(k) — UI 아이콘 1개를 그리는 공용 함수') : bad('uiIcon() 공용 함수가 없다');
  /function svgIcon\(body\)\{/.test(HTML) ? ok('svgIcon(body) — 장비·UI 가 같은 마크업 래퍼를 쓴다') : bad('svgIcon() 공용 래퍼가 없다 — 두 계열의 외곽선이 갈라진다');
  /function gearIcon\(t\)\{ return svgIcon\(GT\.typeSvg\[t\]\); \}/.test(HTML)
    ? ok('gearIcon 이 같은 래퍼(svgIcon)를 쓴다') : bad('gearIcon 이 마크업을 따로 만든다');
  /* (2) 렌더 지점 3곳이 전부 uiIcon 을 부른다 */
  {
    const SITES = [
      ['하단 탭바(buildNav)', /<span class="nic">\$\{uiIcon\('nav_'\+t\.k\)\}<\/span>/],
      ['인게임 스탯 그리드(renderStatsGrid)', /<span class="ic">\$\{uiIcon\(d\.k\)\}<\/span>/],
      ['버프바 폴백(renderBuffBar)', /uiIcon\(BUFF_STAT_IC\[g\.k\]\|\|'spark'\)/],
    ];
    for (const [nm, re] of SITES) re.test(HTML) ? ok(`${nm} 이 uiIcon() 을 쓴다`) : bad(`${nm} 이 uiIcon() 을 쓰지 않는다 — 그 화면만 옛 표기`);
  }
  /* (3) 이모지로 되돌아가지 않았는가 — 세 정의 블록을 실제로 잘라서 본다 */
  {
    const EMO = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;
    const BLOCKS = [
      ['NAV_TABS(하단 5탭)', /const NAV_TABS=\[[\s\S]*?\n\];/],
      ['STAT_DEFS(스탯 7칸)', /const STAT_DEFS=\[[\s\S]*?\n\];/],
      ['BUFF_STAT_IC(버프 폴백)', /const BUFF_STAT_IC=\{[^}]*\}/],
    ];
    for (const [nm, re] of BLOCKS) {
      const m = HTML.match(re);
      if (!m) { bad(`${nm} 을(를) 찾지 못했다 — 게이트를 갱신할 것`); continue; }
      const code = m[0].replace(/\/\*[\s\S]*?\*\//g, '');   /* 주석의 이모지(«🩸 흡혈 행 제거» 등)는 표기가 아니다 */
      EMO.test(code) ? bad(`${nm} 에 이모지가 되살아났다 — 7단계에서 SVG 로 교체된 항목이다`) : ok(`${nm} 이모지 폐지 상태 유지`);
    }
  }
  /* (4) 크기 노브 — 칸의 font-size 하나로 크기가 정해지는가(.gicon 이 1em 이므로) */
  /\.st \.ic\{[^}]*font-size:\d+px/.test(HTML) ? ok('.st .ic 에 font-size (스탯 아이콘 크기 노브)') : bad('.st .ic 크기 규칙이 없다');
  /\.nav-tab \.nic\{[^}]*font-size:\d+px/.test(HTML) ? ok('.nav-tab .nic 에 font-size (탭 아이콘 크기 노브)') : bad('.nav-tab .nic 크기 규칙이 없다');
  /* (5) 표를 실제로 평가해 전수·마크업·중복을 본다 — 키는 STAT_DEFS/NAV_TABS 에서 읽는다(베끼지 않는다) */
  {
    const mUi = HTML.match(/const UI_SVG=\{[\s\S]*?\n\};/);
    const mStat = HTML.match(/const STAT_DEFS=\[[\s\S]*?\n\];/);
    const mNav = HTML.match(/const NAV_TABS=\[[\s\S]*?\n\];/);
    const mGear = HTML.match(/GT\.typeSvg=\{[\s\S]*?\n\};/);
    if (!mUi || !mStat || !mNav) bad('UI_SVG / STAT_DEFS / NAV_TABS 를 읽지 못했다 — 게이트를 갱신할 것');
    else {
      const ctx = { GT: {} }; vm.createContext(ctx);
      vm.runInContext(mUi[0].replace(/^const /, ''), ctx);   /* const 는 vm 전역에 안 붙는다 → 암묵 전역으로 */
      const svg = ctx.UI_SVG;
      const statKeys = [...mStat[0].matchAll(/\{k:'([a-zA-Z]+)'/g)].map(m => m[1]);
      const navKeys = [...mNav[0].matchAll(/\{k:'([a-zA-Z]+)'/g)].map(m => m[1]);
      statKeys.length === 7 ? ok('스탯 7칸 (흡혈 제거 후 — 주인 지시 07:1X)') : bad(`스탯 칸이 7개가 아니다 (${statKeys.length}개)`);
      navKeys.length === 5 ? ok('하단 탭 5개') : bad(`하단 탭이 5개가 아니다 (${navKeys.length}개)`);
      const need = [...statKeys, ...navKeys.map(k => 'nav_' + k), 'spark'];
      const miss = need.filter(k => !svg[k]);
      const extra = Object.keys(svg).filter(k => !need.includes(k));
      miss.length === 0 ? ok(`필요한 아이콘 ${need.length}종 전부 있다 (스탯 7 · 탭 5 · 폴백 1)`)
        : bad(`아이콘 없는 키 ${miss.length}종: ${miss.join(',')} — 그 칸이 폴백으로 조용히 바뀐다`);
      extra.length === 0 ? ok('쓰이지 않는 아이콘 없음') : bad(`아무도 안 쓰는 아이콘 ${extra.join(',')}`);
      let broke = 0, spill = 0, emo = 0;
      const EMO = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
      for (const k of Object.keys(svg)) {
        const s = svg[k] || '', stack = [];
        for (const m of s.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
          if (m[3] === '/') continue;
          if (m[1] === '/') { if (stack.pop() !== m[2]) { broke++; break; } }
          else stack.push(m[2]);
        }
        if (stack.length) broke++;
        for (const d of s.matchAll(/\sd="([^"]*)"/g))
          for (const n of d[1].match(/-?\d+(\.\d+)?/g) || []) if (+n < -0.5 || +n > 24.5) { spill++; break; }
        if (EMO.test(s)) emo++;
      }
      broke === 0 ? ok('UI 아이콘 마크업 태그 짝 정상') : bad(`태그 짝이 맞지 않는 UI 아이콘 ${broke}종`);
      spill === 0 ? ok('UI 아이콘 좌표가 24×24 뷰박스 안') : bad(`뷰박스를 벗어난 UI 아이콘 ${spill}종 — 칸에서 잘린다`);
      emo === 0 ? ok('UI 아이콘 마크업에 이모지 잔재 없음') : bad(`이모지가 남은 UI 아이콘 ${emo}종`);
      const keys = Object.keys(svg), uniq = new Set(keys.map(k => norm(svg[k] || '')));
      uniq.size === keys.length ? ok(`UI 아이콘 ${keys.length}종이 서로 다르다 (중복 0)`)
        : bad(`같은 그림을 쓰는 UI 아이콘이 있다 (서로 다른 그림 ${uniq.size}종/${keys.length}종)`);
      /* 장비 18종과도 겹치면 안 된다 — 한 화면(장비 탭 + 하단 탭)에 둘이 같이 뜬다 */
      if (mGear) {
        vm.runInContext(mGear[0], ctx);
        const gset = new Set(Object.values(ctx.GT.typeSvg).map(s => norm(s)));
        const clash = keys.filter(k => gset.has(norm(svg[k] || '')));
        clash.length === 0 ? ok('UI 아이콘이 장비 아이콘 18종과 겹치지 않는다') : bad(`장비 아이콘과 같은 그림: ${clash.join(',')}`);
      }
    }
  }
  /* (6) 표시 전용 — sim.js 는 UI 아이콘을 모른다 */
  /UI_SVG|uiIcon/.test(SIM) ? bad('sim.js 에 UI 아이콘이 새어 들어갔다 — 표시 메타는 게임 전용이다')
    : ok('sim.js 무관 (표시 전용 메타 — 밸런스 영향 0)');
}

/* ---------- ⑱ 관통 투사체 상한 (주인 지시 15:0X · 승인 24번 종결 · T34) ---------- */
console.log('\n[⑱ 관통 투사체 상한 — 창 ≤8마리 · 검기가 pierce 를 실제로 따르는가 (PLAN §3.3, T34)]');
{
  /* (1) 창: 두 파일 다 pierce:8 을 실어야 한다. PLAN §3.3 «일직선 8명 거리» 의 «8명» 이 상한이다. */
  const spearOf = (src, who) => {
    const m = src.match(/type:'spear',[^}]*?\}/);
    if (!m) { bad(`${who} 에서 창 투사체 생성부를 못 찾았다 — 게이트를 갱신할 것`); return null; }
    const p = m[0].match(/pierce:(\d+)/);
    if (!p) { bad(`${who} 의 창에 관통 상한(pierce)이 없다 — 상한 없는 창은 12마리 웨이브에서 총출력 162배가 된다 (T34)`); return null; }
    return Number(p[1]);
  };
  const sSpear = spearOf(SIM, 'sim.js'), hSpear = spearOf(HTML, 'index.html');
  const planSpear = Number((fs.readFileSync(path.join(ROOT, 'PLAN.md'), 'utf8').match(/일직선 (\d+)명 거리/) || [])[1]);
  if (sSpear !== null && hSpear !== null) {
    if (sSpear !== hSpear) bad(`창 관통 상한이 두 파일에서 다르다 — sim.js ${sSpear} · index.html ${hSpear}`);
    else if (!planSpear) bad('PLAN §3.3 l_spear 에서 «일직선 N명 거리» 를 못 찾았다 — 게이트를 갱신할 것');
    else if (sSpear !== planSpear) bad(`창 관통 상한이 PLAN §3.3 «${planSpear}명» 과 다르다 — 엔진 ${sSpear}`);
    else ok(`창 관통 상한 ${sSpear}마리 — sim.js · index.html · PLAN §3.3 3자 일치`);
  }
  /* (2) 신화 m_spear200 은 «데미지만» 올린다 — 관통 수를 건드리면 주인 확정 스펙 위반 */
  for (const [src, who] of [[SIM, 'sim.js'], [HTML, 'index.html']]) {
    const m = src.match(/type:'spear',[^}]*?\}/);
    if (!m) continue;
    /spearMaster[^,]*pierce|pierce:[^,}]*spearMaster/.test(m[0])
      ? bad(`${who}: m_spear200(창의 대가)이 관통 수를 바꾼다 — 주인 확정: 데미지 200%(엔진 13.5배)로만 작동, 관통 수 불변`)
      : ok(`${who}: m_spear200 은 데미지만 올린다 (관통 수 불변)`);
  }
  /* (3) 관통 판정이 리터럴이 아니라 pr.pierce 를 봐야 한다.
     실제로 index.html 이 `pr.type==='wave'&&pr.hit.size>=2` 로 2를 박아 둬서
     m_wave4(검기의 왕, 20명 관통)가 게임에서 통째로 죽어 있었다(T34 에서 발견). */
  for (const [src, who] of [[SIM, 'sim.js'], [HTML, 'index.html']]) {
    const m = src.match(/pr\.hit\.size\s*>=\s*([A-Za-z0-9_.]+)/);
    if (!m) { bad(`${who} 에서 관통 상한 판정을 못 찾았다 — 게이트를 갱신할 것`); continue; }
    if (m[1] !== 'pr.pierce') bad(`${who}: 관통 판정이 «pr.hit.size>=${m[1]}» — 리터럴을 박으면 pierce 를 올리는 특전(m_wave4 20명)이 죽는다`);
    else ok(`${who}: 관통 판정이 pr.pierce 를 따른다`);
    if (/pr\.type==='wave'&&pr\.hit\.size/.test(src.replace(/\s/g, '')))
      bad(`${who}: 관통 판정이 wave 에만 걸려 있다 — 창(spear)이 상한 없이 뚫는다 (T34)`);
    else ok(`${who}: 관통 판정이 창·검기 양쪽에 걸린다`);
  }
}

/* ---------- ⑲ T3 동작 검증에서 잡힌 버그의 회귀 방지 ---------- */
/* 둘 다 «정적 검사로는 안 걸리고 실제로 굴려 봐야 보이는» 부류라, 잡은 뒤에는 게이트가 지켜야 한다. */
console.log('\n[⑲ T3 발견 버그 회귀 방지]');
{
  /* T3-1 — 다연발 순차 연사의 간격이 «누적» 인가 (k×난수 는 이웃 간격이 0.6~171ms 로 흩어진다) */
  const mv = HTML.match(/function volley\(n,shot\)\{[\s\S]*?\n\}/);
  if (!mv) bad('volley() 를 찾지 못했다 — 게이트를 갱신할 것');
  else {
    const code = mv[0].replace(/\/\*[\s\S]*?\*\//g, '');   /* 수리 근거를 적은 주석에 옛 식이 인용돼 있다 */
    /k\s*\*\s*\(\s*50\s*\+\s*Math\.random\(\)/.test(code)
      ? bad('volley 간격이 k×난수로 되돌아갔다 (T3-1) — 이웃 발 간격이 흩어지고 순서가 뒤집힌다')
      : ok('volley 간격이 k×난수 방식이 아니다 (T3-1 회귀 없음)');
    /d\s*\+=\s*50\s*\+\s*Math\.random\(\)\s*\*\s*20/.test(code)
      ? ok('volley 가 간격을 누적한다 (발 사이 50~70ms 보장)')
      : bad('volley 가 간격을 누적하지 않는다 — 50~70ms 순차 연사(주인 지시 08:3X)가 깨진다');
  }
  /* T3-2 — 폐지된 «영구 강화» 를 화면 문구가 안내하지 않는가 (PLAN §11.4) */
  {
    const body = HTML.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
    /영구\s*강화/.test(body)
      ? bad('화면 문구가 폐지된 «영구 강화» 를 안내한다 (T3-2 · PLAN §11.4 로 폐지된 시스템)')
      : ok('폐지된 «영구 강화» 안내 문구 없음 (T3-2 회귀 없음)');
  }
}

/* ---------- ⑳ 적 회피 10% + 적중률 금지 (주인 확정 15:4X · T43) ---------- */
console.log('\n[⑳ 적 회피 10% · 적중률(명중) 스탯 금지 (PLAN §2.3, T43)]');
{
  /* 주석은 «적중률 금지» 를 설명하느라 금지어를 쓸 수밖에 없다 — 검사는 항상 주석을 뺀 코드/설명문만 본다. */
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
  const SIMC = strip(SIM), HTMLC = strip(HTML);

  /* (1) 상수 — 두 파일 다 0.10, 그리고 TUNE 안이 아니어야 한다(주인 확정 상수 = 튜닝 노브 아님). */
  const evOf = (src, who) => {
    const m = src.match(/const ENEMY_EVADE=([\d.]+);/);
    if (!m) { bad(`${who}: ENEMY_EVADE 상수가 없다 — 적 회피 10% 미반영 (PLAN §2.3 주인 확정)`); return null; }
    return Number(m[1]);
  };
  const evS = evOf(SIMC, 'sim.js'), evH = evOf(HTMLC, 'index.html');
  if (evS !== null && evH !== null) {
    evS === 0.10 ? ok(`sim.js ENEMY_EVADE = ${evS}`) : bad(`sim.js ENEMY_EVADE = ${evS} — 주인 확정값 0.10 이 아니다`);
    evH === 0.10 ? ok(`index.html ENEMY_EVADE = ${evH}`) : bad(`index.html ENEMY_EVADE = ${evH} — 주인 확정값 0.10 이 아니다`);
    evS === evH ? ok('두 엔진의 회피율이 같다') : bad(`sim ${evS} ≠ 게임 ${evH} — sim↔게임 괴리`);
  }
  for (const [src, who] of [[SIMC, 'sim.js'], [HTMLC, 'index.html']]) {
    const t = src.match(/const TUNE=\{[\s\S]*?\n\};/) || src.match(/TUNE=\{[\s\S]*?\n\};/);
    (t && /ENEMY_EVADE|enemyEvade/.test(t[0]))
      ? bad(`${who}: 적 회피율이 TUNE 안에 있다 — 주인 확정 상수라 튜닝 노브가 아니다`)
      : ok(`${who}: 회피율이 TUNE 밖 (노브 아님)`);
  }

  /* (2) 적용 지점 — 주인이 명시한 3종(기본공격·소환·반격)이 전부 걸려야 한다.
     기본공격·소환은 dealDmg/dealPlayerDamage 한 곳으로 모이고, 반격은 doCounter 다. */
  const fnBody = (src, re, who, what) => {
    const m = src.match(re);
    if (!m) { bad(`${who}: ${what} 본문을 못 찾았다 — 게이트를 갱신할 것`); return null; }
    return m[0];
  };
  const SITES = [
    [SIMC, 'sim.js', '기본공격·소환(dealDmg)', /function dealDmg\(G,e,ratio,fromBasic\)\{[\s\S]*?\n\}/],
    [HTMLC, 'index.html', '기본공격·소환(dealPlayerDamage)', /function dealPlayerDamage\(e,ratio,icon\)\{[\s\S]*?\n\}/],
    [SIMC, 'sim.js', '반격(doCounter)', /function doCounter\(G,src,depth\)\{[\s\S]*?\n\}/],
    [HTMLC, 'index.html', '반격(doCounter)', /function doCounter\(src,depth\)\{[\s\S]*?\n\}/],
  ];
  for (const [src, who, what, re] of SITES) {
    const b = fnBody(src, re, who, what);
    if (b === null) continue;
    /Math\.random\(\)<ENEMY_EVADE/.test(norm(b))
      ? ok(`${who} ${what} — 회피 판정 있음`)
      : bad(`${who} ${what} — 회피 판정이 없다 (적 회피 10% 가 이 경로를 안 탄다)`);
  }

  /* (3) 게임은 회피 «지점마다» «MISS» 팝을 띄워야 한다 (PLAN §2.3 위임 표시 규약).
     전역 grep 이면 한쪽이 지워져도 다른 쪽 팝에 가려 통과한다 — 함수 본문별로 본다. */
  for (const [what, re] of [
    ['기본공격·소환(dealPlayerDamage)', /function dealPlayerDamage\(e,ratio,icon\)\{[\s\S]*?\n\}/],
    ['반격(doCounter)', /function doCounter\(src,depth\)\{[\s\S]*?\n\}/]]) {
    const b = fnBody(HTMLC, re, 'index.html', what);
    if (b === null) continue;
    /addText\('MISS'/.test(b) ? ok(`index.html ${what} — «MISS» 팝 있음`)
      : bad(`index.html ${what} — 회피 시 «MISS» 팝이 없다 (주인이 눈으로 확인할 수단이 사라진다)`);
  }

  /* (4) ⚑ 적중률(명중) 금지 — 흡혈 증가 금지(07:1X)와 같은 축.
     설명문(특전 102종 tx · 장비 옵션 126칸 d)과 px 키 이름에 «적 회피를 뚫는» 축이 생기면 불합격.
     PLAN §3·§11.6 표도 같이 본다 — 표에 먼저 들어오고 엔진이 뒤따르는 순서로 새는 일이 실제로 있었다(T8·T9·T11·T12). */
  const BAN = /(명중|적중률|적중\s*확률|적중\s*\+|회피\s*무시|accuracy|hitRate|hitChance)/;
  const banScan = [];
  if (H) for (const h of H) if (BAN.test(h.tx || '')) banScan.push(`특전 ${h.id}: «${h.tx}»`);
  {
    const g = goptTable(SIMC), g2 = goptTable(HTMLC);
    for (const [tbl, who] of [[g, 'sim.js'], [g2, 'index.html']])
      if (tbl) for (const ty of Object.keys(tbl)) tbl[ty].forEach((o, i) => {
        if (BAN.test(o.d || '')) banScan.push(`${who} 장비 ${ty} 옵션${i + 1}: «${o.d}»`);
      });
  }
  for (const [src, who] of [[SIMC, 'sim.js'], [HTMLC, 'index.html']]) {
    const keys = (src.match(/\b(acc|accuracy|hitRate|hitChance|toHit|ignoreEvade)\b\s*[:+]/g) || []);
    if (keys.length) banScan.push(`${who} px/스탯 키: ${[...new Set(keys)].join(' ')}`);
  }
  /* PLAN 은 §2.3(금지 선언)·§3.0(빗맞음 축 설명)에서 금지어를 «금지한다» 는 문장으로 쓴다 —
     그 두 문장은 규칙 선언이므로 제외하고, 특전표(§3.1~§3.4)·옵션표(§11.6) 행만 본다. */
  const PLANSRC = fs.readFileSync(path.join(ROOT, 'PLAN.md'), 'utf8');
  const planRows = PLANSRC.split('\n').filter(l => /^\|/.test(l) && BAN.test(l));
  for (const l of planRows) banScan.push(`PLAN 표 행: «${l.trim().slice(0, 90)}»`);
  banScan.length === 0
    ? ok('적중률(명중)·회피 무시 항목 0건 — 특전 102종 · 장비 126칸 · px 키 · PLAN 표 전수')
    : bad(`적중률(명중) 축이 생겼다 ${banScan.length}건 — 주인 금지 (PLAN §2.3):\n    ` + banScan.join('\n    '));

  /* (5) 제외 경로 문서화 — 가시 반사·오발 화살은 «플레이어가 겨눈 타격» 이 아니라 회피 대상이 아니다(위임, T43).
     두 엔진이 같은 판단이어야 한다(한쪽만 걸면 sim↔게임 괴리). */
  for (const [src, who, re] of [
    [SIMC, 'sim.js', /thorns&&src&&src\.hp>0&&pkk\([^)]*\)\)\{?[^\n]*/],
    [HTMLC, 'index.html', /thorns&&src&&src\.hp>0&&pkk\([^)]*\)\)\{?[^\n]*/]]) {
    const m = src.match(re);
    if (!m) { bad(`${who}: 가시 반사 지점을 못 찾았다 — 게이트를 갱신할 것`); continue; }
    /ENEMY_EVADE/.test(m[0])
      ? bad(`${who}: 가시 반사에 회피가 걸렸다 — T43 위임 판단(제외)과 어긋난다. 바꾸려면 양쪽 동시에 + PROGRESS 갱신`)
      : ok(`${who}: 가시 반사는 회피 제외 (위임, T43)`);
  }
}

/* ---------- ㉑ 소환 적중 = «공격» 트리거 (주인 확정 15:3X · T45) ---------- */
/* 주인 원문: «공격 시 50% 창이면, 창이 적 때렸을 때도 그 50% 적용. 치명타 시 창이면 창이 치명 뜨면 창 또 나가야 함.»
   두 파일이 같은 동사(summonHit/pushProj)·같은 성능 가드 상수를 쓰는지, 그리고 기본공격 전용 3종이
   여전히 기본공격에만 남아 있는지 본다. 실제 «굴러가는가» 단언은 verifyCombatConst ③ 이 vm 으로 본다. */
console.log('\n[㉑ 소환 적중 = 공격 트리거 (PLAN §4, T45)]');
{
  /* (1) 성능 가드 상수가 두 파일에서 같아야 한다 (주인 위임 — 확률·연쇄가 아니라 프레임 보호 장치) */
  const capOf = (src, who, name) => {
    const m = src.match(new RegExp(name + '\\s*=\\s*(\\d+)'));
    if (!m) { bad(`${who} 에서 ${name} 을 못 찾았다 — 성능 가드가 사라졌다`); return null; }
    return Number(m[1]);
  };
  for (const nm of ['PROJ_CAP', 'PROC_TICK_CAP']) {
    const sv = capOf(SIM, 'sim.js', nm), hv = capOf(HTML, 'index.html', nm);
    if (sv !== null && hv !== null)
      sv === hv ? ok(`${nm} = ${sv} — 두 파일 일치`)
                : bad(`${nm} 이 두 파일에서 다르다 — sim.js ${sv} · index.html ${hv}`);
  }
  /* (2) 소환 적중 경로가 전부 트리거를 굴리는 동사(summonHit)를 거쳐야 한다.
     번개(즉발)·자동번개·투사체 적중 3경로 중 하나라도 옛 직접 호출로 돌아가면 그 소환만 조용히 트리거를 잃는다. */
  const paths = [
    ['sim.js 번개(fireBolts)',      SIM,  /function fireBolts\(p\)\{[^}]*summonHit\(/],
    ['sim.js 자동번개(autoBolt)',   SIM,  /autoBolt;k\+\+\)\{const t2=randTarget\(G\);if\(t2\)summonHit\(/],
    ['sim.js 관통 투사체 적중',     SIM,  /pr\.hit\.add\(e\);summonHit\(/],
    ['sim.js 단일 투사체 적중',     SIM,  /pr\.x>=pr\.tgt\.worldX-10\)\{summonHit\(/],
    ['index.html 번개(castBolt)',   HTML, /function castBolt\(t\)\{[\s\S]*?summonHit\(t,0\.75/],
    ['index.html 관통 투사체 적중', HTML, /pr\.hit\.add\(e\);\s*summonHit\(/],
    ['index.html 단일 투사체 적중', HTML, /pr\.x>=pr\.tgt\.worldX-10\)\{\s*summonHit\(/],
  ];
  for (const [what, src, re] of paths)
    re.test(src) ? ok(`${what} → summonHit`) : bad(`${what} 이 summonHit 을 안 거친다 — 그 소환만 «공격 시» 트리거를 잃는다 (T45)`);
  /* (3) 투사체 생성은 pushProj 를 거쳐야 한다 (상한 초과분을 즉발 판정으로 대체하는 지점) */
  for (const [src, who] of [[SIM, 'sim.js'], [HTML, 'index.html']]) {
    const body = src.replace(/\/\*[\s\S]*?\*\//g, '');
    const direct = (body.match(/G\.pprojs\.push\(\{type:'/g) || []).length;
    direct === 0 ? ok(`${who}: 소환 투사체 생성이 전부 pushProj 를 거친다`)
                 : bad(`${who}: G.pprojs.push 직접 호출 ${direct}건 — 투사체 상한(PROJ_CAP) 가드를 우회한다`);
    /function pushProj\(/.test(body) ? ok(`${who}: pushProj 존재`) : bad(`${who}: pushProj 가 없다`);
  }
  /* (4) 기본공격 전용 3종은 그대로 기본공격에만 남아야 한다 (주인 위임: nextCrit/nextAtk 소모 · 분신 · 추가타).
     sim 은 fromBasic 인자, index.html 은 «아이콘 인자 없음» 이 기본공격 표시다. */
  /if\(fromBasic&&p\.nextCrit\)/.test(SIM)
    ? ok('sim.js: nextCrit 소모가 기본공격 전용(fromBasic)으로 남아 있다')
    : bad('sim.js: nextCrit 소모의 기본공격 전용 가드가 사라졌다 (주인 위임 범위 밖)');
  /if\(icon===undefined&&p\.nextCrit\)/.test(HTML)
    ? ok('index.html: nextCrit 소모가 기본공격 전용으로 남아 있다')
    : bad('index.html: nextCrit 소모의 기본공격 전용 가드가 사라졌다');
  for (const [src, who, re] of [
    [SIM, 'sim.js', /function playerStrike\(G,e\)\{[\s\S]*?px\.clone[\s\S]*?px\.extraHit[\s\S]*?procOnAttack\(G\);/],
    [HTML, 'index.html', /function playerStrike\(e\)\{[\s\S]*?px\.clone[\s\S]*?px\.extraHit[\s\S]*?procOnAttack\(\);/]])
    re.test(src) ? ok(`${who}: 분신·추가타가 기본공격(playerStrike)에만 있다`)
                 : bad(`${who}: playerStrike 의 분신·추가타 구조가 바뀌었다 — 소환으로 새면 주인 위임 범위 밖이다`);
  /* (5) 소환 적중이 nextCrit 을 소모하면 안 된다 — sim 은 fromBasic 미전달, 게임은 아이콘 인자 필수 */
  {
    const m = SIM.match(/function summonHit\(G,e,ratio\)\{[\s\S]*?\n\}/);
    if (!m) bad('sim.js: summonHit 을 못 찾았다 — 게이트를 갱신할 것');
    else /dealDmg\(G,\s*e,\s*ratio\s*\)/.test(m[0])
      ? ok('sim.js: summonHit 이 fromBasic 없이 dealDmg 를 부른다 (nextCrit 미소모)')
      : bad('sim.js: summonHit 이 dealDmg 를 fromBasic 으로 부른다 — 소환이 nextCrit 을 먹는다');
  }
}

/* ---------- ㉒ 신규 축 2개 — 스턴 · 빗맞음(onMiss) (주인 지시 15:5X · T48 1단계) ---------- */
/* 주인 원문: «스턴 메커니즘 신설(적 공격 정지 n초)» · «빗맞음 트리거 신설 — 회피 10% 로 빗나갔을 때 발동».
   두 축 다 «한 곳으로 모았는가» 가 핵심이다 — 스턴은 applyStun, 빗맞음은 procOnMiss.
   호출 지점이 하나라도 빠지면 그 경로만 조용히 축을 잃는다(T45 가 «공격 시» 하나를 잃고 있던 것과 같은 실패 모드). */
console.log('\n[㉒ 스턴 · 빗맞음 축 (PLAN §3.0·§4, T48 1단계)]');
{
  /* (1) 위임 기본값 상수 4종이 두 파일에서 같아야 한다 */
  const constOf = (src, who, name) => {
    const m = src.match(new RegExp(name + '\\s*=\\s*([\\d./]+)'));
    if (!m) { bad(`${who} 에서 ${name} 을 못 찾았다 — 스턴·빗맞음 위임 기본값이 사라졌다`); return null; }
    return m[1];
  };
  for (const nm of ['STUN_BOSS_MUL', 'STUN_LORD_MUL', 'STUN_LORD_DMG', 'MISS_STACK_CAP']) {
    const sv = constOf(SIM, 'sim.js', nm), hv = constOf(HTML, 'index.html', nm);
    if (sv !== null && hv !== null)
      sv === hv ? ok(`${nm} = ${sv} — 두 파일 일치`)
                : bad(`${nm} 이 두 파일에서 다르다 — sim.js ${sv} · index.html ${hv}`);
  }
  /* (2) 스턴은 applyStun 한 곳으로만 걸린다 — e.stun 을 직접 대입하는 곳이 있으면 보스 1/3·합산금지 규칙을 우회한다 */
  for (const [src, who] of [[SIM, 'sim.js'], [HTML, 'index.html']]) {
    const body = src.replace(/\/\*[\s\S]*?\*\//g, '');
    /function applyStun\(/.test(body) ? ok(`${who}: applyStun 존재`) : bad(`${who}: applyStun 이 없다`);
    const direct = (body.match(/\be\d?\.stun\s*=/g) || []).filter(x => true).length;
    /* applyStun 본문 자신의 대입 1건은 정상 */
    direct <= 1 ? ok(`${who}: e.stun 직접 대입 ${direct}건 (applyStun 본문뿐)`)
                : bad(`${who}: e.stun 직접 대입 ${direct}건 — 보스 1/3·«더 긴 쪽만» 규칙을 우회한다`);
    /STUN_BOSS_MUL/.test(body.match(/function applyStun\([\s\S]*?\n\}/)?.[0] || '')
      ? ok(`${who}: applyStun 이 보스 지속 배수를 적용한다`)
      : bad(`${who}: applyStun 에 보스 스턴 지속 배수가 없다 (주인 명시 — 보스 영구 스턴락 방지)`);
    /Math\.max\(e\.stun\|\|0,\s*s\)/.test(body)
      ? ok(`${who}: 스턴 재적용이 «더 긴 쪽만» 이다 (합산 금지)`)
      : bad(`${who}: 스턴 재적용이 합산으로 바뀌었다 — 저등급 연타로 영구 스턴락이 된다`);
  }
  /* (3) 스턴 중인 적은 그 틱의 공격을 통째로 건너뛴다 (근접·원거리 둘 다). 타이머도 흐르면 안 된다. */
  [[SIM, 'sim.js', /if\(e\.stun>0\)\{e\.stun-=dt;continue;\}/],
   [HTML, 'index.html', /if\(e\.stun>0\)\{ e\.stun-=dt; e\.aggro=false; continue; \}/]]
    .forEach(([src, who, re]) => re.test(src)
      ? ok(`${who}: 스턴 중 적은 공격 루프를 건너뛴다 (근접·화살 공통, 타이머 정지)`)
      : bad(`${who}: 스턴이 적 공격을 실제로 막는 자리가 없다 — 표시만 뜨고 효과가 없다`));
  /* (4) 빗맞음은 procOnMiss 한 곳으로 모으고, «MISS» 가 뜨는 두 자리 전부에서 불러야 한다 */
  for (const [src, who] of [[SIM, 'sim.js'], [HTML, 'index.html']]) {
    const body = src.replace(/\/\*[\s\S]*?\*\//g, '');
    /function procOnMiss\(/.test(body) ? ok(`${who}: procOnMiss 존재`) : bad(`${who}: procOnMiss 가 없다`);
    const calls = (body.match(/procOnMiss\(/g) || []).length - 1;   /* 정의부 1건 제외 */
    calls === 2 ? ok(`${who}: procOnMiss 호출 2곳 (기본·소환 타격 + 반격)`)
                : bad(`${who}: procOnMiss 호출이 ${calls}곳 — 빗맞음이 일어나는 두 자리(dealDmg·doCounter) 전부여야 한다`);
    /* 회피 분기 안에서 불러야 한다 — 분기 밖이면 적중에도 굴러간다 */
    const evadeBlocks = (body.match(/Math\.random\(\)<ENEMY_EVADE[\s\S]{0,220}?procOnMiss\(/g) || []).length;
    evadeBlocks === 2 ? ok(`${who}: 두 호출 다 적 회피 분기 안에 있다`)
                      : bad(`${who}: 적 회피 분기 안의 procOnMiss 가 ${evadeBlocks}곳 — 적중에도 굴러가면 축이 무너진다`);
  }
  /* (5) 빗맞음 데미지 스택은 «가산» 이어야 한다 (주인 정정) — 배수 대입 금지, 적중 1타당 1장 소모 */
  for (const [src, who] of [[SIM, 'sim.js'], [HTML, 'index.html']]) {
    const body = src.replace(/\/\*[\s\S]*?\*\//g, '');
    /p\.missStk--;\s*addBonus\s*\+=\s*1\.00;/.test(body)
      ? ok(`${who}: 스택 소모가 «적중 1타당 1장 · 가산 +100%» 이다`)
      : bad(`${who}: 빗맞음 스택이 가산 풀(addBonus)로 들어가지 않는다 — 주인 정정(«×2 배수 아님») 위반`);
    /MISS_STACK_CAP,\s*p\.missStk\+1/.test(body)
      ? ok(`${who}: 스택 적립이 상한(MISS_STACK_CAP)을 지킨다`)
      : bad(`${who}: 빗맞음 스택 상한이 걸려 있지 않다`);
  }
  /* (6) 주인이 원문으로 명시한 필수 4종이 실제로 존재해야 한다 */
  for (const id of ['l_stunHit3', 'l_stunCrit3', 'l_missCrit', 'l_missStack'])
    (SIM.includes(`'${id}'`) && HTML.includes(`'${id}'`))
      ? ok(`주인 필수 예시 ${id} — 두 파일에 존재`)
      : bad(`주인이 원문으로 지목한 필수 특전 ${id} 가 없다`);
}

/* ---------- ㉓ 레벨업 필요 경험치 4+4*Lv (주인 확정 17:0X · T47) ---------- */
console.log('\n[㉓ 레벨업 필요 경험치 = 4+4*Lv (PLAN §2.4, T47)]');
{
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
  const SIMC = strip(SIM), HTMLC = strip(HTML);

  /* (1) 두 엔진의 식이 «4+4*lv» 인가. index.html 은 정의가 둘(전역 상수 + TUNE) 이라 둘 다 본다 —
     T47 조사에서 실제로 두 곳에 같은 식이 중복돼 있었다(게임 로직은 전역 쪽만 쓴다). */
  const forms = [
    ['sim.js TUNE.expNeed',      SIMC,  /expNeed:lv=>(\d+)\+(\d+)\*lv/],
    ['index.html 전역 expNeed',  HTMLC, /const expNeed=lv=>(\d+)\+(\d+)\*lv/],
    ['index.html TUNE.expNeed',  HTMLC, /expNeed:lv=>(\d+)\+(\d+)\*lv/],
  ];
  const got = [];
  for (const [who, src, re] of forms) {
    const m = src.match(re);
    if (!m) { bad(`${who}: 경험치 요구식을 못 찾았다 — 코드 모양이 바뀌었나 (게이트를 갱신할 것)`); got.push(null); continue; }
    const base = Number(m[1]), step = Number(m[2]);
    got.push(`${base}+${step}`);
    (base === 4 && step === 4)
      ? ok(`${who} = ${base}+${step}*Lv`)
      : bad(`${who} = ${base}+${step}*Lv — 주인 확정(17:0X)은 4+4*Lv`);
  }
  const uniq = [...new Set(got.filter(Boolean))];
  uniq.length <= 1 ? ok('세 정의가 전부 같은 식 (sim↔게임·게임 내부 중복 일치)')
                   : bad(`경험치 요구식이 갈렸다: ${uniq.join(' / ')} — sim↔게임 괴리`);

  /* (2) 레벨업 루프가 리터럴이 아니라 expNeed 를 쓰는가 (T34 의 «리터럴 >=2» 실패 모드 재발 방지). */
  for (const [who, src, re] of [
    ['sim.js',     SIMC,  /while\(p\.exp>=TUNE\.expNeed\(p\.level\)\)\{p\.exp-=TUNE\.expNeed\(p\.level\)/],
    ['index.html', HTMLC, /while\(p\.exp>=expNeed\(p\.level\)\)\{\s*p\.exp-=expNeed\(p\.level\)/]]) {
    re.test(src) ? ok(`${who}: 레벨업 루프가 expNeed() 를 호출한다 (리터럴 박기 아님)`)
                 : bad(`${who}: 레벨업 루프에서 expNeed() 호출을 못 찾았다 — 리터럴이 박혔나`);
  }

  /* (3) 게임 HUD 의 경험치 바도 같은 식을 쓰는가 (표시와 실제가 어긋나면 유저가 먼저 본다). */
  (/expTxt'\)\.textContent=`\$\{p\.exp\}\/\$\{expNeed\(p\.level\)\}`/.test(HTMLC) &&
   /expBar[^\n]*p\.exp\/expNeed\(p\.level\)/.test(HTMLC))
    ? ok('index.html 경험치 바·숫자 표시가 expNeed() 기준')
    : bad('index.html 경험치 HUD 가 expNeed() 를 안 쓴다 — 표시와 실제 레벨업 조건이 어긋난다');

  /* (4) PLAN 잔재 — 확정 이전 식(4+2*Lv)이 «취소선» 밖에 남아 있으면 T2 이식자가 옛 값을 가져간다(T9 실패 모드). */
  const PLAN = fs.readFileSync(path.join(ROOT, 'PLAN.md'), 'utf8');
  const stale = PLAN.split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /4\+2\*[Ll]v/.test(l) && !/~~`?4\+2\*[Ll]v`?~~/.test(l));
  stale.length === 0
    ? ok('PLAN 에 남은 구식 «4+2*Lv» 없음 (취소선 표기 제외)')
    : bad(`PLAN 에 구식 경험치식 잔재 ${stale.length}곳: ` + stale.map(([n]) => `L${n}`).join(' '));
}

/* ---------- ㉔ 원거리 피격 축 · 반사 확장 · 고중첩 변형 (주인 16:0X·16:1X·16:2X · T48 2단계) ---------- */
/* 주인 원문: «적 원거리 공격(화살)에 맞았을 때 발동하는 축. 일반 피격 트리거와 별개 축(둘 다 굴림)».
   «반사 계열 확장 — 피격 시 30% 확률로 해당 적에게 데미지 반사 필수».
   «공격 시 n% 확률 4초 공속 +5%, 최대 10중첩 — 고중첩 상위 변형». */
console.log('\n[㉔ 원거리 피격 · 반사 확장 · 고중첩 (PLAN §3.0, T48 2단계)]');
{
  for (const [src, who, meleeGuard] of [
    [SIM, 'sim.js', 'if(!isMelee)procOnRanged(G,src);'],
    [HTML, 'index.html', 'if(!isMelee) procOnRanged(src);']]) {
    const body = src.replace(/\/\*[\s\S]*?\*\//g, '');
    /function procOnRanged\(/.test(body) ? ok(`${who}: procOnRanged 존재`) : bad(`${who}: procOnRanged 가 없다`);
    const calls = (body.match(/procOnRanged\(/g) || []).length - 1;   /* 정의부 1건 제외 */
    calls === 1 ? ok(`${who}: procOnRanged 호출 1곳 (화살 피격)`)
                : bad(`${who}: procOnRanged 호출이 ${calls}곳 — 원거리 피격 한 자리에서만 굴려야 한다`);
    body.includes(meleeGuard)
      ? ok(`${who}: 원거리(!isMelee) 에서만 굴린다`)
      : bad(`${who}: 원거리 피격 판별(!isMelee) 가드가 사라졌다 — 근접 피격에도 굴면 별개 축이 무너진다`);
    /* 별개 축 = 일반 «피격 시» 트리거를 «전부 굴린 뒤» 추가로 굴린다. thorns 보다 뒤에 있어야 한다. */
    const iT = body.indexOf('px.thorns&&'), iR = body.indexOf('procOnRanged(' , body.indexOf('function procOnRanged') + 20);
    (iT > 0 && iR > iT) ? ok(`${who}: 일반 «피격 시» 트리거를 전부 굴린 뒤에 원거리 축을 굴린다 (둘 다 발동)`)
                        : bad(`${who}: 원거리 축이 일반 피격 트리거보다 앞이다 — 주인 «둘 다 굴림» 과 순서가 어긋난다`);
    /* 회피에 성공하면 «맞은» 것이 아니므로 굴리면 안 된다 — 회피 분기가 procOnRanged 앞에서 return 한다 */
    const evIdx = body.search(/Math\.random\(\)\*100<effEvade\(p\)/);
    (evIdx > 0 && evIdx < iR) ? ok(`${who}: 회피 분기가 원거리 축보다 앞이라 «빗맞은» 화살은 굴리지 않는다`)
                              : bad(`${who}: 회피에 성공해도 원거리 피격 축이 굴러간다`);
    /* 반사 3단(일반 30%/전설 60%/신화 확정)이 전부 hitPlayer 안에 있는가 */
    for (const [key, label] of [['px.thornsS&&', '일반 🌿 30% 반사(주인 필수 예시)'], ['px.thorns&&', '전설 🌵 60% 반사'], ['px.thornsKing&&', '신화 🌵👑 확정 반사']])
      body.includes(key) ? ok(`${who}: ${label} 존재`) : bad(`${who}: ${label} 가 없다`);
    /* 고중첩 변형 — 최대 중첩 인자가 10 이어야 한다 (기존 5중첩 계열의 상위 변형) */
    /px\.aspdStack10&&pkk\(p,0\.25\*px\.aspdStack10\)\)\s*addBuff\(p,'aspd',0\.05,4,10/.test(body)
      ? ok(`${who}: 공속 고중첩 변형이 4초·+5%·10중첩이다 (주인 예시 원문)`)
      : bad(`${who}: 공속 10중첩 변형이 없거나 인자가 다르다`);
  }
  /* 중첩 상한 보너스는 addBuff 한 곳에서만 처리해야 한다 (호출부 수십 곳에 흩어지면 조용히 어긋난다) */
  for (const [src, who] of [[SIM, 'sim.js'], [HTML, 'index.html']]) {
    const body = src.replace(/\/\*[\s\S]*?\*\//g, '');
    /* 정의부(특전 ap) 를 뺀 «소비처» 가 정확히 addBuff 한 곳이어야 한다 */
    const consumers = body.split('\n')
      .filter(L => /px\.stackMaster/.test(L) && !/^\s*add\('/.test(L) && !/\{id:'/.test(L));
    (consumers.length === 1 && /function addBuff\(/.test(
        body.slice(Math.max(0, body.indexOf(consumers[0]) - 400), body.indexOf(consumers[0]) + 40)))
      ? ok(`${who}: 중첩 상한 보너스 소비처가 addBuff 한 곳뿐이다`)
      : bad(`${who}: px.stackMaster 소비처가 ${consumers.length}곳 — addBuff 한 곳에서만 처리해야 한다 (호출부에 흩어지면 조용히 어긋난다)`);
  }
  {
    const cv = s => (s.match(/STACK_BONUS\s*=\s*(\d+)/) || [])[1];
    const a = cv(SIM), b = cv(HTML);
    (a && a === b) ? ok(`STACK_BONUS = ${a} — 두 파일 일치`)
                   : bad(`STACK_BONUS 가 두 파일에서 다르다 — sim.js ${a} · index.html ${b}`);
  }
  /* 주인이 원문으로 지목한 필수 4종 (원거리 3 + 반사 1) */
  for (const id of ['r_rangeThorns', 'l_rangeBolt', 'm_rangeSpear', 'c_thornsS'])
    (SIM.includes(`'${id}'`) && HTML.includes(`'${id}'`))
      ? ok(`주인 필수 예시 ${id} — 두 파일에 존재`)
      : bad(`주인이 원문으로 지목한 필수 특전 ${id} 가 없다`);
}

/* ---------- ㉕ 횟수형 방어막 · 회피 즉사(사신의 낫) (주인 16:5X·17:2X · T48 3단계) ---------- */
/* 주인 원문: «공격 시 10% 확률로 적 공격 1회를 완전히 막아주는 방어막 1장. 5장 쌓였으면 5번 막음
   (피격 1회당 1장 소모, 그 타격 데미지 완전 무효 — 수치형 실드와 별개 축). 버프 아이콘에 남은 장수 뱃지
   + 막을 때 전용 이펙트» · «회피 시 10% 확률로 공격한 그 적 즉사. 사신의 낫 전용 연출 필수 —
   낫이 베어 죽이는 이펙트, 일반 처치 연기와 구별». */
console.log('\n[㉕ 횟수형 방어막 · 회피 즉사 (PLAN §3.0, T48 3단계)]');
{
  /* (1) 상수 3종이 두 파일에서 같아야 한다 */
  const cv = (src, name) => (src.match(new RegExp(name + '\\s*=\\s*([\\d.]+)')) || [])[1];
  for (const nm of ['WARD_CAP', 'WARD_CAP_KING', 'REAPER_CH']) {
    const a = cv(SIM, nm), b = cv(HTML, nm);
    (a && a === b) ? ok(`${nm} = ${a} — 두 파일 일치`)
                   : bad(`${nm} 이 두 파일에서 다르다 — sim.js ${a} · index.html ${b}`);
  }
  for (const [src, who] of [[SIM, 'sim.js'], [HTML, 'index.html']]) {
    const body = src.replace(/\/\*[\s\S]*?\*\//g, '');
    /* (2) 방어막 획득은 gainWard 한 곳으로만 — 직접 증가시키면 상한·신화 배수 규칙을 우회한다 */
    /function gainWard\(/.test(body) ? ok(`${who}: gainWard 존재`) : bad(`${who}: gainWard 가 없다`);
    const gains = (body.match(/gainWard\(p,/g) || []).length - 1;   /* 정의부 1건 제외 */
    gains === 4 ? ok(`${who}: 방어막 획득 트리거 4곳 (공격·치명타·피격·회피)`)
                : bad(`${who}: gainWard 호출이 ${gains}곳 — 공격·치명타·피격·회피 넷이어야 한다`);
    /* 장수를 올리는 자리는 gainWard 본문 하나뿐이어야 한다 (직접 올리면 상한·신화 배수를 우회한다) */
    const ups = body.split('\n').filter(L => /p\.ward\s*(\+\+|=\s*Math\.min)/.test(L));
    (ups.length === 1 && /Math\.min/.test(ups[0]))
      ? ok(`${who}: ward 를 올리는 자리가 gainWard 본문 한 곳뿐이다`)
      : bad(`${who}: ward 를 올리는 자리가 ${ups.length}곳 — gainWard 밖에서 올리면 상한·신화 배수를 우회한다`);
    /* (3) 상한이 신화 변형에서 두 배가 된다 */
    /wardCap\(p\)\{\s*return p\.px\.wardKing\?WARD_CAP_KING:WARD_CAP;\s*\}/.test(body.replace(/\s+/g, ' ').replace(/function /g, ''))
      ? ok(`${who}: 방어막 상한이 신화 변형에서 WARD_CAP_KING 으로 바뀐다`)
      : bad(`${who}: wardCap 이 신화 변형(m_wardKing)의 상한을 반영하지 않는다`);
    /* (4) 소모는 «피격 1회당 1장 · 데미지 완전 무효» — 실드·방어력·체력을 아예 안 거쳐야 한다 */
    /const warded=p\.ward>0;/.test(body.replace(/\s*=\s*/g, '=').replace(/;\s*/g, ';'))
      ? ok(`${who}: 방어막 소모 판정이 존재한다`)
      : bad(`${who}: 방어막 소모 판정(warded)이 없다`);
    /letd=warded\?0:/.test(body.replace(/\s+/g, ''))
      ? ok(`${who}: 막은 타격은 데미지가 0 이다 (완전 무효)`)
      : bad(`${who}: 막은 타격의 데미지가 완전 무효가 아니다 — 주인 «1회를 완전히 막는다» 위반`);
    /!warded&&p\.sh>0/.test(body.replace(/\s+/g, ''))
      ? ok(`${who}: 막은 타격은 수치형 실드를 건드리지 않는다 (별개 축)`)
      : bad(`${who}: 방어막으로 막았는데 수치형 실드가 깎인다 — 주인 «별개 축» 위반`);
    /* (5) 회피 즉사 — 회피 분기 안 · 보스 제외 · 확률 상수 사용 */
    /px\.reaper&&src&&src\.hp>0&&!src\.isBoss&&pkk\(p,REAPER_CH\)/.test(body.replace(/\s+/g, ''))
      ? ok(`${who}: 회피 즉사가 «보스 제외 · REAPER_CH» 조건이다`)
      : bad(`${who}: 회피 즉사 조건이 스펙과 다르다 (보스 제외·확률 상수)`);
    /* 회피 즉사·회피 방어막이 «회피 분기 안» 인지는 hitPlayer 본문 안에서만 따진다
       (특전 정의부에도 px.reaper 가 나오므로 파일 전체 인덱스로 재면 오판한다). */
    {
      const hp = body.slice(body.search(/function hitPlayer\(/));
      const iEv = hp.search(/effEvade\(p\)/), iRe = hp.indexOf('px.reaper'), iDmg = hp.search(/const warded=/);
      (iEv >= 0 && iRe > iEv && iDmg > iRe)
        ? ok(`${who}: 회피 즉사가 회피 분기 «안» 이다 (맞았을 때가 아니라 피했을 때)`)
        : bad(`${who}: 회피 즉사가 회피 분기 밖이다 — 회피가 아닌 상황에서도 즉사가 터진다`);
    }
  }
  /* (6) 게임 전용 연출 — 사신의 낫은 일반 처치 연기(poof)와 구별돼야 한다 (주인 필수 지시) */
  {
    const H = HTML.replace(/\/\*[\s\S]*?\*\//g, '');
    /function reapFx\(/.test(H) ? ok('index.html: 사신의 낫 전용 연출 reapFx 존재')
                                : bad('index.html: 사신의 낫 전용 연출이 없다 (주인 필수 지시)');
    const m = H.match(/function reapFx\(wx\)\{[\s\S]*?\n\}/);
    (m && !/poof\(/.test(m[0]))
      ? ok('index.html: reapFx 가 일반 처치 연기(poof)를 쓰지 않는다 — 구별된다')
      : bad('index.html: reapFx 가 일반 처치 연기와 같은 연출을 쓴다 (주인 «구별되게» 위반)');
    /G\.reaps/.test(H) ? ok('index.html: 낫 연출이 실제로 그려진다 (G.reaps)')
                       : bad('index.html: 낫 연출 상태(G.reaps)가 없다 — 텍스트만 뜨고 낫이 안 보인다');
    /function wardFx\(/.test(H) ? ok('index.html: 방어막 전용 이펙트 wardFx 존재 (주인 17:2X)')
                                : bad('index.html: 방어막을 막을 때의 전용 이펙트가 없다');
    /* 뱃지는 버프 줄 «맨 앞» 에 붙되(주인 17:2X) 시간제 버프와 구별되게 ward-ic 를 함께 단다 —
       만료로 사라지지 않는 «장수» 라, 검사(T3)·로직이 시간제 버프와 섞으면 안 된다. */
    /if\(p\.ward>0\)\{[\s\S]{0,300}?class="buff-ic ward-ic"[\s\S]{0,120}?\$\{p\.ward\}/.test(H)
      ? ok('index.html: 버프 아이콘 줄에 남은 장수 뱃지가 붙는다 (.ward-ic 로 시간제 버프와 구별)')
      : bad('index.html: 방어막 남은 장수 뱃지가 버프 아이콘 줄에 없다 (또는 .ward-ic 클래스가 빠졌다)');
  }
  /* (7) 주인이 원문으로 지목한 필수 2종 */
  for (const id of ['r_ward', 'm_reaper'])
    (SIM.includes(`'${id}'`) && HTML.includes(`'${id}'`))
      ? ok(`주인 필수 예시 ${id} — 두 파일에 존재`)
      : bad(`주인이 원문으로 지목한 필수 특전 ${id} 가 없다`);
}

/* ============================================================================
   ㉖ 대형 수치 표기 축약 (docs/ref 스크린샷 기준, T54)
   ----------------------------------------------------------------------------
   왜 게이트인가 — 되돌리기가 «한 줄» 이다. `fmt` 를 toLocaleString 콤마 표기로 되돌리면
   문법도 통과하고 T3 도 통과한다(T3 는 챕터 1 만 띄우니 골드가 3자다). 실제로 깨지는 건
   챕터 30~40 부터인데 그때는 아무 검사도 안 보고 있었다 — 그래서 «표기 규약» 자체를 못박는다.
   주인 스크린샷 4장이 규약의 근거다: 보유 골드 «10.54K»(1만 이상 축약) · 원화 «₩170,000»(콤마)
   · 상품 수량 «12000»(평문) · 전투력/스탯/젬 «6122» «1055» «543»(평문).
   ============================================================================ */
console.log('\n[㉖ 대형 수치 표기 — 1만 이상 축약 (docs/ref, T54)]');
{
  /* (1) 세 포맷터가 존재하고 서로 다른 일을 한다 */
  const vmFmt = (() => {
    const m = HTML.match(/const NUM_SUF[\s\S]*?const fmtQty = [^\n]*\n/);
    if (!m) return null;
    try { const sb = { exports: {} }; new (require('vm').Script)(m[0] + ';module.exports={fmt,fmtWon,fmtQty,NUM_SUF,FMT_MIN};')
      .runInNewContext(Object.assign(sb, { module: sb, require })); return sb.exports; } catch (e) { return null; }
  })();
  vmFmt ? ok('index.html: fmt/fmtWon/fmtQty 세 포맷터가 실행 가능하게 존재한다')
        : bad('index.html: 표기 포맷터(NUM_SUF … fmtQty)를 찾지 못했다 — T54 가 되돌려졌다');

  if (vmFmt) {
    const { fmt, fmtWon, fmtQty, FMT_MIN } = vmFmt;
    /* (2) 주인 스크린샷에서 읽은 표본 9개를 그대로 단언한다 (관측값 = 기대값) */
    const REF = [[10540, '10.54K', '메인로비 골드'], [11540, '11.54K', '캐릭터 장비·상점 골드'],
                 [6122, '6122', '전투력'], [1055, '1055', '체력'], [2258, '2258', '실드'],
                 [543, '543', '보유 젬'], [4801, '4801', '적 HP'], [7845, '7845', '적 HP']];
    for (const [n, e, why] of REF)
      fmt(n) === e ? ok(`스크린샷 표본 ${why}: fmt(${n}) = «${e}»`)
                   : bad(`스크린샷 표본 ${why}: fmt(${n}) = «${fmt(n)}» — 주인 스크린샷은 «${e}»`);

    /* (3) 경계 = 1만. 미만은 평문(콤마 금지), 이상은 축약 */
    FMT_MIN === 1e4 ? ok('축약 경계 = 1만 (스크린샷 ③④ 와 일치)') : bad(`축약 경계가 ${FMT_MIN} 다 — 1만이어야 한다`);
    !/,/.test(fmt(9999)) ? ok('1만 미만은 콤마 없는 평문 — fmt(9999) = «9999»')
                         : bad(`1만 미만에 콤마가 붙는다 — fmt(9999) = «${fmt(9999)}»`);
    /K$/.test(fmt(10000)) ? ok('1만은 축약된다 — fmt(10000) = «10.00K»')
                          : bad(`fmt(10000) = «${fmt(10000)}» — 축약되지 않았다`);

    /* (4) 폭이 유한하다 — 이 게이트의 본체. 챕터 300 골드·슬롯 Lv150 비용까지 9자 이내 */
    const WORST = [1.96e30, 2.445e84, -9.58e29, 999999, 1e300, 5.968e28];
    const wide = WORST.filter(n => fmt(n).length > 9);
    wide.length === 0 ? ok(`도달 가능한 최대 수치가 전부 9자 이내 — 챕터300 골드 «${fmt(1.96e30)}» · 슬롯Lv150 «${fmt(2.445e84)}»`)
                      : bad(`표기가 9자를 넘는 값이 있다: ${wide.map(n => `${n}→«${fmt(n)}»(${fmt(n).length}자)`).join(', ')}`);
    /* 되돌림 감지: 콤마 전체 표기면 챕터 300 골드가 41자가 된다 */
    fmt(1.79e30).length < 12 ? ok('챕터 300 골드가 콤마 전체 표기로 되돌아가지 않았다')
                             : bad(`챕터 300 골드가 ${fmt(1.79e30).length}자다 — 콤마 전체 표기로 되돌아갔다(구 버그 재발)`);
    /* 자릿수 이월: 999,999 는 «1000.00K» 가 아니라 «1.00M» */
    fmt(999999) === '1.00M' ? ok('자릿수 이월 처리 — fmt(999999) = «1.00M»')
                            : bad(`fmt(999999) = «${fmt(999999)}» — «1.00M» 이어야 한다`);

    /* (5) 원화·수량은 축약되면 안 된다 (스크린샷 ②③) */
    fmtWon(170000) === '170,000' ? ok('원화 가격은 콤마 전체 표기 — fmtWon(170000) = «170,000»')
                                 : bad(`fmtWon(170000) = «${fmtWon(170000)}» — 스크린샷은 «₩170,000»`);
    fmtQty(12000) === '12000' && fmtQty(25000) === '25000'
      ? ok('상품 수량은 콤마도 축약도 없다 — fmtQty(12000) = «12000»')
      : bad(`fmtQty(12000) = «${fmtQty(12000)}» — 스크린샷은 «12000»`);
  }

  /* (6) 호출부가 규약대로 갈려 있다 — 원화는 fmtWon, 다이아 수량은 fmtQty */
  /₩\$\{fmtWon\(p\.won\)\}/.test(HTML) ? ok('상점 원화 버튼이 fmtWon 을 쓴다')
                                       : bad('상점 원화 버튼이 fmtWon 을 쓰지 않는다 — «₩12.00K» 가 된다');
  !/₩\$\{fmt\(/.test(HTML) ? ok('원화 자리에 축약 fmt 가 남아 있지 않다')
                           : bad('원화 표시에 축약 fmt 가 쓰인 곳이 있다');
  /class="amt">💎 \$\{fmtQty\(p\.gem\)\}/.test(HTML) ? ok('다이아 상품 수량이 fmtQty 를 쓴다')
                                                    : bad('다이아 상품 수량이 fmtQty 를 쓰지 않는다 — «12.00K» 가 된다');

  /* (7) 로비 상단 줄이 축약 표기를 담도록 좁혀져 있다 (실측 근거: 구 CSS 는 챕터 40 에서 417px) */
  /\.lobby-top\{[^}]*gap:6px[^}]*padding:12px 10px 0/.test(HTML)
    ? ok('로비 상단 줄 여백이 좁혀져 있다 (gap 6 · padding 10)')
    : bad('로비 상단 줄 여백이 구 값으로 돌아갔다 — 골드 «8.26M» 에서 줄이 417px 가 된다');
  /\.lobby-top \.pill\{[\s\S]{0,200}?font-size:clamp\(11px, calc\(min\(100vw, 100vh \* 9 \/ 19\) \* \.036\), 14px\)[\s\S]{0,120}?min-width:0/.test(HTML)
    ? ok('로비 pill 글자가 프레임 폭에 연동된다 (316px 프레임 대응) + min-width:0 안전망')
    : bad('로비 pill 의 프레임 연동 글자 크기 또는 min-width:0 안전망이 사라졌다 — SE(프레임 316px)에서 글자가 잘린다');
  /#powerPill\{font-size:clamp\(12px,/.test(HTML)
    ? ok('전투력 글자도 프레임 폭에 연동된다')
    : bad('전투력 글자가 고정 크기로 돌아갔다 — 316px 프레임에서 줄이 밀린다');
  /#sndBtnL\{position:absolute/.test(HTML)
    ? ok('🔊 가 상단 줄 밖(스크린샷의 ☰ 자리)에 있다 — 줄 폭에서 빠진다')
    : bad('🔊 가 상단 줄 안으로 돌아갔다 — 360px 에서 글자가 잘린다');
  /#sndBtnL,#sndBtnG\{[^}]*flex:none/.test(HTML)
    ? ok('인게임 🔊(#sndBtnG) 공용 규칙은 그대로다')
    : bad('#sndBtnG 공용 규칙이 바뀌었다 — 인게임 버튼까지 함께 움직였다');

  /* (8) sim.js 오염 금지 — 표기는 게임 전용이라 sim 에 새면 T1 회차가 흔들린다 */
  !/NUM_SUF|fmtQty|fmtWon/.test(SIM) ? ok('sim.js 에 표기 포맷터가 새지 않았다 (밸런스 무관 유지)')
                                     : bad('sim.js 에 표기 포맷터가 들어갔다 — 표기는 게임 전용이어야 한다');
}

/* ============================================================================
   ㉗ 전투 플로팅 텍스트 표기 (T57)
   ----------------------------------------------------------------------------
   왜 ㉖ 과 따로 두는가 — ㉖ 은 «포맷터가 옳은가 + 로비/상점 호출부가 규약대로인가» 만 본다.
   T57 은 그 게이트가 초록인 채로 새어 나온 건이다: 캔버스에 뜨는 전투 팝업 42곳 중
   `addText('+'+drop+' 🪙', …)` 한 줄만 raw number 였다. 골드는 챕터당 ×1.22 로 자라
   챕터 150 에서 19자, 챕터 240 부터는 JS 지수표기(«+9.25e+22 🪙»)가 그대로 떴다.
   그래서 «한 줄» 이 아니라 «축» 을 못박는다 — addText 의 문구에 들어가는 모든 값은
   fmt 를 거치거나, 상한이 코드로 묶인 소수치 화이트리스트여야 한다.
   ============================================================================ */
console.log('\n[㉗ 전투 플로팅 텍스트 표기 — addText 는 fmt 를 거친다 (T57)]');
{
  /* addText( 의 첫 인자(문구)만 괄호 깊이를 세어 뽑는다 */
  function addTextArgs(src) {
    const out = [];
    const re = /addText\(/g; let m;
    while ((m = re.exec(src))) {
      if (/function\s+$/.test(src.slice(Math.max(0, m.index - 12), m.index))) continue;   /* 정의부 제외 */
      let i = m.index + m[0].length, d = 1, q = null, cur = '';
      for (; i < src.length && d > 0; i++) {
        const ch = src[i];
        if (q) { cur += ch; if (ch === q && src[i - 1] !== '\\') q = null; continue; }
        if (ch === "'" || ch === '"' || ch === '`') { q = ch; cur += ch; continue; }
        if ('([{'.includes(ch)) d++;
        if (')]}'.includes(ch)) { d--; if (d === 0) break; }
        if (ch === ',' && d === 1) break;          /* 첫 인자 끝 */
        cur += ch;
      }
      out.push({ arg: cur.trim(), at: src.slice(0, m.index).split('\n').length });
    }
    return out;
  }
  /* 상한이 코드로 묶여 있어 축약이 필요 없는 값들. 늘릴 때는 «왜 작은가» 를 여기 적을 것. */
  const SMALL = [
    ['p.missStk', 'MISS_STACK_CAP 으로 상한'], ['p.ward', 'WARD_CAP 으로 상한'],
    ['REST_EXP', '상수 26 (PLAN §2.4)'], ['p.level', '레벨은 두 자리'],
  ];
  const calls = addTextArgs(HTML);
  calls.length >= 30 ? ok(`index.html: addText 호출부 ${calls.length}곳을 파싱했다`)
                     : bad(`addText 호출부가 ${calls.length}곳뿐이다 — 파서가 깨졌거나 전투 연출이 사라졌다`);

  const raw = [];
  for (const c of calls) {
    /* ① fmt(...) 로 감싼 부분과 ② 문자열 리터럴을 지운다 — 남는 것이 «맨 값» 이다 */
    let s = c.arg;
    for (let n = 0; n < 6; n++) s = s.replace(/\bfmt\(([^()]*)\)/g, 'F');
    s = s.replace(/'(?:[^'\\]|\\.)*'/g, '').replace(/"(?:[^"\\]|\\.)*"/g, '')
         .replace(/`(?:[^`\\$]|\\.)*`/g, '');
    for (const [w] of SMALL) s = s.split(w).join('');
    /* 남은 식별자(연출용 이모지 변수 icon·문자열 결합 흔적 제외)를 찾는다 */
    const ids = (s.match(/[A-Za-z_$][A-Za-z0-9_$.]*/g) || []).filter(x => x !== 'icon' && x !== 'crit' && x !== 'F');
    if (ids.length) raw.push({ at: c.at, arg: c.arg.slice(0, 60), ids: [...new Set(ids)] });
  }
  raw.length === 0
    ? ok(`전투 팝업 ${calls.length}곳 전부가 fmt 또는 상한 있는 소수치만 쓴다 (화이트리스트 ${SMALL.length}종)`)
    : bad(`fmt 를 안 거친 전투 팝업 ${raw.length}곳: ` +
          raw.map(r => `index.html:${r.at} «${r.arg}» → ${r.ids.join(',')}`).join(' / '));

  /* T57 본체 — 골드 드랍 팝업. 위 전수 검사가 잡지만, 되돌림을 이름으로도 못박아 둔다. */
  /addText\('\+'\+fmt\(drop\)\+' 🪙'/.test(HTML)
    ? ok('골드 드랍 팝업이 fmt(drop) 을 쓴다 (T57)')
    : bad("골드 드랍 팝업이 `'+'+fmt(drop)+' 🪙'` 가 아니다 — 챕터 240+ 에서 «+9.25e+22 🪙» 로 뜬다");

  /* 실제 도달값으로 폭을 잰다 — 게임의 goldKill 식과 fmt 를 index.html 에서 그대로 읽어 실행한다 */
  const vmFmt2 = (() => {
    const m = HTML.match(/const NUM_SUF[\s\S]*?const fmtQty = [^\n]*\n/);
    if (!m) return null;
    try { const sb = { exports: {} }; new vm.Script(m[0] + ';module.exports={fmt};')
      .runInNewContext(Object.assign(sb, { module: sb, require })); return sb.exports.fmt; } catch (e) { return null; }
  })();
  const gk = (() => {
    const g = HTML.match(/goldKillBase:\s*([\d.]+),\s*goldKillPer:\s*([\d.]+)/);
    const gg = HTML.match(/goldGrowth:\s*([\d.]+)/);
    if (!g || !gg) return null;
    return c => (+g[1] + +g[2] * c) * Math.pow(+gg[1], c - 1) * 1.8;   /* rand 최대치 */
  })();
  if (vmFmt2 && gk) {
    const worst = [50, 100, 150, 200, 250, 300].map(c => ({ c, s: vmFmt2(Math.round(gk(c))) }));
    /* 9자 이내 + «도달 가능한» 구간은 접미사 사다리로 읽혀야 한다. 지수표기(«3.65e27»)는
       ㉖ 이 슬롯 Lv150(2.45e84) 용으로 남겨 둔 최후 폴백이고, 골드 드랍 최대치는 ~5e27 이라
       사다리(1e36·Dc)가 전부 덮는다 — 여기서 지수표기가 나오면 사다리가 잘린 것이다. */
    const over = worst.filter(w => w.s.length > 9 || /e\d/.test(w.s));
    over.length === 0
      ? ok(`도달 가능한 골드 드랍이 전부 9자 이내 + 접미사 표기 — 챕터150 «${worst[2].s}» · 챕터300 «${worst[5].s}»`)
      : bad(`골드 드랍 표기가 규약 밖이다: ${over.map(w => `챕터${w.c}→«${w.s}»`).join(', ')}` +
            ' (fmt 되돌림이거나, 골드 성장률이 올라 NUM_SUF 사다리를 넘었다 — 후자면 사다리를 늘릴 것)');
  } else bad('goldKill 식 또는 fmt 를 index.html 에서 읽지 못했다 — ㉗ 실측 단언 불가');

  /* 인게임 HUD 누적 골드도 같은 규약 (팝업만 고치고 HUD 를 놓치는 되돌림 방지) */
  /\$\('gGold'\)\.textContent=fmt\(G\.gold\)/.test(HTML)
    ? ok('인게임 HUD 누적 골드가 fmt 를 쓴다')
    : bad('인게임 HUD 누적 골드가 fmt 를 거치지 않는다');
}

/* ============================================================================
   ㉘ 절대배치 뱃지의 기준 상자 (T60)

   `.bang`(합성 «!» 알림 점)은 `position:absolute; top:-6px; right:-4px` 라
   **호스트 버튼이 positioned 여야만** 그 버튼 모서리에 붙는다. 호스트가 static 이면
   기준 상자가 조상(`#gear`)으로 밀려 화면 우상단(-6·-4)으로 날아가고,
   `#frame{overflow:hidden}` 에 잘린다 — 실제로 `#fuseBtn` 이 그랬다(T60 실측
   378..394 × -6..10, 우 4px·상 6px 잘림, 정작 버튼은 267..304 에 있었다).

   여기서는 되돌림과 «새 호스트» 둘 다 잡는다:
   ① `.bang` 이 여전히 absolute + 음수 오프셋인가 (전제)
   ② `class="bang"` 를 심는 호스트 집합이 등재분과 정확히 일치하는가
      — 새 버튼에 뱃지를 달면 여기서 빨개져 «그 버튼도 positioned 인지» 를 강제한다
   ③ 각 호스트를 positioned 로 만드는 CSS 규칙이 살아 있는가
   ④ `#frame` 이 여전히 잘라내는가 (잘림이 실제 피해라는 근거)
   실제 렌더 위치 단언은 T3 `tools/t3/gear.js` ⑤ 가 본다(정적으론 못 푸는 축).
   ============================================================================ */
{
  console.log('\n[㉘ 절대배치 뱃지의 기준 상자 — .bang 호스트는 positioned (T60)]');

  /* ① .bang 정의 */
  const bangRule = (HTML.match(/\.bang\s*\{[^}]*\}/) || [''])[0];
  /position:\s*absolute/.test(bangRule)
    ? ok('.bang 이 position:absolute 다 (호스트 positioned 전제가 성립)')
    : bad('.bang 이 absolute 가 아니다 — ㉘ 전제가 깨졌다. 규칙을 다시 세울 것');
  /top:\s*-\d/.test(bangRule) && /right:\s*-\d/.test(bangRule)
    ? ok('.bang 오프셋이 음수다 (top/right 모두) — 기준 상자가 틀리면 프레임 밖으로 나간다')
    : bad('.bang 의 음수 오프셋(top/right)이 사라졌다 — ㉘ 이 지키던 실패 모드가 바뀌었다');

  /* ② class="bang" 호스트 전수 수집 */
  const BANG_HOSTS = {                       /* 호스트 id → 그를 positioned 로 만드는 CSS 셀렉터 */
    fuseBtn: '#fuseBtn',                     /* 장비 탭 «🔨 합성» (T60 에서 position:relative 추가) */
    fgAuto: '.forge-actionbar button',       /* 합성 화면 «⚙️ 자동» (T2 5단계부터 relative) */
  };
  const found = new Set();
  for (const line of HTML.split('\n')) {
    if (!line.includes('class="bang"')) continue;
    const direct = line.match(/\$\('(\w+)'\)\.innerHTML\s*=/);
    if (direct) { found.add(direct[1]); continue; }
    const viaVar = line.match(/(\w+)\.innerHTML\s*=/);
    if (viaVar) {
      const re = new RegExp('(?:const|let|var)\\s+' + viaVar[1] + '\\s*=\\s*\\$\\(\'(\\w+)\'\\)');
      const m = HTML.match(re);
      if (m) { found.add(m[1]); continue; }
    }
    bad(`class="bang" 를 심는 호스트를 못 읽었다: «${line.trim().slice(0, 70)}» — ㉘ 파서를 고칠 것`);
  }
  const want = Object.keys(BANG_HOSTS).sort().join(',');
  const got = [...found].sort().join(',');
  got === want
    ? ok(`.bang 호스트 ${found.size}곳 전부 등재분과 일치 — ${got}`)
    : bad(`.bang 호스트 집합이 바뀌었다: 등재 «${want}» ≠ 실제 «${got}»` +
          ' — 새 호스트라면 그 버튼도 positioned 인지 확인하고 BANG_HOSTS 에 등재할 것');

  /* ③ 각 호스트가 positioned 인가 */
  for (const [id, sel] of Object.entries(BANG_HOSTS)) {
    const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rule = (HTML.match(new RegExp(esc + '\\s*\\{[^}]*\\}')) || [''])[0];
    if (!rule) { bad(`${id} 를 positioned 로 만들 CSS 규칙 «${sel}» 이 없다`); continue; }
    /position:\s*(relative|absolute|sticky|fixed)/.test(rule)
      ? ok(`${id} 호스트가 positioned 다 — «${sel}»`)
      : bad(`${id} 호스트 규칙 «${sel}» 에 position 이 없다 — .bang 이 조상으로 날아간다 (T60 재발)`);
  }

  /* ④ 프레임이 잘라낸다 = 기준 상자가 틀리면 실제 피해가 난다 */
  const frameRule = (HTML.match(/#frame\s*\{[^}]*\}/) || [''])[0];
  /overflow:\s*hidden/.test(frameRule)
    ? ok('#frame 이 overflow:hidden 이다 — 밖으로 나간 뱃지는 잘린다(피해 근거)')
    : bad('#frame 의 overflow:hidden 이 사라졌다 — ㉘ 의 피해 전제가 바뀌었다. 항목을 재작성할 것');
}

/* ============================================================================
   ㉙ 보스 처치 ~ 클리어 확정 사이의 700ms 창 (T61)
   ----------------------------------------------------------------------------
   sim.js 는 `while(!G.dead && !G.cleared && G.t<maxT)` 라 **보스가 죽는 순간 챕터가 끝난다.**
   index.html 만 클리어 화면을 `setTimeout(…,700)` 로 미루면서 그 0.7초 동안 전투를 더 굴렸다.
   실측 재현 3종(전부 정상 엔진 경로):
     ① 보스가 잡몹보다 먼저 죽으면(관통 창·번개 등 원거리 소환) 그 창에 플레이어가 맞아 죽어
        «💀 쓰러졌다» 가 뜬 뒤 0.7초에 «🏆 클리어» 가 그 위를 덮었다 — 죽었는데 클리어.
     ② 그 창에 포기하고 나가면 정당한 클리어가 해금·보너스 없이 증발한다.
     ③ 그 창에 다른 챕터를 시작하면 `if(G)` 가 새 전투를 통과시켜 **한 대도 안 때린 챕터가
        클리어 처리**됐다(챕터 40 을 처치 0 으로 클리어 + 보너스 280.04K 지급).
   그래서 «한 증상» 이 아니라 «창» 자체를 못박는다 — 네 자리 전부가 상시 감시 대상이다.
   ============================================================================ */
console.log('\n[㉙ 보스 처치~클리어 확정 700ms 창 (T61)]');
{
  /* ⓐ 정본 근거 — sim 은 보스 사망 즉시 루프를 빠져나간다 (이 규칙이 «옳은 동작» 의 기준이다) */
  /while\s*\(\s*!G\.dead\s*&&\s*!G\.cleared\s*&&/.test(SIM)
    ? ok('sim.js 전투 루프가 `!G.dead && !G.cleared` 로 보스 사망 즉시 끝난다 (정본 기준)')
    : bad('sim.js 전투 루프가 더 이상 G.cleared 로 끝나지 않는다 — T61 의 기준 자체가 사라졌다');

  /* ⓑ 게임의 update() 가 같은 규칙을 따른다 — 보스가 죽으면 그 틱부터 전투 정지 */
  const upGuard = /const\s+alive\s*=\s*aliveEnemies\(\);[\s\S]{0,900}?if\s*\(\s*!alive\.length\s*\|\|\s*G\.cleared\s*\)\s*return;/;
  upGuard.test(HTML)
    ? ok('index.html update() 조기 반환이 `!alive.length || G.cleared` 다 (보스 사망 = 전투 종료)')
    : bad('index.html update() 조기 반환에 G.cleared 가 없다 — 보스 사망 뒤 700ms 동안 전투가 계속 돈다');

  /* ⓒ 예약된 클리어 화면이 «그 전투» 에만 열린다 (종전 `if(G)` 되돌림 감시) */
  const cap = /const\s+g\s*=\s*G;\s*[\s\S]{0,120}?setTimeout\(\s*\(\)\s*=>\s*\{\s*if\s*\(\s*G\s*===\s*g\s*\)\s*openClear\(\);\s*\}\s*,\s*700\s*\)/;
  cap.test(HTML)
    ? ok('openClear 예약이 캡처한 전투(G===g)에서만 열린다')
    : bad('openClear 예약이 전역 G 를 그대로 본다 — 창 안에 시작한 다른 챕터가 공짜로 클리어된다');
  /\bif\s*\(\s*G\s*\)\s*openClear\(\)/.test(HTML)
    ? bad('종전 `if(G) openClear()` 가 되살아났다 (T61 되돌림)')
    : ok('종전 `if(G) openClear()` 가 남아 있지 않다');

  /* ⓓ 창 안에서는 일시정지·포기가 막힌다 (클리어 증발 · 공짜 클리어 양쪽의 입구) */
  /\$\('menuBtn'\)\.onclick\s*=\s*\(\)\s*=>\s*\{[\s\S]{0,400}?if\s*\(\s*!G\|\|G\.over\|\|G\.paused\|\|G\.cleared\s*\)\s*return;/.test(HTML)
    ? ok('일시정지 버튼 가드에 G.cleared 가 있다 (창 안 포기 불가)')
    : bad('일시정지 버튼 가드에 G.cleared 가 없다 — 창 안에 포기하면 정당한 클리어가 증발한다');

  /* ⓔ 사망 화면은 클리어 확정 뒤에는 뜨지 않는다 (다른 경로로 새어도 «죽었는데 클리어» 재발 금지) */
  /function\s+openDead\(\)\s*\{[\s\S]{0,400}?if\s*\(\s*G\.cleared\s*\)\s*return;/.test(HTML)
    ? ok('openDead 가 G.cleared 면 즉시 반환한다')
    : bad('openDead 에 G.cleared 가드가 없다 — 보스 처치 뒤 사망 화면이 뜰 수 있다');

  /* ⓕ 두 엔진이 같은 «클리어 확정» 지점을 쓴다 (보스 onKill 안) */
  (/if\(e\.isBoss\)G\.cleared=true;/.test(SIM) && /if\(e\.isBoss\)\{\s*\n?\s*G\.cleared=true;/.test(HTML))
    ? ok('두 엔진 모두 보스 onKill 에서 G.cleared 를 세운다')
    : bad('보스 onKill 의 G.cleared 확정 지점이 두 엔진에서 어긋난다');
}

/* ============================================================================
   ㉚ 합성 화면 재료 줄이 담는 열 안에 들어간다 (T62)

   `#fgMats` 는 «칸 3개 + 간격 2개» 라 **폭이 내용으로 고정**인데, 담는 `#forgeCol` 은
   `width:33%` 만 있어 하한이 없었다. `align-items:center` 라 넘치는 폭은 좌우로 반씩
   삐져나가고, 왼쪽 초과분이 `#forgeStage` 의 좌우 패딩(12px)을 넘기는 순간
   `#frame{overflow:hidden}` 이 첫 재료 칸을 잘라낸다 — 프레임이 좁을수록 더 잘린다.
   T62 실측(재료 3개 선택 상태, 수정 전): 360×640 프레임 303 = **12.9px 잘림**(첫 칸의 29%
   + 부위 태그 전체 소실) · 390×750(주소창) 프레임 355 = 4.4px · 360×800 = 3.6px.
   같은 크기만큼 오른쪽으로도 넘쳐 셋째 칸이 `#fgBanner` 를 최대 15px 침범했다.

   그래서 «지금 값이 맞나» 가 아니라 **«기하가 성립하나»** 를 못박는다 —
   칸 크기·간격·패딩 중 무엇을 바꿔도 부등식이 깨지면 빨개진다:
     ① 칸/간격이 변수 한 곳(`--fgCell`·`--fgGap`)에서 나온다 (세 값이 따로 놀 수 없다)
     ② `#forgeCol` 의 min-width ≥ 재료 줄 폭  (프레임 폭과 무관하게 열 안에 들어간다)
     ③ 스테이지 좌우 패딩 ≥ 부위 태그의 음수 오프셋 (태그도 프레임 밖으로 안 나간다)
     ④ `width:33%` 유지 (스크린샷 구도 — min-width 는 하한일 뿐 대체가 아니다)
     ⑤ `#frame` 이 여전히 잘라낸다 (잘림이 실제 피해라는 근거)
   실제 렌더 좌표 단언은 T3 `tools/t3/gear.js` ⑥ 이 본다(정적으론 못 푸는 축).
   ============================================================================ */
{
  console.log('\n[㉚ 합성 재료 줄이 열 안에 들어간다 — #fgMats ⊂ #forgeCol (T62)]');
  const rule = sel => {
    const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return (HTML.match(new RegExp(esc + '\\s*\\{[^}]*\\}')) || [''])[0];
  };
  const px = s => { const m = s && s.match(/(-?[\d.]+)px/); return m ? parseFloat(m[1]) : null; };

  /* ① 칸·간격이 변수 한 곳에서 나온다 */
  /* :root 는 여러 블록으로 나뉘어 있다(팔레트 · 화면별) — 전부 이어 붙여서 본다 */
  const root = (HTML.match(/:root\s*\{[^}]*\}/g) || []).join('\n');
  const CELL = px((root.match(/--fgCell:\s*[^;}]+/) || [''])[0]);
  const GAP = px((root.match(/--fgGap:\s*[^;}]+/) || [''])[0]);
  (CELL > 0 && GAP >= 0)
    ? ok(`:root 에 --fgCell=${CELL}px · --fgGap=${GAP}px 가 있다`)
    : bad(':root 에서 --fgCell/--fgGap 을 읽지 못했다 — 세 값이 따로 놀면 ㉚ 의 부등식이 무의미하다');

  const cellRule = rule('.fg-cell');
  (/width:\s*var\(--fgCell\)/.test(cellRule) && /height:\s*var\(--fgCell\)/.test(cellRule))
    ? ok('.fg-cell 의 width·height 가 var(--fgCell) 이다')
    : bad('.fg-cell 이 --fgCell 을 안 쓴다 — 칸을 키워도 열 하한이 따라오지 않는다 (T62 재발 경로)');
  /gap:\s*var\(--fgGap\)/.test(rule('#fgMats'))
    ? ok('#fgMats 의 gap 이 var(--fgGap) 이다')
    : bad('#fgMats 의 gap 이 --fgGap 을 안 쓴다 — 간격을 넓혀도 열 하한이 따라오지 않는다');

  /* ② min-width ≥ 재료 줄 폭 — calc 식을 변수값으로 실제 계산해 부등식을 확인한다 */
  const colRule = rule('#forgeCol');
  const rowW = CELL * 3 + GAP * 2;
  const mw = (colRule.match(/min-width:\s*([^;}]+)/) || [])[1];
  if (!mw) {
    bad('#forgeCol 에 min-width 가 없다 — 재료 줄(폭 고정)이 33% 열보다 넓어져 프레임에 잘린다 (T62)');
  } else {
    const expr = mw.replace(/calc\(/g, '(').replace(/var\(--fgCell\)/g, String(CELL))
      .replace(/var\(--fgGap\)/g, String(GAP)).replace(/px/g, '').trim();
    let minW = null;
    if (/^[\d\s.+\-*/()]+$/.test(expr)) { try { minW = Function(`"use strict";return (${expr})`)(); } catch (e) { minW = null; } }
    if (minW === null) bad(`#forgeCol 의 min-width «${mw.trim()}» 를 숫자로 못 풀었다 — ㉚ 파서를 고칠 것`);
    else if (minW + 1e-9 >= rowW) ok(`#forgeCol min-width ${minW}px ≥ 재료 줄 ${rowW}px (칸3+간격2) — 프레임 폭과 무관하게 열 안에 들어간다`);
    else bad(`#forgeCol min-width ${minW}px < 재료 줄 ${rowW}px — 좁은 폰에서 첫 칸이 프레임 밖으로 ${((rowW - minW) / 2).toFixed(1)}px 잘린다 (T62 재발)`);
  }

  /* ③ 스테이지 패딩 ≥ 부위 태그의 음수 오프셋 (태그는 칸보다 왼쪽에서 시작한다) */
  const padL = px((rule('#forgeStage').match(/padding:\s*[^;}]+/) || [''])[0].replace(/padding:\s*[\d.]+px\s*/, ''));
  const tagOff = Math.abs(px((rule('.inv-cell .ptag,.fg-cell .ptag').match(/left:\s*-[\d.]+px/) || [''])[0]) || 0);
  (padL !== null && tagOff > 0 && padL >= tagOff)
    ? ok(`#forgeStage 좌우 패딩 ${padL}px ≥ 부위 태그 오프셋 ${tagOff}px — 태그도 프레임 안에 있다`)
    : bad(`부위 태그가 프레임 밖으로 나간다 — 패딩 ${padL} < 태그 오프셋 ${tagOff} (T62 실측: 390×844 에서 1.6px 잘렸다)`);

  /* ④ 스크린샷 구도(33%)는 유지 — min-width 는 하한일 뿐 대체가 아니다 */
  /width:\s*33%/.test(colRule)
    ? ok('#forgeCol 이 width:33% 를 유지한다 (docs/ref 구도)')
    : bad('#forgeCol 의 width:33% 가 사라졌다 — min-width 로 갈아치우면 넓은 화면 구도가 스크린샷과 어긋난다');

  /* ⑤ 프레임이 잘라낸다 = 넘침이 실제 피해다 */
  /overflow:\s*hidden/.test(rule('#frame'))
    ? ok('#frame 이 overflow:hidden 이다 — 열 밖으로 나간 칸은 잘린다(피해 근거)')
    : bad('#frame 의 overflow:hidden 이 사라졌다 — ㉚ 의 피해 전제가 바뀌었다. 항목을 재작성할 것');
}

/* ---------- 결과 ---------- */
console.log(`\n통과 ${pass} · 불합격 ${fail}`);
console.log(fail === 0 ? '→ 통과' : '→ 불합격');
process.exit(fail === 0 ? 0 : 1);
