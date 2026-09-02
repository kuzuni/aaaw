'use strict';
/* 꼬마기사 밸런스 시뮬레이터 — 게임 엔진과 동일한 수식 사용 */

const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* ---------- 튜닝 파라미터 (여기 숫자를 게임에 이식) ---------- */
const TUNE={
  eBaseHp:26.82, eBaseDmg:4.986,
  /* ⚑ T35: 단일 성장률 `eHpG 1.185`·`eDmgG 1.08` 폐기 → PLAN §11.7 «구간별 성장률» 표.
     적 HP 는 플레이어 «공격력» 축, 적 DMG 는 «체력+실드» 축에서 주인 확정 스탯 사다리로부터 역산된 값이다.
     [하한, 성장률] — 챕터 c 에서 c+1 로 갈 때 적용할 배수를 c 로 찾는다.
     1~5 는 5→15 구간률을 앞으로, 260~300 은 120→260 구간률을 뒤로 연장한다 (PLAN §11.7 괄호 규정).
     ⚑ T1 R01 재적합 (주인 확정 15:1X: «성장률 표는 확정 지위 해제 → T1 자유 튜닝 노브, 사다리 7점이 유일한 과녁»).
     T35 초기값은 «플레이어 힘 선형» 가정의 역산이라 엔진의 초선형성을 못 담아 사다리가 1/7 이었다.
     구간별 난이도 지수 a 로 재적합 — 성장률 = 1 + a*(T35 초기율 - 1), a = 1.0/1.15/1.6/1.45/2.0/2.8,
     기저는 40/8 → 22.8/4.56 (×0.57). T47(expNeed 4+4*Lv)·T48 2·3단계(특전 132종)까지 합류한 트리에서 잰 최종값이다.
     근거·실측표 `docs/balance/resume-R01/raw.md`.
     ⚑ T1 R02 — 구간0(챕터 1~14)만 1.0718/1.0497 → 1.0292/1.0265 로 내리고 기저를 22.8/4.56 → 26.82/4.986 으로 올렸다.
     이것은 난이도 총량 변경이 **아니라** 아래 «벽 예산» 항등식을 만족시키는 재배치다 — 사다리 과녁 5·15 가 그대로 유지된다. */
  eHpSeg:[[0,1.0292],[15,1.0544],[30,1.0565],[50,1.0724],[70,1.0188],[120,1.0154],[260,1.0056]],
  eDmgSeg:[[0,1.0265],[15,1.0544],[30,1.0349],[50,1.0345],[70,1.0254],[120,1.0143],[260,1.0056]],
  /* ⚑⚑ 「벽 예산」 — T1 R02 가 «사다리 유지 + 벽 존재» 를 동시에 만족시킨 방법 (T35 가 남긴 숙제의 답).
     T35 는 «구간별 성장률이 사다리 7점에서 역산된 값이라 벽을 얹으면 사다리가 어긋난다» 며 벽 4종을 전부 껐다.
     하지만 어긋나는 건 «혼동» 이 아니라 **예산**이다: 과녁 7개 중 5 만 벽 밖(c<10)이고 15·30·50·70·120·260 은 전부 벽 안이라
     고정할 식이 둘뿐이다 — D(5)=기저·g0^4 · D(15)=기저·g0^14·W. 나누면 **g0^10 · W = 상수** (HP 2.000 · DMG 1.624).
     즉 10챕터 벽 배수는 «구간0 성장률 10챕터분» 에서 빌려 오고, 빌린 만큼 기저를 올려 되갚으면 7점이 통째로 보존된다.
     15 이후 구간률을 안 건드리므로 위쪽 과녁 5개는 자동으로 따라온다. 실측 사다리 7/7 · 챕터 9→10 계단 ×1.54.
     ⚠ 예산은 유한하다 — W 를 더 올리면 g0 가 눌려 챕터 1~9 가 평평해지고 기저가 올라 1~4 가 무거워진다.
        실측 §7 1~20 적합 셀: 벽 끄기 29 · **W=1.5 → 36** · W=1.7 → 27(악화). 1.5 가 최적점이다.
     ⚠ 같은 이유로 15 벽(wall2)은 켤 수 없다 — 그건 과녁 «일반=15» 자체에 곱해지고 같은 예산을 나눠 쓴다.
     90·300 벽(wall3/4)은 과녁 120·260 에 직접 걸리므로, 켜려면 구간 70→120·120→260 지수를 같은 방식으로 재적합해야 한다.
     근거 `docs/balance/resume-R02/raw.md` · 스펙 개정 제안은 PROGRESS 승인 30번(T54). */
  wallHp:1.5, wallDmg:1.25,     // 10챕터 이상 벽 배수 (⚑ T1 R02 재산정 — 아래 «벽 예산» 주석)
  wall2Hp:1.0, wall2Dmg:1.0,    // 15챕터 이상 추가 배수 (임시 비활성 — T1 재산정)
  waveHp:0.15, waveDmg:0.08,    // 웨이브 인덱스당 (R03)
  wall3Hp:2.0, wall3Dmg:1.5,    // 90챕터 대형 벽 (⚑ T1 R03 켬 — 벽 예산: 구간 70→120 률을 3.30/3.38% → 1.88/2.54% 로 내려 D(120) 보존)
  wall4Hp:3.2, wall4Dmg:1.8,    // 300챕터 최종 벽 (⚑ T1 R03 켬 — 260 위에는 과녁이 없어 벽 예산 제약이 «완전히» 없다. slotCostG 1.6 의 짝 노브 — 계정이 부유해진 만큼 최종 벽을 올려 30~400회 대역에 되돌린다)
  bossHp:8, bossDmg:1.8,        // 주인 확정 상수 (튜닝 노브 아님) — 5배수 챕터 추가 배수 폐기
  maxChapter:300,               // PLAN §2.4 (§11 도입으로 20 → 100 → 주인 추가 지시로 300)
  /* 플레이어 기본치 (영구강화 4종 폐지 — 성장은 §11 장비 + 슬롯 강화가 전담)
     ⚑ T35 주인 확정(PLAN §11.5-a): 공 25 / 체 150 / 실드 250. 실드는 `maxHp*0.8` 파생이 아니라 독립 스탯이다. */
  pAtk0:25, pHp0:150, pSh0:250, pAspd0:1.0, pCrit0:5,
  goldKillBase:0.6, goldKillPer:0.10, goldClearPer:3,
  goldGrowth:1.22,              // 챕터당 골드 성장 배수 (R07: 1.185 → 1.22. 1.185 는 챕터 90 대형 벽에서 슬롯 13 에 갇혀 F2P·과금 둘 다 영구 정체했다 — 실험4 실측. eHpG 보다 높게 둬야 후반 벽에서 수입이 적 성장을 따라잡는다)
  expKill:3, expBoss:9, expNeed:lv=>4+4*lv,
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
/* ⚑ 쉼터 보상 (PLAN §2.4 · 주인 확정 2026-09-02 17:1X · T49) — «❤️ 체력 260 회복(고정값)» vs «🌟 경험치 +26».
   고정값이라 최대체력 비율로 되돌리지 말 것. index.html 과 이름·값이 같아야 한다(게이트 verifyRestPolicy). */
const REST_HEAL=260, REST_EXP=26;
/* ⚑ 주인 확정 상수 (PLAN §2.3, 2026-09-02 15:4X) — 적 전원 회피율 10%.
   튜닝 노브가 아니다(TUNE 밖에 둔 이유). 적중률(명중) 스탯·특전·장비 옵션·버프는 이 게임에 존재 금지 —
   흡혈 증가 금지와 같은 축이라, 이 상수를 «뚫는» 수단을 추가하면 게이트(verifyT2 ⑲)가 빨개진다.
   적용 범위(주인 명시): 기본공격 · 소환(창/도끼/화살/번개/검기) · 반격.
   제외(위임 판단, PROGRESS T43 에 근거 등재): 가시 반사·오발 화살 — 플레이어가 겨눈 타격이 아니라
   적의 공격이 되돌아온 것이라 «적이 회피한다» 가 성립하지 않는다. */
const ENEMY_EVADE=0.10;
/* ⚑ T48 1단계 — 주인 지시 15:5X 신규 축 2개의 메커니즘 상수 (PLAN §3.0·§4).
   전부 «위임 기본값» 이라 주인이 바꾸라면 이 두 줄만 고치면 된다. index.html 도 같은 값(게이트가 대조).
   · STUN_BOSS_MUL — 보스는 스턴 지속 1/3 (치명타 스턴으로 보스를 영구 스턴락하는 것 방지, 주인 명시).
   · STUN_LORD_MUL — 신화 m_stunLord 의 지속 배수. STUN_LORD_DMG — 스턴 중인 적에게 주는 데미지 배수.
   · MISS_STACK_CAP — 빗맞음 데미지 스택(l_missStack) 상한 5장.
     주인 정정(16:3X): ×2 배수가 아니라 **가산 +100%** 이고 한 타에 한 장만 소모된다.
     그래서 엔진에서도 배수(`d*=2`)가 아니라 firstHit 과 같은 «가산 보너스 풀» 에 +1.00 을 더한다
     (execute·backDmg 같은 순수 배수 계열과는 여전히 곱 — 기존 밸런스를 건드리지 않기 위한 위임 판단). */
const STUN_BOSS_MUL=1/3, STUN_LORD_MUL=2, STUN_LORD_DMG=1.6, MISS_STACK_CAP=5;
/* ⚑ T48 3단계 — 횟수형 방어막 (주인 17:2X) · 회피 즉사 (주인 16:5X). 둘 다 위임 기본값이다.
   · WARD_CAP / WARD_CAP_KING — 방어막 «장수» 상한. 주인: «존나 쌓여서» → 기본 5장, 신화 변형 10장.
     수치형 실드와 완전히 별개 축이다 — 실드는 데미지를 «흡수» 하고 방어막은 타격 «1회» 를 통째로 무효화한다.
   · REAPER_CH — 사신의 낫 즉사 확률(주인 원문 10%). 보스 제외는 🧨 처형자 선례를 따른다. */
const WARD_CAP=5, WARD_CAP_KING=10, REAPER_CH=0.10;
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

/* ---------- 특전 정의 (132종 — T48 로 102 → 132. 등급당 33종씩 균등, 편차 0) ---------- */
/* ap(p): 적용. u: 고유. 이름은 게임과 동일 키 */
function mkPerks(){
  const P=[];
  const add=(id,r,ap,u)=>P.push({id,r,ap,u:!!u});
  /* 일반 33 */
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
  add('c_stunHit',0,p=>p.px.stunHitS++);
  add('c_missAtk',0,p=>p.px.missAtk++);
  add('c_missDef',0,p=>p.px.missDef++);
  add('c_rangeShield',0,p=>p.px.rangeShield++);
  add('c_thornsS',0,p=>p.px.thornsS++);
  add('c_wardHit',0,p=>p.px.wardHit++);
  add('c_wardEvade',0,p=>p.px.wardEvade++);
  /* 희귀 33 */
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
  add('r_stunCrit',1,p=>p.px.stunCritM++);
  add('r_missAspd',1,p=>p.px.missAspd++);
  add('r_missReset',1,p=>p.px.missReset++);
  add('r_rangeThorns',1,p=>p.px.rangeThorns++);
  add('r_aspdStack10',1,p=>p.px.aspdStack10++);
  add('r_ward',1,p=>p.px.wardAtk++);
  add('r_wardCrit',1,p=>p.px.wardCrit++);
  /* 전설 33 */
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
  add('l_stunHit3',2,p=>p.px.stunHitL++);
  add('l_stunCrit3',2,p=>p.px.stunCritL++);
  add('l_missCrit',2,p=>p.px.missCrit=true,1);
  add('l_missStack',2,p=>p.px.missStack++);
  add('l_rangeBolt',2,p=>p.px.rangeBolt++);
  /* 신화 33 */
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
  add('m_stunLord',3,p=>p.px.stunLord=true,1);
  add('m_stunKill',3,p=>p.px.stunKill=true,1);
  add('m_stunAura',3,p=>p.px.stunAura++);
  add('m_missRush',3,p=>p.px.missRush=true,1);
  add('m_missSpear',3,p=>p.px.missSpear++);
  add('m_rangeSpear',3,p=>p.px.rangeSpear++);
  add('m_thornsKing',3,p=>p.px.thornsKing=true,1);
  add('m_stackMaster',3,p=>p.px.stackMaster=true,1);
  add('m_reaper',3,p=>p.px.reaper=true,1);
  add('m_wardKing',3,p=>p.px.wardKing=true,1);
  add('m_wardBurst',3,p=>p.px.wardBurst=true,1);
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
  slotCostBase:600, slotCostG:1.6,   // 슬롯 강화 비용 = base*costG^L (⚑ T1 R03: 3.5 → 2.6 → 1.6 — 비평가 B 실측. 정상상태 슬롯레벨 L ≈ c*ln(goldGrowth)/ln(slotCostG) 라 2.6 이면 상한 150 이 챕터 431 에서야 닿는다 = 사문. 1.6 이면 챕터 300 부근에서 닿는다)
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
    /* ⚑ T48 1단계 — 신규 축 2개 (주인 15:5X): 스턴 · 빗맞음(onMiss) */
    stunHitS:0,stunHitL:0,stunCritM:0,stunCritL:0,stunLord:false,stunKill:false,stunAura:0,
    missAtk:0,missDef:0,missAspd:0,missReset:0,missCrit:false,missStack:0,missRush:false,missSpear:0,
    /* ⚑ T48 2단계 — 원거리 피격 축 · 반사 확장 · 고중첩 변형 (주인 16:0X·16:1X·16:2X) */
    rangeShield:0,rangeThorns:0,rangeBolt:0,rangeSpear:0,thornsS:0,thornsKing:false,aspdStack10:0,stackMaster:false,
    /* ⚑ T48 3단계 — 횟수형 방어막 · 회피 즉사 (주인 16:5X·17:2X) */
    wardAtk:0,wardHit:0,wardEvade:0,wardCrit:0,wardKing:false,wardBurst:false,reaper:false,
  };
}
function mkPlayer(build,G){
  const pw=buildPower(build);
  const maxHp=pw.hp;
  const p={G, worldX:0, atkTimer:0, nextAtk:0, nextCrit:false,
    dmg:pw.atk, aspd:TUNE.pAspd0, critR:TUNE.pCrit0, critF:200,
    def:5, counter:10, evade:8, steal:0, killHeal:0, misfire:0, goldMul:1, walkMul:1, healAmp:0,
    maxHp, hp:maxHp, maxSh:pw.sh, sh:pw.sh,   /* ⚑ T35: 실드 독립 스탯 (`maxHp*0.8` 파생 폐기) */
    level:1, exp:0, missStk:0, ward:0, buffs:{atk:[],aspd:[],critR:[],critF:[],def:[],evade:[]}, px:basePx()};
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
/* 신화 m_stackMaster «축적의 대가» — 모든 중첩 버프의 최대 중첩을 STACK_BONUS 만큼 늘린다.
   상한 자체를 건드리는 특전이라 개별 호출부 수십 곳을 고치는 대신 여기 한 곳에서만 처리한다. */
const STACK_BONUS=5;
function addBuff(p,k,amt,dur,max){
  if(p.px&&p.px.stackMaster)max+=STACK_BONUS;
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
/* 지금 «필드 위에» 있는 적이 속한 노드 = 플레이어가 상대하고 있는 최전방 노드.
   주인 확정 보강(15:2X): 관통형(창·검기)은 이 노드의 적만 맞는다 — 다음 웨이브 대기분은 절대 맞지 않는다.
   두 엔진 다 챕터의 적을 시작할 때 한꺼번에 만들어 두므로(노드 간격 560px, 창 사거리 88×8=704px)
   필터가 없으면 창이 다음 웨이브까지 꿰뚫는다. 발사 시점의 노드를 투사체에 박아 두고 그것만 때린다. */
function frontNode(G){let b=null;for(const n of G.nodes)for(const e of n.enemies)if(e.hp>0&&(!b||e.worldX<b.worldX))b=e;return b?b.wave:null;}
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
  /* 신화 m_stunKill «충격파» — 처치 시 사거리 안의 남은 적 전부 스턴 (randTarget 과 같은 사거리 필터) */
  if(px.stunKill)for(const e2 of aliveList(G)){const dx=e2.worldX-p.worldX;if(dx>-30&&dx<540)applyStun(G,e2,1.2);}
  /* 웨이브 전멸 실드 충전 폐지 (PLAN §2.3 주인 지시) — 실드 충전은 특전으로만 */
  if(e.isBoss)G.cleared=true;   /* 클리어 확정을 먼저 — 보스 경험치로 레벨업해도 특전 3택 없음 (PLAN §2.4 주인 지시) */
  gainExp(G,(e.isBoss?TUNE.expBoss:TUNE.expKill)+(px.sage?1:0));
}
function gainExp(G,n){
  const p=G.player;
  p.exp+=n;
  while(p.exp>=TUNE.expNeed(p.level)){p.exp-=TUNE.expNeed(p.level);p.level++;if(!G.cleared)perkChoice(G);}
}
/* ⚑ T48 1단계 — 스턴 메커니즘 (주인 15:5X · PLAN §3.0).
   적은 원래 제자리 고정이라 «정지» 할 것이 공격뿐이다 — 스턴 중엔 근접 타격도 화살도 나가지 않는다.
   갱신 규칙(위임): 이미 스턴 중이면 «더 긴 쪽» 을 남긴다(합산 금지 — 합산이면 저등급 연타로 영구 스턴락).
   보스는 STUN_BOSS_MUL(1/3) 배 지속(주인 명시). index.html 과 같은 동사·같은 상수. */
function applyStun(G,e,sec){
  if(!e||e.hp<=0)return;
  const p=G.player;
  let s=sec*(p.px.stunLord?STUN_LORD_MUL:1);
  if(e.isBoss)s*=STUN_BOSS_MUL;
  e.stun=Math.max(e.stun||0,s);
  G.stuns=(G.stuns||0)+1;
}
/* ⚑ T48 1단계 — 빗맞음(onMiss) 트리거 (주인 15:5X · PLAN §3.0).
   «적 회피 10% 로 내 공격이 빗나갔을 때» 발동. 적중률 금지 규칙과 공존 — 빗맞음을 없애는 것이 아니라
   빗맞음에서 이득을 얻는 축이다. 호출 지점은 빗맞음이 실제로 일어나는 두 곳(dealDmg · doCounter)뿐. */
function procOnMiss(G,e){
  const p=G.player,px=p.px;
  G.misses=(G.misses||0)+1;
  if(px.missAtk)addBuff(p,'atk',0.06*px.missAtk,3,5);
  if(px.missDef)addBuff(p,'def',6*px.missDef,3,3);
  if(px.missAspd)addBuff(p,'aspd',0.12*px.missAspd,2,3);
  if(px.missReset&&pkk(p,0.30*px.missReset))p.atkTimer=0;
  if(px.missCrit)p.nextCrit=true;                                  /* 주인 필수 예시 ① */
  if(px.missStack)p.missStk=Math.min(MISS_STACK_CAP,p.missStk+1);  /* 주인 필수 예시 ② */
  if(px.missRush){p.atkTimer=0;p.nextAtk=Math.min(1.5,Math.max(p.nextAtk,1.0));}
  if(px.missSpear&&pkk(p,0.30*px.missSpear))fireSpear(p);
}
/* ⚑ T48 3단계 — 횟수형 방어막 (주인 17:2X · PLAN §3.0).
   «공격 시 10% 확률로 적 공격 1회를 완전히 막아주는 방어막 1장» — 5장이면 5번 막는다.
   상한은 신화 m_wardKing 이 두 배로 늘리고, 같은 특전이 획득 확률도 두 배로 만든다.
   수치형 실드(p.sh)와 별개 축이라 서로 간섭하지 않는다. */
function wardCap(p){return p.px.wardKing?WARD_CAP_KING:WARD_CAP;}
function gainWard(p,ch){
  if(!ch)return;
  if(!pkk(p,ch*(p.px.wardKing?2:1)))return;
  p.ward=Math.min(wardCap(p),p.ward+1);
}
/* ⚑ T48 2단계 — 원거리 피격 트리거 (주인 16:1X · PLAN §3.0).
   «적의 원거리 공격(화살)에 맞았을 때» 발동하는 별개 축이다 — 일반 «피격 시» 트리거와 배타가 아니라
   원거리 피격은 둘 다 굴린다(주인 위임 기본값). 회피에 성공하면 «맞은» 것이 아니라 굴리지 않는다. */
function procOnRanged(G,src){
  const p=G.player,px=p.px;
  if(px.rangeShield&&pkk(p,0.20*px.rangeShield))p.sh=Math.min(p.maxSh,p.sh+p.maxSh*0.04);
  if(px.rangeThorns&&src&&src.hp>0&&pkk(p,0.30*px.rangeThorns)){src.hp-=effDmg(p)*0.8;if(src.hp<=0)onKill(G,src);}
  if(px.rangeBolt&&pkk(p,0.30*px.rangeBolt)){const t=randTarget(G);if(t)summonHit(G,t,0.75);}
  if(px.rangeSpear&&pkk(p,0.30*px.rangeSpear))fireSpear(p);
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
  /* ⚑ 적 회피 10% (PLAN §2.3 주인 확정). 판정을 치명타 굴림 «뒤» 에 두는 이유:
     빗맞아도 그 «공격» 은 일어난 것이라 nextCrit(여기) 과 nextAtk(playerStrike) 가 함께 소모된다 — 위임 기본값.
     여기가 유일한 빗맞음 지점이므로 신설될 «빗맞음 트리거» 축(주인 15:5X)도 이 자리에 붙는다. */
  G.atkTries++;
  if(Math.random()<ENEMY_EVADE){G.miss++;procOnMiss(G,e);return false;}
  let d=effDmg(p)*ratio*(crit?effCritF(p)/100:1)*rand(0.92,1.08);
  /* 가산 보너스 풀 — «+n%» 로 적히는 데미지 보너스는 서로 합연산 (주인 정정 16:3X).
     스택은 «적중 1타당 1개» 소모하고, 몇 장이 쌓여 있든 한 타에는 +100% 한 번만 붙는다. */
  let addBonus=0;
  if(full&&px.firstHit)addBonus+=0.20*px.firstHit;
  if(px.missStack&&p.missStk>0){p.missStk--;addBonus+=1.00;}
  if(addBonus)d*=1+addBonus;
  if(px.stunLord&&e.stun>0)d*=STUN_LORD_DMG;   /* 신화 m_stunLord — 스턴 중인 적에게 추가 피해 */
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
    if(px.stunCritM&&pkk(p,0.15*px.stunCritM))applyStun(G,e,2.0);
    if(px.stunCritL&&pkk(p,0.35*px.stunCritL))applyStun(G,e,3.0);   /* 주인 필수 예시 «치명타 시 3초 스턴» */
    gainWard(p,0.12*px.wardCrit);
  }
  if(px.execKill&&!e.isBoss&&e.hp>0&&e.hp<=e.maxHp*0.25)e.hp=0;
  if(e.hp<=0)onKill(G,e);
  return crit;
}
/* ⚑ 주인 확정(2026-09-02 15:3X) — 소환 적중도 «공격» 이다: 소환(창/도끼/화살/번개/검기)이 적을 맞히면
   «공격 시 n%» 트리거를 굴린다(창이 창을 부르는 연쇄 허용). «치명타 시» 트리거는 `dealDmg` 안에 있어
   기본공격 전용이 아니었으므로 소환 적중에도 이미 걸린다 — 즉 이 규칙에서 새로 추가되는 것은 «공격 시» 쪽이다.
   **기본공격 전용으로 남는 것은 `nextCrit`/`nextAtk` 소모 · 분신 · 추가타 셋뿐**(PLAN §4, 주인 위임).
   확률·연쇄 자체에는 인위적 제한을 두지 않는다(세면 T1 이 수치로 잡는다). 아래 둘은 주인이 명시 허용한 **성능 가드**다:
     · `PROJ_CAP`      동시 활성 투사체 상한 — 초과분은 «즉발 판정» 으로 대체(데미지는 사라지지 않는다).
     · `PROC_TICK_CAP` 한 틱에 굴리는 소환 적중 트리거 수 상한 — 번개처럼 즉발로 꼬리를 무는 연쇄가
       한 틱 안에서 무한히 자라는 것을 막는다(상한을 넘겨도 데미지는 그대로, 트리거만 안 굴린다).
   index.html 도 같은 상수·같은 동사를 쓴다(게이트가 두 파일을 대조한다). */
const PROJ_CAP=200, PROC_TICK_CAP=200;
function summonHit(G,e,ratio){
  dealDmg(G,e,ratio);
  if(G.procN<PROC_TICK_CAP){G.procN++;procOnAttack(G);}
}
function pushProj(G,pr){
  if(G.pprojs.length<PROJ_CAP){G.pprojs.push(pr);return;}
  if(pr.hit){                                   /* 관통형(창·검기): 사거리 안 적을 앞에서부터 pierce 마리 */
    const list=aliveList(G).filter(e=>(!pr.node||e.wave===pr.node)&&e.worldX>=pr.x-16&&e.worldX<=pr.maxX)
                           .sort((a,b)=>a.worldX-b.worldX);   /* pr.node = 미스폰·대기 웨이브 피격 금지 (주인 15:2X · T44) */
    for(const e of list.slice(0,pr.pierce))summonHit(G,e,pr.ratio);
  }else if(pr.tgt&&pr.tgt.hp>0)summonHit(G,pr.tgt,pr.ratio);
}
function fireAxe(p){const G=p.G,n=p.px.axeCount?14:1;for(let k=0;k<n;k++){const t=randTarget(G);if(t)pushProj(G,{type:'axe',x:p.worldX+14,tgt:t,ratio:0.50,spd:430});}}
function fireArrows(p){const G=p.G,n=p.px.arrowCount?24:2;for(let k=0;k<n;k++){const t=randTarget(G);if(t)pushProj(G,{type:'parrow',x:p.worldX+14,tgt:t,ratio:0.65,spd:560});}}
function fireBolts(p){const G=p.G,n=p.px.boltCount?20:2;for(let k=0;k<n;k++){const t=randTarget(G);if(t)summonHit(G,t,0.75);}}
function fireWave(p){const G=p.G;pushProj(G,{type:'wave',x:p.worldX+14,ratio:0.70,spd:470,maxX:p.worldX+(p.px.waveKing?1400:340),hit:new Set(),pierce:p.px.waveKing?20:2,node:frontNode(G)});}
/* 창 관통 상한 8마리 — PLAN §3.3 l_spear «일직선 8명 거리(88px×8) 관통» 의 «8명» 이 엔진에 없어
   12마리 웨이브에서 총출력이 162배까지 갔다(T34). 신화 m_spear200 은 데미지만 올리고 관통 수는 그대로. */
function fireSpear(p){const G=p.G;pushProj(G,{type:'spear',x:p.worldX+14,ratio:p.px.spearMaster?13.5:1.0,spd:520,maxX:p.worldX+88*8,hit:new Set(),pierce:8,node:frontNode(G)});}
function procOnAttack(G){
  const p=G.player,px=p.px;
  if(px.atkPerm&&pkk(p,0.10*px.atkPerm))p.dmg*=1.01;
  if(px.c_atkBuff&&pkk(p,0.30*px.c_atkBuff))addBuff(p,'atk',0.05,3,5);
  if(px.c_aspdBuff&&pkk(p,0.30*px.c_aspdBuff))addBuff(p,'aspd',0.05,3,5);
  if(px.aspdStack10&&pkk(p,0.25*px.aspdStack10))addBuff(p,'aspd',0.05,4,10);   /* 주인 예시 — 고중첩 상위 변형 */
  if(px.atkBuffM&&pkk(p,0.30*px.atkBuffM))addBuff(p,'atk',0.14,4,5);
  if(px.atkBuffL&&pkk(p,0.25*px.atkBuffL))addBuff(p,'atk',0.35,5,3);
  if(px.axe&&pkk(p,0.15*px.axe))fireAxe(p);
  if(px.arrow2&&pkk(p,0.15*px.arrow2))fireArrows(p);
  if(px.wave&&pkk(p,0.20*px.wave))fireWave(p);
  if(px.spear&&pkk(p,0.075*px.spear))fireSpear(p);
  if(px.bolt&&pkk(p,0.10*px.bolt))fireBolts(p);
  if(px.arsenal&&pkk(p,0.16*px.arsenal))pick([fireAxe,fireArrows,fireBolts,fireWave,fireSpear])(p);
  gainWard(p,0.10*px.wardAtk);   /* 주인 필수 예시 — «공격 시 10% 확률로 방어막 1장» */
}
function doCounter(G,src,depth){
  const p=G.player,px=p.px;
  if(!src||src.hp<=0)return;
  /* 반격도 «플레이어의 타격» 이라 적 회피 10% 를 탄다 (PLAN §2.3 주인 명시 3종 중 하나).
     빗맞으면 반격 연쇄(counterChain)도 끊긴다 — 위임 기본값. */
  G.atkTries++;
  if(Math.random()<ENEMY_EVADE){G.miss++;procOnMiss(G,src);return;}
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
    gainWard(p,0.10*px.wardEvade);
    /* 신화 m_reaper «사신의 낫» — 회피 시 확률로 공격한 그 적 즉사 (보스 제외, 주인 16:5X).
       게임에는 낫이 베는 전용 연출이 붙는다(일반 처치 연기와 구별). */
    if(px.reaper&&src&&src.hp>0&&!src.isBoss&&pkk(p,REAPER_CH)){src.hp=0;onKill(G,src);}
    return;
  }
  /* 횟수형 방어막 — 이 타격 «1회» 를 통째로 무효화하고 1장 소모한다 (수치형 실드보다 먼저).
     «데미지 완전 무효» 라 방어력·실드·체력을 아예 건드리지 않지만, «맞은 사건» 자체는 일어난 것이라
     아래 피격 트리거들은 그대로 굴린다(주인 원문이 «그 타격 데미지 완전 무효» 이므로 — 위임 판단). */
  const warded=p.ward>0;
  if(warded){
    p.ward--;
    if(px.wardBurst&&src&&src.hp>0){src.hp-=effDmg(p)*3;if(src.hp<=0)onKill(G,src);}
  }
  let d=warded?0:dmg*(1-effDef(p)/100);
  if(!warded&&px.guardCrystal&&p.sh>0)d*=0.62;
  if(!warded&&p.sh>0){const ab=Math.min(p.sh,d);p.sh-=ab;d-=ab;}
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
  if(px.thornsS&&src&&src.hp>0&&pkk(p,0.30*px.thornsS)){src.hp-=dmg*0.5;if(src.hp<=0)onKill(G,src);}
  if(px.thorns&&src&&src.hp>0&&pkk(p,0.60*px.thorns)){src.hp-=dmg*1.5;if(src.hp<=0)onKill(G,src);}
  if(px.thornsKing&&src&&src.hp>0){src.hp-=dmg*3;if(src.hp<=0)onKill(G,src);}
  /* 피격 시 스턴 — 주인 필수 예시 «피격 시 (n% 확률로) 공격한 적 3초 스턴» (전설 l_stunHit3) */
  gainWard(p,0.08*px.wardHit);
  if(px.stunHitS&&src&&pkk(p,0.12*px.stunHitS))applyStun(G,src,1.5);
  if(px.stunHitL&&src&&pkk(p,0.55*px.stunHitL))applyStun(G,src,3.0);
  /* 원거리 피격 축 — 위 «피격 시» 트리거를 전부 굴린 «뒤» 에 추가로 굴린다 (별개 축, 주인 16:1X) */
  if(!isMelee)procOnRanged(G,src);
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
  const G={chapter,player:null,nodes:[],pprojs:[],arrows:[],gold:0,kills:0,procN:0,
    perkChances:0,taken:[],legendOnly:false,overBoltCd:0,autoBoltT:2,stunAuraT:2.5,stuns:0,misses:0,
    dead:false,cleared:false,t:0,atkTries:0,miss:0,   /* 적 회피 10% 실측용 (PLAN §2.3) */
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
          atkTimer:rand(0.4,1.2),stun:0,wave:nd,dead:false,isBoss:false,exp:0});
      }
      wi++;x+=(node.size-1)*88+560;
    }else if(node.t==='boss'){
      const st=enemyStats(chapter,wi);
      const bh=st.hp*TUNE.bossHp,bd=st.dmg*TUNE.bossDmg;   /* 챕터 무관 항상 동일 (PLAN §6 주인 확정) */
      nd.enemies.push({worldX:x+60,hp:bh,maxHp:bh,dmg:bd,ranged:false,
        atkTimer:1.2,stun:0,wave:nd,dead:false,isBoss:true,hits:0});
    }else x+=470;
    G.nodes.push(nd);
  }
  const dt=1/30;
  const maxT=900;
  while(!G.dead&&!G.cleared&&G.t<maxT){
    G.t+=dt;
    G.procN=0;   /* 성능 가드: 소환 적중 트리거 예산은 틱마다 리셋 (PROC_TICK_CAP) */
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
          /* ⚑ 주인 확정(2026-09-02 16:4X · PLAN §7): 가상 플레이어는 쉼터에서 «항상 🌟 경험치» 를 고른다.
             체력 회복 분기는 시뮬에서 금지 — 전 실험(1~5·사다리·하니스) 공통 측정 조건.
             실제 게임(index.html)은 유저 자유 선택이므로 두 선택지를 그대로 둔다.
             ⚑ 주인 확정(17:1X · PLAN §2.4 · T49): 보상이 «체력 260 회복(고정값) vs 경험치 +26» 으로 개정됐다. */
          gainExp(G,REST_EXP);        /* SIM_REST_POLICY: 항상 경험치 (게이트 tools/verifyRestPolicy.js 가 감시) */
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
    if(p.px.autoBolt){G.autoBoltT-=dt;if(G.autoBoltT<=0){G.autoBoltT=2.4;for(let k=0;k<p.px.autoBolt;k++){const t2=randTarget(G);if(t2)summonHit(G,t2,0.75);}}}
    /* 신화 m_stunAura «위압» — 2.5초마다 랜덤 적 1명 스턴 (중첩 시 횟수 +1. autoBolt 와 같은 구조) */
    if(p.px.stunAura){G.stunAuraT-=dt;if(G.stunAuraT<=0){G.stunAuraT=2.5;for(let k=0;k<p.px.stunAura;k++){const t3=randTarget(G);if(t3)applyStun(G,t3,2.5);}}}
    /* 적 */
    for(const e of alive){
      if(e.hp<=0)continue;
      /* ⚑ 스턴 (T48) — 남은 시간을 줄이고, 스턴 중이면 이번 틱 공격을 통째로 건너뛴다.
         공격 타이머는 흐르지 않는다(스턴이 풀리자마자 밀린 공격이 몰아치지 않게 — 위임 기본값). */
      if(e.stun>0){e.stun-=dt;continue;}
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
          if(pr.node&&e.wave!==pr.node)continue;   /* 미스폰·대기 웨이브 피격 금지 (주인 15:2X) */
          if(!pr.hit.has(e)&&Math.abs(e.worldX-pr.x)<16){
            pr.hit.add(e);summonHit(G,e,pr.ratio);
            if(pr.hit.size>=pr.pierce){done=true;break;}
          }
        }
        if(pr.x>pr.maxX)done=true;
      }else{
        if(!pr.tgt||pr.tgt.hp<=0)done=true;
        else if(pr.x>=pr.tgt.worldX-10){summonHit(G,pr.tgt,pr.ratio);done=true;}
      }
      if(done)G.pprojs.splice(i,1);
    }
  }
  return {clear:G.cleared,time:G.t,gold:G.gold,taken:G.taken.map(t=>t.id),level:p.level,atkTries:G.atkTries,miss:G.miss};
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
/* 실험1·2 하니스 = **변별점 규칙** (주인 확정 2026-09-02 15:1X · 승인 25번 3안 채택 · T31).
   ⚑ 정본 규칙 (종전 T5 «그 챕터 도달 시점의 관측 중앙값» 은 이 규칙으로 개정됐다):
     ① 두 하니스 모두 전체 클리어율이 변별 구간 15~85% 안에 있어야 한다 (바닥/천장 포화면 측정 자체가 무의미 — T7).
     ② 실험2 는 그 안에서도 «변별력 최대» 인 60~70% 지점을 목표로 잡는다.
     ③ 실험1 은 등급 4단(일반·희귀·전설·신화) 클리어율이 전부 1~99% 비포화 + 인접 ≥2%p 분리되는 지점으로 잡는다.
     ④ 경제·난이도 노브를 바꾼 회차마다 재보정한다 (T5 의 재보정 조항은 그대로 유효 — 기준만 바뀌었다).
     ⑤ «도달 시점 실제 계정과의 괴리» 는 위반이 아니라 **참고 지표**다 (3안). 실험3 곡선이 목표에 들어올수록 저절로 줄어든다.
   감시: `node tools/verifyHarness.js` (①②③ 위반 시 exit 1 · ⑤ 는 표시만). 값을 바꾸면 그 게이트를 --rebase 로 갱신할 것.
   EXP1_GEAR='등급,강화,슬롯' 형태 환경변수로 덮어쓸 수 있다. */
/* ⚑ T1 R01 신설 — 하니스 «챕터» 축. 정본 ②③ 은 하니스가 변별 구간에 앉기를 요구하는데,
   R01 의 난이도 재적합(기저 40/8 → 26/5.2) 후 챕터 6 에서 강화 축이 **절벽**이 됐다:
   미장착 2.3% ↔ 일반+0 99.7% 사이에 값이 없다(일반+N 은 위로만 간다). 즉 종전처럼 강화로는 못 고른다.
   그래서 «어느 챕터에서 재나» 를 새 조절 축으로 열었다 — `EXP1_CH`/`EXP2_CH` 로 덮어쓸 수 있고
   기본값이 곧 채택 하니스다. `tools/verifyHarness.js` 가 이 기본값을 소스에서 읽어 자동 추종한다. */
function hCh(env,def){ const v=Number(process.env[env]); return Number.isFinite(v)&&v>0?v:def; }
function harness(env,defRar,defPlus,defSlot){
  const s=(process.env[env]||'').split(',').map(v=>v.trim()===''?NaN:Number(v));   /* T7: ''.split(',') → [''] → Number('')=0 이라 기본값이 무시되던 버그 수정 */
  const rar=Number.isFinite(s[0])?s[0]:defRar, plus=Number.isFinite(s[1])?s[1]:defPlus, slot=Number.isFinite(s[2])?s[2]:defSlot;
  return {b:mkBuild(rar,plus,slot),desc:`${GT.rarName[rar]}${plus?'+'+plus:''} 6부위 · 슬롯 ${slot}렙`};
}
function exp1_rarityLadder(){
  const h=harness('EXP1_GEAR',0,3,0), CH=hCh('EXP1_CH',13);
  /* ⚑ T1 R02 재보정 (정본 ④ — 챕터 10 벽을 켠 회차). 하니스 챕터 13 은 벽 구간(c≥10) 안이라 ×1.5 를 그대로 맞는다:
     종전 «일반+1» 이 혼합 23.7% → 4.7% 로 변별 구간(15~85%) 아래로 빠졌다. 챕터는 그대로 두고 강화만 +1 → +3.
     300판 실측 후보 — ch13·+2 17.3%(사다리 2.3/6.7/22.0/58.0, 일반 칸이 바닥에 붙는다) · **채택 ch13·+3 29.3%**
     (사다리 12.0/18.0/47.3/72.7, 간격 6.0·29.3·25.4%p, 포화 0) · ch13·+4 48.3%(전설 68.3·신화 82.3 으로 위가 답답하다). */
  /* **T47 재선정 (2026-09-02, 주인 확정 «레벨업 필요 경험치 4+4*Lv» · 변별점 규칙 ③):** 요구 경험치가 레벨당 2배로
     늘어 같은 챕터에서 얻는 특전 수가 줄었다. T45·T46 까지 반영한 엔진에서 300판 재측정 — 종전 «일반+2» 는
     24.3% → **10.7%** 로 변별 구간(15~85%) 아래로 빠졌다. 후보: 일반+3 17.0%(사다리 2.7/13.0/22.3/50.0 — 일반 칸이
     바닥 1.0% 에 붙는다) · **일반+4 30.7%**(사다리 일반 8.3 / 희귀 21.7 / 전설 40.7 / 신화 61.7, 간격 13.4·19.0·21.0%p,
     포화 0) → **일반+4 슬롯0 채택**.
     T49(쉼터 260/26)까지 들어온 최종 트리에서 재측정 — 36.0%(사다리 12.3/25.7/51.7/66.7, 포화 0)로 밴드 안. */
  /* T31 재보정 (2026-09-02, 스탯 사다리 개편 후 · 변별점 규칙 ③): 종전 «전설 6부위·슬롯 1렙» 은 개편으로 챕터6 클리어율이
     100.0% 가 되어 등급 4단이 전부 천장 포화했다(사다리 100/100/100/100 — 측정 불능). 300판 실측으로 재보정한 값이다:
       일반+2 슬롯0 → 혼합 52.7% · 사다리 일반 12.0 / 희귀 41.7 / 전설 75.0 / 신화 87.3% (간격 29.7·33.3·12.3%p, 포화 0).
     ⚠ 등급 축(일반→희귀)은 챕터6 에서 23.0% → 100.0% 로 절벽이라 하니스를 «등급» 으로는 못 고른다 —
       연속 미세 조절이 되는 축이 강화(+1강당 장비 기여 +13%)뿐이라 «일반 등급 + 강화» 를 픽스처로 쓴다.
     ⚑ **T1 R01 재보정 (난이도 재적합 · 정본 ②③④)**: 기저 40/8 → 26/5.2 로 챕터 6 이 통째로 물러져 일반+2 가 100.0% 천장 포화가 됐고,
       강화 축을 내려도 **미장착 2.3% ↔ 일반+0 99.7%** 라 챕터 6 에는 변별 구간(15~85%)에 앉을 값이 아예 없다.
       그래서 새로 연 «챕터» 축으로 재선정 — **챕터 13 · 일반+1 · 슬롯 0** (300판 실측: 혼합 26.0% ·
       사다리 일반 4.3 / 희귀 12.3 / 전설 36.0 / 신화 62.3%, 간격 8.0·23.7·26.3%p, 포화 0 — 바닥·천장 양쪽 여유 최대).
       후보 비교: 챕터 11·일반+1 은 일반→희귀 간격이 5.0%p 뿐이고(30.3 vs 35.3) 신화가 90.3% 로 천장에 가깝다.
       ⚠ 인접 챕터가 난이도 순서를 보장하지 않는다(T28 — `chapterLayout` 제비뽑기가 지배): 챕터 10 은 일반+1 로 99.5% 인데
         챕터 11 은 같은 하니스로 58.7% 다. 챕터 축으로 고를 때는 **반드시 실측으로** 고르고 «12 가 11 보다 어렵다» 로 추정하지 말 것.
     ⚠ 실경제에서 일반 장비에 +강은 붙지 않는다(합성 +강은 전설부터) — 이것은 대표성이 아니라 변별력을 위한 **측정 픽스처**이고,
       변별점 규칙(⑤)은 대표성을 요구하지 않는다. 부작용: `GT.optCount(0,plus)=0` 이라 실험1·2 는 **장비 옵션 0개** 환경에서 돈다
       (특전 효과만 분리해 재는 데는 오히려 유리하지만, «특전 × 장비 옵션» 상호작용은 이 두 실험이 못 본다 — 실험4·5 의 몫). */
  console.log(`\n=== 실험1: 등급 고정 파워 사다리 (챕터${CH}, 하니스 ${h.desc}, 300판) ===`);
  for(const rar of [null,0,1,2,3]){
    let wins=0,times=0,n=300;
    for(let i=0;i<n;i++){
      const r=runChapter(CH,h.b,rar===null?{}:{rarityLock:rar});
      if(r.clear){wins++;times+=r.time;}
    }
    const nm=rar===null?'혼합':['일반','희귀','전설','신화'][rar];
    console.log(`${nm}: 클리어 ${(wins/n*100).toFixed(1)}%  평균시간 ${wins?(times/wins).toFixed(0):'-'}s`);
  }
}
function exp2_perkWinrate(){
  const h=harness('EXP2_GEAR',0,4,0), CH=hCh('EXP2_CH',11);
  /* ⚑ T1 R02 재보정 (정본 ②④ — 챕터 10 벽을 켠 회차). 챕터 11 도 벽 안이라 종전 «일반+1·슬롯3» 이 64.7% → 21.0%
     로 밴드 아래로 빠졌다. 300판 실측 — 일반+3·슬롯3 54.0% · **채택 일반+4·슬롯0 66.7%** · 일반+4·슬롯3 70.0% ·
     일반+5·슬롯0 80.3%. 채점이 실제로 도는 1200판에서 재확인 **65.4%** 로 밴드(60~70%) 정중앙이다.
     R01 이 슬롯 축까지 써야 했던 것과 달리 이번엔 강화 축만으로 밴드에 앉아 슬롯 0렙으로 되돌렸다. */
  /* **T47 재선정 (2026-09-02 · 변별점 규칙 ②④):** 주인 확정 «레벨업 필요 경험치 4+4*Lv» 로 특전 획득이 느려져
     T46 이 고른 «일반+9» 가 73.3% → **41.0%**(게이트 300판)로 목표 밴드 60~70% 밖으로 떨어졌다. 재측정 —
     게이트 300판: 일반+9 41.0% · **일반+10 60.3%** · 일반+11 73.0% / 채점이 실제로 도는 1200판: 일반+9 42.3% ·
     **일반+10 58.5%** · 일반+11 71.1%. 두 판수 모두에서 밴드(허용 ±8%p) 안이고 300판 기준으로는 밴드 정중앙인
     **일반+10 슬롯0 채택** (일반+11 은 300판 73.0% 로 밴드를 넘는다).
     T49(쉼터 260/26)까지 들어온 최종 트리에서 재측정 — 62.3% 로 목표 밴드 60~70% 안, 구성 유지. */
  /* T31 재보정 (2026-09-02 · 변별점 규칙 ②): 종전 «신화 6부위·슬롯 0렙» 은 스탯 사다리 개편 후 챕터8 클리어율이
     100.0%(천장 포화)라 특전별 승률 차가 전혀 안 벌어졌다. 300판 실측으로 목표 밴드 60~70% 에 맞춘 값이다:
       일반+6 52.0% · **일반+7 66.3%** · 일반+8 84.3% → 일반+7 슬롯0 채택 (종전 규칙값의 66.7% 와 사실상 같은 지점).
     **T43·T45 재보정 (적 회피 10% + 소환 적중 트리거 · 정본 ④):** 두 변경이 반대 방향으로 밀어(회피 −, 소환 +)
     같은 하니스가 66.3% → 55.0%(T43 단독) → 77.7%(T45 단독) → **62.3%(둘 다 반영)** 로 움직였다.
     둘 다 반영한 엔진에서 300판 재측정 — 일반+6 44.3% · **일반+7 62.3%** · 일반+8 67.7% · 일반+9 75.7%
     → **일반+7 슬롯0 유지**가 목표 밴드 정중앙이다(중간 커밋에서 일반+6 으로 내렸다가 되돌렸다).
     **T46 재보정 (시뮬 쉼터 = 항상 경험치 · 정본 ②④):** 쉼터 회복(최대체력 40%)이 시뮬에서 빠지자 같은 하니스가
     62.3% → 46.0% 로 목표 밴드(60~70%) 밖으로 나갔다 → 1200판 재측정으로 일반+9 채택(69.3%).
     **T49 재보정 (쉼터 보상 260/26 · 같은 세션):** 경험치가 +10 → +26 이 되자 일반+9 가 80.7%(게이트 300판)로
     다시 밴드를 넘겨 한 단계 내렸다 — 1200판 기준 일반+7 52.2% · **일반+8 66.1%** · 일반+9 69.3%(T46 시점)
     → **일반+8 슬롯0 채택**(게이트 300판 65.0%).
     ⚑ **T1 재개 R01 재보정 (난이도 재적합 · 정본 ②④)**: 기저 40/8 → 22.8/4.56 으로 챕터 8 이 물러져 일반+10 이 천장 포화가 됐다.
       실험1 과 같은 이유로 «챕터» 축을 써서 재선정 — **챕터 11 · 일반+1 · 슬롯 3**.
       ⚠ 강화 축만으로는 밴드에 못 앉는다: 챕터 11 에서 일반+1 은 1200판 58.7/59.3%(밴드 아래) · 일반+2 는 300판 73.3%(밴드 위)로
         **두 값 사이에 강화 단계가 없다**. 슬롯(레벨당 +1%)이 유일하게 남은 미세 축이라 이것으로 채웠다 —
         일반+1 슬롯3 = 1200판 **62.6 / 63.8%**(게이트 300판 63.0%)로 목표 밴드 60~70% 안이다.
       종전 등재: 챕터 8 · 일반+10 · 62.3%.
     축 선택 근거·픽스처 성격·옵션 0개 부작용은 실험1 주석과 동일하다. */
  /* 진단 전용 오버라이드 (채점용 기본값은 PLAN §7 의 1200판 그대로).
     EXP2_N: 표본 수를 늘려 «측정 노이즈 대 실제 아웃라이어» 를 분리할 때만 사용.
     EXP2_FULL=1: 등급별 전 특전 승률을 덤프해 어느 특전을 올리고 내릴지 고를 때 사용. */
  let base=0,N=parseInt(process.env.EXP2_N||'1200',10);
  console.log(`\n=== 실험2: 특전별 기여도 (챕터${CH}, 하니스 ${h.desc}, ${N}판) ===`);
  const stat={};
  for(const p of PERKS)stat[p.id]={w:0,n:0};
  for(let i=0;i<N;i++){
    const r=runChapter(CH,h.b,{});
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
  /* ⚑ T1 R02 — 합격 기준 ①(«20일=600판 연속 실패» 정체 없음)을 «추정» 이 아니라 «측정» 으로 판정하려고 신설했다.
     종전 출력은 30일 눈금뿐이라, 구간 평균이 임계의 75% 여도 그 안에서 600판 연속 실패가 있었는지 알 수 없었다
     (R02 비평가 2인이 독립적으로 같은 한계를 지적했다 — «①은 검증 자체가 불가능하다»). 챕터별 최장 연속 실패 판수를 센다. */
  let worstCh=0,worstTries=0;
  const marks=[1,3,7,14,30,60,90,120,150,180,240,300,365];
  /* ⚑ T1 R03(T59) — `chap <= maxChapter` 가드. 이게 없으면 계정이 콘텐츠가 없는 301+ 로 계속 올라가고,
     기준①(정체)이 «경제가 막혔다» 가 아니라 «게임이 끝났다» 를 재게 된다. R02 까지는 계정이 250~290 장에
     머물러 드러나지 않았는데, R03 이 곡선·경제를 풀자 실제로 넘어갔다(F2P 365일차 315·350·348장). */
  let doneDay=0;
  for(let d=1;d<=DAYS&&!doneDay;d++){
    for(let k=0;k<GT.runsPerDay;k++){
      total++;tries++;
      if(accAttempt(a,chap).clear){ if(tries>worstTries){worstTries=tries;worstCh=chap;} chap++; tries=0;
        if(chap>TUNE.maxChapter){ doneDay=d; break; } }
    }
    if(marks.includes(d)){
      const my=GT.parts.filter(pt=>a.eq[pt]&&a.eq[pt].rar===4).length;
      console.log(`  ${String(d).padStart(3)}일차: 챕터 ${String(chap-1).padStart(3)} 클리어  슬롯 ${slotStr(a)}  신화 ${my}/6  장비 ${eqStr(a)}  누적뽑기 ${a.pulls}`);
    }
    if(tries>GT.runsPerDay*STUCK){ stuckFrom=chap; stuck=tries; break; }   /* STUCK 일 넘게 한 챕터에 정체 = 막힘 (90·300 대형 벽은 원래 오래 걸리므로 기본 40일) */
  }
  const my=GT.parts.filter(pt=>a.eq[pt]&&a.eq[pt].rar===4).length;
  console.log(`최종: 챕터 ${chap-1} 클리어 · 슬롯 ${slotStr(a)} · 신화 부위 ${my}/6 · 뽑기 ${a.pulls}회 · 합성 ${a.fuses}회 · 총 ${total}판`
    +(doneDay?`  ★ 전 챕터(${TUNE.maxChapter}) 완주 — ${doneDay}일차`:''));
  /* ⚑ T1 R02 — 기준 ① 직접 판정. 마지막 챕터는 아직 클리어 전이라 진행 중 판수(tries)도 후보에 넣는다.
     ⚑ T1 R03(T59) — 완주한 런은 «진행 중» 이 없으므로 이 보정을 하지 않는다. */
  if(!doneDay&&tries>worstTries){worstTries=tries;worstCh=chap;}
  console.log(`기준①(정체) 최장 연속 실패: 챕터 ${worstCh} 에서 ${worstTries}판(${(worstTries/GT.runsPerDay).toFixed(1)}일) — 임계 ${GT.runsPerDay*20}판(20일) ${worstTries<GT.runsPerDay*20?'미만 ✓':'이상 ✗'}`);
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
