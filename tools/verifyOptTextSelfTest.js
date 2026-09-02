'use strict';
/* `tools/verifyOptText.js` ④ 산문 대조(T42)의 자가 시험 — 게이트가 «정말로 빨개지는가» 를 본다.
   사용: node tools/verifyOptTextSelfTest.js        (전부 통과해야 exit 0)

   왜 필요한가: T42 는 «게이트가 표만 보고 산문은 안 봐서 드리프트를 통과시켰다» 는 문제였다.
   그래서 산문 항목을 붙이는 것만으로는 부족하고, «틀리게 바꾸면 실제로 exit 1 이 되는가» 를 증명해야 한다.
   실제로 구현 도중 이 시험이 한 번 잡았다 — 허용목록을 «앵커+숫자» 로만 걸었더니, T42 를 낳은 그 버그
   (§3.0 «확률 1.22배» → «확률 2배»)를 허용목록이 그대로 삼켰다(음성 ①). 그래서 ctx 매칭을 넣었다.

   방식: PLAN.md·sim.js·tools/verifyOptText.js 를 임시 폴더에 복사하고, 거기서만 문자열을 바꿔 게이트를 돌린다.
   저장소 원본은 건드리지 않는다. */

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const root = path.join(__dirname, '..');
const SB = fs.mkdtempSync(path.join(os.tmpdir(), 'optTextSelfTest-'));
fs.mkdirSync(path.join(SB, 'tools'));
for (const f of ['PLAN.md', 'sim.js']) fs.copyFileSync(path.join(root, f), path.join(SB, f));
fs.copyFileSync(path.join(root, 'tools', 'verifyOptText.js'), path.join(SB, 'tools', 'verifyOptText.js'));

const PLAN0 = fs.readFileSync(path.join(SB, 'PLAN.md'), 'utf8');
const SIM0 = fs.readFileSync(path.join(SB, 'sim.js'), 'utf8');

/* [이름, 대상파일, 찾을 문자열, 바꿀 문자열, 기대 exit] — 기대 1 = 잡아야 함(음성), 0 = 통과해야 함(오탐 방지) */
const CASES = [
  ['① §3.0 폭풍의 힘 산문 1.22→2배 (T42 등재 사유 그 자체)', 'PLAN',
    '**모든 발동형 확률 1.22배**', '**모든 발동형 확률 2배**', 1],
  ['② §4 pk() 산문 1.22→1.5배', 'PLAN',
    '확률 **1.22배**(엔진', '확률 **1.5배**(엔진', 1],
  ['③ §3.0 등급 확률 산문 전설 25→22%', 'PLAN',
    '전설 25% / 신화 15%', '전설 22% / 신화 15%', 1],
  ['④ §3.0 등급 확률 산문 신화 15→18%', 'PLAN',
    '전설 25% / 신화 15%', '전설 25% / 신화 18%', 1],
  ['⑤ §4 doCounter 산문 0.7→0.9 (백틱 코드식 안의 숫자)', 'PLAN',
    '`effDmg*0.7*(1+counterX)`', '`effDmg*0.9*(1+counterX)`', 1],
  ['⑥ 엔진쪽 드리프트 — pkk 1.22→1.35 (산문은 그대로 1.22)', 'SIM',
    '1.22', '1.35', 1],
  ['⑦ 새로 쓴 산문 줄의 틀린 수치 (`doCounter` 반격 계수 0.55)', 'PLAN',
    '- 랜덤 타겟:', '- `doCounter` 는 반격 데미지를 공격력의 55% 로 준다.\n- 랜덤 타겟:', 1],
  ['⑧ 오탐 방지 — 문서 참조(§3.4→§3.9)만 바꾸면 통과해야', 'PLAN',
    '§3.4 `m_procX2` 와 같은 값', '§3.9 `m_procX2` 와 같은 값', 0],
  ['⑨ 오탐 방지 — 앵커 없는 산문 줄의 숫자는 안 본다', 'PLAN',
    '- 랜덤 타겟:', '- 이 문장은 엔진 심볼을 하나도 부르지 않으므로 숫자 12345% 가 있어도 대조 대상이 아니다.\n- 랜덤 타겟:', 0],
  ['⑩ 오탐 방지 — 표 밖이지만 §7(다른 게이트 관할) 산문은 안 본다', 'PLAN',
    '- 챕터가 무한 + 웨이브 5마리 고정 구조임', '- `chapterLayout(c)` 는 챕터당 999개를 만든다(§7 산문 — verifyPlanConst 관할).\n- 챕터가 무한 + 웨이브 5마리 고정 구조임', 0],
];

function run() {
  const r = cp.spawnSync(process.execPath, [path.join(SB, 'tools', 'verifyOptText.js')], { encoding: 'utf8' });
  return r;
}

console.log('=== verifyOptText ④ 산문 대조 자가 시험 (T42) ===');
let pass = 0, fail = 0;

/* 양성 대조군: 원본 그대로면 통과해야 한다 */
{
  const r = run();
  const ok = r.status === 0;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✓' : '✗'} ⓪ 원본 그대로 → exit ${r.status} (기대 0)`);
  if (!ok) console.log(r.stdout.split('\n').slice(-8).map(s => '      ' + s).join('\n'));
}

for (const [name, which, from, to, want] of CASES) {
  const src = which === 'PLAN' ? PLAN0 : SIM0;
  if (!src.includes(from)) {
    fail++;
    console.log(`  ✗ ${name} — 치환 대상 문자열을 못 찾았다(PLAN/sim 이 바뀌었으면 이 시험을 갱신할 것)`);
    continue;
  }
  /* SIM 쪽 상수는 여러 곳에 있을 수 있어 전부 바꾼다. PLAN 산문은 첫 곳만. */
  const mutated = which === 'SIM' ? src.split(from).join(to) : src.replace(from, to);
  fs.writeFileSync(path.join(SB, 'PLAN.md'), which === 'PLAN' ? mutated : PLAN0);
  fs.writeFileSync(path.join(SB, 'sim.js'), which === 'SIM' ? mutated : SIM0);
  const r = run();
  const ok = r.status === want;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✓' : '✗'} ${name} → exit ${r.status} (기대 ${want})`);
  if (!ok) console.log(r.stdout.split('\n').slice(-8).map(s => '      ' + s).join('\n'));
}

fs.rmSync(SB, { recursive: true, force: true });
console.log(`\n자가 시험 ${pass}/${pass + fail} 통과 (음성 ${CASES.filter(c => c[4] === 1).length}종 · 오탐 방지 ${CASES.filter(c => c[4] === 0).length}종 · 양성 대조군 1종)`);
if (fail) {
  console.log('→ 실패: 게이트가 드리프트를 놓치거나(음성) 멀쩡한 문장을 잡는다(오탐). verifyOptText.js ④ 를 고쳐라.');
  process.exit(1);
}
console.log('→ 통과');
