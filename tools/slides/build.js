#!/usr/bin/env node
/* 진행 슬라이드를 파일 하나로 묶어요.
 *   node tools/slides/build.js . 슬라이드.html [실명 명단.csv]   (저장소 폴더에서)
 * 저장소의 shared/(theme.css · card.css · logic.js · csv.js · card.js), assets/logo.png,
 * data/players.csv · data/meta.json을 그대로 넣어서, 인터넷 없이도(글꼴 제외) 열려요. */
'use strict';
const fs = require('fs');
const path = require('path');
const [repo, out] = process.argv.slice(2);
if (!repo || !out) { console.error('사용법: node tools/slides/build.js . 슬라이드.html [실명 명단.csv]   (저장소 폴더에서)'); process.exit(1); }
const R = (p) => fs.readFileSync(path.join(repo, p), 'utf8');
const here = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(repo, 'assets/logo.png')).toString('base64');
const data = { meta: JSON.parse(R('data/meta.json')), csv: R('data/players.csv').replace(/^﻿/, ''), names: {} };
// 카드 왼쪽 아래 실명: 비공개 명단 private/roster.csv(이름·ID)에서 가져와 이 파일 안에만 넣어요 (공개 저장소엔 없음)
const rosterPath = process.argv[4] || path.join(repo, 'private/roster.csv');
if (fs.existsSync(rosterPath)) {
  const rows = fs.readFileSync(rosterPath, 'utf8').replace(/^﻿/, '').split(/\r?\n/).map((l) => l.split(','));
  const h = rows[0].map((x) => x.trim());
  const ni = h.indexOf('이름'), ii = h.indexOf('ID');
  rows.slice(1).forEach((r) => { if (r[ii] && r[ni]) data.names[r[ii].trim()] = r[ni].trim(); });
  console.log('실명', Object.keys(data.names).length + '명 (' + rosterPath + ')');
} else console.log('private/roster.csv가 없어서 카드에는 닉네임이 들어가요');
// 글꼴: fonts.css(make_fonts.py로 만든 내장 글꼴)가 있으면 넣어서 인터넷 없이도 같은 글꼴로 보여요
const fontsCss = fs.existsSync(path.join(__dirname, 'fonts.css')) ? here('fonts.css') : '';
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
const css = [R('shared/theme.css'), R('shared/card.css'), here('slides.css')].join('\n');
const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SK라이커 · ${data.meta.season || 2026} 시즌 클로징 데이</title>
<link rel="icon" type="image/png" href="${logo}">
${fontsCss ? '' : '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@400;500;700&family=Noto+Sans+KR:wght@400;500;700;900&display=swap">'}
<style>
${fontsCss}
${css.replace(/@import\s+url\([^)]*\)\s*;/g, '')}
</style>
</head>
<body>
<div id="viewport"><div id="stage">
  <div class="chrome-top"><div class="lg"><img src="${logo}" alt=""></div><div class="band"><span id="band"></span></div><div class="pg" id="pg"></div></div>
  <div id="slides"></div>
  <canvas id="confetti" width="1920" height="1080"></canvas>
  <div id="prog"></div>
  <div id="hint">→ 다음 · ← 이전 · R 다시 · F 전체화면 · P 선수 · M 맵 · T 팀 · B 밸런스</div>
  <div id="drop">players.csv · meta.json을 놓으세요</div>
  <div id="toast"></div>
</div></div>
<script>window.SKL_LOGO = ${JSON.stringify(logo)};
window.SKL_SLIDES_DATA = ${safe(JSON.stringify(data))};</script>
<script>${safe(R('shared/logic.js'))}</script>
<script>${safe(R('shared/csv.js'))}</script>
<script>${safe(R('shared/card.js'))}</script>
<script>${safe(here('slides.js'))}</script>
</body>
</html>
`;
fs.writeFileSync(out, html);
console.log('built', out, Math.round(html.length / 1024) + 'KB');
