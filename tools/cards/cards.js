/* 선수카드 인쇄: A4 3x3, 앞면 페이지 → 뒷면 페이지(양면 인쇄용으로 좌우 반전) */
(async function () {
  'use strict';
  const { cardFront, cardBack, esc } = SKLView;
  const $ = (s) => document.querySelector(s);

  let D;
  try { D = await SKLStore.load(); } catch (e) {
    $('#pages').innerHTML = `<div class="skl-error">${esc(e.message)}</div>`; return;
  }
  const { meta, players, teams } = D;
  const list = players.slice().sort((a, b) => (a.team - b.team) || (a.number - b.number));
  const qr = {};
  list.forEach((p) => { qr[p.id] = SKLQR.dataUrl(SKL.qrUrl(meta, p.id), 360); });
  $('#info').textContent = `${list.length}명 · QR 주소 ${meta.mobileUrl}`;
  if (/localhost|127\.0\.0\.1/.test(meta.mobileUrl)) $('#info').textContent += ' ⚠ 로컬 주소예요. 인쇄 전에 관리 페이지에서 GitHub Pages 주소로 바꾸세요.';

  function render(side) {
    const per = 9, html = [];
    for (let i = 0; i < list.length; i += per) {
      const chunk = list.slice(i, i + per);
      const pageNo = i / per + 1;
      if (side !== 'back') {
        html.push(`<div class="page"><div class="label">앞면 ${pageNo}</div>${chunk.map((p) => slot(cardFront(p, meta))).join('')}</div>`);
      }
      if (side !== 'front') {
        // 긴 쪽 넘김 양면 인쇄: 행마다 좌우 순서를 뒤집음
        const cells = [];
        for (let r = 0; r < 3; r++) {
          const row = [0, 1, 2].map((c) => chunk[r * 3 + c] || null).reverse();
          if (row.every((x) => !x)) continue;
          row.forEach((p) => cells.push(p ? slot(cardBack(p, meta, teams, players, qr[p.id])) : '<div class="slot" style="outline:none"></div>'));
        }
        html.push(`<div class="page"><div class="label">뒷면 ${pageNo}</div>${cells.join('')}</div>`);
      }
    }
    $('#pages').innerHTML = html.join('') || '<div class="skl-loading">선수가 없어요.</div>';
  }
  const slot = (inner) => `<div class="slot"><div class="skl-card-wrap">${inner}</div></div>`;

  document.querySelectorAll('input[name=side]').forEach((r) => r.addEventListener('change', () => render(r.value)));
  $('#print').addEventListener('click', () => window.print());
  render('both');
})();
