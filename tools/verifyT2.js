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

/* ⚑ P1(T83) — mkPerks 가 «한 줄에 여러 add() · 대부분 ap 생략(기본형 p=>p.px[id]=1)» 으로 바뀌었다.
   고유 플래그(u)는 폐지됐다 — 주인 확정 «획득 중복 금지» 로 **전 특전이 고유**다. */
/* ⚑ T96 — mkPerks() 가 `add(id, 등급, ap)` 호출 나열에서 **리터럴 배열**로 바뀌었다(등급 폐지).
   id 와 ap 본문만 뽑아 index.html 과 대조한다 — 순서·수치·표시 텍스트의 3자 대조는 verifyPerkOrder 몫이다. */
function simPerks() {
  const body = SIM.slice(SIM.indexOf('function mkPerks()'), SIM.indexOf('const PERKS=mkPerks()'));
  const out = [];
  for (const line of body.split('\n')) {
    const m = line.match(/\{id:'([^']+)',[\s\S]*?ap:\s*(.+?),?\s*\},?\s*$/);
    if (m) out.push({ id: m[1], ap: m[2].trim().replace(/,$/, '') });
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
      u: true,   /* ⚑ 주인 확정 «획득 중복 금지» — 전 특전이 고유다 (u 플래그 폐지) */
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

/* ---------- ② 특전 전수 대조 (T48 로 102 → 132 → T77 로 128종) ---------- */
/* ⚑ 개수는 더 이상 고정이 아니다 — 주인 확정(16:0X): «등급당 30~40 까지 허용, 단 등급 간 개수는 골고루».
   그래서 «102 인가» 가 아니라 «두 파일이 같은가 + 등급별 편차 ≤ PERK_RAR_GAP» 을 본다.
   T48 이 각 등급 33종(총 132)까지 채웠고, T77(주인 확정 «전투 무관 특전 4종 삭제»)이
   일반 2종(c_gold30·c_walk20)·신화 2종(m_gold2·m_sage)을 빼 31/33/33/31 = 128종, 편차 2 가 됐다. */
const PERK_TOTAL = 99;   /* ⚑⚑⚑ T121 3차 — 주인 확정 «풀 99종(일반 39 · 희귀 32 · 전설 28)». 77종(16:0X~17:4X)에서 22종이 더 붙었다(17:5X ~ 18:4X) */
console.log(`\n[② 특전 ${PERK_TOTAL}종 — id·순서·ap 본문 두 엔진 대조]`);
const S = simPerks(), H = htmlPerks();
if (!H) { bad('index.html 에서 const PERKS=[...] 를 찾지 못했다'); }
else {
  if (S.length === PERK_TOTAL) ok(`sim.js mkPerks() = ${S.length}종`);
  else bad(`sim.js mkPerks() 가 ${S.length}종 (${PERK_TOTAL} 이어야 함 — 주인 확정표를 늘렸으면 verifyPerkOrder 의 WANT 도 같이 고칠 것)`);
  if (H.length === S.length) ok(`index.html PERKS = ${H.length}종`);
  else bad(`index.html PERKS = ${H.length}종 (sim ${S.length}종과 다름)`);

  /* ⚑ T96 — 등급별 개수·편차 검사는 등급이 폐지되어 대상이 사라졌다. 대신 «순서» 를 본다:
     두 엔진의 배열 순서가 곧 획득 순서이므로 순서가 어긋나면 게임과 시뮬이 다른 것을 잰다. */
  (S.map(x => x.id).join() === H.map(x => x.id).join())
    ? ok(`획득 순서가 두 엔진에서 같다 (${S.map(x => x.id).join('>')})`)
    : bad(`획득 순서가 다르다 — sim ${S.map(x => x.id).join('>')} / index ${H.map(x => x.id).join('>')}`);

  const hm = new Map(H.map(x => [x.id, x]));
  let miss = [], rdiff = [], udiff = [], apdiff = [];
  for (const s of S) {
    const h = hm.get(s.id);
    if (!h) { miss.push(s.id); continue; }
    if (norm(h.ap) !== norm(s.ap)) apdiff.push(`${s.id}\n      sim  : ${s.ap}\n      index: ${h.ap}`);
  }
  const extra = H.filter(x => !S.find(s => s.id === x.id)).map(x => x.id);
  miss.length ? bad(`index.html 에 없는 특전 ${miss.length}종: ${miss.join(' ')}`) : ok('누락 특전 0');
  extra.length ? bad(`sim.js 에 없는 특전 ${extra.length}종: ${extra.join(' ')}`) : ok('잉여 특전 0');
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
  ['effDef 상한', /const effDef=p=>Math\.min\(80,p\.def\+bsum\(p,'def'\)\);/, /function effDef\(p\)\{ return Math\.min\(80,\s*p\.def\+bsum\(p,'def'\)\); \}/],
  ['effEvade 상한·최후의 저항', /lastStand&&p\.hp<=p\.maxHp\*0\.10\)e\+=40;[\s\S]{0,400}?Math\.min\(90,e\)/, /lastStand&&p\.hp<=p\.maxHp\*0\.10\)\s*e\+=40;[\s\S]{0,400}?Math\.min\(90,e\)/],
  ['effDmg 격노 배수', /rage&&p\.sh<=0\)m?\s*\*=\s*1\.5/, /rage&&p\.sh<=0\)\s*m\*=1\.5/],
  ['처형(execute) 배수', /execute&&e\.hp<=e\.maxHp\*0\.5\)d\*=2\.2/, /execute&&e\.hp<=e\.maxHp\*0\.5\)\s*d\*=2\.2/],
  ['배후(backDmg) 배수 — 장비 옵션', /if\(front&&e!==front\)d\*=3\.2;/, /if\(front&&e!==front\) d\*=3\.2;/],
  ['처형자(execKill) 임계', /execKill&&!e\.isBoss&&e\.hp>0&&e\.hp<=e\.maxHp\*0\.25/, /execKill&&!e\.isBoss&&e\.hp>0&&e\.hp<=e\.maxHp\*0\.25/],
  ['수호의 결정 감쇄', /guardCrystal&&p\.sh>0\)d\*=([\d.]+)/, v => new RegExp(`guardCrystal&&p\\.sh>0\\)\\s*d\\*=${numRe(v)}`)],
  ['부활 회복률', /revive--;p\.hp=p\.maxHp\*([\d.]+);p\.sh=p\.maxSh\*([\d.]+)/, (a,b) => new RegExp(`revive--;[\\s\\S]{0,40}p\\.hp=p\\.maxHp\\*${numRe(a)};\\s*p\\.sh=p\\.maxSh\\*${numRe(b)}`)],
  ['가시(thorns) 확률·계수', /px\.thorns&&pkk\(p,0\.60\*px\.thorns\)\)reflect\(G?,?\s*src,dmg\*1\.5/, /px\.thorns&&pkk\(p,0\.60\*px\.thorns\)\)\s*reflect\(src,dmg\*1\.5/],
  /* ⚑ P3 R02: 계수를 박지 않고 sim 에서 뽑아 html 과 대조하는 «값 추출형» 으로 바꿨다 —
     전설 반사 계수는 P3 ②단계가 움직이는 튜닝 노브라 200% 를 박으면 정당한 회차마다 빨개진다.
     이 항목이 지킬 것은 «두 엔진이 같은 계수를 쓴다 + 확률 없이 무조건» 이다. */
  ['반격 피해 계수', /effDmg\(p\)\*0\.7\*\(1\+px\.counterX\)/, /effDmg\(p\)\*0\.7\*\(1\+px\.counterX\)/],
  ['추가타(extraHit) 확률·배수', /extraHit&&pkk\(p,0\.75\*px\.extraHit\)&&e\.hp>0\)dealDmg\(G,e,2\.3\)/, /extraHit&&pkk\(p,0\.75\*px\.extraHit\)&&e\.hp>0\)\s*dealPlayerDamage\(e,2\.3/],
  ['분신(clone) 계수', /clone&&e\.hp>0\)dealDmg\(G,e,([\d.]+)\)/, v => new RegExp(`clone&&e\\.hp>0\\)\\s*dealPlayerDamage\\(e,${numRe(v)}`)],
  ['초과회복→실드 계수', /overheal\)\s*repair\(p,over\*7\)/, /overheal\)\s*repair\(p,over\*7\)/],
  ['뇌신 주기', /autoBoltT=([\d.]+)/, v => new RegExp(`autoBoltT=${numRe(v)}`)],
  /* ⚑ T1 회귀2 R02 신설 — 충격파(m_stunKill) 스턴 사거리. 특전 문면에 숫자가 없는 «문면 무변» 노브라
     문자열 대조(②)로는 잡히지 않는다. 상수 값이 두 파일에서 같은지 + 두 엔진이 리터럴이 아니라
     그 상수를 실제로 쓰는지를 함께 본다(한쪽만 540 으로 되돌리면 빨개진다). */
  /* ⚑ P1(T83) — 신화 폐지로 «충격파(m_stunKill)»·«👼 전설이상»·4단 굴림이 사라졌다. 3단 배열 대조로 교체. */
  /* ⚑ T96 — 등급 확률 배열·등급 굴림은 폐지됐다(그 부재는 verifyPerkOrder ③ 이 감시).
     대신 «순서 지급 동사» 가 두 엔진에서 같은 자리에 있는지를 여기서 본다. */
  /* ⚑⚑⚑ T117 — 3택이 돌아오면서 «지급 동사» 가 둘로 나뉘었다: 제시(offerPerks) + 확정(pickPerk).
     index.html 은 유저가 고르므로 sim.js 의 `grantNextPerk`(정책 선택까지 하는 시뮬 전용 동사)를 안 쓴다 —
     두 엔진이 공유해야 하는 것은 «3장을 어떻게 뽑는가»(offerPerks)와 «고른 것을 어떻게 붙이는가»(pickPerk)다. */
  ['제시 동사(offerPerks)', /function offerPerks\(taken,noble\)\{/, /function offerPerks\(taken,noble\)\{/],
  ['확정 동사(pickPerk)', /function pickPerk\(G,perk\)\{/, /function pickPerk\(perk\)\{/],
  ['제시 장수 상수(PERK_OFFER=3)', /const PERK_OFFER=3;/, /const PERK_OFFER=3;/],
  /* ⚑⚑⚑ T119 — 등급 굴림 확률·등급 이름이 두 엔진에서 같은 배열인가 (값 대조는 verifyPerkOrder ① 가 한다) */
  ['등급 굴림 확률(PERK_GRADE_RATE)', /const PERK_GRADE_RATE=\[60,25,15\];/, /const PERK_GRADE_RATE=\[60,25,15\];/],
  /* ⚑ T121 (주인 확정 16:2X·16:3X) — 기존 4종이 내려가 상수 줄이 통째로 바뀌었다(1.20/10/10 → 1.15/8/8). */
  ['특전 소환 확률 상수', /const PERK_ATK_M=1\.15, PERK_DEF_M=1\.08/, /const PERK_ATK_M=1\.15, PERK_DEF_M=1\.08/],
  ['경험치 요구식', /expNeed:lv=>5\*lv\+1/, /expNeed=lv=>5\*lv\+1/],   /* ⚑⚑⚑ T100 — 4+3*lv → 5*lv+1 */
];
/* ⚑ T1 회귀2 R02 — 세 번째 칸이 «함수» 면 sim.js 에서 뽑은 값을 넣어 index.html 쪽 정규식을 만든다.
   종전에는 양쪽에 같은 «숫자» 를 박아 둬서 밸런스 튜닝을 할 때마다 게이트가 빨개졌고(이번 회차 4건),
   그때마다 게이트를 손대면 «게이트가 엔진을 따라가는» 꼴이라 대조 능력이 떨어진다.
   값 추출형은 «두 파일의 값이 같은가» 만 보므로 튜닝과 무관하고, 한쪽만 고치면 여전히 빨개진다. */
const numRe = v => String(v).replace(/\./g, '\\.');
for (const [name, reSim, reHtml] of FORMULAS) {
  const m = SIM.match(reSim);
  const a = !!m;
  const rh = typeof reHtml === 'function' ? (a ? reHtml(...m.slice(1)) : null) : reHtml;
  const b = rh ? rh.test(HTML) : false;
  if (a && b) ok(name);
  else if (!a && !b) bad(`${name} — 양쪽 다 파싱 실패 (코드 모양이 바뀌었다 — 게이트를 갱신할 것)`);
  else bad(`${name} — ${a ? 'index.html' : 'sim.js'} 쪽에서 찾지 못했다`);
}

/* ---------- ⑤ 주인 지시 이행 (index.html 관측 가능 동작) ---------- */
console.log('\n[⑤ 주인 지시 이행 — 배포 빌드에서 관측되는 동작]');
const DIRECTIVES = [
  ['웨이브 전멸 실드 무료충전 폐지 (06:5X·08:5X)', () => !/wave\.done=true;[\s\S]{0,120}p\.sh=p\.maxSh/.test(HTML)],
  /* ⚑⚑ T96 — «선택지 등급 통일»·«선택지 3개 고정» 은 선택창 자체가 폐지되어 대상이 사라졌다.
     그 자리에 새 체제의 관측 가능 동작 3건을 넣는다. */
  /* ⚑⚑⚑ T117 (주인 확정 2026-09-04 12:3X) — 레벨업이 «3택 1» 로 돌아왔다.
     되살아난 것은 선택창뿐이고 등급·무료 새로고침·전지의 눈은 그대로 폐지다(그 부재는 아래 두 줄이 함께 잠근다). */
  ['⚑ T117·T119 레벨업 = 3택 선택창 + 등급 굴림 (새로고침은 그대로 폐지)', () => {
    const m = HTML.match(/function openLevelUp\(\)\{[\s\S]*?\n\}/);
    return !!m && /offerPerks\(G\.perksTaken,!!G\.player\.px\.p_nobleEye\)/.test(m[0])
      && /perkCardHTML\(p,i,'pick'\)/.test(m[0])
      && /pickPerk\(p\)/.test(m[0]) && !/rollPerks|perkPool|refreshLeft|rollRarity/.test(m[0]);
  }],
  ['⚑ T117 줄 특전이 없으면 레벨업 팝업이 안 뜬다', () => {
    const m = HTML.match(/function openLevelUp\(\)\{[\s\S]*?\n\}/);
    return !!m && /if\(!hasPerkLeft\(\)\)\{[^}]*afterPerk\(\);\s*return;\s*\}/.test(m[0]);
  }],
  ['⚑ 남은 풀은 «진짜 특전 수» 로 센다 (천사의 축복이 한 자리를 먹지 않는다)',
    () => /function perkOrderN\(\)\{[\s\S]{0,160}PERKS\.includes\(q\)/.test(HTML)
       && /function hasPerkLeft\(\)\{\s*return perkOrderN\(\)<PERK_PICKS\s*&&\s*perksLeftN\(\)>0;\s*\}/.test(HTML)],
  ['챕터 종료 보스 킬 = 특전 스킵 (06:3X)', () => /G\.cleared=true/.test(HTML) && /lev>0\s*&&\s*!G\.over\s*&&\s*!G\.cleared/.test(HTML)],
  ['레벨업 회복·최대치 보정 없음 (06:4X)', () => {
    const m = HTML.match(/function gainExp\(n\)\{[\s\S]*?\n\}/);
    return !!m && !/maxHp|maxSh|p\.hp=|p\.sh=/.test(m[0]);
  }],
  /* ⚑⚑⚑ T104 — 1번 특전이 «생명 흡수» → «회피 시 회복» 으로 바뀌었다.
     특전에서 흡혈(steal) 축이 완전히 사라졌으므로 어느 특전도 `p.steal +=` 를 안 한다(엔진의 steal 스탯은 남는다 —
     장비 옵션이 필요하면 쓸 수 있다). 대신 두 엔진에 «회피 시 회복» 이 정확히 한 번 들어가 있는지 본다. */
  ['⚑ T104 — 특전이 p.steal 을 안 건드린다 (특전에서 흡혈 축 폐기)',
    () => (HTML.match(/p\.steal\s*\+=/g) || []).length === 0 && (SIM.match(/p\.steal\s*\+=/g) || []).length === 0],
  ['⚑ T104 — 회피 시 회복(p_evadeHeal)이 두 엔진에 하나씩 있고 회피 분기에서 heal(...,true) 로 처리된다',
    () => {
      const re = /if\(px\.p_evadeHeal\s*&&\s*pkk\(p\s*,\s*(?:PERK_EVHEAL_CH|0?\.10)\s*\)\)[\s\S]{0,80}?heal\(p\s*,\s*p\.maxHp\s*\*\s*(?:PERK_EVHEAL_F|0?\.06)\s*,\s*true\s*\)/;
      return re.test(SIM) && re.test(HTML);
    }],
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
  /* ⚑ T96 — ap 본문이 엔진 상수(PERK_ATK_M …)를 쓰므로 sim.js 에서 그 값을 읽어 샌드박스에 깔아 준다.
     상수를 리터럴로 되돌리면 여기서 잡히지 않지만 verifyPerkOrder ① 이 확정값과 대조한다. */
  const sandbox = {
    Math, console,
    heal: (p, a) => { p.hp = Math.min(p.maxHp, p.hp + a); },
    G: { perkChances: 3, overBoltCd: 0 },
  };
  for (const m of SIM.matchAll(/\b(PERK_[A-Z_]+)=([0-9.]+)/g)) sandbox[m[1]] = Number(m[2]);
  /* ⚑ T119 — «같은 이름·다른 등급» 계열의 확률 최댓값 갱신 도우미. 두 엔진 다 mkPerks/PERKS 바로 위에
     같은 본문으로 두므로 ap 본문 대조가 성립한다. 여기서도 같은 동사를 깔아야 ap 를 실행할 수 있다. */
  sandbox.kmax = (p, k, v) => { p.px[k] = Math.max(p.px[k] || 0, v); };
  vm.createContext(sandbox);
  let thrown = [];
  const mkP = () => {
    const px = {};
    for (const k of pxKeys(SIM)) px[k] = 0;
    /* ⚑ T119 — 합산 키 5개(p_kill* · p_thorns)와 repairAmp 를 함께 깔아 둔다 (sim.js basePx 와 같은 축) */
    for (const k of ['p_killSpear', 'p_killBolt', 'p_killArrow', 'p_killAxe', 'p_thorns']) px[k] = 0;
    return { maxHp: 300, hp: 300, maxSh: 240, sh: 240, dmg: 30, aspd: 1, critR: 5, critF: 200,
      def: 5, counter: 10, evade: 8, steal: 0, killHeal: 0, misfire: 0, goldMul: 1, walkMul: 1,
      healAmp: 0, repairAmp: 0, px, G: sandbox.G };
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
                'wall3Hp','wall3Dmg','wall4Hp','wall4Dmg','wall4At','bossHp','bossDmg','maxChapter',
                'pAtk0','pHp0','pSh0','pAspd0','pCrit0',
                'goldKillBase','goldKillPer','goldClearPer','goldGrowth','expKill','expBoss'];
  const missing = MUST.filter(k => !(k in TH));
  const diff = MUST.filter(k => k in TH && TS[k] !== TH[k]).map(k => `${k} sim=${TS[k]} html=${TH[k]}`);
  missing.length ? bad(`index.html TUNE 누락 ${missing.length}개: ${missing.join(' ')}`) : ok(`필수 TUNE 상수 ${MUST.length}개 전부 존재`);
  diff.length ? bad(`TUNE 값 불일치 ${diff.length}건: ${diff.join(' / ')}`) : ok(`TUNE 값 ${MUST.length}개 전수 일치 (보스 ×${TS.bossHp}·×${TS.bossDmg}, 챕터 ${TS.maxChapter})`);
  if (TS.bossHp === 8 && TS.bossDmg === 1.8) ok('보스 = HP ×8 · DMG ×1.8 (주인 확정 상수, 07:3X)');
  else bad(`보스 배수가 주인 확정값이 아니다 — HP ×${TS.bossHp} · DMG ×${TS.bossDmg} (확정: ×8 · ×1.8)`);
  /* ⚑⚑⚑ T103 — 주인 정정으로 600 → **420** (사다리 8점 맨 아랫줄 «신화9강+슬롯100 = 420»).
     최종 벽 위치도 같은 값이다. ⚠ 배수(`wall4Hp/Dmg`)는 T103 재적합에서 **1.0(꺼짐)** 이 됐다 —
     380→420 을 «150→380 률을 그대로 이어» 채우면 잔차가 1 아래라, 주인 지시 ④ 의
     «잔차가 1 아래면 벽을 끄고 률만으로 잇는다» 규정을 그대로 이행한 결과다. 아래 ⑧이 그 상태를 못박는다. */
  if (TS.maxChapter === 420) ok('챕터 상한 420 (PLAN §2.4 · ⚑ T103 주인 정정)'); else bad(`챕터 상한이 ${TS.maxChapter} (확정: 420)`);
  if (TS.wall4At === 420) ok('최종 벽 위치 = 챕터 420 (⚑ T103 — 주인 «사다리 8점 · 신화9강+슬롯100 = 챕터 420»)');
  else bad(`최종 벽 위치가 ${TS.wall4At} (확정: 420)`);
  if (TS.wall4Hp === 1 && TS.wall4Dmg === 1)
    ok('최종 벽 배수 = ×1.0 (T103 재적합 — 잔차 <1 이라 주인 지시 ④대로 껐다. 되살리려면 380→420 구간률을 함께 내릴 것)');
  else bad(`최종 벽 배수가 ×${TS.wall4Hp}/×${TS.wall4Dmg} — T103 재적합값은 ×1.0/×1.0 이다`);
  /* 최종 벽이 마지막 챕터 «위» 로 새면 벽이 영영 안 걸린다 — 위치와 상한을 함께 본다 */
  if (TS.wall4At <= TS.maxChapter) ok(`최종 벽이 콘텐츠 안에 있다 (${TS.wall4At} ≤ ${TS.maxChapter})`);
  else bad(`최종 벽 ${TS.wall4At} 이 챕터 상한 ${TS.maxChapter} 을 넘어 영영 안 걸린다`);
  /* ⚑ T102 — index.html 세이브 정규화의 상한 리터럴 ↔ TUNE.maxChapter.
     그 줄은 TUNE 선언보다 «위» 라 TDZ 때문에 상수를 못 쓰고 리터럴이 하나 남는다. 두 값이 갈라지면
     로비 해금 상한과 전투 곡선이 어긋난다 — 정적으로라도 반드시 대조한다. */
  {
    const m = HTML.match(/save\.maxChapter\s*=\s*Math\.max\(1,\s*Math\.min\(save\.maxChapter\|0\|\|1,\s*(\d+)\)\)/);
    if (!m) bad('index.html 세이브 정규화의 챕터 상한 리터럴을 못 찾았다 — 게이트를 갱신할 것');
    else if (Number(m[1]) === TH.maxChapter) ok(`세이브 정규화 상한 ${m[1]} = TUNE.maxChapter (⚑ T104)`);
    else bad(`세이브 정규화 상한 ${m[1]} ≠ TUNE.maxChapter ${TH.maxChapter} — 로비 해금과 전투 곡선이 갈라진다`);
  }
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
  /* ⚑ T107 — LAYOUT_MAXENEMY 와 chapterLayout 사이에 `chapterEnemyCount`·`chapterWaveSizes` 가 생겼다.
     «첫 들여쓰기 없는 `}`» 으로 자르면 그 함수에서 끊긴다 — chapterLayout 을 닫는 `}` 까지 떠 온다. */
  const f = lines.findIndex((l, i) => i > a && l.startsWith('function chapterLayout'));
  const b = lines.findIndex((l, i) => i > f && l === '}');
  if (!mul || a < 0 || f < 0 || b < 0) return null;
  const code = mul + '\nconst clamp=(v,x,y)=>Math.max(x,Math.min(y,v));\n' + lines.slice(a, b + 1).join('\n') + '\n;chapterLayout';
  try { return vm.runInNewContext(code, { Math }); } catch (e) { return null; }
}
const LS = loadLayout(SIM), LH = loadLayout(HTML);
if (!LS || !LH) bad(`chapterLayout 추출 실패 (${!LS ? 'sim.js' : ''}${!LS && !LH ? ' / ' : ''}${!LH ? 'index.html' : ''}) — 게이트를 갱신할 것`);
else {
  const key = L => L.map(n => n.t === 'wave' ? 'w' + n.size : n.t[0]).join('>');
  let mism = [], viol = [], maxE = 0, minE = 1e9;
  for (let c = 1; c <= 420; c++) {   /* ⚑ T103 — 챕터 상한 600 → 420 */
    const A = LS(c), B = LH(c);
    if (key(A) !== key(B)) { if (mism.length < 3) mism.push(`ch${c}: sim=${key(A)} html=${key(B)}`); else mism.push(''); }
    const cnt = t => A.filter(n => n.t === t).length;
    const tot = A.filter(n => n.t === 'wave').reduce((s, n) => s + n.size, 0);
    minE = Math.min(minE, tot); maxE = Math.max(maxE, tot);
    const why = [];
    /* ⚑ T107 — 챕터별 적 수 곡선(보스 포함 N(c) = c≤5?17:min(50,12+c))이 들어와 총수가 챕터마다 다르다.
       여기서는 상한만 본다(공식 전수 대조는 전용 게이트 verifyChapterFixed 가 한다). */
    if (tot + 1 > 50) why.push(`적 ${tot + 1}마리>50`);
    if (cnt('devil') !== 1) why.push(`악마 ${cnt('devil')}개≠1`);
    if (cnt('angel') !== 1) why.push(`천사 ${cnt('angel')}개≠1`);
    if (cnt('rest') < 1 || cnt('rest') > 4) why.push(`쉼터 ${cnt('rest')}개(1~4 밖)`);
    if (cnt('boss') !== 1 || A[A.length - 1].t !== 'boss') why.push('보스 배치 이상');
    if (why.length && viol.length < 3) viol.push(`ch${c}: ${why.join(', ')}`);
    else if (why.length) viol.push('');
  }
  const nm = mism.filter(Boolean);
  mism.length ? bad(`두 파일 레이아웃 불일치 ${mism.length}챕터: ${nm.join(' / ')}`) : ok('챕터 1~420 레이아웃 전수 동일 (sim.js ↔ index.html · ⚑ T103)');
  const nv = viol.filter(Boolean);
  viol.length ? bad(`주인 확정 제약 위반 ${viol.length}챕터: ${nv.join(' / ')}`) : ok(`제약 4종 전수 만족 — 적 총수(보스 포함) ${minE + 1}~${maxE + 1}(≤50 · ⚑ T107 곡선) · 쉼터 1~4 · 악마 1 · 천사 1`);
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
    /* ⚑⚑⚑ T102 — plusStep 0.13 → 19/9. «+9강 = 정확히 ×20» 이 주인 확정의 실질이므로 리터럴이 아니라
       그 산술을 단언한다(19/9 는 double 로 딱 떨어지지 않지만 1+ps*9 는 정확히 20 이 된다). */
    const PS9 = 1 + GH.plusStep * 9;
    if (GH.slotLvMax === 150 && GH.slotStep === 0.01 && PS9 === 20) ok(`주인 확정 성장 상수 — 슬롯 1렙당 +1% · 상한 150 · +9강 = 정확히 ×${PS9} (plusStep ${GH.plusStep} = 19/9 · PLAN §11.4·§11.5-a)`);
    else bad(`주인 확정 성장 상수 위반 — slotStep ${GH.slotStep}(0.01) · slotLvMax ${GH.slotLvMax}(150) · 1+plusStep*9 = ${PS9}(20)`);
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

/* ---------- ⑩ GOPT 18종류 × 8옵션 = 144칸 전수 대조 ---------- */
/* ⚑ T124 — 18«계열» 이 «3세트 × 6부위» 로 바뀌었다. 종류 수(18)는 그대로지만 종류 키가 `crit_weapon`
   처럼 밑줄을 쓰고 옵션이 8칸(일반부터 1개)이 됐다 — 파서의 키 정규식과 칸 수 단언을 함께 갱신했다. */
console.log('\n[⑩ GOPT 세트 옵션표 — 설명문 144칸 + ap 본문 전수 대조 (PLAN §11.6)]');
function goptTable(src) {
  const i = src.indexOf('const GOPT={');
  if (i < 0) return null;
  const end = src.indexOf('\n};', i);
  if (end < 0) return null;
  const body = src.slice(i + 'const GOPT={'.length, end);
  const out = {};
  /* `type:[ ... ],` 블록을 괄호 깊이로 쪼갠다 */
  const re = /^\s{2}([a-z_]+):\[/gm;
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
    ts.length === 18 ? ok('sim.js GOPT 18종류 (3세트 × 6부위)') : bad(`sim.js GOPT 가 ${ts.length}종류 (18 이어야 함)`);
    const missT = ts.filter(t => !th.includes(t));
    const extraT = th.filter(t => !ts.includes(t));
    missT.length ? bad(`index.html 에 없는 종류 ${missT.length}개: ${missT.join(' ')}`) : ok('18종류 전부 index.html 에 존재');
    extraT.length ? bad(`sim.js 에 없는 종류 ${extraT.length}개: ${extraT.join(' ')}`) : ok('잉여 종류 0');
    let cells = 0, dDiff = [], apDiff = [], nCnt = [];
    for (const t of ts) {
      const a = OS[t], b = OH[t] || [];
      if (a.length !== 8) nCnt.push(`${t}=${a.length}`);
      if (b.length !== a.length) { dDiff.push(`${t}: 옵션 수 sim ${a.length} vs index ${b.length}`); continue; }
      for (let i = 0; i < a.length; i++) {
        cells++;
        if (a[i].d !== b[i].d) dDiff.push(`${t}[${i + 1}] 설명 sim«${a[i].d}» vs index«${b[i].d}»`);
        if (norm(a[i].ap) !== norm(b[i].ap)) apDiff.push(`${t}[${i + 1}] ap sim«${a[i].ap}» vs index«${b[i].ap}»`);
      }
    }
    nCnt.length ? bad(`8옵션이 아닌 종류: ${nCnt.join(' ')}`) : ok('18종류 전부 8옵션 (일반 1 … 신화 5 · +3/+6/+9 각 +1 — PLAN §11.1)');
    dDiff.length ? bad(`설명문 불일치 ${dDiff.length}칸:\n    ` + dDiff.slice(0, 8).join('\n    ')) : ok(`설명문 ${cells}칸 전수 일치`);
    apDiff.length ? bad(`ap 본문 불일치 ${apDiff.length}칸:\n    ` + apDiff.slice(0, 8).join('\n    ')) : ok(`ap 본문 ${cells}칸 전수 일치`);

    /* PLAN §11.6 표의 설명문과도 대조 — T8·T9·T11·T12 계열(표↔엔진 불일치) 재발 방지 */
    const PLAN = fs.readFileSync(path.join(ROOT, 'PLAN.md'), 'utf8');
    let planMiss = [];
    for (const t of ts) for (const o of OS[t]) if (o.d && !PLAN.includes(o.d)) planMiss.push(`${t}: ${o.d}`);
    planMiss.length ? bad(`PLAN §11.6 표에 없는 설명문 ${planMiss.length}칸:\n    ` + planMiss.slice(0, 8).join('\n    '))
      : ok('144칸 설명문 전부 PLAN §11.6 표에 존재');
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
  /* 뽑기 확률은 주인 확정값이라 따로 못박는다 (PLAN §11.2).
     T65 로 리터럴 임계가 `GT.gachaRate` 단일 출처로 바뀌었다 — 여기서는 «두 파일이 같은 파생 굴림을 쓴다» 만 보고,
     PLAN 산문·상점 안내문까지 엮은 3자 대조는 ㉜ 가 본다(리터럴 정규식은 이제 오히려 되돌림을 유도한다). */
  const RAR = /GT\.rarRoll=r=>\{[^}]*\}/;
  const sr = SIM.match(RAR), hr = HTML.match(RAR);
  (sr && hr && norm(sr[0]) === norm(hr[0]))
    ? ok('뽑기 등급 굴림 GT.rarRoll 이 두 파일에서 같다 (확률값 자체는 ㉜ 가 PLAN·상점과 3자 대조)')
    : bad('GT.rarRoll 이 두 파일에서 다르거나 없다 (PLAN §11.2)');
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
    /* ⚑ T116 U01 — 두 top 이 «고정 px» 에서 «프레임 높이 비율(+px)» 로 바뀌었다(레퍼런스 비례 맞춤).
       단언의 뜻은 그대로 «버프 아이콘이 챕터 블록보다 42px 이상 아래» 이므로, 390×844 프레임(=fh 844)에서의
       실제 px 로 환산해 비교한다. 두 표기(`top:NNpx` · `top:calc(var(--fh)*.NNN [+ NNpx])`)를 모두 읽는다. */
    const topPx = sel => {
      const m = HTML.match(new RegExp(sel.replace(/[#.]/g, c => '\\' + c) + '\\{[^}]*top:([^;]+);'));
      if (!m) return null;
      const t = m[1].trim();
      let mm = t.match(/^(\d+(?:\.\d+)?)px$/);
      if (mm) return +mm[1];
      mm = t.match(/^calc\(var\(--fh\)\s*\*\s*\.(\d+)(?:\s*\+\s*(\d+(?:\.\d+)?)px)?\)$/);
      if (mm) return 844 * +('.' + mm[1]) + (mm[2] ? +mm[2] : 0);
      return null;
    };
    const chapTop = topPx('#chapHud');
    const buffTop = topPx('#buffBar');
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
    /* ⚑⚑⚑ T119 — 등급이 부활해 «출처 특전의 등급색» 으로 돌아왔다(주인 «인포 팝업·미리보기 줄에도 등급색»).
       한 색으로 되돌아가면(PERK_COLOR 직접 사용) 빨개진다 — 출처 불명 버프의 회색 폴백은 그대로다. */
    (/perkColor\(g\.perk\)/.test(rb[0]) && !/=\s*PERK_COLOR/.test(rb[0]))
      ? ok('⚑ T119 버프 아이콘이 출처 특전의 등급색(perkColor)을 쓴다')
      : bad('renderBuffBar 가 등급색(perkColor)을 안 쓴다 — T96 시절의 한 색(PERK_COLOR)으로 되돌아갔는지 확인할 것');
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
    /cc\s*=\s*perkColor\(o\.pk\)/.test(rp[0]) ? ok('⚑ T119 미리보기 칩이 특전의 등급색(perkColor)을 쓴다')
      : bad('미리보기 줄이 등급색을 안 쓴다 — T96 시절의 한 색(PERK_COLOR)으로 되돌아갔는지 확인할 것');
    /c>1\?/.test(rp[0]) ? ok('중복 획득은 아이콘 1개 + 개수 뱃지') : bad('중복 획득 개수 뱃지가 없다');
    /pv-more">\+\$\{more\}/.test(rp[0]) ? ok('한 줄을 넘치면 최신 것만 남기고 «+N» 으로 합침') : bad('넘침 처리(«+N»)가 없다');
    /* ⚑ T116 U01 — «남길 개수» 가 cap-1 에서 capF(«+N» 칩의 실제 폭 44px 을 뺀 값)로 바뀌었다.
       이 단언이 지키는 것은 «앞쪽이 아니라 뒤쪽(최신)을 남긴다» 이므로 꼬리 slice 인지만 본다. */
    /slice\(order\.length-\(?cap/.test(rp[0]) ? ok('넘칠 때 «최신 것들» 이 보인다') : bad('넘칠 때 최신이 아니라 앞쪽이 남는다 (주인 지시: 최신 것들이 보이게)');
  }
  /* 특전을 얻는 두 경로(레벨업·천사의 축복) 모두에서 줄이 갱신돼야 한다 */
  const tp = HTML.match(/function pickPerk\(perk\)\{[\s\S]*?\n\}/);   /* ⚑ T117 — takePerk → pickPerk (두 엔진 공용 동사명) */
  (tp && /renderPerkStrip\(\)/.test(tp[0])) ? ok('pickPerk 가 미리보기 줄을 갱신') : bad('pickPerk 후 미리보기 줄이 갱신되지 않는다');
  /천사의 축복[\s\S]{0,220}renderPerkStrip\(\)/.test(HTML) ? ok('천사의 축복도 미리보기 줄에 반영') : bad('천사의 축복 획득 시 미리보기 줄이 갱신되지 않는다');

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
    /* ⚑⚑⚑ T125 ①-c (주인 확정 21:2X) — 자동 장착은 **폐지**됐다. 대신 «장착분은 재료가 아니다» 가
       그 자리를 지킨다(그래야 합성으로 부위가 비지 않는다). 두 단언이 짝이다 —
       ① 게임 어디에도 자동 장착 호출이 없다 ② 수동 합성 목록이 장착분을 재료 후보에서 뺀다. */
    const CODE = HTML.replace(/\/\*[\s\S]*?\*\//g, ' ');   /* 주석의 «autoEquipBest() 를 없앴다» 같은 서술은 코드가 아니다 */
    !/autoEquipBest\s*\(/.test(CODE) ? ok('게임 쪽 자동 장착 없음 (뽑기·합성 결과는 인벤에만 — T125 ①-c)')
      : bad('index.html 에 자동 장착 호출이 남아 있다 — 주인 21:2X «뽑기만 하고 장착 안 했는데 자동 장착되는 거 안 되게»');
    /* ⚑ T127 — 바로 위 단언은 «autoEquipBest» 라는 **이름 하나**만 본다. 같은 동작을 다른 이름으로
       되살리면 정적 게이트가 통과한다(사본 실측 — 빨개진 게이트 0건 · T3 gear 만 잡았다).
       자동 장착은 이름이 무엇이든 반드시 `save.eq[...] = ...` 에 쓴다 — 그래서 **쓰는 자리를 센다**.
       지금 장착을 «쓰는» 곳은 장비 세부 팝업의 «장착» 버튼(gdEq) 하나뿐이다
       (해제 `gdUneq` 와 로드 정리는 `delete` 라 여기 안 걸린다 · `=` 뒤의 `==`·`=>` 는 제외). */
    const EQW = CODE.match(/save\.eq\[[^\]]*\]\s*=(?![=>])/g) || [];
    EQW.length === 1
      ? ok('장착을 쓰는 자리가 1곳뿐 — 이름을 바꾼 자동 장착도 막힌다 (T125 ①-c · T127)')
      : bad(`index.html 이 save.eq[...] 에 ${EQW.length}곳에서 쓴다 — 수동 «장착» 버튼 1곳이어야 한다 (T125 ①-c)`);
    /gdEq[\s\S]{0,200}?save\.eq\[g\.part\]\s*=\s*g\.u/.test(CODE)
      ? ok('그 1곳이 세부 팝업 «장착» 버튼(gdEq) 안이다 (유저가 직접 장착)')
      : bad('save.eq 쓰기가 수동 «장착» 버튼(gdEq) 안에 있지 않다 — 자동 장착 경로일 수 있다 (T125 ①-c)');
    /if\(isEquipped\(g\)\)\{\s*toast/.test(HTML.replace(/\s+/g, m => m.includes('\n') ? '\n' : ' '))
      || /isEquipped\(g\)\|\|\(lock/.test(HTML)
      ? ok('합성 재료 후보에서 장착분 제외 (T125 ①-c · PLAN §11.3 과 일치)')
      : bad('장착 중인 장비가 아직 합성 재료로 선택된다 — 자동 장착이 없어 그 부위가 빈 채 남는다');
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
console.log('\n[⑯ 레벨업 특전 카드 — 메달리온 구도 · 순번 태그 (T96 · 선택창 폐지)]');
{
  const icCss = HTML.match(/\.perk-card \.ic\{[^}]*\}/);
  if (!icCss) bad('.perk-card .ic 규칙이 없다');
  else {
    /clip-path:polygon/.test(icCss[0]) ? ok('특전 아이콘이 팔각 메달리온 (스크린샷 구도)')
      : bad('특전 아이콘이 맨 이모지다 — 스크린샷의 메달리온 구도가 아니다');
    /var\(--pc/.test(icCss[0]) ? ok('메달리온 바탕이 카드색(--pc)') : bad('메달리온이 카드색을 쓰지 않는다');
    /width:46px;\s*height:46px/.test(icCss[0]) ? ok('메달리온이 정사각(46px) — 팔각이 찌그러지지 않는다')
      : bad('메달리온 가로·세로가 어긋난다');
  }
  /* ⚑⚑ T96 — «무료 새로고침 버튼»·«남은 횟수» 줄은 선택창과 함께 폐지됐다.
     되살아나면 빨개지게 반대 방향으로 잠근다(폐지의 회귀 방지 — ㉜ 와 같은 취지). */
  !/#refBtn\{/.test(HTML) && !/id="refBtn"/.test(HTML) && !/id="refLeft"/.test(HTML)
    ? ok('새로고침 버튼·«남은 횟수» 줄이 없다 (선택창 폐지 — 되살아나면 빨개진다)')
    : bad('새로고침 버튼/«남은 횟수» 줄이 되살아났다 — 주인 확정 «새로고침 폐지» 위반');
  /* ⚑⚑⚑ T119 — 카드 태그가 «획득 순번(1/10)» 에서 **등급 이름**으로 돌아왔고, 테두리(`--pc`)가 등급색이다
     (주인 «등급 테두리 색 부활 + 등급 이름»). 특전이 아닌 획득물(천사의 축복)만 «축복» 태그다. */
  const ch = HTML.match(/function perkCardHTML\(p,i,extra\)\{[\s\S]*?\n\}/);
  (ch && /PERK_GRADE_NAME\[g\]/.test(ch[0]) && /'축복'/.test(ch[0]))
    ? ok('⚑ T119 카드 태그가 등급 이름(일반/희귀/전설)이다 — 축복만 «축복»')
    : bad('카드 태그가 등급 이름이 아니다 — T96 시절의 획득 순번 태그로 되돌아갔는지 확인할 것');
  (ch && /--pc:\$\{perkColor\(p\)\}/.test(ch[0]))
    ? ok('⚑ T119 카드 테두리색(--pc)이 등급색이다')
    : bad('카드 테두리색이 등급색이 아니다');
  /* 등급색 3종이 주인 위임값(회색·파랑·금색)으로 정의돼 있는가 — 색 자체가 사라지면 빨개진다 */
  /const PERK_GRADE_COLOR=\['#9EA3AC','#4FA3F7','#FFB92E'\]/.test(HTML)
    ? ok('⚑ T119 등급색 3종 = 일반 회색 · 희귀 파랑 · 전설 금색')
    : bad('PERK_GRADE_COLOR 가 없거나 값이 다르다 (일반 회색 · 희귀 파랑 · 전설 금색)');
  (ch && !/RARITY/.test(ch[0])) ? ok('카드가 옛 132종 등급 상수(RARITY)를 참조하지 않는다') : bad('카드가 아직 RARITY 를 참조한다');
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
  /* ⚑ P1(T83) — 관통 상한이 상수 SPEAR_PIERCE 로 올라갔다. 창 생성부가 그 상수를 쓰는지까지 본다. */
  const spearOf = (src, who) => {
    const m = src.match(/type:'spear',[^}]*?\}/);
    if (!m) { bad(`${who} 에서 창 투사체 생성부를 못 찾았다 — 게이트를 갱신할 것`); return null; }
    if (!/pierce:SPEAR_PIERCE/.test(m[0])) { bad(`${who} 의 창이 상수 SPEAR_PIERCE 를 안 쓴다 — 상한 없는 창은 12마리 웨이브에서 총출력 162배가 된다 (T34)`); return null; }
    const c = src.match(/SPEAR_PIERCE=(\d+);/);
    if (!c) { bad(`${who} 에서 SPEAR_PIERCE 상수를 못 찾았다`); return null; }
    return Number(c[1]);
  };
  const sSpear = spearOf(SIM, 'sim.js'), hSpear = spearOf(HTML, 'index.html');
  const planSpear = Number((fs.readFileSync(path.join(ROOT, 'PLAN.md'), 'utf8').match(/일직선 최대 \*\*(\d+)마리\*\* 관통/) || [])[1]);
  if (sSpear !== null && hSpear !== null) {
    if (sSpear !== hSpear) bad(`창 관통 상한이 두 파일에서 다르다 — sim.js ${sSpear} · index.html ${hSpear}`);
    else if (!planSpear) bad('PLAN §3.0 에서 «일직선 최대 N마리 관통» 을 못 찾았다 — 게이트를 갱신할 것');
    else if (sSpear !== planSpear) bad(`창 관통 상한이 PLAN §3.0 «${planSpear}마리» 와 다르다 — 엔진 ${sSpear}`);
    else ok(`창 관통 상한 ${sSpear}마리 — sim.js · index.html · PLAN §3.0 3자 일치`);
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
    [SIMC, 'sim.js', /px\.thorns&&pkk\([^)]*\)\)[^\n]*/],
    [HTMLC, 'index.html', /px\.thorns&&pkk\([^)]*\)\)[^\n]*/]]) {
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
    /* ⚑ P1(T83) — 투사체 적중은 projHit() 한 동사를 거치고, 그 안에서 summonHit 을 부른다. */
    ['sim.js 번개(fireBolts)',      SIM,  /function fireBolts\(p,n\)\{[\s\S]*?summonHit\(G,t,R_BOLT\)/],
    ['sim.js 자동번개(autoBolt)',   SIM,  /autoBoltT=3;fireBolts\(p,p\.px\.autoBolt\)/],
    ['sim.js projHit → summonHit',  SIM,  /function projHit\(G,pr,e\)\{[\s\S]*?summonHit\(/],
    ['sim.js 관통 투사체 적중',     SIM,  /pr\.hit\.add\(e\);projHit\(/],
    ['sim.js 단일 투사체 적중',     SIM,  /pr\.x>=pr\.tgt\.worldX-10\)\{projHit\(/],
    ['index.html 번개(castBolt)',   HTML, /function castBolt\(t\)\{[\s\S]*?summonHit\(t,R_BOLT/],
    ['index.html projHit → summonHit', HTML, /function projHit\(pr,e\)\{[\s\S]*?summonHit\(/],
    ['index.html 관통 투사체 적중', HTML, /pr\.hit\.add\(e\);\s*projHit\(/],
    ['index.html 단일 투사체 적중', HTML, /pr\.x>=pr\.tgt\.worldX-10\)\{\s*projHit\(/],
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
  /if\(basic&&p\.nextCrit\)/.test(HTML) && /const basic=\(icon===undefined\);/.test(HTML)
    ? ok('index.html: nextCrit 소모가 기본공격 전용(basic = 아이콘 인자 없음)으로 남아 있다')
    : bad('index.html: nextCrit 소모의 기본공격 전용 가드가 사라졌다');
  for (const [src, who, re] of [
    [SIM, 'sim.js', /function playerStrike\(G,e\)\{[\s\S]*?px\.clone[\s\S]*?px\.extraHit[\s\S]*?procOnAttack\(G,e\);/],
    [HTML, 'index.html', /function playerStrike\(e\)\{[\s\S]*?px\.clone[\s\S]*?px\.extraHit[\s\S]*?procOnAttack\(e\);/]])
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
  /* ⚑ P1(T83) — STUN_LORD_*(신화 전용)·MISS_STACK_CAP(무제한 적립으로 폐지)이 사라졌다 */
  for (const nm of ['STUN_BOSS_MUL']) {
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
  [[SIM, 'sim.js', /if\(e\.stun>0\)\{\s*e\.stun-=dt;[\s\S]{0,140}?continue;\s*\}/],
   [HTML, 'index.html', /if\(e\.stun>0\)\{\s*e\.stun-=dt; e\.aggro=false;[\s\S]{0,160}?continue;\s*\}/]]
    .forEach(([src, who, re]) => re.test(src)
      ? ok(`${who}: 스턴 중 적은 공격 루프를 건너뛴다 (근접·화살 공통, 타이머 정지)`)
      : bad(`${who}: 스턴이 적 공격을 실제로 막는 자리가 없다 — 표시만 뜨고 효과가 없다`));
  /* (4) 빗맞음은 procOnMiss 한 곳으로 모으고, «MISS» 가 뜨는 **모든** 자리에서 불러야 한다.
     ⚑⚑⚑ T121 2차 — «관통 베기»(주인 확정 17:4X)로 빗맞음 자리가 2 → **3곳**이 됐다.
     주인 문면이 «뒤 적의 회피 10% 는 따로 굴린다» 라 뒤 적도 자기 회피 판정을 하고, 빗맞으면 그 자리에서도
     빗맞음 축이 굴러야 한다(안 부르면 `missAtk`·`missSpear` 같은 축이 그 타격만 조용히 건너뛴다).
     그래서 기대값을 3 으로 올리되 **«회피 분기 안» 조항은 그대로**다 — 세 곳 다 분기 안이어야 한다. */
  for (const [src, who] of [[SIM, 'sim.js'], [HTML, 'index.html']]) {
    const body = src.replace(/\/\*[\s\S]*?\*\//g, '');
    /function procOnMiss\(/.test(body) ? ok(`${who}: procOnMiss 존재`) : bad(`${who}: procOnMiss 가 없다`);
    const calls = (body.match(/procOnMiss\(/g) || []).length - 1;   /* 정의부 1건 제외 */
    calls === 3 ? ok(`${who}: procOnMiss 호출 3곳 (기본·소환 타격 + 반격 + ⚑ 관통 베기의 뒤 적)`)
                : bad(`${who}: procOnMiss 호출이 ${calls}곳 — 빗맞음이 일어나는 세 자리(dealDmg·doCounter·cleave) 전부여야 한다`);
    /* 회피 분기 안에서 불러야 한다 — 분기 밖이면 적중에도 굴러간다 */
    const evadeBlocks = (body.match(/Math\.random\(\)<ENEMY_EVADE[\s\S]{0,220}?procOnMiss\(/g) || []).length;
    evadeBlocks === 3 ? ok(`${who}: 세 호출 다 적 회피 분기 안에 있다`)
                      : bad(`${who}: 적 회피 분기 안의 procOnMiss 가 ${evadeBlocks}곳 — 적중에도 굴러가면 축이 무너진다`);
  }
  /* ⚑⚑ T96 — (5)(5-b)(6) 은 대상이 사라졌다.
     빗맞음 «스택»(💢 l_missStack)·주인 필수 예시 4종(l_stunHit3·r_stunCrit·l_missCrit·l_missStack)은
     전부 폐지된 132종의 특전이다. **빗맞음·스턴 «축» 자체는 살아 있고**(장비 계열 옵션 miss*·stunHit*·stunCrit*)
     위 (1)~(4) 가 그 축의 구조(호출 지점·회피 분기 안·두 엔진 동형)를 계속 지킨다. */
}

/* ---------- ㉓ 레벨업 필요 경험치 5*Lv+1 (⚑⚑ 주인 확정 2026-09-03 · T100 — 종전 4+3*Lv·4+4*Lv 폐기)
   ⚑ T107 로 «완주 = 특전 10개» 항등식은 사라졌다(적 수가 챕터마다 다르다). 그래서 이 절이 지키는 것은
   «두 엔진 + 게임 내부 중복 정의가 전부 5*Lv+1 한 식을 쓴다» 뿐이고, 챕터별 실제 획득 특전 수는
   `tools/verifyChapterFixed.js` ⓓ 가 표(1~5=6·15=7·28=8·38+=9)와 실측으로 대조한다. ---------- */
console.log('\n[㉓ 레벨업 필요 경험치 = 5*Lv+1 (PLAN §2.4, T100)]');
{
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
  const SIMC = strip(SIM), HTMLC = strip(HTML);

  /* (1) 두 엔진의 식이 «5*lv+1» 인가 (⚑⚑⚑ T100 — 종전 4+3*lv). index.html 은 정의가 둘(전역 상수 + TUNE)
     이라 둘 다 본다 — T47 조사에서 실제로 두 곳에 같은 식이 중복돼 있었다(게임 로직은 전역 쪽만 쓴다). */
  const forms = [
    ['sim.js TUNE.expNeed',      SIMC,  /expNeed:lv=>(\d+)\*lv\+(\d+)/],
    ['index.html 전역 expNeed',  HTMLC, /const expNeed=lv=>(\d+)\*lv\+(\d+)/],
    ['index.html TUNE.expNeed',  HTMLC, /expNeed:lv=>(\d+)\*lv\+(\d+)/],
  ];
  const got = [];
  for (const [who, src, re] of forms) {
    const m = src.match(re);
    if (!m) { bad(`${who}: 경험치 요구식을 못 찾았다 — 코드 모양이 바뀌었나 (게이트를 갱신할 것)`); got.push(null); continue; }
    const step = Number(m[1]), base = Number(m[2]);
    got.push(`${step}*lv+${base}`);
    (step === 5 && base === 1)
      ? ok(`${who} = ${step}*Lv+${base} (Lv1→${step + base})`)
      : bad(`${who} = ${step}*Lv+${base} — 주인 확정(2026-09-03 · T100)은 5*Lv+1`);
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

  /* (3-b) ⚑ 주인 지시(2026-09-03) — 경험치 바에 «레벨» 을 쓰지 않는다.
     참고 스크린샷(docs/ref/메인 게임화면.jpg)의 캡 표기는 «EXP» 다. 레벨 자체(필요 경험치·특전 3택)는 그대로 산다. */
  {
    const barRe = /<div class="bar" id="expBar">[\s\S]*?<\/div>\s*<div class="bar" id="hpBar"/;
    const bar = HTML.match(barRe);
    if (!bar) bad('경험치 바 마크업을 못 찾았다 — 코드 모양이 바뀌었나 (게이트를 갱신할 것)');
    else {
      /<span class="cap cap-exp">EXP<\/span>/.test(bar[0])
        ? ok('경험치 바 캡 = «EXP» (참고 스크린샷 표기)')
        : bad('경험치 바 캡이 «EXP» 가 아니다 — 주인 지시(2026-09-03) 위반');
      /Lv/.test(bar[0])
        ? bad('경험치 바 마크업에 «Lv» 가 남아 있다 — 주인 지시(2026-09-03)로 레벨 표기 금지')
        : ok('경험치 바 마크업에 «Lv» 표기 없음');
    }
    /lvCap/.test(HTML)
      ? bad('«lvCap»(경험치 바 레벨 표기) 잔재가 있다 — 주인 지시(2026-09-03)로 폐지됐다')
      : ok('«lvCap» 잔재 없음');
    /textContent\s*=\s*['"`]Lv['"`]\s*\+\s*p\.level/.test(HTMLC)
      ? bad('HUD 가 «Lv»+p.level 을 다시 그린다 — 주인 지시(2026-09-03) 위반')
      : ok('HUD 에 «Lv»+레벨 그리는 자리 없음');
  }

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
    [SIM, 'sim.js', 'if(!isMelee)procOnRanged(G,src,dmg);'],
    [HTML, 'index.html', 'if(!isMelee) procOnRanged(src,dmg);']]) {
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
    /* ⚑ P1(T83) — 반사 3단이 «일반 🌿 c_thornsS 30%/50% · 전설 🦔 l_thorns 확정 200%» 2단으로 바뀌었고,
       구 짧은 키(thornsS·thorns·thornsKing)는 장비 옵션 전용으로 남았다. 특전·장비 양쪽을 본다. */
    /* ⚑ T96 — 반사 특전 2종(🌿 c_thornsS · 🦔 l_thorns)은 폐지됐다. 반사 «축» 은 장비 옵션으로 남는다. */
    for (const [key, label] of [['px.thorns&&', '장비 가시 옵션'], ['px.thornsKing)', '장비 가시왕 옵션'], ['px.thornsS&&', '장비 가시(소) 옵션']])
      body.includes(key) ? ok(`${who}: ${label} 존재`) : bad(`${who}: ${label} 가 없다`);
    /* 고중첩 변형 — 최대 중첩 인자가 10 이어야 한다 (기존 5중첩 계열의 상위 변형) */
    /* ⚑ P1(T83) — 주인 확정 «버프 무한 중첩» 으로 중첩 인자 자체가 폐지됐다(장비 옵션은 그대로 남음) */
    /px\.aspdStack10&&pkk\(p,0\.25\*px\.aspdStack10\)\)\s*addBuff\(p,'aspd',0\.05,4[,)]/.test(body)
      ? ok(`${who}: 장비 공속 옵션이 4초·+5% 로 남아 있다 (중첩 상한은 폐지)`)
      : bad(`${who}: 장비 공속 옵션이 없거나 인자가 다르다`);
  }
  /* ⚑ P1(T83) — 주인 확정 «버프 중첩 상한 전부 삭제(무한 중첩)». 상한 로직이 되살아나면 빨개진다. */
  for (const [src, who] of [[SIM, 'sim.js'], [HTML, 'index.html']]) {
    const body = src.replace(/\/\*[\s\S]*?\*\//g, '');
    (!/STACK_BONUS/.test(body) && !/px\.stackMaster/.test(body))
      ? ok(`${who}: 중첩 상한 보너스 체계(STACK_BONUS·stackMaster)가 없다`)
      : bad(`${who}: 중첩 상한 체계가 되살아났다 — 주인 확정 «무한 중첩» 위반`);
    const ab = body.match(/function addBuff\([^)]*\)\s*\{[\s\S]*?\n\}/);
    (ab && !/arr\.length>=max/.test(ab[0]) && /push\(\{t:dur,amt/.test(ab[0]))
      ? ok(`${who}: addBuff 가 상한 없이 push 만 한다 (무한 중첩)`)
      : bad(`${who}: addBuff 에 중첩 상한이 되살아났다`);
  }
  /* ⚑ T96 — «필수 특전» 목록은 132종 시절 주인 원문에서 온 것이라 대상이 사라졌다.
     원거리 피격·반사 축의 **구조**(위 호출 지점·순서·회피 가드)는 그대로 지킨다. */
}

/* ---------- ㉕ 횟수형 방어막 (주인 17:2X · T48 3단계)
   주인 원문: «적 공격 1회를 완전히 막아주는 방어막 1장. 5장 쌓였으면 5번 막음 (피격 1회당 1장 소모,
   그 타격 데미지 완전 무효 — 수치형 실드와 별개 축). 버프 아이콘에 남은 장수 뱃지 + 막을 때 전용 이펙트».
   ⚑ T96 — «회피 즉사»(☠️🌾 사신의 낫)는 그 특전이 폐지되면서 대상이 사라져 이 절에서 뺐다.
   방어막은 장비 계열 옵션(wardAtk·wardEvade·wardCrit·wardHit)으로 그대로 살아 있다. ---------- */
console.log('\n[㉕ 횟수형 방어막 (PLAN §3.0, T48 3단계)]');
{
  for (const [src, who] of [[SIM, 'sim.js'], [HTML, 'index.html']]) {
    const body = src.replace(/\/\*[\s\S]*?\*\//g, '');
    /function gainWard\(p,ch\)/.test(body) ? ok(`${who}: gainWard(p,ch) 한 동사로 모여 있다`)
                                          : bad(`${who}: gainWard 동사가 없다`);
    !/wardCap|WARD_CAP/.test(body)
      ? ok(`${who}: 방어막 장수에 상한이 없다 (주인 확정 «무한»)`)
      : bad(`${who}: 방어막 장수 상한이 되살아났다 — 주인 확정 «무한» 위반`);
    /* ⚑⚑⚑ T121 3차 (주인 확정 18:2X) — 판정 순서가 **회피 → 방어막 → 피해 무시 → 피해** 로 못 박히고,
       막힌 타격은 «피격» 이 아니게 됐다(트리거·가시갑옷 없음). 그래서 종전의 `const warded` / `const nulled`
       두 갈래가 «1장 소모하고 그 자리에서 끝난다» 한 줄로 합쳐졌다 — 그 모양을 여기서 못 박는다. */
    /if\(p\.ward>0\)\{[\s\S]{0,200}?p\.ward--;[\s\S]{0,200}?return;/.test(body)
      ? ok(`${who}: 방어막이 피격 1회당 1장을 소모하고 그 타격은 «피격» 이 아니다 (⚑ 주인 18:2X)`)
      : bad(`${who}: 방어막 소모·조기 종료 판정이 없다`);
    /const ign1=px\.p_ignoreN&&pkk\(p,PERK_IGN_N\);/.test(body) && /const ign2=p\.sh>0&&px\.p_shWallL&&pkk\(p,PERK_SHWALL_L\);/.test(body)
      ? ok(`${who}: «피해 무시»·«실드 방벽» 이 방어막 «뒤» 에서 각각 따로 굴고, 걸리면 피해도 «피격» 도 없다`)
      : bad(`${who}: «피해 무시»·«실드 방벽» 판정이 방어막 뒤에 없다`);
  }
  /ward-ic/.test(HTML) ? ok('index.html: 버프바에 남은 장수 뱃지(.ward-ic)') : bad('index.html: 방어막 장수 뱃지가 없다');
  /function wardFx\(/.test(HTML) ? ok('index.html: 막을 때 전용 이펙트(wardFx)') : bad('index.html: 방어막 전용 이펙트가 없다');
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

  /* (7) 로비 상단 줄이 축약 표기를 담도록 좁혀져 있다 (실측 근거: 구 CSS 는 챕터 40 에서 417px)
         ⚑ T64 로 세 값에 `* var(--tf)` 배율이 얹혔다 — 기준값(gap 6 · padding 10 · clamp 식)은 그대로 지킨다. */
  /* ⚑ T116 U01 — 위 여백이 12px 에서 «프레임 높이 3.7%»(레퍼런스의 상단 바 y)로 바뀌었다.
     이 단언이 지키는 것은 «gap 6 · 좌우 padding 10 · 배율 --tf» 이고 그 셋은 그대로다 — 세로 여백만 자유롭게 둔다. */
  /\.lobby-top\{[^}]*gap:calc\(6px \* var\(--tf\)\)[^}]*padding:[^;]*? calc\(10px \* var\(--tf\)\) 0/.test(HTML)
    ? ok('로비 상단 줄 여백이 좁혀져 있다 (gap 6 · padding 10 · T64 배율)')
    : bad('로비 상단 줄 여백이 구 값으로 돌아갔다 — 골드 «8.26M» 에서 줄이 417px 가 된다');
  /\.lobby-top \.pill\{[\s\S]{0,200}?font-size:calc\(clamp\(11px, calc\(min\(100vw, 100vh \* 9 \/ 19\) \* \.036\), 14px\) \* var\(--tf\)\)[\s\S]{0,160}?min-width:0/.test(HTML)
    ? ok('로비 pill 글자가 프레임 폭에 연동된다 (316px 프레임 대응) + min-width:0 안전망')
    : bad('로비 pill 의 프레임 연동 글자 크기 또는 min-width:0 안전망이 사라졌다 — SE(프레임 316px)에서 글자가 잘린다');
  /#powerPill\{font-size:calc\(clamp\(12px,[^}]*var\(--tf\)\)/.test(HTML)
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
    /* ⚑ P1(T83) — 세 카운터 다 상한이 폐지됐지만(주인 확정 «무한»), 한 판에서 실제로 쌓이는 규모는
       수십 장이라 자릿수가 터지지 않는다. 큰 «수치» 가 아니라 «장수» 라서 fmt 축약이 오히려 읽기 나쁘다. */
    ['p.missStk', '빗맞음 스택 장수(판당 수십)'], ['p.ward', '방어막 장수(판당 수십)'],
    ['p.evStk', '회피 스택 장수(판당 수십)'],
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

  /* 인게임 HUD 누적 골드도 같은 규약 (팝업만 고치고 HUD 를 놓치는 되돌림 방지)
     ⚑ T64 로 표기 자리가 `syncGameTop()` 한 곳으로 모였다 — 그 안에서 fmt 를 거치는지로 본다. */
  {
    const sgt = (HTML.match(/function syncGameTop\([\s\S]*?\n\}/) || [''])[0];
    (/const gs=fmt\(/.test(sgt) && /\$\('gGold'\)\.textContent=gs/.test(sgt))
      ? ok('인게임 HUD 누적 골드가 fmt 를 쓴다 (syncGameTop 경유)')
      : bad('인게임 HUD 누적 골드가 fmt 를 거치지 않는다');
    !/\$\('gGold'\)\.textContent=(?!gs|g8)/.test(HTML)
      ? ok('gGold 를 syncGameTop 밖에서 직접 쓰는 곳이 없다 (fmt 우회 경로 차단)')
      : bad('gGold 에 직접 대입하는 곳이 남았다 — 그 경로는 fmt 도 상단 줄 맞춤도 건너뛴다');
  }
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

/* ============================================================================
   ㉛ 상단 줄 3개가 프레임 폭에 맞는다 — `--tf` 자동 맞춤 (T64)

   프레임 폭은 `min(100vw, 100dvh*9/19)` 라 **세로가 폭을 정한다** — 주소창이 뜨면 폭이 준다.
   T54 는 로비 줄 글자를 프레임에 연동했지만 `clamp(11px, …, 14px)` 의 **하한 11px 에서 축소가 멈추고**
   아바타 52px·여백·pill padding 은 처음부터 고정이라, 프레임이 316px 아래로 내려가면 줄이 넘쳤다.
   T64 실측(수정 전):
     · 로비 — 278px(SE 375×667 + 주소창)에서 «59.68Oc»→«59.…» · 267px 에서 전투력 «338»→«…»/빈칸.
       말줄임 안전망이 **수치** 에 걸려 숫자가 통째로 거짓이 됐다.
     · 인게임 `#topbar` — T54 의 손이 안 닿아 고정 14px·min-width 무제한이라 칸이 못 줄고
       ☰ 가 프레임(overflow:hidden) 밖으로 **+25.9px**(골드 «120.00Dc» 면 +32.9px) 밀려 **일시정지·포기가 안 눌렸다.**
     · 장비/대장간/상점 `.top-bar` — `flex:1` + `justify-content:center` 라 좌우로 **±14.9px** 씩 삐져나갔다.

   그래서 «값이 맞나» 가 아니라 **«세 줄이 같은 장치를 쓰나»** 를 못박는다:
     ① 세 줄 모두 `--tf:1` 기준값을 갖고, 가로 치수(글자·여백·간격)가 `* var(--tf)` 로 걸려 있다
     ② 수치 span 이 말줄임 안전망(min-width:0 + text-overflow)을 갖는다
     ③ `fitTopRow` 가 «span 말줄임» 과 «줄 넘침» 두 가지를 다 보고, 배율 사다리를 1 부터 내려간다
     ④ 세 줄의 갱신 함수가 각각 맞춤을 부른다 (renderLobby · syncGameTop · renderTopBars)
     ⑤ 인게임은 처치마다 불리므로 «자릿수가 바뀔 때만» 재맞춤하되, 잴 때 숫자를 8 로 바꿔
        그 자릿수의 최대 폭으로 맞춘다 (같은 자릿수라도 «888.88» 이 «111.11» 보다 3.1px 넓다)
     ⑥ 프레임 폭이 바뀌는 사건(resize = 주소창 여닫힘)에 두 줄 다 다시 맞춘다
   실제 렌더 좌표 단언은 T3 `tools/t3/boot.js` 가 본다(정적으론 못 푸는 축).
   ============================================================================ */
{
  console.log('\n[㉛ 상단 줄 3개가 프레임 폭에 맞는다 — --tf 자동 맞춤 (T64)]');
  const rule = sel => {
    const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return (HTML.match(new RegExp(esc + '\\s*\\{[^}]*\\}')) || [''])[0];
  };

  /* ① 세 줄이 --tf 기준값을 갖고 가로 치수가 배율에 걸려 있다 */
  for (const [sel, label] of [['.lobby-top', '로비'], ['#topbar', '인게임'], ['.top-bar', '장비·대장간·상점']]) {
    const r = rule(sel);
    /--tf:\s*1/.test(r) ? ok(`${label} 줄이 --tf 기준값 1 을 갖는다 (넓은 화면에서는 종전과 동일)`)
                        : bad(`${label} 줄(${sel})에 --tf:1 이 없다 — 배율 장치가 사라졌다`);
    /(gap|padding|left|right):[^;}]*var\(--tf\)/.test(r)
      ? ok(`${label} 줄의 여백·간격이 --tf 에 걸려 있다`)
      : bad(`${label} 줄의 여백·간격이 고정으로 돌아갔다 — 글자만 줄여서는 269px 프레임을 못 맞춘다`);
  }
  /* ⚑ T116 U01 — 아바타가 «고정 52px» 에서 «프레임 높이 4.5%»(레퍼런스 비례)로 바뀌었다.
     단언의 뜻은 «치수가 --tf 배율에 걸려 있다» 이므로 그 부분만 본다. */
  /#avatar\{[^}]*width:calc\([^;]*var\(--tf\)\)/.test(HTML)
    ? ok('로비 아바타 치수도 --tf 에 걸려 있다 — 269px 프레임에서 줄의 19% 를 먹던 고정 치수')
    : bad('로비 아바타가 고정 52px 로 돌아갔다 — 좁은 프레임에서 수치 자리를 먹는다');
  /#topbar \.pill\{[^}]*font-size:calc\(14px \* var\(--tf\)\)/.test(HTML)
    ? ok('인게임 pill 글자가 --tf 에 걸려 있다')
    : bad('인게임 pill 이 고정 14px 로 돌아갔다 — ☰ 가 프레임 밖으로 밀린다 (T64 재발)');
  /#topbar #menuBtn,#topbar #sndBtnG\{width:calc\(42px \* var\(--tf\)\)/.test(HTML)
    ? ok('인게임 ☰·🔊 버튼도 --tf 에 걸려 있다 (flex:none 이라 안 줄면 줄을 밀어낸다)')
    : bad('인게임 ☰·🔊 가 고정 42px 로 돌아갔다 — 줄이 못 줄어 ☰ 가 프레임 밖으로 나간다');
  /* ⚑ T116 U01 — 글자가 14 → 13px 로 내려갔다(상단 바 높이를 레퍼런스 4.5% 로 맞추느라). --tf·min-width:0 은 그대로. */
  /\.top-bar \.pill\{[^}]*font-size:calc\(1[34]px \* var\(--tf\)\)[^}]*min-width:0/.test(HTML)
    ? ok('장비·대장간·상점 pill 이 --tf + min-width:0 을 갖는다')
    : bad('장비·대장간·상점 pill 이 구 값으로 돌아갔다 — 269px 에서 좌우로 ±14.9px 삐져나간다');

  /* ② 수치 span 의 말줄임 안전망 (마지막 방어선 — 이게 없으면 넘침이 그대로 프레임을 넘는다) */
  for (const [sel, label] of [['.lobby-top .pill span', '로비'], ['#topbar .pill span', '인게임'], ['.top-bar .pill span', '장비·상점']]) {
    /text-overflow:ellipsis/.test(rule(sel))
      ? ok(`${label} 수치 span 에 말줄임 안전망이 있다`)
      : bad(`${label} 수치 span 의 말줄임 안전망이 없다 (${sel}) — 넘침이 프레임 밖으로 그대로 나간다`);
  }

  /* ③ fitTopRow 가 두 판정을 다 보고 1 부터 내려간다 */
  const fit = (HTML.match(/function fitTopRow\(row,spans\)\{[\s\S]*?\n\}/) || [''])[0];
  /scrollWidth>row\.clientWidth/.test(fit) && /e\.scrollWidth>e\.clientWidth/.test(fit)
    ? ok('fitTopRow 이 «줄 넘침»(☰ 축)과 «span 말줄임»(수치 축)을 둘 다 본다')
    : bad('fitTopRow 의 판정이 한 축만 남았다 — 로비(말줄임)와 인게임(넘침)은 증상이 다르다');
  const steps = (HTML.match(/const TF_STEPS=\[([^\]]+)\]/) || [, ''])[1].split(',').map(Number);
  (steps.length >= 4 && steps[0] === 1 && steps.every((v, i) => i === 0 || v < steps[i - 1]) && steps[steps.length - 1] <= 0.6)
    ? ok(`배율 사다리가 1 에서 ${steps[steps.length - 1]} 까지 내려간다 (${steps.length}칸)`)
    : bad(`TF_STEPS 가 «1 에서 시작해 단조감소, 하한 ≤0.6» 이 아니다: [${steps}]`);

  /* ④ 세 줄의 갱신 함수가 각각 맞춤을 부른다 */
  for (const [fn, call, label] of [
    ['function renderLobby\\(\\)\\{[\\s\\S]*?\\n\\}', 'fitLobbyTop()', 'renderLobby'],
    ['function syncGameTop\\([\\s\\S]*?\\n\\}', "fitTopRow($('topbar')", 'syncGameTop'],
    ['function renderTopBars\\(\\)\\{[\\s\\S]*?\\n\\}', 'fitTopRow(r,', 'renderTopBars'],
  ]) {
    const body = (HTML.match(new RegExp(fn)) || [''])[0];
    body.includes(call) ? ok(`${label} 이 맞춤을 부른다`)
                        : bad(`${label} 에서 맞춤 호출(${call})이 사라졌다 — 값이 바뀌어도 배율이 안 따라간다`);
  }
  /\$\('gKills'\)\.textContent=|syncGameTop\(/.test(HTML) && !/\$\('gGold'\)\.textContent=fmt\(G\.gold\)/.test(HTML)
    ? ok('인게임 골드·처치 표기가 syncGameTop 한 곳으로 모여 있다')
    : bad('gGold 를 syncGameTop 밖에서 직접 쓰는 곳이 남았다 — 그 경로는 맞춤을 건너뛴다');

  /* ⑤ 자릿수 재맞춤 + 8 치환(같은 자릿수 최대 폭) */
  const sgt = (HTML.match(/function syncGameTop\([\s\S]*?\n\}/) || [''])[0];
  /replace\(\/\\d\/g,'8'\)/.test(sgt)
    ? ok('재맞춤 때 숫자를 8 로 바꿔 «그 자릿수의 최대 폭» 으로 맞춘다 (888.88 이 111.11 보다 3.1px 넓다)')
    : bad('8 치환이 사라졌다 — 같은 자릿수의 더 넓은 값에서 다시 잘린다');
  /if\(key!==gameTopKey\)/.test(sgt)
    ? ok('인게임 재맞춤이 «자릿수가 바뀔 때만» 돈다 (처치마다 강제 레이아웃을 피한다)')
    : bad('인게임 재맞춤 조건이 사라졌다 — 처치마다 강제 레이아웃이면 후반 웨이브에서 프레임을 갉아먹는다');

  /* ⑥ resize(주소창 여닫힘)에 두 줄 다 다시 맞춘다 */
  const rz = (HTML.match(/window\.addEventListener\('resize',\(\)=>\{[\s\S]*?\}\);/) || [''])[0];
  (/screenName==='lobby'\) renderLobby\(\)/.test(rz) && /screenName==='game'/.test(rz) && /syncGameTop\(\)/.test(rz))
    ? ok('resize 에서 로비·인게임 줄을 둘 다 다시 맞춘다 (주소창 여닫힘 = 프레임 폭 변화)')
    : bad('resize 처리에서 인게임 줄 재맞춤이 빠졌다 — 주소창이 뜨면 폭이 줄어드는데 배율이 안 따라간다');

  /* ⑦ 프레임이 잘라낸다 = 넘침이 실제 피해다 */
  /overflow:\s*hidden/.test(rule('#frame'))
    ? ok('#frame 이 overflow:hidden 이다 — 줄 밖으로 나간 ☰ 는 눌리지 않는다(피해 근거)')
    : bad('#frame 의 overflow:hidden 이 사라졌다 — ㉛ 의 피해 전제가 바뀌었다. 항목을 재작성할 것');
}

/* ============================================================================
   ㉜ 뽑기 확률·천장·피티 = 주인 확정 상수 한 곳에서만 나온다 (PLAN §11.2, T65)

   T65 전까지 이 세 값이 **세 군데에 손으로 베껴져** 있었다 —
     ⓐ PLAN §11.2 산문 «신화 0.1% / 전설 2% / …», «50회 천장», «전설 10회 피티»
     ⓑ 두 엔진의 `gachaPull` 누적 임계 리터럴 (`r<0.1?4 : r<2.1?3 : r<12.1?2 : r<42.1?1 : 0`) 과 `>=50`·`>=10`
     ⓒ index.html 상점 안내문 문자열 «신화 0.1% · 전설 2% · … · 일반 57.9%» 와 `50-st.p50` · `10-st.p10`
   ⓑ 는 `verifyGearEcon` ③ 이 «엔진이 실제로 그렇게 구는가» 로 보지만, **ⓒ 를 보는 게이트는 없었다.**
   즉 임계를 손보면 상점이 조용히 거짓 확률을 광고하고(주인 확정 상수 = 노브 아님), 천장을 60 으로
   올리면 «천장까지 -9회» 가 화면에 뜬다. T8·T9·T11·T12 가 네 번 반복한 «설명문↔엔진 불일치» 와 같은 모양이다.

   그래서 «지금 값이 맞나» 가 아니라 **«한 곳에서만 나오나»** 를 못박는다:
     ① PLAN 산문 ↔ 두 파일의 `GT.gachaRate`/`pityMyth`/`pityLegend` 3자 일치 · 확률 합 100%
     ② 두 파일이 서로 같다
     ③ `gachaPull` 이 리터럴이 아니라 `GT.rarRoll`·`GT.pityMyth`·`GT.pityLegend` 를 쓴다
     ④ 파생 임계(`GT.gachaCum`)가 종전 리터럴 [0.1,2.1,12.1,42.1,100] 과 **비트 단위로** 같다
        (1ULP 만 밀려도 시드 재현성이 깨진다 — T65 는 1,000,000 뽑기 전수 대조로 동치를 확인했다)
     ⑤ 상점 안내문이 리터럴을 안 쓴다 — 확률 줄은 `gachaRateText()`, 천장·피티는 `GT.pityMyth`/`GT.pityLegend`
     ⑥ `gachaRateText()` 를 실제로 돌린 문자열이 PLAN 산문의 등급·값·순서와 일치한다
   ============================================================================ */
{
  console.log('\n[㉜ 뽑기 확률·천장·피티 단일 출처 (PLAN §11.2, T65)]');
  const PLAN = fs.readFileSync(path.join(ROOT, 'PLAN.md'), 'utf8');
  const RN = ['일반', '희귀', '영웅', '전설', '신화'];

  /* ---- PLAN 산문 파싱 ---- */
  const mRate = PLAN.match(/신화\s*([\d.]+)%\s*\/\s*전설\s*([\d.]+)%\s*\/\s*영웅\s*([\d.]+)%\s*\/\s*희귀\s*([\d.]+)%\s*\/\s*일반\s*([\d.]+)%/);
  const mM = PLAN.match(/\*\*(\d+)회 천장\*\*/);
  const mL = PLAN.match(/\*\*전설 (\d+)회 피티\*\*/);
  const planRate = mRate ? [+mRate[5], +mRate[4], +mRate[3], +mRate[2], +mRate[1]] : null;   /* 일반→신화 순으로 뒤집는다 */
  const planM = mM ? +mM[1] : null, planL = mL ? +mL[1] : null;
  (planRate && planM !== null && planL !== null)
    ? ok(`PLAN §11.2 파싱 — 확률 [${planRate.join(', ')}]% · 천장 ${planM}회 · 피티 ${planL}회`)
    : bad('PLAN §11.2 의 확률/천장/피티 문장을 못 찾았다 — 문구가 바뀌었으면 ㉜ 파서를 함께 고칠 것');

  /* ---- 엔진 상수 추출 ---- */
  const grab = src => {
    const r = (src.match(/gachaRate:\s*\[([^\]]*)\]/) || [])[1];
    return {
      rate: r ? r.split(',').map(Number) : null,
      m: Number((src.match(/pityMyth:\s*(\d+)/) || [])[1]),
      l: Number((src.match(/pityLegend:\s*(\d+)/) || [])[1]),
    };
  };
  const S = grab(SIM), H = grab(HTML);

  /* ① PLAN ↔ 두 파일 3자 일치 */
  if (planRate) {
    for (const [nm, g] of [['sim.js', S], ['index.html', H]]) {
      const eq = g.rate && g.rate.length === 5 && g.rate.every((v, i) => v === planRate[i]);
      eq ? ok(`${nm} GT.gachaRate = PLAN 산문 [${planRate.join(', ')}]%`)
         : bad(`${nm} GT.gachaRate «${g.rate}» ≠ PLAN «${planRate}» — 상점이 거짓 확률을 광고한다 (주인 확정 상수)`);
      g.m === planM ? ok(`${nm} GT.pityMyth ${g.m} = PLAN «${planM}회 천장»`)
                    : bad(`${nm} GT.pityMyth ${g.m} ≠ PLAN ${planM}`);
      g.l === planL ? ok(`${nm} GT.pityLegend ${g.l} = PLAN «전설 ${planL}회 피티»`)
                    : bad(`${nm} GT.pityLegend ${g.l} ≠ PLAN ${planL}`);
    }
    const sum = planRate.reduce((a, b) => a + b, 0);
    Math.abs(sum - 100) < 1e-9 ? ok(`확률 5단 합 ${sum}% = 100%`)
                               : bad(`확률 5단 합이 ${sum}% 다 — 100% 가 아니면 최하 등급 비중이 조용히 어긋난다 (T25 «합 105%» 선례)`);
  }

  /* ② 두 파일이 서로 같다 */
  (S.rate && H.rate && String(S.rate) === String(H.rate) && S.m === H.m && S.l === H.l)
    ? ok('sim.js ↔ index.html 뽑기 상수 3종 일치')
    : bad(`두 파일의 뽑기 상수가 벌어졌다 — sim [${S.rate}]/${S.m}/${S.l} vs html [${H.rate}]/${H.m}/${H.l}`);

  /* ③ gachaPull 이 리터럴을 안 쓴다 */
  for (const [nm, src] of [['sim.js', SIM], ['index.html', HTML]]) {
    const body = src.slice(src.indexOf('function gachaPull(st){'));
    const fn = body.slice(0, body.indexOf('\n}') + 2);
    (/GT\.rarRoll\(/.test(fn) && /GT\.pityMyth/.test(fn) && /GT\.pityLegend/.test(fn))
      ? ok(`${nm} gachaPull 이 GT.rarRoll·pityMyth·pityLegend 를 쓴다`)
      : bad(`${nm} gachaPull 이 파생 상수를 안 쓴다 — 임계를 리터럴로 되돌리면 상점 안내문과 갈라진다 (T65 재발)`);
    /r\s*<\s*\d+\.?\d*\s*\?/.test(fn)
      ? bad(`${nm} gachaPull 에 누적 임계 리터럴(«r<0.1?…»)이 돌아왔다 — 단일 출처가 깨졌다`)
      : ok(`${nm} gachaPull 에 누적 임계 리터럴이 없다`);
  }

  /* ④ 파생 임계가 종전 리터럴과 비트 단위로 같다 */
  {
    const mCum = SIM.match(/GT\.gachaCum=\(\(\)=>\{[\s\S]*?\}\)\(\);/);
    const ctx = { GT: { gachaRate: S.rate } };
    vm.createContext(ctx);
    let cum = null;
    if (mCum) { try { vm.runInContext(mCum[0], ctx); cum = ctx.GT.gachaCum; } catch (e) { cum = null; } }
    const want = [100, 42.1, 12.1, 2.1, 0.1];
    (cum && cum.length === 5 && cum.every((v, i) => Object.is(v, want[i])))
      ? ok(`GT.gachaCum = [${want.join(', ')}] — 종전 리터럴 임계와 비트 단위로 같다 (1,000,000 뽑기 동치 확인, T65)`)
      : bad(`GT.gachaCum 이 «${cum}» 이다 — [${want.join(', ')}] 와 다르면 시드 재현성이 깨진다`);
  }

  /* ⑤ 상점 안내문이 리터럴을 안 쓴다 */
  {
    const mShop = HTML.match(/<div class="pity">[\s\S]*?<\/div>/);
    const shop = mShop ? mShop[0] : '';
    (/\$\{gachaRateText\(\)\}/.test(shop))
      ? ok('상점 확률 줄이 gachaRateText() 로 만들어진다')
      : bad('상점 확률 줄이 문자열 리터럴로 돌아왔다 — 임계를 손보면 거짓 확률을 광고한다 (T65 재발)');
    (/GT\.pityMyth/.test(shop) && /GT\.pityLegend/.test(shop))
      ? ok('상점 천장·피티 잔여 표시가 GT.pityMyth·GT.pityLegend 를 쓴다')
      : bad('상점 천장·피티 표시에 리터럴(«50-st.p50» 류)이 돌아왔다 — 천장을 올리면 «-9회» 가 화면에 뜬다');
    /[\d.]+\s*%/.test(shop)
      ? bad(`상점 안내문에 확률 숫자 리터럴이 남아 있다 — «${(shop.match(/[\d.]+\s*%/) || [])[0]}»`)
      : ok('상점 안내문에 확률 숫자 리터럴이 없다');
  }

  /* ⑥ gachaRateText() 실행 결과 ↔ PLAN 산문 */
  {
    const mFn = HTML.match(/function gachaRateText\(\)\{[\s\S]*?\n\}/);
    const ctx = { GT: { gachaRate: H.rate, rarName: RN } };
    vm.createContext(ctx);
    let txt = null;
    if (mFn) { try { vm.runInContext(mFn[0] + '\n__t=gachaRateText();', ctx); txt = ctx.__t; } catch (e) { txt = null; } }
    const want = planRate ? RN.map((nm, i) => `${nm} ${+planRate[i]}%`).reverse().join(' · ') : null;
    (txt && want && txt === want)
      ? ok(`gachaRateText() = «${txt}» (PLAN 산문과 등급·값·순서 일치)`)
      : bad(`gachaRateText() 가 «${txt}» 다 — PLAN 기준 «${want}» 여야 한다`);
  }
}

/* ============================================================================
   ㉝ 특전 본문이 살아 있다 — 툴팁이 약속한 효과가 실제로 코드에 있는가 (T66)

/* ---------- (구 T66 절 — 대상 소멸) ----------
   ⚑ P1(T83): 🎲 `r_refresh`(«특전 새로고침 횟수 +1»)는 주인 확정으로 **삭제**됐다.
   무료 새로고침 1회는 특전이 아니라 기본 기능으로 남는다(PLAN §3.0). 그래서 이 절은 «되살아났는가» 만 본다. */
console.log('\n[㉜ 🎲 새로고침 특전 폐지 — 되살아나지 않았는가]');
{
  (!/r_refresh/.test(SIM) && !/r_refresh/.test(HTML))
    ? ok('두 엔진 어디에도 새로고침 특전이 없다 (주인 확정 삭제)')
    : bad('🎲 새로고침 특전이 되살아났다 — 주인 확정 «삭제» 위반');
  /* ⚑⚑ T96 — 무료 새로고침은 «기본 기능» 으로도 폐지됐다(선택창 자체가 사라졌다).
     특전으로도 기능으로도 되살아나면 빨개진다. */
  (!/refreshLeft|refreshBonus/.test(SIM) && !/refreshLeft|refreshBonus/.test(HTML))
    ? ok('두 엔진에 새로고침 상태(refreshLeft·refreshBonus)가 없다 (주인 확정 폐지)')
    : bad('무료 새로고침이 되살아났다 — 주인 확정 «선택창·새로고침 폐지» 위반');
}


/* ---------- ㊲ 전투 무관 특전 금지 — 경제(골드·경험치)·이동속도류 (T77) ----------
   ⚑ 주인 확정(2026-09-03): «132종에서 🪙 c_gold30 · 💰 m_gold2 · 🌟 m_sage · 🏃 c_walk20 삭제.
   향후 경제/이속류 특전 추가 금지(흡혈·적중률 금지와 같은 축, 게이트 감시)».
   금지어 목록만 두면 «px 키를 새로 파서 우회하는» 되돌림을 못 잡으므로, 판정을 구조로 건다:
   특전의 ap 가 «대입하는 대상 집합» 이 전부 금지축(goldMul·px.sage·walkMul)이면 전투 무관 특전이다.
   🕰️ m_time 은 walkMul 과 함께 aspd(전투 스탯)를 올리므로 이 판정을 통과한다 — 주인 삭제 목록에도 없다.
   ※ 장비 옵션(GOPT)에는 골드·경험치 옵션이 그대로 있다. 주인 지시는 «특전» 축이므로 여기서 보지 않는다. */
console.log('\n[㊲ 전투 무관 특전 금지 — 경제·이속류 (T77 · 주인 확정 2026-09-03)]');
{
  const GONE = ['c_gold30', 'm_gold2', 'm_sage', 'c_walk20'];
  const BAN = { goldMul: '경제(골드)', sage: '경제(경험치)', walkMul: '이동속도' };
  const PLANTXT77 = fs.readFileSync(path.join(ROOT, 'PLAN.md'), 'utf8');
  const S77 = simPerks(), H77 = htmlPerks() || [];

  /* ① 삭제된 4종이 어디서도 되살아나지 않는다 (두 엔진 + PLAN §3 표) */
  {
    const back = [];
    for (const id of GONE) {
      if (S77.some(p => p.id === id)) back.push(`sim.js:${id}`);
      if (H77.some(p => p.id === id)) back.push(`index.html:${id}`);
      if (new RegExp('^\\|\\s*' + id + '\\s*\\|', 'm').test(PLANTXT77)) back.push(`PLAN §3:${id}`);
    }
    back.length === 0
      ? ok(`① 주인 확정 삭제 4종(${GONE.join(', ')}) 이 두 엔진·PLAN §3 어디에도 없다`)
      : bad(`① 삭제된 특전이 되살아났다: ${back.join(' · ')}`);
  }

  /* ap 가 «대입하는 대상» 집합 — p.<키> / p.px.<키> 양쪽 */
  const targets = ap => {
    const out = new Set();
    for (const m of String(ap || '').matchAll(/p\.(?:px\.)?([A-Za-z0-9_]+)\s*(\+\+|--|\+=|-=|\*=|\/=|=(?!=))/g)) out.add(m[1]);
    return out;
  };
  /* ② 전투 기여가 0 인 특전 0종 — 대입 대상이 전부 금지축이면 그건 전투 무관 특전이다 */
  for (const [nm, arr] of [['sim.js', S77], ['index.html', H77]]) {
    const hit = [];
    for (const p of arr) {
      const t = [...targets(p.ap)];
      if (t.length === 0) continue;                       // 대입이 없는 특전(🎲 r_refresh 류)은 T66 관할
      if (t.every(k => BAN[k])) hit.push(`${p.id}(${t.map(k => BAN[k]).join('+')})`);
    }
    hit.length === 0
      ? ok(`② ${nm} — 전투 기여 없이 금지축(골드·경험치·이동속도)만 올리는 특전 0종`)
      : bad(`② ${nm} — 전투 무관 특전 ${hit.length}종: ${hit.join(', ')} — 주인 확정으로 금지된 축이다`);
  }
  /* ③ 두 파일이 같은 판정을 받는다 (한쪽만 되돌아가는 것 방지) */
  {
    const key = arr => arr.filter(p => [...targets(p.ap)].some(k => BAN[k])).map(p => p.id).sort().join(',');
    const a = key(S77), b = key(H77);
    a === b
      ? ok(`③ 금지축을 건드리는 특전 집합이 두 파일에서 동일 (${a || '없음'})`)
      : bad(`③ 금지축 특전 집합 불일치 — sim.js [${a}] vs index.html [${b}]`);
  }
  /* ④ 표시 문구 금지어 — 특전 tx·PLAN §3 표에 «골드»·«경험치» 0건
     (이동속도는 m_time 이 정당하게 쓰므로 ② 의 구조 판정이 담당한다) */
  {
    const WORD = /골드|경험치|gold|exp획득/i;
    const txHit = H77.filter(p => WORD.test(p.tx)).map(p => p.id);
    const planHit = [];
    for (const line of PLANTXT77.split('\n')) {
      const m = line.match(/^\|\s*([a-z]_[A-Za-z0-9]+)\s*\|\s*(.+?)\s*\|/);
      if (m && WORD.test(m[2])) planHit.push(m[1]);
    }
    (txHit.length === 0 && planHit.length === 0)
      ? ok('④ 특전 표시 문구·PLAN §3 표에 «골드»·«경험치» 0건')
      : bad(`④ 경제 문구가 특전에 남았다 — index.html tx [${txHit.join(', ')}] · PLAN §3 [${planHit.join(', ')}]`);
  }
  /* ⚑ T96 — ⑤ «등급별 개수» 는 등급이 폐지되어 대상이 사라졌다. 개수·순서는 verifyPerkOrder 가 본다. */
}

/* ---------- ㊳ 주기형 회복 금지 (T79 · 주인 확정 2026-09-03) ----------
   ⚑ «N초마다 체력 회복 / 실드 수리» 류 시간 경과형 회복은 특전·장비 옵션에 존재 금지(예방 조항 —
   현행 목록엔 원래 없다). 시간형 «공격» 은 허용이다(⚡👑 뇌신 2.4초마다 번개 · 💫🌀 위압 2.5초마다 기절).
   그래서 «초마다» 라는 낱말이 아니라 **주기 블록의 몸통이 무엇을 하는가** 로 본다:
   두 엔진의 주기 패턴 `X -= dt; if (X <= 0) { X = <주기>; …몸통… }` 을 전부 떠서
   몸통에 회복·실드 충전이 들어 있으면 빨개진다. 문구 쪽은 «초마다 … 회복/수리/충전» 을 따로 막는다. */
console.log('\n[㊳ 주기형 회복 금지 — «N초마다 회복/수리» (T79 · 주인 확정 2026-09-03)]');
{
  /* 주기 블록 몸통 뽑기 — `<이름> -= dt` 다음에 오는 `if(<이름><=0){ … }` 의 중괄호를 세어 자른다 */
  const periodicBodies = src => {
    const out = [];
    const re = /([A-Za-z_$][\w.$]*)\s*-=\s*dt\s*;/g;
    let m;
    while ((m = re.exec(src))) {
      const name = m[1];
      const rest = src.slice(m.index + m[0].length, m.index + m[0].length + 4000);
      const gm = rest.match(new RegExp('^\\s*if\\s*\\(\\s*' + name.replace(/[.$]/g, '\\$&') + '\\s*<=\\s*0\\s*\\)\\s*\\{'));
      if (!gm) continue;
      let i = gm[0].length, d = 1, body = '';
      while (i < rest.length && d > 0) {
        const ch = rest[i];
        if (ch === '{') d++;
        if (ch === '}') { d--; if (d === 0) break; }
        body += ch; i++;
      }
      out.push({ name, body });
    }
    return out;
  };
  const HEALCALL = /\bheal\s*\(|\.hp\s*\+=|\.sh\s*=\s*Math\.min|\.sh\s*\+=|gainWard\s*\(/;
  for (const [nm, src] of [['sim.js', SIM], ['index.html', HTML]]) {
    const bodies = periodicBodies(src);
    const hit = bodies.filter(b => HEALCALL.test(b.body)).map(b => b.name);
    if (bodies.length === 0) bad(`① ${nm} — 주기 블록을 하나도 못 찾았다 (파서가 낡았다: 뇌신·위압이 있어야 정상)`);
    else if (hit.length === 0) ok(`① ${nm} — 주기 블록 ${bodies.length}개(${bodies.map(b => b.name).join(', ')}) 전부 회복·실드 충전 없음`);
    else bad(`① ${nm} — 주기형 회복이 생겼다: ${hit.join(', ')} — 주인 확정으로 금지된 축이다(시간형 «공격» 만 허용)`);
  }
  /* ② 문구 금지 — 특전 tx · PLAN §3·§11.6 표 칸 · GOPT 설명문.
     ⚑ 태그를 먼저 걷어낸다 — «3초마다 체력 <b>3%</b> 회복» 처럼 <b> 하나로 검사를 빠져나가지 못하게. */
  {
    const strip = t => String(t).replace(/<[^>]+>/g, '');
    const PERIOD_HEAL = /(\d+(?:\.\d+)?\s*초\s*마다|주기적으로|일정\s*시간\s*마다)[^\n]{0,24}(회복|수리|충전)/;
    const hits = t => PERIOD_HEAL.test(strip(t));
    const H79 = htmlPerks() || [];
    const txHit = H79.filter(p => hits(p.tx)).map(p => p.id);
    const PL79 = fs.readFileSync(path.join(ROOT, 'PLAN.md'), 'utf8');
    /* PLAN 은 «표 칸» 단위로 본다 — 한 줄 안의 다른 칸과 섞여 우연히 걸리거나 새어나가지 않게 */
    const planHit = PL79.split('\n').filter(l => l.startsWith('|'))
      .flatMap(l => l.split('|')).filter(hits).length;
    /* 장비 옵션 설명문 — GOPT 의 d: '…' 전수 */
    const optHit = (HTML.match(/d\s*:\s*'([^']*)'/g) || []).filter(hits);
    (txHit.length === 0 && planHit === 0 && optHit.length === 0)
      ? ok(`② 특전 문구 ${H79.length}종·PLAN 표 칸·장비 옵션 설명문에 «N초마다 … 회복/수리/충전» 0건`)
      : bad(`② 주기형 회복 문구가 있다 — 특전 [${txHit.join(', ')}] · PLAN 표 ${planHit}칸 · 장비 옵션 [${optHit.join(' | ')}]`);
  }
}

/* ---------- ㊴ 이벤트/팝업 열림 중 게임 시간 완전 정지 (T79 · 불변 규약 승격) ----------
   ⚑ 주인 확정(2026-09-03): 쉼터·악마·천사·레벨업·일시정지 등 팝업이 떠 있는 동안 게임 시간이 흐르면
   «쉼터 무한 대기» 로 회복·쿨다운을 공짜로 벌 수 있다. 그래서 세 고리를 전부 못박는다:
   ① 팝업을 여는 자리는 openOverlay 하나뿐이고 거기서 G.paused=true, 닫을 때 false
   ② 메인 루프가 G.paused 일 때 update(dt) 를 아예 안 부른다(그려주기만 한다)
   ③ 게임 시계 G.t 는 update 안에서만 흐른다. */
console.log('\n[㊴ 이벤트/팝업 중 게임 시간 정지 — 불변 규약 (T79)]');
{
  const H = HTML.replace(/\/\*[\s\S]*?\*\//g, '');
  const openOK = /function openOverlay\([^)]*\)\s*\{[\s\S]{0,400}?G\.paused\s*=\s*true;[\s\S]{0,40}?\}/.test(H);
  openOK ? ok('① openOverlay() 가 G.paused = true 로 시간을 세운다')
    : bad('① openOverlay() 안에서 G.paused = true 를 못 찾았다 — 팝업이 떠도 게임이 계속 돈다');
  const closeOK = /function closeOverlay\(\)\s*\{[\s\S]{0,300}?G\.paused\s*=\s*false;[\s\S]{0,20}?\}/.test(H);
  closeOK ? ok('② closeOverlay() 가 G.paused = false 로 되돌린다')
    : bad('② closeOverlay() 가 G.paused 를 안 되돌린다');
  /* ③ 오버레이를 여는 다른 뒷문이 없다 — ov.classList.add('on') 은 openOverlay 안에서만 */
  const addOn = (H.match(/ov\.classList\.add\(\s*'on'\s*\)/g) || []).length;
  addOn === 1 ? ok("③ 오버레이를 켜는 자리는 openOverlay 한 곳뿐 (ov.classList.add('on') 1건)")
    : bad(`③ ov.classList.add('on') 이 ${addOn}곳 — openOverlay 를 우회해 팝업을 열면 시간이 안 멈춘다`);
  /* ④ 메인 루프: update 는 !G.paused 일 때만 */
  const loopOK = /if\s*\(\s*!G\.paused\s*&&\s*!G\.over\s*\)\s*update\(/.test(H);
  loopOK ? ok('④ 메인 루프가 !G.paused && !G.over 일 때만 update(dt) 를 부른다')
    : bad('④ 메인 루프의 update 호출이 G.paused 로 막혀 있지 않다');
  /* ⑤ update 호출은 그 한 자리뿐 (다른 곳에서 시간을 밀지 않는다) */
  const upN = (H.match(/(?<!function\s)(?<![\w.])update\s*\(\s*dt/g) || []).length;
  upN === 1 ? ok('⑤ update(dt) 호출은 한 자리뿐')
    : bad(`⑤ update(dt) 호출이 ${upN}곳 — 정지 중에 시간을 미는 우회로가 생겼다`);
  /* ⑥ 게임 시계 G.t 는 update 안에서만 흐른다 (두 파일 공통) */
  for (const [nm, src] of [['sim.js', SIM], ['index.html', HTML]]) {
    const n = (src.match(/G\.t\s*\+=/g) || []).length;
    n === 1 ? ok(`⑥ ${nm} — 게임 시계 G.t 를 미는 자리 1곳`)
      : bad(`⑥ ${nm} — G.t 를 미는 자리가 ${n}곳이다 (1곳이어야 한다)`);
  }
}

/* ---------- ㊵ 특전 선택창 «보유 특전» 버튼 (T89 · 주인 지시 2026-09-03) ----------
   ⚑ 주인 지시: 레벨업 선택창 **오른쪽 하단**에 📘 버튼 — 누르면 이번 런에서 얻은 특전 목록을 보여주고,
   닫으면 **선택창으로 복귀**한다(«선택지를 고르기 전에 내가 뭘 갖고 있는지 확인»).
   이 기능이 조용히 망가지는 길은 셋이고 전부 여기서 막는다:
   ① 책을 닫을 때 closeOverlay 를 부르면 → 레벨업 특전 선택이 통째로 날아간다
   ② 복귀가 roll() 이면 → 선택지가 다시 굴려져 «보고 나서 고른다» 가 성립하지 않는다(새로고침 무료 무한)
   ③ 버튼을 절대 배치로 띄우면 → 좁은 화면에서 카드·새로고침 위에 올라탄다(주인 «겹치지 않는 위치»)
   덧붙여 이 작업은 UI 전용이라 sim.js 에 흔적이 없어야 한다(밸런스 영향 0). */
console.log('\n[㊵ 레벨업 팝업 «보유 특전» 버튼 (T89 · ⚑ T96 에서 선택창 → 레벨업 팝업으로 이관)]');
{
  /* 함수 본문을 중괄호를 세어 정확히 뜬다 (문자열 안의 괄호에 속지 않게 따옴표·백틱을 건너뛴다) */
  const fnBody = (src, name) => {
    const m = new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{').exec(src);
    if (!m) return null;
    let i = m.index + m[0].length, d = 1, q = null, out = '';
    for (; i < src.length && d > 0; i++) {
      const ch = src[i], pv = src[i - 1];
      if (q) { out += ch; if (ch === q && pv !== '\\') q = null; continue; }
      if (ch === "'" || ch === '"' || ch === '`') { q = ch; out += ch; continue; }
      if (ch === '{') d++;
      if (ch === '}') { d--; if (d === 0) break; }
      out += ch;
    }
    return out;
  };
  const choice = fnBody(HTML, 'openLevelUp');   /* ⚑ T96 — 선택창(openPerkChoice) → 레벨업 팝업(openLevelUp) */
  const book = fnBody(HTML, 'openPerkBook');
  if (!choice || !book) bad('① openPerkChoice / openPerkBook 을 못 찾았다 (T89 대상 함수가 사라졌다)');
  else {
    /* ① 버튼 존재 + 오른쪽 하단 줄(.ov-foot) 안 */
    const inFoot = /<div class="ov-foot"><button id="perkBookBtn">/.test(choice.replace(/\s+/g, ' '));
    inFoot ? ok('① 레벨업 팝업에 #perkBookBtn 이 있고 오른쪽 정렬 줄(.ov-foot) 안에 있다')
      : bad('① 레벨업 팝업의 #perkBookBtn 이 없거나 .ov-foot 줄 밖으로 나갔다 (주인 지시: 오른쪽 하단)');
    /* ② 버튼이 보유 특전 개수를 함께 보여준다 */
    /<button id="perkBookBtn">[^<]*<b>\$\{G\.perksTaken\.length\}<\/b>/.test(choice)
      ? ok('② 버튼이 보유 특전 개수(G.perksTaken.length)를 표시한다')
      : bad('② 버튼에 보유 특전 개수 표시가 없다');
    /* ③ 눌렀을 때 openPerkBook 에 «복귀 콜백» 을 넘긴다 — 그 콜백이 paint(다시 그리기)여야 한다 */
    /\$\('perkBookBtn'\)\.onclick\s*=\s*e\s*=>\s*\{\s*e\.stopPropagation\(\);\s*openPerkBook\(\s*paint\s*\);?\s*\}/.test(choice)
      ? ok('③ 📘 버튼이 stopPropagation 후 openPerkBook(paint) — 복귀 콜백을 넘긴다')
      : bad('③ 📘 버튼이 복귀 콜백(paint)을 안 넘기거나 stopPropagation 이 빠졌다 — 책이 열리자마자 되돌아가거나 복귀가 끊긴다');
    /* ④ ⚑ 핵심(⚑ T117 판): 굴림(offerPerks)은 paint «밖» 에서 딱 한 번이다. paint 안에 있으면
       책을 드나들 때마다 선택지가 다시 굴려져 «무료 무한 새로고침» 이 된다 — T89 가 못 박은 실패 경로 ② 그대로다
       (T96 순서 지급 시절에는 같은 자리가 «중복 지급» 으로 나타났다). */
    const grantN = (choice.match(/offerPerks\s*\(/g) || []).length;
    const paintM = /const paint\s*=\s*\(\)\s*=>\s*\{/.exec(choice);
    let paintBody = '';
    if (paintM) {
      let i = paintM.index + paintM[0].length, d = 1, q = null;
      for (; i < choice.length && d > 0; i++) {
        const ch = choice[i], pv = choice[i - 1];
        if (q) { paintBody += ch; if (ch === q && pv !== '\\') q = null; continue; }
        if (ch === "'" || ch === '"' || ch === '`') { q = ch; paintBody += ch; continue; }
        if (ch === '{') d++;
        if (ch === '}') { d--; if (d === 0) break; }
        paintBody += ch;
      }
    }
    if (!paintM) bad('④ openLevelUp 안에 paint(다시 그리기) 가 없다 — 복귀가 곧 재지급이 된다');
    else if (grantN !== 1) bad(`④ openLevelUp 안의 offerPerks 호출이 ${grantN}곳 (1곳이어야 한다)`);
    else if (/offerPerks\s*\(/.test(paintBody)) bad('④ paint 가 offerPerks 를 부른다 — 책을 닫고 돌아올 때마다 선택지가 다시 굴려진다(무료 새로고침)');
    else ok('④ 굴림은 paint 밖 한 곳뿐 — 책을 드나들어도 선택지가 안 바뀐다');
    /* ⑤ ⚑ 복귀 모드에서는 closeOverlay 를 부르지 않는다 (부르면 레벨업 특전이 통째로 날아간다) */
    const closeCalls = [...book.matchAll(/closeOverlay\s*\(\s*\)/g)];
    const guarded = closeCalls.every(m => /ret\s*\?\s*ret\(\)\s*:\s*$/.test(book.slice(Math.max(0, m.index - 24), m.index)));
    (closeCalls.length === 1 && guarded)
      ? ok('⑤ 책의 closeOverlay 는 «복귀 콜백이 없을 때만» 불린다 (레벨업 팝업에서 열면 팝업을 안 날린다)')
      : bad(`⑤ openPerkBook 의 closeOverlay 호출 ${closeCalls.length}건이 복귀 콜백 가드 밖에 있다 — 레벨업 팝업에서 책을 닫으면 팝업이 날아간다`);
    /* ⑥ 복귀 모드 판별은 «함수인가» 로 한다 — HUD 버튼이 클릭 이벤트를 넘겨도 오작동하지 않게 */
    /typeof\s+back\s*===\s*'function'/.test(book)
      ? ok("⑥ 복귀 모드 판별이 typeof back === 'function' (클릭 이벤트가 들어와도 안전)")
      : bad('⑥ 복귀 모드 판별이 없다 — HUD 📘 버튼이 이벤트를 넘기면 오작동한다');
    /* ⑦ 책이 열려 있는 동안에도 시간 정지 유지 — 책은 openOverlay 로 «내용만» 갈아끼운다.
       (ov.classList.add('on') 이 openOverlay 한 곳뿐인 것은 ㊴③ 이 전역으로 본다) */
    /openOverlay\s*\(/.test(book) && !/closeOverlay\s*\(\s*\)\s*;\s*openOverlay/.test(book.replace(/\s+/g, ' '))
      ? ok('⑦ 책은 openOverlay 로 내용만 교체한다 — G.paused 가 한 프레임도 안 풀린다 (T79 규약)')
      : bad('⑦ 책이 closeOverlay → openOverlay 로 다시 여는 경로다 — 정지가 풀리는 틈이 생긴다');
  }
  /* ⑧ 겹침 방지의 근거 = 흐름(flow) 배치. .ov-foot 가 절대·고정 배치면 좁은 화면에서 카드 위에 올라탄다 */
  const foot = /\.ov-foot\s*\{([^}]*)\}/.exec(HTML);
  if (!foot) bad('⑧ .ov-foot CSS 규칙이 없다');
  else if (/position\s*:\s*(absolute|fixed)/.test(foot[1])) bad('⑧ .ov-foot 가 절대·고정 배치다 — 카드와 겹칠 수 있다 (주인 «겹치지 않는 위치»)');
  else if (!/justify-content\s*:\s*flex-end/.test(foot[1])) bad('⑧ .ov-foot 가 오른쪽 정렬이 아니다 (주인 지시: 오른쪽 하단)');
  else ok('⑧ .ov-foot = 흐름 배치 + 오른쪽 정렬 — 카드·새로고침과 구조적으로 안 겹친다');
  /* ⑨ UI 전용 = sim.js 무관 (밸런스 영향 0) */
  /(openPerkBook|perkBookBtn|ov-foot)/.test(SIM)
    ? bad('⑨ sim.js 에 T89 UI 흔적이 있다 — UI 전용 작업이라 시뮬은 무수정이어야 한다')
    : ok('⑨ sim.js 에 T89 흔적 0 — UI 전용, 밸런스 영향 0');
}

console.log('\n[㊶ T125 ①-c «↑ 표시» — 인벤에 더 좋은 게 있을 때만 (T129)]');
{
  /* 주인 21:2X 위임 기본값의 **나머지 절반**이다: «지금 낀 것보다 좋은(등급·강화) 장비가 인벤에 있으면
     부위 칸에 ↑ 표시만(자동은 아님)». T127 이 자동 장착을, T128 이 NEW 뱃지를 메웠고 이 축만 비어 있었다 —
     T129 실측: `slotCardHTML` 의 ↑ 를 통째로 지운 사본에서 **정적 19종·T3 4스위트가 전부 초록**이었다.
     ①② 는 표시 자리(두 갈래 모두)를, ③ 은 «더 좋은» 의 **판정을 실제로 실행해서** 본다
     (㉒(5) fuseMake 행동 대조와 같은 방식 — 이름·문구 grep 은 T127 이 겪은 대로 이름만 바꾸면 뚫린다). */
  const CODE = HTML.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const sc = /function slotCardHTML\(pt\)\{[\s\S]*?\n\}/.exec(CODE);
  if (!sc) bad('① slotCardHTML 을 찾지 못했다 — 게이트를 갱신할 것');
  else {
    const body = sc[0];
    const rets = body.match(/return `[\s\S]*?`;/g) || [];
    const marked = rets.filter(r => /\$\{up\}/.test(r));
    /betterInInv\s*\(\s*pt\s*\)\s*\?/.test(body)
      ? ok('① 슬롯 칸의 ↑ 는 betterInInv(pt) 로 계산된다 (상시 표시·하드코딩이 아니다)')
      : bad('① 슬롯 칸이 betterInInv(pt) 를 안 쓴다 — ↑ 가 사라졌거나 늘 떠 있다 (T125 ①-c)');
    (rets.length === 2 && marked.length === 2)
      ? ok('② 빈 칸·장착 칸 두 갈래 모두 ↑ 를 단다 (한쪽 갈래만 다는 회귀 방지)')
      : bad(`② 슬롯 칸 ${rets.length}갈래 중 ↑ 를 다는 갈래가 ${marked.length}개다 — 두 갈래 모두여야 한다 (T125 ①-c)`);
    /* ③ 행동 대조 — betterInInv 를 꺼내 실제로 돌린다. 보는 것은 «경계» 다:
       같은 등급·강화는 «더 좋은» 이 **아니고**(그때 ↑ 가 뜨면 유저가 헛장착을 한다),
       등급이 위이거나 같은 등급에 강화가 위면 «더 좋은» 이다(주인 원문 «좋은(등급·강화)»). */
    const bi = /function betterInInv\(pt\)\{[\s\S]*?\n\}/.exec(CODE);
    const gs = /const gearScore=([^;]+);/.exec(CODE);
    if (!bi) bad('③ betterInInv 를 찾지 못했다 — 게이트를 갱신할 것');
    else if (!gs) bad('③ gearScore 정의를 찾지 못했다 — 게이트를 갱신할 것');
    else {
      const run = new Function('save', `
        const gearScore=${gs[1]};
        const invById=u=>save.inv.find(g=>g.u===u)||null;
        const equippedGear=pt=>invById(save.eq[pt]);
        const isEquipped=g=>save.eq[g.part]===g.u;
        ${bi[0]}
        return betterInInv('weapon');`);
      const mk = (u, rar, plus) => ({ u, part: 'weapon', type: 'crit_weapon', rar, plus });
      const cases = [
        ['장착만 있고 인벤에 후보가 없으면 ↑ 없음', { inv: [mk(1, 3, 0)], eq: { weapon: 1 } }, false],
        ['같은 등급·같은 강화는 «더 좋은» 이 아니다', { inv: [mk(1, 3, 0), mk(2, 3, 0)], eq: { weapon: 1 } }, false],
        ['등급이 위면 ↑', { inv: [mk(1, 3, 0), mk(2, 4, 0)], eq: { weapon: 1 } }, true],
        ['같은 등급이라도 강화가 위면 ↑', { inv: [mk(1, 3, 0), mk(2, 3, 1)], eq: { weapon: 1 } }, true],
        ['등급이 아래면 강화가 높아도 ↑ 없음 (신화0 > 전설9)', { inv: [mk(1, 4, 0), mk(2, 3, 9)], eq: { weapon: 1 } }, false],
        ['빈 부위에 그 부위 장비가 있으면 ↑', { inv: [mk(1, 0, 0)], eq: {} }, true],
        ['빈 부위이고 그 부위 장비도 없으면 ↑ 없음', { inv: [], eq: {} }, false],
      ];
      let miss = 0;
      for (const [n, sv, want] of cases) {
        let got; try { got = run(sv); } catch (e) { got = `throw:${e.message}`; }
        if (got !== want) { miss++; bad(`③ betterInInv — ${n} (기대 ${want} · 실제 ${got})`); }
      }
      if (!miss) ok(`③ betterInInv 행동 대조 ${cases.length}건 — «더 좋은» = 등급 우선, 같으면 강화 (같은 값은 «더 좋은» 이 아니다)`);
    }
  }
}

/* ---------- 결과 ---------- */
console.log(`\n통과 ${pass} · 불합격 ${fail}`);
console.log(fail === 0 ? '→ 통과' : '→ 불합격');
process.exit(fail === 0 ? 0 : 1);
