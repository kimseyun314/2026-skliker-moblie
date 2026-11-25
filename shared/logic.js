/*
 * SK라이커 포지션 유형 · 팀 배정 공통 로직
 * 브라우저에서는 window.SKL, Node에서는 require()로 사용
 */
(function (root) {
  'use strict';

  // 선수카드 시안(검정 + 라임)과 같은 유형 정의. color는 지도·명단에서 유형을 구분하는 색
  // 축: 가로 = 도전(Q1~Q6, A쪽) ↔ 준비 / 세로 = 주도(Q7~Q12, A쪽) ↔ 함께
  // corner: 포지션 맵에서 그 유형의 꼭짓점 [도전, 주도]. sub: [가로축이 더 강할 때, 세로축이 더 강할 때]
  const TYPES = {
    PIVO:    { ko: '피보',     nick: '해결사',     axis: '도전 + 주도', sub: ['돌파형', '결정형'], color: '#E4F218', ability: '결정력', corner: [18, 18],
               line: '결정적인 순간, 공을 받고 싶어하는 사람',
               persona: '일이 꼬이면 직접 붙잡고 마무리한다. 결론을 내는 데 망설임이 없고, "역시 너라서 해냈다"는 말에 힘이 난다.',
               keywords: ['#해냄의아이콘', '#마감해결사', '#결론메이커'] },
    ALA:     { ko: '아라',     nick: '에너자이저', axis: '도전 + 함께', sub: ['질주형', '연결형'], color: '#FF8A3D', ability: '활동력', corner: [18, 0],
               line: '먼저 뛰어들고, 같이 웃는 사람',
               persona: '처음 해보는 일도 일단 부딪히고, 감이 오면 바로 움직인다. 혼자보다 같이 해낼 때 더 신나고, 어디서든 분위기를 끌어올린다.',
               keywords: ['#일단부딪힘', '#직감결정', '#함께가좋아'] },
    FIXO:    { ko: '픽소',     nick: '설계자',     axis: '준비 + 주도', sub: ['설계형', '지휘형'], color: '#3DD6F5', ability: '설계력', corner: [0, 18],
               line: '한 발 뒤에서 판을 읽고 해법을 내는 사람',
               persona: '먼저 상황을 살피고 자료를 모은 뒤 움직인다. 흐름이 흐트러지면 정리부터 하고, 막힌 순간에 해결책을 내놓는 든든한 두뇌.',
               keywords: ['#자료조사러', '#정리필요', '#해결책제시'] },
    GOLEIRO: { ko: '골레이로', nick: '버팀목',     axis: '준비 + 함께', sub: ['철벽형', '소통형'], color: '#B79CFF', ability: '수호력', corner: [0, 0],
               line: '맨 뒤에서 모두를 보고 받쳐주는 사람',
               persona: '한 발 물러서서 모두를 살피고, 이야기를 끝까지 들어준다. 내가 빛나기보다 동료가 빛날 때 뿌듯한, 팀의 마지막 버팀목.',
               keywords: ['#남을빛내는', '#공감리스너', '#함께가좋아'] },
  };
  const TYPE_ORDER = ['PIVO', 'ALA', 'FIXO', 'GOLEIRO'];

  // 성향 문항 12개 (1~4점). 앞 6개 = 도전, 뒤 6개 = 주도. 1에 가까울수록 A(왼쪽 태그) 성향
  const QUESTIONS = [
    ['Q1', '#즉흥외출러', '#계획휴식러'], ['Q2', '#먼저인사러', '#관찰후합류'], ['Q3', '#일단부딪힘', '#자료조사러'],
    ['Q4', '#신메뉴헌터', '#단골파'], ['Q5', '#직감결정', '#신중결정'], ['Q6', '#변화즐김', '#정리필요'],
    ['Q7', '#끝까지책임', '#연결고리'], ['Q8', '#해결책제시', '#공감리스너'], ['Q9', '#해냄의아이콘', '#함께가좋아'],
    ['Q10', '#결론메이커', '#분위기중재'], ['Q11', '#마감해결사', '#같이해결'], ['Q12', '#결과로증명', '#남을빛내는'],
  ];
  const QUESTION_OFFSET = 1; // 문항 번호 = index + 1

  const DEFAULT_TEAMS = [
    { name: '산타 FC', color: '#E63946' },
    { name: '루돌프 FC', color: '#C8853F' },
    { name: '눈사람 FC', color: '#4EA8DE' },
    { name: '트리 FC', color: '#2A9D8F' },
  ];

  /**
   * answers: "121223 132211"처럼 1~4 숫자 12개 (공백 무시).
   * 예전 A/B 형식도 읽어요 (A=1, B=4).
   * 반환: { a: [12개 숫자], valid }
   */
  function normalizeAnswers(ans) {
    const chars = String(ans || '').toUpperCase().replace(/A/g, '1').replace(/B/g, '4').replace(/[^1-4]/g, '');
    const valid = chars.length === 12;
    const a = chars.padEnd(12, '3').slice(0, 12).split('').map(Number);
    return { a, valid };
  }
  function scores(answers) {
    const { a, valid } = normalizeAnswers(answers);
    const pts = a.map((v) => 4 - v);
    const x = pts.slice(0, 6).reduce((s, v) => s + v, 0);
    const y = pts.slice(6).reduce((s, v) => s + v, 0);
    return { x, y, a, valid }; // x: 도전 0~18, y: 주도 0~18
  }
  function median(arr) {
    if (!arr.length) return 9;
    const s = arr.slice().sort((p, q) => p - q);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  /** 기준선: meta.medBold / meta.medSolve 숫자가 있으면 그 값, 없으면 9 */
  function medians(meta) {
    const n = (v) => (typeof v === 'number' && isFinite(v) ? v : 9);
    return { mx: n(meta && meta.medBold), my: n(meta && meta.medSolve) };
  }
  function typeOf(x, y, a, med) {
    const { mx, my } = med || { mx: 9, my: 9 };
    const bold = x > mx || (x === mx && a && a[1] <= 2);
    const solve = y > my || (y === my && a && a[7] <= 2);
    return bold ? (solve ? 'PIVO' : 'ALA') : (solve ? 'FIXO' : 'GOLEIRO');
  }
  /**
   * 각 유형 꼭짓점과의 거리로 40~100 능력치 (카드 레이더와 같은 식).
   * 기준선(중앙값)이 맵 가운데(9, 9)에 오도록 옮겨서 계산해요 → 유형과 BEST 능력치가 맞아요.
   */
  function affinity(x, y, med) {
    const m = med || { mx: 9, my: 9 };
    const cl = (v) => Math.max(0, Math.min(18, v));
    const sx = cl(x - m.mx + 9), sy = cl(y - m.my + 9);
    const max = 18 * Math.SQRT2;
    const out = {};
    for (const t of TYPE_ORDER) {
      const [cx, cy] = TYPES[t].corner;
      out[t] = Math.round(100 - 60 * Math.hypot(sx - cx, sy - cy) / max);
    }
    return out;
  }
  /** 가장 높은 능력치. 같으면 내 유형을 우선 */
  function bestOf(aff, type) {
    return TYPE_ORDER.reduce((b, k) => (aff[k] > aff[b] ? k : b), type || TYPE_ORDER[0]);
  }
  /**
   * 태그 2개: 가로축(도전/준비)과 세로축(주도/함께)에서 내 유형 방향의 답 중 가장 강한 것 하나씩.
   * 그 방향 답이 하나도 없으면 그 축에서 가장 강한 답을 써요.
   */
  const TAG_ORDER = [[1, 2, 0, 4, 5, 3], [7, 8, 11, 10, 9, 6]];
  function tagsOf(a, type) {
    const t = TYPES[type] || TYPES.PIVO;
    const wantA = [t.corner[0] === 18, t.corner[1] === 18];
    return TAG_ORDER.map((idx, axis) => {
      const strength = (v, A) => (A ? (v === 1 ? 2 : v === 2 ? 1 : 0) : (v === 4 ? 2 : v === 3 ? 1 : 0));
      let best = null;
      for (const i of idx) {
        const st = strength(a[i], wantA[axis]);
        if (st && (!best || st > best.st)) best = { i, st, A: wantA[axis] };
      }
      if (!best) {
        for (const i of idx) {
          const A = a[i] <= 2, st = strength(a[i], A);
          if (!best || st > best.st) best = { i, st, A };
        }
      }
      return QUESTIONS[best.i][best.A ? 1 : 2];
    });
  }
  /** 화면용 계산값을 붙인 새 객체 반환 */
  function enrich(p, med) {
    const m = med || { mx: 9, my: 9 };
    const { x, y, a, valid } = scores(p.answers);
    const type = typeOf(x, y, a, m);
    const t = TYPES[type];
    const subtype = (Math.abs(x - m.mx) >= Math.abs(y - m.my) ? t.sub[0] : t.sub[1]) + ' ' + t.ko;
    const aff = affinity(x, y, m);
    return Object.assign({}, p, { x, y, valid, type, subtype, tags: tagsOf(a, type), aff, best: bestOf(aff, type), role: p.role || type });
  }

  // 한 팀 포지션 우선순위 (5명 = GK, 픽소, 아라, 피보, 아라)
  const ROLE_SEQ = ['GOLEIRO', 'FIXO', 'ALA', 'PIVO', 'ALA', 'FIXO', 'PIVO', 'ALA'];

  /**
   * 팀 자동 배정
   * players: [{id, answers, gk:'yes'|'ok'|'no', play:'full'|'half'|'cheer', exp:0|1|2}]
   * 반환: { [id]: { team: 0..T-1, role: 'PIVO'|'ALA'|'FIXO'|'GOLEIRO'|'CHEER' } }
   */
  function assignTeams(players, teamCount, med) {
    const list = players.map((p) => enrich(p, med));
    const field = list.filter((p) => p.play !== 'cheer');
    const cheer = list.filter((p) => p.play === 'cheer');
    const T = Math.max(2, teamCount || Math.round(field.length / 5) || 2);
    const perTeam = Math.ceil(field.length / T);

    // 1) 포지션 슬롯 만들기
    let slots = [];
    for (let k = 0; k < perTeam; k++) {
      const role = ROLE_SEQ[k % ROLE_SEQ.length];
      for (let t = 0; t < T; t++) slots.push({ role, team: t, k });
    }
    // 인원보다 슬롯이 많으면 우선순위 낮은 슬롯부터 제거
    slots.sort((a, b) => a.k - b.k || a.team - b.team);
    slots = slots.slice(0, field.length);

    const need = {};
    slots.forEach((s) => { need[s.role] = (need[s.role] || 0) + 1; });

    // 2) 적합도가 높은 순서로 선수-포지션 매칭 (골키퍼 기피 반영)
    const pairs = [];
    for (const p of field) {
      for (const role of Object.keys(need)) {
        let score = p.aff[role] + (p.type === role ? 15 : 0);
        if (role === 'GOLEIRO') {
          if (p.gk === 'no') score -= 1000;
          else if (p.gk === 'ok') score -= 10;
          else if (p.gk === 'yes') score += 10;
        }
        pairs.push({ p, role, score });
      }
    }
    pairs.sort((a, b) => b.score - a.score || String(a.p.id).localeCompare(String(b.p.id)));
    const roleOf = {};
    const left = Object.assign({}, need);
    for (const { p, role } of pairs) {
      if (roleOf[p.id] || !left[role]) continue;
      roleOf[p.id] = role; left[role]--;
    }

    // 3) 포지션별로 팀에 분배 (구력 합이 비슷해지도록)
    const capacity = Array.from({ length: T }, () => ({}));
    slots.forEach((s) => { capacity[s.team][s.role] = (capacity[s.team][s.role] || 0) + 1; });
    const teamExp = new Array(T).fill(0);
    const teamSize = new Array(T).fill(0);
    const result = {};
    const roleOrder = ['GOLEIRO', 'FIXO', 'PIVO', 'ALA'];
    for (const role of roleOrder) {
      const members = field
        .filter((p) => roleOf[p.id] === role)
        .sort((a, b) => (b.exp || 0) - (a.exp || 0) || b.aff[role] - a.aff[role]);
      for (const p of members) {
        let best = -1;
        for (let t = 0; t < T; t++) {
          if (!capacity[t][role]) continue;
          if (best < 0 || teamExp[t] < teamExp[best] || (teamExp[t] === teamExp[best] && teamSize[t] < teamSize[best])) best = t;
        }
        capacity[best][role]--;
        teamExp[best] += p.exp || 0;
        teamSize[best]++;
        result[p.id] = { team: best, role };
      }
    }
    // 4) 응원 담당은 인원이 적은 팀부터
    for (const p of cheer) {
      let best = 0;
      for (let t = 1; t < T; t++) if (teamSize[t] < teamSize[best]) best = t;
      teamSize[best]++;
      result[p.id] = { team: best, role: 'CHEER' };
    }
    return result;
  }

  function nearest(me, players) {
    let best = null, bd = Infinity;
    for (const q of players) {
      if (q.id === me.id) continue;
      const d = (q.x - me.x) ** 2 + (q.y - me.y) ** 2;
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  }

  function newId() {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  /** 관리용 데이터 → 배포용(공개) 데이터. 실명·구력 제거 */
  function toPublic(data) {
    return {
      meta: data.meta,
      players: data.players.map((p) => {
        const { name, exp, ...pub } = p;
        return pub;
      }),
    };
  }

  function teamsOf(meta) {
    const n = (meta && meta.teamCount) || 2;
    const custom = (meta && meta.teams) || [];
    return Array.from({ length: n }, (_, i) => Object.assign({}, DEFAULT_TEAMS[i % DEFAULT_TEAMS.length], custom[i] || {}));
  }

  /** team 값을 팀 번호(0부터)로 통일. 숫자, "0" 같은 문자열, 팀 이름("산타 FC") 모두 허용 */
  function resolveTeams(players, meta) {
    const teams = teamsOf(meta);
    return players.map((p) => {
      let t = p.team;
      if (typeof t === 'string') {
        const byName = teams.findIndex((x) => x.name.replace(/\s/g, '') === t.replace(/\s/g, ''));
        t = byName >= 0 ? byName : (/^\d+$/.test(t.trim()) ? Number(t) : undefined);
      }
      if (typeof t === 'number' && (t < 0 || t >= teams.length)) t = undefined;
      return Object.assign({}, p, { team: t });
    });
  }

  function qrUrl(meta, id) {
    const base = (meta && meta.mobileUrl) || '';
    return base + (base.includes('?') ? '&' : '?') + 'p=' + encodeURIComponent(id);
  }

  const SKL = { TYPES, TYPE_ORDER, QUESTIONS, QUESTION_OFFSET, DEFAULT_TEAMS, normalizeAnswers, scores, median, medians, typeOf, affinity, bestOf, tagsOf, enrich, assignTeams, nearest, newId, toPublic, teamsOf, qrUrl, resolveTeams };
  if (typeof module !== 'undefined' && module.exports) module.exports = SKL;
  root.SKL = SKL;
})(typeof window !== 'undefined' ? window : globalThis);
