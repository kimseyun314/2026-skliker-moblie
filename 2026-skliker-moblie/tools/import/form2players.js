#!/usr/bin/env node
/*
 * 구글폼 응답 CSV → data/players.csv · data/meta.json · data/analysis.json
 *
 * 사용법 (저장소 폴더에서)
 *   node tools/import/form2players.js ~/Downloads/응답.csv
 *
 * 옵션
 *   --dry-run        파일은 안 쓰고 결과만 보여줘요
 *   --keep-teams     players.csv에 이미 적힌 팀·포지션을 그대로 둬요 (손으로 고친 팀 유지)
 *   --fixed-median   기준선을 참가자 중앙값으로 다시 계산하지 않고 meta.json 값을 써요
 *
 * 만들어지는 파일
 *   data/players.csv        공개 · 모바일과 카드가 읽는 선수 표 (실명·구력 없음)
 *   data/meta.json          공개 · 기준선(medBold/medSolve)이 참가자 중앙값으로 바뀌어요
 *   data/analysis.json      공개 · 선수별 점수·유형·태그·능력치, 팀 밸런스 (슬라이드·확인용)
 *   private/roster.csv      비공개 · 실명 ↔ QR ID 명단. 다음에 다시 돌려도 같은 사람이 같은 QR에 붙어요
 *   private/report.md       비공개 · 운영진용 분석 리포트, 확인할 것, 카드 배부 목록
 *   private/backup-…/       비공개 · 덮어쓰기 전 원래 파일
 *   (private/ 폴더는 .gitignore에 들어 있어서 저장소에 올라가지 않아요)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'shared', 'logic.js'));
require(path.join(ROOT, 'shared', 'csv.js'));
const SKLForm = require(path.join(ROOT, 'shared', 'formimport.js'));
const SKLCSV = globalThis.SKLCSV;

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const file = args.find((a) => !a.startsWith('--'));
if (!file || flag('--help') || flag('-h')) {
  console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n\/\*\n?/, '').replace(/^ \* ?/gm, ''));
  process.exit(file ? 0 : 1);
}

const P = {
  players: path.join(ROOT, 'data', 'players.csv'),
  meta: path.join(ROOT, 'data', 'meta.json'),
  analysis: path.join(ROOT, 'data', 'analysis.json'),
  privDir: path.join(ROOT, 'private'),
};
P.roster = path.join(P.privDir, 'roster.csv');
P.report = path.join(P.privDir, 'report.md');

const readText = (p) => (fs.existsSync(p) ? SKLCSV.decode(fs.readFileSync(p)) : '');

let out;
try {
  out = SKLForm.run({
    formText: SKLCSV.decode(fs.readFileSync(path.resolve(file.replace(/^~(?=$|\/)/, process.env.HOME || '~')))),
    playersCsv: readText(P.players),
    rosterCsv: readText(P.roster),
    meta: fs.existsSync(P.meta) ? JSON.parse(fs.readFileSync(P.meta, 'utf8')) : {},
    options: { keepTeams: flag('--keep-teams'), fixedMedian: flag('--fixed-median') },
  });
} catch (e) {
  console.error('\n✖ ' + e.message + '\n');
  process.exit(1);
}

const R = out.report;
const h = out.columns.headers;
console.log('\n[읽은 성향 문항 열]');
out.columns.scale.forEach((i, k) => console.log(`  ${String(k + 1).padStart(2)}. ${h[i]}`));
console.log(`\n응답 ${R.count}명 · 새로 등록 ${out.log.added.length} · 업데이트 ${out.log.updated.length} · 설문 없이 유지 ${out.log.kept.length} · 남은 빈 QR ${out.pending}`);
console.log(`기준선(중앙값) 도전 ${R.median.challenge} · 주도 ${R.median.lead}`);
console.log('유형 분포  ' + Object.entries(R.typeCount).map(([t, n]) => `${t} ${n}`).join(' · '));
console.log('');
console.table(R.players.map((p) => ({ ID: p.id, 닉네임: p.nickname, 번호: p.number, 도전: p.x, 주도: p.y, 유형: p.subtype, 팀: p.teamName, 포지션: p.role })));
R.teams.forEach((t) => console.log(`  ${t.name}: ${t.size}명 (GK ${t.roles.GOLEIRO} · 픽소 ${t.roles.FIXO} · 아라 ${t.roles.ALA} · 피보 ${t.roles.PIVO} · 응원 ${t.roles.CHEER}) 구력합 ${t._expSum}`));
if (out.warnings.length) {
  console.log('\n[확인할 것]');
  out.warnings.forEach((w) => console.log('  ⚠ ' + w));
}

if (flag('--dry-run')) {
  console.log('\n--dry-run: 파일은 바꾸지 않았어요.\n');
  process.exit(0);
}

fs.mkdirSync(P.privDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
const bak = path.join(P.privDir, 'backup-' + stamp);
fs.mkdirSync(bak, { recursive: true });
[P.players, P.meta, P.analysis, P.roster].forEach((p) => { if (fs.existsSync(p)) fs.copyFileSync(p, path.join(bak, path.basename(p))); });

fs.writeFileSync(P.players, out.playersCsv);
fs.writeFileSync(P.meta, out.metaJson);
fs.writeFileSync(P.analysis, out.analysisJson);
fs.writeFileSync(P.roster, out.rosterCsv);
fs.writeFileSync(P.report, out.reportMd);

const rel = (p) => path.relative(ROOT, p);
console.log(`\n✔ 저장했어요
  ${rel(P.players)}   ${rel(P.meta)}   ${rel(P.analysis)}   (공개 · 커밋)
  ${rel(P.report)}   ${rel(P.roster)}   (비공개 · 커밋 금지)
  원래 파일 백업: ${rel(bak)}/
`);
