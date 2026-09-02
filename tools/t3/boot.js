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
    chk('특전 128종 로드', boot.perks === 128, `PERKS=${boot.perks}`);   /* T48 로 102 → 132, T77(전투 무관 4종 삭제)로 → 128 (개수를 바꾸면 여기도 갱신) */
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

    /* --- ⚑ 대형 수치 표기 (T54) — 실제 렌더로 «후반 챕터 골드가 줄을 밀어내지 않는가» ---
       정적 게이트 verifyT2 ㉖ 은 포맷터와 CSS 값을 보고, 실제로 줄이 프레임 안에 드는지는 여기서 본다.
       구 구현(콤마 전체 표기)은 챕터 300 골드가 41자라 줄이 886px 로 부풀어 🔊 가 화면 밖으로 나갔다. */
    for (const c of [40, 90, 300]) {
      const t54 = await p.evaluate(c => {
        const keep = save.gold, keepGem = save.gem;
        let cum = 0; for (let i = 1; i <= c; i++) cum += TUNE.goldClear(i) * 6;
        save.gold = cum; save.gem = 2500 * 3650; renderLobby();
        const top = document.querySelector('.lobby-top');
        const clip = ['lbPower', 'lbGold', 'lbGem'].map(id => { const e = document.getElementById(id); return e.scrollWidth > e.clientWidth + 1; });
        const snd = document.getElementById('sndBtnL').getBoundingClientRect();
        const r = { gold: document.getElementById('lbGold').textContent, scroll: top.scrollWidth, client: top.clientWidth,
                    clipped: clip.filter(Boolean).length, sndRight: Math.round(snd.right), vw: window.innerWidth };
        save.gold = keep; save.gem = keepGem; renderLobby();
        return r;
      }, c);
      chk(`챕터 ${c} 골드 «${t54.gold}» — 상단 줄이 프레임 안에 든다`,
        t54.scroll <= t54.client && t54.clipped === 0 && t54.sndRight <= t54.vw,
        `줄 ${t54.scroll}/${t54.client} · 글자잘림 ${t54.clipped} · 🔊 right=${t54.sndRight} ≤ ${t54.vw}`);
    }

    chk('pageerror 0', errs.length === 0, errs.slice(0, 2).join(' | '));
    const realWarn = warns.filter(w => !/fonts\.googleapis|ERR_(NAME|INTERNET|BLOCKED|CONNECTION)|net::/.test(w));
    chk('콘솔 에러 0 (웹폰트 네트워크 실패 제외)', realWarn.length === 0, realWarn.slice(0, 2).join(' | ') || `(폰트 경고 ${warns.length}건은 샌드박스 무망 탓)`);
    await ctx.close();
  }

  /* ============================================================================
     ⚑ T64 — 좁은 프레임에서 상단 줄 3개가 잘리지 않는가 (실제 렌더)
     프레임 폭은 min(100vw, 100dvh*9/19) 라 «세로가 폭을 정한다» — 주소창이 뜨면 폭이 준다.
     위 3뷰포트는 전부 프레임 ≥316px 라 T54 때 이 축을 못 봤다. 여기서 그 아래를 직접 잰다:
       375×587 = SE(375×667) + 주소창 → 278px · 360×563 → 267px · 320×568(iPhone5) → 269px
     수정 전 실측: 로비 전투력 «338»→«…»/빈칸 · 골드 «59.68Oc»→«59.…» ·
                   인게임 ☰ 가 프레임 밖 +25.9px(눌리지 않는다) · 장비/상점 줄이 좌우 ±14.9px.
     ============================================================================ */
  console.log('\n=== ⚑ T64 좁은 프레임 상단 줄 (프레임 278 · 267 · 269px) ===');
  {
    const STATES = [
      ['초반', `save.gold=0;save.gem=0;save.inv=[];save.eq={};`],
      ['중반', `save.gold=8.26e6;save.gem=2500;`],
      ['후반', `save.gold=Math.round(TUNE.goldClear(300));save.gem=250000;`],
      ['최대', `save.gold=1e9;save.gem=1234567;save.inv=[];save.eq={};save.uid=1;
         for(const pt of GT.parts){const g=newGear(pt,GT.types[pt][0],4,9);save.inv.push(g);save.eq[pt]=g.u;}
         for(const pt of GT.parts) save.slots[pt]=GT.slotLvMax;`],
    ];
    for (const vp of [{ width: 375, height: 587 }, { width: 360, height: 563 }, { width: 320, height: 568 }]) {
      const ctx = await b.newContext({ viewport: vp });
      const p = await ctx.newPage();
      const errs = []; p.on('pageerror', e => errs.push(String(e)));
      await p.goto(URL); await p.waitForTimeout(500);
      const fw = await p.evaluate(() => +document.getElementById('frame').getBoundingClientRect().width.toFixed(1));

      /* ① 로비 — 네 상태 전부에서 세 수치가 온전히 보인다(말줄임 0) */
      for (const [nm, js] of STATES) {
        const r = await p.evaluate(js => {
          eval(js); renderLobby();
          const fr = document.getElementById('frame').getBoundingClientRect();
          const row = document.querySelector('.lobby-top').getBoundingClientRect();
          const ids = ['lbPower', 'lbGold', 'lbGem'];
          return {
            cut: ids.filter(i => { const e = document.getElementById(i); return e.scrollWidth > e.clientWidth + 1; }),
            txt: ids.map(i => document.getElementById(i).textContent).join(' '),
            out: row.left < fr.left - 0.6 || row.right > fr.right + 0.6,
            tf: document.querySelector('.lobby-top').style.getPropertyValue('--tf') || '1',
          };
        }, js);
        chk(`[${vp.width}×${vp.height} 프레임 ${fw}] 로비 ${nm} — 수치가 안 잘린다`,
          r.cut.length === 0 && !r.out, `«${r.txt}» tf=${r.tf}${r.cut.length ? ' 잘림:' + r.cut : ''}`);
      }

      /* ② 장비 화면 줄 — 좌우로 삐져나가지 않는다 */
      const gear = await p.evaluate(() => {
        showScreen('gear');
        const fr = document.getElementById('frame').getBoundingClientRect();
        const row = document.querySelector('#gear .top-bar');
        const r = row.getBoundingClientRect();
        const sp = [...row.querySelectorAll('span')];
        return { left: +(r.left - fr.left).toFixed(1), right: +(r.right - fr.right).toFixed(1),
                 cut: sp.filter(e => e.scrollWidth > e.clientWidth + 1).length, tf: row.style.getPropertyValue('--tf') || '1' };
      });
      chk(`[프레임 ${fw}] 장비 상단 줄이 프레임 안에 든다`,
        gear.left >= -0.6 && gear.right <= 0.6 && gear.cut === 0,
        `left ${gear.left} · right ${gear.right} · 글자잘림 ${gear.cut} · tf=${gear.tf}`);

      /* ③ 인게임 줄 — ☰ 가 프레임 안에 있어야 «일시정지·포기» 를 누를 수 있다 */
      await p.evaluate(() => { save.maxChapter = 300; save.selChapter = 300; startChapter(300); });
      await p.waitForTimeout(400);
      for (const gold of [1e4, 5.97e28, 1.2e35]) {
        const r = await p.evaluate(g => {
          G.gold = g; G.kills = 99999; syncGameTop();
          const fr = document.getElementById('frame').getBoundingClientRect();
          const mb = document.getElementById('menuBtn').getBoundingClientRect();
          return { over: +(mb.right - fr.right).toFixed(1), gold: document.getElementById('gGold').textContent,
                   cut: ['gGold', 'gKills'].filter(i => { const e = document.getElementById(i); return e.scrollWidth > e.clientWidth + 1; }),
                   tf: document.getElementById('topbar').style.getPropertyValue('--tf') || '1' };
        }, gold);
        chk(`[프레임 ${fw}] 인게임 골드 «${r.gold}» — ☰ 가 프레임 안 + 수치 온전`,
          r.over <= 0.6 && r.cut.length === 0, `☰ 프레임 대비 ${r.over}px · tf=${r.tf}${r.cut.length ? ' 잘림:' + r.cut : ''}`);
      }
      chk(`[프레임 ${fw}] pageerror 0`, errs.length === 0, errs.slice(0, 2).join(' | '));
      await ctx.close();
    }
  }

  await b.close();
  const bad = R.filter(r => !r.c);
  console.log(`\n[①] 통과 ${R.length - bad.length} · 불합격 ${bad.length}`);
  process.exit(bad.length ? 1 : 0);
})();
