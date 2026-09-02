'use strict';
/* 꼬마기사 밸런스 시뮬레이터 — 게임 엔진과 동일한 수식 사용 */

const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* ---------- 튜닝 파라미터 (여기 숫자를 게임에 이식) ---------- */
const TUNE={
  eBaseHp:40, eBaseDmg:8,
  /* ⚑ T35: 단일 성장률 `eHpG 1.185`·`eDmgG 1.08` 폐기 → PLAN §11.7 «구간별 성장률» 표.
     적 HP 는 플레이어 «공격력» 축, 적 DMG 는 «체력+실드» 축에서 주인 확정 스탯 사다리로부터 역산된 값이다.
     [하한, 성장률] — 챕터 c 에서 c+1 로 갈 때 적용할 배수를 c 로 찾는다.
     1~5 는 5→15 구간률을 앞으로, 260~300 은 120→260 구간률을 뒤로 연장한다 (PLAN §11.7 괄호 규정). */
  eHpSeg:[[0,1.0718],[15,1.0473],[30,1.0353],[50,1.0499],[70,1.0165],[120,1.0055]],
  eDmgSeg:[[0,1.0497],[15,1.0473],[30,1.0218],[50,1.0238],[70,1.0169],[120,1.0051]],
  /* ⚑ T35 임시값: 벽 배수 4종 전부 1.0 (= 비활성). 근거는 PROGRESS T35 행.
     요약 — PLAN §11.7 구간별 성장률은 «벽이 없는 매끈한 곡선» 으로 사다리 7점(5·15·30·50·70·120·260)에서
     직접 역산된 값이라, 그 위에 벽 배수를 얹으면 사다리가 곧바로 어긋난다(종전 3.6 은 새 곡선에서 83챕터분).
     T35 의 과녁은 사다리이므로 벽을 임시로 껐다. «사다리 유지 + 벽 존재» 를 동시에 만족하는 값은 T1 재산정 몫. */
  wallHp:1.0, wallDmg:1.0,      // 10챕터 이상 벽 배수 (임시 비활성 — T1 재산정)
  wall2Hp:1.0, wall2Dmg:1.0,    // 15챕터 이상 추가 배수 (임시 비활성 — T1 재산정)
  waveHp:0.15, waveDmg:0.08,    // 웨이브 인덱스당 (R03)
  wall3Hp:1.0, wall3Dmg:1.0,    // 90챕터 대형 벽 (임시 비활성 — T1 재산정)
  wall4Hp:1.0, wall4Dmg:1.0,    // 300챕터 최종 벽 (임시 비활성 — T1 재산정)
  bossHp:8, bossDmg:1.8,        // 주인 확정 상수 (튜닝 노브 아님) — 5배수 챕터 추가 배수 폐기
  maxChapter:300,               // PLAN §2.4 (§11 도입으로 20 → 100 → 주인 추가 지시로 300)
  /* 플레이어 기본치 (영구강화 4종 폐지 — 성장은 §11 장비 + 슬롯 강화가 전담)
     ⚑ T35 주인 확정(PLAN §11.5-a): 공 25 / 체 150 / 실드 250. 실드는 `maxHp*0.8` 파생이 아니라 독립 스탯이다. */
  pAtk0:25, pHp0:150, pSh0:250, pAspd0:1.0, pCrit0:5,
  goldKillBase:0.6, goldKillPer:0.10, goldClearPer:3,
  goldGrowth:1.22,              // 챕터당 골드 성장 배수 (R07: 1.185 → 1.22. 1.185 는 챕터 90 대형 벽에서 슬롯 13 에 갇혀 F2P·과금 둘 다 영구 정체했다 — 실험4 실측. eHpG 보다 높게 둬야 후반 벽에서 수입이 적 성장을 따라잡는다)
  expKill:3, expBoss:9, expNeed:lv=>4+2*lv,
};
TUNE.goldKill=c=>(TUNE.goldKillBase+TUNE.goldKillPer*c)*Math.pow(TUNE.goldGrowth,c-1)*rand(1,1.8);
TUNE.goldClear=c=>TUNE.goldClearPer*c*Math.pow(TUNE.goldGrowth,c-1);
/* 스윕용 오버라이드 (기본 동작 불변) — 예: TUNE_OVERRIDE='{"eHpG":1.22}' node sim.js 3 */
if(process.env.TUNE_OVERRIDE){
  const o=JSON.parse(process.env.TUNE_OVERRIDE);
  for(const k in o){ if(typeof o[k]==='object'&&o[k]) Object.assign(TUNE[k],o[k]); else TUNE[k]=o[k]; }
}

/* ---------- 챕터 레이아웃 (결정적) ---------- */
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

/* ---------- 시드 RNG (하니스 전용 · R11) ----------
   `SEED=<정수>` 를 주면 Math.random 을 결정적 스트림으로 갈아끼운다. SEED 미설정 시 동작은 종전과 완전히 동일하다.
   스트림을 둘로 나눈 이유: 실험4 «과금은 가속만» 기준(§7)을 재려면 F2P/과금이 같은 난수를 써야 하는데(공통난수),
   과금은 1일차에 뽑기를 30회 더 하므로 단일 스트림이면 그 시점부터 전투 난수까지 통째로 어긋나 비교가 무의미해진다.
   뽑기를 별도 스트림으로 빼면 «k번째 뽑기 결과» 가 두 계정에서 동일해져, 과금은 같은 뽑기 수열을 더 빨리 소비할 뿐이 된다. */
let RNG_GACHA=null;
function setSeed(s){ const m=mulberry(s|0); Math.random=()=>m(); RNG_GACHA=mulberry((s^0x9E3779B9)|0); }
const grand=()=>(RNG_GACHA||Math.random)();
/* ⚑ 주인 확정 제약 (PLAN §2.4, 2026-09-02 14:2X) — 전 300 챕터 공통:
   ① 적 총 수 ≤ 100 (보스 제외 웨이브 적 합) ② 쉼터 1~4 ③ 악마 정확히 1 ④ 천사 정확히 1.
   가중치(45/30/25) 배치는 폐기 — 악마1·천사1 을 먼저 깔고 남는 슬롯을 전부 쉼터로 채운 뒤 순서만 시드 셔플한다. */
const LAYOUT_MAXENEMY=100;
function chapterLayout(c){
  const rnd=mulberry(c*1013904223+77);
  let waveCount=4+(rnd()<0.4?1:0);
  let size=rnd()<0.5?10:12;
  while(waveCount*size>LAYOUT_MAXENEMY&&size>10) size-=2;      /* ① 마릿수부터 줄이고 */
  while(waveCount*size>LAYOUT_MAXENEMY&&waveCount>4) waveCount--; /* 그래도 넘치면 웨이브 수 */
  const evs=['devil','angel'];                                  /* ③④ 정확히 하나씩 */
  const rest=clamp(waveCount-3,1,4);                            /* ② 남는 슬롯 = 쉼터, 1~4 클램프 */
  for(let i=0;i<rest;i++) evs.push('rest');
  for(let i=evs.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); const t=evs[i]; evs[i]=evs[j]; evs[j]=t; }
  const out=[];
  for(let i=0;i<evs.length;i++){ out.push({t:'wave',size}); out.push({t:evs[i]}); }
  out.push({t:'wave',size});
  out.push({t:'boss'});
  return out;
}
/* ⚑ T35: 구간별 성장률 누적 배수. 챕터 1 을 1.0 으로 두고 1→c 까지 각 스텝의 구간 배수를 곱한다.
   결과는 메모이즈한다 (실험3/4 가 챕터 300 까지 수만 번 호출한다). */
function segRate(seg,c){ let r=seg[0][1]; for(const s of seg){ if(c>=s[0]) r=s[1]; } return r; }
function segGrow(seg,cache,c){
  if(cache[c]!==undefined) return cache[c];
  let v=1; for(let k=1;k<c;k++) v*=segRate(seg,k);
  cache[c]=v; return v;
}
const _hpGrow={}, _dmgGrow={};
function enemyStats(c,w){
  let hp=TUNE.eBaseHp*segGrow(TUNE.eHpSeg,_hpGrow,c)*(1+TUNE.waveHp*w);
  let dmg=TUNE.eBaseDmg*segGrow(TUNE.eDmgSeg,_dmgGrow,c)*(1+TUNE.waveDmg*w);
  if(c>=10){hp*=TUNE.wallHp; dmg*=TUNE.wallDmg;}
  if(c>=15){hp*=TUNE.wall2Hp; dmg*=TUNE.wall2Dmg;}
  if(c>=90){hp*=TUNE.wall3Hp; dmg*=TUNE.wall3Dmg;}     /* 90 대형 벽 (PLAN §11.7) */
  if(c>=300){hp*=TUNE.wall4Hp; dmg*=TUNE.wall4Dmg;}    /* 300 최종 벽 (PLAN §11.7) */
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
  add('c_killHeal2',0,p=>p.killHeal+=0.0037);
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
  add('l_killHeal5',2,p=>p.killHeal+=0.0055);
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
  add('l_perkHp',2,p=>{p.px.perkHp=true; for(let i=0;i<p.G.perkChances;i++){const a=p.maxHp*0.018;p.maxHp+=a;heal(p,a,true);}},1);
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
  add('m_time',3,p=>{p.aspd*=1.21;p.walkMul+=0.21;});
  add('m_axe3',3,p=>p.px.axeCount=1,1);
  add('m_arrow4',3,p=>p.px.arrowCount=1,1);
  add('m_spear200',3,p=>p.px.spearMaster=1,1);
  add('m_bolt3',3,p=>p.px.boltCount=1,1);
  add('m_wave4',3,p=>p.px.waveKing=1,1);
  add('m_gold2',3,p=>p.goldMul*=2,1);
  add('m_sage',3,p=>p.px.sage=true,1);
  add('m_def20',3,p=>p.def+=8);
  add('m_crit25',3,p=>p.critR+=9);
  add('m_giant',3,p=>{const a=p.maxHp*0.16;p.maxHp+=a;heal(p,a,true);});
  add('m_lucky',3,p=>{p.evade+=11;p.counter+=11;});
  add('m_choice4',3,p=>p.px.choice4=true,1);
  add('m_fortress',3,p=>p.maxSh*=2.4);
  add('m_wallBuff',3,p=>p.px.wallBuff++);
  return P;
}
const PERKS=mkPerks();

/* ================= 장비 시스템 (PLAN §11) ================= */
/* 등급 5 · 부위 6 · 부위당 종류 3 (=18계열). 장착 시 공/체 상승 + 계열 옵션.
   옵션 개수: 일반0 · 희귀1 · 영웅2 · 전설3 · 신화4, 신화는 +3/+6/+9 강에서 1개씩 추가(최대 7). */
const GT={
  parts:['weapon','helm','armor','glove','boot','neck'],
  partName:{weapon:'무기',helm:'투구',armor:'갑옷',glove:'장갑',boot:'신발',neck:'목걸이'},
  types:{
    weapon:['greatsword','axe','bow'], helm:['helmet','crown','hood'],
    armor:['plate','chain','robe'],    glove:['gauntlet','leather','handwrap'],
    boot:['sandal','boots','greave'],  neck:['pendant','amulet','beads'],
  },
  typeName:{greatsword:'대검',axe:'전투도끼',bow:'장궁',helmet:'투구',crown:'왕관',hood:'두건',
    plate:'판금갑옷',chain:'사슬갑옷',robe:'로브',gauntlet:'건틀릿',leather:'가죽장갑',handwrap:'핸드랩',
    sandal:'샌들',boots:'부츠',greave:'장화',pendant:'펜던트',amulet:'부적',beads:'구슬목걸이'},
  rarName:['일반','희귀','영웅','전설','신화'],
  /* ⚑ T35 — 등급별 1부위 기여 (0강·슬롯 0렙). PLAN §11.5-a 주인 확정표를 그대로 옮긴 값이다.
     종전의 «기준값 ÷ rarStep^n» 등비 생성(`atkUnit`·`hpUnit`·`rarStep 155`)은 전면 폐기 — 역산 금지.
     인덱스 = 일반0 · 희귀1 · 영웅2 · 전설3 · 신화4. 실드는 체력 파생이 아니라 독립 기여축이다.
     검산(기본치 공25/체150/실250 + 6부위): 일반 50/250/400 · 희귀 100/500/800 · 영웅 200/700/1300 ·
     전설 530/1000/2200 · 신화 1200/2385/5000 · 신화+9강 2575/5000/10558 (PLAN §11.7 사다리표와 일치). */
  atk:[4.167, 12.500,  29.167,  84.167, 195.833],
  hp: [16.667, 58.333,  91.667, 141.667, 372.500],
  sh: [25.000, 91.667, 175.000, 325.000, 791.667],
  plusStep:0.13,                 // 강화 1레벨당 해당 장비 공/체/실 +13% (주인 확정 — 종전 0.12)
  slotLvMax:150,                 // 슬롯 레벨 상한 (주인 확정)
  slotStep:0.01,                 // 슬롯 1레벨당 공/체/실 +1% (가산 — 종전 `slotG 2.68` 등비 폐기)
  slotCostBase:600, slotCostG:3.5,   // 슬롯 강화 비용 = base*costG^L
  /* R07: 150/5.5 → 600/4.2. T6 의 «costG < goldGrowth^6» 규칙은 틀렸다 — 5.5 는 그 규칙을 지키고도 실험4 가
     챕터 118 에서 40일 정체했다. 올바른 조건은 «슬롯 1렙이 벌어주는 챕터 수(ln slotG/ln eHpG = 5.808챕터) 동안의
     골드 증가분 goldGrowth^5.808 ≥ costG», 즉 costG ≤ 1.22^5.808 = 3.174 다.
     R09: 4.2 → 3.5 (T13·T15). R07 이 «4.2 는 이를 만족» 이라 적은 것은 계산 착오였다 — 4.2 > 3.174 라 위반이고,
     매 챕터 3.4% 씩 적에게 뒤처져 실험3 이 챕터 120 부터 무너지고 실험4 가 챕터 212 에서 영구 정체했다.
     3.5 는 적대비 0.990 으로 적자가 1/3.5 로 줄어 챕터 300 완주가 된다(워커 A T13 3런 + R09 6런 = 9런 재현).
     3.3 이하는 폭주(91~300 전부 시도 1회), 3.8 이상은 열화 시점이 밀릴 뿐 곡선이 같다 — 유효 구간 3.4~3.6.
     ⚠ 대가: 챕터 90 도달 시 슬롯이 14~15렙(=앵커 A 스펙)에서 16렙으로 올라가 90 대형 벽이 무너진다(R09 6런 0/6).
        slotCostBase 로 되돌리려면 3000 이 필요한데 그 지점에서 챕터 10~18 이 400회 상한에 막힌다 — 승인 대기 14번. */
  evenStep:0.05, evenPer:5,      // 6슬롯 전부 5N렙 → 공/체/실 +5%*N (PLAN §11.4 — T35 로 실드에도 적용)
  pullCost:400, dailyGem:2500, iapGem:12000,   // 주인 확정 상수
  legendToMythPlus:10,           // 전설 +10강 도달 시 신화 0강으로 변환
  runsPerDay:30,                 // (위임) 하루 플레이 판수 — 실험3/4 의 다이아 적립 환산 기준
};
/* 스윕용 오버라이드 — 예: GT_OVERRIDE='{"slotG":1.6}' node sim.js 5 */
if(process.env.GT_OVERRIDE){
  const o=JSON.parse(process.env.GT_OVERRIDE);
  for(const k in o){ if(Array.isArray(o[k])||typeof o[k]!=='object'||!o[k]) GT[k]=o[k]; else Object.assign(GT[k],o[k]); }
}
/* ⚑ T35: GT.atk/hp/sh 는 위 확정표를 그대로 쓴다 (파생 생성 없음). 슬롯은 «1렙당 +1% 가산 · 상한 150». */
GT.slotMul=L=>1+GT.slotStep*Math.min(L,GT.slotLvMax);
GT.slotCost=L=>Math.floor(GT.slotCostBase*Math.pow(GT.slotCostG,L));
GT.allTypes=[]; for(const pt of GT.parts) for(const ty of GT.types[pt]) GT.allTypes.push({part:pt,type:ty});
/* 옵션 개수: 등급별 + 신화 강화 보너스 */
GT.optCount=(rar,plus)=>{
  let n=rar;                                   // 일반0 희귀1 영웅2 전설3 신화4
  if(rar===4){ if(plus>=3)n++; if(plus>=6)n++; if(plus>=9)n++; }
  return n;
};

/* ---- 18계열 옵션표 (PLAN §11.6 초안 — 기존 엔진 동사만 재사용) ----
   각 계열 7단계, 상위 등급은 하위 옵션을 전부 포함하고 하나 더 얹는다. */
const GOPT={
  /* 무기 */
  greatsword:[ /* 검기 계열 */
    {d:'공격력 +6%',            ap:p=>p.dmg*=1.06},
    {d:'공격 시 20% 확률 검기 발사', ap:p=>p.px.wave++},
    {d:'공격 시 30% 확률 공격력 +14% 4초', ap:p=>p.px.atkBuffM++},
    {d:'검기 관통 20·사거리 1400', ap:p=>p.px.waveKing=1},
    {d:'공격 시 25% 확률 공격력 +35% 5초', ap:p=>p.px.atkBuffL++},
    {d:'반격 시 검기 발사(확정)', ap:p=>p.px.counterWave++},
    {d:'체력 50% 이하 적에게 피해 2.2배', ap:p=>p.px.execute=true},
  ],
  axe:[ /* 도끼 계열 */
    {d:'공격력 +6%',            ap:p=>p.dmg*=1.06},
    {d:'공격 시 15% 확률 도끼 발사', ap:p=>p.px.axe++},
    {d:'치명타 확률 +6',        ap:p=>p.critR+=6},
    {d:'도끼 14개로 증가',       ap:p=>p.px.axeCount=1},
    {d:'도끼 발사 확률 +15%p',   ap:p=>p.px.axe++},
    {d:'처치 시 실드 충전',      ap:p=>p.px.killShield3++},
    {d:'최대 체력 적 첫 타격 피해 +20%', ap:p=>p.px.firstHit++},
  ],
  bow:[ /* 화살 계열 */
    {d:'공격력 +6%',            ap:p=>p.dmg*=1.06},
    {d:'공격 시 15% 확률 화살 2발', ap:p=>p.px.arrow2++},
    {d:'치명타 배율 +30',       ap:p=>p.critF+=30},
    {d:'화살 24발로 증가',       ap:p=>p.px.arrowCount=1},
    {d:'치명타 시 75% 확률 추가타', ap:p=>p.px.extraHit++},
    {d:'화살 발사 확률 +15%p',   ap:p=>p.px.arrow2++},
    {d:'최대 체력 적에게 치명타 확률 62', ap:p=>p.px.fullHpCrit=true},
  ],
  /* 투구 */
  helmet:[ /* 방어 계열 */
    {d:'방어 +6',               ap:p=>p.def+=6},
    {d:'피격 시 방어 +3 3초(누적)', ap:p=>p.px.defHitBuff++},
    {d:'방어 +8',               ap:p=>p.def+=8},
    {d:'피격 시 30% 확률 방어 +14 4초', ap:p=>p.px.defBuff2++},
    {d:'피격 시 방어 +10 4초(최대 2중첩)', ap:p=>p.px.wallBuff++},
    {d:'피격 시 20% 확률 방어 +15 4초', ap:p=>p.px.defBuffL++},
    {d:'실드가 있으면 받는 피해 38% 감소', ap:p=>p.px.guardCrystal=true},
  ],
  crown:[ /* 치명타 확률 계열 */
    {d:'치명타 확률 +6',        ap:p=>p.critR+=6},
    {d:'치명타 시 치명 확률 +5 3초(누적)', ap:p=>p.px.critChain++},
    {d:'치명타 확률 +8',        ap:p=>p.critR+=8},
    {d:'처치 시 30% 확률 치명 확률 +14 4초', ap:p=>p.px.killCritBuff++},
    {d:'치명타 시 45% 확률 공격 즉시 재장전', ap:p=>p.px.critReset++},
    {d:'치명타 확률 +10',       ap:p=>p.critR+=10},
    {d:'치명타 시 공격력 +15% 4초', ap:p=>p.px.critAtkBuff++},
  ],
  hood:[ /* 번개 계열 */
    {d:'치명타 배율 +25',       ap:p=>p.critF+=25},
    {d:'공격 시 10% 확률 번개 2발', ap:p=>p.px.bolt++},
    {d:'치명타 시 치명 배율 +34 4초', ap:p=>p.px.critFBuff++},
    {d:'번개 20회로 증가',       ap:p=>p.px.boltCount=1},
    {d:'2.4초마다 번개 자동 발사', ap:p=>p.px.autoBolt++},
    {d:'치명타 시 공격속도 +25% 3초', ap:p=>p.px.critAspdBuff++},
    {d:'공격 시 16% 확률 소환 무작위 발사', ap:p=>p.px.arsenal++},
  ],
  /* 갑옷 */
  plate:[ /* 체력·피격 계열 */
    {d:'최대 체력 +8%',         ap:p=>{const a=p.maxHp*0.08;p.maxHp+=a;heal(p,a,true);}},
    {d:'피격 시 15% 확률 체력 2% 회복', ap:p=>p.px.hitHeal++},
    {d:'최대 체력 +10%',        ap:p=>{const a=p.maxHp*0.10;p.maxHp+=a;heal(p,a,true);}},
    {d:'피격 시 22% 확률 회피 +14 3초', ap:p=>p.px.hitEvadeBuff++},
    {d:'최대 체력 +12%',        ap:p=>{const a=p.maxHp*0.12;p.maxHp+=a;heal(p,a,true);}},
    {d:'피격 시 10% 확률 실드 5% 충전', ap:p=>p.px.shieldOnHit++},
    {d:'사망 시 1회 부활',       ap:p=>p.px.revive++},
  ],
  chain:[ /* 가시 계열 */
    {d:'방어 +5',               ap:p=>p.def+=5},
    {d:'피격 시 60% 확률 가시 반사', ap:p=>p.px.thorns++},
    {d:'방어 +7',               ap:p=>p.def+=7},
    {d:'피격 시 방어 +3 3초(누적)', ap:p=>p.px.defHitBuff++},
    {d:'가시 반사 확률 +60%p',   ap:p=>p.px.thorns++},
    {d:'최대 체력 +10%',        ap:p=>{const a=p.maxHp*0.10;p.maxHp+=a;heal(p,a,true);}},
    {d:'피격 시 30% 확률 회피 +15 3초', ap:p=>p.px.evadeHitBuff++},
  ],
  robe:[ /* 실드 계열 */
    {d:'최대 실드 +15%',        ap:p=>p.maxSh*=1.15},
    {d:'처치 시 실드 소량 충전', ap:p=>p.px.killShield3++},
    {d:'최대 실드 +20%',        ap:p=>p.maxSh*=1.20},
    {d:'회복 시 30% 확률 실드 8% 충전', ap:p=>p.px.healShield5++},
    {d:'처치 시 실드 충전 강화', ap:p=>p.px.killShield10++},
    {d:'최대 실드 +25%',        ap:p=>p.maxSh*=1.25},
    {d:'실드가 0일 때 공격력 1.5배', ap:p=>p.px.rage=true},
  ],
  /* 장갑 */
  gauntlet:[ /* 치명타 배율 계열 */
    {d:'치명타 배율 +30',       ap:p=>p.critF+=30},
    {d:'치명타 시 치명 배율 +10 3초', ap:p=>p.px.critFsmall++},
    {d:'치명타 배율 +40',       ap:p=>p.critF+=40},
    {d:'치명타 시 30% 확률 체력 4% 회복', ap:p=>p.px.critHeal3++},
    {d:'치명타 배율 +50',       ap:p=>p.critF+=50},
    {d:'치명타 시 75% 확률 추가타', ap:p=>p.px.extraHit++},
    {d:'뒤쪽 적에게 피해 3.2배',   ap:p=>p.px.backDmg=true},
  ],
  leather:[ /* 공격속도 계열 */
    {d:'공격속도 +8%',          ap:p=>p.aspd*=1.08},
    {d:'공격 시 30% 확률 공속 +5% 3초', ap:p=>p.px.c_aspdBuff++},
    {d:'공격속도 +10%',         ap:p=>p.aspd*=1.10},
    {d:'처치 시 공속 +20% 4초',  ap:p=>p.px.aspdKill++},
    {d:'공격속도 +12%',         ap:p=>p.aspd*=1.12},
    {d:'처치마다 공속 영구 +1%', ap:p=>p.px.killAspd=true},
    {d:'공속 +35%·이동속도 +35%', ap:p=>{p.aspd*=1.35;p.walkMul+=0.35;}},
  ],
  handwrap:[ /* 연타·분신 계열 */
    {d:'공격력 +5%',            ap:p=>p.dmg*=1.05},
    {d:'공격 시 30% 확률 공격력 +5% 3초', ap:p=>p.px.c_atkBuff++},
    {d:'공격력 +7%',            ap:p=>p.dmg*=1.07},
    {d:'공격 시 10% 확률 공격력 영구 +1%', ap:p=>p.px.atkPerm++},
    {d:'공격력 +9%',            ap:p=>p.dmg*=1.09},
    {d:'기본공격마다 분신 추가타', ap:p=>p.px.clone=true},
    {d:'체력 25% 이하 적 즉사(보스 제외)', ap:p=>p.px.execKill=true},
  ],
  /* 신발 (주인 예시 계열 그대로) */
  sandal:[ /* 회피 계열 */
    {d:'회피 +7',               ap:p=>p.evade+=7},
    {d:'회피 시 10% 확률 도끼 1개 발사', ap:p=>p.px.evadeAxe++},
    {d:'회피 +8',               ap:p=>p.evade+=8},
    {d:'회피 시 공격력 +28% 5초', ap:p=>p.px.evadeAtkBuff++},
    {d:'회피 시 15% 확률 체력 7% 회복', ap:p=>p.px.evadeHeal++},
    {d:'회피 시 회피 +8 3초(누적)', ap:p=>p.px.evadeEvBuff++},
    {d:'회피 시 다음 공격 치명타 확정', ap:p=>p.px.evadeCrit=true},
  ],
  boots:[ /* 반격 계열 */
    {d:'반격 확률 +7',          ap:p=>p.counter+=7},
    {d:'반격 시 공격력 +5% 3초', ap:p=>p.px.counterAtkS++},
    {d:'반격 확률 +8',          ap:p=>p.counter+=8},
    {d:'반격 시 공격력 +14% 4초', ap:p=>p.px.counterAtkM++},
    {d:'반격 피해 +100%',        ap:p=>p.px.counterX++},
    {d:'반격 시 체력 4% 회복',   ap:p=>p.px.counterHeal++},
    {d:'반격 시 연쇄 반격(확정)', ap:p=>p.px.counterChain=true},
  ],
  greave:[ /* 체력 계열 */
    {d:'최대 체력 +8%',         ap:p=>{const a=p.maxHp*0.08;p.maxHp+=a;heal(p,a,true);}},
    {d:'처치 시 체력 0.5% 회복', ap:p=>p.killHeal+=0.005},
    {d:'최대 체력 +10%',        ap:p=>{const a=p.maxHp*0.10;p.maxHp+=a;heal(p,a,true);}},
    {d:'회복량 +20%',           ap:p=>p.healAmp+=0.2},
    {d:'최대 체력 +12%',        ap:p=>{const a=p.maxHp*0.12;p.maxHp+=a;heal(p,a,true);}},
    {d:'처치 시 체력 +0.8% 추가 회복', ap:p=>p.killHeal+=0.008},
    {d:'체력 10% 이하 시 회피 +40', ap:p=>p.px.lastStand=true},
  ],
  /* 목걸이 */
  pendant:[ /* 회복 계열 */
    {d:'회복량 +15%',           ap:p=>p.healAmp+=0.15},
    {d:'회복 시 30% 확률 방어 +5 3초', ap:p=>p.px.healDefBuff++},
    {d:'회복량 +20%',           ap:p=>p.healAmp+=0.20},
    {d:'회복 시 20% 확률 실드 3% 충전', ap:p=>p.px.healShield3++},
    {d:'회복 시 공격력 +8% 3초', ap:p=>p.px.healAtkBuff++},
    {d:'회복 시 20% 확률 추가 회복', ap:p=>p.px.healBoost2++},
    {d:'과회복분의 7배가 실드로 전환', ap:p=>p.px.overheal=true},
  ],
  amulet:[ /* 처치 계열 */
    {d:'골드 획득 +30%',        ap:p=>p.goldMul+=0.3},
    {d:'처치 시 방어 +10 3초',   ap:p=>p.px.killDefBuff++},
    {d:'골드 획득 +40%',        ap:p=>p.goldMul+=0.4},
    {d:'처치 시 30% 확률 치명 확률 +14 4초', ap:p=>p.px.killCritBuff++},
    {d:'획득 경험치 +1',        ap:p=>p.px.sage=true},
    {d:'처치 시 실드 충전 강화', ap:p=>p.px.killShield10++},
    {d:'골드 획득 2배',          ap:p=>p.goldMul*=2},
  ],
  beads:[ /* 창 계열 */
    {d:'공격력 +5%',            ap:p=>p.dmg*=1.05},
    {d:'공격 시 7.5% 확률 창 발사', ap:p=>p.px.spear++},
    {d:'치명타 확률 +6',        ap:p=>p.critR+=6},
    {d:'창 피해 13.5배·관통',    ap:p=>p.px.spearMaster=1},
    {d:'창 발사 확률 +7.5%p',    ap:p=>p.px.spear++},
    {d:'적 화살 30% 확률 오발',  ap:p=>p.misfire+=0.30},
    {d:'모든 발동 확률 1.22배',  ap:p=>p.px.procX2=true},
  ],
};

/* ---- 뽑기 (PLAN §11.2) ---- */
function newGacha(){ return {p50:0,p10:0,pulls:0}; }
function gachaPull(st){
  st.pulls++; st.p50++; st.p10++;
  const pityM=st.p50>=50, pityL=st.p10>=10;
  let rar;
  if(pityM) rar=4;
  else{
    const r=grand()*100;
    rar = r<0.1?4 : r<2.1?3 : r<12.1?2 : r<42.1?1 : 0;
    if(pityL&&rar<3) rar=3;
  }
  if(rar===4){
    st.p50=0;
    /* 50천장과 10피티가 겹치면 신화 우선 · 전설 확정은 다음 뽑기로 이월(p10 유지) */
    if(!(pityM&&pityL)) st.p10=0;
  }else if(rar===3) st.p10=0;
  const t=GT.allTypes[Math.floor(grand()*GT.allTypes.length)];   /* 뽑기 스트림 (R11) */
  return {part:t.part,type:t.type,rar,plus:0};
}

/* ---- 합성 (PLAN §11.3) ---- */
const gearKey=g=>`${g.part}|${g.type}|${g.rar}|${g.plus}`;
/* 합성 산출물 규칙 — 자동(fuseAll)·수동(합성 화면) 둘 다 **이 함수 하나만** 쓴다.
   규칙을 두 곳에 적으면 T8·T9·T11·T12 계열(«같은 수치를 손으로 두 번 옮기다 어긋남») 이 재발한다.
   base = 재료 3개 중 최고 강화품(호출부가 정렬해서 넘긴다). */
function fuseMake(base){
  if(base.rar<3) return {part:base.part,type:base.type,rar:base.rar+1,plus:0};
  if(base.rar===3){
    const np=base.plus+1;
    return np>=GT.legendToMythPlus
      ? {part:base.part,type:base.type,rar:4,plus:0}            /* +10강 도달 → 신화 0강 변환 */
      : {part:base.part,type:base.type,rar:3,plus:np};
  }
  return {part:base.part,type:base.type,rar:4,plus:base.plus+1};   /* 신화 무한 강화 */
}
/* inv: 배열. equipped: Set(장착 중인 객체) — 재료에서 제외 */
function fuseAll(inv,equipped){
  let did=true,count=0;
  while(did){
    did=false;
    const groups=new Map();
    for(const g of inv){
      if(equipped.has(g))continue;
      const k=`${g.part}|${g.type}|${g.rar}`;
      if(!groups.has(k))groups.set(k,[]);
      groups.get(k).push(g);
    }
    for(const [k,arr] of groups){
      if(arr.length<3)continue;
      arr.sort((a,b)=>b.plus-a.plus);          /* 재료 중 최고 강화 기준 */
      const mats=arr.slice(0,3), base=mats[0];
      const made=fuseMake(base);
      for(const m of mats){const i=inv.indexOf(m);inv.splice(i,1);}
      inv.push(made);count++;did=true;
      break;                                    /* 인벤이 바뀌었으니 재그룹화 */
    }
  }
  return count;
}
const gearScore=g=>g.rar*1000+g.plus;           /* 등급 우선, 같은 등급이면 강화 (신화0>전설9 제약과 일관) */
function autoEquip(inv){
  const eq={};
  for(const g of inv){ const b=eq[g.part]; if(!b||gearScore(g)>gearScore(b))eq[g.part]=g; }
  return eq;                                    /* {part: gear|undefined} */
}

/* ---- 빌드(계정 상태) → 전투 스탯 ---- */
/* build = {eq:{part:gear|null}, slots:{part:레벨}} */
function mkBuild(rar,plus,slotLv,typeIdx){
  const eq={},slots={};
  for(const pt of GT.parts){
    eq[pt] = rar<0?null:{part:pt,type:GT.types[pt][typeIdx||0],rar,plus:plus||0};
    slots[pt]=slotLv||0;
  }
  return {eq,slots};
}
const evenBonus=b=>1+GT.evenStep*Math.floor(Math.min(...GT.parts.map(pt=>b.slots[pt]||0))/GT.evenPer);
/* 진단용 평탄 빌드: 장비/옵션 없이 공/체만 직접 지정 (앵커 요구 전투력 역산 fit 모드) */
function flatBuild(atk,hp,sh){ const slots={}; for(const pt of GT.parts) slots[pt]=0; return {eq:{},slots,flat:{atk,hp,sh:sh===undefined?TUNE.pSh0:sh}}; }
function buildPower(b){
  if(b.flat)return b.flat;
  let atk=0,hp=0,sh=0;
  for(const pt of GT.parts){
    const g=b.eq[pt]; if(!g)continue;
    const m=GT.slotMul(b.slots[pt]||0)*(1+GT.plusStep*g.plus);
    atk+=GT.atk[g.rar]*m; hp+=GT.hp[g.rar]*m; sh+=GT.sh[g.rar]*m;
  }
  const ev=evenBonus(b);
  return {atk:(TUNE.pAtk0+atk)*ev, hp:(TUNE.pHp0+hp)*ev, sh:(TUNE.pSh0+sh)*ev};
}

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
    evadeAxe:0,
  };
}
function mkPlayer(build,G){
  const pw=buildPower(build);
  const maxHp=pw.hp;
  const p={G, worldX:0, atkTimer:0, nextAtk:0, nextCrit:false,
    dmg:pw.atk, aspd:TUNE.pAspd0, critR:TUNE.pCrit0, critF:200,
    def:5, counter:10, evade:8, steal:0, killHeal:0, misfire:0, goldMul:1, walkMul:1, healAmp:0,
    maxHp, hp:maxHp, maxSh:pw.sh, sh:pw.sh,   /* ⚑ T35: 실드 독립 스탯 (`maxHp*0.8` 파생 폐기) */
    level:1, exp:0, buffs:{atk:[],aspd:[],critR:[],critF:[],def:[],evade:[]}, px:basePx()};
  /* 장비 계열 옵션 적용 (PLAN §11.1 — 상위 등급은 하위 옵션 포함) */
  for(const pt of GT.parts){
    const g=build.eq[pt]; if(!g)continue;
    const tbl=GOPT[g.type]; if(!tbl)continue;
    const n=GT.optCount(g.rar,g.plus);
    for(let i=0;i<n&&i<tbl.length;i++) tbl[i].ap(p);
  }
  p.hp=p.maxHp; p.sh=p.maxSh=Math.round(p.maxSh);
  return p;
}
const bsum=(p,k)=>{let s=0;for(const b of p.buffs[k])s+=b.amt;return s;};
function addBuff(p,k,amt,dur,max){
  const arr=p.buffs[k];
  if(arr.length>=max){let mi=0;for(let i=1;i<arr.length;i++)if(arr[i].t<arr[mi].t)mi=i;arr[mi]={t:dur,amt};}
  else arr.push({t:dur,amt});
}
const pkk=(p,ch)=>Math.random()<ch*(p.px.procX2?1.22:1);
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
      if(px.overheal) p.sh=Math.min(p.maxSh,p.sh+over*7);
      if(px.overBolt&&p.G.overBoltCd<=0){ p.G.overBoltCd=0.12; fireBolts(p,true); }
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
  if(px.killShield3)p.sh=Math.min(p.maxSh,p.sh+p.maxSh*0.007*px.killShield3);
  if(px.killShield10)p.sh=Math.min(p.maxSh,p.sh+p.maxSh*0.0075*px.killShield10);
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
  if(px.fullHpCrit&&full)cr=Math.max(cr,62);
  if(fromBasic&&p.nextCrit){cr=100;}
  const crit=Math.random()*100<cr;
  if(fromBasic&&p.nextCrit)p.nextCrit=false;
  let d=effDmg(p)*ratio*(crit?effCritF(p)/100:1)*rand(0.92,1.08);
  if(full&&px.firstHit)d*=1+0.20*px.firstHit;
  if(px.execute&&e.hp<=e.maxHp*0.5)d*=2.2;
  if(px.backDmg){
    let front=null;for(const en of aliveList(G))if(!front||en.worldX<front.worldX)front=en;
    if(front&&e!==front)d*=3.2;
  }
  e.hp-=d;
  if(p.steal>0)heal(p,d*p.steal/100);
  if(crit){
    if(px.critChain)addBuff(p,'critR',5*px.critChain,3,5);
    if(px.critFsmall)addBuff(p,'critF',10*px.critFsmall,3,3);
    if(px.critFBuff)addBuff(p,'critF',34*px.critFBuff,4,3);
    if(px.critAtkBuff)addBuff(p,'atk',0.15*px.critAtkBuff,4,3);
    if(px.critAspdBuff)addBuff(p,'aspd',0.25*px.critAspdBuff,3,3);
    if(px.critHealS&&pkk(p,0.20*px.critHealS))heal(p,p.maxHp*0.01);
    if(px.critHeal3&&pkk(p,0.30*px.critHeal3))heal(p,p.maxHp*0.04);
    if(px.critReset&&pkk(p,0.45*px.critReset))p.atkTimer=0;
  }
  if(px.execKill&&!e.isBoss&&e.hp>0&&e.hp<=e.maxHp*0.25)e.hp=0;
  if(e.hp<=0)onKill(G,e);
  return crit;
}
function fireAxe(p){const G=p.G,n=p.px.axeCount?14:1;for(let k=0;k<n;k++){const t=randTarget(G);if(t)G.pprojs.push({type:'axe',x:p.worldX+14,tgt:t,ratio:0.50,spd:430});}}
function fireArrows(p){const G=p.G,n=p.px.arrowCount?24:2;for(let k=0;k<n;k++){const t=randTarget(G);if(t)G.pprojs.push({type:'parrow',x:p.worldX+14,tgt:t,ratio:0.65,spd:560});}}
function fireBolts(p){const G=p.G,n=p.px.boltCount?20:2;for(let k=0;k<n;k++){const t=randTarget(G);if(t)dealDmg(G,t,0.75);}}
function fireWave(p){const G=p.G;G.pprojs.push({type:'wave',x:p.worldX+14,ratio:0.70,spd:470,maxX:p.worldX+(p.px.waveKing?1400:340),hit:new Set(),pierce:p.px.waveKing?20:2});}
/* 창 관통 상한 8마리 — PLAN §3.3 l_spear «일직선 8명 거리(88px×8) 관통» 의 «8명» 이 엔진에 없어
   12마리 웨이브에서 총출력이 162배까지 갔다(T34). 신화 m_spear200 은 데미지만 올리고 관통 수는 그대로. */
function fireSpear(p){const G=p.G;G.pprojs.push({type:'spear',x:p.worldX+14,ratio:p.px.spearMaster?13.5:1.0,spd:520,maxX:p.worldX+88*8,hit:new Set(),pierce:8});}
function procOnAttack(G){
  const p=G.player,px=p.px;
  if(px.atkPerm&&pkk(p,0.10*px.atkPerm))p.dmg*=1.01;
  if(px.c_atkBuff&&pkk(p,0.30*px.c_atkBuff))addBuff(p,'atk',0.05,3,5);
  if(px.c_aspdBuff&&pkk(p,0.30*px.c_aspdBuff))addBuff(p,'aspd',0.05,3,5);
  if(px.atkBuffM&&pkk(p,0.30*px.atkBuffM))addBuff(p,'atk',0.14,4,5);
  if(px.atkBuffL&&pkk(p,0.25*px.atkBuffL))addBuff(p,'atk',0.35,5,3);
  if(px.axe&&pkk(p,0.15*px.axe))fireAxe(p);
  if(px.arrow2&&pkk(p,0.15*px.arrow2))fireArrows(p);
  if(px.wave&&pkk(p,0.20*px.wave))fireWave(p);
  if(px.spear&&pkk(p,0.075*px.spear))fireSpear(p);
  if(px.bolt&&pkk(p,0.10*px.bolt))fireBolts(p);
  if(px.arsenal&&pkk(p,0.16*px.arsenal))pick([fireAxe,fireArrows,fireBolts,fireWave,fireSpear])(p);
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
  if(px.counterHeal)heal(p,p.maxHp*0.04*px.counterHeal);
  if(px.counterWave&&pkk(p,1.0*px.counterWave))fireWave(p);
  if(src.hp<=0)onKill(G,src);
  else if(px.counterChain&&depth<2&&Math.random()<1.0)doCounter(G,src,1);
}
function hitPlayer(G,dmg,isMelee,src){
  const p=G.player,px=p.px;
  if(Math.random()*100<effEvade(p)){
    if(px.evadeEvBuff)addBuff(p,'evade',8*px.evadeEvBuff,3,3);
    if(px.evadeAspd)addBuff(p,'aspd',0.05,2,3);
    if(px.evadeDef)addBuff(p,'def',5*px.evadeDef,3,3);
    if(px.evadeAtkBuff)addBuff(p,'atk',0.28*px.evadeAtkBuff,5,3);
    if(px.evadeRush&&p.nextAtk<1.5)p.nextAtk=Math.min(1.5,p.nextAtk+0.5*px.evadeRush);
    if(px.evadeCrit)p.nextCrit=true;
    if(px.evadeHeal&&pkk(p,0.15*px.evadeHeal))heal(p,p.maxHp*0.07);
    if(px.evadeShield&&pkk(p,0.15*px.evadeShield))p.sh=Math.min(p.maxSh,p.sh+p.maxSh*0.14);
    if(px.evadeCounter&&pkk(p,1.0*px.evadeCounter))doCounter(G,src);
    if(px.evadeAxe&&pkk(p,0.10*px.evadeAxe))fireAxe(p);   /* 장비 계열 옵션(샌들) — 주인 예시 */
    return;
  }
  let d=dmg*(1-effDef(p)/100);
  if(px.guardCrystal&&p.sh>0)d*=0.62;
  if(p.sh>0){const ab=Math.min(p.sh,d);p.sh-=ab;d-=ab;}
  if(d>0){
    p.hp-=d;
    if(p.hp<=0){
      if(px.revive>0){px.revive--;p.hp=p.maxHp*0.07;p.sh=p.maxSh*0.07;}
      else{p.hp=0;G.dead=true;return;}
    }
  }
  if(px.defHitBuff)addBuff(p,'def',3*px.defHitBuff,3,5);
  if(px.defBuff2&&pkk(p,0.30*px.defBuff2))addBuff(p,'def',14,4,3);
  if(px.defBuffL&&pkk(p,0.20*px.defBuffL))addBuff(p,'def',15,4,2);
  if(px.wallBuff)addBuff(p,'def',10,4,2);
  if(px.hitEvadeBuff&&pkk(p,0.22*px.hitEvadeBuff))addBuff(p,'evade',14,3,2);
  if(px.evadeHitBuff&&pkk(p,0.30*px.evadeHitBuff))addBuff(p,'evade',15,3,2);
  if(px.shieldOnHit&&pkk(p,0.10*px.shieldOnHit))p.sh=Math.min(p.maxSh,p.sh+p.maxSh*0.05);
  if(px.hitHeal&&pkk(p,0.15*px.hitHeal))heal(p,p.maxHp*0.02);
  if(px.thorns&&src&&src.hp>0&&pkk(p,0.60*px.thorns)){src.hp-=dmg*1.5;if(src.hp<=0)onKill(G,src);}
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
  if(px.clone&&e.hp>0)dealDmg(G,e,0.37);
  if(crit&&px.extraHit&&pkk(p,0.75*px.extraHit)&&e.hp>0)dealDmg(G,e,2.3);
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
  if(p.px.perkHp){const a=p.maxHp*0.018;p.maxHp+=a;heal(p,a,true);}
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
function runChapter(chapter,build,opts){
  opts=opts||{};
  const G={chapter,player:null,nodes:[],pprojs:[],arrows:[],gold:0,kills:0,
    perkChances:0,taken:[],legendOnly:false,overBoltCd:0,autoBoltT:2,
    dead:false,cleared:false,t:0,
    rarityLockOn:opts.rarityLock!==undefined,rarityLock:opts.rarityLock};
  const p=mkPlayer(build,G);G.player=p;p.G=G;
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
    if(p.px.autoBolt){G.autoBoltT-=dt;if(G.autoBoltT<=0){G.autoBoltT=2.4;for(let k=0;k<p.px.autoBolt;k++){const t2=randTarget(G);if(t2)dealDmg(G,t2,0.75);}}}
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
            if(pr.hit.size>=pr.pierce){done=true;break;}
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

/* ---------- 계정 진행 모델 (장비 + 슬롯 + 다이아) ---------- */
/* 실험3·4 가 공유하는 경제 코어. 한 판(=1 attempt) 마다 다이아 dailyGem/runsPerDay 적립. */
function newAccount(startGem){
  const slots={}; for(const pt of GT.parts) slots[pt]=0;
  return {gold:0, gem:startGem||0, inv:[], slots, gacha:newGacha(), eq:{}, pulls:0, fuses:0};
}
function accBuild(a){ return {eq:a.eq, slots:a.slots}; }
function accRefresh(a){
  a.fuses+=fuseAll(a.inv,new Set());     /* 장착 중 장비도 매번 재산정하므로 전체 대상으로 합성 후 재장착 */
  a.eq=autoEquip(a.inv);
}
function accPull(a){
  let n=0;
  while(a.gem>=GT.pullCost){ a.gem-=GT.pullCost; a.inv.push(gachaPull(a.gacha)); n++; a.pulls++; }
  if(n)accRefresh(a);
  return n;
}
function accBuySlots(a){
  /* 균등 보너스(§11.4) 유도: 항상 최저 레벨 슬롯부터 올린다 */
  let bought=0;
  for(;;){
    let lo=null;
    for(const pt of GT.parts) if(lo===null||a.slots[pt]<a.slots[lo]) lo=pt;
    if(a.slots[lo]>=GT.slotLvMax)break;          /* ⚑ T35: 슬롯 레벨 상한 150 (주인 확정) */
    const c=GT.slotCost(a.slots[lo]);
    if(a.gold<c)break;
    a.gold-=c; a.slots[lo]++; bought++;
  }
  return bought;
}
function accAttempt(a,chapter){
  const r=runChapter(chapter,accBuild(a),{});
  a.gold+=r.gold;
  if(r.clear)a.gold+=TUNE.goldClear(chapter);
  a.gem+=GT.dailyGem/GT.runsPerDay;
  accPull(a); accBuySlots(a);
  return r;
}
const slotStr=a=>GT.parts.map(pt=>a.slots[pt]).join('/');
function eqStr(a){
  return GT.parts.map(pt=>{const g=a.eq[pt];return g?`${GT.rarName[g.rar]}${g.plus?'+'+g.plus:''}`:'—';}).join('/');
}

/* ---------- 실험들 ---------- */
/* 실험1·2 하니스: 「그 챕터 도달 시점의 관측 중앙값 장비/슬롯 상태」 (T5 승인 규칙을 장비 경제로 이식).
   EXP1_GEAR='등급,강화,슬롯' 형태 환경변수로 덮어쓸 수 있다. */
function harness(env,defRar,defPlus,defSlot){
  const s=(process.env[env]||'').split(',').map(v=>v.trim()===''?NaN:Number(v));   /* T7: ''.split(',') → [''] → Number('')=0 이라 기본값이 무시되던 버그 수정 */
  const rar=Number.isFinite(s[0])?s[0]:defRar, plus=Number.isFinite(s[1])?s[1]:defPlus, slot=Number.isFinite(s[2])?s[2]:defSlot;
  return {b:mkBuild(rar,plus,slot),desc:`${GT.rarName[rar]}${plus?'+'+plus:''} 6부위 · 슬롯 ${slot}렙`};
}
function exp1_rarityLadder(){
  const h=harness('EXP1_GEAR',3,0,1);
  /* 슬롯 1렙 = 실험3 관측 중앙값 (T5 재보정 규칙 — R11 재보정, 12런 중앙값 1렙[1이 8런·2가 4런].
     R09 의 slotCostG 4.2→3.5 가 재보정 대상 변경이었는데 R09·R10 이 이를 빠뜨렸다 — T26).
     ⚠ 등급 «전설» 은 T5 규칙값이 아니다 (T31 실측: 챕터6 도달 시점 부위별 등급 중앙값은 «희귀», 옵션 수 8.8개 vs 하니스 18개).
     하니스 클리어율 20.3% vs 도달 시점 실제 계정 0.0%(12시드 중앙값) — 이 괴리는 승인 대기 23번으로 등재돼 있고
     `node tools/verifyHarness.js` 가 기준선 20.3%p 로 감시한다. 값을 바꾸면 그 게이트를 --rebase 로 갱신할 것. */
  console.log(`\n=== 실험1: 등급 고정 파워 사다리 (챕터6, 하니스 ${h.desc}, 300판) ===`);
  for(const rar of [null,0,1,2,3]){
    let wins=0,times=0,n=300;
    for(let i=0;i<n;i++){
      const r=runChapter(6,h.b,rar===null?{}:{rarityLock:rar});
      if(r.clear){wins++;times+=r.time;}
    }
    const nm=rar===null?'혼합':['일반','희귀','전설','신화'][rar];
    console.log(`${nm}: 클리어 ${(wins/n*100).toFixed(1)}%  평균시간 ${wins?(times/wins).toFixed(0):'-'}s`);
  }
}
function exp2_perkWinrate(){
  const h=harness('EXP2_GEAR',4,0,0);
  /* ⚠ 이 값은 T5 규칙값이 아니라 «변별력 최대인 클리어율 60~70% 지점» 으로 잡은 값이다 (실측 66.7%).
     T31 실측: 챕터8 도달 시점 중앙값은 부위별 등급 «전설»·슬롯 2렙(옵션 15.2개)이고 그 계정의 클리어율은 0.7% 다.
     즉 하니스는 옵션 24개·슬롯 0렙으로 실측보다 1.58배 강하고, T5(«도달 시점 중앙값») 와 정면으로 어긋난다.
     T5 를 문자 그대로 적용하면 실험2 는 0.7% 바닥 포화라 측정 자체가 불가능하다 — 어느 규칙을 쓸지는 승인 대기 23번.
     `node tools/verifyHarness.js` 가 괴리 66.0%p·슬롯 −2렙을 기준선으로 감시한다. 값을 바꾸면 --rebase 로 갱신할 것. */
  /* 진단 전용 오버라이드 (채점용 기본값은 PLAN §7 의 1200판 그대로).
     EXP2_N: 표본 수를 늘려 «측정 노이즈 대 실제 아웃라이어» 를 분리할 때만 사용.
     EXP2_FULL=1: 등급별 전 특전 승률을 덤프해 어느 특전을 올리고 내릴지 고를 때 사용. */
  let base=0,N=parseInt(process.env.EXP2_N||'1200',10);
  console.log(`\n=== 실험2: 특전별 기여도 (챕터8, 하니스 ${h.desc}, ${N}판) ===`);
  const stat={};
  for(const p of PERKS)stat[p.id]={w:0,n:0};
  for(let i=0;i<N;i++){
    const r=runChapter(8,h.b,{});
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
  console.log('-- 등급별 스프레드 (표본 25판 이상만) --');
  for(let r=0;r<4;r++){
    const rr=rows.filter(x=>x.r===r);
    if(!rr.length){console.log(`  ${['일반','희귀','전설','신화'][r]}: 표본 없음`);continue;}
    const hi=rr[0],lo=rr[rr.length-1],sp=hi.wr-lo.wr;
    /* R09: 소수점 1자리로 출력한다. 정수 반올림이면 «최상 80% / 최하 55% → 폭 25%p OK» 처럼
       끝값과 폭이 서로 안 맞아 보여(실제 79.8−55.2=24.6) 읽는 쪽이 판정 오류로 오해한다 —
       R09 비평가 2명이 독립적으로 같은 오독을 했다. 판정(sp<25)은 원래부터 미반올림 값이라 무변경. */
    console.log(`  ${['일반','희귀','전설','신화'][r]}: 최상 ${hi.id} ${hi.wr.toFixed(1)}% / 최하 ${lo.id} ${lo.wr.toFixed(1)}% → 폭 ${sp.toFixed(1)}%p ${sp<25?'OK':'초과'}`);
  }
  if(process.env.EXP2_FULL){
    console.log('-- [진단] 등급별 전 특전 승률 (표본 25판 이상, 내림차순) --');
    for(let r=0;r<4;r++){
      const rr=rows.filter(x=>x.r===r);
      console.log(`  [${['일반','희귀','전설','신화'][r]}] ${rr.map(x=>`${x.id} ${x.wr.toFixed(0)}%(${x.n})`).join(' · ')}`);
    }
  }
}
function exp3_progression(){
  const MAXC=parseInt(process.env.EXP3_MAX||String(TUNE.maxChapter),10);
  const LIMIT=parseInt(process.env.EXP3_LIMIT||'400',10);
  console.log(`\n=== 실험3: 전체 진행 시뮬 (챕터 1→${MAXC}, 골드=슬롯강화 · 다이아=뽑기 자동) ===`);
  const a=newAccount(0);
  let total=0;
  for(let c=1;c<=MAXC;c++){
    let attempts=0,cleared=false;
    while(!cleared&&attempts<LIMIT){
      attempts++;total++;
      if(accAttempt(a,c).clear)cleared=true;
    }
    const pw=buildPower(accBuild(a));   /* R07 진단: 전투력이 챕터를 따라 자라는지(=성장 축이 살아있는지) 확인용 */
    console.log(`챕터 ${String(c).padStart(3)}: 시도 ${String(attempts).padStart(3)}회  슬롯 ${slotStr(a)}  장비 ${eqStr(a)}  뽑기 ${a.pulls}회  전투력 공${pw.atk.toExponential(2)}·체${pw.hp.toExponential(2)}  ${cleared?'':'** '+LIMIT+'회 실패 **'}`);
    if(!cleared)break;
  }
  console.log(`총 시도: ${total}  (환산 ${(total/GT.runsPerDay).toFixed(0)}일)`);
}
/* ---------- 실험4: F2P 일 단위 장비 진행 (PLAN §7) ---------- */
function exp4_gearProgress(){
  const DAYS=parseInt(process.env.EXP4_DAYS||'365',10);
  const IAP=process.env.EXP4_IAP==='1';
  const STUCK=parseInt(process.env.EXP4_STUCK||'40',10);
  console.log(`\n=== 실험4: 장비 진행 (하루 다이아 ${GT.dailyGem} · ${GT.runsPerDay}판/일 · ${DAYS}일${IAP?' · 과금 '+GT.iapGem+'다이아 1회':''}) ===`);
  const a=newAccount(IAP?GT.iapGem:0);
  let chap=1,total=0,tries=0,stuckFrom=-1,stuck=0;
  const marks=[1,3,7,14,30,60,90,120,150,180,240,300,365];
  for(let d=1;d<=DAYS;d++){
    for(let k=0;k<GT.runsPerDay;k++){
      total++;tries++;
      if(accAttempt(a,chap).clear){ chap++; tries=0; }
    }
    if(marks.includes(d)){
      const my=GT.parts.filter(pt=>a.eq[pt]&&a.eq[pt].rar===4).length;
      console.log(`  ${String(d).padStart(3)}일차: 챕터 ${String(chap-1).padStart(3)} 클리어  슬롯 ${slotStr(a)}  신화 ${my}/6  장비 ${eqStr(a)}  누적뽑기 ${a.pulls}`);
    }
    if(tries>GT.runsPerDay*STUCK){ stuckFrom=chap; stuck=tries; break; }   /* STUCK 일 넘게 한 챕터에 정체 = 막힘 (90·300 대형 벽은 원래 오래 걸리므로 기본 40일) */
  }
  const my=GT.parts.filter(pt=>a.eq[pt]&&a.eq[pt].rar===4).length;
  console.log(`최종: 챕터 ${chap-1} 클리어 · 슬롯 ${slotStr(a)} · 신화 부위 ${my}/6 · 뽑기 ${a.pulls}회 · 합성 ${a.fuses}회 · 총 ${total}판`);
  if(stuckFrom>0)console.log(`** 정체 감지: 챕터 ${stuckFrom} 에서 ${stuck}판(${(stuck/GT.runsPerDay).toFixed(0)}일) 연속 실패 — 90·300 은 대형 벽이라 정상, 그 외 챕터면 경제가 막힌 것 **`);
}
/* ---------- 실험5: 스탯 사다리 7점 검증 (⚑ T35 — PLAN §11.7 주인 확정 과녁) ---------- */
/* 종전의 앵커 3점(C=30 · A=90 · B=300)은 주인이 폐기했다. 유일한 과녁은 아래 «등급별 스탯 사다리» 다:
   노템 5 · 일반 15 · 희귀 30 · 영웅 50 · 전설 70 · 신화 120 · 신화+9강 260 (전부 슬롯 0렙 · 특전 미획득).
   합격 구간은 §7 T6 제안 기준을 그대로 승계한다 — 과녁 챕터 클리어율 2~10% (기대 재도전 10~50회). */
const LADDER=[
  {id:'노템',      rar:-1, plus:0, at:5,   want:[25,150,250]},
  {id:'일반',      rar:0,  plus:0, at:15,  want:[50,250,400]},
  {id:'희귀',      rar:1,  plus:0, at:30,  want:[100,500,800]},
  {id:'영웅',      rar:2,  plus:0, at:50,  want:[200,700,1300]},
  {id:'전설',      rar:3,  plus:0, at:70,  want:[530,1000,2200]},
  {id:'신화',      rar:4,  plus:0, at:120, want:[1200,2385,5000]},
  {id:'신화+9강',  rar:4,  plus:9, at:260, want:[2600,5000,10000]},
];
function exp5_ladder(){
  const N=parseInt(process.env.EXP5_N||'200',10);
  const only=process.env.EXP5_ONLY;                 /* '신화' 등으로 한 칸만 측정 */
  const span=parseInt(process.env.EXP5_SPAN||'0',10);   /* >0 이면 과녁 ±span 챕터도 함께 측정 */
  console.log(`\n=== 실험5: 스탯 사다리 7점 (PLAN §11.7 · 각 챕터 ${N}판 · 슬롯 0렙 · 합격 2~10%) ===`);
  const rows=[];
  for(const L of LADDER){
    if(only&&only!==L.id)continue;
    const b=mkBuild(L.rar,L.plus,0);
    const pw=buildPower(b);
    const dev=(v,w)=>((v/w-1)*100).toFixed(1).padStart(5)+'%';
    console.log(`\n  [${L.id}] 풀셋 ${L.plus?'+'+L.plus+'강':'0강'} → 과녁 챕터 ${L.at}`);
    console.log(`    스탯: 공 ${pw.atk.toFixed(1)} / 체 ${pw.hp.toFixed(1)} / 실 ${pw.sh.toFixed(1)}`+
                `  (확정표 ${L.want.join('/')} 대비 ${dev(pw.atk,L.want[0])}·${dev(pw.hp,L.want[1])}·${dev(pw.sh,L.want[2])})`);
    for(let c=L.at-span;c<=L.at+span;c++){
      if(c<1)continue;
      let w=0;
      for(let i=0;i<N;i++) if(runChapter(c,b,{}).clear)w++;
      const rate=w/N*100;
      const exp=rate>0?(100/rate).toFixed(1)+'회':'∞';
      const tag=c===L.at?(rate>=2&&rate<=10?'   ← 과녁 ✓':'   ← 과녁 ✗(합격 2~10%)'):'';
      console.log(`    챕터 ${String(c).padStart(3)}: 클리어율 ${rate.toFixed(1)}%  (기대 재도전 ${exp})${tag}`);
      if(c===L.at) rows.push([L.id,L.at,rate]);
    }
  }
  console.log(`\n  — 사다리 요약 (합격 2~10%) —`);
  console.log(`  | 상태 | 과녁 챕터 | 클리어율 | 판정 |`);
  console.log(`  |---|---|---|---|`);
  for(const [id,at,rate] of rows)
    console.log(`  | ${id} | ${at} | ${rate.toFixed(1)}% | ${rate>=2&&rate<=10?'✓':'✗'} |`);
}

/* ---------- 계열 옵션표 덤프 (PLAN §11.6 등재용) ---------- */
function dumpGearTable(){
  const step=['희귀(1)','영웅(2)','전설(3)','신화(4)','신화+3(5)','신화+6(6)','신화+9(7)'];
  console.log('| 부위 | 종류 | 계열 | '+step.map((s,i)=>`옵션${i+1} · ${s}`).join(' | ')+' |');
  console.log('|---|---|---|'+step.map(()=>'---').join('|')+'|');
  const line={greatsword:'검기',axe:'도끼 소환',bow:'화살 소환',helmet:'방어',crown:'치명타 확률',hood:'번개 소환',
    plate:'체력·피격',chain:'가시 반사',robe:'실드',gauntlet:'치명타 배율',leather:'공격속도',handwrap:'연타·분신',
    sandal:'회피',boots:'반격',greave:'체력',pendant:'회복',amulet:'처치',beads:'창 소환'};
  for(const pt of GT.parts) for(const ty of GT.types[pt])
    console.log(`| ${GT.partName[pt]} | ${GT.typeName[ty]} | ${line[ty]} | `+GOPT[ty].map(o=>o.d).join(' | ')+' |');
}

/* ---------- fit: 앵커 챕터가 «겨우 클리어(≈5%)» 가 되는 요구 전투력 역산 (진단 전용) ---------- */
function fitAnchors(){
  const N=parseInt(process.env.FIT_N||'60',10);
  const CH=(process.env.FIT_CH||'30,90,300').split(',').map(Number);
  console.log(`\n=== fit: 앵커 챕터 요구 전투력 역산 (기준 공30/체300 의 배수 k, 클리어율 ≈5% 지점, ${N}판/평가) ===`);
  for(const c of CH){
    const rate=k=>{let w=0;const b=flatBuild(30*k,300*k);for(let i=0;i<N;i++)if(runChapter(c,b,{}).clear)w++;return w/N*100;};
    let lo=1,hi=1;
    while(rate(hi)<5&&hi<1e60)hi*=4;
    if(hi>1e60){console.log(`  챕터 ${c}: k>1e60 (역산 실패)`);continue;}
    lo=hi/4;
    for(let it=0;it<12;it++){const mid=Math.sqrt(lo*hi);if(rate(mid)<5)lo=mid;else hi=mid;}
    const k=Math.sqrt(lo*hi);
    console.log(`  챕터 ${String(c).padStart(3)}: k ≈ ${k.toExponential(3)}  (공격력 ${(30*k).toExponential(3)} · 체력 ${(300*k).toExponential(3)})`);
  }
}

const mode=process.argv[2]||'all';
if(process.env.SEED!==undefined&&process.env.SEED!=='') setSeed(Number(process.env.SEED));   /* R11: 하니스 시드 (미설정 시 종전과 동일) */
if(mode==='table'){ dumpGearTable(); process.exit(0); }
if(mode==='fit'){ fitAnchors(); process.exit(0); }
if(mode==='1'||mode==='all')exp1_rarityLadder();
if(mode==='2'||mode==='all')exp2_perkWinrate();
if(mode==='3'||mode==='all')exp3_progression();
if(mode==='4'||mode==='all')exp4_gearProgress();
if(mode==='5'||mode==='all')exp5_ladder();
