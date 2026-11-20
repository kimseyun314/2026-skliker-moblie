/*
 * 사이트 설정
 * 경로는 이 파일(shared/config.js) 위치를 기준으로 자동 계산돼서
 * 어느 페이지(루트, tools/admin, tools/cards)에서 불러도 같은 파일을 가리켜요.
 */
(function () {
  const here = document.currentScript ? document.currentScript.src : location.href;
  window.SKL_CONFIG = {
    // 선수 데이터 파일
    dataUrl: new URL('../data/players.json', here).href,
    // 모바일 화면 주소 (QR 기본값). 사이트 맨 위 주소예요.
    siteUrl: new URL('../', here).href,
  };
})();
