#!/usr/bin/env python3
"""슬라이드에 넣을 글꼴을 만들어 fonts.css(base64)로 저장해요. 한 번만 돌리면 돼요.
- 한글: Noto Sans CJK KR (Regular 400 · Bold 700 · Black 900), 자주 쓰는 한글 2,350자 + 영문·숫자·기호만 남겨요
- 영문 제목: Anton 400, 라벨: Oswald 500 · 700 (woff2 파일 경로를 인자로)
사용: python3 make_fonts.py <Noto CJK 폴더> <anton-400.woff2> <oswald-500.woff2> <oswald-700.woff2>
필요: pip install fonttools brotli
"""
import sys, io, base64, os
from fontTools.ttLib import TTCollection
from fontTools import subset

noto_dir, anton, osw5, osw7 = sys.argv[1:5]
here = os.path.dirname(os.path.abspath(__file__))

# KS X 1001 한글 2,350자 + 자모 + ASCII + 자주 쓰는 기호
chars = set()
for hi in range(0xB0, 0xC9):
    for lo in range(0xA1, 0xFF):
        try: chars.add(bytes([hi, lo]).decode('euc-kr'))
        except UnicodeDecodeError: pass
chars |= {chr(c) for c in range(0x20, 0x7F)}
chars |= {chr(c) for c in range(0x3131, 0x3164)}
chars |= set('·×↔→←↑↓✦★☆…“”‘’「」『』○●◆■□▲△▼▽♥♡~!?%&()[]{}<>+-=/\\|:;\'",.、。·')
text = ''.join(sorted(chars))

def sub(ttc_path, idx):
    font = TTCollection(ttc_path).fonts[idx]
    opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['*']; opts.name_IDs = ['*']; opts.notdef_outline = True
    s = subset.Subsetter(opts); s.populate(text=text); s.subset(font)
    buf = io.BytesIO(); font.flavor = 'woff2'; font.save(buf); return buf.getvalue()

faces = []
def face(family, weight, data):
    faces.append("@font-face{font-family:'%s';font-style:normal;font-weight:%s;font-display:block;src:url(data:font/woff2;base64,%s) format('woff2');}" % (family, weight, base64.b64encode(data).decode()))

for w, f in [(400, 'NotoSansCJK-Regular.ttc'), (700, 'NotoSansCJK-Bold.ttc'), (900, 'NotoSansCJK-Black.ttc')]:
    face('Noto Sans KR', w, sub(os.path.join(noto_dir, f), 1))
face('Anton', 400, open(anton, 'rb').read())
face('Oswald', 500, open(osw5, 'rb').read())
face('Oswald', 700, open(osw7, 'rb').read())
out = os.path.join(here, 'fonts.css')
open(out, 'w').write('/* 슬라이드용 내장 글꼴 (make_fonts.py로 생성) */\n' + '\n'.join(faces) + '\n')
print(out, round(os.path.getsize(out) / 1024), 'KB')
