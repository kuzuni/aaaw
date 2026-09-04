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
  /* T45 성능 가드 — 주인 위임 기본값. 밸런스 노브가 아니라 프레임 보호 장치라 PLAN §4 에 값이 박혀 있어야 한다
     (두 파일 사이 일치는 verifyT2 ⑳, 실제 동작은 아래 ③ 이 본다). */
  ['투사체 상한(PROJ_CAP)',      /PROJ_CAP=(\d+)/,                          /`PROJ_CAP` = \*\*(\d+)\*\*/,            '§4'],
  ['틱 트리거 예산(PROC_TICK_CAP)',/PROC_TICK_CAP=(\d+)/,                    /`PROC_TICK_CAP` = \*\*(\d+)\*\*/,       '§4'],
  ['플레이어 이동속도',     /p\.worldX\+=(\d+)\*p\.walkMul\*dt/,        /속도 `(\d+)\*walkMul`/,                    '§2.3'],
  ['플레이어 정지 거리',    /if\(dist>(\d+)\)\{p\.worldX/,              /가장 가까운 적이 (\d+)px 안이면/,           '§2.3'],
  ['플레이어 공격 쿨',      /p\.atkTimer\+=([\d.]+);playerStrike/,      /공격당 ([\d.]+) 쿨/,                        '§2.3'],
  ['적 근접 사거리',        /const d=e\.worldX-p\.worldX;[\s\S]{0,240}?if\(d<(\d+)\)/, /플레이어가 (\d+)px 안에 오면/, '§2.3'],
  /* ⚑ P1(T83) — 🥶 위압의 오라·⛓️ 둔화가 «간격 배수»(ivm)를 곱하게 되면서 리터럴이 괄호 안으로 들어갔다 */
  ['적 근접 공격 쿨',       /e\.atkTimer\+=\(e\.isBoss\?[\d.]+:([\d.]+)\)\*ivm/, /그 자리에서 공격\(쿨 ([\d.]+)s\)/,   '§2.3'],
  /* ⚑⚑⚑ T114 — «각 적 40% 독립 굴림»(RANGED_P) 은 폐기됐다. 원거리는 이제 마릿수 곡선 `RANGED_CURVE`
     세 값이 정한다 — PLAN §2.3 문장의 세 숫자와 각각 대조한다(적 수 곡선 ENEMY_CURVE 와 같은 수법). */
  ['원거리 곡선 비율',      /const RANGED_CURVE=\{zeroUntil:\d+, rate:([\d.]+),/,             /굴림 대상의 (\d+)%/,      '§2.3', 100],
  ['원거리 곡선 0구간',     /const RANGED_CURVE=\{zeroUntil:(\d+),/,                          /(\d+)챕터까지 원거리 0/,   '§2.3'],
  ['원거리 곡선 흔들림',    /const RANGED_CURVE=\{zeroUntil:\d+, rate:[\d.]+, jitter:(\d+)\}/, /흔들림 ± (\d+)/,          '§2.3'],
  ['원거리 적 사거리',      /\}else if\(d<(\d+)&&d>\d+\)\{/,            /(\d+)px 안에서 화살 발사/,                  '§2.3'],
  ['원거리 적 공격 쿨',     /e\.atkTimer\+=([\d.]+)\*ivm;G\.arrows\.push/, /화살 발사\(쿨 ([\d.]+)s/,                '§2.3'],
  ['적 화살 속도',          /a\.x-=(\d+)\*dt/,                          /화살 속도 (\d+)\)/,                        '§2.3'],
  ['적 배치 간격',          /worldX:x\+j\*(\d+)/,                       /적 간격 (\d+)px/,                          '§2.3'],
  ['보스 강타 주기',        /e\.hits%(\d+)===0/,                        /(\d+)번째 공격마다 강타/,                   '§2.3'],
  ['보스 강타 배수',        /e\.hits%\d+===0\)dm\*=([\d.]+)/,           /강타\(x([\d.]+)/,                           '§2.3'],
  /* ⚑ T35: «maxSh = maxHp*0.8» 파생은 주인 지시로 폐기됐다 — 실드는 독립 기여축이다(§11.5-a).
     대조 대상을 «파생 배수» 에서 «노템 기본 실드» 로 교체한다. */
  ['기본 실드(노템)',       /pSh0:(\d+)/,                              /기본 실드는 노템 (\d+)/,                         '§2.3'],
  ['방어력 상한',           /const effDef=p=>Math\.min\((\d+),/,          /`effDef`\(상한 (\d+)\)/,                    '§4'],
  ['회피 상한',             /return Math\.min\((\d+),e\)/,              /`effEvade`\(lastStand 포함, 상한 (\d+)\)/,  '§4'],
  ['반격 데미지 계수',      /const cd=effDmg\(p\)\*([\d.]+)\*\(1\+px\.counterX\)/, /반격 데미지 `effDmg\*([\d.]+)\*/, '§4'],
  ['랜덤 타겟 사거리',      /return d>-\d+&&d<(\d+);/,                  /플레이어 앞 (\d+)px 이내/,                  '§4'],
  /* ⚑⚑ T96 4단계 — 챕터 구성이 «전 챕터 고정» 이 되면서 제비뽑기 3항목이 상수 2개로 바뀌었다.
     전수 구성·챕터별 특전 개수(⚑ T107 로 «완주 = 10개» 는 폐기 · 1~5=6·15=7·28=8·38+=9)는
     전용 게이트 `tools/verifyChapterFixed.js` 가 본다. */
  ['웨이브 수(고정)',       /const LAYOUT_WAVES=(\d+),/,                /웨이브 (\d+)개 · 챕터별 적 수 곡선/,       '§2.4'],
  /* ⚑⚑⚑ T107 — «웨이브당 15마리» 상수(LAYOUT_WAVE_SIZE)는 챕터별 적 수 곡선으로 대체됐다.
     곡선 상수 3개(ENEMY_CURVE)를 PLAN §2.4 문장과 직접 대조한다. */
  ['적 수 곡선 초반(1~5)',  /const ENEMY_CURVE=\{early:(\d+),/,         /1~5챕터는 (\d+)마리/,                      '§2.4'],
  ['적 수 곡선 증가 시작',  /const ENEMY_CURVE=\{early:\d+, from:(\d+),/, /(\d+)챕터부터 챕터당 \+1/,               '§2.4'],
  ['적 수 곡선 상한',       /const ENEMY_CURVE=\{early:\d+, from:\d+, cap:(\d+)\}/, /상한 (\d+)마리/,               '§2.4'],
  /* ⚑ 주인 확정 제약(2026-09-02 14:2X)으로 «이벤트 가중치 45/30/25» 두 항목은 대상 소멸 — 아래 두 항목으로 대체.
     악마=1·천사=1 은 값이 아니라 구조라 PLAN 문장과 대조할 숫자가 없어 verifyT2 ⑧ 이 전 300 챕터 전수로 본다. */
  ['적 총 수 상한',         /const LAYOUT_MAXENEMY=(\d+);/,             /상한 (\d+) 이내/,                          '§2.4'],
  ['쉼터 수(고정)',         /LAYOUT_RESTS=(\d+);/,                      /쉼터 \*\*(\d+) \(고정\)\*\*/,               '§2.4'],
  /* ⚑ 주인 지시(2026-09-02 15:0X, 승인 24번 종결): 창 관통 8마리 상한은 «누락된 스펙 구현» 이다.
     T34 가 실측한 대로 상한이 없으면 12마리 웨이브에서 총출력 162배가 되고 앵커 A 가 5.3%→100% 로 무너진다.
     신화 m_spear200 은 데미지만 올리고 관통 수는 건드리지 않으므로 이 값은 상수 하나로 족하다. */
  /* ⚑ P1(T83) — 창 관통은 상수 SPEAR_PIERCE 로 올라갔고 PLAN 문면도 §3.0 «일직선 최대 8마리» 로 바뀌었다 */
  ['창 관통 상한',          /const R_AXE=[\d.]+[^\n]*\n[^\n]*SPEAR_PIERCE=(\d+);/, /일직선 최대 \*\*(\d+)마리\*\* 관통/, '§3.0'],
  /* ⚑ 주인 확정(2026-09-02 15:4X, T43): 적 전원 회피 10%. 튜닝 노브가 아니라 «주인 확정 상수» 라
     TUNE 밖 최상위 const 로 둔다 — 여기서 PLAN §2.3 문장과 직접 대조한다(엔진 0.10 ↔ PLAN 10%). */
  ['적 회피율',             /const ENEMY_EVADE=([\d.]+);/,             /적 전원 회피율 (\d+)% 고정/,                 '§2.3', 100],
  /* ⚑ 주인 확정(2026-09-03, T72): 플레이어 기본 스탯 6종. 노브가 아니라 확정 상수다.
     넷(치배·반격·방어·회피)은 종전에 mkPlayer 리터럴이라 PLAN 에 값이 없었고 아래 ② 가
     «미문서 상수» 로 등재만 하고 있었다(T27 · 승인 대기 22번). 주인이 값을 정하면서
     TUNE 으로 올라왔고, 이제 PLAN §2.3 표와 직접 대조한다 — ② 에서는 빠졌다. */
  ['기본 공격속도',         /pAspd0:([\d.]+),/,                        /\| 공격속도 \| ([\d.]+) \/s \|/,          '§2.3'],
  ['기본 치명타 확률',      /pCrit0:(\d+),/,                           /\| 치명타 확률 \| (\d+)% \|/,             '§2.3'],
  ['기본 치명타 배율',      /pCritF0:(\d+),/,                          /\| 치명타 데미지 \| (\d+)% \|/,           '§2.3'],
  ['기본 반격 확률',        /pCounter0:(\d+),/,                        /\| 반격 확률 \| (\d+)% \|/,               '§2.3'],
  ['기본 방어력',           /pDef0:(\d+),/,                            /\| 방어력 \| (\d+) \|/,                   '§2.3'],
  ['기본 회피',             /pEvade0:(\d+),/,                          /\| 회피 \| (\d+) \|/,                     '§2.3'],
  /* ⚑ 주인 확정(2026-09-02 17:0X, T47): 레벨업 필요 경험치 `4+2*Lv` → `4+4*Lv`.
     PLAN 문장에는 폐기된 식이 취소선으로 함께 남아 있으므로, «주인 확정» 표기가 붙은 쪽만 골라 대조한다. */
  /* ⚑⚑⚑ T100 — 곡선 모양이 «기본 + 증분·Lv» 에서 «증분·Lv + 기본» 으로 바뀌었다(`4+3*lv` → `5*lv+1`).
     대조 축은 그대로 둘(증분·기본)이고 읽는 자리만 옮겼다. */
  ['레벨업 필요경험치 증분', /expNeed:lv=>(\d+)\*lv\+\d+/,             /T100\): `(\d+)\*Lv\+\d+`/,                   '§2.4'],
  ['레벨업 필요경험치 기본', /expNeed:lv=>\d+\*lv\+(\d+)/,             /T100\): `\d+\*Lv\+(\d+)`/,                   '§2.4'],
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
};
/* [항목, 엔진 정규식, PLAN 에 그 값이 있으면 매칭될 정규식] */
const UNDOC=[
  ['maxT(전투 제한시간)',        /const maxT=(\d+);/,                                  /제한\s*시간|타임아웃|maxT/],
  /* ⚑ T72 — 넷(치배·반격·방어·회피)은 주인 확정(2026-09-03)으로 PLAN §2.3 표에 값이 생겨
     ① 로 옮겨 갔다. 승인 대기 22번 종결. 여기 남은 것은 maxT 하나뿐이다. */
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

/* ---------- ②-b 기본 스탯이 mkPlayer 리터럴로 되돌아가지 않았는가 (T72) ---------- */
/* 왜 — 이 넷이 리터럴이던 시절이 정확히 «PLAN 에 값이 없다» 의 원인이었다(T27).
   TUNE 을 안 거치고 다시 숫자를 박으면 ① 은 TUNE 만 보므로 조용히 통과한다. */
console.log('\n=== ②-b 기본 스탯 단일 출처 (mkPlayer ↔ TUNE) ===');
{
  const HTML2=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const want=[['치명타 배율','critF:TUNE.pCritF0'],['방어력','def:TUNE.pDef0'],
              ['반격 확률','counter:TUNE.pCounter0'],['회피','evade:TUNE.pEvade0'],
              ['치명타 확률','critR:TUNE.pCrit0'],['공격속도','aspd:TUNE.pAspd0']];
  for(const [nm,frag] of want){
    const inSim=SIM.includes(frag), inHtml=HTML2.includes(frag);
    if(inSim&&inHtml) pass(`${nm} — 두 파일 mkPlayer 가 «${frag}» 를 쓴다`);
    else fail(`${nm} — «${frag}» 누락 (sim ${inSim?'OK':'✗'} · index.html ${inHtml?'OK':'✗'}) — 리터럴로 되돌아갔나`);
  }
  /* 두 파일의 TUNE 기본 스탯 줄이 글자 그대로 같은가 */
  const line=/pAtk0:\d+, pHp0:\d+, pSh0:\d+, pAspd0:[\d.]+, pCrit0:\d+, pCritF0:\d+, pCounter0:\d+, pDef0:\d+, pEvade0:\d+,/;
  const a=SIM.match(line), b=HTML2.match(line);
  (a&&b&&a[0]===b[0]) ? pass(`두 파일 기본 스탯 줄 일치 — ${a?a[0]:''}`)
                      : fail(`두 파일 기본 스탯 줄이 다르다 — sim «${a?a[0]:'없음'}» / index.html «${b?b[0]:'없음'}»`);
}

/* ---------- ③ 소환 적중 = «공격» 트리거 — 실행 단언 (주인 확정 15:3X · T45) ---------- */
/* 정적 대조(두 파일 같은 동사·같은 상수)는 verifyT2 ⑳ 이 본다. 여기서는 «실제로 굴러가는가» 를 본다:
   소환 적중 한 번이 procOnAttack 을 굴리는지, 기본공격 전용 3종이 소환으로 새지 않는지.
   sim.js 는 CLI 디스패처 앞까지 잘라 vm 에서 평가한다(verifyHarness·verifyGearEcon 과 같은 방식). */
console.log('\n=== ③ 소환 적중 트리거 (PLAN §4 주인 확정 15:3X · T45) ===');
{
  const vm=require('vm');
  const CUT="const mode=process.argv[2]||'all';";
  const at=SIM.indexOf(CUT);
  if(at<0) fail('sim.js 에서 CLI 디스패처를 못 찾았다 — 잘림 기준이 바뀌었다');
  else{
    /* ⚑ T51 — 난수 고정. 이 블록의 단언은 «한 번 때렸을 때 무슨 일이 일어나는가» 라서
       적 회피 10%(ENEMY_EVADE · 주인 확정 15:4X)가 그대로 들어오면 **10판에 한 번 빨개진다**
       (실제로 HEAD 상태 8런 중 1런이 «투사체 상한» 항목에서 실패했다 — T51).
       vm 컨텍스트에만 Math.random 을 갈아 끼운다(Object.create 라 게이트 프로세스의 Math 는 그대로).
       RNG.v 를 바꾸면 «맞았을 때/빗맞았을 때» 를 골라 재현할 수 있다 — (6) 이 그 대조군이다. */
    const RNG={v:0.5};                                   /* 0.5 > ENEMY_EVADE(0.10) → 항상 명중 */
    const FakeMath=Object.create(Math); FakeMath.random=()=>RNG.v;
    const ctx={console:{log(){}},process,Math:FakeMath,JSON,Number,String,Array,Set,Map,Object,Date,parseInt,parseFloat,isFinite,isNaN,require};
    vm.createContext(ctx);
    vm.runInContext(SIM.slice(0,at)+
      '\n;globalThis.__X={summonHit,pushProj,dealDmg,procOnAttack,PROJ_CAP,PROC_TICK_CAP};',ctx);
    const X=ctx.__X||ctx.globalThis.__X;
    /* 최소 가짜 전장: 적 1마리 · 플레이어는 «공격 시 확정 공격력 +1%»(atkPerm ×100 = 확률 10 → 확정)만 가진다.
       atkPerm 은 타겟·사거리와 무관해 «트리거가 굴었는가» 를 p.dmg 변화 하나로 관측할 수 있다. */
    const mkG=()=>{
      const e={worldX:100,hp:1e12,maxHp:1e12,dead:false,isBoss:false};
      const p={worldX:0,dmg:100,px:{atkPerm:100},nextCrit:false,nextAtk:0,
               buffs:{atk:[],aspd:[],critR:[],critF:[],def:[],evade:[]},
               sh:0,maxSh:0,hp:100,maxHp:100,steal:0,goldMul:1,level:1,exp:0,
               critR:0,critF:150,def:0,evade:0,counter:0,atkTimer:1,aspd:1,walkMul:1,killHeal:0};
      const G={chapter:1,player:p,nodes:[{enemies:[e]}],pprojs:[],arrows:[],gold:0,kills:0,procN:0,
               t:0,taken:[],cleared:false,dead:false,perkChances:0,autoBoltT:2,overBoltCd:0};
      p.G=G; return {G,p,e};
    };
    /* (1) 소환 적중이 «공격 시» 트리거를 굴린다 */
    {
      const {G,p,e}=mkG(); const d0=p.dmg;
      X.summonHit(G,e,0.75);
      p.dmg>d0 ? pass('소환 적중 1회 → «공격 시» 트리거가 굴었다 (창이 창을 부르는 연쇄의 전제)')
               : fail('소환 적중이 «공격 시» 트리거를 안 굴린다 — 주인 확정 15:3X 위반');
    }
    /* (2) 소환 적중은 nextCrit / nextAtk 를 소모하지 않는다 (기본공격 전용 잔존) */
    {
      const {G,p,e}=mkG(); p.nextCrit=true; p.nextAtk=0.5;
      X.summonHit(G,e,0.75);
      (p.nextCrit===true&&p.nextAtk===0.5)
        ? pass('소환 적중이 nextCrit·nextAtk 를 소모하지 않는다 (기본공격 전용 잔존)')
        : fail(`소환 적중이 기본공격 전용 자원을 먹었다 — nextCrit ${p.nextCrit} · nextAtk ${p.nextAtk}`);
    }
    /* (3) 성능 가드 ① — 한 틱 트리거 예산(PROC_TICK_CAP)을 넘기면 데미지는 그대로, 트리거만 멈춘다 */
    {
      const {G,p,e}=mkG(); G.procN=X.PROC_TICK_CAP;
      const d0=p.dmg, hp0=e.hp;
      X.summonHit(G,e,0.75);
      (p.dmg===d0&&e.hp<hp0)
        ? pass(`틱 예산 ${X.PROC_TICK_CAP} 초과 시 트리거만 멈추고 데미지는 그대로 들어간다`)
        : fail('틱 예산 초과 처리가 스펙과 다르다 (데미지까지 사라지거나 트리거가 계속 굴었다)');
    }
    /* (4) 성능 가드 ② — 투사체 상한 초과분은 «즉발 판정» 으로 대체된다 (데미지가 사라지지 않는다) */
    {
      const {G,p,e}=mkG();
      for(let i=0;i<X.PROJ_CAP;i++)G.pprojs.push({type:'axe',x:0,tgt:e,ratio:0,spd:1});
      const hp0=e.hp, len0=G.pprojs.length;
      X.pushProj(G,{type:'axe',x:0,tgt:e,ratio:0.5,spd:430});
      (G.pprojs.length===len0&&e.hp<hp0)
        ? pass(`투사체 상한 ${X.PROJ_CAP} 초과분이 즉발 판정으로 대체된다 (데미지 유실 없음)`)
        : fail('투사체 상한 초과 처리가 스펙과 다르다 (투사체가 계속 쌓이거나 데미지가 사라졌다)');
    }
    /* (6) 대조군 — 난수를 «빗맞음» 쪽으로 돌리면 같은 타격이 데미지 0 이어야 한다.
       (1)~(4) 가 «항상 명중» 난수에 기대고 있음을 드러내 두는 자리이기도 하다 (T51). */
    {
      const {G,p,e}=mkG(); const hp0=e.hp;
      RNG.v=0.05;                                        /* 0.05 < ENEMY_EVADE(0.10) → 빗맞음 */
      X.summonHit(G,e,0.75);
      RNG.v=0.5;
      e.hp===hp0
        ? pass('난수를 빗맞음 쪽으로 돌리면 소환 적중도 데미지 0 이다 (적 회피 10% 가 소환에도 걸린다)')
        : fail('빗맞음 난수인데 데미지가 들어갔다 — 적 회피 10%(주인 확정 15:4X)가 소환에 안 걸린다');
    }
    /* (5) PLAN §4 에 주인 확정 문구가 살아 있는가 (문서 ↔ 엔진 동시 회귀 방지) */
    planHas(/소환 적중도 «공격» 으로 친다/)
      ? pass('PLAN §4 에 주인 확정 «소환 적중도 공격» 문구가 있다')
      : fail('PLAN §4 에서 «소환 적중도 «공격» 으로 친다» 문구가 사라졌다');
  }
}

/* ---------- ④ 스턴 · 빗맞음 축 — 실행 단언 (주인 지시 15:5X · T48 1단계) ---------- */
/* 정적 대조(두 파일 같은 동사·같은 상수)는 verifyT2 ㉒ 가 본다. 여기서는 «실제로 굴러가는가» 를 본다:
   스턴이 실제 시간을 남기는지(보스는 1/3), 빗맞음 스택이 «적중 1타당 1장 · 한 타에 +100% 한 번» 인지. */
console.log('\n=== ④ 스턴 · 빗맞음 축 (PLAN §3.0·§4 주인 지시 15:5X · T48) ===');
{
  const vm=require('vm');
  const CUT="const mode=process.argv[2]||'all';";
  const at=SIM.indexOf(CUT);
  if(at<0) fail('sim.js 에서 CLI 디스패처를 못 찾았다 — 잘림 기준이 바뀌었다');
  else{
    const ctx={console:{log(){}},process,Math,JSON,Number,String,Array,Set,Map,Object,Date,parseInt,parseFloat,isFinite,isNaN,require};
    vm.createContext(ctx);
    vm.runInContext(SIM.slice(0,at)+
      '\n;globalThis.__Y={applyStun,procOnMiss,dealDmg,STUN_BOSS_MUL,effDmg};',ctx);
    const Y=ctx.__Y||ctx.globalThis.__Y;
    const mkG=(px,boss)=>{
      const e={worldX:100,hp:1e12,maxHp:1e12,dead:false,isBoss:!!boss,stun:0};
      const p={worldX:0,dmg:100,px:Object.assign({},px),nextCrit:false,nextAtk:0,missStk:0,ward:0,repairAmp:0,
               atkN:0,evStk:0,evStreak2:0,evStreak3:0,nextX3:false,nextP200:false,
               comboT:null,comboN:0,rampN:0,lowShieldUsed:false,
               buffs:{atk:[],aspd:[],critR:[],critF:[],def:[],evade:[]},
               sh:0,maxSh:0,hp:100,maxHp:100,steal:0,goldMul:1,level:1,exp:0,healAmp:0,
               critR:0,critF:150,def:0,evade:0,counter:0,atkTimer:1,aspd:1,walkMul:1,killHeal:0};
      const G={chapter:1,player:p,nodes:[{enemies:[e]}],pprojs:[],arrows:[],gold:0,kills:0,procN:0,
               t:0,taken:[],cleared:false,dead:false,perkChances:0,autoBoltT:2,autoSumT:2,rampT:3,overBoltCd:0,
               atkTries:0,miss:0};
      p.G=G; return {G,p,e};
    };
    /* (1) 스턴이 실제로 시간을 남긴다 */
    {
      const {G,e}=mkG({});
      Y.applyStun(G,e,3.0);
      Math.abs(e.stun-3.0)<1e-9 ? pass('applyStun 3초 → 일반 적에게 3초가 남는다')
                                : fail(`applyStun 이 스턴 시간을 남기지 않는다 (e.stun=${e.stun})`);
    }
    /* (2) 보스는 지속 1/3 (주인 명시 — 영구 스턴락 방지) */
    {
      const {G,e}=mkG({},true);
      Y.applyStun(G,e,3.0);
      Math.abs(e.stun-3.0*Y.STUN_BOSS_MUL)<1e-9
        ? pass(`보스 스턴 지속이 ${Y.STUN_BOSS_MUL.toFixed(3)} 배로 줄어든다 (3초 → ${e.stun.toFixed(2)}초)`)
        : fail(`보스 스턴 지속 배수가 안 걸렸다 (e.stun=${e.stun})`);
    }
    /* (3) 재적용은 «더 긴 쪽만» — 짧은 스턴이 긴 스턴을 덮거나 합산되면 안 된다 */
    {
      const {G,e}=mkG({});
      Y.applyStun(G,e,3.0); Y.applyStun(G,e,1.0);
      Math.abs(e.stun-3.0)<1e-9 ? pass('짧은 스턴 재적용이 긴 스턴을 덮지도 합산하지도 않는다')
                                : fail(`스턴 재적용 규칙 위반 (3초 뒤 1초 재적용 → ${e.stun})`);
    }
    /* ⚑ T96 — (4)(5) «빗맞음 스택»(💢 l_missStack) 실행 단언은 그 특전이 폐지되면서 대상이 사라졌다.
       빗맞음 «축» 자체는 살아 있다(장비 옵션 missAtk·missDef·missAspd·missReset·missRush·missSpear) —
       그 축이 실제로 굴러가는지는 위 ③ (6) «빗맞음 난수면 데미지 0» 대조군이 계속 지킨다. */
    /* (6) PLAN 에 주인 지시 문구가 살아 있는가 */
    /* ⚑ P1(T83) — §3.0 이 재작성되면서 문면이 바뀌었다. 두 축이 «트리거 축» 목록과 기절 조항으로 남아 있는지 본다. */
    planHas(/트리거 축: .*빗맞음/)
      ? pass('PLAN §3.0 트리거 축 목록에 «빗맞음» 이 있다')
      : fail('PLAN §3.0 트리거 축 목록에서 «빗맞음» 이 사라졌다');
    planHas(/기절 지속은 3초 또는 6초만/)
      ? pass('PLAN §3.0 에 주인 확정 «기절 지속 3초/6초» 조항이 있다')
      : fail('PLAN §3.0 에서 기절(스턴) 조항이 사라졌다');
  }
}

/* ---------- ⑤ 원거리 피격 축 · 중첩 상한 보너스 — 실행 단언 (주인 16:1X·16:2X · T48 2단계) ---------- */
console.log('\n=== ⑤ 원거리 피격 축 · 고중첩 (PLAN §3.0 주인 16:1X·16:2X · T48) ===');
{
  const vm=require('vm');
  const CUT="const mode=process.argv[2]||'all';";
  const at=SIM.indexOf(CUT);
  if(at<0) fail('sim.js 에서 CLI 디스패처를 못 찾았다 — 잘림 기준이 바뀌었다');
  else{
    const ctx={console:{log(){}},process,Math,JSON,Number,String,Array,Set,Map,Object,Date,parseInt,parseFloat,isFinite,isNaN,require};
    vm.createContext(ctx);
    vm.runInContext(SIM.slice(0,at)+
      '\n;globalThis.__Z={hitPlayer,addBuff};',ctx);
    const Z=ctx.__Z||ctx.globalThis.__Z;
    const mkG=(px)=>{
      const e={worldX:100,hp:1e6,maxHp:1e6,dead:false,isBoss:false,stun:0};
      const p={worldX:0,dmg:100,px:Object.assign({},px),nextCrit:false,nextAtk:0,missStk:0,ward:0,repairAmp:0,healAmp:0,
               atkN:0,evStk:0,evStreak2:0,evStreak3:0,nextX3:false,nextP200:false,
               comboT:null,comboN:0,rampN:0,lowShieldUsed:false,
               buffs:{atk:[],aspd:[],critR:[],critF:[],def:[],evade:[]},
               sh:0,maxSh:1000,hp:1e6,maxHp:1e6,steal:0,goldMul:1,level:1,exp:0,
               critR:0,critF:150,def:0,evade:0,counter:0,atkTimer:1,aspd:1,walkMul:1,killHeal:0};
      const G={chapter:1,player:p,nodes:[{enemies:[e]}],pprojs:[],arrows:[],gold:0,kills:0,procN:0,
               t:0,taken:[],cleared:false,dead:false,perkChances:0,autoBoltT:2,autoSumT:2,rampT:3,overBoltCd:0,
               atkTries:0,miss:0};
      p.G=G; return {G,p,e};
    };
    const rnd=Math.random;
    /* ⚑ T1 R01 — «5스택이면 확정» 을 상수로 박아 두면 c_rangeShield 확률을 튜닝할 때마다 이 게이트가 빨개진다.
       (실제로 R01 이 20% → 10% 로 내리자 0.20*5=1.0 가정이 깨져 ①③ 이 빨개졌다.)
       기저 확률을 sim.js 에서 읽어 «확정이 되는 최소 스택» 을 계산한다 — 튜닝과 무관하게 결정적이다. */
    const RS_BASE=Number((SIM.match(/pkk\(p,([\d.]+)\*px\.rangeShield\)/)||[])[1]);
    const RS_N=RS_BASE>0?Math.ceil(1/RS_BASE):5;
    /* (1) 원거리 피격이 원거리 축을 굴린다 — 확률 100% 로 키워 결정적으로 만든다 */
    {
      const {G,p,e}=mkG({rangeShield:RS_N});   /* RS_BASE*RS_N ≥ 1.0 = 확정 */
      Math.random=()=>0.5;                  /* 회피(evade 0) 는 어차피 안 뜬다 */
      Z.hitPlayer(G,10,false,e);
      Math.random=rnd;
      p.sh>0 ? pass('화살 피격 → 원거리 피격 축이 굴었다')
             : fail('원거리 피격 축이 안 굴었다 — 주인 16:1X 위반');
    }
    /* (2) 근접 피격은 원거리 축을 굴리지 않는다 (별개 축) */
    {
      const {G,p,e}=mkG({rangeShield:RS_N});
      Math.random=()=>0.5;
      Z.hitPlayer(G,10,true,e);
      Math.random=rnd;
      p.sh===0 ? pass('근접 피격은 원거리 축을 굴리지 않는다')
               : fail('근접 피격에도 원거리 축이 굴었다 — 별개 축이 아니게 된다');
    }
    /* (3) 원거리 피격은 «일반 피격 시» 트리거도 함께 굴린다 (주인 위임: 둘 다 굴림) */
    {
      const {G,p,e}=mkG({rangeShield:RS_N,defHitBuff:1});
      Math.random=()=>0.5;
      Z.hitPlayer(G,10,false,e);
      Math.random=rnd;
      (p.sh>0&&p.buffs.def.length>0)
        ? pass('원거리 피격이 일반 «피격 시» 트리거와 원거리 축을 둘 다 굴린다')
        : fail(`원거리 피격에서 한쪽 축이 빠졌다 — 실드 ${p.sh} · 방어버프 ${p.buffs.def.length}`);
    }
    /* (4) 회피에 성공하면 «맞은» 것이 아니라 원거리 축을 굴리지 않는다 */
    {
      const {G,p,e}=mkG({rangeShield:RS_N});
      p.evade=100;
      Math.random=()=>0.0;                  /* 회피 굴림 0 < 100 → 회피 성공 */
      Z.hitPlayer(G,10,false,e);
      Math.random=rnd;
      p.sh===0 ? pass('화살을 회피하면 원거리 축이 굴지 않는다')
               : fail('회피에 성공했는데 원거리 피격 축이 굴었다');
    }
    /* (5) ⚑ 주인 확정 «버프 무한 중첩» — addBuff 는 상한 없이 계속 쌓는다 (구 STACK_BONUS 체계 폐지) */
    {
      const {p}=mkG({});
      for(let i=0;i<20;i++) Z.addBuff(p,'atk',0.05,3);
      p.buffs.atk.length===20
        ? pass('addBuff 가 상한 없이 20개까지 쌓는다 (주인 확정 «무한 중첩»)')
        : fail(`버프 중첩 상한이 되살아났다 — 20번 넣었는데 ${p.buffs.atk.length}개만 남았다`);
    }
    /* (6) PLAN 에 주인 지시 문구가 살아 있는가 */
    planHas(/원거리 피격/)
      ? pass('PLAN §3.0 에 주인 지시 «원거리 피격 트리거 신설» 문구가 있다')
      : fail('PLAN §3.0 에서 «원거리 피격» 축이 사라졌다');
  }
}

/* ---------- ⑥ 횟수형 방어막 — 실행 단언 (주인 17:2X · T48 3단계)
   ⚑ T96 — «회피 즉사»(☠️🌾 사신의 낫)는 그 특전이 폐지되면서 대상이 사라졌다. 방어막은 장비 옵션
   축(wardAtk·wardEvade·wardCrit·wardHit)으로 그대로 살아 있어 아래 단언이 계속 유효하다. ---------- */
console.log('\n=== ⑥ 횟수형 방어막 (PLAN §3.0 주인 17:2X · T48) ===');
{
  const vm=require('vm');
  const CUT="const mode=process.argv[2]||'all';";
  const at=SIM.indexOf(CUT);
  if(at<0) fail('sim.js 에서 CLI 디스패처를 못 찾았다 — 잘림 기준이 바뀌었다');
  else{
    const ctx={console:{log(){}},process,Math,JSON,Number,String,Array,Set,Map,Object,Date,parseInt,parseFloat,isFinite,isNaN,require};
    vm.createContext(ctx);
    vm.runInContext(SIM.slice(0,at)+
      '\n;globalThis.__W={hitPlayer,gainWard};',ctx);
    const W=ctx.__W||ctx.globalThis.__W;
    const mkG=(px,boss)=>{
      const e={worldX:100,hp:1e6,maxHp:1e6,dead:false,isBoss:!!boss,stun:0};
      const p={worldX:0,dmg:100,px:Object.assign({},px),nextCrit:false,nextAtk:0,missStk:0,ward:0,repairAmp:0,healAmp:0,
               atkN:0,evStk:0,evStreak2:0,evStreak3:0,nextX3:false,nextP200:false,
               comboT:null,comboN:0,rampN:0,lowShieldUsed:false,
               buffs:{atk:[],aspd:[],critR:[],critF:[],def:[],evade:[]},
               sh:500,maxSh:500,hp:1000,maxHp:1000,steal:0,goldMul:1,level:1,exp:0,
               critR:0,critF:150,def:0,evade:0,counter:0,atkTimer:1,aspd:1,walkMul:1,killHeal:0};
      const G={chapter:1,player:p,nodes:[{enemies:[e]}],pprojs:[],arrows:[],gold:0,kills:0,procN:0,
               t:0,taken:[],cleared:false,dead:false,perkChances:0,autoBoltT:2,autoSumT:2,rampT:3,overBoltCd:0,
               atkTries:0,miss:0};
      p.G=G; return {G,p,e};
    };
    const rnd=Math.random;
    /* (1) 방어막이 그 타격을 «완전히» 막는다 — 체력도 실드도 안 깎인다 */
    {
      const {G,p,e}=mkG({});
      p.ward=2;
      Math.random=()=>0.99;                 /* 회피 실패 */
      W.hitPlayer(G,300,true,e);
      Math.random=rnd;
      (p.hp===1000&&p.sh===500&&p.ward===1)
        ? pass('방어막 1장이 타격 1회를 완전히 막는다 (체력·실드 무손실, 장수 2 → 1)')
        : fail(`방어막이 타격을 완전히 막지 못했다 — 체력 ${p.hp} · 실드 ${p.sh} · 남은 장수 ${p.ward}`);
    }
    /* (2) 장수가 떨어지면 그 다음 타격은 그대로 들어온다 (5장이면 딱 5번) */
    {
      const {G,p,e}=mkG({});
      p.ward=1;
      Math.random=()=>0.99;
      W.hitPlayer(G,300,true,e);            /* 1장으로 막고 */
      const shAfterBlock=p.sh;
      W.hitPlayer(G,300,true,e);            /* 두 번째는 맞는다 */
      Math.random=rnd;
      (shAfterBlock===500&&p.sh<500&&p.ward===0)
        ? pass('장수가 떨어지면 다음 타격은 그대로 들어온다 («5장이면 5번» 이 성립)')
        : fail(`방어막 소진 후 동작이 스펙과 다르다 — 막은 뒤 실드 ${shAfterBlock} · 그 다음 ${p.sh}`);
    }
    /* (3) ⚑ 주인 확정 «무한» — 방어막 장수에 상한이 없다 */
    {
      const {p}=mkG({wardAtk:1});
      for(let i=0;i<50;i++) W.gainWard(p,1.0);
      p.ward===50
        ? pass('방어막이 상한 없이 50장까지 쌓인다 (주인 확정 «무한»)')
        : fail(`방어막 장수 상한이 되살아났다 — 50번 얻었는데 ${p.ward}장`);
    }
    /* (4) 방어막으로 막아도 «맞은 사건» 은 일어난 것이라 피격 트리거는 굴러간다 (위임 판단, 주인 원문 «데미지 무효») */
    {
      const {G,p,e}=mkG({defHitBuff:1});
      p.ward=1;
      Math.random=()=>0.99;
      W.hitPlayer(G,300,true,e);
      Math.random=rnd;
      p.buffs.def.length>0
        ? pass('막은 타격도 «피격 시» 트리거를 굴린다 (데미지만 무효)')
        : fail('막은 타격이 «피격 시» 트리거를 굴리지 않는다');
    }
    /* ⚑ T96 — (5)~(7) «회피 즉사» 단언은 ☠️🌾 폐지로 대상이 사라져 함께 지웠다. */

    /* (6) PLAN 에 주인 지시 문구가 살아 있는가 */
    /* ⚑ P1(T83) — §3.0 재작성 후 문면. 방어막 무한 조항과 사신의 낫(전용 연출)이 살아 있는지 본다. */
    planHas(/방어막\(ward\) 장수 상한도 없다/) ? pass('PLAN §3.0 에 «방어막 장수 상한 없음» 조항이 있다')
                                             : fail('PLAN §3.0 에서 방어막 무한 조항이 사라졌다');
    /* ⚑ T96 — «사신의 낫»(☠️🌾) 문면 검사는 그 특전이 폐지되면서 대상이 사라졌다. */
  }
}

/* ⚑⚑ T96 (2026-09-03) — ⑦ «반격 연쇄»(🔂 l_counterChain · COUNTER_CHAIN_N) 와
   ⑧ «킬 회복 축»(🍖 c_killHeal2 5% · 💉 l_killHeal5 · 🔰 c_killShield3) 절은 통째로 지웠다.
   특전 132종이 폐지되면서 세 특전과 상수가 함께 사라져 **잴 대상이 없다**(측정 실패가 아니라 대상 소멸).
   두 축의 «엔진 동사» 자체는 장비 계열 옵션 쪽에 남아 있다 —
     · 반격: `doCounter` + 장비 `counterX`·`hitCounter`·`hitCounterS` (연쇄 특전만 사라졌다)
     · 처치 회복: `onKill` 의 `p.killHeal`·`killShield3`·`killShield10` (전부 장비 pendant/robe/amulet 옵션)
   그 계수들은 `verifyOptText`(설명문 ↔ 엔진 상수 대조)와 `verifyT2`(두 엔진 대조)가 계속 지킨다.
   ⚑ 주인 확정 «처치 시 체력 5% 회복» 은 그 특전(🍖)에 붙어 있던 조항이라 함께 소멸했다 —
   되살리려면 주인이 새 10종 표에 그 축을 넣어야 한다(워커가 임의로 만들지 않는다). */


console.log(`\n대조 ${CHECKS.length}항목 · 일치 ${okN}개 · 불일치 ${bad}건 · 미문서화 신규 ${undocNew}건 · 등재된 기존 ${undocKnown}건`);
console.log(bad?'→ 불합격':'→ 통과');
process.exit(bad?1:0);
