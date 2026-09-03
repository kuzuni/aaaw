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
    const n = await p.evaluate(() => document.querySelectorAll('#luOk').length);
    if (!n) break;
    await p.click('#luOk'); await p.waitForTimeout(350);
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
      cards: document.querySelectorAll('#luOk').length,
      choice: document.querySelectorAll('#overlay .choice-btn').length,
      exit: !!document.getElementById('clOk') || !!document.getElementById('deOk'),
      on: document.getElementById('overlay').classList.contains('on'),
    }));
    if (st.exit) return n;
    if (st.cards) { await p.click('#luOk'); n++; }
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
      taken: G.perksTaken.map(x => x.id), first: PERKS[0].id, ok: !!document.getElementById('luOk'),
      noChoice: document.querySelectorAll('#overlay .perk-card[data-i]:not(.static)').length,
    };
  });
  /* ⚑⚑ T96 — 3택 선택창은 폐지됐다. 레벨업하면 «다음 순번 하나» 를 그 자리에서 받는다. */
  chk('레벨업 = 특전 카드 1장 (선택창 폐지)', pick.n === 1 && pick.noChoice === 0, `카드 ${pick.n}장 · 고를 수 있는 카드 ${pick.noChoice}장`);
  chk('⚑ 첫 특전이 1번(공격력 증가)이다 — 순서 획득', pick.taken.length === 1 && pick.taken[0] === pick.first, `${pick.taken.join(',')} (1번 = ${pick.first})`);
  chk('카드 태그가 획득 순번 «1/10»', pick.tags[0] === '1/10', pick.tags.join(','));
  chk('확인 버튼(계속 전진)이 있다 — 고를 것이 없다', pick.ok);
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

  await p.click('#luOk'); await p.waitForTimeout(300);
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
    for (let i = 0; !key && i < PERKS.length; i++) { takePerk(PERKS[i]); key = Object.keys(G.pxPerk)[0] || null; }
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
      /* 기대 테두리색 = 그 특전의 등급색. 일반 등급색(#9EA3AC)은 «출처 없음» 폴백색과 같은 값이라
         «회색이 아니다» 로는 판정할 수 없다 — 등급에서 기대색을 만들어 비교한다. */
      wantCC: perk ? PERK_COLOR : null, wantRar: perk ? '특전' : '-',
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
        cards: document.querySelectorAll('#luOk').length,
        choice: document.querySelectorAll('#overlay .choice-btn').length, paused: !!(G && G.paused) };
    }, buffOn.key);
    if (st.n === 0) { gone = true; tLast = 0; break; }
    tLast = st.left; polls++;
    if (st.cards) { await p.click('#luOk'); await p.waitForTimeout(250); continue; }
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
    takePerk(same); takePerk(same);            /* 같은 특전 3번 → 개수 뱃지 3 */
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
    for (const q of PERKS.filter(x => !had.has(x.id || x.tx))) takePerk(q);
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

  /* ---------- ⚑ T89 «보유 특전» 버튼 (주인 지시 2026-09-03 · ⚑ T96 에서 레벨업 팝업으로 옮겨졌다) ----------
     선택창이 폐지돼 «고르기 전에 확인» 이라는 원래 쓰임은 사라졌지만, «지금 내가 뭘 갖고 있나» 는
     그대로 필요하므로 버튼은 레벨업 팝업에 남는다. 여기서 보는 것은 ①버튼이 오른쪽 하단에 있고
     ②카드와 안 겹치고 ③목록이 열린 동안에도 시간이 멈춰 있고 ④닫으면 **같은 팝업**으로 돌아오는지다. */
  console.log('\n=== ⚑ 레벨업 팝업 «보유 특전» 버튼 (T89 · T96 이관) ===');
  await drainAll(p);
  const bk0 = await p.evaluate(() => {
    /* 10개를 다 얻었으면 팝업이 안 뜬다 — 진짜 특전을 9개로 줄여 한 칸 비워 두고 연다
       (앞 절이 같은 특전을 여러 번 밀어 넣어 뒀으므로 «중복까지 포함해» 9개가 되도록 다시 만든다) */
    G.perksTaken = [PERKS.slice(0, PERKS.length - 1), G.perksTaken.filter(x => !PERKS.includes(x))].flat();
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
      back: !!document.getElementById('pbBack'), choiceGone: !document.getElementById('luOk'),
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
    ok: !!document.getElementById('luOk'), paused: G.paused,
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
        cards: document.querySelectorAll('#luOk').length,
        alive: !!(bn && bn.enemies.some(e => !e.dead && e.hp > 0)),
        cleared: !!(G && G.cleared), ov: document.getElementById('overlay').textContent.slice(0, 40),
      };
    });
    if (st.alive) {
      if (st.cards) { lateDrain++; await p.click('#luOk'); await p.waitForTimeout(250); continue; }
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

  chk('pageerror 0', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close();
  const bad = R.filter(r => !r.c);
  console.log(`\n[②] 통과 ${R.length - bad.length} · 불합격 ${bad.length}`);
  if (bad.length) console.log('불합격:', bad.map(x => x.n + (x.d ? ` (${x.d})` : '')).join(' / '));
  process.exit(bad.length ? 1 : 0);
})();
