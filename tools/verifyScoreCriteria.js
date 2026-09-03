#!/usr/bin/env node
'use strict';
/* 채점 기준 게이트 — ⚑⚑⚑ 2026-09-03 주인 확정 «방금 말한 게 기준이고 나머지 기준은 다 폐기» 로 **은퇴**했다.
 *
 * 무엇이 있었나:
 *   이 게이트(T30 신설)는 «PLAN §7 채점표 문면 ↔ sim.js 의 실험1~5 하니스·판정 임계 ↔ tools/scoreExp3.js BANDS»
 *   를 73항목까지 대조하던 자(尺) 감시기였다. 그 자가 재던 것 — 스탯 사다리 7점 · 채점표 v1~v5 ·
 *   실험1 등급 과녁 · 실험2 등급 내 폭 · 실험3 진행 곡선 목표 · 실험4 기준 ①②③ · «비평가 2인 각 ≥8/10» —
 *   이 전부 주인 지시로 폐기됐고, 특전이 «고정 10종·순서 획득» 이 되면서 등급 자체가 사라져
 *   실험1·2 는 측정이 불가능해졌다. 옛 항목을 그대로 두면 T96 이 특전을 갈아끼우는 순간부터
 *   «폐기된 기준을 못 지켰다» 고 빨개진다 — 그래서 은퇴시킨다. 옛 본문은 git 이력에 그대로 있다.
 *
 * 지금 보는 것 (유효한 기준 2점의 문면이 살아 있는가):
 *   과녁 A — 표준 장비(희귀 풀셋·슬롯 0렙) + 특전 10종 순서 획득 = 챕터 15 클리어율 10%
 *   과녁 B — 노장비(장비 0·슬롯 0)   + 특전 10종 순서 획득 = 챕터  4 클리어율 30%
 *   둘 다 PLAN.md 와 docs/ROUTINE.md 에 적혀 있어야 한다(한쪽에서 지워지면 빨강).
 *
 * ⚑ T97 의 첫 번째 할 일: 이 파일을 새 과녁 2점 기준의 실측 게이트로 다시 만든다
 *   (측정 조건·판수·시드·허용 오차를 PLAN 문면 ↔ sim.js 구현으로 대조하고, 음성 검사까지).
 *   그때까지 이 게이트는 «기준 문면이 지워지지 않았는가» 만 지킨다.
 *
 * 사용: node tools/verifyScoreCriteria.js      (exit 0 = 통과, 1 = 불일치)
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const PLAN = rd('PLAN.md');
const ROUTINE = rd('docs/ROUTINE.md');

/* 과녁 문면 — 숫자를 바꿔 적으면 여기서 걸린다. 표기 흔들림(공백·강조)은 허용한다. */
const CHECKS = [
  ['PLAN §7 · 과녁 A (챕터 15 = 10%)', PLAN, /챕터\s*15\s*\**\s*클리어율\s*\**\s*10\s*%/],
  ['PLAN §7 · 과녁 B (챕터 4 = 30%)', PLAN, /챕터\s*4\s*\**\s*클리어율\s*\**\s*30\s*%/],
  ['PLAN §7 · 허용 오차 ±2%p', PLAN, /±\s*2\s*%p/],
  ['PLAN §11.7 · 사다리 7점 폐기 표시', PLAN, /사다리\s*7점은\s*폐기/],
  ['ROUTINE · 과녁 A (챕터 15 = 10%)', ROUTINE, /챕터\s*15\s*\**\s*클리어율\s*\**\s*10\s*%/],
  ['ROUTINE · 과녁 B (챕터 4 = 30%)', ROUTINE, /챕터\s*4\s*\**\s*클리어율\s*\**\s*30\s*%/],
  ['ROUTINE · 폐기 목록(채점표·비평가 게이트)', ROUTINE, /채점표\s*v1~v5[\s\S]{0,80}비평가/],
];

let bad = 0;
console.log('채점 기준 게이트 — 은퇴 상태 (2026-09-03 주인 기준 폐기). 유효 기준 2점의 문면만 확인한다.\n');
for (const [name, hay, re] of CHECKS) {
  const ok = re.test(hay);
  if (!ok) bad++;
  console.log(`  ${ok ? '✓' : '✗'} ${name}`);
}
console.log(`\n대조 ${CHECKS.length}항목 · 일치 ${CHECKS.length - bad} · 불일치 ${bad}`);
if (bad) {
  console.log('→ 실패 — 유효한 밸런스 기준(과녁 A·B) 문면이 지워졌거나 숫자가 바뀌었다.');
  console.log('   주인이 기준을 바꾸신 것이라면 이 파일의 CHECKS 도 같이 고칠 것.');
  process.exit(1);
}
console.log('→ 통과 (⚑ T97 이 이 게이트를 새 과녁 2점의 실측 게이트로 다시 만든다)');
