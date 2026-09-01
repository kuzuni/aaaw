'use strict';
/* 실험3(진행 곡선) 스윕 도구 — sim.js 를 TUNE_OVERRIDE 로 여러 번 돌려 챕터별 평균 시도수를 집계한다.
   사용: node tools/sweep.js '<TUNE_OVERRIDE JSON>' [반복수]
   PLAN §7 의 합격 구간(1~5:1~2 / 6~9:2~5 / 10:10~400 / 11~19:3~10 / 20:10~30)과 대조해 OK/NG 를 표시. */
const {execFileSync}=require('child_process');
const path=require('path');

const ov=process.argv[2]||'{}';
const N=parseInt(process.argv[3]||'5',10);
const root=path.join(__dirname,'..');

const runs=[];
for(let i=0;i<N;i++){
  const out=execFileSync('node',[path.join(root,'sim.js'),'3'],
    {env:Object.assign({},process.env,{TUNE_OVERRIDE:ov}),encoding:'utf8',maxBuffer:1<<24});
  const att={};
  for(const line of out.split('\n')){
    const m=line.match(/^챕터\s+(\d+): 시도\s+(\d+)회/);
    if(m)att[+m[1]]=+m[2];
  }
  runs.push(att);
}
const band=c=>c<=5?[1,2]:c<=9?[2,5]:c===10?[10,400]:c<=19?[3,10]:[10,30];
let ok=0,tot=0;
console.log(`override=${ov}  반복=${N}`);
console.log('챕 | 목표      | 각 런 시도수                | 평균  | 판정');
for(let c=1;c<=20;c++){
  const vals=runs.map(r=>r[c]).filter(v=>v!==undefined);
  if(!vals.length){console.log(`${String(c).padStart(2)} | 도달 실패`);break;}
  const [lo,hi]=band(c);
  const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
  const good=vals.filter(v=>v>=lo&&v<=hi).length;
  ok+=good;tot+=N;
  console.log(`${String(c).padStart(2)} | ${String(lo).padStart(2)}~${String(hi).padStart(3)}   | ${vals.map(v=>String(v).padStart(4)).join('')}${' '.repeat(Math.max(0,24-4*vals.length))} | ${avg.toFixed(1).padStart(5)} | ${good}/${vals.length}${good===vals.length?' OK':''}`);
}
console.log(`구간 적합 셀: ${ok}/${tot} (${(ok/tot*100).toFixed(0)}%)`);
