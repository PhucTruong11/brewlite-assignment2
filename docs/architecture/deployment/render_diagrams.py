"""Render the report's UML deployment views in the team's original visual style.

Run with Python and PyMuPDF installed. SVGs remain editable vector sources;
PDFs are vector image assets consumed by the existing LaTeX report.
"""
from pathlib import Path
from html import escape
from math import hypot
import pymupdf

ROOT = Path(__file__).resolve().parent
FONT = pymupdf.Font(fontfile='C:/Windows/Fonts/arial.ttf') if Path('C:/Windows/Fonts/arial.ttf').exists() else pymupdf.Font('helv')

class Drawing:
    def __init__(self, height):
        self.parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="780" height="{height}" viewBox="0 0 780 {height}">', '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10" fill="#334155"/></marker></defs>', '<rect width="100%" height="100%" fill="white"/>']
    def text(self, x, y, lines, size=19, bold=False, anchor='middle', color='#182334'):
        for i, line in enumerate(lines):
            self.parts.append(f'<text x="{x}" y="{y+i*(size+6)}" text-anchor="{anchor}" font-family="Arial" font-size="{size}" font-weight="{"bold" if bold else "normal"}" fill="{color}">{escape(line)}</text>')
    def box(self, x,y,w,h,fill='white',stroke='#50627F'):
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>')
    def node(self,x,y,w,h,lines,artifact=None,size=19):
        self.parts.append(f'<path d="M{x} {y} l9 -9 h{w} v{h} l-9 9 M{x+w} {y} l9 -9 M{x} {y} h{w} v{h} h-{w} Z" fill="white" stroke="#50627F" stroke-width="1.5"/>')
        self.text(x+w/2,y+28,lines,size,True)
        if artifact:
            ah=len(artifact)*23+23
            self.artifact(x+16,y+h-ah-14,w-32,ah,artifact)
    def artifact(self,x,y,w,h,lines):
        self.box(x,y,w,h,'#F5F7FC')
        self.parts.append(f'<path d="M{x+w-19} {y+8} h7 l7 7 v10 h-14 Z M{x+w-12} {y+8} v7 h7" fill="white" stroke="#7C90B0"/>')
        self.text(x+w/2,y+27,lines,17)
    def note(self,x,y,w,h,lines):
        self.parts.append(f'<path d="M{x} {y} h{w-16} l16 16 v{h-16} h-{w} Z M{x+w-16} {y} v16 h16" fill="#FFF9E8" stroke="#B68836" stroke-width="1.3"/>')
        self.text(x+14,y+28,lines,17,anchor='start',color='#514329')
    def arrow(self,points,label=None,at=None,dashed=False):
        pts=' '.join(f'{x},{y}' for x,y in points)
        self.parts.append(f'<polyline points="{pts}" fill="none" stroke="#334155" stroke-width="1.7"'+(' stroke-dasharray="7 5"' if dashed else '')+'/>')
        x,y=points[-1]; px,py=points[-2]; length=hypot(x-px,y-py)
        ux,uy=(x-px)/length,(y-py)/length
        triangle=[(x,y),(x-10*ux+4*uy,y-10*uy-4*ux),(x-10*ux-4*uy,y-10*uy+4*ux)]
        self.parts.append('<polygon points="'+' '.join(f'{a},{b}' for a,b in triangle)+'" fill="#334155"/>')
        if label:
            x,y=at
            width=max(FONT.text_length(s,fontsize=16) for s in label)+8
            self.box(x-width/2,y-17,width,len(label)*22+3,'white','white')
            self.text(x,y,label,16)
    def save(self,name):
        svg=ROOT/f'{name}.svg'
        svg.write_text('\n'.join(self.parts+['</svg>']),encoding='utf-8')
        doc=pymupdf.open(svg)
        (ROOT/f'{name}.pdf').write_bytes(doc.convert_to_pdf())

d=Drawing(760)
d.node(245,30,285,105,['«device»','Thiết bị người dùng','Trình duyệt web'])
d.box(28,220,715,280)
d.text(385,247,['PRODUCTION · Hình 3.2b'],19,True)
d.node(55,280,180,150,['Vercel','Next.js / CDN'],['Web build'])
d.node(300,280,180,150,['Render','NestJS / Docker'],['API build'])
d.node(545,280,175,150,['Supabase','PostgreSQL'],['DB schema'])
d.arrow([(388,135),(388,190),(145,190),(145,271)],['HTTPS 443'],(270,181))
d.arrow([(235,325),(299,325)],['HTTPS'],(267,311))
d.arrow([(480,325),(544,325)],['TLS'],(511,311))
d.text(385,471,['API tích hợp PayOS (VietQR) và Brevo (OTP).'],17)
d.node(40,590,300,125,['«device» · Local · Hình 3.2c'],['Docker Compose','web / api / db'])
d.node(440,590,300,125,['CI/CD · Hình 3.2d'],['GitHub Actions + GHCR','Kiểm thử, phát hành theo SHA'])
d.arrow([(340,651),(439,651)],['Commit / PR'],(391,631))
d.arrow([(600,581),(600,540),(390,540),(390,500)],['Deploy sau CI'],(494,531),True)
d.save('overview')

d=Drawing(950)
d.node(40,25,340,108,['«device» · Thiết bị người dùng','Trình duyệt web'])
d.node(40,215,340,160,['Vercel Platform','«executionEnvironment»','Next.js Frontend · apps/web'],['Web build + rewrite /api/*'])
d.node(40,470,340,180,['Render Service · Docker','«executionEnvironment»','NestJS API · apps/api · PORT'],['Backend production build','GET /api/health'])
d.node(40,760,340,145,['Supabase Platform','«executionEnvironment»'],['Managed PostgreSQL','Schema + dữ liệu bền vững'])
d.node(520,460,220,100,['PayOS · VietQR','«external system»'])
d.node(520,665,220,100,['Brevo · Email OTP','«external system»'])
d.arrow([(210,133),(210,205)],['HTTPS / TCP 443'],(210,177))
d.arrow([(210,375),(210,460)],['HTTPS 443 · cookie JWT','Proxy /api/:path*'],(210,410))
d.arrow([(210,650),(210,750)],['PostgreSQL / TLS','Session Pooler · TCP 5432'],(210,694))
d.arrow([(380,505),(510,505)],['HTTPS 443','Tạo link / đối soát'],(448,454))
d.arrow([(520,540),(480,540),(480,592),(381,592)],['Webhook đã ký'],(454,574))
d.arrow([(380,620),(450,620),(450,715),(510,715)],['HTTPS / OTP'],(459,650))
d.note(430,815,310,102,['TLS: sslmode=require.','Secrets cấu hình trên nền tảng.','Lưu trữ do Supabase quản lý.'])
d.save('production')

d=Drawing(950)
d.node(25,25,715,895,['«device» · Máy lập trình viên · Windows'])
d.node(50,115,430,700,['«executionEnvironment»','Docker Engine / Compose · bridge'])
d.node(80,215,370,140,['«executionEnvironment» · web','Next.js · container / host :3000'],['Next.js build · .next/'])
d.node(80,435,370,145,['«executionEnvironment» · api','NestJS · container :3001'],['NestJS build · dist/'])
d.node(80,660,370,130,['«executionEnvironment» · db','PostgreSQL 16 · container :5432'],['Volume brewlite_pgdata'])
d.artifact(505,150,225,135,['docker-compose.yml','dev.yml: db','app.yml: api, web'])
d.arrow([(515,250),(481,250)],None,dashed=True)
d.arrow([(265,355),(265,425)],['HTTP / TCP 3001','DNS: api:3001 · proxy /api/*'],(265,387))
d.arrow([(265,580),(265,650)],['PostgreSQL / TCP 5432','DNS: db:5432'],(265,614))
d.note(515,400,195,172,['Healthcheck:','web: GET /','api: GET','/api/products','db: pg_isready'])
d.note(515,655,195,150,['Cổng từ host:','web: 3000','api: 127.0.0.1','  :3001','db: 5433 → 5432'])
d.text(380,867,['Project: brewlite-assignment2','Volume lưu tại /var/lib/postgresql/data'],18)
d.save('local')

d=Drawing(965)
d.node(35,25,440,125,['GitHub Repository · brewlite-assignment2'],['.github/workflows/ci.yml','.github/workflows/cd.yml'])
d.node(35,265,440,575,['«executionEnvironment»','GitHub Actions Runner · Node.js 22'])
d.artifact(65,355,380,95,['CI: backend / frontend / integration-e2e','Lint · unit test · build','Kiểm thử tích hợp và E2E qua API'])
d.node(65,515,380,125,['«executionEnvironment»','PostgreSQL 16 tạm cho kiểm thử'],['brewlite_test · CI only'])
d.artifact(65,710,380,95,['CD: preflight → migration','Deploy API → web → smoke test','Release theo cùng commit SHA'])
d.node(535,350,205,150,['GHCR'],['Docker image','API + web','Tag commit SHA'])
d.node(535,660,220,180,['Production'],['Migration DB','Render API','Vercel web','Smoke test'])
d.arrow([(255,150),(255,255)],['CI: PR vào main','CD: push main / tag v* / thủ công'],(255,192))
d.arrow([(255,450),(255,505)],['Migration / test'],(255,481))
d.arrow([(65,402),(50,402),(50,674),(255,674),(255,700)],['CI đạt'],(255,674),True)
d.arrow([(445,743),(505,743),(505,433),(525,433)],['Push SHA'],(506,586))
d.arrow([(445,777),(525,777)],['Deploy'],(490,765))
d.note(35,875,705,75,['Environment production: kiểm tra đích, baseline và backup trước migration.','Rollout lỗi: thử rollback ứng dụng. Rollback DB xử lý riêng theo runbook.'])
d.save('release')
