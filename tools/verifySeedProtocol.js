'use strict';
/* 회귀 측정 규약 게이트 (T87 신설 — T74 가 «규약화» 로 남긴 몫)
   사용: node tools/verifySeedProtocol.js        (규약이 깨지면 exit 1)

   ⚑ 왜 있나. R01~R05 내내 실험1·2·5 회귀 수치가 **무시드 1벌**로 적혔다 — 실험1 희귀 칸은 재실행마다
   14.7~21.0%, 실험5 신화+9강은 2.5~9.0% 로 흔들리는데도 «회차 대비 ±n%p» 를 그 위에 세운 것이다.
   R05 초판 문서는 한 절 안에 서로 다른 두 런의 숫자가 섞이는 사고까지 냈다(T74).
   PLAN §7 «회귀 측정 규약» 3조가 그 답이고, 이 게이트는 그 3조가 **코드로 지켜지는지**를 본다.
   자(尺)의 자라서 엔진 수치는 한 글자도 안 본다 — 밸런스와 무관하다.

   검사:
     ① 결정성 — 같은 SEED 로 두 번 돌린 실험5 출력이 **바이트 단위로 같다**.
        (Date.now()·미시드 난수·전역 상태 잔재가 새로 끼면 여기서 즉시 빨개진다.)
     ② 시드 유효성 — 서로 다른 세 시드가 **모두 같은 출력**이면 안 된다.
        (SEED 가 실제로 물리지 않고 «결정적으로 보이기만» 하는 퇴화를 잡는다. ① 만으로는 못 잡는다.)
     ③ 채점 판수 상수 — `EXP5_SCORE_N`(≥1000) · `EXP1_SCORE_N`(≥1000) 이 선언돼 있고 **기본값 자리에
        그 상수가 실제로 쓰인다**(리터럴 우회 차단 — T80 이 실험2 에 쓴 방식 그대로).
     ④ 러너 — `tools/regress.js` 의 기본 시드가 **3벌 이상**이고, 실험1·2·5 를 파싱하며,
        판수 환경변수를 **지워서** 채점 기본값으로 돌린다(규약 ② 우회 차단).
     ⑤ PLAN §7 에 규약 3조 문면이 살아 있다. */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const SIM = fs.readFileSync(path.join(root, 'sim.js'), 'utf8');
const REG = fs.readFileSync(path.join(root, 'tools', 'regress.js'), 'utf8');
const PLAN = fs.readFileSync(path.join(root, 'PLAN.md'), 'utf8');

let bad = 0, okN = 0;
const pass = m => { okN++; console.log(`  ✓ ${m}`); };
const fail = m => { bad++; console.log(`  ✗ ${m}`); };

/* 값싼 픽스처: 사다리 한 칸만 200판 — 규약 검사에 판수는 필요 없다. */
/* ⚑ T97 — 탐침 판수 40 → 200. 재적합으로 세 시드가 «같은 눈금에 겹쳐 찍히는 일»을 막았다.
   ⚑⚑ T104 — 탐침 스펙 «노템 / 챕터 5» → «신화 / 챕터 120». 1번 특전이 «공격력 +20%» → «회피 시 회복»
   으로 바뀌며 노템 챕터 5 가 세 시드 전부 0.0% 로 겹쳐 ② «시드가 물리는가» 를 스스로 침몰시켰기 때문이다.
   ⚑⚑⚑ T103 — 사다리 8점 재적합으로 실험5 의 칸 이름과 챕터가 통째로 바뀌었다(실험5 = 같은 8칸을 **슬롯 0렙**
   으로 다시 보는 진단). 새 사다리는 슬롯 레벨에 크게 기대므로 **슬롯 0렙 관측은 4칸(영웅) 위로 전부 0.0%**
   다 — 실제로 «신화 / 챕터 150» 을 그대로 쓰면 세 시드가 전부 0.0% 로 겹쳐 ② 가 죽는다(T103 이 한 번 밟았다).
   그래서 탐침을 **«일반 풀셋(슬롯0)» 칸 / 챕터 15** 로 옮긴다 — 슬롯 0렙으로 8.5% 라 세 시드가 갈린다.
   ⚠ 탐침 칸이 0.0% 나 100.0% 로 포화하면 ② 가 조용히 죽는다. 재적합 회차마다 그 값을 확인할 것. */
function runSeed(seed) {
  const env = Object.assign({}, process.env, { SEED: String(seed), EXP5_ONLY: '일반 풀셋(슬롯0)', EXP5_N: '200' });
  return execFileSync(process.execPath, ['sim.js', '5'], { cwd: root, env, encoding: 'utf8', maxBuffer: 1 << 26 });
}

console.log('=== 회귀 측정 규약 게이트 (T87 · PLAN §7) ===');

console.log('\n① 결정성 — 같은 시드 = 같은 출력');
{
  const a = runSeed(7), b = runSeed(7);
  a === b
    ? pass('SEED=7 두 런의 출력이 완전히 같다')
    : fail('SEED=7 인데 두 런의 출력이 다르다 — 시드 밖 난수(Date.now·미시드 Math.random·전역 잔재)가 끼었다. 회차 간 비교가 성립하지 않는다');
}

console.log('\n② 시드 유효성 — 다른 시드 = 다른 출력');
{
  const outs = [7, 8, 9].map(runSeed);
  const uniq = new Set(outs).size;
  uniq >= 2
    ? pass(`시드 7·8·9 의 출력이 ${uniq}종 — SEED 가 실제로 스트림에 물린다`)
    : fail('시드 7·8·9 의 출력이 전부 같다 — SEED 가 난수에 물리지 않는다(고정 시드 3벌이 무의미해진다)');
}

console.log('\n③ 채점 판수 상수 (PLAN §7 ↔ sim.js · 리터럴 우회 차단)');
for (const [name, envName, floor, wire] of [
  ['EXP5_SCORE_N', 'EXP5_N', 1000, /N\s*=\s*parseInt\(process\.env\.EXP5_N\s*\|\|\s*String\(EXP5_SCORE_N\)\s*,\s*10\)/],
  /* ⚑ T96 — 실험2(등급 내 폭)는 폐지됐다. 그 자리를 새 과녁 2점(실험1)이 받는다 — 과녁당 1,000판. */
  ['EXP1_SCORE_N', 'EXP1_N', 1000, /N\s*=\s*parseInt\(process\.env\.EXP1_N\s*\|\|\s*String\(EXP1_SCORE_N\)\s*,\s*10\)/],
]) {
  const m = SIM.match(new RegExp(`const ${name}\\s*=\\s*(\\d+)\\s*;`));
  if (!m) { fail(`sim.js 에 \`const ${name}\` 선언이 없다`); continue; }
  Number(m[1]) >= floor
    ? pass(`${name} = ${m[1]} (하한 ${floor} 이상)`)
    : fail(`${name} = ${m[1]} — 하한 ${floor} 아래다. 채점 판수를 내리면 지표가 잡음에 잠긴다`);
  wire.test(SIM)
    ? pass(`${envName} 미지정 시 ${name} 이 그대로 기본 판수가 된다`)
    : fail(`${name} 이 선언만 돼 있고 기본값 자리에는 다른 리터럴이 쓰인다 — 우회다`);
}

console.log('\n④ 러너 tools/regress.js (규약 ①② 배선)');
{
  const m = REG.match(/const DEFAULT_SEEDS\s*=\s*\[([^\]]*)\]/);
  const seeds = m ? m[1].split(',').map(s => s.trim()).filter(Boolean) : [];
  seeds.length >= 3
    ? pass(`기본 고정 시드 ${seeds.length}벌 (${seeds.join('·')})`)
    : fail(`기본 고정 시드가 ${seeds.length}벌 — 규약 ① 은 3벌 이상을 요구한다`);
  const guard = /if\s*\(SEEDS\.length\s*<\s*3\)/.test(REG);
  guard ? pass('REGRESS_SEEDS 로 3벌 미만을 주면 러너가 거부한다')
        : fail('러너가 «시드 3벌 미만» 을 거부하지 않는다 — 규약 ① 이 환경변수로 우회된다');
  const dels = /delete env\.EXP2_N;\s*delete env\.EXP5_N;/.test(REG);
  dels ? pass('러너가 판수 환경변수를 지워 채점 기본값으로 돌린다')
       : fail('러너가 EXP2_N·EXP5_N 을 지우지 않는다 — 규약 ② 가 상속된 환경변수로 우회된다');
  /* ⚑⚑⚑ T120 (주인 확정 2026-09-04 15:3X ①) — 판수와 같은 이유로 **자(尺)**도 상속되면 안 된다. */
  /delete env\.EXP1_PERKMODE;/.test(REG)
    ? pass('러너가 EXP1_PERKMODE 를 지워 «기준 플레이어» 자로 돌린다 (T120)')
    : fail('러너가 EXP1_PERKMODE 를 지우지 않는다 — 회귀 표가 3택 자로 찍힐 수 있다(T120 ① 위반)');
  const parsers = ['1', '2', '5'].filter(e => new RegExp(`'${e}':\\s*parse`).test(REG));
  parsers.length === 3
    ? pass('실험1·2·5 세 실험을 모두 파싱한다')
    : fail(`파서가 실험 ${parsers.join('·') || '없음'} 만 있다 — 규약은 실험1·2·5 를 대상으로 한다`);
}

/* ⚑⚑⚑ T120 신설 — 자(尺) 고정. ①~④ 가 «같은 난수로 재는가» 를 봤다면 이 절은 «같은 플레이어로 재는가» 를 본다.
   T119 가 3택·새 특전 조건으로 사다리를 다시 맞췄다가 주인이 «맞추라 한 적이 없다» 며 되돌린 자리다 —
   자가 조용히 바뀌면 적 스탯이 그 자를 따라가고, 그것을 막는 것이 이 검사다. */
console.log('\n⑥ 자(尺) 고정 — 사다리는 «기준 플레이어» 로만 잰다 (T120)');
{
  /const\s+PERK_MODE_PLAY\s*=\s*'3pick'\s*,\s*PERK_MODE_LADDER\s*=\s*'base10'/.test(SIM)
    ? pass('sim.js 에 자 두 개(PERK_MODE_PLAY · PERK_MODE_LADDER)가 선언돼 있다')
    : fail('sim.js 에 PERK_MODE_PLAY/PERK_MODE_LADDER 선언이 없다');
  /const\s+EXP1_PERKMODE\s*=\s*process\.env\.EXP1_PERKMODE\s*\|\|\s*PERK_MODE_LADDER/.test(SIM)
    ? pass('실험1 기본 자 = PERK_MODE_LADDER (EXP1_PERKMODE 는 참고표 전용 덮어쓰기)')
    : fail('실험1 기본 자가 PERK_MODE_LADDER 가 아니다 — 사다리를 다른 조건으로 재고 있다');
  /perkMode\s*:\s*opts\.perkMode\s*\|\|\s*PERK_MODE_PLAY/.test(SIM)
    ? pass('runChapter 기본값은 3택 — 게임 동작은 자에 물들지 않는다')
    : fail('runChapter 기본값이 3택이 아니다 — 자가 게임 동작까지 덮는다');
}

console.log('\n⑤ PLAN §7 규약 문면');
{
  const at = PLAN.indexOf('회귀 측정 규약');
  const sec = at < 0 ? '' : PLAN.slice(at, at + 2000);
  /* ⚑ 조항 번호에 붙여서 본다 — «①» 없이 낱말만 찾으면 바로 아래 게이트 설명 문장(«ⓓ 러너의 고정 시드
     3벌 이상»)이 대신 걸려서, 정작 규약 ① 을 지워도 초록이던 구멍이 있었다(이 게이트의 음성 검사 N8). */
  const has = re => re.test(sec);
  at >= 0
    ? pass('PLAN §7 에 «회귀 측정 규약» 절이 있다')
    : fail('PLAN §7 에서 «회귀 측정 규약» 절이 사라졌다');
  has(/①\s*\*\*고정 시드 3벌 이상\*\*/) ? pass('규약 ① 고정 시드 3벌 이상') : fail('규약 ① 문면이 없다(«① **고정 시드 3벌 이상**»)');
  has(/②[^\n]*EXP1_SCORE_N[^\n]*EXP5_SCORE_N/) ? pass('규약 ② 채점 판수 상수 2종') : fail('규약 ② 문면이 없다(«② … EXP1_SCORE_N … EXP5_SCORE_N»)');
  has(/③[^\n]*\*\*원시 출력에서 그대로 복사\*\*/) ? pass('규약 ③ 원시 출력 그대로 복사') : fail('규약 ③ 문면이 없다(«③ … **원시 출력에서 그대로 복사**»)');
}

console.log(`\n결과: ${okN} 통과 · ${bad} 실패`);
process.exit(bad ? 1 : 0);
