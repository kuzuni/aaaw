/* T84 (P2) — 새 특전 132종 «실제 발동» 게이트 · **게임(index.html) 축**
 *
 * 사용: node tools/verifyPerkFireHtml.js       (exit 0 = 통과, 1 = 불합격)
 *       PERKFIRE_VERBOSE=1 …                   (특전별 발동 횟수까지 출력)
 * 전제: playwright-core (T3 스위트와 동일 — 스크래치패드에 깔고 PW_CORE 로 넘긴다. 리포에 커밋 금지)
 *
 * `verifyPerkFire.js` 가 `sim.js` 에서 하는 일을 **주인이 실제로 하는 게임**에서 그대로 한다.
 * 두 엔진이 «수치가 같다» 는 것은 `verifyT2`·`verifyCombatConst` 가 이미 대조하지만,
 * 그것은 정적 대조라 «게임 쪽 트리거가 실제로 굴었는가» 는 못 본다 — 이 게이트가 그 자리다.
 *
 * 방법: `index.html` 원본은 건드리지 않는다. 인라인 스크립트를 꺼내 메모리에서 계측한 뒤
 * 스크래치패드에 임시 HTML 로 떨어뜨려 헤드리스 크로미움에 물린다(임시 파일은 커밋 대상이 아니다).
 * 페이지 안에서 `startChapter()` 로 판을 열고 `update(1/30)` 을 직접 밀어 프레임을 앞당긴다
 * (rAF 를 기다리면 132종 × 여러 판이 실시간이 된다). 레벨업 특전 선택은 끄고 보유 목록을 고정한다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const core = require('./perkFireCore.js');

let chromium;
try { ({ chromium } = require(process.env.PW_CORE || 'playwright-core')); }
catch (e) {
  console.error('playwright-core 를 찾지 못했다. 스크래치패드에 설치한 뒤 PW_CORE=<경로> 로 지정할 것 (리포에 커밋 금지).');
  process.exit(2);
}
const EXE = process.env.PW_CHROME || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(f => fs.existsSync(f));

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SIM = fs.readFileSync(path.join(ROOT, 'sim.js'), 'utf8');

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok = m => console.log('  ✓ ' + m);

/* ══════════ 1. 특전 목록 — sim.js 가 정본, 게임에 같은 132종이 있어야 한다 ══════════ */
const MK = SIM.match(/function mkPerks\(\)[\s\S]*?\n\}/);
if (!MK) { console.log('sim.js mkPerks() 를 찾지 못했다'); process.exit(1); }
const PERK = [...MK[0].matchAll(/add\('([a-z]_[A-Za-z0-9]+)',(\d)/g)].map(m => ({ id: m[1], r: +m[2] }));
const IDSET = new Set(PERK.map(p => p.id));
const RAR = ['일반', '희귀', '전설'];

const S0 = HTML.indexOf('<script>'), S1 = HTML.indexOf('</script>');
if (S0 < 0 || S1 < 0) { console.log('index.html 인라인 스크립트를 찾지 못했다'); process.exit(1); }
const HEAD = HTML.slice(0, S0 + 8), TAIL = HTML.slice(S1);
let JS = HTML.slice(S0 + 8, S1);
const LINEBASE = HEAD.split('\n').length - 1;

{
  const htmlIds = new Set([...JS.matchAll(/\{id:'([a-z]_[A-Za-z0-9]+)'/g)].map(m => m[1]));
  const miss = PERK.filter(p => !htmlIds.has(p.id)).map(p => p.id);
  if (miss.length) bad(`게임 PERKS 에 없는 특전 ${miss.length}종 — ${miss.join(' ')}`);
  else ok(`게임 PERKS 가 sim.js 132종을 전부 담고 있다`);
}

/* ══════════ 2. 계측 ══════════ */
/* 바깥 관문·뒤집힌 조건 — sim.js 쪽과 같은 3자리 (게임은 공백만 다르다) */
const IF_SKIP = [
  'px.c_backDmg||px.backDmg',
  'p.px.l_autoBolt||p.px.l_autoAxe||p.px.l_autoSpear',
  '!(stunned&&px.c_stunNoEvade)&&Math.random()<ENEMY_EVADE',
];
const ifRes = core.instrumentIfs(JS, IDSET, IF_SKIP, LINEBASE);
JS = ifRes.out;
const SITES = ifRes.sites.slice();

/* 손 패치표 — if 문이 아닌 자리 9곳 + px 키를 안 읽는 스탯 직변형 5종.
   각 원문은 index.html 에 정확히 1번 나와야 한다(0번/2번이면 실패). */
const PATCH = [
  ['c_stunNoEvade', '  if(!(stunned&&px.c_stunNoEvade)&&Math.random()<ENEMY_EVADE){',
    '  if(stunned&&px.c_stunNoEvade)__F("M_stunNoEvade",{c_stunNoEvade:1});\n  if(!(stunned&&px.c_stunNoEvade)&&Math.random()<ENEMY_EVADE){'],
  ['l_noCritAtk3', 'return p.px.l_noCritAtk3?0:p.critR', 'return p.px.l_noCritAtk3?(__F("M_noCrit",{l_noCritAtk3:1}),0):p.critR'],
  ['c_collCounter', 'p.px.c_collCounter?2*perkN():0', 'p.px.c_collCounter?(__F("M_collCounter",{c_collCounter:1}),2*perkN()):0'],
  /* ⚑ P3 R04: 도끼 회전 수가 주인 승인 40번 ⓔ 로 튜닝 노브가 됐다 — 숫자를 박지 않고 정규식으로 받고,
     **1보다 클 때만** 발동으로 센다(`?1:1` 무력화가 초록으로 지나가던 구멍 — R03 의 r_counterX 선례). */
  ['l_axeSpin', /const times=px\.l_axeSpin\?(\d+):1;/, 'const times=px.l_axeSpin?(((($1)>1)?__F("M_axeSpin",{l_axeSpin:1}):0),$1):1;'],
  /* ⚑ P3 R03: 반격 계수는 튜닝 노브라 값을 정규식으로 받는다(R02 의 정규식 패치 규약). */
  ['r_counterX', /\*\(px\.r_counterX\?([\d.]+):1\);/, '*(px.r_counterX?(((($1)>1)?__F("M_counterX",{r_counterX:1}):0),$1):1);'],
  ['l_wavePierce', 'const big=px.l_wavePierce;', 'const big=px.l_wavePierce;if(big)__F("M_wavePierce",{l_wavePierce:1});'],
  /* ⚑ P3 R02: 확률·계수는 튜닝 노브라 패치 원문에 박지 않는다 (`[\d.]+` 로 받는다 — verifyPerkFire 와 같은 처리) */
  ['l_shieldIgnore', /const ignored=px\.l_shieldIgnore&&p\.sh>0&&pkk\(p,[\d.]+\);/,
    '$&if(ignored)__F("M_shieldIgnore",{l_shieldIgnore:1});'],
  ['r_hitCounter', /\|\|\(px\.r_hitCounter&&pkk\(p,([\d.]+)\)\);/, '||(px.r_hitCounter&&pkk(p,$1)&&(__F("M_hitCounter",{r_hitCounter:1}),true));'],
  ['l_slowAura', /\(p\.px\.l_slowAura\?1\/([\d.]+):1\)/, '(p.px.l_slowAura?(__F("M_slowAura",{l_slowAura:1}),1/$1):1)'],
  /* 스탯 직변형 5종 — 그 스탯이 실제로 쓰인 자리에서 센다 (표식 `p.__amp` 는 아래 STATPERK 가 심는다) */
  ['c_killHeal2', '  if(p.killHeal>0) heal(p,p.maxHp*p.killHeal);',
    '  if(p.killHeal>0){ if(p.__amp&&p.__amp.c_killHeal2)__F("M_killHeal",{c_killHeal2:1}); heal(p,p.maxHp*p.killHeal); }'],
  ['r_healAmp', '    amt*=1+p.healAmp;',
    '    if(p.__amp&&p.__amp.r_healAmp&&amt>0&&p.hp<p.maxHp)__F("M_healAmp",{r_healAmp:1});\n    amt*=1+p.healAmp;'],
  ['r_repairAmp', 'function repair(p,amt){ if(amt<=0) return;',
    'function repair(p,amt){ if(amt<=0) return; if(p.__amp&&p.__amp.r_repairAmp&&p.sh<p.maxSh)__F("M_repairAmp",{r_repairAmp:1});'],
  ['r_critF100|r_atk50', '  e.hp-=d; e.hitT=0.15;',
    '  e.hp-=d; e.hitT=0.15;\n  if(p.__amp&&p.__amp.r_atk50)__F("M_atk50",{r_atk50:1});\n  if(crit&&p.__amp&&p.__amp.r_critF100)__F("M_critF",{r_critF100:1});'],
];
const STATPERK = [
  ['c_killHeal2', 'killHeal', 'p=>{p.px.c_killHeal2=1;p.killHeal+=0.05;}'],
  ['r_healAmp', 'healAmp', /p=>\{p\.px\.r_healAmp=1;p\.healAmp\+=[\d.]+;\}/],
  ['r_repairAmp', 'repairAmp', /p=>\{p\.px\.r_repairAmp=1;p\.repairAmp\+=[\d.]+;\}/],
  ['r_critF100', 'critF', 'p=>{p.px.r_critF100=1;p.critF+=100;}'],
  ['r_atk50', 'dmg', 'p=>{p.px.r_atk50=1;p.dmg*=1.50;}'],
];
/* ⚑ P3 R03: ap 원문이 정규식일 수도 있으므로(수치가 튜닝 노브인 2종) 치환문에 원문을 `$&` 로 되꽂는다.
   문자열 원문에서도 `$&` 는 «일치한 그 문자열» 이라 동작이 같다. */
for (const [id, fld] of STATPERK) PATCH.push([id + ':ap', STATPERK.find(s => s[0] === id)[2],
  `p=>{const __b=p.${fld};($&)(p);(p.__amp||(p.__amp={})).${id}=(p.${fld}!==__b);}`]);

{
  const r = core.applyPatches(JS, PATCH, IDSET);
  JS = r.out; r.errs.forEach(bad); SITES.push(...r.sites);
}

/* 시험용 훅 */
const HOOK = [
  /* 확률 굴림 강제 (2차용) */
  ['pkk', 'function pkk(p,ch){ return Math.random() < ch*(p.px.procX2?1.22:1); }',
    'function pkk(p,ch){ return window.__PFforce ? true : Math.random() < ch*(p.px.procX2?1.22:1); }'],
  /* 보유 특전 고정 */
  ['startChapter', '  G.player.G=G;', `  G.player.G=G;
  if(window.__PFhold){ for(const id of window.__PFhold){ const pk=PERKS.find(x=>x.id===id); if(!pk)throw new Error('없는 특전 '+id); pk.ap(G.player); G.perksTaken.push(pk); } G.player.hp=G.player.maxHp; G.player.sh=G.player.maxSh; }`],
  /* 레벨업 특전 선택 팝업 차단 (팝업은 G.paused 로 게임을 멈춘다) */
  ['openPerkChoice', 'function openPerkChoice(){\n  G.perkChances++;',
    'function openPerkChoice(){\n  G.perkChances++;\n  if(window.__PFnoperk) return;'],
];
for (const [tag, from, to] of HOOK) {
  const n = JS.split(from).length - 1;
  if (n !== 1) { bad(`훅 «${tag}» 원문이 ${n}번 나온다 (1번이어야 한다)`); continue; }
  JS = JS.replace(from, to);
}

const PRELUDE = core.PRELUDE + `
window.__PFforce=false; window.__PFhold=null; window.__PFnoperk=false;
/* 시드 고정 — 게임은 sim.js 와 달리 setSeed 가 없어서 Math.random 을 통째로 갈아끼운다(sim.js mulberry 와 같은 식).
   이걸 안 하면 발동 횟수가 판마다 흔들려 «어제 초록이던 게이트가 오늘 빨갛다» 가 된다. */
function __mul(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
window.__PF={
  fired:__FIRED, site:__FSITE,
  reset(){ for(const k in __FIRED) delete __FIRED[k]; for(const k in __FSITE) delete __FSITE[k]; },
  /* 한 판을 «프레임을 직접 밀어» 돌린다. rAF 를 기다리지 않으므로 실시간의 수백 배로 지나간다.
     팝업(이벤트·쉼터)이 뜨면 G.paused 가 되어 update 가 멈추므로 그 자리에서 눌러 치운다. */
  run(ch, hold, steps, seed){
    Math.random=__mul(seed|0);
    window.__PFhold=hold; window.__PFnoperk=true;
    startChapter(ch);
    let guard=0;
    for(let i=0;i<steps;i++){
      if(!G || G.over || G.cleared) break;
      if(G.paused){
        const b=document.querySelector('#overlay .choice-btn')||document.querySelector('#overlay button');
        if(b) b.click(); else closeOverlay();
        if(++guard>400) break;
        continue;
      }
      update(1/30);
    }
    const st={t:G?G.t:0, kills:G?G.kills:0, cleared:!!(G&&G.cleared), over:!!(G&&G.over)};
    window.__PFhold=null;
    return st;
  },
};
`;
const OUTHTML = HEAD + PRELUDE + JS + TAIL;

if (fail) { console.log(`\n계측 단계에서 ${fail}건 — 중단`); process.exit(1); }
{
  const covered = new Set(SITES.map(s => s.id));
  const miss = PERK.filter(p => !covered.has(p.id)).map(p => p.id);
  if (miss.length) bad(`게임 쪽 계측 지점이 0곳인 특전 ${miss.length}종 — ${miss.join(' ')}`);
  else ok(`132종 전부 게임 쪽 계측 지점 ≥1곳 (총 ${new Set(SITES.map(s => s.id + s.site)).size}곳)`);
}

const TMP = path.join(process.env.T3_OUT || os.tmpdir(), 'perkfire.instrumented.html');
fs.writeFileSync(TMP, OUTHTML);

/* ══════════ 3. 실행 ══════════ */
const COMPANION = ['c_axeHit', 'r_arrowAtk', 'c_waveAtk', 'c_boltKill', 'l_spear2Atk',
  'c_wardHit', 'c_stunAtk', 'c_killHeal2', 'c_killShield3'];
/* 발동 사다리 — 위 칸에서 굴면 거기서 끝낸다. 아래로 갈수록 판을 늘리고 조건을 벌린다.
   ① 표준(실험1 하니스 자리 챕터 30 + 두들겨 맞는 챕터 60)
   ② 판수·챕터 확대 — 드문 트리거(3연속 회피·쉼터·저체력)를 위한 자리
   ③ 확률 강제 — 여기서만 굴면 «배선은 살아 있고 확률이 낮았다»
   ⚠ ③ 이 ① 보다 항상 유리한 것은 아니다: 모든 확률이 참이 되면 플레이어가 너무 세져
     맞는 일 자체가 줄어 «피격·반격» 축은 오히려 안 굴 수 있다. 그래서 ② 를 ③ 앞에 둔다. */
const LADDER = [
  { name: '표준', forced: false, rep: 3, chs: [30, 60], steps: 9000 },
  { name: '확대', forced: false, rep: 8, chs: [20, 45, 90], steps: 12000 },
  { name: '확률 강제', forced: true, rep: 6, chs: [30, 60, 90], steps: 9000 },
];

(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('file://' + TMP);
  await page.waitForTimeout(500);

  const boot = await page.evaluate(() => ({ perks: typeof PERKS !== 'undefined' ? PERKS.length : -1, pf: !!window.__PF }));
  if (boot.perks !== 132 || !boot.pf) { bad(`계측본 부팅 실패 — PERKS ${boot.perks} · __PF ${boot.pf}`); await b.close(); finish(); return; }
  ok(`계측본 부팅 — PERKS ${boot.perks}종 · 드라이버 준비됨`);

  /* 장비: 실험1 하니스와 같은 «희귀 풀셋 · 슬롯 0» 으로 맞춘다 */
  await page.evaluate(() => {
    for (const pt of GT.parts) { save.eq[pt] = { part: pt, type: GT.types[pt][0], rar: 1, plus: 0 }; save.slots[pt] = 0; }
  });

  const res = {};
  async function runOn(pg, id, st) {
    const hold = [id, ...COMPANION.filter(c => c !== id)];
    return await pg.evaluate(([hold, id, st]) => {
      window.__PFforce = st.forced;
      let cnt = 0, seed = 20260902; const sites = new Set();
      for (const ch of st.chs) for (let i = 0; i < st.rep; i++) {
        window.__PF.reset();
        window.__PF.run(ch, hold, st.steps, seed = (seed * 1103515245 + 12345 + ch) | 0);
        cnt += window.__PF.fired[id] || 0;
        if (window.__PF.site[id]) for (const s of window.__PF.site[id]) sites.add(s);
      }
      window.__PFforce = false;
      return { cnt, sites: [...sites] };
    }, [hold, id, st]);
  }

  const stage = {};
  for (let s = 0; s < LADDER.length; s++) {
    const todo = PERK.filter(p => !res[p.id] || res[p.id].cnt === 0);
    if (!todo.length) break;
    console.log(`\n[사다리 ${s + 1} · ${LADDER[s].name} — 챕터 ${LADDER[s].chs.join('·')} 각 ${LADDER[s].rep}판${LADDER[s].forced ? ' · pkk 강제' : ''}] 대상 ${todo.length}종`);
    for (const p of todo) {
      res[p.id] = await runOn(page, p.id, LADDER[s]);
      if (res[p.id].cnt > 0) stage[p.id] = s;
    }
    const done = PERK.filter(p => res[p.id] && res[p.id].cnt > 0).length;
    console.log(`  누적 발동 ${done}/${PERK.length}종`);
    if (s > 0) for (const p of todo) if (res[p.id].cnt > 0) console.log(`    · ${p.id}(${RAR[p.r]}) — ${res[p.id].cnt}회`);
  }

  console.log('');
  const dead = PERK.filter(p => res[p.id].cnt === 0);
  if (dead.length) bad(`게임에서 발동 0인 특전 ${dead.length}종 — ${dead.map(d => `${d.id}(${RAR[d.r]})`).join(' · ')}`);
  else {
    const byStage = LADDER.map((L, i) => `${L.name} ${PERK.filter(p => stage[p.id] === i).length}`).join(' · ');
    ok(`132/132 전 특전이 게임 엔진에서도 실제로 발동했다 (${byStage})`);
  }
  for (let r = 0; r < 3; r++) {
    const rr = PERK.filter(p => p.r === r);
    console.log(`  ${RAR[r]} ${rr.filter(p => res[p.id].cnt > 0).length}/${rr.length} 발동 · 총 ${rr.reduce((s, p) => s + res[p.id].cnt, 0).toLocaleString()}회`);
  }
  if (process.env.PERKFIRE_VERBOSE) {
    console.log('\n[진단] 특전별 발동 횟수 · 발동 지점');
    for (const p of PERK) console.log(`  ${p.id.padEnd(18)} ${RAR[p.r]} ${String(res[p.id].cnt).padStart(7)}회  ${res[p.id].sites.join(',')}`);
  }

  if (errs.length) bad(`pageerror ${errs.length}건 — ${errs.slice(0, 3).join(' | ')}`);
  else ok('pageerror 0 (사다리 전 구간)');

  /* ══════════ 4. 게이트 자가검사 ══════════ */
  /* 게임 쪽 효과를 지운 계측본을 따로 띄워, 그 특전이 «발동 0» 으로 잡히는지 본다.
     안 잡히면 이 게이트는 게임을 보고 있는 것이 아니다. */
  console.log('\n[③ 자가검사 — 게임 쪽 효과를 지우면 발동 0 으로 잡히는가]');
  const SELF = [
    ['c_waveAtk', 'if(px.c_waveAtk&&pkk(p,0.10))', 'if(false&&px.c_waveAtk&&pkk(p,0.10))'],
    ['l_thorns', 'if(px.l_thorns)', 'if(false&&px.l_thorns)'],
    ['l_axeSpin', 'const times=px.l_axeSpin?', 'const times=false&&px.l_axeSpin?'],
    ['c_killHeal2', 'p.killHeal+=0.05;', 'p.killHeal+=0;'],
    ['r_atk50', 'p.dmg*=1.50;', 'p.dmg*=1;'],
  ];
  for (const [id, from, to] of SELF) {
    if (OUTHTML.split(from).length - 1 < 1) { bad(`자가검사 «${id}» 원문을 못 찾았다 — 엔진이 바뀌었다면 자가검사표를 고칠 것`); continue; }
    const c0 = res[id].cnt;                       /* 양성 대조 — 안 고친 계측본에서 실제로 굴었다 */
    if (c0 === 0) { bad(`${id} — 양성 대조에서조차 발동 0 (자가검사가 무의미하다)`); continue; }
    const f = path.join(process.env.T3_OUT || os.tmpdir(), `perkfire.self.${id}.html`);
    fs.writeFileSync(f, OUTHTML.replace(from, to));
    const p2 = await ctx.newPage();
    await p2.goto('file://' + f); await p2.waitForTimeout(300);
    await p2.evaluate(() => { for (const pt of GT.parts) { save.eq[pt] = { part: pt, type: GT.types[pt][0], rar: 1, plus: 0 }; save.slots[pt] = 0; } });
    const c = (await runOn(p2, id, LADDER[0])).cnt;
    await p2.close(); fs.unlinkSync(f);
    if (c === 0) ok(`${id} — 효과 있을 때 ${c0}회 → 지우니 0회 (게이트가 본다)`);
    else bad(`${id} — 효과를 지웠는데도 발동 ${c}회로 잡힌다 (계측이 효과가 아니라 다른 것을 세고 있다)`);
  }

  await b.close();
  finish();
})().catch(e => { console.log('  ✗ 실행 예외: ' + (e && e.stack || e)); process.exit(1); });

function finish() {
  console.log(`\n통과 ${fail === 0 ? '전부' : ''} · 위반 ${fail}`);
  process.exit(fail ? 1 : 0);
}
