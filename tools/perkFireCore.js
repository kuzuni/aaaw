/* T84 (P2) — 특전 «실제 발동» 계측기 (공용 코어)
 *
 * `verifyPerkFire.js`(sim.js 축)와 `verifyPerkFireHtml.js`(index.html 축)가 같이 쓴다.
 * 원본 파일은 절대 건드리지 않는다 — 소스 문자열을 받아 계측본 문자열을 돌려줄 뿐이다.
 *
 * 계측의 뜻: `if( … px.<특전id> … ) <효과>` 의 **효과 자리 맨 앞**에 `__F` 를 꽂는다.
 * 조건이 통째로 참일 때만 불리므로 «px 를 읽었다» 가 아니라 «효과가 실행됐다» 를 센다.
 * 조건 안에 id 가 여럿이면 그중 px 값이 참인 것만 기록한다.
 */
'use strict';

/* 문자열·주석 밖의 «코드» 위치만 1 인 마스크. 두 엔진 다 정규식 리터럴을 안 쓴다(호출부가 확인한다). */
function codeMask(s) {
  const m = new Uint8Array(s.length);
  let i = 0;
  while (i < s.length) {
    const c = s[i], d = s[i + 1];
    if (c === '/' && d === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < s.length) { if (s[i] === '\\') { i += 2; continue; } if (s[i] === q) { i++; break; } i++; }
      continue;
    }
    m[i] = 1; i++;
  }
  return m;
}

function lineIndex(src) {
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') starts.push(i + 1);
  return pos => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; } return lo + 1; };
}

/* 문(statement) 하나의 끝 — 깊이 0 의 `;` 또는 블록의 닫는 `}` */
function stmtEnd(s, mask, i) {
  let dp = 0, db = 0, dk = 0;
  while (i < s.length) {
    if (!mask[i]) { i++; continue; }
    const c = s[i];
    if (c === '(') dp++; else if (c === ')') dp--;
    else if (c === '[') dk++; else if (c === ']') dk--;
    else if (c === '{') db++; else if (c === '}') { db--; if (db === 0) return i + 1; if (db < 0) return i; }
    else if (c === ';' && dp === 0 && db === 0 && dk === 0) return i + 1;
    i++;
  }
  return i;
}

/* src 안의 모든 `if( … px.<id> … )` 를 찾아 효과 자리에 __F 를 꽂는다.
   ifSkip 에 걸리는 조건은 건너뛴다(바깥 관문·뒤집힌 조건 — 호출부가 손 패치표로 따로 다룬다). */
function instrumentIfs(src, idSet, ifSkip, lineBase) {
  const mask = codeMask(src);
  const lineOf = lineIndex(src);
  const ID_RE = /(?:p\.)?px\.([a-z]_[A-Za-z0-9]+)/g;
  const edits = [], sites = [];
  for (let i = 0; i < src.length - 2; i++) {
    if (!mask[i]) continue;
    if (!(src[i] === 'i' && src[i + 1] === 'f')) continue;
    if (i > 0 && /[A-Za-z0-9_$.]/.test(src[i - 1])) continue;
    let j = i + 2; while (j < src.length && /\s/.test(src[j])) j++;
    if (src[j] !== '(') continue;
    let dp = 0, k = j;
    for (; k < src.length; k++) { if (!mask[k]) continue; if (src[k] === '(') dp++; else if (src[k] === ')') { dp--; if (dp === 0) break; } }
    const cond = src.slice(j + 1, k);
    ID_RE.lastIndex = 0;
    const found = []; let m;
    while ((m = ID_RE.exec(cond))) if (idSet.has(m[1]) && !found.some(f => f.id === m[1])) found.push({ id: m[1], expr: m[0] });
    if (!found.length) continue;
    if (ifSkip.some(sk => cond.includes(sk))) continue;
    let c = k + 1; while (c < src.length && /\s/.test(src[c])) c++;
    const site = 'L' + (lineOf(i) + (lineBase || 0));
    const call = `__F(${JSON.stringify(site)},{${found.map(f => `${f.id}:${f.expr}`).join(',')}});`;
    if (src[c] === '{') edits.push({ pos: c + 1, text: call });
    else { edits.push({ pos: c, text: '{' + call }); edits.push({ pos: stmtEnd(src, mask, c), text: '}' }); }
    for (const f of found) sites.push({ id: f.id, site });
    i = k;
  }
  edits.sort((a, b) => a.pos - b.pos);
  let out = '', last = 0;
  for (const e of edits) { out += src.slice(last, e.pos) + e.text; last = e.pos; }
  return { out: out + src.slice(last), sites };
}

/* 손 패치표 적용 — 각 원문은 소스에 정확히 1번 나와야 한다.
   0번/2번이면 «엔진이 바뀌었는데 게이트만 조용히 통과» 를 막기 위해 오류로 돌려준다. */
function applyPatches(src, patches, idSet) {
  const errs = [], sites = [];
  for (const [tag, from, to] of patches) {
    const n = src.split(from).length - 1;
    if (n !== 1) { errs.push(`패치표 «${tag}» 원문이 소스에 ${n}번 나온다 (1번이어야 한다) — 엔진이 바뀌었다면 패치표를 고칠 것`); continue; }
    src = src.replace(from, to);
    for (const id of tag.split('|')) if (!idSet || idSet.has(id)) sites.push({ id, site: 'M' });
  }
  return { out: src, errs, sites };
}

const PRELUDE = `
const __FIRED=Object.create(null), __FSITE=Object.create(null);
function __F(site,obj){ for(const k in obj){ if(!obj[k])continue; __FIRED[k]=(__FIRED[k]||0)+1; (__FSITE[k]||(__FSITE[k]=new Set())).add(site); } }
`;

module.exports = { codeMask, lineIndex, stmtEnd, instrumentIfs, applyPatches, PRELUDE };
