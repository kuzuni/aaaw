/* T3 동작 검증 — ⚑다연발 순차 연사·이벤트 3종(쉼터·악마·천사)·사망 화면·챕터 300 진입
 *
 * 사용: node tools/t3/fx.js          (exit 0 = 통과, 1 = 불합격)
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
const chk = (n, c, d) => { R.push({ n, c, d }); console.log(`  ${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); };

(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(URL); await p.waitForTimeout(600);
  await p.click('#startBtn'); await p.waitForTimeout(800);

  /* ---------- ⚑ 다연발 = 순차 연사 (주인 지시 08:3X) ---------- */
  console.log('\n=== ⚑ 다연발 순차 연사 (50~70ms 간격 · 발마다 판정·사운드) ===');
  const volley = await p.evaluate(async () => {
    /* 화살 24발이 언제 스폰되는지 실측 — 동시 스폰이면 간격이 0 이 된다 */
    const t0 = performance.now(), stamps = [], sounds = [];
    const origPlay = AU.play; AU.play = k => { if (k === 'arrow') sounds.push(performance.now() - t0); origPlay.call(AU, k); };
    const origPush = G.pprojs.push.bind(G.pprojs);
    G.pprojs.push = (o) => { if (o.type === 'parrow') stamps.push(performance.now() - t0); return origPush(o); };
    G.player.px.arrowCount = 1;                       /* 신화 화살 24발 */
    /* 예약된 지연값 자체도 잡는다 — 실측 간격에는 브라우저 타이머 지터가 섞이므로
       «코드가 요구한 간격» 은 setTimeout 인자로 확인하는 것이 결정적이다 */
    const wanted = [], origST = window.setTimeout;
    window.setTimeout = (f, ms, ...a) => { if (typeof ms === 'number' && ms > 0 && ms < 5000) wanted.push(ms); return origST(f, ms, ...a); };
    /* 적이 있어야 randTarget 이 대상을 준다 — 없으면 첫 웨이브를 깨운다 */
    for (const n of G.nodes) if (n.type === 'wave') { n.enemies.forEach(e => { e.aggro = true; }); break; }
    fireArrows(G.player);
    window.setTimeout = origST;          /* 예약은 fireArrows 동기 구간에서 전부 끝난다 */
    await new Promise(r => origST(r, 2600));
    AU.play = origPlay; G.pprojs.push = origPush;
    const wgaps = wanted.slice(1).map((t, i) => t - wanted[i]);
    const gaps = stamps.slice(1).map((t, i) => t - stamps[i]);
    return {
      n: stamps.length, sounds: sounds.length,
      min: gaps.length ? Math.min(...gaps).toFixed(1) : -1,
      max: gaps.length ? Math.max(...gaps).toFixed(1) : -1,
      avg: gaps.length ? (gaps.reduce((a, c) => a + c, 0) / gaps.length).toFixed(1) : -1,
      span: stamps.length ? (stamps[stamps.length - 1] - stamps[0]).toFixed(0) : -1,
      simul: gaps.filter(g => g < 20).length,
      wmin: wgaps.length ? Math.min(...wgaps).toFixed(1) : -1,
      wmax: wgaps.length ? Math.max(...wgaps).toFixed(1) : -1,
      wasc: wanted.every((t, i) => i === 0 || t > wanted[i - 1]),
    };
  });
  chk('화살 24발이 낱발로 나간다', volley.n === 24, `${volley.n}발 · 총 ${volley.span}ms`);
  chk('동시 스폰 0 (간격 20ms 미만 없음)', volley.simul === 0, `최소 간격 ${volley.min}ms`);
  chk('코드가 예약한 간격이 정확히 50~70ms', +volley.wmin >= 50 && +volley.wmax <= 70, `예약 간격 ${volley.wmin}~${volley.wmax}ms`);
  chk('발 순서가 뒤집히지 않는다 (예약 시각 단조증가)', volley.wasc);
  chk('실측 간격도 낱발로 구별된다 (브라우저 타이머 지터 포함)', volley.min >= 35 && volley.max <= 110, `min ${volley.min} · avg ${volley.avg} · max ${volley.max} ms`);
  chk('발마다 사운드', volley.sounds === volley.n, `사운드 ${volley.sounds}회 / ${volley.n}발`);

  /* ---------- 이벤트 3종 ---------- */
  console.log('\n=== 이벤트 팝업 (쉼터 · 악마 · 천사) ===');
  const rest = await p.evaluate(() => { openRest(); const ov = document.getElementById('overlay'); return { on: ov.classList.contains('on'), heal: !!document.getElementById('rHeal'), exp: !!document.getElementById('rExp') }; });
  chk('쉼터 — 회복/레벨업 2택', rest.on && rest.heal && rest.exp);
  const restPick = await p.evaluate(() => { const hp0 = G.player.hp; G.player.hp = Math.max(1, G.player.maxHp * 0.2); document.getElementById('rHeal').click(); return { hp0, hp: G.player.hp, max: G.player.maxHp }; });
  chk('쉼터 회복이 실제로 체력을 올린다', restPick.hp > restPick.max * 0.2, `${Math.round(restPick.hp)}/${Math.round(restPick.max)}`);
  await p.waitForTimeout(300);
  const devil = await p.evaluate(() => { openDevil(); return { on: document.getElementById('overlay').classList.contains('on'), yes: !!document.getElementById('dYes'), no: !!document.getElementById('dNo'), txt: document.getElementById('overlay').textContent.replace(/\s+/g, ' ').slice(0, 50) }; });
  chk('악마 — 체력 지불/거절 2택', devil.on && devil.yes && devil.no, devil.txt);
  const devilPay = await p.evaluate(() => { const hp0 = G.player.hp, n0 = G.perksTaken.length; document.getElementById('dYes').click(); return { paid: G.player.hp < hp0, got: G.perksTaken.length > n0 }; });
  chk('악마 거래 — 체력 지불하고 특전 획득', devilPay.paid && devilPay.got);
  await p.waitForTimeout(400);
  await p.evaluate(() => closeOverlay());
  const angel = await p.evaluate(() => { openAngel(); return { on: document.getElementById('overlay').classList.contains('on'), free: !!document.getElementById('aFree'), ad: !!document.getElementById('aAd') }; });
  chk('천사 — 무료/광고 2택', angel.on && angel.free && angel.ad);
  const angelPick = await p.evaluate(() => { const d0 = G.player.dmg; document.getElementById('aFree').click(); return { up: G.player.dmg > d0, d0, d1: G.player.dmg }; });
  chk('천사 축복이 공격력을 올린다', angelPick.up, `${Math.round(angelPick.d0)} → ${Math.round(angelPick.d1)}`);
  await p.waitForTimeout(400); await p.evaluate(() => closeOverlay());

  /* ---------- 사망 화면 ---------- */
  console.log('\n=== 사망 처리 ===');
  const dead = await p.evaluate(async () => {
    G.player.px.revive = 0; G.player.revived = true;      /* 부활 특전 영향 배제 */
    G.player.evade = 0; G.player.buffs.evade = [];        /* 회피로 안 맞고 넘어가지 않게 */
    G.player.hp = 1; G.player.sh = 0;
    hitPlayer(1e9);                                        /* 시그니처: (dmg, isMelee, src) */
    await new Promise(r => setTimeout(r, 1200));
    return { over: !!G.over, ov: document.getElementById('overlay').textContent.replace(/\s+/g, ' ').slice(0, 40), btn: !!document.getElementById('deOk') };
  });
  chk('사망 시 게임오버 화면', dead.over && dead.btn, dead.ov.trim());
  await p.evaluate(() => { const b = document.getElementById('deOk'); if (b) b.click(); }); await p.waitForTimeout(600);
  chk('로비로 복귀', await p.evaluate(() => document.querySelector('.screen.on')?.id) === 'lobby');

  /* ---------- 챕터 300 진입 ---------- */
  console.log('\n=== 챕터 300 진입·클리어 ===');
  const c300 = await p.evaluate(() => {
    save.maxChapter = 300; save.selChapter = 300; renderLobby(); persist();
    startChapter(300);
    const bn = G.nodes.find(n => n.type === 'boss');
    return { screen: document.querySelector('.screen.on')?.id, nodes: G.nodes.length, total: G.totalEnemies, bossHp: bn ? bn.enemies[0].hp : -1, hud: document.getElementById('chapHudName').textContent.trim() };
  });
  chk('챕터 300 진입', c300.screen === 'game' && /300/.test(c300.hud), `${c300.hud} · 노드 ${c300.nodes} · 적 ${c300.total}`);
  chk('챕터 300 보스 HP 가 유한하다', Number.isFinite(c300.bossHp) && c300.bossHp > 0, `보스 HP ${c300.bossHp.toExponential(2)}`);
  const clear300 = await p.evaluate(async () => {
    G.player.dmg = Infinity;
    for (const n of G.nodes) { n.enemies.forEach(e => { e.dead = true; e.hp = 0; }); n.done = true; }
    G.killed = G.totalEnemies; G.cleared = true; openClear();
    await new Promise(r => setTimeout(r, 500));
    return { ov: document.getElementById('overlay').textContent.replace(/\s+/g, ' '), mx: save.maxChapter };
  });
  chk('챕터 300 클리어 시 상한 유지 + 완주 문구', clear300.mx === 300 && /모든 챕터를 클리어했습니다/.test(clear300.ov), clear300.ov.trim().slice(0, 80));

  chk('pageerror 0', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  const bad = R.filter(r => !r.c);
  console.log(`\n[④] 통과 ${R.length - bad.length} · 불합격 ${bad.length}`);
  if (bad.length) console.log('불합격:', bad.map(x => x.n + (x.d ? ` (${x.d})` : '')).join(' / '));
  process.exit(bad.length ? 1 : 0);
})();
