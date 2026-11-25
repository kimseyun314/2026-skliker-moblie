/*
 * 구글폼 응답 → players.csv · meta.json · 분석 데이터
 *
 * 관리 도구(브라우저)와 tools/import/form2players.js(Node)가 같은 로직을 써요.
 *
 * 흐름
 *   1. readForm()   구글폼 응답 표(CSV/시트 복사)를 읽어 응답자 목록으로 바꿔요
 *   2. merge()      기존 players.csv의 QR ID에 응답자를 붙여요
 *                   (같은 사람 = 실명 명단 → 닉네임 순으로 찾고, 새 사람은 빈 ID 순서대로)
 *   3. analyze()    참가자 중앙값으로 기준선을 다시 잡고, 유형·세부 유형·태그·능력치·팀을 계산해요
 */
(function (root) {
  'use strict';
  const SKL = root.SKL || (typeof require !== 'undefined' ? require('./logic.js') : null);
  const SKLCSV = root.SKLCSV || (typeof require !== 'undefined' ? require('./csv.js') : null);

  // 설문 성향 문항 제목 (문항지 순서). 제목이 조금 달라도 아래 "숫자 열" 규칙으로 찾아요.
  const SCALE_TITLES = [
    '주말에 갑자기 시간이 비었다', '처음 가는 모임에서 나는', '처음 해보는 일을 맡았을 때',
    '메뉴를 고를 때 나는', '중요한 결정을 내릴 때 나는', '약속 직전에 계획이 바뀌었다',
    '팀으로 일할 때 내가 편한 역할은', '친구가 고민을 털어놓으면 나는', '더 듣고 싶은 칭찬은',
    '모임에서 의견이 갈리면 나는', '마감 직전에 일이 꼬였다', '내가 더 뿌듯한 순간은',
  ];

  const clean = (h) => String(h || '').replace(/^﻿/, '').replace(/^\s*Q?\d+[.)]\s*/i, '').trim();
  const squash = (s) => String(s || '').replace(/\s/g, '');

  // 기본 정보 열: 제목에 들어 있는 낱말로 찾아요
  const FIELDS = {
    ts: (h) => /타임스탬프|timestamp/i.test(h),
    email: (h) => /이메일|email/i.test(h),
    nickname: (h) => h.includes('닉네임'),
    name: (h) => /^이름/.test(h) && !h.includes('닉네임'),
    number: (h) => h.includes('등번호'),
    nameEn: (h) => h.includes('영문'),
    emoji: (h) => h.includes('이모지'),
    moment: (h) => /최고의\s*순간|하이라이트/.test(h),
    photo: (h) => h.includes('사진'),
    gk: (h) => h.includes('골키퍼'),
    play: (h) => /뛸\s*수|당일\s*참여/.test(h),
    exp: (h) => h.includes('구력'),
  };

  /** 성향 답 한 칸 → '1'~'4' (선형 배율 숫자, 예전 A/B 보기도 허용). 못 읽으면 '' */
  function scaleValue(v) {
    const s = String(v || '').trim();
    let m = s.match(/^([1-4])(\s|$|\D)/);
    if (m) return m[1];
    if (/^A([.\s)]|$)/i.test(s)) return '1';
    if (/^B([.\s)]|$)/i.test(s)) return '4';
    return '';
  }
  const GK = (v) => (/피하|no/i.test(v) ? 'no' : /좋아|맡겨|yes/i.test(v) ? 'yes' : 'ok');
  const PLAY = (v) => (/응원|진행|cheer/i.test(v) ? 'cheer' : /절반|half/i.test(v) ? 'half' : 'full');
  const EXP = (v) => (/이상/.test(v) ? 2 : /1\s*~\s*2/.test(v) ? 1 : 0);

  /**
   * 구글폼 응답 표 → { responses, columns, warnings }
   * responses: [{ row, name, nickname, number, emoji, moment, photoLink, answers, gk, play, exp, ts }]
   */
  function readForm(text) {
    const rows = SKLCSV.parse(String(text || '').replace(/^﻿/, ''));
    if (rows.length < 2) throw new Error('제목 행과 응답 행이 모두 필요해요. 구글 시트에서 제목 행까지 포함해 내보내 주세요.');
    const head = rows[0].map(clean);
    const body = rows.slice(1);
    const used = new Set();
    const idx = {};
    Object.keys(FIELDS).forEach((k) => {
      idx[k] = head.findIndex((h, i) => !used.has(i) && FIELDS[k](h));
      if (idx[k] >= 0) used.add(idx[k]);
    });

    // 성향 12문항: ① 제목이 문항지와 같은 열 → ② 1~4만 들어 있는 나머지 열을 왼쪽부터
    let q = SCALE_TITLES.map((t) => head.findIndex((h, i) => !used.has(i) && squash(h).startsWith(squash(t))));
    if (q.some((i) => i < 0)) {
      const numeric = head.map((_, i) => i).filter((i) => !used.has(i) && !q.includes(i)
        && body.some((r) => String(r[i] || '').trim())
        && body.every((r) => !String(r[i] || '').trim() || scaleValue(r[i])));
      let n = 0;
      q = q.map((i) => (i >= 0 ? i : (numeric[n++] ?? -1)));
      q.sort((a, b) => (a < 0) - (b < 0) || a - b); // 설문 순서 = 열 순서
    }
    const missing = [];
    if (idx.nickname < 0 && idx.name < 0) missing.push('닉네임');
    q.forEach((i, k) => { if (i < 0) missing.push(`성향 ${k + 1}번`); });
    if (missing.length) {
      throw new Error(`이 열을 찾지 못했어요: ${missing.join(', ')}. 성향 문항은 1~4 숫자 응답 열 12개가 있어야 해요.`);
    }

    const warnings = [];
    const pick = (r, k) => (idx[k] >= 0 ? String(r[idx[k]] == null ? '' : r[idx[k]]).trim() : '');
    const responses = [];
    body.forEach((r, n) => {
      const name = pick(r, 'name');
      const nickname = pick(r, 'nickname') || name;
      if (!nickname) return;
      const vals = q.map((i) => scaleValue(r[i]));
      const blank = vals.filter((v) => !v).length;
      if (blank) warnings.push(`${nickname}: 성향 문항 ${blank}개가 비어 있어서 중간값(3)으로 채웠어요`);
      const a = vals.map((v) => v || '3').join('');
      const num = pick(r, 'number').replace(/[^0-9]/g, '');
      responses.push({
        row: n + 2, ts: pick(r, 'ts'), name, nickname,
        number: num === '' ? '' : Number(num),
        nameEn: pick(r, 'nameEn'), emoji: pick(r, 'emoji'), moment: pick(r, 'moment'),
        photoLink: pick(r, 'photo'),
        answers: a.slice(0, 6) + ' ' + a.slice(6),
        gk: GK(pick(r, 'gk')), play: PLAY(pick(r, 'play')), exp: EXP(pick(r, 'exp')),
        _gkRaw: pick(r, 'gk'), _playRaw: pick(r, 'play'),
      });
    });

    // 같은 사람이 여러 번 냈으면 마지막 응답만 (실명 → 닉네임 기준)
    const byKey = new Map();
    responses.forEach((p) => {
      const key = squash(p.name) || 'nick:' + squash(p.nickname);
      if (byKey.has(key)) warnings.push(`${p.name || p.nickname}: 응답이 여러 번 있어서 마지막(${p.row}번째 줄) 응답을 썼어요`);
      byKey.set(key, p);
    });
    const columns = { info: idx, scale: q, headers: head };
    return { responses: Array.from(byKey.values()).sort((a, b) => a.row - b.row), columns, warnings };
  }

  /** players.csv 글자 → 줄 순서를 지킨 [{id, ...}] (닉네임이 빈 줄 = 아직 안 쓴 QR) */
  function readPlayersCsv(text) {
    if (!text) return [];
    const parsed = SKLCSV.toPlayers(text);
    const filled = new Map(parsed.players.map((p) => [p.id, p]));
    const rows = SKLCSV.parse(String(text).replace(/^﻿/, ''));
    const head = (rows[0] || []).map((h) => String(h).replace(/^﻿/, '').trim().toLowerCase());
    const ic = head.findIndex((h) => h === 'id' || h === 'qr' || h === 'qrid' || h === '아이디');
    return rows.slice(1).map((r) => String(r[ic] || '').trim()).filter(Boolean)
      .map((id) => filled.get(id) || { id });
  }

  /** 비공개 명단(roster.csv: 이름, 닉네임, ID, 구력) 글자 → [{name, nickname, id, exp}] */
  function readRoster(text) {
    if (!text) return [];
    const rows = SKLCSV.parse(String(text).replace(/^﻿/, ''));
    const h = (rows[0] || []).map((x) => String(x).trim());
    const at = (k) => h.indexOf(k);
    return rows.slice(1).map((r) => ({
      name: String(r[at('이름')] || '').trim(), nickname: String(r[at('닉네임')] || '').trim(),
      id: String(r[at('ID')] || '').trim(), exp: EXP(String(r[at('구력')] || '')),
    })).filter((x) => x.id);
  }
  function rosterCsv(players) {
    const expTxt = ['1년 미만', '1~2년', '2년 이상'];
    const cell = (v) => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const lines = ['이름,닉네임,ID,등번호,구력'];
    players.filter((p) => p.nickname).forEach((p) => lines.push([p.name, p.nickname, p.id, p.number, p.exp == null ? '' : expTxt[p.exp]].map(cell).join(',')));
    return '﻿' + lines.join('\r\n') + '\r\n';
  }

  /**
   * 기존 선수 줄 + 설문 응답 → 새 선수 줄
   * opts.roster: 비공개 명단(실명 → ID). 다시 돌려도 같은 사람은 같은 QR에 붙어요.
   * 반환: { players(줄 순서 유지, 빈 QR 포함), log: {added, updated, kept, extraIds}, warnings }
   */
  function merge(existing, responses, opts) {
    const o = opts || {};
    const roster = o.roster || [];
    const rows = existing.map((p) => Object.assign({}, p));
    const warnings = [];
    const log = { added: [], updated: [], kept: [], extraIds: [] };
    const taken = new Set();

    const findRow = (r) => {
      const fromRoster = roster.find((x) => r.name && squash(x.name) === squash(r.name));
      if (fromRoster) { const row = rows.find((p) => p.id === fromRoster.id); if (row && !taken.has(row.id)) return row; }
      return rows.find((p) => !taken.has(p.id) && p.nickname && squash(p.nickname) === squash(r.nickname));
    };

    const matched = [], fresh = [];
    responses.forEach((r) => { const row = findRow(r); if (row) { taken.add(row.id); matched.push([row, r]); } else fresh.push(r); });
    fresh.forEach((r) => {
      let row = rows.find((p) => !p.nickname && !taken.has(p.id));
      if (!row) {
        let id; do { id = SKL.newId(); } while (rows.some((p) => p.id === id));
        row = { id }; rows.push(row); log.extraIds.push(id);
        warnings.push(`${r.nickname}: 미리 만든 QR ID가 모자라서 새 ID(${id})를 만들었어요. 이 선수 QR은 새로 인쇄해야 해요`);
      }
      taken.add(row.id);
      matched.push([row, r]);
      log.added.push(r.nickname);
    });
    matched.forEach(([row, r]) => {
      if (row.nickname && !log.added.includes(r.nickname)) log.updated.push(r.nickname);
      Object.assign(row, {
        nickname: r.nickname, name: r.name, number: r.number, answers: r.answers,
        moment: r.moment || row.moment || '', gk: r.gk, play: r.play, exp: r.exp,
        emoji: r.emoji, photoLink: r.photoLink,
        nameEn: row.nameEn || r.nameEn || '', photo: row.photo || '',
        _fromForm: true,
      });
    });
    rows.forEach((p) => {
      if (p.nickname && !p._fromForm) {
        log.kept.push(p.nickname);
        const rs = roster.find((x) => x.id === p.id);
        if (rs) { p.name = p.name || rs.name; if (p.exp == null) p.exp = rs.exp; }
      }
    });

    // 닉네임 길이 · 등번호 겹침 (먼저 응답한 사람 우선)
    const order = rows.filter((p) => p.nickname).sort((a, b) => (a._fromForm ? 1 : 0) - (b._fromForm ? 1 : 0));
    const byRow = new Map(responses.map((r) => [squash(r.name) || squash(r.nickname), r.row]));
    const rowOf = (p) => byRow.get(squash(p.name) || squash(p.nickname)) || 0;
    order.sort((a, b) => rowOf(a) - rowOf(b));
    const nums = new Map();
    order.forEach((p) => {
      if ([...p.nickname].length > 10) warnings.push(`${p.nickname}: 닉네임이 10자를 넘어요. 카드에서 잘릴 수 있어요`);
      if (p.number === '' || p.number == null) { warnings.push(`${p.nickname}: 등번호가 없어요`); return; }
      if (p.number < 1 || p.number > 99) warnings.push(`${p.nickname}: 등번호 ${p.number}는 1~99 밖이에요`);
      const shared = (o.sharedNumbers || []).some((n) => squash(n) === squash(p.nickname));
      if (nums.has(p.number) && shared) { warnings.push(`${p.nickname}: 등번호 ${p.number}번을 ${nums.get(p.number)} 님과 같이 써요 (meta.json sharedNumbers)`); return; }
      if (nums.has(p.number)) {
        warnings.push(`${p.nickname}: 등번호 ${p.number}번이 ${nums.get(p.number)} 님과 겹쳐요 (먼저 응답한 ${nums.get(p.number)} 우선). 등번호 칸을 비워뒀어요`);
        p.number = '';
      } else nums.set(p.number, p.nickname);
    });
    return { players: rows, log, warnings };
  }

  /**
   * 분석: 기준선(참가자 중앙값) → 유형·세부 유형·태그·능력치 → 팀 배정
   * opts.keepTeams: 이미 팀·포지션이 적힌 선수는 그대로 둬요 (한 명이라도 비면 전체 재배정)
   * opts.fixedMedian: true면 meta.json의 기준선을 그대로 써요
   */
  function analyze(players, meta, opts) {
    const o = opts || {};
    const m = Object.assign({}, meta || {});
    const list = players.filter((p) => p.nickname);
    const sc = list.map((p) => SKL.scores(p.answers)).filter((s) => s.valid);
    if (!o.fixedMedian && sc.length) {
      m.medBold = SKL.median(sc.map((s) => s.x));
      m.medSolve = SKL.median(sc.map((s) => s.y));
    }
    const med = SKL.medians(m);
    const teams = SKL.teamsOf(m);

    const allSet = list.every((p) => p.team !== '' && p.team != null && p.role);
    let assigned = null;
    if (!(o.keepTeams && allSet)) assigned = SKL.assignTeams(list, m.teamCount, med);
    list.forEach((p) => {
      if (assigned && assigned[p.id]) { p.team = assigned[p.id].team; p.role = assigned[p.id].role; }
    });
    const resolved = SKL.resolveTeams(list, m);

    const rows = resolved.map((p) => {
      const e = SKL.enrich(Object.assign({}, p, { role: p.role || '' }), med);
      return {
        id: p.id, nickname: p.nickname, number: p.number, x: e.x, y: e.y,
        type: e.type, typeKo: SKL.TYPES[e.type].ko, typeNick: SKL.TYPES[e.type].nick, subtype: e.subtype, tags: e.tags, aff: e.aff, best: e.best,
        ability: SKL.TYPES[e.type].ability, line: SKL.TYPES[e.type].line,
        team: typeof p.team === 'number' ? p.team : null,
        teamName: typeof p.team === 'number' ? teams[p.team].name : '',
        role: e.role, play: p.play, gk: p.gk, valid: e.valid,
        // 아래는 비공개 리포트에서만 써요
        _name: p.name || '', _exp: p.exp,
      };
    });

    const typeCount = {};
    SKL.TYPE_ORDER.forEach((t) => { typeCount[t] = rows.filter((r) => r.type === t).length; });
    const avg = (a) => (a.length ? Math.round(a.reduce((s, v) => s + v, 0) / a.length * 10) / 10 : 0);
    const teamSummary = teams.map((t, i) => {
      const mem = rows.filter((r) => r.team === i);
      const field = mem.filter((r) => r.role !== 'CHEER');
      const roles = {};
      ['GOLEIRO', 'FIXO', 'ALA', 'PIVO', 'CHEER'].forEach((k) => { roles[k] = mem.filter((r) => r.role === k).length; });
      const types = {};
      SKL.TYPE_ORDER.forEach((k) => { types[k] = mem.filter((r) => r.type === k).length; });
      const abil = {};
      SKL.TYPE_ORDER.forEach((k) => { abil[k] = avg(field.map((r) => r.aff[k])); });
      return {
        index: i, name: t.name, color: t.color, size: mem.length, field: field.length,
        roles, types, avgChallenge: avg(field.map((r) => r.x)), avgLead: avg(field.map((r) => r.y)), ability: abil,
        members: mem.map((r) => r.id),
        _expSum: field.reduce((s, r) => s + (r._exp || 0), 0),
      };
    });

    const warnings = [];
    rows.forEach((r) => { if (!r.valid) warnings.push(`${r.nickname}: 성향 응답이 12개가 아니에요`); });
    teamSummary.forEach((t) => { if (t.field && !t.roles.GOLEIRO) warnings.push(`${t.name}: 골키퍼가 없어요`); });
    rows.filter((r) => r.role === 'GOLEIRO' && r.gk === 'no').forEach((r) => warnings.push(`${r.nickname}: 골키퍼를 피하고 싶다고 했는데 골키퍼로 배정됐어요`));

    return {
      meta: m,
      players: list,
      report: {
        generatedAt: new Date().toISOString(),
        count: rows.length, fieldCount: rows.filter((r) => r.role !== 'CHEER').length,
        axes: { x: '도전(Q1~Q6) ↔ 준비', y: '주도(Q7~Q12) ↔ 함께' },
        median: { challenge: med.mx, lead: med.my, source: o.fixedMedian ? 'meta.json' : 'participants' },
        typeCount,
        types: SKL.TYPE_ORDER.map((t) => ({ type: t, ko: SKL.TYPES[t].ko, nick: SKL.TYPES[t].nick, axis: SKL.TYPES[t].axis, ability: SKL.TYPES[t].ability, line: SKL.TYPES[t].line, keywords: SKL.TYPES[t].keywords, members: rows.filter((r) => r.type === t).map((r) => r.id) })),
        teams: teamSummary, players: rows,
      },
      warnings,
    };
  }

  /** 공개용 분석 데이터 (실명·구력 제거) */
  function publicReport(report) {
    const strip = (o) => { const c = {}; Object.keys(o).forEach((k) => { if (k[0] !== '_') c[k] = o[k]; }); return c; };
    return Object.assign({}, report, { players: report.players.map(strip), teams: report.teams.map(strip) });
  }

  /** 운영진용 마크다운 리포트 (실명·구력 포함, 저장소에 올리지 마세요) */
  function markdownReport(report, ctx) {
    const c = ctx || {};
    const R = report;
    const expTxt = ['1년 미만', '1~2년', '2년 이상'];
    const gkTxt = { yes: '좋아요', ok: '잠깐 OK', no: '피하고 싶음' };
    const playTxt = { full: '풀타임', half: '절반', cheer: '응원·진행' };
    const L = [];
    L.push(`# SK라이커 성향 검사 분석 리포트`, '', `> 운영진용 · 실명과 구력이 들어 있어요. 저장소에 올리지 마세요.  `, `> 생성: ${R.generatedAt.replace('T', ' ').slice(0, 16)} (UTC)`, '');
    L.push('## 요약', '');
    L.push(`- 응답 ${R.count}명 (필드 ${R.fieldCount}명, 응원·진행 ${R.count - R.fieldCount}명)`);
    if (c.log) L.push(`- 새로 등록 ${c.log.added.length}명 · 업데이트 ${c.log.updated.length}명 · 설문 없이 유지 ${c.log.kept.length}명 · 남은 빈 QR ${c.pending || 0}개`);
    L.push(`- 기준선(중앙값): 도전 **${R.median.challenge}** · 주도 **${R.median.lead}** ${R.median.source === 'participants' ? '(참가자 중앙값으로 계산)' : '(meta.json 고정값)'}`);
    L.push(`- 유형 분포: ${SKL.TYPE_ORDER.map((t) => `${SKL.TYPES[t].ko}(${SKL.TYPES[t].nick}) ${R.typeCount[t]}명`).join(' · ')}`, '');
    L.push('## 선수별 결과', '');
    L.push('| 이름 | 닉네임 | 등번호 | QR ID | 도전 | 주도 | 유형 | 세부 유형 | 태그 | 팀 | 당일 포지션 | 골키퍼 | 참여 | 구력 |');
    L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    R.players.slice().sort((a, b) => (a.team ?? 9) - (b.team ?? 9) || String(a.role).localeCompare(String(b.role))).forEach((p) => {
      L.push(`| ${p._name} | ${p.nickname} | ${p.number} | \`${p.id}\` | ${p.x} | ${p.y} | ${p.type} | ${p.subtype} | ${p.tags.join(' ')} | ${p.teamName} | ${p.role} | ${gkTxt[p.gk] || ''} | ${playTxt[p.play] || ''} | ${p._exp == null ? '' : expTxt[p._exp]} |`);
    });
    L.push('', '## 팀 밸런스', '');
    L.push('| 팀 | 인원(필드) | GK·픽소·아라·피보·응원 | 평균 도전 | 평균 주도 | 구력 합 |');
    L.push('|---|---|---|---|---|---|');
    R.teams.forEach((t) => L.push(`| ${t.name} | ${t.size} (${t.field}) | ${t.roles.GOLEIRO}·${t.roles.FIXO}·${t.roles.ALA}·${t.roles.PIVO}·${t.roles.CHEER} | ${t.avgChallenge} | ${t.avgLead} | ${t._expSum} |`));
    if (c.photos && c.photos.length) {
      L.push('', '## 사진', '', '구글폼 업로드 사진은 로그인해야 보이는 드라이브 주소라 카드에 바로 못 써요. 내려받아 `photos/등번호.jpg`로 올리고 사진 칸에 경로를 적어주세요.', '');
      c.photos.forEach((x) => L.push(`- ${x.nickname} → ${x.link}`));
    }
    const w = c.warnings || [];
    L.push('', '## 확인할 것', '');
    L.push(w.length ? w.map((x) => `- ${x}`).join('\n') : '- 없음');
    L.push('', '## 카드 배부 목록', '', '| QR ID | 받을 사람 | 닉네임 |', '|---|---|---|');
    R.players.forEach((p) => L.push(`| \`${p.id}\` | ${p._name} | ${p.nickname} |`));
    return L.join('\n') + '\n';
  }

  /** 한 번에: 구글폼 글자 + 기존 데이터 → 저장할 파일 내용 전부 */
  function run(input) {
    const form = readForm(input.formText);
    const existing = readPlayersCsv(input.playersCsv);
    const roster = readRoster(input.rosterCsv);
    const mg = merge(existing, form.responses, { roster, sharedNumbers: (input.meta && input.meta.sharedNumbers) || [] });
    const an = analyze(mg.players, input.meta || {}, input.options || {});
    const teams = SKL.teamsOf(an.meta);
    const filledIds = new Set(an.players.map((p) => p.id));
    const outRows = mg.players.map((p) => (filledIds.has(p.id) ? an.players.find((q) => q.id === p.id) : { id: p.id }));
    const pending = outRows.filter((p) => !p.nickname).length;
    const photos = an.players.filter((p) => p.photoLink && !p.photo).map((p) => ({ nickname: p.nickname, link: p.photoLink }));
    const warnings = form.warnings.concat(mg.warnings, an.warnings);
    return {
      playersCsv: SKLCSV.fromPlayers(outRows, teams),
      metaJson: JSON.stringify(Object.assign({}, an.meta, { teams }), null, 2) + '\n',
      analysisJson: JSON.stringify(publicReport(an.report), null, 2) + '\n',
      reportMd: markdownReport(an.report, { log: mg.log, pending, photos, warnings }),
      rosterCsv: rosterCsv(an.players),
      report: an.report, players: an.players, meta: an.meta, log: mg.log, pending, warnings, columns: form.columns,
    };
  }

  const SKLForm = { SCALE_TITLES, readForm, readPlayersCsv, readRoster, rosterCsv, merge, analyze, publicReport, markdownReport, run };
  if (typeof module !== 'undefined' && module.exports) module.exports = SKLForm;
  root.SKLForm = SKLForm;
})(typeof window !== 'undefined' ? window : globalThis);
