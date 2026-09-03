/* T3 동작 검증 — ⚑다연발 순차 연사·이벤트 3종(쉼터·악마·천사)·사망 화면·챕터 420 진입(⚑ T103)
 *
 * 사용: node tools/t3/fx.js          (exit 0 = 통과, 1 = 불합격)
 * 전제: playwright-core 가 있어야 한다. **리포에 커밋하지 말 것**(ROUTINE §1 대용량 바이너리 금지) —
 *       스크래치패드에 `npm i playwright-core` 로 깔고 `PW_CORE=<경로>/node_modules/playwright-core` 로 넘긴다.
 *       크로미움은 환경에 미리 깔린 /opt/pw-browsers 를 쓴다(PW_CHROME 으로 덮어쓸 수 있다).
 * 스크린샷은 OUT(기본 /tmp)에만 떨어뜨린다 — 캡처 PNG 커밋 금지.
 *
 * ⚑ 계측 규칙 (T50, 2026-09-02): **연출 타이밍은 «엔진이 예약한 시각» 으로 판정하고 벽시계 실측으로 판정하지 않는다.**
 *   헤드리스 브라우저의 setTimeout 은 지터·코얼레싱으로 간격이 0.7ms 까지 붙거나 크게 벌어진다 —
 *   그건 엔진의 성질이 아니라 런타임의 성질이라, 벽시계 간격을 합격선으로 쓰면 같은 커밋이 통과/실패로 갈린다.
 *   실행 시각으로 볼 수 있는 것은 «예약보다 이르지 않다» 뿐이다(타이머는 늦어질 뿐 빨라지지 않는다).
 *   벽시계 수치는 판정에서 빼고 «[참고·판정외]» 로 출력한다. 이 스위트에 연출 항목을 더할 때도 같은 규칙을 따를 것.
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
  /* ⚑ T50 수리 — 계측점을 «벽시계 실측 간격» 에서 «엔진이 예약한 발사 시각» 으로 옮겼다.
     종전 판정 2개(«간격 20ms 미만 없음» · «실측 간격 35~110ms»)는 헤드리스 브라우저의 setTimeout
     지터·코얼레싱을 그대로 재고 있어서 같은 커밋에서 통과/실패가 갈렸다(워커 C 관측: 최소 간격 0.7ms · 32.5ms).
     타이머 지터는 엔진의 성질이 아니다 — 엔진이 통제하는 건 «예약 간격» 뿐이다. 그래서:
       · 간격 판정은 전부 예약값(setTimeout 인자)으로 — 결정적이다.
       · 실행 시각은 «예약보다 이르지 않다» 만 본다. 타이머는 늦어질 뿐 빨라지지 않으므로 지터에 면역이고,
         예약만 해 두고 실제로는 즉시 쏘는 회귀는 전 발이 예약 시각보다 이르게 찍혀 즉시 빨개진다.
         스케줄 자체를 없애는 동시 스폰 회귀는 «발마다 예약이 하나씩» 이 잡는다.
       · 벽시계 min/avg/max 는 판정에서 빼고 참고 수치로만 출력한다. */
  const volley = await p.evaluate(async () => {
    const t0 = performance.now(), stamps = [], sounds = [], earrows = [];
    const origPlay = AU.play; AU.play = k => { if (k === 'arrow') sounds.push(performance.now() - t0); origPlay.call(AU, k); };
    const origPush = G.pprojs.push.bind(G.pprojs);
    G.pprojs.push = (o) => { if (o.type === 'parrow') stamps.push(performance.now() - t0); return origPush(o); };
    /* ⚑ T50 — «arrow» 사운드는 플레이어 화살만 쓰는 게 아니다. 적 원거리 분기도 같은 키를 쓴다
       (`AU.play('arrow'); G.arrows.push(...)` 1:1). 첫 웨이브의 궁수가 사거리 440 에 들어오는 순간
       25번째 소리가 섞여 «발마다 사운드» 가 25/24 로 틀렸다 — 실측에서 최근접 적이 446~448px 로
       임계값 440 바로 바깥에 서므로 플레이어가 몇 px 만 걸어도 넘어간다. 적 화살 수를 따로 세서 뺀다. */
    const origArr = G.arrows.push.bind(G.arrows);
    G.arrows.push = (o) => { earrows.push(performance.now() - t0); return origArr(o); };
    G.player.px.arrowCount = 1;                       /* 신화 화살 폭풍(m_arrow4) 보유 상태 */
    /* ⚑ T78 — 발수를 숫자로 박아 두면 밸런스 튜닝(소환 연쇄 임계 ≤ 0.8)마다 이 검사가 헛되이 빨개진다.
       엔진 함수 본문에서 그 값을 그대로 읽어 «코드가 쏘겠다는 발수만큼 낱발로 나갔는가» 를 본다. */
    /* ⚑ P1(T83) — fireArrows 가 «발수 인자» 를 받게 바뀌었다. 기본 발수는 특전 텍스트(«화살 2발»)가
       정하고, 장비 «화살 3발로 증가»(arrowCount)가 배수로 곱한다. 그 배수를 엔진 본문에서 읽는다. */
    const BASE_N = 2;
    const mN = String(fireArrows).match(/arrowCount\)\s*n=Math\.round\(n\*([\d.]+)\)/);
    const wantN = mN ? Math.round(BASE_N * Number(mN[1])) : -1;
    /* 예약된 지연값 자체를 잡는다 — 이것이 «코드가 요구한 간격» 이고 판정의 근거다 */
    const wanted = [], origST = window.setTimeout;
    window.setTimeout = (f, ms, ...a) => { if (typeof ms === 'number' && ms > 0 && ms < 5000) wanted.push(ms); return origST(f, ms, ...a); };
    /* 적이 있어야 randTarget 이 대상을 준다 — 없으면 첫 웨이브를 깨운다 */
    for (const n of G.nodes) if (n.type === 'wave') { n.enemies.forEach(e => { e.aggro = true; }); break; }
    fireArrows(G.player, BASE_N);
    window.setTimeout = origST;          /* 예약은 fireArrows 동기 구간에서 전부 끝난다 */
    await new Promise(r => origST(r, 2600));
    AU.play = origPlay; G.pprojs.push = origPush; G.arrows.push = origArr;
    const wgaps = wanted.slice(1).map((t, i) => t - wanted[i]);
    const gaps = stamps.slice(1).map((t, i) => t - stamps[i]);
    const wabs = [0].concat(wanted);                  /* k 번째 발의 예약 시각(0발은 동기 발사) */
    /* 타이머는 늦어질 뿐 빨라지지 않는다 — 5ms 는 시계 해상도 여유 */
    const early = stamps.filter((t, i) => i < wabs.length && t < wabs[i] - 5).length;
    const lag = stamps.reduce((m, t, i) => i < wabs.length ? Math.max(m, t - wabs[i]) : m, 0);
    return {
      n: stamps.length, wantN, sounds: sounds.length, earrows: earrows.length, wn: wanted.length,
      min: gaps.length ? Math.min(...gaps).toFixed(1) : -1,
      max: gaps.length ? Math.max(...gaps).toFixed(1) : -1,
      avg: gaps.length ? (gaps.reduce((a, c) => a + c, 0) / gaps.length).toFixed(1) : -1,
      span: stamps.length ? (stamps[stamps.length - 1] - stamps[0]).toFixed(0) : -1,
      wspan: wabs[wabs.length - 1].toFixed(0),
      early, lag: lag.toFixed(0),
      wsimul: wgaps.filter(g => g < 20).length,
      wmin: wgaps.length ? Math.min(...wgaps).toFixed(1) : -1,
      wmax: wgaps.length ? Math.max(...wgaps).toFixed(1) : -1,
      wasc: wanted.every((t, i) => i === 0 || t > wanted[i - 1]),
      sasc: stamps.every((t, i) => i === 0 || t >= stamps[i - 1]),
    };
  });
  chk(`화살 ${volley.wantN}발(엔진 fireArrows 의 발수)이 낱발로 나간다`, volley.wantN > 1 && volley.n === volley.wantN,
    `${volley.n}발 / 기대 ${volley.wantN}발 · 총 ${volley.span}ms`);
  chk('발마다 예약이 하나씩 (n-1발이 지연 예약)', volley.wn === volley.n - 1, `예약 ${volley.wn}건 / ${volley.n}발`);
  chk('동시 스폰 0 (예약 간격에 20ms 미만 없음)', volley.wsimul === 0, `최소 예약 간격 ${volley.wmin}ms`);
  chk('코드가 예약한 간격이 정확히 50~70ms', +volley.wmin >= 50 && +volley.wmax <= 70, `예약 간격 ${volley.wmin}~${volley.wmax}ms`);
  chk('발 순서가 뒤집히지 않는다 (예약·실측 둘 다 단조증가)', volley.wasc && volley.sasc);
  chk('실측 발사가 예약 시각보다 이르지 않다 (예약해 두고 즉시 쏘면 빨개진다)', volley.early === 0,
    `이른 발 ${volley.early}개 · 실측 ${volley.span}ms / 예약 ${volley.wspan}ms · 최대 지연 ${volley.lag}ms · [참고·판정외] 벽시계 간격 min ${volley.min} · avg ${volley.avg} · max ${volley.max} ms`);
  chk('발마다 사운드 (적 궁수 화살 제외)', volley.sounds - volley.earrows === volley.n,
    `사운드 ${volley.sounds}회 − 적화살 ${volley.earrows}회 = ${volley.sounds - volley.earrows} / ${volley.n}발`);

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

  /* ---------- 챕터 420 진입 (⚑ T103 — 최종 챕터) ---------- */
  console.log('\n=== 챕터 420 진입·클리어 ===');
  const c300 = await p.evaluate(() => {
    save.maxChapter = 420; save.selChapter = 420; renderLobby(); persist();
    startChapter(420);
    const bn = G.nodes.find(n => n.type === 'boss');
    return { screen: document.querySelector('.screen.on')?.id, nodes: G.nodes.length, total: G.totalEnemies, bossHp: bn ? bn.enemies[0].hp : -1, hud: document.getElementById('chapHudName').textContent.trim() };
  });
  chk('챕터 420 진입', c300.screen === 'game' && /420/.test(c300.hud), `${c300.hud} · 노드 ${c300.nodes} · 적 ${c300.total}`);
  chk('챕터 420 보스 HP 가 유한하다', Number.isFinite(c300.bossHp) && c300.bossHp > 0, `보스 HP ${c300.bossHp.toExponential(2)}`);
  const clear300 = await p.evaluate(async () => {
    G.player.dmg = Infinity;
    for (const n of G.nodes) { n.enemies.forEach(e => { e.dead = true; e.hp = 0; }); n.done = true; }
    G.killed = G.totalEnemies; G.cleared = true; openClear();
    await new Promise(r => setTimeout(r, 500));
    return { ov: document.getElementById('overlay').textContent.replace(/\s+/g, ' '), mx: save.maxChapter };
  });
  chk('챕터 420 클리어 시 상한 유지 + 완주 문구', clear300.mx === 420 && /모든 챕터를 클리어했습니다/.test(clear300.ov), clear300.ov.trim().slice(0, 80));

  chk('pageerror 0', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  const bad = R.filter(r => !r.c);
  console.log(`\n[④] 통과 ${R.length - bad.length} · 불합격 ${bad.length}`);
  if (bad.length) console.log('불합격:', bad.map(x => x.n + (x.d ? ` (${x.d})` : '')).join(' / '));
  process.exit(bad.length ? 1 : 0);
})();
