'use strict';
/* 실험3(진행 곡선) 스윕 도구 — sim.js 를 TUNE_OVERRIDE / GT_OVERRIDE 로 여러 번 돌려 챕터별 시도수를 집계한다.
   사용: node tools/sweep.js '<TUNE_OVERRIDE JSON>' [반복수] '<GT_OVERRIDE JSON>' [EXP3_MAX]
   합격 구간 (PLAN §7):
     1~5:1~2 · 6~9:2~5 · 10:10~400(벽) · 11~19:3~10 · 20:10~30
     21~49:1~20 · 50~89:1~40 · 90:30~400(대형 벽) · 91~299:1~50 · 300:30~400(최종 벽)
   ※ T6 로 exp3 출력이 «강화 4종» → «슬롯 6개 + 장비» 로 바뀌어 구 파서가 무동작이었다 (R07 수리). */
const {execFileSync}=require('child_process');
const path=require('path');

const ov=process.argv[2]||'{}';
const N=parseInt(process.argv[3]||'5',10);
const gov=process.argv[4]||'{}';
const MAXC=parseInt(process.argv[5]||'20',10);
const root=path.join(__dirname,'..');

const band=c=>c<=5?[1,2]:c<=9?[2,5]:c===10?[10,400]:c<=19?[3,10]:c===20?[10,30]
  :c<=49?[1,20]:c<=89?[1,40]:c===90?[30,400]:c<=299?[1,50]:[30,400];

/* R11: SWEEP_SEED 를 주면 런 i 가 SEED=SWEEP_SEED+i 로 돈다 — 여러 구성을 «같은 난수» 로 비교(공통난수)해
   R10 이 부딪힌 «런간 분산이 노브 효과보다 커서 전 구성이 구별 불가» 문제를 없앤다. 미설정 시 종전과 동일(무시드). */
const SEED0=process.env.SWEEP_SEED!==undefined&&process.env.SWEEP_SEED!==''?Number(process.env.SWEEP_SEED):null;
const runs=[],slots=[],gears=[];
for(let i=0;i<N;i++){
  const env=Object.assign({},process.env,{TUNE_OVERRIDE:ov,GT_OVERRIDE:gov,EXP3_MAX:String(MAXC)});
  if(SEED0!==null)env.SEED=String(SEED0+i); else delete env.SEED;
  const out=execFileSync('node',[path.join(root,'sim.js'),'3'],
    {env,encoding:'utf8',maxBuffer:1<<24});
  const att={},sl={},gr={};
  for(const line of out.split('\n')){
    const m=line.match(/^챕터\s+(\d+): 시도\s+(\d+)회\s+슬롯\s+([\d/]+)\s+장비\s+(\S+)/);
    if(m){att[+m[1]]=+m[2];sl[+m[1]]=m[3].split('/').map(Number);gr[+m[1]]=m[4];}
  }
  runs.push(att);slots.push(sl);gears.push(gr);
}
let ok=0,tot=0;
console.log(`TUNE=${ov}  GT=${gov}  반복=${N}  챕터 1~${MAXC}`);
console.log('챕 | 목표      | 각 런 시도수                | 평균  | 판정');
for(let c=1;c<=MAXC;c++){
  const vals=runs.map(r=>r[c]).filter(v=>v!==undefined);
  if(!vals.length){console.log(`${String(c).padStart(3)} | 도달 실패 (전 런)`);break;}
  const [lo,hi]=band(c);
  const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
  const good=vals.filter(v=>v>=lo&&v<=hi).length;
  ok+=good;tot+=N;
  console.log(`${String(c).padStart(3)} | ${String(lo).padStart(2)}~${String(hi).padStart(3)}   | ${vals.map(v=>String(v).padStart(5)).join('')}${' '.repeat(Math.max(0,25-5*vals.length))} | ${avg.toFixed(1).padStart(6)} | ${good}/${vals.length}${good===vals.length?' OK':''}`);
}
/* 하니스 재보정용 (T5 규칙): 그 챕터 통과 시점의 슬롯 최저레벨·장비 등급 구성 */
const med=a=>{const b=a.slice().sort((x,y)=>x-y);return b.length?b[Math.floor(b.length/2)]:NaN;};
for(const c of [6,8]){
  const sv=slots.map(s=>s[c]).filter(Boolean).map(a=>Math.min(...a));
  const gv=gears.map(g=>g[c]).filter(Boolean);
  if(sv.length)console.log(`하니스 참고 — 챕터${c} 통과 시점 슬롯 최저레벨 중앙값 ${med(sv)} (각 런 ${sv.join(',')}) · 장비 ${gv.join(' | ')}`);
}
const totalAtt=runs.map(r=>Object.values(r).reduce((a,b)=>a+b,0));
console.log(`총 시도수(런별): ${totalAtt.join(', ')}  (환산 ${totalAtt.map(t=>(t/30).toFixed(0)+'일').join(', ')})`);
console.log(`구간 적합 셀: ${ok}/${tot} (${(ok/tot*100).toFixed(0)}%)`);
