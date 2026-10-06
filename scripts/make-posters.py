# สร้างโปสเตอร์ตัวอย่าง (รูปปกกิจกรรม 16:9 + โปสเตอร์ประกาศ 3:4) เก็บที่ server/demo-posters/
# วิธีใช้: npm run posters  (ต้องมี Python + Pillow และ Google Chrome ในเครื่อง)
# รูปปกกิจกรรมตอนนี้เป็นรูปจริง → ไม่เขียนทับไฟล์ที่มีอยู่แล้ว (สร้างเฉพาะที่ยังไม่มี) · บังคับสร้างใหม่ทั้งหมด: npm run posters -- --force
#
# ทำไมใช้ Chrome: Pillow ในเครื่องส่วนใหญ่ไม่มี raqm จึงวางสระ/วรรณยุกต์ภาษาไทยผิดที่
# เลยเขียนโปสเตอร์เป็น HTML/CSS แล้วให้ Chrome แบบ headless ถ่ายภาพ (จัดตัวอักษรไทยถูกต้อง) แล้วค่อยแปลงเป็น JPEG
# โปสเตอร์ทั้งหมดวาดเอง ไม่ใช้โลโก้หรือรูปของมหาวิทยาลัย

import html
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'server' / 'demo-posters'

CHROME_CANDIDATES = [
    os.environ.get('CHROME_PATH', ''),
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'google-chrome',
    'chromium',
]

# สีเดียวกับ src/lib/categories.ts (สีหลัก, สีเข้มสำหรับไล่เฉด)
CATEGORY = {
    'academic': ('วิชาการ', '#2F5BD3', '#16307A'),
    'volunteer': ('จิตอาสา', '#146C38', '#0A3B1E'),
    'sport': ('กีฬา', '#C2410C', '#6E2206'),
    'culture': ('ศิลปวัฒนธรรม', '#9D2C8A', '#4E1245'),
}

# id ตรงกับกิจกรรมใน server/seed.mjs (วันเวลาในข้อมูลเปลี่ยนทุกครั้งที่เปิด server จึงไม่พิมพ์วันที่ลงโปสเตอร์)
ACTIVITIES = [
    ('demo-hackathon', 'academic', '🚀', 'NKC Hackathon<br>2026', 'ประชันไอเดียเขียนโปรแกรมแก้โจทย์จริง', 'อาคารเรียนรวม 2 ห้อง NK6301', '4 ชั่วโมงกิจกรรม', 'เช็กอินในแอป'),
    ('demo-beach-cleanup', 'volunteer', '🏖️', 'จิตอาสา<br>ทำความสะอาดหาดสีดา', 'ร่วมเก็บขยะรักษาสิ่งแวดล้อมริมฝั่งโขง', 'หาดสีดา ต.หนองกอมเกาะ', 'ชั่วโมงจิตอาสา', 'ใบเซ็นชื่อ'),
    ('demo-sports-day', 'sport', '🏆', 'กีฬาสี<br>เชื่อมความสัมพันธ์', 'แข่งกีฬาพื้นบ้านและสากล สานสัมพันธ์นักศึกษา', 'โรงยิมพลศึกษา', '3 ชั่วโมงกิจกรรม', 'เช็กอินในแอป'),
    ('demo-photo-exhibition', 'culture', '📸', 'นิทรรศการ<br>ภาพถ่ายริมโขง', 'ชมวิถีชีวิตริมแม่น้ำโขงฝีมือนักศึกษา', 'ลานหน้าห้องสมุดช่อวายุภักษ์', '6 ชั่วโมงกิจกรรม', 'เช็กอินในแอป'),
    ('demo-ai-talk', 'academic', '🤖', 'AI in Everyday<br>Life', 'สัมมนาพิเศษการประยุกต์ใช้ AI อย่างสร้างสรรค์', 'อาคารเรียนรวม 1 ห้อง NK2301', '3 ชั่วโมงกิจกรรม', 'รับ 120 ที่'),
    ('demo-music-fest', 'culture', '🎸', 'Music Fest<br>@ NKC', 'เทศกาลดนตรีร็อคและป๊อปจากวงนักศึกษา', 'ลานกิจกรรมหน้าคอมเพล็กซ์', '4 ชั่วโมงกิจกรรม', 'เข้าชมฟรี'),
    ('demo-marathon', 'sport', '🏃', 'NKC Mini<br>Marathon 2026', 'วิ่งการกุศลรอบวิทยาเขตหนองคาย', 'จุดปล่อยตัวหน้าคอมเพล็กซ์', '3 ชั่วโมงกิจกรรม', 'เช็กอินในแอป'),
    ('demo-blood-donation', 'volunteer', '🩸', 'บริจาคโลหิต<br>กู้วิกฤติคลังเลือด', 'ร่วมบริจาคโลหิตกับสภากาชาดไทย', 'โถงชั้น 1 อาคารเรียนรวม 1', 'ชั่วโมงจิตอาสา', 'ใบเซ็นชื่อ'),
]

BASE_CSS = """
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; }
body { font-family: 'Leelawadee UI', 'Leelawadee', 'Tahoma', sans-serif; color: #fff; overflow: hidden; }
.emoji { font-family: 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif; }
.circle { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.08); }
.brand { display: flex; align-items: center; gap: 12px; font-size: 22px; font-weight: 600; opacity: 0.92; }
.brand .dot { width: 34px; height: 34px; border-radius: 10px; background: #fff; color: #0F5F8C; font-weight: 800;
  display: flex; align-items: center; justify-content: center; font-size: 17px; }
.pill { display: inline-block; padding: 8px 20px; border-radius: 999px; background: rgba(255,255,255,0.18);
  border: 2px solid rgba(255,255,255,0.35); font-size: 22px; font-weight: 700; }
"""


def activity_html(cat, emoji, title, tagline, place, hours, badge):
    label, color, dark = CATEGORY[cat]
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{BASE_CSS}
body {{ background: linear-gradient(135deg, {color} 0%, {dark} 100%); position: relative; }}
.content {{ position: absolute; left: 72px; top: 64px; width: 760px; display: flex; flex-direction: column; gap: 22px; }}
h1 {{ font-size: 74px; line-height: 1.12; font-weight: 800; letter-spacing: -0.5px; text-shadow: 0 4px 18px rgba(0,0,0,0.25); }}
.tag {{ font-size: 27px; line-height: 1.45; opacity: 0.95; max-width: 700px; }}
.info {{ display: flex; flex-wrap: wrap; gap: 12px; margin-top: 6px; }}
.chip {{ background: #fff; color: {dark}; border-radius: 14px; padding: 10px 18px; font-size: 23px; font-weight: 700; }}
.chip.ghost {{ background: rgba(0,0,0,0.22); color: #fff; }}
.art {{ position: absolute; right: 70px; top: 140px; width: 400px; height: 400px; border-radius: 50%;
  background: rgba(255,255,255,0.14); border: 6px solid rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center; }}
.art .emoji {{ font-size: 210px; }}
.footer {{ position: absolute; left: 72px; right: 72px; bottom: 44px; display: flex; justify-content: space-between; align-items: center; }}
</style></head><body>
<div class="circle" style="width:520px;height:520px;right:-160px;top:-180px"></div>
<div class="circle" style="width:260px;height:260px;left:560px;bottom:-120px"></div>
<div class="content">
  <div><span class="pill">{label}</span></div>
  <h1>{title}</h1>
  <p class="tag">{html.escape(tagline)}</p>
  <div class="info">
    <span class="chip"><span class="emoji">📍</span> {html.escape(place)}</span>
    <span class="chip ghost">{html.escape(hours)}</span>
    <span class="chip ghost">{html.escape(badge)}</span>
  </div>
</div>
<div class="art"><span class="emoji">{emoji}</span></div>
<div class="footer"><div class="brand"><span class="dot">NK</span> KKUNK Today · มข. วิทยาเขตหนองคาย</div><div style="font-size:22px;opacity:.85">ลงทะเบียนในแอป</div></div>
</body></html>"""


def find_chrome():
    for candidate in CHROME_CANDIDATES:
        if not candidate:
            continue
        if Path(candidate).exists():
            return candidate
        found = shutil.which(candidate)
        if found:
            return found
    sys.exit('ไม่พบ Chrome/Edge ตั้ง CHROME_PATH ให้ชี้ไปที่ไฟล์ chrome ก่อน')


def render(chrome, work, name, markup, width, height):
    page = work / f'{name}.html'
    png = work / f'{name}.png'
    page.write_text(markup, encoding='utf-8')
    subprocess.run(
        [
            chrome,
            '--headless=new',
            '--disable-gpu',
            '--hide-scrollbars',
            '--force-device-scale-factor=1',
            f'--user-data-dir={work / "profile"}',
            f'--window-size={width},{height}',
            f'--screenshot={png}',
            page.as_uri(),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=60,
    )
    image = Image.open(png).convert('RGB')
    if image.size != (width, height):
        image = image.crop((0, 0, width, height))
    target = OUT / f'{name}.jpg'
    image.save(target, 'JPEG', quality=85, optimize=True, progressive=True)
    print(f'{target.relative_to(ROOT)}  {target.stat().st_size // 1024} KB')


def main():
    chrome = find_chrome()
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        force = '--force' in sys.argv
        for activity_id, cat, emoji, title, tagline, place, hours, badge in ACTIVITIES:
            if not force and (OUT / f'{activity_id}.jpg').exists():
                print(f'ข้าม {activity_id}.jpg (มีรูปอยู่แล้ว)')
                continue
            render(chrome, work, activity_id, activity_html(cat, emoji, title, tagline, place, hours, badge), 1280, 720)


if __name__ == '__main__':
    main()
