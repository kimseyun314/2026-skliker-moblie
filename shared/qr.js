/* QR 코드 생성 (vendor/qrcode.js 사용) */
(function () {
  'use strict';

  /** text → <canvas> (size: 한 변 픽셀) */
  function canvas(text, size = 360, fg = '#1E0A3C', bg = '#FFFFFF') {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const margin = 2;
    const cell = Math.floor(size / (n + margin * 2));
    const real = cell * (n + margin * 2);
    const c = document.createElement('canvas');
    c.width = c.height = real;
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, real, real);
    ctx.fillStyle = fg;
    for (let r = 0; r < n; r++) {
      for (let col = 0; col < n; col++) {
        if (qr.isDark(r, col)) ctx.fillRect((col + margin) * cell, (r + margin) * cell, cell, cell);
      }
    }
    return c;
  }

  function dataUrl(text, size) {
    return canvas(text, size).toDataURL('image/png');
  }

  function download(text, filename, size = 720) {
    const a = document.createElement('a');
    a.href = dataUrl(text, size);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  window.SKLQR = { canvas, dataUrl, download };
})();
