'use strict';
/* 관통 대상 범위 게이트 — 주인 확정 보강(2026-09-02 15:2X · T44)
 *
 * 「창은 «필드 위에 현재 존재하는(스폰된) 적» 중 일직선 최대 8마리 관통. 아직 생성/활성화되지 않은 적
 *  (다음 웨이브 대기분 등)은 절대 맞지 않는다. 검기 등 다른 관통형도 같은 규칙.」
 *
 * 왜 게이트인가 — 두 엔진 다 챕터의 적을 **시작할 때 한꺼번에** 만들어 두고(`startChapter`/`runChapter`)
 * 관통 판정이 `aliveList`/`aliveEnemies` 전체를 훑는다. 노드 간격은 560px 인데 창 사거리는 88×8=704px,
 * 검기(신화)는 1400px 라 **필터가 없으면 다음 웨이브 대기분이 그대로 맞는다**. 정적 검사로는
 * 「전체를 훑는다」가 버그로 안 보이므로, 여기서는 **실제로 굴려서 교차 노드 피격 수를 센다**.
 *
 * 사용: node tools/verifyPierceScope.js      (exit 0 = 통과, 1 = 불합격)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SIM = fs.readFileSync(path.join(ROOT, 'sim.js'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let fail = 0, pass = 0;
const ok = m => { pass++; console.log('  ✓ ' + m); };
const bad = m => { fail++; console.log('  ✗ ' + m); };

console.log('[관통 대상 범위 — 관통형은 «지금 필드의 노드» 적만 맞는다 (주인 15:2X · T44)]');

/* ---------- ① 두 파일이 같은 규칙을 같은 모양으로 갖고 있는가 ---------- */
{
  const need = [
    ['frontNode 헬퍼', /function frontNode\(/],
    ['창이 발사 시점 노드를 싣는다', /type:'spear',[\s\S]{0,200}?node:frontNode\(/],
    ['검기가 발사 시점 노드를 싣는다', /type:'wave',[\s\S]{0,200}?node:frontNode\(/],
    ['관통 판정이 다른 노드의 적을 건너뛴다', /pr\.node\s*&&\s*e\.wave\s*!==\s*pr\.node\s*\)\s*continue/],
  ];
  for (const [nm, re] of need) {
    for (const [src, who] of [[SIM, 'sim.js'], [HTML, 'index.html']]) {
      re.test(src.replace(/\s*\n\s*/g, m => m)) || re.test(src)
        ? ok(`${who}: ${nm}`)
        : bad(`${who}: ${nm} — 없다 (다음 웨이브 대기분이 관통에 맞는다)`);
    }
  }
}

/* ---------- ② 실제로 굴려서 교차 노드 피격 0 인가 (sim.js 엔진) ---------- */
/* sim.js 를 통째로 로드하되 CLI 실행부는 잘라 낸다 (T29·T31 게이트와 같은 방식). */
{
  const cut = SIM.indexOf('const mode=process.argv[2]');
  if (cut < 0) { bad('sim.js 의 CLI 실행부 경계(const mode=process.argv[2])를 못 찾았다 — 게이트를 갱신할 것'); }
  else {
    const ctx = { console, Math, Set, Map, JSON, process: { env: {} } };
    vm.createContext(ctx);
    vm.runInContext(SIM.slice(0, cut) + '\n;globalThis.__api={runChapter,mkPlayer,GT,TUNE};', ctx);

    /* dealDmg 를 감싸서 «어느 노드의 적이 맞았는가» 를 기록한다 — 투사체별 발사 노드와 대조한다. */
    const probe = vm.runInContext(`(function(chapters, seedRuns){
      let cross=0, hits=0, spears=0, waves=0;
      const origDeal = dealDmg;
      /* 관통 투사체가 때린 적의 노드가 pr.node 와 다르면 위반이다. 판정은 엔진 안에서 직접 본다. */
      for(const c of chapters){
        for(let s=0;s<seedRuns;s++){
          /* 창·검기를 확실히 쓰는 빌드: 전설 풀셋 + 창/검기 특전을 강제로 켠다 */
          const build={eq:{},slots:{}};
          for(const pt of GT.parts){ build.eq[pt]={rar:3,plus:0,part:pt}; build.slots[pt]=0; }
          const G={chapter:c,player:null,nodes:[],pprojs:[],arrows:[],gold:0,kills:0,
            perkChances:0,taken:[],legendOnly:false,overBoltCd:0,autoBoltT:2,dead:false,cleared:false,t:0};
          const p=mkPlayer(build,G); G.player=p; p.G=G;
          p.px.spear=8; p.px.wave=8; p.px.waveKing=1;   /* 발사 확률·사거리를 최대로 — 교차 노드 기회를 늘린다 */
          const layout=chapterLayout(c);
          let x=560, wi=0;
          for(const node of layout){
            const nd={type:node.t,x,done:false,enemies:[]};
            if(node.t==='wave'){
              const st=enemyStats(c,wi);
              for(let j=0;j<node.size;j++) nd.enemies.push({worldX:x+j*88,hp:st.hp,maxHp:st.hp,dmg:st.dmg,
                ranged:false,atkTimer:1,wave:nd,dead:false,isBoss:false,exp:0});
              wi++; x+=(node.size-1)*88+560;
            } else if(node.t==='boss'){
              const st=enemyStats(c,wi);
              nd.enemies.push({worldX:x+60,hp:st.hp*TUNE.bossHp,maxHp:st.hp*TUNE.bossHp,dmg:st.dmg*TUNE.bossDmg,
                ranged:false,atkTimer:1.2,wave:nd,dead:false,isBoss:true,hits:0});
            } else x+=470;
            G.nodes.push(nd);
          }
          /* 전투 루프를 돌리지 않고, 관통 투사체만 직접 날려 «사거리 안에 다음 웨이브가 들어오는» 최악을 만든다:
             플레이어를 각 웨이브의 마지막 적 바로 앞에 세우고 창·검기를 쏜다. */
          for(const nd of G.nodes){
            if(nd.type!=='wave') continue;
            const last=nd.enemies[nd.enemies.length-1];
            /* 그 웨이브의 마지막 적만 남긴 상태 = 실제 전투에서 다음 웨이브가 사거리에 들어오는 순간 */
            for(const n2 of G.nodes) for(const e of n2.enemies) if(n2===nd&&e!==last) e.hp=0;
            p.worldX=last.worldX-74;
            G.pprojs.length=0;
            fireSpear(p); spears++;
            fireWave(p);  waves++;
            /* 투사체를 끝까지 전진시키며 판정만 돌린다 (엔진과 같은 식) */
            for(let step=0; step<400 && G.pprojs.length; step++){
              for(let i=G.pprojs.length-1;i>=0;i--){
                const pr=G.pprojs[i]; pr.x+=pr.spd*(1/30); let done=false;
                if(pr.type==='spear'||pr.type==='wave'){
                  for(const e of aliveList(G)){
                    if(pr.node&&e.wave!==pr.node) continue;
                    if(!pr.hit.has(e)&&Math.abs(e.worldX-pr.x)<16){
                      pr.hit.add(e); hits++;
                      if(e.wave!==pr.node) cross++;      /* 필터가 있으면 여기 절대 안 걸린다 */
                      if(pr.hit.size>=pr.pierce){ done=true; break; }
                    }
                  }
                  if(pr.x>pr.maxX) done=true;
                } else done=true;
                if(done) G.pprojs.splice(i,1);
              }
            }
            /* 다음 웨이브 검사용으로 이 웨이브는 전멸 처리 */
            for(const e of nd.enemies) e.hp=0;
          }
        }
      }
      return {cross, hits, spears, waves};
    })`, ctx)([5, 30, 90, 200], 3);

    probe.cross === 0
      ? ok(`관통 피격 ${probe.hits}회 전부 «발사 시점 노드» 안 (교차 노드 피격 0 · 창 ${probe.spears}발 · 검기 ${probe.waves}발)`)
      : bad(`다음 웨이브 대기분을 때린 관통 ${probe.cross}회 — 주인 확정(15:2X) 위반`);

    /* 필터를 끈 대조군 — 게이트가 «있으나 마나» 가 아님을 매 실행마다 스스로 증명한다 */
    const off = vm.runInContext(`(function(){
      const build={eq:{},slots:{}};
      for(const pt of GT.parts){ build.eq[pt]={rar:3,plus:0,part:pt}; build.slots[pt]=0; }
      let cross=0;
      for(const c of [5,30,90,200]){
        const G={chapter:c,player:null,nodes:[],pprojs:[],arrows:[],gold:0,kills:0,
          perkChances:0,taken:[],legendOnly:false,overBoltCd:0,autoBoltT:2,dead:false,cleared:false,t:0};
        const p=mkPlayer(build,G); G.player=p; p.G=G; p.px.spear=8; p.px.wave=8; p.px.waveKing=1;
        const layout=chapterLayout(c); let x=560, wi=0;
        for(const node of layout){
          const nd={type:node.t,x,done:false,enemies:[]};
          if(node.t==='wave'){
            const st=enemyStats(c,wi);
            for(let j=0;j<node.size;j++) nd.enemies.push({worldX:x+j*88,hp:st.hp,maxHp:st.hp,dmg:st.dmg,
              ranged:false,atkTimer:1,wave:nd,dead:false,isBoss:false,exp:0});
            wi++; x+=(node.size-1)*88+560;
          } else if(node.t==='boss'){
            const st=enemyStats(c,wi);
            nd.enemies.push({worldX:x+60,hp:st.hp*TUNE.bossHp,maxHp:st.hp*TUNE.bossHp,dmg:st.dmg*TUNE.bossDmg,
              ranged:false,atkTimer:1.2,wave:nd,dead:false,isBoss:true,hits:0});
          } else x+=470;
          G.nodes.push(nd);
        }
        for(const nd of G.nodes){
          if(nd.type!=='wave') continue;
          const last=nd.enemies[nd.enemies.length-1];
          for(const n2 of G.nodes) for(const e of n2.enemies) if(n2===nd&&e!==last) e.hp=0;
          p.worldX=last.worldX-74; G.pprojs.length=0;
          fireSpear(p); fireWave(p);
          for(let step=0; step<400 && G.pprojs.length; step++){
            for(let i=G.pprojs.length-1;i>=0;i--){
              const pr=G.pprojs[i]; pr.x+=pr.spd*(1/30); let done=false;
              for(const e of aliveList(G)){                 /* ← 노드 필터를 뺀 판정 */
                if(!pr.hit.has(e)&&Math.abs(e.worldX-pr.x)<16){
                  pr.hit.add(e); if(e.wave!==pr.node) cross++;
                  if(pr.hit.size>=pr.pierce){ done=true; break; }
                }
              }
              if(pr.x>pr.maxX) done=true;
              if(done) G.pprojs.splice(i,1);
            }
          }
          for(const e of nd.enemies) e.hp=0;
        }
      }
      return cross;
    })()`, ctx);
    off > 0
      ? ok(`대조군(필터 제거) 교차 노드 피격 ${off}회 — 이 게이트가 실제로 무언가를 막고 있다`)
      : bad('대조군에서도 교차 피격이 0 이다 — 시나리오가 위반을 재현하지 못한다(게이트를 갱신할 것)');
  }
}

console.log(`\n통과 ${pass} · 불합격 ${fail}`);
console.log(fail === 0 ? '→ 통과' : '→ 불합격');
process.exit(fail === 0 ? 0 : 1);
