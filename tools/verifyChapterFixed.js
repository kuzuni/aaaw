#!/usr/bin/env node
/* ⚑⚑⚑ T107 게이트 — «챕터별 적 수 곡선 + 특전은 되는 만큼» (주인 확정 2026-09-03 17:3X)
 *   T100 의 «전 챕터 76마리 고정 · 완주 = 특전 10개» 게이트를 이 지시로 재작성했다.
 *
 * 주인 원문: «그 적수를 1챕터~5까지 17마리, 6챕터부터 1 올라갈 때마다 1개씩 추가, 그리고 적 개수 50개 되면
 *           더이상 안 올리기 … 특전은 걍 되는 만큼으로 하셈. 특전 사실 꼭 10까지 안 떠도 되긴 할듯.»
 * 공식: N(c) = c ≤ 5 ? 17 : min(50, 17 + (c − 5))  — 보스 포함 총 수 · 38챕터부터 50 고정
 * 특전: 경험치 상수(처치 3 · 보스 9 · 쉼터 26×2 · 5·Lv+1)는 불변이고 «그 챕터가 주는 만큼» 이 된다 —
 *      보스 전 공급 (N−1)×3 + 52 → 챕터 1~5 = **6개** · 15 = **7** · 28 = **8** · 38 이후 = **9**(최대).
 *
 * 보는 것:
 *   ⓐ 챕터 전수 적 총 수 = N(c) 공식 일치 (두 엔진)   ⓑ 단조 비감소 · 상한 50(= LAYOUT_MAXENEMY) 이내
 *   ⓒ 웨이브 5 · 쉼터 2 · 악마 1 · 천사 1 · 보스는 항상 마지막 · 웨이브 크기는 균등 분배(앞 웨이브부터)
 *   ⓓ **특전 개수 실측** = 주인 표(1~5 = 6 · 15 = 7 · 28 = 8 · 38+ = 9). «완주 = 10개» 단언은 폐기됐다.
 *   ⓔ~ⓙ 두 엔진 대조 + T105 «원거리 자리도 챕터별 고정» 단언(그대로 유지)
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

/* 주인 확정값 — 이 상수들이 이 게이트의 기준이다 (⚑ T107) */
const WANT = { waves: 5, rests: 2, devils: 1, angels: 1, cap: 50, curve: { early: 17, from: 6, cap: 50 } };
/* ⚑ T107 — 주인 확정 «특전은 되는 만큼» 표. [챕터, 특전 개수] · 한 판 완주 기준 실측값이다. */
const PERK_TABLE = [[1, 6], [3, 6], [5, 6], [15, 7], [28, 8], [38, 9], [60, 9]];
/* 공식 N(c) — 엔진이 아니라 «주인 지시» 를 그대로 옮긴 독립 구현이다(엔진과 대조하는 것이 이 게이트의 일). */
const wantN = c => c <= 5 ? WANT.curve.early : Math.min(WANT.curve.cap, WANT.curve.early + (c - 5));
/* 웨이브 크기 기대값 — 일반 적 N−1 을 5개에 균등 분배, 나머지는 앞 웨이브부터 */
const wantSizes = c => { const n = wantN(c) - 1, b = Math.floor(n / WANT.waves), r = n % WANT.waves;
  return Array.from({ length: WANT.waves }, (_, i) => b + (i < r ? 1 : 0)); };
/* ⚑⚑⚑ T114 — 주인 확정 «원거리 마릿수 곡선». 이 세 값과 아래 세 함수가 이 게이트의 독립 구현이다
   (엔진이 아니라 «주인 지시» 를 그대로 옮긴 것 — 엔진과 대조하는 것이 게이트의 일).
     E(c) = N(c) − 1 − 웨이브 5 · B(c) = round(0.30·E) · j ∈ {−2..+2}
     R(c) = c ≤ 4 ? 0 : (c−4 ≤ B(c) ? c−4 : max(0, B(c)+j))     — 램프 구간은 흔들림 없이 정확히 +1
   T105 의 «각 적 40% 독립 굴림» 과 그 36~44% 밴드는 이 곡선으로 폐기됐다. */
const WANT_R = { zeroUntil: 4, rate: 0.30, jitter: 2 };
const wantPool = c => wantN(c) - 1 - WANT.waves;
const wantBase = c => Math.round(WANT_R.rate * wantPool(c));
/* 램프 끝 — «c−4 가 기준값을 따라잡는» 마지막 챕터. 곡선 상수만으로 결정되므로 리터럴로 박지 않는다. */
const rampEndOf = maxc => { let e = WANT_R.zeroUntil; for (let c = WANT_R.zeroUntil + 1; c <= maxc; c++) { if (c - WANT_R.zeroUntil > wantBase(c)) break; e = c; } return e; };
/* ⚑ T105 ⓙ — 이벤트 배치 순서(챕터 1~`TUNE.maxChapter`, 웨이브 뺀 나열)의 골든 지문. T105 «이전» 트리에서 잰 값이고,
   원거리 굴림을 이벤트 셔플 뒤에 넣었으므로 T105 뒤에도 같아야 한다. 이 숫자가 바뀌면 시드 스트림
   소비 순서를 건드린 것이다 — 챕터마다 정해져 있던 쉼터·악마·천사 자리가 통째로 이사한다.
   ⚠ 챕터 상한이 바뀌면 이 지문도 다시 재야 한다 (현재 값은 상한 420 · T103 기준). */
const ORDER_FP = 385779098;

/* ⚑ T105 — 두 엔진에서 `chapterLayout` 만 떼어 같은 방식으로 평가한다 (verifyT2 ⑧ 과 같은 수법):
   `const LAYOUT_MAXENEMY` 줄부터 `function chapterLayout` 을 닫는 들여쓰기 없는 `}` 까지가 한 덩어리다.
   ⚑ T107 — 그 사이에 `chapterEnemyCount`·`chapterWaveSizes` 가 생겨 «첫 `}`» 로 자르면 잘린다. */
function loadLayout(src) {
  const mul = src.split('\n').find(l => l.startsWith('function mulberry'));
  const lines = src.split('\n');
  const a = lines.findIndex(l => l.startsWith('const LAYOUT_MAXENEMY'));
  const f = lines.findIndex((l, i) => i > a && l.startsWith('function chapterLayout'));
  const b = lines.findIndex((l, i) => i > f && l === '}');
  if (!mul || a < 0 || f < 0 || b < 0) return null;
  const code = mul + '\nconst clamp=(v,x,y)=>Math.max(x,Math.min(y,v));\n' + lines.slice(a, b + 1).join('\n') + '\n;chapterLayout';
  try { return vm.runInNewContext(code, { Math }); } catch (e) { return null; }
}
/* 원거리 패턴 지문 — 웨이브 노드의 `ranged` 를 0/1 문자열로 이어 붙인다 */
const rangedKey = L => L.filter(n => n.t === 'wave').map(n => (n.ranged || []).map(v => v ? '1' : '0').join('')).join('|');
const orderKey = L => L.filter(n => n.t !== 'wave').map(n => n.t[0]).join('');

function loadSim(src) {
  const body = src.replace(/const mode=process\.argv[\s\S]*$/,
    'module.exports={runChapter,PERKS,mkBuild,chapterLayout,TUNE,LAYOUT_MAXENEMY,REST_EXP,GT};');
  const m = { exports: {} };
  vm.runInNewContext(body, { module: m, exports: m.exports, process, console: { log() {} }, require });
  return m.exports;
}

function run(simSrc, htmSrc) {
  R.length = 0;
  const S = loadSim(simSrc);

  /* ===== ⓐⓑⓒ 챕터 전수 — 적 수 곡선 · 단조 · 상한 · 구성 =====
     ⚑ T104 — 상한을 `TUNE.maxChapter` 에서 읽는다. 리터럴을 박아 두면 챕터 상한이 바뀐 뒤에도
     게이트는 옛 챕터까지만 보고 초록을 내준다(«늘어난 챕터는 아무도 안 본다»). */
  const MAXC = S.TUNE.maxChapter;
  console.log(`\n=== ⓐⓑⓒ 챕터 1~${MAXC} — 적 수 곡선 N(c) · 단조 비감소 · 상한 ${WANT.cap} · 구성 ===`);
  let maxN = 0, prevN = 0, mono = true, badN = [], badShape = [], badSize = [], badLast = [], orders = new Set();
  const sample = {};
  for (let c = 1; c <= MAXC; c++) {
    const L = S.chapterLayout(c);
    let n = 0, rest = 0, devil = 0, angel = 0, boss = 0;
    const sizes = [];
    for (const x of L) {
      if (x.t === 'wave') { n += x.size; sizes.push(x.size); }
      else if (x.t === 'rest') rest++;
      else if (x.t === 'devil') devil++;
      else if (x.t === 'angel') angel++;
      else if (x.t === 'boss') { boss++; n += 1; }
    }
    const want = wantN(c);
    if (n !== want && badN.length < 4) badN.push(`ch${c} ${n} ≠ ${want}`);
    if (n < prevN) mono = false;
    prevN = n; maxN = Math.max(maxN, n);
    if ((sizes.length !== WANT.waves || rest !== WANT.rests || devil !== WANT.devils || angel !== WANT.angels || boss !== 1) && badShape.length < 4)
      badShape.push(`ch${c} 웨${sizes.length}/쉼${rest}/악${devil}/천${angel}/보${boss}`);
    if (sizes.join(',') !== wantSizes(c).join(',') && badSize.length < 4) badSize.push(`ch${c} [${sizes}] ≠ [${wantSizes(c)}]`);
    if (L[L.length - 1].t !== 'boss' && badLast.length < 4) badLast.push(`ch${c} 끝=${L[L.length - 1].t}`);
    orders.add(L.filter(x => x.t !== 'wave').map(x => x.t).join('>'));
    if ([1, 5, 6, 15, 28, 38].includes(c)) sample[c] = n;
  }
  chk(`ⓐ 챕터 1~${MAXC} 적 총 수가 공식 N(c)=c≤5?17:min(50,12+c) 와 전수 일치한다`, badN.length === 0,
    badN.join(' / ') || `ch1=${sample[1]} · ch6=${sample[6]} · ch15=${sample[15]} · ch28=${sample[28]} · ch38=${sample[38]}`);
  chk('ⓑ 적 총 수가 단조 비감소다', mono);
  chk(`ⓑ 적 총 수가 상한 ${WANT.cap}(=LAYOUT_MAXENEMY) 이내다`, maxN <= WANT.cap, `최대 ${maxN}마리`);
  chk(`ⓒ 웨이브 ${WANT.waves} · 쉼터 ${WANT.rests} · 악마 1 · 천사 1 이 전 챕터 동일하다`, badShape.length === 0, badShape.join(' / '));
  chk('ⓒ 웨이브 크기가 균등 분배다 (나머지는 앞 웨이브부터)', badSize.length === 0, badSize.join(' / ') || 'ch1 [4,3,3,3,3] · ch38 [10,10,10,10,9]');
  chk('ⓒ 보스는 항상 마지막 노드다', badLast.length === 0, badLast.join(' / '));
  /* 순서는 계속 섞여야 한다 — 고정 구성이 «전부 똑같은 판» 이 되는 것은 주인 지시가 아니다 */
  chk('이벤트 배치 «순서» 는 여전히 챕터마다 섞인다', orders.size >= 4, `순서 ${orders.size}종`);

  /* ===== ⓓ 특전 = 그 챕터가 주는 만큼 (실측) =====
     ⚑ T107 — T100 의 «완주 = 정확히 10개» 단언은 주인 지시로 폐기됐다. 대신 **챕터별 개수 표**를 실측한다.
     산수부터 못 박는다: 챕터를 끝내는 보스 처치는 레벨업이 돼도 특전을 안 주므로(PLAN §2.4) 개수를 정하는 것은
     **보스 전 공급 (N−1)×expKill + 쉼터 2×26** 이고, 마지막 한 장은 악마의 «다음 순번 앞당김» 이 댄다. */
  console.log('\n=== ⓓ 특전 = 그 챕터가 주는 만큼 (sim.js 실측) ===');
  const perkOf = c => {                                   /* 공급으로 예측한 특전 수 — 레벨업 n번 + 악마 1장 */
    const preBoss = (wantN(c) - 1) * S.TUNE.expKill + WANT.rests * S.REST_EXP;
    let need = 0, lv = 0;
    while (need + S.TUNE.expNeed(lv + 1) <= preBoss) { need += S.TUNE.expNeed(++lv); }
    return Math.min(lv + 1, S.PERK_PICKS !== undefined ? S.PERK_PICKS : 10);
  };
  const b = S.mkBuild(S.GT.RAR_MYTH, 9, 150);   /* ⚑ T153 — 영웅 폐지로 최고 등급 인덱스가 4 → 3 */
  let perkBad = [], perkLog = [];
  for (const [c, want] of PERK_TABLE) {
    const dist = {}; let clears = 0;
    for (let i = 0; i < 40; i++) { const r = S.runChapter(c, b); if (!r.clear) continue; clears++; dist[r.taken.length] = (dist[r.taken.length] || 0) + 1; }
    const ks = Object.keys(dist);
    const ok = clears >= 30 && ks.length === 1 && Number(ks[0]) === want;
    if (!ok) perkBad.push(`ch${c} → ${ks.map(k => `${k}개 ${dist[k]}판`).join('/') || '표본 없음'} (기대 ${want})`);
    perkLog.push(`ch${c}=${ks.join('/') || '?'}`);
    /* 공급 예측과 실측이 어긋나면 «어디서» 깨졌는지 이름을 붙여 준다 */
    if (ok && perkOf(c) !== want) perkBad.push(`ch${c} 공급 예측 ${perkOf(c)} ≠ 실측 ${want}`);
  }
  chk('⚑ 챕터별 특전 개수가 주인 표(1~5=6 · 15=7 · 28=8 · 38+=9)와 실측 일치한다', perkBad.length === 0,
    perkBad.join(' / ') || perkLog.join(' · '));
  /* «10개» 는 이제 어느 챕터에서도 안 나온다 — 주인 승인 사항이라 사실로 못 박아 둔다
     (49×3 + 52 = 199 < 9레벨 누적 234). 이 단언이 빨개지면 경험치 상수나 곡선이 움직인 것이다. */
  const capSupply = (WANT.curve.cap - 1) * S.TUNE.expKill + WANT.rests * S.REST_EXP;
  let need9 = 0; for (let L = 1; L <= 9; L++) need9 += S.TUNE.expNeed(L);
  chk('상한 챕터(적 50)에서도 특전 10번(방어력)은 안 나온다 — 주인 승인 사항', capSupply < need9,
    `보스 전 공급 ${capSupply} < 9레벨 누적 ${need9}`);

  /* ===== ⓔ 두 엔진 대조 ===== */
  console.log('\n=== ⓔ 두 엔진(sim.js · index.html) 대조 ===');
  const g = (src, k) => (src.match(new RegExp(k + '=(\\d+)')) || [])[1];
  /* ⚑ T107 — LAYOUT_WAVE_SIZE 는 곡선으로 대체됐고, 대신 ENEMY_CURVE 3값을 대조한다 */
  const cv = src => (src.match(/const ENEMY_CURVE=\{early:(\d+), from:(\d+), cap:(\d+)\}/) || []).slice(1).join('/');
  for (const k of ['LAYOUT_MAXENEMY', 'LAYOUT_WAVES', 'LAYOUT_RESTS']) {
    chk(`${k} 이 두 파일에서 같다`, g(simSrc, k) !== undefined && g(simSrc, k) === g(htmSrc, k),
      `sim ${g(simSrc, k)} / game ${g(htmSrc, k)}`);
  }
  chk('ENEMY_CURVE(early/from/cap)가 두 파일에서 같다', cv(simSrc) !== '' && cv(simSrc) === cv(htmSrc),
    `sim ${cv(simSrc) || '없음'} / game ${cv(htmSrc) || '없음'}`);
  const wantC = { LAYOUT_MAXENEMY: String(WANT.cap), LAYOUT_WAVES: String(WANT.waves), LAYOUT_RESTS: String(WANT.rests) };
  chk('세 상수 + 곡선이 주인 확정값이다', Object.keys(wantC).every(k => g(simSrc, k) === wantC[k])
      && cv(simSrc) === `${WANT.curve.early}/${WANT.curve.from}/${WANT.curve.cap}`,
    Object.keys(wantC).map(k => `${k}=${g(simSrc, k)}`).join(' · ') + ` · ENEMY_CURVE=${cv(simSrc)}`);
  /* ⚑ T107 — 두 엔진의 `chapterEnemyCount`(공식 그 자체)가 전 챕터 같은 값을 낸다는 것은
     아래 ⓕ 의 «두 엔진 원거리 패턴 전수 동일» 이 웨이브 크기까지 같아야 성립하므로 함께 잡힌다. */
  /* 경험치 곡선 */
  const eSim = (simSrc.match(/expNeed:lv=>(\d+)\*lv\+(\d+)/) || []).slice(1).join('/');
  const eHtm = (htmSrc.match(/const expNeed=lv=>(\d+)\*lv\+(\d+)/) || []).slice(1).join('/');
  chk('레벨업 요구 경험치가 두 엔진에서 5*lv+1 다', eSim === '5/1' && eHtm === '5/1', `sim ${eSim || '없음'} / game ${eHtm || '없음'}`);
  /* index.html 은 전역 `expNeed` 와 `TUNE.expNeed` 를 둘 다 갖는다 — 한쪽만 고치면 표시와 실제가 어긋난다 */
  const eHtmTune = (htmSrc.match(/expNeed:lv=>(\d+)\*lv\+(\d+)/) || []).slice(1).join('/');
  chk('index.html 의 전역 expNeed 와 TUNE.expNeed 가 같다', eHtmTune === eHtm && eHtmTune === '5/1', `TUNE ${eHtmTune || '없음'} / 전역 ${eHtm || '없음'}`);
  /* 제비뽑기가 되살아나지 않았는가 — 구성이 다시 흔들리면 인접 챕터 난이도 역전이 돌아온다 */
  for (const [nm, src] of [['sim.js', simSrc], ['index.html', htmSrc]]) {
    const body = src.slice(src.indexOf('function chapterLayout'), src.indexOf('function chapterLayout') + 1600);
    const rolled = /waveCount\s*=\s*\d+\s*\+/.test(body) || /waveCount\s*=[^;\n]*rnd\(/.test(body)
                || /sizes?\s*=[^;\n]*rnd\(/.test(body) || /clamp\(waveCount/.test(body)
                || /size:[^,}\n]*rnd\(/.test(body);
    chk(`${nm}: 구성 제비뽑기(웨이브 수·마릿수·쉼터 수)가 되살아나지 않았다`, !rolled);
    chk(`${nm}: 시드 셔플이 «이벤트 순서» 에만 남아 있다`, /evs\[i\]=evs\[j\]/.test(body));
  }

  /* ===== ⚑⚑⚑ ⓔ~ⓙ T105(자리 고정) + T114(마릿수 곡선) ===== */
  console.log('\n=== ⓔ~ⓙ 원거리 — 자리 챕터별 고정(T105) · 마릿수 곡선(⚑⚑⚑ T114 주인 확정) ===');
  const LS = loadLayout(simSrc), LH = loadLayout(htmSrc);
  const RAMP_END = rampEndOf(MAXC);
  if (!LS || !LH) {
    chk('chapterLayout 추출 (sim.js · index.html)', false, `${!LS ? 'sim.js ' : ''}${!LH ? 'index.html' : ''} 실패 — 게이트를 갱신할 것`);
  } else {
    let same = true, cross = true, firstOk = true, ord = 0;
    let rTot = 0, eTot = 0, aTot = 0, rMin = 1e9, rMax = 0, badC = [];
    let zeroBad = [], rampBad = [], bandBad = [], poolBad = [], prevR = 0, dec = 0, decMax = 0;
    for (let c = 1; c <= MAXC; c++) {
      const A = LS(c), A2 = LS(c), B = LH(c);
      const kA = rangedKey(A);
      if (kA !== rangedKey(A2)) { same = false; if (badC.length < 3) badC.push(`ch${c} 재생성 불일치`); }
      if (kA !== rangedKey(B)) { cross = false; if (badC.length < 3) badC.push(`ch${c} 두 엔진 불일치`); }
      let rc = 0, ec = 0;
      for (const n of A.filter(x => x.t === 'wave')) {
        if (!n.ranged || n.ranged.length !== n.size) { same = false; if (badC.length < 3) badC.push(`ch${c} ranged 길이 이상`); continue; }
        if (n.ranged[0]) firstOk = false;
        for (let j = 0; j < n.ranged.length; j++) { aTot++; if (j > 0) ec++; if (n.ranged[j]) rc++; }
      }
      /* ⚑ T114 ⓗ — 곡선 전수 대조. 세 구간을 따로 본다(«평균이 맞으면 통과» 를 막는다). */
      if (ec !== wantPool(c) && poolBad.length < 3) poolBad.push(`ch${c} 굴림 대상 ${ec} ≠ ${wantPool(c)}`);
      if (c <= WANT_R.zeroUntil) { if (rc !== 0 && zeroBad.length < 4) zeroBad.push(`ch${c} ${rc}마리`); }
      else if (c <= RAMP_END) { if (rc !== c - WANT_R.zeroUntil && rampBad.length < 4) rampBad.push(`ch${c} ${rc} ≠ ${c - WANT_R.zeroUntil}`);
        if (rc !== prevR + 1 && rampBad.length < 4) rampBad.push(`ch${c} 램프 +1 아님 (${prevR}→${rc})`); }
      else if (Math.abs(rc - wantBase(c)) > WANT_R.jitter && bandBad.length < 4)
        bandBad.push(`ch${c} R=${rc} B=${wantBase(c)} 차 ${rc - wantBase(c)}`);
      if (c > 1 && rc < prevR) { dec++; decMax = Math.max(decMax, prevR - rc); }
      prevR = rc;
      rTot += rc; eTot += ec; rMin = Math.min(rMin, rc); rMax = Math.max(rMax, rc);
      const k = orderKey(A);
      for (let i = 0; i < k.length; i++) ord = (ord * 31 + k.charCodeAt(i)) >>> 0;
    }
    const pct = eTot ? rTot / eTot * 100 : 0;          /* 굴림 대상(첫 마리 제외) 대비 */
    const pctAll = aTot ? rTot / aTot * 100 : 0;       /* 참고 — 적 전체 대비 */
    chk('ⓔ 같은 챕터를 두 번 생성하면 원거리 패턴이 완전히 같다', same, badC.join(' / ') || `챕터 1~${MAXC} 전수`);
    chk('ⓕ sim.js ↔ index.html 원거리 패턴이 전 챕터 동일하다', cross, badC.join(' / ') || `챕터 1~${MAXC} 전수`);
    chk('ⓖ 웨이브 첫 마리는 전 챕터 원거리가 아니다', firstOk);
    chk(`ⓗ 굴림 대상 모집단이 E(c) = N(c) − 1 − 웨이브 ${WANT.waves} 와 전수 일치한다`, poolBad.length === 0,
      poolBad.join(' / ') || `ch1 E=${wantPool(1)} · ch38+ E=${wantPool(38)}`);
    chk(`ⓗ 챕터 1~${WANT_R.zeroUntil} 는 원거리 0마리다 (주인 «챕터 4까지는 원거리 아예 없고»)`, zeroBad.length === 0, zeroBad.join(' / '));
    chk(`ⓗ 챕터 ${WANT_R.zeroUntil + 1}~${RAMP_END}(램프)는 정확히 +1/챕터 로 오른다 (주인 «5부터 1마리씩 추가»)`,
      rampBad.length === 0, rampBad.join(' / ') || `ch${WANT_R.zeroUntil + 1}=1 … ch${RAMP_END}=${RAMP_END - WANT_R.zeroUntil}`);
    chk(`ⓗ 챕터 ${RAMP_END + 1} 이후는 기준값 B(c)=round(${WANT_R.rate}·E) 의 ± ${WANT_R.jitter} 안이다 (주인 «30퍼에서 플러스 마이너스 2로 묶으까»)`,
      bandBad.length === 0, bandBad.join(' / ') || `B: ch15=${wantBase(15)} · ch28=${wantBase(28)} · ch38+=${wantBase(38)}`);
    chk(`ⓗ 전 챕터 합산 원거리 비율(굴림 대상 대비)이 ${(WANT_R.rate * 100).toFixed(0)}% 근방이다`,
      Math.abs(pct - WANT_R.rate * 100) <= 3,
      `${pct.toFixed(2)}% (${rTot}/${eTot}) · 적 전체 대비 ${pctAll.toFixed(2)}% · 챕터당 최소 ${rMin} · 최대 ${rMax} · 평균 ${(rTot / MAXC).toFixed(2)}마리 · 앞 챕터보다 줄어드는 챕터 ${dec}개(최대 ${decMax}마리)`);
    chk('ⓙ 이벤트 배치 순서가 T105 이전과 한 챕터도 안 바뀌었다 (원거리를 셔플 «뒤» 에 굴린 증명)',
      ord === ORDER_FP, `지문 ${ord} (기준 ${ORDER_FP})`);
  }
  /* ⓘ 정적 — 웨이브 생성부에서 다시 굴리거나 «각 적 독립 굴림»(T114 로 폐기)이 남아 있으면 곡선이 그 자리에서 깨진다 */
  for (const [nm, src] of [['sim.js', simSrc], ['index.html', htmSrc]]) {
    chk(`ⓘ ${nm}: 웨이브 생성부에 매판 굴림(Math.random()<0.4)이 남아 있지 않다`,
      !/Math\.random\(\)\s*<\s*0?\.[34]\s*&&\s*j\s*>\s*0/.test(src));
    chk(`ⓘ ${nm}: «각 적 독립 굴림»(RANGED_P·<0.4·<0.3) 잔재가 없다 — T114 로 폐기`,
      !/RANGED_P/.test(src) && !/rnd\(\)\s*<\s*0?\.[34]/.test(src));
  }

  const bad = R.filter(x => !x.c).length;
  console.log(`\n[T107 챕터별 적 수 곡선 게이트] 통과 ${R.length - bad} · 불합격 ${bad}`);
  return bad;
}

const simSrc = fs.readFileSync(path.join(ROOT, 'sim.js'), 'utf8');
const htmSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

if (process.argv.includes('--self')) {
  const cases = [
    ['웨이브를 4개로 되돌리면', s => s.replace('LAYOUT_WAVES=5', 'LAYOUT_WAVES=4'), null],
    ['쉼터를 1개로 줄이면', s => s.replace('LAYOUT_RESTS=2', 'LAYOUT_RESTS=1'), null],
    /* ⚑ T107 — 곡선 세 상수를 각각 흔든다 */
    ['초반 마릿수를 17 → 15 로 내리면', s => s.replace('ENEMY_CURVE={early:17', 'ENEMY_CURVE={early:15'), null],
    ['증가 시작 챕터를 6 → 11 로 미루면', s => s.replace('from:6, cap:50', 'from:11, cap:50'), null],
    ['상한을 50 → 76 으로 올리면', s => s.replace('ENEMY_CURVE={early:17, from:6, cap:50}', 'ENEMY_CURVE={early:17, from:6, cap:76}'), null],
    ['상한 상수(LAYOUT_MAXENEMY)만 80 으로 되돌리면', s => s.replace('const LAYOUT_MAXENEMY=50;', 'const LAYOUT_MAXENEMY=80;'), null],
    ['곡선을 챕터당 +2 로 가파르게 하면',
      s => s.replace('ENEMY_CURVE.early+(c-(ENEMY_CURVE.from-1))', 'ENEMY_CURVE.early+2*(c-(ENEMY_CURVE.from-1))'), null],
    ['곡선을 T100 의 전 챕터 76 고정으로 되돌리면',
      s => s.replace(/function chapterEnemyCount\(c\)\{[\s\S]*?\n\}/, 'function chapterEnemyCount(c){ return 76; }'), null],
    ['적 수를 챕터마다 다시 굴리면 (제비뽑기 부활)',
      s => s.replace('const waveCount=LAYOUT_WAVES, sizes=chapterWaveSizes(c);',
        'const waveCount=LAYOUT_WAVES; const sizes=chapterWaveSizes(c).map(v=>v+(rnd()<0.4?1:0));'), null],
    ['나머지를 뒤 웨이브부터 주면 (균등 분배 규약 위반)',
      s => s.replace('out.push(b+(i<r?1:0));', 'out.push(b+(i>=LAYOUT_WAVES-r?1:0));'),
      s => s.replace('out.push(b+(i<r?1:0));', 'out.push(b+(i>=LAYOUT_WAVES-r?1:0));')],
    ['게임만 곡선이 다르면 (상한 50 → 40)', null, s => s.replace('from:6, cap:50', 'from:6, cap:40')],
    ['게임만 웨이브 수가 다르면', null, s => s.replace('LAYOUT_WAVES=5', 'LAYOUT_WAVES=4')],
    /* 경험치 축 — 특전 개수 표가 곧바로 어긋난다 */
    ['경험치 곡선을 4+3*lv 로 되돌리면', s => s.replace('expNeed:lv=>5*lv+1', 'expNeed:lv=>4+3*lv'), null],
    ['경험치 증분만 5 → 6 으로 바꾸면', s => s.replace('expNeed:lv=>5*lv+1', 'expNeed:lv=>6*lv+1'), null],
    ['시작 요구치만 6 → 7 로 바꾸면', s => s.replace('expNeed:lv=>5*lv+1', 'expNeed:lv=>5*lv+2'), null],
    ['처치 경험치를 3 → 4 로 올리면', s => s.replace('expKill:3, expBoss:9', 'expKill:4, expBoss:9'), null],
    ['쉼터 경험치를 깎으면', s => s.replace('REST_HEAL=260, REST_EXP=26', 'REST_HEAL=260, REST_EXP=20'), null],
    ['게임만 경험치 곡선이 다르면', null, s => s.replace('const expNeed=lv=>5*lv+1', 'const expNeed=lv=>4+3*lv')],
    ['게임의 TUNE.expNeed 만 안 고치면', null, s => s.replace('expNeed:lv=>5*lv+1', 'expNeed:lv=>4+3*lv')],
    ['이벤트 순서 셔플을 없애면', s => s.replace('for(let i=evs.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); const t=evs[i]; evs[i]=evs[j]; evs[j]=t; }', ''), null],
    /* ⚑ T105 — 원거리 자리가 다시 흔들리는 갈래 (그대로 유지) */
    ['원거리를 매판 굴림으로 되돌리면 (sim)',
      s => s.replace('const ranged=node.ranged[j];', 'const ranged=Math.random()<0.4&&j>0;'), null],
    ['원거리를 매판 굴림으로 되돌리면 (게임)',
      null, s => s.replace('const ranged=nl.ranged[j];', 'const ranged=Math.random()<0.4 && j>0;')],
    ['챕터 시드 대신 매판 난수로 자리를 뽑으면',
      s => s.replace('const k=Math.floor(rnd()*(i+1)); const t=pool[i];', 'const k=Math.floor(Math.random()*(i+1)); const t=pool[i];'), null],
    /* ⚑⚑⚑ T114 — 마릿수 곡선이 흔들리는 갈래 */
    ['게임만 원거리 비율이 다르면 (30% → 20%)',
      null, s => s.replace('RANGED_CURVE={zeroUntil:4, rate:0.30', 'RANGED_CURVE={zeroUntil:4, rate:0.20')],
    ['원거리 비율을 두 엔진 다 0.30 → 0.50 으로 올리면',
      s => s.replace('rate:0.30', 'rate:0.50'), s => s.replace('rate:0.30', 'rate:0.50')],
    ['원거리 0 구간을 4 → 2 챕터로 줄이면 (주인 «챕터 4까지는 아예 없고» 위반)',
      s => s.replace('RANGED_CURVE={zeroUntil:4', 'RANGED_CURVE={zeroUntil:2'),
      s => s.replace('RANGED_CURVE={zeroUntil:4', 'RANGED_CURVE={zeroUntil:2')],
    ['흔들림을 ± 2 → ± 5 로 키우면 (± 2 묶기 위반)',
      s => s.replace('jitter:2}', 'jitter:5}'), s => s.replace('jitter:2}', 'jitter:5}')],
    ['램프에도 흔들림을 태우면 (주인 «1마리씩 추가» 단조 위반 — 위임 원문의 min() 형태)',
      s => s.replace('return ramp<=B ? ramp : Math.max(0,B+jit);', 'return Math.min(ramp, Math.max(0,B+jit));'),
      s => s.replace('return ramp<=B ? ramp : Math.max(0,B+jit);', 'return Math.min(ramp, Math.max(0,B+jit));')],
    ['램프를 +2/챕터 로 가파르게 하면',
      s => s.replace('const ramp=c-RANGED_CURVE.zeroUntil,', 'const ramp=2*(c-RANGED_CURVE.zeroUntil),'),
      s => s.replace('const ramp=c-RANGED_CURVE.zeroUntil,', 'const ramp=2*(c-RANGED_CURVE.zeroUntil),')],
    ['굴림 대상을 «일반 적 전체»(E = N−1)로 넓히면',
      s => s.replace('return chapterEnemyCount(c)-1-LAYOUT_WAVES;', 'return chapterEnemyCount(c)-1;'),
      s => s.replace('return chapterEnemyCount(c)-1-LAYOUT_WAVES;', 'return chapterEnemyCount(c)-1;')],
    ['T105 의 «각 적 40% 독립 굴림» 으로 되돌리면',
      s => s.replace(/  for\(const nd of out\) if\(nd\.t==='wave'\) nd\.ranged=new Array\(nd\.size\)\.fill\(false\);[\s\S]*?for\(let q=0;q<want&&q<pool\.length;q\+\+\)\{ const\[i,j\]=pool\[q\]; out\[i\]\.ranged\[j\]=true; \}/,
        "  for(const nd of out){ if(nd.t!=='wave') continue; const r=[]; for(let j=0;j<nd.size;j++) r.push(rnd()<0.40&&j>0); nd.ranged=r; }"), null],
    ['웨이브 첫 마리도 원거리가 될 수 있게 하면',
      s => s.replace('for(let j=1;j<nd.size;j++) pool.push([i,j]);', 'for(let j=0;j<nd.size;j++) pool.push([i,j]);'),
      s => s.replace('for(let j=1;j<nd.size;j++) pool.push([i,j]);', 'for(let j=0;j<nd.size;j++) pool.push([i,j]);')],
    /* ⚑ 핵심 — 원거리 굴림을 이벤트 셔플 «앞» 으로 옮기면 시드 스트림이 밀려 쉼터·악마·천사 자리가
       챕터마다 이사한다. 두 엔진이 똑같이 밀리므로 ⓕ 는 초록인 채라, ⓙ 골든 지문만이 이걸 잡는다. */
    ['흔들림 j 를 램프 구간에서 굴리지 않으면 (챕터마다 소비 수가 달라져 자리가 밀린다)',
      s => s.replace('const jit=Math.floor(rnd()*(2*RANGED_CURVE.jitter+1))-RANGED_CURVE.jitter;',
        'const jit=c>RANGED_CURVE.zeroUntil+5?Math.floor(rnd()*(2*RANGED_CURVE.jitter+1))-RANGED_CURVE.jitter:0;'), null],
    ['원거리 굴림을 이벤트 셔플 «앞» 으로 옮기면',
      s => s.replace("const evs=['devil','angel'];", "const _pre=[]; for(let q=0;q<50;q++) _pre.push(rnd());\n  const evs=['devil','angel'];"),
      s => s.replace("const evs=['devil','angel'];", "const _pre=[]; for(let q=0;q<50;q++) _pre.push(rnd());\n  const evs=['devil','angel'];")],
  ];
  let caught = 0;
  const quiet = console.log;
  for (const [nm, fsim, fhtm] of cases) {
    /* ⚑ T126 가드 — 돌연변이 문자열이 낡아 replace 가 no-op 이 되면 사본 = 원본이라
       게이트가 초록으로 «통과» 하고 이 음성 케이스는 아무것도 안 지키면서 숫자만 올린다.
       (verifyPerkOrder 의 «가시갑옷 근접» 케이스가 T124 뒤 실제로 그렇게 죽어 있었다.
        verifyCombatConst ②-c 는 처음부터 같은 가드를 갖고 있었다 — 그 규약을 여기로 옮긴다.) */
    const mS = fsim ? fsim(simSrc) : simSrc, mH = fhtm ? fhtm(htmSrc) : htmSrc;
    const noop = (fsim && mS === simSrc) || (fhtm && mH === htmSrc);
    let bad = 0;
    if (!noop) {
      console.log = () => {};
      try { bad = run(mS, mH); } catch (e) { bad = 1; }
      console.log = quiet;
    }
    const okc = !noop && bad > 0;
    if (okc) caught++;
    console.log(`  ${okc ? '✓' : '✗'} ${nm} → ${okc ? '빨개진다'
      : noop ? '🔴 돌연변이가 원본을 안 바꾼다 (문자열이 낡았다 = 죽은 검사)' : '🔴 안 잡힌다 (죽은 검사)'}`);
  }
  console.log(`\n[음성 검사] ${caught}/${cases.length}`);
  process.exit(caught === cases.length ? 1 : 0);
}

console.log('⚑⚑⚑ T107 게이트 — 챕터별 적 수 곡선 · 특전은 그 챕터가 주는 만큼');
process.exit(run(simSrc, htmSrc) ? 1 : 0);
