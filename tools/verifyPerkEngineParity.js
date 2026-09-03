#!/usr/bin/env node
/* tools/verifyPerkEngineParity.js — 특전 132종의 **엔진 상수**가 두 파일에서 같은가 (P3 R04 신설)
 *
 * 왜 있나. 이 레포에서 가장 자주 재발한 결함 계열이 «설명문 ↔ 엔진 상수 불일치» 다(T8·T9·T11·T12 → T17 이
 * 장비 옵션 축에 게이트를 세웠다). 그런데 **특전의 두 엔진(sim.js ↔ index.html) 사이**에는 그 게이트가 없었고,
 * P3 R04 가 착수 시점에 전수 대조해 보니 **살아 있는 괴리가 6건** 있었다 — 전부 직전 회차(R03)가 희귀 14종을
 * 튜닝하면서 `sim.js` 와 표시 텍스트만 고치고 `index.html` 의 **엔진 상수**를 빠뜨린 것이다:
 *
 *   💥 r_critRBuff  게임 40%/치확+10 ↔ 텍스트·sim 70%/+20     🔥 r_critFBuff  게임 30%/치배+20 ↔ 60%/+40
 *   ⚜️ r_counterX   게임 ×2(+100%)   ↔ 텍스트·sim ×2.5(+150%)  🛡️❤️ r_wardHeal 게임 체력 5% ↔ 10%
 *   ⛓️ r_stunSlow   게임 3초         ↔ 텍스트·sim 6초          💃 r_evade3Dmg  게임 +200% ↔ +300%
 *
 * 즉 **배포된 게임이 자기 특전 설명과 다르게 동작하고 있었고, 밸런스 회차가 잰 sim 수치와도 달랐다.**
 * 기존 게이트가 왜 못 잡았나: `verifyPerkFireHtml` 은 «발동하는가» 만 보고(값은 안 본다),
 * `verifyT2`·`verifyCombatConst` 의 두 엔진 대조는 **손으로 고른 몇 항목**뿐이라 새로 튜닝한 특전은 사각이다.
 *
 * 이 게이트는 항목을 손으로 고르지 않는다 — **132종 전부**에 대해
 *   ① `sim.js` 에서 그 특전이 실제로 쓰이는 자리(정의부의 `ap` + `px.<id>` 를 참조하는 모든 줄)
 *   ② `index.html` 에서 같은 자리
 * 를 떠서, 주석·문자열·연출 호출을 걷어낸 뒤 **남은 숫자 리터럴의 다중집합**을 비교한다.
 * 값만 보므로 «두 엔진의 코드 모양이 달라도» 통과하고, 한쪽 숫자만 바뀌면 반드시 빨개진다.
 *
 * 실행: node tools/verifyPerkEngineParity.js   (불일치 있으면 exit 1)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SIM = fs.readFileSync(path.join(ROOT, 'sim.js'), 'utf8');
const HTM = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* ---------- 공통 전처리 ---------- */
/* 블록 주석은 여러 줄에 걸치므로 «줄 단위 정규식» 으로는 못 지운다 — 상태를 들고 지운다.
   (실제로 프로토타입이 이걸 안 해서 sim.js 의 설명 주석에 있던 «+100%» 를 엔진 상수로 착각했다) */
function stripComments(src) {
  const out = [];
  let inBlock = false;
  for (const raw of src.split('\n')) {
    let line = '', i = 0;
    while (i < raw.length) {
      if (inBlock) {
        const e = raw.indexOf('*/', i);
        if (e < 0) { i = raw.length; } else { inBlock = false; i = e + 2; }
        continue;
      }
      const b = raw.indexOf('/*', i), l = raw.indexOf('//', i);
      if (b >= 0 && (l < 0 || b < l)) { line += raw.slice(i, b); inBlock = true; i = b + 2; continue; }
      if (l >= 0) { line += raw.slice(i, l); i = raw.length; continue; }
      line += raw.slice(i); i = raw.length;
    }
    out.push(line);
  }
  return out;
}
/* 문자열 리터럴 제거 — 표시 텍스트(`tx`)·버프 출처 이름·색상 코드(`'#7ED957'`)가 전부 여기서 사라진다.
   이 게이트가 보는 것은 «엔진이 쓰는 수» 이지 «화면에 찍히는 글자» 가 아니다(그쪽은 verifyNumClean 몫). */
const noStr = s => s.replace(/'(?:[^'\\]|\\.)*'/g, "''")
                    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
                    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
/* 연출 전용 호출 제거 — index.html 에만 있고 sim.js 에는 없다(팝업 좌표 -104 같은 수가 딸려 온다).
   중첩 괄호가 없는 단순 호출이라 한 겹만 걷으면 된다. */
const FX = /(?:addText|addFloat|renderStatsGrid|playSfx|shake|reapFx|poof)\s*\([^()]*\)/g;
const noFx = s => s.replace(FX, ' ');

const SIM_L = stripComments(SIM);
const HTM_L = stripComments(HTM);

/* 특전 목록 = sim.js 정의부가 정본 */
const IDS = [...SIM.matchAll(/add\('([a-z]_[A-Za-z0-9_]+)'/g)].map(m => m[1]);

/* ---------- 한 특전의 «엔진 조각» 모으기 ---------- */
/* 줄이 `{` 로 열리고 몸통이 다음 줄로 넘어가는 경우(index.html 에 흔하다)를 위해 중괄호가 닫힐 때까지 잇는다.
   이걸 안 하면 sim 의 한 줄짜리 구현과 html 의 여러 줄짜리 구현이 «숫자 개수가 다르다» 로 오검출된다. */
const depthOf = s => { let d = 0; for (const ch of s) { if (ch === '{') d++; else if (ch === '}') d--; } return d; };
function blockFrom(lines, i) {
  let depth = depthOf(noStr(lines[i]));
  if (depth <= 0) return lines[i];        /* 한 줄짜리 구현 — 그 줄이 전부다 */
  const out = [lines[i]];
  for (let k = i + 1; k < lines.length && k < i + 40; k++) {
    out.push(lines[k]);
    depth += depthOf(noStr(lines[k]));
    if (depth <= 0) break;
  }
  return out.join('\n');
}
function pieces(lines, id, defRe) {
  const use = new RegExp(`px(?:\\.|\\[')${id}(?![A-Za-z0-9_])`);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!use.test(noStr(line))) continue;
    if (defRe.test(line)) {                       /* 정의부 줄: ap 부분만 본다(등급·아이콘·표시 텍스트 제외) */
      const j = line.indexOf('ap:');
      const k = line.indexOf('p=>');
      const cut = j >= 0 ? j : k;                 /* sim 은 `add('id',r,p=>…)`, html 은 `{… ap:p=>…}` */
      if (cut >= 0) out.push(line.slice(cut));
      continue;
    }
    out.push(blockFrom(lines, i));
  }
  return out.join('\n');
}
/* 숫자 뽑기 — 자기 가드 대입(`p.px.<id>=1`)은 «값» 이 아니라 표식이라 뺀다(두 엔진에서 개수가 달라진다). */
function nums(txt, id) {
  let t = noFx(noStr(txt));
  t = t.replace(new RegExp(`(?:p\\.)?px(?:\\.${id}|\\['${id}'\\])\\s*=\\s*1`, 'g'), ' ');
  return (t.match(/(?<![A-Za-z0-9_.])\d+(?:\.\d+)?/g) || []).map(Number).sort((a, b) => a - b);
}

/* ---------- 등재된 «구조가 달라서 나는» 차이 (값 차이가 아님) ---------- */
/* 값이 갈린 것은 절대 여기 넣지 말 것 — 여기 넣어도 되는 것은 «한쪽 엔진에만 있는 구조» 뿐이고,
   각 항목은 왜 값 차이가 아닌지를 적는다. 비면 비는 대로 좋다.
   ⚑ 등재는 «면죄부» 가 아니라 **못**이다: 기대하는 두 값 목록을 그대로 적어 두므로,
     등재된 특전이라도 어느 한쪽 숫자가 바뀌면 목록이 달라져 곧바로 빨개진다
     (T86 이 `verifyNumClean` 래칫에서 «등재 = 무방비» 를 실측한 뒤로 이 레포의 규약이다). */
const KNOWN = {
  r_boltChain: { sim: '0.3', html: '0,0.3,10',
    why: 'html 만 화면용 번개 이펙트를 함께 넣는다(G.bolts.push 의 t:0 · seed 배율 10) — 연출 상수라 전투값이 아니다. 데미지는 양쪽 다 summonHit(o, R_BOLT) 로 같고 확률 0.30 도 같다' },
  l_boltChainK: { sim: '0.3', html: '0,0.3,10',
    why: '위와 같은 줄을 공유한다(둘이 한 if 안에 있다) — 같은 연출 상수' },
  l_aspdRamp: { sim: '0,0', html: '0,0,0',
    why: 'html 은 초기화 전에 p.rampN>0 가드를 둬 불필요한 스탯 재렌더를 피한다 — 비교 상수 0 이 하나 더 붙을 뿐 동작은 같다' },
};

/* ---------- 대조 ---------- */
let bad = 0, known = 0, okN = 0;
const lines = [];
for (const id of IDS) {
  const a = nums(pieces(SIM_L, id, new RegExp(`add\\('${id}'`)), id);
  const b = nums(pieces(HTM_L, id, new RegExp(`\\{id:'${id}'`)), id);
  if (a.join(',') === b.join(',')) { okN++; continue; }
  const k = KNOWN[id];
  if (k && k.sim === a.join(',') && k.html === b.join(',')) {
    known++; lines.push(`🔵 ${id} — sim[${a}] ≠ html[${b}]  등재: ${k.why}`); continue;
  }
  bad++;
  lines.push(k ? `❌ ${id} — 등재된 차이가 아니다. 등재 sim[${k.sim}]/html[${k.html}] ↔ 지금 sim[${a}]/html[${b}]`
               : `❌ ${id} — sim[${a}] ≠ html[${b}]`);
}
console.log('=== 특전 엔진 상수 두 파일 대조 (sim.js ↔ index.html) ===\n');
for (const l of lines) console.log('  ' + l);
if (!lines.length) console.log('  (차이 없음)');
console.log(`\n특전 ${IDS.length}종 · 일치 ${okN} · 신규 불일치 ${bad} · 등재된 구조 차이 ${known}`);
if (IDS.length !== 132) { console.log(`❌ 특전 수가 132 가 아니다 (${IDS.length}) — 목록 파싱이 깨졌다`); process.exit(1); }
if (bad) { console.log('→ 실패 — 한쪽 엔진만 고쳤다. 표시 텍스트가 가리키는 값으로 양쪽을 맞춰라.'); process.exit(1); }
console.log('→ 통과');
