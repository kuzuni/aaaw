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
      '\n;globalThis.__Z={hitPlayer,addBuff,STACK_BONUS};',ctx);
    const Z=ctx.__Z||ctx.globalThis.__Z;
    const mkG=(px)=>{
      const e={worldX:100,hp:1e6,maxHp:1e6,dead:false,isBoss:false,stun:0};
      const p={worldX:0,dmg:100,px:Object.assign({},px),nextCrit:false,nextAtk:0,missStk:0,
               buffs:{atk:[],aspd:[],critR:[],critF:[],def:[],evade:[]},
               sh:0,maxSh:1000,hp:1e6,maxHp:1e6,steal:0,goldMul:1,level:1,exp:0,
               critR:0,critF:150,def:0,evade:0,counter:0,atkTimer:1,aspd:1,walkMul:1,killHeal:0};
      const G={chapter:1,player:p,nodes:[{enemies:[e]}],pprojs:[],arrows:[],gold:0,kills:0,procN:0,
               t:0,taken:[],cleared:false,dead:false,perkChances:0,autoBoltT:2,stunAuraT:2.5,overBoltCd:0,
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
    /* (5) 중첩 상한 보너스 — m_stackMaster 가 있으면 상한 5 짜리 버프가 5+STACK_BONUS 개까지 쌓인다 */
    {
      const {p}=mkG({});
      for(let i=0;i<20;i++) Z.addBuff(p,'atk',0.05,3,5);
      const base=p.buffs.atk.length;
      const {p:p2}=mkG({stackMaster:true});
      for(let i=0;i<20;i++) Z.addBuff(p2,'atk',0.05,3,5);
      (base===5&&p2.buffs.atk.length===5+Z.STACK_BONUS)
        ? pass(`중첩 상한 보너스가 addBuff 에서 걸린다 (5 → ${p2.buffs.atk.length})`)
        : fail(`중첩 상한 보너스가 스펙과 다르다 — 기본 ${base} · 보유 시 ${p2.buffs.atk.length}`);
    }
    /* (6) PLAN 에 주인 지시 문구가 살아 있는가 */
    planHas(/원거리 피격 트리거 신설/)
      ? pass('PLAN §3.0 에 주인 지시 «원거리 피격 트리거 신설» 문구가 있다')
      : fail('PLAN §3.0 에서 «원거리 피격 트리거 신설» 문구가 사라졌다');
  }
}

/* ---------- ⑥ 횟수형 방어막 · 회피 즉사 — 실행 단언 (주인 16:5X·17:2X · T48 3단계) ---------- */
console.log('\n=== ⑥ 횟수형 방어막 · 회피 즉사 (PLAN §3.0 주인 16:5X·17:2X · T48) ===');
{
  const vm=require('vm');
  const CUT="const mode=process.argv[2]||'all';";
  const at=SIM.indexOf(CUT);
  if(at<0) fail('sim.js 에서 CLI 디스패처를 못 찾았다 — 잘림 기준이 바뀌었다');
  else{
    const ctx={console:{log(){}},process,Math,JSON,Number,String,Array,Set,Map,Object,Date,parseInt,parseFloat,isFinite,isNaN,require};
    vm.createContext(ctx);
    vm.runInContext(SIM.slice(0,at)+
      '\n;globalThis.__W={hitPlayer,gainWard,wardCap,WARD_CAP,WARD_CAP_KING,REAPER_CH};',ctx);
    const W=ctx.__W||ctx.globalThis.__W;
    const mkG=(px,boss)=>{
      const e={worldX:100,hp:1e6,maxHp:1e6,dead:false,isBoss:!!boss,stun:0};
      const p={worldX:0,dmg:100,px:Object.assign({},px),nextCrit:false,nextAtk:0,missStk:0,ward:0,
               buffs:{atk:[],aspd:[],critR:[],critF:[],def:[],evade:[]},
               sh:500,maxSh:500,hp:1000,maxHp:1000,steal:0,goldMul:1,level:1,exp:0,
               critR:0,critF:150,def:0,evade:0,counter:0,atkTimer:1,aspd:1,walkMul:1,killHeal:0};
      const G={chapter:1,player:p,nodes:[{enemies:[e]}],pprojs:[],arrows:[],gold:0,kills:0,procN:0,
               t:0,taken:[],cleared:false,dead:false,perkChances:0,autoBoltT:2,stunAuraT:2.5,overBoltCd:0,
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
    /* (3) 상한 — 기본 WARD_CAP, 신화 변형은 WARD_CAP_KING */
    {
      const {p}=mkG({wardAtk:1});
      for(let i=0;i<50;i++) W.gainWard(p,1.0);
      const {p:p2}=mkG({wardAtk:1,wardKing:true});
      for(let i=0;i<50;i++) W.gainWard(p2,1.0);
      (p.ward===W.WARD_CAP&&p2.ward===W.WARD_CAP_KING)
        ? pass(`방어막 상한 ${W.WARD_CAP}장 · 신화 변형 ${W.WARD_CAP_KING}장`)
        : fail(`방어막 상한이 스펙과 다르다 — 기본 ${p.ward} · 신화 ${p2.ward}`);
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
    /* (5) 회피 즉사 — 회피에 성공했을 때만, 보스는 제외 */
    {
      const {G,e}=mkG({reaper:true});
      G.player.evade=100;
      Math.random=()=>0.0;                  /* 회피 성공 + 즉사 굴림 성공 */
      W.hitPlayer(G,10,true,e);
      Math.random=rnd;
      e.hp<=0 ? pass('회피 시 사신의 낫이 그 적을 즉사시킨다')
              : fail('회피 즉사가 안 터진다');
    }
    {
      const {G,e}=mkG({reaper:true},true);  /* 보스 */
      G.player.evade=100;
      Math.random=()=>0.0;
      W.hitPlayer(G,10,true,e);
      Math.random=rnd;
      e.hp>0 ? pass('보스는 사신의 낫에 즉사하지 않는다 (🧨 처형자 선례)')
             : fail('보스가 회피 즉사로 죽었다 — 주인 위임 «보스 제외» 위반');
    }
    {
      const {G,e}=mkG({reaper:true});       /* 회피 실패 → 즉사도 없음 */
      Math.random=()=>0.0001;               /* evade 0 이라 회피 실패, 즉사 굴림은 성공할 값 */
      W.hitPlayer(G,10,true,e);
      Math.random=rnd;
      e.hp>0 ? pass('회피에 실패하면 사신의 낫은 굴지 않는다')
             : fail('맞았는데도 회피 즉사가 터졌다');
    }
    /* (6) PLAN 에 주인 지시 문구가 살아 있는가 */
    planHas(/횟수형 방어막 특전/) ? pass('PLAN §3.0 에 «횟수형 방어막 특전» 문구가 있다')
                                : fail('PLAN §3.0 에서 «횟수형 방어막 특전» 문구가 사라졌다');
    planHas(/회피 즉사 특전/) ? pass('PLAN §3.0 에 «회피 즉사 특전» 문구가 있다')
                            : fail('PLAN §3.0 에서 «회피 즉사 특전» 문구가 사라졌다');
  }
}

console.log('\n=== ⑦ 반격 연쇄 — «반드시 한 번 더, 연쇄 2회 제한» (PLAN §3.3 l_counterChain · T69) ===');
/* T69: sim.js 의 가드가 `depth<2` 였다. 바깥 호출부는 depth 를 안 넘기므로 `undefined<2` = false —
   즉 전설 특전이 sim 에서 한 번도 안 터졌다(1200판 발동 0회). 게임(index.html)은 `!depth` 라 정상이었다.
   그래서 여기서는 «상수 대조» 가 아니라 **실제로 몇 번 반격하는지 세어** 본다:
     - 특전 없음 = 1회 · 특전 있음 = 정확히 2회 (많아도 적어도 안 된다 — 2 미만이면 사장, 초과면 스턴락급 연쇄)
     - 두 엔진의 가드 형태가 같은가 (한쪽만 고치면 sim↔게임이 다시 벌어진다)
     - «undefined 와 비교하는» 가드로 되돌아가면 즉시 빨개진다 */
{
  const vm=require('vm');
  const HTML=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const CUT="const mode=process.argv[2]||'all';";
  const at=SIM.indexOf(CUT);
  if(at<0) fail('sim.js 에서 CLI 디스패처를 못 찾았다 — 잘림 기준이 바뀌었다');
  else{
    const ctx={console:{log(){}},process,Math,JSON,Number,String,Array,Set,Map,Object,Date,parseInt,parseFloat,isFinite,isNaN,require};
    vm.createContext(ctx);
    vm.runInContext(SIM.slice(0,at)+'\n;globalThis.__C={doCounter};',ctx);
    const C=ctx.__C||ctx.globalThis.__C;
    const rnd=Math.random;
    /* 반격 횟수 = 적이 받은 데미지 / 1회분. 적 체력을 넉넉히 줘서 «죽어서 끊긴 것» 과 구별한다. */
    const count=(px)=>{
      const e={worldX:100,hp:1e12,maxHp:1e12,dead:false,isBoss:false,stun:0};
      const p={worldX:0,dmg:100,px:Object.assign({},px),nextCrit:false,nextAtk:0,missStk:0,ward:0,
               buffs:{atk:[],aspd:[],critR:[],critF:[],def:[],evade:[]},
               sh:500,maxSh:500,hp:1000,maxHp:1000,steal:0,goldMul:1,level:1,exp:0,
               critR:0,critF:150,def:0,evade:0,counter:0,atkTimer:1,aspd:1,walkMul:1,killHeal:0};
      const G={chapter:1,player:p,nodes:[{enemies:[e]}],pprojs:[],arrows:[],gold:0,kills:0,procN:0,
               t:0,taken:[],cleared:false,dead:false,perkChances:0,autoBoltT:2,stunAuraT:2.5,overBoltCd:0,
               atkTries:0,miss:0};
      p.G=G;
      Math.random=()=>0.99;                 /* 적 회피(10%) 실패 = 반격이 전부 적중 */
      C.doCounter(G,e);                     /* 바깥 호출부와 똑같이 depth 를 안 넘긴다 */
      Math.random=rnd;
      return G.atkTries;                    /* doCounter 진입 1회당 1 */
    };
    const n0=count({}), n1=count({counterChain:1});
    n0===1 ? pass('특전 없으면 반격 1회 (연쇄 없음)')
           : fail(`특전 없는 반격이 ${n0}회다 — 1회여야 한다`);
    n1===2 ? pass('l_counterChain 이 있으면 정확히 2회 (반격 + 연쇄 1회)')
           : fail(`l_counterChain 반격이 ${n1}회다 — PLAN §3.3 «반드시 한 번 더 · 연쇄 2회 제한» 위반`+
                  (n1===1?' (특전이 사장돼 한 번도 안 터진다 — T69 재발)':''));
    /* 두 엔진 가드 형태 대조 + «undefined 비교» 가드 금지 */
    const grab=(s)=>{ const m=s.match(/else if\(px\.counterChain&&([^)]*)\)\s*doCounter/); return m?m[1].replace(/\s+/g,''):null; };
    const gs=grab(SIM), gh=grab(HTML);
    (gs&&gh&&gs===gh) ? pass(`두 엔진의 연쇄 가드가 같다 («${gs}»)`)
                      : fail(`연쇄 가드가 두 엔진에서 다르다 — sim «${gs}» / index.html «${gh}»`);
    /* depth 를 숫자와 비교하면 바깥 호출부(인자 미전달)에서 undefined 비교가 되어 죽는다 */
    [['sim.js',gs],['index.html',gh]].forEach(([f,g])=>{
      (g&&!/depth[<>]=?\d/.test(g))
        ? pass(`${f} 의 가드가 depth 를 숫자와 비교하지 않는다 (undefined 비교 회귀 차단)`)
        : fail(`${f} 의 가드 «${g}» 가 depth 를 숫자와 비교한다 — 호출부가 depth 를 안 넘기므로 항상 거짓이 된다(T69)`);
    });
    /* 호출부가 실제로 depth 를 안 넘기는지 (넘기기 시작하면 위 가정이 깨진다) */
    const outer=(s)=>[...s.matchAll(/(function\s+)?doCounter\(([^)]*)\)/g)]
                     .filter(m=>!m[1])                       /* 정의부는 제외 — 호출부만 본다 */
                     .map(m=>m[2].replace(/\s+/g,''))
                     .filter(a=>a!=='G,src,1'&&a!=='src,1'); /* 재귀 호출(연쇄 1회)은 정상 */
    const so=outer(SIM).filter(a=>a!=='G,src'&&a!==''), ho=outer(HTML).filter(a=>a!=='src'&&a!=='');
    (so.length===0&&ho.length===0)
      ? pass('바깥 호출부는 두 엔진 모두 depth 인자를 넘기지 않는다 (재귀 호출만 1)')
      : fail(`depth 를 넘기는 예상 밖 호출부가 있다 — sim ${JSON.stringify(so)} / index.html ${JSON.stringify(ho)}`);
    planHas(/l_counterChain \| 🔂 반격 시 반드시 한 번 더 반격 \(연쇄 2회 제한\)/)
      ? pass('PLAN §3.3 에 «반드시 한 번 더 반격 (연쇄 2회 제한)» 행이 있다')
      : fail('PLAN §3.3 의 l_counterChain 행 문구가 바뀌었다 — 게이트 기준과 대조할 것');
  }
}

/* ---------- ⑧ 킬 회복 축 — 주인 확정 «처치 시 체력 5% 회복» + 등급 차등 (T82) ---------- */
/* 주인 원문(2026-09-03): «🍖 c_killHeal2 = «처치 시 체력 5% 회복» 고정 (주인 확정 상수 — 튜닝 노브 아님)» +
   «특전 수치를 소수점(0.37%·0.5%·0.55%)으로 깎는 것 금지 — 남는 강함은 적 난이도를 올려서 흡수한다».
   그래서 이 축은 «수치가 맞나» 만이 아니라 «다시 소수점으로 깎이지 않았나» 를 봐야 한다:
     - c_killHeal2 = 정확히 5% (한 자리라도 다르면 빨개진다 — T1 이 이걸 노브로 쓰면 안 된다)
     - 킬 회복 4종 전부 5%의 배수 (0.37/0.5/0.55/0.75 같은 소수점 체급으로 되돌아가면 빨개진다)
     - 전설 > 일반 (주인: «전설은 일반보다 좋게»)
     - 두 엔진 상수 일치 · PLAN §3 표시 텍스트 일치
     - **실행 단언** — 실제로 onKill 한 번에 최대 체력의 5% 가 회복되고 실드가 5%/10% 충전되는가
       (상수만 맞고 호출부가 죽어 있던 T69 형 사고를 막는다) */
console.log('\n=== ⑧ 킬 회복 축 — 주인 확정 5% 체급 (PLAN §3 · T82) ===');
{
  const vm=require('vm');
  const HTML=fs.readFileSync(path.join(root,'index.html'),'utf8');
  /* (1) 네 값의 정적 대조 — 두 엔진 + PLAN */
  const num=(re,src,what)=>{ const m=src.match(re); return m?Number(m[1]):null; };   /* 못 찾으면 null — 아래 renamed 분기가 «효과 자체가 사라졌나» 로 판정한다 */
  const V={
    killHealC:[num(/add\('c_killHeal2',0,p=>p\.killHeal\+=([\d.]+)\)/,SIM,'sim c_killHeal2'),
               num(/id:'c_killHeal2'[^}]*p\.killHeal\+=([\d.]+)/,HTML,'index c_killHeal2'), 0.05, '일반 킬힐'],
    killHealL:[num(/add\('l_killHeal5',2,p=>p\.killHeal\+=([\d.]+)\)/,SIM,'sim l_killHeal5'),
               num(/id:'l_killHeal5'[^}]*p\.killHeal\+=([\d.]+)/,HTML,'index l_killHeal5'), null, '전설 킬힐'],
    killSh3:  [num(/p\.maxSh\*([\d.]+)\*px\.killShield3/,SIM,'sim killShield3'),
               num(/p\.maxSh\*([\d.]+)\*px\.killShield3/,HTML,'index killShield3'), null, '일반 킬실드'],
    killSh10: [num(/p\.maxSh\*([\d.]+)\*px\.killShield10/,SIM,'sim killShield10'),
               num(/p\.maxSh\*([\d.]+)\*px\.killShield10/,HTML,'index killShield10'), null, '전설 킬실드'],
  };
  /* ⚑ 주인이 특전 목록을 재작성 중이다(2026-09-03 «전면 정지»). id 가 통째로 바뀔 수 있으므로
     «id 가 사라졌다» 를 곧장 불합격으로 보지 않는다 — 대신 **효과가 사라졌는지**를 본다:
     일반 등급에 «처치 시 체력 N% 회복» 특전이 하나도 없으면 그때 빨개진다(주인 확정 상수의 소멸). */
  const renamed = V.killHealC[0]===null && V.killHealC[1]===null;
  if(renamed){
    const commons=[...HTML.matchAll(/\{id:'(\w+)',\s*r:0,[^}]*tx:'([^']*)'/g)]
      .map(m=>[m[1],m[2].replace(/<[^>]*>/g,'')])
      .filter(([,t])=>/처치 시 체력 [\d.]+% 회복/.test(t));
    if(!commons.length) fail('일반 등급에 «처치 시 체력 N% 회복» 특전이 없다 — 주인 확정 상수(킬힐 5%)가 목록에서 사라졌다');
    else{
      const bad=commons.filter(([,t])=>Number(t.match(/처치 시 체력 ([\d.]+)% 회복/)[1])!==5);
      bad.length ? fail(`특전 재작성본의 일반 킬힐이 5% 가 아니다 — ${bad.map(([i,t])=>i+' «'+t+'»').join(' · ')}`)
                 : pass(`특전 id 가 바뀌었다 — 일반 킬힐 ${commons.map(([i])=>i).join('·')} 가 5% 를 지키고 있다`);
    }
  }
  for(const k in V){
    const [a,b,fixed,nm]=V[k];
    if(a===null&&b===null) continue;   /* 재작성으로 사라진 id — 위 renamed 분기가 본다 */
    if(a===null||b===null) continue;
    (a===b) ? pass(`${nm} 상수가 두 엔진에서 같다 (${(a*100).toFixed(0)}%)`)
            : fail(`${nm} 상수가 두 엔진에서 다르다 — sim ${a} / index.html ${b}`);
    if(fixed!==null){
      (a===fixed) ? pass(`c_killHeal2 = ${(fixed*100).toFixed(0)}% (주인 확정 상수 — 튜닝 노브 아님)`)
                  : fail(`c_killHeal2 가 ${(a*100)}% 다 — 주인 확정 상수는 5%. 밸런스가 안 맞으면 특전이 아니라 난이도를 움직여라(ROUTINE 2026-09-03 «밸런싱 방향 전환»)`);
    }
    const pct=+(a*100).toFixed(6);
    (Number.isInteger(pct)&&pct%5===0)
      ? pass(`${nm} ${pct}% 가 읽히는 체급(5% 단위)이다`)
      : fail(`${nm} 가 ${pct}% 다 — 주인 확정 «소수점 금지·수치 계수 5% 단위» 위반. 소수점으로 깎지 말고 난이도로 흡수할 것`);
  }
  if(V.killHealL[0]!==null&&V.killHealC[0]!==null)
    (V.killHealL[0]>V.killHealC[0]) ? pass(`전설 킬힐(${V.killHealL[0]*100}%) > 일반 킬힐(${V.killHealC[0]*100}%) — 주인 «전설은 일반보다 좋게»`)
                                    : fail(`전설 킬힐 ${V.killHealL[0]*100}% 가 일반 ${V.killHealC[0]*100}% 이하다 — 주인 확정 «전설은 일반보다 좋게» 위반`);
  if(V.killSh10[0]!==null&&V.killSh3[0]!==null)
    (V.killSh10[0]>V.killSh3[0]) ? pass(`전설 킬실드(${V.killSh10[0]*100}%) > 일반 킬실드(${V.killSh3[0]*100}%)`)
                                 : fail(`전설 킬실드 ${V.killSh10[0]*100}% 가 일반 ${V.killSh3[0]*100}% 이하다 — 등급 차등 위반`);
  /* (2) PLAN §3 표시 텍스트 대조 — 게임에 뜨는 문장이 엔진 값과 같은가 */
  const planRow=(re,want,nm)=>{ const m=PLAN.match(re);
    if(!m) fail(`PLAN §3 에서 ${nm} 행을 못 찾았다`);
    else (Number(m[1])===want) ? pass(`PLAN §3 «${nm} ${m[1]}%» 가 엔진과 일치`)
                               : fail(`PLAN §3 «${nm} ${m[1]}%» 가 엔진 ${want}% 와 다르다`); };
  const P4=[[/c_killHeal2 \| 🍖 처치 시 체력 ([\d.]+)% 회복/,V.killHealC[0],'c_killHeal2'],
            [/c_killShield3 \| 🔰 처치 시 실드 ([\d.]+)% 충전/,V.killSh3[0],'c_killShield3'],
            [/l_killHeal5 \| 💉 처치 시 체력 ([\d.]+)% 회복/,V.killHealL[0],'l_killHeal5'],
            [/l_killShield10 \| 🏯 처치 시 실드 ([\d.]+)% 충전/,V.killSh10[0],'l_killShield10']];
  for(const [re,v,nm] of P4) if(v!==null) planRow(re,100*v,nm);
  /* index.html 표시 텍스트(tx)도 같은 값인가 — 태그를 걷어내고 본다(T79 ㊳ 과 같은 취지) */
  const txPct=(id)=>{ const m=HTML.match(new RegExp(`id:'${id}'[^}]*tx:'([^']*)'`)); if(!m)return null;
                      const t=m[1].replace(/<[^>]*>/g,''); const n=t.match(/([\d.]+)%/); return n?Number(n[1]):null; };
  [['c_killHeal2',V.killHealC[0]],['c_killShield3',V.killSh3[0]],
   ['l_killHeal5',V.killHealL[0]],['l_killShield10',V.killSh10[0]]].forEach(([id,v])=>{
    if(v===null) return;                       /* 재작성으로 사라진 id */
    const want=100*v, got=txPct(id);
    (got===want) ? pass(`index.html 표시 텍스트 «${id} ${got}%» 가 엔진과 일치`)
                 : fail(`index.html 표시 텍스트 «${id} ${got}%» 가 엔진 ${want}% 와 다르다 — 게임에 틀린 숫자가 뜬다`);
  });
  /* (3) 실행 단언 — onKill 한 번이 실제로 그만큼 회복시키는가 */
  const CUT="const mode=process.argv[2]||'all';";
  const at=SIM.indexOf(CUT);
  if(at<0) fail('sim.js 에서 CLI 디스패처를 못 찾았다 — 잘림 기준이 바뀌었다');
  else{
    const ctx={console:{log(){}},process,Math,JSON,Number,String,Array,Set,Map,Object,Date,parseInt,parseFloat,isFinite,isNaN,require};
    vm.createContext(ctx);
    vm.runInContext(SIM.slice(0,at)+'\n;globalThis.__K={onKill,PERKS,mkPlayer,mkBuild};',ctx);
    const K=ctx.__K||ctx.globalThis.__K;
    const run=(perkId)=>{
      const p=K.mkPlayer(K.mkBuild(-1,0,0));   /* 미장착 = 장비 옵션 0개 (희귀 풀셋은 옵1 에 healAmp 가 붙어 회복량이 1.15배가 된다) */ const perk=K.PERKS.find(x=>x.id===perkId);
      if(!perk) return null;
      perk.ap(p);
      p.hp=p.maxHp/2; p.sh=0;
      const e={worldX:100,hp:0,maxHp:100,dead:false,isBoss:false,stun:0};
      const G={chapter:1,player:p,nodes:[{enemies:[e]}],pprojs:[],arrows:[],gold:0,kills:0,procN:0,t:0,
               taken:[],cleared:false,dead:false,perkChances:0,autoBoltT:2,stunAuraT:2.5,overBoltCd:0,atkTries:0,miss:0};
      p.G=G;
      const hp0=p.hp, sh0=p.sh;
      K.onKill(G,e);
      return {dHp:(p.hp-hp0)/p.maxHp*100, dSh:(p.sh-sh0)/p.maxSh*100};
    };
    const near=(a,b)=>Math.abs(a-b)<1e-6;
    [['c_killHeal2','dHp',V.killHealC[0],'체력'],['l_killHeal5','dHp',V.killHealL[0],'체력'],
     ['c_killShield3','dSh',V.killSh3[0],'실드'],['l_killShield10','dSh',V.killSh10[0],'실드']].forEach(([id,f,v,nm])=>{
      if(v===null) return;                     /* 재작성으로 사라진 id */
      const want=100*v, r=run(id);
      if(!r) return fail(`특전 ${id} 가 PERKS 에 없다`);
      near(r[f],want) ? pass(`${id}: 처치 1회에 최대 ${nm}의 ${r[f].toFixed(2)}% 가 실제로 채워진다`)
                      : fail(`${id}: 처치 1회 실측 ${r[f].toFixed(4)}% ≠ 표시 ${want}% — 특전이 사장됐거나 호출부가 끊겼다`);
     });
    /* 특전이 없으면 0 이어야 한다 (다른 경로가 몰래 회복시키고 있지 않은가) */
    const none=run('c_atkPerm');
    (none&&near(none.dHp,0)&&near(none.dSh,0))
      ? pass('킬 회복 특전이 없으면 처치로 체력·실드가 늘지 않는다')
      : fail(`킬 회복 특전이 없는데 처치로 체력 ${none&&none.dHp.toFixed(2)}% · 실드 ${none&&none.dSh.toFixed(2)}% 가 찼다 — 무료 회복 경로가 있다`);
  }
}

console.log(`\n대조 ${CHECKS.length}항목 · 일치 ${okN}개 · 불일치 ${bad}건 · 미문서화 신규 ${undocNew}건 · 등재된 기존 ${undocKnown}건`);
console.log(bad?'→ 불합격':'→ 통과');
process.exit(bad?1:0);
