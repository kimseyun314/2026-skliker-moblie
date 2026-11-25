/* 관리 페이지: 선수 추가·수정, 팀 배정, QR 생성, 저장(로컬 / 파일 / GitHub) */
(async function () {
  'use strict';
  const { TYPES, QUESTIONS, QUESTION_OFFSET } = SKL;
  const { esc, avatar } = SKLView;
  const $ = (s) => document.querySelector(s);
  const GH_KEY = 'skl-gh-v1', TOKEN_KEY = 'skl-gh-token';

  /* ---------- 상태 불러오기 ---------- */
  let state = SKLStore.readLocal();
  if (!state) {
    try { state = await SKLStore.fetchPublic(); toast('사이트의 players.csv로 시작했어요'); }
    catch (e) { state = { meta: {}, players: [] }; }
  }
  state.meta = Object.assign({ club: 'SK라이커', season: 2026, event: '시즌 클로징 데이', eventEn: 'SEASON CLOSING DAY', teamCount: 2, teams: [], mobileUrl: '' }, state.meta || {});
  state.players = state.players || [];
  state.pending = state.pending || [];
  /** 새 선수 ID: players.csv에 미리 만들어둔 빈 ID(이미 인쇄한 QR)부터 순서대로 써요 */
  function nextId() {
    while (state.pending.length) {
      const id = state.pending.shift();
      if (!state.players.some((q) => q.id === id)) return id;
    }
    let id; do { id = SKL.newId(); } while (state.players.some((q) => q.id === id));
    return id;
  }

  const defaultMobileUrl = () => (window.SKL_CONFIG && SKL_CONFIG.siteUrl) || new URL('../../', location.href).href;
  const mobileUrl = () => state.meta.mobileUrl || defaultMobileUrl();
  const metaForQR = () => Object.assign({}, state.meta, { mobileUrl: mobileUrl() });

  function save(msg) {
    SKLStore.writeLocal(state);
    const t = new Date();
    $('#status').textContent = `이 브라우저에 자동 저장됨 · ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
    if (msg) toast(msg);
  }
  function toast(m) {
    const el = $('#toast'); el.textContent = m; el.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 2400);
  }

  /* ---------- ① 행사 설정 ---------- */
  function renderMeta() {
    const m = state.meta;
    $('#mClub').value = m.club || ''; $('#mSeason').value = m.season || '';
    $('#mEvent').value = m.event || ''; $('#mEventEn').value = m.eventEn || '';
    $('#mTeamCount').value = String(m.teamCount || 2);
    $('#mMobileUrl').value = m.mobileUrl || '';
    $('#mMobileUrl').placeholder = defaultMobileUrl();
    renderTeams(); urlHint();
  }
  function renderTeams() {
    const teams = SKL.teamsOf(state.meta);
    $('#teamEdit').innerHTML = teams.map((t, i) => `<div class="tm"><input type="color" data-ti="${i}" data-k="color" value="${t.color}"><input type="text" data-ti="${i}" data-k="name" value="${esc(t.name)}"></div>`).join('');
  }
  function urlHint() {
    const u = mobileUrl();
    const local = /localhost|127\.0\.0\.1|file:/.test(u);
    $('#urlHint').className = local ? 'warn' : '';
    $('#urlHint').textContent = local
      ? `지금 QR은 ${u} 로 만들어져요. 이 컴퓨터에서만 열리는 주소라 인쇄 전에 GitHub Pages 주소로 바꿔주세요.`
      : `QR 예시: ${SKL.qrUrl(metaForQR(), 'abc123')}`;
  }
  ['mClub', 'mSeason', 'mEvent', 'mEventEn'].forEach((id) => $('#' + id).addEventListener('input', (e) => {
    const k = { mClub: 'club', mSeason: 'season', mEvent: 'event', mEventEn: 'eventEn' }[id];
    state.meta[k] = id === 'mSeason' ? Number(e.target.value) || '' : e.target.value;
    save();
  }));
  $('#mTeamCount').addEventListener('change', (e) => {
    state.meta.teamCount = Number(e.target.value);
    renderTeams(); renderPlayers(); save('팀 수가 바뀌었어요. "팀 자동 배정"을 다시 눌러주세요');
  });
  $('#teamEdit').addEventListener('input', (e) => {
    const i = Number(e.target.dataset.ti), k = e.target.dataset.k;
    if (Number.isNaN(i)) return;
    const teams = SKL.teamsOf(state.meta);
    state.meta.teams = teams.map((t) => ({ name: t.name, color: t.color }));
    state.meta.teams[i][k] = e.target.value;
    renderPlayers(); save();
  });
  $('#mMobileUrl').addEventListener('change', (e) => {
    let v = e.target.value.trim();
    if (v && !/^https?:\/\//.test(v)) v = 'https://' + v;
    state.meta.mobileUrl = v; e.target.value = v;
    urlHint(); renderQR(); save('QR 주소를 바꿨어요');
  });
  $('#fillUrl').addEventListener('click', () => {
    state.meta.mobileUrl = defaultMobileUrl();
    $('#mMobileUrl').value = state.meta.mobileUrl;
    urlHint(); renderQR(); save();
  });

  /* ---------- ② 선수 표 ---------- */
  const ROLE_OPTS = ['PIVO', 'ALA', 'FIXO', 'GOLEIRO', 'CHEER'];
  const PLAY_KO = { full: '풀타임', half: '절반', cheer: '응원' };
  function renderPlayers() {
    const teams = SKL.teamsOf(state.meta);
    $('#pCount').textContent = `${state.players.length}명`;
    if (!state.players.length) {
      $('#pBody').innerHTML = `<tr><td colspan="10" class="empty">아직 선수가 없어요. "+ 선수 추가"나 "구글폼 응답 붙여넣기"로 시작하세요.</td></tr>`;
      renderQR(); return;
    }
    $('#pBody').innerHTML = state.players.map((raw) => {
      const p = SKL.enrich(Object.assign({}, raw, { photo: SKLStore.resolvePhoto(raw.photo) }), SKL.medians(state.meta));
      const c = TYPES[p.type].color;
      const teamSel = `<select data-id="${p.id}" data-k="team"><option value="">미배정</option>${teams.map((t, i) => `<option value="${i}" ${raw.team === i ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>`;
      const roleSel = `<select data-id="${p.id}" data-k="role"><option value="">-</option>${ROLE_OPTS.map((r) => `<option ${raw.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>`;
      return `<tr style="--c:${c}"><td>${avatar(p)}</td>
        <td><b>${esc(p.nickname)}</b> <span class="muted">${esc(raw.name || '')}</span></td>
        <td>${esc(p.number)}</td><td><span class="badge">${p.type}</span></td>
        <td class="muted">${p.x} / ${p.y}</td><td>${teamSel}</td><td>${roleSel}</td>
        <td class="muted">${PLAY_KO[p.play] || '-'}</td><td class="idc">${esc(p.id)}</td>
        <td><div class="act"><button class="ghost sm" data-edit="${p.id}">수정</button><button class="ghost sm danger" data-del="${p.id}">삭제</button></div></td></tr>`;
    }).join('');
    renderQR();
  }
  $('#pBody').addEventListener('change', (e) => {
    const id = e.target.dataset.id, k = e.target.dataset.k;
    const p = state.players.find((q) => q.id === id);
    if (!p) return;
    if (k === 'team') p.team = e.target.value === '' ? undefined : Number(e.target.value);
    if (k === 'role') p.role = e.target.value || undefined;
    save();
  });
  $('#pBody').addEventListener('click', (e) => {
    const ed = e.target.dataset.edit, del = e.target.dataset.del;
    if (ed) openEdit(ed);
    if (del) {
      const p = state.players.find((q) => q.id === del);
      if (confirm(`${p.nickname} 선수를 삭제할까요?\n이미 인쇄한 이 선수의 QR(${p.id})은 더 이상 열리지 않아요.`)) {
        state.players = state.players.filter((q) => q.id !== del);
        renderPlayers(); save('삭제했어요');
      }
    }
  });
  $('#btnAssign').addEventListener('click', () => {
    if (state.players.length < 2) return toast('선수가 2명 이상 필요해요');
    const has = state.players.some((p) => p.team !== undefined);
    if (has && !confirm('지금 팀·포지션을 지우고 새로 배정할까요?')) return;
    autoAssign();
    renderPlayers(); save('팀을 배정했어요');
  });
  function autoAssign() {
    const res = SKL.assignTeams(state.players, state.meta.teamCount, SKL.medians(state.meta));
    state.players.forEach((p) => Object.assign(p, res[p.id] || {}));
  }

  /* ---------- 선수 편집 ---------- */
  let editingId = null, photoData = '';
  $('#qs').innerHTML = QUESTIONS.map((q, i) => `<div class="q">
      <div class="n">${esc(q[0])}</div><div class="t">${esc(q[1])} ↔ ${esc(q[2])}</div>
      <div class="sp"></div>
      ${[1, 2, 3, 4].map((n) => `<label class="opt"><input type="radio" name="q${i}" value="${n}"> ${n}${n === 1 ? ' ' + esc(q[1]) : n === 4 ? ' ' + esc(q[2]) : ''}</label>`).join('')}</div>`).join('');

  function openEdit(id) {
    editingId = id || null;
    const f = $('#editForm');
    f.reset();
    const p = id ? state.players.find((q) => q.id === id) : null;
    $('#editTitle').textContent = p ? `선수 수정 · QR ID ${p.id}` : '선수 추가';
    const used = state.players.map((q) => Number(q.number));
    const v = p || { name: '', nickname: '', number: [...Array(99).keys()].map((n) => n + 1).find((n) => !used.includes(n)), nameEn: '', moment: '', gk: 'ok', play: 'full', exp: 0, answers: '' };
    ['name', 'nickname', 'number', 'nameEn', 'moment', 'gk', 'play'].forEach((k) => { f.elements[k].value = v[k] == null ? '' : v[k]; });
    f.elements.exp.value = String(v.exp || 0);
    const { a } = SKL.normalizeAnswers(v.answers);
    const has = String(v.answers || '').replace(/[^1-4AB]/gi, '');
    for (let i = 0; i < 12; i++) {
      const val = i < has.length ? String(a[i]) : null;
      f.querySelectorAll(`input[name=q${i}]`).forEach((r) => { r.checked = r.value === val; });
    }
    photoData = v.photo || '';
    showPhoto(); preview();
    $('#editModal').classList.add('show');
    setTimeout(() => f.elements.nickname.focus(), 50);
  }
  function readAnswers() {
    let s = '', missing = 0;
    for (let i = 0; i < 12; i++) {
      const r = $(`#editForm input[name=q${i}]:checked`);
      if (!r) missing++;
      s += r ? r.value : '3';
    }
    return { s, missing };
  }
  function preview() {
    const { s, missing } = readAnswers();
    const e = SKL.enrich({ answers: s }, SKL.medians(state.meta));
    $('#typePreview').innerHTML = `<span class="badge" style="--c:${TYPES[e.type].color}">${e.type}</span>${esc(e.subtype)} · 도전 ${e.x}/18 · 주도 ${e.y}/18${missing ? ` <small class="warn">(${missing}문항 미응답 → 3으로 계산)</small>` : ''}`;
  }
  function showPhoto() {
    const el = $('#phPrev');
    el.style.backgroundImage = photoData ? `url('${SKLStore.resolvePhoto(photoData)}')` : '';
    $('#phPath').value = photoData && !photoData.startsWith('data:') ? photoData : '';
    el.textContent = photoData ? '' : '📷';
  }
  $('#qs').addEventListener('change', preview);
  $('#phFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    photoData = await resizeImage(file, 480, 0.82);
    showPhoto(); e.target.value = '';
  });
  $('#phClear').addEventListener('click', () => { photoData = ''; showPhoto(); });
  $('#phPath').addEventListener('change', (e) => { photoData = e.target.value.trim(); showPhoto(); });
  $('#editCancel').addEventListener('click', () => $('#editModal').classList.remove('show'));
  $('#editForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const { s } = readAnswers();
    const data = {
      name: f.elements.name.value.trim(),
      nickname: f.elements.nickname.value.trim(),
      number: f.elements.number.value === '' ? '' : Number(f.elements.number.value),
      nameEn: f.elements.nameEn.value.trim(),
      moment: f.elements.moment.value.trim(),
      photo: photoData,
      answers: s,
      gk: f.elements.gk.value, play: f.elements.play.value, exp: Number(f.elements.exp.value),
    };
    const dup = state.players.find((q) => q.id !== editingId && data.number !== '' && Number(q.number) === data.number);
    if (dup && !confirm(`등번호 ${data.number}번은 ${dup.nickname} 선수와 겹쳐요. 그대로 저장할까요?`)) return;
    if (editingId) {
      Object.assign(state.players.find((q) => q.id === editingId), data);
    } else {
      const id = nextId();
      state.players.push(Object.assign({ id }, data));
    }
    $('#editModal').classList.remove('show');
    renderPlayers(); save(editingId ? '수정했어요' : '선수를 추가했어요. 팀 배정을 다시 해주세요');
  });
  $('#btnAdd').addEventListener('click', () => openEdit(null));

  function resizeImage(file, max, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const r = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  /* ---------- 구글폼 붙여넣기 ---------- */
  $('#btnImport').addEventListener('click', () => { $('#importMsg').textContent = ''; $('#importModal').classList.add('show'); });
  $('#importCancel').addEventListener('click', () => $('#importModal').classList.remove('show'));
  let lastImport = null;
  $('#importRun').addEventListener('click', () => {
    const msg = $('#importMsg');
    try {
      const r = importTable($('#importText').value);
      lastImport = r;
      msg.className = 'ghmsg ' + (r.warnings.length ? 'err' : 'ok');
      msg.innerHTML = `새로 등록 ${r.log.added.length}명 · 업데이트 ${r.log.updated.length}명 · 남은 빈 QR ${r.pending}개<br>`
        + `기준선 도전 ${r.meta.medBold} · 주도 ${r.meta.medSolve} · ` + SKL.TYPE_ORDER.map((t) => `${t} ${r.report.typeCount[t]}`).join(' · ')
        + ' · 팀 배정 완료'
        + (r.warnings.length ? '<br><b>확인할 것</b><br>' + r.warnings.map((w) => '· ' + esc(w)).join('<br>') : '');
      $('#importReport').style.display = '';
      renderMeta(); renderTeams(); renderPlayers(); save('구글폼 응답을 분석해서 넣었어요');
    } catch (e) {
      msg.className = 'ghmsg err'; msg.textContent = e.message;
    }
  });
  $('#importReport').addEventListener('click', () => { if (lastImport) downloadText(lastImport.reportMd, `분석리포트_${stamp()}.md`); });

  /** 구글폼 응답 → shared/formimport.js (Node 스크립트와 같은 로직) */
  function importTable(text) {
    const rows = state.players.concat((state.pending || []).filter((id) => !state.players.some((p) => p.id === id)).map((id) => ({ id })));
    const out = SKLForm.run({
      formText: text.trim(),
      playersCsv: SKLCSV.fromPlayers(rows, SKL.teamsOf(state.meta)),
      rosterCsv: SKLForm.rosterCsv(state.players),
      meta: state.meta,
    });
    const prev = new Map(state.players.map((p) => [p.id, p]));
    const parsed = SKLForm.readPlayersCsv(out.playersCsv);
    state.players = parsed.filter((p) => p.nickname).map((p) => {
      const full = out.players.find((q) => q.id === p.id) || {};
      const old = prev.get(p.id) || {};
      return Object.assign({}, old, p, {
        name: full.name || old.name || '', exp: full.exp != null ? full.exp : old.exp,
        photo: old.photo || p.photo || '', emoji: full.emoji || old.emoji || '',
        team: typeof full.team === 'number' ? full.team : p.team, role: full.role || p.role,
      });
    });
    state.pending = parsed.filter((p) => !p.nickname).map((p) => p.id);
    state.meta = Object.assign({}, state.meta, { medBold: out.meta.medBold, medSolve: out.meta.medSolve });
    return out;
  }

  /* ---------- ③ QR ---------- */
  function renderQR() {
    const meta = metaForQR();
    $('#qrGrid').innerHTML = state.players.map((p) => {
      const url = SKL.qrUrl(meta, p.id);
      return `<div class="qri"><img src="${SKLQR.dataUrl(url, 280)}" alt="QR"><b>${esc(p.nickname)} <span class="muted">#${esc(p.number)}</span></b>
        <div class="u">${esc(url)}</div>
        <div class="act"><button class="ghost sm" data-qrdl="${p.id}">PNG 저장</button><a class="ghost sm" style="text-decoration:none;border:1px solid #D9CCE6;border-radius:10px;padding:6px 10px;font-weight:700;font-size:12.5px;color:#3B1466" href="../../?src=local&p=${encodeURIComponent(p.id)}" target="_blank">열어보기</a></div></div>`;
    }).join('') || '<div class="empty">선수를 추가하면 QR이 여기 생겨요.</div>';
  }
  const qrName = (p) => `QR_${String(p.number).padStart(2, '0')}_${p.nickname}_${p.id}.png`;
  $('#qrGrid').addEventListener('click', (e) => {
    const id = e.target.dataset.qrdl;
    if (!id) return;
    const p = state.players.find((q) => q.id === id);
    SKLQR.download(SKL.qrUrl(metaForQR(), id), qrName(p));
  });
  $('#qrAll').addEventListener('click', async () => {
    for (const p of state.players) {
      SKLQR.download(SKL.qrUrl(metaForQR(), p.id), qrName(p));
      await new Promise((r) => setTimeout(r, 350));
    }
  });

  /* ---------- ④ 배포 / 백업 ---------- */
  function ensureTeams() {
    if (state.players.some((p) => p.team === undefined || p.team === null || p.team === '')) {
      autoAssign(); renderPlayers(); save();
      toast('팀이 비어 있는 선수가 있어서 자동 배정했어요');
    }
  }
  /** 배포용 선수 표 (실명·구력은 빠져요) */
  function publicCsv() {
    ensureTeams();
    const pub = SKL.toPublic({ meta: state.meta, players: state.players });
    const rest = (state.pending || []).map((id) => ({ id })); // 아직 안 채운 QR 줄도 유지
    return SKLCSV.fromPlayers(pub.players.concat(rest), SKL.teamsOf(state.meta));
  }
  function publicMeta() {
    const m = Object.assign({}, state.meta);
    m.teams = SKL.teamsOf(state.meta);
    return JSON.stringify(m, null, 2) + '\n';
  }
  function downloadText(text, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: name.endsWith('.csv') ? 'text/csv;charset=utf-8' : 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const stamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');
  $('#dlPublic').addEventListener('click', () => downloadText(publicCsv(), 'players.csv'));
  $('#dlMeta').addEventListener('click', () => downloadText(publicMeta(), 'meta.json'));
  $('#dlAnalysis').addEventListener('click', () => {
    ensureTeams();
    const an = SKLForm.analyze(state.players.map((p) => Object.assign({}, p)), state.meta, { keepTeams: true, fixedMedian: true });
    downloadText(JSON.stringify(SKLForm.publicReport(an.report), null, 2) + '\n', 'analysis.json');
  });
  $('#dlBackup').addEventListener('click', () => downloadText(JSON.stringify(state, null, 2), `skliker-admin-backup-${stamp()}.json`));
  $('#ulBackup').addEventListener('click', () => $('#backupFile').click());
  $('#backupFile').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!Array.isArray(d.players)) throw new Error('players 목록이 없어요');
      if (!confirm(`백업의 선수 ${d.players.length}명으로 바꿀까요? 지금 데이터는 사라져요.`)) return;
      state = d; state.meta = state.meta || {};
      renderMeta(); renderPlayers(); save('백업을 불러왔어요');
    } catch (err) { alert('백업 파일을 읽지 못했어요: ' + err.message); }
    e.target.value = '';
  });
  $('#loadPublic').addEventListener('click', async () => {
    if (!confirm('사이트에 올라가 있는 players.csv로 다시 시작할까요? 실명·구력처럼 배포 파일에 없는 정보는 사라져요.')) return;
    try {
      state = await SKLStore.fetchPublic();
      state.players.forEach((p) => { delete p.qrUrl; });
      renderMeta(); renderPlayers(); save('사이트 데이터를 불러왔어요');
    } catch (e) { alert(e.message); }
  });

  // GitHub 바로 저장
  const gh = Object.assign({ owner: '', repo: '', branch: 'main', path: 'data/players.csv' }, JSON.parse(localStorage.getItem(GH_KEY) || '{}'));
  if (!gh.owner && location.hostname.endsWith('github.io')) {
    gh.owner = location.hostname.split('.')[0];
    gh.repo = location.pathname.split('/').filter(Boolean)[0] || '';
  }
  $('#ghOwner').value = gh.owner; $('#ghRepo').value = gh.repo; $('#ghBranch').value = gh.branch; $('#ghPath').value = gh.path;
  const savedToken = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
  $('#ghToken').value = savedToken; $('#ghRemember').checked = !!localStorage.getItem(TOKEN_KEY);

  function b64utf8(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  $('#ghSave').addEventListener('click', async () => {
    const msg = $('#ghMsg');
    const cfg = { owner: $('#ghOwner').value.trim(), repo: $('#ghRepo').value.trim(), branch: $('#ghBranch').value.trim() || 'main', path: ($('#ghPath').value.trim() || 'data/players.csv').replace(/^\/+/, '') };
    const token = $('#ghToken').value.trim();
    if (!cfg.owner || !cfg.repo || !token) { msg.className = 'ghmsg err'; msg.textContent = '계정, 저장소, 토큰을 모두 입력해주세요.'; return; }
    localStorage.setItem(GH_KEY, JSON.stringify(cfg));
    localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY);
    ($('#ghRemember').checked ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);

    const apiOf = (path) => `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    msg.className = 'ghmsg'; msg.textContent = '저장 중…';
    async function put(path, text, message) {
      const api = apiOf(path);
      let sha;
      const g = await fetch(`${api}?ref=${encodeURIComponent(cfg.branch)}`, { headers });
      if (g.ok) sha = (await g.json()).sha;
      else if (g.status !== 404) throw new Error(await ghError(g));
      const body = { message, content: b64utf8(text), branch: cfg.branch };
      if (sha) body.sha = sha;
      const r = await fetch(api, { method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await ghError(r));
      return r.json();
    }
    try {
      const metaPath = cfg.path.replace(/[^/]*$/, 'meta.json');
      await put(metaPath, publicMeta(), '행사 설정 업데이트');
      const j = await put(cfg.path, publicCsv(), `선수 데이터 업데이트 (${state.players.length}명)`);
      msg.className = 'ghmsg ok';
      msg.textContent = `저장했어요 ✓ (커밋 ${j.commit.sha.slice(0, 7)})\n1~2분 뒤 사이트에 반영돼요.`;
    } catch (e) {
      msg.className = 'ghmsg err'; msg.textContent = '저장하지 못했어요: ' + e.message;
    }
  });
  async function ghError(res) {
    let m = '';
    try { m = (await res.json()).message; } catch (e) { /* ignore */ }
    if (res.status === 401) return '토큰이 올바르지 않거나 만료됐어요 (401)';
    if (res.status === 403) return `권한이 없어요. 토큰에 이 저장소의 Contents 쓰기 권한이 있는지 확인해주세요 (403${m ? ': ' + m : ''})`;
    if (res.status === 404) return '저장소나 브랜치를 찾지 못했어요. 계정·저장소 이름을 확인해주세요 (404)';
    if (res.status === 409 || res.status === 422) return `파일이 그사이 바뀌었어요. 다시 눌러주세요 (${res.status}${m ? ': ' + m : ''})`;
    return `${res.status} ${m}`;
  }

  /* ---------- 미리보기 링크 ---------- */
  $('#lnMobile').href = '../../?src=local';
  $('#lnCards').href = '../cards/?src=local';

  renderMeta(); renderPlayers();
  SKLStore.writeLocal(state);
  $('#status').textContent = `이 브라우저에 저장된 데이터 · 선수 ${state.players.length}명`;
})();
