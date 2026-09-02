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
  /* ⚑ 주인 확정(2026-09-02 17:0X, T47): 레벨업 필요 경험치 `4+2*Lv` → `4+4*Lv`.
     PLAN 문장에는 폐기된 식이 취소선으로 함께 남아 있으므로, «주인 확정» 표기가 붙은 쪽만 골라 대조한다. */
  ['레벨업 필요경험치 기본', /expNeed:lv=>(\d+)\+\d+\*lv/,             /17:0X\): `(\d+)\+\d+\*Lv`/,                  '§2.4'],
  ['레벨업 필요경험치 증분', /expNeed:lv=>\d+\+(\d+)\*lv/,             /17:0X\): `\d+\+(\d+)\*Lv`/,                  '§2.4'],
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
      '\n;globalThis.__Y={applyStun,procOnMiss,dealDmg,STUN_BOSS_MUL,STUN_LORD_MUL,MISS_STACK_CAP,effDmg};',ctx);
    const Y=ctx.__Y||ctx.globalThis.__Y;
    const mkG=(px,boss)=>{
      const e={worldX:100,hp:1e12,maxHp:1e12,dead:false,isBoss:!!boss,stun:0};
      const p={worldX:0,dmg:100,px:Object.assign({},px),nextCrit:false,nextAtk:0,missStk:0,
               buffs:{atk:[],aspd:[],critR:[],critF:[],def:[],evade:[]},
               sh:0,maxSh:0,hp:100,maxHp:100,steal:0,goldMul:1,level:1,exp:0,
               critR:0,critF:150,def:0,evade:0,counter:0,atkTimer:1,aspd:1,walkMul:1,killHeal:0};
      const G={chapter:1,player:p,nodes:[{enemies:[e]}],pprojs:[],arrows:[],gold:0,kills:0,procN:0,
               t:0,taken:[],cleared:false,dead:false,perkChances:0,autoBoltT:2,stunAuraT:2.5,overBoltCd:0,
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
    /* (4) 빗맞음 스택: 적립은 상한까지, 소모는 적중 1타당 1장 */
    {
      const {G,p,e}=mkG({missStack:1});
      for(let i=0;i<Y.MISS_STACK_CAP+3;i++) Y.procOnMiss(G,e);
      p.missStk===Y.MISS_STACK_CAP ? pass(`빗맞음 스택이 상한 ${Y.MISS_STACK_CAP} 에서 멈춘다`)
                                   : fail(`빗맞음 스택 상한이 안 걸린다 (${p.missStk})`);
      const before=p.missStk;
      /* 확정 적중 상태에서 한 타 — 정확히 한 장만 줄어야 한다 (여러 장이 한 타에 붙으면 주인 정정 위반) */
      const rnd=Math.random; Math.random=()=>0.99;      /* 회피(0.10)·치명(0) 둘 다 안 뜨게 */
      Y.dealDmg(G,e,1,true);
      Math.random=rnd;
      p.missStk===before-1 ? pass('적중 1타에 스택이 정확히 1장만 소모된다 (한 타에 +100% 한 번)')
                           : fail(`적중 1타에 스택이 ${before-p.missStk}장 소모됐다 — 주인 정정(«한 타에 +100% 한 번만») 위반`);
    }
    /* (5) 스택 +100% 가 «가산» 이다 — 풀피 보너스(firstHit)와 곱이 아니라 합이어야 한다 */
    {
      const rnd=Math.random; Math.random=()=>0.99;
      const hit=(px,stk)=>{
        const {G,p,e}=mkG(px); p.missStk=stk;
        e.hp=e.maxHp=1e6;          /* 1e12 는 배정밀도 유효자릿수 밖이라 «맞은 만큼» 을 못 잰다 */
        const hp0=e.hp; Y.dealDmg(G,e,1,true); return hp0-e.hp;
      };
      const base=hit({},0), stack=hit({missStack:1},1), both=hit({missStack:1,firstHit:1},1);
      Math.random=rnd;
      /* rand(0.92,1.08) 이 Math.random 고정으로 상수가 되므로 배수 비교가 성립한다 */
      const okStack=Math.abs(stack/base-2.0)<1e-6;
      const okBoth=Math.abs(both/base-2.2)<1e-6;      /* 합 = 1 + 1.00 + 0.20 (곱이면 2.4) */
      okStack ? pass('빗맞음 스택 1장이 데미지 +100% 를 준다')
              : fail(`빗맞음 스택 배수가 ${(stack/base).toFixed(3)} 배다 (2.000 이어야 함)`);
      okBoth ? pass('풀피 보너스와 «합연산» 이다 (1+1.00+0.20 = 2.2배 — 곱이면 2.4배)')
             : fail(`스택+풀피가 ${(both/base).toFixed(3)} 배다 — 주인 정정(«가산, 다른 보너스와 합») 위반`);
    }
    /* (6) PLAN 에 주인 지시 문구가 살아 있는가 */
    planHas(/빗맞음\(온미스\) 트리거 신설/)
      ? pass('PLAN §3.0 에 주인 지시 «빗맞음 트리거 신설» 문구가 있다')
      : fail('PLAN §3.0 에서 «빗맞음(온미스) 트리거 신설» 문구가 사라졌다');
    planHas(/스턴 메커니즘 신설/)
      ? pass('PLAN §3.0 에 주인 지시 «스턴 메커니즘 신설» 문구가 있다')
      : fail('PLAN §3.0 에서 «스턴 메커니즘 신설» 문구가 사라졌다');
  }
}

console.log(`\n대조 ${CHECKS.length}항목 · 일치 ${okN}개 · 불일치 ${bad}건 · 미문서화 신규 ${undocNew}건 · 등재된 기존 ${undocKnown}건`);
console.log(bad?'→ 불합격':'→ 통과');
process.exit(bad?1:0);
