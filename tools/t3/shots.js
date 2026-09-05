/* T116 UI 회차 하니스 — 390×844 스크린샷 + «요소 rect 를 프레임 % 로» 낸다
 *
 * 사용: PW_CORE=<경로>/node_modules/playwright-core T3_OUT=<레포 밖 경로> node tools/t3/shots.js
 * 전제: T3 하니스(boot/battle/gear/fx)와 같은 크로미움(/opt/pw-browsers). playwright-core 는 스크래치패드에 깔고
 *       PW_CORE 로 넘긴다 — **리포에 커밋 금지**(ROUTINE §1 대용량 바이너리 금지).
 * 출력: T3_OUT/shot-<키>.png (커밋 금지) + T3_OUT/layout.json (요소별 프레임 % · 비평가용 자)
 *       stdout 에는 같은 표를 사람이 읽는 형태로 찍는다.
 *
 * ⚑ 이 파일은 «화면을 만들고 재는» 도구일 뿐이다 — 게임 수치·규칙은 한 줄도 건드리지 않는다(T116 ①).
 *   상태는 재현 가능해야 하므로 시드·장비 구성·챕터를 여기서 고정한다(난수 장비 뽑기 금지).
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
const VP = { width: 390, height: 844 };

/* 화면별로 «프레임 % 로 잴 요소» — 이름은 docs/ui/ref-layout.md 의 행 이름과 1:1 이다. */
const MEASURE = {
  lobby: {
    '상단 바(참고·컨테이너)': '.lobby-top', '아바타': '#avatar', '전투력 pill': '#powerPill',
    '재화 pill 끝칸': '.lobby-top .pill:last-of-type',
    '챕터 제목': '#lobbyChapName', '챕터 밑줄': '.chap-underline',
    '챕터 카드': '#dioCard', '좌 화살표': '#chPrev', '우 화살표': '#chNext',
    'START 버튼': '#startBtn', '하단 탭바': '#lobby .bottomNav',
    '탭1': '#lobby .bottomNav .nav-tab:nth-child(1)', '탭3': '#lobby .bottomNav .nav-tab:nth-child(3)',
    '탭5': '#lobby .bottomNav .nav-tab:nth-child(5)', '사운드 버튼': '#sndBtnL',
  },
  battle: {
    '전투 캔버스': '#cvWrap', '상단 HUD 줄(참고·컨테이너)': '#topbar', '킬 pill': '#topbar .pill:nth-child(1)',
    /* ⚑ U03 정정 — `#chapHud` 는 `left:0;right:0` 짜리 가운데 정렬 컨테이너라 늘 x0 w100 이다.
     *   ref ② 의 «챕터 제목 36/11/28/2.6» 이 가리키는 것은 그 안의 글자 상자(`.nm`)다. 둘 다 낸다. */
    '챕터 표시(참고·컨테이너)': '#chapHud', '챕터 제목': '#chapHud .nm',
    '진행 바': '#progOut', '배속 버튼': '#speedBtn',
    '하단 패널': '#hud', '바 줄': '#hud .bars', 'EXP 바': '#expBar', 'HP 바': '#hpBar', '실드 바': '#shBar',
    '스탯 그리드': '#stats', '스탯칸1': '#stats .st:nth-child(1)', '스탯칸2': '#stats .st:nth-child(2)',
    '하단 발': '#hudFoot', 'Info 버튼': '#infoBtn', '특전 미리보기 줄': '#perkStrip',
    '우하단 원형 버튼': '#hudRound',
  },
  gear: {
    '상단 바(참고·컨테이너)': '#gear .top-bar', '아바타': '#gear .avatar-box',
    '재화 pill 첫칸': '#gear .top-bar .pill:nth-of-type(1)', '재화 pill 끝칸': '#gear .top-bar .pill:last-of-type',
    '장비 무대': '#gearHero', '좌 슬롯열': '#gearColL', '우 슬롯열': '#gearColR',
    '슬롯1(좌)': '#gearColL .slot-card:nth-child(1)', '슬롯3(좌)': '#gearColL .slot-card:nth-child(3)',
    '캐릭터': '#gearAvatar',
    /* ⚑ U03 정정 — `#gearStats`·`.gear-actionbar`·`#invGrid` 는 좌우 여백을 품은 **컨테이너**라 늘 x0 w100 이다
     *   (`ref-layout.md` ⚑U01 정정 표가 «안쪽 요소로 판정할 것» 이라고 적어 둔 바로 그 행들인데
     *   하니스가 컨테이너만 내고 있었다). 컨테이너는 «(참고)» 로 남기고 판정 행을 따로 낸다.
     *   ③ 표의 «액션바(Forge) 70/42.3/27/4.2» 가 가리키는 것은 줄이 아니라 **버튼**이다. */
    '스탯 요약줄(참고·컨테이너)': '#gearStats',
    '스탯 요약칸1': '#gearStats .gs:nth-child(1)', '스탯 요약칸3': '#gearStats .gs:nth-child(3)',
    '액션바(참고·컨테이너)': '.gear-actionbar', '액션바(Forge 버튼)': '#fuseBtn', '합성 버튼': '#fuseBtn',
    '인벤 그리드(참고·컨테이너)': '#invGrid', '인벤칸1': '#invGrid .inv-cell:nth-child(1)', '인벤칸5': '#invGrid .inv-cell:nth-child(5)',
    '인벤칸6': '#invGrid .inv-cell:nth-child(6)', '인벤칸2': '#invGrid .inv-cell:nth-child(2)', '하단 탭바': '#gear .bottomNav',
    /* ⚑⚑⚑ T140 (주인 2026-09-05 14:3X «장비 아이콘들 너무 작아서 잘 안 보임») — 지금까지 이 표는 **칸**만 쟀다.
     *   칸 안의 아이콘(`.gicon`)이 얼마나 차는지가 주인이 말한 바로 그것이라 아이콘 행을 따로 낸다. */
    '슬롯1 아이콘': '#gearColL .slot-card:nth-child(1) .gicon',
    '인벤칸1 아이콘': '#invGrid .inv-cell:nth-child(1) .gicon',
  },
  gearpop: {
    /* ⚑ U02 — U01 이 적어 둔 `.gd-ic`/`.gd-contrib`/`.gd-opts`/`.gd-cost` 는 실재하지 않는 클래스라
     *   4행이 통째로 «없음» 으로 나왔다. U02 가 팝업을 레퍼런스 5블록 구조로 재배치하면서
     *   행 이름이 `docs/ui/ref-layout.md` ④ 표와 1:1 이 되게 실제 클래스로 맞췄다. */
    '팝업 박스': '#overlay .ov-inner', '등급 배지': '#overlay .gd-badge',
    '아이템 아이콘': '#overlay .gd-ic', '아이템 아이콘(SVG)': '#overlay .gd-ic .gicon',   /* ⚑ T140 — 칸과 아이콘을 따로 */
    '이름줄': '#overlay .gd-name', '메타줄': '#overlay .gd-meta',
    '스탯 섹션': '#overlay .gd-stats', '옵션 목록': '#overlay .gd-opts', '비용줄': '#overlay .gd-cost',
    '스탯 첫 줄': '#overlay .gd-stat', '옵션 첫 줄': '#overlay .gd-opt',
    '버튼줄': '#overlay .gd-row',
    '버튼1': '#overlay .gd-row button:nth-child(1)', '버튼2': '#overlay .gd-row button:nth-child(2)',
    '닫기 버튼': '#gdClose',
  },
  shop: {
    /* ⚑ U02 정정 — 섹션 헤더는 `.shop-sec:first-child` 가 CSS 로 숨겨져 있어 첫 칸을 재면 «없음» 이다.
     *   보이는 헤더 2개(장비 뽑기·다이아)를 자식 순번으로 잰다. */
    '상단 바(참고·컨테이너)': '#shop .top-bar', '아바타': '#shop .avatar-box',
    '재화 pill 첫칸': '#shop .top-bar .pill:nth-of-type(1)', '재화 pill 끝칸': '#shop .top-bar .pill:last-of-type',
    '본문(참고·컨테이너)': '#shopBody',
    '섹션 헤더1': '#shopBody > div:nth-child(3)', '섹션 헤더2': '#shopBody > div:nth-child(5)',
    '무료 줄': '#shopBody .free-row', '무료 카드1': '#shopBody .free-row .gem-card:nth-child(1)',
    '무료 카드2': '#shopBody .free-row .gem-card:nth-child(2)',
    '뽑기 카드': '#shopBody .gacha-card',
    '뽑기 버튼줄': '#shopBody .gacha-btns', '다이아 그리드(참고·컨테이너)': '#shopBody .gem-grid',
    '상품 카드1': '#shopBody .gem-grid .gem-card:nth-child(1)', '상품 카드2': '#shopBody .gem-grid .gem-card:nth-child(2)',
    '상품 카드3': '#shopBody .gem-grid .gem-card:nth-child(3)',
    '상품 카드4(2행)': '#shopBody .gem-grid .gem-card:nth-child(4)', '하단 탭바': '#shop .bottomNav',
  },
  forge: {
    /* ⚑ U03 정정 — `ref-layout.md` ⑥ 표에 **대장간 상단 바 행이 없다**(무대가 y0 부터 화면을 꽉 채운다).
     *   게임도 상단 바가 없으므로 이 행은 늘 «없음» = 근거 없는 X 였다. 지웠다. */
    '대장간 무대': '#forgeStage', '결과 슬롯': '#fgResult', '화살표': '.fg-up',
    /* ⚑ U02 — 레퍼런스는 재료가 «1칸(w17)» 인데 게임은 규칙상 «3칸 합성»(PLAN)이라 줄 폭이 구조적으로 안 맞는다.
     *   줄과 칸을 둘 다 내서 U03 비평가가 무엇이 구조 차이인지 볼 수 있게 한다. */
    '재료 줄': '#fgMats', '재료 칸1': '#fgMats .fg-cell:nth-child(1)',
    '안내 배너': '#fgBanner', '액션바': '.forge-actionbar',
    '자동 버튼': '#fgAuto', '합성 버튼': '#fgFuse', '인벤 그리드(참고·컨테이너)': '#fgGrid',
    '인벤칸1': '#fgGrid .inv-cell:nth-child(1)',
    '뒤로 줄(참고·컨테이너)': '.forge-back', '뒤로 버튼': '#fgBack',
    /* ⚑ T140 — 재료·결과 칸은 «비어 있으면» 아이콘이 없다(이 shot 은 빈 상태다) → 아래 `forgemat` 이 채운 상태를 잰다. */
    '인벤칸1 아이콘': '#fgGrid .inv-cell:nth-child(1) .gicon',
  },
  /* ⚑⚑⚑ T140 — 재료 3칸이 «채워진» 대장간. 주인 ③ 의 «합성» 한 장이 이것이다. */
  forgemat: {
    '결과 슬롯': '#fgResult', '결과 슬롯 아이콘': '#fgResult .gicon',
    '재료 줄': '#fgMats', '재료 칸1': '#fgMats .fg-cell:nth-child(1)',
    '재료 칸1 아이콘': '#fgMats .fg-cell:nth-child(1) .gicon',
    '재료 칸3': '#fgMats .fg-cell:nth-child(3)', '재료 칸1 부위태그': '#fgMats .fg-cell:nth-child(1) .ptag',
  },
  /* ⚑⚑⚑ T140 — 뽑기 결과(10연차). 주인 ① 의 «뽑기 결과 화면(11칸도)» 자리다. */
  pullres: {
    '결과 그리드': '#overlay .pull-list',
    '결과칸1': '#overlay .pull-list .inv-cell:nth-child(1)',
    '결과칸1 아이콘': '#overlay .pull-list .inv-cell:nth-child(1) .gicon',
    '결과칸5': '#overlay .pull-list .inv-cell:nth-child(5)',
    '결과칸1 부위태그': '#overlay .pull-list .inv-cell:nth-child(1) .ptag',
  },
  perk: {
    /* ⚑ U03 정정 — 레퍼런스 «선택창»(perks.jpg)에는 **팝업 상자가 없다**(`ref-layout.md` ⚑U01 정정 · ⑦ 표에도
     *   «(인포 팝업) 박스» 행만 있다). `ov-full` 의 `.ov-inner` 는 상자가 아니라 «배경 없는 세로 흐름 상자» 라
     *   ref 에 대응 행이 없다 — 참고로만 남긴다(판정 행 아님). */
    '팝업 박스(참고·대응 ref 없음)': '#overlay .ov-inner', '배너': '#overlay .ov-banner', '부제': '#overlay .ov-sub',
    /* ⚑ T117 — 3택이 돌아와 카드가 3장이다(ref ⑦ 표의 «특전 카드 1·2·3» 이 그대로 자가 된다).
     *   «확인 버튼(#luOk)» 은 사라졌다 — 카드를 누르는 것이 곧 확정이라 확인 버튼이 할 일이 없다.
     *   레퍼런스의 가운데 하단 버튼 자리는 게임에 대응물이 없는 «무료 새로고침» 이라 비워 둔다. */
    '특전 카드': '#overlay .perk-card', '특전 카드2': '#overlay .perk-card:nth-of-type(2)',
    '특전 카드3': '#overlay .perk-card:nth-of-type(3)',
    '카드 아이콘': '#overlay .perk-card .ic', '카드 문구': '#overlay .perk-card .tx',
    '보유 특전 버튼': '#perkBookBtn',
  },
  perkbook: {
    '팝업 박스': '#overlay .ov-inner', '배너': '#overlay .ov-banner', '부제': '#overlay .ov-sub',
    '목록(참고·컨테이너)': '#overlay .perk-list', '목록 카드1': '#overlay .perk-list .perk-card:nth-child(1)',
    /* 이 하니스는 «선택창에서 연 책» 상태를 찍으므로 하단 줄이 `.tap-close` 가 아니라 `#pbBack` 이다
     *   (레퍼런스의 «닫기 안내 y91.5» 자리 — 둘 다 상자 밖 아래 줄이다).
     *   ⚑ U03 정정 — 이 상태에서 `.tap-close` 는 **존재하지 않는다**(HUD 📘 로 연 책에만 있다).
     *   늘 «없음» 이라 근거 없는 X 였다 — 판정 행은 `#pbBack` 하나다. */
    '닫기 안내(= 뒤로 버튼)': '#pbBack',
  },
};

const pct = (v, base) => Math.round(v / base * 1000) / 10;

async function measure(p, map) {
  return await p.evaluate(m => {
    const f = document.getElementById('frame').getBoundingClientRect();
    const out = {};
    /* ⚑ U03 — 선택자 앞의 `⊕` 는 «맞는 요소 전부의 합집합 상자» 를 뜻한다.
     *   레퍼런스 표의 «…줄(N칸)» 행은 컨테이너(좌우 여백 포함)가 아니라 **칸들이 실제로 차지한 폭**이라
     *   그것을 그대로 재려면 합집합이 필요하다(예: 장비 «스탯 요약줄 x10 w79» = 3칸의 합집합). */
    for (const [name, sel] of Object.entries(m)) {
      let r;
      if (sel[0] === '⊕') {
        const els = [...document.querySelectorAll(sel.slice(1))].map(e => e.getBoundingClientRect())
          .filter(b => b.width || b.height);
        if (!els.length) { out[name] = null; continue; }
        const l = Math.min(...els.map(b => b.left)), t = Math.min(...els.map(b => b.top));
        const rg = Math.max(...els.map(b => b.right)), bt = Math.max(...els.map(b => b.bottom));
        r = { left: l, top: t, width: rg - l, height: bt - t };
      } else {
        const el = document.querySelector(sel);
        if (!el) { out[name] = null; continue; }
        r = el.getBoundingClientRect();
      }
      if (r.width === 0 && r.height === 0) { out[name] = null; continue; }
      out[name] = {
        x: (r.left - f.left) / f.width * 100, y: (r.top - f.top) / f.height * 100,
        w: r.width / f.width * 100, h: r.height / f.height * 100,
      };
    }
    return out;
  }, map);
}

/* 재현 가능한 장비 구성 — 뽑기 난수를 쓰지 않고 직접 만든다 (T116 ③-1 «재현 가능하게 스크립트에 고정») */
const SEED_GEAR = () => {
  save.inv = []; save.eq = {}; save.uid = 1;
  const plan = [
    /* ⚑ T124 — 종류 키가 «세트_부위» 로 바뀌었다(치명·체력실드·회피 × 6부위). 구성은 종전과 같은 모양이다. */
    ['weapon', 'crit_weapon', 4, 2], ['helm', 'hpsh_helm', 3, 1], ['armor', 'crit_armor', 3, 0],
    ['glove', 'crit_glove', 2, 1], ['boot', 'crit_boot', 2, 0], ['neck', 'crit_neck', 1, 0],
    ['weapon', 'hpsh_weapon', 2, 0], ['weapon', 'evade_weapon', 1, 0], ['helm', 'crit_helm', 1, 0],
    ['armor', 'hpsh_armor', 1, 0], ['glove', 'hpsh_glove', 0, 0], ['boot', 'evade_boot', 0, 0],
    ['neck', 'hpsh_neck', 0, 0], ['weapon', 'crit_weapon', 0, 0], ['helm', 'evade_helm', 0, 0],
    ['armor', 'evade_armor', 0, 0], ['glove', 'evade_glove', 0, 0], ['boot', 'hpsh_boot', 0, 0],
  ];
  for (const [pt, ty, rar, plus] of plan) save.inv.push(newGear(pt, ty, rar, plus));
  for (const pt of GT.parts) { const g = save.inv.find(x => x.part === pt); if (g) save.eq[pt] = g.u; }
  save.gold = 11540; save.gem = 543; save.chapter = 22; save.maxChapter = 22;
  persist();
};

(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: VP, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(URL);
  await p.waitForTimeout(700);
  await p.evaluate(SEED_GEAR);
  await p.evaluate(() => { showScreen('lobby'); });
  await p.waitForTimeout(300);

  const layout = {};
  const shot = async (key, note) => {
    await p.screenshot({ path: path.join(OUT, `shot-${key}.png`) });
    layout[key] = await measure(p, MEASURE[key] || {});
    console.log(`\n=== ${key}${note ? ' — ' + note : ''} ===`);
    for (const [n, r] of Object.entries(layout[key])) {
      console.log(r ? `  ${n.padEnd(16)} x ${r.x.toFixed(1)}% y ${r.y.toFixed(1)}% w ${r.w.toFixed(1)}% h ${r.h.toFixed(1)}%`
        : `  ${n.padEnd(16)} (없음)`);
    }
  };

  await shot('lobby', '로비');

  /* 장비 탭 (6부위 장착) */
  await p.evaluate(() => showScreen('gear'));
  await p.waitForTimeout(250);
  await shot('gear', '장비 탭');

  /* 장비 세부 팝업 — 장착 중인 무기
     ⚑ T122 — 팝업은 `.ov-inner{animation:popIn .34s}` 라 250ms 면 여기도 애니메이션 도중이다
     (실측 회차 간 차이는 0.00004%p 로 인쇄 정밀도 0.1%p 밖이지만, 자는 자다). */
  await p.evaluate(() => { openGearDetail(save.inv[0].u); });
  await p.waitForTimeout(700);
  await shot('gearpop', '장비 세부 팝업');
  await p.evaluate(() => closeOverlay());

  /* 상점 */
  await p.evaluate(() => showScreen('shop'));
  await p.waitForTimeout(250);
  await shot('shop', '상점');

  /* 대장간 */
  await p.evaluate(() => openForge());
  await p.waitForTimeout(250);
  await shot('forge', '대장간/합성');

  /* 전투 — 챕터 22, 전진 중 */
  await p.evaluate(() => { startChapter(22); });
  await p.waitForTimeout(1200);
  await shot('battle', '전투 (전진)');

  /* 전투 — 적 발견 (첫 웨이브에 닿을 때까지 돌린다) */
  await p.evaluate(() => new Promise(res => {
    const t0 = Date.now();
    const tick = () => {
      const seen = G && G.nodes.some(n => n.type === 'wave' && n.enemies.some(e => e.aggro && !e.dead));
      if (seen || Date.now() - t0 > 20000) res(seen); else setTimeout(tick, 100);
    };
    tick();
  }));
  await p.waitForTimeout(120);
  layout.battleFoe = await measure(p, MEASURE.battle);
  await p.screenshot({ path: path.join(OUT, 'shot-battleFoe.png') });
  console.log('\n=== battleFoe — 전투 (적 발견) === (요소는 battle 과 같은 자를 쓴다)');

  /* 특전 획득 팝업 — 3개 획득 상태에서 4번째를 받는 순간
   * ⚑ T122 — 종전 이 자리는 `grantNextPerk()` 를 불렀는데 그 동사는 **`sim.js` 전용**이다
   *   (`verifyT2` ⑯·`verifyDevilPolicy` 가 «index.html 에 있으면 빨강» 으로 못 박은 이름).
   *   T117 이 3택을 되살리면서 게임 쪽 지급 동사가 `offerPerks`(굴림) / `pickPerk`(적용) 둘로 갈렸고,
   *   하니스만 옛 이름에 남아 `ReferenceError: grantNextPerk is not defined` 로 부팅부터 죽어 있었다.
   *   지금은 **두 엔진 공용 동사 `pickPerk`** 로 표 앞에서부터 안 가진 것 3장을 채운다 —
   *   굴림을 안 거치므로 «어느 3장을 들고 있나» 가 회차마다 같다(이 파일 머리의 «상태는 재현 가능하게» 규약).
   *   `pickPerk` 가 `renderPerkStrip` 을 스스로 부르므로 여기서 다시 부르지 않는다. */
  await p.evaluate(() => {
    G.paused = true;
    for (const pk of PERKS) {
      if (G.perksTaken.length >= 3) break;
      if (G.perksTaken.indexOf(pk) < 0) pickPerk(pk);
    }
    renderStatsGrid();
    /* 선택창에 뜨는 3장은 `offerPerks` 의 등급 굴림 결과다 — 카드 문구 길이가 줄수(= 카드 높이)를 바꿔
       레이아웃 실측까지 흔들리므로, **굴림 동안만** 고정 시드 난수로 바꿔 회차 간 자를 같게 만든다.
       게임 코드는 한 줄도 안 건드린다(T116 ①) — 원래 `Math.random` 은 곧바로 되돌린다. */
    const rnd0 = Math.random;
    let s = 20260904;
    Math.random = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    try { openLevelUp(); } finally { Math.random = rnd0; }
  });
  /* ⚑ T122 — 이 두 팝업만 250ms 로는 **등장 애니메이션 도중**을 잰다
     (배너 `bannerDrop .45s` · 카드 `slideUp .35s` + 카드별 지연 최대 .18s → 최대 .53s).
     실제로 2회 실행에서 카드 y 가 0.04%p 씩 달라져 «자» 가 회차마다 흔들렸다 — 끝난 뒤에 잰다. */
  await p.waitForTimeout(700);
  await shot('perk', '특전 획득 팝업');

  /* 특전 인포(보유 특전) 팝업 */
  await p.evaluate(() => { document.getElementById('perkBookBtn').click(); });
  await p.waitForTimeout(700);
  await shot('perkbook', '특전 인포 팝업');

  /* ⚑⚑⚑ T140 (주인 2026-09-05 14:3X) — 아이콘이 «실제로 그려진» 두 자리를 마지막에 더 찍는다.
     앞의 shot 들을 흔들지 않으려고 **맨 뒤**에 둔다(상태를 다시 씨앗으로 되돌린 뒤 찍는다).
     ① 재료 3칸이 채워진 대장간 ② 10연차 뽑기 결과 화면. */
  await p.evaluate(SEED_GEAR);
  await p.evaluate(() => {
    /* 합성 재료 칸을 채우려면 «같은 부위·종류·등급 3개» 가 필요한데 씨앗 구성엔 그런 묶음이 없다 —
       재현 가능한 3개를 더 심는다(뽑기 난수를 쓰지 않는다 · T116 ③-1 규약). */
    for (let i = 0; i < 3; i++) save.inv.push(newGear('weapon', 'crit_weapon', 1, 0));
    persist();
    showScreen('gear'); openForge(); renderForge();
  });
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    /* 같은 부위·종류·등급 3개를 골라 재료 칸을 채운다 (클릭 = 게임과 같은 경로) */
    const us = save.inv.filter(g => g.part === 'weapon' && g.type === 'crit_weapon' && g.rar === 1).slice(0, 3);
    for (const g of us) { const b = document.querySelector(`#fgGrid .inv-cell[data-u="${g.u}"]`); if (b) b.click(); }
  });
  await p.waitForTimeout(250);
  await shot('forgemat', '대장간 — 재료 3칸 채움');

  await p.evaluate(() => { showScreen('shop'); save.gem = 999999; doPull(10); });
  await p.waitForTimeout(700);
  await shot('pullres', '뽑기 결과 (10연차)');
  await p.evaluate(() => closeOverlay());

  fs.writeFileSync(path.join(OUT, 'layout.json'), JSON.stringify(layout, null, 1));
  console.log(`\npageerror ${errs.length}건${errs.length ? ': ' + errs.join(' | ') : ''}`);
  console.log(`PNG 11장 + layout.json → ${OUT}`);
  await b.close();
  process.exit(errs.length ? 1 : 0);
})();
