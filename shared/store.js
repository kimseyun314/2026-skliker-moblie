/*
 * 데이터 불러오기 · 저장
 * - 모바일 화면과 카드 인쇄는 data/players.csv(+ data/meta.json)를 읽음
 * - 관리 도구는 브라우저 localStorage에 전체 데이터(실명·구력 포함)를 저장
 * - 주소에 ?src=local 이 있으면 관리 도구에서 편집 중인 데이터로 미리보기
 */
(function () {
  'use strict';
  const ADMIN_KEY = 'skl-admin-v1';
  const cfg = () => window.SKL_CONFIG || {};

  function readLocal() {
    try {
      const raw = localStorage.getItem(ADMIN_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function writeLocal(data) {
    localStorage.setItem(ADMIN_KEY, JSON.stringify(data));
  }

  const bust = (url) => url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();

  function jsonError(text, e, name) {
    const m = /position (\d+)/.exec(e.message);
    const where = m ? ` (${text.slice(0, Number(m[1])).split('\n').length}번째 줄 근처)` : '';
    return new Error(`${name} 형식이 올바르지 않아요${where}. 쉼표·따옴표·괄호를 확인해주세요.`);
  }
  async function getJson(url, name) {
    const res = await fetch(bust(url), { cache: 'no-store' });
    if (!res.ok) return null;
    const text = await res.text();
    try { return JSON.parse(text); } catch (e) { throw jsonError(text, e, name); }
  }

  /**
   * 공개 데이터 읽기 → { meta, players, pending, warnings }
   * 1) data/meta.json + data/players.csv (주소에 ?demo 가 있으면 data/sample.csv)
   * 2) players.csv가 없으면 예전 data/players.json
   */
  async function fetchPublic() {
    const c = cfg();
    const demo = new URLSearchParams(location.search).has('demo');
    const meta = (await getJson(c.metaUrl || 'data/meta.json', 'meta.json')) || {};
    const res = await fetch(bust(demo ? c.demoUrl : c.playersUrl), { cache: 'no-store' });
    if (res.ok) {
      const parsed = SKLCSV.toPlayers(SKLCSV.decode(await res.arrayBuffer()));
      return { meta, players: parsed.players, pending: parsed.pending, warnings: parsed.warnings };
    }
    const legacy = await getJson(c.legacyJsonUrl || 'data/players.json', 'players.json');
    if (legacy) return { meta: Object.assign({}, legacy.meta, meta), players: legacy.players || [], pending: [], warnings: [] };
    throw new Error(`data/players.csv를 찾지 못했어요 (${res.status}). 파일 위치를 확인해주세요.`);
  }

  /** 사진 경로: data URL·http 주소는 그대로, 'photos/xx.jpg' 같은 상대 경로는 사이트 기준으로 */
  function resolvePhoto(photo) {
    if (!photo) return '';
    if (/^(data:|https?:)/.test(photo)) return photo;
    return new URL(photo, cfg().siteUrl || location.href).href;
  }

  /** 공개 화면용: {meta, players(enriched), teams, warnings} */
  async function load() {
    const params = new URLSearchParams(location.search);
    let data = null;
    if (params.get('src') === 'local') {
      const local = readLocal();
      if (local) data = SKL.toPublic(local);
    }
    if (!data) data = await fetchPublic();
    data.meta = data.meta || {};
    if (!data.meta.mobileUrl) data.meta.mobileUrl = cfg().siteUrl || new URL('./', location.href).href;
    const warnings = (data.warnings || []).slice();
    const seen = new Set();
    data.players = (data.players || []).filter((p, i) => {
      if (!p || !p.id) { warnings.push(`${i + 1}번째 선수에 id가 없어서 건너뛰었어요`); return false; }
      if (seen.has(p.id)) { warnings.push(`id "${p.id}"가 중복이에요`); return false; }
      seen.add(p.id);
      return true;
    }).map((p) => Object.assign({ nickname: '이름없음', number: '' }, p, { photo: resolvePhoto(p.photo) }))
      ;
    data.players = SKL.resolveTeams(data.players, data.meta).map((p) => SKL.enrich(p, SKL.medians(data.meta)));
    if (warnings.length) console.warn('[선수 데이터]', warnings.join(' / '));
    data.warnings = warnings;
    data.teams = SKL.teamsOf(data.meta);
    return data;
  }

  window.SKLStore = { ADMIN_KEY, readLocal, writeLocal, fetchPublic, load, resolvePhoto };
})();
