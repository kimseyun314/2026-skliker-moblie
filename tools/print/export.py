#!/usr/bin/env python3
"""포토카드 주문용 이미지 내보내기 (퍼블로그 포토카드 63×88mm)
  python3 tools/print/export.py <사이트 주소> <출력 폴더> [dpi]
  예) python3 -m http.server 8000 (저장소 폴더에서) → python3 tools/print/export.py http://localhost:8000 out 300
- 선수마다 앞면·뒷면 PNG (작업 사이즈 67×92mm = 상품 63×88mm + 사방 2mm 재단 여백, RGB)
- 필요: pip install playwright pillow && playwright install chromium
"""
import asyncio, csv, os, sys
from playwright.async_api import async_playwright
from PIL import Image

base, out = sys.argv[1].rstrip('/'), sys.argv[2]
dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 300
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
rows = list(csv.DictReader(open(os.path.join(root, 'data/players.csv'), encoding='utf-8-sig')))
os.makedirs(out, exist_ok=True)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 670, 'height': 920}, device_scale_factor=dpi / 254)
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        for r in rows:
            if not r.get('닉네임'):
                continue
            num = int(r['등번호']) if r['등번호'].isdigit() else 0
            for side in ('front', 'back'):
                await pg.goto(f"{base}/tools/print/?id={r['ID']}&side={side}")
                await pg.wait_for_function('window.READY', timeout=20000)
                await pg.wait_for_timeout(150)
                f = os.path.join(out, f"{num:02d}_{r['닉네임']}_{r['ID']}_{'앞' if side == 'front' else '뒤'}.png")
                await pg.locator('#c').screenshot(path=f)
                im = Image.open(f).convert('RGB')
                im.save(f, dpi=(dpi, dpi), optimize=True)
                print(os.path.basename(f), im.size)
        if errs:
            print('ERR', errs)
        await b.close()

asyncio.run(main())
