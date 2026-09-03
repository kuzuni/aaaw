/* T88 1단계 — 🃏 수집가 4종 «보유 특전 1개당 +2%» 실효치 게이트 (주인 지시 ③·④)
 *
 * 사용: node tools/verifyCollector.js        (exit 0 = 통과, 1 = 불합격)
 *
 * ── 왜 이 게이트가 생겼나 ──────────────────────────────────────────────────
 * 주인 버그 보고: «🃏🔁 보유 특전 1개당 반격 확률 +2% 가 배포 빌드에서 적용 안 되는 느낌».
 * 실측해 보니 **엔진은 멀쩡했다** — `effCounter` 는 특전 수만큼 정확히 올라가고 반격 굴림도
 * 그 값을 읽는다. 거짓말을 한 것은 HUD 였다: 스탯 그리드 7행 중 «반격 확률» 한 행만
 * 실효치(`effCounter(p)`)가 아니라 기본치(`p.counter`)를 찍고 있어, 특전을 아무리 쌓아도
 * 화면 숫자가 20.0% 에 얼어 있었다(회피·방어력 행은 같은 축인데 실효치라 정상으로 보였다).
 *
 * 그래서 이 게이트는 **두 축을 같이** 본다:
 *   ㉠ 엔진 수치가 «기본 + 2N» 인가 (두 엔진 실행 단언 · 서로 같은 값인가)
 *   ㉡ 그 실효치가 **굴림 자리와 HUD 에 실제로 닿는가** — 어느 한쪽이 기본치를 직독하면 빨강.
 * ㉡ 이 없으면 이번 버그는 게이트를 통과한다(엔진은 초록이었으니까).
 *
 * 자가검사: 소스 문자열을 메모리에서만 망가뜨린 사본으로 같은 판정을 다시 돌려,
 * «망가뜨렸는데도 초록» 이 나오면 그 자체를 실패로 친다. 원본 파일은 건드리지 않는다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SIM_SRC = fs.readFileSync(path.join(ROOT, 'sim.js'), 'utf8');
const HTML_SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* 수집가 4종 — id · 실효치 함수 · «기본치에 어떻게 얹히는가» */
const COLL = [
  { id: 'c_collAtk', ic: '🃏⚔️', fn: 'effDmg', stat: '공격력', kind: 'mul', cap: Infinity },
  { id: 'c_collEvade', ic: '🃏💨', fn: 'effEvade', stat: '회피', kind: 'add', cap: 90 },
  { id: 'c_collCounter', ic: '🃏🔁', fn: 'effCounter', stat: '반격 확률', kind: 'add', cap: Infinity },
  { id: 'c_collDef', ic: '🃏🛡️', fn: 'effDef', stat: '방어력', kind: 'add', cap: 80 },
];
const NS = [0, 1, 2, 3, 5, 10, 20, 44];   /* 44 = 일반 등급 전량 보유(중복 금지라 그 이상은 등급 섞임) */
const STEP = 2;                            /* 주인 확정 문면 «1개당 +2%» */

/* ══════════ 소스 도구 ══════════ */

/* `sig` 로 시작하는 정의 한 덩어리를 통째로 떼어 온다 (괄호 짝맞춤).
   `oc` = 여는 괄호 — 함수는 `{`, 배열 리터럴(STAT_DEFS)은 `[` 로 잡아야 첫 행만 떼어 오지 않는다. */
function grabBlock(src, sig, oc) {
  oc = oc || '{';
  const cc = oc === '[' ? ']' : '}';
  const at = src.indexOf(sig);
  if (at < 0) return null;
  const open = src.indexOf(oc, at);
  if (open < 0) return null;
  let d = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === oc) d++;
    else if (src[i] === cc) { d--; if (!d) return src.slice(at, i + 1); }
  }
  return null;
}
/* sim.js 는 `const effDmg=p=>{…};` 꼴이라 세미콜론까지 붙여 준다. */
const grabConst = (src, name) => {
  const b = grabBlock(src, 'const ' + name + '=');
  return b ? b + ';' : null;
};

/* ══════════ 판정 본체 — 소스 문자열만 받는다(자가검사가 같은 함수를 재사용한다) ══════════ */
function audit(SIM, HTML) {
  const F = [];                                   /* 위반 목록 */
  const P = [];                                   /* 통과 목록 */
  const bad = m => F.push(m);
  const ok = m => P.push(m);

  /* ── ① sim.js 실행 단언 ── */
  let simEff = null;
  {
    const CUT = "const mode=process.argv[2]||'all';";
    const at = SIM.indexOf(CUT);
    if (at < 0) bad('sim.js 에서 CLI 디스패처를 못 찾았다 — 잘림 기준이 바뀌었다');
    else {
      const ctx = { console: { log() { } }, process, Math, JSON, Number, String, Array, Set, Map, Object, Date, parseInt, parseFloat, isFinite, isNaN, require };
      vm.createContext(ctx);
      try {
        vm.runInContext(SIM.slice(0, at) + '\n;globalThis.__C={effDmg,effDef,effEvade,effCounter,perkN};', ctx);
        simEff = ctx.__C || ctx.globalThis.__C;
      } catch (e) { bad('sim.js vm 실행 실패 — ' + e.message); }
    }
  }

  /* ── ② index.html 실행 단언 — 게임 소스의 그 함수들을 그대로 떼어 돌린다 ── */
  let htmlEff = null;
  {
    const parts = ['function perkN()', 'function effDmg(p)', 'function effDef(p)', 'function effEvade(p)', 'function effCounter(p)']
      .map(sig => ({ sig, code: grabBlock(HTML, sig) }));
    const miss = parts.filter(x => !x.code).map(x => x.sig);
    if (miss.length) bad(`index.html 에서 «${miss.join(' · ')}» 를 못 떼어 왔다 — 정의 꼴이 바뀌었다`);
    else {
      const ctx = { Math, G: null, bsum: () => 0 };
      vm.createContext(ctx);
      try {
        vm.runInContext(parts.map(x => x.code).join('\n') +
          '\n;globalThis.__C={effDmg,effDef,effEvade,effCounter,perkN};', ctx);
        htmlEff = ctx.__C || ctx.globalThis.__C;
        htmlEff.__ctx = ctx;
      } catch (e) { bad('index.html eff* 조각 vm 실행 실패 — ' + e.message); }
    }
  }

  /* 기본치 — 캡(방어 80·회피 90)에 걸리는 구간까지 일부러 지난다 */
  const BASE = { dmg: 100, def: 20, evade: 20, counter: 20 };
  const expect = (c, n) => c.kind === 'mul'
    ? BASE.dmg * (1 + 0.01 * STEP * n)
    : Math.min(c.cap, (c.id === 'c_collDef' ? BASE.def : c.id === 'c_collEvade' ? BASE.evade : BASE.counter) + STEP * n);

  const mkSim = (px, n) => {
    const p = {
      dmg: BASE.dmg, def: BASE.def, evade: BASE.evade, counter: BASE.counter, critR: 20, critF: 150,
      aspd: 1, hp: 100, maxHp: 100, sh: 0, maxSh: 0, px,
      buffs: { atk: [], aspd: [], critR: [], critF: [], def: [], evade: [] },
    };
    p.G = { taken: Array.from({ length: n }, (_, i) => ({ id: 'f' + i })) };
    return p;
  };
  const mkHtml = (px, n) => {
    htmlEff.__ctx.G = { perksTaken: Array.from({ length: n }, (_, i) => ({ id: 'f' + i })) };
    return { dmg: BASE.dmg, def: BASE.def, evade: BASE.evade, counter: BASE.counter, sh: 0, maxSh: 0, hp: 100, maxHp: 100, px };
  };
  const near = (a, b) => Math.abs(a - b) < 1e-9;

  for (const c of COLL) {
    if (!simEff || !htmlEff) break;
    let sBad = 0, hBad = 0, xBad = 0, nBad = 0;
    for (const n of NS) {
      const want = expect(c, n);
      const s = simEff[c.fn](mkSim({ [c.id]: 1 }, n));
      const h = htmlEff[c.fn](mkHtml({ [c.id]: 1 }, n));
      if (!near(s, want)) { sBad++; if (sBad === 1) bad(`${c.ic} ${c.id} — sim.js: 특전 ${n}개 보유 시 ${c.stat} 실효치 ${s} (기대 ${want})`); }
      if (!near(h, want)) { hBad++; if (hBad === 1) bad(`${c.ic} ${c.id} — index.html: 특전 ${n}개 보유 시 ${c.stat} 실효치 ${h} (기대 ${want})`); }
      if (!near(s, h)) { xBad++; if (xBad === 1) bad(`${c.ic} ${c.id} — 두 엔진 괴리: 특전 ${n}개에서 sim ${s} ≠ 게임 ${h}`); }
      /* 음성 대조 — 그 수집가를 안 들었으면 특전 수가 늘어도 불변이어야 한다 */
      const s0 = simEff[c.fn](mkSim({}, n)), h0 = htmlEff[c.fn](mkHtml({}, n));
      const base0 = c.kind === 'mul' ? BASE.dmg : expect(c, 0);
      if (!near(s0, base0) || !near(h0, base0)) { nBad++; if (nBad === 1) bad(`${c.ic} ${c.id} — 미보유인데 특전 ${n}개에서 ${c.stat} 가 움직였다 (sim ${s0} · 게임 ${h0})`); }
    }
    if (!sBad && !hBad && !xBad && !nBad)
      ok(`${c.ic} ${c.id} — ${c.stat} 실효치 = 기본 + ${STEP}N (두 엔진 ${NS.length}점 일치 · 미보유 시 불변)`);
  }

  /* ── ③ 실효치가 «굴림 자리» 에 닿는가 (두 엔진) ── */
  /* 여기서 기본치를 직독하면 특전은 계산만 되고 게임엔 아무 영향이 없다. */
  const ROLL = [
    { tag: '반격 굴림', re: /Math\.random\(\)\*100<effCounter\(p\)/, wrong: /Math\.random\(\)\*100<p\.counter\b/ },
    { tag: '회피 굴림', re: /Math\.random\(\)\*100<effEvade\(p\)/, wrong: /Math\.random\(\)\*100<p\.evade\b/ },
    { tag: '방어 감쇄', re: /\(1-effDef\(p\)\/100\)/, wrong: /\(1-p\.def\/100\)/ },
    { tag: '피해 계산', re: /let d=effDmg\(p\)\*ratio/, wrong: /let d=p\.dmg\*ratio/ },
  ];
  for (const [name, src] of [['sim.js', SIM], ['index.html', HTML]]) {
    for (const r of ROLL) {
      const n = (src.match(new RegExp(r.re.source, 'g')) || []).length;
      if (n < 1) bad(`${name} — «${r.tag}» 이 실효치를 안 읽는다 (${r.re.source} 0곳)`);
      else if (r.wrong.test(src)) bad(`${name} — «${r.tag}» 에 기본치 직독이 되살아났다 (${r.wrong.source})`);
      else ok(`${name} «${r.tag}» — 실효치를 읽는다 (${n}곳)`);
    }
  }

  /* ── ④ HUD 스탯 그리드가 실효치를 보여주는가 (주인 지시 ④ · 이번 버그의 정체) ── */
  {
    const grid = grabBlock(HTML, 'const STAT_DEFS=', '[');
    if (!grid) bad('index.html STAT_DEFS 를 못 찾았다 — HUD 정의 꼴이 바뀌었다');
    else {
      /* 한 행 = `{k:'counter',lb:'…', v:p=>…, cur:p=>…, base:()=>…}` */
      const rows = [...grid.matchAll(/\{k:'(\w+)',[^}]*?v:p=>([^,]+),\s*cur:p=>([^,]+),/g)]
        .map(m => ({ k: m[1], v: m[2].trim(), cur: m[3].trim() }));
      const NEED = { dmg: 'effDmg', def: 'effDef', aspd: 'effAspd', counter: 'effCounter', critR: 'effCritR', evade: 'effEvade', critF: 'effCritF' };
      const keys = Object.keys(NEED);
      if (rows.length !== keys.length) bad(`HUD 스탯 행 ${rows.length}개 — ${keys.length}개여야 한다 (행이 늘거나 줄면 이 검사를 갱신할 것)`);
      let hudBad = 0;
      for (const k of keys) {
        const row = rows.find(r => r.k === k);
        if (!row) { bad(`HUD 스탯 그리드에 «${k}» 행이 없다`); hudBad++; continue; }
        for (const [w, expr] of [['표시값 v', row.v], ['강조 기준 cur', row.cur]]) {
          if (!expr.includes(NEED[k] + '(p)')) {
            bad(`HUD «${k}» 행의 ${w} 가 실효치를 안 읽는다 — «${expr}» (${NEED[k]}(p) 여야 한다)`); hudBad++;
          }
        }
      }
      if (!hudBad) ok(`HUD 스탯 그리드 ${keys.length}행 전부 표시값·강조 기준이 실효치(eff*) — 특전·버프가 화면에 그대로 뜬다`);
    }
  }

  /* ── ⑤ 계수 문면 대조 — 표시 텍스트의 «+2%» ↔ 엔진 계수 (두 엔진) ── */
  for (const c of COLL) {
    const tx = HTML.match(new RegExp(`\\{id:'${c.id}'[^}]*tx:'([^']*)'`));
    if (!tx) { bad(`index.html 에서 ${c.id} 의 표시 텍스트를 못 찾았다`); continue; }
    const num = tx[1].replace(/<[^>]+>/g, '').match(/1개당[^+]*\+(\d+)%/);
    if (!num) { bad(`${c.ic} ${c.id} 표시 텍스트가 «1개당 … +N%» 꼴이 아니다 — «${tx[1].replace(/<[^>]+>/g, '')}»`); continue; }
    if (+num[1] !== STEP) bad(`${c.ic} ${c.id} — 표시 텍스트는 +${num[1]}% 인데 엔진 계수는 ${STEP} 이다`);
    else ok(`${c.ic} ${c.id} — 표시 텍스트 «1개당 +${STEP}%» 가 실측 증분과 일치`);
  }

  return { F, P };
}

/* ══════════ 실행 ══════════ */
console.log('[T88] 🃏 수집가 4종 실효치 게이트\n');
const main = audit(SIM_SRC, HTML_SRC);
main.P.forEach(m => console.log('  ✓ ' + m));
main.F.forEach(m => console.log('  ✗ ' + m));

/* ── 자가검사 — 망가뜨린 사본에서 반드시 빨개져야 한다 ── */
console.log('\n[자가검사 — 소스를 망가뜨리면 이 게이트가 잡는가]');
const SELF = [
  ['HUD 반격 행을 기본치 직독으로 되돌린다 (이번 버그 그 자체)', 'html',
    'v:p=>effCounter(p).toFixed(1)+\'%\', cur:p=>effCounter(p)', 'v:p=>p.counter.toFixed(1)+\'%\', cur:p=>p.counter'],
  ['HUD 회피 행을 기본치 직독으로 바꾼다', 'html',
    "v:p=>effEvade(p).toFixed(1)+'%',cur:p=>effEvade(p)", "v:p=>p.evade.toFixed(1)+'%',cur:p=>p.evade"],
  ['게임 effCounter 에서 수집가 항을 뺀다', 'html',
    'return p.counter+(p.px.c_collCounter?2*perkN():0);', 'return p.counter;'],
  ['게임 반격 굴림이 기본치를 읽게 한다', 'html',
    'const cc=Math.random()*100<effCounter(p);', 'const cc=Math.random()*100<p.counter;'],
  ['게임 계수를 2 → 1 로 내린다 (텍스트는 +2% 그대로)', 'html',
    'if(px.c_collEvade) e+=2*perkN();', 'if(px.c_collEvade) e+=1*perkN();'],
  ['sim 수집가가 획득 시점 1회 계산으로 굳는다 (perkN 을 0 으로)', 'sim',
    'const perkN=p=>(p.G&&p.G.taken?p.G.taken.length:0);', 'const perkN=p=>0;'],
  ['sim effDmg 에서 수집가 항을 뺀다', 'sim',
    'if(px.c_collAtk)m*=1+0.02*perkN(p);', 'if(px.c_collAtk)m*=1;'],
  ['sim 방어 감쇄가 기본치를 읽게 한다', 'sim',
    'let d=nulled?0:dmg*(1-effDef(p)/100);', 'let d=nulled?0:dmg*(1-p.def/100);'],
];
let selfFail = 0;
for (const [name, which, from, to] of SELF) {
  const src = which === 'sim' ? SIM_SRC : HTML_SRC;
  const n = src.split(from).length - 1;
  if (n !== 1) { console.log(`  ✗ ${name} — 원문이 소스에 ${n}번 나온다 (1번이어야 한다)`); selfFail++; continue; }
  const r = which === 'sim' ? audit(src.replace(from, to), HTML_SRC) : audit(SIM_SRC, src.replace(from, to));
  if (r.F.length) console.log(`  ✓ ${name} → 위반 ${r.F.length}건으로 잡힌다`);
  else { console.log(`  ✗ ${name} → 망가뜨렸는데도 초록이다 (게이트가 이 축을 안 본다)`); selfFail++; }
}

const total = main.F.length + selfFail;
console.log(`\n통과 ${main.P.length}항목 · 자가검사 ${SELF.length - selfFail}/${SELF.length} · 위반 ${total}`);
process.exit(total ? 1 : 0);
