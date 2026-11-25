/* SK라이커 시즌 클로징 데이 · 진행 슬라이드
 * 데이터: window.SKL_SLIDES_DATA = { meta, csv } (빌드할 때 data/meta.json · data/players.csv를 넣어요)
 * 유형·태그·능력치·팀은 모바일과 같은 shared/logic.js로 계산해요.
 * 조작: → / Space 다음 · ← 이전 · R 다시 재생 · F 전체 화면 · P 선수 소개 · M 포지션 맵 · T 팀 결성 · B 밸런스
 *       players.csv · meta.json을 화면에 끌어다 놓으면 그 데이터로 바뀌어요. */
(function () {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const { esc, disp, avatar, cardFront, cardBack } = SKLView;
  const TYPES = SKL.TYPES, ORDER = SKL.TYPE_ORDER;
  const LOGO = window.SKL_LOGO;
  const stage = $('#stage');

  /* ---------- 데이터 ---------- */
  let D;
  function load(meta, csv) {
    const parsed = SKLCSV.toPlayers(csv);
    const med = SKL.medians(meta);
    const names = window.SKL_SLIDES_DATA.names || {};
    const players = SKL.resolveTeams(parsed.players, meta).map((p) => SKL.enrich(Object.assign({}, p, { photo: '' }, names[p.id] ? { cardName: names[p.id] } : {}), med));
    const teams = SKL.teamsOf(meta);
    const isCoach = (p) => p.role === 'COACH';
    return { meta, med, teams, players, isCoach, field: players.filter((p) => !isCoach(p)), coaches: players.filter(isCoach), season: meta.season || 2026 };
  }

  /* ---------- 타이머 (슬라이드를 넘기면 정리) ---------- */
  let timers = [];
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const r1 = (v) => Math.round(v * 10) / 10;

  /* ---------- 공통 조각 ---------- */
  const tc = (p) => TYPES[p.type].color;
  const stampSvg = (text) => `<svg viewBox="0 0 230 230"><defs><path id="sc" d="M115,115 m-88,0 a88,88 0 1,1 176,0 a88,88 0 1,1 -176,0"/></defs><text font-family="Oswald" font-weight="700" font-size="17" letter-spacing="5" fill="#E4F218"><textPath href="#sc">${text}</textPath></text></svg>`;
  const stamp = (big, small, ring) => `<div class="stamp pop" style="animation-delay:.6s">${stampSvg(ring)}<b>${big}${small ? `<small>${small}</small>` : ''}</b></div>`;
  const marquee = (word) => { const s = Array(8).fill(`${word} ✦ `).join(''); return `<div class="marquee"><span>${s}${s}</span></div>`; };
  const ghost = (word, pos) => `<div class="ghost fade" style="${pos}">${word}</div>`;
  const typeName = (k) => `${TYPES[k].ko}`;

  /* ---------- 슬라이드 만들기 ---------- */
  function buildSlides() {
    const { meta, teams, players, field, coaches, season, med } = D;
    const list = [];
    const counts = {}; ORDER.forEach((k) => { counts[k] = players.filter((p) => p.type === k).length; });

    // 1. 타이틀
    list.push({
      cls: 's-title', band: `SK LIKER ✦ ${season} SEASON CLOSING DAY ✦ FIND YOUR POSITION ✦ `,
      html: `<div class="lime-block slideL"></div>
        <div class="yr fade" style="animation-delay:.3s">${season}</div>
        <div class="tlogo drop" style="animation-delay:.2s"><img src="${LOGO}" alt="SK LIKER"></div>
        <div class="tt"><div class="k up" style="animation-delay:.4s">SK LIKER FUTSAL CLUB</div>
          <div class="big up" style="animation-delay:.5s">SEASON<br>CLOSING DAY</div>
          <div class="ko up" style="animation-delay:.7s">${esc(meta.event || '시즌 클로징 데이')} · 나의 풋살 포지션 유형</div></div>
        ${stamp('16', '명의 선수카드', 'SK LIKER ✦ SEASON CLOSING ✦ ' + season + ' ✦ ')}
        ${marquee('SEASON CLOSING DAY')}
        <div class="meta-row">
          <div class="up" style="animation-delay:.9s">PLAYERS<b>${field.length}<em>${coaches.length ? ' +' + coaches.length : ''}</em></b></div>
          <div class="up" style="animation-delay:1s">TEAMS<b>${teams.length}</b></div>
          <div class="up" style="animation-delay:1.1s">TYPES<b>4</b></div>
          <div class="up" style="animation-delay:1.2s">KICK OFF<b>20:00</b></div>
        </div>`,
    });

    // 2. 유형 소개
    list.push({
      cls: 's-types', band: 'FOUR POSITION TYPES ✦ 도전 × 주도 ✦ PIVO ✦ ALA ✦ FIXO ✦ GOLEIRO ✦ ',
      html: `${ghost('TYPES', 'right:-60px;bottom:-60px')}
        <div class="kicker up"><b>01</b>POSITION TYPES</div>
        <div class="h1 up" style="animation-delay:.1s">${disp('4가지 포지션 유형')}<small>설문 12문항 → 도전 점수 × 주도 점수 → 참가자 중앙값으로 네 칸</small></div>
        <div class="axes fade" style="animation-delay:.4s"><b>가로</b> 도전 ↔ 준비 (Q1~Q6)<br><b>세로</b> 주도 ↔ 함께 (Q7~Q12)<br>기준선 <b>${med.mx} · ${med.my}</b></div>
        <div class="grid">${ORDER.map((k, i) => {
          const t = TYPES[k];
          return `<div class="tcard up" style="--c:${t.color};animation-delay:${.35 + i * .15}s">
            <div class="ax">${t.axis}</div><div class="en">${k}</div>
            <div class="ko">${t.ko}<span>${t.nick}</span></div>
            <div class="line">"${esc(t.line)}"</div>
            <div class="kw">${(t.keywords || []).map((w) => `<i>${esc(w)}</i>`).join('')}</div>
            <div class="ab">ABILITY<b>${t.ability}</b></div>
            <div class="cnt">${counts[k]}<small class="ko">명</small></div></div>`;
        }).join('')}</div>`,
    });

    // 3. 오늘의 선수들
    const rosterOrder = players.slice().sort((a, b) => (D.isCoach(a) - D.isCoach(b)) || (Number(a.number) - Number(b.number)));
    list.push({
      cls: 's-roster', band: `TODAY'S PLAYERS ✦ ${field.length} PLAYERS ✦ ${coaches.length} COACH ✦ `,
      html: `${ghost('PLAYERS', 'left:-40px;bottom:-80px')}
        <div class="kicker up"><b>02</b>TODAY'S PLAYERS</div>
        <div class="h1 up" style="animation-delay:.1s">${disp('오늘의 선수들')}<small>카드를 받으면 같이 열어봐요 · 유형은 아직 비밀</small></div>
        <div class="sum up" style="animation-delay:.3s">${field.length}<span class="mute" style="font-size:60px">${coaches.length ? ' +' + coaches.length : ''}</span><small>PLAYERS${coaches.length ? ' + COACH' : ''}</small></div>
        <div class="grid">${rosterOrder.map((p, i) => `<div class="rtile pop${D.isCoach(p) ? ' coach' : ''}" style="--c:${tc(p)};animation-delay:${.4 + i * .06}s">${avatar(p)}<div class="nm">${esc(p.nickname)}</div><div class="tp">${D.isCoach(p) ? 'COACH' : '???'}</div></div>`).join('')}</div>`,
      enter(el) {
        // 잠깐 뒤에 유형 공개
        later(() => $$('.rtile', el).forEach((t, i) => later(() => {
          const p = rosterOrder[i];
          if (!D.isCoach(p)) { t.querySelector('.tp').textContent = p.type; }
          t.animate([{ transform: 'rotateY(0)' }, { transform: 'rotateY(360deg)' }], { duration: 600, easing: 'cubic-bezier(.3,.9,.3,1)' });
        }, i * 90)), 2600);
      },
    });

    // 4. 선수 스포트라이트
    const spot = ORDER.flatMap((k) => field.filter((p) => p.type === k).sort((a, b) => a.number - b.number)).concat(coaches);
    spot.forEach((p, idx) => {
      const t = TYPES[p.type];
      const isC = D.isCoach(p);
      const team = typeof p.team === 'number' ? teams[p.team] : null;
      const best = p.best || SKL.bestOf(p.aff, p.type);
      list.push({
        cls: 's-spot', group: 'spot', style: `--c:${t.color}`,
        band: `PLAYER ${String(idx + 1).padStart(2, '0')} ✦ NO.${esc(p.number)} ${esc(p.nickname)} ✦ ${p.type} ✦ ${esc(p.subtype)} ✦ `,
        html: `<div class="rays"></div>${ghost(p.type, 'right:-40px;bottom:-90px;-webkit-text-stroke-color:#1A1A1A')}
          <div class="cardbox"><div class="flip"><div class="face a"><div class="skl-card-wrap" style="--scale:.9">${cardFront(p, D.meta)}</div></div><div class="face b"><div class="skl-card-wrap" style="--scale:.9">${cardBack(p, D.meta, teams, players)}</div></div></div></div>
          <div class="score fade" style="animation-delay:.9s">도전 · 주도<b>${p.x} · ${p.y}</b></div>
          <div class="info">
            <div class="who up" style="animation-delay:.5s"><b>PLAYER ${String(idx + 1).padStart(2, '0')}</b> / ${spot.length}${team ? ` · ${esc(team.name)}` : ''}</div>
            <div class="nm up" style="animation-delay:.6s"><span class="no">${esc(p.number)}</span><span class="n">${disp(p.nickname)}</span></div>
            <div class="tline up" style="animation-delay:.75s"><span class="pill">${p.type}</span><span class="sub">${esc(p.subtype)}</span>${isC ? '<span class="coachb">COACH</span>' : ''}</div>
            <div class="quote up" style="animation-delay:.9s">"${esc(t.line)}"</div>
            <div class="bars up" style="animation-delay:1.05s">${ORDER.map((k) => `<div class="bar${k === best ? ' best' : ''}" style="--c:${TYPES[k].color}"><div class="lb"><span>${TYPES[k].ability}</span><b data-v="${p.aff[k]}">0</b></div><div class="tr"><i data-w="${p.aff[k]}"></i></div></div>`).join('')}</div>
            <div class="tags up" style="animation-delay:1.2s">${p.tags.map((g) => `<i>${esc(g)}</i>`).join('')}</div>
            <div class="moment up" style="animation-delay:1.35s"><div class="k">${season} HIGHLIGHT</div><p data-text="${esc(p.moment || '')}"></p></div>
          </div>`,
        enter(el) {
          later(() => {
            $$('.tr i', el).forEach((i) => { i.style.width = i.dataset.w + '%'; });
            $$('.lb b', el).forEach((b) => countUp(b, +b.dataset.v, 1300));
          }, 1200);
          const pEl = $('.moment p', el), text = pEl.dataset.text;
          pEl.textContent = '';
          later(() => { let n = 0; const tick = () => { pEl.textContent = [...text].slice(0, ++n).join(''); if (n < [...text].length) later(tick, 45); }; tick(); }, 1900);
          later(() => $('.flip', el).classList.add('back'), 5200);
          later(() => $('.flip', el).classList.remove('back'), 9500);
        },
        leave(el) { $$('.tr i', el).forEach((i) => { i.style.width = '0'; }); $('.flip', el).classList.remove('back'); },
      });
    });

    // 5. 포지션 맵 (실시간 클러스터링)
    list.push({
      cls: 's-map', group: 'map', band: 'POSITION MAP ✦ LIVE CLUSTERING ✦ 도전 × 주도 ✦ ',
      html: `<div class="plot fade"><div class="grid"></div>
          ${quadHtml()}
          <div class="med v"></div><div class="med h"></div>
          <svg class="links" viewBox="0 0 820 820"></svg>
          <div class="axl" style="left:0;bottom:-34px">← 준비</div><div class="axl" style="right:0;bottom:-34px">도전 →</div>
          <div class="axl" style="left:-40px;top:-34px">주도 ↑</div><div class="axl" style="left:-40px;bottom:6px;transform:rotate(-90deg);transform-origin:left bottom">함께</div>
        </div>
        <div class="panel">
          <span class="live">LIVE</span>
          <div class="ttl up" style="animation-delay:.1s">POSITION MAP<small>${players.length}명의 점수로 네 유형을 찾는 중</small></div>
          <div class="stats up" style="animation-delay:.25s"><div><small>ITERATION</small><b class="st-i">0/6</b></div><div><small>중심 이동</small><b class="st-m">-</b></div><div><small>재배정</small><b class="st-r">-</b></div></div>
          <div class="log up" style="animation-delay:.35s"></div>
          <div class="result">${ORDER.map((k) => `<div style="--c:${TYPES[k].color}"><b>${k}</b><span>${TYPES[k].ko} ${counts[k]}명</span><p>${players.filter((p) => p.type === k).map((p) => esc(p.nickname)).join(' · ')}</p></div>`).join('')}</div>
        </div>`,
      enter: runCluster,
    });

    // 6. 팀 결성
    list.push({
      cls: 's-draft', group: 'draft', band: `TEAM DRAFT ✦ ${teams.map((t) => t.name).join(' ✦ ')} ✦ `,
      html: `${ghost('TEAMS', 'right:-80px;top:40px')}
        <div class="head"><div><div class="kicker up"><b>03</b>TEAM DRAFT</div>
          <div class="h1 up" style="animation-delay:.1s">${disp(`오늘의 ${teams.length}팀`)}<small>팀마다 골레이로 · 피보 1명씩, 아라 · 픽소가 골고루</small></div></div></div>
        <div class="teams">${teams.map((t, i) => `<div class="team" style="--c:${t.color}"><div class="tn slideR" style="animation-delay:${.3 + i * .15}s"><b>${disp(t.name)}</b><span>${field.filter((p) => p.team === i).length} PLAYERS</span></div><div class="pitch fade" data-t="${i}" style="animation-delay:${.4 + i * .15}s"></div></div>`).join('')}</div>
        ${teams.slice(1).map((_, i) => `<div class="vs" data-i="${i}">VS</div>`).join('')}
        ${field.map((p) => `<div class="pl" data-id="${esc(p.id)}" style="--c:${tc(p)};left:960px;top:620px;opacity:0">${avatar(p)}<div class="n">${esc(p.nickname)}</div><div class="r">${p.role}</div></div>`).join('')}
        ${coaches.length ? `<div class="coach up" style="animation-delay:4.6s"><span class="ck">COACH</span>${coaches.map((c) => `${avatar(c)}<div><strong>${esc(c.nickname)}</strong><small>오늘의 코치 · 세 팀 모두를 응원해요</small></div>`).join('')}</div>` : ''}`,
      enter: runDraft,
    });

    // 7. 팀 밸런스
    list.push({ cls: 's-bal', group: 'bal', band: 'TEAM BALANCE ✦ ABILITY RADAR ✦ ', html: balanceHtml(), enter: runBalance });

    // 8. 킥오프
    const sched = meta.schedule || [
      { time: '20:00', title: '전반전 · 팀 결성 & 미니게임', items: [['20:05', '선수카드 언박싱 · 유형 공개'], ['20:17', '팀 결성 · 조끼 · 주장 · 구호'], ['20:20', '미니게임 4판 (정확도 · 스피드 · 소통 · 팀워크)'], ['20:52', '카드 뽑기 세리머니']] },
      { time: '21:00', title: '후반전 · 미션카드 리그전', items: [['21:00', '카드 룰 브리핑'], ['21:05', '1경기 · 12분 단판'], ['21:20', '2경기'], ['21:35', '3경기']] },
      { time: '21:52', title: '시상 & 단체사진', items: [['🏆', '리그 우승'], ['🃏', '카드 마스터'], ['MVP', '유형별 MVP 4명'], ['🎁', '럭키드로우']] },
    ];
    const cs = [teams[0] ? teams[0].color : '#E63946', '#E4F218', teams[2] ? teams[2].color : '#4EA8DE'];
    list.push({
      cls: 's-kick', band: "LET'S PLAY ✦ KICK OFF ✦ SK LIKER ✦ ",
      html: `${ghost('KICKOFF', 'left:-60px;bottom:-90px')}
        <div class="kicker up"><b>04</b>MATCH DAY</div>
        <div class="big up" style="animation-delay:.15s">KICK OFF!</div>
        ${stamp(String(field.length), 'PLAYERS', 'SK LIKER ✦ MATCH DAY ✦ ' + season + ' ✦ ')}
        <div class="tl">${sched.map((s, i) => `<div class="up" style="--c:${cs[i % cs.length]};animation-delay:${.5 + i * .15}s"><b>${esc(s.time)}</b><h3>${esc(s.title)}</h3><ul>${(s.items || []).map(([a, b]) => `<li><em>${esc(a)}</em>${esc(b)}</li>`).join('')}</ul></div>`).join('')}</div>`,
      enter() { later(() => { confetti(560, 360, 160); confetti(1360, 360, 160); }, 700); },
    });
    return list;
  }

  /* ---------- 포지션 맵 ---------- */
  const PS = 820;
  const px = (v) => (v / 18) * PS;
  const py = (v) => (1 - v / 18) * PS;
  function quadHtml() {
    const qx = px(D.med.mx), qy = py(D.med.my);
    const box = {
      PIVO: [qx, 0, PS - qx, qy, 'right:16px;top:12px'],
      FIXO: [0, 0, qx, qy, 'left:16px;top:12px'],
      ALA: [qx, qy, PS - qx, PS - qy, 'right:16px;bottom:10px'],
      GOLEIRO: [0, qy, qx, PS - qy, 'left:16px;bottom:10px'],
    };
    return ORDER.map((k) => { const [l, t, w, h, lp] = box[k]; return `<div class="quad" data-k="${k}" style="--c:${TYPES[k].color};left:${l}px;top:${t}px;width:${w}px;height:${h}px;background:${TYPES[k].color}14"><span style="${lp}">${k}</span></div>`; }).join('');
  }
  function runCluster(el) {
    const plot = $('.plot', el), svg = $('svg.links', el), log = $('.log', el);
    const live = $('.live', el);
    live.classList.remove('done'); live.textContent = 'LIVE';
    $$('.dot, .cen', plot).forEach((n) => n.remove());
    $$('.quad, .med', plot).forEach((n) => n.classList.remove('on'));
    $$('.result div', el).forEach((n) => n.classList.remove('on'));
    svg.innerHTML = ''; log.innerHTML = '';
    $('.st-i', el).textContent = '0/6'; $('.st-m', el).textContent = '-'; $('.st-r', el).textContent = '-';
    const addLog = (h) => { const d = document.createElement('div'); d.innerHTML = h; log.appendChild(d); while (log.children.length > 8) log.firstChild.remove(); };
    $('.med.v', plot).style.left = px(D.med.mx) + 'px';
    $('.med.h', plot).style.top = py(D.med.my) + 'px';

    // 같은 점수는 살짝 옆으로
    const seen = {};
    const pts = D.players.map((p) => {
      const key = p.x + ',' + p.y; const n = (seen[key] = (seen[key] || 0) + 1) - 1;
      return { p, x: px(p.x) + (n ? (n % 2 ? 8 : -8) : 0), y: py(p.y), cls: null };
    });
    // 겹치지 않게 살짝 밀어내기 (점수 위치에서 크게 벗어나지 않음)
    const MIN = 78;
    for (let it = 0; it < 160; it++) {
      for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) {
        const A = pts[a], B = pts[b]; let dx = B.x - A.x, dy = B.y - A.y; let d = Math.hypot(dx, dy);
        if (d < MIN) { if (d < .01) { dx = 1; dy = 0; d = 1; } const push = (MIN - d) / 2; A.x -= dx / d * push; A.y -= dy / d * push; B.x += dx / d * push; B.y += dy / d * push; }
      }
      pts.forEach((o) => { o.x = Math.max(32, Math.min(PS - 32, o.x)); o.y = Math.max(32, Math.min(PS - 40, o.y)); });
    }
    pts.forEach((o, i) => {
      const d = document.createElement('div');
      d.className = 'dot';
      d.innerHTML = `${esc(o.p.number)}<em>${esc(o.p.nickname)}</em>`;
      const col = i % 8, row = Math.floor(i / 8);
      d.style.left = (150 + col * 75) + 'px'; d.style.top = (360 + row * 100) + 'px';
      plot.appendChild(d); o.el = d;
    });
    const rnd = (a, b) => a + Math.random() * (b - a);
    later(() => pts.forEach((o) => { o.el.style.left = rnd(60, 760) + 'px'; o.el.style.top = rnd(60, 760) + 'px'; }), 500);
    later(() => addLog('> load <b>' + pts.length + '</b> players · 12 answers each'), 600);
    later(() => pts.forEach((o, i) => later(() => { o.el.style.left = o.x + 'px'; o.el.style.top = o.y + 'px'; }, i * 70)), 1500);
    later(() => addLog('> score → (도전, 주도) · 0~18'), 1700);

    // 중심점: 무작위 시작 → 실제 유형 평균으로 수렴
    const target = {};
    ORDER.forEach((k) => {
      const m = pts.filter((o) => o.p.type === k);
      target[k] = m.length ? { x: m.reduce((s, o) => s + o.x, 0) / m.length, y: m.reduce((s, o) => s + o.y, 0) / m.length } : { x: PS / 2, y: PS / 2 };
    });
    const start = {}; const cen = {};
    ORDER.forEach((k, i) => {
      start[k] = { x: rnd(200, 620), y: rnd(200, 620) };
      const c = document.createElement('div');
      c.className = 'cen'; c.style.setProperty('--c', TYPES[k].color);
      c.innerHTML = `<b>${k}</b>`;
      c.style.left = start[k].x + 'px'; c.style.top = start[k].y + 'px';
      plot.appendChild(c); cen[k] = { el: c, x: start[k].x, y: start[k].y };
    });
    const T0 = 3400, K = 6, STEP = 1000;
    later(() => { ORDER.forEach((k) => cen[k].el.classList.add('on')); addLog('> k = 4 · init centroids <b>random</b>'); }, T0);
    const nearest = (o) => ORDER.reduce((b, k) => (Math.hypot(o.x - cen[k].x, o.y - cen[k].y) < Math.hypot(o.x - cen[b].x, o.y - cen[b].y) ? k : b), ORDER[0]);
    for (let k = 1; k <= K; k++) {
      later(() => {
        const e = ease(k / K), noise = Math.pow(1 - k / K, .7) * 150;
        let move = 0;
        ORDER.forEach((t) => {
          const nx = start[t].x + (target[t].x - start[t].x) * e + (k < K ? rnd(-noise, noise) : 0);
          const ny = start[t].y + (target[t].y - start[t].y) * e + (k < K ? rnd(-noise, noise) : 0);
          move += Math.hypot(nx - cen[t].x, ny - cen[t].y);
          cen[t].x = nx; cen[t].y = ny; cen[t].el.style.left = nx + 'px'; cen[t].el.style.top = ny + 'px';
        });
        later(() => {
          let changed = 0;
          pts.forEach((o) => {
            const c = k === K ? o.p.type : nearest(o);
            if (c !== o.cls) { changed++; o.cls = c; }
            o.el.style.borderColor = TYPES[c].color;
          });
          svg.innerHTML = pts.map((o) => `<line x1="${o.x}" y1="${o.y}" x2="${cen[o.cls].x}" y2="${cen[o.cls].y}" stroke="${TYPES[o.cls].color}"/>`).join('');
          const mv = r1((move / 4) / PS * 18);
          $('.st-i', el).textContent = `${k}/${K}`; $('.st-m', el).textContent = mv.toFixed(1); $('.st-r', el).textContent = changed + '명';
          addLog(`> iter <b>${k}</b> · shift ${mv.toFixed(1)} · reassigned <b>${changed}</b>`);
        }, 500);
      }, T0 + 500 + (k - 1) * STEP);
    }
    const TEND = T0 + 500 + K * STEP + 300;
    later(() => {
      svg.innerHTML = '';
      $$('.med', plot).forEach((n) => n.classList.add('on'));
      $$('.quad', plot).forEach((n) => n.classList.add('on'));
      pts.forEach((o, i) => later(() => { o.el.style.setProperty('--gc', TYPES[o.p.type].color); o.el.classList.add('glow'); }, i * 40));
      ORDER.forEach((k) => cen[k].el.classList.remove('on'));
      live.classList.add('done'); live.textContent = 'CONVERGED';
      addLog(`> median line <b>도전 ${D.med.mx} · 주도 ${D.med.my}</b>`);
      addLog('> done · ' + ORDER.map((k) => `${k} ${pts.filter((o) => o.p.type === k).length}`).join(' · '));
      $$('.result div', el).forEach((n, i) => later(() => n.classList.add('on'), 300 + i * 160));
    }, TEND);
    // 끝난 뒤에도 살짝 흔들림
    const wob = () => { pts.forEach((o) => { o.el.style.left = (o.x + rnd(-3, 3)) + 'px'; o.el.style.top = (o.y + rnd(-3, 3)) + 'px'; }); later(wob, 1400); };
    later(wob, TEND + 1500);
  }

  /* ---------- 팀 결성 ---------- */
  const ROW = { PIVO: 8, ALA: 34, FIXO: 59, GOLEIRO: 87 };
  const SPREAD = { PIVO: 24, ALA: 32, FIXO: 24, GOLEIRO: 18 };
  function slotOf(role, i, n) {
    const y = ROW[role] || ROW.ALA, d = SPREAD[role] || 24;
    // 한 명이면 가운데, 두 명이면 양옆 대칭
    const xs = n === 1 ? [50] : n === 2 ? [50 - d, 50 + d] : [50, 50 - d, 50 + d];
    return [xs[i % xs.length], y];
  }
  function relPos(node, root) { let x = 0, y = 0; while (node && node !== root) { x += node.offsetLeft; y += node.offsetTop; node = node.offsetParent; } return { x, y }; }
  function runDraft(el) {
    const pls = $$('.pl', el);
    pls.forEach((n) => { n.style.transition = 'none'; n.style.left = '960px'; n.style.top = '620px'; n.style.opacity = '0'; });
    $$('.vs', el).forEach((v) => v.classList.remove('on'));
    void el.offsetWidth;
    pls.forEach((n) => { n.style.transition = ''; });
    const pitches = $$('.pitch', el).map((pt) => { const r = relPos(pt, el); return { x: r.x, y: r.y, w: pt.offsetWidth, h: pt.offsetHeight }; });
    // 자리 계산
    const targets = {};
    D.teams.forEach((_, ti) => {
      const mem = D.field.filter((p) => p.team === ti && p.role !== 'CHEER');
      const cnt = {}; mem.forEach((p) => { cnt[p.role] = (cnt[p.role] || 0) + 1; });
      const used = {};
      mem.forEach((p) => {
        const i = (used[p.role] = (used[p.role] || 0) + 1) - 1;
        const [sx, sy] = slotOf(p.role, i, cnt[p.role]);
        const pt = pitches[ti];
        targets[p.id] = { x: pt.x + pt.w * sx / 100, y: pt.y + pt.h * sy / 100 - 46 };
      });
    });
    // 드래프트 순서: 골레이로 → 피보 → 픽소 → 아라, 팀을 번갈아
    const order = ['GOLEIRO', 'PIVO', 'FIXO', 'ALA'].flatMap((r) => D.field.filter((p) => p.role === r).sort((a, b) => a.team - b.team));
    D.field.forEach((p) => { if (!order.includes(p)) order.push(p); });
    order.forEach((p, i) => later(() => {
      const n = pls.find((x) => x.dataset.id === String(p.id)); const tg = targets[p.id];
      if (!n || !tg) return;
      n.style.opacity = '1'; n.style.left = tg.x + 'px'; n.style.top = tg.y + 'px';
    }, 1100 + i * 180));
    const tEnd = 1100 + order.length * 180 + 600;
    later(() => {
      $$('.vs', el).forEach((v, i) => {
        const a = pitches[i], b = pitches[i + 1];
        v.style.left = ((a.x + a.w + b.x) / 2 - 52) + 'px'; v.style.top = (a.y + a.h / 2 - 40) + 'px';
        later(() => v.classList.add('on'), i * 200);
      });
      confetti(960, 300, 220);
    }, tEnd);
  }

  /* ---------- 팀 밸런스 ---------- */
  function teamStats() {
    return D.teams.map((t, i) => {
      const mem = D.field.filter((p) => p.team === i);
      const fld = mem.filter((p) => p.role !== 'CHEER');
      const avg = (f) => (fld.length ? fld.reduce((s, p) => s + f(p), 0) / fld.length : 0);
      const ab = {}; ORDER.forEach((k) => { ab[k] = r1(avg((p) => p.aff[k])); });
      const roles = {}; ['GOLEIRO', 'FIXO', 'ALA', 'PIVO'].forEach((k) => { roles[k] = fld.filter((p) => p.role === k).length; });
      return { t, i, mem, ab, roles, x: r1(avg((p) => p.x)), y: r1(avg((p) => p.y)) };
    });
  }
  function balanceHtml() {
    const S = teamStats();
    const R = 230, C = 300;
    const ang = { PIVO: -90, ALA: 0, FIXO: 90, GOLEIRO: 180 };
    const all = S.flatMap((s) => ORDER.map((k) => s.ab[k]));
    const lo = Math.floor(Math.min(...all) / 5) * 5 - 10, hi = Math.ceil(Math.max(...all) / 5) * 5 + 5;
    const rad = (v) => Math.max(.06, (v - lo) / (hi - lo)) * R;
    const pt = (k, v) => { const a = ang[k] * Math.PI / 180; return [C + Math.cos(a) * rad(v), C + Math.sin(a) * rad(v)]; };
    const rings = [.25, .5, .75, 1].map((f) => `<polygon points="${ORDER.map((k) => { const a = ang[k] * Math.PI / 180; return [C + Math.cos(a) * R * f, C + Math.sin(a) * R * f].join(','); }).join(' ')}" fill="none" stroke="#2A2A2A" stroke-width="2"/>`).join('');
    const spokes = ORDER.map((k) => { const a = ang[k] * Math.PI / 180; return `<line x1="${C}" y1="${C}" x2="${C + Math.cos(a) * R}" y2="${C + Math.sin(a) * R}" stroke="#2A2A2A" stroke-width="2"/>`; }).join('');
    const polys = S.map((s) => `<polygon class="t" data-i="${s.i}" points="${ORDER.map((k) => pt(k, s.ab[k]).join(',')).join(' ')}" fill="${s.t.color}33" stroke="${s.t.color}" stroke-width="4" stroke-linejoin="round"/>`).join('');
    const lab = (k) => {
      const a = ang[k] * Math.PI / 180; const lx = C + Math.cos(a) * (R + 62), ly = C + Math.sin(a) * (R + 50);
      const anchor = k === 'ALA' ? 'start' : k === 'GOLEIRO' ? 'end' : 'middle';
      const dx = k === 'ALA' ? -30 : k === 'GOLEIRO' ? 30 : 0;
      return `<text x="${lx + dx}" y="${ly - 10}" text-anchor="${anchor}" font-family="Noto Sans KR" font-weight="900" font-size="26" fill="${TYPES[k].color}">${TYPES[k].ability}</text>
        <text x="${lx + dx}" y="${ly + 22}" text-anchor="${anchor}" font-family="Anton" font-size="24">${S.map((s) => `<tspan fill="${s.t.color}">${Math.round(s.ab[k])}</tspan>`).join('<tspan fill="#555"> · </tspan>')}</text>`;
    };
    const diffs = ORDER.map((k) => Math.max(...S.map((s) => s.ab[k])) - Math.min(...S.map((s) => s.ab[k])));
    const avgDiff = r1(diffs.reduce((a, b) => a + b, 0) / diffs.length);
    const verdict = avgDiff < 3 ? '박빙! 거의 완벽한 밸런스' : avgDiff < 6 ? '팽팽한 승부 예상' : '개성이 뚜렷한 세 팀';
    const gauge = (v, label, col) => { const c = 2 * Math.PI * 44; return `<div class="gauge"><svg viewBox="0 0 104 104"><circle cx="52" cy="52" r="44" fill="none" stroke="#262626" stroke-width="10"/><circle class="v" cx="52" cy="52" r="44" fill="none" stroke="${col}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-off="${c * (1 - v / 18)}"/></svg><div class="gv">${v}</div><small>${label}</small></div>`; };
    const card = (s, n) => {
      const others = S.filter((o) => o !== s);
      const strong = ORDER.reduce((b, k) => ((s.ab[k] - others.reduce((a, o) => a + o.ab[k], 0) / others.length) > (s.ab[b] - others.reduce((a, o) => a + o.ab[b], 0) / others.length) ? k : b), ORDER[0]);
      return `<div class="bcard up" style="--c:${s.t.color};animation-delay:${.6 + n * .2}s">
        <div class="tn">${disp(s.t.name)}</div>
        <div class="mem">${s.mem.map((p) => `<span style="--tc:${tc(p)}">${avatar(p)}</span>`).join('')}</div>
        <div class="comp">GK ${s.roles.GOLEIRO} · 픽소 ${s.roles.FIXO} · 아라 ${s.roles.ALA} · 피보 ${s.roles.PIVO}</div>
        <div class="str">강점 <b>${TYPES[strong].ability}</b> ${Math.round(s.ab[strong])}</div>
        <div class="gauges">${gauge(s.x, '도전', '#E4F218')}${gauge(s.y, '주도', '#fff')}</div></div>`;
    };
    const sumCard = `<div class="bcard up" style="--c:#E4F218;animation-delay:1.2s">
        <div class="tn" style="color:#fff">BALANCE</div><div class="verd">${verdict}</div>
        <div class="comp" style="font-size:22px;line-height:1.7;margin-top:8px">능력치 평균 차이 <b class="lime" style="font-family:Anton;font-size:30px">${avgDiff}</b>점<br>
        도전 평균 ${S.map((s) => `<b style="color:${s.t.color}">${s.x}</b>`).join(' · ')}<br>주도 평균 ${S.map((s) => `<b style="color:${s.t.color}">${s.y}</b>`).join(' · ')}</div></div>`;
    return `${ghost('BALANCE', 'left:-60px;top:60px')}
      <div class="kicker up"><b>03</b>TEAM BALANCE</div>
      <div class="h1 up" style="animation-delay:.1s">${disp('팀 밸런스 체크')}<small>필드 선수 능력치 평균 · 결정력 · 활동력 · 설계력 · 수호력</small></div>
      <div class="wrap">
        <div style="grid-column:1;grid-row:1">${card(S[0], 0)}</div>
        <div class="radar fade" style="animation-delay:.3s"><svg viewBox="0 0 600 600">${rings}${spokes}${polys}${ORDER.map(lab).join('')}</svg>
          <div class="legend">${S.map((s) => `<span style="--c:${s.t.color}">${esc(s.t.name)}</span>`).join('')}</div></div>
        <div style="grid-column:3;grid-row:1">${S[1] ? card(S[1], 1) : ''}</div>
        <div style="grid-column:1;grid-row:2">${S[2] ? card(S[2], 2) : ''}</div>
        <div style="grid-column:3;grid-row:2">${sumCard}</div>
      </div>
`;
  }
  function runBalance(el) {
    $$('polygon.t', el).forEach((p) => p.classList.remove('on'));
    $$('circle.v', el).forEach((c) => { c.style.strokeDashoffset = c.getAttribute('stroke-dasharray'); });
    $$('polygon.t', el).forEach((p, i) => later(() => p.classList.add('on'), 700 + i * 350));
    later(() => $$('circle.v', el).forEach((c) => { c.style.strokeDashoffset = c.dataset.off; }), 1100);
  }

  /* ---------- 숫자 올라가기 · 꽃가루 ---------- */
  function countUp(node, to, ms) {
    const t0 = performance.now();
    const f = (now) => { const k = Math.min(1, (now - t0) / ms); node.textContent = Math.round(to * ease(k)); if (k < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }
  const cv = $('#confetti'), cx = cv.getContext('2d');
  let parts = [], raf = 0;
  function confetti(x, y, n) {
    const cols = ['#E4F218', '#FFFFFF'].concat(D.teams.map((t) => t.color));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 6 + Math.random() * 14;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 8, r: Math.random() * 6.28, vr: (Math.random() - .5) * .3, w: 10 + Math.random() * 12, h: 6 + Math.random() * 8, c: cols[i % cols.length], life: 0 });
    }
    if (!raf) raf = requestAnimationFrame(draw);
  }
  function draw() {
    cx.clearRect(0, 0, 1920, 1080);
    parts = parts.filter((p) => p.life < 200 && p.y < 1150);
    parts.forEach((p) => {
      p.life++; p.vy += .35; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c; cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore();
    });
    raf = parts.length ? requestAnimationFrame(draw) : 0;
  }

  /* ---------- 슬라이드 엔진 ---------- */
  let slides = [], cur = -1;
  function render() {
    slides = buildSlides();
    $('#slides').innerHTML = slides.map((s, i) => `<section class="slide ${s.cls}" data-i="${i}" style="${s.style || ''}">${s.html}</section>`).join('');
    slides.forEach((s, i) => { s.el = $(`.slide[data-i="${i}"]`); });
  }
  function go(i, force) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    if (i === cur && !force) return;
    clearTimers();
    const prev = slides[cur];
    if (prev && prev.el) { prev.el.classList.remove('active'); prev.leave && prev.leave(prev.el); }
    cur = i;
    const s = slides[i];
    void s.el.offsetWidth;
    s.el.classList.add('active');
    s.enter && s.enter(s.el);
    const band = (s.band || 'SK LIKER ✦ ').repeat(6);
    $('#band').textContent = band + band;
    $('#pg').innerHTML = `${String(i + 1).padStart(2, '0')}<small>/${slides.length}</small>`;
    $('#prog').style.width = ((i + 1) / slides.length) * 100 + '%';
    history.replaceState(null, '', '#' + (i + 1));
  }
  const idxOf = (g) => slides.findIndex((s) => s.group === g);
  function fit() { const s = Math.min(innerWidth / 1920, innerHeight / 1080); stage.style.transform = `scale(${s})`; }
  addEventListener('resize', fit);

  function start(data) {
    D = data;
    const keep = cur;
    render();
    cur = -1;
    go(keep >= 0 ? Math.min(keep, slides.length - 1) : Math.max(0, (parseInt(location.hash.slice(1), 10) || 1) - 1), true);
  }

  document.addEventListener('keydown', (e) => {
    const k = e.key;
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); go(cur + 1); }
    else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); go(cur - 1); }
    else if (k === 'Home') go(0);
    else if (k === 'End') go(slides.length - 1);
    else if (k === 'r' || k === 'R') go(cur, true);
    else if (k === 'f' || k === 'F') { if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); else document.exitFullscreen && document.exitFullscreen(); }
    else if (k === 'p' || k === 'P') go(idxOf('spot'));
    else if (k === 'm' || k === 'M') go(idxOf('map'));
    else if (k === 't' || k === 'T') go(idxOf('draft'));
    else if (k === 'b' || k === 'B') go(idxOf('bal'));
  });
  stage.addEventListener('click', (e) => { const r = stage.getBoundingClientRect(); if (e.clientX > r.left + r.width / 2) go(cur + 1); else go(cur - 1); });

  // players.csv · meta.json 끌어다 놓기
  const drop = $('#drop'), toast = $('#toast');
  const say = (m) => { toast.textContent = m; toast.classList.add('on'); setTimeout(() => toast.classList.remove('on'), 2600); };
  addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('on'); });
  addEventListener('dragleave', (e) => { if (e.target === drop) drop.classList.remove('on'); });
  addEventListener('drop', async (e) => {
    e.preventDefault(); drop.classList.remove('on');
    let meta = D.meta, csv = null;
    for (const f of e.dataTransfer.files) {
      const text = SKLCSV.decode(await f.arrayBuffer());
      if (/\.json$/i.test(f.name)) { try { meta = JSON.parse(text); } catch (err) { say('meta.json을 읽지 못했어요'); return; } }
      else csv = text;
    }
    try { start(load(meta, csv || window.SKL_SLIDES_DATA.csv)); say('새 데이터로 바꿨어요'); } catch (err) { say('파일을 읽지 못했어요: ' + err.message); }
  });

  fit();
  start(load(window.SKL_SLIDES_DATA.meta, window.SKL_SLIDES_DATA.csv));
})();
