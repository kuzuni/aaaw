/* T3 동작 검증 — 상점(무료 다이아·뽑기)·장비 탭(장착·슬롯 강화·세부 팝업)·대장간 수동 3칸 합성·저장 v2 왕복·챕터 이동 UI
 *
 * 사용: node tools/t3/gear.js          (exit 0 = 통과, 1 = 불합격)
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

  /* ---------- 상점 ---------- */
  console.log('\n=== 상점 탭 (무료 다이아 · 뽑기) ===');
  await p.evaluate(() => showScreen('shop')); await p.waitForTimeout(400);
  const shop0 = await p.evaluate(() => ({
    screen: document.querySelector('.screen.on')?.id,
    free: document.getElementById('freeBtn')?.textContent.trim(),
    gem: save.gem, packs: document.querySelectorAll('.gem-grid .gem-card').length,
    pity: document.querySelector('.pity')?.textContent.replace(/\s+/g, ' ').trim(),
  }));
  chk('상점 화면 전환', shop0.screen === 'shop');
  chk('일일 무료 다이아 버튼', shop0.free === '수령', shop0.free);
  chk('모의 결제 상품 1종 (주인이 정한 값만)', shop0.packs === 1, `${shop0.packs}종`);
  chk('천장·피티 잔여 표시', /50회 천장까지/.test(shop0.pity || ''), shop0.pity);

  await p.click('#freeBtn'); await p.waitForTimeout(300);
  const shop1 = await p.evaluate(() => ({ gem: save.gem, free: document.getElementById('freeBtn').textContent.trim(), dis: document.getElementById('freeBtn').disabled }));
  chk('무료 다이아 2,500 수령', shop1.gem === shop0.gem + 2500, `${shop0.gem} → ${shop1.gem}`);
  chk('하루 1회 — 재수령 막힘', shop1.dis && /완료/.test(shop1.free), shop1.free);

  /* 뽑기 1회 + 10회 (다이아를 넣어 준다 — 모의 결제 경로 대신 상태를 직접) */
  await p.evaluate(() => { save.gem = 100000; renderShop(); });
  await p.click('#pull1'); await p.waitForTimeout(500);
  const g1 = await p.evaluate(() => ({
    inv: save.inv.length, gem: save.gem, pulls: save.gacha.pulls,
    ov: document.getElementById('overlay').classList.contains('on'),
    cells: document.querySelectorAll('#overlay .inv-cell, #overlay .pull-cell').length,
    svg: document.querySelectorAll('#overlay svg.gicon').length,
  }));
  chk('뽑기 1회 — 장비 1개 획득', g1.inv === 1 && g1.pulls === 1, `인벤 ${g1.inv} · 누적 ${g1.pulls}`);
  chk('뽑기 비용 400 다이아', g1.gem === 100000 - 400, `잔액 ${g1.gem}`);
  chk('결과 연출 오버레이 + 장비 SVG 아이콘', g1.ov && g1.svg >= 1, `svg ${g1.svg}개`);
  await p.evaluate(() => closeOverlay()); await p.waitForTimeout(200);
  await p.click('#pull10'); await p.waitForTimeout(700);
  const g10 = await p.evaluate(() => ({ inv: save.inv.length, gem: save.gem, pulls: save.gacha.pulls, svg: document.querySelectorAll('#overlay svg.gicon').length }));
  chk('뽑기 10회 — 장비 10개 추가', g10.inv === 11 && g10.pulls === 11, `인벤 ${g10.inv} · 누적 ${g10.pulls}`);
  chk('10회 결과 10칸 연출', g10.svg >= 10, `svg ${g10.svg}개`);
  await p.evaluate(() => closeOverlay()); await p.waitForTimeout(200);
  /* 천장 — 50회에서 신화가 반드시 나온다 */
  const pity = await p.evaluate(() => {
    save.inv = []; save.gacha = { p50: 0, p10: 0, pulls: 0 }; save.gem = 1e9;
    /* «50번째가 반드시 신화» 로 보면 안 된다 — 그 전에 자연 신화가 나오면 천장이 리셋된다.
       천장의 실제 약속은 «신화 없이 50회를 넘기지 않는다», 피티는 «전설 이상 없이 10회를 넘기지 않는다» 다. */
    const rar = [];
    for (let i = 0; i < 600; i++) rar.push(gachaPull(save.gacha).rar);
    let gapM = 0, curM = 0, gapL = 0, curL = 0;
    for (const r of rar) {
      curM = r === 4 ? 0 : curM + 1; gapM = Math.max(gapM, curM);
      curL = r >= 3 ? 0 : curL + 1; gapL = Math.max(gapL, curL);
    }
    return { gapM, gapL, myth: rar.filter(r => r === 4).length, leg: rar.filter(r => r >= 3).length, n: rar.length };
  });
  chk('50회 천장 — 신화 없이 50회를 넘지 않는다', pity.gapM <= 50, `600회 중 최장 무신화 구간 ${pity.gapM}회 · 신화 ${pity.myth}개`);
  chk('10회 피티 — 전설 이상 없이 10회를 넘지 않는다', pity.gapL <= 10, `최장 무전설 구간 ${pity.gapL}회 · 전설↑ ${pity.leg}개`);
  await p.screenshot({ path: `${OUT}/t3-shop.png` });

  /* ---------- 장비 탭 ---------- */
  console.log('\n=== 장비 탭 (장착 · 슬롯 강화 · 세부 팝업) ===');
  await p.evaluate(() => { save.inv = []; save.eq = {}; save.gem = 1e9; save.gold = 1e9; for (let i = 0; i < 60; i++) { const g = gachaPull(save.gacha); g.u = save.uid++; save.inv.push(g); } autoEquipBest(); persist(); showScreen('gear'); });
  await p.waitForTimeout(500);
  const gear = await p.evaluate(() => ({
    screen: document.querySelector('.screen.on')?.id,
    slots: document.querySelectorAll('#gearColL .slot-card, #gearColR .slot-card').length,
    equipped: Object.keys(save.eq).length,
    stats: [...document.querySelectorAll('#gearStats .gs')].map(e => e.textContent.replace(/\s+/g, ' ').trim()),
    inv: document.querySelectorAll('#invGrid .inv-cell').length,
    svg: document.querySelectorAll('#invGrid svg.gicon').length,
    power: power(),
  }));
  chk('장비 화면 6부위 슬롯 카드', gear.slots === 6, `${gear.slots}칸`);
  chk('자동 장착 6부위', gear.equipped === 6, `${gear.equipped}부위`);
  chk('공/체/실 3스탯 표시', gear.stats.length === 3, gear.stats.join(' | '));
  chk('인벤 칸이 전부 SVG 아이콘', gear.inv > 0 && gear.svg === gear.inv, `${gear.svg}/${gear.inv}`);
  chk('전투력이 장비로 오른다', gear.power > 0, `power=${gear.power}`);

  /* 세부 팝업 + 슬롯 강화 */
  await p.click('#gearColL .slot-card'); await p.waitForTimeout(400);
  const det = await p.evaluate(() => ({
    on: document.getElementById('overlay').classList.contains('on'),
    opts: document.querySelectorAll('#overlay .gd-opt').length,
    locks: document.querySelectorAll('#overlay .gd-opt.lock').length,
    opens: [...document.querySelectorAll('#overlay .gd-opt')].filter(e => !e.classList.contains('lock')).length,
    up: document.getElementById('gdUp')?.textContent.trim(),
    txt: document.getElementById('overlay').textContent.replace(/\s+/g, ' ').slice(0, 90),
  }));
  chk('세부 팝업이 열린다', det.on);
  /* .gd-opt = 계열 옵션 7칸 + 슬롯 강화 안내 1줄 = 8 (안내 줄은 «슬롯 1레벨당…» 고정 문구) */
  chk('옵션 7칸 목록 (해금 ◆ / 잠금 🔒) + 슬롯 안내 1줄', det.opts === 8 && det.locks >= 1 && det.opens >= 1,
    `${det.opts}줄 (해금 ${det.opens} · 잠금 ${det.locks})`);
  chk('슬롯 강화 버튼', /슬롯 강화|슬롯 MAX/.test(det.up || ''), det.up);
  const before = await p.evaluate(() => { const pt = GT.parts.find(x => save.eq[x]); return { pt, lv: save.slots[pt] | 0, gold: save.gold }; });
  await p.click('#gdUp'); await p.waitForTimeout(400);
  const afterUp = await p.evaluate(() => { const pt = GT.parts.find(x => save.eq[x]); return { lv: save.slots[pt] | 0, gold: save.gold }; });
  chk('슬롯 강화가 레벨을 올리고 골드를 쓴다', afterUp.lv === before.lv + 1 && afterUp.gold < before.gold, `Lv ${before.lv}→${afterUp.lv} · 골드 ${before.gold}→${afterUp.gold}`);
  await p.evaluate(() => closeOverlay()); await p.waitForTimeout(200);
  const cap = await p.evaluate(() => { const pt = GT.parts.find(x => save.eq[x]); save.slots[pt] = 150; return { maxed: slotMaxed(pt), over: (save.slots[pt] | 0) }; });
  chk('슬롯 레벨 상한 150', cap.maxed && cap.over === 150, `Lv ${cap.over} · MAX=${cap.maxed}`);
  await p.screenshot({ path: `${OUT}/t3-gear.png` });

  /* ---------- 대장간 수동 3칸 합성 ---------- */
  console.log('\n=== 대장간 — 수동 3칸 합성 (5단계 구도) ===');
  await p.evaluate(() => {
    save.inv = []; save.eq = {}; save.slots = {};
    for (let i = 0; i < 3; i++) save.inv.push({ part: 'weapon', type: 'greatsword', rar: 0, plus: 0, u: save.uid++ });
    save.inv.push({ part: 'helm', type: 'helmet', rar: 1, plus: 0, u: save.uid++ });
    autoEquipBest(); persist(); showScreen('gear'); renderGear();
  });
  await p.click('#fuseBtn'); await p.waitForTimeout(400);
  const f0 = await p.evaluate(() => ({ screen: document.querySelector('.screen.on')?.id, mats: document.querySelectorAll('#fgMats .fg-cell').length, fuse: document.getElementById('fgFuse').textContent.trim(), dis: document.getElementById('fgFuse').disabled }));
  chk('대장간 화면 전환', f0.screen === 'forge', f0.screen);
  chk('재료 3칸', f0.mats === 3);
  chk('재료 0개면 합성 버튼 잠김', f0.dis, f0.fuse);
  /* 인벤에서 같은 계열 3개 고르기 */
  await p.evaluate(async () => {
    const cells = [...document.querySelectorAll('#fgGrid .inv-cell')];
    for (const c of cells) { const g = invById(+c.dataset.u); if (g && g.type === 'greatsword') c.click(); }
  });
  await p.waitForTimeout(400);
  const f1 = await p.evaluate(() => ({
    picked: FG.length, fuse: document.getElementById('fgFuse').textContent.trim(), dis: document.getElementById('fgFuse').disabled,
    result: document.getElementById('fgResult').className, banner: document.getElementById('fgBanner').textContent.replace(/\s+/g, ' ').trim().slice(0, 40),
    off: document.querySelectorAll('#fgGrid .inv-cell.off').length,
  }));
  chk('수동으로 재료 3개 선택', f1.picked === 3, `${f1.fuse}`);
  chk('3개 차면 결과 미리보기가 뜬다', !/empty/.test(f1.result) && /희귀|일반|영웅|전설|신화/.test(f1.banner), f1.banner);
  chk('다른 계열은 흐리게(선택 불가)', f1.off >= 1, `${f1.off}칸`);
  chk('합성 버튼 활성', !f1.dis, f1.fuse);
  await p.click('#fgFuse'); await p.waitForTimeout(500);
  const f2 = await p.evaluate(() => ({ inv: save.inv.length, rar: save.inv.map(g => g.rar + ':' + g.type).join(','), fuses: save.fuses, picked: FG.length }));
  chk('합성 실행 — 3개가 1개(상위 등급)로', f2.inv === 2 && /1:greatsword/.test(f2.rar), `인벤 ${f2.inv} [${f2.rar}]`);
  chk('합성 횟수 누적 · 재료 칸 비움', f2.fuses === 1 && f2.picked === 0);
  await p.screenshot({ path: `${OUT}/t3-forge.png` });

  /* ---------- 저장 v2 왕복 ---------- */
  console.log('\n=== 저장 포맷 v2 왕복 ===');
  const saved = await p.evaluate(() => { save.gold = 12345; save.gem = 678; persist(); return JSON.parse(localStorage.getItem('kkoma-knight-v2')); });
  await p.reload(); await p.waitForTimeout(700);
  const loaded = await p.evaluate(() => ({ gold: save.gold, gem: save.gem, inv: save.inv.length, eq: Object.keys(save.eq).length, keys: Object.keys(save).sort().join(',') }));
  chk('새로고침 후 골드·다이아·인벤 유지', loaded.gold === 12345 && loaded.gem === 678 && loaded.inv === saved.inv.length, `골드 ${loaded.gold} · 💎 ${loaded.gem} · 인벤 ${loaded.inv}`);
  chk('v2 키 구성', /gacha/.test(loaded.keys) && /slots/.test(loaded.keys) && !/(^|,)up(,|$)/.test(loaded.keys), loaded.keys);
  /* 구버전 v1 세이브 이월 */
  const legacy = await p.evaluate(async () => {
    localStorage.clear();
    localStorage.setItem('kkoma-knight-v1', JSON.stringify({ gold: 999, maxChapter: 7, selChapter: 7, up: { atk: 5 }, muted: true }));
    return true;
  });
  await p.reload(); await p.waitForTimeout(700);
  const mig = await p.evaluate(() => ({ gold: save.gold, mx: save.maxChapter, up: save.up, muted: save.muted, inv: save.inv.length }));
  chk('v1 세이브에서 골드·진행도·음소거만 이월', mig.gold === 999 && mig.mx === 7 && mig.muted === true && mig.up === undefined, `골드 ${mig.gold} · 챕터 ${mig.mx} · up=${JSON.stringify(mig.up)}`);

  /* ---------- 챕터 300 이동 UI (T36) ---------- */
  console.log('\n=== 챕터 이동 UI (T36) ===');
  await p.evaluate(() => { save.maxChapter = 300; save.selChapter = 1; renderLobby(); persist(); showScreen('lobby'); });
  await p.waitForTimeout(300);
  await p.click('#lobbyChapName'); await p.waitForTimeout(400);
  const jump = await p.evaluate(() => ({ on: document.getElementById('overlay').classList.contains('on'), input: !!document.getElementById('jumpVal'), last: document.getElementById('jLast')?.textContent.trim() }));
  chk('제목 탭 → 챕터 이동 팝업', jump.on && jump.input, jump.last);
  await p.evaluate(() => { document.getElementById('jumpVal').value = '250'; document.getElementById('jOk').click(); });
  await p.waitForTimeout(400);
  const jumped = await p.evaluate(() => ({ sel: save.selChapter, txt: document.getElementById('lobbyChapName').textContent.trim() }));
  chk('입력한 챕터로 이동', jumped.sel === 250 && /250/.test(jumped.txt), jumped.txt);
  /* ▶ 길게 누르기 가속 */
  await p.evaluate(() => { save.selChapter = 1; renderLobby(); });
  const btn = await p.$('#chNext');
  const box = await btn.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down(); await p.waitForTimeout(1600); await p.mouse.up();
  await p.waitForTimeout(200);
  const held = await p.evaluate(() => save.selChapter);
  chk('▶ 길게 누르면 가속 이동', held >= 10, `1.6초에 1 → ${held}`);

  chk('pageerror 0', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  const bad = R.filter(r => !r.c);
  console.log(`\n[③] 통과 ${R.length - bad.length} · 불합격 ${bad.length}`);
  if (bad.length) console.log('불합격:', bad.map(x => x.n + (x.d ? ` (${x.d})` : '')).join(' / '));
  process.exit(bad.length ? 1 : 0);
})();
