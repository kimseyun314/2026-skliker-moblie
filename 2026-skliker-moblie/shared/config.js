/*
 * 사이트 설정
 * 경로는 이 파일(shared/config.js) 위치를 기준으로 자동 계산돼서
 * 어느 페이지(루트, tools/admin, tools/cards)에서 불러도 같은 파일을 가리켜요.
 *
 *   data/players.csv  ★ 선수 정보 (한 줄 = 선수 한 명, ID 열이 QR과 연결돼요)
 *   data/meta.json      행사 설정 (동호회 이름, 팀 이름·색, 기준선)
 *   data/sample.csv     연습용 가짜 선수 10명 (주소 끝에 ?demo 를 붙이면 이걸로 보여줘요)
 */
(function () {
  const here = document.currentScript ? document.currentScript.src : location.href;
  window.SKL_CONFIG = {
    playersUrl: new URL('../data/players.csv', here).href,
    metaUrl: new URL('../data/meta.json', here).href,
    demoUrl: new URL('../data/sample.csv', here).href,
    legacyJsonUrl: new URL('../data/players.json', here).href, // 예전 형식 (players.csv가 없을 때만)
    siteUrl: new URL('../', here).href, // QR 기본 주소 = 사이트 맨 위 주소
  };
})();
