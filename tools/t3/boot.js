/* T3 동작 검증 — 부팅·콘솔·로비 렌더·⚑모바일 폭 (390×844 · 360×800 · 375×667)
 *
 * 사용: node tools/t3/boot.js          (exit 0 = 통과, 1 = 불합격)
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
  for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 800 }, { width: 375, height: 667 }]) {
    console.log(`\n=== ${vp.width}×${vp.height} ===`);
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    const errs = [], warns = [];
    p.on('pageerror', e => errs.push(String(e)));
    p.on('console', m => { if (m.type() === 'error') warns.push(m.text()); });
    await p.goto(URL);
    await p.waitForTimeout(700);

    /* --- 부팅 --- */
    const boot = await p.evaluate(() => ({
      perks: typeof PERKS !== 'undefined' ? PERKS.length : -1,
      maxChapter: TUNE.maxChapter,
      screen: document.querySelector('.screen.on')?.id,
      startTxt: document.getElementById('startBtn')?.textContent.trim(),
      chapTxt: document.getElementById('lobbyChapName')?.textContent.trim(),
      saveKey: (() => { try { save.gold = save.gold; persist(); } catch (e) {} return Object.keys(localStorage).join(','); })(),
    }));
    chk('특전 132종 로드', boot.perks === 132, `PERKS=${boot.perks}`);   /* T48 로 102 → 117 (늘리면 여기도 갱신) */
    chk('챕터 상한 300', boot.maxChapter === 300, `maxChapter=${boot.maxChapter}`);
    chk('로비 화면이 켜져 있다', boot.screen === 'lobby', boot.screen);
    chk('START 버튼 렌더', boot.startTxt === 'START', boot.startTxt);
    chk('로비 챕터 제목 렌더', /^CHAPTER \d+$/.test(boot.chapTxt), boot.chapTxt);
    chk('저장 포맷 v2', /kkoma-knight-v2/.test(boot.saveKey), boot.saveKey);

    /* --- ⚑ 모바일 폭 (주인 지시 14:4X / T40) --- */
    const mob = await p.evaluate(() => {
      const f = document.getElementById('frame').getBoundingClientRect();
      const t = document.getElementById('lobbyChapName');
      const nav = [...document.querySelectorAll('.bottomNav')].find(n => n.offsetParent !== null);
      const nr = nav.getBoundingClientRect();
      const meta = document.querySelector('meta[name=viewport]')?.getAttribute('content') || '';
      return {
        fw: Math.round(f.width), fh: Math.round(f.height),
        vw: window.innerWidth, vh: window.innerHeight,
        titleFs: getComputedStyle(t).fontSize,
        navBottom: Math.round(nr.bottom), navTop: Math.round(nr.top),
        hScroll: document.documentElement.scrollWidth > window.innerWidth,
        meta,
      };
    });
    /* #frame 은 9:19 비율 고정(CSS width:min(100vw, 100dvh*9/19)) — 세로가 짧은 16:9(375×667)에서는
       폭이 아니라 높이가 한계라 좌우 여백이 남는 것이 정상이다(T40 이 실측·근거를 남겼다). */
    const want = Math.min(mob.vw, Math.round(mob.vh * 9 / 19));
    chk('프레임 폭이 9:19 규칙대로다 (긴 화면=꽉 참 · 16:9=높이 한계)', Math.abs(mob.fw - want) <= 1,
      `frame ${mob.fw}px / 기대 ${want}px (viewport ${mob.vw}×${mob.vh})`);
    chk('로비 제목 글씨가 축소되지 않는다 (CSS 36px 그대로)', mob.titleFs === '36px', mob.titleFs);
    chk('하단 5탭이 뷰포트 안에 들어온다 (잘림 없음)', mob.navBottom <= mob.vh + 1, `nav.bottom ${mob.navBottom} ≤ vh ${mob.vh}`);
    chk('가로 스크롤 없음', !mob.hScroll);
    chk('viewport 메타 3항목', /width=device-width/.test(mob.meta) && /initial-scale=1/.test(mob.meta) && /viewport-fit=cover/.test(mob.meta), mob.meta);

    /* 주소창이 뜬 «작은 뷰포트» 재현 — 높이를 90% 로 줄여도 탭이 안 잘리나 */
    await p.setViewportSize({ width: vp.width, height: Math.round(vp.height * 0.88) });
    await p.waitForTimeout(300);
    const small = await p.evaluate(() => {
      const nav = [...document.querySelectorAll('.bottomNav')].find(n => n.offsetParent !== null);
      return { navBottom: Math.round(nav.getBoundingClientRect().bottom), vh: window.innerHeight, fh: Math.round(document.getElementById('frame').getBoundingClientRect().height) };
    });
    chk('주소창 표시 상태(높이 −12%)에서도 탭이 안 잘린다', small.navBottom <= small.vh + 1, `nav.bottom ${small.navBottom} ≤ vh ${small.vh} (frame ${small.fh})`);
    await p.setViewportSize(vp);
    await p.waitForTimeout(200);

    chk('pageerror 0', errs.length === 0, errs.slice(0, 2).join(' | '));
    const realWarn = warns.filter(w => !/fonts\.googleapis|ERR_(NAME|INTERNET|BLOCKED|CONNECTION)|net::/.test(w));
    chk('콘솔 에러 0 (웹폰트 네트워크 실패 제외)', realWarn.length === 0, realWarn.slice(0, 2).join(' | ') || `(폰트 경고 ${warns.length}건은 샌드박스 무망 탓)`);
    await ctx.close();
  }
  await b.close();
  const bad = R.filter(r => !r.c);
  console.log(`\n[①] 통과 ${R.length - bad.length} · 불합격 ${bad.length}`);
  process.exit(bad.length ? 1 : 0);
})();
