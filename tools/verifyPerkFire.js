/* T84 (P2) — 새 특전 132종 «실제 발동» 게이트
 *
 * 사용: node tools/verifyPerkFire.js            (exit 0 = 통과, 1 = 불합격)
 *       PERKFIRE_VERBOSE=1 …                    (특전별 발동 횟수·발동 지점까지 출력)
 *
 * ── 무엇을 재는가 ────────────────────────────────────────────────────────────
 * T83(P1) 이 확인한 것은 «획득» 이다 — 132종을 하나씩 들려 돌려도 예외가 안 났다는 것.
 * 이 게이트는 그보다 한 칸 안쪽, «그 특전의 효과 코드가 실제로 실행됐는가» 를 본다.
 * 특전이 엔진에 배선만 되고 트리거가 영영 안 굴면(도달 불가 조건·오타난 필드·죽은 분기)
 * 획득 검사도 정적 검사도 초록인 채로 그 특전은 게임에서 아무 일도 하지 않는다.
 *
 * ── 방법 ────────────────────────────────────────────────────────────────────
 * `sim.js` 원본은 건드리지 않는다. 소스를 읽어 **메모리에서만** 계측본을 만들고 그것을 돌린다.
 *   ① `if( … px.<특전id> … ) <효과>` 꼴을 전수 찾아 **효과 자리 맨 앞**에 `__F` 를 꽂는다.
 *      조건이 통째로 참일 때만 불리므로 «px 를 읽었다» 가 아니라 «효과가 실행됐다» 를 센다.
 *      조건 안의 id 가 여럿이면 그중 **px 값이 참인 것만** 기록한다(단독 보유 실행이라 하나로 갈린다).
 *   ② if 문이 아닌 자리(삼항·대입·|| 꼬리 등)와, px 키를 아예 안 읽고 스탯을 직접 바꾸는 5종
 *      (🍖 killHeal · 💞 healAmp · 🔧 repairAmp · 🔥 critF · 💪 dmg)은 **손으로 짚은 패치표**로 꽂는다.
 *      패치표의 각 원문은 소스에 **정확히 1번** 나와야 한다 — 0번이나 2번이면 그 자리에서 실패시킨다.
 *      (엔진이 바뀌어 자리가 사라지면 게이트가 조용히 통과하는 대신 빨개진다.)
 *   ③ 게이트 자체의 자가검사: 계측본에서 특정 특전의 효과를 지우면 그 특전이 «발동 0» 으로 잡히는지.
 *
 * ── 실행 조건 ───────────────────────────────────────────────────────────────
 * 특전 하나만 들려 돌리면 **구조적으로 못 도는 것들**이 있다 — 방어막을 소모할 때 발동하는 특전은
 * 방어막을 주는 특전이 없으면 영영 안 굴고, 화살 개조는 화살을 쏘는 특전이 없으면 안 굴린다.
 * 그래서 «대상 특전 + 고정 동반 세트(소환 5종·방어막·기절·회복·수리 공급원)» 로 돌리고,
 * 기록은 **대상 특전의 카운터만** 읽는다. 레벨업 특전 획득은 꺼서(noPerkChoice) 보유 목록을 고정한다.
 *
 * 1차는 **확률 손대지 않고**(자연 굴림) 돌린다. 여기서 다 굴면 그것이 가장 강한 결과다.
 * 1차에 안 굴린 것만 2차에서 `pkk`(특전 확률 굴림 한 곳)를 참으로 고정해 다시 본다 —
 * 2차에서 굴면 «배선은 살아 있고 확률·트리거 빈도가 낮았다», 2차에서도 안 굴면 **죽은 특전**이다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SIM = path.join(__dirname, '..', 'sim.js');
const SRC = fs.readFileSync(SIM, 'utf8');

let fail = 0;
const bad = (m) => { console.log('  ✗ ' + m); fail++; };
const ok = (m) => console.log('  ✓ ' + m);

/* ══════════ 1. 특전 목록 ══════════ */
const MK = SRC.match(/function mkPerks\(\)[\s\S]*?\n\}/);
if (!MK) { console.log('mkPerks() 를 찾지 못했다'); process.exit(1); }
const PERK = [...MK[0].matchAll(/add\('([a-z]_[A-Za-z0-9]+)',(\d)/g)].map(m => ({ id: m[1], r: +m[2] }));
const RAR = ['일반', '희귀', '전설'];

/* ══════════ 2. 소스 계측 ══════════ */

/* 문자열·주석 밖의 «코드» 위치만 참인 마스크. sim.js 에 정규식 리터럴은 없다(게이트가 확인한다). */
function codeMask(s) {
  const m = new Uint8Array(s.length);
  let i = 0;
  while (i < s.length) {
    const c = s[i], d = s[i + 1];
    if (c === '/' && d === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < s.length) { if (s[i] === '\\') { i += 2; continue; } if (s[i] === q) { i++; break; } i++; }
      continue;
    }
    m[i] = 1; i++;
  }
  return m;
}
const MASK = codeMask(SRC);
if (/\/[^\/*\s][^\n]*\/[gimsuy]*\.(test|exec)\(/.test(SRC)) bad('sim.js 에 정규식 리터럴이 생겼다 — 계측 스캐너의 전제가 깨진다');

const lineOf = (() => {
  const starts = [0];
  for (let i = 0; i < SRC.length; i++) if (SRC[i] === '\n') starts.push(i + 1);
  return pos => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; } return lo + 1; };
})();

const ID_RE = /(?:p\.)?px\.([a-z]_[A-Za-z0-9]+)/g;
const IDSET = new Set(PERK.map(p => p.id));

/* 일반 if 변환에서 **제외**할 자리 — 조건이 참이어도 그 특전의 효과가 실행됐다는 뜻이 아닌 관문들.
   (안쪽에 진짜 효과 if 가 따로 있거나, 조건이 뒤집혀 있다.) */
const IF_SKIP = [
  'px.c_backDmg||px.backDmg',                                  /* 바깥 관문 — 안쪽 `if(px.c_backDmg)` 가 진짜 효과 */
  'p.px.l_autoBolt||p.px.l_autoAxe||p.px.l_autoSpear',         /* 바깥 관문 — 안쪽 3줄이 진짜 발사 */
  '!(stunned&&px.c_stunNoEvade)&&Math.random()<ENEMY_EVADE',   /* 뒤집힘 — 참이면 «회피했다» = 특전이 안 막았다 */
];

/* 문(statement) 하나의 끝(세미콜론 또는 블록 끝)을 찾는다. */
function stmtEnd(s, i) {
  let dp = 0, db = 0, dk = 0;
  while (i < s.length) {
    if (!MASK[i]) { i++; continue; }
    const c = s[i];
    if (c === '(') dp++; else if (c === ')') dp--;
    else if (c === '[') dk++; else if (c === ']') dk--;
    else if (c === '{') db++; else if (c === '}') { db--; if (db === 0) return i + 1; if (db < 0) return i; }
    else if (c === ';' && dp === 0 && db === 0 && dk === 0) return i + 1;
    i++;
  }
  return i;
}

function instrument(src) {
  const edits = [];   /* {pos, text} */
  const sites = [];   /* 진단용 */

  /* ── ① if 문 일반 변환 ── */
  for (let i = 0; i < src.length - 2; i++) {
    if (!MASK[i]) continue;
    if (!(src[i] === 'i' && src[i + 1] === 'f')) continue;
    const prev = i > 0 ? src[i - 1] : ' ';
    if (/[A-Za-z0-9_$.]/.test(prev)) continue;             /* elif/notif 같은 식별자 꼬리 배제 */
    let j = i + 2; while (j < src.length && /\s/.test(src[j])) j++;
    if (src[j] !== '(') continue;
    /* 조건 괄호 짝 맞추기 */
    let dp = 0, k = j;
    for (; k < src.length; k++) { if (!MASK[k]) continue; if (src[k] === '(') dp++; else if (src[k] === ')') { dp--; if (dp === 0) break; } }
    const cond = src.slice(j + 1, k);
    ID_RE.lastIndex = 0;
    const found = [];
    let m; while ((m = ID_RE.exec(cond))) if (IDSET.has(m[1]) && !found.some(f => f.id === m[1])) found.push({ id: m[1], expr: m[0] });
    if (!found.length) continue;
    if (IF_SKIP.some(sk => cond.includes(sk))) continue;
    /* 효과(consequent) 시작점 */
    let c = k + 1; while (c < src.length && /\s/.test(src[c])) c++;
    const ln = lineOf(i);
    const call = `__F(${JSON.stringify('L' + ln)},{${found.map(f => `${f.id}:${f.expr}`).join(',')}});`;
    if (src[c] === '{') {
      edits.push({ pos: c + 1, text: call });
    } else {
      const e = stmtEnd(src, c);
      edits.push({ pos: c, text: '{' + call });
      edits.push({ pos: e, text: '}' });
    }
    for (const f of found) sites.push({ id: f.id, site: 'L' + ln });
    i = k;
  }

  edits.sort((a, b) => a.pos - b.pos || 0);
  let out = '', last = 0;
  for (const e of edits) { out += src.slice(last, e.pos) + e.text; last = e.pos; }
  out += src.slice(last);
  return { out, sites };
}

let { out: INS, sites: SITES } = instrument(SRC);

/* ── ② 손으로 짚은 패치표 (if 문이 아닌 자리 + px 키를 안 읽는 5종) ── */
const PATCH = [
  /* 🗿 기절한 적은 회피 못 함 — 조건이 뒤집혀 있어 «막았을 때» 를 따로 센다 */
  ['c_stunNoEvade', 'G.atkTries++;\n  if(!(stunned&&px.c_stunNoEvade)',
    'G.atkTries++;\n  if(stunned&&px.c_stunNoEvade)__F("M_stunNoEvade",{c_stunNoEvade:1});\n  if(!(stunned&&px.c_stunNoEvade)'],
  /* 💀⚔️ 치확 0% (삼항) */
  ['l_noCritAtk3', "p=>p.px.l_noCritAtk3?0:p.critR", 'p=>p.px.l_noCritAtk3?(__F("M_noCrit",{l_noCritAtk3:1}),0):p.critR'],
  /* 🃏🔁 특전 1개당 반격 (삼항) */
  ['c_collCounter', "p.px.c_collCounter?2*perkN(p):0", 'p.px.c_collCounter?(__F("M_collCounter",{c_collCounter:1}),2*perkN(p)):0'],
  /* 🪓🌪️ 도끼 3회전 (삼항) */
  ['l_axeSpin', 'const times=px.l_axeSpin?3:1;', 'const times=px.l_axeSpin?(__F("M_axeSpin",{l_axeSpin:1}),3):1;'],
  /* ⚜️ 반격 피해 +100% (삼항) */
  ['r_counterX', '*(px.r_counterX?2:1);', '*(px.r_counterX?(__F("M_counterX",{r_counterX:1}),2):1);'],
  /* 🌊🔱 거대 검기 (대입) */
  ['l_wavePierce', 'const big=px.l_wavePierce;', 'const big=px.l_wavePierce;if(big)__F("M_wavePierce",{l_wavePierce:1});'],
  /* 💎 실드 있으면 50% 데미지 무시 (대입 — 실제로 무시했을 때만) */
  ['l_shieldIgnore', 'const ignored=px.l_shieldIgnore&&p.sh>0&&pkk(p,0.50);',
    'const ignored=px.l_shieldIgnore&&p.sh>0&&pkk(p,0.50);if(ignored)__F("M_shieldIgnore",{l_shieldIgnore:1});'],
  /* 💢 피격 시 즉시 반격 (|| 꼬리) */
  ['r_hitCounter', '||(px.r_hitCounter&&pkk(p,0.30));', '||(px.r_hitCounter&&pkk(p,0.30)&&(__F("M_hitCounter",{r_hitCounter:1}),true));'],
  /* 🥶 위압의 오라 (삼항) */
  ['l_slowAura', '(p.px.l_slowAura?1/0.70:1)', '(p.px.l_slowAura?(__F("M_slowAura",{l_slowAura:1}),1/0.70):1)'],
  /* ── px 키를 안 읽고 스탯을 직접 바꾸는 5종 — «그 스탯이 실제로 쓰인 자리» 에서 센다 ──
     `p.__amp.<id>` 는 아래 STATPERK 가 심는 표식으로, **획득 시 그 스탯이 실제로 변했을 때만** 참이다.
     px 키만 보면 «수치를 0 으로 지워도 발동으로 잡히는» 헛계측이 된다(자가검사 ⑤가 이것을 잡는다). */
  /* 🍖 처치 시 체력 5% (주인 확정 상수) */
  ['c_killHeal2', 'if(p.killHeal>0)heal(p,p.maxHp*p.killHeal);',
    'if(p.killHeal>0){if(p.__amp&&p.__amp.c_killHeal2)__F("M_killHeal",{c_killHeal2:1});heal(p,p.maxHp*p.killHeal);}'],
  /* 💞 체력 회복 효과 +100% — 실제로 회복이 일어난 자리 */
  ['r_healAmp', '    amt*=1+p.healAmp;',
    '    if(p.__amp&&p.__amp.r_healAmp&&amt>0&&p.hp<p.maxHp)__F("M_healAmp",{r_healAmp:1});\n    amt*=1+p.healAmp;'],
  /* 🔧 실드 수리 효과 +100% — 실제로 수리가 일어난 자리 */
  ['r_repairAmp', 'function repair(p,amt){ if(amt<=0)return;',
    'function repair(p,amt){ if(amt<=0)return; if(p.__amp&&p.__amp.r_repairAmp&&p.sh<p.maxSh)__F("M_repairAmp",{r_repairAmp:1});'],
  /* 🔥 치명타 데미지 +100% · 💪 공격력 +50% — 실제로 피해가 들어간 자리 */
  ['r_critF100|r_atk50', '  e.hp-=d;\n  if(p.steal>0)',
    '  e.hp-=d;\n  if(p.__amp&&p.__amp.r_atk50)__F("M_atk50",{r_atk50:1});\n  if(crit&&p.__amp&&p.__amp.r_critF100)__F("M_critF",{r_critF100:1});\n  if(p.steal>0)'],
];
/* 스탯 직변형 5종 — 획득 함수를 감싸 «그 스탯이 실제로 변했는가» 를 표식으로 남긴다. */
const STATPERK = [
  ['c_killHeal2', 'killHeal', 'p=>{p.px.c_killHeal2=1;p.killHeal+=0.05;}'],
  ['r_healAmp', 'healAmp', 'p=>{p.px.r_healAmp=1;p.healAmp+=1.00;}'],
  ['r_repairAmp', 'repairAmp', 'p=>{p.px.r_repairAmp=1;p.repairAmp+=1.00;}'],
  ['r_critF100', 'critF', 'p=>{p.px.r_critF100=1;p.critF+=100;}'],
  ['r_atk50', 'dmg', 'p=>{p.px.r_atk50=1;p.dmg*=1.50;}'],
];
for (const [id, fld, ap] of STATPERK) PATCH.push([id + ':ap', ap,
  `p=>{const __b=p.${fld};(${ap})(p);(p.__amp||(p.__amp={})).${id}=(p.${fld}!==__b);}`]);
for (const [tag, from, to] of PATCH) {
  const n = INS.split(from).length - 1;
  if (n !== 1) { bad(`패치표 «${tag}» 원문이 소스에 ${n}번 나온다 (1번이어야 한다) — 엔진이 바뀌었다면 패치표를 고칠 것`); continue; }
  INS = INS.replace(from, to);
  for (const id of tag.split('|')) if (IDSET.has(id)) SITES.push({ id, site: 'M' });
}

/* ── ③ 런타임 계측·시험용 훅 ── */
const PRELUDE = `
const __FIRED=Object.create(null), __FSITE=Object.create(null);
function __F(site,obj){ for(const k in obj){ if(!obj[k])continue; __FIRED[k]=(__FIRED[k]||0)+1; (__FSITE[k]||(__FSITE[k]=new Set())).add(site); } }
`;
INS = PRELUDE + INS;

/* 확률 굴림 강제 (2차용) */
{
  const from = 'const pkk=(p,ch)=>Math.random()<ch*(p.px.procX2?1.22:1);';
  if (INS.split(from).length - 1 !== 1) bad('pkk 정의를 찾지 못했다 — 확률 강제 훅을 못 꽂는다');
  else INS = INS.replace(from, 'const pkk=(p,ch)=>__FORCE?true:Math.random()<ch*(p.px.procX2?1.22:1);');
}
/* 보유 특전 고정 — 대상+동반 세트를 미리 들리고, 레벨업 특전 획득은 끈다 */
{
  const from = '  const p=mkPlayer(build,G);G.player=p;p.G=G;';
  if (INS.split(from).length - 1 !== 1) bad('runChapter 의 플레이어 생성부를 찾지 못했다');
  else INS = INS.replace(from, from + `
  if(opts.hold){ G.noPerkChoice=true; for(const id of opts.hold){ const pk=PERKS.find(x=>x.id===id); if(!pk)throw new Error('없는 특전 '+id); pk.ap(p); G.taken.push(pk); } p.hp=p.maxHp; p.sh=p.maxSh; }`);
}
{
  const from = 'function perkChoice(G){\n';
  if (INS.split(from).length - 1 !== 1) bad('perkChoice 정의를 찾지 못했다');
  else INS = INS.replace(from, from + '  if(G.noPerkChoice)return;\n');
}
/* 실험 자동 실행 차단 + 내보내기 */
{
  const from = "const mode=process.argv[2]||'all';";
  if (INS.split(from).length - 1 !== 1) bad('main 디스패치를 찾지 못했다');
  else INS = INS.replace(from, "const mode='__perkfire__';");
}
INS += `
module.exports={PERKS,runChapter,mkBuild,setSeed,TUNE,__FIRED,__FSITE,
  reset:()=>{for(const k in __FIRED)delete __FIRED[k];for(const k in __FSITE)delete __FSITE[k];},
  force:v=>{__FORCE=v;}};
var __FORCE=false;
`;

if (fail) { console.log(`\n계측 단계에서 이미 ${fail}건 — 중단`); process.exit(1); }

/* ══════════ 3. 계측본 적재 ══════════ */
function load(src) {
  const mod = { exports: {} };
  const ctx = vm.createContext({ module: mod, exports: mod.exports, require, console, process, Math, Set, Map, Object, Array, JSON, Number, String, Boolean, isNaN, parseInt, parseFloat, Infinity, NaN, undefined });
  try { vm.runInContext(src, ctx, { filename: 'sim.instrumented.js' }); }
  catch (e) { console.log('  ✗ 계측본 실행 실패: ' + e.message); process.exit(1); }
  return mod.exports;
}
const S = load(INS);
ok(`계측본 적재 — 특전 ${S.PERKS.length}종 · 계측 지점 ${new Set(SITES.map(s => s.id + s.site)).size}곳`);

/* 계측이 한 군데도 안 걸린 특전이 있으면 그 자체가 결함이다 */
{
  const covered = new Set(SITES.map(s => s.id));
  const miss = PERK.filter(p => !covered.has(p.id)).map(p => p.id);
  if (miss.length) bad(`계측 지점이 0곳인 특전 ${miss.length}종 — ${miss.join(' ')}`);
  else ok(`132종 전부 계측 지점 ≥1곳 (일반 ${PERK.filter(p => p.r === 0).length} · 희귀 ${PERK.filter(p => p.r === 1).length} · 전설 ${PERK.filter(p => p.r === 2).length})`);
}

/* ══════════ 4. 실행 조건 ══════════ */
/* 동반 세트 — 대상 특전이 «구조적으로» 못 도는 경우를 없앤다.
   소환 5종 공급(도끼·화살·검기·번개·창) · 방어막 공급 · 기절 공급 · 회복/수리 공급.
   기록은 대상 특전의 카운터만 읽으므로 동반 특전이 함께 굴어도 판정은 오염되지 않는다. */
const COMPANION = ['c_axeHit', 'r_arrowAtk', 'c_waveAtk', 'c_boltKill', 'l_spear2Atk',
  'c_wardHit', 'c_stunAtk', 'c_killHeal2', 'c_killShield3'];

/* 챕터 30 = 실험1 하니스(희귀 풀셋·슬롯 0)와 같은 자리 — 완주하며 이벤트·쉼터를 다 지난다.
   챕터 60 = 같은 장비로 두들겨 맞는 자리 — 저체력·방어막 소모·피격 축이 여기서 굴린다. */
const CONF = [{ ch: 30, n: 6 }, { ch: 60, n: 6 }];
const build = S.mkBuild(1, 0, 0, 0);

function runFor(id, forced, seed0) {
  S.force(forced);
  const hold = [id, ...COMPANION.filter(c => c !== id)];
  let cnt = 0; const sites = new Set();
  for (const cf of CONF) {
    for (let i = 0; i < cf.n; i++) {
      S.reset();
      S.setSeed(seed0 + i * 7919 + cf.ch);
      try { S.runChapter(cf.ch, build, { hold }); }
      catch (e) { S.force(false); throw new Error(`${id} 실행 예외 (챕터 ${cf.ch}): ${e.message}`); }
      cnt += S.__FIRED[id] || 0;
      if (S.__FSITE[id]) for (const s of S.__FSITE[id]) sites.add(s);
    }
  }
  S.force(false);
  return { cnt, sites: [...sites] };
}

console.log('\n[① 자연 굴림 — 확률에 손대지 않고 챕터 30·60 각 6판]');
const res = {};
let natural = 0, exc = 0;
for (const p of PERK) {
  try { res[p.id] = runFor(p.id, false, 4242); }
  catch (e) { bad(e.message); exc++; res[p.id] = { cnt: 0, sites: [] }; continue; }
  if (res[p.id].cnt > 0) natural++;
}
if (!exc) ok(`실행 예외 0건 (132종 × 12판 = 1,584판)`);
console.log(`  자연 굴림 발동: ${natural}/${PERK.length}종`);

const rest = PERK.filter(p => res[p.id].cnt === 0);
if (rest.length) {
  console.log(`\n[② 확률 강제 (pkk=true) — 1차 미발동 ${rest.length}종 재시도]`);
  for (const p of rest) {
    try { res[p.id] = runFor(p.id, true, 99173); } catch (e) { bad(e.message); }
    console.log(`  ${res[p.id].cnt > 0 ? '·' : '✗'} ${p.id}(${RAR[p.r]}) — ${res[p.id].cnt > 0 ? `강제 시 발동 ${res[p.id].cnt}회` : '**강제해도 발동 0**'}`);
  }
}

const dead = PERK.filter(p => res[p.id].cnt === 0);
console.log('');
if (dead.length) bad(`발동 0인 특전 ${dead.length}종 — ${dead.map(d => `${d.id}(${RAR[d.r]})`).join(' · ')}`);
else ok(`132/132 전 특전이 실제로 발동했다 (자연 ${natural} · 확률 강제 ${PERK.length - natural})`);

/* 등급별 요약 */
for (let r = 0; r < 3; r++) {
  const rr = PERK.filter(p => p.r === r);
  const nat = rr.filter(p => res[p.id].cnt > 0).length;
  console.log(`  ${RAR[r]} ${nat}/${rr.length} 발동 · 총 발동 ${rr.reduce((s, p) => s + res[p.id].cnt, 0).toLocaleString()}회`);
}
if (process.env.PERKFIRE_VERBOSE) {
  console.log('\n[진단] 특전별 발동 횟수 · 발동 지점');
  for (const p of PERK) console.log(`  ${p.id.padEnd(18)} ${RAR[p.r]} ${String(res[p.id].cnt).padStart(7)}회  ${res[p.id].sites.join(',')}`);
}

/* ══════════ 5. 게이트 자가검사 ══════════ */
/* 계측본에서 어떤 특전의 효과를 지우면 그 특전이 «발동 0» 으로 잡혀야 한다.
   안 잡히면 이 게이트는 아무것도 안 보고 있는 것이다. */
console.log('\n[③ 자가검사 — 효과를 지우면 발동 0 으로 잡히는가]');
const SELF = [
  /* 효과 분기를 죽인다 */
  ['c_waveAtk', 'if(px.c_waveAtk&&pkk(p,0.10))', 'if(false&&px.c_waveAtk&&pkk(p,0.10))'],
  ['l_thorns', 'if(px.l_thorns)', 'if(false&&px.l_thorns)'],
  ['r_wardHeal', 'if(px.r_wardHeal)', 'if(false&&px.r_wardHeal)'],
  /* 손 패치표 자리(삼항·|| 꼬리)도 같이 본다 */
  ['l_axeSpin', 'const times=px.l_axeSpin?', 'const times=false&&px.l_axeSpin?'],
  ['r_hitCounter', '||(px.r_hitCounter&&pkk(p,0.30)', '||(false&&px.r_hitCounter&&pkk(p,0.30)'],
  /* 스탯 직변형 — 수치만 0 으로 지워도 잡혀야 한다 (px 키는 그대로 남는다) */
  ['c_killHeal2', 'p.killHeal+=0.05;', 'p.killHeal+=0;'],
  ['r_repairAmp', 'p.repairAmp+=1.00;', 'p.repairAmp+=0;'],
  ['r_atk50', 'p.dmg*=1.50;', 'p.dmg*=1;'],
];
const selfCount = (M, id) => {
  M.force(true);
  const hold = [id, ...COMPANION.filter(c => c !== id)];
  let c = 0;
  for (const cf of CONF) for (let i = 0; i < 3; i++) { M.reset(); M.setSeed(4242 + i * 7919 + cf.ch); M.runChapter(cf.ch, build, { hold }); c += M.__FIRED[id] || 0; }
  M.force(false); return c;
};
const BASE = load(INS);
for (const [id, from, to] of SELF) {
  if (INS.split(from).length - 1 < 1) { bad(`자가검사 «${id}» 원문을 못 찾았다 — 엔진이 바뀌었다면 자가검사표를 고칠 것`); continue; }
  const c0 = selfCount(BASE, id);                       /* 양성 대조 — 안 고친 계측본에서는 굴어야 한다 */
  if (c0 === 0) { bad(`${id} — 양성 대조에서조차 발동 0 (자가검사가 무의미하다)`); continue; }
  const c = selfCount(load(INS.replace(from, to)), id);
  if (c === 0) ok(`${id} — 효과 있을 때 ${c0}회 → 지우니 0회 (게이트가 본다)`);
  else bad(`${id} — 효과를 지웠는데도 발동 ${c}회로 잡힌다 (계측이 효과가 아니라 다른 것을 세고 있다)`);
}

console.log(`\n통과 ${fail === 0 ? '전부' : ''} · 위반 ${fail}`);
process.exit(fail ? 1 : 0);
