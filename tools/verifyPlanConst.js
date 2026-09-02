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

/* 가챠 확률: rar = r<0.1?4 : r<2.1?3 : r<12.1?2 : r<42.1?1 : 0 → 등급별 % */
function gachaPct(){
  const m=SIM.match(/rar\s*=\s*r<([\d.]+)\?4\s*:\s*r<([\d.]+)\?3\s*:\s*r<([\d.]+)\?2\s*:\s*r<([\d.]+)\?1\s*:\s*0/);
  if(!m) throw new Error('가챠 확률 분기를 못 찾았다');
  const c=m.slice(1,5).map(Number);
  return {myth:c[0], leg:c[1]-c[0], hero:c[2]-c[1], rare:c[3]-c[2], norm:100-c[3]};
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
  ['eBaseHp',  T('eBaseHp'),  /적 HP\s+= (\d+) \*/,                             '§6 확정값',1,CONF],
  ['eHpG',     T('eHpG'),     /적 HP\s+= \d+ \* ([\d.]+)\^/,                    '§6 확정값',1,CONF],
  ['waveHp',   T('waveHp'),   /적 HP\s+= .*\(1\+([\d.]+)\*웨이브\)/,             '§6 확정값',1,CONF],
  ['wallHp',   T('wallHp'),   /적 HP\s+= .*c>=10: ×([\d.]+)/,                   '§6 확정값',1,CONF],
  ['wall2Hp',  T('wall2Hp'),  /적 HP\s+= .*c>=15: ×([\d.]+)/,                   '§6 확정값',1,CONF],
  ['eBaseDmg', T('eBaseDmg'), /적 DMG\s+=\s+(\d+) \*/,                          '§6 확정값',1,CONF],
  ['eDmgG',    T('eDmgG'),    /적 DMG\s+=\s+\d+ \* ([\d.]+)\^/,                 '§6 확정값',1,CONF],
  ['waveDmg',  T('waveDmg'),  /적 DMG\s+= .*\(1\+([\d.]+)\*웨이브\)/,            '§6 확정값',1,CONF],
  ['wallDmg',  T('wallDmg'),  /적 DMG\s+= .*c>=10: ×([\d.]+)/,                  '§6 확정값',1,CONF],
  ['wall2Dmg', T('wall2Dmg'), /적 DMG\s+= .*c>=15: ×([\d.]+)/,                  '§6 확정값',1,CONF],
  ['bossHp',   T('bossHp'),   /보스: HP ×(\d+), DMG/,                           '§6 확정값',1,CONF],
  ['bossDmg',  T('bossDmg'),  /보스: HP ×\d+, DMG ×([\d.]+)/,                   '§6 확정값',1,CONF],
  ['wall3Hp',  T('wall3Hp'),  /90 대형 벽\s+: c>=90\s+→ HP ×([\d.]+)/,                      '§6 T6 추가분'],
  ['wall3Dmg', T('wall3Dmg'), /90 대형 벽\s+: c>=90\s+→ HP ×[\d.]+ · DMG ×([\d.]+)/,        '§6 T6 추가분'],
  ['wall4Hp',  T('wall4Hp'),  /300 최종 벽 : c>=300 → HP ×([\d.]+)/,                        '§6 T6 추가분'],
  ['wall4Dmg', T('wall4Dmg'), /300 최종 벽 : c>=300 → HP ×[\d.]+ · DMG ×([\d.]+)/,          '§6 T6 추가분'],
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
  ['atkUnit',  G('atkUnit'),  /atkUnit ([\d.]+) ·/,                                          '§11.5-a'],
  ['hpUnit',   G('hpUnit'),   /atkUnit [\d.]+ · hpUnit ([\d.]+)/,                            '§11.5-a'],
  ['rarStep',  G('rarStep'),  /rarStep\s+(\d+)\s/,                                           '§11.5-a'],
  ['plusStep', G('plusStep'), /plusStep\s+([\d.]+)\s/,                                       '§11.5-a'],
  ['slotG',    G('slotG'),    /slotG\s+([\d.]+)\s/,                                          '§11.5-a'],
  ['slotCostBase(§11.5-a)', G('slotCostBase'), /슬롯 강화 비용 = floor\((\d+) \*/,            '§11.5-a'],
  ['slotCostG(§11.5-a)',    G('slotCostG'),    /슬롯 강화 비용 = floor\(\d+ \* ([\d.]+)\^/,   '§11.5-a'],

  /* §7 위임 기본값 */
  ['runsPerDay', G('runsPerDay'), /하루 플레이 판수 = (\d+)판/,                               '§7'],
];

let bad=0,ok=0,miss=0;
console.log('=== PLAN.md ↔ sim.js 상수 대조 (T16 게이트) ===');
for(const [name,eng,re,where,scale,scope] of CHECKS){
  const m=(scope||PLAN).match(re);
  if(!m){ miss++; console.log(`  ⚠ 미검출  ${name.padEnd(22)} ${where} — PLAN 에서 해당 표기를 못 찾았다(문구 변경?)`); continue; }
  const doc=Number(m[1].replace(/,/g,'')), want=eng*(scale||1);
  if(Math.abs(doc-want)<1e-9){ ok++; }
  else{ bad++; console.log(`  ✗ 불일치  ${name.padEnd(22)} PLAN ${where} = ${doc}  ≠  엔진 = ${want}`); }
}
console.log(`\n일치 ${ok} · 불일치 ${bad} · 미검출 ${miss} (총 ${CHECKS.length}항목)`);
if(bad||miss){ console.log('→ 실패: PLAN 과 엔진이 어긋났다. 둘 중 옳은 쪽으로 맞춰라(엔진 수치 변경은 T1 회차 절차를 따를 것).'); process.exit(1); }
console.log('→ 통과');
