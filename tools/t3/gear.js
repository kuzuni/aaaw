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
    gem: save.gem,
    /* ⚑ T116 U02 — 레퍼런스 상점은 3열 2행(6칸)이라 빈 칸을 «형태만» 잠금 카드로 채웠다(T116 ④ⓑ).
       그래서 «상품» 은 잠금이 아닌 칸으로 세고, 잠금 칸에는 살 수 있는 버튼이 하나도 없어야 한다
       — 지키는 성질(«주인이 정한 값 말고는 살 수 없다»)은 종전과 같고 오히려 강해졌다. */
    packs: document.querySelectorAll('.gem-grid .gem-card:not(.lock)').length,
    lockCells: document.querySelectorAll('.gem-grid .gem-card.lock').length,
    lockBtns: document.querySelectorAll('.gem-grid .gem-card.lock button').length,
    pity: document.querySelector('.pity')?.textContent.replace(/\s+/g, ' ').trim(),
  }));
  chk('상점 화면 전환', shop0.screen === 'shop');
  chk('일일 무료 다이아 버튼', shop0.free === '수령', shop0.free);
  chk('모의 결제 상품 1종 (주인이 정한 값만) · 잠금 칸은 살 수 없다',
    shop0.packs === 1 && shop0.lockBtns === 0, `상품 ${shop0.packs}종 · 잠금 ${shop0.lockCells}칸(버튼 ${shop0.lockBtns})`);
  /* ⚑ T125 ①-b (주인 21:1X) — 문구가 «신화 확정까지 N회 · 전설 확정까지 N회» 두 줄로 바뀌었다. */
  chk('천장 문구 — «신화 확정까지 N회 · 전설 확정까지 N회»',
    /신화 확정까지\s*50\s*회/.test(shop0.pity || '') && /전설 확정까지\s*10\s*회/.test(shop0.pity || ''), shop0.pity);

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
    for (let i = 0; i < 600; i++) for (const g of gachaPull(save.gacha)) rar.push(g.rar);   /* ⚑ T125 — 배열 */
    let gapM = 0, curM = 0, gapL = 0, curL = 0;
    for (const r of rar) {
      curM = r === 4 ? 0 : curM + 1; gapM = Math.max(gapM, curM);
      curL = r >= 3 ? 0 : curL + 1; gapL = Math.max(gapL, curL);
    }
    return { gapM, gapL, myth: rar.filter(r => r === 4).length, leg: rar.filter(r => r >= 3).length, n: rar.length };
  });
  chk('50회 천장 — 신화 없이 50회를 넘지 않는다', pity.gapM <= 50, `600회 중 최장 무신화 구간 ${pity.gapM}회 · 신화 ${pity.myth}개`);
  chk('10회 피티 — 전설 이상 없이 10회를 넘지 않는다', pity.gapL <= 10, `최장 무전설 구간 ${pity.gapL}회 · 전설↑ ${pity.leg}개`);
  /* ⚑⚑⚑ T125 ① (주인 21:0X) — 천장 겹침은 «이월» 이 아니라 «둘 다 지급» 이다.
     ⓐ 한 회차(p50=49 · p10=9)가 신화 1 + 전설 1 = 2개 ⓑ 그 겹침이 낀 10연차는 결과가 11개 ⓒ 두 카운터 리셋. */
  const ov = await p.evaluate(() => {
    save.gacha = { p50: 49, p10: 9, pulls: 0 };
    const got = gachaPull(save.gacha);
    const one = { n: got.length, rars: got.map(g => g.rar), p50: save.gacha.p50, p10: save.gacha.p10 };
    /* 10연차 안에서 겹치게: 카운터를 49·9 로 두면 **첫 회차**에서 천장과 피티가 같이 걸린다.
       (40·0 으로 두고 10회째를 노리면 중간의 자연 전설이 피티를 리셋해 겹침이 안 날 수 있다 — 결정적으로 간다.) */
    save.inv = []; save.eq = {}; save.gem = 1e9; save.gacha = { p50: 49, p10: 9, pulls: 0 };
    doPull(10);
    const ten = { inv: save.inv.length, pulls: save.gacha.pulls, cells: document.querySelectorAll('#overlay .inv-cell').length };
    closeOverlay();
    return { one, ten };
  });
  await p.waitForTimeout(200);
  chk('겹침 회차가 2개를 준다 (신화 + 전설)', ov.one.n === 2 && ov.one.rars[0] === 4 && ov.one.rars[1] === 3,
    `${ov.one.n}개 [${ov.one.rars.join(',')}]`);
  chk('겹침 뒤 두 카운터 리셋 (이월 없음)', ov.one.p50 === 0 && ov.one.p10 === 0, `p50=${ov.one.p50} p10=${ov.one.p10}`);
  chk('겹침이 낀 10연차는 11개', ov.ten.inv === 11 && ov.ten.pulls === 10, `인벤 ${ov.ten.inv} · 뽑기 ${ov.ten.pulls}회`);
  chk('11개가 결과 화면에도 다 뜬다', ov.ten.cells === 11, `${ov.ten.cells}칸`);
  /* ⚑⚑⚑ T125 ①-c — 뽑기 결과 자동 장착 금지 + 수동 장착 동작 */
  const noAuto = await p.evaluate(() => {
    save.inv = []; save.eq = {}; save.gem = 1e9; save.gacha = { p50: 0, p10: 0, pulls: 0 };
    doPull(10); closeOverlay();
    const eqAfterPull = Object.keys(save.eq).length;
    const nw = save.inv.filter(g => g.nw).length;
    const g = save.inv[0];
    openGearDetail(g.u);                      /* 세부 팝업 → «장착» 버튼 */
    const hasEq = !!document.getElementById('gdEq');
    if (hasEq) document.getElementById('gdEq').click();
    return { eqAfterPull, nw, inv: save.inv.length, eqAfterClick: Object.keys(save.eq).length,
      equippedU: save.eq[g.part], u: g.u, nwCleared: !g.nw, hasEq };
  });
  await p.waitForTimeout(200);
  chk('뽑기 결과가 자동 장착되지 않는다', noAuto.eqAfterPull === 0, `장착 ${noAuto.eqAfterPull}부위 · 인벤 ${noAuto.inv}개`);
  chk('새로 뽑은 장비에 NEW 뱃지 플래그', noAuto.nw === noAuto.inv, `${noAuto.nw}/${noAuto.inv}`);
  chk('세부 팝업의 «장착» 으로 수동 장착된다', noAuto.hasEq && noAuto.eqAfterClick === 1 && noAuto.equippedU === noAuto.u,
    `장착 ${noAuto.eqAfterClick}부위 · uid ${noAuto.equippedU}`);
  chk('장착하면 NEW 뱃지가 사라진다', noAuto.nwCleared);
  await p.evaluate(() => { closeOverlay(); showScreen('shop'); }); await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/t3-shop.png` });

  /* ---------- 장비 탭 ---------- */
  console.log('\n=== 장비 탭 (장착 · 슬롯 강화 · 세부 팝업) ===');
  /* ⚑ T125 ①-c — 자동 장착이 없어져 이 픽스처가 직접 «부위별 최고» 를 끼운다(장비 탭 단언의 전제). */
  await p.evaluate(() => {
    save.inv = []; save.eq = {}; save.gem = 1e9; save.gold = 1e9;
    for (let i = 0; i < 60; i++) for (const raw of gachaPull(save.gacha)) { const g = newGear(raw.part, raw.type, raw.rar, raw.plus); g.u = save.uid++; save.inv.push(g); }
    const best = autoEquip(save.inv);
    for (const pt of GT.parts) if (best[pt]) save.eq[pt] = best[pt].u;
    persist(); showScreen('gear');
  });
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
  chk('6부위 장착 (픽스처가 수동으로 끼운 것)', gear.equipped === 6, `${gear.equipped}부위`);
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
  /* ⚑ T124 — .gd-opt = 세트 옵션 **8칸** + 슬롯 강화 안내 1줄 = 9 (일반부터 1개 · 신화 +9강이 8칸째) */
  chk('옵션 8칸 목록 (해금 ◆ / 잠금 🔒) + 슬롯 안내 1줄', det.opts === 9 && det.locks >= 1 && det.opens >= 1,
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
    for (let i = 0; i < 3; i++) save.inv.push({ part: 'weapon', type: 'crit_weapon', rar: 0, plus: 0, u: save.uid++ });
    save.inv.push({ part: 'helm', type: 'hpsh_helm', rar: 1, plus: 0, u: save.uid++ });
    /* ⚑ T125 ①-c — 자동 장착이 없어졌고 «장착분은 재료가 아니다» 가 됐다.
       합성 시험은 재료 3개가 다 선택 가능해야 하므로 아무것도 장착하지 않은 상태로 둔다. */
    persist(); showScreen('gear'); renderGear();
  });
  await p.click('#fuseBtn'); await p.waitForTimeout(400);
  const f0 = await p.evaluate(() => ({ screen: document.querySelector('.screen.on')?.id, mats: document.querySelectorAll('#fgMats .fg-cell').length, fuse: document.getElementById('fgFuse').textContent.trim(), dis: document.getElementById('fgFuse').disabled }));
  chk('대장간 화면 전환', f0.screen === 'forge', f0.screen);
  chk('재료 3칸', f0.mats === 3);
  chk('재료 0개면 합성 버튼 잠김', f0.dis, f0.fuse);
  /* 인벤에서 같은 계열 3개 고르기 */
  await p.evaluate(async () => {
    const cells = [...document.querySelectorAll('#fgGrid .inv-cell')];
    for (const c of cells) { const g = invById(+c.dataset.u); if (g && g.type === 'crit_weapon') c.click(); }
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
  chk('합성 실행 — 3개가 1개(상위 등급)로', f2.inv === 2 && /1:crit_weapon/.test(f2.rar), `인벤 ${f2.inv} [${f2.rar}]`);
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

  /* ---------- ⑦ 세이브 정규화가 uid 유일성을 지킨다 (T68) ----------
     uid 는 인벤의 유일 키다 — `invById`·`save.eq`·대장간 `FG` 가 전부 이걸로 장비를 집는다.
     겹치면 세부 팝업·해제·합성이 «엉뚱한 장비» 를 집는다(장착 중인 신화 장비가 신품에 가려진다).
     정규화 블록이 종전엔 «uid 가 없는 항목» 만 봤기 때문에 두 갈래로 샜다 —
       ⓐ 같은 uid 를 가진 항목이 둘인 세이브   ⓑ `save.uid` 가 인벤 최대 uid 보다 뒤처진 세이브.
     ⓑ 는 정규화 시점엔 멀쩡해 보이고 **그 다음 뽑기·합성이 만든 신품에서** 터지므로,
     여기서는 부팅 직후 상태만이 아니라 «부팅 후 실제로 한 번 뽑아 본다» 까지 확인한다. */
  console.log('\n=== ⑦ 세이브 정규화 — uid 유일성 (T68) ===');
  {
    /* 인벤 6칸 전부 장착 · uid 1~6 인데 save.uid 필드가 없는 세이브(구버전·부분 손상) */
    await p.evaluate(() => {
      const inv = [], eq = {}; let u = 1;
      for (const pt of GT.parts) { inv.push({ u, part: pt, type: GT.types[pt][0], rar: 4, plus: 9 }); eq[pt] = u; u++; }
      const slots = {}; for (const pt of GT.parts) slots[pt] = 0;
      localStorage.clear();
      localStorage.setItem('kkoma-knight-v2', JSON.stringify({ gold: 0, gem: 1e6, maxChapter: 1, selChapter: 1, inv, eq, slots, gacha: { p50: 0, p10: 0, pulls: 0 } }));
    });
    await p.reload(); await p.waitForTimeout(700);
    const u0 = await p.evaluate(() => ({ uid: save.uid, mx: Math.max(...save.inv.map(g => g.u)), n: save.inv.length, eq: Object.keys(save.eq).length }));
    chk('uid 필드가 없는 세이브 — save.uid 가 인벤 최대 uid 위로 보정된다', u0.uid > u0.mx, `save.uid=${u0.uid} · 인벤 최대=${u0.mx}`);
    chk('보정하면서 장비·장착을 잃지 않는다', u0.n === 6 && u0.eq === 6, `인벤 ${u0.n} · 장착 ${u0.eq}`);
    const u1 = await p.evaluate(() => {
      doPull(1); closeOverlay();
      const uids = save.inv.map(g => g.u);
      const dup = [...new Set(uids.filter((x, i) => uids.indexOf(x) !== i))];
      /* 겹치면 «장착 중인 부위» 의 세부 팝업이 신품 이름으로 뜬다 — 증상 쪽도 같이 본다 */
      const ghost = GT.parts.filter(pt => { const g = save.inv.find(x => x.u === save.eq[pt]); return !g || g.part !== pt; });
      return { uids, dup, ghost };
    });
    chk('보정 후 뽑은 신품이 기존 uid 를 재사용하지 않는다', u1.dup.length === 0, `중복 uid [${u1.dup}] · 전체 [${u1.uids}]`);
    chk('장착 uid 가 다른 부위 장비를 가리키지 않는다', u1.ghost.length === 0, `어긋난 부위 ${u1.ghost}`);

    /* ⓐ 같은 uid 가 둘인 세이브 — 나중 것이 새 번호를 받고 먼저 것이 장착 연결을 유지해야 한다 */
    await p.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('kkoma-knight-v2', JSON.stringify({
        uid: 2, gold: 0, gem: 0, maxChapter: 1, selChapter: 1, eq: { weapon: 1 }, slots: {},
        inv: [{ u: 1, part: 'weapon', type: 'crit_weapon', rar: 4, plus: 9 },
              { u: 1, part: 'armor', type: 'hpsh_armor', rar: 0, plus: 0 }],
        gacha: { p50: 0, p10: 0, pulls: 0 },
      }));
    });
    await p.reload(); await p.waitForTimeout(700);
    const d = await p.evaluate(() => {
      const uids = save.inv.map(g => g.u);
      const keep = save.inv.find(g => g.u === save.eq.weapon);
      return { uids, dup: uids.length !== new Set(uids).size, uid: save.uid, keptRar: keep && keep.rar, keptPart: keep && keep.part };
    });
    chk('중복 uid 세이브 — 중복이 사라진다', !d.dup, `uid 목록 [${d.uids}]`);
    chk('중복 강등분도 save.uid 위의 새 번호를 받는다', Math.max(...d.uids) < d.uid, `최대 ${Math.max(...d.uids)} < save.uid ${d.uid}`);
    chk('먼저 나온 쪽이 장착 연결을 유지한다 (신화 무기)', d.keptPart === 'weapon' && d.keptRar === 4, `eq.weapon → ${d.keptPart}/rar${d.keptRar}`);
  }
  await p.evaluate(() => localStorage.clear());
  await p.reload(); await p.waitForTimeout(500);

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

  /* ---------- ⑤ 절대배치 뱃지의 기준 상자 (T60) ----------
     `.bang`(합성 «!» 알림 점)은 absolute + 음수 오프셋이라 호스트 버튼이 positioned 여야
     그 모서리에 붙는다. `#fuseBtn` 이 static 이던 시절엔 기준 상자가 `#gear` 로 밀려
     화면 우상단(378..394 × -6..10)으로 날아갔고 `#frame{overflow:hidden}` 에 잘렸다.
     정적 게이트(`verifyT2` ㉘)는 «CSS 에 position 이 있나» 까지만 보므로 **실제 위치는 여기서 본다.** */
  console.log('\n=== ⑤ 절대배치 뱃지의 기준 상자 (T60) ===');
  const ESC_OK = ['sndBtnL'];   /* 의도적으로 조상(#lobby)에 거는 것 — T54 가 🔊 를 상단 줄 밖으로 뺐다 */
  for (const vw of [390, 360]) {
    await p.setViewportSize({ width: vw, height: 844 });
    await p.evaluate(() => {                       /* 합성 가능 재료(일반 3개씩) → 뱃지가 뜨는 상태 */
      save.inv = []; save.eq = {};
      for (const pt of GT.parts) { const ty = GT.types[pt][0]; for (let i = 0; i < 3; i++) save.inv.push(newGear(pt, ty, 0, 0)); }
      save.gold = 1e9; persist(); showScreen('gear');
    });
    await p.waitForTimeout(350);
    const bg = await p.evaluate(() => {
      const btn = document.getElementById('fuseBtn'), el = btn.querySelector('.bang');
      if (!el) return { none: true };
      const fr = document.getElementById('frame').getBoundingClientRect();
      const rb = btn.getBoundingClientRect(), rg = el.getBoundingClientRect();
      return {
        anchor: el.offsetParent ? (el.offsetParent.id || el.offsetParent.tagName) : 'null',
        clip: Math.round(Math.max(0, rg.right - fr.right) + Math.max(0, fr.top - rg.top) +
                         Math.max(0, fr.left - rg.left) + Math.max(0, rg.bottom - fr.bottom)),
        dx: Math.round(rg.right - rb.right), dy: Math.round(rg.top - rb.top),
        box: [rg.left, rg.top, rg.right, rg.bottom].map(Math.round).join(','),
      };
    });
    chk(`[${vw}px] 합성 «!» 뱃지가 #fuseBtn 에 걸린다`, bg.anchor === 'fuseBtn', `기준 상자=${bg.anchor} · ${bg.box}`);
    chk(`[${vw}px] 뱃지가 프레임 안에 온전히 들어온다 (잘림 0px)`, bg.clip === 0, `잘림 ${bg.clip}px · ${bg.box}`);
    chk(`[${vw}px] 뱃지가 버튼 우상단 모서리에 붙는다`, Math.abs(bg.dx - 4) <= 1 && Math.abs(bg.dy + 6) <= 1, `버튼 대비 우 ${bg.dx}px · 상 ${bg.dy}px`);

    /* 같은 실패 모드 전수 감시 — 부모가 static 인 absolute 요소 (화면별) */
    for (const sc of ['gear', 'forge']) {
      await p.evaluate(s => showScreen(s), sc); await p.waitForTimeout(250);
      const esc = await p.evaluate(okIds => {
        const out = [];
        document.querySelectorAll('#frame *').forEach(el => {
          if (el.offsetParent === null) return;
          if (getComputedStyle(el).position !== 'absolute') return;
          const par = el.parentElement;
          if (!par || getComputedStyle(par).position !== 'static') return;
          if (okIds.includes(el.id)) return;
          out.push((el.id ? '#' + el.id : '.' + String(el.className).split(' ')[0]) +
                   '←' + (par.id ? '#' + par.id : '.' + String(par.className).split(' ')[0]));
        });
        return out;
      }, ESC_OK);
      chk(`[${vw}px] ${sc} 화면 — 기준 상자가 부모를 벗어난 absolute 요소 0`, esc.length === 0, esc.join(' / '));
    }
    await p.evaluate(() => showScreen('gear'));
  }
  await p.setViewportSize({ width: 390, height: 844 });

  /* ---------- ⑥ 합성 재료 3칸이 프레임 안에 온전히 들어온다 (T62) ----------
     `#fgMats` 는 «칸 3개 + 간격 2개» 로 폭이 고정인데 담는 `#forgeCol` 은 33% 라,
     하한이 없으면 좁은 프레임에서 좌우로 반씩 삐져나가 첫 칸이 `#frame` 에 잘리고
     셋째 칸이 `#fgBanner` 를 침범했다(T62 수정 전 실측: 프레임 303px 에서 12.9px 잘림).
     프레임 폭은 9:19 비율이라 **뷰포트 «높이» 에도 걸린다** — 주소창이 보이는 상태를
     흉내내려 360×640·390×750 을 함께 잰다. 정적 게이트(`verifyT2` ㉚)는 부등식만 보므로
     **실제 좌표는 여기서 본다.** */
  console.log('\n=== ⑥ 합성 재료 줄이 프레임 안에 들어온다 (T62) ===');
  for (const vp of [{ width: 360, height: 640 }, { width: 360, height: 800 }, { width: 390, height: 750 }, { width: 390, height: 844 }]) {
    await p.setViewportSize(vp);
    await p.evaluate(() => {                     /* 재료 3개를 실제로 채운 상태로 본다(부위 태그까지 렌더된다) */
      save.inv = []; save.eq = {};
      for (const pt of GT.parts) { const ty = GT.types[pt][0]; for (let i = 0; i < 3; i++) save.inv.push(newGear(pt, ty, 0, 0)); }
      save.gold = 1e9; persist(); openForge();
      const cells = [...document.querySelectorAll('#fgGrid .inv-cell')];
      for (const c of cells) { if (FG.length >= 3) break; c.click(); }
    });
    await p.waitForTimeout(350);
    const m = await p.evaluate(() => {
      const fr = document.getElementById('frame').getBoundingClientRect();
      const mats = document.getElementById('fgMats').getBoundingClientRect();
      const ban = document.getElementById('fgBanner').getBoundingClientRect();
      const parts = [...document.querySelectorAll('#fgMats .fg-cell, #fgMats .ptag')];
      let clip = 0;
      for (const el of parts) {
        const r = el.getBoundingClientRect();
        clip = Math.max(clip, Math.max(0, fr.left - r.left), Math.max(0, r.right - fr.right));
      }
      return { frW: +fr.width.toFixed(1), n: document.querySelectorAll('#fgMats .fg-cell').length,
        filled: FG.length, clip: +clip.toFixed(1), overBanner: +(mats.right - ban.left).toFixed(1) };
    });
    chk(`[${vp.width}×${vp.height}] 프레임 ${m.frW}px — 재료 칸·부위 태그가 프레임 밖으로 안 나간다`,
      m.clip === 0 && m.n === 3 && m.filled === 3, `잘림 ${m.clip}px · 칸 ${m.n}개(재료 ${m.filled})`);
    chk(`[${vp.width}×${vp.height}] 재료 줄이 결과 배너를 침범하지 않는다`,
      m.overBanner <= 0, `침범 ${m.overBanner}px`);
  }
  await p.setViewportSize({ width: 390, height: 844 });

  chk('pageerror 0', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  const bad = R.filter(r => !r.c);
  console.log(`\n[③] 통과 ${R.length - bad.length} · 불합격 ${bad.length}`);
  if (bad.length) console.log('불합격:', bad.map(x => x.n + (x.d ? ` (${x.d})` : '')).join(' / '));
  process.exit(bad.length ? 1 : 0);
})();
