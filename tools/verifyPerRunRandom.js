#!/usr/bin/env node
/* ⚑⚑⚑ T134 게이트 — «스킨·첫 공격 타이머·전투 난수는 그대로 매판 굴린다»
 *
 * 주인 확정 T105 ② (2026-09-03 17:0X) 원문:
 *   «두 엔진의 웨이브 생성부는 Math.random() 대신 노드의 ranged[j] 를 읽는다.
 *    스킨·첫 공격 타이머·전투 난수(치명·회피·소환)는 **연출·전투 난수라 그대로 매판 굴린다**
 *    (주인 «배치» 범위 밖 — 위임).»
 *
 * ⚑ 왜 있나 (T130·T131 이 두 번 연속으로 짚은 자리와 같은 종류다).
 *   한 문장에 «A 는 고정하되 B 는 그대로» 가 있으면 **A 만 게이트가 생긴다.**
 *   T105·T114 의 «고정» 반쪽(원거리 자리·마릿수)은 `verifyChapterFixed` ⓔ~ⓙ 가 33항목으로 지키고,
 *   T3 `battle.js` 도 실측한다. 그런데 **«그대로 매판 굴린다» 반쪽은 두 엔진 어디에도 단언이 없었다.**
 *   사본 실측(T134): `atkTimer:rand(0.4,1.2)` 를 두 엔진에서 상수 `0.8` 로 굳혔더니
 *   **정적 게이트 19종·T3 4스위트(241)가 전부 초록인 채**로
 *   일반 풀셋 클리어율이 ch7 90.1→91.7 · ch8 81.8→84.4 · **ch9 55.7→60.8%** 로 올라갔다
 *   (시드 3벌 × 2,000판 · 시드 간 흔들림은 ±1%p 라 잡음이 아니다). 밸런스 자(尺)가 소리 없이 움직인다.
 *   더 나쁜 갈래는 «타이머·전투 난수까지 챕터 시드로 옮기는» 것이다 — 그러면 같은 챕터는 매번
 *   **글자 그대로 같은 판**이 되어 게임이 죽는데, 지금 게이트는 한 줄도 안 본다.
 *
 * 이 게이트는 엔진 수치를 한 개도 안 본다 — «어느 난수 스트림에서 굴리는가» 만 본다.
 * 밸런스와 무관하고, 주인 상시 규칙(«적 스탯은 한 글자도 건드리지 않는다»)과도 무관하다.
 *
 * 보는 것:
 *   ⓐ 첫 공격 타이머 — 두 엔진 웨이브 생성부가 매판 `rand(a,b)` 로 굴린다 (정적)
 *   ⓑ 스킨·흔들림 — 게임이 매판 `pick()`·`Math.random()` 으로 굴린다 (정적 · 연출은 게임 몫)
 *   ⓒ 전투 난수(치명·적 회피·플레이어 회피·반격·소환/발동·오발)가 두 엔진에서 매판 굴려진다 (정적)
 *   ⓓ 챕터 시드는 타이머·스킨을 안 싣는다 — `chapterLayout` 출력 키 전수 + 시드 스트림 분리 (실측)
 *   ⓔ 스폰 실측 — 같은 챕터를 두 번 세워도 «자리는 같고 타이머는 다르다» · 굴림 수 = 일반 적 수
 *   ⓕ 전투 실측 — 같은 챕터 두 판의 지문이 다르고, `Math.random` 을 얼리면 완전히 같아진다
 *
 * 사용: node tools/verifyPerRunRandom.js         (exit 0 = 통과, 1 = 불합격)
 *      node tools/verifyPerRunRandom.js --self  (음성 검사 — 전부 잡히면 exit 0)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const R = [];
const chk = (n, c, d) => { R.push({ n, c }); console.log(`  ${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); return c; };

/* ── 소스에서 «웨이브 적 하나를 만드는 자리» 만 떼어 낸다 ────────────────────────────────
   두 엔진 다 `const ranged=<노드에서 읽기>;` 바로 뒤가 그 자리다 (T105 가 그렇게 못 박았다). */
function spawnBlock(src, engine) {
  const anchor = engine === 'sim' ? 'const ranged=node.ranged[j];' : 'const ranged=nl.ranged[j];';
  const i = src.indexOf(anchor);
  if (i < 0) return null;
  return src.slice(i, i + 700);
}
/* `atkTimer:rand(0.4,1.2)` 의 범위를 소스에서 읽는다 — 게이트에 숫자를 박지 않는다.
   («그대로» 조항이 지키는 것은 «굴린다» 이지 특정 숫자가 아니다. 숫자를 박으면 주인이
   범위를 바꿀 때 이 게이트가 «그대로» 와 무관한 이유로 빨개진다.) */
const timerRange = blk => {
  const m = blk && blk.match(/atkTimer\s*:\s*rand\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
};

/* ── 시뮬을 vm 으로 올린다. Math 를 갈아끼울 수 있게 샌드박스에 직접 넣는다 ───────────────
   (sim.js 는 `Math.random` 을 쓰고 `setSeed` 도 그것을 갈아끼운다 — 즉 «매판 스트림» 의 정체가
    `Math.random` 이다. 여기서 그 스트림을 세거나 얼려 보는 것이 이 게이트의 실측 수법이다.) */
function loadSim(src, hook) {
  const body = src.replace(/const mode=process\.argv[\s\S]*$/,
    'module.exports={runChapter,chapterLayout,mkBuild,TUNE};');
  const M = Object.create(Math);
  M.random = () => { hook.n++; return hook.frozen === null ? Math.random() : hook.frozen; };
  const m = { exports: {} };
  vm.runInNewContext(body, { module: m, exports: m.exports, process, console: { log() {} }, require, Math: M });
  return m.exports;
}
/* 전투 루프 «앞» 에서 멈추는 사본 — 스폰 직후의 `G` 를 그대로 돌려준다.
   (엔진을 고치는 것이 아니라 게이트가 쓰는 사본만 자른다. `verifyChapterFixed` 의 `loadLayout` 과 같은 수법.) */
const CUT = '  const dt=1/30;';
function loadSpawn(src, hook) {
  if (src.indexOf(CUT) < 0) return null;
  return loadSim(src.replace(CUT, '  return {__spawn:G};\n' + CUT), hook);
}
/* 두 엔진에서 `chapterLayout` 만 떼어 같은 방식으로 평가한다 (`verifyChapterFixed` 와 같은 수법).
   여기서는 «무엇을 싣고 있나» 와 «Math.random 을 쓰나» 두 가지만 본다. */
function loadLayout(src, M) {
  const mul = src.split('\n').find(l => l.startsWith('function mulberry'));
  const lines = src.split('\n');
  const a = lines.findIndex(l => l.startsWith('const LAYOUT_MAXENEMY'));
  const f = lines.findIndex((l, i) => i > a && l.startsWith('function chapterLayout'));
  const b = lines.findIndex((l, i) => i > f && l === '}');
  if (!mul || a < 0 || f < 0 || b < 0) return null;
  const code = mul + '\nconst clamp=(v,x,y)=>Math.max(x,Math.min(y,v));\n' + lines.slice(a, b + 1).join('\n') + '\n;chapterLayout';
  try { return vm.runInNewContext(code, { Math: M }); } catch (e) { return null; }
}

/* 전투 난수 여섯 갈래 — 이름 · sim.js 정규식 · index.html 정규식.
   전부 «`Math.random()` 에서 굴리는가» 를 본다. 챕터 시드(`rnd`/`mulberry`)로 옮기면 여기서 걸린다. */
const COMBAT = [
  ['치명', /const crit\s*=\s*Math\.random\(\)\s*\*\s*100\s*</, /const crit\s*=\s*Math\.random\(\)\s*\*\s*100\s*</],
  ['적 회피(ENEMY_EVADE)', /Math\.random\(\)\s*<\s*ENEMY_EVADE/, /Math\.random\(\)\s*<\s*ENEMY_EVADE/],
  ['플레이어 회피', /Math\.random\(\)\s*\*\s*100\s*<\s*effEvade\(/, /Math\.random\(\)\s*\*\s*100\s*<\s*effEvade\(/],
  ['반격', /Math\.random\(\)\s*\*\s*100\s*<\s*effCounter\(/, /Math\.random\(\)\s*\*\s*100\s*<\s*effCounter\(/],
  ['소환·발동(pkk)', /pkk\s*=\s*\(p,\s*ch\)\s*=>\s*Math\.random\(\)\s*</, /function pkk\([^)]*\)\s*\{\s*return\s+Math\.random\(\)\s*</],
  ['화살 오발(misfire)', /misfire>0\s*&&\s*Math\.random\(\)\s*<\s*p\.misfire/, /misfire>0\s*&&\s*Math\.random\(\)\s*<\s*p\.misfire/],
];

function run(simSrc, htmSrc) {
  R.length = 0;

  /* ===== ⓐ 첫 공격 타이머 — 두 엔진 웨이브 생성부 (정적) ===== */
  console.log('\n=== ⓐ 첫 공격 타이머 — 웨이브 생성부가 매판 굴린다 (두 엔진) ===');
  const sBlk = spawnBlock(simSrc, 'sim'), hBlk = spawnBlock(htmSrc, 'htm');
  chk('sim.js 웨이브 생성부를 찾았다 (`const ranged=node.ranged[j];`)', !!sBlk);
  chk('index.html 웨이브 생성부를 찾았다 (`const ranged=nl.ranged[j];`)', !!hBlk);
  const sR = timerRange(sBlk), hR = timerRange(hBlk);
  chk('sim.js: 적 첫 공격 타이머를 `rand(a,b)` 로 매판 굴린다', !!sR, sR ? `rand(${sR[0]},${sR[1]})` : '상수이거나 자리가 없다');
  chk('index.html: 적 첫 공격 타이머를 `rand(a,b)` 로 매판 굴린다', !!hR, hR ? `rand(${hR[0]},${hR[1]})` : '상수이거나 자리가 없다');
  chk('두 엔진의 타이머 범위가 같다', !!sR && !!hR && sR[0] === hR[0] && sR[1] === hR[1],
    `sim ${sR ? sR.join('~') : '—'} / html ${hR ? hR.join('~') : '—'}`);
  chk('범위가 실제로 폭이 있다 (a < b — 사실상 상수로 좁히면 «굴린다» 가 뜻을 잃는다)',
    !!sR && sR[0] < sR[1], sR ? `폭 ${(sR[1] - sR[0]).toFixed(2)}s` : '');
  for (const [nm, src] of [['sim.js', simSrc], ['index.html', htmSrc]])
    chk(`${nm}: \`rand\` 가 매판 스트림(Math.random) 기반이다`,
      /const rand\s*=\s*\(\s*a\s*,\s*b\s*\)\s*=>\s*a\s*\+\s*Math\.random\(\)\s*\*\s*\(\s*b\s*-\s*a\s*\)/.test(src));
  /* «노드에서 읽는 것은 ranged 뿐» — 타이머·스킨을 챕터 노드에 실어 읽으면 여기서 걸린다 */
  chk('sim.js: 생성부가 챕터 노드에서 읽는 것은 `ranged` 뿐이다',
    !!sBlk && !/node\.(atkTimer|skin|bob|timer)/.test(sBlk));
  chk('index.html: 생성부가 챕터 노드에서 읽는 것은 `ranged` 뿐이다',
    !!hBlk && !/nl\.(atkTimer|skin|bob|timer)/.test(hBlk));
  /* 보스 타이머는 원래부터 «상수» 다 — «일반 적만 굴린다» 는 반쪽이라 같이 못 박는다.
     숫자는 박지 않는다(주인이 값을 바꿀 수 있다) — «굴리지 않는다» 와 «두 엔진이 같다» 만 본다. */
  const bossT = src => { const i = src.indexOf("t==='boss'") >= 0 ? src.indexOf("t==='boss'") : src.indexOf("type==='boss'");
    const blk = i < 0 ? '' : src.slice(i, i + 600);
    const m = blk.match(/atkTimer\s*:\s*([\d.]+)\s*,\s*stun/);
    return { blk, v: m ? m[1] : null }; };
  const bS = bossT(simSrc), bH = bossT(htmSrc);
  chk('보스 첫 공격 타이머는 두 엔진 다 상수다 (굴리지 않는다 — 일반 적만 굴린다)',
    bS.v !== null && bH.v !== null && !/atkTimer\s*:\s*rand\(/.test(bS.blk) && !/atkTimer\s*:\s*rand\(/.test(bH.blk),
    `sim ${bS.v} / html ${bH.v}`);
  chk('두 엔진의 보스 타이머 상수가 같다', bS.v !== null && bS.v === bH.v, `sim ${bS.v} / html ${bH.v}`);

  /* ===== ⓑ 스킨·흔들림 — 게임 전용 연출 난수 (정적) ===== */
  console.log('\n=== ⓑ 스킨·흔들림 — 게임이 매판 굴린다 (연출 난수 · 주인 «배치» 범위 밖) ===');
  chk('index.html: 적 스킨을 매판 `pick()` 으로 뽑는다 (원거리/근접 각각)',
    !!hBlk && /skin\s*:\s*ranged\s*\?\s*pick\(\s*RANGED_SKINS\s*\)\s*:\s*pick\(\s*ENEMY_SKINS\s*\)/.test(hBlk));
  chk('index.html: `pick` 이 매판 스트림(Math.random) 기반이다',
    /const pick\s*=\s*\w+\s*=>\s*\w+\[\s*Math\.floor\(\s*Math\.random\(\)\s*\*/.test(htmSrc));
  chk('index.html: 적 흔들림(bob)을 매판 굴린다',
    !!hBlk && /bob\s*:\s*Math\.random\(\)\s*\*/.test(hBlk));
  const skinN = nm => { const m = htmSrc.match(new RegExp('const ' + nm + '\\s*=\\s*\\[([\\s\\S]*?)\\n\\];')); return m ? (m[1].match(/\{/g) || []).length : 0; };
  chk('스킨 풀이 두 종 이상이다 (한 종으로 굳으면 «뽑는다» 가 뜻을 잃는다)',
    skinN('ENEMY_SKINS') >= 2 && skinN('RANGED_SKINS') >= 2,
    `근접 ${skinN('ENEMY_SKINS')}종 · 원거리 ${skinN('RANGED_SKINS')}종`);

  /* ===== ⓒ 전투 난수 — 두 엔진 (정적) ===== */
  console.log('\n=== ⓒ 전투 난수(치명·회피·반격·소환·오발)가 매판 굴려진다 (두 엔진) ===');
  for (const [nm, rs, rh] of COMBAT) {
    chk(`sim.js: ${nm} 판정이 매판 스트림(Math.random)에서 굴려진다`, rs.test(simSrc));
    chk(`index.html: ${nm} 판정이 매판 스트림(Math.random)에서 굴려진다`, rh.test(htmSrc));
  }
  /* 챕터 시드 스트림은 `chapterLayout` 안에서만 산다 — 전투부로 새면 판이 챕터마다 굳는다 */
  for (const [nm, src] of [['sim.js', simSrc], ['index.html', htmSrc]]) {
    const after = src.slice(src.indexOf('function chapterLayout'));
    const tail = after.slice(after.indexOf('\n}\n') + 3);
    chk(`${nm}: 챕터 시드 RNG(mulberry)가 chapterLayout 밖으로 안 샜다`,
      !/mulberry\(/.test(tail), (tail.match(/.*mulberry\(.*/g) || []).slice(0, 2).join(' / '));
  }

  /* ===== ⓓ 챕터 시드가 싣는 것은 «자리» 뿐 (실측 · 두 엔진) ===== */
  console.log('\n=== ⓓ 챕터 시드는 타이머·스킨을 안 싣는다 (chapterLayout 실측 · 두 엔진) ===');
  const hook = { n: 0, frozen: null };
  const S = loadSim(simSrc, hook);
  const MAXC = S.TUNE.maxChapter;
  for (const [nm, src] of [['sim.js', simSrc], ['index.html', htmSrc]]) {
    const cnt = { n: 0 };
    const M = Object.create(Math); M.random = () => { cnt.n++; return Math.random(); };
    const L = loadLayout(src, M);
    if (!L) { chk(`${nm}: chapterLayout 을 떼어 낼 수 있다`, false); continue; }
    let extra = [], keysBad = [];
    for (let c = 1; c <= MAXC; c++) {
      for (const nd of L(c)) {
        if (nd.t !== 'wave') continue;
        for (const k of Object.keys(nd))
          if (!['t', 'size', 'ranged'].includes(k) && extra.length < 4) extra.push(`ch${c}.${k}`);
        if (!Array.isArray(nd.ranged) && keysBad.length < 4) keysBad.push(`ch${c} ranged 없음`);
      }
    }
    chk(`${nm}: 웨이브 노드가 싣는 것은 t·size·ranged 뿐이다 (타이머·스킨이 챕터에 굳지 않았다)`,
      extra.length === 0 && keysBad.length === 0, extra.concat(keysBad).join(' / ') || `챕터 1~${MAXC} 전수`);
    chk(`${nm}: chapterLayout 이 매판 스트림(Math.random)을 한 번도 안 쓴다 (자리는 판마다 안 흔들린다)`,
      cnt.n === 0, `${cnt.n}회`);
  }

  /* ===== ⓔ 스폰 실측 — 자리는 같고 타이머는 다르다 (sim.js) ===== */
  console.log('\n=== ⓔ 스폰 실측 — 같은 챕터 두 번: 자리는 같고 첫 공격 타이머는 다르다 (sim.js) ===');
  const SP = loadSpawn(simSrc, hook);
  if (!SP) {
    chk('전투 루프 앞에서 멈추는 사본을 만들 수 있다 (`const dt=1/30;` 앵커)', false);
  } else {
    const b = SP.mkBuild(0, 0, 0);
    const spawn = c => { hook.n = 0; const G = SP.runChapter(c, b, {}).__spawn; const n = hook.n;
      const mob = G.nodes.flatMap(nd => nd.enemies).filter(e => !e.isBoss);
      const boss = G.nodes.flatMap(nd => nd.enemies).filter(e => e.isBoss);
      return { rolls: n, mob: mob.length, boss,
        pat: G.nodes.filter(nd => nd.type === 'wave').map(nd => nd.enemies.map(e => e.ranged ? '1' : '0').join('')).join('|'),
        t: mob.map(e => e.atkTimer) }; };
    const A = spawn(9), B = spawn(9);
    chk('같은 챕터를 두 번 세우면 원거리 «자리» 는 완전히 같다 (T105 고정 반쪽 재확인)',
      A.pat === B.pat && A.pat.length > 0, `챕터 9 · ${A.pat.replace(/\|/g, ' ')}`);
    chk('같은 챕터를 두 번 세우면 첫 공격 «타이머» 는 다르다 (T105 «그대로 매판 굴린다»)',
      A.t.join(',') !== B.t.join(','), `1회차 ${A.t[0].toFixed(3)} / 2회차 ${B.t[0].toFixed(3)}`);
    chk('한 판 안에서도 적마다 타이머가 다르다 (한 값으로 굳지 않았다)',
      new Set(A.t).size === A.t.length, `${new Set(A.t).size}/${A.t.length}종`);
    if (sR) {
      const mn = Math.min(...A.t.concat(B.t)), mx = Math.max(...A.t.concat(B.t)), w = sR[1] - sR[0];
      chk('타이머가 선언 범위 안이고 범위를 실제로 채운다',
        mn >= sR[0] && mx <= sR[1] && mn < sR[0] + w * 0.25 && mx > sR[1] - w * 0.25,
        `${mn.toFixed(3)}~${mx.toFixed(3)} (선언 ${sR[0]}~${sR[1]})`);
    }
    /* 굴림 수 = 일반 적 수 — 상수화(0회) · 이중 굴림(2배) · 챕터 시드 이동(0회)이 전부 여기서 걸린다.
       챕터를 여러 개 재서 «마릿수를 따라 움직인다» 까지 본다 (한 챕터만 보면 우연히 맞을 수 있다). */
    const rows = [1, 9, 15, 38].map(c => { const s = spawn(c); return `ch${c} ${s.rolls}/${s.mob}`; });
    const ok = [1, 9, 15, 38].every(c => { const s = spawn(c); return s.rolls === s.mob && s.mob > 0; });
    chk('스폰이 매판 스트림을 «정확히 일반 적 수» 만큼 굴린다 (적 하나당 타이머 한 번)', ok, rows.join(' · '));
    chk('보스는 타이머를 안 굴린다 (상수 그대로)', A.boss.length === 1 && A.boss[0].atkTimer === B.boss[0].atkTimer,
      `보스 타이머 ${A.boss.length ? A.boss[0].atkTimer : '—'}`);
  }

  /* ===== ⓕ 전투 실측 — 판마다 새로 굴린다 (sim.js) ===== */
  console.log('\n=== ⓕ 전투 실측 — 같은 챕터 두 판이 다르고, 매판 스트림을 얼리면 같아진다 (sim.js) ===');
  {
    const b = S.mkBuild(0, 0, 0);
    const fp = r => [r.clear, r.time.toFixed(4), r.gold, r.level, r.atkTries, r.miss].join('/');
    hook.frozen = null;
    /* 지문이 우연히 겹칠 수 있으니 5판을 재서 «서로 다른 지문이 2개 이상» 을 본다 (잡음 방지). */
    hook.n = 0; const r1 = fp(S.runChapter(9, b, {})); const c1 = hook.n;
    hook.n = 0; const r2 = fp(S.runChapter(9, b, {})); const c2 = hook.n;
    const seen = new Set([r1, r2]);
    for (let i = 0; i < 3 && seen.size < 2; i++) seen.add(fp(S.runChapter(9, b, {})));
    chk('같은 챕터·같은 빌드를 여러 판 돌리면 지문이 갈린다 (전투가 판마다 새로 굴려진다)',
      seen.size >= 2, `${seen.size}종 · ${r1} vs ${r2}`);
    chk('한 판이 스폰(=적 수)보다 훨씬 많이 굴린다 (전투부가 실제로 난수를 쓴다)', c1 > 100 && c2 > 100,
      `${c1}회 / ${c2}회`);
    hook.frozen = 0.5;
    const f1 = fp(S.runChapter(9, b, {})), f2 = fp(S.runChapter(9, b, {}));
    hook.frozen = null;
    chk('매판 스트림을 얼리면 두 판이 완전히 같아진다 (판 간 변동이 전부 Math.random 을 통한다)',
      f1 === f2, `${f1}`);
  }

  const bad = R.filter(x => !x.c).length;
  console.log(`\n[T134 매판 난수 게이트] 통과 ${R.length - bad} · 불합격 ${bad}`);
  return bad;
}

const simSrc = fs.readFileSync(path.join(ROOT, 'sim.js'), 'utf8');
const htmSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

if (process.argv.includes('--self')) {
  /* 음성 검사 — 「매판 굴린다」를 깨는 돌연변이를 사본에 심고 이 게이트가 빨개지는지 본다.
     ⚑ T126 규약 — 돌연변이 문자열이 낡아 replace 가 no-op 이 되면 사본 = 원본이라 «통과» 가 되고
     이 케이스는 아무것도 안 지키면서 숫자만 올린다. no-op 은 그 자리에서 불합격으로 떨어뜨린다. */
  const cases = [
    ['첫 공격 타이머를 상수로 굳히면 (sim)',
      s => s.replace('atkTimer:rand(0.4,1.2),stun:0', 'atkTimer:0.8,stun:0'), null],
    ['첫 공격 타이머를 상수로 굳히면 (게임)',
      null, s => s.replace('atkTimer:rand(0.4,1.2), stun:0', 'atkTimer:0.8, stun:0')],
    ['타이머 범위를 사실상 상수로 좁히면 (두 엔진)',
      s => s.replace('atkTimer:rand(0.4,1.2)', 'atkTimer:rand(0.8,0.8)'),
      s => s.replace('atkTimer:rand(0.4,1.2)', 'atkTimer:rand(0.8,0.8)')],
    ['두 엔진의 타이머 범위가 갈리면 (게임만 0.4~2.0)',
      null, s => s.replace('atkTimer:rand(0.4,1.2)', 'atkTimer:rand(0.4,2.0)')],
    ['타이머를 챕터 시드로 옮기면 (같은 챕터 = 늘 같은 타이머)',
      s => s.replace('atkTimer:rand(0.4,1.2),stun:0', 'atkTimer:0.4+0.8*(((chapter*7+j)%10)/10),stun:0'), null],
    ['타이머를 챕터 노드에 실어 읽으면 (레이아웃이 타이머를 싣는다)',
      s => s.replace('  for(const nd of out) if(nd.t===\'wave\') nd.ranged=new Array(nd.size).fill(false);',
        '  for(const nd of out) if(nd.t===\'wave\'){ nd.ranged=new Array(nd.size).fill(false); nd.atkTimer=new Array(nd.size).fill(0).map(()=>0.4+0.8*rnd()); }')
        .replace('atkTimer:rand(0.4,1.2),stun:0', 'atkTimer:node.atkTimer[j],stun:0'), null],
    ['스폰에서 타이머를 두 번 굴리면 (굴림 수가 적 수와 어긋난다)',
      s => s.replace('atkTimer:rand(0.4,1.2),stun:0', 'atkTimer:(rand(0.4,1.2)+rand(0.4,1.2))/2,stun:0'), null],
    ['보스 타이머까지 매판 굴리면 (게임 — «일반 적만 굴린다» 위반)',
      null, s => s.replace('atkTimer:1.2, stun', 'atkTimer:rand(1.0,1.4), stun')],
    ['두 엔진의 보스 타이머 상수가 갈리면 (sim 만 1.5)',
      s => s.replace('atkTimer:1.2,stun', 'atkTimer:1.5,stun'), null],
    ['게임 스킨을 한 종으로 굳히면',
      null, s => s.replace('skin: ranged?pick(RANGED_SKINS):pick(ENEMY_SKINS),', 'skin: ranged?RANGED_SKINS[0]:ENEMY_SKINS[0],')],
    ['게임 스킨 풀을 한 종으로 줄이면',
      null, s => s.replace(/const RANGED_SKINS=\[\n[\s\S]*?\n\];/,
        "const RANGED_SKINS=[\n  {body:'#5E7C8A', hat:'hood', weapon:'bow'},\n];")],
    ['게임 적 흔들림(bob)을 상수로 굳히면',
      null, s => s.replace('bob:Math.random()*7,', 'bob:3.5,')],
    ['치명을 매판 스트림에서 떼면 (sim)',
      s => s.replace('const crit=Math.random()*100<cr;', 'const crit=false;'), null],
    ['치명을 매판 스트림에서 떼면 (게임)',
      null, s => s.replace('const crit=Math.random()*100<cr;', 'const crit=false;')],
    ['적 회피를 «항상 안 피함» 으로 굳히면 (sim)',
      s => s.replace(/Math\.random\(\)<ENEMY_EVADE/g, 'false'), null],
    ['플레이어 회피를 굴리지 않으면 (게임)',
      null, s => s.replace('if(Math.random()*100<effEvade(p)){', 'if(false){')],
    ['반격을 굴리지 않으면 (sim)',
      s => s.replace('const cc=Math.random()*100<effCounter(p);', 'const cc=false;'), null],
    ['소환·발동(pkk)을 매판 스트림에서 떼면 (sim)',
      s => s.replace('const pkk=(p,ch)=>Math.random()<ch*(p.px.procX2?1.22:1);',
        'const pkk=(p,ch)=>ch*(p.px.procX2?1.22:1)>0.5;'), null],
    ['화살 오발을 굴리지 않으면 (게임)',
      null, s => s.replace('const friendly = p.misfire>0 && Math.random()<p.misfire;', 'const friendly = false;')],
    ['`rand` 를 챕터 시드 스트림으로 갈아끼우면 (sim — 타이머가 통째로 챕터에 굳는다)',
      s => s.replace('const rand=(a,b)=>a+Math.random()*(b-a);',
        'let __cr=mulberry(7); const rand=(a,b)=>a+__cr()*(b-a);'), null],
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

console.log('⚑⚑⚑ T134 게이트 — 스킨·첫 공격 타이머·전투 난수는 그대로 매판 굴린다 (주인 확정 T105 ②)');
process.exit(run(simSrc, htmSrc) ? 1 : 0);
