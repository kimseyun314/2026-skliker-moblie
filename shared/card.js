/* 선수카드 · 포지션 맵 · 아바타 렌더링 (HTML 문자열 반환)
 * 카드 디자인은 Design 시안 "SK라이커 선수 카드 시안"(검정 + 라임, Anton/Oswald)을 따라요. */
(function () {
  'use strict';
  const T = () => SKL.TYPES;
  const LIME = '#E4F218';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /** 원형 엠블럼 (카드 오른쪽 위와 같은 모양) */
  function emblem() {
    return `<div class="skl-emblem"><b>FC LIKER</b><i>SL</i><small>FUTSAL CLUB</small></div>`;
  }

  const SILHOUETTE = `<svg viewBox="0 0 300 380" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax meet">
<circle cx="150" cy="118" r="62" fill="#C9CCD2"/><path d="M20 380 C 25 262, 85 208, 150 208 C 215 208, 275 262, 280 380 Z" fill="#C9CCD2"/></svg>`;

  /** 원형 아바타: 사진이 있으면 사진, 없으면 등번호 */
  function avatar(p, cls = '') {
    if (p.photo) return `<span class="skl-av ${cls}" style="background-image:url('${p.photo}')"></span>`;
    return `<span class="skl-av ${cls}"><b>${esc(p.number === '' || p.number == null ? (p.nickname || '?').slice(0, 1) : p.number)}</b></span>`;
  }

  /** 디스플레이 서체(Anton)에는 한글이 없어서, 한글 부분만 굵은 고딕으로 감싸요 */
  const disp = (s) => esc(s).replace(/([\u3131-\u318E\uAC00-\uD7A3]+(?:\s+[\u3131-\u318E\uAC00-\uD7A3]+)*)/g, '<span class="ko">$1</span>');
  const bigName = (p) => disp(p.nameEn || p.nickname);
  const subName = (p) => (p.nameEn ? esc(p.nickname) : '');
  const season = (meta) => esc((meta && meta.season) || 2026);

  function cardFront(p, meta) {
    const t = T()[p.type];
    const photo = p.photo
      ? `<img class="cf-img" src="${p.photo}" alt="">`
      : `<div class="cf-sil">${SILHOUETTE}</div>`;
    return `<div class="skl-card cf">
  <div class="cf-in">
    <div class="cf-lime"></div>
    <div class="cf-top chrome">${photo}
      <div class="cf-circ cf-type"><small>TYPE</small><b>${t.ko}</b></div>
      <div class="cf-circ cf-emb">${emblem()}</div>
    </div>
    <div class="cf-numwrap">
      <div class="cf-num"><span class="sh" aria-hidden="true">${esc(p.number)}</span><span class="fg">${esc(p.number)}</span></div>
      <div class="cf-pos"><b>${p.type}</b><i></i><span>${esc(p.subtype)}</span></div>
    </div>
    <div class="cf-bottom">
      <div class="cf-name">${bigName(p)}</div>
      ${subName(p) ? `<div class="cf-nick">${subName(p)}</div>` : ''}
      <div class="cf-foot"><span>SK LIKER FUTSAL CLUB · ${season(meta)} SEASON CLOSING</span><b>NO. ${esc(p.number)}</b></div>
    </div>
  </div>
</div>`;
  }

  function radar(p) {
    const k = (v) => v / 100;
    const r = [p.aff.PIVO, p.aff.ALA, p.aff.FIXO, p.aff.GOLEIRO];
    const pts = [`130,${113 - 89 * k(r[0])}`, `${130 + 70 * k(r[1])},113`, `130,${113 + 89 * k(r[2])}`, `${130 - 70 * k(r[3])},113`].join(' ');
    return `<svg viewBox="0 0 260 226" class="cb-radar" role="img" aria-label="능력치 돌파력 ${r[0]}, 활동력 ${r[1]}, 조율력 ${r[2]}, 수호력 ${r[3]}">
<polygon points="130,24 200,113 130,202 60,113" fill="none" stroke="#3A3A3A"/>
<polygon points="130,46 182.5,113 130,180 77.5,113" fill="none" stroke="#2E2E2E"/>
<polygon points="130,68.5 165,113 130,157.5 95,113" fill="none" stroke="#2E2E2E"/>
<line x1="130" y1="24" x2="130" y2="202" stroke="#2E2E2E"/><line x1="60" y1="113" x2="200" y2="113" stroke="#2E2E2E"/>
<polygon points="${pts}" fill="rgba(228,242,24,.28)" stroke="${LIME}" stroke-width="2.5"/>
<text x="130" y="15" fill="#fff" font-size="16" font-weight="700" text-anchor="middle">돌파력 ${r[0]}</text>
<text x="258" y="105" fill="#fff" font-size="16" font-weight="700" text-anchor="end">활동력</text>
<text x="258" y="129" fill="#fff" font-size="19" text-anchor="end" font-family="Anton, sans-serif">${r[1]}</text>
<text x="130" y="223" fill="#fff" font-size="16" font-weight="700" text-anchor="middle">조율력 ${r[2]}</text>
<text x="2" y="105" fill="#fff" font-size="16" font-weight="700">수호력</text>
<text x="2" y="129" fill="#fff" font-size="19" font-family="Anton, sans-serif">${r[3]}</text></svg>`;
  }

  /** 카드 뒷면 03 POSITION 박스 (기준선 + 내 사분면 강조) */
  function miniPos(p, meta) {
    const { mx, my } = SKL.medians(meta);
    const px = (v) => 4 + (v / 18) * 92, py = (v) => 4 + ((18 - v) / 18) * 92;
    const qx = px(mx), qy = py(my);
    const quad = { PIVO: `left:${qx}%;right:0;top:0;height:${qy}%`, GOLEIRO: `left:0;width:${qx}%;top:0;height:${qy}%`, ALA: `left:${qx}%;right:0;top:${qy}%;bottom:0`, FIXO: `left:0;width:${qx}%;top:${qy}%;bottom:0` }[p.type];
    const lab = (k, pos) => `<div class="mp-l" style="${pos};color:${p.type === k ? LIME : '#6E6E6E'}">${k}</div>`;
    return `<div class="mp"><div class="mp-q" style="${quad}"></div>
<div class="mp-v" style="left:${qx}%"></div><div class="mp-h" style="top:${qy}%"></div>
${lab('GOLEIRO', 'top:7px;left:9px')}${lab('PIVO', 'top:7px;right:9px')}${lab('FIXO', 'bottom:7px;left:9px')}${lab('ALA', 'bottom:7px;right:9px')}
<div class="mp-dot" style="left:${px(p.x)}%;top:${py(p.y)}%"></div></div>`;
  }

  function cardBack(p, meta, teams, players, qrSrc) {
    const t = T()[p.type];
    return `<div class="skl-card cb">
  <div class="cb-in">
    <div class="cb-head"><div class="cb-no">${esc(p.number)}</div><div class="cb-name">${bigName(p)}</div><div class="cb-club">SK LIKER FUTSAL CLUB<br>${season(meta)} SEASON CLOSING</div></div>
    <div class="cb-body">
      <div class="cb-box">
        <div class="cb-k">01  TYPE</div>
        <div class="cb-type"><span class="cb-badge">${p.type}</span><b>${esc(p.subtype)}</b></div>
        <div class="cb-line">“${t.line}”</div>
        <div class="cb-persona">${t.persona}</div>
        <div class="cb-tags">${p.tags.map((g) => `<span>${esc(g)}</span>`).join('')}</div>
      </div>
      <div class="cb-grid">
        <div class="cb-box"><div class="cb-k">02  ABILITY</div>${radar(p)}</div>
        <div class="cb-box cb-pos"><div class="cb-k">03  POSITION</div>${miniPos(p, meta)}
          <div class="cb-xy"><div><span>과감 →</span><b>${p.x}</b><small>/18</small></div><div><span>해결 ↑</span><b>${p.y}</b><small>/18</small></div></div></div>
      </div>
      <div class="cb-box cb-hl">
        <div><div class="cb-k">04  ${season(meta)} HIGHLIGHT</div><div class="cb-moment">${esc(p.moment || '')}</div></div>
        ${qrSrc ? `<img class="cb-qr" src="${qrSrc}" alt="QR">` : ''}
      </div>
    </div>
  </div>
</div>`;
  }

  /**
   * 포지션 맵 SVG (모바일용). 가로 = 과감, 세로 = 해결 (0~18), 점선 = 기준선
   * opts: { me, size, mode:'type'|'team', teams, meta }
   */
  function mapSVG(players, opts = {}) {
    const size = opts.size || 340;
    const pad = 14, s = size - pad * 2;
    const { mx, my } = SKL.medians(opts.meta);
    const X = (v) => pad + (0.06 + (v / 18) * 0.88) * s;
    const Y = (v) => pad + (0.06 + ((18 - v) / 18) * 0.88) * s;
    const g = [`<svg viewBox="0 0 ${size} ${size}" width="100%" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;display:block;font-family:'Noto Sans KR',sans-serif">`];
    g.push(`<rect x="${pad}" y="${pad}" width="${s}" height="${s}" fill="#141414" stroke="#2E2E2E"/>`);
    for (let i = 1; i < 6; i++) {
      const v = pad + (s * i) / 6;
      g.push(`<line x1="${v}" y1="${pad}" x2="${v}" y2="${pad + s}" stroke="#1F1F1F"/><line x1="${pad}" y1="${v}" x2="${pad + s}" y2="${v}" stroke="#1F1F1F"/>`);
    }
    const me = opts.me;
    const qx = X(mx), qy = Y(my);
    if (me && opts.mode !== 'team') {
      const r = { PIVO: [qx, pad, pad + s - qx, qy - pad], GOLEIRO: [pad, pad, qx - pad, qy - pad], ALA: [qx, qy, pad + s - qx, pad + s - qy], FIXO: [pad, qy, qx - pad, pad + s - qy] }[me.type];
      g.push(`<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" fill="${LIME}" opacity=".08"/>`);
    }
    g.push(`<line x1="${qx}" y1="${pad}" x2="${qx}" y2="${pad + s}" stroke="#6E6E6E" stroke-dasharray="4 4"/>`);
    g.push(`<line x1="${pad}" y1="${qy}" x2="${pad + s}" y2="${qy}" stroke="#6E6E6E" stroke-dasharray="4 4"/>`);
    const lab = (k, x, y, anchor) => g.push(`<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Oswald, sans-serif" font-size="12" font-weight="700" letter-spacing="1.5" fill="${opts.mode === 'team' ? '#6E6E6E' : T()[k].color}" opacity="${me && me.type !== k && opts.mode !== 'team' ? 0.55 : 1}">${k}</text>`);
    lab('GOLEIRO', pad + 8, pad + 18, 'start'); lab('PIVO', pad + s - 8, pad + 18, 'end');
    lab('FIXO', pad + 8, pad + s - 8, 'start'); lab('ALA', pad + s - 8, pad + s - 8, 'end');

    const seen = {};
    const ordered = players.filter((p) => !me || p.id !== me.id).concat(me ? [players.find((p) => p.id === me.id) || me] : []);
    for (const p of ordered) {
      const key = p.x + ',' + p.y;
      const k = seen[key] = (seen[key] || 0) + 1;
      let cx = X(p.x), cy = Y(p.y);
      if (k > 1) { const a = k * 2.1; cx += Math.cos(a) * 15; cy += Math.sin(a) * 15; }
      const col = opts.mode === 'team' && opts.teams && opts.teams[p.team] ? opts.teams[p.team].color : T()[p.type].color;
      const isMe = me && p.id === me.id;
      if (isMe) {
        g.push(`<circle cx="${cx}" cy="${cy}" r="26" fill="${LIME}" opacity=".18"><animate attributeName="r" values="18;30;18" dur="2s" repeatCount="indefinite"/></circle>`);
        g.push(`<circle cx="${cx}" cy="${cy}" r="11" fill="${LIME}" stroke="#111" stroke-width="3"/>`);
        const w = 22 + String(p.nickname).length * 13;
        g.push(`<g transform="translate(${Math.max(pad, Math.min(pad + s - w, cx - w / 2))},${cy - 44})"><rect width="${w}" height="22" fill="${LIME}"/><text x="${w / 2}" y="15.5" text-anchor="middle" font-size="12" font-weight="900" fill="#111">나 · ${esc(p.nickname)}</text></g>`);
      } else {
        g.push(`<circle cx="${cx}" cy="${cy}" r="8" fill="${col}" stroke="#111" stroke-width="2"/>`);
        g.push(`<text x="${cx}" y="${cy + 21}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#BDBDBD">${esc(p.nickname)}</text>`);
      }
    }
    g.push('</svg>');
    return g.join('');
  }

  window.SKLView = { esc, disp, emblem, avatar, cardFront, cardBack, mapSVG, LIME };
})();
