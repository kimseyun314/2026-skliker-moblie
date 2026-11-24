# SK라이커 2026 시즌 클로징 데이 — 모바일

선수카드 QR을 찍으면 열리는 **모바일 전용** 사이트예요. 빌드 과정 없이 GitHub Pages에 올리면 바로 동작해요.

- 모바일 화면: `https://아이디.github.io/저장소/?p=QR ID`
  - 내 유형 공개(카드 뒤집기) → 전체 포지션 맵 속 내 위치 → 우리 팀, 3장을 옆으로 넘겨요
  - 처음 열면 카드팩 오프닝 → 홀로그램 카드(휴대폰을 기울이면 빛 반사) → 레이더 스캔 지도 → 3D 피치 라인업
  - `카드 스캔`으로 다른 선수 카드를 찍으면 그 선수 화면으로 이동
  - `?p=` 없이 열면 첫 화면이 QR 스캔 화면이에요 (큰 스캔 버튼 → 카메라). 아래 "이름으로 찾기"도 있어요
- 선수 데이터: **`data/players.csv`** 하나만 채우면 돼요. ID가 QR과 연결돼 있어서 저장하면 바로 그 선수 화면에 반영돼요 → [DATA_GUIDE.md](DATA_GUIDE.md)
- 연습용 가짜 선수 화면: 주소 끝에 `?demo` (예: `…/?demo`, `…/?p=bx7k2m&demo`)

## 폴더 구성

```
index.html            모바일 화면 (사이트 첫 화면)
app/                  모바일 화면 스타일·동작
data/players.csv      ★ 선수 정보 표 (한 줄 = 선수 한 명. QR ID 16개가 미리 들어 있음)
data/meta.json        행사 설정 (동호회 이름, 팀 이름·색, 유형 기준선)
data/sample.csv       연습용 가짜 선수 10명 (?demo 로 볼 때만 사용)
photos/               선수 사진 (선택)
shared/               공통 로직 (유형 계산·팀 배정·QR·카드 디자인)
vendor/               QR 생성(qrcode-generator, MIT) · QR 인식(jsQR, Apache-2.0)
tools/admin/          관리 도구 (선수 입력, 구글폼 붙여넣기, 팀 자동 배정, QR 생성, players.csv 만들기)
tools/cards/          선수카드 인쇄 (63×88mm, A4 9장, 양면)
```

`tools/`는 운영진용 보조 도구예요. 지워도 모바일 화면에는 영향이 없어요.

## GitHub Pages에 올리기

1. GitHub에서 **New repository** → 이름 예: `sk-liker-mobile` → **Public** → Create
   (무료 계정은 공개 저장소만 Pages를 쓸 수 있어요)
2. **Add file → Upload files** → 이 폴더 **안의 내용 전부**를 끌어다 놓고 **Commit changes**
   (`index.html`이 저장소 맨 위에 있어야 해요)
3. **Settings → Pages → Build and deployment**: Source **Deploy from a branch**, Branch **main** / **(root)** → **Save**
4. 1~2분 뒤 주소가 생겨요: `https://아이디.github.io/sk-liker-mobile/`
5. 확인: `https://아이디.github.io/sk-liker-mobile/?p=bx7k2m&demo` (연습용 선수 "번개")

## 준비 순서

1. `data/players.csv`를 엑셀·구글시트로 열어 ID 옆 칸을 채우고 저장해서 올리기 → [DATA_GUIDE.md](DATA_GUIDE.md)
   (또는 `tools/admin/`에서 입력 후 "players.csv 다운로드"로 덮어쓰기)
2. `tools/admin/` ③에서 선수별 QR 확인·이미지 저장
3. `tools/cards/`에서 선수카드 인쇄 (QR 포함)
4. 당일: 카드 배포 → 각자 QR 스캔

## QR 동작 방식

- QR 내용 = `사이트 주소?p=선수 id` (예: `https://myid.github.io/sk-liker-mobile/?p=bx7k2m`)
- 모바일 화면은 주소의 `p` 값으로 `players.csv`에서 같은 ID 줄을 찾아 보여줘요. 그 줄이 아직 비어 있으면 "COMING SOON" 화면이 떠요.
- **ID는 한 번 정하면 바꾸지 마세요.** 다른 정보는 바꿔도 이미 인쇄한 QR이 그대로 동작해요.
- QR 이미지는 관리 도구에서 만들거나, 아무 QR 생성기에 위 주소를 넣어도 돼요.

## 내 컴퓨터에서 미리 보기

```bash
cd sk-liker-mobile
python3 -m http.server 8000
# http://localhost:8000/?p=bx7k2m&demo
```

## 꼭 알아둘 점

- 사이트는 주소를 아는 누구나 볼 수 있어요. `players.csv`에 **실명·구력은 넣지 말고**, 사진은 본인 동의 후 올려주세요.
- 관리 도구의 데이터는 그 브라우저에만 저장돼요. 다른 PC에서 이어 하려면 "백업 파일 내보내기/불러오기"를 쓰세요. 백업 파일(실명 포함)은 저장소에 올리지 마세요.
- `카드 스캔`은 HTTPS에서만 카메라가 켜져요 (GitHub Pages는 HTTPS). 휴대폰 기본 카메라로 찍어도 돼요.
