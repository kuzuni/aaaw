#!/usr/bin/env node
/* ⚑⚑⚑ T96 4단계 게이트 — «고정 챕터 구성 + 완주 = 특전 10개» (주인 확정 2026-09-03)
 *
 * 주인 원문: «특전 10개를 얻을 정도의 적 개수로만 챕터를 구성해라. 이게 우선돼야 밸런스를 제대로 잡는다.»
 * 확정 구성: 웨이브 **4 × 12 = 48** + 보스 1 = 적 **49** · 쉼터 **2** · 악마 **1** · 천사 **1** ·
 *          레벨업 요구 경험치 **4 + 3·Lv**.
 * 산수: 공급 48×3 + 9 + 2×26 = **205** = 필요 Σ(4+3·L), L=1..10 = **205** → 완주 = 정확히 특전 10개.
 *
 * 보는 것 넷:
 *   ⓐ 적 총 수 ≤ LAYOUT_MAXENEMY(50)  ⓑ 챕터 1~300 구성이 전부 같다  ⓒ **완주 = 특전 10개 실측**
 *   ⓓ 두 엔진(sim.js · index.html)이 같은 상수·같은 구조
 *
 * 사용: node tools/verifyChapterFixed.js        (exit 0 = 통과, 1 = 불합격)
 *      node tools/verifyChapterFixed.js --self  (음성 검사)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const R = [];
const chk = (n, c, d) => { R.push({ n, c }); console.log(`  ${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); return c; };

/* 주인 확정값 — 이 상수들이 이 게이트의 기준이다 */
const WANT = { waves: 4, size: 12, rests: 2, devils: 1, angels: 1, total: 49, cap: 50, perks: 10 };

function loadSim(src) {
  const body = src.replace(/const mode=process\.argv[\s\S]*$/,
    'module.exports={runChapter,PERKS,mkBuild,chapterLayout,TUNE,LAYOUT_MAXENEMY,REST_EXP};');
  const m = { exports: {} };
  vm.runInNewContext(body, { module: m, exports: m.exports, process, console: { log() {} }, require });
  return m.exports;
}

function run(simSrc, htmSrc) {
  R.length = 0;
  const S = loadSim(simSrc);

  /* ===== ⓐⓑ 챕터 1~300 전수 구성 ===== */
  console.log('\n=== ⓐⓑ 챕터 1~300 구성 — 상한 이내 · 전 챕터 동일 ===');
  const shapes = new Map();
  let maxN = 0, orders = new Set();
  for (let c = 1; c <= 300; c++) {
    const L = S.chapterLayout(c);
    let n = 0, w = 0, rest = 0, devil = 0, angel = 0, boss = 0;
    for (const x of L) {
      if (x.t === 'wave') { n += x.size; w++; if (x.size !== WANT.size) shapes.set('마릿수 ' + x.size, (shapes.get('마릿수 ' + x.size) || 0) + 1); }
      else if (x.t === 'rest') rest++;
      else if (x.t === 'devil') devil++;
      else if (x.t === 'angel') angel++;
      else if (x.t === 'boss') { boss++; n += 1; }
    }
    maxN = Math.max(maxN, n);
    shapes.set(`적${n}/웨${w}/쉼${rest}/악${devil}/천${angel}/보${boss}`, 1);
    orders.add(L.filter(x => x.t !== 'wave').map(x => x.t).join('>'));
  }
  const keys = [...shapes.keys()].filter(k => /^적/.test(k));
  chk(`적 총 수가 상한 ${WANT.cap} 이내다`, maxN <= WANT.cap, `최대 ${maxN}마리`);
  chk('챕터 1~300 구성이 전부 같다 (제비뽑기 폐지)', keys.length === 1, keys.join(' · '));
  chk(`구성이 주인 확정값과 같다 (적 ${WANT.total} · 웨이브 ${WANT.waves} · 쉼터 ${WANT.rests} · 악마 1 · 천사 1)`,
    keys.length === 1 && keys[0] === `적${WANT.total}/웨${WANT.waves}/쉼${WANT.rests}/악${WANT.devils}/천${WANT.angels}/보1`,
    keys[0]);
  /* 순서는 계속 섞여야 한다 — 고정 구성이 «전부 똑같은 판» 이 되는 것은 주인 지시가 아니다 */
  chk('이벤트 배치 «순서» 는 여전히 챕터마다 섞인다', orders.size >= 4, `순서 ${orders.size}종`);

  /* ===== ⓒ 완주 = 특전 10개 (실측) ===== */
  console.log('\n=== ⓒ 완주 = 특전 10개 (sim.js 실측) ===');
  /* 경험치 산수부터 — 구성과 곡선이 서로를 만족시키는가 (실측 전에 «왜 10인가» 를 못 박는다) */
  const supply = (WANT.total - 1) * S.TUNE.expKill + S.TUNE.expBoss + WANT.rests * S.REST_EXP;
  let need = 0; for (let L = 1; L <= WANT.perks; L++) need += S.TUNE.expNeed(L);
  chk(`경험치 공급 ${supply} = 10레벨 누적 요구 ${need}`, supply === need,
    `공급 ${WANT.total - 1}×${S.TUNE.expKill} + ${S.TUNE.expBoss} + ${WANT.rests}×${S.REST_EXP} = ${supply} · 요구 Σ(4+3L) = ${need}`);
  chk('11번째 레벨까지는 못 간다 (공급이 딱 10레벨분)', supply < need + S.TUNE.expNeed(WANT.perks + 1),
    `11레벨 요구 ${need + S.TUNE.expNeed(WANT.perks + 1)} > 공급 ${supply}`);
  /* 실측 — 반드시 완주하는 빌드로 여러 판 돌려 획득 특전 수를 센다 */
  const b = S.mkBuild(4, 9, 150);
  const dist = {};
  let clears = 0;
  for (let i = 0; i < 200; i++) {
    const r = S.runChapter(3, b);
    if (!r.clear) continue;
    clears++;
    dist[r.taken.length] = (dist[r.taken.length] || 0) + 1;
  }
  chk('대조군 성립 — 실측 표본이 전부 완주다', clears >= 150, `완주 ${clears}/200판`);
  chk(`⚑ 완주하면 정확히 특전 ${WANT.perks}개다`,
    clears > 0 && Object.keys(dist).length === 1 && Number(Object.keys(dist)[0]) === WANT.perks,
    Object.entries(dist).map(([k, v]) => `${k}개 ${v}판`).join(' · ') || '표본 없음');

  /* ===== ⓓ 두 엔진 대조 ===== */
  console.log('\n=== ⓓ 두 엔진(sim.js · index.html) 대조 ===');
  const g = (src, k) => (src.match(new RegExp(k + '=(\\d+)')) || [])[1];
  for (const k of ['LAYOUT_MAXENEMY', 'LAYOUT_WAVES', 'LAYOUT_WAVE_SIZE', 'LAYOUT_RESTS']) {
    chk(`${k} 이 두 파일에서 같다`, g(simSrc, k) !== undefined && g(simSrc, k) === g(htmSrc, k),
      `sim ${g(simSrc, k)} / game ${g(htmSrc, k)}`);
  }
  const wantC = { LAYOUT_MAXENEMY: String(WANT.cap), LAYOUT_WAVES: String(WANT.waves), LAYOUT_WAVE_SIZE: String(WANT.size), LAYOUT_RESTS: String(WANT.rests) };
  chk('네 상수가 주인 확정값이다', Object.keys(wantC).every(k => g(simSrc, k) === wantC[k]),
    Object.keys(wantC).map(k => `${k}=${g(simSrc, k)}`).join(' · '));
  /* 경험치 곡선 */
  const eSim = (simSrc.match(/expNeed:lv=>4\+(\d)\*lv/) || [])[1];
  const eHtm = (htmSrc.match(/const expNeed=lv=>4\+(\d)\*lv/) || [])[1];
  chk('레벨업 요구 경험치가 두 엔진에서 4+3*lv 다', eSim === '3' && eHtm === '3', `sim 4+${eSim}*lv / game 4+${eHtm}*lv`);
  /* 제비뽑기가 되살아나지 않았는가 — 구성이 다시 흔들리면 인접 챕터 난이도 역전이 돌아온다 */
  for (const [nm, src] of [['sim.js', simSrc], ['index.html', htmSrc]]) {
    const body = src.slice(src.indexOf('function chapterLayout'), src.indexOf('function chapterLayout') + 1600);
    const rolled = /waveCount\s*=\s*4\s*\+/.test(body) || /size\s*=\s*rnd\(\)</.test(body) || /clamp\(waveCount/.test(body);
    chk(`${nm}: 구성 제비뽑기(웨이브 수·마릿수·쉼터 수)가 되살아나지 않았다`, !rolled);
    chk(`${nm}: 시드 셔플이 «이벤트 순서» 에만 남아 있다`, /evs\[i\]=evs\[j\]/.test(body));
  }

  const bad = R.filter(x => !x.c).length;
  console.log(`\n[T96 고정 챕터 게이트] 통과 ${R.length - bad} · 불합격 ${bad}`);
  return bad;
}

const simSrc = fs.readFileSync(path.join(ROOT, 'sim.js'), 'utf8');
const htmSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

if (process.argv.includes('--self')) {
  const cases = [
    ['웨이브를 5개로 되돌리면', s => s.replace('LAYOUT_WAVES=4', 'LAYOUT_WAVES=5'), null],
    ['마릿수를 10으로 내리면', s => s.replace('LAYOUT_WAVE_SIZE=12', 'LAYOUT_WAVE_SIZE=10'), null],
    ['쉼터를 1개로 줄이면', s => s.replace('LAYOUT_RESTS=2', 'LAYOUT_RESTS=1'), null],
    ['경험치 곡선을 4+4*lv 로 되돌리면', s => s.replace('expNeed:lv=>4+3*lv', 'expNeed:lv=>4+4*lv'), null],
    ['게임만 경험치 곡선이 다르면', null, s => s.replace('const expNeed=lv=>4+3*lv', 'const expNeed=lv=>4+4*lv')],
    ['게임만 웨이브 수가 다르면', null, s => s.replace('LAYOUT_WAVES=4', 'LAYOUT_WAVES=5')],
    ['구성 제비뽑기를 되살리면', s => s.replace('const waveCount=LAYOUT_WAVES, size=LAYOUT_WAVE_SIZE;',
      'let waveCount=4+(rnd()<0.4?1:0); const size=LAYOUT_WAVE_SIZE;'), null],
    ['이벤트 순서 셔플을 없애면', s => s.replace('for(let i=evs.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); const t=evs[i]; evs[i]=evs[j]; evs[j]=t; }', ''), null],
    ['적 상한을 넘기면', s => s.replace('LAYOUT_WAVE_SIZE=12', 'LAYOUT_WAVE_SIZE=20'), null],
    ['쉼터 경험치를 깎으면', s => s.replace('REST_HEAL=260, REST_EXP=26', 'REST_HEAL=260, REST_EXP=20'), null],
  ];
  let caught = 0;
  const quiet = console.log;
  for (const [nm, fsim, fhtm] of cases) {
    console.log = () => {};
    let bad = 0;
    try { bad = run(fsim ? fsim(simSrc) : simSrc, fhtm ? fhtm(htmSrc) : htmSrc); } catch (e) { bad = 1; }
    console.log = quiet;
    const okc = bad > 0;
    if (okc) caught++;
    console.log(`  ${okc ? '✓' : '✗'} ${nm} → ${okc ? '빨개진다' : '🔴 안 잡힌다 (죽은 검사)'}`);
  }
  console.log(`\n[음성 검사] ${caught}/${cases.length}`);
  process.exit(caught === cases.length ? 1 : 0);
}

console.log('⚑⚑⚑ T96 게이트 — 고정 챕터 구성 · 완주 = 특전 10개');
process.exit(run(simSrc, htmSrc) ? 1 : 0);
