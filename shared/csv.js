/*
 * 선수 표(players.csv) 읽기 · 쓰기
 * - 엑셀/구글시트에서 한 줄 = 선수 한 명으로 채워서 저장하면 돼요.
 * - 제목 행은 한글(닉네임, 등번호 …)과 영문(nickname, number …) 둘 다 알아봐요.
 * - 쉼표(CSV)와 탭(시트에서 복사한 내용) 둘 다 읽어요.
 */
(function (root) {
  'use strict';

  // 열 순서 = 파일에 쓰는 순서. [키, 한글 제목, 다른 이름들]
  const COLUMNS = [
    ['id', 'ID', ['id', 'qr', 'qrid', '아이디', '큐알']],
    ['nickname', '닉네임', ['nickname', '닉네임', '이름']],
    ['number', '등번호', ['number', 'no', '등번호', '번호']],
    ['nameEn', '영문이름', ['nameen', '영문이름', '영문', '영어이름']],
    ['answers', '응답', ['answers', '응답', '성향', '답']],
    ['moment', '하이라이트', ['moment', 'highlight', '하이라이트', '최고의순간', '한줄']],
    ['photo', '사진', ['photo', '사진']],
    ['gk', '골키퍼', ['gk', '골키퍼', '골키퍼의향']],
    ['play', '참여', ['play', '참여', '당일참여']],
    ['team', '팀', ['team', '팀']],
    ['role', '포지션', ['role', '포지션', '오늘포지션']],
  ];
  const norm = (h) => String(h || '').replace(/^﻿/, '').replace(/[\s_()\-·*]/g, '').toLowerCase();

  /** 바이트 → 글자. UTF-8이 아니면(한글 엑셀 기본 저장) EUC-KR로 다시 읽어요 */
  function decode(buf) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, ''); }
    catch (e) { return new TextDecoder('euc-kr').decode(buf); }
  }

  function parse(text) {
    const first = text.split(/\r?\n/)[0] || '';
    const delim = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? '\t' : ',';
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"' && cell === '') q = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        rows.push(row); row = [];
      } else cell += ch;
    }
    row.push(cell); rows.push(row);
    return rows.filter((r) => r.some((c) => String(c).trim()));
  }

  const GK = (v) => (/no|피하/.test(v) ? 'no' : /yes|좋아/.test(v) ? 'yes' : 'ok');
  const PLAY = (v) => (/cheer|응원|진행/.test(v) ? 'cheer' : /half|절반/.test(v) ? 'half' : 'full');

  /**
   * 표 글자 → { players, warnings }
   * 닉네임이 빈 줄은 "아직 안 채운 QR"로 보고 pending 목록에 넣어요.
   */
  function toPlayers(text) {
    const rows = parse(text);
    if (!rows.length) return { players: [], pending: [], warnings: ['players.csv가 비어 있어요'] };
    const head = rows[0].map(norm);
    const idx = {};
    COLUMNS.forEach(([key, , names]) => { idx[key] = head.findIndex((h) => names.includes(h)); });
    const warnings = [];
    if (idx.id < 0) warnings.push('ID 열이 없어요. 첫 줄에 ID, 닉네임, 등번호 … 제목이 있어야 해요');
    const players = [], pending = [];
    rows.slice(1).forEach((r, n) => {
      const get = (k) => (idx[k] >= 0 ? String(r[idx[k]] == null ? '' : r[idx[k]]).trim() : '');
      const id = get('id');
      if (!id) return;
      const nickname = get('nickname');
      if (!nickname) { pending.push(id); return; }
      const num = get('number').replace(/[^0-9]/g, '');
      const team = get('team');
      players.push({
        id, nickname,
        number: num === '' ? '' : Number(num),
        nameEn: get('nameEn'),
        answers: get('answers'),
        moment: get('moment'),
        photo: get('photo'),
        gk: GK(get('gk')),
        play: PLAY(get('play')),
        team: /^\d+$/.test(team) ? Number(team) : team,
        role: get('role').toUpperCase(),
      });
      const a = get('answers').replace(/[^1-4AaBb]/g, '');
      if (a.length !== 12) warnings.push(`${n + 2}번째 줄(${nickname})의 응답이 ${a.length}개예요. 12개여야 해요`);
    });
    return { players, pending, warnings };
  }

  function cell(v) {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  /** 선수 목록 → CSV 글자 (엑셀에서 한글이 안 깨지게 BOM 포함) */
  function fromPlayers(players, teams) {
    const lines = [COLUMNS.map((c) => c[1]).join(',')];
    players.forEach((p) => {
      const team = typeof p.team === 'number' && teams && teams[p.team] ? teams[p.team].name : (p.team == null ? '' : p.team);
      lines.push(COLUMNS.map(([k]) => cell(k === 'team' ? team : p[k])).join(','));
    });
    return '﻿' + lines.join('\r\n') + '\r\n';
  }

  const SKLCSV = { COLUMNS, decode, parse, toPlayers, fromPlayers };
  if (typeof module !== 'undefined' && module.exports) module.exports = SKLCSV;
  root.SKLCSV = SKLCSV;
})(typeof window !== 'undefined' ? window : globalThis);
