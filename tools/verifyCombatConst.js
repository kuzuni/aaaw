'use strict';
/* 전투 코어 상수 ↔ PLAN 대조 게이트 (T27 신설)
   사용: node tools/verifyCombatConst.js        (불일치·미문서화가 있으면 exit 1)

   왜 필요한가: 기존 게이트 5종이 이 축을 한 항목도 보지 않는다.
     - verifyPlanConst(T16) 48항목 = 전부 경제·적 성장·장비 계수. 전투 물리/타이밍 0항목.
     - verifyOptText(T17) = 특전·옵션 «설명문» 숫자. verifySaturation(T19) = 효과 포화.
     - verifyPerkGearDup(T24) = 특전↔장비 px 중복. verifyPerkPolicy(T25) = 특전 선택 정책·이벤트 보상.
   그런데 T23 이 실측했듯 «벽» 의 정체는 난이도가 아니라 «죽이는 데 걸리는 시간» 이고,
   그 시간을 정하는 것이 바로 이 축(이동속도·사거리·공격 쿨·투사체 속도·적 배치 간격)이다.
   T2 는 PLAN 을 보고 index.html 로 이식하므로, PLAN 에 없는 상수는 게임에 안 들어가거나
   이식자가 임의로 지어낸 값이 들어간다 — T23(maxT=900)이 이미 그 실패 모드를 한 건 보여줬다.

   검사 두 가지:
     ① 대조 — PLAN 에 적힌 전투 상수와 엔진 상수가 같은가.
     ② 미문서화 — 엔진에는 있는데 PLAN 어디에도 값이 없는 전투 코어 상수가 있는가.
        (②는 KNOWN 에 «등재된 것» 만 통과시킨다. 신규로 생기면 exit 1.)

   sim.js 는 require 하면 실험이 돌아버리므로(하단 CLI 디스패처) 소스 텍스트를 파싱한다. */

const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const SIM=fs.readFileSync(path.join(root,'sim.js'),'utf8');
const PLAN=fs.readFileSync(path.join(root,'PLAN.md'),'utf8');

let bad=0, okN=0;
const fail=(m)=>{bad++;console.log('  ❌ '+m);};
const pass=(m)=>{okN++;console.log('  ✓ '+m);};

/* 엔진 소스에서 정규식으로 숫자 1개를 뽑는다. 못 찾으면 «파싱 실패» 로 즉시 불합격 —
   코드 모양이 바뀌었을 때 조용히 통과하지 않게 하려는 것(T25 게이트와 같은 방침). */
function eng(re,what){
  const m=SIM.match(re);
  if(!m) return {err:`엔진에서 «${what}» 를 못 찾았다 (코드 모양이 바뀌었나 — 게이트를 고칠 것)`};
  return {v:Number(m[1])};
}
function planHas(re){ return PLAN.match(re); }

/* ---------- ① PLAN 문서값 ↔ 엔진 대조 ---------- */
/* [항목, 엔진 정규식, PLAN 정규식(캡처 1개), PLAN 위치] */
const CHECKS=[
  ['플레이어 이동속도',     /p\.worldX\+=(\d+)\*p\.walkMul\*dt/,        /속도 `(\d+)\*walkMul`/,                    '§2.3'],
  ['플레이어 정지 거리',    /if\(dist>(\d+)\)\{p\.worldX/,              /가장 가까운 적이 (\d+)px 안이면/,           '§2.3'],
  ['플레이어 공격 쿨',      /p\.atkTimer\+=([\d.]+);playerStrike/,      /공격당 ([\d.]+) 쿨/,                        '§2.3'],
  ['적 근접 사거리',        /const d=e\.worldX-p\.worldX;[\s\S]{0,80}?if\(d<(\d+)\)/, /플레이어가 (\d+)px 안에 오면/, '§2.3'],
  ['적 근접 공격 쿨',       /e\.atkTimer\+=e\.isBoss\?[\d.]+:([\d.]+)/, /그 자리에서 공격\(쿨 ([\d.]+)s\)/,          '§2.3'],
  ['원거리 적 비율',        /const ranged=Math\.random\(\)<([\d.]+)&&j>0/, /원거리 적\((\d+)% 확률/,                 '§2.3', 100],
  ['원거리 적 사거리',      /\}else if\(d<(\d+)&&d>\d+\)\{/,            /(\d+)px 안에서 화살 발사/,                  '§2.3'],
  ['원거리 적 공격 쿨',     /e\.atkTimer\+=([\d.]+);G\.arrows\.push/,   /화살 발사\(쿨 ([\d.]+)s/,                   '§2.3'],
  ['적 화살 속도',          /a\.x-=(\d+)\*dt/,                          /화살 속도 (\d+)\)/,                        '§2.3'],
  ['적 배치 간격',          /worldX:x\+j\*(\d+)/,                       /적 간격 (\d+)px/,                          '§2.3'],
  ['보스 강타 주기',        /e\.hits%(\d+)===0/,                        /(\d+)번째 공격마다 강타/,                   '§2.3'],
  ['보스 강타 배수',        /e\.hits%\d+===0\)dm\*=([\d.]+)/,           /강타\(x([\d.]+)/,                           '§2.3'],
  /* ⚑ T35: «maxSh = maxHp*0.8» 파생은 주인 지시로 폐기됐다 — 실드는 독립 기여축이다(§11.5-a).
     대조 대상을 «파생 배수» 에서 «노템 기본 실드» 로 교체한다. */
  ['기본 실드(노템)',       /pSh0:(\d+)/,                              /기본 실드는 노템 (\d+)/,                         '§2.3'],
  ['방어력 상한',           /effDef=p=>Math\.min\((\d+),/,              /`effDef`\(상한 (\d+)\)/,                    '§4'],
  ['회피 상한',             /return Math\.min\((\d+),e\)/,              /`effEvade`\(lastStand 포함, 상한 (\d+)\)/,  '§4'],
  ['반격 데미지 계수',      /const cd=effDmg\(p\)\*([\d.]+)\*\(1\+px\.counterX\)/, /반격 데미지 `effDmg\*([\d.]+)\*/, '§4'],
  ['랜덤 타겟 사거리',      /return d>-\d+&&d<(\d+);/,                  /플레이어 앞 (\d+)px 이내/,                  '§4'],
  ['웨이브 최소 수',        /let waveCount=(\d+)\+\(rnd/,               /웨이브 수: (\d+)~\d+개/,                    '§2.4'],
  ['웨이브 적 수(소)',      /let size=rnd\(\)<[\d.]+\?(\d+):\d+/,       /웨이브당 적 (\d+)마리 또는 \d+마리/,        '§2.4'],
  ['웨이브 적 수(대)',      /let size=rnd\(\)<[\d.]+\?\d+:(\d+)/,       /웨이브당 적 \d+마리 또는 (\d+)마리/,        '§2.4'],
  /* ⚑ 주인 확정 제약(2026-09-02 14:2X)으로 «이벤트 가중치 45/30/25» 두 항목은 대상 소멸 — 아래 두 항목으로 대체.
     악마=1·천사=1 은 값이 아니라 구조라 PLAN 문장과 대조할 숫자가 없어 verifyT2 ⑧ 이 전 300 챕터 전수로 본다. */
  ['적 총 수 상한',         /const LAYOUT_MAXENEMY=(\d+);/,             /적 총 수 최대 (\d+)마리/,                   '§2.4'],
  ['쉼터 상한',             /clamp\(waveCount-3,1,(\d+)\)/,             /쉼터 1~(\d+)개/,                            '§2.4'],
  /* ⚑ 주인 지시(2026-09-02 15:0X, 승인 24번 종결): 창 관통 8마리 상한은 «누락된 스펙 구현» 이다.
     T34 가 실측한 대로 상한이 없으면 12마리 웨이브에서 총출력 162배가 되고 앵커 A 가 5.3%→100% 로 무너진다.
     신화 m_spear200 은 데미지만 올리고 관통 수는 건드리지 않으므로 이 값은 상수 하나로 족하다. */
  ['창 관통 상한',          /type:'spear',[^}]*pierce:(\d+)/,           /일직선 (\d+)명 거리/,                        '§3.3'],
  /* ⚑ 주인 확정(2026-09-02 15:4X, T43): 적 전원 회피 10%. 튜닝 노브가 아니라 «주인 확정 상수» 라
     TUNE 밖 최상위 const 로 둔다 — 여기서 PLAN §2.3 문장과 직접 대조한다(엔진 0.10 ↔ PLAN 10%). */
  ['적 회피율',             /const ENEMY_EVADE=([\d.]+);/,             /적 전원 회피율 (\d+)% 고정/,                 '§2.3', 100],
];

console.log('=== ① PLAN 전투 상수 ↔ 엔진 대조 ===');
for(const [name,engRe,planRe,where,mul,mode] of CHECKS){
  const e=eng(engRe,name);
  if(e.err){ fail(`${name}: ${e.err}`); continue; }
  const m=planHas(planRe);
  if(!m){ fail(`${name}: PLAN ${where} 에서 문서값을 못 찾았다 (문구가 바뀌었나)`); continue; }
  /* devil 은 PLAN 이 45/30/25 로 «구간» 을, 엔진이 0.75 로 «누적» 을 적어 서로 표기가 다르다 */
  const planV = mode==='cum2' ? Number(m[1])+Number(m[2]) : Number(m[1]);
  const engV  = e.v*(mul||1);
  if(Math.abs(planV-engV) > 1e-9) fail(`${name}: PLAN ${where} «${planV}» ↔ 엔진 «${engV}»`);
  else pass(`${name} = ${engV} (PLAN ${where})`);
}

/* ---------- ② PLAN 에 값이 없는 전투 코어 상수 ---------- */
/* KNOWN = 이미 PROGRESS 에 등재된 건. 여기 없는 새 항목이 나오면 불합격. */
const KNOWN={
  'maxT(전투 제한시간)':'T23 / 승인 대기 18번 — PLAN 에 전투 제한시간 항목 자체가 없다. 채점 2점(90·300 벽)을 이 상수가 지배한다',
  'pCritF0(기본 치명타 배율)':'T27 / 승인 대기 22번 — mkPlayer 하드코딩. PLAN §2.3 은 스탯 이름만 적고 기본값을 안 적는다',
  'pDef0(기본 방어력)':'T27 / 승인 대기 22번 — 같음. 실측상 실험3 1~20 ↔ 앵커 C 를 동시에 지배하는 축',
  'pCounter0(기본 반격 확률)':'T27 / 승인 대기 22번 — 같음',
  'pEvade0(기본 회피)':'T27 / 승인 대기 22번 — 같음. pDef0 와 함께 앵커 C 를 밴드 밖으로 밀어낸다',
};
/* [항목, 엔진 정규식, PLAN 에 그 값이 있으면 매칭될 정규식] */
const UNDOC=[
  ['maxT(전투 제한시간)',        /const maxT=(\d+);/,                                  /제한\s*시간|타임아웃|maxT/],
  ['pCritF0(기본 치명타 배율)',  /critR:TUNE\.pCrit0, critF:(\d+),/,                   /기본 치명타 배율[^\n]*\d/],
  ['pDef0(기본 방어력)',         /\n\s*def:(\d+), counter:\d+, evade:\d+, steal:0,/,   /기본 방어력[^\n]*\d/],
  ['pCounter0(기본 반격 확률)',  /\n\s*def:\d+, counter:(\d+), evade:\d+, steal:0,/,   /기본 반격[^\n]*\d/],
  ['pEvade0(기본 회피)',         /\n\s*def:\d+, counter:\d+, evade:(\d+), steal:0,/,   /기본 회피[^\n]*\d/],
];
console.log('\n=== ② 엔진에만 있고 PLAN 에 값이 없는 전투 코어 상수 ===');
let undocNew=0, undocKnown=0;
for(const [name,engRe,planRe] of UNDOC){
  const e=eng(engRe,name);
  if(e.err){ fail(`${name}: ${e.err}`); continue; }
  if(planHas(planRe)){ pass(`${name} = ${e.v} — PLAN 에 문서화됨`); continue; }
  if(KNOWN[name]){ undocKnown++; console.log(`  🔵 ${name} = ${e.v} — PLAN 에 값 없음`); console.log(`        └ 등재됨: ${KNOWN[name]}`); }
  else { undocNew++; fail(`${name} = ${e.v} — PLAN 에 값이 없고 PROGRESS 에도 미등재 (신규)`); }
}

console.log(`\n대조 ${CHECKS.length}항목 · 일치 ${okN}개 · 불일치 ${bad}건 · 미문서화 신규 ${undocNew}건 · 등재된 기존 ${undocKnown}건`);
console.log(bad?'→ 불합격':'→ 통과');
process.exit(bad?1:0);
