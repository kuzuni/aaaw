'use strict';
/* 숫자 청결 게이트 — 주인 확정 «깔끔한 숫자 규칙» (ROUTINE 2026-09-03)
 *
 * 주인 원문(표기·튜닝 공통):
 *   «특전·장비 옵션의 **확률은 10% 단위**(10/20/30…%, 예외적으로 5% 허용) · 지속시간 0.5초 단위 ·
 *    수치 계수 5% 단위 · **소수점 금지** (0.37% 같은 값 금지 — 밸런스가 안 맞으면 소수점으로 깎지 말고
 *    효과 설계 자체를 바꿔라). 게이트에 «숫자 청결» 검사 추가(전 특전·옵션 텍스트 파싱).»
 *   ««%p» 표기 전면 금지 … 게이트의 금지어 검사에 «%p» 추가.»  «대폭 증가» 같은 추상 표현도 금지.»
 * 이 규칙은 «특전 재설계 전면 폐기»(같은 날 주인 최종 결정) 뒤에도 **명시적으로 유지**된다 —
 * 폐기 항목이 «표기 규칙은 유지: %p 금지·소수점 금지·확률 5~10% 단위·추상 표현 금지» 라고 못박았다.
 *
 * ⚑ «%p» 의 사정거리 (T81 위임 판단, PROGRESS 에 근거 등재):
 *   금지 대상은 **게임에 뜨는 표시 텍스트**(특전 tx · 장비 옵션 d · PLAN 의 그 표 행)다.
 *   «클리어율이 5%p 벌어졌다» 처럼 *측정 결과의 차이*를 적는 분석 산문은 대상이 아니다 —
 *   주인 본인이 과녁 허용 오차를 «±5%p» 로 주셨으므로(ROUTINE 실험1 과녁) 그 축까지 금지일 수 없다.
 *   그래서 이 게이트는 PLAN 의 **표 행(`|` 로 시작)** 만 보고 산문 줄은 건드리지 않는다.
 *
 * ⚑ 래칫(ratchet) 구조 — 왜 «0건 강제» 가 아닌가:
 *   Ⓐ·Ⓑ 두 축은 이미 0건이라 그대로 «0건» 을 강제한다.
 *   Ⓒ~Ⓕ 네 축은 **기존 위반이 94건 남아 있다**(T81 1단계 시점). 이걸 한 번에 정리하려면
 *   특전 수치를 통째로 옮겨야 해서 밸런스 등가 유지(주인 조건)를 위한 재측정이 필요하다 —
 *   T1 이 도는 중에 혼자 할 일이 아니라 T81 2단계 몫이다. 그동안 «더 나빠지지 않는다» 를 지키려고
 *   위반 항목을 id 로 동결해 두고 **신규 위반만 빨갛게** 만든다.
 *   위반이 해소되면(= 등재됐는데 이제 깨끗하면) 빨개지지 않고 «✎ 목록에서 지울 것» 을 찍는다.
 *   T1 이 매 회차 특전 수치를 만지는데 «고쳤더니 게이트가 빨개진다» 면 그 자가 벌이 되기 때문이다.
 *   목록 정리 담당(=T81 2단계)은 `--strict` 로 돌려 해소분까지 빨갛게 볼 것.
 *
 * 사용: node tools/verifyNumClean.js [--strict]     (exit 0 = 통과, 1 = 불합격)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const STRICT = process.argv.includes('--strict');
const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SIM = fs.readFileSync(path.join(ROOT, 'sim.js'), 'utf8');
const PLAN = fs.readFileSync(path.join(ROOT, 'PLAN.md'), 'utf8');

let fail = 0, pass = 0, note = 0;
const ok = m => { pass++; console.log('  ✓ ' + m); };
const bad = m => { fail++; console.log('  ✗ ' + m); };
const hint = m => { note++; console.log('  ✎ ' + m); };

/* ---------- 파서 ---------- */
function splitTop(src) {
  const parts = []; let d = 0, cur = '', q = null;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) { cur += ch; if (ch === q && src[i - 1] !== '\\') q = null; continue; }
    if (ch === "'" || ch === '"') { q = ch; cur += ch; continue; }
    if ('([{'.includes(ch)) d++;
    if (')]}'.includes(ch)) d--;
    if (ch === ',' && d === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}
/* 표시 텍스트는 <b> 로 수치를 감싼다 — 태그를 걷어낸 «사람이 읽는 문장» 으로만 검사한다.
   («3초마다 체력 <b>3</b>.<b>7</b>% 회복» 식 태그 쪼개기 우회를 막는다 — T79 ㊳ 과 같은 취지) */
const strip = s => s.replace(/<[^>]*>/g, '');

function perksOf(src) {
  const m = src.match(/const PERKS=\[[\s\S]*?\n\];/);
  if (!m) return null;
  const out = [];
  for (const raw of m[0].split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('{id:')) continue;
    const parts = splitTop(line.replace(/^\{/, '').replace(/\},?$/, ''));
    const get = k => {
      const p = parts.find(x => x.trim().startsWith(k + ':'));
      return p === undefined ? undefined : p.trim().slice(k.length + 1).trim();
    };
    out.push({ k: '특전 ' + get('id').slice(1, -1), t: (get('tx') || '').slice(1, -1) });
  }
  return out;
}
function goptOf(src, who) {
  const m = src.match(/const GOPT=\{[\s\S]*?\n\};/);
  if (!m) return null;
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(m[0].replace(/^const /, ''), ctx);
  const out = [];
  for (const ty of Object.keys(ctx.GOPT)) ctx.GOPT[ty].forEach((o, i) => out.push({ k: `장비 ${ty}옵${i + 1}`, t: o.d, who }));
  return out;
}

const perks = perksOf(HTML);
const gopt = goptOf(SIM, 'sim');
const goptHtml = goptOf(HTML, 'html');
if (!perks || !gopt || !goptHtml) { console.log('  ✗ PERKS/GOPT 를 파싱하지 못했다'); process.exit(1); }

/* 검사 대상 = 게임에 뜨는 표시 텍스트 전부.
   장비 옵션은 두 파일이 같은 문자열을 들고 있고(verifyT2 가 그 일치를 본다) 키가 겹치므로
   래칫 목록은 sim 쪽 한 벌만 쓰되, 금지어 축(Ⓐ·Ⓑ)은 두 파일 모두 훑는다. */
const ITEMS = [...perks, ...gopt];
const ALL_TEXT = [...perks, ...gopt, ...goptHtml];

/* PLAN 의 «표 행» — §3 특전표·§11.6 옵션표가 전부 `|` 로 시작한다. 산문 줄은 대상이 아니다. */
const PLAN_ROWS = PLAN.split('\n').filter(l => /^\s*\|/.test(l));

console.log('\n=== 숫자 청결 게이트 (주인 확정 «깔끔한 숫자 규칙») ===');
console.log(`  대상: 특전 ${perks.length}종 tx · 장비 옵션 ${gopt.length}칸 d (두 파일) · PLAN 표 ${PLAN_ROWS.length}행`);

/* ---------- Ⓐ «%p» 표기 전면 금지 (0건 강제) ---------- */
console.log('\n[Ⓐ «%p» 표기 금지 — 주인 지시 «게이트의 금지어 검사에 %p 추가»]');
{
  const hits = ALL_TEXT.filter(x => /%p/.test(strip(x.t))).map(x => `${x.k}${x.who === 'html' ? '(index.html)' : ''}: «${strip(x.t)}»`);
  hits.length ? bad(`표시 텍스트에 «%p» ${hits.length}건 — ${hits.join(' / ')}`)
              : ok('특전 tx · 장비 옵션 d 양쪽 파일에 «%p» 0건');
  const prow = PLAN_ROWS.filter(l => /%p/.test(l)).map(l => l.trim().slice(0, 60));
  prow.length ? bad(`PLAN 표 행에 «%p» ${prow.length}건 — ${prow.join(' / ')}`)
              : ok('PLAN 표 행(§3 특전표 · §11.6 옵션표)에 «%p» 0건');
  /* 방어력·회피·반격은 % 스탯이므로 «+8%» 가 맞다(엔진: def/evade/counter 는 가산 후 상한 80/90 의 % 값).
     %p 를 지우면서 «+8» 처럼 단위를 통째로 날리는 되돌림을 막는다.
     ⚑ 특전 128종은 이미 전부 «+N%» 꼴이라 **0건을 강제**한다.
        장비 옵션 13칸은 아직 «회피 +7» 처럼 단위가 없다 — 같은 스탯을 게임이 두 가지로 적고 있다.
        주인 확정 ⑥(««방어력 +10» 같은 단위 없는 표기 전면 금지»)이 «재설계 지시에 합침» 블록에 있어
        재설계 폐기 뒤 살아 있는지가 불분명하므로, 워커가 임의로 13칸을 고치지 않고
        **래칫으로 동결 + 주인 검토 등재**만 한다(PROGRESS T81). */
  const BARE = /(방어력|회피|반격 확률|치명타 확률)\s*\+\d+(?!\s*%|\d)/;
  const barePerk = perks.filter(x => BARE.test(strip(x.t))).map(x => `${x.k}: «${strip(x.t)}»`);
  barePerk.length ? bad(`특전 tx 에 단위 없는 스탯 표기 ${barePerk.length}건 — ${barePerk.join(' / ')}`)
                  : ok('특전 128종 스탯 표기가 전부 «+N%» 꼴 (단위 누락 0건)');
  const KNOWN_BARE = ['장비 axe옵3', '장비 crown옵1', '장비 crown옵3', '장비 crown옵6', '장비 plate옵4',
    '장비 chain옵7', '장비 sandal옵1', '장비 sandal옵3', '장비 sandal옵6', '장비 boots옵1',
    '장비 boots옵3', '장비 greave옵7', '장비 beads옵3'];
  const bareGear = gopt.filter(x => BARE.test(strip(x.t))).map(x => x.k);
  const freshBare = bareGear.filter(k => !KNOWN_BARE.includes(k));
  freshBare.length ? bad(`장비 옵션에 단위 없는 스탯 표기가 새로 ${freshBare.length}건 늘었다 — ${freshBare.join(', ')}`)
                   : ok(`장비 옵션 단위 누락 ${bareGear.length}칸 전부 등재된 기존 분 (주인 검토 대기 — 특전은 «+8%», 장비는 «+7» 로 갈려 있다)`);
}

/* ---------- Ⓑ 추상 표현 금지 (0건 강제) ---------- */
console.log('\n[Ⓑ 추상 표현 금지 — 주인 지시 ««대폭 증가» 같은 추상 표현도 금지, 전부 구체 수치로»]');
{
  const VAGUE = /(대폭|소폭|조금|약간|살짝|미미|다소|크게\s*(증가|상승|감소)|약간의|상당히)/;
  const hits = ALL_TEXT.filter(x => VAGUE.test(strip(x.t))).map(x => `${x.k}: «${strip(x.t)}»`);
  hits.length ? bad(`표시 텍스트에 추상 표현 ${hits.length}건 — ${hits.join(' / ')}`)
              : ok('특전 tx · 장비 옵션 d 에 추상 표현 0건');
  const prow = PLAN_ROWS.filter(l => VAGUE.test(l)).map(l => l.trim().slice(0, 60));
  prow.length ? bad(`PLAN 표 행에 추상 표현 ${prow.length}건 — ${prow.join(' / ')}`)
              : ok('PLAN 표 행에 추상 표현 0건');
}

/* ---------- Ⓒ~Ⓕ 래칫 축 ---------- */
/* ⚑ 아래 네 목록은 **T81 1단계 시점의 기존 위반 동결분**이다. 정리는 T81 2단계 몫.
   ⚑ T82 (주인 확정 «킬힐 5% 기준») — 킬 회복 4종(c_killHeal2 · c_killShield3 · l_killHeal5 · l_killShield10)이
   5·10% 로 정리돼 **동결분에서 빠졌다**. 이제 이 넷이 다시 소수점으로 깎이면 여기서 곧장 빨개진다.
   목록에 없는 id 가 위반하면 = 신규 위반 = 불합격. 새 특전·옵션을 넣을 땐 규칙대로 쓰면 그만이다. */

/* Ⓒ 소수점 금지 (주인: «0.37% 같은 값 금지») */
const KNOWN_DECIMAL = ['특전 c_stunHit', '특전 l_overBolt', '특전 l_perkHp', '특전 l_legendOnly', '특전 m_procX2',
  '특전 m_autoBolt', '특전 m_stunLord', '특전 m_stunKill', '특전 m_stunAura', '장비 greatsword옵7',
  '장비 hood옵5', '장비 robe옵7', '장비 gauntlet옵7', '장비 greave옵2', '장비 greave옵6',
  '장비 beads옵4', '장비 beads옵7'];

/* Ⓓ 확률 10% 단위(예외 5% 허용) = 5의 배수 */
const KNOWN_PROB = ['특전 c_wardHit', '특전 r_hitEvade', '특전 r_wardCrit', '특전 l_fullHpCrit', '장비 plate옵4'];

/* Ⓔ 지속시간 0.5초 단위 */
const KNOWN_DUR = ['특전 l_overBolt', '특전 m_autoBolt', '특전 m_stunKill', '장비 hood옵5'];

/* Ⓕ 수치 계수 5% 단위 */
const KNOWN_COEF = ['특전 c_atkPerm', '특전 c_defHit',
  '특전 c_hitHeal', '특전 c_evadeEv', '특전 c_healBoost', '특전 c_healShield', '특전 c_hp12',
  '특전 c_rangeShield', '특전 r_atkBuffM', '특전 r_critFBuff', '특전 r_critHeal3', '특전 r_killCrit',
  '특전 r_defBuff2', '특전 r_hitEvade', '특전 r_evadeHeal', '특전 r_counterAtkM', '특전 r_counterCrit',
  '특전 r_healShield5', '특전 r_healAtk', '특전 r_def6', '특전 r_missAspd', '특전 l_killAspd',
  '특전 l_evadeAtk', '특전 l_counterHeal', '특전 l_perkHp',
  '특전 l_legendOnly', '특전 m_revive', '특전 m_clone', '특전 m_guard', '특전 m_time', '특전 m_def20',
  '특전 m_crit25', '특전 m_giant', '특전 m_lucky', '장비 greatsword옵1', '장비 greatsword옵3',
  '장비 axe옵1', '장비 bow옵1', '장비 helmet옵7', '장비 plate옵1', '장비 plate옵2', '장비 plate옵5',
  '장비 robe옵4', '장비 gauntlet옵4', '장비 leather옵1', '장비 leather옵5', '장비 leather옵6',
  '장비 handwrap옵3', '장비 handwrap옵4', '장비 handwrap옵5', '장비 sandal옵4', '장비 sandal옵5',
  '장비 boots옵4', '장비 boots옵6', '장비 greave옵1', '장비 greave옵2', '장비 greave옵5',
  '장비 greave옵6', '장비 pendant옵4', '장비 pendant옵5'];

const isMul = (v, u) => Math.abs(v / u - Math.round(v / u)) < 1e-9;
/* 확률 표기는 두 어순을 다 쓴다 — «20% 확률로» 와 «확률 60%».
   ⚑ «확률 +14%» 처럼 **부호가 붙은** 것은 발동 확률이 아니라 «치명타 확률» 스탯의 상승폭이라
   Ⓓ(발동 확률 단위)가 아니라 Ⓕ(수치 계수)로 센다 — 그래서 두 번째 어순은 `+` 를 배제한다. */
const PROB_RE = () => /(\d+(?:\.\d+)?)%\s*확률|확률\s+(\d+(?:\.\d+)?)%/g;

function probs(t) { const out = []; let m; const re = PROB_RE(); while ((m = re.exec(t))) out.push(+(m[1] || m[2])); return out; }
function secs(t) { const out = []; let m; const re = /(\d+(?:\.\d+)?)초/g; while ((m = re.exec(t))) out.push(+m[1]); return out; }
function coefs(t) {
  /* 확률로 이미 읽은 수는 계수 축에서 뺀다 (한 값을 두 축이 이중으로 세지 않게) */
  const t2 = t.replace(PROB_RE(), '');
  const out = []; let m; const re = /(\d+(?:\.\d+)?)%/g; while ((m = re.exec(t2))) out.push(+m[1]);
  return out;
}

const AXES = [
  { n: 'Ⓒ', name: '소수점 금지', known: KNOWN_DECIMAL, hit: t => /\d+\.\d/.test(t), why: '소수점 값' },
  { n: 'Ⓓ', name: '확률 10% 단위(예외 5% 허용)', known: KNOWN_PROB, hit: t => probs(t).some(v => !isMul(v, 5)), why: '5의 배수가 아닌 확률' },
  { n: 'Ⓔ', name: '지속시간 0.5초 단위', known: KNOWN_DUR, hit: t => secs(t).some(v => !isMul(v, 0.5)), why: '0.5초 배수가 아닌 지속시간' },
  { n: 'Ⓕ', name: '수치 계수 5% 단위', known: KNOWN_COEF, hit: t => coefs(t).some(v => !isMul(v, 5)), why: '5의 배수가 아닌 계수' },
];

let remain = 0;
for (const ax of AXES) {
  console.log(`\n[${ax.n} ${ax.name} — 래칫 (등재 ${ax.known.length}건, 신규만 불합격)]`);
  const cur = ITEMS.filter(x => ax.hit(strip(x.t)));
  const curK = cur.map(x => x.k);
  const known = new Set(ax.known);
  const fresh = cur.filter(x => !known.has(x.k));
  const gone = ax.known.filter(k => !curK.includes(k));
  remain += curK.length;
  fresh.length
    ? bad(`신규 위반 ${fresh.length}건(${ax.why}) — ` + fresh.map(x => `${x.k}: «${strip(x.t)}»`).join(' / '))
    : ok(`신규 위반 0건 (현재 ${curK.length}건 전부 등재된 기존 분)`);
  if (gone.length) {
    const msg = `등재분 ${gone.length}건이 해소됐다 — 목록에서 지울 것: ${gone.join(', ')}`;
    STRICT ? bad(msg) : hint(msg);
  } else ok('등재 목록에 죽은 항목 없음');
}

console.log(`\n  ※ 잔여 위반 총 ${remain}건 (Ⓒ~Ⓕ 중복 포함) — 정리는 T81 2단계 몫이다.`);
console.log('    주인 조건: «수치 정리 시 밸런스 등가 유지» · «소수점으로 깎지 말고 효과 설계 자체를 바꿔라».');
console.log(`\n결과: ${pass} 통과 · ${fail} 불합격` + (note ? ` · ${note} 안내` : ''));
if (fail) { console.log('→ 불합격'); process.exit(1); }
console.log('→ 통과' + (note ? ' (안내 있음 — 래칫 목록 정리 필요)' : ''));
