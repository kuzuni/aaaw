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
    const n = await p.evaluate(() => document.querySelectorAll('.perk-card').length);
    if (!n) break;
    await p.click('.perk-card'); await p.waitForTimeout(350);
  }
  await p.evaluate(() => { if (document.getElementById('overlay').classList.contains('on')) closeOverlay(); });
  await p.waitForTimeout(250);
};
const chk = (n, c, d) => { R.push({ n, c, d }); console.log(`  ${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); };

(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(URL); await p.waitForTimeout(600);

  /* ---------- 전투 진입 ---------- */
  console.log('\n=== 전투 진입 · 레벨업 특전 3택 ===');
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
    return { n: cards.length, tags: cards.map(c => c.querySelector('.tag')?.textContent), medal: cards.map(c => getComputedStyle(c.querySelector('.ic')).clipPath !== 'none') };
  });
  chk('레벨업 특전 3택 노출', pick.n === 3 || pick.n === 4, `카드 ${pick.n}장`);
  chk('선택지 등급 통일 (주인 지시 06:2X)', new Set(pick.tags).size === 1, pick.tags.join(','));
  chk('특전 아이콘이 등급 메달리온 (6단계 구도)', pick.medal.every(Boolean));

  await p.click('.perk-card'); await p.waitForTimeout(300);
  const strip1 = await p.evaluate(() => ({ chips: document.querySelectorAll('#perkStrip .pv-ic').length, taken: G.perksTaken.length }));
  chk('⚑ 특전 미리보기 줄에 칩이 쌓인다', strip1.chips === 1 && strip1.taken === 1, `칩 ${strip1.chips} / 획득 ${strip1.taken}`);

  /* ---------- ⚑ 버프 아이콘 표시/소멸 (주인 지시 07:0X) ---------- */
  console.log('\n=== ⚑ 발동 중 버프 아이콘 (#buffBar) ===');
  await drain(p);
  const buffOn = await p.evaluate(() => {
    /* 실제 특전이 주는 시간제 버프와 같은 경로로 넣는다 — src 는 그 특전을 가리키는 px 키 */
    /* 버프 아이콘이 «어느 특전의 버프인가» 를 알려면 px 키를 올리는 특전이 있어야 한다.
       고른 특전이 순수 스탯형이면 G.pxPerk 가 비므로, 정상 경로(takePerk)로 하나 더 얻는다. */
    let key = Object.keys(G.pxPerk)[0] || null;
    for (let i = 0; !key && i < PERKS.length; i++) { takePerk(PERKS[i]); key = Object.keys(G.pxPerk)[0] || null; }
    const perk = key ? G.pxPerk[key] : G.perksTaken[0];
    addBuff(G.player, 'atk', 0.2, 4, 5, key);
    addBuff(G.player, 'atk', 0.2, 4, 5, key);   /* 같은 출처 2중첩 → 개수 뱃지 */
    addBuff(G.player, 'aspd', 0.15, 4, 5, null); /* 출처 불명 → 스탯 폴백 아이콘 */
    const ics = [...document.querySelectorAll('#buffBar .buff-ic')];
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
      /* 기대 테두리색 = 그 특전의 등급색. 일반 등급색(#9EA3AC)은 «출처 없음» 폴백색과 같은 값이라
         «회색이 아니다» 로는 판정할 수 없다 — 등급에서 기대색을 만들어 비교한다. */
      wantCC: perk ? RARITY[perk.r].cc : null, wantRar: perk ? RARITY[perk.r].nm : '-',
    };
  });
  chk('버프 발동 시 아이콘이 뜬다', buffOn.n === 2, `아이콘 ${buffOn.n}개(같은 출처 2중첩은 1칸)`);
  chk('중첩 2 이상이면 개수 뱃지', buffOn.cnt.some(c => +c >= 2), `뱃지 ${buffOn.cnt.join('|')} (같은 출처 중첩 수)`);
  const hex2rgb = h => { const n = parseInt(h.slice(1), 16); return `rgb(${n >> 16 & 255}, ${n >> 8 & 255}, ${n & 255})`; };
  chk('출처 특전의 등급색 테두리', buffOn.wantCC ? buffOn.border.includes(hex2rgb(buffOn.wantCC)) : false,
    `${buffOn.border.join(' / ')} ← 기대 ${buffOn.wantCC ? hex2rgb(buffOn.wantCC) : '?'} (${buffOn.wantRar} · ${buffOn.perkName})`);
  chk('출처 불명 버프는 스탯 SVG 폴백 (7단계)', buffOn.svgFallback >= 1, `SVG 폴백 ${buffOn.svgFallback}개`);
  chk('버프바가 챕터 표시와 겹치지 않는다', !buffOn.overlap, `chapHud.bottom ${buffOn.hudBottom} ≤ buffBar.top ${buffOn.barTop}`);
  await p.screenshot({ path: `${OUT}/t3-buffbar.png` });

  /* 만료 대기 — 버프는 «게임이 흐를 때만» 준다(오버레이가 열리면 G.paused 로 정지하는 것이 정상이다).
     그래서 기다리는 동안 뜨는 레벨업 팝업을 계속 비워 가며 본다. */
  let gone = false, waited = 0;
  for (let i = 0; i < 40; i++) {
    const st = await p.evaluate(() => ({ n: document.querySelectorAll('#buffBar .buff-ic').length, cards: document.querySelectorAll('.perk-card').length, paused: !!(G && G.paused) }));
    if (st.n === 0) { gone = true; break; }
    if (st.cards) { await p.click('.perk-card'); await p.waitForTimeout(300); }
    await p.waitForTimeout(300); waited += 300;
  }
  chk('지속시간이 끝나면 아이콘이 사라진다', gone, `${(waited / 1000).toFixed(1)}초 안에 소멸 (버프 4초 + 팝업 정지 시간)`);

  /* ---------- ⚑ 특전 미리보기 줄 — 누적·중복·«+N» ---------- */
  console.log('\n=== ⚑ 얻은 특전 미리보기 줄 (#perkStrip) ===');
  await drain(p);
  const strip2 = await p.evaluate(() => {
    const same = G.perksTaken[0];
    takePerk(same); takePerk(same);            /* 같은 특전 3번 → 개수 뱃지 3 */
    /* 같은 특전이 3번이면 칩은 «그 특전 1개 + 뱃지 3» 이어야 한다 (전체 칩 수는 그 전에 얻은 특전 수에 달렸다) */
    const distinct = new Set(G.perksTaken.map(x => x.id || x.tx)).size;
    const chips0 = [...document.querySelectorAll('#perkStrip .pv-ic')];
    const before = chips0.length;
    const badge = chips0.map(c => c.querySelector('.cnt')?.textContent).find(t => t === '3');
    for (let i = 0; i < 20; i++) takePerk(PERKS[i]);   /* 넘치게 */
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

  /* ---------- 보스 킬 = 특전 스킵 (주인 지시 06:3X) ---------- */
  console.log('\n=== 챕터 종료 보스 킬 = 특전 스킵 · 클리어 ===');
  /* 전투 중에 뜬 레벨업 팝업이 남아 있으면 게임이 멈춰 있어 보스가 죽지 않는다 — 먼저 비운다 */
  for (let i = 0; i < 6; i++) {
    const n = await p.evaluate(() => document.querySelectorAll('.perk-card').length);
    if (!n) break;
    await p.click('.perk-card'); await p.waitForTimeout(400);
  }
  await p.evaluate(() => { if (document.getElementById('overlay').classList.contains('on')) closeOverlay(); });
  await p.waitForTimeout(300);
  const boss = await p.evaluate(() => {
    /* 보스만 남기고 플레이어를 보스 앞에 세운다 — 걸어가는 시간을 기다리지 않기 위해 */
    for (const n of G.nodes) { if (n.type !== 'boss') { n.enemies.forEach(e => { e.dead = true; e.hp = 0; }); n.done = true; } }
    G.killed = G.totalEnemies - 1;
    const bn = G.nodes.find(n => n.type === 'boss');
    G.player.worldX = bn.x - 40;
    G.player.dmg = 1e9;                                   /* 한 방에 */
    G.player.exp = expNeed(G.player.level) - 1;           /* 이 처치로 반드시 레벨업 */
    const lv0 = G.player.level;
    bn.enemies.forEach(e => { e.hp = 1e6; });
    return { lv0, bossX: Math.round(bn.x) };
  });
  /* 클리어까지 폴링하며 «도중에 특전 카드가 한 번이라도 떴는가» 를 본다 */
  let sawCard = 0;
  for (let i = 0; i < 60; i++) {
    const st = await p.evaluate(() => ({
      cards: document.querySelectorAll('.perk-card').length,
      cleared: !!(G && G.cleared), ov: document.getElementById('overlay').textContent.slice(0, 40),
    }));
    sawCard = Math.max(sawCard, st.cards);
    if (st.cleared && /클리어/.test(st.ov)) break;
    await p.waitForTimeout(250);
  }
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

  chk('pageerror 0', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close();
  const bad = R.filter(r => !r.c);
  console.log(`\n[②] 통과 ${R.length - bad.length} · 불합격 ${bad.length}`);
  if (bad.length) console.log('불합격:', bad.map(x => x.n + (x.d ? ` (${x.d})` : '')).join(' / '));
  process.exit(bad.length ? 1 : 0);
})();
