#!/usr/bin/env node
/* ⚑ T157 게이트 — PLAN §3.1 의 «표 밖 산문» ↔ 엔진 상수·§3.1 표 대조
 *
 * 왜 생겼나 (구멍의 증거).
 *   §3.1 은 «특전 표»(100행) 아래에 **표가 아닌 글**로 세 덩이를 더 들고 있다:
 *     ⓐ «등급별 개수» 줄(39/32/29 = 풀 100 · 카드 등급 굴림 60/25/15)
 *     ⓑ «수치 해석» 불릿 블록(주인 위임 기본값 — 회피 시 회복 3종 · 확률형/치피 · 곱연산 3종 ·
 *        가시갑옷 · 처치 시 트리거 · 보이는 적 전부 · 오버킬 · 광전사 · 귀족의 눈 · 창의 화신)
 *     ⓒ «엔진 상수» 문단(상수 이름 ↔ 값을 손으로 적어 둔 목록)
 *   이 셋에 닿는 자가 **하나도 없었다**. `verifyOptText` ④ 는 설계상 «그 줄이 엔진 심볼(함수명·px 키·
 *   특전 id)을 이름으로 부를 때만» 보므로 이 줄들은 관할 밖이고, `verifyPerkOrder` 는 §3.1 **표**만 본다.
 *   사본 돌연변이 9종(회복량 12→6 · II 66→15 · «실드는 안 채움» 뒤집기 · «회복 증폭 적용» 뒤집기 ·
 *   +10→+25 · +50→+90 · 광전사 ×3→×5 · 60/25/15→40/35/25 · 풀 100→99)을 심어도
 *   **정적 32종의 통과 수가 글자 하나 안 움직였다.**
 *   실제로 이미 드리프트해 있었다 — T121 이 내린 수치(+10→+8 · +50→+30 · 1.20→1.15 · 1.10→1.08)와
 *   T155 가 바꾼 회피 회복(0.10→0.33 · 0.06→0.12)이 산문·«엔진 상수» 문단에 하나도 반영돼 있지 않았고,
 *   특전 행 번호 참조 7곳(가시갑옷·처치 시 트리거·보이는 적 전부·오버킬·광전사·귀족의 눈·회복 증폭)이
 *   풀 32종 시절 번호 그대로였다. PLAN 은 확정 스펙이라 **다음 워커가 읽고 엔진을 여기에 맞추면 진짜 사고**다.
 *
 * 무엇을 보나 — 기대값을 **두 엔진에서 뽑아** 산문과 대조한다(이 파일에 수치를 박지 않는다).
 *   ⓐ 등급별 개수·풀 크기·카드 등급 굴림  ↔ §3.1 표 실측 + `PERK_GRADE_RATE`
 *   ⓑ 회피 시 회복 3종                    ↔ `PERK_EVHEAL_CH/_R/_L/_F` + 회피 분기 실제 호출 모양
 *   ⓒ 확률형·치피                          ↔ `PERK_EVADE_A`·`PERK_COUNTER_A`·`PERK_CRITR_A`·`PERK_CRITF_A` + `TUNE` 기본치
 *   ⓓ 곱연산 3종                           ↔ `PERK_ATK_M`·`PERK_DEF_M`·`PERK_BERSERK_M`
 *   ⓔ 가시갑옷 최대 배율                   ↔ `PERK_THORN_N/_R/_L`
 *   ⓕ 번개 회당 계수 · 창 데미지/관통       ↔ `R_BOLT`·`R_SPEAR`·`SPEAR_PIERCE`
 *   ⓖ 귀족의 눈 재정규화 62.5/37.5          ↔ `PERK_GRADE_RATE` 로 계산
 *   ⓗ 특전 행 번호 참조 8곳                 ↔ §3.1 표에서 이름으로 찾은 실제 행 번호
 *   ⓘ «엔진 상수» 문단의 이름↔값 전부       ↔ 두 엔진의 실제 선언값 (이름이 없으면 그것도 불합격)
 *
 * 사용: node tools/verifyPlanProse.js        (exit 0 = 통과, 1 = 불합격)
 *      node tools/verifyPlanProse.js --self  (음성 검사 — 일부러 깨뜨린 사본이 전부 빨개지는지)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let R = [];
const chk = (n, c, d) => { R.push({ n, c: !!c }); return !!c; };

/* ── 엔진 상수 읽기 — `const NAME=값` / `NAME=값` 선언에서 한 값을 집는다.
      분수 리터럴(`2/3`)도 한 값으로 읽는다(verifyPerkOrder 와 같은 규약). ── */
function constOf(src, name) {
  const m = src.match(new RegExp('(?:^|[,;{\\s])' + name + '\\s*=\\s*(-?[0-9.]+(?:/[0-9.]+)?)'));
  if (!m) return null;
  return m[1].includes('/') ? eval(m[1]) : Number(m[1]); // eslint-disable-line no-eval
}
function arrOf(src, name) {
  const m = src.match(new RegExp(name + '\\s*=\\s*\\[([0-9,\\s]+)\\]'));
  return m ? m[1].split(',').map(s => Number(s.trim())) : null;
}
function tuneOf(src, key) {
  const m = src.match(new RegExp('\\b' + key + '\\s*:\\s*(-?[0-9.]+)'));
  return m ? Number(m[1]) : null;
}

/* ── §3.1 특전 표 파싱 — «| n | p_id | 등급 | 이름 | 효과 |» ── */
function planRows(planSrc) {
  const out = [];
  for (const l of planSrc.split('\n')) {
    const m = l.match(/^\|\s*(\d+)\s*\|\s*(p_[A-Za-z]+)\s*\|\s*(일반|희귀|전설)\s*\|\s*([^|]+?)\s*\|/);
    if (m) out.push({ n: Number(m[1]), id: m[2], g: m[3], nm: m[4] });
  }
  return out;
}
/* «11~14 · 16 · 19~21» → [11,12,13,14,16,19,20,21] */
function expandRefs(s) {
  const out = [];
  for (const tok of s.split(/[·,\s]+/)) {
    const r = tok.match(/^(\d+)~(\d+)$/);
    if (r) { for (let i = Number(r[1]); i <= Number(r[2]); i++) out.push(i); continue; }
    const one = tok.match(/^(\d+)$/);
    if (one) out.push(Number(one[1]));
  }
  return out;
}
const num = (line, re) => { const m = line && line.match(re); return m ? Number(m[1]) : null; };
const eq = (a, b) => a !== null && b !== null && Math.abs(a - b) < 1e-9;

/* ── §3.1 의 산문 구간만 잘라 낸다 (표 끝 «등급별 개수» 줄부터 «엔진 상수» 문단 끝까지) ── */
function proseOf(planSrc) {
  const L = planSrc.split('\n');
  const a = L.findIndex(l => l.startsWith('**등급별 개수**'));
  const b = L.findIndex((l, i) => i > a && l.startsWith('(두 엔진 같은 이름·같은 값)'));
  if (a < 0 || b < 0) return null;
  return L.slice(a, b + 1);
}
/* 여러 줄에 걸친 불릿을 한 줄로 잇는다 (`- ` 로 시작하는 줄 ~ 다음 `- `/빈 줄 전까지) */
function bullets(lines) {
  const out = [];
  let cur = null;
  for (const l of lines) {
    if (/^- /.test(l)) { if (cur !== null) out.push(cur); cur = l; }
    else if (cur !== null && /^\s+\S/.test(l)) cur += ' ' + l.trim();
    else if (cur !== null) { out.push(cur); cur = null; }
  }
  if (cur !== null) out.push(cur);
  return out;
}

/* ================================================================ */
function run(simSrc, htmSrc, planSrc, quiet) {
  R = [];
  const say = quiet ? () => {} : console.log;
  const P = proseOf(planSrc);
  if (!chk('§3.1 산문 구간(«등급별 개수» ~ «엔진 상수»)을 찾았다', !!P)) return R;
  const B = bullets(P);
  const find = re => B.find(l => re.test(l)) || null;
  const rows = planRows(planSrc);
  const rowsOfName = nm => rows.filter(r => r.nm === nm).map(r => r.n);
  const E = [['sim.js', simSrc], ['index.html', htmSrc]];
  /* 두 엔진에서 같은 값일 때만 기대값으로 쓴다 — 갈라져 있으면 그 자체가 불합격 */
  const K = name => {
    const v = E.map(([, s]) => constOf(s, name));
    return (v[0] !== null && v[0] === v[1]) ? v[0] : null;
  };

  /* ===== ⓐ 등급별 개수 · 풀 크기 · 카드 등급 굴림 ===== */
  say('\n=== ⓐ «등급별 개수» 줄 ↔ §3.1 표 실측 · PERK_GRADE_RATE ===');
  {
    const line = P.find(l => l.startsWith('**등급별 개수**'));
    const cnt = g => rows.filter(r => r.g === g).length;
    const m = line && line.match(/일반 \*\*(\d+)\*\* · 희귀 \*\*(\d+)\*\* · 전설 \*\*(\d+)\*\* = 풀 \*\*(\d+)\*\*/);
    chk('«등급별 개수» 줄의 일반 수가 §3.1 표 실측과 같다', m && Number(m[1]) === cnt('일반'));
    chk('«등급별 개수» 줄의 희귀 수가 §3.1 표 실측과 같다', m && Number(m[2]) === cnt('희귀'));
    chk('«등급별 개수» 줄의 전설 수가 §3.1 표 실측과 같다', m && Number(m[3]) === cnt('전설'));
    chk('«등급별 개수» 줄의 풀 크기가 §3.1 표 행 수와 같다', m && Number(m[4]) === rows.length);
    chk('세 등급의 합이 풀 크기다', m && Number(m[1]) + Number(m[2]) + Number(m[3]) === Number(m[4]));
    const rate = E.map(([, s]) => arrOf(s, 'PERK_GRADE_RATE'));
    const rm = line && line.match(/카드 등급 굴림 \*\*(\d+) \/ (\d+) \/ (\d+)\*\*/);
    chk('두 엔진의 PERK_GRADE_RATE 가 같다', rate[0] && rate[1] && rate[0].join() === rate[1].join());
    chk('«카드 등급 굴림» 3수가 PERK_GRADE_RATE 와 같다',
      rm && rate[0] && [1, 2, 3].every(i => Number(rm[i]) === rate[0][i - 1]));
    chk('«카드 등급 굴림» 3수의 합이 100 이다', rm && Number(rm[1]) + Number(rm[2]) + Number(rm[3]) === 100);
  }

  /* ===== ⓑ 회피 시 회복 I·II·III ===== */
  say('\n=== ⓑ «회피 시 회복 I·II·III» 산문 ↔ PERK_EVHEAL_* · 회피 분기 ===');
  {
    const line = find(/회피 시 회복 I·II·III/);
    chk('«회피 시 회복 I·II·III» 불릿이 있다', !!line);
    const ch = K('PERK_EVHEAL_CH'), rr = K('PERK_EVHEAL_R'), ll = K('PERK_EVHEAL_L'), f = K('PERK_EVHEAL_F');
    chk('PERK_EVHEAL_CH/_R/_L/_F 네 상수가 두 엔진에서 같다',
      ch !== null && rr !== null && ll !== null && f !== null);
    const m = line && line.match(/\(I (\d+)% · II (\d+)% · III (\d+)%\)/);
    chk('산문의 I 확률이 PERK_EVHEAL_CH ×100 이다', m && eq(Number(m[1]), ch * 100));
    chk('산문의 II 확률이 PERK_EVHEAL_R ×100 이다', m && eq(Number(m[2]), rr * 100));
    chk('산문의 III 확률이 PERK_EVHEAL_L ×100 이다', m && eq(Number(m[3]), ll * 100));
    chk('산문의 회복량이 PERK_EVHEAL_F ×100 이다', eq(num(line, /회복량 \*\*(\d+)%\*\*/), f * 100));
    /* 산문이 든 행 번호 3개가 §3.1 표의 «회피 시 회복»·«… II»·«… III» 자리와 같은가 */
    const ref = line && line.match(/일반 (\d+) · 희귀 (\d+) · 전설 (\d+)/);
    chk('산문이 든 일반 행 번호가 §3.1 표의 «회피 시 회복» 이다',
      ref && rowsOfName('회피 시 회복').join() === String(Number(ref[1])));
    chk('산문이 든 희귀 행 번호가 §3.1 표의 «회피 시 회복 II» 다',
      ref && rowsOfName('회피 시 회복 II').join() === String(Number(ref[2])));
    chk('산문이 든 전설 행 번호가 §3.1 표의 «회피 시 회복 III» 이다',
      ref && rowsOfName('회피 시 회복 III').join() === String(Number(ref[3])));
    /* 문면 3조항 — «각각 독립 굴림» · «실드는 안 채움» · «회복 증폭 적용» */
    chk('산문에 «각각 독립 굴림» 이 있다', !!line && /\*\*각각 독립 굴림\*\*/.test(line));
    chk('산문에 «실드는 안 채움» 이 있다', !!line && /\*\*실드는 안 채움\*\*/.test(line));
    chk('산문에 «회복 증폭 적용» 이 있다', !!line && /\*\*회복 증폭 적용\*\*/.test(line));
    /* 그 세 조항이 엔진에서 실제로 그런가 — 세 줄이 각각 pkk 로 따로 굴고, heal 은 두 인자(증폭 분기)다 */
    const three = [['p_evadeHeal', 'PERK_EVHEAL_CH'], ['p_evHealR', 'PERK_EVHEAL_R'], ['p_evHealL', 'PERK_EVHEAL_L']];
    for (const [nm, src] of E) {
      const sq = src.replace(/\s+/g, '');
      for (const [key, cst] of three) {
        const re = new RegExp('if\\(px\\.' + key + '&&pkk\\(p,' + cst + '\\)\\)\\{?heal\\(p,p\\.maxHp\\*PERK_EVHEAL_F\\)');
        chk(`${nm} — ${key} 이 ${cst} 로 따로 굴고 PERK_EVHEAL_F 로 회복한다 (증폭 분기 · 인자 2개)`, re.test(sq));
      }
      chk(`${nm} — 회피 회복이 noBoost(=true) 로 새지 않는다`, !/PERK_EVHEAL_F,true/.test(sq));
    }
  }

  /* ===== ⓒ 확률형 · 치명타 피해 ===== */
  say('\n=== ⓒ «확률형 +N · 치명타 피해 +M» ↔ 특전 상수 + TUNE 기본치 ===');
  {
    const line = find(/^- 확률형\(회피·반격·치명타 확률\)/);
    chk('«확률형» 불릿이 있다', !!line);
    const ev = K('PERK_EVADE_A'), ct = K('PERK_COUNTER_A'), cr = K('PERK_CRITR_A'), cf = K('PERK_CRITF_A');
    chk('PERK_EVADE_A·PERK_COUNTER_A·PERK_CRITR_A 가 두 엔진에서 같은 한 값이다',
      ev !== null && ev === ct && ct === cr, `${ev}/${ct}/${cr}`);
    const m = line && line.match(/\*\*\+(\d+)\*\*\(기본 (\d+) → (\d+)\)/);
    chk('산문의 확률형 증가폭이 세 상수와 같다', m && eq(Number(m[1]), ev));
    /* 기본치는 TUNE 에서 — 회피·반격·치확 셋이 같은 기본치를 쓴다 */
    const base = ['pEvade0', 'pCounter0', 'pCrit0'].map(k => tuneOf(simSrc, k));
    chk('TUNE 의 회피·반격·치확 기본치가 한 값이다', base.every(v => v !== null && v === base[0]), base.join('/'));
    chk('산문의 «기본 X» 가 TUNE 기본치와 같다', m && eq(Number(m[2]), base[0]));
    chk('산문의 «→ Y» 가 기본치 + 증가폭이다', m && eq(Number(m[3]), base[0] + ev));
    const c = line && line.match(/치명타 피해는 \*\*\+(\d+)\*\*\(기본 (\d+) → (\d+)\)/);
    const cfBase = tuneOf(simSrc, 'pCritF0');
    chk('산문의 치피 증가폭이 PERK_CRITF_A 와 같다', c && eq(Number(c[1]), cf));
    chk('산문의 치피 «기본 X» 가 TUNE.pCritF0 와 같다', c && eq(Number(c[2]), cfBase));
    chk('산문의 치피 «→ Y» 가 기본치 + 증가폭이다', c && eq(Number(c[3]), cfBase + cf));
    /* index.html 도 같은 기본치를 쓰는가 */
    for (const k of ['pEvade0', 'pCounter0', 'pCrit0', 'pCritF0'])
      chk(`두 엔진의 TUNE.${k} 가 같다`, tuneOf(simSrc, k) !== null && tuneOf(simSrc, k) === tuneOf(htmSrc, k));
  }

  /* ===== ⓓ 곱연산 3종 ===== */
  say('\n=== ⓓ «공격력 · 방어력 · 광전사» 곱연산 ↔ PERK_ATK_M · PERK_DEF_M · PERK_BERSERK_M ===');
  {
    const line = find(/^- 공격력 \+\d+%\(\d+번\)/);
    chk('«곱연산 3종» 불릿이 있다', !!line);
    const atk = K('PERK_ATK_M'), def = K('PERK_DEF_M'), bs = K('PERK_BERSERK_M');
    chk('PERK_ATK_M·PERK_DEF_M·PERK_BERSERK_M 이 두 엔진에서 같다', atk !== null && def !== null && bs !== null);
    const m = line && line.match(/공격력 \+(\d+)%\((\d+)번\) · 방어력 \+(\d+)%\((\d+)번\) · 광전사 ×(\d+)\((\d+)번\)/);
    chk('산문의 공격력 증가율이 (PERK_ATK_M − 1)×100 이다', m && eq(Number(m[1]), Math.round((atk - 1) * 1000) / 10));
    chk('산문의 방어력 증가율이 (PERK_DEF_M − 1)×100 이다', m && eq(Number(m[3]), Math.round((def - 1) * 1000) / 10));
    chk('산문의 광전사 배수가 PERK_BERSERK_M 이다', m && eq(Number(m[5]), bs));
    chk('산문의 공격력 행 번호가 §3.1 표의 «공격력 증가» 다', m && rowsOfName('공격력 증가').join() === m[2]);
    chk('산문의 방어력 행 번호가 §3.1 표의 «방어력 증가» 다', m && rowsOfName('방어력 증가').join() === m[4]);
    chk('산문의 광전사 행 번호가 §3.1 표의 «광전사» 다', m && rowsOfName('광전사').join() === m[6]);
  }

  /* ===== ⓔ 가시갑옷 ===== */
  say('\n=== ⓔ 가시갑옷 ↔ PERK_THORN_N/_R/_L ===');
  {
    const line = find(/^- \*\*가시갑옷\(/);
    chk('«가시갑옷» 불릿이 있다', !!line);
    const t = ['PERK_THORN_N', 'PERK_THORN_R', 'PERK_THORN_L'].map(K);
    chk('PERK_THORN_N/_R/_L 이 두 엔진에서 같다', t.every(v => v !== null));
    const m = line && line.match(/\(\+(\d+) \+(\d+) \+(\d+) = 최대 \*\*\+(\d+)%\*\*\)/);
    chk('산문의 세 배율이 PERK_THORN_N/_R/_L ×100 이다',
      m && [1, 2, 3].every(i => eq(Number(m[i]), t[i - 1] * 100)));
    chk('산문의 «최대» 가 세 배율의 가산 합이다', m && eq(Number(m[4]), t.reduce((a, b) => a + b, 0) * 100));
    const ref = line && line.match(/^- \*\*가시갑옷\(([0-9·~ ]+)번\)/);
    chk('산문이 든 가시갑옷 행 번호가 §3.1 표의 «가시갑옷» 전부다',
      ref && expandRefs(ref[1]).join() === rowsOfName('가시갑옷').join(),
      ref ? `산문 ${expandRefs(ref[1]).join('·')} / 표 ${rowsOfName('가시갑옷').join('·')}` : '-');
  }

  /* ===== ⓕ 번개 · 창 ===== */
  say('\n=== ⓕ 번개 회당 계수 · 창 데미지/관통 ↔ R_BOLT · R_SPEAR · SPEAR_PIERCE ===');
  {
    const line = find(/^- \*\*보이는 적 전부\(/);
    chk('«보이는 적 전부» 불릿이 있다', !!line);
    const bolt = K('R_BOLT');
    chk('R_BOLT 가 두 엔진에서 같다', bolt !== null);
    chk('산문의 «회당 공격력 N%» 가 R_BOLT ×100 이다', eq(num(line, /회당 공격력 \*\*(\d+)%\*\*/), bolt * 100));
    const ref = line && line.match(/^- \*\*보이는 적 전부\(([0-9·~ ]+)번\)/);
    /* «보이는 적 전부에게» 라고 §3.1 표가 직접 적은 행 = 정본 */
    const want = [];
    for (const l of planSrc.split('\n')) {
      const m = l.match(/^\|\s*(\d+)\s*\|\s*p_[A-Za-z]+\s*\|/);
      if (m && /보이는 적 전부/.test(l)) want.push(Number(m[1]));
    }
    chk('산문이 든 행 번호가 §3.1 표에서 «보이는 적 전부» 라고 적힌 행 전부다',
      ref && expandRefs(ref[1]).join() === want.join(),
      ref ? `산문 ${expandRefs(ref[1]).join('·')} / 표 ${want.join('·')}` : '-');

    const sp = find(/^- \*\*창의 화신/);
    chk('«창의 화신» 불릿이 있다', !!sp);
    const rsp = K('R_SPEAR'), pierce = K('SPEAR_PIERCE');
    chk('R_SPEAR·SPEAR_PIERCE 가 두 엔진에서 같다', rsp !== null && pierce !== null);
    chk('산문의 «창 데미지 N%» 가 R_SPEAR ×100 이다', eq(num(sp, /창 데미지 (\d+)%/), rsp * 100));
    chk('산문의 «M마리 관통» 이 SPEAR_PIERCE 다', eq(num(sp, /·(\d+)마리 관통/), pierce));
    /* «전설 N» = 전설 등급 안에서 몇 번째인가 */
    const leg = rows.filter(r => r.g === '전설').map(r => r.n);
    const idx = rowsOfName('창의 화신')[0];
    chk('산문의 «전설 N» 이 §3.1 표에서 창의 화신이 전설 몇 번째인가와 같다',
      eq(num(sp, /\*\*창의 화신 \(전설 (\d+)\)\*\*/), leg.indexOf(idx) + 1),
      `표 ${leg.indexOf(idx) + 1}번째`);
  }

  /* ===== ⓖ 귀족의 눈 재정규화 ===== */
  say('\n=== ⓖ 귀족의 눈 62.5 / 37.5 ↔ PERK_GRADE_RATE 재정규화 ===');
  {
    const line = find(/^- \*\*귀족의 눈\(/);
    chk('«귀족의 눈» 불릿이 있다', !!line);
    const rate = arrOf(simSrc, 'PERK_GRADE_RATE');
    const tot = rate ? rate[1] + rate[2] : 0;
    const m = line && line.match(/희귀 \*\*([0-9.]+)%\*\* · 전설 \*\*([0-9.]+)%\*\* 로 재정규화 = (\d+):(\d+)/);
    chk('산문의 희귀 재정규화값이 rate[1]/(rate[1]+rate[2]) 다',
      m && rate && eq(Number(m[1]), Math.round(rate[1] / tot * 1000) / 10));
    chk('산문의 전설 재정규화값이 rate[2]/(rate[1]+rate[2]) 다',
      m && rate && eq(Number(m[2]), Math.round(rate[2] / tot * 1000) / 10));
    chk('산문의 «= A:B» 가 PERK_GRADE_RATE 희귀:전설이다',
      m && rate && Number(m[3]) === rate[1] && Number(m[4]) === rate[2]);
    chk('두 재정규화값의 합이 100 이다', m && Math.abs(Number(m[1]) + Number(m[2]) - 100) < 0.05);
    chk('산문이 든 귀족의 눈 행 번호가 §3.1 표와 같다',
      line && (line.match(/^- \*\*귀족의 눈\((\d+)번\)/) || [])[1] === String(rowsOfName('귀족의 눈')[0]));
  }

  /* ===== ⓗ 나머지 행 번호 참조 ===== */
  say('\n=== ⓗ 산문의 특전 행 번호 참조 ↔ §3.1 표 실제 행 ===');
  {
    const ov = find(/^- \*\*오버킬 회복\(/);
    chk('«오버킬 회복» 불릿이 있다', !!ov);
    chk('산문의 오버킬 회복 행 번호가 §3.1 표와 같다',
      ov && (ov.match(/^- \*\*오버킬 회복\((\d+)번\)/) || [])[1] === String(rowsOfName('오버킬 회복')[0]));
    chk('오버킬 산문이 든 «회복 증폭(N번)» 이 §3.1 표의 «회복 증폭» 이다',
      ov && (ov.match(/회복 증폭\((\d+)번\)/) || [])[1] === String(rowsOfName('회복 증폭')[0]));
    const bs = find(/^- \*\*광전사\(/);
    chk('«광전사» 불릿이 있다', !!bs);
    chk('산문의 광전사 행 번호가 §3.1 표와 같다',
      bs && (bs.match(/^- \*\*광전사\((\d+)번\)/) || [])[1] === String(rowsOfName('광전사')[0]));
    /* 광전사 산문이 든 «치확 +N 특전» 은 PERK_CRITR_A 다 */
    chk('광전사 산문의 «치확 +N 특전» 이 PERK_CRITR_A 와 같다', eq(num(bs, /치확 \+(\d+) 특전/), K('PERK_CRITR_A')));
    /* 처치 시 트리거 — §3.1 표에서 이름이 «처치 시 …» 인 행 전부 */
    const kl = find(/^- \*\*처치 시 트리거\(/);
    chk('«처치 시 트리거» 불릿이 있다', !!kl);
    const want = rows.filter(r => /^처치 시/.test(r.nm)).map(r => r.n);
    const ref = kl && kl.match(/^- \*\*처치 시 트리거\(([0-9·~ ]+)\)\*\*/);
    chk('산문이 든 처치 시 트리거 행 번호가 §3.1 표의 «처치 시 …» 전부다',
      ref && expandRefs(ref[1]).join() === want.join(),
      ref ? `산문 ${expandRefs(ref[1]).length}행 / 표 ${want.length}행` : '-');
  }

  /* ===== ⓘ «엔진 상수» 문단 ===== */
  say('\n=== ⓘ «엔진 상수» 문단의 이름↔값 ↔ 두 엔진 실제 선언 ===');
  {
    const i = P.findIndex(l => l.startsWith('**엔진 상수**'));
    chk('«엔진 상수» 문단이 있다', i >= 0);
    const para = i >= 0 ? P.slice(i).join(' ') : '';
    /* `NAME 값` 쌍 전부 (배열형은 따로) */
    const pairs = [...para.matchAll(/\b([A-Z][A-Z0-9_]{3,})\s+(-?[0-9.]+)\b/g)].map(m => [m[1], Number(m[2])]);
    chk('문단에서 «이름 값» 쌍을 하나 이상 읽었다', pairs.length > 0, `${pairs.length}쌍`);
    const bad = [];
    for (const [k, v] of pairs) {
      const s = constOf(simSrc, k), h = constOf(htmSrc, k);
      if (s === null || h === null) { bad.push(`${k}(엔진에 없음)`); continue; }
      if (s !== h) { bad.push(`${k}(sim ${s} / game ${h} — 두 엔진이 갈라짐)`); continue; }
      if (!eq(v, s)) bad.push(`${k}(문단 ${v} / 엔진 ${s})`);
    }
    chk(`«엔진 상수» 문단의 ${pairs.length}쌍이 두 엔진 실제 값과 전부 같다`, bad.length === 0, bad.join(' · ') || `${pairs.length}쌍`);
    /* 배열 상수 — PERK_GRADE_RATE [a,b,c] */
    const am = para.match(/PERK_GRADE_RATE \[([0-9,]+)\]/);
    const rate = arrOf(simSrc, 'PERK_GRADE_RATE');
    chk('문단의 PERK_GRADE_RATE 배열이 엔진과 같다',
      am && rate && am[1].split(',').map(Number).join() === rate.join(),
      am ? `문단 [${am[1]}] / 엔진 [${rate}]` : '-');
    /* T155 로 새로 생긴 두 상수가 문단에 등재됐는가 (문단이 «두 엔진 같은 이름·같은 값» 이라고 약속한다) */
    for (const k of ['PERK_EVHEAL_R', 'PERK_EVHEAL_L'])
      chk(`⚑ T155 신설 ${k} 이 «엔진 상수» 문단에 등재돼 있다`, new RegExp('\\b' + k + '\\s').test(para));
  }

  return R;
}

/* ================================================================ */
const simSrc = rd('sim.js');
const htmSrc = rd('index.html');
const planSrc = rd('PLAN.md');

if (!process.argv.includes('--self')) {
  console.log('=== ⚑ T157 게이트 — PLAN §3.1 «표 밖 산문» ↔ 엔진 상수 대조 ===');
  const res = run(simSrc, htmSrc, planSrc, false);
  for (const r of res) console.log(`  ${r.c ? '✓' : '✗'} ${r.n}`);
  const pass = res.filter(r => r.c).length;
  console.log(`\n [PLAN §3.1 산문 게이트] 대조 ${res.length}항목 · 통과 ${pass} · 불합격 ${res.length - pass} → ${pass === res.length ? '통과' : '불합격'}`);
  process.exit(pass === res.length ? 0 : 1);
}

/* ── 음성 검사 — 일부러 깨뜨린 사본이 전부 빨개지는지 (no-op 도 불합격) ── */
const green = src => { const r = run(src[0], src[1], src[2], true); return r.every(x => x.c); };
if (!green([simSrc, htmSrc, planSrc])) {
  console.log('  ✗ 원본이 이미 빨갛다 — 음성 검사 전에 본 게이트부터 볼 것');
  process.exit(1);
}
const CASES = [
  ['산문 회복량을 12 → 6 으로 되돌리면', null, null, s => s.replace('회복량 **12%** 는', '회복량 **6%** 는')],
  ['산문 II 확률을 66 → 15 로 되돌리면', null, null, s => s.replace('II 66% · III 100%', 'II 15% · III 100%')],
  ['산문에서 «실드는 안 채움» 을 뒤집으면', null, null, s => s.replace('**실드는 안 채움**', '**실드도 채움**')],
  /* ⚑ 앵커는 «산문 쪽 그 줄» 만 집어야 한다 — 짧게 잡으면 §3.1 **표**(1·67·79행)의 같은 문구가 먼저 걸려
     사본이 산문은 그대로인 채 표만 바뀐다(실제로 이 세 건이 처음에 «초록 = 구멍» 으로 보였다). */
  ['산문에서 «회복 증폭 적용» 을 지우면', null, null,
    s => s.replace('버림 · **실드는 안 채움** · **회복 증폭 적용**', '버림 · **실드는 안 채움** · **회복 증폭 미적용**')],
  ['산문에서 «각각 독립 굴림» 을 지우면', null, null, s => s.replace('**각각 독립 굴림**', '한 번만 굴림')],
  ['확률형 증가폭을 +8 → +25 로 흔들면', null, null, s => s.replace('은 **+8**(기본 0 → 8)', '은 **+25**(기본 0 → 25)')],
  ['확률형 기본치를 0 → 20 으로 흔들면', null, null, s => s.replace('**+8**(기본 0 → 8)', '**+8**(기본 20 → 28)')],
  ['치피 증가폭을 +30 → +50 으로 되돌리면', null, null, s => s.replace('치명타 피해는 **+30**(기본 150 → 180)', '치명타 피해는 **+50**(기본 150 → 200)')],
  ['치피 합을 틀리게 적으면 (150 + 30 ≠ 190)', null, null, s => s.replace('(기본 150 → 180)', '(기본 150 → 190)')],
  ['공격력 곱연산을 +15 → +20 으로 되돌리면', null, null, s => s.replace('- 공격력 +15%(2번)', '- 공격력 +20%(2번)')],
  ['방어력 곱연산을 +8 → +10 으로 되돌리면', null, null, s => s.replace('방어력 +8%(10번)', '방어력 +10%(10번)')],
  ['광전사 배수를 ×3 → ×5 로 흔들면', null, null, s => s.replace('광전사 ×3(77번)', '광전사 ×5(77번)')],
  ['광전사 행 번호를 옛 29 로 되돌리면', null, null, s => s.replace('광전사 ×3(77번)', '광전사 ×3(29번)')],
  ['가시갑옷 행 번호를 옛 15·19·32 로 되돌리면', null, null, s => s.replace('**가시갑옷(15·43·80번)**', '**가시갑옷(15·19·32번)**')],
  ['처치 시 트리거 목록에서 한 행을 빼면', null, null, s => s.replace('11~14 · 16 · 19~21', '11~14 · 16 · 19~20')],
  ['보이는 적 전부 목록을 옛 12·21·25 로 되돌리면', null, null, s => s.replace('**보이는 적 전부(12·45·73·90번)**', '**보이는 적 전부(12·21·25번)**')],
  ['오버킬 행 번호를 옛 26 으로 되돌리면', null, null, s => s.replace('**오버킬 회복(74번)**', '**오버킬 회복(26번)**')],
  ['회복 증폭 행 번호를 옛 18 로 되돌리면', null, null, s => s.replace('회복 증폭(42번)', '회복 증폭(18번)')],
  ['귀족의 눈 행 번호를 옛 30 으로 되돌리면', null, null, s => s.replace('**귀족의 눈(78번)**', '**귀족의 눈(30번)**')],
  ['귀족의 눈 재정규화를 62.5 → 60 으로 흔들면', null, null, s => s.replace('희귀 **62.5%**', '희귀 **60%**')],
  ['번개 회당 계수를 75 → 50 으로 흔들면', null, null, s => s.replace('회당 공격력 **75%**', '회당 공격력 **50%**')],
  ['창 데미지를 100 → 130 으로 흔들면', null, null,
    s => s.replace('\n  창 데미지 100%·8마리 관통 그대로.', '\n  창 데미지 130%·8마리 관통 그대로.')],
  ['창 관통을 8 → 6 으로 흔들면', null, null,
    s => s.replace('\n  창 데미지 100%·8마리 관통 그대로.', '\n  창 데미지 100%·6마리 관통 그대로.')],
  ['창의 화신의 «전설 8» 을 «전설 9» 로 흔들면', null, null, s => s.replace('**창의 화신 (전설 8)**', '**창의 화신 (전설 9)**')],
  ['등급별 개수 일반 39 → 38 로 흔들면', null, null, s => s.replace('일반 **39** · 희귀 **32**', '일반 **38** · 희귀 **32**')],
  ['풀 100 → 99 로 되돌리면', null, null, s => s.replace('= 풀 **100**', '= 풀 **99**')],
  ['카드 등급 굴림을 60/25/15 → 40/35/25 로 흔들면', null, null, s => s.replace('카드 등급 굴림 **60 / 25 / 15**', '카드 등급 굴림 **40 / 35 / 25**')],
  ['«엔진 상수» 문단의 PERK_ATK_M 을 옛 1.20 으로 되돌리면', null, null, s => s.replace('PERK_ATK_M 1.15', 'PERK_ATK_M 1.20')],
  ['«엔진 상수» 문단의 PERK_CRITF_A 를 옛 50 으로 되돌리면', null, null, s => s.replace('PERK_CRITF_A 30', 'PERK_CRITF_A 50')],
  ['«엔진 상수» 문단의 PERK_EVHEAL_F 를 옛 0.06 으로 되돌리면', null, null, s => s.replace('PERK_EVHEAL_F 0.12', 'PERK_EVHEAL_F 0.06')],
  ['«엔진 상수» 문단에서 T155 신설 PERK_EVHEAL_L 을 빼면', null, null, s => s.replace(' · PERK_EVHEAL_L 1.00', '')],
  ['«엔진 상수» 문단의 PERK_GRADE_RATE 배열을 흔들면', null, null, s => s.replace('PERK_GRADE_RATE [60,25,15]', 'PERK_GRADE_RATE [50,30,20]')],
  ['«엔진 상수» 문단에 없는 이름을 적으면', null, null, s => s.replace('PERK_AMP 1.00', 'PERK_NOPE 1.00')],
  /* 엔진 쪽을 흔들어도 잡는가 — 산문은 그대로인데 상수만 움직이는 경우 */
  ['sim.js 의 PERK_EVHEAL_F 만 0.06 으로 되돌리면 (산문은 12% 그대로)',
    s => s.replace('PERK_EVHEAL_F=0.12', 'PERK_EVHEAL_F=0.06'), null, null],
  ['index.html 의 PERK_EVHEAL_R 만 0.15 로 되돌리면 (두 엔진이 갈라진다)',
    null, s => s.replace('PERK_EVHEAL_R=0.66', 'PERK_EVHEAL_R=0.15'), null],
  ['sim.js 의 회피 회복을 noBoost 로 되돌리면',
    s => s.replace('if(px.p_evadeHeal&&pkk(p,PERK_EVHEAL_CH))heal(p,p.maxHp*PERK_EVHEAL_F);',
      'if(px.p_evadeHeal&&pkk(p,PERK_EVHEAL_CH))heal(p,p.maxHp*PERK_EVHEAL_F,true);'), null, null],
  ['index.html 의 전설 III 발동부를 떼면',
    null, s => s.replace('if(px.p_evHealL&&pkk(p,PERK_EVHEAL_L)){ heal(p,p.maxHp*PERK_EVHEAL_F);', 'if(0){ '), null],
  ['sim.js 의 R_BOLT 를 0.50 으로 흔들면 (산문은 75% 그대로)',
    s => s.replace('R_BOLT=0.75', 'R_BOLT=0.50'), null, null],
  ['sim.js 의 SPEAR_PIERCE 를 6 으로 흔들면', s => s.replace('SPEAR_PIERCE=8', 'SPEAR_PIERCE=6'), null, null],
  ['sim.js 의 TUNE.pCritF0 를 200 으로 흔들면', s => s.replace('pCritF0:150', 'pCritF0:200'), null, null],
  ['index.html 의 PERK_GRADE_RATE 만 흔들면 (두 엔진이 갈라진다)',
    null, s => s.replace('PERK_GRADE_RATE=[60,25,15]', 'PERK_GRADE_RATE=[50,30,20]'), null],
  ['§3.1 표에서 전설 «회피 시 회복 III» 행을 지우면 (풀 100 ≠ 표 행 수)',
    null, null, s => s.replace(/\n\| 100 \| p_evHealL \|[^\n]*/, '')],
];
let ok = 0, noop = 0;
console.log('=== ⚑ T157 게이트 음성 검사 (심은 고장이 전부 빨개지는가) ===');
for (const [nm, fs_, fh, fp] of CASES) {
  const s = fs_ ? fs_(simSrc) : simSrc;
  const h = fh ? fh(htmSrc) : htmSrc;
  const p = fp ? fp(planSrc) : planSrc;
  if (s === simSrc && h === htmSrc && p === planSrc) { console.log(`  ✗ ${nm} → **no-op** (치환이 안 먹었다)`); noop++; continue; }
  const red = !green([s, h, p]);
  console.log(`  ${red ? '✓' : '✗'} ${nm} → ${red ? '빨개진다' : '**초록이다 (구멍)**'}`);
  if (red) ok++;
}
console.log(`\n[음성 검사] ${ok}/${CASES.length} · no-op ${noop} · 오탐 0`);
process.exit(ok === CASES.length && noop === 0 ? 0 : 1);
