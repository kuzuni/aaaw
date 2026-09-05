#!/usr/bin/env node
/* ⚑⚑⚑ T170 게이트 — `data/*.json` 이 엔진과 어긋나지 않는가
 *
 * 사용: node tools/verifyExportData.js        (exit 0 = 통과)
 *
 * 세 축 (주인 지시 ②):
 *  ⓐ **드리프트 0** — `node tools/exportData.js --check` 가 초록인가(다시 뽑은 것 = 커밋본).
 *     + **음성**: sim.js·index.html 을 한 글자 흔든 사본에서 --check 가 실제로 빨개지는가.
 *       (엔진 수치를 바꾸고 `data/` 를 안 뽑으면 이 게이트가 잡는다 — ROUTINE §1 의 한 줄이 그것이다.)
 *  ⓑ **스키마** — 필수 키·배열 길이(특전 100 · 옵션 18종 × 7칸 · 챕터 420 · 슬롯 비용 150).
 *  ⓒ **두 엔진 대조** — `data/` 가 적은 공통 상수가 `index.html` 에도 같은 값으로 있는가.
 *     (TUNE ↔ PLAN 대조는 `verifyPlanConst`·`verifyT2` 몫이라 여기서 되풀이하지 않는다.)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const J = f => JSON.parse(rd(path.join('data', f)));

const R = [];
const chk = (n, c, d) => { R.push({ n, c }); console.log(`  ${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); return c; };

/* ===== ⓐ 드리프트 ===== */
console.log('\n=== ⓐ 드리프트 (exportData --check) ===');
const runCheck = (cwdRoot) => {
  const r = cp.spawnSync(process.execPath, [path.join(cwdRoot, 'tools', 'exportData.js'), '--check'],
    { encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
};
const live = runCheck(ROOT);
chk('data/*.json 이 지금 엔진에서 다시 뽑은 것과 같다 (드리프트 0)', live.code === 0,
  live.code === 0 ? live.out.trim().split('\n').pop() : live.out.trim().split('\n').slice(-3).join(' / '));

/* 음성 — 엔진을 흔든 사본에서 --check 가 실제로 빨개지는가 */
console.log('\n--- 음성 (엔진을 흔들면 빨개지는가) ---');
const MUT = [
  ['sim.js', 'const ENEMY_GAP=44;', 'const ENEMY_GAP=45;', '적 간격 44 → 45'],
  ['sim.js', 'bossHp:4, bossDmg:1.5', 'bossHp:5, bossDmg:1.5', '보스 HP 배수 4 → 5'],
  ['sim.js', 'const PERK_PICKS=10;', 'const PERK_PICKS=11;', '한 런 특전 상한 10 → 11'],
  ['sim.js', 'if(dist>74)', 'if(dist>75)', '정지 거리 74 → 75 (이름 없는 리터럴)'],
  ['sim.js', 'pullCost:400', 'pullCost:401', '뽑기 가격 400 → 401'],
  ['index.html', 'const CAM_ZOOM=1.5;', 'const CAM_ZOOM=1.6;', '카메라 줌 1.5 → 1.6 (index.html)'],
];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'expdata-'));
for (const f of ['sim.js', 'index.html']) fs.copyFileSync(path.join(ROOT, f), path.join(tmp, f));
fs.mkdirSync(path.join(tmp, 'tools'));
fs.copyFileSync(path.join(ROOT, 'tools', 'exportData.js'), path.join(tmp, 'tools', 'exportData.js'));
fs.cpSync(path.join(ROOT, 'data'), path.join(tmp, 'data'), { recursive: true });
/* 양성 대조군 — 흔들기 «전» 사본은 초록이어야 한다(사본 자체가 틀린 게 아님을 보인다) */
chk('양성 대조군: 흔들지 않은 사본은 초록', runCheck(tmp).code === 0);
let neg = 0;
for (const [file, from, to, label] of MUT) {
  const orig = fs.readFileSync(path.join(tmp, file), 'utf8');
  if (orig.indexOf(from) < 0) { chk(`음성 «${label}»`, false, `사본에서 «${from}» 을 못 찾았다 — 게이트 갱신 필요`); continue; }
  fs.writeFileSync(path.join(tmp, file), orig.replace(from, to));
  const red = runCheck(tmp).code !== 0;
  fs.writeFileSync(path.join(tmp, file), orig);
  if (chk(`음성 «${label}» → --check 빨강`, red)) neg++;
}
fs.rmSync(tmp, { recursive: true, force: true });
chk(`음성 ${MUT.length}종 전부 검출`, neg === MUT.length, `${neg}/${MUT.length}`);

/* ===== ⓑ 스키마 ===== */
console.log('\n=== ⓑ 스키마 ===');
const files = ['tune.json', 'enemies.json', 'perks.json', 'gear.json', 'gacha.json', 'combat.json', 'ui.json'];
const D = {};
for (const f of files) {
  let ok = true, why = '';
  try { D[f] = J(f); } catch (e) { ok = false; why = String(e.message); }
  chk(`data/${f} 존재·파싱`, ok, why);
}
const has = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o) !== undefined;
for (const f of files) {
  if (!D[f]) continue;
  chk(`data/${f} · _source·_generatedAt`, has(D[f], '_source') && has(D[f], '_generatedAt'),
    D[f]._source);
}
const T = D['tune.json'], E = D['enemies.json'], P = D['perks.json'], GE = D['gear.json'],
  GA = D['gacha.json'], C = D['combat.json'], U = D['ui.json'];

chk('tune · 적 기저·구간표·벽·보스·챕터 상한',
  ['tune.eBaseHp', 'tune.eBaseDmg', 'tune.eHpSeg', 'tune.eDmgSeg', 'tune.wallHp', 'tune.wall3Hp',
    'tune.wall4At', 'tune.bossHp', 'tune.bossDmg', 'tune.maxChapter', 'tune.pAtk0', 'tune.goldGrowth',
    'tune.expKill'].every(k => has(T, k)));
chk('tune · expNeed 표 30 레벨', Array.isArray(T.expNeedTable) && T.expNeedTable.length === 30,
  `Lv1 ${T.expNeedTable[0].need} · Lv10 누적 ${T.expNeedTable[9].cum}`);
chk('tune · expNeed = 5*lv+1', T.expNeedTable.every(r => r.need === 5 * r.level + 1));

chk(`enemies · 챕터 ${T.tune.maxChapter} 전수`, E.chapters.length === T.tune.maxChapter, `${E.chapters.length}개`);
chk('enemies · 챕터마다 웨이브 5 + 보스', E.chapters.every(c => c.waves.length === E.layout.waves && c.boss));
chk('enemies · nodes = 웨이브 5 + 이벤트 4 + 보스 1', E.chapters.every(c =>
  c.nodes.filter(n => n.t === 'wave').length === 5 && c.nodes.filter(n => n.t === 'boss').length === 1
  && c.nodes.filter(n => n.t === 'rest').length === 2
  && c.nodes.filter(n => n.t === 'devil').length === 1 && c.nodes.filter(n => n.t === 'angel').length === 1));
chk('enemies · 적 수 곡선 N(c) = c≤5 ? 17 : min(50, 17+(c−5))', E.chapters.every(c =>
  c.enemyCount === (c.c < 6 ? 17 : Math.min(50, 17 + (c.c - 5)))));
chk('enemies · 웨이브 크기 합 = 적 수 − 1(보스)', E.chapters.every(c =>
  c.waveSizes.reduce((a, b) => a + b, 0) === c.enemyCount - 1));
chk('enemies · 보스 = 마지막 웨이브 스탯 × bossHp/bossDmg', E.chapters.every(c =>
  c.boss.hp === c.boss.baseHp * T.tune.bossHp && c.boss.dmg === c.boss.baseDmg * T.tune.bossDmg),
  `ch1 ${E.chapters[0].boss.baseHp}×${T.tune.bossHp} = ${E.chapters[0].boss.hp}`);
chk('enemies · HP·DMG 가 챕터에 대해 단조 증가', (() => {
  for (let i = 1; i < E.chapters.length; i++)
    if (E.chapters[i].waves[0].hp < E.chapters[i - 1].waves[0].hp) return false;
  return true;
})());

chk('perks · 100종', P.count === 100 && P.perks.length === 100, `${P.count}종`);
chk('perks · 등급 분포 39/32/29', P.countByGrade['일반'] === 39 && P.countByGrade['희귀'] === 32
  && P.countByGrade['전설'] === 29, JSON.stringify(P.countByGrade));
chk('perks · id 중복 0', new Set(P.perks.map(p => p.id)).size === P.perks.length);
chk('perks · 표 순서 = 배열 순서', P.perks.every((p, i) => p.order === i));
chk('perks · 전원 이름·설명·등급·효과', P.perks.every(p => p.name && p.desc && p.grade >= 0 && p.grade <= 2
  && p.effect && !p.effect._error && (p.effect.stat || p.effect.px)));
chk('perks · 등급 굴림 60/25/15 · 3택 · 한 런 10', JSON.stringify(P.rules.gradeRate) === '[60,25,15]'
  && P.rules.offerPerLevel === 3 && P.rules.picksPerRun === 10);
chk('perks · 3장 같은 등급 · 악마 전설 1장 · 비용 30%', P.rules.sameGradeOffer === true
  && P.rules.devilGrade === 2 && P.rules.devilOffer === 1 && P.rules.devilCostMaxHp === 0.30);
chk('perks · PERK_* 상수 표', Object.keys(P.constants).length >= 30, `${Object.keys(P.constants).length}종`);

chk('gear · 4등급 · 6부위 · 3세트', GE.rarName.length === 4 && GE.parts.length === 6 && GE.sets.length === 3,
  GE.rarName.join('/'));
chk('gear · «영웅» 등급이 없다', GE.rarName.indexOf('영웅') < 0);
chk('gear · 기여표 4행 × 3축', [GE.contribution.atk, GE.contribution.hp, GE.contribution.sh]
  .every(a => Array.isArray(a) && a.length === 4));
chk('gear · 옵션 18종 × 7칸', Object.keys(GE.optionLadder.options).length === 18
  && Object.values(GE.optionLadder.options).every(a => a.length === 7));
chk('gear · 옵션 효과 실측 오류 0', Object.values(GE.optionLadder.options)
  .every(a => a.every(o => o.effect && !o.effect._error && (o.effect.stat || o.effect.px))));
chk('gear · 사다리 마지막 칸 = 흡혈 · 6번 칸 = 도끼', Object.values(GE.optionLadder.options)
  .every(a => /흡혈/.test(a[6].desc) && /도끼/.test(a[5].desc)));
chk('gear · optCount 최대 7 (신화 +9강)', GE.optionLadder.maxCount === 7
  && GE.optionLadder.optCount[3].plus9 === 7);
chk('gear · 전설 → 신화 변환 +3강 (전설 최대 +2)', GE.enhance.legendToMythPlus === 3 && GE.enhance.legendMaxPlus === 2);
chk('gear · 강화 선형 · +9강 = ×20 정확', 1 + GE.enhance.plusStep * 9 === 20);
chk('gear · 슬롯 상한 150 · 비용표 150칸', GE.slot.lvMax === 150 && GE.slot.costTable.length === 150,
  `L0 ${GE.slot.costTable[0]} · L149 ${GE.slot.costTable[149].toExponential(3)}`);

chk('gacha · 상자 3종(희귀·전설·신화)', ['rare', 'legend', 'myth'].every(k => GA.boxes[k]),
  Object.values(GA.boxes).map(b => `${b.name} ${b.cost}`).join(' · '));
chk('gacha · 확률 합 100%', Object.values(GA.boxes).every(b =>
  Math.abs(b.rate.reduce((a, x) => a + x, 0) - 100) < 1e-6));
chk('gacha · 신화 상자 신화 0.8 · 전설 4', GA.boxes.myth.rate[3] === 0.8 && GA.boxes.myth.rate[2] === 4);
chk('gacha · 희귀 상자 80 다이아 · 희귀 33.3', GA.boxes.rare.cost === 80 && GA.boxes.rare.rate[1] === 33.3);
chk('gacha · 천장 50 · 피티 10 (신화 상자만 천장)', GA.boxes.myth.pityMyth === 50
  && GA.boxes.myth.pityLegend === 10 && GA.boxes.rare.pityMyth === 0);

chk('combat · 이동·사거리·투사체·스턴·상한', ['move.playerSpeed', 'move.stopDistance', 'range.meleeEnemy',
  'range.rangedEnemyMax', 'range.enemyGap', 'range.nodeGap', 'projectile.axeSpeed', 'projectile.cap',
  'enemyAttack.evade', 'stun.boss', 'caps.def', 'caps.evade'].every(k => has(C, k)));
chk('combat · 창 사거리 = 적 간격 × 관통 수', C.range.spearReach === C.range.enemyGap * C.pierce.spear,
  `${C.range.enemyGap} × ${C.pierce.spear} = ${C.range.spearReach}`);
chk('combat · 방어 상한 80 · 회피 상한 90 · 적 회피 10%', C.caps.def === 80 && C.caps.evade === 90
  && C.enemyAttack.evade === 0.10);

chk('ui · 카메라·바·연출', ['camera.zoom', 'camera.playerX', 'bars.footBarW', 'bars.enemyBarW',
  'fx.axeArc', 'fx.popShield'].every(k => has(U, k)));
chk('ui · _source 가 index.html', /^index\.html@[0-9a-f]{40}$/.test(U._source), U._source);

/* ===== ⓒ 두 엔진 대조 ===== */
console.log('\n=== ⓒ 두 엔진 대조 (data ↔ index.html) ===');
const HTML = rd('index.html');
/* ⚠ 이름이 두 곳에 나오는 것은 «어느 자리인지» 를 못박는다 — `maxChapter` 는 세이브 기본값(1)에도 있어서
   그냥 첫 매치를 집으면 엉뚱한 1 을 읽는다. TUNE 안의 자리(주석이 붙은 줄)를 골라 본다. */
const HTML_AT = { maxChapter: /maxChapter:(\d+),\s*\/\// };
const htmlConst = (name) => {
  const m = HTML.match(HTML_AT[name] || new RegExp(`\\b${name}\\s*[=:]\\s*(-?[\\d.]+(?:/[\\d.]+)?)`));
  if (!m) return undefined;
  return m[1].indexOf('/') > 0 ? Number(m[1].split('/')[0]) / Number(m[1].split('/')[1]) : Number(m[1]);
};
const PAIRS = [
  ['ENEMY_GAP', C.range.enemyGap], ['NODE_GAP', C.range.nodeGap], ['NODE_GAP_EVENT', C.range.nodeGapEvent],
  ['SPEAR_PIERCE', C.pierce.spear], ['WAVE_PIERCE', C.pierce.wave], ['WAVE_PIERCE_BIG', C.pierce.waveBig],
  ['R_AXE', C.summonRatio.axe], ['R_ARROW', C.summonRatio.arrow], ['R_WAVE', C.summonRatio.wave],
  ['R_BOLT', C.summonRatio.bolt], ['R_SPEAR', C.summonRatio.spear],
  ['ENEMY_EVADE', C.enemyAttack.evade], ['STUN_BOSS_MUL', null],
  ['REST_HEAL', C.events.restHeal], ['REST_EXP', C.events.restExp], ['DEVIL_COST', C.events.devilCostMaxHp],
  ['PROJ_CAP', C.projectile.cap], ['PROC_TICK_CAP', C.projectile.procTickCap],
  ['bossHp', T.tune.bossHp], ['bossDmg', T.tune.bossDmg], ['maxChapter', T.tune.maxChapter],
  ['pAtk0', T.tune.pAtk0], ['pHp0', T.tune.pHp0], ['pSh0', T.tune.pSh0],
  ['eBaseHp', T.tune.eBaseHp], ['eBaseDmg', T.tune.eBaseDmg],
  ['plusStep', GE.enhance.plusStep], ['slotLvMax', GE.slot.lvMax], ['legendToMythPlus', GE.enhance.legendToMythPlus],
  ['pullCost', GA.economy.pullCost], ['pityMyth', GA.boxes.myth.pityMyth], ['pityLegend', GA.boxes.myth.pityLegend],
  ['PERK_PICKS', P.rules.picksPerRun], ['PERK_OFFER', P.rules.offerPerLevel],
];
for (const [name, want] of PAIRS) {
  if (want === null) { chk(`index.html · ${name} 존재`, /STUN_BOSS_MUL\s*=\s*1\s*\/\s*3/.test(HTML)); continue; }
  const got = htmlConst(name);
  chk(`index.html · ${name} = ${want}`, got !== undefined && Math.abs(got - want) < 1e-9,
    got === undefined ? '못 찾음' : String(got));
}
chk('index.html · 도끼 포물선·카메라 줌·발밑 바 상수 (ui.json 과 동일)',
  htmlConst('AXE_ARC') === U.fx.axeArc && htmlConst('CAM_ZOOM') === U.camera.zoom
  && htmlConst('CAM_PLAYER_X') === U.camera.playerX);

/* ===== 결과 ===== */
const pass = R.filter(r => r.c).length, fail = R.length - pass;
console.log(`\n[T170 수치 내보내기 게이트] 대조 ${R.length}항목 · 통과 ${pass} · 불합격 ${fail}`
  + (fail ? '' : ' → 통과'));
process.exit(fail ? 1 : 0);
