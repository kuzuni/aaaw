const eHpG=1.185, slotG=2.68, gg=1.22, scg=4.2, plusStep=0.12;
const L=Math.log;
const chPerSlot = L(slotG)/L(eHpG);              // 슬롯 1렙이 벌어주는 챕터 수
const dLdc      = L(gg)/L(scg);                  // 챕터당 획득 슬롯 레벨
const powPerCh  = Math.pow(slotG,dLdc);          // 챕터당 플레이어 파워 배수(슬롯만)
console.log('슬롯 1렙 = 챕터', chPerSlot.toFixed(3), '분');
console.log('챕터당 슬롯레벨 획득 dL/dc =', dLdc.toFixed(4), '→ 6챕터당', (dLdc*6).toFixed(3),'렙');
console.log('챕터당 파워 성장(슬롯) =', powPerCh.toFixed(4), ' vs 적 HP 성장', eHpG);
console.log('적자 배수/챕터 =', (eHpG/powPerCh).toFixed(4), ' → 100챕터 누적', Math.pow(eHpG/powPerCh,100).toExponential(2));
console.log('R07 자체 규칙 상한 slotCostG ≤ gg^'+chPerSlot.toFixed(2)+' =', Math.pow(gg,chPerSlot).toFixed(3), ' (현행 4.2 → 위반)');
console.log('현행 4.2 를 유지하려면 goldGrowth ≥', Math.pow(scg,1/chPerSlot).toFixed(4));
console.log('');
console.log('앵커가 강제하는 slotG: A(90,slot15)→B(300,slot50) = 35렙 / 210챕터 → slotG = eHpG^'+ (210/35) +' =', Math.pow(eHpG,6).toFixed(3), '(실제 2.68 ✓)');
console.log('');
console.log('-- 후보별 챕터당 파워 성장 --');
for(const g of [1.22,1.24,1.26,1.28]) for(const s of [3.2,3.4,3.6,3.8,4.0,4.2]){
  const p=Math.pow(slotG,L(g)/L(s));
  const m=p/eHpG;
  console.log(` gg=${g} scg=${s}: 파워/챕터 ${p.toFixed(4)}  적대비 ${m.toFixed(4)}  100챕터누적 ${Math.pow(m,100).toExponential(2)}`);
}
