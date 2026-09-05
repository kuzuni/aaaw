#!/usr/bin/env node
/* ⚑⚑⚑ T136 게이트 — «창의 화신 = fireArrows 가 fireSpear 가 된다 · 창 데미지·8관통 그대로»
 *
 * 주인 확정 T105 (2026-09-03 17:2X · `docs/ROUTINE.md` 특전 위임 절) 원문:
 *   «**창의 화신** = `fireArrows(n)` 이 `fireSpear(n)` 이 된다
 *    (화살 3개 → 창 3개 · 회피 시 화살 → 창 · 장비 화살 옵션도 포함). **창 데미지·8관통 그대로.**»
 *
 * ⚑ 왜 있나 (T130·T131·T132·T133·T134·T135 가 여섯 번 연속으로 짚은 자리와 같은 종류다).
 *   한 문장에 «A 로 바꾸되 B 는 그대로» 가 있으면 **A 만 게이트가 생긴다.**
 *   «바꾼다» 반쪽은 `verifyPerkOrder` 가 정규식 **한 항목**으로 본다 —
 *   «fireArrows 안에서 `fireSpear(p,n)` 로 갈아탄다». 그런데 «그대로» 반쪽인
 *     ① 갈아타는 자리가 **장비 화살 발수 옵션(`arrowCount` ×1.5) 뒤**인가
 *        (앞으로 옮기면 «장비 화살 옵션도 포함» 이 조용히 죽는다 — 발수가 창에 안 실린다)
 *     ② 아바타가 만든 창이 **평범한 창과 한 필드도 다르지 않은가**
 *        (계수·관통·사거리·속도. fireArrows 안에서 창을 직접 만들면 데미지·8관통이 사본으로 갈린다)
 *     ③ `parrow` 생성이 **fireArrows 안에만** 있는가 (= «내가 쏘는 **모든** 화살»)
 *   는 두 엔진 어디에도 단언이 없었다. T134 가 «다음 워커가 알 것 ⓐ» 로 남긴 목록의 마지막 줄이다.
 *
 * ⚑ 사본 실측으로 먼저 증명했다 (T136 착수 시점 · 사본 4벌 · 아래 음성 검사가 그대로 재현한다).
 *   **완전히 안 잡히던 것은 ①(순서)이다** — 아바타 분기를 `arrowCount` 줄 **위**로 한 줄만 올리면
 *   기존 정적 게이트 22종이 **전부 초록**(빨강은 `verifyScoreCriteria` 하나뿐인데 그건 T136 이전부터
 *   빨간 주인 판단 대기다)이고 **T3 `battle` 57 도 전부 초록**인 채,
 *   장비 «화살 3발» 을 낀 창의 화신의 창이 **3개 → 2개** 로 줄어든다(sim.js 실측 · 33% 손실).
 *   ②③ 쪽 갈래는 이웃 게이트가 절반쯤 덮고 있었다 — 사본 실측 결과
 *   «fireArrows 안에서 창 직접 생성(관통 2)» 은 `verifyPerkOrder`+`verifyT2` 가,
 *   «fireSpear 가 아바타만 관통 2로 깎기» 는 `verifyT2` ⑱ 이,
 *   «회피 시 화살이 fireArrows 를 우회» 는 `verifyPerkOrder` 가 잡았다.
 *   덮여 있던 것도 여기서 **한 축으로 모아 다시 못 박는다** — 이웃 게이트는 다른 이유로 그 자리를
 *   보고 있어서(관통 상한 T34 · 특전 순서 T96), 그 조항이 바뀌면 이 축은 소리 없이 비어 버린다.
 *
 * 이 게이트는 밸런스 수치를 한 개도 정하지 않는다 — 창 계수·관통 수는 **소스에서 읽어**
 * «아바타 창 == 평범한 창» 만 본다. 주인 상시 규칙(«적 스탯은 한 글자도») 과 무관하다.
 *
 * 보는 것:
 *   ⓐ 전환 자리 — 아바타 분기가 fireArrows 안 · `arrowCount` 뒤 · 같은 n · 즉시 return (정적 · 두 엔진)
 *   ⓑ «모든 화살» — `parrow` 생성이 fireArrows 본문 안 한 곳뿐 (정적 · 두 엔진)
 *   ⓒ 창은 «그대로» — fireSpear 가 아바타를 모르고, 계수·관통이 한 자리에서만 나온다 (정적 · 두 엔진)
 *   ⓓ 아바타 창 == 평범한 창 — 필드 전수 대조 (sim.js 실측)
 *   ⓔ 발수·장비 옵션 — n 보존 · `arrowCount` 가 창 발수에 실린다 · `spearMaster` 가 똑같이 걸린다 (실측)
 *   ⓕ 한 챕터 전수 — 아바타를 켜면 `parrow` 가 **0개**가 되고 창으로 바뀐다 (실측)
 *
 * 사용: node tools/verifySpearAvatar.js         (exit 0 = 통과, 1 = 불합격)
 *      node tools/verifySpearAvatar.js --self  (음성 검사 — 전부 잡히면 exit 0)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const R = [];
const chk = (n, c, d) => { R.push({ n, c }); console.log(`  ${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); return c; };

/* ── 소스에서 함수 본문 한 덩어리를 떼어 낸다 ────────────────────────────────────────────
   두 엔진 다 최상위 `function …(` 선언이라 «다음 최상위 function 선언 직전» 까지가 본문이다.
   (게이트가 중괄호를 세지 않는 이유 — 문자열·정규식 안의 중괄호에 걸리면 조용히 어긋난다.) */
function body(src, name) {
  const i = src.indexOf(`function ${name}(`);
  if (i < 0) return null;
  const j = src.indexOf('\nfunction ', i + 1);
  return src.slice(i, j < 0 ? i + 1200 : j);
}
const squash = s => (s || '').replace(/\s+/g, '');

/* ── sim.js 를 vm 으로 올린다 (모드 러너를 잘라 내고 필요한 것만 내보낸다) ────────────────
   `verifyPerRunRandom` 의 `loadSim`·`loadSpawn` 과 같은 수법 — 엔진이 아니라 게이트가 쓰는 사본만 자른다. */
const CUT = '  const dt=1/30;';
const EXPORTS = 'module.exports={runChapter,chapterLayout,mkBuild,TUNE,setSeed,fireArrows,fireSpear,R_ARROW,R_SPEAR,SPEAR_PIERCE};';
function loadSim(src, extra) {
  let b = src.replace(/const mode=process\.argv[\s\S]*$/, EXPORTS);
  if (extra) { b = extra(b); if (b === null) return null; }
  const m = { exports: {} };
  const ctx = { module: m, exports: m.exports, process, console: { log() {} }, require, __TALLY: {} };
  vm.runInNewContext(b, ctx);
  m.exports.__TALLY = ctx.__TALLY;
  return m.exports;
}
/* 전투 루프 «앞» 에서 멈추는 사본 — 스폰 직후의 `G`(플레이어 포함)를 그대로 돌려준다. */
function loadSpawn(src) {
  return loadSim(src, b => b.indexOf(CUT) < 0 ? null : b.replace(CUT, '  return {__spawn:G};\n' + CUT));
}
/* 한 챕터를 끝까지 돌리되 ⓐ 특전 px 를 강제로 켤 수 있고 ⓑ 만들어진 투사체를 종류별로 센다.
   («모든 화살» 은 직접 호출이 아니라 **판이 스스로 쏘는 화살** 에서 확인해야 뜻이 있다.) */
const A_PX = 'const p=mkPlayer(build,G);G.player=p;p.G=G;';
const A_PJ = 'function pushProj(G,pr){';
function loadRun(src) {
  return loadSim(src, b => (b.indexOf(A_PX) < 0 || b.indexOf(A_PJ) < 0) ? null
    : b.replace(A_PX, A_PX + 'if(opts.forcePx)Object.assign(p.px,opts.forcePx);')
       .replace(A_PJ, A_PJ + '__TALLY[pr.type]=(__TALLY[pr.type]||0)+1;'));
}

function run(simSrc, htmSrc) {
  R.length = 0;
  const ENG = [['sim.js', simSrc], ['index.html', htmSrc]];

  /* ===== ⓐ 전환 자리 (정적 · 두 엔진) ===== */
  console.log('\n=== ⓐ 아바타 분기가 fireArrows 안 · 장비 화살 옵션 «뒤» · 같은 n · 즉시 return ===');
  const arrB = {}, spB = {};
  for (const [nm, src] of ENG) {
    const a = body(src, 'fireArrows'); arrB[nm] = a;
    if (!chk(`${nm}: fireArrows 본문을 떼어 낼 수 있다`, !!a)) continue;
    /* 장비 «화살 3발로 증가» 줄 — 발수를 정하는 자리다 */
    const iCnt = a.search(/px\.arrowCount\)?\s*n\s*=/);
    chk(`${nm}: 장비 화살 발수 옵션(arrowCount)이 fireArrows 안에서 발수를 정한다`, iCnt >= 0);
    const iAv = a.search(/px\.p_spearAvatar\s*\)/);
    chk(`${nm}: 창의 화신 분기가 fireArrows 본문 안에 있다 (발사 동사 한 곳에서 갈아탄다)`, iAv >= 0);
    chk(`${nm}: 아바타 분기가 장비 화살 옵션 «뒤» 다 (장비 화살 옵션도 창으로 포함된다)`,
      iCnt >= 0 && iAv > iCnt, iCnt >= 0 && iAv >= 0 ? `arrowCount@${iCnt} < avatar@${iAv}` : '자리를 못 찾았다');
    chk(`${nm}: 아바타가 **같은 n** 을 넘기고 즉시 return 한다 (발수 그대로)`,
      /p_spearAvatar\)\{?fireSpear\(p,n\);return;\}?/.test(squash(a)), squash(a).match(/p_spearAvatar[^;]*;[^;]*;/) ? '' : '');
    /* fireArrows 안에서 창을 직접 만들면 데미지·관통이 사본으로 갈린다 — 그 갈래를 막는다 */
    chk(`${nm}: fireArrows 가 창 투사체를 **직접** 만들지 않는다 (데미지·관통 사본 금지)`,
      !/type\s*:\s*'spear'/.test(a));
  }

  /* ===== ⓑ «내가 쏘는 모든 화살» (정적 · 두 엔진) ===== */
  console.log('\n=== ⓑ parrow 생성이 fireArrows 본문 안 한 곳뿐이다 (= «모든 화살») ===');
  for (const [nm, src] of ENG) {
    const all = [...src.matchAll(/type\s*:\s*'parrow'/g)].map(m => m.index);
    const a = arrB[nm], i = a ? src.indexOf(a) : -1;
    chk(`${nm}: 화살 투사체를 만드는 자리가 정확히 한 곳이다`, all.length === 1, `${all.length}곳`);
    chk(`${nm}: 그 한 곳이 fireArrows 본문 안이다 (우회로가 없다)`,
      all.length === 1 && i >= 0 && all[0] > i && all[0] < i + a.length);
    /* 화살을 쏘는 «경로» 가 여럿이어야 «동사 한 곳» 이 뜻을 가진다 (특전·장비·회피·처치 …) */
    const calls = (src.match(/fireArrows\(/g) || []).length - 1;   /* 선언 1건 제외 */
    chk(`${nm}: fireArrows 를 부르는 경로가 여럿이다 (회피 시·처치 시·장비 옵션 …)`, calls >= 3, `${calls}곳`);
  }

  /* ===== ⓒ 창은 «그대로» (정적 · 두 엔진) ===== */
  console.log('\n=== ⓒ fireSpear 는 아바타를 모른다 — 창 계수·관통이 한 자리에서만 나온다 ===');
  for (const [nm, src] of ENG) {
    const s = body(src, 'fireSpear'); spB[nm] = s;
    if (!chk(`${nm}: fireSpear 본문을 떼어 낼 수 있다`, !!s)) continue;
    chk(`${nm}: fireSpear 가 `+'`p_spearAvatar` 를 한 번도 안 본다 (아바타 전용 창 금지)',
      !/p_spearAvatar/.test(s));
    chk(`${nm}: fireSpear 가 `+'`arrowCount` 를 안 본다 (화살 발수 규칙이 창으로 새지 않았다)',
      !/arrowCount/.test(s));
    chk(`${nm}: 창 계수가 «장비 창 데미지 옵션 ? 상향값 : R_SPEAR» 한 자리에서 나온다`,
      /ratio:p\.px\.spearMaster\?[\d.]+:R_SPEAR/.test(squash(s)));
    chk(`${nm}: 창 관통이 상수 SPEAR_PIERCE 다 (아바타든 아니든 같은 8관통)`,
      /pierce:SPEAR_PIERCE/.test(squash(s)));
  }
  /* 두 엔진 1:1 — 한쪽만 고치는 갈래를 막는다 */
  const avLine = a => { const m = squash(a).match(/px\.p_spearAvatar\)\{?[^}]*\}?/); return m ? m[0] : null; };
  chk('두 엔진의 아바타 분기가 글자 그대로 같다',
    !!avLine(arrB['sim.js']) && avLine(arrB['sim.js']) === avLine(arrB['index.html']),
    avLine(arrB['sim.js']) || '—');
  const pj = s => { const m = squash(s).match(/type:'spear'[^}]*hit:newSet\(\),pierce:SPEAR_PIERCE/); return m ? m[0] : null; };
  chk('두 엔진의 창 투사체 인자(계수·속도·사거리·관통)가 글자 그대로 같다',
    !!pj(spB['sim.js']) && pj(spB['sim.js']) === pj(spB['index.html']), pj(spB['sim.js']) || '—');

  /* ===== ⓓ·ⓔ 실측 (sim.js) ===== */
  console.log('\n=== ⓓ 아바타 창 == 평범한 창 (필드 전수 대조 · sim.js 실측) ===');
  const S = loadSpawn(simSrc);
  if (!S) {
    chk('전투 루프 앞에서 멈추는 사본을 만들 수 있다 (`const dt=1/30;` 앵커)', false);
  } else {
    const G = S.runChapter(7, S.mkBuild(0, 0, 0), {}).__spawn;
    const p = G.player;
    /* 화살은 사거리 안(540) 에 표적이 있어야 날아간다 — 스폰 직후 플레이어는 아직 멀리 있다.
       창은 표적을 안 보지만 «화살 3발 → 창 3개» 를 재려면 화살 쪽도 실제로 나야 한다.
       전투 루프는 안 돌리고 자리만 당긴다 (두 쪽 다 같은 worldX 라 대조는 그대로 성립). */
    const first = G.nodes.flatMap(nd => nd.enemies).sort((a, b) => a.worldX - b.worldX)[0];
    p.worldX = first ? first.worldX - 200 : 0;
    /* 투사체를 만들고 «만들어진 것» 만 떼어 온다 (전투 루프가 안 돌므로 사라지지 않는다) */
    const fire = (fn, n, px) => {
      Object.assign(p.px, { p_spearAvatar: 0, arrowCount: 0, spearMaster: 0 }, px || {});
      G.pprojs.length = 0;
      fn(p, n);
      const out = G.pprojs.map(o => ({ type: o.type, ratio: o.ratio, spd: o.spd, pierce: o.pierce, maxX: o.maxX }));
      G.pprojs.length = 0;
      return out;
    };
    const base = fire(S.fireArrows, 3, {});
    const av = fire(S.fireArrows, 3, { p_spearAvatar: 1 });
    const sp = fire(S.fireSpear, 3, {});
    chk('아바타 없이 fireArrows(3) 은 화살 3발이다 (전제)',
      base.length === 3 && base.every(o => o.type === 'parrow' && o.ratio === S.R_ARROW),
      `${base.length}발 · ${base[0] ? base[0].type + ' ' + base[0].ratio : '—'}`);
    chk('아바타를 켜면 fireArrows(3) 이 창 3개가 된다 (화살 0발 · 발수 그대로)',
      av.length === 3 && av.every(o => o.type === 'spear'),
      `${av.length}개 · 화살 ${av.filter(o => o.type === 'parrow').length}발`);
    chk('그 창이 fireSpear(3) 의 창과 **한 필드도 다르지 않다** (계수·속도·사거리·관통)',
      JSON.stringify(av) === JSON.stringify(sp), JSON.stringify(sp[0] || {}));
    chk('아바타 창의 계수가 평범한 창 계수(R_SPEAR)다 — «창 데미지 그대로»',
      av.length > 0 && av.every(o => o.ratio === S.R_SPEAR), `ratio ${av[0] ? av[0].ratio : '—'} / R_SPEAR ${S.R_SPEAR}`);
    chk('아바타 창의 관통이 SPEAR_PIERCE 다 — «8관통 그대로»',
      av.length > 0 && av.every(o => o.pierce === S.SPEAR_PIERCE), `pierce ${av[0] ? av[0].pierce : '—'} / SPEAR_PIERCE ${S.SPEAR_PIERCE}`);
    chk('아바타 창의 사거리도 평범한 창과 같다 (88×SPEAR_PIERCE)',
      av.length > 0 && sp.length > 0 && av[0].maxX === sp[0].maxX, `maxX ${av[0] ? av[0].maxX : '—'}`);

    console.log('\n=== ⓔ 발수 보존 · 장비 화살/창 옵션이 아바타에도 똑같이 걸린다 (sim.js 실측) ===');
    const rows = [];
    let nOk = true;
    for (let n = 1; n <= 6; n++) {
      const a = fire(S.fireArrows, n, {}), v = fire(S.fireArrows, n, { p_spearAvatar: 1 });
      rows.push(`${n}→${v.length}`);
      if (a.length !== n || v.length !== n) nOk = false;
    }
    chk('발수 n 이 1~6 전수에서 그대로 창 개수가 된다 (화살 3개 → 창 3개)', nOk, rows.join(' · '));
    /* 장비 «화살 3발로 증가» — 주인 문면 «장비 화살 옵션도 포함» */
    const ac0 = fire(S.fireArrows, 2, { arrowCount: 1 });
    const ac1 = fire(S.fireArrows, 2, { arrowCount: 1, p_spearAvatar: 1 });
    chk('장비 «화살 발수» 옵션이 화살을 2발→3발로 늘린다 (전제)', ac0.length === 3, `${ac0.length}발`);
    chk('그 옵션이 아바타의 **창 발수** 에도 그대로 걸린다 (주인 «장비 화살 옵션도 포함»)',
      ac1.length === ac0.length && ac1.every(o => o.type === 'spear'), `창 ${ac1.length}개`);
    /* 장비 «창 데미지» 옵션 — 아바타 창이라고 다르게 오르면 «창 데미지 그대로» 가 깨진다 */
    const sm0 = fire(S.fireSpear, 1, { spearMaster: 1 });
    const sm1 = fire(S.fireArrows, 1, { spearMaster: 1, p_spearAvatar: 1 });
    chk('장비 «창 데미지» 옵션이 평범한 창 계수를 올린다 (전제)',
      sm0.length === 1 && sm0[0].ratio > S.R_SPEAR, `ratio ${sm0[0] ? sm0[0].ratio : '—'}`);
    chk('아바타 창도 **똑같은 계수** 로 오른다 (창 쪽 옵션이 아바타를 안 가린다)',
      sm1.length === 1 && sm0.length === 1 && sm1[0].ratio === sm0[0].ratio,
      `아바타 ${sm1[0] ? sm1[0].ratio : '—'} / 평범 ${sm0[0] ? sm0[0].ratio : '—'}`);
  }

  /* ===== ⓕ 한 챕터 전수 실측 — 판이 스스로 쏘는 화살까지 전부 창이 된다 ===== */
  console.log('\n=== ⓕ 한 챕터를 돌리면 화살이 0발이 된다 («내가 쏘는 모든 화살» · sim.js 실측) ===');
  const RUN = loadRun(simSrc);
  if (!RUN) {
    chk('특전 px 강제 + 투사체 집계 사본을 만들 수 있다 (mkPlayer·pushProj 앵커)', false);
  } else {
    const b = RUN.mkBuild(0, 0, 0);
    /* 장비 «공격 시 화살 2발»(arrow2)만 켜고 특전은 끈다 — 화살이 확실히 날고, 아바타 외 변수는 없다 */
    const tally = px => {
      RUN.setSeed(4242);                                   /* 시드 고정 — 판마다 흔들리지 않게 */
      for (const k of Object.keys(RUN.__TALLY)) delete RUN.__TALLY[k];
      for (let c = 1; c <= 6; c++) RUN.runChapter(c, b, { noPerk: true, forcePx: px });
      return Object.assign({}, RUN.__TALLY);
    };
    const off = tally({ arrow2: 1 });
    const on = tally({ arrow2: 1, p_spearAvatar: 1 });
    chk('아바타 없이 돌리면 화살이 실제로 나고 창은 한 개도 안 난다 (전제 · 챕터 1~6)',
      (off.parrow || 0) > 0 && (off.spear || 0) === 0, `화살 ${off.parrow || 0}발 · 창 ${off.spear || 0}개`);
    chk('아바타를 켜면 화살이 **0발** 이다 (우회 생성 경로가 없다)',
      (on.parrow || 0) === 0, `화살 ${on.parrow || 0}발`);
    chk('그 화살이 창으로 나온다 (사라지지 않는다)',
      (on.spear || 0) > 0, `창 ${off.spear || 0}개 → ${on.spear || 0}개`);
  }

  const bad = R.filter(x => !x.c).length;
  console.log(`\n[T136 창의 화신 게이트] 통과 ${R.length - bad} · 불합격 ${bad}`);
  return bad;
}

const simSrc = fs.readFileSync(path.join(ROOT, 'sim.js'), 'utf8');
const htmSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

if (process.argv.includes('--self')) {
  /* 음성 검사 — 「화살이 창이 되되 창은 그대로」를 깨는 돌연변이를 사본에 심고 이 게이트가 빨개지는지 본다.
     ⚑ T126 규약 — 돌연변이 문자열이 낡아 replace 가 no-op 이 되면 사본 = 원본이라 «통과» 가 되고
     이 케이스는 아무것도 안 지키면서 숫자만 올린다. no-op 은 그 자리에서 불합격으로 떨어뜨린다. */
  const SIM_AV = 'if(px.p_spearAvatar){fireSpear(p,n);return;}';
  const HTM_AV = 'if(px.p_spearAvatar){ fireSpear(p,n); return; }';
  const SIM_CNT = 'if(px.arrowCount)n=Math.round(n*1.5);';
  const HTM_CNT = 'if(px.arrowCount) n=Math.round(n*1.5);';
  const cases = [
    ['아바타 분기를 장비 화살 옵션 «위» 로 올리면 (sim — 장비 화살 발수가 창에 안 실린다)',
      s => s.replace(SIM_CNT, '').replace('const G=p.G,px=p.px;n=n||2;\n', 'const G=p.G,px=p.px;n=n||2;\n  ' + SIM_AV + '\n  ' + SIM_CNT + '\n'), null],
    ['아바타 분기를 장비 화살 옵션 «위» 로 올리면 (게임)',
      null, s => s.replace(HTM_CNT + '            /* 장비 «화살 3발로 증가» (기본 2발 → 3발) */',
        HTM_AV).replace(/  const px=p\.px; n=n\|\|2;\n  if\(px\.p_spearAvatar\)\{ fireSpear\(p,n\); return; \}/,
        '  const px=p.px; n=n||2;\n  ' + HTM_AV + '\n  ' + HTM_CNT)],
    ['아바타가 발수를 버리고 창 1개만 쏘면 (sim — «화살 3개 → 창 3개» 위반)',
      s => s.replace(SIM_AV, 'if(px.p_spearAvatar){fireSpear(p,1);return;}'), null],
    ['아바타가 발수를 버리고 창 1개만 쏘면 (게임)',
      null, s => s.replace(HTM_AV, 'if(px.p_spearAvatar){ fireSpear(p,1); return; }')],
    ['아바타가 fireSpear 를 안 부르고 창을 직접 만들면 (sim — 8관통이 2관통이 된다)',
      s => s.replace(SIM_AV,
        "if(px.p_spearAvatar){for(let k=0;k<n;k++)pushProj(G,{type:'spear',x:p.worldX+14,ratio:R_SPEAR,spd:520,maxX:p.worldX+88*2,hit:new Set(),pierce:2,node:frontNode(G)});return;}"), null],
    ['아바타 창만 계수를 깎으면 (sim — «창 데미지 그대로» 위반)',
      s => s.replace(SIM_AV, 'if(px.p_spearAvatar){const _o=p.px.spearMaster;p.px.spearMaster=0;fireSpear(p,n);p.px.spearMaster=_o;return;}'), null],
    ['fireSpear 가 아바타를 알아보고 관통을 깎으면 (sim)',
      s => s.replace('pierce:SPEAR_PIERCE,node:frontNode(G)});}',
        'pierce:p.px.p_spearAvatar?2:SPEAR_PIERCE,node:frontNode(G)});}'), null],
    ['fireSpear 가 아바타를 알아보고 관통을 깎으면 (게임)',
      null, s => s.replace('pierce:SPEAR_PIERCE,node:frontNode()});', 'pierce:p.px.p_spearAvatar?2:SPEAR_PIERCE,node:frontNode()});')],
    ['아바타 분기를 통째로 지우면 (sim — 화살이 화살로 남는다)',
      s => s.replace(SIM_AV, ''), null],
    ['아바타 분기를 통째로 지우면 (게임)',
      null, s => s.replace(HTM_AV, '')],
    ['화살 생성 우회로를 하나 더 내면 (sim — «모든 화살» 위반)',
      s => s.replace('if(px.p_arrowEv &&pkk(p,PERK_SUMMON_N))fireArrows(p,1);',
        "if(px.p_arrowEv &&pkk(p,PERK_SUMMON_N)){const _t=randTarget(G);if(_t)pushProj(G,{type:'parrow',x:p.worldX+14,tgt:_t,ratio:R_ARROW,spd:560});}"), null],
    ['화살 생성 우회로를 하나 더 내면 (게임)',
      null, s => s.replace("if(px.p_arrowEv&&pkk(p,PERK_SUMMON_N)) fireArrows(p,1);",
        "if(px.p_arrowEv&&pkk(p,PERK_SUMMON_N)){ const _t=randTarget(); if(_t) pushProj({type:'parrow',x:p.worldX+14,tgt:_t,ratio:R_ARROW,spd:560}); }")],
    ['창 계수를 상수로 박아 장비 창 옵션을 무시하면 (sim)',
      s => s.replace('ratio:p.px.spearMaster?13.5:R_SPEAR', 'ratio:R_SPEAR'), null],
    ['창 계수를 상수로 박아 장비 창 옵션을 무시하면 (게임)',
      null, s => s.replace('ratio:p.px.spearMaster?13.5:R_SPEAR', 'ratio:R_SPEAR')],
    ['두 엔진의 아바타 분기가 갈리면 (게임만 절반 발수)',
      null, s => s.replace(HTM_AV, 'if(px.p_spearAvatar){ fireSpear(p,Math.ceil(n/2)); return; }')],
    ['두 엔진의 창 투사체 인자가 갈리면 (게임만 속도 다름)',
      null, s => s.replace("type:'spear',x:p.worldX+14,ratio:p.px.spearMaster?13.5:R_SPEAR,spd:520",
        "type:'spear',x:p.worldX+14,ratio:p.px.spearMaster?13.5:R_SPEAR,spd:900")],
  ];
  let caught = 0, noopN = 0;
  const quiet = console.log;
  for (const [nm, fsim, fhtm] of cases) {
    const mS = fsim ? fsim(simSrc) : simSrc, mH = fhtm ? fhtm(htmSrc) : htmSrc;
    const noop = (fsim && mS === simSrc) || (fhtm && mH === htmSrc);
    let bad = 0;
    if (!noop) {
      console.log = () => {};
      try { bad = run(mS, mH); } catch (e) { bad = 1; }
      console.log = quiet;
    } else noopN++;
    const okc = !noop && bad > 0;
    if (okc) caught++;
    console.log(`  ${okc ? '✓' : '✗'} ${nm} → ${okc ? '빨개진다'
      : noop ? '🔴 돌연변이가 원본을 안 바꾼다 (문자열이 낡았다 = 죽은 검사)' : '🔴 안 잡힌다 (죽은 검사)'}`);
  }
  /* 양성 대조군 — 원본은 전부 통과해야 한다 (오탐 0) */
  console.log = () => {};
  let base = 0; try { base = run(simSrc, htmSrc); } catch (e) { base = 1; }
  console.log = quiet;
  console.log(`  ${base === 0 ? '✓' : '✗'} 양성 대조군: 원본이 통과한다 (오탐 ${base}건)`);
  console.log(`\n[음성 검사] ${caught}/${cases.length} · no-op ${noopN} · 오탐 ${base}`);
  process.exit(caught === cases.length && noopN === 0 && base === 0 ? 0 : 1);
}

console.log('⚑⚑⚑ T136 게이트 — 창의 화신: 화살이 창이 되되 창 데미지·8관통은 그대로 (주인 확정 T105)');
process.exit(run(simSrc, htmSrc) ? 1 : 0);
