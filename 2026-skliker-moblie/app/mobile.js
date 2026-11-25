/* 모바일 버전: QR(?p=선수ID)로 들어오면 그 선수 기준 화면 3장
 * 연출: 카드팩 오프닝 → 홀로그램 카드(기울이면 빛 반사) → 레이더 스캔 지도 → 3D 피치 라인업 */
(async function () {
  'use strict';
  const { TYPES, TYPE_ORDER } = SKL;
  const { esc, disp, avatar, cardFront, cardBack, emblem, mapSVG } = SKLView;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const app = $('#app');
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  let D;
  try { D = await SKLStore.load(); } catch (e) {
    app.innerHTML = `<div class="skl-error">${esc(e.message)}</div>`; return;
  }
  const { meta, players, teams } = D;
  const params = new URLSearchParams(location.search);
  const pid = params.get('p');
  const me = players.find((p) => p.id === pid);
  $('#scanBtn').hidden = false;
  const season = esc(meta.season || 2026);

  /** 위쪽 전광판 띠 (계속 흘러가는 글자) */
  function ticker(n, words) {
    const run = words.map((w) => `<span>${w}</span><i>✦</i>`).join('');
    return `<div class="tick"><div class="tick-em">${emblem(meta)}</div><div class="tick-band"><div class="tick-run">${run}${run}</div></div><div class="tick-pg"><b>0${n}</b>/03</div></div>`;
  }
  const ghost = (word) => `<div class="ghost" aria-hidden="true">${esc(word)}</div>`;
  /** 천천히 도는 원형 스탬프 */
  let badgeN = 0;
  function badge(text, center) {
    const id = 'bdg' + (badgeN++);
    return `<div class="badge" aria-hidden="true"><svg viewBox="0 0 120 120"><defs><path id="${id}" d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0"/></defs>
      <circle cx="60" cy="60" r="58" fill="#111"/><circle cx="60" cy="60" r="34" fill="none" stroke="#E4F218" stroke-width="1.5" stroke-dasharray="3 3"/>
      <text font-family="Oswald, sans-serif" font-size="11.5" font-weight="700" fill="#E4F218"><textPath href="#${id}" textLength="286" lengthAdjust="spacing">${text}</textPath></text></svg><b>${center}</b></div>`;
  }
  /** 큰 외곽선 글자가 흘러가는 띠 */
  const marquee = (word, dir) => `<div class="mq${dir ? ' rev' : ''}" aria-hidden="true"><div>${Array(8).fill(`<span>${esc(word)}</span><i>✦</i>`).join('')}</div></div>`;
  /** 포스터식 머리: 비스듬한 라임 블록 */
  const posterHead = (no, kicker, title, extra = '') => `<div class="phead"><div class="phead-k"><b>${no}</b>${kicker}</div><div class="phead-t">${title}</div>${extra}</div>`;

  if (!me) {
    if (pid && (D.pending || []).includes(pid)) renderPending(); else renderPicker();
    setupScanner(); return;
  }
  document.title = `${me.nickname} · ${meta.club || 'SK라이커'}`;

  const t = TYPES[me.type];
  const team = teams[me.team];
  const qrSrc = SKLQR.dataUrl(SKL.qrUrl(meta, me.id), 300);
  const scale = Math.min(0.5, (Math.min(window.innerWidth, 480) - 80) / 630);

  /* ---------- 1. 유형 공개 ---------- */
  const best = me.best || SKL.bestOf(me.aff, me.type);
  const stats = TYPE_ORDER.map((k, i) => `<div class="st${k === best ? ' top' : ''}" style="--i:${i};--c:${TYPES[k].color}"><div class="st-k">${['PWR', 'RUN', 'CTL', 'DEF'][i]}<span>${TYPES[k].ability}</span></div><em data-count="${me.aff[k]}">0</em><div class="st-bar"><i style="--w:${me.aff[k]}%"></i></div>${k === best ? '<div class="st-best">BEST</div>' : ''}</div>`).join('');
  const abil = TYPE_ORDER.map((k, i) => `<div class="ab${k === best ? ' top' : ''}" style="--i:${i}"><span>${TYPES[k].ability}</span><div class="tr"><div class="fl" style="--w:${me.aff[k]}%"></div></div><em data-count="${me.aff[k]}">0</em></div>`).join('');
  const p1 = `<section class="panel" data-i="0">
    ${ghost(me.type)}
    ${ticker(1, ['SK LIKER', `${season} SEASON CLOSING`, `NO.${esc(me.number)} ${esc(me.nickname)}`, me.type, esc(me.subtype)])}
    <div class="poster">
      <div class="poster-no" aria-hidden="true">${esc(me.number)}</div>
      <div class="hello"><b>${esc(me.nickname)}</b> 님의 포지션 유형은</div>
      <div class="bigtype">${me.type.split('').map((c, i) => `<span style="--i:${i}">${c}</span>`).join('')}</div>
      <div class="subtype"><i></i>${esc(me.subtype)}</div>
      ${badge('SK LIKER ✦ ' + season + ' ✦ SEASON CLOSING ✦ ', esc(t.ko))}
    </div>
    <div class="oneline">“${t.line}”</div>
    <div class="persona">${t.persona}</div>
    <div class="stage"><div class="rays" aria-hidden="true"></div>
      <div class="flip" id="flip" style="--scale:${scale}"><div class="flip-in">
        <div class="face"><div class="skl-card-wrap" style="--scale:${scale}">${cardFront(me, meta)}</div><div class="holo"></div></div>
        <div class="face b"><div class="skl-card-wrap" style="--scale:${scale}">${cardBack(me, meta, teams, players, qrSrc)}</div><div class="holo"></div></div>
      </div></div>
    </div>
    <div class="fliphint"><span>TILT</span> 기울이면 반짝 · <span>TAP</span> 누르면 뒷면</div>
    ${marquee(me.type)}
    <div class="sec"><b>01</b>ABILITY</div>
    <div class="stats">${stats}</div>
    <div class="kws">${me.tags.map((k) => `<span>${esc(k)}</span>`).join('')}</div>
    <button class="cta" data-go="1"><span>포지션 맵에서 내 위치 보기</span><b>→</b></button>
  </section>`;

  /* ---------- 2. 포지션 맵 ---------- */
  const near = SKL.nearest(me, players);
  const counts = {};
  players.forEach((p) => { counts[p.type] = (counts[p.type] || 0) + 1; });
  const nearMsg = near
    ? `<div class="sh2" style="--c:${TYPES[near.type].color}">${avatar(near)}<div><small>NEAREST PLAYER</small>나와 가장 가까운 <b>${esc(near.nickname)}</b> · ${esc(near.subtype)}<br><em>${near.team === me.team ? '오늘 같은 팀이에요. 호흡 맞춰봐요!' : '오늘은 상대 팀이에요. 마크 주의!'}</em></div></div>`
    : '';
  const p2 = `<section class="panel" data-i="1">
    ${ghost('MAP')}
    ${ticker(2, ['POSITION MAP', `${players.length} PLAYERS`, '4 TYPES', `도전 ${me.x} · 주도 ${me.y}`])}
    ${posterHead('02', 'POSITION MAP', '우리 동호회 안에서<br>나는 <u>여기</u>에 있어요')}
    <div class="seg"><button class="on" data-mode="type">TYPE</button><button data-mode="team">TEAM</button></div>
    <div class="mapwrap"><i class="hud tl"></i><i class="hud tr"></i><i class="hud bl"></i><i class="hud br"></i><div class="scan" aria-hidden="true"></div><div id="map">${mapSVG(players, { me, size: 340, meta })}</div>
      <div class="axis x">도전 →</div><div class="axis y">주도 ↑</div></div>
    <div class="legend" id="legend"></div>
    ${marquee('POSITION MAP', true)}
    <div class="sheet"><div class="sh1"><span class="tg">${me.type}</span>${esc(me.nickname)}<span class="m">도전 <b>${me.x}</b> · 주도 <b>${me.y}</b> <small>/18</small></span></div>${nearMsg}</div>
  </section>`;

  /* ---------- 3. 우리 팀 ---------- */
  const SLOTS = { PIVO: [[50, 14], [30, 16], [70, 16]], ALA: [[18, 40], [82, 40], [50, 32]], FIXO: [[50, 62], [30, 64], [70, 64]], GOLEIRO: [[50, 87], [35, 87]] };
  const mates = players.filter((p) => p.team === me.team);
  const used = {};
  const field = mates.filter((p) => p.role !== 'CHEER');
  const marks = field.map((p, n) => {
    const list = SLOTS[p.role] || SLOTS.ALA;
    const i = (used[p.role] = (used[p.role] || 0) + 1) - 1;
    const [x, y] = list[i % list.length];
    const isMe = p.id === me.id;
    return `<div class="pl${isMe ? ' me' : ''}" style="left:${x}%;top:${y}%;--c:${TYPES[p.type].color};--i:${n}"><div class="pl-up">${avatar(p)}<div class="pn">${esc(p.nickname)}</div><div class="pt">${p.role}</div></div><div class="pl-sh"></div></div>`;
  }).join('');
  const cheers = mates.filter((p) => p.role === 'CHEER');
  const others = teams.map((tm, ti) => ({ tm, ti })).filter((o) => o.ti !== me.team);
  const oppHtml = others.map(({ tm, ti }) => {
    const list = players.filter((p) => p.team === ti).map((q, n) => `<div class="op" style="--c:${TYPES[q.type].color};--i:${n}"><span class="no">${esc(q.number)}</span><b>${esc(q.nickname)}</b><span class="rl">${q.role === 'CHEER' ? 'CHEER' : q.role}</span></div>`).join('');
    return `<div class="vst"><em>VS</em><span style="color:${tm.color}">${disp(tm.name)}</span></div><div class="ops">${list}</div>`;
  }).join('');
  const myRole = me.role === 'CHEER' ? '응원 담당' : `${TYPES[me.role].ko}(${me.role})`;
  const tc = team ? team.color : '#ffffff';
  const p3 = `<section class="panel" data-i="2" style="--tc:${tc}">
    ${ghost('TEAM')}
    ${ticker(3, ['STARTING LINEUP', esc(team ? team.name : 'TEAM'), `${field.length} PLAYERS`, `MY ROLE ${me.role}`])}
    <div class="tblock"><div class="phead-k"><b>03</b>MY TEAM</div><div class="teamname">${disp(team ? team.name : '팀 미정')}</div>${badge('STARTING LINEUP ✦ ' + season + ' ✦ MATCH DAY ✦ ', field.length + '<small>명</small>')}</div>
    <div class="hs">오늘 내 포지션은 <b>${myRole}</b>${me.role !== me.type && me.role !== 'CHEER' ? ` · 원래 유형은 ${t.ko}` : ''}</div>
    <div class="pitch3d"><div class="pitch"><div class="ln c1"></div><div class="ln c2"></div><div class="ln c3"></div><div class="ln c4"></div>${marks}</div></div>
    ${cheers.length ? `<div class="cheers">응원 담당 · ${cheers.map((c) => esc(c.nickname)).join(', ')}</div>` : ''}
    <div class="note"><div class="ic">!</div><div><b>미션카드는 전반전에 획득</b><p>미니게임에서 이기면 후반전에 쓸 초능력 카드를 고를 수 있어요</p></div></div>
    ${marquee('MATCH DAY')}
    <div class="vs">${oppHtml}</div>
  </section>`;

  app.innerHTML = `<div class="pager" id="pager">${p1}${p2}${p3}</div><div class="dots" id="dots"><i class="on"></i><i></i><i></i></div>`;

  /* ---------- 카드팩 오프닝 ---------- */
  const intro = document.createElement('div');
  intro.className = 'pack';
  intro.innerHTML = `<div class="pack-a"></div><div class="pack-b"></div>
    <div class="pack-in">
      <div class="pack-k">SK LIKER · ${season} SEASON CLOSING</div>
      <div class="pack-no">${esc(me.number)}</div>
      <div class="pack-name">${esc(me.nickname)}</div>
      <div class="pack-k2">PLAYER CARD UNLOCKED</div>
      <button class="pack-btn">TAP TO OPEN</button>
    </div>`;
  document.body.appendChild(intro);
  const open = () => {
    askTilt();
    intro.classList.add('go');
    document.body.classList.add('opened');
    setTimeout(() => { intro.remove(); revealPanel(0); }, reduce ? 0 : 900);
  };
  intro.addEventListener('click', open, { once: true });

  /* ---------- 범례 · 지도 모드 ---------- */
  function legend(mode) {
    const el = $('#legend');
    el.classList.toggle('team', mode === 'team');
    el.innerHTML = mode === 'team'
      ? teams.map((tm, i) => `<span style="--c:${tm.color}">${esc(tm.name)}<b>${players.filter((p) => p.team === i).length}</b></span>`).join('')
      : TYPE_ORDER.map((k) => `<span style="--c:${TYPES[k].color}" class="${k === me.type ? 'mine' : ''}">${TYPES[k].ko}<b>${counts[k] || 0}</b></span>`).join('');
  }
  legend('type');
  $$('.seg button').forEach((b) => b.addEventListener('click', () => {
    $$('.seg button').forEach((x) => x.classList.toggle('on', x === b));
    $('#map').innerHTML = mapSVG(players, { me, size: 340, mode: b.dataset.mode, teams, meta });
    legend(b.dataset.mode);
  }));

  /* ---------- 페이지 이동 · 등장 연출 ---------- */
  const pager = $('#pager');
  const panels = $$('.panel');
  function revealPanel(i) {
    const p = panels[i];
    if (!p || p.classList.contains('in')) return;
    p.classList.add('in');
    p.querySelectorAll('[data-count]').forEach((el) => countUp(el, Number(el.dataset.count)));
  }
  function countUp(el, to) {
    if (reduce) { el.textContent = to; return; }
    const t0 = performance.now(), dur = 900;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    setTimeout(() => requestAnimationFrame(step), 250);
  }
  pager.addEventListener('scroll', () => {
    const i = Math.round(pager.scrollLeft / pager.clientWidth);
    $$('#dots i').forEach((d, k) => d.classList.toggle('on', k === i));
    if (document.body.classList.contains('opened')) revealPanel(i);
  }, { passive: true });
  $$('[data-go]').forEach((b) => b.addEventListener('click', () => pager.scrollTo({ left: pager.clientWidth * Number(b.dataset.go), behavior: 'smooth' })));

  /* ---------- 홀로그램 카드: 손가락/기울기에 따라 빛 반사 ---------- */
  const flip = $('#flip');
  let flipped = false;
  flip.addEventListener('click', () => { flipped = !flipped; flip.classList.toggle('back', flipped); });
  function tilt(nx, ny) { // -1 ~ 1
    flip.style.setProperty('--rx', (-ny * 10).toFixed(2) + 'deg');
    flip.style.setProperty('--ry', (nx * 14).toFixed(2) + 'deg');
    flip.style.setProperty('--mx', (50 + nx * 50).toFixed(1) + '%');
    flip.style.setProperty('--my', (50 + ny * 50).toFixed(1) + '%');
  }
  const stage = $('.stage');
  stage.addEventListener('pointermove', (e) => {
    const r = flip.getBoundingClientRect();
    tilt(Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1)), Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1)));
  });
  stage.addEventListener('pointerleave', () => tilt(0, 0));
  function onOrient(e) {
    if (e.gamma == null) return;
    tilt(Math.max(-1, Math.min(1, e.gamma / 25)), Math.max(-1, Math.min(1, (e.beta - 40) / 25)));
  }
  function askTilt() {
    if (reduce || !window.DeviceOrientationEvent) return;
    const D0 = window.DeviceOrientationEvent;
    if (typeof D0.requestPermission === 'function') { // iOS: 탭할 때 한 번 허락받아요
      D0.requestPermission().then((s) => { if (s === 'granted') addEventListener('deviceorientation', onOrient); }).catch(() => {});
    } else addEventListener('deviceorientation', onOrient);
  }
  if (!reduce) { // 손대기 전에도 살짝 숨 쉬듯 움직여요
    let idle = true;
    stage.addEventListener('pointerdown', () => { idle = false; }, { once: true });
    addEventListener('deviceorientation', () => { idle = false; }, { once: true });
    const t0 = performance.now();
    (function breathe(now) {
      if (!idle) return;
      const s = (now - t0) / 1000;
      tilt(Math.sin(s * 0.9) * 0.45, Math.cos(s * 0.7) * 0.3);
      requestAnimationFrame(breathe);
    })(t0);
  }

  setupScanner();

  /* ---------- QR 없이 들어온 경우: 스캔이 먼저 ---------- */
  function landingTop(title, desc) {
    return `${ticker(0, ['SK LIKER', `${season} SEASON CLOSING`, 'SCAN YOUR CARD', 'FIND YOUR TYPE']).replace('<b>00</b>/03', '')}
      <div class="land-hero">${title}${badge('SCAN ✦ SCAN ✦ SCAN ✦ SCAN ✦ SCAN ✦ ', 'QR')}</div>
      <button class="vf" id="bigScan" type="button" aria-label="카메라로 선수카드 QR 스캔">
        <i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>
        <span class="vf-qr" aria-hidden="true">${fakeQR()}</span><i class="laser"></i>
        <span class="vf-go"><b>TAP TO SCAN</b>카메라로 카드 QR 찍기</span>
      </button>
      <p class="land-p">${desc}</p>`;
  }
  function fakeQR() { // 장식용 QR 무늬 (실제 데이터 아님)
    let r = 7, cells = '';
    const seed = (x, y) => ((x * 73856093) ^ (y * 19349663)) % 7 < 3;
    for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
      const fin = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      if (fin) continue;
      if (seed(x + 3, y + 5)) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
    const f = (x, y) => `<rect x="${x}" y="${y}" width="${r}" height="${r}" fill="none" stroke="currentColor" stroke-width="1"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
    return `<svg viewBox="-.5 -.5 22 22" fill="currentColor">${cells}${f(0, 0)}${f(14, 0)}${f(0, 14)}</svg>`;
  }
  function bindLanding() {
    $('#bigScan').addEventListener('click', () => $('#scanBtn').click());
    $('#scanBtn').hidden = true; // 큰 스캔 버튼이 있으니 떠 있는 버튼은 숨겨요
  }
  function renderPicker() {
    const list = players.slice().sort((a, b) => (Number(a.number) || 99) - (Number(b.number) || 99))
      .map((p, n) => `<a href="?p=${encodeURIComponent(p.id)}${params.get('src') ? '&src=' + params.get('src') : ''}${params.has('demo') ? '&demo' : ''}" style="--c:${TYPES[p.type].color};--i:${n}"><span class="no">${esc(p.number)}</span><div><b>${esc(p.nickname)}</b><small>${esc(p.subtype)}</small></div><em>${p.type}</em></a>`).join('');
    app.innerHTML = `<div class="picker in">${landingTop('<h1>SCAN<br>YOUR<br><span>CARD</span></h1>', '선수카드 뒷면의 QR을 비추면 내 포지션 유형과 우리 팀이 열려요.<br>휴대폰 기본 카메라로 찍어도 돼요.')}
      <details class="who"><summary><span>QR이 없나요?</span> 이름으로 찾기 <b>${players.length}</b></summary>
      ${players.length ? `<div class="plist">${list}</div>` : '<div class="empty">아직 등록된 선수가 없어요.<br>data/players.csv를 채우면 여기에 나타나요.</div>'}</details></div>`;
    bindLanding();
  }
  /** QR은 인쇄했지만 players.csv에 아직 이 줄을 안 채운 경우 */
  function renderPending() {
    app.innerHTML = `<div class="picker in">${landingTop('<h1>COMING<br><span>SOON</span></h1>', `이 카드(ID <b>${esc(pid)}</b>)는 아직 선수 정보가 등록되지 않았어요.<br>운영진이 정보를 넣으면 이 QR로 바로 내 화면이 열려요. 다른 카드를 찍어볼 수도 있어요.`)}</div>`;
    bindLanding();
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
