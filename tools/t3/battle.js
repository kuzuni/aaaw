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
    const n = await p.evaluate(() => document.querySelectorAll('.perk-card.pick').length);
    if (!n) break;
    await p.click('#perkPick0'); await p.waitForTimeout(350);
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
      cards: document.querySelectorAll('.perk-card.pick').length,
      choice: document.querySelectorAll('#overlay .choice-btn').length,
      exit: !!document.getElementById('clOk') || !!document.getElementById('deOk'),
      on: document.getElementById('overlay').classList.contains('on'),
    }));
    if (st.exit) return n;
    if (st.cards) { await p.click('#perkPick0'); n++; }
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
      pcs: cards.map(c => getComputedStyle(c).borderTopColor),
      taken: G.perksTaken.map(x => x.id), first: PERKS[0].id, ok: !!document.getElementById('perkPick0'),
      pickable: document.querySelectorAll('#overlay .perk-card.pick[data-i]').length,
    };
  });
  /* ⚑⚑⚑ T117 (주인 확정 2026-09-04 12:3X) — 3택 선택창이 돌아왔다. 레벨업하면 «남은 풀에서 무작위 3장» 이
     뜨고 **고르기 전에는 아무것도 안 받는다**(순서 지급 시절엔 팝업이 뜨는 순간 이미 받은 상태였다). */
  chk('⚑ T117 레벨업 = 고를 수 있는 특전 카드 3장', pick.n === 3 && pick.pickable === 3,
    `카드 ${pick.n}장 · 고를 수 있는 카드 ${pick.pickable}장`);
  chk('⚑ T117 고르기 «전» 에는 아직 아무것도 안 받았다', pick.taken.length === 0, `보유 ${pick.taken.join(',') || '0종'}`);
  chk('⚑ T117 세 장이 서로 다르다 (같은 카드 안 중복 금지)', new Set(pick.tx).size === 3, pick.tags.join(','));
  /* ⚑⚑⚑ T119 — 카드 태그가 «획득 순번» 에서 **등급 이름**으로 돌아왔고 테두리가 등급색이다 */
  chk('⚑ T119 카드 태그가 등급 이름(일반/희귀/전설)이다',
    pick.tags.every(t => ['일반', '희귀', '전설'].includes(t)), pick.tags.join(','));
  chk('⚑ T119 카드 테두리색이 등급색 3종 중 하나다 (일반 회색 · 희귀 파랑 · 전설 금색)',
    pick.pcs.every(c => ['rgb(158, 163, 172)', 'rgb(79, 163, 247)', 'rgb(255, 185, 46)'].includes(c)),
    pick.pcs.join(' / '));
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

  await p.click('#perkPick0'); await p.waitForTimeout(300);
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
    for (let i = 0; !key && i < PERKS.length; i++) { pickPerk(PERKS[i]); key = Object.keys(G.pxPerk)[0] || null; }
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
      /* ⚑⚑⚑ T119 — 등급이 부활해 기대 테두리색은 «그 특전의 등급색» 이다(T96~T118 은 한 색 PERK_COLOR 였다).
         일반 등급색(#9EA3AC)은 «출처 없음» 폴백색과 같은 값이라 «회색이 아니다» 로는 판정할 수 없어,
         등급에서 기대색을 만들어 비교한다. */
      wantCC: perk ? perkColor(perk) : null, wantRar: perk ? PERK_GRADE_NAME[perk.g] : '-',
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
        cards: document.querySelectorAll('.perk-card.pick').length,
        choice: document.querySelectorAll('#overlay .choice-btn').length, paused: !!(G && G.paused) };
    }, buffOn.key);
    if (st.n === 0) { gone = true; tLast = 0; break; }
    tLast = st.left; polls++;
    if (st.cards) { await p.click('#perkPick0'); await p.waitForTimeout(250); continue; }
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
    pickPerk(same); pickPerk(same);            /* 같은 특전 3번 → 개수 뱃지 3 */
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
    for (const q of PERKS.filter(x => !had.has(x.id || x.tx))) pickPerk(q);
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

  /* ---------- ⚑ T89 «보유 특전» 버튼 (주인 지시 2026-09-03 · T96 이관 · ⚑ T117 로 원래 쓰임 복귀) ----------
     ⚑ T117 로 3택 선택창이 돌아와 «고르기 전에 내가 뭘 갖고 있나 확인» 이라는 원래 쓰임을 되찾았다.
     여기서 보는 것은 ①버튼이 오른쪽 하단에 있고 ②카드와 안 겹치고 ③목록이 열린 동안에도 시간이
     멈춰 있고 ④닫으면 **선택지가 그대로인 같은 팝업**으로 돌아오는지다(재굴림 = 무료 새로고침 금지). */
  console.log('\n=== ⚑ 레벨업 팝업 «보유 특전» 버튼 (T89 · T96 이관) ===');
  await drainAll(p);
  const bk0 = await p.evaluate(() => {
    /* ⚑ T119 — 풀(32)이 한 런 상한(PERK_PICKS 10)보다 커졌다. 앞 절이 32종을 전부 밀어 넣어 뒀으므로
       그대로 열면 **상한에 걸려** 팝업이 안 뜬다(hasPerkLeft = false). 상한 아래로 줄여 3장이 뜨게 만든다.
       (앞 절이 같은 특전을 여러 번 밀어 넣어 뒀으므로 «중복까지 포함해» 다시 만든다) */
    G.perksTaken = [PERKS.slice(0, 3), G.perksTaken.filter(x => !PERKS.includes(x))].flat();
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
      back: !!document.getElementById('pbBack'), choiceGone: !document.getElementById('perkPick0'),
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
    ok: !!document.getElementById('perkPick0'), paused: G.paused,
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
        cards: document.querySelectorAll('.perk-card.pick').length,
        alive: !!(bn && bn.enemies.some(e => !e.dead && e.hp > 0)),
        cleared: !!(G && G.cleared), ov: document.getElementById('overlay').textContent.slice(0, 40),
      };
    });
    if (st.alive) {
      if (st.cards) { lateDrain++; await p.click('#perkPick0'); await p.waitForTimeout(250); continue; }
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

  /* ---------- ⚑⚑⚑ T105 — «같은 챕터 두 번 시작 → 원거리 자리 동일» (주인 확정 2026-09-03 17:0X) ----------
     정적 게이트(`verifyChapterFixed` ⓔ~ⓙ)는 `chapterLayout` 이 내놓는 `ranged[]` 를 보지만, 게임이 실제로
     그것을 «읽어서» 적을 세우는지는 여기서만 확인된다(중간에 다시 굴리면 정적 검사는 초록인 채 깨진다).
     맨 끝에 두는 이유 — `startChapter` 가 전역 G 를 갈아치우므로 앞의 검사들이 끝난 뒤에야 안전하다. */
  console.log('\n=== ⚑ T105 같은 챕터 = 같은 원거리 자리 (실측) ===');
  const rangedRun = c => p.evaluate(ch => {
    startChapter(ch);
    return {
      pat: G.nodes.filter(n => n.type === 'wave').map(n => n.enemies.map(e => e.ranged ? '1' : '0').join('')).join('|'),
      n: G.nodes.flatMap(n => n.type === 'wave' ? n.enemies : []).filter(e => e.ranged).length,
      /* ⚑⚑⚑ T134 — «그대로 매판 굴린다» 반쪽의 실측 재료. 자리(ranged)는 챕터 시드로 굳었지만
         첫 공격 타이머·스킨·흔들림은 판마다 새로 굴려져야 한다 (주인 확정 T105 ②). */
      t: G.nodes.flatMap(n => n.type === 'wave' ? n.enemies : []).map(e => +e.atkTimer.toFixed(4)),
      sk: G.nodes.flatMap(n => n.type === 'wave' ? n.enemies : []).map(e => e.skin && e.skin.body).join(','),
      bob: G.nodes.flatMap(n => n.type === 'wave' ? n.enemies : []).map(e => +e.bob.toFixed(4)),
      bossT: (G.nodes.find(n => n.type === 'boss') || { enemies: [] }).enemies.map(e => e.atkTimer).join(','),
    };
  }, c);
  /* ⚑⚑⚑ T114 — 챕터 1~4 는 원거리가 0마리라 «다른 챕터는 다른 자리» 를 거기서 재면 둘 다 전부 0 이라
     항상 같다. 과녁을 원거리가 실제로 서는 챕터(7·8 = 램프 구간 3·4마리)로 옮긴다. */
  const r7a = await rangedRun(7), r7b = await rangedRun(7), r8 = await rangedRun(8);
  chk('⚑ 같은 챕터를 두 번 시작하면 원거리 자리가 완전히 같다', r7a.pat === r7b.pat && r7a.pat.length > 0,
    `챕터 7 원거리 ${r7a.n}마리 · 두 번째 ${r7b.n}마리`);
  chk('다른 챕터는 다른 자리다 (고정이 «전 챕터 동일» 로 뭉개지지 않았다)', r7a.pat !== r8.pat,
    `ch7 ${r7a.n}마리 / ch8 ${r8.n}마리`);
  chk('웨이브 첫 마리는 원거리가 아니다', r7a.pat.split('|').every(w => w[0] === '0'));
  /* ⚑⚑⚑ T134 — 같은 주인 문장의 «나머지 반쪽»: «스킨·첫 공격 타이머·전투 난수는 그대로 매판 굴린다».
     정적 게이트(`verifyPerRunRandom`)는 두 엔진 소스와 sim.js 스폰을 보지만, **게임이 실제로 세운 적**이
     판마다 새로 굴려지는지는 여기서만 확인된다. 자리는 위에서 «같다» 를 봤으니 여기선 «다르다» 를 본다. */
  chk('⚑ T134 같은 챕터를 두 번 시작해도 첫 공격 타이머는 판마다 다르다 (실측)',
    r7a.t.join(',') !== r7b.t.join(',') && r7a.t.length > 0,
    `1회차 ${r7a.t.slice(0, 3).join('/')} … / 2회차 ${r7b.t.slice(0, 3).join('/')} …`);
  chk('⚑ T134 한 판 안에서도 적마다 타이머가 다르다 (한 값으로 굳지 않았다)',
    new Set(r7a.t).size === r7a.t.length, `${new Set(r7a.t).size}/${r7a.t.length}종`);
  chk('⚑ T134 적 스킨·흔들림도 판마다 새로 굴려진다 (연출 난수 — 주인 «배치» 범위 밖)',
    (r7a.sk !== r7b.sk || r7a.bob.join(',') !== r7b.bob.join(',')) && r7a.sk.length > 0,
    `스킨 ${r7a.sk === r7b.sk ? '동일' : '다름'} · 흔들림 ${r7a.bob.join(',') === r7b.bob.join(',') ? '동일' : '다름'}`);
  chk('⚑ T134 보스 첫 공격 타이머는 상수 그대로다 (일반 적만 굴린다)',
    r7a.bossT === r7b.bossT && r7a.bossT.length > 0, `보스 ${r7a.bossT}`);
  /* ⚑⚑⚑ T114 마릿수 곡선 실측 — 주인 «챕터 4까지는 원거리 아예 없고 5부터 원거리 1마리씩 추가».
     정적 게이트는 `chapterLayout` 을 보지만, 게임이 그 마릿수대로 실제 적을 세우는지는 여기서만 확인된다. */
  const zeroN = [];
  for (const c of [1, 2, 3, 4]) zeroN.push((await rangedRun(c)).n);
  chk('⚑ 챕터 1~4 는 원거리가 한 마리도 안 선다 (주인 «챕터 4까지는 원거리 아예 없고»)',
    zeroN.every(n => n === 0), `ch1~4 = ${zeroN.join('/')}마리`);
  const ramp = [];
  for (const c of [5, 6, 7, 8]) ramp.push((await rangedRun(c)).n);
  chk('⚑ 챕터 5~8(램프)은 1·2·3·4마리로 한 마리씩 는다 (주인 «5부터 1마리씩 추가»)',
    ramp.join('/') === '1/2/3/4', `ch5~8 = ${ramp.join('/')}마리`);

  /* ---------- ⚑⚑⚑ T136 — 창의 화신: 화살이 창이 되되 «창 데미지·8관통 그대로» (주인 확정 T105) ----------
     정적 게이트(`verifySpearAvatar`)는 두 엔진 소스와 sim.js 실측을 보지만, **게임이 실제로 만드는 투사체**가
     평범한 창과 같은 계수·관통·사거리인지는 여기서만 확인된다(게임 쪽 `fireSpear` 는 `volley` 순차 연사를
     한 겹 더 쓴다 — sim.js 에는 없는 층이라 여기서 발수가 조용히 깎일 수 있다).
     ⚑ 판을 `G.paused=true` 로 얼려 두고 잰다 — 얼려도 `volley` 의 setTimeout 은 그대로 흘러 발사되고,
       전투 업데이트만 멈춘다(`if(!G.paused&&!G.over) update(...)`). 플레이어가 죽거나 적이 사라져
       발수가 흔들리는 것을 막는다. 투사체는 `G.pprojs.push` 를 가로채 **만들어진 순간** 을 센다. */
  console.log('\n=== ⚑ T136 창의 화신 — 화살이 창이 되되 창 데미지·8관통은 그대로 (실측) ===');
  const shoot = (px, n, which) => p.evaluate(async ([px, n, which]) => {
    startChapter(1);
    const pl = G.player;
    Object.assign(pl.px, { p_spearAvatar: 0, arrowCount: 0, spearMaster: 0 }, px);
    /* 화살은 사거리(540) 안에 표적이 있어야 난다 — 자리만 당기고 판은 얼린다 */
    const first = G.nodes.flatMap(nd => nd.enemies).sort((a, b) => a.worldX - b.worldX)[0];
    pl.worldX = first ? first.worldX - 200 : 0;
    G.paused = true;
    const rec = [];
    G.pprojs.push = function (o) {
      rec.push({ type: o.type, ratio: o.ratio, spd: o.spd, pierce: o.pierce, maxX: o.maxX });
      return Array.prototype.push.call(this, o);
    };
    (which === 'spear' ? fireSpear : fireArrows)(pl, n);
    await new Promise(r => setTimeout(r, 700));   /* volley = 발마다 50~70ms 순차 연사 */
    G.paused = false;
    return rec;
  }, [px, n, which]);
  const t136base = await shoot({}, 3, 'arrows');
  const t136av = await shoot({ p_spearAvatar: 1 }, 3, 'arrows');
  const t136sp = await shoot({}, 3, 'spear');
  chk('⚑ T136 아바타 없이 화살 3발을 쏘면 화살 3발이 뜬다 (전제)',
    t136base.length === 3 && t136base.every(o => o.type === 'parrow'),
    `${t136base.length}발 · ${t136base[0] ? t136base[0].type : '—'}`);
  chk('⚑ T136 아바타를 켜면 같은 자리에서 창 3개가 뜬다 (화살 0발 · 발수 그대로)',
    t136av.length === 3 && t136av.every(o => o.type === 'spear'),
    `창 ${t136av.filter(o => o.type === 'spear').length}개 · 화살 ${t136av.filter(o => o.type === 'parrow').length}발`);
  chk('⚑ T136 그 창이 fireSpear(3) 의 창과 한 필드도 다르지 않다 (계수·속도·사거리·관통)',
    JSON.stringify(t136av) === JSON.stringify(t136sp), JSON.stringify(t136sp[0] || {}));
  const t136ac = await shoot({ p_spearAvatar: 1, arrowCount: 1 }, 2, 'arrows');
  chk('⚑ T136 장비 «화살 발수» 옵션이 아바타의 창 발수에도 걸린다 (주인 «장비 화살 옵션도 포함»)',
    t136ac.length === 3 && t136ac.every(o => o.type === 'spear'), `2발 → 창 ${t136ac.length}개`);
  const t136sm = await shoot({ p_spearAvatar: 1, spearMaster: 1 }, 1, 'arrows');
  const t136sm0 = await shoot({ spearMaster: 1 }, 1, 'spear');
  chk('⚑ T136 장비 «창 데미지» 옵션도 아바타 창에 똑같이 걸린다 (아바타 전용 창이 아니다)',
    t136sm.length === 1 && t136sm0.length === 1 && t136sm[0].ratio === t136sm0[0].ratio
    && t136sm[0].ratio > (t136sp[0] ? t136sp[0].ratio : Infinity),
    `아바타 ${t136sm[0] ? t136sm[0].ratio : '—'} / 평범 ${t136sm0[0] ? t136sm0[0].ratio : '—'} / 기본 ${t136sp[0] ? t136sp[0].ratio : '—'}`);
  /* ---------- ⚑⚑⚑ T137 — 장비 옵션의 «발동 조건» 을 **게임 안에서** 실측 (주인 확정 T124 ③) ----------
     주인 문면 두 절: «가시갑옷 옵션은 특전 가시갑옷과 가산(실드 > 0 일 때만 +12%씩)» ·
     ««체력 50% 미만일 때 회피 시 회복» 은 회피 성공 순간 체력 비율로 판정».
     정적 게이트(`verifyGearOptTrigger`)는 `sim.js` 의 `hitPlayer` 를 vm 에서 굴려 재고 index.html 은
     «조건이 평가되는 자리» 를 구조로 본다 — **게임이 실제로 그 조건대로 발동하는지**는 여기서만 확인된다.
     맨 끝에 두는 이유: 난수·플레이어 상태를 잠깐 갈아끼우므로 앞의 검사가 다 끝난 뒤라야 안전하다. */
  console.log('\n=== ⚑ T137 장비 옵션 발동 조건 (게임 안 실측) ===');
  const trig = await p.evaluate(() => {
    startChapter(7);                                   /* 갓 만든 G · 플레이어로 시작 */
    const pl = G.player, px = pl.px, RR = Math.random;
    /* 시간이 흐르면 방어 버프가 만료돼 `effDef` 가 측정 도중에 움직인다 —
       판을 멈추고 방어축을 0 으로 굳혀서 «받은 피해» 를 dmg 그대로 만든다. */
    const keep = { hp: pl.hp, sh: pl.sh, ev: pl.evade, ward: pl.ward, def: pl.def,
      bd: pl.buffs.def, gc: px.guardCrystal, pause: G.paused,
      th: px.g_thornSh, pt: px.p_thorns, eh: px.g_evHeal, ea: px.g_evAxe };
    G.paused = true; pl.def = 0; pl.buffs.def = []; px.guardCrystal = false;
    let n = 0;
    const roll = f => { n = 0; Math.random = () => { const v = f(n); n++; return v; }; };
    const foe = () => ({ hp: 1e4 });   /* 반사량은 1 미만이라 부동소수 간격이 측정을 흐리지 않게 작게 잡는다 */
    const out = { d: 0 };
    try {
      /* ⓐ 가시갑옷 — 실드 유무로 장비분(+72%)이 붙었다 떨어진다 (특전분 0) */
      pl.ward = 0; pl.evade = 0; px.g_thornSh = 0.72; px.p_thorns = 0;
      const d = 1 * (1 - effDef(pl) / 100); out.d = d;
      roll(() => 0.999);                               /* 회피 실패 · 모든 확률 굴림 실패 */
      pl.hp = pl.maxHp; pl.sh = 1e9; let e = foe(); hitPlayer(1, true, e); out.shOn = 1e4 - e.hp;
      roll(() => 0.999);
      pl.hp = pl.maxHp; pl.sh = 0; e = foe(); hitPlayer(1, true, e); out.shOff = 1e4 - e.hp;
      /* ⓑ 실드가 이 타격으로 «전부 소진» 돼도 발동한다 (조건 시점 = 피격 «전») */
      roll(() => 0.999);
      pl.hp = pl.maxHp; pl.sh = d / 2; e = foe(); hitPlayer(1, true, e); out.shDrain = 1e4 - e.hp;
      /* ⓒ 특전 가시(+100%)와 «가산» — 곱연산이면 ×1.72 가 아니라 ×1.72… 가 아니라 1×1.72 로 갈라진다 */
      roll(() => 0.999); px.p_thorns = 3;
      pl.hp = pl.maxHp; pl.sh = 1e9; e = foe(); hitPlayer(1, true, e); out.both = 1e4 - e.hp;
      /* ⓓ 원거리는 안 붙는다 */
      roll(() => 0.999);
      pl.hp = pl.maxHp; pl.sh = 1e9; e = foe(); hitPlayer(1, false, e); out.ranged = 1e4 - e.hp;
      /* ⓔ 저체력 회피 회복 — 굴림 횟수(부위마다 따로)·조건 경계·회복량 */
      px.g_thornSh = 0; px.p_thorns = 0; px.g_evAxe = 0; px.g_evHeal = 6; pl.evade = 50; pl.sh = 0;
      roll(() => 0); pl.hp = pl.maxHp * 0.10; let h0 = pl.hp; hitPlayer(1, true, foe());
      out.loRolls = n; out.loHeal = (pl.hp - h0) / pl.maxHp;
      roll(() => 0); pl.hp = pl.maxHp * 0.50; h0 = pl.hp; hitPlayer(1, true, foe());
      out.midRolls = n; out.midHeal = (pl.hp - h0) / pl.maxHp;
      roll(() => 0); pl.hp = pl.maxHp * 0.49; h0 = pl.hp; hitPlayer(1, true, foe());
      out.loEdgeRolls = n;
      px.g_evHeal = 1;
      roll(() => 0); pl.hp = pl.maxHp * 0.10; h0 = pl.hp; hitPlayer(1, true, foe());
      out.oneRolls = n; out.oneHeal = (pl.hp - h0) / pl.maxHp;
    } finally {
      Math.random = RR;
      pl.hp = keep.hp; pl.sh = keep.sh; pl.evade = keep.ev; pl.ward = keep.ward; pl.def = keep.def;
      pl.buffs.def = keep.bd; px.guardCrystal = keep.gc; G.paused = keep.pause;
      px.g_thornSh = keep.th; px.p_thorns = keep.pt; px.g_evHeal = keep.eh; px.g_evAxe = keep.ea;
    }
    return out;
  });
  const nr = (a, b) => Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b));
  chk('⚑ T137 실드가 있으면 가시갑옷 장비분(+72%)이 붙는다', nr(trig.shOn, trig.d * 0.72),
    `반사 ${trig.shOn} · 기대 ${trig.d * 0.72}`);
  chk('⚑ T137 실드가 0 이면 장비분이 안 붙는다', nr(trig.shOff, 0), `반사 ${trig.shOff}`);
  chk('⚑ T137 실드가 이 타격으로 전부 소진돼도 발동한다 (조건 시점 = 피격 «전»)',
    nr(trig.shDrain, trig.d * 0.72), `반사 ${trig.shDrain} · 기대 ${trig.d * 0.72} (0 이면 hadSh 가 흡수 «뒤» 로 밀린 것)`);
  chk('⚑ T137 특전 가시(+300%)와 «가산» 이다 (×3.72 · 곱연산이면 ×5.16)',
    nr(trig.both, trig.d * 3.72), `반사 ${trig.both} · 가산 ${trig.d * 3.72} · 곱연산 ${trig.d * 3 * 1.72}`);
  chk('⚑ T137 원거리 피격은 가시갑옷이 안 붙는다', nr(trig.ranged, 0), `반사 ${trig.ranged}`);
  chk('⚑ T137 체력 10% 회피 → 6부위가 각각 따로 굴린다 (굴림 7 = 회피1 + 회복6)',
    trig.loRolls === 7, `굴림 ${trig.loRolls}회`);
  chk('⚑ T137 전부 성공하면 최대 체력의 10% × 6 회복', nr(trig.loHeal, 0.6),
    `회복 ${(trig.loHeal * 100).toFixed(4)}%`);
  chk('⚑ T137 체력 정확히 50% 면 발동하지 않는다 («미만»)',
    trig.midRolls === 1 && nr(trig.midHeal, 0), `굴림 ${trig.midRolls}회 · 회복 ${trig.midHeal}`);
  chk('⚑ T137 체력 49% 면 발동한다 (경계 한 칸)', trig.loEdgeRolls === 7, `굴림 ${trig.loEdgeRolls}회`);
  chk('⚑ T137 1부위면 정확히 1번 굴리고 10% 회복한다',
    trig.oneRolls === 2 && nr(trig.oneHeal, 0.1), `굴림 ${trig.oneRolls}회 · 회복 ${(trig.oneHeal * 100).toFixed(4)}%`);

  chk('pageerror 0', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close();
  const bad = R.filter(r => !r.c);
  console.log(`\n[②] 통과 ${R.length - bad.length} · 불합격 ${bad.length}`);
  if (bad.length) console.log('불합격:', bad.map(x => x.n + (x.d ? ` (${x.d})` : '')).join(' / '));
  process.exit(bad.length ? 1 : 0);
})();
