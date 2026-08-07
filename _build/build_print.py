# -*- coding: utf-8 -*-
"""Genera _build/_print.html (portada + wireframes + fichas) para exportar a PDF."""
import json, os, glob
import render  # reutiliza render_svg, detail_html, MENUS, PROFILE_*

BASE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATADIR=os.path.join(BASE,"_build","data")

def load_screens():
    screens=[]
    for fp in sorted(glob.glob(os.path.join(DATADIR,"*.json"))):
        arr=json.load(open(fp,encoding="utf-8"))
        screens.extend(arr if isinstance(arr,list) else [arr])
    screens.sort(key=lambda s:(int(s["id"].split(".")[0]), int(s["id"].split(".")[1])))
    return screens

CSS = """
@page { size: A4 portrait; margin: 14mm 12mm 16mm; }
*{box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;color:#2b2f36;margin:0;font-size:10pt;line-height:1.45}
h1,h2,h3,h4{margin:0}
.cover{height:255mm;display:flex;flex-direction:column;justify-content:center;page-break-after:always}
.cover .kick{font-size:11pt;color:#5b7089;font-weight:700;letter-spacing:.5px}
.cover h1{font-size:26pt;margin:8px 0 6px;color:#2b2f36}
.cover .sub{font-size:12pt;color:#6b7280;margin-bottom:26px}
.cover .meta{font-size:10pt;color:#6b7280;border-top:1px solid #c3c8d0;padding-top:14px;max-width:150mm}
.cover .meta b{color:#2b2f36}
.toc{page-break-after:always}
.toc h2{font-size:15pt;border-left:4px solid #5b7089;padding-left:10px;margin-bottom:12px}
.toc .grp{font-weight:700;color:#5b7089;margin:12px 0 4px;font-size:10.5pt}
.toc ul{margin:0 0 0 6px;padding:0;list-style:none;columns:2;column-gap:14mm}
.toc li{font-size:9.5pt;padding:2px 0;color:#2b2f36}
.pdiv{page-break-before:always;border-left:5px solid #5b7089;padding:4px 0 4px 12px;margin-bottom:6px}
.pdiv h2{font-size:18pt}
.pdiv .a{font-size:10pt;color:#6b7280;margin-top:4px}
.screen{page-break-before:always}
.screen .hd{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #c3c8d0;padding-bottom:6px;margin-bottom:10px}
.screen .hd h3{font-size:14pt}
.screen .hd .tag{font-size:9pt;color:#6b7280}
.wf{border:1px solid #d9dce1;border-radius:4px;background:#fafbfc;padding:6px;margin-bottom:12px;text-align:center;break-inside:avoid}
.wf svg{width:100% !important;height:auto !important;max-width:100%}
.screen.mob .wf svg{width:72mm !important}
.detail h4{font-size:11pt;color:#5b7089;border-bottom:1px solid #e6e8ec;padding-bottom:3px;margin:10px 0 7px}
.detail .src{font-weight:normal;color:#9aa1ac;font-size:8.5pt}
.detail p.desc{margin:0 0 8px}
.detail p.lbl{font-weight:700;margin:9px 0 4px;font-size:9.5pt}
.detail table{width:100%;border-collapse:collapse;margin-bottom:6px}
.detail th{background:#e6e8ec;text-align:left;padding:4px 6px;font-size:8.5pt}
.detail td{border-bottom:1px solid #eceef1;padding:4px 6px;font-size:9pt;vertical-align:top}
.detail td.req,.detail .req{color:#5b7089;font-weight:600;white-space:nowrap}
.detail tr,.detail .ux{break-inside:avoid}
.detail .ux{margin:7px 0}
.detail .uxc{font-weight:700;margin:0 0 2px;font-size:9.5pt}
.detail .ux p{margin:0 0 3px}
.detail .prin{color:#5b7089;font-style:italic;font-size:9pt}
"""

def build():
    screens=load_screens()
    order=["gerencial","operacional","tecnico","auditor","super-admin"]
    by={}
    for s in screens: by.setdefault(s["profile"],[]).append(s)
    H=['<!doctype html><html lang="es"><head><meta charset="utf-8">',
       '<title>EMS PASA — Wireframes y justificación UX</title>',
       f'<style>{CSS}</style></head><body>']
    # portada
    H.append('<section class="cover">')
    H.append('<div class="kick">GLOBE POWER SpA · PARQUE ARAUCO (PASA)</div>')
    H.append('<h1>EMS — Wireframes de baja fidelidad<br>y justificación de experiencia de usuario</h1>')
    H.append('<div class="sub">Documento de diseño funcional · 5 perfiles · 35 pantallas</div>')
    H.append('<div class="meta"><b>Fuente:</b> Especificación de Pantallas v2.0 (Anexo 07 PASA). '
             '<b>Alcance:</b> operación monopaís (Chile). '
             '<b>Mapa gerencial:</b> reconciliado a 3 niveles (País → Centro comercial → Tienda/Local). '
             '<b>Versión del documento:</b> 31 de julio de 2026 · Confidencial.</div>')
    H.append('</section>')
    # índice
    H.append('<section class="toc"><h2>Índice de pantallas</h2>')
    for p in order:
        if p not in by: continue
        H.append(f'<div class="grp">Perfil {render.PROFILE_LABEL[p]}</div><ul>')
        for s in by[p]:
            H.append(f'<li>{s["id"]} · {s["title"]}</li>')
        H.append('</ul>')
    H.append('</section>')
    # secciones por perfil + pantallas
    for p in order:
        if p not in by: continue
        H.append(f'<section class="pdiv"><h2>Perfil {render.PROFILE_LABEL[p]}</h2>'
                 f'<div class="a">{render.PROFILE_AUTH[p]}</div></section>')
        for s in by[p]:
            dev = "Móvil · PWA 390×844" if s.get("device")=="mobile" else "Escritorio · 1440×900"
            cls = "screen mob" if s.get("device")=="mobile" else "screen"
            svg = render.render_svg(s)
            H.append(f'<section class="{cls}"><div class="hd"><h3>{s["id"]} · {s["title"]}</h3>'
                     f'<div class="tag">Perfil {render.PROFILE_LABEL[p]} · {dev}</div></div>')
            H.append(f'<div class="wf">{svg}</div>')
            H.append(render.detail_html(s))
            H.append('</section>')
    H.append('</body></html>')
    out=os.path.join(BASE,"_build","_print.html")
    open(out,"w",encoding="utf-8").write("\n".join(H))
    print("OK:",out)

if __name__=="__main__":
    build()
