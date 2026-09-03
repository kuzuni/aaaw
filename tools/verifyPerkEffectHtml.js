/* T88 2단계 — 132종 «효과 적용» 감사 (주인 지시 ⑤) · index.html 축
 *
 * 사용: PW_CORE=<playwright-core 경로> node tools/verifyPerkEffectHtml.js
 *       PERKEFFECT_VERBOSE=1 …                (특전별 달라진 판 수까지 출력)
 * 전제: `playwright-core` 를 스크래치패드에 깔고 PW_CORE 로 넘긴다 (리포에 커밋 금지 — ROUTINE §1).
 *
 * 재는 것은 `verifyPerkEffect.js`(sim.js 축)와 **완전히 같다**:
 *   특전 하나의 **효과 크기만** 항등으로 만든 사본을 메모리에서 만들고,
 *   원본과 같은 시드·같은 보유 특전으로 판을 돌려 결과 지문을 맞댄다.
 *   지문이 한 판도 안 달라지면 = 그 효과는 게임에서 아무 일도 안 하고 있다.
 * 조건·확률 굴림은 손대지 않는다(난수열이 밀려서 달라 보이는 착시 방지).
 *
 * ⚠ sim 이 초록이어도 게임이 빨갈 수 있다 — T34 가 잡은 «검기의 왕이 배포 빌드에서만 죽어
 *   있던» 건이 그 선례다. 그래서 두 엔진을 따로 잰다.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
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
const OUT = process.env.T3_OUT || os.tmpdir();

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok = m => console.log('  ✓ ' + m);

/* ══════════ 1. 특전 목록 — sim.js 가 정본 ══════════ */
const MK = SIM.match(/function mkPerks\(\)[\s\S]*?\n\}/);
if (!MK) { console.log('sim.js mkPerks() 를 찾지 못했다'); process.exit(1); }
const PERK = [...MK[0].matchAll(/add\('([a-z]_[A-Za-z0-9]+)',(\d)/g)].map(m => ({ id: m[1], r: +m[2] }));
const IDSET = new Set(PERK.map(p => p.id));
const RAR = ['일반', '희귀', '전설'];
/* 진단용 — PERKEFFECT_ONLY=id,id 로 대상을 좁힐 수 있다(게이트 판정에는 영향 없음, 조사용). */
const ONLY = (process.env.PERKEFFECT_ONLY || '').split(',').map(x => x.trim()).filter(Boolean);

const S0 = HTML.indexOf('<script>'), S1 = HTML.indexOf('</script>');
if (S0 < 0 || S1 < 0) { console.log('index.html 인라인 스크립트를 찾지 못했다'); process.exit(1); }
const HEAD = HTML.slice(0, S0 + 8), TAIL = HTML.slice(S1);
const JS0 = HTML.slice(S0 + 8, S1);

/* ══════════ 2. 무력화기 — sim 축과 같은 방식 ══════════ */
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
    if (ids.size > 1) shared++;
    let c = k + 1; while (c < src.length && /\s/.test(src[c])) c++;
    cuts.push([c, core.stmtEnd(src, mask, c)]);
    i = k;
  }
  if (!cuts.length) return null;
  const keep = [];
  for (const c of cuts) if (!keep.length || c[0] >= keep[keep.length - 1][1]) keep.push(c);
  let out = '', last = 0;
  for (const [a, b] of keep) { out += src.slice(last, a) + '{}'; last = b; }
  return { out: out + src.slice(last), n: keep.length, shared };
}

/* if 문이 아닌 자리 — 게임 쪽 원문(공백이 sim 과 다르다). 전부 «크기만 항등» 으로. */
const HAND = {
  c_stunNoEvade: ['if(!(stunned&&px.c_stunNoEvade)&&Math.random()<ENEMY_EVADE){', 'if(!(false&&stunned&&px.c_stunNoEvade)&&Math.random()<ENEMY_EVADE){'],
  l_noCritAtk3: [/l_noCritAtk3\?0:(p\.critR\+bsum\(p,'critR'\))/, "l_noCritAtk3?($1):$1"],
  c_collCounter: ['p.px.c_collCounter?2*perkN():0', 'p.px.c_collCounter?0:0'],
  l_axeSpin: [/const times=px\.l_axeSpin\?(\d+):1;/, 'const times=px.l_axeSpin?1:1;'],
  r_counterX: [/\*\(px\.r_counterX\?([\d.]+):1\);/, '*(px.r_counterX?1:1);'],
  l_slowAura: [/\(p\.px\.l_slowAura\?1\/([\d.]+):1\)/, '(p.px.l_slowAura?1:1)'],
  l_wavePierce: ['const big=px.l_wavePierce;', 'const big=px.l_wavePierce&&false;'],
  l_shieldIgnore: [/const ignored=(px\.l_shieldIgnore&&p\.sh>0&&pkk\(p,[\d.]+\));/, 'const ignored=($1)&&false;'],
  r_hitCounter: [/\|\|\(px\.r_hitCounter&&pkk\(p,([\d.]+)\)\);/, '||((px.r_hitCounter&&pkk(p,$1))&&false);'],
  c_killHeal2: [/p\.px\.c_killHeal2=1;p\.killHeal\+=[\d.]+;/, 'p.px.c_killHeal2=1;p.killHeal+=0;'],
  r_healAmp: [/p\.px\.r_healAmp=1;p\.healAmp\+=[\d.]+;/, 'p.px.r_healAmp=1;p.healAmp+=0;'],
  r_repairAmp: [/p\.px\.r_repairAmp=1;p\.repairAmp\+=[\d.]+;/, 'p.px.r_repairAmp=1;p.repairAmp+=0;'],
  r_critF100: [/p\.px\.r_critF100=1;p\.critF\+=[\d.]+;/, 'p.px.r_critF100=1;p.critF+=0;'],
  r_atk50: [/p\.px\.r_atk50=1;p\.dmg\*=[\d.]+;/, 'p.px.r_atk50=1;p.dmg*=1;'],
};
const count = (src, from) => from instanceof RegExp
  ? (src.match(new RegExp(from.source, from.flags.includes('g') ? from.flags : from.flags + 'g')) || []).length
  : src.split(from).length - 1;

function neutralize(id) {
  if (HAND[id]) {
    const [from, to] = HAND[id];
    const n = count(JS0, from);
    if (n !== 1) return { err: `항등화표 «${id}» 원문이 index.html 에 ${n}번 나온다 (1번이어야 한다) — 엔진이 바뀌었다면 표를 고칠 것` };
    return { out: JS0.replace(from, to), n: 1, shared: 0, how: '손' };
  }
  const r = neutralizeIfs(JS0, id);
  if (!r) return { err: `${id} — index.html 에서 무력화할 자리를 못 찾았다` };
  return { out: r.out, n: r.n, shared: r.shared, how: '자동' };
}

/* ══════════ 3. 드라이버 ══════════ */
/* 보유 특전 고정 · 레벨업 팝업 차단 · 확률 강제 · 시드 고정 — verifyPerkFireHtml 과 같은 세 자리. */
const HOOK = [
  ['pkk', 'function pkk(p,ch){ return Math.random() < ch*(p.px.procX2?1.22:1); }',
    'function pkk(p,ch){ return window.__PEforce ? true : Math.random() < ch*(p.px.procX2?1.22:1); }'],
  ['startChapter', '  G.player.G=G;', `  G.player.G=G;
  if(window.__PEhold){ for(const id of window.__PEhold){ const pk=PERKS.find(x=>x.id===id); if(!pk)throw new Error('없는 특전 '+id); pk.ap(G.player); G.perksTaken.push(pk); } G.player.hp=G.player.maxHp; G.player.sh=G.player.maxSh; }`],
  ['openPerkChoice', 'function openPerkChoice(){\n  G.perkChances++;',
    'function openPerkChoice(){\n  G.perkChances++;\n  if(window.__PEnoperk) return;'],
];
const DRIVER = `
window.__PEforce=false; window.__PEhold=null; window.__PEnoperk=false;
function __mul(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
window.__PE={
  /* 한 판을 프레임을 직접 밀어 돌리고 **결과 지문**을 돌려준다.
     지문 = 소요 시간 · 처치 수 · 클리어/사망 · 남은 체력·실드 · 레벨 · 획득 골드.
     효과가 전투에 조금이라도 닿으면 이 중 하나는 흔들린다. */
  run(ch, hold, steps, seed){
    Math.random=__mul(seed|0);
    window.__PEhold=hold; window.__PEnoperk=true;
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
    const p=G?G.player:null;
    const fp=[G?G.t.toFixed(3):'-', G?G.kills:'-', G&&G.cleared?1:0, G&&G.over?1:0,
              p?p.hp.toFixed(2):'-', p?p.sh.toFixed(2):'-', p?p.level:'-', G?G.gold:'-'].join('/');
    window.__PEhold=null;
    return fp;
  },
  runAll(hold, conf, seed0, forced){
    window.__PEforce=!!forced;
    const out=[];
    for(const cf of conf) for(let i=0;i<cf.n;i++) out.push(this.run(cf.ch, hold, 9000, seed0 + i*7919 + cf.ch));
    window.__PEforce=false;
    return out;
  },
};
`;
function build(js) {
  let out = js;
  for (const [tag, a, b] of HOOK) {
    if (out.split(a).length - 1 !== 1) throw new Error(`훅 «${tag}» 자리가 1번이 아니다`);
    out = out.replace(a, b);
  }
  return HEAD + DRIVER + out + TAIL;
}

/* ══════════ 4. 실행 ══════════ */
const COMPANION = ['c_axeHit', 'r_arrowAtk', 'c_waveAtk', 'c_boltKill', 'l_spear2Atk',
  'c_wardHit', 'c_stunAtk', 'c_killHeal2', 'c_killShield3'];
/* ⚑ 동반 축소 세트 — 회복·수리·방어막 공급원을 뺀 것.
   표준 세트에는 🍖 c_killHeal2(처치 시 체력 5% 회복)가 있어 체력이 만피에 붙어 있고,
   그러면 «회피 시 5% 회복» 같은 회복형 특전은 **회복이 통째로 클램프돼** 결과에 안 나타난다
   (T88 2단계에서 c_evadeHealS·r_counterHeal 이 이 이유로 위양성이 났다 — 둘 다 실측하면
   문면대로 정확히 회복한다). 그래서 «못 찾은 것» 만 이 세트로 한 번 더 본다. */
const LEAN = ['c_axeHit', 'r_arrowAtk', 'c_waveAtk', 'c_boltKill', 'l_spear2Atk', 'c_stunAtk'];
const SEED = 20260903;
const LADDER = [
  { name: '표준', forced: false, conf: [{ ch: 30, n: 3 }, { ch: 60, n: 3 }] },
  { name: '확대', forced: false, conf: [{ ch: 20, n: 4 }, { ch: 45, n: 4 }, { ch: 90, n: 4 }] },
  { name: '확률 강제', forced: true, conf: [{ ch: 30, n: 3 }, { ch: 60, n: 3 }, { ch: 90, n: 3 }] },
  { name: '동반 축소', forced: false, lean: true, conf: [{ ch: 45, n: 4 }, { ch: 70, n: 4 }] },
  { name: '동반 축소·확률 강제', forced: true, lean: true, conf: [{ ch: 45, n: 4 }, { ch: 70, n: 4 }] },
];
const GEAR = () => { for (const pt of GT.parts) { save.eq[pt] = { part: pt, type: GT.types[pt][0], rar: 1, plus: 0 }; save.slots[pt] = 0; } };

(async () => {
  let BASEHTML;
  try { BASEHTML = build(JS0); } catch (e) { bad('원본 계측본 생성 실패 — ' + e.message); return finish(); }
  const baseFile = path.join(OUT, 'perkeffect.base.html');
  fs.writeFileSync(baseFile, BASEHTML);

  const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const basePage = await ctx.newPage();
  const errs = []; basePage.on('pageerror', e => errs.push(String(e)));
  await basePage.goto('file://' + baseFile);
  await basePage.waitForTimeout(500);
  const boot = await basePage.evaluate(() => ({ perks: typeof PERKS !== 'undefined' ? PERKS.length : -1, pe: !!window.__PE }));
  if (boot.perks !== PERK.length || !boot.pe) { bad(`원본 부팅 실패 — PERKS ${boot.perks} · 드라이버 ${boot.pe}`); await b.close(); return finish(); }
  ok(`원본 부팅 — PERKS ${boot.perks}종 · 드라이버 준비됨`);
  await basePage.evaluate(GEAR);

  const holdOf = (id, st) => { const set = st.lean ? LEAN : COMPANION; return [id, ...set.filter(c => c !== id)]; };
  const runOn = (pg, id, st) => pg.evaluate(([hold, conf, seed, forced]) =>
    window.__PE.runAll(hold, conf, seed, forced), [holdOf(id, st), st.conf, SEED, st.forced]);

  /* 무력화본을 미리 만들어 둔다 (원문 개수 검사는 여기서 걸린다) */
  const nz = {}, stat = { 자동: 0, 손: 0 }, sharedIds = [];
  for (const p of PERK) {
    const r = neutralize(p.id);
    if (r.err) { bad(r.err); continue; }
    stat[r.how]++; if (r.shared) sharedIds.push(p.id);
    nz[p.id] = r;
  }
  console.log(`  무력화 자리: 자동(if) ${stat.자동}종 · 손 항등화 ${stat.손}종` +
    (sharedIds.length ? ` · 조건 공유 ${sharedIds.length}종(${sharedIds.join(' ')})` : ''));

  console.log('\n[① 효과 무력화 대조 — 게임 엔진]');
  const detail = {};
  for (const p of PERK) if (nz[p.id] && (!ONLY.length || ONLY.includes(p.id))) detail[p.id] = { diff: 0, n: nz[p.id].n, how: nz[p.id].how, stage: -1 };

  for (let s = 0; s < LADDER.length; s++) {
    const st = LADDER[s];
    const todo = PERK.filter(p => detail[p.id] && !detail[p.id].diff);
    if (!todo.length) break;
    console.log(`  [사다리 ${s + 1} · ${st.name} — 챕터 ${st.conf.map(c => c.ch).join('·')} 각 ${st.conf[0].n}판${st.forced ? ' · pkk 강제' : ''}] 대상 ${todo.length}종`);
    for (const p of todo) {
      const a = await runOn(basePage, p.id, st);
      const f = path.join(OUT, `perkeffect.nz.${p.id}.html`);
      let pg;
      try {
        fs.writeFileSync(f, build(nz[p.id].out));
        pg = await ctx.newPage();
        const pe = []; pg.on('pageerror', e => pe.push(String(e)));
        await pg.goto('file://' + f);
        await pg.waitForTimeout(180);
        await pg.evaluate(GEAR);
        const c = await runOn(pg, p.id, st);
        if (pe.length) { bad(`${p.id} — 무력화본 pageerror: ${pe[0].slice(0, 120)}`); }
        const d = a.filter((x, i) => x !== c[i]).length;
        if (d) { detail[p.id].diff = d; detail[p.id].runs = a.length; detail[p.id].stage = s; }
      } catch (e) { bad(`${p.id} — 무력화본 실행 실패: ${e.message}`); }
      finally { if (pg) await pg.close(); try { fs.unlinkSync(f); } catch (e) { /* 임시 파일 */ } }
    }
    console.log(`    누적 «효과 적용» ${PERK.filter(p => detail[p.id] && detail[p.id].diff).length}/${PERK.length}종`);
  }

  const inert = PERK.filter(p => detail[p.id] && !detail[p.id].diff);
  console.log('');
  if (inert.length) {
    bad(`게임에서 효과를 무력화해도 결과가 안 달라진 특전 ${inert.length}종 — ${inert.map(d => `${d.id}(${RAR[d.r]})`).join(' · ')}`);
    console.log('     ↑ 조건은 굴지만 효과가 배포 빌드에 닿지 않는다는 뜻이다.');
  } else ok(`${PERK.length}/${PERK.length} — 게임 엔진에서도 전 특전의 효과가 실제로 적용된다`);
  for (let r = 0; r < 3; r++) {
    const rr = PERK.filter(p => p.r === r).filter(p => detail[p.id]);
    console.log(`  ${RAR[r]} ${rr.filter(p => detail[p.id].diff > 0).length}/${rr.length} 적용`);
  }
  console.log(`  판정이 갈린 사다리 칸: ${LADDER.map((L, i) => `${L.name} ${PERK.filter(p => detail[p.id] && detail[p.id].stage === i).length}`).join(' · ')}`);
  if (process.env.PERKEFFECT_VERBOSE) {
    console.log('\n[진단] 특전별 «무력화 시 달라진 판 수»');
    for (const p of PERK) if (detail[p.id]) console.log(`  ${p.id.padEnd(18)} ${RAR[p.r]} ${String(detail[p.id].diff).padStart(3)}/${detail[p.id].runs || '-'}  (${detail[p.id].how} ${detail[p.id].n}곳 · 사다리 ${detail[p.id].stage + 1})`);
  }
  if (errs.length) bad(`원본 pageerror ${errs.length}건 — ${errs.slice(0, 2).join(' | ')}`);
  else ok('원본 pageerror 0');

  /* ══════════ 5. 자가검사 ══════════ */
  console.log('\n[② 자가검사 — 효과가 죽은 게임을 만들어 놓고 잡히는지 본다]');
  const SELF = [
    ['l_axeSpin', '도끼 회전 수를 1 로', /const times=px\.l_axeSpin\?(\d+):1;/, 'const times=px.l_axeSpin?1:1;'],
    ['c_collCounter', '수집가 반격 증분을 0 으로', 'p.px.c_collCounter?2*perkN():0', 'p.px.c_collCounter?0:0'],
    ['r_atk50', '공격력 +50% 를 ×1 로', /p\.px\.r_atk50=1;p\.dmg\*=[\d.]+;/, 'p.px.r_atk50=1;p.dmg*=1;'],
  ];
  for (const [id, what, from, to] of SELF) {
    if (count(JS0, from) !== 1) { bad(`자가검사 «${id}» 원문이 1번이 아니다`); continue; }
    if (ONLY.length && !ONLY.includes(id)) continue;   /* 진단 모드에서 대상 밖은 건너뛴다 */
    if (!detail[id] || !detail[id].diff) { bad(`${id} — 양성 대조에서조차 «효과 없음» 이다`); continue; }
    const broken = JS0.replace(from, to);
    const nz2 = HAND[id] && count(broken, HAND[id][0]) === 1 ? broken.replace(HAND[id][0], HAND[id][1])
      : (HAND[id] ? broken : (neutralizeIfs(broken, id) || { out: broken }).out);
    const fa = path.join(OUT, `perkeffect.self.a.${id}.html`), fb = path.join(OUT, `perkeffect.self.b.${id}.html`);
    fs.writeFileSync(fa, build(broken)); fs.writeFileSync(fb, build(nz2));
    const pa = await ctx.newPage(), pb = await ctx.newPage();
    await pa.goto('file://' + fa); await pb.goto('file://' + fb);
    await pa.waitForTimeout(180); await pb.waitForTimeout(180);
    await pa.evaluate(GEAR); await pb.evaluate(GEAR);
    const A = await runOn(pa, id, LADDER[0]), B = await runOn(pb, id, LADDER[0]);
    await pa.close(); await pb.close(); fs.unlinkSync(fa); fs.unlinkSync(fb);
    const d = A.filter((x, i) => x !== B[i]).length;
    if (!d) ok(`${id} — ${what} → 이 게이트가 «효과 없음»(0판) 으로 잡는다 (원본은 ${detail[id].diff}판)`);
    else bad(`${id} — ${what} 했는데도 ${d}판이 달라져 «적용됨» 이 나온다`);
  }

  await b.close();
  finish();
})().catch(e => { console.log('  ✗ 실행 예외: ' + (e && e.stack || e)); process.exit(1); });

function finish() {
  console.log(`\n통과 ${fail === 0 ? '전부' : ''} · 위반 ${fail}`);
  process.exit(fail ? 1 : 0);
}
