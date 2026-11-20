/* 선수카드 · 포지션 맵 · 아바타 렌더링 (HTML 문자열 반환) */
(function () {
  'use strict';
  const T = () => SKL.TYPES;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function emblem(meta) {
    const club = esc((meta && meta.club) || 'SK라이커');
    const season = esc((meta && meta.season) || '2026');
    return `<svg viewBox="0 0 100 118" xmlns="http://www.w3.org/2000/svg" class="skl-emblem">
<path d="M50 3 L95 15 L95 58 C95 88 72 106 50 115 C28 106 5 88 5 58 L5 15 Z" fill="#fff" stroke="#3B1466" stroke-width="5"/>
<path d="M50 12 L86 22 L86 57 C86 81 68 96 50 104 C32 96 14 81 14 57 L14 22 Z" fill="#3B1466"/>
<text x="50" y="40" text-anchor="middle" font-size="14.5" font-weight="900" fill="#fff" letter-spacing="-0.5">${club}</text>
<circle cx="50" cy="66" r="16" fill="#fff"/><path d="M50 56 l7 5 -3 8 h-8 l-3 -8 z" fill="#3B1466"/>
<text x="50" y="96" text-anchor="middle" font-size="9" font-weight="700" fill="#C9A7F5" letter-spacing="1">${season}</text></svg>`;
  }

  const SILHOUETTE = `<svg viewBox="0 0 300 380" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax meet">
<defs><linearGradient id="sklsg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9C3D3"/><stop offset="1" stop-color="#9D93AE"/></linearGradient></defs>
<circle cx="150" cy="110" r="62" fill="url(#sklsg)"/><path d="M20 380 C 25 255, 85 200, 150 200 C 215 200, 275 255, 280 380 Z" fill="url(#sklsg)"/></svg>`;

  /** 원형 아바타 (사진 있으면 사진, 없으면 이모지) */
  function avatar(p, cls = '') {
    if (p.photo) return `<span class="skl-av ${cls}" style="background-image:url('${p.photo}')"></span>`;
    return `<span class="skl-av ${cls}"><b>${esc(p.emoji || '⚽')}</b></span>`;
  }

  function cardFront(p, meta) {
    const t = T()[p.type];
    const photo = p.photo
      ? `<div class="cf-photo-img" style="background-image:url('${p.photo}')"></div>`
      : `<div class="cf-photo">${SILHOUETTE}</div>`;
    return `<div class="skl-card cf" style="--accent:${t.color}">
  <div class="cf-tex"></div>${photo}<div class="cf-panel"></div>
  <div class="cf-stripe s1"></div><div class="cf-stripe s2"></div>
  <div class="cf-num">${esc(p.number)}</div>
  <div class="cf-season">SEASON<br>${esc((meta && meta.season) || 2026)}</div>
  <div class="cf-pos">${p.type}</div>
  <div class="cf-name">${esc(p.nickname)}</div>
  <div class="cf-alias">${t.ko} · ${t.alias}</div>
  <div class="cf-sign">${esc(p.nickname)}</div>
  <div class="cf-emb">${emblem(meta)}</div>
  <div class="cf-foot">${esc((meta && meta.club) || 'SK라이커')} · WOMEN'S FUTSAL CLUB · ${esc((meta && meta.eventEn) || 'SEASON CLOSING DAY')}</div>
</div>`;
  }

  function bar(left, right, v) {
    const w = Math.round((v / 6) * 100);
    return `<div class="cb-bar"><span>${left}</span><div class="cb-track"><div class="cb-fill" style="width:${w}%"></div><div class="cb-knob" style="left:${w}%"></div></div><span class="r">${right}</span></div>`;
  }

  function cardBack(p, meta, teams, players, qrSrc) {
    const t = T()[p.type];
    const team = teams[p.team] || null;
    const chips = t.kw.map((k) => `<span class="cb-chip">#${k}</span>`).join('');
    return `<div class="skl-card cb" style="--accent:${t.color}">
  <div class="cb-head"><div><div class="cb-k">PLAYER PROFILE</div><div class="cb-n">${esc(p.emoji || '')} ${esc(p.nickname)} <span>#${esc(p.number)}</span></div></div><div class="cb-badge">${p.type}</div></div>
  <div class="cb-type">${t.ko} <em>${t.alias}</em></div>
  <div class="cb-mid">
    <div class="cb-map">${mapSVG(players, { me: p, size: 210, small: true })}<div class="cb-cap">${esc((meta && meta.season) || 2026)} 포지션 맵 속 나의 위치</div></div>
    <div class="cb-bars">${bar('신중', '과감', p.x)}${bar('연결', '해결', p.y)}<div class="cb-chips">${chips}</div></div>
  </div>
  <div class="cb-moment"><div class="cb-mk">${esc((meta && meta.season) || 2026)} BEST MOMENT</div>“${esc(p.moment || '')}”</div>
  <div class="cb-foot">
    <div class="cb-qr">${qrSrc ? `<img src="${qrSrc}" alt="QR">` : ''}</div>
    <div class="cb-qt"><b>SCAN ME</b><br>QR을 찍으면 전체 포지션 맵에서<br>내 위치와 우리 팀을 볼 수 있어요
      ${team ? `<div class="cb-team" style="background:${team.color}">${esc(team.name)}</div>` : ''}</div>
  </div>
</div>`;
  }

  /**
   * 4분면 포지션 맵 SVG
   * opts: { me, size, small, mode:'type'|'team', teams, labels }
   */
  function mapSVG(players, opts = {}) {
    const size = opts.size || 340;
    const small = !!opts.small;
    const pad = small ? 14 : 16;
    const s = size - pad * 2;
    const pos = (x, y) => [pad + (0.12 + (x / 6) * 0.76) * s, pad + (0.12 + ((6 - y) / 6) * 0.76) * s];
    const quads = [['GOLEIRO', 0, 0], ['PIVO', 1, 0], ['FIXO', 0, 1], ['ALA', 1, 1]];
    const g = [`<svg viewBox="0 0 ${size} ${size}" width="100%" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;display:block">`];
    for (const [t, qx, qy] of quads) {
      const col = T()[t].color;
      const gap = small ? 0 : 3;
      g.push(`<rect x="${pad + (qx * s) / 2 + gap}" y="${pad + (qy * s) / 2 + gap}" width="${s / 2 - gap * 2}" height="${s / 2 - gap * 2}" rx="${small ? 0 : 14}" fill="${col}" opacity="${small ? 0.18 : 0.13}"/>`);
      const tx = pad + (qx * s) / 2 + (qx === 0 ? (small ? 6 : 12) : s / 2 - (small ? 6 : 12));
      const ty = pad + (qy * s) / 2 + (qy === 0 ? (small ? 14 : 22) : s / 2 - (small ? 6 : 12));
      g.push(`<text x="${tx}" y="${ty}" text-anchor="${qx === 0 ? 'start' : 'end'}" font-size="${small ? 10 : 12.5}" font-weight="900" fill="${col}" letter-spacing="1">${t}</text>`);
    }
    if (small) {
      g.push(`<line x1="${pad + s / 2}" y1="${pad}" x2="${pad + s / 2}" y2="${pad + s}" stroke="#fff" stroke-opacity=".35"/>`);
      g.push(`<line x1="${pad}" y1="${pad + s / 2}" x2="${pad + s}" y2="${pad + s / 2}" stroke="#fff" stroke-opacity=".35"/>`);
    }
    // 같은 좌표 겹침 방지: 살짝 퍼뜨리기
    const seen = {};
    const me = opts.me;
    const ordered = players.filter((p) => !me || p.id !== me.id).concat(me ? [players.find((p) => p.id === me.id) || me] : []);
    for (const p of ordered) {
      const key = p.x + ',' + p.y;
      const k = seen[key] = (seen[key] || 0) + 1;
      let [cx, cy] = pos(p.x, p.y);
      if (k > 1) { const a = k * 2.1; cx += Math.cos(a) * (small ? 7 : 16); cy += Math.sin(a) * (small ? 7 : 16); }
      const col = opts.mode === 'team' && opts.teams && opts.teams[p.team] ? opts.teams[p.team].color : T()[p.type].color;
      const isMe = me && p.id === me.id;
      if (small) {
        if (isMe) g.push(`<circle cx="${cx}" cy="${cy}" r="12" fill="${col}" opacity=".35"/><circle cx="${cx}" cy="${cy}" r="6.5" fill="${col}" stroke="#fff" stroke-width="2"/>`);
        else g.push(`<circle cx="${cx}" cy="${cy}" r="4" fill="#fff" opacity=".5"/>`);
        continue;
      }
      if (isMe) {
        g.push(`<circle cx="${cx}" cy="${cy}" r="30" fill="${col}" opacity=".18"><animate attributeName="r" values="22;32;22" dur="2s" repeatCount="indefinite"/></circle>`);
        g.push(`<circle cx="${cx}" cy="${cy}" r="15" fill="${col}" stroke="#fff" stroke-width="3"/>`);
        g.push(`<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="14">${esc(p.emoji || '')}</text>`);
        g.push(`<g transform="translate(${cx - 38},${cy - 50})"><rect width="76" height="22" rx="11" fill="#fff"/><text x="38" y="15.5" text-anchor="middle" font-size="12" font-weight="900" fill="#3B1466">나 · ${esc(p.nickname)}</text></g>`);
      } else {
        g.push(`<circle cx="${cx}" cy="${cy}" r="11" fill="${col}" stroke="#1A0736" stroke-width="2"/>`);
        g.push(`<text x="${cx}" y="${cy + 24}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">${esc(p.nickname)}</text>`);
      }
    }
    g.push('</svg>');
    return g.join('');
  }

  window.SKLView = { esc, emblem, avatar, cardFront, cardBack, mapSVG };
})();
