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
    pity: document.querySelector('.gacha-card.gb-myth .pity')?.textContent.replace(/\s+/g, ' ').trim(),
  }));
  chk('상점 화면 전환', shop0.screen === 'shop');
  chk('일일 무료 다이아 버튼', shop0.free === '수령', shop0.free);
  chk('모의 결제 상품 1종 (주인이 정한 값만) · 잠금 칸은 살 수 없다',
    shop0.packs === 1 && shop0.lockBtns === 0, `상품 ${shop0.packs}종 · 잠금 ${shop0.lockCells}칸(버튼 ${shop0.lockBtns})`);
  /* ⚑⚑⚑ T153 (주인 확정 2026-09-05 18:1X) — 상자가 3종이다. 화면에 세 칸이 뜨고, 각 칸의 확률·가격·천장 줄이
     그 상자 것이어야 한다(희귀 상자는 천장 줄이 아예 없고, 전설 상자는 «전설 확정까지» 한 줄이다). */
  const boxes = await p.evaluate(() => [...document.querySelectorAll('.gacha-card')].map(c => ({
    cls: c.className,
    ttl: c.querySelector('.ttl')?.textContent.trim(),
    pity: c.querySelector('.pity')?.textContent.replace(/\s+/g, ' ').trim(),
    btns: [...c.querySelectorAll('.gacha-btns button')].map(b => ({ id: b.id, t: b.textContent.replace(/\s+/g, ' ').trim() })),
  })));
  chk('⚑ T153 상점에 뽑기 상자가 3칸이다 (희귀 · 전설 · 신화)',
    boxes.length === 3 && boxes[0].ttl === '희귀 상자' && boxes[1].ttl === '전설 상자' && boxes[2].ttl === '신화 상자',
    boxes.map(b => b.ttl).join(' / '));
  chk('⚑ T153 희귀 상자 — 확률 «희귀 33.3% · 일반 66.7%» · 1회 80💎 · 천장 줄 없음',
    /희귀 33\.3% · 일반 66\.7%/.test(boxes[0].pity || '') && !/확정까지/.test(boxes[0].pity || '')
      && /1회 💎80/.test(boxes[0].btns[0]?.t || '') && /10회 💎800/.test(boxes[0].btns[1]?.t || ''),
    `${boxes[0].pity} | ${boxes[0].btns.map(b => b.t).join(' / ')}`);
  chk('⚑ T153 전설 상자 — 확률 «전설 4% · 희귀 30% · 일반 66%» · 1회 200💎 · «전설 확정까지» 한 줄',
    /전설 4% · 희귀 30% · 일반 66%/.test(boxes[1].pity || '')
      && /전설 확정까지 10회/.test((boxes[1].pity || '').replace(/\s+/g, ' '))
      && !/신화 확정까지/.test(boxes[1].pity || '') && /1회 💎200/.test(boxes[1].btns[0]?.t || ''),
    `${boxes[1].pity} | ${boxes[1].btns.map(b => b.t).join(' / ')}`);
  chk('⚑ T153 신화 상자 — 확률 «신화 0.8% · 전설 4% · 희귀 30% · 일반 65.2%» · 1회 400💎',
    /신화 0\.8% · 전설 4% · 희귀 30% · 일반 65\.2%/.test(boxes[2].pity || '') && /1회 💎400/.test(boxes[2].btns[0]?.t || ''),
    `${boxes[2].pity} | ${boxes[2].btns.map(b => b.t).join(' / ')}`);
  chk('⚑ T153 어느 상자에도 «영웅» 이 안 뜬다 (등급 폐지)',
    !boxes.some(b => /영웅/.test(b.pity || '')), boxes.map(b => b.pity).join(' | '));
  /* ⚑ T125 ①-b (주인 21:1X) — 신화 상자 문구가 «신화 확정까지 N회 · 전설 확정까지 N회» 두 줄이다. */
  chk('천장 문구 — «신화 확정까지 N회 · 전설 확정까지 N회» (신화 상자)',
    /신화 확정까지\s*50\s*회/.test(boxes[2].pity || '') && /전설 확정까지\s*10\s*회/.test(boxes[2].pity || ''), boxes[2].pity);

  await p.click('#freeBtn'); await p.waitForTimeout(300);
  const shop1 = await p.evaluate(() => ({ gem: save.gem, free: document.getElementById('freeBtn').textContent.trim(), dis: document.getElementById('freeBtn').disabled }));
  chk('무료 다이아 2,500 수령', shop1.gem === shop0.gem + 2500, `${shop0.gem} → ${shop1.gem}`);
  chk('하루 1회 — 재수령 막힘', shop1.dis && /완료/.test(shop1.free), shop1.free);

  /* 뽑기 1회 + 10회 (다이아를 넣어 준다 — 모의 결제 경로 대신 상태를 직접) */
  await p.evaluate(() => { save.gem = 100000; renderShop(); });
  await p.click('#pull1_myth'); await p.waitForTimeout(500);
  const g1 = await p.evaluate(() => ({
    inv: save.inv.length, gem: save.gem, pulls: save.gachaBoxes.myth.pulls,
    ov: document.getElementById('overlay').classList.contains('on'),
    cells: document.querySelectorAll('#overlay .inv-cell, #overlay .pull-cell').length,
    svg: document.querySelectorAll('#overlay svg.gicon').length,
  }));
  chk('뽑기 1회 — 장비 1개 획득', g1.inv === 1 && g1.pulls === 1, `인벤 ${g1.inv} · 누적 ${g1.pulls}`);
  chk('뽑기 비용 400 다이아', g1.gem === 100000 - 400, `잔액 ${g1.gem}`);
  chk('결과 연출 오버레이 + 장비 SVG 아이콘', g1.ov && g1.svg >= 1, `svg ${g1.svg}개`);
  await p.evaluate(() => closeOverlay()); await p.waitForTimeout(200);
  await p.click('#pull10_myth'); await p.waitForTimeout(700);
  const g10 = await p.evaluate(() => ({ inv: save.inv.length, gem: save.gem, pulls: save.gachaBoxes.myth.pulls, svg: document.querySelectorAll('#overlay svg.gicon').length }));
  chk('뽑기 10회 — 장비 10개 추가', g10.inv === 11 && g10.pulls === 11, `인벤 ${g10.inv} · 누적 ${g10.pulls}`);
  /* ⚑ T131 — 여기서 잔액을 재는 단언이 없었다 (g10.gem 을 모으기만 하고 안 봤다). 10연차도 회차당 1회분이다. */
  chk('뽑기 10회 비용 4,000 다이아 (400 × 10회 · 할인·할증 없음)', g10.gem === 100000 - 400 - 4000, `잔액 ${g10.gem}`);
  chk('10회 결과 10칸 연출', g10.svg >= 10, `svg ${g10.svg}개`);
  await p.evaluate(() => closeOverlay()); await p.waitForTimeout(200);
  /* 천장 — 50회에서 신화가 반드시 나온다 */
  const pity = await p.evaluate(() => {
    save.inv = []; save.gachaBoxes.myth = { p50: 0, p10: 0, pulls: 0 }; save.gem = 1e9;
    /* «50번째가 반드시 신화» 로 보면 안 된다 — 그 전에 자연 신화가 나오면 천장이 리셋된다.
       천장의 실제 약속은 «신화 없이 50회를 넘기지 않는다», 피티는 «전설 이상 없이 10회를 넘기지 않는다» 다. */
    const rar = [];
    for (let i = 0; i < 600; i++) for (const g of gachaPull(save.gachaBoxes.myth, GT.boxes.myth)) rar.push(g.rar);   /* ⚑ T125 — 배열 */
    let gapM = 0, curM = 0, gapL = 0, curL = 0;
    for (const r of rar) {
      curM = r === GT.RAR_MYTH ? 0 : curM + 1; gapM = Math.max(gapM, curM);
      curL = r >= GT.RAR_LEGEND ? 0 : curL + 1; gapL = Math.max(gapL, curL);
    }
    return { gapM, gapL, myth: rar.filter(r => r === GT.RAR_MYTH).length, leg: rar.filter(r => r >= GT.RAR_LEGEND).length, n: rar.length };
  });
  chk('50회 천장 — 신화 없이 50회를 넘지 않는다', pity.gapM <= 50, `600회 중 최장 무신화 구간 ${pity.gapM}회 · 신화 ${pity.myth}개`);
  chk('10회 피티 — 전설 이상 없이 10회를 넘지 않는다', pity.gapL <= 10, `최장 무전설 구간 ${pity.gapL}회 · 전설↑ ${pity.leg}개`);
  /* ⚑⚑⚑ T125 ① (주인 21:0X) — 천장 겹침은 «이월» 이 아니라 «둘 다 지급» 이다.
     ⓐ 한 회차(p50=49 · p10=9)가 신화 1 + 전설 1 = 2개 ⓑ 그 겹침이 낀 10연차는 결과가 11개 ⓒ 두 카운터 리셋. */
  const ov = await p.evaluate(() => {
    save.gachaBoxes.myth = { p50: 49, p10: 9, pulls: 0 };
    const got = gachaPull(save.gachaBoxes.myth, GT.boxes.myth);
    const one = { n: got.length, rars: got.map(g => g.rar), p50: save.gachaBoxes.myth.p50, p10: save.gachaBoxes.myth.p10 };
    /* 10연차 안에서 겹치게: 카운터를 49·9 로 두면 **첫 회차**에서 천장과 피티가 같이 걸린다.
       (40·0 으로 두고 10회째를 노리면 중간의 자연 전설이 피티를 리셋해 겹침이 안 날 수 있다 — 결정적으로 간다.) */
    save.inv = []; save.eq = {}; save.gem = 1e9; save.gachaBoxes.myth = { p50: 49, p10: 9, pulls: 0 };
    const gem0 = save.gem;
    doPull(10,'myth');
    const ten = { inv: save.inv.length, pulls: save.gachaBoxes.myth.pulls, cells: document.querySelectorAll('#overlay .inv-cell').length,
                  spent: gem0 - save.gem };
    closeOverlay();
    /* ⚑ T131 — 겹침 «1회» 뽑기의 청구도 잰다 (주인 T125 ① «비용은 1회분 그대로») */
    save.inv = []; save.eq = {}; save.gem = 1e9; save.gachaBoxes.myth = { p50: 49, p10: 9, pulls: 0 };
    const gem1 = save.gem;
    doPull(1,'myth');
    const solo = { inv: save.inv.length, spent: gem1 - save.gem };
    closeOverlay();
    return { one, ten, solo };
  });
  await p.waitForTimeout(200);
  chk('겹침 회차가 2개를 준다 (신화 + 전설)', ov.one.n === 2 && ov.one.rars[0] === 3 && ov.one.rars[1] === 2,   /* ⚑ T153 등급 인덱스 */
    `${ov.one.n}개 [${ov.one.rars.join(',')}]`);
  chk('겹침 뒤 두 카운터 리셋 (이월 없음)', ov.one.p50 === 0 && ov.one.p10 === 0, `p50=${ov.one.p50} p10=${ov.one.p10}`);
  chk('겹침이 낀 10연차는 11개', ov.ten.inv === 11 && ov.ten.pulls === 10, `인벤 ${ov.ten.inv} · 뽑기 ${ov.ten.pulls}회`);
  chk('11개가 결과 화면에도 다 뜬다', ov.ten.cells === 11, `${ov.ten.cells}칸`);
  /* ⚑⚑⚑ T131 — T125 ① 의 나머지 반쪽. «둘 다 준다» 는 위 3항목이 보지만 «비용은 1회분 그대로» 는
     두 엔진 어디에도 단언이 없었다 — 사본에서 겹침분을 추가 청구해도 정적 게이트 18종이 전부 초록이었다. */
  chk('겹침이 낀 10연차도 비용은 4,000 (11개를 받아도 10회분 · T125 ①)', ov.ten.spent === 4000,
    `차감 ${ov.ten.spent} 다이아 · 받은 것 ${ov.ten.inv}개`);
  chk('겹침 1회 뽑기도 비용은 400 (2개를 받아도 1회분 · T125 ①)', ov.solo.spent === 400 && ov.solo.inv === 2,
    `차감 ${ov.solo.spent} 다이아 · 받은 것 ${ov.solo.inv}개`);
  /* ⚑⚑⚑ T133 — T125 ①-b 의 나머지 반쪽. 위 «천장 문구» 단언은 **처음 화면(카운터 0)** 에서 «50회·10회» 만 보고,
     정적 ㉜⑤ 는 «GT.pityMyth·GT.pityLegend 라는 이름이 블록 안에 있는가» 만 본다. 그래서 두 줄의 뺄셈을 지운
     사본(= 몇 번을 뽑아도 영원히 50·10)이 **정적 19종·이 스위트 80/80 을 전부 초록으로 통과**했다(T133 실측).
     주인 21:1X 원문은 «N = 남은 횟수 · 50회·10회에서 **카운트다운**» 이라 화면에서 실제로 줄어드는지 잰다. */
  const cd = await p.evaluate(() => {
    const rd = () => {
      /* ⚑ T153 — 상자가 3칸이라 «신화 상자» 칸의 천장 줄을 집는다 (첫 칸은 희귀 상자다) */
      const t = (document.querySelector('.gacha-card.gb-myth .pity')?.textContent || '').replace(/\s+/g, ' ');
      const m = /신화 확정까지\s*(-?\d+)\s*회/.exec(t), l = /전설 확정까지\s*(-?\d+)\s*회/.exec(t);
      return { m: m ? +m[1] : null, l: l ? +l[1] : null, t: t.trim() };
    };
    save.inv = []; save.eq = {}; save.gem = 1e9;
    save.gachaBoxes.myth = { p50: 0, p10: 0, pulls: 0 }; renderShop(); const a = rd();
    save.gachaBoxes.myth = { p50: 7, p10: 3, pulls: 7 }; renderShop(); const b = rd();
    save.gachaBoxes.myth = { p50: 49, p10: 9, pulls: 49 }; renderShop(); const c = rd();
    /* 상태를 손으로 세우는 것에 그치지 않고 **실제 뽑기**로도 움직이는지 본다:
       p50=49·p10=9 는 겹침 회차라 한 번 뽑으면 두 카운터가 같이 리셋된다(T125 ①) → 표시도 50·10 으로 돌아온다. */
    doPull(1,'myth'); closeOverlay(); renderShop(); const d = rd();
    /* 겹치지 않는 평범한 한 회차: p50·p10 이 각각 1씩 오르므로 표시는 각각 1씩 줄어야 한다.
       (자연 전설↑ 이 나오면 p10 이 리셋되므로 신화 쪽만 결정적으로 본다.) */
    save.gachaBoxes.myth = { p50: 10, p10: 2, pulls: 10 }; renderShop(); const e = rd();
    doPull(1,'myth'); closeOverlay(); renderShop(); const f = rd();
    return { a, b, c, d, e, f, p50: save.gachaBoxes.myth.p50 };
  });
  await p.waitForTimeout(200);
  chk('천장 표시가 카운트다운이다 — 카운터 0·0 → 50/10 · 7·3 → 43/7 · 49·9 → 1/1',
    cd.a.m === 50 && cd.a.l === 10 && cd.b.m === 43 && cd.b.l === 7 && cd.c.m === 1 && cd.c.l === 1,
    `${cd.a.m}/${cd.a.l} → ${cd.b.m}/${cd.b.l} → ${cd.c.m}/${cd.c.l}`);
  chk('신화 줄은 p50 만, 전설 줄은 p10 만 본다 (두 카운터가 안 뒤바뀌었다)',
    cd.b.m === 43 && cd.b.l === 7, `p50=7·p10=3 에서 ${cd.b.m}/${cd.b.l} (기대 43/7)`);
  chk('겹침 회차를 실제로 뽑으면 표시도 50·10 으로 돌아온다 (T125 ① 두 카운터 리셋)',
    cd.d.m === 50 && cd.d.l === 10, `${cd.d.m}/${cd.d.l}`);
  /* 마지막 항목만 실제 굴림에 기대므로 «p50 이 11» 로 못박지 않는다 — 0.1% 로 자연 신화가 떠 p50 이 0 이 되면
     기대 표시도 50 이다. 보는 것은 언제나 «화면 = 50 − p50» 이고, 카운터가 움직였다는 것까지 같이 본다. */
  chk('평범한 1회 뽑기를 화면이 따라간다 (표시 = 50 − p50 · 카운터가 실제로 움직였다)',
    cd.e.m === 40 && cd.p50 !== 10 && cd.f.m === 50 - cd.p50, `${cd.e.m} → ${cd.f.m} (p50 10 → ${cd.p50})`);
  /* ⚑⚑⚑ T125 ①-c — 뽑기 결과 자동 장착 금지 + 수동 장착 동작 */
  const noAuto = await p.evaluate(() => {
    save.inv = []; save.eq = {}; save.gem = 1e9; save.gachaBoxes.myth = { p50: 0, p10: 0, pulls: 0 };
    doPull(10,'myth'); closeOverlay();
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
  /* ⚑⚑⚑ T128 — «열어 보면 지워진다» 갈래는 위 «장착» 갈래와 다른 코드 경로다(장착은 renderGear 를 부르고 닫기는 안 불렀다).
     그래서 **모델 플래그가 아니라 화면의 뱃지 개수**를 센다 — 모델만 보는 단언은 이 결함을 그대로 통과시켰다. */
  const nwView = await p.evaluate(() => {
    save.inv = []; save.eq = {}; save.gem = 1e9; save.gachaBoxes.myth = { p50: 0, p10: 0, pulls: 0 };
    doPull(10,'myth'); closeOverlay();
    showScreen('gear'); renderGear();
    const cnt = () => document.querySelectorAll('#invGrid .nwm').length;
    const before = cnt();
    const g = save.inv[0];
    openGearDetail(g.u);
    const hasClose = !!document.getElementById('gdClose');
    if (hasClose) document.getElementById('gdClose').click();   /* «닫기» — 장착하지 않는다 */
    const after = cnt(), model = save.inv.filter(x => x.nw).length;
    closeOverlay();
    return { before, after, model, inv: save.inv.length, hasClose };
  });
  await p.waitForTimeout(200);
  chk('세부 팝업을 열면 NEW 플래그가 지워진다 (닫기 갈래)', nwView.hasClose && nwView.model === nwView.inv - 1,
    `모델 ${nwView.model}/${nwView.inv}`);
  chk('«닫기» 직후 인벤 격자의 NEW 뱃지가 즉시 줄어든다', nwView.before === nwView.inv && nwView.after === nwView.model,
    `뱃지 ${nwView.before} → ${nwView.after} · 모델 ${nwView.model}`);
  /* ⚑⚑⚑ T129 — ①-c 의 나머지 절반 «↑ 표시»(지금 낀 것보다 좋은 장비가 인벤에 있으면 부위 칸에 ↑ 만).
     T128 이 «다음 워커가 넣을 자리» 로 남긴 축이다. 여기도 T128 과 같은 이유로 **모델이 아니라 화면**을
     본다 — `.upmark` 의 개수와 **어느 부위 칸에 붙었는지**를 센다(정적 ㊶ 는 판정식을, 여기는 표시를). */
  const upm = await p.evaluate(() => {
    const cnt = () => document.querySelectorAll('#gearColL .upmark, #gearColR .upmark').length;
    const at = pt => !!document.querySelector(`.slot-card[data-pt="${pt}"] .upmark`);
    const add = (pt, rar, plus) => { const g = newGear(pt, GT.types[pt][0], rar, plus); save.inv.push(g); return g; };
    save.inv = []; save.eq = {}; save.gem = 1e9;
    for (const pt of GT.parts) save.eq[pt] = add(pt, 2, 0).u;   /* 여섯 부위 전부 «전설 +0» 을 끼운다 (⚑ T153 — 전설 = 2) */
    showScreen('gear'); renderGear();
    const none = cnt();
    add('weapon', 2, 0); renderGear();                          /* 같은 등급·강화 — «더 좋은» 이 아니다 (⚑ T153 전설=2) */
    const equal = cnt();
    const better = add('weapon', 3, 0); renderGear();           /* 등급이 위 (신화=3) */
    const byRar = { n: cnt(), weapon: at('weapon'), helm: at('helm') };
    add('helm', 2, 3); renderGear();                            /* 같은 등급 · 강화가 위 (⚑ T153 전설=2) */
    const byPlus = { n: cnt(), helm: at('helm') };
    const eqBefore = Object.keys(save.eq).length;
    save.eq.weapon = better.u; renderGear();                    /* 유저가 직접 끼우면 그 부위 ↑ 는 꺼진다 */
    return { none, equal, byRar, byPlus, eqBefore,
      after: { n: cnt(), weapon: at('weapon'), helm: at('helm') } };
  });
  await p.waitForTimeout(200);
  chk('↑ — 인벤에 더 좋은 게 없으면 한 칸도 안 뜬다', upm.none === 0, `${upm.none}개`);
  chk('↑ — 같은 등급·같은 강화는 «더 좋은» 이 아니다 (헛장착 유도 금지)', upm.equal === 0, `${upm.equal}개`);
  chk('↑ — 등급이 위인 장비가 인벤에 있으면 그 부위 칸에만 뜬다',
    upm.byRar.n === 1 && upm.byRar.weapon && !upm.byRar.helm, `${upm.byRar.n}개 · 무기 ${upm.byRar.weapon} · 투구 ${upm.byRar.helm}`);
  chk('↑ — 같은 등급이라도 강화가 위면 뜬다 (등급·강화 둘 다 본다)',
    upm.byPlus.n === 2 && upm.byPlus.helm, `${upm.byPlus.n}개 · 투구 ${upm.byPlus.helm}`);
  chk('↑ 가 떠도 자동으로 갈아끼우지 않는다 (장착 부위 수 불변 · T125 ①-c)', upm.eqBefore === 6, `${upm.eqBefore}부위`);
  chk('↑ — 유저가 그것을 장착하면 그 부위 ↑ 만 꺼진다',
    upm.after.n === 1 && !upm.after.weapon && upm.after.helm, `${upm.after.n}개 · 무기 ${upm.after.weapon} · 투구 ${upm.after.helm}`);
  await p.evaluate(() => { closeOverlay(); showScreen('shop'); }); await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/t3-shop.png` });

  /* ---------- 장비 탭 ---------- */
  console.log('\n=== 장비 탭 (장착 · 슬롯 강화 · 세부 팝업) ===');
  /* ⚑ T125 ①-c — 자동 장착이 없어져 이 픽스처가 직접 «부위별 최고» 를 끼운다(장비 탭 단언의 전제). */
  await p.evaluate(() => {
    save.inv = []; save.eq = {}; save.gem = 1e9; save.gold = 1e9;
    for (let i = 0; i < 60; i++) for (const raw of gachaPull(save.gachaBoxes.myth, GT.boxes.myth)) { const g = newGear(raw.part, raw.type, raw.rar, raw.plus); g.u = save.uid++; save.inv.push(g); }
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
  /* ⚑ T124 → ⚑ T153 — .gd-opt = 세트 옵션 **7칸** + 슬롯 강화 안내 1줄 = 8 (일반부터 1개 · 신화 +9강이 7칸째) */
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

  /* ---------- ⚑ T145 → ⚑⚑⚑ T153 — 세부 팝업 마지막 7번 칸 = «흡혈 +8%» ----------
     정적 게이트(verifyGearOptOrder·verifyGearOptAgg)는 GOPT 표를 보지만, 유저가 실제로 읽는 줄은
     세부 팝업의 옵션 목록이다. ⚑ T153 로 «공격력 +10%» 칸이 사라져 흡혈이 **마지막 칸(신화 +9강)** 이 됐다:
     +6강에서는 아직 잠겨 있고 +9강에서 열린다. */
  console.log('\n=== ⚑⚑⚑ T153 세부 팝업 — 마지막 7번 = 흡혈 +8% (공격력 칸 삭제) ===');
  for (const [plus, want7open] of [[6, false], [9, true]]) {
    const st = await p.evaluate((pl) => {
      save.inv = []; save.eq = {}; save.slots = {};
      const g = newGear('weapon', 'crit_weapon', GT.RAR_MYTH, pl); g.u = save.uid++;
      save.inv.push(g); save.eq.weapon = g.u; persist(); showScreen('gear');
      return { plus: g.plus, rar: g.rar };
    }, plus);
    await p.waitForTimeout(300);
    await p.click('#gearColL .slot-card'); await p.waitForTimeout(400);
    const d = await p.evaluate(() => {
      const rows = [...document.querySelectorAll('#overlay .gd-opt')]
        .filter(e => !/슬롯/.test(e.textContent))
        .map(e => ({ t: e.textContent.replace(/\s+/g, ' ').trim(), lock: e.classList.contains('lock') }));
      return { rows, n: rows.length };
    });
    const r7 = d.rows[6];
    chk(`신화 +${plus} 세부 팝업 — 옵션 줄이 7개다 (⚑ T153)`, d.n === 7, `${d.n}줄`);
    chk(`신화 +${plus} 세부 팝업 — 마지막 7번 줄이 «흡혈 +8%» 다`,
      !!r7 && /흡혈 \+8%/.test(r7.t), r7 ? r7.t : `줄 ${d.n}개`);
    chk(`신화 +${plus} 세부 팝업 — 7번이 ${want7open ? '해금' : '잠금'} 이다`,
      !!r7 && r7.lock === !want7open, r7 ? `lock=${r7.lock}` : '(없음)');
    chk(`신화 +${plus} 세부 팝업 — «공격력 +10%» 줄이 없다 (⚑ T153 삭제)`,
      !d.rows.some(x => /공격력 \+10%/.test(x.t)), d.rows.map(x => x.t).join(' | ').slice(0, 60));
    chk(`신화 +${plus} 세부 팝업 — «흡혈» 줄이 정확히 1개다 (부위당 1칸)`,
      d.rows.filter(x => /흡혈/.test(x.t)).length === 1,
      `${d.rows.filter(x => /흡혈/.test(x.t)).length}줄`);
    await p.evaluate(() => closeOverlay()); await p.waitForTimeout(200);
    void st;
  }
  /* ---------- ⚑ T147 — 세부 팝업 «잠금 안내» 가 해금 조건과 맞는가 (한 칸 밀려 있었다) ----------
     옵션 i 는 GT.optCount(rar,plus) > i 일 때 열린다 → ⚑ T153 로 i=0~3 은 일반·희귀·전설·신화 «이상»,
     i=4~6 은 신화 +3/+6/+9강. 일반 +0 장비 하나로 7칸의 안내 문구를 전수로 읽는다. */
  console.log('\n=== ⚑ T147·T153 세부 팝업 잠금 안내 — 7칸 전수 ===');
  {
    await p.evaluate(() => {
      save.inv = []; save.eq = {}; save.slots = {};
      const g = newGear('weapon', 'crit_weapon', 0, 0); g.u = save.uid++;
      save.inv.push(g); save.eq.weapon = g.u; persist(); showScreen('gear');
    });
    await p.waitForTimeout(300);
    await p.click('#gearColL .slot-card'); await p.waitForTimeout(400);
    const rows = await p.evaluate(() => [...document.querySelectorAll('#overlay .gd-opt')]
      .filter(e => !/슬롯/.test(e.textContent))
      .map(e => e.textContent.replace(/\s+/g, ' ').trim()));
    const WANT = [null, '희귀 이상', '전설 이상', '신화 이상', '신화 +3강', '신화 +6강', '신화 +9강'];
    chk('일반 +0 장비 — 1번만 해금(◆) 이고 2~7번은 잠금(🔒)', rows.length === 7 && /^◆/.test(rows[0]) && rows.slice(1).every(t => /^🔒/.test(t)),
      `${rows.length}줄 — ${rows.map(t => t.slice(0, 2)).join('')}`);
    for (let i = 1; i < 7; i++) {
      chk(`${i + 1}번 칸 잠금 안내가 «(${WANT[i]})» 다`, !!rows[i] && rows[i].includes(`(${WANT[i]})`),
        rows[i] || '(없음)');
    }
    await p.evaluate(() => closeOverlay()); await p.waitForTimeout(200);
  }

  {
    /* 엔진 쪽 실측 — ⚑ T153 로 흡혈이 마지막 칸이라 **풀셋 +9강**에서 부위마다 가산돼 48 이다(= 준 피해의 48%). */
    const agg = await p.evaluate(() => {
      const set = parts => {
        save.inv = []; save.eq = {}; save.slots = {};
        for (const pt of parts) { const g = newGear(pt, GT.types[pt][0], GT.RAR_MYTH, 9); g.u = save.uid++; save.inv.push(g); save.eq[pt] = g.u; }
        persist(); return playerBase().steal;
      };
      const full = set(GT.parts), one = set(['weapon']);
      return { full, one };
    });
    chk('index.html 엔진 — 풀셋 +9강 흡혈이 부위마다 가산돼 48 이다', agg.full === 48, `steal=${agg.full}`);
    chk('index.html 엔진 — 1부위만 끼면 흡혈 8 이다', agg.one === 8, `steal=${agg.one}`);
  }

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

  /* ---------- ⚑⚑⚑ T161 — 전설 +2 → 합성 → 신화 0강 변환 (주인 확정 2026-09-05 20:5X) ---------- */
  console.log('\n=== ⚑ T161 전설 +3강 대신 신화 0강 (임계 10 → 3) ===');
  {
    /* 임계는 게임에서 읽는다 — 리터럴 3 을 여기 적으면 상수가 바뀌어도 시험이 안 따라온다.
       («확정값 3» 을 지키는 자리는 정적 게이트 `verifyT2` 다 — 여기는 «규칙대로 도는가» 를 본다.) */
    const t = await p.evaluate(() => {
      const L2M = GT.legendToMythPlus, MAX = L2M - 1;
      /* 전설 최대강(+2) 3개를 쥐어 준다 → 합성하면 규칙상 신화 0강이 나와야 한다 */
      save.inv = []; save.eq = {}; save.slots = {}; FG.length = 0;
      for (let i = 0; i < 3; i++) save.inv.push({ part: 'weapon', type: 'crit_weapon', rar: GT.RAR_LEGEND, plus: MAX, u: save.uid++ });
      persist(); showScreen('forge'); renderForge();
      return { L2M, MAX, RL: GT.RAR_LEGEND, RM: GT.RAR_MYTH };
    });
    await p.evaluate(() => { for (const c of [...document.querySelectorAll('#fgGrid .inv-cell')]) c.click(); });
    await p.waitForTimeout(400);
    const pv = await p.evaluate(() => ({
      conv: !!document.getElementById('fgConv'),
      convTxt: (document.getElementById('fgConv') || {}).textContent || '',
      banner: document.getElementById('fgBanner').textContent.replace(/\s+/g, ' ').trim(),
      picked: FG.length,
    }));
    chk(`ⓐ 전설 +${t.MAX} 3개 선택 — 결과 미리보기가 «신화» 라고 알린다`,
        pv.picked === 3 && /신화/.test(pv.banner), pv.banner.slice(0, 60));
    /* ② 합성 화면 안내문 (주인 지시 ②) — 임계를 문구에서 읽어 상수와 대조한다(하드코딩 금지 축) */
    chk('ⓑ 변환 안내문이 뜬다 — «전설 +N강 대신 신화 0강»',
        pv.conv && pv.convTxt.includes(`전설 +${t.L2M}강 대신`) && pv.convTxt.includes('신화 0강'), pv.convTxt);
    await p.click('#fgFuse'); await p.waitForTimeout(500);
    const af = await p.evaluate(() => save.inv.map(g => `${g.rar}:+${g.plus}`).join(','));
    chk(`ⓒ 합성 실행 — 전설 +${t.MAX} 3개가 신화 0강 1개가 된다`, af === `${t.RM}:+0`, `인벤 [${af}]`);

    /* ⓓ 규칙의 반대편: 전설 +3(= 임계)은 «존재할 수 없다». 합성으로도 안 나오고, 세이브에 있어도 안 남는다. */
    const reach = await p.evaluate(() => {
      const L2M = GT.legendToMythPlus, out = [];
      for (let plus = 0; plus < L2M; plus++)
        out.push(fuseMake({ part: 'weapon', type: 'crit_weapon', rar: GT.RAR_LEGEND, plus }));
      return { over: out.filter(g => g.rar === GT.RAR_LEGEND && g.plus >= L2M).length, n: out.length,
               last: `${out[out.length - 1].rar}:+${out[out.length - 1].plus}` };
    });
    chk(`ⓓ 합성으로 전설 +${t.L2M} 이상이 나오는 경로가 없다 (0~${t.MAX} 전수)`,
        reach.over === 0, `${reach.n}가지 · 마지막(전설 +${t.MAX} 합성) = ${reach.last}`);

    /* ⓔ 세이브 마이그레이션 — 임계를 내리기 전 세이브의 전설 +3~+9 가 신화 0강으로 옮겨진다 */
    await p.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('kkoma-knight-v2'));
      raw.inv = [{ part: 'weapon', type: 'crit_weapon', rar: GT.RAR_LEGEND, plus: 3, u: 9001 },
                 { part: 'helm',   type: 'hpsh_helm',   rar: GT.RAR_LEGEND, plus: 9, u: 9002 },
                 { part: 'armor',  type: 'evade_armor', rar: GT.RAR_LEGEND, plus: 2, u: 9003 }];
      raw.eq = {}; localStorage.setItem('kkoma-knight-v2', JSON.stringify(raw));
    });
    await p.reload(); await p.waitForTimeout(700);
    const mg = await p.evaluate(() => ({
      inv: save.inv.map(g => `${g.part}:${g.rar}:+${g.plus}`).sort().join(','),
      over: save.inv.filter(g => g.rar === GT.RAR_LEGEND && g.plus >= GT.legendToMythPlus).length,
      RM: GT.RAR_MYTH, RL: GT.RAR_LEGEND,
    }));
    chk('ⓔ 세이브의 전설 +3·+9 가 신화 0강으로 마이그레이션 (전설 +2 는 그대로)',
        mg.over === 0 && mg.inv === `armor:${mg.RL}:+2,helm:${mg.RM}:+0,weapon:${mg.RM}:+0`, mg.inv);
  }

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
      for (const pt of GT.parts) { inv.push({ u, part: pt, type: GT.types[pt][0], rar: GT.RAR_MYTH, plus: 9 }); eq[pt] = u; u++; }
      const slots = {}; for (const pt of GT.parts) slots[pt] = 0;
      localStorage.clear();
      localStorage.setItem('kkoma-knight-v2', JSON.stringify({ gold: 0, gem: 1e6, maxChapter: 1, selChapter: 1, inv, eq, slots, gacha: { p50: 0, p10: 0, pulls: 0 } }));
    });
    await p.reload(); await p.waitForTimeout(700);
    const u0 = await p.evaluate(() => ({ uid: save.uid, mx: Math.max(...save.inv.map(g => g.u)), n: save.inv.length, eq: Object.keys(save.eq).length }));
    chk('uid 필드가 없는 세이브 — save.uid 가 인벤 최대 uid 위로 보정된다', u0.uid > u0.mx, `save.uid=${u0.uid} · 인벤 최대=${u0.mx}`);
    chk('보정하면서 장비·장착을 잃지 않는다', u0.n === 6 && u0.eq === 6, `인벤 ${u0.n} · 장착 ${u0.eq}`);
    const u1 = await p.evaluate(() => {
      doPull(1,'myth'); closeOverlay();
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
        /* ⚑ T153 — 이 절은 uid 를 재는 자리라 등급 마이그레이션이 끼면 안 된다: 판 표시를 «현재 판» 으로 심어
           이미 4등급 세이브임을 알린다(마이그레이션 자체는 T153 절이 따로 잰다). */
        uid: 2, gold: 0, gem: 0, maxChapter: 1, selChapter: 1, eq: { weapon: 1 }, slots: {}, gearRarV: 2,
        inv: [{ u: 1, part: 'weapon', type: 'crit_weapon', rar: GT.RAR_MYTH, plus: 9 },
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
    chk('먼저 나온 쪽이 장착 연결을 유지한다 (신화 무기)', d.keptPart === 'weapon' && d.keptRar === 3, `eq.weapon → ${d.keptPart}/rar${d.keptRar}`);
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

  /* ---------- ⚑⚑⚑ T140 장비 아이콘 크기 (주인 2026-09-05 14:3X «너무 작아서 잘 안 보임») ----------
     주인 ② 의 위임 기본값은 «지금의 약 1.6배 · 칸 안에서 칸 폭의 70% 이상» 이다. 크기 노브는 칸의
     `font-size` 하나뿐(`.gicon` 이 1em)이라 **CSS 한 줄만 되돌려도 조용히 작아진다** — 그래서 실측으로 못박는다.
     ⚑ 인벤·뽑기 결과 칸은 «가로가 세로의 1.18배» 라 짧은 변이 한계다(칸 자체는 T116 레퍼런스 값이라 못 키운다) —
       그래서 **짧은 변 70%** 로 잰다(폭 기준은 참고로 함께 찍는다). 세부 팝업은 정사각이라 폭 = 짧은 변이다. */
  console.log('\n=== ⚑ T140 장비 아이콘 크기 — 칸의 70% 이상 · 프레임 밖으로 안 나간다 (실측) ===');
  for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 800 }]) {
    await p.setViewportSize(vp);
    await p.waitForTimeout(200);
    const t140 = await p.evaluate(async () => {
      const fr = document.getElementById('frame').getBoundingClientRect();
      const out = { frW: +fr.width.toFixed(1), rows: [], clip: 0, pageIcons: 0 };
      const take = (nm, cellSel, icSel) => {
        const c = document.querySelector(cellSel), i = document.querySelector(icSel || (cellSel + ' .gicon'));
        if (!c || !i) { out.rows.push({ nm, miss: true }); return; }
        const cr = c.getBoundingClientRect(), ir = i.getBoundingClientRect();
        const short = Math.min(cr.width, cr.height);
        out.rows.push({ nm, cell: +cr.width.toFixed(1), icon: +ir.width.toFixed(1),
          shortPct: +(ir.width / short * 100).toFixed(1), wPct: +(ir.width / cr.width * 100).toFixed(1),
          framePct: +(ir.width / fr.width * 100).toFixed(2),
          fits: ir.width <= cr.width + 0.6 && ir.height <= cr.height + 0.6 });
      };
      save.inv = []; save.eq = {}; save.uid = 1;
      /* 부위마다 4개 — 하나는 장착하고 남은 3개로 합성한다(«장착분은 재료가 아니다» · T125 ①-c) */
      for (const pt of GT.parts) for (let k = 0; k < 4; k++) save.inv.push(newGear(pt, GT.types[pt][0], 2, k));
      for (const pt of GT.parts) { const g = save.inv.find(x => x.part === pt); if (g) save.eq[pt] = g.u; }
      showScreen('gear'); renderGear();
      take('장비 탭 부위칸', '#gearColL .slot-card');
      take('인벤 칸', '#invGrid .inv-cell');
      openForge(); renderForge();
      for (const g of save.inv.filter(x => x.part === 'weapon' && save.eq.weapon !== x.u).slice(0, 3)) {
        const btn = document.querySelector(`#fgGrid .inv-cell[data-u="${g.u}"]`); if (btn) btn.click();
      }
      await new Promise(r => setTimeout(r, 120));
      take('합성 재료 칸', '#fgMats .fg-cell');
      take('합성 결과 칸', '#fgResult');
      showScreen('shop'); save.gem = 999999; doPull(10,'myth');
      await new Promise(r => setTimeout(r, 420));
      out.pullCells = document.querySelectorAll('.pull-list .inv-cell').length;
      take('뽑기 결과 칸', '.pull-list .inv-cell');
      closeOverlay();
      showScreen('gear'); renderGear();
      openGearDetail(save.inv[0].u);
      await new Promise(r => setTimeout(r, 420));
      take('세부 팝업 아이콘칸', '.gd-ic');
      closeOverlay();
      showScreen('gear'); renderGear();
      /* 프레임 밖으로 삐져나간 아이콘·뱃지가 하나도 없어야 한다 */
      for (const el of document.querySelectorAll('#gear .gicon, #gear .ptag, #gear .nwm, #gear .upmark, #gear .plus')) {
        const r = el.getBoundingClientRect(); out.pageIcons++;
        out.clip = Math.max(out.clip, Math.max(0, fr.left - r.left), Math.max(0, r.right - fr.right));
      }
      out.clip = +out.clip.toFixed(1);
      return out;
    });
    for (const r of t140.rows) {
      chk(`[${vp.width}×${vp.height}] ${r.nm} — 아이콘이 칸 짧은 변의 70% 이상`,
        !r.miss && r.shortPct >= 70 && r.fits,
        r.miss ? '칸이나 아이콘을 못 찾았다' : `칸 ${r.cell}px · 아이콘 ${r.icon}px · 짧은변 ${r.shortPct}% · 폭 ${r.wPct}% · 프레임 ${r.framePct}%`);
    }
    chk(`[${vp.width}×${vp.height}] 장비 탭의 아이콘·뱃지가 프레임 밖으로 안 나간다`,
      t140.clip === 0 && t140.pageIcons > 0, `잘림 ${t140.clip}px · 잰 요소 ${t140.pageIcons}개`);
    chk(`[${vp.width}×${vp.height}] 부위 6칸은 3×2 유지 (칸을 키워도 열을 줄이지 않는다 — 주인 ②)`,
      (await p.evaluate(() => document.querySelectorAll('#gearColL .slot-card').length === 3
        && document.querySelectorAll('#gearColR .slot-card').length === 3)), '');
  }
  await p.setViewportSize({ width: 390, height: 844 });

  /* ---------- ⚑⚑⚑ T153 — 영웅 등급 폐지: 합성 체인 · 세부 팝업 7칸 · 세이브 마이그레이션 ---------- */
  const t153 = await p.evaluate(() => {
    const out = {};
    out.rarNames = GT.rarName.slice();
    out.colors = GT.rarColor.length;
    /* ⓐ 합성 — 희귀 3개가 «전설» 이 된다(영웅이 사라진 자리) */
    save.inv = []; save.eq = {}; save.uid = 1;
    for (let i = 0; i < 3; i++) save.inv.push(newGear('weapon', 'crit_weapon', 1, 0));
    fuseAll(save.inv, new Set());
    out.fused = save.inv.length === 1 ? { rar: save.inv[0].rar, nm: GT.rarName[save.inv[0].rar] } : null;
    /* ⓑ 세부 팝업 — 신화 +9강이면 옵션 7칸이 전부 열리고 «공격력 +10%» 이 한 칸도 없다 */
    save.inv = [newGear('weapon', 'crit_weapon', GT.RAR_MYTH, 9)];
    save.eq = {}; renderGear(); openGearDetail(save.inv[0].u);
    const rows = [...document.querySelectorAll('.gd-opt')];
    out.optRows = rows.length;
    out.optLocked = rows.filter(r => r.classList.contains('lock')).length;
    out.optText = rows.map(r => r.textContent.replace(/\s+/g, ' ').trim()).join(' | ');
    out.secname = document.querySelector('.gd-secname')?.textContent.trim();
    closeOverlay();
    /* ⓒ 잠금 안내 — 일반 0강이면 1칸만 열리고 잠긴 칸의 조건이 «희귀 이상 … 신화 +9강» 이다 */
    save.inv = [newGear('weapon', 'crit_weapon', 0, 0)];
    renderGear(); openGearDetail(save.inv[0].u);
    const rows0 = [...document.querySelectorAll('.gd-opt')];
    /* ⚑ T155 ② — 소환 옵션 문구에 «(공격력의 N%)» 가 붙으면서 괄호가 **두 개**가 됐다
       («… 도끼 1개 (공격력의 50%) (신화 +3강)»). 잠금 조건은 데미지 표기가 아닌 마지막 괄호다. */
    out.lockNeeds = rows0.slice(1).map(r => {
      const g = (r.textContent.match(/\(([^)]*)\)/g) || []).map(x => x.slice(1, -1))
        .filter(x => !/^(?:[^()]* · )?공격력의 /.test(x));
      return g.length ? g[g.length - 1] : undefined;
    });
    closeOverlay();
    return out;
  });
  chk('⚑ T153 등급이 4개다 (일반 · 희귀 · 전설 · 신화 — 영웅 없음)',
    t153.rarNames.join('·') === '일반·희귀·전설·신화' && t153.colors === 4,
    `${t153.rarNames.join('·')} · 색 ${t153.colors}개`);
  chk('⚑ T153 합성 — 희귀 3개 → «전설» 0강 (영웅이 빠진 자리)',
    !!t153.fused && t153.fused.rar === 2 && t153.fused.nm === '전설', JSON.stringify(t153.fused));
  chk('⚑ T153 세부 팝업 — 신화 +9강이면 옵션 7칸이 전부 열린다',
    t153.optRows === 7 && t153.optLocked === 0, `${t153.optRows}칸 · 잠김 ${t153.optLocked} · «${t153.secname}»`);
  chk('⚑ T153 세부 팝업에 «공격력 +10%» 옵션이 없다 (주인 «+9 부분 현재 꺼 빼고»)',
    !/공격력 \+10%/.test(t153.optText || ''), (t153.optText || '').slice(0, 80));
  chk('⚑ T153 잠금 안내가 «희귀 이상 → 전설 이상 → 신화 이상 → 신화 +3/+6/+9강» 이다',
    (t153.lockNeeds || []).join(' / ') === '희귀 이상 / 전설 이상 / 신화 이상 / 신화 +3강 / 신화 +6강 / 신화 +9강',
    (t153.lockNeeds || []).join(' / '));
  /* ⓓ 세이브 마이그레이션 — 5등급 시절 세이브(영웅 2 · 전설 3 · 신화 4)를 심고 다시 읽는다.
     영웅은 «전설로 승격»(주인 위임), 전설·신화는 인덱스만 당겨진다. 새 판이면 두 번 돌지 않는다. */
  await p.evaluate(() => {
    const raw = {
      gold: 0, gem: 0, maxChapter: 1, selChapter: 1, muted: false, uid: 10, freeDay: '',
      inv: [
        { u: 1, part: 'weapon', type: 'crit_weapon', rar: 0, plus: 0 },
        { u: 2, part: 'helm',   type: 'crit_helm',   rar: 1, plus: 0 },
        { u: 3, part: 'armor',  type: 'crit_armor',  rar: 2, plus: 0 },   /* 영웅 → 전설 승격 */
        { u: 4, part: 'glove',  type: 'crit_glove',  rar: 3, plus: 4 },   /* 전설 +4 → ⚑ T161 로 신화 0강 (두 마이그레이션이 겹치는 칸) */
        { u: 5, part: 'boot',   type: 'crit_boot',   rar: 4, plus: 2 },   /* 신화 → 신화 */
        { u: 6, part: 'neck',   type: 'crit_neck',   rar: 3, plus: 2 },   /* 전설 +2 → 전설 (강화 유지 — T153 의 원래 축) */
      ],
      eq: {}, slots: {}, gacha: { p50: 17, p10: 3, pulls: 20 }, pulls: 20, fuses: 0,
    };
    localStorage.setItem('kkoma-knight-v2', JSON.stringify(raw));
  });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(600);
  const migT153 = await p.evaluate(() => ({
    rars: save.inv.map(g => `${GT.rarName[g.rar]}+${g.plus}`),
    v: save.gearRarV,
    mythPity: save.gachaBoxes.myth ? { p50: save.gachaBoxes.myth.p50, p10: save.gachaBoxes.myth.p10, pulls: save.gachaBoxes.myth.pulls } : null,
    rare: save.gachaBoxes.rare, legend: save.gachaBoxes.legend, legacy: 'gacha' in save,
  }));
  /* ⚑⚑⚑ T161 — 이 칸은 이제 **마이그레이션 두 개가 겹치는** 자리다: T153 이 등급 인덱스를 당기고(4→3 신화 · 3→2 전설),
     그 위에서 T161 이 «전설 +3 이상은 없다» 를 적용한다. 그래서 전설 +4 는 **신화 0강**이 되고,
     전설 +2(u:6)는 그대로 남아 T153 의 원래 축(«전설은 강화까지 그대로»)이 계속 지켜진다. 순서가 뒤바뀌면 여기가 빨개진다. */
  chk('⚑ T153+T161 마이그레이션 — 영웅은 전설로 승격 · 전설 +2 는 강화까지 그대로 · 전설 +4 는 신화 0강 · 신화는 그대로',
    migT153.rars.join(' / ') === '일반+0 / 희귀+0 / 전설+0 / 신화+0 / 신화+2 / 전설+2', migT153.rars.join(' / '));
  chk('⚑ T153 마이그레이션 판 표시가 남아 두 번 돌지 않는다 (gearRarV)', migT153.v === 2, `gearRarV=${migT153.v}`);
  chk('⚑ T153 옛 단일 피티 카운터가 «신화 상자» 칸으로 옮겨진다 (진행 보존 · 옛 키 삭제)',
    !!migT153.mythPity && migT153.mythPity.p50 === 17 && migT153.mythPity.p10 === 3 && migT153.mythPity.pulls === 20 && !migT153.legacy,
    `${JSON.stringify(migT153.mythPity)} · 옛 키 남음=${migT153.legacy}`);
  chk('⚑ T153 희귀·전설 상자 카운터는 새로 0 에서 시작한다',
    !!migT153.rare && migT153.rare.p50 === 0 && migT153.rare.pulls === 0 && !!migT153.legend && migT153.legend.pulls === 0,
    `${JSON.stringify(migT153.rare)} / ${JSON.stringify(migT153.legend)}`);

  chk('pageerror 0', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  const bad = R.filter(r => !r.c);
  console.log(`\n[③] 통과 ${R.length - bad.length} · 불합격 ${bad.length}`);
  if (bad.length) console.log('불합격:', bad.map(x => x.n + (x.d ? ` (${x.d})` : '')).join(' / '));
  process.exit(bad.length ? 1 : 0);
})();
