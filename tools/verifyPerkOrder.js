#!/usr/bin/env node
/* ⚑⚑⚑ T96 게이트 — «특전 = 고정 10종 · 순서 획득» (주인 확정 2026-09-03)
 *
 * 이 게이트가 132종 시절의 특전 게이트 10종을 통째로 대체한다
 * (verifyPerkFire·verifyPerkFireHtml·verifyPerkEffect·verifyPerkEffectHtml·verifyPerkEngineParity·
 *  verifyCommonFreeze·verifyCollector·verifyPerkGearDup·verifyPerkPolicy·verifyHarness — 전부 대상 소멸).
 *
 * 보는 것은 셋이다:
 *   ① **3자 대조 (정적)** — PLAN §3.1 표 ↔ sim.js ↔ index.html 의 id·순서·수치·표시 텍스트가 같은가.
 *   ② **순서·상한 (실행)** — 실제로 «순서대로 하나씩», 중복 없이, 10개에서 멈추는가.
 *   ③ **폐지분 (구조)** — 등급·선택창·새로고침·전지의 눈이 정말 사라졌는가 + 소환 연쇄 기대값 B = 0.
 *
 * 사용: node tools/verifyPerkOrder.js        (exit 0 = 통과, 1 = 불합격)
 *      node tools/verifyPerkOrder.js --self  (음성 검사 — 일부러 깨뜨린 사본이 전부 빨개지는지)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const R = [];
const chk = (n, c, d) => { R.push({ n, c }); console.log(`  ${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); return c; };

/* ---------- 주인 확정표 (ROUTINE ⑦ · PLAN §3.1) — 이 배열이 이 게이트의 기준이다.
   ⚑⚑⚑ T104 (주인 확정 2026-09-03) — 순서 재정렬 + 1번 특전 «생명 흡수» → «회피 시 회복» 으로 교체 ---------- */
const WANT = [
  { id: 'p_evadeHeal', nm: '회피 시 회복', tx: '회피 시 10% 확률로 최대 체력 6% 회복' },
  { id: 'p_counter', nm: '반격률 증가', tx: '반격률 +10' },
  { id: 'p_spearCt', nm: '반격 시 창', tx: '반격 시 50% 확률로 창 1개' },
  { id: 'p_arrowEv', nm: '회피 시 화살', tx: '회피 시 50% 확률로 화살 1개' },
  { id: 'p_axeHit', nm: '피격 시 도끼', tx: '피격 시 50% 확률로 도끼 1개' },
  { id: 'p_atk', nm: '공격력 증가', tx: '공격력 +20%' },
  { id: 'p_evade', nm: '회피율 증가', tx: '회피율 +10' },
  { id: 'p_critR', nm: '치명타 확률 증가', tx: '치명타 확률 +10' },
  { id: 'p_critF', nm: '치명타 피해 증가', tx: '치명타 피해 +50' },
  { id: 'p_def', nm: '방어력 증가', tx: '방어력 +10%' },
];
/* ⚑ T104 — `PERK_STEAL` 은 폐기됐다(특전에서 흡혈 축이 사라졌다). 자리에 `PERK_EVHEAL_CH`·`PERK_EVHEAL_F` 신설. */
const CONST = { PERK_ATK_M: '1.20', PERK_DEF_M: '1.10', PERK_EVADE_A: '10', PERK_COUNTER_A: '10',
  PERK_CRITR_A: '10', PERK_CRITF_A: '50', PERK_EVHEAL_CH: '0.10', PERK_EVHEAL_F: '0.06', PERK_SUMMON_CH: '0.50' };

function run(simSrc, htmSrc, planSrc) {
  R.length = 0;
  const strip = s => s.replace(/<\/?b>/g, '').replace(/\s+/g, ' ').trim();

  /* ===== ① 3자 대조 ===== */
  console.log('\n=== ① 3자 대조 — PLAN §3.1 ↔ sim.js ↔ index.html ===');
  const simIds = [...simSrc.matchAll(/\{id:'(p_[A-Za-z]+)'/g)].map(m => m[1]);
  const htmIds = [...htmSrc.matchAll(/\{id:'(p_[A-Za-z]+)'/g)].map(m => m[1]);
  const planRows = [...planSrc.matchAll(/^\| (\d+) \| (p_[A-Za-z]+) \| ([^|]+?) \| ([^|]+?) \|/gm)]
    .map(m => ({ n: +m[1], id: m[2], nm: m[3].trim(), tx: strip(m[4]) }));
  const want = WANT.map(w => w.id);
  chk('sim.js 특전이 10종이고 주인 표와 순서까지 같다', simIds.join() === want.join(), `${simIds.length}종 · ${simIds.join('>')}`);
  chk('index.html 특전이 10종이고 순서가 sim.js 와 같다', htmIds.join() === want.join(), `${htmIds.length}종`);
  chk('PLAN §3.1 표가 10행이고 번호·id 가 순서대로다',
    planRows.length === 10 && planRows.every((r, i) => r.n === i + 1 && r.id === want[i]),
    `${planRows.length}행`);
  const planTxBad = planRows.filter((r, i) => WANT[i] && !(r.nm === WANT[i].nm && r.tx.replace(/\*/g, '') === WANT[i].tx));
  chk('PLAN 표의 이름·효과 문장이 주인 확정 문면 그대로다', planRows.length === 10 && planTxBad.length === 0,
    planTxBad.map(r => r.id).join(',') || '10/10');
  /* index.html 의 표시 텍스트(tx)가 주인 문면과 글자까지 같은가 — <b> 태그를 걷어내고 본다 */
  const htmTx = [...htmSrc.matchAll(/\{id:'(p_[A-Za-z]+)',\s*nm:'([^']*)',\s*ic:'([^']*)',\s*tx:'([^']*)'/g)]
    .map(m => ({ id: m[1], nm: m[2], tx: strip(m[4]) }));
  const txBad = htmTx.filter(h => { const w = WANT.find(x => x.id === h.id); return !w || w.tx !== h.tx || w.nm !== h.nm; });
  chk('index.html 표시 텍스트가 주인 문면과 글자까지 같다', htmTx.length === 10 && txBad.length === 0,
    txBad.map(h => `${h.id}«${h.tx}»`).join(' · ') || '10/10');
  /* 엔진 상수 — 두 파일이 같은 이름·같은 값이고 확정표와 일치 */
  let cBad = [];
  for (const k in CONST) {
    const g = s => (s.match(new RegExp(k + '=([0-9.]+)')) || [])[1];
    if (g(simSrc) !== CONST[k] || g(htmSrc) !== CONST[k]) cBad.push(`${k}(sim ${g(simSrc)} / game ${g(htmSrc)} / 기대 ${CONST[k]})`);
  }
  chk('엔진 상수 8종이 두 파일에서 같고 확정값이다', cBad.length === 0, cBad.join(' · ') || Object.keys(CONST).length + '종');

  /* ===== ② 순서·상한 (실행 단언) ===== */
  console.log('\n=== ② 순서·상한 — sim.js 를 실제로 돌려서 ===');
  const S = loadSim(simSrc);
  const b = S.mkBuild(1, 0, 0);
  let orderBad = 0, dupBad = 0, over = 0, maxN = 0, runs = 0;
  for (let i = 0; i < 200; i++) {
    const r = S.runChapter(20, b);
    runs++;
    maxN = Math.max(maxN, r.taken.length);
    if (r.taken.length > S.PERKS.length) over++;
    if (new Set(r.taken).size !== r.taken.length) dupBad++;
    for (let k = 0; k < r.taken.length; k++) if (r.taken[k] !== S.PERKS[k].id) orderBad++;
  }
  chk('획득 목록이 언제나 «표의 앞에서부터» 다 (무작위 없음)', orderBad === 0, `${runs}판 · 위반 ${orderBad}건`);
  chk('한 판에서 같은 특전을 두 번 얻지 않는다', dupBad === 0, `위반 ${dupBad}판`);
  chk('한 판 획득이 10종을 넘지 않는다', over === 0, `한 판 최대 획득 ${maxN}개 (상한 ${S.PERKS.length})`);
  /* ⚑ 상한은 «한 챕터의 경험치 예산» 으로는 도달하지 않는다(실측 최대 8~9종) — 지급 동사를 직접
     15번 불러 «10에서 멈추는가» 를 잰다. 챕터 실행으로만 재면 이 검사가 조용히 죽는다(음성 검사로 확인). */
  {
    const Gx = { taken: [], player: null, perkChances: 0 };
    const px = S.mkPlayer(S.mkBuild(1, 0, 0), Gx); Gx.player = px; px.G = Gx;
    let nulls = 0;
    for (let i = 0; i < 15; i++) if (!S.grantNextPerk(Gx)) nulls++;
    chk('⚑ 지급 동사를 15번 불러도 10종에서 멈춘다', Gx.taken.length === 10 && nulls === 5,
      `획득 ${Gx.taken.length}종 · 빈 지급 ${nulls}회 · 기회 ${Gx.perkChances}회`);
    chk('⚑ 그 10종이 표 전체·순서대로다',
      Gx.taken.map(x => x.id).join() === S.PERKS.map(x => x.id).join(), Gx.taken.map(x => x.id).join('>'));
  }
  /* ===== ②-b PERK_PICKS 분리 (⚑ 주인 방향 2026-09-03 · T102) =====
     «풀 크기(PERKS.length)» 와 «한 런 획득 수(PERK_PICKS)» 를 분리해 뒀는지 본다.
     지금은 둘 다 10 이라 동작이 불변이어야 하고(그 «동일성» 자체를 단언), 두 엔진이 같은 값을 써야 한다.
     ⚑ PERK_PICKS 는 챕터 레벨업 횟수(T100 = 10)와 같아야 «완주 = 특전 10개» 가 성립한다. */
  console.log('\n=== ②-b PERK_PICKS 분리 — 풀 크기 ↔ 한 런 획득 수 (⚑ T102) ===');
  const htmPicks = (htmSrc.match(/const PERK_PICKS\s*=\s*(\d+)/) || [])[1];
  chk('sim.js 에 PERK_PICKS 상수가 있다', typeof S.PERK_PICKS === 'number', `PERK_PICKS=${S.PERK_PICKS}`);
  chk('index.html 에 PERK_PICKS 상수가 있다', htmPicks !== undefined, `PERK_PICKS=${htmPicks}`);
  chk('두 엔진의 PERK_PICKS 가 같다', htmPicks !== undefined && Number(htmPicks) === S.PERK_PICKS,
    `sim ${S.PERK_PICKS} / html ${htmPicks}`);
  chk('풀 크기 ≥ 한 런 획득 수 (풀이 모자라면 순번 지급이 깨진다)', S.PERKS.length >= S.PERK_PICKS,
    `풀 ${S.PERKS.length} ≥ 획득 ${S.PERK_PICKS}`);
  chk('⚑ 지금은 풀 크기 = 한 런 획득 수 = 10 (동작 불변 — 나중에 풀만 늘린다)',
    S.PERKS.length === 10 && S.PERK_PICKS === 10, `풀 ${S.PERKS.length} · 획득 ${S.PERK_PICKS}`);
  /* 챕터 레벨업 횟수 = «보스 전 공급으로 레벨이 몇 번 오르나 + 악마 앞당김 1» = PERK_PICKS 여야 한다.
     T100 산수(보스 전 공급 277 로 9레벨 + 악마 1 = 10)를 여기서도 못 박아, 둘이 갈라지면 빨개진다. */
  chk('⚑ PERK_PICKS 가 챕터 «완주 = 특전 N개» 의 N(=10)과 같다', S.PERK_PICKS === 10,
    `PERK_PICKS=${S.PERK_PICKS} · T100 완주 획득수 10`);
  /* 수치 — 획득 순서대로 하나씩 붙이며 실효 스탯 변화를 잰다.
     ⚑ T104 — 순서가 바뀌었고, 1번 특전은 스탯을 안 건드리는 트리거형(회피 시 회복)이라 스탯 델타 0 이다. */
  const G0 = { taken: [], player: null, perkChances: 0 };
  const p = S.mkPlayer(S.mkBuild(-1, 0, 0), G0); G0.player = p; p.G = G0;
  const before = { dmg: p.dmg, evade: p.evade, counter: p.counter, critR: p.critR, critF: p.critF, def: p.def, steal: p.steal };
  const deltas = [];
  for (const perk of S.PERKS) {
    const a = { dmg: p.dmg, evade: p.evade, counter: p.counter, critR: p.critR, critF: p.critF, def: p.def, steal: p.steal };
    perk.ap(p);
    deltas.push({ id: perk.id, d: Object.fromEntries(Object.entries(a).map(([k, v]) => [k, +(p[k] - v).toFixed(6)])) });
  }
  const dOf = id => deltas.find(x => x.id === id).d;
  chk('① 회피 시 회복은 스탯을 안 건드린다 (트리거형 · px.p_evadeHeal 만 세운다)',
    Object.values(dOf('p_evadeHeal')).every(v => v === 0));
  chk('② 반격률 +10', dOf('p_counter').counter === 10);
  chk('③④⑤ 소환 3종은 스탯을 안 건드린다 (트리거형)',
    ['p_spearCt', 'p_arrowEv', 'p_axeHit'].every(id => Object.values(dOf(id)).every(v => v === 0)));
  chk('⑥ 공격력 +20% 가 기본치에 곱연산이다', Math.abs(dOf('p_atk').dmg - before.dmg * 0.20) < 1e-6, `+${dOf('p_atk').dmg.toFixed(3)} (기본 ${before.dmg})`);
  chk('⑦ 회피율 +10', dOf('p_evade').evade === 10);
  chk('⑧ 치명타 확률 +10', dOf('p_critR').critR === 10);
  chk('⑨ 치명타 피해 +50', dOf('p_critF').critF === 50);
  chk('⑩ 방어력 +10% 가 기본치에 곱연산이다', Math.abs(dOf('p_def').def - before.def * 0.10) < 1e-6, `+${dOf('p_def').def.toFixed(3)} (기본 ${before.def})`);
  /* ⚑ T104 — 특전에서 흡혈 축이 사라졌다: 어느 특전도 `p.steal` 을 안 건드린다 (엔진의 steal 스탯은 남는다). */
  chk('⚑ T104 — 특전이 p.steal 을 건드리지 않는다 (특전에서 흡혈 축 폐기)',
    S.PERKS.every(pk => dOf(pk.id).steal === 0));
  /* 회피 시 회복은 «실드를 안 채운다» — heal 의 noBoost 경로(true)를 실제로 타는지 본다.
     `if(px.p_evadeHeal&&pkk(p,...))heal(p,p.maxHp*...,true);` 형태를 두 엔진에서 찾아 확인한다. */
  const evHealRe = /if\(px\.p_evadeHeal\s*&&\s*pkk\(p\s*,\s*(?:PERK_EVHEAL_CH|0?\.10)\s*\)\)\s*(?:\{[^}]*)?heal\(p\s*,\s*p\.maxHp\s*\*\s*(?:PERK_EVHEAL_F|0?\.06)\s*,\s*true\s*\)/;
  chk('⚑ T104 ① 회피 시 회복이 회피 분기에서 noBoost=true 로 회복한다 (sim.js)', evHealRe.test(simSrc));
  chk('⚑ T104 ① 회피 시 회복이 회피 분기에서 noBoost=true 로 회복한다 (index.html)', evHealRe.test(htmSrc));

  /* ===== ③ 폐지분 + 소환 연쇄 ===== */
  console.log('\n=== ③ 폐지분 (등급·선택창·새로고침) · 소환 연쇄 B ===');
  const both = [['sim.js', simSrc], ['index.html', htmSrc]];
  const deadTokens = ['RARITY_P', 'rollRarity', 'rollPerks', 'perkPool', 'rarityLock', 'refreshLeft', 'refreshBonus'];
  for (const [nm, src] of both) {
    const hit = deadTokens.filter(t => new RegExp('\\b' + t + '\\b').test(src));
    chk(`${nm} 에 등급·선택창·새로고침 코드가 남아 있지 않다`, hit.length === 0, hit.join(',') || '0건');
  }
  /* 주석에 «폐지됐다» 고 적는 것은 괜찮다 — 실제 버튼·핸들러·CSS 가 사라졌는지만 본다 */
  chk('index.html 에 새로고침 버튼·핸들러·CSS 가 없다',
    !/id="refBtn"/.test(htmSrc) && !/#refBtn\{/.test(htmSrc) && !/getElementById\('refBtn'\)/.test(htmSrc));
  chk('레벨업 지급 동사가 두 엔진에 하나씩 있다',
    /function grantNextPerk\(/.test(simSrc) && /function grantNextPerk\(/.test(htmSrc));
  /* 악마 = «다음 순번 앞당김». 두 엔진 모두 비용을 낸 «뒤» 같은 지급 동사를 부르고, 전설 풀 뽑기가 없다 */
  const devilSim = simSrc.slice(simSrc.indexOf("n.type==='devil'"), simSrc.indexOf('SIM_ANGEL_POLICY'));
  const devilHtm = htmSrc.slice(htmSrc.indexOf('function openDevil'), htmSrc.indexOf('function openAngel'));
  chk('악마도 같은 지급 동사를 쓴다 (전설 확정 폐기)',
    /payDevilCost\([^)]*\)[\s\S]{0,200}grantNextPerk\(/.test(devilSim) &&
    /payDevilCost\([^)]*\)[\s\S]{0,200}grantNextPerk\(/.test(devilHtm) &&
    !/perkPool|pick\(pool\)/.test(devilSim + devilHtm));
  /* ⚑ 소환 연쇄 기대값 B — 새 10종의 소환 3종은 트리거가 «피격/회피/반격» 이라
     소환 «적중» 이 새 소환을 낳지 않는다. 즉 «공격 시»·«치명타 시» 축에 특전 소환이 0건이어야 한다. */
  const atkAxis = simSrc.slice(simSrc.indexOf('function procOnAttack'), simSrc.indexOf('function doCounter'));
  const critAxis = simSrc.slice(simSrc.indexOf('if(crit){'), simSrc.indexOf('if(px.execKill'));
  const perkSummonOnAtk = [...(atkAxis + critAxis).matchAll(/px\.(p_[A-Za-z]+)/g)].map(m => m[1]);
  chk('⚑ 소환 연쇄 기대값 B = 0 — «공격/치명타 시» 축에 특전 소환이 없다',
    perkSummonOnAtk.length === 0, perkSummonOnAtk.join(',') || 'B = 0 (임계 0.8 구조적 만족)');

  const bad = R.filter(x => !x.c).length;
  console.log(`\n[T96 특전 순서 게이트] 통과 ${R.length - bad} · 불합격 ${bad}`);
  return bad;
}

/* sim.js 를 모드 실행 없이 로드한다 (맨 아래 러너를 잘라 내고 필요한 것만 내보낸다) */
function loadSim(src) {
  const body = src.replace(/const mode=process\.argv[\s\S]*$/, 'module.exports={runChapter,PERKS,PERK_PICKS,mkBuild,mkPlayer,grantNextPerk,TUNE};');
  const m = { exports: {} };
  vm.runInNewContext(body, { module: m, exports: m.exports, process, console: { log() {} }, require });
  return m.exports;
}

const simSrc = fs.readFileSync(path.join(ROOT, 'sim.js'), 'utf8');
const htmSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const planSrc = fs.readFileSync(path.join(ROOT, 'PLAN.md'), 'utf8');

if (process.argv.includes('--self')) {
  /* 음성 검사 — 일부러 깨뜨린 사본마다 «빨개지는지» 만 본다. 통과하면 그 항목이 죽은 검사라는 뜻이다. */
  const cases = [
    ['sim 순서를 뒤집으면', s => s.replace("{id:'p_evade'", "{id:'zz_evade'"), null, null],
    ['sim 공격력 배수를 1.30 으로', s => s.replace('PERK_ATK_M=1.20', 'PERK_ATK_M=1.30'), null, null],
    ['game 치명타 피해를 +40 으로', null, s => s.replace('PERK_CRITF_A=50', 'PERK_CRITF_A=40'), null],
    ['game 표시 텍스트를 바꾸면', null, s => s.replace('회피율 <b>+10</b>', '회피율 <b>+20</b>'), null],
    ['PLAN 표의 효과를 바꾸면', null, null, s => s.replace('| 공격력 **+20%** |', '| 공격력 **+30%** |')],
    ['등급 굴림을 되살리면', s => s + '\nfunction rollRarity(){return 0;}\n', null, null],
    ['새로고침을 되살리면', null, s => s.replace('function takePerk(perk){', 'function takePerk(perk){ G.refreshLeft=1;'), null],
    ['⚑ T104 회피 시 회복이 회복 증폭을 타게 하면 (noBoost=true 제거)',
      s => s.replace('heal(p,p.maxHp*PERK_EVHEAL_F,true)', 'heal(p,p.maxHp*PERK_EVHEAL_F)'), null, null],
    ['«공격 시» 축에 특전 소환을 달면', s => s.replace('  if(px.c_waveAtk', '  if(px.p_axeHit&&pkk(p,0.5))fireAxe(p,1);\n  if(px.c_waveAtk')
      .replace('function procOnAttack(G,e){\n  const p=G.player,px=p.px;', 'function procOnAttack(G,e){\n  const p=G.player,px=p.px;\n  if(px.p_axeHit&&pkk(p,0.5))fireAxe(p,1);'), null, null],
    ['특전을 11종으로 늘리면', s => s.replace("  ];\n}\nconst PERKS=mkPerks();", "    {id:'p_zzz', nm:'x', d:'x', ap:p=>p.px.p_zzz=1},\n  ];\n}\nconst PERKS=mkPerks();"), null, null],
    ['악마가 앞당김 대신 딴 짓을 하면', s => s.replace('            grantNextPerk(G);', '            /* nothing */'), null, null],
    ['한 런 획득 상한을 없애면', s => s.replace('if(G.taken.length>=PERK_PICKS)return null;', ''), null, null],
    ['PERK_PICKS 를 챕터 레벨업 횟수와 다르게 하면', s => s.replace('const PERK_PICKS=10;', 'const PERK_PICKS=7;'), null, null],
  ];
  let caught = 0;
  const quiet = console.log;
  for (const [nm, fs_, fh, fp] of cases) {
    console.log = () => {};
    let bad = 0;
    try { bad = run(fs_ ? fs_(simSrc) : simSrc, fh ? fh(htmSrc) : htmSrc, fp ? fp(planSrc) : planSrc); }
    catch (e) { bad = 1; }
    console.log = quiet;
    const ok = bad > 0;
    if (ok) caught++;
    console.log(`  ${ok ? '✓' : '✗'} ${nm} → ${ok ? '빨개진다' : '🔴 안 잡힌다 (죽은 검사)'}`);
  }
  console.log(`\n[음성 검사] ${caught}/${cases.length}`);
  process.exit(caught === cases.length ? 1 : 0);   /* 음성 검사는 «전부 잡히면» exit 1 이 정상이다 */
}

console.log('⚑⚑⚑ T96 게이트 — 특전 고정 10종 · 순서 획득');
process.exit(run(simSrc, htmSrc, planSrc) ? 1 : 0);
