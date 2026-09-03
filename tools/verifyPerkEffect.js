/* T88 2단계 — 132종 «효과 적용» 감사 (주인 지시 ⑤) · sim.js 축
 *
 * 사용: node tools/verifyPerkEffect.js              (exit 0 = 통과, 1 = 불합격)
 *       PERKEFFECT_VERBOSE=1 …                       (특전별 지문 차이까지 출력)
 *
 * ── 기존 게이트가 못 보는 것 ────────────────────────────────────────────────
 * `verifyPerkFire` 는 «트리거가 굴었나» 를 센다. 그런데 T88 1단계의 수집가 건이 보여줬듯,
 * **굴었는데 효과가 아무 일도 안 하는** 경로가 따로 있다 — 계수가 ×1 이거나, 결과가
 * 아무도 안 읽는 변수에 들어가거나, 화면·굴림에 닿지 않거나. 발동 게이트는 그 전부에 초록이다.
 * (실제로 P3 R03·R04 가 `r_counterX`·`l_axeSpin` 에서 «?1:1 로 바꿔도 초록» 구멍을 두 번 막았다.)
 *
 * ── 이 게이트가 재는 것 = «효과를 무력화하면 결과가 달라지는가» ──────────────
 * 특전 하나를 골라 **그 효과만** 항등(identity)으로 만든 사본을 메모리에서 만들고,
 * 원본과 **완전히 같은 시드·같은 보유 특전**으로 판을 돌려 결과 지문을 맞대 본다.
 *   · 지문이 달라진다  → 그 효과는 실제로 게임에 적용되고 있다.
 *   · 지문이 똑같다    → **무력화해도 게임이 한 치도 안 달라진다 = 효과가 안 먹고 있다.**
 * 조건(트리거·확률 굴림)은 손대지 않고 **효과의 크기만** 없앤다. 그래서 «조건을 지워서
 * 난수열이 밀린 탓에 달라 보이는» 착시가 생기지 않는다.
 *
 * 지문 = runChapter 가 돌려주는 관측치 (클리어 여부 · 소요 시간 · 골드 · 레벨 · 타격 시도 수 ·
 * 빗맞음 수). 효과가 조금이라도 전투에 닿으면 12판 중 한 판은 반드시 흔들린다.
 *
 * ⚠ 이 게이트는 «효과가 적용된다» 까지만 본다. «문면대로의 크기인가» 는 3단계 몫이다
 *    (스탯형 실효치 증분 · 데미지형 증분 · 회복량 · 기절 초 · 방어막 장수 · 소환 발수).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const core = require('./perkFireCore.js');

const SIM = path.join(__dirname, '..', 'sim.js');
const SRC = fs.readFileSync(SIM, 'utf8');

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok = m => console.log('  ✓ ' + m);

/* ══════════ 1. 특전 목록 ══════════ */
const MK = SRC.match(/function mkPerks\(\)[\s\S]*?\n\}/);
if (!MK) { console.log('mkPerks() 를 찾지 못했다'); process.exit(1); }
const PERK = [...MK[0].matchAll(/add\('([a-z]_[A-Za-z0-9]+)',(\d)/g)].map(m => ({ id: m[1], r: +m[2] }));
const RAR = ['일반', '희귀', '전설'];
const IDSET = new Set(PERK.map(p => p.id));

/* ══════════ 2. 무력화기 ══════════ */

/* ── ㉠ `if( … px.<id> … ) <효과>` 의 **효과 자리만** 지운다 (조건은 그대로 평가된다) ──
   `instrumentIfs` 와 같은 스캐너를 쓰되, 꽂는 대신 **효과 문장을 통째로 들어낸다**.
   조건 안의 확률 굴림(`pkk`)은 그대로 불리므로 난수열이 밀리지 않는다. */
function neutralizeIfs(src, id) {
  const mask = core.codeMask(src);
  const ID_RE = /(?:p\.)?px\.([a-z]_[A-Za-z0-9]+)/g;
  const cuts = [];
  let shared = 0;
  for (let i = 0; i < src.length - 2; i++) {
    if (!mask[i]) continue;
    if (!(src[i] === 'i' && src[i + 1] === 'f')) continue;
    if (i > 0 && /[A-Za-z0-9_$.]/.test(src[i - 1])) continue;
    let j = i + 2; while (j < src.length && /\s/.test(src[j])) j++;
    if (src[j] !== '(') continue;
    let dp = 0, k = j;
    for (; k < src.length; k++) { if (!mask[k]) continue; if (src[k] === '(') dp++; else if (src[k] === ')') { dp--; if (dp === 0) break; } }
    const cond = src.slice(j + 1, k);
    ID_RE.lastIndex = 0;
    const ids = new Set(); let m;
    while ((m = ID_RE.exec(cond))) if (IDSET.has(m[1])) ids.add(m[1]);
    if (!ids.has(id)) { i = k; continue; }
    if (ids.size > 1) shared++;              /* 조건을 다른 특전과 나눠 쓰는 자리 — 판정에 참고로 남긴다 */
    let c = k + 1; while (c < src.length && /\s/.test(src[c])) c++;
    cuts.push([c, core.stmtEnd(src, mask, c)]);
    i = k;
  }
  if (!cuts.length) return null;
  /* 중첩 자리 정리 — 바깥 if 의 효과를 통째로 들어내면 그 안의 if 는 이미 사라진 것이라
     다시 자르면 소스가 깨진다(`c_backDmg` 의 바깥 관문·`l_autoBolt` 의 3중 분기가 그랬다). */
  const keep = [];
  for (const c of cuts) if (!keep.length || c[0] >= keep[keep.length - 1][1]) keep.push(c);
  let out = '', last = 0;
  for (const [a, b] of keep) { out += src.slice(last, a) + '{}'; last = b; }
  return { out: out + src.slice(last), n: keep.length, shared };
}

/* ── ㉡ if 문이 아닌 자리 — 손으로 짚은 «항등화» 표 ──
   전부 «효과의 크기만 1배·0 으로» 만든다. 조건과 확률 굴림은 건드리지 않는다.
   각 원문은 소스에 정확히 1번 나와야 하고(0/2 번이면 실패), 수치가 튜닝 노브인 자리는
   정규식으로 받아 회차마다 표가 깨지지 않게 한다(verifyPerkFire 의 패치표 규약과 같다). */
const HAND = {
  /* 🗿 기절한 적은 회피 못 함 — 막지 않게 되돌린다(그 자리에서 회피 굴림이 되살아난다) */
  c_stunNoEvade: ['!(stunned&&px.c_stunNoEvade)&&Math.random()<ENEMY_EVADE', '!(false&&stunned&&px.c_stunNoEvade)&&Math.random()<ENEMY_EVADE'],
  /* 💀⚔️ 치확 0% — 깎지 않게 */
  l_noCritAtk3: [/l_noCritAtk3\?0:(p\.critR\+bsum\(p,'critR'\))/, "l_noCritAtk3?($1):$1"],
  /* 🃏🔁 특전 1개당 반격 — 증분 0 */
  c_collCounter: ['p.px.c_collCounter?2*perkN(p):0', 'p.px.c_collCounter?0:0'],
  /* 🪓🌪️ 도끼 회전 수 · ⚜️ 반격 피해 배수 · 🥶 적 공속 감속 — 전부 ×1 */
  l_axeSpin: [/const times=px\.l_axeSpin\?(\d+):1;/, 'const times=px.l_axeSpin?1:1;'],
  r_counterX: [/\*\(px\.r_counterX\?([\d.]+):1\);/, '*(px.r_counterX?1:1);'],
  l_slowAura: [/\(p\.px\.l_slowAura\?1\/([\d.]+):1\)/, '(p.px.l_slowAura?1:1)'],
  /* 🌊🔱 거대 검기 — 커지지 않게 */
  l_wavePierce: ['const big=px.l_wavePierce;', 'const big=px.l_wavePierce&&false;'],
  /* 💎 실드 있으면 데미지 무시 · 🦔 피격 반격 — 굴림은 그대로 하되 결과만 죽인다 */
  l_shieldIgnore: [/const ignored=(px\.l_shieldIgnore&&p\.sh>0&&pkk\(p,[\d.]+\));/, 'const ignored=($1)&&false;'],
  r_hitCounter: [/\|\|\(px\.r_hitCounter&&pkk\(p,([\d.]+)\)\);/, '||((px.r_hitCounter&&pkk(p,$1))&&false);'],
  /* px 키를 안 읽고 스탯을 직접 바꾸는 5종 — 증분을 0(또는 ×1)으로 */
  c_killHeal2: [/p\.px\.c_killHeal2=1;p\.killHeal\+=[\d.]+;/, 'p.px.c_killHeal2=1;p.killHeal+=0;'],
  r_healAmp: [/p\.px\.r_healAmp=1;p\.healAmp\+=[\d.]+;/, 'p.px.r_healAmp=1;p.healAmp+=0;'],
  r_repairAmp: [/p\.px\.r_repairAmp=1;p\.repairAmp\+=[\d.]+;/, 'p.px.r_repairAmp=1;p.repairAmp+=0;'],
  r_critF100: [/p\.px\.r_critF100=1;p\.critF\+=[\d.]+;/, 'p.px.r_critF100=1;p.critF+=0;'],
  r_atk50: [/p\.px\.r_atk50=1;p\.dmg\*=[\d.]+;/, 'p.px.r_atk50=1;p.dmg*=1;'],
};

function neutralize(id) {
  if (HAND[id]) {
    const [from, to] = HAND[id];
    const n = from instanceof RegExp
      ? (SRC.match(new RegExp(from.source, from.flags.includes('g') ? from.flags : from.flags + 'g')) || []).length
      : SRC.split(from).length - 1;
    if (n !== 1) return { err: `항등화표 «${id}» 원문이 소스에 ${n}번 나온다 (1번이어야 한다) — 엔진이 바뀌었다면 표를 고칠 것` };
    return { out: SRC.replace(from, to), n: 1, shared: 0, how: '손' };
  }
  const r = neutralizeIfs(SRC, id);
  if (!r) return { err: `${id} — 무력화할 자리를 못 찾았다 (if 자리 0곳 · 항등화표에도 없다)` };
  return { out: r.out, n: r.n, shared: r.shared, how: '자동' };
}

/* ══════════ 3. 적재 ══════════ */
/* 실행 훅 — verifyPerkFire 와 같은 세 자리. 원본 파일은 건드리지 않는다.
   ① 보유 특전 고정(대상 + 동반 세트) ② 레벨업 특전 획득 차단 ③ 확률 굴림 강제 스위치.
   ③ 은 «자연 굴림으로는 12판 안에 한 번도 안 굴어서 안 달라 보이는» 특전을 가려내기 위한 것이다. */
const HOOK = [
  ['플레이어 생성부', '  const p=mkPlayer(build,G);G.player=p;p.G=G;',
    '  const p=mkPlayer(build,G);G.player=p;p.G=G;\n  if(opts.hold){ G.noPerkChoice=true; for(const id of opts.hold){ const pk=PERKS.find(x=>x.id===id); if(!pk)throw new Error(\'없는 특전 \'+id); pk.ap(p); G.taken.push(pk); } p.hp=p.maxHp; p.sh=p.maxSh; }'],
  ['perkChoice', 'function perkChoice(G){\n', 'function perkChoice(G){\n  if(G.noPerkChoice)return;\n'],
  ['pkk', 'const pkk=(p,ch)=>Math.random()<ch*(p.px.procX2?1.22:1);',
    'const pkk=(p,ch)=>__FORCE?true:Math.random()<ch*(p.px.procX2?1.22:1);'],
];
const EXPORTS = `
var __FORCE=false;
module.exports={PERKS,runChapter,mkBuild,setSeed,TUNE,force:v=>{__FORCE=v;}};
`;
function load(src) {
  const from = "const mode=process.argv[2]||'all';";
  if (src.split(from).length - 1 !== 1) throw new Error('main 디스패치를 찾지 못했다');
  for (const [tag, a, b] of HOOK) {
    if (src.split(a).length - 1 !== 1) throw new Error(`훅 «${tag}» 자리를 찾지 못했다`);
    src = src.replace(a, b);
  }
  const body = src.replace(from, "const mode='__perkeffect__';") + EXPORTS;
  const mod = { exports: {} };
  const ctx = vm.createContext({ module: mod, exports: mod.exports, require, console, process, Math, Set, Map, Object, Array, JSON, Number, String, Boolean, isNaN, parseInt, parseFloat, Infinity, NaN, undefined });
  vm.runInContext(body, ctx, { filename: 'sim.neutralized.js' });
  return mod.exports;
}

let BASE;
try { BASE = load(SRC); } catch (e) { console.log('  ✗ 원본 적재 실패: ' + e.message); process.exit(1); }
ok(`원본 적재 — 특전 ${BASE.PERKS.length}종`);
if (BASE.PERKS.length !== PERK.length) bad(`mkPerks 파싱 ${PERK.length}종 ≠ 적재 ${BASE.PERKS.length}종`);

/* ══════════ 4. 실행 조건 — verifyPerkFire 와 같은 자리 ══════════ */
const COMPANION = ['c_axeHit', 'r_arrowAtk', 'c_waveAtk', 'c_boltKill', 'l_spear2Atk',
  'c_wardHit', 'c_stunAtk', 'c_killHeal2', 'c_killShield3'];
const build = BASE.mkBuild(1, 0, 0, 0);

/* 발동 사다리 — 위 칸에서 «달라진다» 가 나오면 거기서 끝낸다 (verifyPerkFireHtml 과 같은 취지).
   아래로 갈수록 판을 늘리고 조건을 벌린다. 드문 트리거(쉼터·저체력·3연속 회피)는 12판 안에
   한 번도 안 굴 수 있고, 그건 «효과가 없다» 가 아니라 «이 조건에서 못 봤다» 이기 때문이다. */
const LADDER = [
  { name: '표준', forced: false, conf: [{ ch: 30, n: 6 }, { ch: 60, n: 6 }] },
  { name: '확대', forced: false, conf: [{ ch: 20, n: 8 }, { ch: 45, n: 8 }, { ch: 90, n: 8 }] },
  { name: '확률 강제', forced: true, conf: [{ ch: 30, n: 6 }, { ch: 60, n: 6 }, { ch: 90, n: 6 }] },
];

/* 결과 지문 — 효과가 전투에 조금이라도 닿으면 이 중 하나는 흔들린다 */
const fp = r => `${r.clear ? 1 : 0}/${r.time.toFixed(3)}/${r.gold}/${r.level}/${r.atkTries}/${r.miss}`;

function run(M, id, seed0, st) {
  const hold = [id, ...COMPANION.filter(c => c !== id)];
  const out = [];
  M.force(st.forced);
  try {
    for (const cf of st.conf) for (let i = 0; i < cf.n; i++) {
      M.setSeed(seed0 + i * 7919 + cf.ch);
      out.push(fp(M.runChapter(cf.ch, build, { hold })));
    }
  } finally { M.force(false); }
  return out;
}

/* ══════════ 5. 감사 ══════════ */
console.log('\n[① 효과 무력화 대조 — 특전마다 «그 효과만» 항등으로 만들고 같은 시드로 돌린다]');
const SEED = 20260903;
const errs = [], stat = { 자동: 0, 손: 0 }, sharedIds = [];
const detail = {}, MUT = {};
for (const p of PERK) {
  const nz = neutralize(p.id);
  if (nz.err) { errs.push(nz.err); continue; }
  stat[nz.how]++;
  if (nz.shared) sharedIds.push(p.id);
  try { MUT[p.id] = load(nz.out); } catch (e) { errs.push(`${p.id} — 무력화본 적재 실패: ${e.message}`); continue; }
  detail[p.id] = { diff: 0, n: nz.n, how: nz.how, stage: -1 };
}
for (let s = 0; s < LADDER.length; s++) {
  const st = LADDER[s];
  const todo = PERK.filter(p => detail[p.id] && !detail[p.id].diff);
  if (!todo.length) break;
  const runs = st.conf.reduce((x, c) => x + c.n, 0);
  console.log(`  [사다리 ${s + 1} · ${st.name} — 챕터 ${st.conf.map(c => c.ch).join('·')} 각 ${st.conf[0].n}판${st.forced ? ' · pkk 강제' : ''}] 대상 ${todo.length}종`);
  for (const p of todo) {
    let a, b;
    try { a = run(BASE, p.id, SEED, st); b = run(MUT[p.id], p.id, SEED, st); }
    catch (e) { errs.push(`${p.id} — 실행 예외: ${e.message}`); continue; }
    const d = a.filter((x, i) => x !== b[i]).length;
    if (d) { detail[p.id].diff = d; detail[p.id].runs = runs; detail[p.id].stage = s; }
  }
  console.log(`    누적 «효과 적용» ${PERK.filter(p => detail[p.id] && detail[p.id].diff).length}/${PERK.length}종`);
}
const inert = PERK.filter(p => detail[p.id] && !detail[p.id].diff);
errs.forEach(bad);
console.log(`  무력화 자리: 자동(if) ${stat.자동}종 · 손 항등화 ${stat.손}종` +
  (sharedIds.length ? ` · 조건 공유 ${sharedIds.length}종(${sharedIds.join(' ')})` : ''));

if (inert.length) {
  bad(`효과를 무력화해도 12판 지문이 한 판도 안 달라진 특전 ${inert.length}종 — ${inert.map(d => `${d.id}(${RAR[d.r]})`).join(' · ')}`);
  console.log('     ↑ 조건은 굴지만 효과가 게임에 닿지 않는다는 뜻이다 (발동 게이트는 이걸 못 본다).');
} else {
  ok(`132/132 — 전 특전이 «무력화하면 결과가 달라진다» (효과가 실제로 게임에 닿는다)`);
}
for (let r = 0; r < 3; r++) {
  const rr = PERK.filter(p => p.r === r).filter(p => detail[p.id]);
  const live = rr.filter(p => detail[p.id].diff > 0).length;
  console.log(`  ${RAR[r]} ${live}/${rr.length} 적용`);
}
{
  const byStage = LADDER.map((L, i) => `${L.name} ${PERK.filter(p => detail[p.id] && detail[p.id].stage === i).length}`).join(' · ');
  console.log(`  판정이 갈린 사다리 칸: ${byStage}`);
}
if (process.env.PERKEFFECT_VERBOSE) {
  console.log('\n[진단] 특전별 «무력화 시 달라진 판 수»');
  for (const p of PERK) if (detail[p.id]) console.log(`  ${p.id.padEnd(18)} ${RAR[p.r]} ${String(detail[p.id].diff).padStart(3)}/${detail[p.id].runs || '-'}  (${detail[p.id].how} ${detail[p.id].n}곳 · 사다리 ${detail[p.id].stage + 1})`);
}

/* ══════════ 6. 자가검사 ══════════ */
/* 멀쩡한 특전을 **일부러 무력하게 만든 엔진**에서 이 게이트가 «효과 없음» 으로 잡아내는가.
   못 잡으면 이 게이트는 아무것도 안 보고 있는 것이다. */
console.log('\n[② 자가검사 — 효과가 죽은 엔진을 만들어 놓고 잡히는지 본다]');
const SELF = [
  /* P3 R03·R04 가 실제로 막았던 «?1:1» 구멍을 그대로 재현한다 */
  ['l_axeSpin', '도끼 회전 수를 1 로 (문면은 3회전 그대로)', /const times=px\.l_axeSpin\?(\d+):1;/, 'const times=px.l_axeSpin?1:1;'],
  ['r_counterX', '반격 피해 배수를 ×1 로', /\*\(px\.r_counterX\?([\d.]+):1\);/, '*(px.r_counterX?1:1);'],
  ['c_collCounter', '수집가 반격 증분을 0 으로', 'p.px.c_collCounter?2*perkN(p):0', 'p.px.c_collCounter?0:0'],
  ['r_atk50', '공격력 +50% 를 ×1 로', /p\.px\.r_atk50=1;p\.dmg\*=[\d.]+;/, 'p.px.r_atk50=1;p.dmg*=1;'],
  ['c_killHeal2', '처치 회복량을 0 으로', /p\.px\.c_killHeal2=1;p\.killHeal\+=[\d.]+;/, 'p.px.c_killHeal2=1;p.killHeal+=0;'],
];
for (const [id, what, from, to] of SELF) {
  const n = from instanceof RegExp
    ? (SRC.match(new RegExp(from.source, from.flags.includes('g') ? from.flags : from.flags + 'g')) || []).length
    : SRC.split(from).length - 1;
  if (n !== 1) { bad(`자가검사 «${id}» 원문이 ${n}번 나온다 (1번이어야 한다)`); continue; }
  if (!detail[id] || !detail[id].diff) { bad(`${id} — 양성 대조에서조차 «효과 없음» 이다 (자가검사가 무의미하다)`); continue; }
  const broken = SRC.replace(from, to);
  /* 망가진 엔진에서 같은 감사를 다시 돌린다 — 이제는 «무력화해도 안 달라진다» 가 나와야 한다 */
  let B, N;
  try { B = load(broken); N = load(neutralizeAgainst(broken, id)); }
  catch (e) { bad(`${id} — 자가검사 적재 실패: ${e.message}`); continue; }
  const a = run(B, id, SEED, LADDER[0]), b = run(N, id, SEED, LADDER[0]);
  const d = a.filter((x, i) => x !== b[i]).length;
  if (!d) ok(`${id} — ${what} → 이 게이트가 «효과 없음»(0판) 으로 잡는다 (원본은 ${detail[id].diff}판)`);
  else bad(`${id} — ${what} 했는데도 ${d}판이 달라져 «적용됨» 이 나온다 (게이트가 이 축을 못 본다)`);
}

/* 자가검사용 — 임의의 소스에 같은 무력화를 적용한다 */
function neutralizeAgainst(src, id) {
  if (HAND[id]) {
    const [from, to] = HAND[id];
    /* 이미 망가뜨린 소스에는 원문이 없을 수 있다 — 그때는 이미 항등이라 그대로 돌려준다 */
    const n = from instanceof RegExp
      ? (src.match(new RegExp(from.source, from.flags.includes('g') ? from.flags : from.flags + 'g')) || []).length
      : src.split(from).length - 1;
    return n === 1 ? src.replace(from, to) : src;
  }
  const r = neutralizeIfs(src, id);
  return r ? r.out : src;
}

console.log(`\n통과 ${fail === 0 ? '전부' : ''} · 위반 ${fail}`);
process.exit(fail ? 1 : 0);
