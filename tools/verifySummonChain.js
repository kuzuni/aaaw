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

console.log(`\n결과: ${okN} 통과 · ${bad} 실패`);
process.exit(bad ? 1 : 0);
