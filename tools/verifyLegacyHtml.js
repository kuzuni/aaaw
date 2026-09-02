'use strict';
/* «주인이 폐지한 동작이 배포 빌드에 살아 있는가» 자동 게이트 (T33 신설)
   사용: node tools/verifyLegacyHtml.js            (위반이 있으면 exit 1)
         node tools/verifyLegacyHtml.js --list     (탐지한 무료 회복 지점 전부 덤프)
         node tools/verifyLegacyHtml.js --selftest (게이트가 실제로 빨개지는지 음성 대조)

   왜 필요한가 — 기존 게이트 8종은 **전부 `sim.js`·`PLAN.md` 만 본다**:
     verifyPlanConst(T16) 경제·적 상수 · verifyOptText(T17) 설명문 · verifySaturation(T19) 포화
     · verifyPerkGearDup(T24) 특전↔장비 px 중복 · verifyPerkPolicy(T25) 선택 정책
     · verifyCombatConst(T27) 전투 코어 상수 · verifyGearEcon(T29) 장비 경제 동작
     · verifyScoreCriteria(T30) 채점 기준.
   그런데 **주인이 실제로 보는 것은 GitHub Pages 로 나가는 `index.html`** 이고, 그 축은 무검사였다.
   실제 사고: «웨이브 전멸 실드 무료충전 폐지»(06:5X 지시)가 sim.js 에만 반영된 채 구버전에 남아
   주인이 배포 빌드에서 **또 관측**했고, 긴급 핫픽스로 T32 가 제거했다. 같은 일이 재발하지 않도록
   «폐지된 무료 회복» 축만 좁게 고정한다.

   보는 것 3가지 (전부 주인 확정 스펙 — PLAN §2.3·§2.4):
     ① 웨이브(보스 제외) 전멸 블록에 체력·실드 회복이 없다.
     ② 레벨업 경로(gainExp → openPerkChoice → takePerk → afterPerk)에 회복·최대치 보정이 없다.
        «레벨업 = 특전 선택뿐». 특전 효과인 `px.perkHp` 줄만 예외.
     ③ 풀충전(`X.sh = X.maxSh` / `X.hp = X.maxHp`)은 **특전 정의(PERKS 배열) 안에서만** 허용.
        비율 회복(`*0.5` 등, 부활 특전)은 풀충전이 아니라 대상 밖이다.
   ④ 부수로 sim.js 도 같은 잣대로 본다 — 두 파일이 이 축에서 갈라지는 순간이 사고의 시작이다.

   범위 제한: 이 게이트는 T2(index.html 전면 이식)의 대체물이 아니다. 폐지 동작 재도입만 본다.
   흡혈 특전 제거·버프 아이콘 등 «아직 안 한 T2 작업» 은 여기서 실패로 세지 않는다(지금 빨개져도
   고칠 수 있는 워커가 없어 게이트가 무의미해진다). */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const LIST = process.argv.includes('--list');
const SELFTEST = process.argv.includes('--selftest');

/* ── 소스 준비 ────────────────────────────────────── */
function scriptsOf(html) {
  const out = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out.join('\n;\n');
}

/* 균형 잡힌 블록 추출: from 위치의 다음 '{' 부터 짝이 맞는 '}' 까지 */
function blockAt(src, from) {
  const i = src.indexOf('{', from);
  if (i < 0) return null;
  let d = 0;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '{') d++;
    else if (c === '}') { d--; if (d === 0) return src.slice(i, j + 1); }
  }
  return null;
}

function funcBody(src, name) {
  const i = src.search(new RegExp('function\\s+' + name + '\\s*\\('));
  if (i < 0) return null;
  const p = src.indexOf(')', i);
  if (p < 0) return null;
  return blockAt(src, p);
}

/* 웨이브 전멸 블록: `...enemies.every(...)` 조건의 if 본문 */
function waveClearBlock(src) {
  const i = src.search(/enemies\s*\.\s*every\s*\(/);
  if (i < 0) return null;
  return blockAt(src, i);
}

/* PERKS 정의 배열(특전표) 구간 — 여기 안의 풀충전은 특전 효과라 정상 */
function perkTableRange(src) {
  const i = src.search(/const\s+PERKS\s*=\s*\[/);
  if (i < 0) return null;
  const s = src.indexOf('[', i);
  let d = 0;
  for (let j = s; j < src.length; j++) {
    const c = src[j];
    if (c === '[') d++;
    else if (c === ']') { d--; if (d === 0) return [s, j]; }
  }
  return null;
}

/* ── 탐지 규칙 ────────────────────────────────────── */
/* 풀충전: 같은 객체의 현재값 = 최대값. 뒤에 연산자가 붙으면(=비율 회복) 제외. */
const FULL = /([\w.]+)\.(sh|hp)\s*=\s*\1\.(maxSh|maxHp)\s*(?![*/+\-.\w])/g;
/* 레벨업 경로에서 금지: 회복 호출·풀충전·최대치 증가 */
const LEVEL_BAN = [
  { re: /healPlayer\s*\(/, why: '회복 호출' },
  { re: /\.(sh|hp)\s*=\s*[\w.]+\.(maxSh|maxHp)/, why: '풀충전' },
  { re: /\.(maxSh|maxHp)\s*[*+]=/, why: '최대치 보정' },
];
/* 웨이브 전멸 블록에서 금지 */
const WAVE_BAN = [
  { re: /\.(sh|hp)\s*=/, why: '체력·실드 대입' },
  { re: /healPlayer\s*\(/, why: '회복 호출' },
];

function lineNoOf(src, idx) { return src.slice(0, idx).split('\n').length; }

function checkSource(label, src, opt) {
  opt = opt || {};
  const fails = [];
  const found = [];

  /* ① 웨이브 전멸 블록 */
  const wave = waveClearBlock(src);
  if (wave === null && opt.requireWaveBlock) fails.push(`${label}: 파싱 실패 — 웨이브 전멸 블록(enemies.every)을 못 찾았다`);
  else if (wave) for (const b of WAVE_BAN) {
    for (const ln of wave.split('\n')) {
      if (b.re.test(ln)) fails.push(`${label}: 웨이브 전멸 블록에 ${b.why} — «${ln.trim()}» (폐지 지시 06:5X·08:5X)`);
    }
  }

  /* ② 레벨업 경로 */
  let seen = 0;
  for (const fn of opt.levelFns) {
    const body = funcBody(src, fn);
    if (body === null) continue;
    seen++;
    for (const ln of body.split('\n')) {
      if (/px\.perkHp/.test(ln)) continue;               // 특전 효과라 예외
      for (const b of LEVEL_BAN) {
        if (b.re.test(ln)) fails.push(`${label}: 레벨업 경로 ${fn}() 에 ${b.why} — «${ln.trim()}» (레벨업=특전 선택뿐, 지시 06:4X)`);
      }
    }
  }
  if (seen === 0) fails.push(`${label}: 파싱 실패 — 레벨업 경로 함수(${opt.levelFns.join('/')})를 하나도 못 찾았다`);

  /* ③ 풀충전 위치 */
  const pr = opt.perkTable ? perkTableRange(src) : null;
  if (opt.perkTable && pr === null) fails.push(`${label}: 파싱 실패 — PERKS 정의 배열을 못 찾았다`);
  FULL.lastIndex = 0;
  let m;
  while ((m = FULL.exec(src))) {
    const at = m.index;
    const inPerk = pr && at > pr[0] && at < pr[1];
    const line = src.slice(src.lastIndexOf('\n', at) + 1, src.indexOf('\n', at)).trim();
    found.push({ ln: lineNoOf(src, at), inPerk, line });
    if (!inPerk) fails.push(`${label}: 특전 정의 밖 풀충전 — L${lineNoOf(src, at)} «${line}»`);
  }

  return { fails, found };
}

/* ── 실행 ─────────────────────────────────────────── */
const HTML_RAW = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const HTML = scriptsOf(HTML_RAW);
const SIM = fs.readFileSync(path.join(root, 'sim.js'), 'utf8');

if (!HTML.trim()) { console.log('파싱 실패 — index.html 에서 <script> 를 못 뽑았다'); process.exit(1); }

const targets = [
  { label: 'index.html', src: HTML, opt: { levelFns: ['gainExp', 'openPerkChoice', 'takePerk', 'afterPerk'], perkTable: true, requireWaveBlock: true } },
  /* sim.js 는 특전이 add('id',등급,ap) 형태라 PERKS 배열이 없다 → 풀충전은 전부 위반으로 본다.
     현재 sim.js 에는 풀충전이 «빌드 셋업(mkPlayer 마무리)» 한 곳뿐이라 그 함수만 대상에서 뺀다. */
  { label: 'sim.js', src: SIM.replace(/function\s+mkPlayer[\s\S]*?\n}\n/, '\n'), opt: { levelFns: ['gainExp'], perkTable: false, requireWaveBlock: false } },
];

console.log('[T33] 배포 빌드 «폐지 동작 재도입» 게이트');
let fails = [];
for (const t of targets) {
  const r = checkSource(t.label, t.src, t.opt);
  fails = fails.concat(r.fails);
  const wb = waveClearBlock(t.src) ? '있음' : '없음(해당 분기 자체가 없다)';
  console.log(`  ${t.label}: 웨이브 전멸 블록 ${wb} · 풀충전 지점 ${r.found.length}개 (특전 정의 안 ${r.found.filter(f => f.inPerk).length}) · 위반 ${r.fails.length}`);
  if (LIST) for (const f of r.found) console.log(`      L${f.ln} ${f.inPerk ? '[특전]' : '[!!]'} ${f.line}`);
}

/* ④ 음성 대조 — 폐지된 코드를 되살리면 게이트가 실제로 잡는가 */
if (SELFTEST) {
  console.log('');
  console.log('[--selftest] 폐지 동작을 되살린 사본으로 게이트가 빨개지는지 확인');
  const opt = targets[0].opt;
  const cases = [
    ['웨이브 전멸 실드 충전 부활', HTML.replace(/(enemies\s*\.\s*every\s*\([\s\S]{0,80}?\{)/, '$1 p.sh=p.maxSh;')],
    ['레벨업 풀충전 부활', HTML.replace(/(function\s+afterPerk\s*\(\s*\)\s*\{)/, '$1 G.player.hp=G.player.maxHp;')],
    ['레벨업 최대체력 증가 부활', HTML.replace(/(function\s+gainExp\s*\([^)]*\)\s*\{)/, '$1 p.maxHp*=1.05;')],
    ['특전 밖 풀충전 추가', HTML.replace(/(function\s+onKill\s*\([^)]*\)\s*\{)/, '$1 G.player.sh=G.player.maxSh;')],
  ];
  let bad = 0;
  for (const [nm, mutated] of cases) {
    if (mutated === HTML) { console.log(`  ✗ ${nm}: 변이 주입 실패(패턴 불일치)`); bad++; continue; }
    const r = checkSource('mut', mutated, opt);
    if (r.fails.length === 0) { console.log(`  ✗ ${nm}: 게이트가 못 잡았다`); bad++; }
    else console.log(`  ✓ ${nm}: 잡음 — ${r.fails[0].slice(0, 90)}`);
  }
  if (bad) { console.log(`→ 자기검사 실패 ${bad}건`); process.exit(1); }
  console.log('  음성 대조 4/4 통과');
}

console.log('');
if (fails.length) {
  for (const f of fails) console.log('  ✗ ' + f);
  console.log(`→ 실패 ${fails.length}건: 주인이 폐지한 무료 회복이 살아 있다. PLAN §2.3·§2.4 와 ROUTINE ⚑ 지시를 볼 것`);
  process.exit(1);
}
console.log('→ 통과 (폐지된 무료 회복 재도입 0 · index.html ↔ sim.js 이 축에서 일치)');
