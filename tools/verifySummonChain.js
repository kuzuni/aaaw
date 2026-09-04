'use strict';
/* 소환 연쇄 임계 게이트 (T78 신설 · ⚑ P1(T83) 새 132종으로 전면 재작성)
   사용: node tools/verifySummonChain.js       (연쇄가 등재 기준선보다 나빠지면 exit 1)

   ⚑ 주인 확정 (2026-09-03):
     «연쇄 메커니즘(소환 적중 = 공격 판정)은 유지하되, **소환 1발의 적중이 낳는 신규 소환 기대값 ≤ 0.8** 을
      어떤 특전 조합에서도 유지해야 한다.»

   왜 이 자가 필요한가: 소환 적중은 «공격» 이라(주인 확정 15:3X · T45) 소환이 소환을 부른다.
   한 번의 적중이 평균 B 개의 새 소환을 낳으면 한 타격의 총 소환 수는 등비급수 1/(1-B) 다 —
   B<1 이면 수렴(B=0.8 → 5배), B≥1 이면 발산해서 PROC_TICK_CAP 이 끊을 때까지 부푼다.
   즉 이 게이트가 지키는 것은 «수치가 세다/약하다» 가 아니라 **연쇄가 수렴하는가** 라는 구조다.

   ⚑⚑ 지금 상태 (P1 이식 직후 · 주인 판단 대기):
     주인이 확정한 새 132종은 「공격 시」 축에만 소환 특전이 6종 있고(일반 🌊 10%×1 · 희귀 🏹 15%×2 ·
     전설 ⚡🪓🏹🌊 각 20%×2), 여기에 소환 개조(🏹² 화살 2배 · 🪓🌪️ 도끼 3타 · 🔗👑 번개 연쇄)가 곱해진다.
     **전부 보유하면 B 가 0.8 을 크게 넘는다** — 확정 목록 자체가 임계와 충돌한다.
     다만 새 과녁이 «전설만 뜨면 클리어율 80%»(§7)라 «전설 뜨면 판이 뒤집힌다» 는 주인 의도와 방향이 같고,
     확률·발수는 주인이 직접 확정한 값이라 워커가 임의로 내릴 수 없다.
     → 그래서 이 게이트는 **«0.8 을 지키는가»(판정 보류·표시만) 와 «등재 기준선보다 나빠졌는가»(단언)**
       를 분리한다. 기준선을 넘으면 빨개지므로 «조용히 더 세지는» 회귀는 여전히 막힌다.
       주인이 임계를 폐기하거나 확률을 내리라고 하면 BASE_B 를 지우고 CAP 단언으로 되돌릴 것.

   검사:
     ① procOnAttack 에서 소환 호출을 **자동 추출** — 게이트가 모르는 소환이 생기면 여기서 잡힌다.
     ② 두 파일(sim.js·index.html) 의 소환 확률·발수가 같은가.
     ③ 최악 조합(모든 소환 + 모든 소환 개조 동시 보유)의 기대값 — 분석값.
     ④ 같은 조합을 sim.js 엔진에서 실제로 굴려(몬테카를로) 잰 값이 분석값과 맞는가 · 기준선 이하인가. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const SIM = fs.readFileSync(path.join(root, 'sim.js'), 'utf8');
const HTML = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const CAP = 0.8;          /* 주인 확정 임계 (지금은 표시만 — 위 주석 참조) */
const BASE_B = 2.90;      /* ⚑ P1(T83) 이식 직후 실측 2.816 을 올림한 등재 기준선. 이 위로 가면 불합격. */

let bad = 0, okN = 0;
const fail = m => { bad++; console.log('  ❌ ' + m); };
const pass = m => { okN++; console.log('  ✓ ' + m); };
const note = m => console.log('  🔵 ' + m);
const pct = v => { const s = (v * 100).toFixed(1); return (s.endsWith('.0') ? s.slice(0, -2) : s) + '%'; };

/* ---------- ① procOnAttack 의 소환 호출 자동 추출 ---------- */
console.log('=== ① procOnAttack 의 소환 호출 — 게이트가 모르는 소환이 없는가 ===');
const KIND = { fireAxe: '도끼', fireArrows: '화살', fireBolts: '번개', fireWave: '검기', fireSpear: '창' };
function scanProc(src, who) {
  const m = src.match(/function procOnAttack\((?:G,e|e)\)\s*\{[\s\S]*?\n\}/);
  if (!m) { fail(`${who} 에서 procOnAttack 본문을 못 찾았다 — 코드 모양이 바뀌었다. 게이트를 함께 고칠 것`); return null; }
  const body = m[0];
  const rows = [];
  /* (a) 새 특전 축: if(px.<id>&&pkk(p,<확률>))fire<종류>(p,<발수>); */
  for (const x of body.matchAll(/px\.([crl]_\w+)&&pkk\(p,\s*([\d.]+)\)\s*\)?\s*(fire(?:Axe|Arrows|Bolts|Wave|Spear))\(p,\s*(\d+)\)/g))
    rows.push({ key: x[1], prob: +x[2], fn: x[3], n: +x[4], perk: true });
  /* (b) 장비 옵션 축(구 키): if(px.<key>&&pkk(p,<기저>*px.<key>))fire<종류>(p,<발수>); */
  for (const x of body.matchAll(/px\.(\w+)&&pkk\(p,\s*([\d.]+)\*px\.\1\)\s*\)?\s*(fire(?:Axe|Arrows|Bolts|Wave|Spear))\(p,\s*(\d+)\)/g))
    rows.push({ key: x[1], prob: +x[2], fn: x[3], n: +x[4], perk: false });
  /* (c) 무기고 — 5종 균등 추첨 */
  const ars = body.match(/px\.(\w+)&&pkk\(p,\s*([\d.]+)\*px\.\1\)\s*\)?\s*pick\(\[([^\]]*)\]\)\(p,\s*(\d+)\)/);
  if (ars) rows.push({ key: ars[1], prob: +ars[2], fn: 'arsenal', n: +ars[4], perk: false, pool: ars[3].split(',').map(s => s.trim()) });
  /* 미등록 검출: 본문의 소환 호출 총수와 위에서 잡은 수가 맞아야 한다 */
  const calls = [...body.matchAll(/\bfire(?:Axe|Arrows|Bolts|Wave|Spear)\b/g)].length;
  const seen = rows.filter(r => r.fn !== 'arsenal').length + (ars ? ars[3].split(',').length : 0);
  if (calls !== seen) fail(`${who}: procOnAttack 안의 소환 호출 ${calls}개 중 ${seen}개만 해석됐다 — 새 소환이 추가됐다면 이 게이트가 읽을 수 있는 형태로 쓰거나 게이트를 갱신할 것`);
  else pass(`${who}: 소환 호출 ${calls}개 전부 해석됨 (특전 ${rows.filter(r => r.perk).length}종 + 장비 ${rows.filter(r => !r.perk).length}종)`);
  return rows;
}
const rowsS = scanProc(SIM, 'sim.js');
const rowsH = scanProc(HTML, 'index.html');

/* ---------- ② 두 파일 대조 ---------- */
console.log('\n=== ② sim.js ↔ index.html 소환 확률·발수 대조 ===');
if (rowsS && rowsH) {
  const key = r => `${r.key}|${r.fn}|${r.prob}|${r.n}`;
  const a = rowsS.map(key).sort(), b = rowsH.map(key).sort();
  if (a.join('\n') === b.join('\n')) pass(`소환 ${a.length}건의 키·종류·확률·발수가 두 파일에서 완전히 같다`);
  else {
    const only = (x, y) => x.filter(v => !y.includes(v));
    fail(`두 파일 괴리 — sim 전용 [${only(a, b).join(' / ')}] · html 전용 [${only(b, a).join(' / ')}]`);
  }
  for (const r of rowsS.filter(r => r.perk)) console.log(`    ${r.key.padEnd(14)} ${pct(r.prob).padStart(5)} × ${r.n}발 → ${KIND[r.fn] || r.fn}`);
}

/* ---------- ③ 최악 조합 기대값 (분석) ---------- */
console.log(`\n=== ③ 최악 조합 기대값 — 모든 소환 + 모든 소환 개조 동시 보유 ===`);
let analytic = null;
if (rowsS && !bad) {
  /* 소환 개조가 «적중 수» 에 주는 배수 (전부 보유 가정).
     · 🪓🌪️ l_axeSpin  도끼 1발이 3번 타격 · 🪞 r_axeBounce 적중 후 다른 적 1번 추가
     · 🏹² r_arrowX2   화살 발수 2배 (🏹→🔱 l_arrowToSpear 은 종류만 바꾸고 수는 그대로)
     · 🔗👑 l_boltChainK 번개가 무조건 옆 적으로 1번 더 (🔗 r_boltChain 30% 는 이보다 약해 최악에서 가려진다) */
  const MUL = {
    fireAxe: (/l_axeSpin/.test(SIM) ? 3 : 1) + (/r_axeBounce/.test(SIM) ? 1 : 0),
    fireArrows: /r_arrowX2/.test(SIM) ? 2 : 1,
    fireBolts: /l_boltChainK/.test(SIM) ? 2 : 1,
    fireWave: 1,
    fireSpear: 1,
  };
  let sum = 0;
  for (const r of rowsS) {
    const m = r.fn === 'arsenal'
      ? Object.values(MUL).reduce((x, y) => x + y, 0) / 5      /* 5종 균등 추첨 → 배수 평균 */
      : MUL[r.fn];
    const t = r.prob * r.n * m;
    sum += t;
    console.log(`    ${(KIND[r.fn] || '무기고').padEnd(3)} ${r.key.padEnd(14)} ${pct(r.prob).padStart(5)} × ${r.n}발 × 개조 ×${m.toFixed(1)} = ${t.toFixed(3)}`);
  }
  analytic = sum;
  console.log(`    ＝ 기대값 B(분석) = ${analytic.toFixed(3)}`);
  analytic <= CAP + 1e-9
    ? pass(`분석 기대값 ${analytic.toFixed(3)} ≤ ${CAP} — 연쇄가 수렴한다 (총 소환 배수 ${(1 / (1 - analytic)).toFixed(2)}배)`)
    : note(`분석 기대값 ${analytic.toFixed(3)} > 주인 확정 임계 ${CAP} — **주인 확정 132종 자체가 임계와 충돌한다(판단 대기).** 아래 ④ 의 기준선 단언으로 회귀만 막는다`);
}

/* ---------- ④ 실행 단언 (몬테카를로) ---------- */
console.log('\n=== ④ 엔진 실측 — 소환 적중 1회가 낳는 신규 소환 수 ===');
if (rowsS && !bad) {
  const CUT = "const mode=process.argv[2]||'all';";
  const at = SIM.indexOf(CUT);
  if (at < 0) fail('sim.js 에서 CLI 디스패처를 못 찾았다 — 잘림 기준이 바뀌었다');
  else {
    const ctx = { console: { log() { } }, process, Math, JSON, Number, String, Array, Set, Map, Object, Date, parseInt, parseFloat, isFinite, isNaN, require };
    vm.createContext(ctx);
    vm.runInContext(SIM.slice(0, at) + '\n;globalThis.__S={summonHit,PROC_TICK_CAP,PERKS,basePx};', ctx);
    const X = ctx.__S || ctx.globalThis.__S;
    /* 최악 조합 = 132종 전부 보유. 적은 무한 체력 8마리(관통형이 줄에서 여러 번 맞도록). */
    const mk = () => {
      const es = [];
      for (let j = 0; j < 8; j++) es.push({ worldX: 100 + j * 40, hp: 1e15, maxHp: 1e15, dead: false, isBoss: false, wave: 0, stun: 0, slow: 0, ranged: false });
      const p = {
        worldX: 0, dmg: 100, px: X.basePx(), nextCrit: false, nextAtk: 0, missStk: 0, ward: 0, repairAmp: 0,
        atkN: 0, evStk: 0, evStreak2: 0, evStreak3: 0, nextX3: false, nextP200: false,
        comboT: null, comboN: 0, rampN: 0, lowShieldUsed: false,
        buffs: { atk: [], aspd: [], critR: [], critF: [], def: [], evade: [] },
        sh: 0, maxSh: 0, hp: 1e9, maxHp: 1e9, steal: 0, goldMul: 1, level: 1, exp: 0, healAmp: 0, killHeal: 0,
        critR: 0, critF: 150, def: 0, evade: 0, counter: 0, atkTimer: 1, aspd: 1, walkMul: 1, misfire: 0,
      };
      const G = {
        chapter: 1, player: p, nodes: [{ enemies: es }], pprojs: [], arrows: [], gold: 0, kills: 0, procN: 0,
        t: 0, taken: [], cleared: false, dead: false, perkChances: 0, autoBoltT: 2, autoSumT: 2, rampT: 3,
        overBoltCd: 0, atkTries: 0, miss: 0,
      };
      p.G = G;
      for (const k of X.PERKS) { k.ap(p); G.taken.push(k); }
      return { G, e: es[0] };
    };
    /* 한 번의 소환 적중이 «직접» 낳은 신규 소환 수. procN 을 상한-1 로 두면 바깥 summonHit 만
       트리거를 굴리고 손자 세대는 굴지 않는다(1세대 격리).
       신규 소환 = 투사체로 쌓인 것(pprojs) + 즉발 판정으로 끝난 것(번개 = dealDmg 횟수 −1(자기 타격)). */
    const N = 100000;
    let s = 0, ss = 0;
    for (let i = 0; i < N; i++) {
      const { G, e } = mk();
      G.procN = X.PROC_TICK_CAP - 1;
      X.summonHit(G, e, 0.75);
      const v = G.pprojs.length + G.atkTries - 1;
      s += v; ss += v * v;
    }
    const b1 = s / N, sd = Math.sqrt(Math.max(0, ss / N - b1 * b1)), se = sd / Math.sqrt(N);
    const tol = Math.max(0.05, 4 * se);
    console.log(`    실측(${N.toLocaleString('en-US')}회) B = ${b1.toFixed(3)}  (SE ${se.toFixed(4)})`);
    b1 <= BASE_B
      ? pass(`실측 ${b1.toFixed(3)} ≤ 등재 기준선 ${BASE_B} — 연쇄가 더 세지지 않았다`)
      : fail(`실측 ${b1.toFixed(3)} > 등재 기준선 ${BASE_B} — 소환 연쇄가 더 세졌다. 확률·발수를 올렸다면 되돌리고, 주인이 승인한 상향이면 BASE_B 를 갱신할 것`);
    if (analytic !== null) {
      const d = Math.abs(b1 - analytic);
      d <= tol
        ? pass(`분석 ${analytic.toFixed(3)} ≈ 실측 ${b1.toFixed(3)} (차 ${d.toFixed(3)} ≤ 허용 ${tol.toFixed(3)})`)
        : note(`분석 ${analytic.toFixed(3)} vs 실측 ${b1.toFixed(3)} (차 ${d.toFixed(3)}) — 관통·랜덤 타겟 부재 등 전장 조건 차이. 단언은 실측 쪽이 정본이다`);
    }
    if (b1 > CAP) note(`실측도 주인 확정 임계 ${CAP} 를 넘는다 (${b1.toFixed(3)}) — PROGRESS «주인 승인 대기» 항목 참조`);
  }
}

/* ---------- ⑤ ⚑⚑⚑ T119 처치 축 연쇄 (주인 확정 2026-09-04 13:0X) ----------
   T96~T118 의 소환 3종은 트리거가 «피격/회피/반격» 이라 소환 적중이 새 소환을 낳지 않았다(공격 축 B = 0).
   T119 가 «처치 시 창/번개/화살/도끼» 를 넣으면서 **처치 축 연쇄**가 새로 생겼다:
   소환이 적을 죽이면 그 처치가 다시 소환을 낳는다. 주인 지시가 «이 풀로 B 를 다시 계산해
   넘으면 값을 임의로 깎지 말고 주인 승인 대기에 등재» 라 여기서 재고 판정은 기준선으로만 한다.

   재는 것 셋:
     ⓐ 처치 1회가 낳는 소환 수 (분석 = 창1 + 화살3 + 도끼2 + 번개(웨이브 생존 수) · 실측)
     ⓑ B_kill = 그 소환들이 낳는 «신규 처치» 기대값 — 최악 조건(적 체력 1 = 어떤 소환도 즉사)에서 잰다
     ⓒ 구조적 유한성 — 번개 대상이 «죽은 적이 속한 웨이브» 로 묶여 있고 한 적은 한 번만 죽으므로
        연쇄는 한 웨이브(최대 10마리) 안에서 끝난다. 이 성질이 깨지면(대상이 frontNode 로 되돌아가면)
        연쇄가 대기 웨이브를 지나 보스까지 즉사시킨다 — T119 가 실측으로 잡은 회귀다. */
console.log('\n=== ⑤ ⚑ T119 처치 축 연쇄 (처치 시 소환 4종) ===');
{
  const CUT2 = "const mode=process.argv[2]||'all';";
  const at2 = SIM.indexOf(CUT2);
  const ctx = { console: { log() { } }, process, Math, JSON, Number, String, Array, Set, Map, Object, Date, parseInt, parseFloat, isFinite, isNaN, require };
  vm.createContext(ctx);
  vm.runInContext(SIM.slice(0, at2) + '\n;globalThis.__K={onKill,PERKS,basePx,PROC_TICK_CAP,PERK_KILL_L};', ctx);
  const K = ctx.__K || ctx.globalThis.__K;
  /* ⓒ 구조적 단언 먼저 — 번개 대상이 «죽은 적의 웨이브» 인가 (두 파일) */
  const boundS = /fireBoltsAll\(p,e\.wave\)/.test(SIM) && /function fireBoltsAll\(p,node\)/.test(SIM);
  const boundH = /fireBoltsAll\(p,e\.wave\)/.test(HTML) && /function fireBoltsAll\(p,node\)/.test(HTML);
  (boundS && boundH)
    ? pass('ⓒ 처치 시 번개의 대상이 «죽은 적이 속한 웨이브» 로 묶여 있다 — 연쇄가 대기 웨이브·보스로 못 넘어간다')
    : fail(`ⓒ 처치 시 번개가 웨이브에 안 묶여 있다(sim ${boundS} / game ${boundH}) — frontNode 로 되돌아가면 연쇄가 챕터를 통째로 즉사시킨다`);
  /* ⓐ·ⓑ 실측 — 웨이브 하나(10마리)를 만들고 그 안의 한 마리를 «죽은 것» 으로 놓고 onKill 을 부른다 */
  const WAVE = 10;
  const mkG = hp => {
    const nd = { type: 'wave', x: 0, done: false, enemies: [] };
    for (let j = 0; j < WAVE; j++) nd.enemies.push({ worldX: 100 + j * 40, hp, maxHp: hp, dmg: 1, ranged: false, atkTimer: 1, stun: 0, slow: 0, wave: nd, dead: false, isBoss: false, exp: 0 });
    const p = {
      worldX: 0, dmg: 1e9, aspd: 1, critR: 0, critF: 150, def: 0, counter: 0, evade: 0, steal: 0, killHeal: 0,
      misfire: 0, goldMul: 1, walkMul: 1, healAmp: 0, repairAmp: 0, nextCrit: false, nextAtk: 0, ward: 0,
      maxHp: 1e9, hp: 1e9, maxSh: 0, sh: 0, level: 1, exp: 0,
      buffs: { atk: [], aspd: [], critR: [], critF: [], def: [], evade: [] }, px: K.basePx(),
    };
    const G = { chapter: 1, player: p, nodes: [nd], pprojs: [], arrows: [], gold: 0, kills: 0, procN: 0,
      perkChances: 0, taken: [], overBoltCd: 0, autoBoltT: 3, stuns: 0, misses: 0, dead: false, cleared: false,
      t: 0, atkTries: 0, miss: 0, noPerk: false };
    p.G = G;
    for (const k of K.PERKS) { k.ap(p); G.taken.push(k); }
    return { G, nd };
  };
  /* ⓐ 1세대 격리 — procN 을 상한-1 로 두면 바깥 처치만 트리거를 굴린다 */
  {
    const N = 20000; let s = 0;
    for (let i = 0; i < N; i++) {
      const { G, nd } = mkG(1e15);
      const e = nd.enemies[0]; e.hp = 0;
      G.procN = K.PROC_TICK_CAP - 1;
      const before = G.pprojs.length, tries = G.atkTries;
      K.onKill(G, e, 0);
      s += (G.pprojs.length - before) + (G.atkTries - tries);   /* 투사체 + 즉발(번개) */
    }
    const b = s / N;
    const want = 1 + 3 + 2 + (WAVE - 1);   /* 창1 + 화살3 + 도끼2 + 번개(같은 웨이브 생존 9) · 전부 100% */
    console.log(`    ⓐ 처치 1회가 낳는 소환 수 = ${b.toFixed(3)} (분석 ${want} = 창1 + 화살3 + 도끼2 + 번개${WAVE - 1})`);
    Math.abs(b - want) <= 0.5
      ? pass(`ⓐ 실측 ${b.toFixed(2)} ≈ 분석 ${want} — 처치 시 소환 4종이 전부 확정 발동으로 걸린다(전설판 보유)`)
      : fail(`ⓐ 실측 ${b.toFixed(2)} 가 분석 ${want} 와 다르다 — 처치 시 소환의 발수·확률·대상 범위를 확인할 것`);
  }
  /* ⓑ B_kill — 최악(적 체력 1)에서 «한 처치가 낳는 신규 처치» 수. 트리거 예산을 풀고 한 웨이브를 끝까지 굴린다. */
  {
    const N = 4000; let s = 0;
    for (let i = 0; i < N; i++) {
      const { G, nd } = mkG(1);
      const e = nd.enemies[0]; e.hp = 0;
      K.onKill(G, e, 0);
      s += G.kills - 1;   /* 자기 자신(바깥 처치)을 뺀 신규 처치 */
    }
    const bk = s / N;
    console.log(`    ⓑ B_kill(최악 · 적 체력 1) = ${bk.toFixed(3)} — 한 처치가 낳는 신규 처치 수`);
    bk <= WAVE - 1 + 1e-9
      ? pass(`ⓑ 연쇄가 한 웨이브 안에서 끝난다 (신규 처치 ${bk.toFixed(2)} ≤ 웨이브 잔여 ${WAVE - 1}) — 한 적은 한 번만 죽으므로 구조적으로 유한하다`)
      : fail(`ⓑ 신규 처치 ${bk.toFixed(2)} 가 웨이브 잔여 ${WAVE - 1} 를 넘는다 — 연쇄가 웨이브를 넘어갔다(대상 범위 회귀)`);
    bk > CAP
      ? note(`ⓑ B_kill ${bk.toFixed(3)} > 주인 확정 임계 ${CAP} — **주인이 직접 정한 확률(33/66/100)·발수라 워커가 깎지 않는다.** ` +
             `PROGRESS «주인 승인 대기» 에 등재했다. 공격 축과 달리 이 축은 «한 적은 한 번만 죽는다» 로 구조적으로 유한해 발산하지 않는다(위 ⓑ 단언)`)
      : pass(`ⓑ B_kill ${bk.toFixed(3)} ≤ 주인 확정 임계 ${CAP}`);
  }
}

/* ---------- ⑥ ⚑⚑⚑ T121 3차 치명 축 연쇄 (주인 확정 2026-09-04 17:5X · 18:4X) ----------
   «치명 시 창»(희귀 33% · 전설 66%)·«치명 시 번개»(전설 66%)가 «치명타 시» 축에 **소환을 처음** 붙였다.
   소환 적중도 «공격» 이라(주인 15:3X · T45) 소환 → 치명타 → 새 소환이 자기를 다시 부른다. 번개는 즉발이라
   한 호출 안에서 재귀하므로, 두 엔진 모두 이 셋을 **소환 적중 트리거와 같은 틱 예산**(PROC_TICK_CAP)으로
   묶어 재귀를 끊는다(주인 명시 허용 성능 가드 · 데미지는 그대로).
   주인 지시대로 여기서는 **재기만 하고 확률·발수는 깎지 않는다** — 임계를 넘으면 승인 대기에 등재한다.
   ⚑ 최악 조합은 «광전사 빼고 전부» 다 — 광전사는 치확을 0 으로 고정해 이 축을 통째로 죽이기 때문에
     «전부 보유» 로 재면 B_crit = 0 이 나와 검사가 조용히 죽는다. */
console.log('\n=== ⑥ ⚑ T121 3차 치명 축 연쇄 (치명 시 창·번개) ===');
{
  const CAP_CRIT = 0.8;        /* 주인 확정 임계 (표시만 — ③④ 와 같은 규약) */
  const BASE_B_CRIT = 8.0;     /* 등재 기준선 — 아래 실측(웨이브 10마리)을 올림한 값. 이 위로 가면 불합격 */
  const WAVE = 10;
  const CUT3 = "const mode=process.argv[2]||'all';";
  const at3 = SIM.indexOf(CUT3);
  const ctx = { console: { log() { } }, process, Math, JSON, Number, String, Array, Set, Map, Object, Date, parseInt, parseFloat, isFinite, isNaN, require };
  vm.createContext(ctx);
  vm.runInContext(SIM.slice(0, at3) + '\n;globalThis.__C={summonHit,PERKS,basePx,PROC_TICK_CAP,PERK_CRITSP_R,PERK_CRITSP_L,PERK_CRITBOLT_L,ENEMY_EVADE};', ctx);
  const C = ctx.__C || ctx.globalThis.__C;
  /* 두 엔진이 같은 가드·같은 확률을 쓰는가 (정적) */
  const guard = /if\(\(px\.p_critSpearR\|\|px\.p_critSpearL\|\|px\.p_critBoltL\)&&G\.procN<PROC_TICK_CAP\)/;
  (guard.test(SIM.replace(/\s+/g, '')) || guard.test(SIM)) && (guard.test(HTML.replace(/\s+/g, '')) || guard.test(HTML))
    ? pass('두 엔진의 치명 축 소환이 같은 틱 예산(PROC_TICK_CAP) 가드 안에 있다 — 즉발 번개의 무한 재귀 차단')
    : fail('치명 축 소환이 틱 예산 가드 밖에 있다 — 번개가 자기를 무한히 다시 부른다(스택 폭주)');
  const mk = () => {
    const nd = { type: 'wave', x: 0, done: false, enemies: [] };
    for (let j = 0; j < WAVE; j++) nd.enemies.push({ worldX: 100 + j * 40, hp: 1e15, maxHp: 1e15, dmg: 1, ranged: false, atkTimer: 1, stun: 0, slow: 0, wave: nd, dead: false, isBoss: false, exp: 0 });
    const p = {
      worldX: 0, dmg: 100, aspd: 1, critR: 0, critF: 150, def: 0, counter: 0, evade: 0, steal: 0, killHeal: 0,
      misfire: 0, goldMul: 1, walkMul: 1, healAmp: 0, repairAmp: 0, nextCrit: false, nextAtk: 0, ward: 0,
      maxHp: 1e9, hp: 1e9, maxSh: 0, sh: 0, level: 1, exp: 0, critStk: 0, nhit: {}, collHpF: 1,
      sureCrit: false, bsStk: 0, dash: false,
      buffs: { atk: [], aspd: [], critR: [], critF: [], def: [], evade: [] }, px: C.basePx(),
    };
    const G = { chapter: 1, player: p, nodes: [nd], pprojs: [], arrows: [], gold: 0, kills: 0, procN: 0,
      perkChances: 0, taken: [], overBoltCd: 0, autoBoltT: 3, autoSumT: 2, rampT: 3, stuns: 0, misses: 0,
      dead: false, cleared: false, t: 0, atkTries: 0, miss: 0, noPerk: false };
    p.G = G;
    for (const k of C.PERKS) { if (k.id === 'p_berserk') continue; k.ap(p); G.taken.push(k); }   /* 광전사만 뺀다 */
    return { G, e: nd.enemies[0] };
  };
  const N = 20000; let s2 = 0;
  for (let i = 0; i < N; i++) {
    const { G, e } = mk();
    G.procN = C.PROC_TICK_CAP - 1;      /* 1세대 격리 — 바깥 적중의 치명 소환만 굴고 손자 세대는 예산에서 막힌다 */
    C.summonHit(G, e, 0.75);
    s2 += G.pprojs.length + (G.atkTries - 1);
  }
  const bc = s2 / N;
  const pHit = 1 - C.ENEMY_EVADE;
  const want = pHit * (C.PERK_CRITSP_R + C.PERK_CRITSP_L + C.PERK_CRITBOLT_L * WAVE);   /* 치확은 이 조합에서 100% */
  console.log(`    분석 B_crit ≈ ${want.toFixed(3)} = 적중 ${pct(pHit)} × (창 ${C.PERK_CRITSP_R} + 창 ${C.PERK_CRITSP_L} + 번개 ${C.PERK_CRITBOLT_L}×${WAVE})`);
  console.log(`    실측(${N.toLocaleString('en-US')}회 · 웨이브 ${WAVE}마리) B_crit = ${bc.toFixed(3)}`);
  bc <= BASE_B_CRIT
    ? pass(`실측 ${bc.toFixed(3)} ≤ 등재 기준선 ${BASE_B_CRIT} — 치명 축 연쇄가 더 세지지 않았다`)
    : fail(`실측 ${bc.toFixed(3)} > 등재 기준선 ${BASE_B_CRIT} — 치명 축이 더 세졌다. 확률·발수를 올렸다면 되돌리고, 주인이 승인한 상향이면 BASE_B_CRIT 를 갱신할 것`);
  Math.abs(bc - want) <= Math.max(0.5, want * 0.15)
    ? pass(`분석 ${want.toFixed(3)} ≈ 실측 ${bc.toFixed(3)} — 확률·대상 수가 확정표대로다`)
    : note(`분석 ${want.toFixed(3)} vs 실측 ${bc.toFixed(3)} — 전장 조건 차이(관통·랜덤 타겟). 단언은 실측 쪽이 정본이다`);
  bc > CAP_CRIT
    ? note(`B_crit ${bc.toFixed(3)} > 주인 확정 임계 ${CAP_CRIT} — **주인이 직접 정한 33/66 확률이라 워커가 깎지 않는다.** ` +
           `처치 축(⑤)과 달리 이 축은 «한 적은 한 번만 죽는다» 같은 구조적 유한성이 없어 B > 1 이면 발산한다 — ` +
           `지금은 두 엔진의 틱 예산 가드(PROC_TICK_CAP)가 한 프레임당 트리거 수를 끊는 것이 유일한 수렴 장치다. PROGRESS «주인 승인 대기» 참조`)
    : pass(`B_crit ${bc.toFixed(3)} ≤ 주인 확정 임계 ${CAP_CRIT}`);
}

console.log(`\n결과: ${okN} 통과 · ${bad} 실패`);
process.exit(bad ? 1 : 0);
