/* 모바일 버전: QR(?p=선수ID)로 들어오면 그 선수 기준 화면 3장 */
(async function () {
  'use strict';
  const { TYPES, TYPE_ORDER } = SKL;
  const { esc, avatar, cardFront, cardBack, emblem, mapSVG } = SKLView;
  const $ = (s) => document.querySelector(s);
  const app = $('#app');

  let D;
  try { D = await SKLStore.load(); } catch (e) {
    app.innerHTML = `<div class="skl-error">${esc(e.message)}</div>`; return;
  }
  const { meta, players, teams } = D;
  const params = new URLSearchParams(location.search);
  const me = players.find((p) => p.id === params.get('p'));
  $('#scanBtn').hidden = false;

  if (!me) { renderPicker(); setupScanner(); return; }
  document.title = `${me.nickname} · ${meta.club || 'SK라이커'}`;

  const t = TYPES[me.type];
  const team = teams[me.team];
  const qrSrc = SKLQR.dataUrl(SKL.qrUrl(meta, me.id), 300); // 친구에게 보여줄 수 있게 뒷면에도 QR
  const scale = Math.min(0.42, (Math.min(window.innerWidth, 480) - 120) / 630);

  /* 1. 유형 공개 */
  const abil = TYPE_ORDER.map((k) => `<div class="ab"><span>${TYPES[k].ability}</span><div class="tr"><div class="fl" style="width:${me.aff[k]}%;background:${TYPES[k].color}"></div></div><em>${me.aff[k]}</em></div>`).join('');
  const p1 = `<section class="panel" style="--accent:${t.color}">
    <div class="top"><div class="lg">${emblem(meta)}</div><div>${esc(meta.season || 2026)} ${esc(meta.eventEn || 'SEASON CLOSING DAY')}</div></div>
    <div class="hello">${esc(me.emoji || '')} <b>${esc(me.nickname)}</b> 님의 포지션 유형은</div>
    <div class="bigtype">${me.type}</div>
    <div class="kotype">${t.ko} · ${t.alias}</div>
    <div class="flip" id="flip" style="--scale:${scale}"><div class="flip-in">
      <div class="face"><div class="skl-card-wrap" style="--scale:${scale}">${cardFront(me, meta)}</div></div>
      <div class="face b"><div class="skl-card-wrap" style="--scale:${scale}">${cardBack(me, meta, teams, players, qrSrc)}</div></div>
    </div></div>
    <div class="fliphint">카드를 누르면 뒤집혀요</div>
    <div class="abil">${abil}</div>
    <div class="kws">${t.kw.map((k) => `<span>#${k}</span>`).join('')}</div>
    <button class="cta" data-go="1">전체 포지션 맵에서 내 위치 보기 →</button>
  </section>`;

  /* 2. 포지션 맵 */
  const near = SKL.nearest(me, players);
  const counts = {};
  players.forEach((p) => { counts[p.type] = (counts[p.type] || 0) + 1; });
  const nearMsg = near
    ? `나와 가장 가까운 선수는 <b>${esc(near.emoji || '')} ${esc(near.nickname)}</b> (${TYPES[near.type].ko})예요. ${near.team === me.team ? '오늘 같은 팀이에요, 호흡 맞춰봐요!' : '오늘은 상대 팀이니 마크 주의!'}`
    : '';
  const p2 = `<section class="panel" style="--accent:${t.color}">
    <div class="ht">${esc(meta.season || 2026)} 포지션 맵</div>
    <div class="hs">${players.length}명의 선수가 4개 유형으로 모였어요</div>
    <div class="seg"><button class="on" data-mode="type">유형별</button><button data-mode="team">팀별</button></div>
    <div class="mapwrap"><div class="axis t">해결 ↑</div><div class="axis b">연결 ↓</div><div id="map">${mapSVG(players, { me, size: 340 })}</div></div>
    <div class="legend" id="legend"></div>
    <div class="sheet"><div class="sh1"><span class="d" style="background:${t.color}"></span><b>${esc(me.nickname)}</b> · ${t.ko}<span class="m">과감 ${me.x}/6 · 해결 ${me.y}/6</span></div>
      <div class="sh2">${nearMsg}</div></div>
  </section>`;

  /* 3. 우리 팀 */
  const SLOTS = { PIVO: [[50, 14], [30, 16], [70, 16]], ALA: [[20, 38], [80, 38], [50, 30]], FIXO: [[50, 60], [30, 62], [70, 62]], GOLEIRO: [[50, 85], [35, 85]] };
  const mates = players.filter((p) => p.team === me.team);
  const used = {};
  const marks = mates.filter((p) => p.role !== 'CHEER').map((p) => {
    const list = SLOTS[p.role] || SLOTS.ALA;
    const i = (used[p.role] = (used[p.role] || 0) + 1) - 1;
    const [x, y] = list[i % list.length];
    const isMe = p.id === me.id;
    return `<div class="pl${isMe ? ' me' : ''}" style="left:${x}%;top:${y}%;--c:${TYPES[p.type].color}">${avatar(p)}<div class="pn">${esc(p.nickname)}${isMe ? ' (나)' : ''}</div><div class="pt">${p.role}</div></div>`;
  }).join('');
  const cheers = mates.filter((p) => p.role === 'CHEER');
  const others = teams.map((tm, ti) => ({ tm, ti })).filter((o) => o.ti !== me.team);
  const oppHtml = others.map(({ tm, ti }) => {
    const list = players.filter((p) => p.team === ti).map((q) => `<div class="op"><i style="background:${TYPES[q.type].color}"></i>${esc(q.nickname)}<span>${q.role === 'CHEER' ? '응원' : TYPES[q.role].ko}</span></div>`).join('');
    return `<div class="vst">VS <span style="color:${tm.color}">${esc(tm.name)}</span></div><div class="ops">${list}</div>`;
  }).join('');
  const myRole = me.role === 'CHEER' ? '응원 담당' : `${TYPES[me.role].ko}(${me.role})`;
  const p3 = `<section class="panel" style="--accent:${team ? team.color : t.color}">
    <div class="ht">우리 팀은 <span style="color:${team ? team.color : '#fff'}">${esc(team ? team.name : '-')}</span></div>
    <div class="hs">오늘 내 포지션은 <b>${myRole}</b>${me.role !== me.type && me.role !== 'CHEER' ? ` · 원래 유형은 ${t.ko}` : ''}</div>
    <div class="pitch"><div class="c1"></div><div class="c2"></div>${marks}</div>
    ${cheers.length ? `<div class="cheers">📣 응원 담당: ${cheers.map((c) => esc(c.nickname)).join(', ')}</div>` : ''}
    <div class="note"><b>🃏 미션카드는 전반전에 획득!</b><p>미니게임에서 이기면 후반전에 쓸 초능력 카드를 고를 수 있어요</p></div>
    <div class="vs">${oppHtml}</div>
  </section>`;

  app.innerHTML = `<div class="pager" id="pager">${p1}${p2}${p3}</div><div class="dots" id="dots"><i class="on"></i><i></i><i></i></div>`;

  // 범례
  function legend(mode) {
    $('#legend').innerHTML = mode === 'team'
      ? teams.map((tm, i) => `<span><i style="background:${tm.color}"></i>${esc(tm.name)} <b>${players.filter((p) => p.team === i).length}</b></span>`).join('')
      : TYPE_ORDER.map((k) => `<span><i style="background:${TYPES[k].color}"></i>${TYPES[k].ko} <b>${counts[k] || 0}</b></span>`).join('');
  }
  legend('type');
  document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.seg button').forEach((x) => x.classList.toggle('on', x === b));
    $('#map').innerHTML = mapSVG(players, { me, size: 340, mode: b.dataset.mode, teams });
    legend(b.dataset.mode);
  }));

  // 페이지 점 표시
  const pager = $('#pager');
  pager.addEventListener('scroll', () => {
    const i = Math.round(pager.scrollLeft / pager.clientWidth);
    document.querySelectorAll('#dots i').forEach((d, k) => d.classList.toggle('on', k === i));
  }, { passive: true });
  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => pager.scrollTo({ left: pager.clientWidth * Number(b.dataset.go), behavior: 'smooth' })));
  $('#flip').addEventListener('click', () => $('#flip').classList.toggle('back'));

  setupScanner();

  /* ---------- QR 없이 들어온 경우: 선수 선택 ---------- */
  function renderPicker() {
    const list = players.slice().sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'))
      .map((p) => `<a href="?p=${encodeURIComponent(p.id)}${params.get('src') ? '&src=' + params.get('src') : ''}" style="--c:${TYPES[p.type].color}">${avatar(p)}<b>${esc(p.nickname)}</b> <span style="color:var(--lilac-2)">#${esc(p.number)}</span><em>${p.type}</em></a>`).join('');
    app.innerHTML = `<div class="picker"><div class="top" style="display:flex;align-items:center;gap:10px;font-size:11px;letter-spacing:2.5px;font-weight:800;color:var(--lilac)"><div style="width:30px">${emblem(meta)}</div>${esc(meta.club || 'SK라이커')} ${esc(meta.season || 2026)}</div>
      <h1>나는 누구일까요?</h1><p>선수카드 뒷면 QR을 찍거나, 아래에서 내 이름을 눌러주세요.</p><div class="plist">${list}</div></div>`;
  }

  /* ---------- QR 스캐너 (카메라 + jsQR) ---------- */
  function setupScanner() {
    const btn = $('#scanBtn'), box = $('#scanner'), video = $('#video'), canvas = $('#canvas'), msg = $('#scanMsg');
    let stream = null, raf = 0;
    btn.addEventListener('click', start);
    $('#scanClose').addEventListener('click', stop);

    async function start() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('이 브라우저에서는 카메라를 쓸 수 없어요. 휴대폰 기본 카메라 앱으로 QR을 찍어주세요.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      } catch (e) {
        alert('카메라 권한이 필요해요. 브라우저 설정에서 카메라를 허용하거나 기본 카메라 앱으로 QR을 찍어주세요.');
        return;
      }
      box.hidden = false;
      video.srcObject = stream;
      await video.play();
      tick();
    }
    function stop() {
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((tr) => tr.stop());
      stream = null;
      box.hidden = true;
    }
    function tick() {
      if (!stream) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const w = video.videoWidth, h = video.videoHeight;
        const side = Math.min(w, h) * 0.7;
        canvas.width = canvas.height = 480;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, (w - side) / 2, (h - side) / 2, side, side, 0, 0, 480, 480);
        const img = ctx.getImageData(0, 0, 480, 480);
        const code = jsQR(img.data, 480, 480, { inversionAttempts: 'dontInvert' });
        if (code && code.data) { handle(code.data); return; }
      }
      raf = requestAnimationFrame(tick);
    }
    function handle(text) {
      let id = null;
      try { id = new URL(text, location.href).searchParams.get('p'); } catch (e) { /* not a URL */ }
      if (!id && /^[a-z0-9]{4,12}$/i.test(text)) id = text;
      if (id && players.some((p) => p.id === id)) {
        stop();
        const q = new URLSearchParams(location.search);
        q.set('p', id);
        location.search = q.toString();
      } else {
        msg.textContent = 'SK라이커 선수카드 QR이 아니에요. 다시 맞춰주세요.';
        setTimeout(() => { msg.textContent = '선수카드 뒷면의 QR을 네모 안에 맞춰주세요'; }, 1800);
        raf = requestAnimationFrame(tick);
      }
    }
  }
})();
