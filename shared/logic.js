/*
 * SK라이커 포지션 유형 · 팀 배정 공통 로직
 * 브라우저에서는 window.SKL, Node에서는 require()로 사용
 */
(function (root) {
  'use strict';

  const TYPES = {
    PIVO:    { ko: '피보',     alias: '돌격하는 해결사',   color: '#FF5A6E', ability: '돌파력', kw: ['추진력', '돌파력', '과감함', '마무리'], corner: [6, 6] },
    ALA:     { ko: '아라',     alias: '쉬지 않는 연결고리', color: '#FFB627', ability: '활동력', kw: ['활동량', '적응력', '공수 전환', '센스'], corner: [6, 0] },
    FIXO:    { ko: '픽소',     alias: '판을 읽는 사령관',   color: '#2EC4B6', ability: '조율력', kw: ['시야', '안정감', '조율', '리더십'], corner: [0, 0] },
    GOLEIRO: { ko: '골레이로', alias: '마지막 수호신',      color: '#9BE15D', ability: '수호력', kw: ['책임감', '침착함', '담대함', '목소리'], corner: [0, 6] },
  };
  const TYPE_ORDER = ['PIVO', 'ALA', 'FIXO', 'GOLEIRO'];

  // 설문지 PART 2 (Q7~Q18). 앞 6개 = 과감(A)/신중(B), 뒤 6개 = 해결(A)/연결(B)
  const QUESTIONS = [
    ['회식 메뉴를 고를 때 나는', '처음 보는 신메뉴에 도전한다', '검증된 단골 메뉴를 고른다'],
    ['경기 중 내 앞에 빈 공간이 열렸다', '일단 공을 치고 달린다', '주변을 한 번 보고 판단한다'],
    ['새로운 일을 시작할 때 나는', '일단 해보면서 고친다', '계획부터 세운다'],
    ['단톡방에 "이거 해줄 사람?"이 올라오면', '먼저 손을 든다', '상황을 보고 필요하면 나선다'],
    ['공을 잡았는데 상대가 바로 붙었다', '개인기로 제쳐본다', '안전하게 뒤로 돌린다'],
    ['나의 여행 스타일은', '그날그날 즉흥으로', '미리 짜둔 일정표대로'],
    ['팀 과제에서 나는', '핵심 파트를 맡아서 끝내는 사람', '사람들 사이를 조율하는 사람'],
    ['골 찬스인데 옆에 더 좋은 위치의 동료가 있다', '내가 찬다', '패스한다'],
    ['더 듣고 싶은 칭찬은', '"너 덕분에 이겼어"', '"너 덕분에 편했어"'],
    ['우리 팀이 위기에 빠졌을 때 나는', '"내가 막을게"', '"같이 커버하자!"'],
    ['친구 모임에서 나는', '이야기의 주인공', '분위기를 띄우고 사람들을 이어주는 사람'],
    ['경기 중 실수했을 때 나는', '다음 플레이로 직접 만회한다', '팀에 빠르게 공유하고 같이 수습한다'],
  ];
  const QUESTION_OFFSET = 7; // 설문지 번호 = index + 7

  const DEFAULT_TEAMS = [
    { name: '산타 FC', color: '#E63946' },
    { name: '루돌프 FC', color: '#C8853F' },
    { name: '눈사람 FC', color: '#4EA8DE' },
    { name: '트리 FC', color: '#2A9D8F' },
  ];

  /** answers: 'AABABA BBAABA' 처럼 A/B 12개 (공백 무시) */
  function normalizeAnswers(a) {
    return String(a || '').toUpperCase().replace(/[^AB]/g, '').padEnd(12, 'B').slice(0, 12);
  }
  function scores(answers) {
    const a = normalizeAnswers(answers);
    let x = 0, y = 0;
    for (let i = 0; i < 6; i++) if (a[i] === 'A') x++;
    for (let i = 6; i < 12; i++) if (a[i] === 'A') y++;
    return { x, y }; // x: 과감 0~6, y: 해결 0~6
  }
  function typeOf(x, y) {
    const bold = x >= 4, solo = y >= 4;
    if (bold && solo) return 'PIVO';
    if (bold) return 'ALA';
    if (solo) return 'GOLEIRO';
    return 'FIXO';
  }
  /** 각 유형 꼭짓점과의 거리로 0~100 적합도(능력치) 계산 */
  function affinity(x, y) {
    const max = Math.hypot(6, 6);
    const out = {};
    for (const t of TYPE_ORDER) {
      const [cx, cy] = TYPES[t].corner;
      const d = Math.hypot(x - cx, y - cy) / max;
      out[t] = Math.round(40 + 60 * (1 - d));
    }
    return out;
  }
  /** 화면용 계산값을 붙인 새 객체 반환 */
  function enrich(p) {
    const { x, y } = scores(p.answers);
    const type = typeOf(x, y);
    return Object.assign({}, p, { x, y, type, aff: affinity(x, y), role: p.role || type });
  }

  // 한 팀 포지션 우선순위 (5명 = GK, 픽소, 아라, 피보, 아라)
  const ROLE_SEQ = ['GOLEIRO', 'FIXO', 'ALA', 'PIVO', 'ALA', 'FIXO', 'PIVO', 'ALA'];

  /**
   * 팀 자동 배정
   * players: [{id, answers, gk:'yes'|'ok'|'no', play:'full'|'half'|'cheer', exp:0|1|2}]
   * 반환: { [id]: { team: 0..T-1, role: 'PIVO'|'ALA'|'FIXO'|'GOLEIRO'|'CHEER' } }
   */
  function assignTeams(players, teamCount) {
    const list = players.map(enrich);
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

  const SKL = { TYPES, TYPE_ORDER, QUESTIONS, QUESTION_OFFSET, DEFAULT_TEAMS, normalizeAnswers, scores, typeOf, affinity, enrich, assignTeams, nearest, newId, toPublic, teamsOf, qrUrl, resolveTeams };
  if (typeof module !== 'undefined' && module.exports) module.exports = SKL;
  root.SKL = SKL;
})(typeof window !== 'undefined' ? window : globalThis);
