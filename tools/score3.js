'use strict';
/* 실험3 채점 계산기 — tools/sweep.js 출력 파일을 받아 채점표(5점)의 구간별 소계를 계산한다.
   사용: node tools/score3.js <sweep 출력 파일>
   배점: 챕1~5 1점 · 챕6~9 1점 · 챕10 2점 · 챕11~20 1점 (각 구간 적합 셀 비율로 비례) */
const fs=require('fs');
const txt=fs.readFileSync(process.argv[2],'utf8');
const good={},tot={};
for(const line of txt.split('\n')){
  const m=line.match(/^\s*(\d+)\s*\|.*\|\s*(\d+)\/(\d+)/);
  if(m){good[+m[1]]=+m[2];tot[+m[1]]=+m[3];}
}
const secs=[['챕1~5',1,1,5],['챕6~9',1,6,9],['챕10',2,10,10],['챕11~20',1,11,20]];
let sum=0;
for(const [nm,pt,a,b] of secs){
  let g=0,t=0;
  for(let c=a;c<=b;c++){g+=good[c]||0;t+=tot[c]||0;}
  const sc=t?pt*g/t:0; sum+=sc;
  console.log(`${nm.padEnd(8)} 배점 ${pt} | 적합 ${String(g).padStart(3)}/${String(t).padStart(3)} | 소계 ${sc.toFixed(2)}`);
}
console.log(`실험3 합계: ${sum.toFixed(2)} / 5`);
