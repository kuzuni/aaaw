'use strict';
/* PLAN.md 문서값 ↔ sim.js 엔진 상수 대조 게이트 (T16 신설)
   사용: node tools/verifyPlanConst.js        (불일치가 있으면 exit 1)

   왜 필요한가: T8·T9·T11·T12·T16 이 전부 «PLAN 에 적힌 숫자와 엔진 상수가 다르다» 는 같은 종류의 버그였다.
   T2 가 PLAN 을 보고 index.html 로 이식하므로, 이 불일치는 게임에 틀린 숫자를 그대로 심는다.
   sim.js 는 require 하면 실험이 돌아버리므로(하단 CLI 디스패처) **소스 텍스트를 파싱**해 상수를 뽑는다. */

const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const SIM=fs.readFileSync(path.join(root,'sim.js'),'utf8');
const PLAN=fs.readFileSync(path.join(root,'PLAN.md'),'utf8');

/* ---- sim.js 에서 상수 블록 뽑기 ---- */
function block(src,head){
  const i=src.indexOf(head);
  if(i<0) throw new Error(`sim.js 에서 «${head}» 를 못 찾았다`);
  const j=src.indexOf('\n};',i);
  return src.slice(i,j);
}
function num(blk,key){
  const m=blk.match(new RegExp(`(?:^|[{,\\s])${key}\\s*:\\s*(-?[0-9.]+)`,'m'));
  if(!m) throw new Error(`상수 ${key} 를 못 찾았다`);
  return Number(m[1]);
}
const TB=block(SIM,'const TUNE={'), GB=block(SIM,'const GT={');
const T=k=>num(TB,k), G=k=>num(GB,k);

/* 가챠 확률: T65 로 누적 임계 리터럴이 GT.gachaRate 단일 출처가 됐다 (일반→신화 순, 단위 %).
   종전엔 `rar = r<0.1?4 : …` 분기에서 누적값을 되돌려 풀었다. */
function gachaPct(){
  const m=SIM.match(/gachaRate:\s*\[([^\]]*)\]/);
  if(!m) throw new Error('GT.gachaRate 를 못 찾았다 (T65 이후 가챠 확률의 단일 출처)');
  const r=m[1].split(',').map(Number);
  if(r.length!==5||r.some(isNaN)) throw new Error(`GT.gachaRate 를 5칸 숫자로 못 읽었다: «${m[1]}»`);
  return {myth:r[4], leg:r[3], hero:r[2], rare:r[1], norm:r[0]};
}
const GP=gachaPct();

/* §6 은 «2026-09-01 튜닝 전 초기값» 블록과 «현재 확정값» 블록이 같은 문법으로 두 번 나온다.
   되돌림용 기록인 앞 블록을 잡지 않도록 뒤 블록만 잘라 대조 범위로 쓴다. */
function sliceFrom(src,head,end){
  const i=src.indexOf(head);
  if(i<0) throw new Error(`PLAN.md 에서 «${head}» 를 못 찾았다`);
  const j=src.indexOf(end,src.indexOf('```',i)+3);
  return src.slice(i,j);
}
const CONF=sliceFrom(PLAN,'**현재 확정값','```');

/* ---- ⚑ T35: 배열 상수(등급별 기여표·구간별 성장률) 뽑기 ----
   등비 생성(`atkUnit`/`hpUnit`/`rarStep`)과 단일 성장률(`eHpG`/`eDmgG`)이 폐기되면서
   PLAN 대조 대상이 «스칼라» 에서 «표» 로 바뀌었다. 표는 아래 별도 루프에서 대조한다. */
function arr(blk,key){
  const m=blk.match(new RegExp(`(?:^|[{,\\s])${key}\\s*:\\s*\\[([^\\]]*)\\]`,'m'));
  if(!m) throw new Error(`배열 상수 ${key} 를 못 찾았다`);
  return m[1].split(',').map(s=>Number(s.trim()));
}
function segArr(blk,key){   /* [[하한,배수],…] → 배수만 */
  const m=blk.match(new RegExp(`(?:^|[{,\\s])${key}\\s*:\\s*\\[(\\[[\\s\\S]*?\\])\\]\\s*,`,'m'));
  if(!m) throw new Error(`구간 상수 ${key} 를 못 찾았다`);
  return [...m[1].matchAll(/\[\s*\d+\s*,\s*([\d.]+)\s*\]/g)].map(x=>Number(x[1]));
}

/* ---- 대조표: [항목, 엔진값, PLAN 정규식(캡처 1개), PLAN 위치 설명, 배율?, 범위?] ----
   배율: PLAN 표기가 % 등 다른 단위일 때 «문서값 = 엔진값 × 배율» (기본 1). 범위: 기본 PLAN 전문. */
const CHECKS=[
  /* §2.4 골드 (T2 가 그대로 이식하는 식) */
  ['goldKillBase',   T('goldKillBase'), /처치 `round\(\(([\d.]+)\+/,                      '§2.4 골드 처치식'],
  ['goldKillPer',    T('goldKillPer'),  /처치 `round\(\([\d.]+\+([\d.]+)\*챕터\)/,          '§2.4 골드 처치식'],
  ['goldGrowth(처치)',T('goldGrowth'),  /처치 `round\(\([\d.]+\+[\d.]+\*챕터\)\*([\d.]+)\^/,'§2.4 골드 처치식'],
  ['goldClearPer',   T('goldClearPer'), /클리어 보너스 `([\d.]+)\*챕터/,                    '§2.4 골드 클리어식'],
  ['goldGrowth(클리어)',T('goldGrowth'),/클리어 보너스 `[\d.]+\*챕터\*([\d.]+)\^/,          '§2.4 골드 클리어식'],
  ['goldGrowth(§2.4 주석)',T('goldGrowth'),/`goldGrowth`, 현행값 ([\d.]+)/,                 '§2.4 괄호 주석'],
  ['slotCostG(§2.4 주석)',G('slotCostG'),/슬롯 강화 비용이 ([\d.]+)\^렙/,                   '§2.4 괄호 주석'],
  ['expKill',        T('expKill'),      /일반 적 처치 \+(\d+), 보스/,                       '§2.4 경험치'],
  ['expBoss',        T('expBoss'),      /일반 적 처치 \+\d+, 보스 \+(\d+)/,                 '§2.4 경험치'],
  ['maxChapter',     T('maxChapter'),   /(\d+)개로 확장\*\*/,                              '§2.4 챕터 수'],

  /* §6 적 수치 (현재 확정값 블록만 — 초기값 블록은 되돌림용 기록이라 제외) */
  ['eBaseHp',  T('eBaseHp'),  /적 HP\s+= ([\d.]+) \*/,                             '§6 확정값',1,CONF],
  ['waveHp',   T('waveHp'),   /적 HP\s+= .*\(1\+([\d.]+)\*웨이브\)/,             '§6 확정값',1,CONF],
  ['wallHp',   T('wallHp'),   /적 HP\s+= .*c>=10: ×([\d.]+)/,                   '§6 확정값',1,CONF],
  ['wall2Hp',  T('wall2Hp'),  /적 HP\s+= .*c>=15: ×([\d.]+)/,                   '§6 확정값',1,CONF],
  ['eBaseDmg', T('eBaseDmg'), /적 DMG\s+=\s+([\d.]+) \*/,                          '§6 확정값',1,CONF],
  ['waveDmg',  T('waveDmg'),  /적 DMG\s+= .*\(1\+([\d.]+)\*웨이브\)/,            '§6 확정값',1,CONF],
  ['wallDmg',  T('wallDmg'),  /적 DMG\s+= .*c>=10: ×([\d.]+)/,                  '§6 확정값',1,CONF],
  ['wall2Dmg', T('wall2Dmg'), /적 DMG\s+= .*c>=15: ×([\d.]+)/,                  '§6 확정값',1,CONF],
  ['bossHp',   T('bossHp'),   /보스: HP ×(\d+), DMG/,                           '§6 확정값',1,CONF],
  ['bossDmg',  T('bossDmg'),  /보스: HP ×\d+, DMG ×([\d.]+)/,                   '§6 확정값',1,CONF],
  ['wall3Hp',  T('wall3Hp'),  /90 대형 벽\s+: c>=90\s+→ HP ×([\d.]+)/,                      '§6 확정값',1,CONF],
  ['wall3Dmg', T('wall3Dmg'), /90 대형 벽\s+: c>=90\s+→ HP ×[\d.]+ · DMG ×([\d.]+)/,        '§6 확정값',1,CONF],
  ['wall4Hp',  T('wall4Hp'),  /300 최종 벽 : c>=300 → HP ×([\d.]+)/,                        '§6 확정값',1,CONF],
  ['wall4Dmg', T('wall4Dmg'), /300 최종 벽 : c>=300 → HP ×[\d.]+ · DMG ×([\d.]+)/,          '§6 확정값',1,CONF],
  ['goldGrowth(§6 R07)',T('goldGrowth'),/goldGrowth\s+: [\d.]+ → ([\d.]+)/,                '§6 R07 블록'],
  ['slotCostBase(§6 R07)',G('slotCostBase'),/슬롯 비용\s+: [\d.]+ \* [\d.]+\^L → (\d+) \*/, '§6 R07 블록'],
  ['slotCostG(§6 R07)',G('slotCostG'),/슬롯 비용\s+: .*→ \d+ \* ([\d.]+)\^L/,               '§6 R07 블록'],

  /* §11.2 가챠 (주인 확정 상수) */
  ['가챠 신화%', GP.myth, /확률: \*\*신화 ([\d.]+)%/,                                       '§11.2'],
  ['가챠 전설%', GP.leg,  /확률: \*\*신화 [\d.]+% \/ 전설 ([\d.]+)%/,                        '§11.2'],
  ['가챠 영웅%', GP.hero, /전설 [\d.]+% \/ 영웅 ([\d.]+)%/,                                  '§11.2'],
  ['가챠 희귀%', GP.rare, /영웅 [\d.]+% \/ 희귀 ([\d.]+)%/,                                  '§11.2'],
  ['가챠 일반%', GP.norm, /희귀 [\d.]+% \/ 일반 ([\d.]+)%/,                                  '§11.2'],
  ['pullCost',  G('pullCost'), /1회 \*\*(\d+) 다이아\*\*/,                                   '§11.2'],

  /* §11.3 합성 */
  ['legendToMythPlus', G('legendToMythPlus'), /\*\*\+(\d+)강 도달 시 그 대신 신화 0강/,       '§11.3'],

  /* §11.4 슬롯 균등 보너스 */
  ['evenStep', G('evenStep'), /`\+([\d.]+)% × floor\(min\(슬롯 렙\)\/\d+\)`/,                '§11.4',100],
  ['evenPer',  G('evenPer'),  /`\+[\d.]+% × floor\(min\(슬롯 렙\)\/(\d+)\)`/,                '§11.4'],

  /* §11.5 경제 (주인 확정 상수) */
  ['dailyGem', G('dailyGem'), /다이아 무료 보급: 하루 ([\d,]+)개/,                            '§11.5'],
  ['iapGem',   G('iapGem'),   /₩110,000 = 다이아 ([\d,]+)개/,                                '§11.5'],

  /* §11.5-a 장비·슬롯 수치 블록 */
  /* ⚑ T35: atkUnit·hpUnit·rarStep·slotG 는 폐기된 상수라 대조 대상에서 제거했다.
     그 자리를 «기본치 3종 + 등급별 기여표 15칸 + 슬롯 2상수» 가 대신한다 (표는 아래 T35 루프). */
  ['pAtk0',    T('pAtk0'),    /기본치\(노템\) = 공격력 (\d+) ·/,                              '§11.5-a'],
  ['pHp0',     T('pHp0'),     /기본치\(노템\) = 공격력 \d+ · 체력 (\d+) ·/,                    '§11.5-a'],
  ['pSh0',     T('pSh0'),     /기본치\(노템\) = 공격력 \d+ · 체력 \d+ · 실드 (\d+)/,           '§11.5-a'],
  ['plusStep', G('plusStep'), /plusStep\s+([\d.]+)\s/,                                       '§11.5-a'],
  ['slotLvMax',G('slotLvMax'),/슬롯 레벨 상한 (\d+) ·/,                                       '§11.5-a'],
  ['slotStep', G('slotStep'), /슬롯 레벨 상한 \d+ · 1렙당 \+([\d.]+)%/,                        '§11.5-a',100],
  ['slotCostBase(§11.5-a)', G('slotCostBase'), /슬롯 강화 비용 = floor\((\d+) \*/,            '§11.5-a'],
  ['slotCostG(§11.5-a)',    G('slotCostG'),    /슬롯 강화 비용 = floor\(\d+ \* ([\d.]+)\^/,   '§11.5-a'],

  /* §7 위임 기본값 */
  ['runsPerDay', G('runsPerDay'), /하루 플레이 판수 = (\d+)판/,                               '§7'],
];

/* ---- ⚑ T35 표 대조: [항목, 엔진값, PLAN 정규식, 위치, 배율] — 소수 표기라 허용오차 1e-6 ---- */
const RAR=['일반','희귀','영웅','전설','신화'];
const TABLE=[];
{
  const eAtk=arr(GB,'atk'), eHp=arr(GB,'hp'), eSh=arr(GB,'sh');
  /* §11.5-a «등급별 1부위 기여» 표: | 일반 | 4.167 | 16.667 | 25.000 | */
  for(let i=0;i<5;i++){
    const row=new RegExp(`\\|\\s*${RAR[i]}\\s*\\|\\s*([\\d.]+)\\s*\\|\\s*([\\d.]+)\\s*\\|\\s*([\\d.]+)\\s*\\|`);
    TABLE.push([`기여 ${RAR[i]} 공`, eAtk[i], row, '§11.5-a 기여표', 1, 1]);
    TABLE.push([`기여 ${RAR[i]} 체`, eHp[i],  row, '§11.5-a 기여표', 1, 2]);
    TABLE.push([`기여 ${RAR[i]} 실`, eSh[i],  row, '§11.5-a 기여표', 1, 3]);
  }
  /* §11.7 «구간별 성장률» 표: | 5 → 15 | 7.18% | 4.97% | — 엔진은 배수라 (배수-1)*100 로 비교 */
  const eHpS=segArr(TB,'eHpSeg'), eDmgS=segArr(TB,'eDmgSeg');
  /* ⚑ T1 R03: 260→300 구간 신설(PLAN §11.7 «필요 ×1.25» 이행) — 표 행도 엔진 배열도 7줄이었다.
     ⚑ T1 R05: 15→30 을 15→20 + 20→30 으로 분할 — 8줄이 됐다(항등식 x⁵·y¹⁰ = 1.0544¹⁵ 로 챕터 30 이후 누적 보존).
     ⚑⚑⚑ T97: 구간0 을 챕터 5 에서 쪼개 **1→5** 가 앞에 붙었다 — 9줄. 과녁 A(챕터 15)와 B(챕터 4)가
        서로 다른 노브를 갖게 하려는 분할이라, 이 줄이 빠지면 표와 엔진 배열의 색인이 통째로 어긋난다. */
  const SEG=[['1','5'],['5','15'],['15','20'],['20','30'],['30','50'],['50','70'],['70','120'],['120','260'],['260','300']];
  SEG.forEach(([a,b],i)=>{
    const row=new RegExp(`\\|\\s*${a}\\s*→\\s*${b}\\s*\\|\\s*([\\d.]+)%\\s*\\|\\s*([\\d.]+)%\\s*\\|`);
    TABLE.push([`성장 ${a}→${b} HP`,  (eHpS[i]-1)*100,  row, '§11.7 구간표', 1, 1]);
    TABLE.push([`성장 ${a}→${b} DMG`, (eDmgS[i]-1)*100, row, '§11.7 구간표', 1, 2]);
  });
}

let bad=0,ok=0,miss=0;
console.log('=== PLAN.md ↔ sim.js 상수 대조 (T16 게이트 · T35 개편 반영) ===');
for(const [name,eng,re,where,scale,scope] of CHECKS){
  const m=(scope||PLAN).match(re);
  if(!m){ miss++; console.log(`  ⚠ 미검출  ${name.padEnd(22)} ${where} — PLAN 에서 해당 표기를 못 찾았다(문구 변경?)`); continue; }
  const doc=Number(m[1].replace(/,/g,'')), want=eng*(scale||1);
  if(Math.abs(doc-want)<1e-9){ ok++; }
  else{ bad++; console.log(`  ✗ 불일치  ${name.padEnd(22)} PLAN ${where} = ${doc}  ≠  엔진 = ${want}`); }
}
for(const [name,eng,re,where,scale,grp] of TABLE){
  const m=PLAN.match(re);
  if(!m){ miss++; console.log(`  ⚠ 미검출  ${name.padEnd(22)} ${where} — PLAN 에서 해당 표 행을 못 찾았다`); continue; }
  const doc=Number(m[grp]), want=eng*(scale||1);
  if(Math.abs(doc-want)<1e-6){ ok++; }
  else{ bad++; console.log(`  ✗ 불일치  ${name.padEnd(22)} PLAN ${where} = ${doc}  ≠  엔진 = ${want}`); }
}
console.log(`\n일치 ${ok} · 불일치 ${bad} · 미검출 ${miss} (총 ${CHECKS.length+TABLE.length}항목)`);
if(bad||miss){ console.log('→ 실패: PLAN 과 엔진이 어긋났다. 둘 중 옳은 쪽으로 맞춰라(엔진 수치 변경은 T1 회차 절차를 따를 것).'); process.exit(1); }
console.log('→ 통과');
