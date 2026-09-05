/* T3 동작 검증 — 전투 진입·레벨업 특전 3택·⚑버프 아이콘 표시/소멸·⚑특전 미리보기 줄·보스킬 특전 스킵
 *
 * 사용: node tools/t3/battle.js          (exit 0 = 통과, 1 = 불합격)
 * 전제: playwright-core 가 있어야 한다. **리포에 커밋하지 말 것**(ROUTINE §1 대용량 바이너리 금지) —
 *       스크래치패드에 `npm i playwright-core` 로 깔고 `PW_CORE=<경로>/node_modules/playwright-core` 로 넘긴다.
 *       크로미움은 환경에 미리 깔린 /opt/pw-browsers 를 쓴다(PW_CHROME 으로 덮어쓸 수 있다).
 * 스크린샷은 OUT(기본 /tmp)에만 떨어뜨린다 — 캡처 PNG 커밋 금지.
 */
const path = require('path');
const fs = require('fs');
let chromium;
try { ({ chromium } = require(process.env.PW_CORE || 'playwright-core')); }
catch (e) {
  console.error('playwright-core 를 찾지 못했다. 스크래치패드에 설치한 뒤 PW_CORE=<경로> 로 지정할 것 (리포에 커밋 금지).');
  process.exit(2);
}
const EXE = process.env.PW_CHROME || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(f => fs.existsSync(f));
const URL = 'file://' + path.join(__dirname, '..', '..', 'index.html');
const OUT = process.env.T3_OUT || require('os').tmpdir();

const R = [];
const drain = async (p) => {   /* 전투 중 뜬 레벨업 팝업을 비운다 — 열려 있으면 게임이 멈춰 버프 타이머도 안 흐른다 */
  for (let i = 0; i < 8; i++) {
    const n = await p.evaluate(() => document.querySelectorAll('.perk-card.pick').length);
    if (!n) break;
    await p.click('#perkPick0'); await p.waitForTimeout(350);
  }
  await p.evaluate(() => { if (document.getElementById('overlay').classList.contains('on')) closeOverlay(); });
  await p.waitForTimeout(250);
};
/* ⚑ T52 — 레벨업·이벤트 팝업을 «더 안 뜰 때까지» 비운다. 팝업이 열려 있으면 G.paused 로 게임이 멈추므로
   비우지 않은 채 폴링에 들어가면 «기다리면 일어날 일» 이 영영 안 일어난다.
   클리어·사망 화면(#clOk/#deOk)은 누르면 로비로 나가 버리므로 건드리지 않고 그 사실을 알린다. */
const drainAll = async (p, max = 16) => {
  let n = 0;
  for (let i = 0; i < max; i++) {
    const st = await p.evaluate(() => ({
      cards: document.querySelectorAll('.perk-card.pick').length,
      choice: document.querySelectorAll('#overlay .choice-btn').length,
      exit: !!document.getElementById('clOk') || !!document.getElementById('deOk'),
      on: document.getElementById('overlay').classList.contains('on'),
    }));
    if (st.exit) return n;
    if (st.cards) { await p.click('#perkPick0'); n++; }
    else if (st.choice) { await p.click('#overlay .choice-btn'); n++; }
    else if (st.on) { await p.evaluate(() => closeOverlay()); n++; }
    else return n;
    await p.waitForTimeout(280);
  }
  return n;
};
const chk = (n, c, d) => { R.push({ n, c, d }); console.log(`  ${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); };

(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(URL); await p.waitForTimeout(600);

  /* ---------- 전투 진입 ---------- */
  console.log('\n=== 전투 진입 · 레벨업 특전 순서 획득 ===');
  await p.click('#startBtn'); await p.waitForTimeout(500);
  const enter = await p.evaluate(() => ({
    screen: document.querySelector('.screen.on')?.id,
    nodes: G.nodes.map(n => n.type).join('>'),
    total: G.totalEnemies,
    hud: !!document.getElementById('stats').children.length,
    hp: Math.round(G.player.hp), sh: Math.round(G.player.sh), dmg: Math.round(G.player.dmg),
  }));
  chk('전투 화면 전환', enter.screen === 'game', enter.screen);
  chk('챕터 레이아웃 생성 (악마1·천사1·쉼터·보스)', /devil/.test(enter.nodes) && /angel/.test(enter.nodes) && /rest/.test(enter.nodes) && /boss$/.test(enter.nodes), enter.nodes);
  chk('스탯 그리드 렌더', enter.hud, `적 ${enter.total}마리`);
  chk('노템 기본치 (공25·체150·실250 — 주인 확정)', enter.dmg === 25 && enter.hp === 150 && enter.sh === 250, `공${enter.dmg}/체${enter.hp}/실${enter.sh}`);

  /* 레벨업까지 자동 전투 */
  await p.waitForFunction(() => document.querySelectorAll('.perk-card').length > 0, null, { timeout: 30000 });
  const pick = await p.evaluate(() => {
    const cards = [...document.querySelectorAll('.perk-card')];
    return {
      n: cards.length, tags: cards.map(c => c.querySelector('.tag')?.textContent),
      tx: cards.map(c => c.querySelector('.tx').textContent),
      medal: cards.map(c => getComputedStyle(c.querySelector('.ic')).clipPath !== 'none'),
      pcs: cards.map(c => getComputedStyle(c).borderTopColor),
      taken: G.perksTaken.map(x => x.id), first: PERKS[0].id, ok: !!document.getElementById('perkPick0'),
      pickable: document.querySelectorAll('#overlay .perk-card.pick[data-i]').length,
    };
  });
  /* ⚑⚑⚑ T117 (주인 확정 2026-09-04 12:3X) — 3택 선택창이 돌아왔다. 레벨업하면 «남은 풀에서 무작위 3장» 이
     뜨고 **고르기 전에는 아무것도 안 받는다**(순서 지급 시절엔 팝업이 뜨는 순간 이미 받은 상태였다). */
  chk('⚑ T117 레벨업 = 고를 수 있는 특전 카드 3장', pick.n === 3 && pick.pickable === 3,
    `카드 ${pick.n}장 · 고를 수 있는 카드 ${pick.pickable}장`);
  chk('⚑ T117 고르기 «전» 에는 아직 아무것도 안 받았다', pick.taken.length === 0, `보유 ${pick.taken.join(',') || '0종'}`);
  chk('⚑ T117 세 장이 서로 다르다 (같은 카드 안 중복 금지)', new Set(pick.tx).size === 3, pick.tags.join(','));
  /* ⚑⚑⚑ T119 — 카드 태그가 «획득 순번» 에서 **등급 이름**으로 돌아왔고 테두리가 등급색이다 */
  chk('⚑ T119 카드 태그가 등급 이름(일반/희귀/전설)이다',
    pick.tags.every(t => ['일반', '희귀', '전설'].includes(t)), pick.tags.join(','));
  chk('⚑ T119 카드 테두리색이 등급색 3종 중 하나다 (일반 회색 · 희귀 파랑 · 전설 금색)',
    pick.pcs.every(c => ['rgb(158, 163, 172)', 'rgb(79, 163, 247)', 'rgb(255, 185, 46)'].includes(c)),
    pick.pcs.join(' / '));
  /* ⚑⚑⚑ T151 (주인 확정 2026-09-05 17:5X) — «3개 다 일반 혹은 희귀 혹은 전설로만 떠야 함. 섞어 뜨지 말고».
     등급을 레벨업마다 1회만 굴리므로 화면의 3장은 태그도 테두리색도 하나여야 한다. */
  chk('⚑⚑⚑ T151 화면의 3장이 전부 같은 등급 태그다 (섞이지 않는다)',
    new Set(pick.tags).size === 1, pick.tags.join(','));
  chk('⚑⚑⚑ T151 화면의 3장이 전부 같은 테두리색이다 (등급색 1종)',
    new Set(pick.pcs).size === 1, pick.pcs.join(' / '));
  chk('특전 아이콘이 메달리온 구도', pick.medal.every(Boolean));

  /* ⚑ T96 — «(고유)» 표기 검사는 폐지. 특전이 10종·순서 획득이라 중복이 구조적으로 불가능하고
     `u` 플래그 자체가 사라졌다. 대신 «표시 텍스트가 두 엔진·PLAN 과 같은가» 는 정적 게이트가 본다. */
  /* ---------- ⚑ 팝업 열림 중 게임 시간 완전 정지 (T79 · 주인 확정 2026-09-03 불변 규약) ----------
     정적 게이트(verifyT2 ㊴)는 «G.paused 로 update 를 막는가» 를 보지만, «실제로 아무것도 안 흐르는가» 는
     여기서만 확인된다. 지금 레벨업 팝업이 떠 있으므로 그대로 재 두고 상태가 얼어붙는지 본다.
     (쉼터 무한 대기로 회복·쿨다운을 공짜로 버는 악용을 원천 차단하는 규약이다) */
  console.log('\n=== ⚑ 팝업 중 게임 시간 정지 (T79) ===');
  const snap = () => p.evaluate(() => ({
    paused: G.paused, t: +G.t.toFixed(4),
    hp: +G.player.hp.toFixed(4), sh: +G.player.sh.toFixed(4),
    atkT: +G.player.atkTimer.toFixed(4), boltT: +G.autoBoltT.toFixed(4),
    ex: G.nodes.flatMap(n => (n.enemies || [])).map(e => `${e.worldX.toFixed(2)}:${e.hp.toFixed(2)}`).join(','),
    frames: (window.__t3frames = (window.__t3frames || 0)),
  }));
  const froze0 = await snap();
  await p.evaluate(() => { window.__t3frames = 0; const tick = () => { window.__t3frames++; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await p.waitForTimeout(800);
  const froze1 = await snap();
  chk('팝업이 뜨면 G.paused = true', froze0.paused === true, `paused=${froze0.paused}`);
  chk('그 사이 화면은 계속 돈다 (프레임이 흘렀다 = 관측이 유효하다)', froze1.frames >= 10, `${froze1.frames} 프레임`);
  chk('⚑ 게임 시계 G.t 가 한 틱도 안 흐른다', froze0.t === froze1.t, `t ${froze0.t} → ${froze1.t}`);
  chk('⚑ 체력·실드가 안 변한다 (쉼터 무한 대기 악용 차단)',
    froze0.hp === froze1.hp && froze0.sh === froze1.sh, `hp ${froze0.hp}→${froze1.hp} · sh ${froze0.sh}→${froze1.sh}`);
  chk('⚑ 쿨다운(공격 타이머·뇌신 주기)이 안 줄어든다',
    froze0.atkT === froze1.atkT && froze0.boltT === froze1.boltT, `atkT ${froze0.atkT}→${froze1.atkT} · boltT ${froze0.boltT}→${froze1.boltT}`);
  chk('⚑ 적이 한 걸음도 안 움직인다', froze0.ex === froze1.ex, `적 ${froze0.ex.split(',').length}마리`);

  await p.click('#perkPick0'); await p.waitForTimeout(300);
  const resumed = await p.evaluate(async () => {
    const t0 = G.t; await new Promise(r => setTimeout(r, 400)); return { paused: G.paused, moved: G.t > t0, t0, t1: G.t };
  });
  chk('⚑ 팝업을 닫으면 시간이 다시 흐른다', resumed.paused === false && resumed.moved,
    `paused=${resumed.paused} · t ${resumed.t0.toFixed(2)}→${resumed.t1.toFixed(2)}`);

  const strip1 = await p.evaluate(() => ({ chips: document.querySelectorAll('#perkStrip .pv-ic').length, taken: G.perksTaken.length }));
  chk('⚑ 특전 미리보기 줄에 칩이 쌓인다', strip1.chips === 1 && strip1.taken === 1, `칩 ${strip1.chips} / 획득 ${strip1.taken}`);


  /* ---------- ⚑ 버프 아이콘 표시/소멸 (주인 지시 07:0X) ---------- */
  console.log('\n=== ⚑ 발동 중 버프 아이콘 (#buffBar) ===');
  await drain(p);
  const buffOn = await p.evaluate(() => {
    /* ⚑ T52 수리 — 관측 창을 조용하게 만든다. 보스 외 적을 치워 경험치 공급원을 없애면
       관측 도중 새 레벨업(→ 새 특전 → 새 버프)이 끼어들지 못한다. 종전에는 그 난입 때문에
       «지속시간이 끝나면 아이콘이 사라진다» 가 ①팝업 정지로 버프 타이머가 멈추거나
       ②새 버프가 계속 들어와 버프바가 안 비거나 두 경로로 흔들렸다.
       기존 버프도 비우고 시작해 이 절이 «자기가 넣은 버프» 만 보게 한다. */
    for (const n of G.nodes) { if (n.type !== 'boss') { n.enemies.forEach(e => { e.dead = true; e.hp = 0; }); n.done = true; } }
    G.player.hp = 1e6; G.player.sh = 1e6;                 /* 보스에게 맞아 죽어 관측이 끊기지 않게 */
    for (const k in G.player.buffs) G.player.buffs[k].length = 0;
    /* 실제 특전이 주는 시간제 버프와 같은 경로로 넣는다 — src 는 그 특전을 가리키는 px 키 */
    /* 버프 아이콘이 «어느 특전의 버프인가» 를 알려면 px 키를 올리는 특전이 있어야 한다.
       고른 특전이 순수 스탯형이면 G.pxPerk 가 비므로, 정상 경로(takePerk)로 하나 더 얻는다. */
    let key = Object.keys(G.pxPerk)[0] || null;
    for (let i = 0; !key && i < PERKS.length; i++) { pickPerk(PERKS[i]); key = Object.keys(G.pxPerk)[0] || null; }
    const perk = key ? G.pxPerk[key] : G.perksTaken[0];
    addBuff(G.player, 'atk', 0.2, 4, key);
    addBuff(G.player, 'atk', 0.2, 4, key);   /* 같은 출처 2중첩 → 개수 뱃지 */
    addBuff(G.player, 'aspd', 0.15, 4, null); /* 출처 불명 → 스탯 폴백 아이콘 */
    const ics = [...document.querySelectorAll('#buffBar .buff-ic:not(.ward-ic)')];   /* 방어막 뱃지는 시간제 버프가 아니라 제외 (T48) */
    const hud = document.getElementById('chapHud').getBoundingClientRect();
    const bar = document.getElementById('buffBar').getBoundingClientRect();
    return {
      n: ics.length,
      cnt: ics.map(e => e.querySelector('.cnt')?.textContent || ''),
      border: ics.map(e => getComputedStyle(e).borderColor),
      svgFallback: ics.filter(e => e.querySelector('svg.gicon')).length,
      overlap: !(bar.top >= hud.bottom - 0.5),
      hudBottom: Math.round(hud.bottom), barTop: Math.round(bar.top),
      perkName: perk ? perk.id : '-', key, pxn: Object.keys(G.pxPerk).length,
      /* ⚑⚑⚑ T119 — 등급이 부활해 기대 테두리색은 «그 특전의 등급색» 이다(T96~T118 은 한 색 PERK_COLOR 였다).
         일반 등급색(#9EA3AC)은 «출처 없음» 폴백색과 같은 값이라 «회색이 아니다» 로는 판정할 수 없어,
         등급에서 기대색을 만들어 비교한다. */
      wantCC: perk ? perkColor(perk) : null, wantRar: perk ? PERK_GRADE_NAME[perk.g] : '-',
    };
  });
  chk('버프 발동 시 아이콘이 뜬다', buffOn.n === 2, `아이콘 ${buffOn.n}개(같은 출처 2중첩은 1칸)`);
  chk('중첩 2 이상이면 개수 뱃지', buffOn.cnt.some(c => +c >= 2), `뱃지 ${buffOn.cnt.join('|')} (같은 출처 중첩 수)`);
  const hex2rgb = h => { const n = parseInt(h.slice(1), 16); return `rgb(${n >> 16 & 255}, ${n >> 8 & 255}, ${n & 255})`; };
  chk('출처 특전 색 테두리', buffOn.wantCC ? buffOn.border.includes(hex2rgb(buffOn.wantCC)) : false,
    `${buffOn.border.join(' / ')} ← 기대 ${buffOn.wantCC ? hex2rgb(buffOn.wantCC) : '?'} (${buffOn.wantRar} · ${buffOn.perkName})`);
  chk('출처 불명 버프는 스탯 SVG 폴백 (7단계)', buffOn.svgFallback >= 1, `SVG 폴백 ${buffOn.svgFallback}개`);
  chk('버프바가 챕터 표시와 겹치지 않는다', !buffOn.overlap, `chapHud.bottom ${buffOn.hudBottom} ≤ buffBar.top ${buffOn.barTop}`);
  await p.screenshot({ path: `${OUT}/t3-buffbar.png` });

  /* 만료 대기 — 버프는 «게임이 흐를 때만» 준다(오버레이가 열리면 G.paused 로 정지하는 것이 정상이다).
     그래서 기다리는 동안 뜨는 레벨업 팝업을 계속 비워 가며 본다.
     ⚑ T48 정정: 종전엔 «버프바가 통째로 빈다» 로 봤는데, T48 이 상시 발동형 버프원을 여럿 늘리면서
     (빗나갈 시 공격력/방어력/공속 버프 — 적 회피 10% 라 전투 중엔 거의 항상 하나는 살아 있다)
     그 기대 자체가 성립하지 않게 됐다. 검사의 «의도» 는 «지속시간이 끝난 버프가 사라지는가» 이므로
     이 테스트가 직접 넣은 버프(src = key 인 atk 버프 2개)만 추적한다 — 의도는 그대로, 조건만 정확해졌다.
     횟수형 방어막 뱃지(.ward-ic)는 시간제 버프가 아니라 애초에 대상이 아니다.
     ⚑ T52 수리(위 T48 targeting 유지 + 예산 계산 교체): «폴링 40회» 라는 벽시계 예산을 «진척» 으로 바꿨다.
     그 사이 뜬 팝업이 게임을 멈추면 버프 타이머도 같이 멈추므로, 정지 시간이 길어지면
     «4초짜리 버프가 안 사라졌다» 로 빨개졌다 — 엔진이 아니라 예산 계산이 틀린 것이다.
     벽시계로 «얼마나 돌았나» 를 추정하는 것도 부정확하다(250ms 창 안에서 팝업이 열리고 닫힌다).
     그래서 엔진이 들고 있는 «추적 버프의 남은 시간»(b.t) 을 직접 읽어 판정한다:
       · 남은 시간이 줄고 있으면 계속 기다린다 — 팝업으로 아무리 오래 멈춰 있어도 빨개지지 않는다.
       · 게임이 도는데도 남은 시간이 안 줄면(stall) 그건 진짜 결함이라 즉시 끊는다. */
  let gone = false, tPrev = Infinity, stall = 0, polls = 0, tLast = -1;
  for (let i = 0; i < 240; i++) {
    const st = await p.evaluate((k) => {
      const mine = G.player.buffs.atk.filter(b => b.src === k);
      return {
        n: mine.length, left: mine.reduce((m, b) => Math.max(m, b.t), 0),
        icons: document.querySelectorAll('#buffBar .buff-ic:not(.ward-ic)').length,
        cards: document.querySelectorAll('.perk-card.pick').length,
        choice: document.querySelectorAll('#overlay .choice-btn').length, paused: !!(G && G.paused) };
    }, buffOn.key);
    if (st.n === 0) { gone = true; tLast = 0; break; }
    tLast = st.left; polls++;
    if (st.cards) { await p.click('#perkPick0'); await p.waitForTimeout(250); continue; }
    /* 쉼터·악마·천사 이벤트 팝업이 뜨면 그것도 게임을 멈춘다 — 아무 선택지나 눌러 진행시킨다 */
    else if (st.choice) { await p.click('#overlay .choice-btn'); await p.waitForTimeout(250); continue; }
    if (st.left < tPrev - 1e-9) { tPrev = st.left; stall = 0; } else if (!st.paused) stall++;
    if (stall >= 12) break;                    /* 게임이 도는데 3초 넘게 남은 시간이 안 줄었다 = 진짜 결함 */
    await p.waitForTimeout(250);
  }
  chk('지속시간이 끝나면 아이콘이 사라진다', gone,
    `추적 버프 남은 시간 ${tLast.toFixed(2)}초 · 폴링 ${polls}회 · 정지 무관(엔진 b.t 로 진척 판정) · stall ${stall}`);

  /* ---------- ⚑ 특전 미리보기 줄 — 누적·중복·«+N» ---------- */
  console.log('\n=== ⚑ 얻은 특전 미리보기 줄 (#perkStrip) ===');
  await drain(p);
  const strip2 = await p.evaluate(() => {
    /* ⚑ T52 수리 — 이 절이 보는 것은 «중복 3회 → 칩 1개 + 뱃지 3» 하나뿐인데, 여기까지 오는 동안
       레벨업이 몇 번 났는지는 타이밍에 달려 있었다. 이미 칩이 접힐 만큼 쌓여 있으면 «칩 수 = 서로 다른 특전 수»
       가 성립하지 않아 빨개졌다(관측: 칩 7 vs 서로 다른 특전 26 — 엔진이 아니라 전제가 틀린 것이다).
       세는 대상을 고정하려고 획득 목록을 «서로 다른 특전 2종» 으로 정규화하고 시작한다. */
    const keep = new Map();
    for (const q of G.perksTaken) { const k = q.id || q.tx; if (!keep.has(k)) keep.set(k, q); if (keep.size >= 2) break; }
    G.perksTaken = [...keep.values()];
    renderPerkStrip();
    const same = G.perksTaken[0];
    pickPerk(same); pickPerk(same);            /* 같은 특전 3번 → 개수 뱃지 3 */
    /* 같은 특전이 3번이면 칩은 «그 특전 1개 + 뱃지 3» 이어야 한다 (전체 칩 수 = 서로 다른 특전 수) */
    const distinct = new Set(G.perksTaken.map(x => x.id || x.tx)).size;
    const chips0 = [...document.querySelectorAll('#perkStrip .pv-ic')];
    const before = chips0.length;
    const badge = chips0.map(c => c.querySelector('.cnt')?.textContent).find(t => t === '3');
    /* 넘치게 — ⚑ T52: 이미 가진 특전을 채우면 칩이 새로 늘지 않고 «최신 칩» 도 뒤로 안 간다.
       아직 안 가진 것만 골라야 «접힌 뒤에도 최신 특전이 보인다» 가 결정적이다. */
    /* ⚑ T96 — PERKS 가 10종뿐이라 «접힘» 을 내려면 합성 획득물이 필요하다.
       천사의 축복처럼 PERKS 밖의 항목도 미리보기 줄에 그대로 쌓이므로 그 경로로 채운다. */
    const had = new Set(G.perksTaken.map(x => x.id || x.tx));
    for (const q of PERKS.filter(x => !had.has(x.id || x.tx))) pickPerk(q);
    for (let i = 0; i < 14; i++) { G.perksTaken.push({ ic: '✨', tx: `합성 획득물 ${i}` }); }
    renderPerkStrip();
    const chips = [...document.querySelectorAll('#perkStrip .pv-ic')];
    const more = document.querySelector('#perkStrip .pv-more')?.textContent || '';
    const box = document.getElementById('perkStrip').getBoundingClientRect();
    const foot = document.getElementById('hudFoot').getBoundingClientRect();
    const info = document.getElementById('infoBtn').getBoundingClientRect();
    const last = G.perksTaken[G.perksTaken.length - 1];
    return {
      before, badge, distinct, chips: chips.length, more,
      overflow: chips.some(c => c.getBoundingClientRect().right > box.right + 1),
      left: Math.round(box.left), footLeft: Math.round(foot.left),
      hitInfo: box.right > info.left + 1,
      lastShown: chips.length ? chips[chips.length - 1].textContent.replace(/\d+$/, '') === last.ic : false,
      lastIc: last.ic,
    };
  });
  chk('중복 획득은 칩 1개 + 개수 뱃지', strip2.before === strip2.distinct && strip2.badge === '3',
    `칩 ${strip2.before} = 서로 다른 특전 ${strip2.distinct} · 3중복 뱃지 ${strip2.badge}`);
  chk('많이 얻으면 «+N» 으로 접힌다', /^\+\d+$/.test(strip2.more), strip2.more);
  chk('접힌 뒤에도 최신 특전이 보인다', strip2.lastShown, `마지막 ${strip2.lastIc}`);
  chk('줄이 자기 폭을 넘지 않는다', !strip2.overflow, `칩 ${strip2.chips}개`);
  chk('줄이 Info 행 왼쪽 끝에서 시작한다', Math.abs(strip2.left - strip2.footLeft) <= 1, `strip.left ${strip2.left} / hudFoot.left ${strip2.footLeft}`);
  chk('Info 버튼을 침범하지 않는다', !strip2.hitInfo);
  await p.screenshot({ path: `${OUT}/t3-perkstrip.png` });

  /* 360px 좁은 폭에서도 안 넘치나 */
  await p.setViewportSize({ width: 360, height: 800 }); await p.waitForTimeout(400);
  const narrow = await p.evaluate(() => {
    renderPerkStrip();
    const box = document.getElementById('perkStrip').getBoundingClientRect();
    const chips = [...document.querySelectorAll('#perkStrip .pv-ic,#perkStrip .pv-more')];
    const info = document.getElementById('infoBtn').getBoundingClientRect();
    return { over: chips.some(c => c.getBoundingClientRect().right > box.right + 1), n: chips.length, hitInfo: box.right > info.left + 1 };
  });
  chk('좁은 폭(360px)에서도 줄이 안 넘친다', !narrow.over && !narrow.hitInfo, `칩 ${narrow.n}개`);
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);

  /* ---------- ⚑ T89 «보유 특전» 버튼 (주인 지시 2026-09-03 · T96 이관 · ⚑ T117 로 원래 쓰임 복귀) ----------
     ⚑ T117 로 3택 선택창이 돌아와 «고르기 전에 내가 뭘 갖고 있나 확인» 이라는 원래 쓰임을 되찾았다.
     여기서 보는 것은 ①버튼이 오른쪽 하단에 있고 ②카드와 안 겹치고 ③목록이 열린 동안에도 시간이
     멈춰 있고 ④닫으면 **선택지가 그대로인 같은 팝업**으로 돌아오는지다(재굴림 = 무료 새로고침 금지). */
  console.log('\n=== ⚑ 레벨업 팝업 «보유 특전» 버튼 (T89 · T96 이관) ===');
  await drainAll(p);
  const bk0 = await p.evaluate(() => {
    /* ⚑ T119 — 풀(32)이 한 런 상한(PERK_PICKS 10)보다 커졌다. 앞 절이 32종을 전부 밀어 넣어 뒀으므로
       그대로 열면 **상한에 걸려** 팝업이 안 뜬다(hasPerkLeft = false). 상한 아래로 줄여 3장이 뜨게 만든다.
       (앞 절이 같은 특전을 여러 번 밀어 넣어 뒀으므로 «중복까지 포함해» 다시 만든다) */
    G.perksTaken = [PERKS.slice(0, 3), G.perksTaken.filter(x => !PERKS.includes(x))].flat();
    renderPerkStrip();
    openLevelUp();
    const btn = document.getElementById('perkBookBtn');
    const cards = [...document.querySelectorAll('.perk-card')];
    const inner = document.querySelector('.ov-inner').getBoundingClientRect();
    const r = btn && btn.getBoundingClientRect();
    const hit = (a, b) => !(a.right <= b.left + .5 || a.left >= b.right - .5 || a.bottom <= b.top + .5 || a.top >= b.bottom - .5);
    return {
      has: !!btn, txt: btn ? btn.textContent.replace(/\s+/g, ' ').trim() : '', taken: G.perksTaken.length,
      cards: cards.map(c => c.querySelector('.tx').textContent), paused: G.paused,
      right: r ? Math.round(inner.right - r.right) : -1, left: r ? Math.round(r.left - inner.left) : -1,
      below: r && cards.length ? r.top >= cards[cards.length - 1].getBoundingClientRect().bottom - .5 : false,
      overlapCard: r ? cards.some(c => hit(r, c.getBoundingClientRect())) : true,
    };
  });
  chk('레벨업 팝업에 📘 «보유 특전» 버튼이 뜬다', bk0.has && /보유 특전/.test(bk0.txt), bk0.txt);
  chk('오른쪽 하단 — 오른쪽 끝에 붙고 카드보다 아래', bk0.has && bk0.right < bk0.left && bk0.below,
    `오른쪽 여백 ${bk0.right}px / 왼쪽 여백 ${bk0.left}px · 카드 아래 ${bk0.below}`);
  chk('카드와 겹치지 않는다 (주인 지시)', !bk0.overlapCard);
  chk('버튼이 보유 특전 개수를 함께 보여준다', bk0.txt.includes(String(bk0.taken)), `보유 ${bk0.taken}종`);
  await p.click('#perkBookBtn'); await p.waitForTimeout(260);
  const bk1 = await p.evaluate(async () => {
    const t0 = G.t, hp0 = G.player.hp;
    await new Promise(r => setTimeout(r, 420));
    return {
      paused: G.paused, on: document.getElementById('overlay').classList.contains('on'),
      list: document.querySelectorAll('.perk-list .perk-card').length, taken: G.perksTaken.length,
      back: !!document.getElementById('pbBack'), choiceGone: !document.getElementById('perkPick0'),
      frozen: G.t === t0 && G.player.hp === hp0, t0, t1: G.t,
    };
  });
  chk('누르면 보유 특전 목록이 뜬다', bk1.on && bk1.list === bk1.taken && bk1.choiceGone,
    `목록 ${bk1.list}장 / 보유 ${bk1.taken}종`);
  chk('돌아가기 버튼이 있다 (탭으로 닫혀 특전을 날리지 않는다)', bk1.back);
  chk('⚑ 목록이 열린 동안에도 시간 정지 유지 (T79 규약)', bk1.paused === true && bk1.frozen,
    `paused=${bk1.paused} · t ${bk1.t0.toFixed(3)}→${bk1.t1.toFixed(3)}`);
  await p.click('#pbBack'); await p.waitForTimeout(260);
  const bk2 = await p.evaluate(() => ({
    cards: [...document.querySelectorAll('.perk-card')].map(c => c.querySelector('.tx').textContent),
    ok: !!document.getElementById('perkPick0'), paused: G.paused,
    book: !!document.getElementById('pbBack'), btn: !!document.getElementById('perkBookBtn'),
    taken: G.perksTaken.length,
  }));
  chk('닫으면 레벨업 팝업으로 복귀한다', bk2.ok && bk2.btn && !bk2.book && bk2.paused === true);
  chk('⚑ 복귀해도 같은 특전 카드다 (두 번 주지 않는다)',
    bk2.cards.length === bk0.cards.length && bk2.cards.every((t, i) => t === bk0.cards[i]) && bk2.taken === bk0.taken,
    `${bk0.cards.length}장 · 보유 ${bk0.taken} → ${bk2.taken} · 카드 ${JSON.stringify((bk0.cards[0] || '').slice(0, 18))}`);
  await p.evaluate(() => closeOverlay()); await p.waitForTimeout(200);
  /* HUD 📘(#infoBtn) 로 연 «평소의 책» 은 종전 그대로 — 탭하면 전투로 돌아간다 (복귀 콜백 없음) */
  await p.click('#infoBtn'); await p.waitForTimeout(260);
  const hud = await p.evaluate(() => ({
    list: document.querySelectorAll('.perk-list .perk-card').length, back: !!document.getElementById('pbBack'),
    tap: !!document.querySelector('.tap-close'), paused: G.paused,
  }));
  await p.click('#overlay'); await p.waitForTimeout(260);
  const hud2 = await p.evaluate(() => ({ on: document.getElementById('overlay').classList.contains('on'), paused: G.paused }));
  chk('HUD 📘 로 연 책은 종전대로 «탭하면 닫힘»', hud.list > 0 && !hud.back && hud.tap && hud.paused === true,
    `목록 ${hud.list}장 · 돌아가기 버튼 ${hud.back}`);
  chk('그 책은 탭하면 닫히고 시간이 다시 흐른다', !hud2.on && hud2.paused === false);

  /* ---------- ⚑⚑⚑ T150 악마의 거래 = 전설 특전 «1개» (주인 확정 2026-09-05 17:4X) ----------
     주인 «악마 거래는 전설 꺼 1개만 두고 hp 소모되면서 가져가는 거로 되야 되는데 3개 특전 주네».
     정적 게이트(`verifyDevilPolicy` ⑨~⑪)는 소스를 보지만, «화면에 실제로 몇 장이 뜨고 눌러서 무엇이
     일어나는가» 는 여기서만 확인된다. 보는 것: ①카드 1장 ②등급 태그 «전설» ③고를 수 있는 카드 0장
     ④2택 유지 ⑤거절하면 아무것도 안 바뀐다 ⑥수락하면 최대 체력 −30% + 미리 보여준 그 한 장을 받는다. */
  console.log('\n=== ⚑⚑⚑ 악마의 거래 = 전설 특전 1개 (T150) ===');
  await p.evaluate(() => { if (document.getElementById('overlay').classList.contains('on')) closeOverlay(); });
  await p.waitForTimeout(200);
  const dv0 = await p.evaluate(() => {
    G.perksTaken = []; G.pxPerk = {}; renderPerkStrip();
    G.player.maxHp = 1000; G.player.hp = 1000;
    openDevil();
    const cards = [...document.querySelectorAll('#overlay .perk-card')];
    return {
      cards: cards.length,
      pickable: document.querySelectorAll('#overlay .perk-card.pick').length,
      tags: cards.map(c => c.querySelector('.tag').textContent),
      tx: cards.map(c => c.querySelector('.tx').textContent),
      choices: [...document.querySelectorAll('#overlay .choice-btn')].map(b => b.textContent.replace(/\s+/g, ' ').trim()),
      yes: !!document.getElementById('dYes'), no: !!document.getElementById('dNo'),
      maxHp: G.player.maxHp, hp: G.player.hp, taken: G.perksTaken.length, paused: G.paused,
    };
  });
  chk('⚑ T150 악마 팝업에 카드가 «정확히 1장» (3택 폐기)', dv0.cards === 1,
    `카드 ${dv0.cards}장 · ${(dv0.tx[0] || '').slice(0, 30)}`);
  chk('⚑ T150 그 카드는 «전설» 이고 고를 수 없다', dv0.tags[0] === '전설' && dv0.pickable === 0,
    `태그 ${dv0.tags.join(',')} · 고를 수 있는 카드 ${dv0.pickable}장`);
  chk('선택지는 2택(지불 / 지나감) 그대로', dv0.yes && dv0.no && dv0.choices.length === 2,
    dv0.choices.map(s => s.slice(0, 34)).join(' | '));
  chk('지불 버튼이 «전설 특전 1개 획득» 을 안내한다', /전설 특전 1개/.test(dv0.choices[0] || ''),
    (dv0.choices[0] || '').slice(0, 60));
  await p.click('#dNo'); await p.waitForTimeout(240);
  const dvNo = await p.evaluate(() => ({
    on: document.getElementById('overlay').classList.contains('on'),
    maxHp: G.player.maxHp, hp: G.player.hp, taken: G.perksTaken.length, paused: G.paused,
  }));
  chk('«지나간다» 를 고르면 최대 체력·보유 특전이 그대로다',
    !dvNo.on && dvNo.maxHp === dv0.maxHp && dvNo.hp === dv0.hp && dvNo.taken === 0 && dvNo.paused === false,
    `최대체력 ${dvNo.maxHp} · 현재 ${dvNo.hp} · 보유 ${dvNo.taken}종`);
  /* ⚑ 비용은 «지불하는 그 순간» 을 재야 한다 — 바로 뒤에 붙는 전설 특전이 최대 체력을 다시 만질 수 있고
     (수집가·최대 체력 +N% 계열), 이 절은 앞 절들이 밀어 넣은 특전이 px 에 남은 상태에서 돈다.
     그래서 payDevilCost 를 감싸 «부르기 직전/직후» 값을 잡는다. */
  const dv1 = await p.evaluate(() => {
    window.__dvSpy = null;
    const real = window.payDevilCost;
    window.__dvReal = real;
    window.payDevilCost = q => { const b = q.maxHp, h = q.hp; real(q); window.__dvSpy = { before: b, hpBefore: h, after: q.maxHp, hp: q.hp }; };
    openDevil();
    const c = document.querySelector('#overlay .perk-card');
    return { tx: c ? c.querySelector('.tx').textContent : '', maxHp: G.player.maxHp };
  });
  await p.click('#dYes'); await p.waitForTimeout(280);
  const dvYes = await p.evaluate(() => {
    const last = G.perksTaken[G.perksTaken.length - 1];
    return {
      spy: window.__dvSpy, taken: G.perksTaken.length,
      lastTx: last ? last.tx.replace(/<[^>]+>/g, '') : '', lastG: last ? last.g : -1,
      giftCards: document.querySelectorAll('#overlay .perk-card').length,
      giftPick: document.querySelectorAll('#overlay .perk-card.pick').length,
      ok: !!document.getElementById('dOk'),
    };
  });
  chk('수락하면 최대 체력이 정확히 30% 줄어든다 (현재체력은 새 최대치로 클램프)',
    !!dvYes.spy && Math.abs(dvYes.spy.after - dvYes.spy.before * 0.7) < 1e-6
      && Math.abs(dvYes.spy.hp - Math.min(dvYes.spy.hpBefore, dvYes.spy.after)) < 1e-6,
    dvYes.spy ? `최대체력 ${dvYes.spy.before} → ${dvYes.spy.after} · 현재 ${dvYes.spy.hpBefore} → ${dvYes.spy.hp}`
      : '지불 동사가 한 번도 안 불렸다');
  chk('⚑ T150 미리 보여준 그 «전설» 한 장을 그대로 받는다',
    dvYes.taken === 1 && dvYes.lastG === 2 && dvYes.lastTx === dv1.tx,
    `보유 ${dvYes.taken}종 · 등급 ${dvYes.lastG} · 미리보기 «${dv1.tx.slice(0, 26)}» → 획득 «${dvYes.lastTx.slice(0, 26)}»`);
  chk('획득 연출에도 카드는 1장이고 «고르기» 가 없다',
    dvYes.giftCards === 1 && dvYes.giftPick === 0 && dvYes.ok,
    `카드 ${dvYes.giftCards}장 · 고를 수 있는 카드 ${dvYes.giftPick}장`);
  await p.evaluate(() => {
    const b = document.getElementById('dOk'); if (b) b.click();
    if (window.__dvReal) window.payDevilCost = window.__dvReal;   /* 스파이 원상 복구 */
  });
  await p.waitForTimeout(240);

  /* ---------- 보스 킬 = 특전 스킵 (주인 지시 06:3X) ---------- */
  console.log('\n=== 챕터 종료 보스 킬 = 특전 스킵 · 클리어 ===');
  /* ⚑ T52 수리 — 순서를 «팝업 비우기 → 과녁 세팅» 에서 «적 정리 → 비우기 → 과녁 세팅» 으로 바꿨다.
     종전에는 팝업을 비운 뒤 세팅까지의 대기(300~400ms) 동안 게임이 계속 돌아 새 레벨업이 떴고,
     그 팝업이 열린 채 폴링에 들어가면 G.paused 로 보스가 영영 안 죽어 이 절 4항목이 통째로 빨개졌다
     (T47 로 경험치 요구식이 바뀌자 레벨업이 정확히 이 구간에 들어왔다 — 발견자 실측 5/7).
     보스 외 적을 먼저 전부 치우면 경험치 공급원이 보스 하나만 남아서
     «비운 뒤에는 새 팝업이 뜰 수 없다» 가 보장된다 — 타이밍이 아니라 구조로 막는다. */
  await p.evaluate(() => {
    for (const n of G.nodes) { if (n.type !== 'boss') { n.enemies.forEach(e => { e.dead = true; e.hp = 0; }); n.done = true; } }
    G.killed = G.totalEnemies - 1;
    G.nodes.find(n => n.type === 'boss').enemies.forEach(e => { e.hp = 1e6; });
    G.player.hp = 1e6; G.player.sh = 1e6;                 /* 비우는 동안 보스에게 맞아 죽지 않게 */
  });
  const drained = await drainAll(p);
  const boss = await p.evaluate(() => {
    /* 플레이어를 보스 앞에 세운다 — 걸어가는 시간을 기다리지 않기 위해 */
    const bn = G.nodes.find(n => n.type === 'boss');
    G.player.worldX = bn.x - 40;
    G.player.dmg = 1e9;                                   /* 한 방에 */
    G.player.exp = expNeed(G.player.level) - 1;           /* 이 처치로 반드시 레벨업 */
    return { lv0: G.player.level, bossX: Math.round(bn.x),
      cards: document.querySelectorAll('.perk-card').length, paused: !!(G && G.paused) };
  });
  chk('⚑ 관측 시작선이 깨끗하다 (팝업 0 · 정지 아님 — T52)', boss.cards === 0 && !boss.paused,
    `카드 ${boss.cards}장 · paused ${boss.paused} · 정리한 팝업 ${drained}개`);
  /* 클리어까지 폴링하며 «보스가 죽은 뒤 특전 카드가 한 번이라도 떴는가» 를 본다.
     ⚑ T52 — 세는 구간을 «보스 사망 이후» 로 좁혔다. 팝업이 열려 있으면 게임이 멈춰 보스가 죽을 수 없으므로,
     «보스 생존 + 카드 있음» 스냅샷의 카드는 정의상 보스킬 이전의 잔여물이다(있으면 비우고 계속 간다).
     보스킬로 카드가 뜨는 진짜 회귀는 «보스 사망» 스냅샷에서 그대로 잡힌다 — 그때는 누르지 않는다. */
  let sawCard = 0, lateDrain = 0;
  for (let i = 0; i < 80; i++) {
    const st = await p.evaluate(() => {
      const bn = G.nodes.find(n => n.type === 'boss');
      return {
        cards: document.querySelectorAll('.perk-card.pick').length,
        alive: !!(bn && bn.enemies.some(e => !e.dead && e.hp > 0)),
        cleared: !!(G && G.cleared), ov: document.getElementById('overlay').textContent.slice(0, 40),
      };
    });
    if (st.alive) {
      if (st.cards) { lateDrain++; await p.click('#perkPick0'); await p.waitForTimeout(250); continue; }
    } else sawCard = Math.max(sawCard, st.cards);
    if (st.cleared && /클리어/.test(st.ov)) break;
    await p.waitForTimeout(250);
  }
  if (lateDrain) console.log(`  · 참고: 보스 생존 중 잔여 레벨업 팝업 ${lateDrain}건을 비웠다 (판정 대상 아님)`);
  const after = await p.evaluate(() => ({
    cards: document.querySelectorAll('.perk-card').length,
    ov: document.getElementById('overlay').textContent.slice(0, 60),
    cleared: !!(G && G.cleared), lv: G ? G.player.level : -1,
    maxCh: save.maxChapter,
  }));
  chk('보스 처치로 레벨업이 일어난다 (전제)', after.lv > boss.lv0, `레벨 ${boss.lv0}→${after.lv}`);
  chk('보스 처치 레벨업에서 특전 카드가 한 번도 안 뜬다 (주인 지시 06:3X)', sawCard === 0, `관측 최대 ${sawCard}장`);
  chk('바로 클리어 화면', after.cleared && /클리어/.test(after.ov), after.ov.trim());
  chk('클리어로 다음 챕터 해금', after.maxCh >= 2, `maxChapter=${after.maxCh}`);
  await p.screenshot({ path: `${OUT}/t3-clear.png` });

  /* ---------- ⚑⚑⚑ T105 — «같은 챕터 두 번 시작 → 원거리 자리 동일» (주인 확정 2026-09-03 17:0X) ----------
     정적 게이트(`verifyChapterFixed` ⓔ~ⓙ)는 `chapterLayout` 이 내놓는 `ranged[]` 를 보지만, 게임이 실제로
     그것을 «읽어서» 적을 세우는지는 여기서만 확인된다(중간에 다시 굴리면 정적 검사는 초록인 채 깨진다).
     맨 끝에 두는 이유 — `startChapter` 가 전역 G 를 갈아치우므로 앞의 검사들이 끝난 뒤에야 안전하다. */
  console.log('\n=== ⚑ T105 같은 챕터 = 같은 원거리 자리 (실측) ===');
  const rangedRun = c => p.evaluate(ch => {
    startChapter(ch);
    return {
      pat: G.nodes.filter(n => n.type === 'wave').map(n => n.enemies.map(e => e.ranged ? '1' : '0').join('')).join('|'),
      n: G.nodes.flatMap(n => n.type === 'wave' ? n.enemies : []).filter(e => e.ranged).length,
      /* ⚑⚑⚑ T134 — «그대로 매판 굴린다» 반쪽의 실측 재료. 자리(ranged)는 챕터 시드로 굳었지만
         첫 공격 타이머·스킨·흔들림은 판마다 새로 굴려져야 한다 (주인 확정 T105 ②). */
      t: G.nodes.flatMap(n => n.type === 'wave' ? n.enemies : []).map(e => +e.atkTimer.toFixed(4)),
      sk: G.nodes.flatMap(n => n.type === 'wave' ? n.enemies : []).map(e => e.skin && e.skin.body).join(','),
      bob: G.nodes.flatMap(n => n.type === 'wave' ? n.enemies : []).map(e => +e.bob.toFixed(4)),
      bossT: (G.nodes.find(n => n.type === 'boss') || { enemies: [] }).enemies.map(e => e.atkTimer).join(','),
    };
  }, c);
  /* ⚑⚑⚑ T114 — 챕터 1~4 는 원거리가 0마리라 «다른 챕터는 다른 자리» 를 거기서 재면 둘 다 전부 0 이라
     항상 같다. 과녁을 원거리가 실제로 서는 챕터(7·8 = 램프 구간 3·4마리)로 옮긴다. */
  const r7a = await rangedRun(7), r7b = await rangedRun(7), r8 = await rangedRun(8);
  chk('⚑ 같은 챕터를 두 번 시작하면 원거리 자리가 완전히 같다', r7a.pat === r7b.pat && r7a.pat.length > 0,
    `챕터 7 원거리 ${r7a.n}마리 · 두 번째 ${r7b.n}마리`);
  chk('다른 챕터는 다른 자리다 (고정이 «전 챕터 동일» 로 뭉개지지 않았다)', r7a.pat !== r8.pat,
    `ch7 ${r7a.n}마리 / ch8 ${r8.n}마리`);
  chk('웨이브 첫 마리는 원거리가 아니다', r7a.pat.split('|').every(w => w[0] === '0'));
  /* ⚑⚑⚑ T134 — 같은 주인 문장의 «나머지 반쪽»: «스킨·첫 공격 타이머·전투 난수는 그대로 매판 굴린다».
     정적 게이트(`verifyPerRunRandom`)는 두 엔진 소스와 sim.js 스폰을 보지만, **게임이 실제로 세운 적**이
     판마다 새로 굴려지는지는 여기서만 확인된다. 자리는 위에서 «같다» 를 봤으니 여기선 «다르다» 를 본다. */
  chk('⚑ T134 같은 챕터를 두 번 시작해도 첫 공격 타이머는 판마다 다르다 (실측)',
    r7a.t.join(',') !== r7b.t.join(',') && r7a.t.length > 0,
    `1회차 ${r7a.t.slice(0, 3).join('/')} … / 2회차 ${r7b.t.slice(0, 3).join('/')} …`);
  chk('⚑ T134 한 판 안에서도 적마다 타이머가 다르다 (한 값으로 굳지 않았다)',
    new Set(r7a.t).size === r7a.t.length, `${new Set(r7a.t).size}/${r7a.t.length}종`);
  chk('⚑ T134 적 스킨·흔들림도 판마다 새로 굴려진다 (연출 난수 — 주인 «배치» 범위 밖)',
    (r7a.sk !== r7b.sk || r7a.bob.join(',') !== r7b.bob.join(',')) && r7a.sk.length > 0,
    `스킨 ${r7a.sk === r7b.sk ? '동일' : '다름'} · 흔들림 ${r7a.bob.join(',') === r7b.bob.join(',') ? '동일' : '다름'}`);
  chk('⚑ T134 보스 첫 공격 타이머는 상수 그대로다 (일반 적만 굴린다)',
    r7a.bossT === r7b.bossT && r7a.bossT.length > 0, `보스 ${r7a.bossT}`);
  /* ⚑⚑⚑ T114 마릿수 곡선 실측 — 주인 «챕터 4까지는 원거리 아예 없고 5부터 원거리 1마리씩 추가».
     정적 게이트는 `chapterLayout` 을 보지만, 게임이 그 마릿수대로 실제 적을 세우는지는 여기서만 확인된다. */
  const zeroN = [];
  for (const c of [1, 2, 3, 4]) zeroN.push((await rangedRun(c)).n);
  chk('⚑ 챕터 1~4 는 원거리가 한 마리도 안 선다 (주인 «챕터 4까지는 원거리 아예 없고»)',
    zeroN.every(n => n === 0), `ch1~4 = ${zeroN.join('/')}마리`);
  const ramp = [];
  for (const c of [5, 6, 7, 8]) ramp.push((await rangedRun(c)).n);
  chk('⚑ 챕터 5~8(램프)은 1·2·3·4마리로 한 마리씩 는다 (주인 «5부터 1마리씩 추가»)',
    ramp.join('/') === '1/2/3/4', `ch5~8 = ${ramp.join('/')}마리`);

  /* ---------- ⚑⚑⚑ T136 — 창의 화신: 화살이 창이 되되 «창 데미지·8관통 그대로» (주인 확정 T105) ----------
     정적 게이트(`verifySpearAvatar`)는 두 엔진 소스와 sim.js 실측을 보지만, **게임이 실제로 만드는 투사체**가
     평범한 창과 같은 계수·관통·사거리인지는 여기서만 확인된다(게임 쪽 `fireSpear` 는 `volley` 순차 연사를
     한 겹 더 쓴다 — sim.js 에는 없는 층이라 여기서 발수가 조용히 깎일 수 있다).
     ⚑ 판을 `G.paused=true` 로 얼려 두고 잰다 — 얼려도 `volley` 의 setTimeout 은 그대로 흘러 발사되고,
       전투 업데이트만 멈춘다(`if(!G.paused&&!G.over) update(...)`). 플레이어가 죽거나 적이 사라져
       발수가 흔들리는 것을 막는다. 투사체는 `G.pprojs.push` 를 가로채 **만들어진 순간** 을 센다. */
  console.log('\n=== ⚑ T136 창의 화신 — 화살이 창이 되되 창 데미지·8관통은 그대로 (실측) ===');
  const shoot = (px, n, which) => p.evaluate(async ([px, n, which]) => {
    startChapter(1);
    const pl = G.player;
    Object.assign(pl.px, { p_spearAvatar: 0, arrowCount: 0, spearMaster: 0 }, px);
    /* 화살은 사거리(540) 안에 표적이 있어야 난다 — 자리만 당기고 판은 얼린다 */
    const first = G.nodes.flatMap(nd => nd.enemies).sort((a, b) => a.worldX - b.worldX)[0];
    pl.worldX = first ? first.worldX - 200 : 0;
    G.paused = true;
    const rec = [];
    G.pprojs.push = function (o) {
      rec.push({ type: o.type, ratio: o.ratio, spd: o.spd, pierce: o.pierce, maxX: o.maxX });
      return Array.prototype.push.call(this, o);
    };
    (which === 'spear' ? fireSpear : fireArrows)(pl, n);
    await new Promise(r => setTimeout(r, 700));   /* volley = 발마다 50~70ms 순차 연사 */
    G.paused = false;
    return rec;
  }, [px, n, which]);
  const t136base = await shoot({}, 3, 'arrows');
  const t136av = await shoot({ p_spearAvatar: 1 }, 3, 'arrows');
  const t136sp = await shoot({}, 3, 'spear');
  chk('⚑ T136 아바타 없이 화살 3발을 쏘면 화살 3발이 뜬다 (전제)',
    t136base.length === 3 && t136base.every(o => o.type === 'parrow'),
    `${t136base.length}발 · ${t136base[0] ? t136base[0].type : '—'}`);
  chk('⚑ T136 아바타를 켜면 같은 자리에서 창 3개가 뜬다 (화살 0발 · 발수 그대로)',
    t136av.length === 3 && t136av.every(o => o.type === 'spear'),
    `창 ${t136av.filter(o => o.type === 'spear').length}개 · 화살 ${t136av.filter(o => o.type === 'parrow').length}발`);
  chk('⚑ T136 그 창이 fireSpear(3) 의 창과 한 필드도 다르지 않다 (계수·속도·사거리·관통)',
    JSON.stringify(t136av) === JSON.stringify(t136sp), JSON.stringify(t136sp[0] || {}));
  const t136ac = await shoot({ p_spearAvatar: 1, arrowCount: 1 }, 2, 'arrows');
  chk('⚑ T136 장비 «화살 발수» 옵션이 아바타의 창 발수에도 걸린다 (주인 «장비 화살 옵션도 포함»)',
    t136ac.length === 3 && t136ac.every(o => o.type === 'spear'), `2발 → 창 ${t136ac.length}개`);
  const t136sm = await shoot({ p_spearAvatar: 1, spearMaster: 1 }, 1, 'arrows');
  const t136sm0 = await shoot({ spearMaster: 1 }, 1, 'spear');
  chk('⚑ T136 장비 «창 데미지» 옵션도 아바타 창에 똑같이 걸린다 (아바타 전용 창이 아니다)',
    t136sm.length === 1 && t136sm0.length === 1 && t136sm[0].ratio === t136sm0[0].ratio
    && t136sm[0].ratio > (t136sp[0] ? t136sp[0].ratio : Infinity),
    `아바타 ${t136sm[0] ? t136sm[0].ratio : '—'} / 평범 ${t136sm0[0] ? t136sm0[0].ratio : '—'} / 기본 ${t136sp[0] ? t136sp[0].ratio : '—'}`);
  /* ---------- ⚑⚑⚑ T137 — 장비 옵션의 «발동 조건» 을 **게임 안에서** 실측 (주인 확정 T124 ③) ----------
     주인 문면 두 절: «가시갑옷 옵션은 특전 가시갑옷과 가산(실드 > 0 일 때만 +12%씩)» ·
     ««체력 50% 미만일 때 회피 시 회복» 은 회피 성공 순간 체력 비율로 판정».
     정적 게이트(`verifyGearOptTrigger`)는 `sim.js` 의 `hitPlayer` 를 vm 에서 굴려 재고 index.html 은
     «조건이 평가되는 자리» 를 구조로 본다 — **게임이 실제로 그 조건대로 발동하는지**는 여기서만 확인된다.
     맨 끝에 두는 이유: 난수·플레이어 상태를 잠깐 갈아끼우므로 앞의 검사가 다 끝난 뒤라야 안전하다. */
  console.log('\n=== ⚑ T137 장비 옵션 발동 조건 (게임 안 실측) ===');
  const trig = await p.evaluate(() => {
    startChapter(7);                                   /* 갓 만든 G · 플레이어로 시작 */
    const pl = G.player, px = pl.px, RR = Math.random;
    /* 시간이 흐르면 방어 버프가 만료돼 `effDef` 가 측정 도중에 움직인다 —
       판을 멈추고 방어축을 0 으로 굳혀서 «받은 피해» 를 dmg 그대로 만든다. */
    const keep = { hp: pl.hp, sh: pl.sh, ev: pl.evade, ward: pl.ward, def: pl.def,
      bd: pl.buffs.def, gc: px.guardCrystal, pause: G.paused,
      th: px.g_thornSh, pt: px.p_thorns, eh: px.g_evHeal, ea: px.g_evAxe };
    G.paused = true; pl.def = 0; pl.buffs.def = []; px.guardCrystal = false;
    let n = 0;
    const roll = f => { n = 0; Math.random = () => { const v = f(n); n++; return v; }; };
    const foe = () => ({ hp: 1e4 });   /* 반사량은 1 미만이라 부동소수 간격이 측정을 흐리지 않게 작게 잡는다 */
    const out = { d: 0 };
    try {
      /* ⓐ 가시갑옷 — 실드 유무로 장비분(+72%)이 붙었다 떨어진다 (특전분 0) */
      pl.ward = 0; pl.evade = 0; px.g_thornSh = 0.72; px.p_thorns = 0;
      const d = 1 * (1 - effDef(pl) / 100); out.d = d;
      roll(() => 0.999);                               /* 회피 실패 · 모든 확률 굴림 실패 */
      pl.hp = pl.maxHp; pl.sh = 1e9; let e = foe(); hitPlayer(1, true, e); out.shOn = 1e4 - e.hp;
      roll(() => 0.999);
      pl.hp = pl.maxHp; pl.sh = 0; e = foe(); hitPlayer(1, true, e); out.shOff = 1e4 - e.hp;
      /* ⓑ 실드가 이 타격으로 «전부 소진» 돼도 발동한다 (조건 시점 = 피격 «전») */
      roll(() => 0.999);
      pl.hp = pl.maxHp; pl.sh = d / 2; e = foe(); hitPlayer(1, true, e); out.shDrain = 1e4 - e.hp;
      /* ⓒ 특전 가시(+100%)와 «가산» — 곱연산이면 ×1.72 가 아니라 ×1.72… 가 아니라 1×1.72 로 갈라진다 */
      roll(() => 0.999); px.p_thorns = 3;
      pl.hp = pl.maxHp; pl.sh = 1e9; e = foe(); hitPlayer(1, true, e); out.both = 1e4 - e.hp;
      /* ⓓ 원거리는 안 붙는다 */
      roll(() => 0.999);
      pl.hp = pl.maxHp; pl.sh = 1e9; e = foe(); hitPlayer(1, false, e); out.ranged = 1e4 - e.hp;
      /* ⓔ 저체력 회피 회복 — 굴림 횟수(부위마다 따로)·조건 경계·회복량 */
      px.g_thornSh = 0; px.p_thorns = 0; px.g_evAxe = 0; px.g_evHeal = 6; pl.evade = 50; pl.sh = 0;
      roll(() => 0); pl.hp = pl.maxHp * 0.10; let h0 = pl.hp; hitPlayer(1, true, foe());
      out.loRolls = n; out.loHeal = (pl.hp - h0) / pl.maxHp;
      roll(() => 0); pl.hp = pl.maxHp * 0.50; h0 = pl.hp; hitPlayer(1, true, foe());
      out.midRolls = n; out.midHeal = (pl.hp - h0) / pl.maxHp;
      roll(() => 0); pl.hp = pl.maxHp * 0.49; h0 = pl.hp; hitPlayer(1, true, foe());
      out.loEdgeRolls = n;
      px.g_evHeal = 1;
      roll(() => 0); pl.hp = pl.maxHp * 0.10; h0 = pl.hp; hitPlayer(1, true, foe());
      out.oneRolls = n; out.oneHeal = (pl.hp - h0) / pl.maxHp;
    } finally {
      Math.random = RR;
      pl.hp = keep.hp; pl.sh = keep.sh; pl.evade = keep.ev; pl.ward = keep.ward; pl.def = keep.def;
      pl.buffs.def = keep.bd; px.guardCrystal = keep.gc; G.paused = keep.pause;
      px.g_thornSh = keep.th; px.p_thorns = keep.pt; px.g_evHeal = keep.eh; px.g_evAxe = keep.ea;
    }
    return out;
  });
  const nr = (a, b) => Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b));
  chk('⚑ T137 실드가 있으면 가시갑옷 장비분(+72%)이 붙는다', nr(trig.shOn, trig.d * 0.72),
    `반사 ${trig.shOn} · 기대 ${trig.d * 0.72}`);
  chk('⚑ T137 실드가 0 이면 장비분이 안 붙는다', nr(trig.shOff, 0), `반사 ${trig.shOff}`);
  chk('⚑ T137 실드가 이 타격으로 전부 소진돼도 발동한다 (조건 시점 = 피격 «전»)',
    nr(trig.shDrain, trig.d * 0.72), `반사 ${trig.shDrain} · 기대 ${trig.d * 0.72} (0 이면 hadSh 가 흡수 «뒤» 로 밀린 것)`);
  chk('⚑ T137 특전 가시(+300%)와 «가산» 이다 (×3.72 · 곱연산이면 ×5.16)',
    nr(trig.both, trig.d * 3.72), `반사 ${trig.both} · 가산 ${trig.d * 3.72} · 곱연산 ${trig.d * 3 * 1.72}`);
  chk('⚑ T137 원거리 피격은 가시갑옷이 안 붙는다', nr(trig.ranged, 0), `반사 ${trig.ranged}`);
  chk('⚑ T137 체력 10% 회피 → 6부위가 각각 따로 굴린다 (굴림 7 = 회피1 + 회복6)',
    trig.loRolls === 7, `굴림 ${trig.loRolls}회`);
  chk('⚑ T137 전부 성공하면 최대 체력의 10% × 6 회복', nr(trig.loHeal, 0.6),
    `회복 ${(trig.loHeal * 100).toFixed(4)}%`);
  chk('⚑ T137 체력 정확히 50% 면 발동하지 않는다 («미만»)',
    trig.midRolls === 1 && nr(trig.midHeal, 0), `굴림 ${trig.midRolls}회 · 회복 ${trig.midHeal}`);
  chk('⚑ T137 체력 49% 면 발동한다 (경계 한 칸)', trig.loEdgeRolls === 7, `굴림 ${trig.loEdgeRolls}회`);
  chk('⚑ T137 1부위면 정확히 1번 굴리고 10% 회복한다',
    trig.oneRolls === 2 && nr(trig.oneHeal, 0.1), `굴림 ${trig.oneRolls}회 · 회복 ${(trig.oneHeal * 100).toFixed(4)}%`);

  /* ---------- ⚑⚑⚑ T138 처치-트리거 3특전 (주인 확정 T121 2차 17:0X · 17:2X) ----------
     정적 층(`tools/verifyKillTrigger.js`)은 `sim.js` 엔진을 굴려서 재고 `index.html` 은 문면·상수로 묶는다.
     여기서는 **게임 쪽 실제 함수**(`onKill`·`dealPlayerDamage`·`playerStrike`)를 그대로 불러 같은 세 문장을 확인한다:
       ⓐ «광전사(치확 0 고정) 상태에서도 그 한 방은 0% → 100%» · 스택 아님 · 평타에서만 소모
       ⓑ «웨이브 마지막 적 → 다음 웨이브 첫 적으로는 대시하지 않는다»
       ⓒ «8스택이라고 +800% 를 한 번에 쓰는 게 아니라 8번의 공격이 각각 +100%»
     ⚑ 판은 `G.paused=true` 로 얼려 두고 `Math.random` 을 0.5 로 고정한다 —
       치명 굴림(`<cr`)·적 회피(10%)·데미지 흔들림(0.92~1.08)이 전부 결정적이 된다. 끝나면 되돌린다. */
  console.log('\n=== ⚑ T138 처치-트리거 3특전 — 확정 치명 · 대시 · 버서커 (게임 쪽 실측) ===');
  const t138 = await p.evaluate(() => {
    startChapter(1);
    const pl = G.player, or = Math.random;
    const waves = G.nodes.filter(nd => nd.type === 'wave' && nd.enemies && nd.enemies.length);
    const prep = nd => nd.enemies.forEach(e => { e.hp = 1e15; e.maxHp = 1e15; e.dead = false; e.isBoss = false; });
    waves.forEach(prep);
    const w0 = waves[0], w1 = waves[1];
    const zero = () => { for (const k of Object.keys(pl.px)) if (typeof pl.px[k] === 'number') pl.px[k] = 0; };
    const kill = e => { e.hp = 0; e.dead = false; onKill(e, 0); };
    G.paused = true; G.cleared = true;          /* 레벨업 팝업이 안 뜨게 (특전 3택은 다른 항목이 본다) */
    Math.random = () => 0.5;
    const out = {};
    try {
      /* ⓐ 확정 치명 — 광전사(치확 0 고정) + 확정 치명 */
      zero(); pl.critR = 0; pl.px.p_berserk = 1;
      const tgt = w0.enemies[w0.enemies.length - 1];
      out.baseCrit = dealPlayerDamage(tgt, 1);                 /* 광전사만 — 치명 0% */
      pl.px.p_killSureCrit = 1;
      kill(w0.enemies[0]);      out.flag1 = pl.sureCrit === true;
      kill(w0.enemies[1]);      out.flag2 = pl.sureCrit === true;   /* 두 번 죽여도 플래그 하나 */
      out.crit1 = dealPlayerDamage(tgt, 1);                    /* 평타 — 반드시 치명 */
      out.crit2 = dealPlayerDamage(tgt, 1);                    /* 소모됐다 — 치명 아님 */
      kill(w0.enemies[2]);                                     /* 다시 켠다 (표적이 곧 그 적이라 되살린다) */
      tgt.hp = 1e15; tgt.maxHp = 1e15; tgt.dead = false;
      out.flag3 = pl.sureCrit === true;
      out.summonCrit = dealPlayerDamage(tgt, 1, '🪓');         /* 소환·반격 축 — 쓰지 않는다 */
      out.summonKeep = pl.sureCrit === true;                   /* 소모도 안 한다 */

      /* ⓑ 대시 — 같은 웨이브에만 */
      zero(); pl.dash = false; pl.px.p_killDash = 1;
      w0.enemies.forEach(e => { e.hp = 1e15; e.dead = false; });
      kill(w0.enemies[0]);      out.dashSame = pl.dash === true;
      pl.dash = false;
      w0.enemies.forEach((e, i) => { if (i) { e.hp = 0; e.dead = true; } });   /* 한 마리만 남았다 */
      if (w1) prep(w1);
      kill(w0.enemies[0]);      out.dashNext = pl.dash;        /* 다음 웨이브가 꽉 차 있어도 false 여야 한다 */
      out.nextAlive = w1 ? w1.enemies.filter(e => e.hp > 0).length : 0;

      /* ⓒ 버서커 — 평타 1회당 1개씩 */
      zero(); pl.dash = false; pl.bsStk = 0; pl.sureCrit = false;
      const wb = waves[waves.length - 1]; prep(wb);
      const bt = wb.enemies[wb.enemies.length - 1];
      const strikes = () => { const a = []; for (let i = 0; i < 5; i++) { const h = bt.hp; playerStrike(bt); a.push(h - bt.hp); } return a; };
      out.plain = strikes();                                   /* 대조군 — 스택 없음 */
      pl.px.p_berserkStk = 1;
      /* 웨이브가 3마리뿐이라 표적까지 죽는다 — 처치로 스택만 쌓고 표적은 되살려 데미지를 잰다 */
      for (let i = 0; i < 3; i++) kill(wb.enemies[i % wb.enemies.length]);
      out.stk = pl.bsStk;
      bt.hp = 1e15; bt.maxHp = 1e15; bt.dead = false;
      out.hits = strikes();
      out.left = pl.bsStk;
      out.counterKeep = (() => { pl.bsStk = 3; doCounter(bt, 0); return pl.bsStk; })();
      out.summonStk = (() => { summonHit(bt, 0.75, '🪓'); return pl.bsStk; })();
    } catch (e) { out.err = String(e); }
    Math.random = or; G.paused = false;
    return out;
  });
  const rr = (t138.hits || []).map((d, i) => d / (t138.plain ? t138.plain[i] : NaN));
  chk('⚑ T138 광전사만 있으면 처치 뒤 평타가 치명타가 아니다 (치확 0 고정 · 대조군)',
    t138.baseCrit === false, `crit=${t138.baseCrit}${t138.err ? ' · ' + t138.err : ''}`);
  chk('⚑ T138 처치하면 확정 치명이 켜지고, 두 번 죽여도 플래그는 하나 (스택 아님)',
    t138.flag1 === true && t138.flag2 === true, `${t138.flag1}/${t138.flag2}`);
  chk('⚑ T138 그 한 방은 광전사여도 반드시 치명타 (주인 «0% → 100%»)', t138.crit1 === true, `crit=${t138.crit1}`);
  chk('⚑ T138 다음 평타는 다시 치명타가 아니다 (한 방만 소모)', t138.crit2 === false, `crit=${t138.crit2}`);
  chk('⚑ T138 소환·반격 적중은 확정 치명을 쓰지도 소모하지도 않는다 (살아 있는 표적에 실측)',
    t138.flag3 === true && t138.summonCrit === false && t138.summonKeep === true,
    `켜짐=${t138.flag3} · crit=${t138.summonCrit} · 남음=${t138.summonKeep}`);
  chk('⚑ T138 같은 웨이브에 적이 남아 있으면 대시한다', t138.dashSame === true, `dash=${t138.dashSame}`);
  chk('⚑ T138 웨이브 마지막 적을 죽이면 다음 웨이브에 적이 남아 있어도 대시하지 않는다 (주인 명시)',
    t138.dashNext === false && t138.nextAlive > 0, `dash=${t138.dashNext} · 다음 웨이브 생존 ${t138.nextAlive}마리`);
  chk('⚑ T138 처치 3번 → 버서커 스택 3개', t138.stk === 3, `bsStk=${t138.stk}`);
  chk('⚑ T138 세 번의 평타가 각각 ×2 · 그 뒤는 ×1 (한 방에 ×8 이 아니다 — 주인 명시)',
    rr.length === 5 && [2, 2, 2, 1, 1].every((w, i) => Math.abs(rr[i] - w) < 1e-9) && t138.left === 0,
    rr.map(x => '×' + (Number.isFinite(x) ? x.toFixed(3) : '?')).join(' · ') + ` · 남은 스택 ${t138.left}`);
  chk('⚑ T138 반격·소환은 버서커 스택을 소모하지 않는다',
    t138.counterKeep === 3 && t138.summonStk === 3, `반격 뒤 ${t138.counterKeep} · 소환 뒤 ${t138.summonStk}`);

  /* ---------- ⚑⚑⚑ T139 피격 판정 순서 (주인 확정 T121 3차 18:2X) ----------
     주인 문면: «판정 순서 **회피 → 방어막 → 피해 무시 → 피해**» · «방어막으로 막은 공격은 «피격» 이
     아니다(트리거·가시갑옷 발동 없음)» · 피해 무시는 «회피 판정 «뒤»·방어막 «뒤» 에 굴림».
     정적 층(`tools/verifyHitOrder.js`)은 `sim.js` 의 `hitPlayer` 를 vm 에서 굴려 재고 index.html 은
     네 층의 **위치**를 비교한다 — **게임이 실제로 그 순서로 도는지**는 여기서만 확인된다.
     순서를 가르는 열쇠는 **방어막 장수의 소모 여부**다. 모든 확률 굴림을 «성공» 으로 굳혀 놓고
     «방어막 1장 + 피해 무시 특전» 으로 한 대 맞으면
       · 주인 순서면 → 방어막이 먼저 막아 **장수가 1 → 0** 이 된다
       · 순서가 뒤집히면 → 무시가 먼저 성공해 그대로 끝나므로 **장수가 1 로 남는다**.
     ⚑ 굴림 횟수는 **조기 종료가 연출 앞에서 끊기는 경로에서만** 쓴다 — 게임 쪽 `hitPlayer` 는
     `sparks`·`wardFx` 같은 연출이 `Math.random` 을 같이 쓰기 때문에(맨몸 피격 한 대에 수십 번)
     피해가 끝까지 흐르거나 방어막 연출을 타는 경로에서는 굴림 수가 순서의 증거가 못 된다.
     회피·피해 무시의 조기 종료는 연출 앞에서 끊겨 굴림이 정확히 1·2회로 떨어진다. */
  console.log('\n=== ⚑ T139 피격 판정 순서 «회피 → 방어막 → 피해 무시 → 피해» (게임 안 실측) ===');
  const t139 = await p.evaluate(() => {
    startChapter(7);
    const pl = G.player, px = pl.px, RR = Math.random;
    const keep = { hp: pl.hp, sh: pl.sh, ev: pl.evade, ward: pl.ward, def: pl.def, bd: pl.buffs.def,
      gc: px.guardCrystal, pause: G.paused, ign: px.p_ignoreN, wall: px.p_shWallL,
      th: px.p_thorns, ths: px.g_thornSh, wh: px.p_wardHitN, ct: pl.counter };
    G.paused = true; pl.def = 0; pl.buffs.def = []; px.guardCrystal = false;
    pl.counter = 0; px.g_thornSh = 0;
    let n = 0;
    const roll = f => { n = 0; Math.random = () => { const v = f(n); n++; return v; }; };
    const foe = () => ({ hp: 1e4 });
    /* 회피율 90(엔진 상한)으로 굳혀 **첫 굴림 값 하나로** 회피 성공·실패를 정한다 */
    const HIT = () => 0.95, EVA = i => (i === 0 ? 0.10 : 0);
    const out = {};
    const set = o => { px.p_ignoreN = o.ign || 0; px.p_shWallL = o.wall || 0;
      px.p_thorns = o.thorn || 0; px.p_wardHitN = o.wardHit || 0;
      pl.ward = o.ward || 0; pl.sh = o.sh || 0; pl.hp = pl.maxHp; pl.evade = 90; };
    const shot = (o, f) => { set(o); const e = foe(); const h0 = pl.hp, s0 = pl.sh, w0 = pl.ward;
      roll(f); hitPlayer(o.dmg === undefined ? 1 : o.dmg, o.melee !== false, e);
      return { rolls: n, ward: pl.ward, dWard: pl.ward - w0, dHp: h0 - pl.hp, dSh: s0 - pl.sh,
        refl: 1e4 - e.hp }; };
    /* 회피만 실패시키고 그 뒤 확률 굴림은 전부 «성공» 으로 굳힌다 — 이 값에서 방어막이 깎이면
       방어막이 무시보다 «앞» 이고, 안 깎이면 무시가 먼저 성공한 것이다. */
    const HITYES = i => (i === 0 ? 0.95 : 0);
    try {
      /* 맨몸 피격 — 아무 방어층도 없으면 피해가 들어간다 (양성 대조) */
      out.bare = shot({}, HIT);
      /* ① 회피 > 방어막 — 피할 수 있던 타격은 방어막을 안 깎는다 (연출 앞에서 끊겨 굴림 1회) */
      out.ev = shot({ ward: 3 }, EVA);
      /* ② 방어막 > 피해 무시 (핵심) — 무시가 «성공» 값을 받아도 방어막이 먼저 깎인다 */
      out.wardFirst = shot({ ward: 1, ign: 1 }, HITYES);
      /* ③ 방어막 > 실드 방벽 */
      out.wardWall = shot({ ward: 1, wall: 1, sh: 1e9 }, HITYES);
      /* ④ 방어막이 0 이라야 무시를 굴린다 — 조기 종료가 연출 앞이라 굴림이 정확히 2회 */
      out.ignOn = shot({ ign: 1 }, HITYES);
      out.ignOff = shot({ ign: 1 }, () => 0.95);
      /* ⑤ 실드 방벽은 실드가 0 이면 굴리지 않는다 (굴렸다면 성공해서 피해가 0 이었을 값) */
      out.wallNoSh = shot({ wall: 1, sh: 0 }, HITYES);
      out.wallSh = shot({ wall: 1, sh: 1e9 }, HITYES);
      /* ⑥ 막힌·무시된 타격은 «피격» 이 아니다 (가시갑옷·피격 시 방어막 0) */
      out.okHit = shot({ thorn: 1, wardHit: 1 }, HITYES);   /* 양성 대조 */
      out.blocked = shot({ ward: 1, thorn: 1, wardHit: 1 }, HITYES);
      out.ignored = shot({ ign: 1, thorn: 1, wardHit: 1 }, HITYES);
      out.evaded = shot({ ward: 2, thorn: 1, wardHit: 1 }, EVA);
    } catch (e) { out.err = String(e && e.message || e); }
    finally {
      Math.random = RR;
      pl.hp = keep.hp; pl.sh = keep.sh; pl.evade = keep.ev; pl.ward = keep.ward; pl.def = keep.def;
      pl.buffs.def = keep.bd; px.guardCrystal = keep.gc; G.paused = keep.pause; pl.counter = keep.ct;
      px.p_ignoreN = keep.ign; px.p_shWallL = keep.wall; px.p_thorns = keep.th;
      px.g_thornSh = keep.ths; px.p_wardHitN = keep.wh;
    }
    return out;
  });
  chk('⚑ T139 맨몸 근접 피격이면 피해가 들어간다 (양성 대조)',
    t139.bare && t139.bare.dHp > 0, t139.bare && `체력 −${t139.bare.dHp}${t139.err ? ' · ' + t139.err : ''}`);
  chk('⚑ T139 ① 회피에 성공하면 방어막이 안 깎이고 굴림은 회피 1번뿐 (회피가 «앞»)',
    t139.ev && t139.ev.ward === 3 && t139.ev.rolls === 1 && t139.ev.dHp === 0,
    t139.ev && `장수 ${t139.ev.ward} · 굴림 ${t139.ev.rolls}회 · 체력 −${t139.ev.dHp}`);
  chk('⚑ T139 ② 방어막 1장 + 피해 무시(굴리면 성공) → **방어막이 먼저 깎인다** (1 이면 뒤집힌 것)',
    t139.wardFirst && t139.wardFirst.ward === 0 && t139.wardFirst.dHp === 0,
    t139.wardFirst && `남은 장수 ${t139.wardFirst.ward} · 체력 −${t139.wardFirst.dHp}`);
  chk('⚑ T139 ③ 방어막 1장 + 실드 방벽(실드 있음) → 방어막이 먼저 깎인다',
    t139.wardWall && t139.wardWall.ward === 0 && t139.wardWall.dHp === 0 && t139.wardWall.dSh === 0,
    t139.wardWall && `남은 장수 ${t139.wardWall.ward} · 체력 −${t139.wardWall.dHp} · 실드 −${t139.wardWall.dSh}`);
  chk('⚑ T139 ④ 방어막이 0 이면 피해 무시를 굴린다 (조기 종료가 연출 앞 → 굴림 정확히 2회 · 피해 0)',
    t139.ignOn && t139.ignOn.rolls === 2 && t139.ignOn.dHp === 0,
    t139.ignOn && `굴림 ${t139.ignOn.rolls}회 · 체력 −${t139.ignOn.dHp}`);
  chk('⚑ T139 ④ 무시에 실패하면 피해가 끝까지 흐른다',
    t139.ignOff && t139.ignOff.dHp > 0, t139.ignOff && `체력 −${t139.ignOff.dHp}`);
  chk('⚑ T139 ⑤ 실드가 0 이면 실드 방벽을 굴리지 않는다 (굴렸으면 성공해 피해가 0 이었을 값)',
    t139.wallNoSh && t139.wallNoSh.dHp > 0, t139.wallNoSh && `체력 −${t139.wallNoSh.dHp}`);
  chk('⚑ T139 ⑤ 실드가 있으면 굴리고, 성공하면 체력·실드가 안 준다 (굴림 2회)',
    t139.wallSh && t139.wallSh.rolls === 2 && t139.wallSh.dSh === 0 && t139.wallSh.dHp === 0,
    t139.wallSh && `굴림 ${t139.wallSh.rolls}회 · 체력 −${t139.wallSh.dHp} · 실드 −${t139.wallSh.dSh}`);
  chk('⚑ T139 ⑥ 양성 대조 — 정상 피격이면 가시갑옷이 되갚고 «피격 시 방어막» 이 붙는다',
    t139.okHit && t139.okHit.refl > 0 && t139.okHit.dWard > 0,
    t139.okHit && `반사 ${t139.okHit.refl} · 방어막 +${t139.okHit.dWard}`);
  chk('⚑ T139 ⑥ 방어막으로 막은 타격은 «피격» 이 아니다 (반사 0 · 방어막 안 붙음)',
    t139.blocked && t139.blocked.refl === 0 && t139.blocked.ward === 0,
    t139.blocked && `반사 ${t139.blocked.refl} · 남은 장수 ${t139.blocked.ward}`);
  chk('⚑ T139 ⑥ 무시된 타격도 «피격» 이 아니다 (반사 0 · 방어막 안 붙음 · 체력 불변)',
    t139.ignored && t139.ignored.refl === 0 && t139.ignored.dWard === 0 && t139.ignored.dHp === 0,
    t139.ignored && `반사 ${t139.ignored.refl} · 방어막 +${t139.ignored.dWard} · 체력 −${t139.ignored.dHp}`);
  chk('⚑ T139 ⑥ 회피한 타격도 반사 0 · 방어막 장수 불변',
    t139.evaded && t139.evaded.refl === 0 && t139.evaded.ward === 2,
    t139.evaded && `반사 ${t139.evaded.refl} · 장수 ${t139.evaded.ward}`);

  /* =============================================================================
     ⚑⚑⚑ T142 — 관통 베기 I/II/III 의 발동 규칙 (주인 확정 T121 2차 · 17:4X)
     정적 게이트 `tools/verifyCleave.js` 는 `sim.js` 를 굴려 재고, **여기서는 게임 쪽 `cleave` 를
     같은 방식으로 굴린다** — 두 엔진이 갈라지는 것을 문면이 아니라 동작으로 잡는 자리다.
     난수를 대본(queue)으로 갈아끼우고 적을 원하는 자리에 세워 «누가 몇 번 얼마나 맞았나» 를 센다.
     ============================================================================= */
  console.log('\n=== ⚑ T142 관통 베기 I/II/III — 따로 굴림 · 바로 뒤 1마리 · 값 그대로 (게임 쪽 실측) ===');
  const t142 = await p.evaluate(() => {
    startChapter(1);
    const pl = G.player, or = Math.random;
    const waves = G.nodes.filter(nd => nd.type === 'wave' && nd.enemies && nd.enemies.length);
    const w0 = waves[0], w1 = waves[1];
    const zero = () => { for (const k of Object.keys(pl.px)) if (typeof pl.px[k] === 'number') pl.px[k] = 0; };
    G.paused = true; G.cleared = true;
    let q = [], dflt = 0.999, n = 0;
    Math.random = () => { n++; return q.length ? q.shift() : dflt; };
    /* 연출 함수(파티클·데미지 숫자·효과음)는 자기들도 난수를 쓰므로 측정 중에는 막아 둔다 —
       막지 않으면 대본이 연출에 먹혀 굴림 순서가 어긋난다. 끝나면 되돌린다. */
    const oSp = window.sparks, oTx = window.addText, oAu = AU.play;
    window.sparks = () => {}; window.addText = () => {}; AU.play = () => {};
    const out = {};
    const HIT = 0, NOEV = 0.5, D = 100;
    try {
      /* 무대 — 첫 웨이브에 적 4마리를 88px 간격 일렬로 세운다 (모자라면 같은 모양으로 채운다) */
      const seed = w0.enemies[0];
      while (w0.enemies.length < 4) w0.enemies.push(Object.assign({}, seed));
      w0.enemies.length = 4;
      const setup = () => {
        w0.enemies.forEach((e, i) => {
          e.worldX = i * 88; e.hp = 1e9; e.maxHp = 1e9;
          e.dead = false; e.isBoss = false; e.stun = 0; e.wave = w0;
        });
        if (w1) w1.enemies.forEach(e => { e.hp = 1e9; e.maxHp = 1e9; e.dead = false; e.wave = w1; });
        G.miss = 0; G.kills = 0;
      };
      /* 한 방 — 대본을 깔고 `cleave` 를 한 번 부른 뒤 각 적의 손실을 돌려준다 */
      const shot = (perks, script, tgtIdx) => {
        zero(); setup();
        for (const k of perks) pl.px[k] = 1;
        q = script.slice(); n = 0;
        const before = w0.enemies.map(e => e.hp);
        const b1 = w1 ? w1.enemies.map(e => e.hp) : [];
        cleave(w0.enemies[tgtIdx === undefined ? 0 : tgtIdx], D);
        return {
          lost: w0.enemies.map((e, i) => before[i] - e.hp),
          lost1: w1 ? w1.enemies.map((e, i) => b1[i] - e.hp) : [],
          rolls: n, miss: G.miss,
        };
      };
      const CL3 = ['p_cleaveN', 'p_cleaveR', 'p_cleaveL'];
      out.three = shot(CL3, [HIT, NOEV, HIT, NOEV, HIT, NOEV]);      /* 셋 다 성공 → 3번 */
      out.one = shot(['p_cleaveN'], [HIT, NOEV]);                    /* 하나만 → 1번 */
      out.midMiss = shot(CL3, [HIT, NOEV, 0.9, HIT, NOEV]);          /* 가운데만 실패 → 2번 */
      out.thN = shot(['p_cleaveN'], [0.32, NOEV]);                   /* 33% 경계 — 발동 */
      out.thN2 = shot(['p_cleaveN'], [0.33, NOEV]);                  /* 33% 경계 — 안 함 */
      out.thR = shot(['p_cleaveR'], [0.65, NOEV]);
      out.thR2 = shot(['p_cleaveR'], [0.66, NOEV]);
      out.thL = shot(['p_cleaveL'], [0.999, NOEV]);                  /* III 는 항상 */
      out.evade = shot(['p_cleaveL'], [HIT, 0.05]);                  /* 뒤 적이 회피 */
      /* 앞 적만 있을 때 — 마지막 적을 타겟으로 잡으면 뒤가 없다 */
      out.frontOnly = shot(['p_cleaveL'], [HIT, NOEV], 3);
      /* 다른 웨이브의 «더 가까운» 적이 있어도 같은 웨이브 것이 맞는다 */
      out.wave = (() => {
        zero(); setup(); pl.px.p_cleaveL = 1;
        w0.enemies[1].hp = 0; w0.enemies[2].hp = 0;                  /* 같은 웨이브의 뒤 = 3번(264px) */
        if (w1) w1.enemies.forEach((e, i) => { e.worldX = 20 + i; });/* 더 가까운 자리에 다음 웨이브 */
        q = [HIT, NOEV]; n = 0;
        const b0 = w0.enemies[3].hp, b1 = w1 ? w1.enemies.map(e => e.hp) : [];
        cleave(w0.enemies[0], D);
        return { same: b0 - w0.enemies[3].hp, next: w1 ? b1.map((h, i) => h - w1.enemies[i].hp) : [] };
      })();
      /* 뒤 적 처치도 «처치» 판정 · 한 적은 한 번만 죽는다 */
      out.kill = (() => {
        zero(); setup(); for (const k of CL3) pl.px[k] = 1;
        w0.enemies[1].hp = D; w0.enemies[1].maxHp = D;
        q = [HIT, NOEV, HIT, NOEV, HIT, NOEV]; n = 0; dflt = 0;
        const k0 = G.kills;
        cleave(w0.enemies[0], D);
        dflt = 0.999;
        return { kills: G.kills - k0, hp: w0.enemies[1].hp, dead: w0.enemies[1].dead === true, miss: G.miss };
      })();
      /* 평타에만 — 게임 쪽 호출부는 `dealPlayerDamage(e,ratio,src)` 의 basic 분기다 */
      out.basic = (() => {
        zero(); setup(); pl.px.p_cleaveL = 1;
        q = [0.99, NOEV, 0.5]; n = 0;                                /* 치명 실패 · 적 회피 실패 · 흔들림 */
        const b = w0.enemies[1].hp;
        dealPlayerDamage(w0.enemies[0], 1, '🪓');                    /* 소환 적중 = 평타 아님 */
        const summon = b - w0.enemies[1].hp;
        setup(); zero(); pl.px.p_cleaveL = 1;
        q = [0.99, NOEV, 0.5, HIT, NOEV]; n = 0;
        const b2 = w0.enemies[1].hp;
        dealPlayerDamage(w0.enemies[0], 1);                          /* 평타 */
        return { summon, basicHit: b2 - w0.enemies[1].hp };
      })();
    } catch (e) { out.err = String(e); }
    window.sparks = oSp; window.addText = oTx; AU.play = oAu;
    Math.random = or; G.paused = false;
    return out;
  });
  const D142 = 100;
  chk('⚑ T142 셋 다 보유·전부 성공 → 바로 뒤 적이 한 공격에 3번 맞는다 (주인 «최대 3번»)',
    t142.three && t142.three.lost[1] === D142 * 3 && t142.three.rolls === 6,
    t142.three ? `[${t142.three.lost}] 굴림 ${t142.three.rolls}${t142.err ? ' · ' + t142.err : ''}` : String(t142.err));
  chk('⚑ T142 하나만 보유하면 1번 · 가운데만 실패하면 2번 (셋을 따로 굴린다)',
    t142.one && t142.one.lost[1] === D142 && t142.midMiss.lost[1] === D142 * 2 && t142.midMiss.rolls === 5,
    t142.one ? `1개 ${t142.one.lost[1]} · 가운데실패 ${t142.midMiss.lost[1]} (굴림 ${t142.midMiss.rolls})` : '');
  chk('⚑ T142 확률 임계 — I 0.32 발동 / 0.33 안 함 · II 0.65 / 0.66 · III 는 0.999 에서도 발동',
    t142.thN && t142.thN.lost[1] === D142 && t142.thN2.lost[1] === 0 &&
    t142.thR.lost[1] === D142 && t142.thR2.lost[1] === 0 && t142.thL.lost[1] === D142,
    t142.thN ? `${t142.thN.lost[1]}/${t142.thN2.lost[1]} · ${t142.thR.lost[1]}/${t142.thR2.lost[1]} · ${t142.thL.lost[1]}` : '');
  chk('⚑ T142 손실은 «바로 뒤» 한 마리에만 몰린다 — 뒤의 뒤로 안 번진다',
    t142.three && t142.three.lost[0] === 0 && t142.three.lost[2] === 0 && t142.three.lost[3] === 0,
    t142.three ? `[${t142.three.lost}]` : '');
  chk('⚑ T142 뒤에 아무도 없으면 굴리지도 않는다 (맨 뒤 적을 때렸을 때)',
    t142.frontOnly && t142.frontOnly.rolls === 0 && t142.frontOnly.lost.every(v => v === 0),
    t142.frontOnly ? `굴림 ${t142.frontOnly.rolls} · [${t142.frontOnly.lost}]` : '');
  chk('⚑ T142 뒤 적의 회피 10% 는 따로 굴린다 (회피하면 hp 불변 · miss +1)',
    t142.evade && t142.evade.lost[1] === 0 && t142.evade.miss === 1 && t142.evade.rolls === 2,
    t142.evade ? `손실 ${t142.evade.lost[1]} · miss ${t142.evade.miss} · 굴림 ${t142.evade.rolls}` : '');
  chk('⚑ T142 같은 웨이브 안에서만 — 다음 웨이브가 더 가까워도 같은 웨이브의 먼 적이 맞는다',
    t142.wave && t142.wave.same === D142 && t142.wave.next.every(v => v === 0),
    t142.wave ? `같은 웨이브 ${t142.wave.same} · 다음 웨이브 [${t142.wave.next}]` : '');
  chk('⚑ T142 뒤 적 처치도 «처치» 판정 — kills +1 · 한 번만 죽고 hp 가 음수로 안 내려간다',
    t142.kill && t142.kill.kills === 1 && t142.kill.hp === 0 && t142.kill.dead && t142.kill.miss === 0,
    t142.kill ? `kills ${t142.kill.kills} · hp ${t142.kill.hp} · miss ${t142.kill.miss}` : '');
  chk('⚑ T142 평타에만 걸린다 — 소환 적중(🪓)에는 안 걸리고 평타에는 걸린다',
    t142.basic && t142.basic.summon === 0 && t142.basic.basicHit > 0,
    t142.basic ? `소환 ${t142.basic.summon} · 평타 ${t142.basic.basicHit}` : '');

  /* ---------- ⚑⚑⚑ T151 «3장 등급 동일» 을 레벨업 여러 번에 걸쳐 (주인 확정 17:5X ④) ----------
     한 번만 보면 «우연히 3장이 같은 등급» 일 수 있다(일반이 60% 라 카드마다 굴리던 판에서도 0.6³ ≒ 22% 로
     일어났다). 그래서 레벨업을 **3회 이상** 열어 매번 태그가 하나인지 본다.
     ⚑ 이 절은 챕터를 끝까지 흘려 보내므로 **맨 뒤에서 새 판으로** 돈다 — 앞 절들이 쓰던 판을 소모하면
     «보스 킬 = 특전 스킵»·클리어 검사가 판이 없어 빨개진다(실제로 한 번 그렇게 됐다). */
  console.log('\n=== ⚑⚑⚑ T151 레벨업 3회 이상 — 3장 태그가 매번 동일 (새 판) ===');
  await p.goto(URL); await p.waitForTimeout(600);
  await p.click('#startBtn'); await p.waitForTimeout(500);
  const rolls = [];
  let exited = false;
  /* 한 회차씩 «다음 레벨업이 뜰 때까지» 기다린다 — 레벨업 간격은 경험치가 정하므로 넉넉히 잡는다.
     기다리는 동안 쉼터·악마·천사 팝업이 뜨면 게임이 멈추므로 아무 선택지나 눌러 흐르게 둔다. */
  for (let round = 0; round < 4 && !exited; round++) {
    let got = false;
    for (let i = 0; i < 160 && !got; i++) {
      const st = await p.evaluate(() => ({
        cards: document.querySelectorAll('.perk-card.pick').length,
        choice: document.querySelectorAll('#overlay .choice-btn').length,
        /* ⚑ T150 뒤 — 악마 거래를 수락하면 «계속»(#dOk) 한 장짜리 결과 팝업이 한 번 더 뜬다.
           그건 선택지도 카드도 아니라, 안 눌러 주면 G.paused 인 채로 영영 멈춘다(실제로 여기서 한 번 멈췄다). */
        foot: document.querySelectorAll('#overlay .ov-foot button').length,
        on: document.getElementById('overlay').classList.contains('on'),
        exit: !!document.getElementById('clOk') || !!document.getElementById('deOk'),
      }));
      if (st.exit) { exited = true; break; }               /* 클리어·사망 화면은 누르면 로비로 나간다 */
      if (st.cards) {
        rolls.push(await p.evaluate(() => {
          const cs = [...document.querySelectorAll('.perk-card.pick')];
          return { tags: cs.map(c => c.querySelector('.tag')?.textContent),
                   pcs: cs.map(c => getComputedStyle(c).borderTopColor) };
        }));
        await p.click('#perkPick0'); got = true;
      } else if (st.choice) await p.click('#overlay .choice-btn');  /* 쉼터·악마·천사 팝업 */
      else if (st.foot) await p.click('#overlay .ov-foot button');  /* 악마 결과 «계속» 등 */
      else if (st.on) await p.evaluate(() => closeOverlay());       /* 그 밖의 팝업 */
      await p.waitForTimeout(250);
    }
    if (!got) break;
  }
  const diag = await p.evaluate(() => ({ t: +G.t.toFixed(1), taken: G.perksTaken.length,
    left: G.nodes.reduce((s, n) => s + (n.enemies || []).filter(e => !e.dead).length, 0) }));
  chk('⚑ T151 레벨업 표본을 3회 이상 모았다', rolls.length >= 3,
    `${rolls.length}회 · t=${diag.t}s · 보유 ${diag.taken}종 · 남은 적 ${diag.left}마리${exited ? ' · 챕터 종료' : ''}`);
  const mixed = rolls.filter(r => new Set(r.tags).size !== 1);
  chk('⚑⚑⚑ T151 모든 레벨업에서 제시 카드의 등급 태그가 하나다', rolls.length >= 3 && mixed.length === 0,
    `${rolls.length}회 중 섞인 회차 ${mixed.length}회 · ${rolls.map(r => r.tags.join('/')).join(' | ')}`);
  const mixedC = rolls.filter(r => new Set(r.pcs).size !== 1);
  chk('⚑⚑⚑ T151 모든 레벨업에서 테두리색도 하나다', rolls.length >= 3 && mixedC.length === 0,
    `섞인 회차 ${mixedC.length}회`);
  /* ---------- 🔴 T149 특전 카드 문구 실측 (주인 버그 신고 2026-09-05 17:3X) ----------
     주인 원문 «폰트 이상하게 뜨네 맨 위 특전. 수정되게 해 정상적으로» · «이런 거도 그러네».
     `#overlay.ov-full .perk-card .tx` 에 있던 `display:flex` 가 문구를 깨뜨렸다 —
     `.tx` 안의 «텍스트 조각 + <b>» 이 조각마다 익명 flex 아이템이 되어 열로 갈라지고,
     **줄 끝 공백이 폭 0 으로 사라진다**(«치명타 시66%확률로 창1개»).
     ⚑ 이 축은 `textContent` 로는 못 잡는다 — DOM 의 글자는 그대로이고 **렌더만** 깨지기 때문이다.
     그래서 세 가지를 렌더에서 직접 잰다: ⓐ `display` 가 flex/grid 가 아니다
     ⓑ **같은 줄에 있는** 끝 공백의 실측 폭 > 0 (줄바꿈 자리에서 접히는 공백은 정상이라 건너뛴다)
     ⓒ `<b>` 가 세로로 쌓이지 않는다(높이 ≤ line-height × 1.3) ⓓ 문구가 2줄 안에 든다.
     특전 **100종 전부**(⚑ T155)를 390×844·360×800 두 폭에서 카드로 렌더해 잰다. */
  console.log('\n=== 🔴 T149 특전 카드 문구 (100종 전부 · 390 / 360) ===');
  for (const [W, H] of [[390, 844], [360, 800]]) {
    await p.setViewportSize({ width: W, height: H });
    await p.waitForTimeout(200);
    const t149 = await p.evaluate(() => {
      const ov = document.getElementById('overlay');
      const wasOn = ov.classList.contains('on'), keep = ov.innerHTML, keepCls = ov.className;
      let n = 0, flexy = 0, gap = 0, gapZero = 0, tallB = 0, over2 = 0, worst = 0, ex = '';
      for (let i = 0; i < PERKS.length; i += 3) {
        const three = PERKS.slice(i, i + 3);
        openOverlay(three.map((q, j) => perkCardHTML(q, j, 'pick')).join(''), { cls: 'ov-full' });
        for (const c of ov.querySelectorAll('.perk-card')) {
          const tx = c.querySelector('.tx'); if (!tx) continue;
          n++;
          const cs = getComputedStyle(tx), lh = parseFloat(cs.lineHeight);
          if (/flex|grid/.test(cs.display)) { flexy++; if (!ex) ex = tx.textContent.slice(0, 24); }
          for (const b of tx.querySelectorAll('b'))
            if (b.getBoundingClientRect().height > lh * 1.3) { tallB++; if (!ex) ex = tx.textContent.slice(0, 24); }
          /* 끝 공백이 «같은 줄» 에서 폭을 갖는가 */
          for (const nd of tx.childNodes) {
            if (nd.nodeType !== 3) continue;
            const t = nd.nodeValue, m = t.match(/\s+$/); if (!m) continue;
            const nx = nd.nextSibling; if (!nx) continue;
            const r1 = document.createRange(); r1.setStart(nd, t.length - m[0].length); r1.setEnd(nd, t.length);
            const r2 = document.createRange();
            if (nx.nodeType === 3) { r2.setStart(nx, 0); r2.setEnd(nx, 1); } else r2.selectNode(nx);
            const a = r1.getBoundingClientRect(), bb = r2.getBoundingClientRect();
            if (Math.abs(bb.top - a.top) > 2) continue;      /* 줄바꿈 자리 — 접히는 것이 정상 */
            gap++; if (a.width < 0.5) { gapZero++; if (!ex) ex = tx.textContent.slice(0, 24); }
          }
          const rg = document.createRange(); rg.selectNodeContents(tx);
          const lines = rg.getBoundingClientRect().height / lh;
          if (lines > worst) worst = lines;
          if (lines > 2.05) { over2++; if (!ex) ex = tx.textContent.slice(0, 24); }
        }
      }
      ov.className = keepCls; ov.innerHTML = keep; if (!wasOn) closeOverlay();
      return { n, all: PERKS.length, flexy, gap, gapZero, tallB, over2, worst: Math.round(worst * 100) / 100, ex };
    });
    chk(`🔴 T149 [${W}] 특전 ${t149.all}종을 다 카드로 렌더했다`, t149.n === t149.all && t149.all > 0, `${t149.n}/${t149.all}장`);
    chk(`🔴 T149 [${W}] 문구 상자가 flex/grid 가 아니다 (조각이 익명 아이템으로 안 갈라진다)`,
      t149.flexy === 0, `flex/grid ${t149.flexy}장 · 예 «${t149.ex}»`);
    chk(`🔴 T149 [${W}] 같은 줄의 끝 공백이 실제로 폭을 갖는다 (띄어쓰기 소실 0)`,
      t149.gap > 0 && t149.gapZero === 0, `${t149.gap}칸 중 폭 0 인 것 ${t149.gapZero}칸 · 예 «${t149.ex}»`);
    chk(`🔴 T149 [${W}] <b> 가 세로로 쌓이지 않는다 (높이 ≤ line-height×1.3)`,
      t149.tallB === 0, `${t149.tallB}건 · 예 «${t149.ex}»`);
    chk(`🔴 T149 [${W}] 문구가 2줄 안에 든다 (최장 ${t149.worst}줄)`,
      t149.over2 === 0, `2줄 초과 ${t149.over2}장 · 최장 ${t149.worst}줄`);
  }
  await p.setViewportSize({ width: 390, height: 844 });

  /* =============================================================================
     ⚑⚑⚑ T155 (주인 확정 2026-09-05 18:5X) — ① «회피 시 회복» 3종(33/66/100% · 12%)이 카드에 그대로 뜨는가
     ② 소환 문구의 «(공격력의 N%)» 가 **실기기 카드 글자**에도 상수대로 붙는가. 정적 게이트는 소스와
     런타임 배열을 보지만, «사람이 보는 카드에 그 괄호가 실제로 그려지는가» 는 여기서만 확인된다.
     ============================================================================= */
  console.log('\n=== ⚑ T155 특전 카드 — 회피 시 회복 3종 · 소환 «(공격력의 N%)» (실측 렌더) ===');
  const t155 = await p.evaluate(() => {
    const ov = document.getElementById('overlay');
    const wasOn = ov.classList.contains('on'), keep = ov.innerHTML, keepCls = ov.className;
    const pct = r => Math.round(r * 100) + '%';
    const W = [['도끼', R_AXE], ['화살', R_ARROW], ['번개', R_BOLT], ['검기', R_WAVE], ['창', R_SPEAR]];
    const want = d => {                      /* 게이트가 상수로 다시 만든 기대 문구 */
      const hit = W.filter(w => d.indexOf(w[0]) >= 0);
      if (!hit.length) return d;
      if (hit.length > 1) {
        const w = hit.reduce((a, b) => (d.lastIndexOf(a[0]) > d.lastIndexOf(b[0]) ? a : b));
        return d + ' (' + w[0] + ' · 공격력의 ' + pct(w[1]) + ')';
      }
      return d + ' (공격력의 ' + pct(hit[0][1]) + (hit[0][0] === '창' ? ' · ' + SPEAR_PIERCE + '마리 관통' : '') + ')';
    };
    let sum = 0, bad = 0, ex = '', heal = [];
    for (let i = 0; i < PERKS.length; i += 3) {
      const three = PERKS.slice(i, i + 3);
      openOverlay(three.map((q, j) => perkCardHTML(q, j, 'pick')).join(''), { cls: 'ov-full' });
      const cards = [...ov.querySelectorAll('.perk-card')];
      three.forEach((q, j) => {
        const tx = cards[j] && cards[j].querySelector('.tx');
        if (!tx) return;
        const shown = tx.textContent;
        if (/회피 시 회복/.test(q.nm)) heal.push(q.nm + '=' + shown);
        if (!W.some(w => shown.indexOf(w[0]) >= 0)) return;
        sum++;
        /* 카드에 그려진 글자에서 표기를 떼면 나머지가 기대 문구와 같아야 한다 */
        if (shown !== want(shown.replace(/ \((?:[^()]* · )?공격력의 [^()]*\)$/, ''))) { bad++; if (!ex) ex = shown; }
      });
    }
    ov.className = keepCls; ov.innerHTML = keep; if (!wasOn) closeOverlay();
    return { sum, bad, ex, heal, evF: PERK_EVHEAL_F, ch: PERK_EVHEAL_CH, rr: PERK_EVHEAL_R, ll: PERK_EVHEAL_L,
      n: PERKS.length, axe: R_AXE, arrow: R_ARROW, bolt: R_BOLT, spear: R_SPEAR, pierce: SPEAR_PIERCE };
  });
  chk(`⚑ T155 ② 소환 카드 ${t155.sum}장의 «(공격력의 N%)» 가 상수대로 그려진다`,
    t155.sum >= 30 && t155.bad === 0,
    `대상 ${t155.sum}장 · 어긋남 ${t155.bad}장${t155.ex ? ' · 예 «' + t155.ex + '»' : ''} (도끼 ${Math.round(t155.axe * 100)}% · 화살 ${Math.round(t155.arrow * 100)}% · 번개 ${Math.round(t155.bolt * 100)}% · 창 ${Math.round(t155.spear * 100)}%/${t155.pierce}관통)`);
  chk('⚑ T155 ① «회피 시 회복» 3종이 33% · 66% · 확정(100%)으로 카드에 뜬다',
    t155.heal.length === 3 && t155.ch === 0.33 && t155.rr === 0.66 && t155.ll === 1.00 && t155.evF === 0.12 &&
    /회피 시 33% 확률로 최대 체력 12% 회복/.test(t155.heal[0]) &&
    /회피 시 66% 확률로 최대 체력 12% 회복/.test(t155.heal[1]) &&
    /회피 시 최대 체력 12% 회복/.test(t155.heal[2]),
    t155.heal.join(' / '));

  /* =============================================================================
     ⚑⚑ T154 — 특전 선택창 «상단 스탯 줄» 8칸 + 전투 하단 패널 «흡혈» 칸 (주인 지시 2026-09-05 18:3X)
     주인 원문: «이런 식으로 특전 뜰 때 상단에 현재 스탯 옵션들 떠야 함. … 그리고 전투할 때 하단에
     원래 흡혈율 떴어야 했는데 안 뜨더라.» 정적 게이트(verifyT2 ㊸)는 마크업·표를 보지만,
     **실기기에서 몇 칸이 어디에 뜨고 값이 eff* 와 같은가**는 여기서만 확인된다.
     ============================================================================= */
  console.log('\n=== ⚑ T154 특전 선택창 상단 스탯 줄 8칸 · 전투 패널 흡혈 칸 (실측) ===');
  const readRow = () => p.evaluate(() => {
    const cells = [...document.querySelectorAll('#overlay .ov-stats .sc')];
    const fr = document.getElementById('frame').getBoundingClientRect();
    return cells.map(el => {
      const v = el.querySelector('.vl'), r = el.getBoundingClientRect();
      return { id: v ? v.id : '', vl: v ? v.textContent : '', up: v ? v.classList.contains('up') : false,
        icon: !!el.querySelector('.ic svg'),
        /* 겹침은 **px 원값**으로 본다 — % 로 반올림하면 이웃한 칸이 소수점에서 겹쳐 보인다 */
        pxL: r.left, pxR: r.right, pxT: r.top,
        x: +((r.left - fr.left) / fr.width * 100).toFixed(2), y: +((r.top - fr.top) / fr.height * 100).toFixed(2),
        w: +(r.width / fr.width * 100).toFixed(2), h: +(r.height / fr.height * 100).toFixed(2),
        frW: fr.width, frL: fr.left };
    });
  });
  const t154 = await p.evaluate(() => {
    /* 등장 애니메이션(bannerDrop·slideUp)이 도는 중에 재면 배너·카드가 «아직 제자리가 아니다» —
       레이아웃을 재는 절이므로 이 절 동안만 애니메이션을 끈다(측정이 끝나면 지운다). */
    const st = document.createElement('style'); st.id = 't154NoAnim';
    st.textContent = '*{animation:none!important;transition:none!important}';
    document.head.appendChild(st);
    startChapter(1);
    G.paused = true; G.cleared = true;          /* 팝업이 저절로 뜨지 않게 (측정 중 상태 고정) */
    const pl = G.player;
    renderStatsGrid();
    const panel = [...document.querySelectorAll('#stats .st')].map(el => ({
      lb: el.querySelector('.lb').textContent, vl: el.querySelector('.vl').textContent,
      up: el.querySelector('.vl').classList.contains('up'), icon: !!el.querySelector('.ic svg'),
    }));
    /* 레퍼런스와 같은 순서·같은 값 동사 — 하니스가 표를 베끼지 않고 게임의 eff* 를 직접 부른다 */
    const eff = [fmt(effDmg(pl)), effDef(pl).toFixed(1) + '%', effAspd(pl).toFixed(2) + '/s',
      effCounter(pl).toFixed(1) + '%', effCritR(pl).toFixed(0) + '%', effEvade(pl).toFixed(1) + '%',
      effCritF(pl).toFixed(0) + '%', effSteal(pl).toFixed(0) + '%'];
    G.perksTaken = []; openLevelUp();
    const fr = document.getElementById('frame').getBoundingClientRect();
    const rowBox = document.querySelector('#overlay .ov-stats').getBoundingClientRect();
    const cards = [...document.querySelectorAll('#overlay .perk-card')].map(c => c.getBoundingClientRect());
    const banner = document.querySelector('#overlay .ov-banner').getBoundingClientRect();
    return { panel, eff, steal0: pl.steal, paused: G.paused, cards: cards.length,
      row: { x: +((rowBox.left - fr.left) / fr.width * 100).toFixed(2), y: +((rowBox.top - fr.top) / fr.height * 100).toFixed(2),
             w: +(rowBox.width / fr.width * 100).toFixed(2), h: +(rowBox.height / fr.height * 100).toFixed(2) },
      /* 줄이 배너·카드를 밀지 않았는가 (흐름 밖 배치) */
      bannerY: +((banner.top - fr.top) / fr.height * 100).toFixed(2),
      card1Y: cards.length ? +((cards[0].top - fr.top) / fr.height * 100).toFixed(2) : -1,
      rowBelowCard: cards.length ? rowBox.bottom <= cards[0].top + .5 : false };
  });
  const cells390 = await readRow();
  chk('⚑ T154 ② 전투 하단 패널이 8칸 · 8번째가 «흡혈»',
    t154.panel.length === 8 && t154.panel[7].lb === '흡혈',
    `${t154.panel.length}칸 · 8번째 «${t154.panel[7] && t154.panel[7].lb}»`);
  chk('⚑ T154 ② 흡혈이 0 이어도 «0%» 로 뜬다 (숨기지 않는다 — 레퍼런스도 0%)',
    t154.panel[7] && t154.panel[7].vl === '0%' && t154.panel[7].icon && !t154.panel[7].up,
    t154.panel[7] && `«${t154.panel[7].vl}» · 아이콘 ${t154.panel[7].icon} · 초록 ${t154.panel[7].up}`);
  chk('⚑ T154 ① 특전 선택창 맨 위에 스탯 줄 8칸이 뜬다',
    cells390.length === 8 && cells390.every((c, i) => c.id === 'ovs' + i && c.icon),
    `${cells390.length}칸 · id ${cells390.map(c => c.id).join(',')}`);
  chk('⚑ T154 ① 8칸 값이 전부 eff* 와 같다 (전투 패널과 같은 숫자)',
    cells390.length === 8 && cells390.every((c, i) => c.vl === t154.eff[i]),
    cells390.map((c, i) => `${c.vl}${c.vl === t154.eff[i] ? '' : '≠' + t154.eff[i]}`).join(' · '));
  chk('⚑ T154 ① 줄이 전투 하단 패널과 같은 값을 보여준다 (두 화면이 안 갈라진다)',
    cells390.length === 8 && cells390.every((c, i) => c.vl === t154.panel[i].vl),
    cells390.map(c => c.vl).join(' · '));
  chk('⚑ T154 ① 줄 자리 = ref-layout ⑦ «상단 스탯 줄(8칸) x0 y4 w100 h6» (±3%p)',
    Math.abs(t154.row.x - 0) <= 3 && Math.abs(t154.row.y - 4) <= 3 &&
    Math.abs(t154.row.w - 100) <= 3 && Math.abs(t154.row.h - 6) <= 3,
    `x${t154.row.x} y${t154.row.y} w${t154.row.w} h${t154.row.h}`);
  chk('⚑ T154 ① 줄이 배너·카드를 밀지 않았다 (배너 y26.5 · 카드1 y36.5 그대로 · 줄이 카드 위)',
    Math.abs(t154.bannerY - 26.5) <= 3 && Math.abs(t154.card1Y - 36.5) <= 3 && t154.rowBelowCard && t154.cards === 3,
    `배너 y${t154.bannerY} · 카드1 y${t154.card1Y} · 카드 ${t154.cards}장`);
  {
    const one = cells390.every(c => Math.abs(c.pxT - cells390[0].pxT) < .6);
    let ovl = 0;
    for (let i = 0; i < cells390.length; i++) for (let j = i + 1; j < cells390.length; j++) {
      const a = cells390[i], b = cells390[j];
      if (!(a.pxR <= b.pxL + .01 || b.pxR <= a.pxL + .01)) ovl++;
    }
    const inFrame = cells390.every(c => c.pxL >= c.frL - .01 && c.pxR <= c.frL + c.frW + .01);
    chk('⚑ T154 ③ 390px — 8칸이 한 줄 · 겹침 0 · 프레임 안', one && ovl === 0 && inFrame,
      `한 줄 ${one} · 겹침 ${ovl} · 칸 폭 ${cells390[0].w}%`);
  }
  /* 팝업이 열려 있는 동안 값이 고정인가 (T79 시간 정지) */
  const froze = await p.evaluate(async () => {
    const before = [...document.querySelectorAll('#overlay .ov-stats .vl')].map(v => v.textContent);
    const t0 = G.t; await new Promise(r => setTimeout(r, 420));
    return { same: [...document.querySelectorAll('#overlay .ov-stats .vl')].map(v => v.textContent).join('|') === before.join('|'),
      paused: G.paused, dt: +(G.t - t0).toFixed(4) };
  });
  chk('⚑ T154 ① 팝업이 열려 있는 동안 값이 고정 (시간 정지 · T79)', froze.same && froze.paused === true && froze.dt === 0,
    `paused=${froze.paused} · Δt ${froze.dt}`);
  /* 360×800 — 8칸이 그대로 한 줄에 들고 겹치지 않는가 */
  await p.setViewportSize({ width: 360, height: 800 }); await p.waitForTimeout(220);
  await p.evaluate(() => { closeOverlay(); G.paused = true; G.perksTaken = []; openLevelUp(); });
  await p.waitForTimeout(180);
  const cells360 = await readRow();
  {
    const one = cells360.length === 8 && cells360.every(c => Math.abs(c.pxT - cells360[0].pxT) < .6);
    let ovl = 0;
    for (let i = 0; i < cells360.length; i++) for (let j = i + 1; j < cells360.length; j++) {
      const a = cells360[i], b = cells360[j];
      if (!(a.pxR <= b.pxL + .01 || b.pxR <= a.pxL + .01)) ovl++;
    }
    const inFrame = cells360.every(c => c.pxL >= c.frL - .01 && c.pxR <= c.frL + c.frW + .01);
    chk('⚑ T154 ③ 360px — 8칸이 한 줄 · 겹침 0 · 프레임 안', one && ovl === 0 && inFrame,
      `${cells360.length}칸 · 한 줄 ${one} · 겹침 ${ovl} · 칸 폭 ${(cells360[0] || {}).w}%`);
  }
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(220);
  /* 흡혈을 인위로 8 로 두면 두 화면 다 «8%» + 초록 (T145 장비 옵션 7번이 들어온 상태) */
  const st8 = await p.evaluate(() => {
    closeOverlay();
    G.player.steal = 8; renderStatsGrid();
    const panel = document.querySelectorAll('#stats .st')[7].querySelector('.vl');
    G.paused = true; G.perksTaken = []; openLevelUp();
    const row = document.getElementById('ovs7');
    return { pv: panel.textContent, pup: panel.classList.contains('up'),
      rv: row ? row.textContent : '', rup: row ? row.classList.contains('up') : false };
  });
  chk('⚑ T154 ③ 흡혈을 8 로 두면 전투 패널·상단 줄 둘 다 «8%» + 초록',
    st8.pv === '8%' && st8.pup && st8.rv === '8%' && st8.rup,
    `패널 «${st8.pv}»(초록 ${st8.pup}) · 상단 줄 «${st8.rv}»(초록 ${st8.rup})`);
  /* 위임 — 악마 카드 · 📘 보유 특전 목록에도 같은 줄 */
  const alsoOn = await p.evaluate(() => {
    const n = () => document.querySelectorAll('#overlay .ov-stats .sc').length;
    closeOverlay(); G.player.steal = 0;
    G.paused = true; G.perksTaken = [PERKS[0]]; openPerkBook();
    const book = n();
    closeOverlay();
    G.paused = true; G.perksTaken = PERKS.filter(k => k.g !== 2).slice(0, 2); openDevil();
    const devilCards = document.querySelectorAll('#overlay .perk-card').length;
    const devil = n(), hasYes = !!document.getElementById('dYes');
    closeOverlay();
    const st = document.getElementById('t154NoAnim'); if (st) st.remove();   /* 애니메이션 복구 */
    return { book, devil, devilCards, hasYes };
  });
  chk('⚑ T154 ① 📘 보유 특전 목록에도 같은 줄 8칸 (위임)', alsoOn.book === 8, `${alsoOn.book}칸`);
  chk('⚑ T154 ① 악마 카드 화면에도 같은 줄 8칸 (위임 · 카드 1장은 T150 그대로)',
    alsoOn.devil === 8 && alsoOn.devilCards === 1 && alsoOn.hasYes,
    `${alsoOn.devil}칸 · 카드 ${alsoOn.devilCards}장`);

  /* =============================================================================
     ⚑⚑⚑ T156 — 특전 선택창 «상단 스탯 줄» 아이콘 2배 (주인 지시 2026-09-05 19:2X)
     주인 원문: «특전 선택할 때 공속 치명확률 이런 옵션 상단에 뜨는 거 그거 아이콘 크기 2배로 키워».
     «2배» 는 CSS 숫자가 아니라 **실기기 rect** 로만 확인된다 — `.gicon` 이 1em 이라 칸의 font-size 를
     물려받는데, 그 사이에 `line-height`·`flex:none`·부모의 `overflow:hidden` 이 끼어 있어
     «CSS 를 32 로 적었다» 가 «화면에서 32px 로 그려졌다» 를 보장하지 않는다.
     ⓐ 종전 실측값 16.0px 을 기준선으로 못박는다(T154 회차 실측 · ref-layout ⚑T156 표에 남겼다).
     ⓑ 커진 뒤에도 8칸이 한 줄 · 겹침 0 · 360px 에서 잘림 0 이어야 한다 — 주인 조항
        «넘치면 칸 간격을 줄이지 아이콘을 줄이지 말 것» 을 지키려면 아이콘이 줄었는지를 먼저 봐야 한다.
     ⓒ 전투 하단 패널 아이콘(`.st .ic` 24px)은 **대상이 아니다** — 같이 커지면 빨강.
     ============================================================================= */
  console.log('\n=== ⚑ T156 특전 선택창 상단 스탯 아이콘 2배 (실측 px) ===');
  const T156_ICON_WAS = 16;   /* T154 회차 실측 (390·360 둘 다 16.0px · `.ov-stats .sc .ic{font-size:16px}`) */
  const readIcons = () => p.evaluate(() => {
    const cells = [...document.querySelectorAll('#overlay .ov-stats .sc')];
    const fr = document.getElementById('frame').getBoundingClientRect();
    const m = cells.map(el => {
      const ic = el.querySelector('.ic svg'), vl = el.querySelector('.vl');
      const c = el.getBoundingClientRect(), i = ic.getBoundingClientRect(), v = vl.getBoundingClientRect();
      return { c, i, v };
    });
    let ovl = 0;
    for (let a = 0; a < m.length; a++) for (let b = a + 1; b < m.length; b++)
      if (!(m[a].c.right <= m[b].c.left + .01 || m[b].c.right <= m[a].c.left + .01)) ovl++;
    return {
      n: cells.length,
      icH: +Math.min(...m.map(x => x.i.height)).toFixed(2),
      icW: +Math.min(...m.map(x => x.i.width)).toFixed(2),
      cellH: +m[0].c.height.toFixed(2), cellW: +m[0].c.width.toFixed(2),
      /* 한 줄 = 8칸의 top 이 같다 */
      oneLine: m.every(x => Math.abs(x.c.top - m[0].c.top) < .6),
      ovl,
      /* 잘림 0 = 아이콘·값이 자기 칸(overflow:hidden) 안에 있고 칸이 프레임 안에 있다 */
      clip: m.filter(x =>
        x.i.left < x.c.left - .01 || x.i.right > x.c.right + .01 ||
        x.i.top < x.c.top - .01 || x.v.bottom > x.c.bottom + .01).length,
      /* 아이콘 ↔ 값 세로 겹침 (주인 «값 글자는 그대로 두되 겹치지 않게») */
      vOverlap: m.filter(x => x.i.bottom > x.v.top + .01).length,
      inFrame: m.every(x => x.c.left >= fr.left - .01 && x.c.right <= fr.right + .01),
      /* 값 글자는 안 커졌다 (주인 «값 글자는 그대로») */
      vlH: +m[0].v.height.toFixed(2),
      panelIcH: +(document.querySelector('#stats .st .ic svg') || { getBoundingClientRect: () => ({ height: -1 }) })
        .getBoundingClientRect().height.toFixed(2),
    };
  });
  await p.evaluate(() => {
    const st = document.createElement('style'); st.id = 't156NoAnim';
    st.textContent = '*{animation:none!important;transition:none!important}';
    document.head.appendChild(st);
    if (document.getElementById('overlay').classList.contains('on')) closeOverlay();
    G.paused = true; G.cleared = true; G.perksTaken = []; openLevelUp();
  });
  await p.waitForTimeout(180);
  const ic390 = await readIcons();
  chk(`⚑ T156 390px — 상단 스탯 아이콘 rect 높이 ≥ 종전 ×1.9 (${T156_ICON_WAS} → ${(T156_ICON_WAS * 1.9).toFixed(1)}px 이상)`,
    ic390.n === 8 && ic390.icH >= T156_ICON_WAS * 1.9 && ic390.icW >= T156_ICON_WAS * 1.9,
    `${ic390.icW}×${ic390.icH}px (종전 ${T156_ICON_WAS} 의 ×${(ic390.icH / T156_ICON_WAS).toFixed(2)})`);
  chk('⚑ T156 390px — 8칸 한 줄 · 겹침 0 · 잘림 0 · 프레임 안',
    ic390.oneLine && ic390.ovl === 0 && ic390.clip === 0 && ic390.inFrame,
    `한 줄 ${ic390.oneLine} · 겹침 ${ic390.ovl} · 잘림 ${ic390.clip} · 칸 ${ic390.cellW}×${ic390.cellH}px`);
  chk('⚑ T156 값 글자는 그대로 (12.09px) · 아이콘 아래에서 안 겹친다',
    Math.abs(ic390.vlH - 12.09) < 1 && ic390.vOverlap === 0,
    `값 ${ic390.vlH}px · 세로 겹침 ${ic390.vOverlap}칸`);
  chk('⚑ T156 전투 하단 패널 아이콘은 대상이 아니다 (24px 그대로)',
    Math.abs(ic390.panelIcH - 24) < .6, `${ic390.panelIcH}px`);
  await p.setViewportSize({ width: 360, height: 800 }); await p.waitForTimeout(220);
  await p.evaluate(() => { closeOverlay(); G.paused = true; G.perksTaken = []; openLevelUp(); });
  await p.waitForTimeout(180);
  const ic360 = await readIcons();
  chk('⚑ T156 360px — 아이콘 ×1.9 이상 유지 · 8칸 한 줄 · 겹침 0 · 잘림 0 (주인 «아이콘을 줄이지 말 것»)',
    ic360.n === 8 && ic360.icH >= T156_ICON_WAS * 1.9 && ic360.oneLine &&
    ic360.ovl === 0 && ic360.clip === 0 && ic360.vOverlap === 0 && ic360.inFrame,
    `${ic360.icW}×${ic360.icH}px · 한 줄 ${ic360.oneLine} · 겹침 ${ic360.ovl} · 잘림 ${ic360.clip} · 칸 폭 ${ic360.cellW}px`);
  /* 음성 — 아이콘을 종전 16px 로 되돌리면 위 단언이 실제로 빨개지는가 (게이트가 살아 있다는 증거) */
  const neg = await p.evaluate((was) => {
    const st = document.createElement('style'); st.id = 't156Neg';
    st.textContent = `#overlay .ov-stats .sc .ic{font-size:${was}px!important}`;
    document.head.appendChild(st);
    const h = document.querySelector('#overlay .ov-stats .sc .ic svg').getBoundingClientRect().height;
    st.remove();
    const back = document.querySelector('#overlay .ov-stats .sc .ic svg').getBoundingClientRect().height;
    return { h: +h.toFixed(2), back: +back.toFixed(2) };
  }, T156_ICON_WAS);
  chk('⚑ T156 음성 — 아이콘을 16px 로 되돌리면 ×1.9 단언이 빨개진다 (게이트가 살아 있다)',
    neg.h < T156_ICON_WAS * 1.9 && neg.back >= T156_ICON_WAS * 1.9,
    `되돌림 ${neg.h}px → 복구 ${neg.back}px`);
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(220);
  await p.evaluate(() => {
    closeOverlay();
    const st = document.getElementById('t156NoAnim'); if (st) st.remove();
  });

  /* ================= ⚑⚑⚑ T159 — 전투 카메라 줌 실측 (주인 지시 2026-09-05 19:5X) =================
     주인 원문 «캐릭터랑 적들 한 1.5배는 더 커 보여야 하는데 … 카메라를 그렇게 되게 하던지».
     여기서 재는 것은 **캔버스 픽셀**이다 — 스프라이트는 DOM 이 아니라서 rect 가 없다.
     같은 `drawCharOn` 을 오프스크린에 **줌 없이** 한 번 더 그려 «종전 크기» 를 만들고,
     실제 화면에서 잰 높이와 나눠 배율을 낸다(색 일치 픽셀의 바운딩 상자).
     ⓐ 플레이어·적 스프라이트 높이 ≥ 종전 ×1.45  ⓑ 프레임 % 가 `docs/ui/ref-layout.md` ② 인게임 행의
     레퍼런스 % ±3%p  ⓒ 데미지 숫자·HP바 글자 가독  ⓓ 360×800 에서 캐릭터가 하단 패널에 안 가림
     ⓔ 보스(1.7배)가 줌 뒤에도 화면 안. */
  /* ⚑ 리베이스 합류 — 앞 절(T156)이 뷰포트를 바꿔 놓을 수 있으므로 390×844 를 명시하고 시작한다 */
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(220);
  console.log('\n=== ⚑ T159 전투 카메라 줌 (캔버스 실측) ===');
  const Z = await p.evaluate(() => {
    /* ---- 재현 가능한 한 프레임 ---- */
    closeOverlay();
    G.paused = true; G.shake = 0; G.over = false;
    G.pprojs = []; G.arrows = []; G.bolts = []; G.parts = []; G.texts = []; G.reaps = [];
    const pl = G.player; pl.hitT = 0; pl.strikeT = 0; pl.walking = false;
    /* 카메라가 «따라가는 상태»(cam>0)로 만들어 둔다 — 챕터 초입(worldX<150)에는 cam 이 0 에 눌려 있어
       플레이어가 화면 왼쪽 끝에 반쯤 걸린다(그때는 줌 기준점과 실제 위치가 다르다). 그리기 전용 위치 지정이다. */
    pl.worldX = 400;
    /* 적 하나를 플레이어 앞 세워 둔다(월드 단위 150 — 그리기와 무관한 위치 지정일 뿐이다) */
    const node = G.nodes.find(n => n.enemies.length) || G.nodes[0];
    for (const n of G.nodes) for (const e of n.enemies) e.hp = 0;
    const e0 = node.enemies[0];
    e0.hp = e0.maxHp; e0.hitT = 0; e0.strikeT = 0; e0.stun = 0; e0.isBoss = false;
    e0.skin = { body: '#6B7F5A', hat: 'bald', weapon: 'sword' };   /* 민머리 = 모자색 잡음 없음 */
    e0.worldX = pl.worldX + 150;
    drawScene();

    const dpr = cv.width / cv.clientWidth;
    const scLay = cv.clientWidth / LW;              /* 레이아웃 1 단위 = CSS px */
    const gy = LH * 0.576;
    const toCssX = lx => (PLAYER_SCREEN_X + (lx - PLAYER_SCREEN_X) * CAM_ZOOM) * scLay;

    /* 색 일치 픽셀의 바운딩 상자 (CSS px). cols = 6자리 대문자 HEX */
    const box = (c2, g2, cols, cxCss, halfCss, den) => {
      const x0 = Math.max(0, Math.round((cxCss - halfCss) * den));
      const x1 = Math.min(c2.width, Math.round((cxCss + halfCss) * den));
      if (x1 <= x0) return null;
      const w = x1 - x0, d = g2.getImageData(x0, 0, w, c2.height).data;
      const set = new Set(cols);
      let top = 1e9, bot = -1e9, l = 1e9, r = -1e9;
      for (let y = 0; y < c2.height; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (d[i + 3] < 250) continue;
        const hex = ((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]).toString(16).padStart(6, '0').toUpperCase();
        if (!set.has(hex)) continue;
        if (y < top) top = y; if (y > bot) bot = y; if (x < l) l = x; if (x > r) r = x;
      }
      return top > bot ? null : { h: (bot - top + 1) / den, w: (r - l + 1) / den,
        top: top / den, bot: bot / den, cx: (x0 + (l + r) / 2) / den };
    };
    /* 같은 옵션을 줌 없이 오프스크린에 그려 «종전 크기»(레이아웃 단위)를 만든다 */
    const refH = (opts, cols) => {
      const oc = document.createElement('canvas'); oc.width = 400; oc.height = 400;
      const g2 = oc.getContext('2d');
      drawCharOn(g2, 200, 300, opts);
      const b = box(oc, g2, cols, 200, 120, 1);
      return b ? b.h : null;
    };

    const PCOL = ['5E6A75', 'F6D7A7', '3E6FD8'];      /* 몸통 · 살색 · 투구 장식(플레이어 전용 색) */
    const ECOL = ['6B7F5A', 'F6D7A7'];                /* 적 몸통 · 살색 */
    const pOpt = { s: 1.05, f: 1, body: '#5E6A75', hat: 'helmet', weapon: 'sword' };
    const eOpt = { s: 1, f: -1, body: '#6B7F5A', hat: 'bald', weapon: 'sword' };

    /* 실제로 그려진 자리에서 잰다 — 레이아웃 x = worldX - cam (cam 은 전역) */
    const pCss = toCssX(pl.worldX - cam), eCss = toCssX(e0.worldX - cam);
    const pNow = box(cv, ctx, PCOL, pCss, 60, dpr);
    const eNow = box(cv, ctx, ECOL, eCss, 60, dpr);
    const pRef = refH(pOpt, PCOL), eRef = refH(eOpt, ECOL);

    const f = document.getElementById('frame').getBoundingClientRect();
    const cvr = cv.getBoundingClientRect();
    return {
      zoom: CAM_ZOOM, scLay, dpr, viewScale,
      player: pNow, enemy: eNow,
      /* 종전(줌 없음) CSS px 높이 = 레이아웃 높이 × scLay */
      playerPre: pRef === null ? null : pRef * scLay,
      enemyPre: eRef === null ? null : eRef * scLay,
      frameH: f.height, cvTop: cvr.top - f.top, cvH: cvr.height,
      /* 실효 글자 크기(CSS px) — 데미지 숫자 17 · 큰 숫자 26 · HP바 글자(클램프 뒤) */
      dmgPx: 17 * viewScale, dmgBigPx: 26 * viewScale,
      hpFontPx: Math.max(10.5, 10 / Math.max(viewScale, 0.001)) * viewScale,
      hudTop: document.getElementById('hud').getBoundingClientRect().top - f.top,
    };
  });
  const rPl = Z.player && Z.playerPre ? Z.player.h / Z.playerPre : 0;
  const rEn = Z.enemy && Z.enemyPre ? Z.enemy.h / Z.enemyPre : 0;
  chk('⚑ T159 ① 플레이어 스프라이트 높이 ≥ 종전 ×1.45', rPl >= 1.45,
    `${(Z.playerPre || 0).toFixed(1)} → ${(Z.player ? Z.player.h : 0).toFixed(1)}px (×${rPl.toFixed(3)} · CAM_ZOOM ${Z.zoom})`);
  chk('⚑ T159 ① 적 스프라이트 높이 ≥ 종전 ×1.45', rEn >= 1.45,
    `${(Z.enemyPre || 0).toFixed(1)} → ${(Z.enemy ? Z.enemy.h : 0).toFixed(1)}px (×${rEn.toFixed(3)})`);
  /* ② 레퍼런스 % 대조 — `docs/ui/ref-layout.md` ② 인게임 «플레이어 높이 9.0 · 적 높이 7.5»(±3%p) */
  const pPct = Z.player ? Z.player.h / Z.frameH * 100 : 0, ePct = Z.enemy ? Z.enemy.h / Z.frameH * 100 : 0;
  chk('⚑ T159 ② 플레이어 높이 % 가 레퍼런스 9.0 ±3%p', Math.abs(pPct - 9.0) <= 3,
    `실측 ${pPct.toFixed(1)}% (레퍼런스 «메인 게임화면.jpg» 투구 장식~발밑 9.0%)`);
  chk('⚑ T159 ② 적(민머리) 높이 % 가 레퍼런스 7.5 ±3%p', Math.abs(ePct - 7.5) <= 3,
    `실측 ${ePct.toFixed(1)}% (레퍼런스 «메인 게임화면_적발견.jpg» 민머리 적 7.5% · 모자 적은 9.0%)`);
  /* ③ 가독 — 데미지 숫자·HP바 글자 */
  chk('⚑ T159 ③ 데미지 숫자·HP바 글자 가독 (실효 ≥ 10 CSS px)',
    Z.dmgPx >= 12 && Z.hpFontPx >= 10,
    `데미지 ${Z.dmgPx.toFixed(1)}px · 큰 숫자 ${Z.dmgBigPx.toFixed(1)}px · HP바 글자 ${Z.hpFontPx.toFixed(1)}px`);
  /* ④ 하단 패널에 안 가림 — 캐릭터 아래끝(HP/실드 라벨 포함)이 #hud 위 */
  const footBot = Z.player ? Z.cvTop + Z.player.bot + 29 * Z.scLay * Z.zoom : 1e9;
  chk('⚑ T159 ④ 390×844 — 캐릭터·발밑 라벨이 하단 패널 위에 있다', footBot < Z.hudTop,
    `발밑 라벨 끝 ${footBot.toFixed(0)}px < 하단 패널 ${Z.hudTop.toFixed(0)}px`);
  chk('⚑ T159 ④ 캐릭터가 캔버스 위로 안 잘린다', Z.player ? Z.player.top > 0.5 : false,
    `머리 끝 ${(Z.player ? Z.player.top : -1).toFixed(1)}px (캔버스 상단 기준)`);

  /* ⑤ 보스(1.7배)가 줌 뒤에도 화면 안 · ⑥ 360×800 재확인 */
  const Zb = await p.evaluate(() => {
    const node = G.nodes.find(n => n.enemies.length) || G.nodes[0];
    const e0 = node.enemies[0];
    e0.isBoss = true; e0.skin = { body: '#5A3247', hat: 'horns', weapon: 'axe' };
    e0.worldX = G.player.worldX + 150;
    drawScene();
    const dpr = cv.width / cv.clientWidth, scLay = cv.clientWidth / LW;
    const cx = (PLAYER_SCREEN_X + (e0.worldX - cam - PLAYER_SCREEN_X) * CAM_ZOOM) * scLay;
    const x0 = Math.max(0, Math.round((cx - 90) * dpr)), x1 = Math.min(cv.width, Math.round((cx + 90) * dpr));
    const w = x1 - x0, d = ctx.getImageData(x0, 0, w, cv.height).data;
    const set = new Set(['5A3247', 'F6D7A7', 'D84343']);   /* 보스 몸통 · 살색 · 뿔 */
    let top = 1e9, bot = -1e9;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] < 250) continue;
      const hex = ((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]).toString(16).padStart(6, '0').toUpperCase();
      if (!set.has(hex)) continue;
      if (y < top) top = y; if (y > bot) bot = y;
    }
    return { top: top / dpr, bot: bot / dpr, cvH: cv.clientHeight, found: top <= bot };
  });
  chk('⚑ T159 ⑤ 보스(1.7배)가 줌 뒤에도 화면 안에 들어온다', Zb.found && Zb.top > 0.5 && Zb.bot < Zb.cvH,
    `보스 머리 ${Zb.top.toFixed(1)}px ~ 발밑 ${Zb.bot.toFixed(1)}px / 캔버스 ${Zb.cvH.toFixed(0)}px`);

  await p.setViewportSize({ width: 360, height: 800 }); await p.waitForTimeout(260);
  const Z360 = await p.evaluate(() => {
    const node = G.nodes.find(n => n.enemies.length) || G.nodes[0];
    const e0 = node.enemies[0];
    e0.isBoss = false; e0.skin = { body: '#6B7F5A', hat: 'bald', weapon: 'sword' };
    drawScene();
    const dpr = cv.width / cv.clientWidth, scLay = cv.clientWidth / LW;
    const cx = (PLAYER_SCREEN_X + (G.player.worldX - cam - PLAYER_SCREEN_X) * CAM_ZOOM) * scLay;
    const x0 = Math.max(0, Math.round((cx - 60) * dpr)), x1 = Math.min(cv.width, Math.round((cx + 60) * dpr));
    const w = x1 - x0, d = ctx.getImageData(x0, 0, w, cv.height).data;
    const set = new Set(['5E6A75', 'F6D7A7', '3E6FD8']);
    let top = 1e9, bot = -1e9;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] < 250) continue;
      const hex = ((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]).toString(16).padStart(6, '0').toUpperCase();
      if (!set.has(hex)) continue;
      if (y < top) top = y; if (y > bot) bot = y;
    }
    const f = document.getElementById('frame').getBoundingClientRect();
    const cvr = cv.getBoundingClientRect();
    return { top: top / dpr, bot: bot / dpr, cvTop: cvr.top - f.top, scLay,
      hudTop: document.getElementById('hud').getBoundingClientRect().top - f.top,
      h: (bot - top + 1) / dpr, frameH: f.height, found: top <= bot };
  });
  const foot360 = Z360.cvTop + Z360.bot + 29 * Z360.scLay * Z.zoom;
  chk('⚑ T159 ⑥ 360×800 — 캐릭터가 잘리지도, 하단 패널에 가리지도 않는다',
    Z360.found && Z360.top > 0.5 && foot360 < Z360.hudTop,
    `머리 ${Z360.top.toFixed(1)}px · 발밑 라벨 끝 ${foot360.toFixed(0)} < 패널 ${Z360.hudTop.toFixed(0)} · 높이 ${(Z360.h / Z360.frameH * 100).toFixed(1)}%`);
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(220);
  console.log(`  [T159 크기표] 플레이어 ${(Z.playerPre || 0).toFixed(1)} → ${(Z.player ? Z.player.h : 0).toFixed(1)}px (${pPct.toFixed(1)}% 프레임) · ` +
    `적 ${(Z.enemyPre || 0).toFixed(1)} → ${(Z.enemy ? Z.enemy.h : 0).toFixed(1)}px (${ePct.toFixed(1)}%) · viewScale ${Z.viewScale.toFixed(3)}`);

  /* ---------- ⚑⚑ T167 이벤트 팝업 «스크롤 없음» (주인 지적 2026-09-05 23:2X) ----------
     주인 원문 «악마와의 거래가 스크롤 있게 되어 있네, 참고 레퍼런스에 이렇게 안 되어 있을 텐데».
     ⚠ 재는 시점 — 팝업은 `popIn`(상자 scale .78→1) 과 `slideUp`(카드·버튼 translateY 26px) 로 등장한다.
     그 동안에는 아래로 26px 이 삐져나와 scrollHeight 가 잠깐 부풀므로(측정 초기에 실제로 427>414 가 나왔다)
     **애니메이션이 끝난 뒤**에 잰다. 상자 자체는 `overflow:visible` 이라 그 순간에도 스크롤은 못 생긴다. */
  console.log('\n=== ⚑ T167 이벤트 팝업(악마·쉼터·천사) 스크롤 없음 ===');
  const evProbe = () => {
    const ov = document.getElementById('overlay');
    const inner = ov.querySelector('.ov-inner');
    if (!inner) return { none: true };
    const f = document.getElementById('frame').getBoundingClientRect();
    const r = inner.getBoundingClientRect();
    const btns = [...ov.querySelectorAll('.choice-btn')].map(b => {
      const q = b.getBoundingClientRect();
      return { inFrame: q.top >= f.top - .5 && q.bottom <= f.bottom + .5,
        inBox: q.top >= r.top - .5 && q.bottom <= r.bottom + .5 };
    });
    return {
      sH: inner.scrollHeight, cH: inner.clientHeight, ovf: getComputedStyle(inner).overflowY,
      boxTop: +(r.top - f.top).toFixed(1), boxBot: +(r.bottom - f.top).toFixed(1), boxH: +r.height.toFixed(1),
      fits: r.top >= f.top - .5 && r.bottom <= f.bottom + .5,
      cards: ov.querySelectorAll('.perk-card').length, stats: ov.querySelectorAll('.ov-stats .sc').length,
      btnN: btns.length, btnOk: btns.every(x => x.inFrame && x.inBox),
    };
  };
  for (const vp of [{ w: 390, h: 844 }, { w: 360, h: 800 }]) {
    await p.setViewportSize({ width: vp.w, height: vp.h }); await p.waitForTimeout(280);
    for (const [ko, fn, wantCard] of [['악마', 'openDevil', 1], ['쉼터', 'openRest', 0], ['천사', 'openAngel', 0]]) {
      await p.evaluate((f) => { closeOverlay(); if (f === 'openDevil') G.perksTaken = []; window[f](); }, fn);
      await p.waitForTimeout(700);
      const m = await p.evaluate(evProbe);
      const good = !m.none && m.sH <= m.cH + 1 && m.ovf === 'visible' && m.fits && m.btnN === 2 && m.btnOk
        && m.cards === wantCard;
      chk(`⚑ T167 ${ko} 팝업 ${vp.w}px — scrollHeight ≤ clientHeight · 버튼 2개 화면 안 · 카드 ${wantCard}장`,
        good, m.none ? '팝업이 안 열렸다' :
        `내용 ${m.sH} ≤ 상자 ${m.cH} · overflow ${m.ovf} · 상자 y${m.boxTop}~${m.boxBot}(h${m.boxH}) · 카드 ${m.cards} · 버튼 ${m.btnN}(${m.btnOk ? '전부 안' : '밖으로 나감'})`);
      if (fn === 'openDevil') chk(`⚑ T167 ${ko} 팝업 ${vp.w}px — 상단 스탯 줄 8칸 유지 (T154 회귀 방지)`,
        m.stats === 8, `${m.stats}칸`);
    }
    /* 최악 조건 — 가장 긴 전설 특전 문구(2줄)를 악마 카드에 강제해도 안 넘친다 */
    const worst = await p.evaluate(() => {
      closeOverlay();
      const leg = PERKS.filter(x => x.g === 2);
      const lng = leg.slice().sort((a, b) => b.tx.replace(/<[^>]*>/g, '').length - a.tx.replace(/<[^>]*>/g, '').length)[0];
      G.perksTaken = []; window.offerDevilPerk = () => lng; openDevil();
      return lng.tx.replace(/<[^>]*>/g, '');
    });
    await p.waitForTimeout(700);
    const mw = await p.evaluate(evProbe);
    chk(`⚑ T167 악마 팝업 ${vp.w}px — 가장 긴 전설 문구에서도 스크롤 0 · 버튼 2개 화면 안`,
      !mw.none && mw.sH <= mw.cH + 1 && mw.fits && mw.btnN === 2 && mw.btnOk,
      `«${worst.slice(0, 34)}…» 내용 ${mw.sH} ≤ 상자 ${mw.cH} · 상자 y${mw.boxTop}~${mw.boxBot}`);
    await p.evaluate(() => closeOverlay());
  }
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(220);

  /* ══════ ⚑⚑⚑ T163 적 간격 44 (주인 확정 2026-09-05 22:1X) ══════
     ④ 가 요구한 셋을 실제 렌더에서 잰다: 적 rect 간격 ≈ ENEMY_GAP × 줌 · 발밑 HP바 겹침 0 · pageerror 0. */
  const GAP = await p.evaluate(() => {
    /* ⚑ 이 스위트는 150개 넘는 검사를 거치며 적을 죽이고 옮긴다(T159 는 0번 적을 보스로 만들어
       worldX 를 플레이어+150 으로 밀어 놓는다). 배치 간격은 **갓 만든 챕터**에서만 뜻이 있으므로
       여기서 챕터를 새로 시작해 그 배치를 읽는다 — 이 절이 이 스위트의 마지막 검사다. */
    startChapter(5);
    const waves = G.nodes.filter(n => n.type === 'wave' && n.enemies.length >= 4);
    const node = waves[0];
    const es = node.enemies.slice(0, 4);
    /* 월드 좌표 간격 — 배치가 ENEMY_GAP 그대로인가 */
    const world = [];
    for (let i = 1; i < es.length; i++) world.push(es[i].worldX - es[i - 1].worldX);
    /* 화면 좌표 간격 — 줌이 곱해진 자리 */
    const scLay = cv.clientWidth / LW;
    const sx = e => (PLAYER_SCREEN_X + (e.worldX - cam - PLAYER_SCREEN_X) * CAM_ZOOM) * scLay;
    const screen = [];
    for (let i = 1; i < es.length; i++) screen.push(sx(es[i]) - sx(es[i - 1]));
    return { world, screen, gap: ENEMY_GAP, zoom: CAM_ZOOM, scLay,
      hpw: HPBAR_W, hpwBoss: HPBAR_W_BOSS, n: es.length };
  });
  chk('⚑ T163 ① 웨이브 안 적의 월드 간격이 ENEMY_GAP(44) 그대로다',
    GAP.gap === 44 && GAP.world.length > 0 && GAP.world.every(d => Math.abs(d - 44) < 1e-6),
    `간격 ${GAP.world.map(d => d.toFixed(0)).join('·')} (상수 ${GAP.gap} · 표본 ${GAP.n}마리)`);
  {
    const want = GAP.gap * GAP.zoom * GAP.scLay;
    const okScr = GAP.screen.length > 0 && GAP.screen.every(d => Math.abs(d - want) < 0.5);
    chk('⚑ T163 ② 화면 간격 = 간격 × 줌 (월드 단위가 그리기 배율과 따로 논다)', okScr,
      `실측 ${GAP.screen.map(d => d.toFixed(1)).join('·')}px · 기대 ${want.toFixed(1)}px (44 × ${GAP.zoom} × ${GAP.scLay.toFixed(3)})`);
  }
  chk('⚑ T163 ③ 적 발밑 HP바가 옆 적과 겹치지 않는다 (폭 < 간격)',
    GAP.hpw > 0 && GAP.hpw < GAP.gap,
    `HP바 폭 ${GAP.hpw} < 간격 ${GAP.gap} (여백 ${GAP.gap - GAP.hpw} · 보스 ${GAP.hpwBoss})`);

  chk('pageerror 0', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close();
  const bad = R.filter(r => !r.c);
  console.log(`\n[②] 통과 ${R.length - bad.length} · 불합격 ${bad.length}`);
  if (bad.length) console.log('불합격:', bad.map(x => x.n + (x.d ? ` (${x.d})` : '')).join(' / '));
  process.exit(bad.length ? 1 : 0);
})();
