'use strict';
/* 소환 연쇄 임계 게이트 (T78 신설)
   사용: node tools/verifySummonChain.js       (임계 초과·두 파일 괴리가 있으면 exit 1)

   ⚑ 주인 확정 (2026-09-03, ROUTINE 맨 위):
     «연쇄 메커니즘(소환 적중 = 공격 판정)은 유지하되, **소환 1발의 적중이 낳는 신규 소환 기대값 ≤ 0.8** 을
      어떤 특전 조합에서도 유지해야 한다. 기대값 = Σ 보유 소환 특전의 발동확률 × 발수.
      1.0 넘으면 기하급수 폭주 — 도끼폭풍 14개 × 15% = 2.1 이 «신화 뜨면 게임 끝» 의 원인.»

   왜 이 자가 필요한가: 소환 적중은 «공격» 이라(주인 확정 15:3X · T45) 소환이 소환을 부른다.
   한 번의 적중이 평균 B 개의 새 소환을 낳으면 한 타격의 총 소환 수는 등비급수 1/(1-B) 다 —
   B<1 이면 수렴(B=0.8 → 5배), B≥1 이면 발산해서 PROC_TICK_CAP 이 끊을 때까지 부푼다.
   즉 이 게이트가 지키는 것은 «수치가 세다/약하다» 가 아니라 **연쇄가 수렴하는가** 라는 구조다.

   검사:
     ① 두 파일(sim.js·index.html) 의 소환 확률·발수 리터럴이 같은가.
     ② 최악 조합(모든 소환 특전 + 모든 발수 특전 + 폭풍의 힘 동시 보유)의 기대값 ≤ 0.8 인가 — 분석값.
     ③ 같은 최악 조합을 sim.js 엔진에서 실제로 굴려(몬테카를로) 잰 값이 ≤ 0.8 이고 ②와 일치하는가.
     ④ procOnAttack 에 게이트가 모르는 소환 호출이 새로 생기지 않았는가 (미등록 소환 = 즉시 불합격).
   ⑤ 는 단언이 아니라 «진단» 이다 — 관통(검기·창)까지 세면 값이 얼마인지 찍어 준다. PROGRESS 승인 항목 참조. */

const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.join(__dirname,'..');
const SIM=fs.readFileSync(path.join(root,'sim.js'),'utf8');
const HTML=fs.readFileSync(path.join(root,'index.html'),'utf8');

const CAP=0.8;                 /* 주인 확정 임계 */
const pct=v=>{const s=(v*100).toFixed(1);return (s.endsWith('.0')?s.slice(0,-2):s)+'%';};
let bad=0, okN=0;
const fail=m=>{bad++;console.log('  ❌ '+m);};
const pass=m=>{okN++;console.log('  ✓ '+m);};

/* 소스에서 숫자 하나를 뽑는다. 못 찾으면 «파싱 실패» = 불합격 (코드 모양이 바뀌면 조용히 통과하지 않는다). */
function num(src,re,what,where){
  const m=src.match(re);
  if(!m){fail(`${where} 에서 «${what}» 를 못 찾았다 — 코드 모양이 바뀌었다. 게이트를 함께 고칠 것`);return null;}
  return Number(m[1]);
}

/* ---------- 소환 축 정의 ----------
   key      : px 키 (procOnAttack 의 조건)
   probRe   : 발동확률 리터럴
   countRe  : 발수 리터럴 (발수 특전 보유 시 : 미보유 시). 없으면 항상 1발. */
const AXES=[
  {name:'도끼',   key:'axe',     probRe:/px\.axe&&pkk\(p,\s*([\d.]+)\*px\.axe\)/,
                                 countRe:/axeCount\?(\d+):(\d+)/,   boost:'m_axe3(도끼 폭풍)'},
  {name:'화살',   key:'arrow2',  probRe:/px\.arrow2&&pkk\(p,\s*([\d.]+)\*px\.arrow2\)/,
                                 countRe:/arrowCount\?(\d+):(\d+)/, boost:'m_arrow4(화살 폭풍)'},
  {name:'검기',   key:'wave',    probRe:/px\.wave&&pkk\(p,\s*([\d.]+)\*px\.wave\)/,
                                 countRe:null,                      boost:null},
  {name:'창',     key:'spear',   probRe:/px\.spear&&pkk\(p,\s*([\d.]+)\*px\.spear\)/,
                                 countRe:null,                      boost:null},
  {name:'번개',   key:'bolt',    probRe:/px\.bolt&&pkk\(p,\s*([\d.]+)\*px\.bolt\)/,
                                 countRe:/boltCount\?(\d+):(\d+)/,  boost:'m_bolt3(번개 지배자)'},
];
/* 무기고(m_arsenal) 는 위 5종 중 하나를 균등 추첨한다 → 발수 기대값 = 5종 발수의 평균. */
const ARS_RE=/px\.arsenal&&pkk\(p,\s*([\d.]+)\*px\.arsenal\)/;
/* 빗맞음 창(m_missSpear) 은 «이 적중이 빗나갔을 때» 만 굴러서 적 회피율만큼 할인된다. */
const MISS_RE=/px\.missSpear&&pkk\(p,\s*([\d.]+)\*px\.missSpear\)/;
const EVADE_RE=/const ENEMY_EVADE=([\d.]+);/;
const PROCX2_RE=/procX2\s*\?\s*([\d.]+)\s*:\s*1/;

/* ---------- ① 두 파일 대조 ---------- */
console.log('=== ① sim.js ↔ index.html 소환 확률·발수 대조 ===');
const S={},H={};
for(const a of AXES){
  S[a.key]={p:num(SIM,a.probRe,`${a.name} 확률`,'sim.js'),  n:1, n0:1};
  H[a.key]={p:num(HTML,a.probRe,`${a.name} 확률`,'index.html'),n:1, n0:1};
  if(a.countRe){
    const ms=SIM.match(a.countRe), mh=HTML.match(a.countRe);
    if(!ms||!mh){fail(`${a.name} 발수 리터럴을 못 찾았다 (sim ${!!ms} / html ${!!mh})`);}
    else{ S[a.key].n=Number(ms[1]); S[a.key].n0=Number(ms[2]);
          H[a.key].n=Number(mh[1]); H[a.key].n0=Number(mh[2]); }
  }
  const s=S[a.key],h=H[a.key];
  if(s.p===null||h.p===null) continue;
  (s.p===h.p&&s.n===h.n&&s.n0===h.n0)
    ? pass(`${a.name}: 확률 ${pct(s.p)} · 발수 ${s.n0}(기본)/${s.n}(발수 특전) — 두 파일 일치`)
    : fail(`${a.name} 두 파일 괴리 — sim ${s.p}/${s.n0}→${s.n} vs html ${h.p}/${h.n0}→${h.n}`);
}
const arsS=num(SIM,ARS_RE,'무기고 확률','sim.js'), arsH=num(HTML,ARS_RE,'무기고 확률','index.html');
if(arsS!==null&&arsH!==null) (arsS===arsH)?pass(`무기고: 확률 ${pct(arsS)} — 두 파일 일치`)
                                          :fail(`무기고 확률 괴리 — sim ${arsS} vs html ${arsH}`);
const msS=num(SIM,MISS_RE,'빗맞음 창 확률','sim.js'), msH=num(HTML,MISS_RE,'빗맞음 창 확률','index.html');
if(msS!==null&&msH!==null) (msS===msH)?pass(`빗맞음 창: 확률 ${pct(msS)} — 두 파일 일치`)
                                      :fail(`빗맞음 창 확률 괴리 — sim ${msS} vs html ${msH}`);
const pxS=num(SIM,PROCX2_RE,'폭풍의 힘 배수','sim.js'), pxH=num(HTML,PROCX2_RE,'폭풍의 힘 배수','index.html');
if(pxS!==null&&pxH!==null) (pxS===pxH)?pass(`폭풍의 힘(m_procX2): 발동 확률 ×${pxS} — 두 파일 일치`)
                                      :fail(`폭풍의 힘 배수 괴리 — sim ${pxS} vs html ${pxH}`);
const evade=num(SIM,EVADE_RE,'적 회피율','sim.js');

/* ---------- ② 최악 조합 기대값 (분석) ---------- */
console.log(`\n=== ② 최악 조합 기대값 ≤ ${CAP} (주인 확정 2026-09-03) ===`);
let analytic=null, missT=0;
if(!bad){
  const mul=pxS;                                   /* 폭풍의 힘 = 발동 확률 배수 (최악 조합이므로 보유 가정) */
  const counts=AXES.map(a=>S[a.key].n);            /* 발수 특전을 전부 보유한 상태의 발수 */
  const arsN=counts.reduce((x,y)=>x+y,0)/counts.length;
  let sum=0; const rows=[];
  AXES.forEach((a,i)=>{ const t=S[a.key].p*counts[i]; sum+=t;
    rows.push(`    ${a.name.padEnd(3)} ${pct(S[a.key].p).padStart(5)} × ${counts[i]}발 = ${t.toFixed(3)}`+(a.boost?`  (${a.boost} 반영)`:'')); });
  const arsT=arsS*arsN; sum+=arsT;
  rows.push(`    무기고 ${pct(arsS).padStart(5)} × ${arsN.toFixed(1)}발(5종 평균) = ${arsT.toFixed(3)}`);
  missT=evade*mul*msS;                       /* 빗나갔을 때만 → 적 회피율만큼 할인 */
  analytic=sum*mul+missT;
  rows.forEach(r=>console.log(r));
  console.log(`    ── 소계 ${sum.toFixed(3)} × 폭풍의 힘 ${mul} = ${(sum*mul).toFixed(3)}`);
  console.log(`    ＋ 빗맞음 창 ${pct(evade)}(적 회피) × ${mul} × ${pct(msS)} = ${missT.toFixed(3)}`);
  console.log(`    ＝ 기대값 B = ${analytic.toFixed(3)}`);
  analytic<=CAP+1e-9
    ? pass(`최악 조합 기대값 ${analytic.toFixed(3)} ≤ ${CAP} — 연쇄가 수렴한다 (총 소환 배수 1/(1-B) = ${(1/(1-analytic)).toFixed(2)}배)`)
    : fail(`최악 조합 기대값 ${analytic.toFixed(3)} > ${CAP} — 주인 확정 임계 위반 (B≥1 이면 기하급수 폭주)`);
}else console.log('  … ① 이 빨개서 건너뜀');

/* ---------- ③ 실행 단언 (몬테카를로) ---------- */
console.log(`\n=== ③ 엔진 실측 — 소환 적중 1회가 낳는 신규 소환 수 ===`);
{
  const CUT="const mode=process.argv[2]||'all';";
  const at=SIM.indexOf(CUT);
  if(at<0) fail('sim.js 에서 CLI 디스패처를 못 찾았다 — 잘림 기준이 바뀌었다');
  else{
    const ctx={console:{log(){}},process,Math,JSON,Number,String,Array,Set,Map,Object,Date,parseInt,parseFloat,isFinite,isNaN,require};
    vm.createContext(ctx);
    vm.runInContext(SIM.slice(0,at)+'\n;globalThis.__S={summonHit,PROC_TICK_CAP,PROJ_CAP};',ctx);
    const X=ctx.__S||ctx.globalThis.__S;
    /* 최악 조합 플레이어: 소환 5종 + 무기고 + 빗맞음 창 + 발수 특전 5종 + 폭풍의 힘을 «각 1개씩» 보유.
       (주인 문언 «모든 소환+발수 특전 동시 보유». 같은 특전 중복 획득은 아래 진단 ⑤ 참조) */
    /* ⚑ missSpear 는 여기서 «빼고» 잰다 — 빼지 않으면 1세대 격리가 깨진다.
       procOnMiss 는 dealDmg 안(트리거 예산 밖)이라, 자식 번개들이 빗맞을 때마다 손자 창이 또 나온다.
       실측하면 12.108(분석) vs 12.253(실측) 처럼 손자분이 섞여 들어온다 — 그 값은 1세대 분기수가 아니다.
       빗맞음 창 항은 ② 가 해석적으로 더하고, 아래 (2) 가 «빗맞으면 정말 창이 나가는가» 를 따로 본다. */
    const worstPx=()=>({axe:1,arrow2:1,wave:1,spear:1,bolt:1,arsenal:1,
                        axeCount:1,arrowCount:1,boltCount:1,waveKing:1,spearMaster:1,procX2:true});
    /* 적 1마리 전장 — 관통은 프레임 루프에서 일어나므로 여기서는 «발사 기준» 이 잡힌다(관통분은 ⑤ 진단). */
    const mk=(n)=>{
      const es=[]; for(let j=0;j<n;j++)es.push({worldX:100+j*40,hp:1e15,maxHp:1e15,dead:false,isBoss:false,wave:0,stun:0});
      const p={worldX:0,dmg:100,px:worstPx(),nextCrit:false,nextAtk:0,missStk:0,ward:0,
               buffs:{atk:[],aspd:[],critR:[],critF:[],def:[],evade:[]},
               sh:0,maxSh:0,hp:1e9,maxHp:1e9,steal:0,goldMul:1,level:1,exp:0,healAmp:0,killHeal:0,
               critR:0,critF:150,def:0,evade:0,counter:0,atkTimer:1,aspd:1,walkMul:1,misfire:0};
      const G={chapter:1,player:p,nodes:[{enemies:es}],pprojs:[],arrows:[],gold:0,kills:0,procN:0,
               t:0,taken:[],cleared:false,dead:false,perkChances:0,autoBoltT:2,overBoltCd:0,atkTries:0,miss:0};
      p.G=G; return {G,p,e:es[0]};
    };
    /* 한 번의 소환 적중이 «직접» 낳은 신규 소환 수를 센다.
       procN 을 상한-1 로 두면 바깥 summonHit 만 트리거를 굴리고 손자 세대는 굴지 않는다(1세대 격리).
       신규 소환 = 투사체로 쌓인 것(pprojs) + 즉발 판정으로 끝난 것(번개 등 = dealDmg 횟수 −1(자기 타격)). */
    const gen1=(nEnemy)=>{
      const {G,e}=mk(nEnemy);
      G.procN=X.PROC_TICK_CAP-1;
      X.summonHit(G,e,0.75);
      return G.pprojs.length+G.atkTries-1;
    };
    const N=200000;
    let s=0,ss=0; for(let i=0;i<N;i++){const v=gen1(1);s+=v;ss+=v*v;}
    const b1=s/N, b1full=b1+missT;
    /* 허용 오차는 «몬테카를로 표준오차 4배» 로 잡는다 — 고정 상수(0.02)로 두면 소환이 세던 시절처럼
       분산이 큰 상태에서 잡음만으로 빨개진다(실측: 임계 위반 상태에서 SE 0.031, 차 0.035). */
    const sd=Math.sqrt(Math.max(0,ss/N-b1*b1)), se=sd/Math.sqrt(N), tol=Math.max(0.02,4*se);
    console.log(`    실측(${N.toLocaleString('en-US')}회) 공격 트리거분 ${b1.toFixed(3)} + 빗맞음 창 ${missT.toFixed(3)} = B ${b1full.toFixed(3)}  (SE ${se.toFixed(4)})`);
    b1full<=CAP
      ? pass(`엔진 실측 ${b1full.toFixed(3)} ≤ ${CAP}`)
      : fail(`엔진 실측 ${b1full.toFixed(3)} > ${CAP} — 주인 확정 임계 위반`);
    if(analytic!==null){
      const d=Math.abs(b1full-analytic);
      d<=tol ? pass(`분석값 ${analytic.toFixed(3)} 과 실측 ${b1full.toFixed(3)} 이 일치 (차 ${d.toFixed(3)} ≤ 허용 ${tol.toFixed(3)})`)
             : fail(`분석값 ${analytic.toFixed(3)} ≠ 실측 ${b1full.toFixed(3)} (차 ${d.toFixed(3)} > 허용 ${tol.toFixed(3)}) — 게이트의 축 목록이 엔진과 어긋났다(④ 참조)`);
    }
    /* (2) 빗맞음 창은 위 측정에서 뺐으므로 «정말 빗맞음에서만 나가는가» 를 여기서 따로 못박는다.
       Math.random 을 고정해 «반드시 빗나가고 · 반드시 발동» 하는 세계를 만든다. */
    {
      const RNG={v:0.0};                                   /* 0.0 < ENEMY_EVADE → 반드시 빗맞음, 모든 pkk 도 참 */
      const FM=Object.create(Math); FM.random=()=>RNG.v;
      const c2={console:{log(){}},process,Math:FM,JSON,Number,String,Array,Set,Map,Object,Date,parseInt,parseFloat,isFinite,isNaN,require};
      vm.createContext(c2);
      vm.runInContext(SIM.slice(0,at)+'\n;globalThis.__S={summonHit,PROC_TICK_CAP};',c2);
      const Y=c2.__S||c2.globalThis.__S;
      const {G,e}=mk(1); G.procN=Y.PROC_TICK_CAP-1;
      /* 이 판만은 «빗맞음 창 하나만» 보유시킨다 — 다른 소환을 켜 두면 procOnAttack 이 쏜 창과
         구별이 안 돼(RNG 를 0 으로 고정했으므로 전부 발동한다) 이 단언이 늘 통과해 버린다. */
      G.player.px={missSpear:1};
      /* vm 이 다르므로 이 판의 함수로 다시 굴린다 — G 는 순수 데이터라 그대로 쓴다 */
      Y.summonHit(G,e,0.75);
      const spears=G.pprojs.filter(pr=>pr.type==='spear').length;
      spears>=1 ? pass('빗맞음 창(m_missSpear): 소환이 빗나가면 창이 나간다 — ② 의 빗맞음 항이 죽은 항이 아니다')
                : fail('빗맞음 창이 빗맞음에서 안 나간다 — ② 의 빗맞음 항이 실제와 어긋났다');
    }
    /* ---------- ⑤ 진단 — 관통까지 세면 얼마인가 ---------- */
    const pierceW=Number((SIM.match(/pierce:p\.px\.waveKing\?(\d+):(\d+)/)||[])[1]);
    const pierceW0=Number((SIM.match(/pierce:p\.px\.waveKing\?(\d+):(\d+)/)||[])[2]);
    const pierceS=Number((SIM.match(/type:'spear',[^}]*pierce:(\d+)/)||[])[1]);
    if(analytic!==null&&pierceW&&pierceS){
      const cnt=AXES.map(a=>S[a.key].n), hits=[1,1,pierceW,pierceS,1];
      const per=cnt.map((n,i)=>n*hits[i]);
      const arsH2=per.reduce((x,y)=>x+y,0)/per.length;
      let hb=0; AXES.forEach((a,i)=>{hb+=S[a.key].p*per[i];}); hb+=arsS*arsH2;
      hb=hb*pxS+missT;
      console.log(`\n=== ⑤ 진단(단언 아님) — 관통까지 세면 ===`);
      console.log(`    검기 관통 ${pierceW0}→${pierceW}(검기의 왕) · 창 관통 ${pierceS} 를 «적중 수» 로 세면 B = ${hb.toFixed(3)}`);
      console.log(`    ※ 주인 문언의 기대값 = «발동확률 × 발수» 라 ②③ 의 단언은 발사 기준이다.`);
      console.log(`      관통형은 1발이 여러 번 «적중» 하고 적중마다 트리거를 굴리므로 실제 분기수는 위 값에 가깝다`);
      console.log(`      (다만 그 줄에 적이 그만큼 있을 때만). 판정 축을 옮길지는 주인 몫 — PROGRESS 승인 항목 참조.`);
    }
  }
}

/* ---------- ④ 미등록 소환 검사 ---------- */
console.log('\n=== ④ procOnAttack 에 게이트가 모르는 소환이 생기지 않았는가 ===');
{
  const m=SIM.match(/function procOnAttack\(G\)\{[\s\S]*?\n\}/);
  if(!m) fail('sim.js 에서 procOnAttack 본문을 못 찾았다');
  else{
    const body=m[0];
    const calls=[...body.matchAll(/\bfire(Axe|Arrows|Bolts|Wave|Spear)\b|\bsummonHit\b/g)].length;
    /* 알려진 호출: 5축 각 1회 + 무기고의 pick 배열 5개 = 10 */
    const known=10;
    calls===known
      ? pass(`procOnAttack 안의 소환 호출 ${calls}개 = 알려진 ${known}개 (5축 + 무기고 배열 5)`)
      : fail(`procOnAttack 안의 소환 호출이 ${calls}개다 (알려진 ${known}개) — 새 소환이 추가됐다면 이 게이트의 AXES 에 등재하고 임계를 다시 계산할 것`);
    const keys=[...body.matchAll(/px\.(\w+)&&pkk/g)].map(x=>x[1]);
    const summonKeys=keys.filter(k=>['axe','arrow2','wave','spear','bolt','arsenal'].includes(k));
    summonKeys.length===6
      ? pass('소환 px 키 6종(axe·arrow2·wave·spear·bolt·arsenal) 전부 존재')
      : fail(`소환 px 키가 ${summonKeys.length}종이다 — 게이트 AXES 와 어긋났다`);
  }
}

console.log(`\n결과: ${okN} 통과 · ${bad} 실패`);
process.exit(bad?1:0);
