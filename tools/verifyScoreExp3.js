#!/usr/bin/env node
/* 게이트 — `tools/scoreExp3.js` 의 자(尺)가 «단조» 인지 합성 입력으로 검사한다. (T67 수리의 회귀 방지)
 *
 * 왜: T67 = «일찍 죽을수록 점수가 오른다». 채점기가 미도달 챕터를 분모에서 빼는 바람에
 *     챕터 21 에서 죽은 런이 300 까지 완주한 런보다 높은 점수를 받을 수 있었다.
 *     실측이 아니라 «자» 의 결함이라 합성 입력으로 잡는 것이 맞다.
 *
 * 사용: node tools/verifyScoreExp3.js     (exit 0 = 통과 · exit 1 = 위반)
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

const TOOL = path.join(__dirname, 'scoreExp3.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scoreexp3-'));
let pass = 0, fail = 0;
const bad = [];

function ok(cond, name, detail) {
  if (cond) { pass++; }
  else { fail++; bad.push(`${name}${detail ? ' — ' + detail : ''}`); }
}

/* 합성 원시 출력 생성. tries(c) 가 null 을 돌려주면 그 챕터에서 400회 실패로 런이 끊긴다. */
function raw(maxc, tries) {
  const L = [`\n=== 실험3: 전체 진행 시뮬 (챕터 1→${maxc}, 골드=슬롯강화 · 다이아=뽑기 자동) ===`];
  let total = 0;
  for (let c = 1; c <= maxc; c++) {
    const t = tries(c);
    if (t === null) { L.push(`챕터 ${String(c).padStart(3)}: 시도 400회  슬롯 0/0/0/0/0/0  장비 -  뽑기 0회  전투력 공1.00e+0·체1.00e+0  ** 400회 실패 **`); break; }
    total += t;
    L.push(`챕터 ${String(c).padStart(3)}: 시도 ${String(t).padStart(3)}회  슬롯 0/0/0/0/0/0  장비 -  뽑기 0회  전투력 공1.00e+0·체1.00e+0  `);
  }
  L.push(`총 시도: ${total}  (환산 ${(total / 30).toFixed(0)}일)`);
  return L.join('\n') + '\n';
}

let n = 0;
function score(text) {
  const f = path.join(tmp, `r${n++}.txt`);
  fs.writeFileSync(f, text);
  const out = execFileSync('node', [TOOL, f], { encoding: 'utf8' });
  const m = out.match(/=\s\*\*([\d.]+)\/3\*\*/);
  if (!m) throw new Error('채점기 출력에서 총점을 못 읽었다:\n' + out);
  return { total: Number(m[1]), out };
}

/* 목표 구간 한가운데 값 — 이 함수를 쓰면 그 챕터는 «적합» 이다. */
function fitTries(c) {
  if (c <= 5) return 2;
  if (c <= 9) return 3;
  if (c === 10) return 40;
  if (c <= 19) return 5;
  if (c === 20) return 20;
  if (c <= 49) return 10;
  if (c <= 89) return 20;
  if (c === 90) return 60;
  if (c <= 299) return 25;
  return 60;
}

/* ── ① T67 본체: «1~20 은 완벽, 그 뒤 죽는다» 가 «1~20 완벽 + 21+ 절반 적합» 을 못 이긴다 ── */
const dieAt21 = score(raw(300, c => (c >= 21 ? null : fitTries(c))));
const fullHalf = score(raw(300, c => (c >= 21 && c % 2 === 0 ? 999 : fitTries(c))));   /* 21+ 짝수 챕터는 이탈 */
ok(dieAt21.total < fullHalf.total, '① 챕터21 사망 < 완주(21+ 절반 적합)',
   `사망 ${dieAt21.total} vs 완주 ${fullHalf.total}`);

/* ── ② 더 세게: 21+ 가 «전부 이탈» 인 완주 런조차 조기 사망보다 낮으면 안 된다 ── */
const fullNone = score(raw(300, c => (c >= 21 ? 999 : fitTries(c))));
ok(dieAt21.total <= fullNone.total, '② 챕터21 사망 ≤ 완주(21+ 전부 이탈)',
   `사망 ${dieAt21.total} vs 완주 ${fullNone.total}`);

/* ── ③ 단조성: 같은 행동으로 더 멀리 간 런이 더 낮은 점수를 받으면 안 된다 ── */
const stops = [21, 50, 90, 120, 200, 300];
let prev = null, monoOK = true, monoDetail = '';
for (const s of stops) {
  const r = score(raw(300, c => (c > s ? null : fitTries(c))));
  if (prev !== null && r.total < prev.v - 1e-9) { monoOK = false; monoDetail = `챕터 ${prev.s}(${prev.v}) → ${s}(${r.total}) 에서 하락`; }
  prev = { s, v: r.total };
}
ok(monoOK, '③ 사망 지점을 뒤로 미룰수록 총점 비감소', monoDetail);

/* ── ④ 완주(전 구간 적합) 가 만점 3.00 ── */
const perfect = score(raw(300, fitTries));
ok(Math.abs(perfect.total - 3) < 1e-9, '④ 전 구간 적합 완주 = 3.00/3', `실측 ${perfect.total}`);

/* ── ⑤ 상한(EXP3_MAX) 절단은 «미도달» 이 아니다 — 설정이지 결과가 아니다 ── */
const cut50 = score(raw(50, fitTries));
ok(Math.abs(cut50.total - 3) < 1e-9, '⑤ EXP3_MAX=50 절단본도 전 구간 적합이면 3.00/3', `실측 ${cut50.total}`);
ok(!/미도달 [1-9]/.test(cut50.out), '⑤ 절단본에 «미도달» 칸이 없다');

/* ── ⑥ 미도달 칸이 실제로 세어지는지 (수리가 살아 있는지) ── */
ok(/런 조기 종료: 챕터 21/.test(dieAt21.out), '⑥ 조기 종료 표시가 뜬다');
ok(/미도달 (2[0-9][0-9]|[3-9][0-9][0-9])/.test(dieAt21.out), '⑥ 미도달 칸 수를 센다',
   (dieAt21.out.match(/미도달 \d+/) || ['(없음)'])[0]);

/* ── ⑦ 헤더 없는 옛 원시 출력도 죽지 않는다 (하위 호환) ── */
const legacy = raw(300, c => (c > 40 ? null : fitTries(c))).replace(/=== 실험3:[^\n]*\n/, '');
const legacyScore = score(legacy);
ok(legacyScore.total > 0, '⑦ 헤더 없는 옛 출력도 채점된다', `총점 ${legacyScore.total}`);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`verifyScoreExp3: ${pass}/${pass + fail} 통과`);
if (fail) { console.error('위반:\n - ' + bad.join('\n - ')); process.exit(1); }
