'use strict';
/* 꼬마기사 밸런스 시뮬레이터 — 게임 엔진과 동일한 수식 사용 */

const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* ---------- 튜닝 파라미터 (여기 숫자를 게임에 이식) ---------- */
const TUNE={
  eBaseHp:40, eBaseDmg:8,
  eHpG:1.15, eDmgG:1.10,        // 챕터당 성장 (R04)
  wallHp:2.6, wallDmg:1.15,     // 10챕터 이상 벽 배수 (R04)
  wall2Hp:1.06, wall2Dmg:1.0,   // 15챕터 이상 추가 배수 (R02)
  waveHp:0.15, waveDmg:0.08,    // 웨이브 인덱스당 (R03)
  bossHp:8, bossDmg:1.8,        // 주인 확정 상수 (튜닝 노브 아님) — 5배수 챕터 추가 배수 폐기
  pDmg:l=>30+8*l, pHp:l=>300+60*l, pAspd:l=>1+0.03*l, pCrit:l=>5+l,
  /* 강화 비용 = base * growth^Lv (growth 는 PLAN §7 조정 노브) */
  costBase:{dmg:40, hp:40, aspd:60, crit:55},
  costG:{dmg:1.07, hp:1.07, aspd:1.09, crit:1.09},
  goldKillBase:0.9, goldKillPer:0.10, goldClearPer:4,
  expKill:3, expBoss:9, expNeed:lv=>4+2*lv,
};
TUNE.cost={
  dmg:l=>Math.floor(TUNE.costBase.dmg*Math.pow(TUNE.costG.dmg,l)),
  hp:l=>Math.floor(TUNE.costBase.hp*Math.pow(TUNE.costG.hp,l)),
  aspd:l=>Math.floor(TUNE.costBase.aspd*Math.pow(TUNE.costG.aspd,l)),
  crit:l=>Math.floor(TUNE.costBase.crit*Math.pow(TUNE.costG.crit,l)),
};
TUNE.goldKill=c=>(TUNE.goldKillBase+TUNE.goldKillPer*c)*rand(1,1.8);
TUNE.goldClear=c=>TUNE.goldClearPer*c;
/* 스윕용 오버라이드 (기본 동작 불변) — 예: TUNE_OVERRIDE='{"eHpG":1.22}' node sim.js 3 */
if(process.env.TUNE_OVERRIDE){
  const o=JSON.parse(process.env.TUNE_OVERRIDE);
  for(const k in o){ if(typeof o[k]==='object'&&o[k]) Object.assign(TUNE[k],o[k]); else TUNE[k]=o[k]; }
}

/* ---------- 챕터 레이아웃 (결정적) ---------- */
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function chapterLayout(c){
  const rnd=mulberry(c*1013904223+77);
  const waveCount=4+(rnd()<0.4?1:0);
  const size=rnd()<0.5?10:12;
  const evs=[];
  for(let i=0;i<waveCount-1;i++){
    const r=rnd();
    evs.push(r<0.45?'rest':(r<0.75?'devil':'angel'));
  }
  if(!evs.includes('rest')) evs[Math.floor(rnd()*evs.length)]='rest';
  const out=[];
  for(let i=0;i<waveCount;i++){ out.push({t:'wave',size}); if(i<waveCount-1) out.push({t:evs[i]}); }
  out.push({t:'boss'});
  return out;
}
function enemyStats(c,w){
  let hp=TUNE.eBaseHp*Math.pow(TUNE.eHpG,c-1)*(1+TUNE.waveHp*w);
  let dmg=TUNE.eBaseDmg*Math.pow(TUNE.eDmgG,c-1)*(1+TUNE.waveDmg*w);
  if(c>=10){hp*=TUNE.wallHp; dmg*=TUNE.wallDmg;}
  if(c>=15){hp*=TUNE.wall2Hp; dmg*=TUNE.wall2Dmg;}
  return {hp:Math.round(hp), dmg:Math.round(dmg)};
}

/* ---------- 특전 정의 (102종) ---------- */
/* ap(p): 적용. u: 고유. 이름은 게임과 동일 키 */
function mkPerks(){
  const P=[];
  const add=(id,r,ap,u)=>P.push({id,r,ap,u:!!u});
  /* 일반 26 */
  add('c_aspdBuff',0,p=>p.px.c_aspdBuff++);
  add('c_atkBuff',0,p=>p.px.c_atkBuff++);
  add('c_atkPerm',0,p=>p.px.atkPerm++);
  add('c_critChain',0,p=>p.px.critChain++);
  add('c_critF',0,p=>p.px.critFsmall++);
  add('c_critHeal1',0,p=>p.px.critHealS++);
  add('c_killHeal2',0,p=>p.killHeal+=0.005);
  add('c_killShield3',0,p=>p.px.killShield3++);
  add('c_gold30',0,p=>p.goldMul+=0.3);
  add('c_defHit',0,p=>p.px.defHitBuff++);
  add('c_shieldHit',0,p=>p.px.shieldOnHit++);
  add('c_hitHeal',0,p=>p.px.hitHeal++);
  add('c_evadeEv',0,p=>p.px.evadeEvBuff++);
  add('c_evadeAspd',0,p=>p.px.evadeAspd++);
  add('c_evadeDef',0,p=>p.px.evadeDef++);
  add('c_hitCounterS',0,p=>p.px.hitCounterS++);
  add('c_counterAtk',0,p=>p.px.counterAtkS++);
  add('c_counterDef',0,p=>p.px.counterDefS++);
  add('c_healBoost',0,p=>p.px.healBoost2++);
  add('c_healDef',0,p=>p.px.healDefBuff++);
  add('c_healShield',0,p=>p.px.healShield3++);
  add('c_firstHit',0,p=>p.px.firstHit++);
  add('c_hp12',0,p=>{const a=p.maxHp*0.12;p.maxHp+=a;heal(p,a,true);});
  add('c_sh15',0,p=>p.maxSh*=1.15);
  add('c_walk20',0,p=>p.walkMul+=0.2);
  add('c_def3',0,p=>p.def+=3);
  /* 희귀 26 */
  add('r_axe',1,p=>p.px.axe++);
  add('r_arrow',1,p=>p.px.arrow2++);
  add('r_wave',1,p=>p.px.wave++);
  add('r_atkBuffM',1,p=>p.px.atkBuffM++);
  add('r_critFBuff',1,p=>p.px.critFBuff++);
  add('r_critReset',1,p=>p.px.critReset++);
  add('r_critHeal3',1,p=>p.px.critHeal3++);
  add('r_aspdKill',1,p=>p.px.aspdKill++);
  add('r_killCrit',1,p=>p.px.killCritBuff++);
  add('r_killDef',1,p=>p.px.killDefBuff++);
  add('r_defBuff2',1,p=>p.px.defBuff2++);
  add('r_hitEvade',1,p=>p.px.hitEvadeBuff++);
  add('r_hitCounter',1,p=>p.px.hitCounter++);
  add('r_evadeHeal',1,p=>p.px.evadeHeal++);
  add('r_evadeShield',1,p=>p.px.evadeShield++);
  add('r_evadeRush',1,p=>p.px.evadeRush++);
  add('r_counterX',1,p=>p.px.counterX++);
  add('r_counterAtkM',1,p=>p.px.counterAtkM++);
  add('r_counterCrit',1,p=>p.px.counterCrit++);
  add('r_healShield5',1,p=>p.px.healShield5++);
  add('r_healAtk',1,p=>p.px.healAtkBuff++);
  add('r_healAmp',1,p=>p.healAmp+=0.2);
  add('r_restHp',1,p=>p.px.restHp++);
  add('r_lastStand',1,p=>p.px.lastStand=true,1);
  add('r_refresh',1,p=>{},1); // 새로고침: 시뮬에서는 효과 없음(선택 정책 랜덤)
  add('r_def6',1,p=>p.def+=6);
  /* 전설 28 */
  add('l_spear',2,p=>p.px.spear++);
  add('l_bolt',2,p=>p.px.bolt++);
  add('l_atkBuffL',2,p=>p.px.atkBuffL++);
  add('l_extraHit',2,p=>p.px.extraHit++);
  add('l_critAtk',2,p=>p.px.critAtkBuff++);
  add('l_critAspd',2,p=>p.px.critAspdBuff++);
  add('l_killAspd',2,p=>p.px.killAspd=true,1);
  add('l_killHeal5',2,p=>p.killHeal+=0.008);
  add('l_killShield10',2,p=>p.px.killShield10++);
  add('l_thorns',2,p=>p.px.thorns++);
  add('l_evadeHitBuff',2,p=>p.px.evadeHitBuff++);
  add('l_defBuffL',2,p=>p.px.defBuffL++);
  add('l_evadeCrit',2,p=>p.px.evadeCrit=true,1);
  add('l_evadeCounter',2,p=>p.px.evadeCounter++);
  add('l_evadeAtk',2,p=>p.px.evadeAtkBuff++);
  add('l_counterChain',2,p=>p.px.counterChain=true,1);
  add('l_counterHeal',2,p=>p.px.counterHeal++);
  add('l_counterWave',2,p=>p.px.counterWave++);
  add('l_overheal',2,p=>p.px.overheal=true,1);
  add('l_overBolt',2,p=>p.px.overBolt=true,1);
  add('l_fullHpCrit',2,p=>p.px.fullHpCrit=true,1);
  add('l_rage',2,p=>p.px.rage=true,1);
  add('l_backDmg',2,p=>p.px.backDmg=true,1);
  add('l_execute',2,p=>p.px.execute=true,1);
  add('l_perkHp',2,p=>{p.px.perkHp=true; for(let i=0;i<p.G.perkChances;i++){const a=p.maxHp*0.03;p.maxHp+=a;heal(p,a,true);}},1);
  add('l_misfire',2,p=>p.misfire+=0.30);
  add('l_legendOnly',2,p=>p.G.legendOnly=true,1);
  add('l_def10',2,p=>p.def+=10);
  /* 신화 22 */
  add('m_revive',3,p=>p.px.revive++,1);
  add('m_clone',3,p=>p.px.clone=true,1);
  add('m_execKill',3,p=>p.px.execKill=true,1);
  add('m_procX2',3,p=>p.px.procX2=true,1);
  add('m_arsenal',3,p=>p.px.arsenal++);
  add('m_guard',3,p=>p.px.guardCrystal=true,1);
  add('m_autoBolt',3,p=>p.px.autoBolt++);
  add('m_time',3,p=>{p.aspd*=1.35;p.walkMul+=0.35;});
  add('m_axe3',3,p=>p.px.axeCount=1,1);
  add('m_arrow4',3,p=>p.px.arrowCount=1,1);
  add('m_spear200',3,p=>p.px.spearMaster=1,1);
  add('m_bolt3',3,p=>p.px.boltCount=1,1);
  add('m_wave4',3,p=>p.px.waveKing=1,1);
  add('m_gold2',3,p=>p.goldMul*=2,1);
  add('m_sage',3,p=>p.px.sage=true,1);
  add('m_def20',3,p=>p.def+=20);
  add('m_crit25',3,p=>p.critR+=25);
  add('m_giant',3,p=>{const a=p.maxHp*0.3;p.maxHp+=a;heal(p,a,true);});
  add('m_lucky',3,p=>{p.evade+=15;p.counter+=15;});
  add('m_choice4',3,p=>p.px.choice4=true,1);
  add('m_fortress',3,p=>p.maxSh*=1.8);
  add('m_wallBuff',3,p=>p.px.wallBuff++);
  return P;
}
const PERKS=mkPerks();

/* ---------- 엔진 ---------- */
function basePx(){
  return {
    c_aspdBuff:0,c_atkBuff:0,atkPerm:0,critChain:0,critFsmall:0,critHealS:0,
    killShield3:0,defHitBuff:0,shieldOnHit:0,hitHeal:0,evadeEvBuff:0,evadeAspd:0,evadeDef:0,
    hitCounterS:0,counterAtkS:0,counterDefS:0,healBoost2:0,healDefBuff:0,healShield3:0,firstHit:0,
    axe:0,arrow2:0,wave:0,atkBuffM:0,critFBuff:0,critReset:0,critHeal3:0,aspdKill:0,
    killCritBuff:0,killDefBuff:0,defBuff2:0,hitEvadeBuff:0,hitCounter:0,evadeHeal:0,evadeShield:0,
    evadeRush:0,counterX:0,counterAtkM:0,counterCrit:0,healShield5:0,healAtkBuff:0,restHp:0,lastStand:false,
    spear:0,bolt:0,atkBuffL:0,extraHit:0,critAtkBuff:0,critAspdBuff:0,killAspd:false,killShield10:0,
    thorns:0,evadeHitBuff:0,defBuffL:0,evadeCrit:false,evadeCounter:0,evadeAtkBuff:0,
    counterChain:false,counterHeal:0,counterWave:0,overheal:false,overBolt:false,
    fullHpCrit:false,rage:false,backDmg:false,execute:false,perkHp:false,
    revive:0,clone:false,execKill:false,procX2:false,arsenal:0,guardCrystal:false,autoBolt:0,
    axeCount:0,arrowCount:0,spearMaster:0,boltCount:0,waveKing:0,sage:false,choice4:false,wallBuff:0,
  };
}
function mkPlayer(up,G){
  const maxHp=TUNE.pHp(up.hp);
  return {G, worldX:0, atkTimer:0, nextAtk:0, nextCrit:false,
    dmg:TUNE.pDmg(up.dmg), aspd:TUNE.pAspd(up.aspd), critR:TUNE.pCrit(up.crit), critF:200,
    def:5, counter:10, evade:8, steal:0, killHeal:0, misfire:0, goldMul:1, walkMul:1, healAmp:0,
    maxHp, hp:maxHp, maxSh:Math.round(maxHp*0.8), sh:Math.round(maxHp*0.8),
    level:1, exp:0, buffs:{atk:[],aspd:[],critR:[],critF:[],def:[],evade:[]}, px:basePx()};
}
const bsum=(p,k)=>{let s=0;for(const b of p.buffs[k])s+=b.amt;return s;};
function addBuff(p,k,amt,dur,max){
  const arr=p.buffs[k];
  if(arr.length>=max){let mi=0;for(let i=1;i<arr.length;i++)if(arr[i].t<arr[mi].t)mi=i;arr[mi]={t:dur,amt};}
  else arr.push({t:dur,amt});
}
const pkk=(p,ch)=>Math.random()<ch*(p.px.procX2?2:1);
const effDmg=p=>{let m=1+bsum(p,'atk');if(p.px.rage&&p.sh<=0)m*=1.5;return p.dmg*m;};
const effAspd=p=>p.aspd*(1+bsum(p,'aspd'));
const effCritR=p=>p.critR+bsum(p,'critR');
const effCritF=p=>p.critF+bsum(p,'critF');
const effDef=p=>Math.min(80,p.def+bsum(p,'def'));
const effEvade=p=>{let e=p.evade+bsum(p,'evade');if(p.px.lastStand&&p.hp<=p.maxHp*0.10)e+=40;return Math.min(90,e);};
function heal(p,amt,noBoost){
  const px=p.px;
  if(!noBoost){
    amt*=1+p.healAmp;
    if(px.healBoost2&&pkk(p,0.20*px.healBoost2)) amt+=p.maxHp*0.02;
  }
  const over=Math.max(0,p.hp+amt-p.maxHp);
  p.hp=Math.min(p.maxHp,p.hp+amt);
  if(!noBoost){
    if(px.healDefBuff&&pkk(p,0.30*px.healDefBuff)) addBuff(p,'def',5*px.healDefBuff,3,3);
    if(px.healShield3&&pkk(p,0.20*px.healShield3)) p.sh=Math.min(p.maxSh,p.sh+p.maxSh*0.03);
    if(px.healShield5&&pkk(p,0.30*px.healShield5)) p.sh=Math.min(p.maxSh,p.sh+p.maxSh*0.08);
    if(px.healAtkBuff) addBuff(p,'atk',0.08,3,3);
    if(over>0){
      if(px.overheal) p.sh=Math.min(p.maxSh,p.sh+over);
      if(px.overBolt&&p.G.overBoltCd<=0){ p.G.overBoltCd=1.0; fireBolts(p,true); }
    }
  }
}

/* 시뮬 전투 상태 */
function aliveList(G){const o=[];for(const n of G.nodes)for(const e of n.enemies)if(e.hp>0)o.push(e);return o;}
function randTarget(G){
  const p=G.player;
  const pool=aliveList(G).filter(e=>{const d=e.worldX-p.worldX;return d>-30&&d<540;});
  return pool.length?pick(pool):null;
}
function onKill(G,e){
  if(e.dead)return;e.dead=true;
  const p=G.player,px=p.px;
  G.kills++;
  G.gold+=Math.round(TUNE.goldKill(G.chapter)*p.goldMul);
  if(p.killHeal>0)heal(p,p.maxHp*p.killHeal);
  if(px.killShield3)p.sh=Math.min(p.maxSh,p.sh+p.maxSh*0.01*px.killShield3);
  if(px.killShield10)p.sh=Math.min(p.maxSh,p.sh+p.maxSh*0.015*px.killShield10);
  if(px.aspdKill)addBuff(p,'aspd',0.20*px.aspdKill,4,3);
  if(px.killCritBuff&&pkk(p,0.30*px.killCritBuff))addBuff(p,'critR',14,4,3);
  if(px.killDefBuff)addBuff(p,'def',10*px.killDefBuff,3,3);
  if(px.killAspd)p.aspd*=1.01;
  /* 웨이브 전멸 실드 충전 폐지 (PLAN §2.3 주인 지시) — 실드 충전은 특전으로만 */
  if(e.isBoss)G.cleared=true;   /* 클리어 확정을 먼저 — 보스 경험치로 레벨업해도 특전 3택 없음 (PLAN §2.4 주인 지시) */
  gainExp(G,(e.isBoss?TUNE.expBoss:TUNE.expKill)+(px.sage?1:0));
}
function gainExp(G,n){
  const p=G.player;
  p.exp+=n;
  while(p.exp>=TUNE.expNeed(p.level)){p.exp-=TUNE.expNeed(p.level);p.level++;if(!G.cleared)perkChoice(G);}
}
function dealDmg(G,e,ratio,fromBasic){
  if(e.hp<=0)return false;
  const p=G.player,px=p.px;
  let cr=effCritR(p);
  const full=e.hp>=e.maxHp-0.5;
  if(px.fullHpCrit&&full)cr=100;
  if(fromBasic&&p.nextCrit){cr=100;}
  const crit=Math.random()*100<cr;
  if(fromBasic&&p.nextCrit)p.nextCrit=false;
  let d=effDmg(p)*ratio*(crit?effCritF(p)/100:1)*rand(0.92,1.08);
  if(full&&px.firstHit)d*=1+0.20*px.firstHit;
  if(px.execute&&e.hp<=e.maxHp*0.5)d*=1.5;
  if(px.backDmg){
    let front=null;for(const en of aliveList(G))if(!front||en.worldX<front.worldX)front=en;
    if(front&&e!==front)d*=2;
  }
  e.hp-=d;
  if(p.steal>0)heal(p,d*p.steal/100);
  if(crit){
    if(px.critChain)addBuff(p,'critR',3*px.critChain,3,5);
    if(px.critFsmall)addBuff(p,'critF',10*px.critFsmall,3,3);
    if(px.critFBuff)addBuff(p,'critF',34*px.critFBuff,4,3);
    if(px.critAtkBuff)addBuff(p,'atk',0.15*px.critAtkBuff,4,3);
    if(px.critAspdBuff)addBuff(p,'aspd',0.15*px.critAspdBuff,3,3);
    if(px.critHealS&&pkk(p,0.20*px.critHealS))heal(p,p.maxHp*0.01);
    if(px.critHeal3&&pkk(p,0.30*px.critHeal3))heal(p,p.maxHp*0.04);
    if(px.critReset&&pkk(p,0.45*px.critReset))p.atkTimer=0;
  }
  if(px.execKill&&!e.isBoss&&e.hp>0&&e.hp<=e.maxHp*0.15)e.hp=0;
  if(e.hp<=0)onKill(G,e);
  return crit;
}
function fireAxe(p){const G=p.G,n=p.px.axeCount?3:1;for(let k=0;k<n;k++){const t=randTarget(G);if(t)G.pprojs.push({type:'axe',x:p.worldX+14,tgt:t,ratio:0.50,spd:430});}}
function fireArrows(p){const G=p.G,n=p.px.arrowCount?4:2;for(let k=0;k<n;k++){const t=randTarget(G);if(t)G.pprojs.push({type:'parrow',x:p.worldX+14,tgt:t,ratio:0.65,spd:560});}}
function fireBolts(p){const G=p.G,n=p.px.boltCount?3:2;for(let k=0;k<n;k++){const t=randTarget(G);if(t)dealDmg(G,t,0.75);}}
function fireWave(p){const G=p.G;G.pprojs.push({type:'wave',x:p.worldX+14,ratio:0.70,spd:470,maxX:p.worldX+(p.px.waveKing?480:340),hit:new Set(),pierce:p.px.waveKing?4:2});}
function fireSpear(p){const G=p.G;G.pprojs.push({type:'spear',x:p.worldX+14,ratio:p.px.spearMaster?2.0:1.0,spd:520,maxX:p.worldX+88*8,hit:new Set()});}
function procOnAttack(G){
  const p=G.player,px=p.px;
  if(px.atkPerm&&pkk(p,0.10*px.atkPerm))p.dmg*=1.01;
  if(px.c_atkBuff&&pkk(p,0.30*px.c_atkBuff))addBuff(p,'atk',0.05,3,5);
  if(px.c_aspdBuff&&pkk(p,0.30*px.c_aspdBuff))addBuff(p,'aspd',0.05,3,5);
  if(px.atkBuffM&&pkk(p,0.30*px.atkBuffM))addBuff(p,'atk',0.14,4,5);
  if(px.atkBuffL&&pkk(p,0.15*px.atkBuffL))addBuff(p,'atk',0.25,5,3);
  if(px.axe&&pkk(p,0.15*px.axe))fireAxe(p);
  if(px.arrow2&&pkk(p,0.15*px.arrow2))fireArrows(p);
  if(px.wave&&pkk(p,0.20*px.wave))fireWave(p);
  if(px.spear&&pkk(p,0.10*px.spear))fireSpear(p);
  if(px.bolt&&pkk(p,0.10*px.bolt))fireBolts(p);
  if(px.arsenal&&pkk(p,0.20*px.arsenal))pick([fireAxe,fireArrows,fireBolts,fireWave,fireSpear])(p);
}
function doCounter(G,src,depth){
  const p=G.player,px=p.px;
  if(!src||src.hp<=0)return;
  const cd=effDmg(p)*0.7*(1+px.counterX);
  src.hp-=cd;
  if(px.counterAtkS)addBuff(p,'atk',0.05*px.counterAtkS,3,3);
  if(px.counterDefS)addBuff(p,'def',8*px.counterDefS,3,3);
  if(px.counterAtkM)addBuff(p,'atk',0.14*px.counterAtkM,4,3);
  if(px.counterCrit)addBuff(p,'critR',14,3,3);
  if(px.counterHeal)heal(p,p.maxHp*0.02*px.counterHeal);
  if(px.counterWave&&pkk(p,0.30*px.counterWave))fireWave(p);
  if(src.hp<=0)onKill(G,src);
  else if(px.counterChain&&!depth&&Math.random()<0.5)doCounter(G,src,1);
}
function hitPlayer(G,dmg,isMelee,src){
  const p=G.player,px=p.px;
  if(Math.random()*100<effEvade(p)){
    if(px.evadeEvBuff)addBuff(p,'evade',8*px.evadeEvBuff,3,3);
    if(px.evadeAspd)addBuff(p,'aspd',0.05,2,3);
    if(px.evadeDef)addBuff(p,'def',5*px.evadeDef,3,3);
    if(px.evadeAtkBuff)addBuff(p,'atk',0.10*px.evadeAtkBuff,4,3);
    if(px.evadeRush&&p.nextAtk<1.5)p.nextAtk=Math.min(1.5,p.nextAtk+0.5*px.evadeRush);
    if(px.evadeCrit)p.nextCrit=true;
    if(px.evadeHeal&&pkk(p,0.15*px.evadeHeal))heal(p,p.maxHp*0.07);
    if(px.evadeShield&&pkk(p,0.15*px.evadeShield))p.sh=Math.min(p.maxSh,p.sh+p.maxSh*0.18);
    if(px.evadeCounter&&pkk(p,0.30*px.evadeCounter))doCounter(G,src);
    return;
  }
  let d=dmg*(1-effDef(p)/100);
  if(px.guardCrystal&&p.sh>0)d*=0.5;
  if(p.sh>0){const ab=Math.min(p.sh,d);p.sh-=ab;d-=ab;}
  if(d>0){
    p.hp-=d;
    if(p.hp<=0){
      if(px.revive>0){px.revive--;p.hp=p.maxHp*0.15;p.sh=p.maxSh*0.15;}
      else{p.hp=0;G.dead=true;return;}
    }
  }
  if(px.defHitBuff)addBuff(p,'def',3*px.defHitBuff,3,5);
  if(px.defBuff2&&pkk(p,0.30*px.defBuff2))addBuff(p,'def',14,4,3);
  if(px.defBuffL&&pkk(p,0.20*px.defBuffL))addBuff(p,'def',15,4,2);
  if(px.wallBuff)addBuff(p,'def',14,4,2);
  if(px.hitEvadeBuff&&pkk(p,0.22*px.hitEvadeBuff))addBuff(p,'evade',14,3,2);
  if(px.evadeHitBuff&&pkk(p,0.30*px.evadeHitBuff))addBuff(p,'evade',15,3,2);
  if(px.shieldOnHit&&pkk(p,0.10*px.shieldOnHit))p.sh=Math.min(p.maxSh,p.sh+p.maxSh*0.05);
  if(px.hitHeal&&pkk(p,0.15*px.hitHeal))heal(p,p.maxHp*0.02);
  if(px.thorns&&src&&src.hp>0&&pkk(p,0.15*px.thorns)){src.hp-=dmg*0.5;if(src.hp<=0)onKill(G,src);}
  if(isMelee&&src&&src.hp>0){
    const cc=Math.random()*100<p.counter;
    const pc=(px.hitCounter&&pkk(p,0.30*px.hitCounter))||(px.hitCounterS&&pkk(p,0.10*px.hitCounterS));
    if(cc||pc)doCounter(G,src);
  }
}
function playerStrike(G,e){
  const p=G.player,px=p.px;
  let ratio=1;
  if(p.nextAtk>0){ratio*=1+p.nextAtk;p.nextAtk=0;}
  const crit=dealDmg(G,e,ratio,true);
  if(px.clone&&e.hp>0)dealDmg(G,e,0.5);
  if(crit&&px.extraHit&&pkk(p,0.30*px.extraHit)&&e.hp>0)dealDmg(G,e,1);
  procOnAttack(G);
}

/* 특전 선택 (정책: policy) */
function rollRarity(G){
  if(G.legendOnly)return Math.random()<0.375?3:2;
  const r=Math.random();
  return r<0.15?3:r<0.40?2:r<0.70?1:0;
}
function rollPerks(G,n){
  /* PLAN §3.0 주인 지시: 등급은 선택지당 1번만 굴리고, 전부 그 등급에서만 나온다 (등급 섞임 금지) */
  const rar=rollRarity(G);
  const pool=PERKS.filter(x=>x.r===rar&&!(x.u&&G.taken.includes(x)));
  const out=[],used=new Set();
  while(out.length<n&&out.length<pool.length){
    const perk=pick(pool);
    if(used.has(perk))continue;
    used.add(perk);out.push(perk);
  }
  return out;
}
function perkChoice(G){
  G.perkChances++;
  const p=G.player;
  if(p.px.perkHp){const a=p.maxHp*0.03;p.maxHp+=a;heal(p,a,true);}
  let opts;
  if(G.rarityLockOn){ /* 등급 고정 실험 */
    const pool=PERKS.filter(x=>x.r===G.rarityLock&&!(x.u&&G.taken.includes(x)));
    opts=[];const used=new Set();
    while(opts.length<3&&opts.length<pool.length){const pp=pick(pool);if(!used.has(pp)){used.add(pp);opts.push(pp);}}
  }else opts=rollPerks(G,p.px.choice4?4:3);
  if(!opts.length)return;
  const chosen=pick(opts);
  chosen.ap(p);
  G.taken.push(chosen);
}

/* ---------- 챕터 1회 실행 ---------- */
function runChapter(chapter,up,opts){
  opts=opts||{};
  const G={chapter,player:null,nodes:[],pprojs:[],arrows:[],gold:0,kills:0,
    perkChances:0,taken:[],legendOnly:false,overBoltCd:0,autoBoltT:2,
    dead:false,cleared:false,t:0,
    rarityLockOn:opts.rarityLock!==undefined,rarityLock:opts.rarityLock};
  const p=mkPlayer(up,G);G.player=p;p.G=G;
  const layout=chapterLayout(chapter);
  let x=560,wi=0;
  for(const node of layout){
    const nd={type:node.t,x,done:false,enemies:[]};
    if(node.t==='wave'){
      const st=enemyStats(chapter,wi);
      for(let j=0;j<node.size;j++){
        const ranged=Math.random()<0.4&&j>0;
        nd.enemies.push({worldX:x+j*88,hp:st.hp,maxHp:st.hp,dmg:st.dmg,ranged,
          atkTimer:rand(0.4,1.2),wave:nd,dead:false,isBoss:false,exp:0});
      }
      wi++;x+=(node.size-1)*88+560;
    }else if(node.t==='boss'){
      const st=enemyStats(chapter,wi);
      const bh=st.hp*TUNE.bossHp,bd=st.dmg*TUNE.bossDmg;   /* 챕터 무관 항상 동일 (PLAN §6 주인 확정) */
      nd.enemies.push({worldX:x+60,hp:bh,maxHp:bh,dmg:bd,ranged:false,
        atkTimer:1.2,wave:nd,dead:false,isBoss:true,hits:0});
    }else x+=470;
    G.nodes.push(nd);
  }
  const dt=1/30;
  const maxT=900;
  while(!G.dead&&!G.cleared&&G.t<maxT){
    G.t+=dt;
    if(G.overBoltCd>0)G.overBoltCd-=dt;
    for(const k in p.buffs){const arr=p.buffs[k];for(let i=arr.length-1;i>=0;i--){arr[i].t-=dt;if(arr[i].t<=0)arr.splice(i,1);}}
    const alive=aliveList(G);
    if(!alive.length)break;
    /* 이벤트 */
    let ev=false;
    for(const n of G.nodes){
      if(!n.done&&(n.type==='rest'||n.type==='devil'||n.type==='angel')&&p.worldX>n.x-95){
        n.done=true;ev=true;
        if(n.type==='rest'){
          if(p.px.restHp){const a=p.maxHp*0.15*p.px.restHp;p.maxHp+=a;heal(p,a,true);}
          if(p.hp<p.maxHp*0.6)heal(p,p.maxHp*0.4);
          else gainExp(G,10);
        }else if(n.type==='devil'){
          if(p.hp>p.maxHp*0.65){
            p.hp=Math.max(1,p.hp-p.maxHp*0.30);
            const rar=Math.random()<0.15?3:2;
            const pool=PERKS.filter(y=>y.r===rar&&!(y.u&&G.taken.includes(y)));
            if(pool.length){const perk=pick(pool);perk.ap(p);G.taken.push(perk);G.perkChances++;}
          }
        }else{p.dmg*=1.05;}
        break;
      }
    }
    if(ev)continue;
    /* 플레이어 */
    alive.sort((a,b)=>a.worldX-b.worldX);
    const tgt=alive[0];
    const dist=tgt.worldX-p.worldX;
    if(dist>74){p.worldX+=132*p.walkMul*dt;p.atkTimer=Math.min(p.atkTimer,0.35);}
    else{p.atkTimer-=dt*effAspd(p);if(p.atkTimer<=0){p.atkTimer+=1;playerStrike(G,tgt);}}
    if(p.px.autoBolt){G.autoBoltT-=dt;if(G.autoBoltT<=0){G.autoBoltT=2;for(let k=0;k<p.px.autoBolt;k++){const t2=randTarget(G);if(t2)dealDmg(G,t2,0.75);}}}
    /* 적 */
    for(const e of alive){
      if(e.hp<=0)continue;
      const d=e.worldX-p.worldX;
      if(!e.ranged){
        if(d<105){
          e.atkTimer-=dt;
          if(e.atkTimer<=0){
            e.atkTimer+=e.isBoss?1.6:1.3;
            let dm=e.dmg;
            if(e.isBoss){e.hits++;if(e.hits%3===0)dm*=2.2;}
            hitPlayer(G,dm,true,e);
            if(G.dead)break;
          }
        }
      }else if(d<440&&d>40){
        e.atkTimer-=dt;
        if(e.atkTimer<=0){e.atkTimer+=2.1;G.arrows.push({x:e.worldX-18,dmg:e.dmg,friendly:p.misfire>0&&Math.random()<p.misfire,src:e});}
      }
    }
    if(G.dead)break;
    /* 화살 */
    for(let i=G.arrows.length-1;i>=0;i--){
      const a=G.arrows[i];a.x-=330*dt;let hit=false;
      if(a.friendly){
        for(const e of alive){
          if(e!==a.src&&e.hp>0&&Math.abs(e.worldX-a.x)<16&&e.worldX<a.src.worldX){
            e.hp-=a.dmg*2;if(e.hp<=0)onKill(G,e);hit=true;break;
          }
        }
      }
      if(!hit&&a.x<=p.worldX+8){hitPlayer(G,a.dmg,false,a.src);hit=true;}
      if(hit||a.x<p.worldX-60)G.arrows.splice(i,1);
    }
    if(G.dead)break;
    /* 아군 투사체 */
    for(let i=G.pprojs.length-1;i>=0;i--){
      const pr=G.pprojs[i];pr.x+=pr.spd*dt;let done=false;
      if(pr.type==='spear'||pr.type==='wave'){
        for(const e of aliveList(G)){
          if(!pr.hit.has(e)&&Math.abs(e.worldX-pr.x)<16){
            pr.hit.add(e);dealDmg(G,e,pr.ratio);
            if(pr.type==='wave'&&pr.hit.size>=pr.pierce){done=true;break;}
          }
        }
        if(pr.x>pr.maxX)done=true;
      }else{
        if(!pr.tgt||pr.tgt.hp<=0)done=true;
        else if(pr.x>=pr.tgt.worldX-10){dealDmg(G,pr.tgt,pr.ratio);done=true;}
      }
      if(done)G.pprojs.splice(i,1);
    }
  }
  return {clear:G.cleared,time:G.t,gold:G.gold,taken:G.taken.map(t=>t.id),level:p.level};
}

/* ---------- 실험들 ---------- */
function exp1_rarityLadder(){
  const L1=parseInt(process.env.EXP1_UP||'4',10);   /* T5 규칙 재보정(R04 경제): 챕터6 도달 중앙값 4렙 */
  console.log(`\n=== 실험1: 등급 고정 파워 사다리 (챕터6, 강화 각 ${L1}렙, 300판) ===`);
  const up={dmg:L1,hp:L1,aspd:L1,crit:L1};
  for(const rar of [null,0,1,2,3]){
    let wins=0,times=0,n=300;
    for(let i=0;i<n;i++){
      const r=runChapter(6,up,rar===null?{}:{rarityLock:rar});
      if(r.clear){wins++;times+=r.time;}
    }
    const nm=rar===null?'혼합':['일반','희귀','전설','신화'][rar];
    console.log(`${nm}: 클리어 ${(wins/n*100).toFixed(1)}%  평균시간 ${wins?(times/wins).toFixed(0):'-'}s`);
  }
}
function exp2_perkWinrate(){
  const L=parseInt(process.env.EXP2_UP||'6',10);   /* T5 규칙 재보정(R04 경제): 챕터8 도달 중앙값 6렙 */
  console.log(`\n=== 실험2: 특전별 기여도 (챕터8, 강화 ${L}렙, 1200판) ===`);
  const up={dmg:L,hp:L,aspd:L,crit:L};
  const stat={};
  for(const p of PERKS)stat[p.id]={w:0,n:0};
  let base=0,N=1200;
  for(let i=0;i<N;i++){
    const r=runChapter(8,up,{});
    if(r.clear)base++;
    const set=new Set(r.taken);
    for(const id of set){stat[id].n++;if(r.clear)stat[id].w++;}
  }
  console.log(`전체 클리어율: ${(base/N*100).toFixed(1)}%`);
  const rows=[];
  for(const p of PERKS){
    const s=stat[p.id];
    if(s.n>=25)rows.push({id:p.id,r:p.r,n:s.n,wr:s.w/s.n*100});
  }
  rows.sort((a,b)=>b.wr-a.wr);
  console.log('-- 상위 12 --');
  rows.slice(0,12).forEach(x=>console.log(`  ${x.id}(${['일','희','전','신'][x.r]}) ${x.wr.toFixed(0)}% (${x.n}판)`));
  console.log('-- 하위 12 --');
  rows.slice(-12).forEach(x=>console.log(`  ${x.id}(${['일','희','전','신'][x.r]}) ${x.wr.toFixed(0)}% (${x.n}판)`));
  /* 채점표 실험2 기준(등급 내 최상−최하 < 25%p) 을 바로 읽을 수 있게 등급별 요약 추가 */
  console.log('-- 등급별 스프레드 (표본 25판 이상만) --');
  for(let r=0;r<4;r++){
    const rr=rows.filter(x=>x.r===r);
    if(!rr.length){console.log(`  ${['일반','희귀','전설','신화'][r]}: 표본 없음`);continue;}
    const hi=rr[0],lo=rr[rr.length-1],sp=hi.wr-lo.wr;
    console.log(`  ${['일반','희귀','전설','신화'][r]}: 최상 ${hi.id} ${hi.wr.toFixed(0)}% / 최하 ${lo.id} ${lo.wr.toFixed(0)}% → 폭 ${sp.toFixed(0)}%p ${sp<25?'OK':'초과'}`);
  }
}
function exp3_progression(){
  console.log('\n=== 실험3: 전체 진행 시뮬 (챕터 1→20, 골드로 강화 구매) ===');
  const up={dmg:0,hp:0,aspd:0,crit:0};
  let gold=0;
  const keys=['dmg','hp','aspd','crit'];
  /* 강화 상한 티어 (PLAN §2.2 주인 지시): 상한 = 10*(1+floor(min(4종 레벨)/10)) */
  const capOf=()=>10*(1+Math.floor(Math.min(up.dmg,up.hp,up.aspd,up.crit)/10));
  const buy=()=>{
    let bought=true;
    while(bought){
      bought=false;
      const cap=capOf();
      let best=null,bestCost=1e18;
      for(const k of keys){
        if(up[k]>=cap)continue;                     /* 상한에 걸린 강화는 구매 불가 */
        const c=TUNE.cost[k](up[k]);if(c<=gold&&c<bestCost){best=k;bestCost=c;}
      }
      if(best){gold-=bestCost;up[best]++;bought=true;}
    }
  };
  let totalAttempts=0;
  for(let c=1;c<=20;c++){
    let attempts=0,cleared=false;
    while(!cleared&&attempts<400){
      attempts++;totalAttempts++;
      const r=runChapter(c,up,{});
      gold+=r.gold;
      if(r.clear){gold+=TUNE.goldClear(c);cleared=true;}
      buy();
    }
    const lv=`${up.dmg}/${up.hp}/${up.aspd}/${up.crit}`;
    console.log(`챕터 ${String(c).padStart(2)}: 시도 ${String(attempts).padStart(3)}회  강화 ${lv}  ${cleared?'':'** 400회 실패 **'}`);
    if(!cleared)break;
  }
  console.log(`총 시도: ${totalAttempts}`);
}

const mode=process.argv[2]||'all';
if(mode==='1'||mode==='all')exp1_rarityLadder();
if(mode==='2'||mode==='all')exp2_perkWinrate();
if(mode==='3'||mode==='all')exp3_progression();
