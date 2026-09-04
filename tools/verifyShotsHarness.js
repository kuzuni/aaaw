'use strict';
/* T116 UI 하니스(`tools/t3/shots.js`) ↔ 게임(`index.html`) 배선 게이트 — T122 (2026-09-04)
 *
 * 왜 이 게이트가 생겼나 — `shots.js` 는 **어떤 게이트도 안 보는 파일**이었다.
 * T3 4스위트(boot·battle·gear·fx)는 자기 합계에 이 파일을 안 넣고, 정적 게이트 18종은
 * `sim.js`·`index.html`·`PLAN.md` 만 읽는다. 게다가 `playwright-core` 가 리포에 없어
 * «그냥 돌려 보는» 것도 게이트가 될 수 없다. 그 사이에 T117 이 3택을 복구하면서 게임 쪽
 * 지급 동사가 `offerPerks`/`pickPerk` 로 갈렸고, 하니스만 **sim.js 전용 동사** `grantNextPerk`
 * 에 남아 `ReferenceError` 로 부팅부터 죽었다 — **T117·T118·T119·T120 넷이 그걸 못 봤다**(T122).
 * 그래서 «실행 없이도 배선이 끊긴 것을 잡는» 정적 대조를 여기 둔다.
 *
 * 검사:
 *  ① 하니스가 **sim.js 전용 동사**를 부르지 않는다 (주석은 빼고 «코드» 만 본다 — 이력 설명은 허용).
 *  ② 하니스가 쓰는 **게임 동사·전역**이 `index.html` 에 정의돼 있다 (양방향 — 목록에 있는데 하니스가
 *     안 쓰면 목록이 썩은 것이므로 그것도 빨강).
 *  ③ 하니스가 부르는 이름 중 **아무 데도 없는 것**이 없다 (JS/Node/하니스 자체 것 · ② 목록 · index.html
 *     정의 셋 중 어디에도 없으면 빨강 — ② 목록에 새 동사를 등재하지 않고 늘린 경우를 잡는다).
 *
 * 사용: node tools/verifyShotsHarness.js          (exit 0 = 통과, 1 = 불합격)
 *       node tools/verifyShotsHarness.js --self   (음성 케이스 — 고장을 심어 빨개지는지 확인)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SHOTS_PATH = path.join(ROOT, 'tools', 't3', 'shots.js');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* `sim.js` 전용 동사 — 게임(index.html)에는 없어야 하고, 게임 화면을 찍는 하니스도 부르면 안 된다.
   (`verifyT2` ⑯·`verifyDevilPolicy` 가 «index.html 에 있으면 빨강» 으로 못 박은 것과 같은 이름들이다.) */
const SIM_ONLY = ['grantNextPerk', 'simPickPerk', 'runChapter', 'mkPlayer', 'mkBuild'];

/* 하니스가 `page.evaluate` 안에서 쓰는 게임 쪽 이름 — 여기 있는 것은 전부 index.html 에 정의돼 있어야 한다. */
const GAME_FN = ['showScreen', 'openGearDetail', 'closeOverlay', 'openForge', 'startChapter',
  'newGear', 'persist', 'pickPerk', 'openLevelUp', 'renderStatsGrid'];
const GAME_VAR = ['G', 'save', 'GT', 'PERKS'];

/* JS·Node·Playwright·하니스 자체의 이름 — ③ 에서 «없는 이름» 으로 세지 않는다. */
const NOT_GAME = new Set([
  'require', 'Promise', 'String', 'Number', 'Boolean', 'Array', 'Object', 'JSON', 'Math', 'Date',
  'setTimeout', 'clearTimeout', 'parseInt', 'parseFloat', 'isNaN', 'console',
  'measure', 'shot', 'pct', 'tick', 'res', 'chromium',
]);
const KEYWORD = new Set(('if for while switch catch return typeof function async await new delete void ' +
  'do else try finally of in instanceof yield throw case').split(' '));

/* 주석·문자열을 지운 «코드만» 소스 — 정규식으로는 따옴표가 섞인 한국어 주석에서 짝이 어긋나므로 문자 단위로 훑는다. */
function codeOnly(src) {
  let out = '', i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; out += ' '; continue; }
    if (c === '/' && d === '/') { const e = src.indexOf('\n', i); i = e < 0 ? n : e; out += ' '; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < n && src[i] !== q) i += (src[i] === '\\' ? 2 : 1);
      i++; out += '@'; continue;
    }
    out += c; i++;
  }
  return out;
}

/* 부르는 이름 뽑기 — `x.foo(` 같은 멤버 호출은 뺀다(게임 전역이 아니다). */
function calledNames(code) {
  const set = new Set();
  const re = /(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = re.exec(code))) if (!KEYWORD.has(m[2])) set.add(m[2]);
  return set;
}
const definedInHtml = nm => new RegExp(`(?:function|const|let|var)\\s+${nm}\\b`).test(HTML);

function run(shotsSrc, label) {
  let fail = 0, pass = 0;
  const ok = m => { pass++; console.log('  ✓ ' + m); };
  const bad = m => { fail++; console.log('  ✗ ' + m); };
  const code = codeOnly(shotsSrc);
  const called = calledNames(code);

  console.log(`[T116 UI 하니스 배선 — shots.js ↔ index.html${label ? ' · ' + label : ''}]`);

  /* ---------- ① sim.js 전용 동사를 부르지 않는다 ---------- */
  for (const nm of SIM_ONLY) {
    new RegExp(`\\b${nm}\\s*\\(`).test(code)
      ? bad(`① shots.js 가 sim.js 전용 동사 \`${nm}()\` 를 부른다 — 게임에는 없는 이름이라 ReferenceError 로 죽는다 (T122 가 고친 바로 그 사고)`)
      : ok(`① sim.js 전용 동사 \`${nm}\` 를 코드에서 안 부른다`);
  }

  /* ---------- ② 게임 동사·전역이 양쪽에 다 있다 ---------- */
  for (const nm of GAME_FN) {
    called.has(nm)
      ? ok(`② shots.js 가 게임 동사 \`${nm}()\` 를 쓴다`)
      : bad(`② 목록의 \`${nm}\` 를 shots.js 가 안 쓴다 — 하니스가 바뀌었으면 이 게이트의 GAME_FN 도 같이 고칠 것(목록이 썩으면 ③ 이 헛돈다)`);
    definedInHtml(nm)
      ? ok(`② index.html 에 \`${nm}\` 가 정의돼 있다`)
      : bad(`② index.html 에 \`${nm}\` 가 없다 — 게임이 이름을 바꿨는데 하니스가 안 따라왔다(T122 와 같은 형태의 사고)`);
  }
  for (const nm of GAME_VAR) {
    new RegExp(`(^|[^.\\w$])${nm}\\b`).test(code)
      ? ok(`② shots.js 가 게임 전역 \`${nm}\` 를 읽는다`)
      : bad(`② 목록의 게임 전역 \`${nm}\` 를 shots.js 가 안 읽는다 — GAME_VAR 목록을 갱신할 것`);
    definedInHtml(nm)
      ? ok(`② index.html 에 게임 전역 \`${nm}\` 가 정의돼 있다`)
      : bad(`② index.html 에 게임 전역 \`${nm}\` 가 없다 — 하니스가 죽는다`);
  }

  /* ---------- ③ 부르는 이름 중 «아무 데도 없는 것» 이 없다 ---------- */
  {
    const unknown = [...called].filter(nm => !NOT_GAME.has(nm) && !GAME_FN.includes(nm) && !definedInHtml(nm));
    unknown.length === 0
      ? ok('③ shots.js 가 부르는 이름이 전부 «JS/하니스 것 · ② 목록 · index.html 정의» 안에 있다')
      : bad(`③ 어디에도 없는 이름을 부른다: ${unknown.join(', ')} — 게임에 없는 동사면 부팅부터 죽는다(하니스 것이면 NOT_GAME 에, 새 게임 동사면 GAME_FN 에 등재할 것)`);
  }

  console.log(`  → 통과 ${pass} · 불합격 ${fail}`);
  return fail;
}

const SRC = fs.readFileSync(SHOTS_PATH, 'utf8');

if (process.argv.includes('--self')) {
  /* 음성 케이스 — 고장을 심었을 때 실제로 빨개지는지. 하나라도 초록이면 그 단언은 죽은 것이다. */
  const cases = [
    ['옛 동사(grantNextPerk)가 되살아나면', s => s.replace('renderStatsGrid();', 'grantNextPerk();')],
    ['게임 동사 호출이 통째로 사라지면', s => s.replace(/pickPerk\(pk\)/g, 'nope(pk)')],
    ['게임에 없는 동사를 부르면', s => s.replace('renderStatsGrid();', 'renderPerkStripXYZ();')],
    ['게임 전역 읽기가 사라지면', s => s.replace(/\bPERKS\b/g, 'PERKS_GONE')],
  ];
  let dead = 0;
  for (const [nm, mut] of cases) {
    const f = run(mut(SRC), '음성: ' + nm);
    if (f === 0) { dead++; console.log(`  ‼ 음성 케이스 «${nm}» 가 초록이다 — 단언이 죽었다`); }
    console.log('');
  }
  console.log(dead ? `음성 자기검사 불합격 ${dead}건` : `음성 자기검사 ${cases.length}/${cases.length} — 심은 고장을 전부 잡았다`);
  process.exit(dead ? 1 : 0);
}

process.exit(run(SRC, '') ? 1 : 0);
