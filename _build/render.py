# -*- coding: utf-8 -*-
"""
Renderizador de wireframes low-fi para EMS PASA.
Lee JSON por pantalla (en _build/data) y emite:
  - wireframes/<carpeta-perfil>/<id>-<slug>.svg
  - wireframes/<carpeta-perfil>/<id>-<slug>.detalle.md
Luego construye wireframes/index.html (dos columnas: wireframe | detalle).

Estilo: escala de grises + un único acento gris azulado para interactivos/CTA.
"""
import json, os, glob, html

# ------------------------------------------------------------------ tokens
BG      = "#ffffff"
PANEL   = "#f3f4f6"   # relleno de bloque claro
PANEL2  = "#e6e8ec"   # relleno alterno / cabeceras de tabla
LINE    = "#c3c8d0"   # bordes
LINE2   = "#d9dce1"   # bordes suaves / grillas internas
INK     = "#2b2f36"   # texto principal (casi negro)
INK2    = "#6b7280"   # texto secundario
INK3    = "#9aa1ac"   # texto terciario / placeholder
ACCENT  = "#5b7089"   # gris azulado — SOLO interactivo/CTA/activo
ACCENT_BG = "#e7ecf1" # fondo tenue de acento (item activo)
# tonos de "semáforo" en escala de gris (placeholder low-fi, con letra)
ST_OK   = "#c9ced6"   # verde -> gris claro
ST_WARN = "#9aa1ac"   # ámbar -> gris medio
ST_CRIT = "#4b5059"   # rojo  -> gris oscuro
ST_NULL = "#eceef1"   # gris  -> sin dato

FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
MONTHS=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
MALLS_W=["Costanera","Egaña","A. Las Condes","Maipú","Vespucio","Ñuñoa"]
BARV=[0.98,1.12,1.18,1.10,1.24,1.28,1.20,1.26,1.05,1.22,0.99,1.15]

def sample_cell(col,r):
    l=str(col).lower()
    if "mall" in l or "centro" in l or "tenant" in l: return MALLS_W[r%len(MALLS_W)]
    if "zona" in l or "piso" in l or "sala" in l or "rack" in l or "tablero" in l: return f"P{r%3+1}·Z{r%4+1}"
    if "serial" in l or "medidor" in l or "tag" in l or "gateway" in l: return f"SN-{4400+r*7}"
    if "descrip" in l or "motivo" in l or "tipo" in l or "causa" in l: return ["Sobreconsumo","Fase desbal.","Dato tardío","Offline >4h","CNR"][r%5]
    if "sev" in l: return ["Crítica","Alta","Media"][r%3]
    if "apertura" in l or "transcurr" in l or "últim" in l or "hora" in l or "timestamp" in l or "fecha" in l or "heartbeat" in l: return f"11:{10+r}·31-07"
    if "precio" in l: return f"{3.1+r*0.18:.2f}"
    if "consumo" in l or "mwh" in l or "volumen" in l: return f"{120+r*13.4:.0f}"
    if "costo" in l or "uf" in l: return f"{1200+r*230:,}".replace(",",".")
    if "variaci" in l: return ("▲" if r%2 else "▼")+f" {0.6+r*0.7:.1f}%"
    if "%" in l or "cobert" in l or "online" in l or "calidad" in l or "disponib" in l or "éxito" in l or "exito" in l: return f"{88+r*1.3:.1f}%"
    if "estado" in l: return ["Activo","Offline","Estimado","Activo","CNR"][r%5]
    if "usuario" in l or "respons" in l or "aprob" in l: return ["p.soto","m.rivas","c.díaz","a.fuentes"][r%4]
    if "ticket" in l or "orden" in l or "versi" in l or "regla" in l or "integr" in l or "polít" in l or "polit" in l: return f"OT-{2200+r*11}"
    if "n°" in l or "nº" in l or "crít" in l or "warn" in l or "resuel" in l or "medidores" in l or "usuarios" in l or "días" in l or "dias" in l or "requests" in l or "cuota" in l: return str((r*3+2)%9)
    return "—"

# ------------------------------------------------------------------ menús por perfil
MENUS = {
    "gerencial": ["Panel consolidado","Consumo jerárquico","Costos y tendencias",
                  "Reportes ejecutivos","Alarmas agregadas","Exportar reportes"],
    "operacional": ["Monitoreo en vivo","Alarmas y eventos","Tickets y SLA",
                    "Calidad y backfill","CNR pendientes","Mapa de cobertura"],
    "tecnico": ["Mis órdenes","Activos (medidores)","Diagnóstico comms",
                "Registro de intervención","Ingreso CNR manual","Maestro de medidores",
                "Reglas de transformación"],
    "auditor": ["Calidad de datos","Cuadratura de agregación","Pista de auditoría",
                "Trazabilidad / lineage","Datos crudos (raw)","Exportar evidencia"],
    "super-admin": ["Tenants y malls","Config y releases","Usuarios y roles","Observabilidad",
                    "Integraciones","Seguridad y PAM","Réplica y datos","SLOs de datos",
                    "Throttle y cargas","Retención y privacidad"],
}
PROFILE_LABEL = {
    "gerencial":"Gerencial","operacional":"Operacional","tecnico":"Técnico",
    "auditor":"Auditor","super-admin":"Súper-admin",
}
PROFILE_FOLDER = {
    "gerencial":"01-gerencial","operacional":"02-operacional","tecnico":"03-tecnico",
    "auditor":"04-auditor","super-admin":"05-super-admin",
}
PROFILE_AUTH = {
    "gerencial":"Solo lectura · sin MFA",
    "operacional":"MFA obligatorio · escritura alarmas/tickets",
    "tecnico":"MFA obligatorio · escritura terreno",
    "auditor":"MFA obligatorio · solo lectura",
    "super-admin":"Federado + MFA + JIT · máx. privilegio",
}

# ------------------------------------------------------------------ helpers svg
def esc(s): return html.escape(str(s), quote=True)

def rect(x,y,w,h,fill=PANEL,stroke=LINE,rx=6,sw=1,dash=None,extra=""):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d} {extra}/>')

def line(x1,y1,x2,y2,stroke=LINE,sw=1,dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" stroke-width="{sw}"{d}/>'

def text(x,y,s,size=13,fill=INK,weight="normal",anchor="start",style=""):
    return (f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" '
            f'fill="{fill}" font-weight="{weight}" text-anchor="{anchor}" {style}>{esc(s)}</text>')

def wrap(s, maxchars):
    words, lines, cur = str(s).split(), [], ""
    for w in words:
        if len(cur)+len(w)+1 <= maxchars: cur = (cur+" "+w).strip()
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def multitext(x,y,s,size=12,fill=INK2,maxchars=40,lh=15,weight="normal"):
    out=[]
    for i,ln in enumerate(wrap(s,maxchars)):
        out.append(text(x,y+i*lh,ln,size=size,fill=fill,weight=weight))
    return "".join(out)

def reqtag(x,y,reqs):
    if not reqs: return ""
    s = "["+", ".join(reqs)+"]"
    return text(x,y,s,size=10.5,fill=ACCENT,weight="600")

STC = {"ok":ST_OK,"warn":ST_WARN,"crit":ST_CRIT,"null":ST_NULL,
       "accent":ACCENT,"panel":PANEL2,"ink":INK3}
def stc(v):
    return STC.get(v, v) if isinstance(v,str) else v

def dot(cx,cy,r,fill,letter=None):
    fill=stc(fill)
    s=f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke="{LINE}" stroke-width="0.8"/>'
    if letter:
        lc = "#ffffff" if fill in (ST_CRIT,) else INK
        s+=text(cx,cy+3.3,letter,size=9,fill=lc,weight="700",anchor="middle")
    return s

# ------------------------------------------------------------------ grilla de contenido
GRID_X0, GRID_X1, GCOLS, GGUT = 264, 1416, 12, 16
GCOLW = (GRID_X1-GRID_X0-(GCOLS-1)*GGUT)/GCOLS   # ancho de una columna

def grid_x(col):  return GRID_X0 + col*(GCOLW+GGUT)
def grid_w(span): return span*GCOLW + (span-1)*GGUT

def resolve_geometry(scr):
    """Convierte {col,colspan,y,h} a x/w absolutos (desktop). En móvil apila en 1 col.
    Bloques que ya traen x/w explícitos se respetan."""
    device=scr.get("device","desktop")
    blocks=scr.get("blocks",[])
    if device=="mobile":
        y=136
        for b in blocks:
            b["x"]=16; b["w"]=358
            b["y"]=y; y+=b.get("h",80)+12
        return
    for b in blocks:
        if "col" in b:
            b["x"]=grid_x(b["col"]); b["w"]=grid_w(b.get("colspan",1))
        b.setdefault("x",264); b.setdefault("w",300)
        b.setdefault("y",184); b.setdefault("h",120)

# ------------------------------------------------------------------ block primitives
def draw_block(b):
    """Dibuja un bloque rotulado según su tipo. Coordenadas absolutas en el lienzo."""
    t=b.get("type","panel"); x=b["x"]; y=b["y"]; w=b["w"]; h=b["h"]
    label=b.get("label",""); meta=b.get("meta",""); reqs=b.get("reqs",[])
    s=[]
    title_h = 22
    # marco base salvo tipos que dibujan su propio marco
    frameless = t in ("title","kpirow","tabs","actions","legend")
    if not frameless:
        s.append(rect(x,y,w,h,fill=PANEL,stroke=LINE))
    pad=12
    # etiqueta principal (arriba-izq del bloque) para tipos con marco
    if not frameless:
        s.append(text(x+pad,y+18,label,size=13,fill=INK,weight="700"))
        if meta: s.append(text(x+pad,y+35,meta,size=11,fill=INK2))
    body_y = y+ (44 if meta else 30)

    if t=="kpi":
        # tarjeta KPI: valor grande + delta
        s.append(text(x+pad,y+ (h*0.62), b.get("value","—"), size=26, fill=INK, weight="700"))
        s.append(text(x+pad,y+ (h*0.62)+18, b.get("delta","Δ % vs. período ant."), size=10.5, fill=INK2))
        if b.get("spark"):
            sx=x+pad; sw_=w-2*pad; sy=y+h-16
            pts=" ".join(f"{sx+sw_*i/6},{sy-8*(0.5+0.5*((i*37)%5)/5)}" for i in range(7))
            s.append(f'<polyline points="{pts}" fill="none" stroke="{ACCENT}" stroke-width="1.5"/>')
    elif t=="map":
        # mapa: región punteada + marcadores de estado
        mx,my,mw,mh = x+pad, body_y, w-2*pad, y+h-body_y-14
        s.append(rect(mx,my,mw,mh,fill="#fafbfc",stroke=LINE2,dash="4 3",rx=4))
        s.append(text(mx+mw/2,my+mh/2-6,"Mapa geográfico interactivo",size=11,fill=INK3,anchor="middle"))
        markers=b.get("markers",[(0.25,0.35,ST_OK),(0.55,0.55,ST_CRIT),(0.7,0.3,ST_WARN),(0.4,0.7,ST_OK),(0.82,0.68,ST_NULL)])
        for (fx,fy,col) in markers:
            s.append(dot(mx+mw*fx,my+mh*fy,7,col))
    elif t=="planta":
        mx,my,mw,mh = x+pad, body_y, w-2*pad, y+h-body_y-14
        s.append(rect(mx,my,mw,mh,fill="#fafbfc",stroke=LINE2,dash="4 3",rx=4))
        cols,rows=6,3; cw=mw/cols; ch=mh/rows
        pal=[ST_OK,ST_OK,ST_WARN,ST_OK,ST_CRIT,ST_NULL,ST_OK,ST_OK,ST_OK,ST_WARN,ST_OK,ST_OK,ST_OK,ST_CRIT,ST_OK,ST_NULL,ST_OK,ST_OK]
        for r_ in range(rows):
            for c_ in range(cols):
                i=r_*cols+c_
                s.append(rect(mx+c_*cw+3,my+r_*ch+3,cw-6,ch-6,fill=pal[i%len(pal)],stroke=LINE2,rx=3))
        s.append(text(mx+4,my-4,"Plano de planta (SVG provisto por PASA)",size=9.5,fill=INK3))
    elif t=="tree":
        rows=b.get("rows",[])
        ry=body_y+4
        for (indent,txt,state) in rows:
            cx=x+pad+indent*18
            if state: s.append(dot(cx+4,ry+5,4,state))
            car = b.get("caret","▾") if indent==0 else ("▸" if indent==1 else "")
            s.append(text(x+pad+indent*18+ (12 if state else 0), ry+9, f"{car} {txt}".strip(), size=11.5,
                          fill=INK if indent<2 else INK2, weight="600" if indent==0 else "normal"))
            ry+=22
    elif t in ("bars","stackedbars","histogram","waterfall"):
        bx,by,bw,bh=x+pad,body_y,w-2*pad,y+h-body_y-24
        s.append(line(bx,by+bh,bx+bw,by+bh,stroke=LINE)) # eje x
        s.append(line(bx,by,bx,by+bh,stroke=LINE))       # eje y
        n = 12 if t=="histogram" else 8
        gap=4; cw=(bw-(n+1)*gap)/n
        heights=[0.35,0.55,0.7,0.45,0.8,0.6,0.9,0.5,0.65,0.4,0.75,0.55]
        for i in range(n):
            bxx=bx+gap+i*(cw+gap); hh=bh*heights[i%len(heights)]
            if t=="stackedbars":
                seg=[0.5,0.3,0.2]; yy=by+bh
                for j,fr in enumerate(seg):
                    sh=hh*fr; yy-=sh
                    s.append(rect(bxx,yy,cw,sh,fill=[PANEL2,INK3,ST_CRIT][j],stroke=LINE2,rx=0,sw=0.6))
            elif t=="waterfall":
                col= ST_CRIT if i%2 else ST_OK
                s.append(rect(bxx,by+bh-hh,cw,hh,fill=col,stroke=LINE2,rx=0,sw=0.6))
            else:
                col=ACCENT if (b.get("hl") and i==b["hl"]) else PANEL2
                s.append(rect(bxx,by+bh-hh,cw,hh,fill=col,stroke=LINE,rx=1,sw=0.6))
        labs=MONTHS[12-n:]
        for i in range(n):
            bxx=bx+gap+i*(cw+gap)
            s.append(text(bxx+cw/2,by+bh+12,labs[i],size=8,fill=INK3,anchor="middle"))
            if t=="bars":
                hh=bh*heights[i%len(heights)]
                s.append(text(bxx+cw/2,by+bh-hh-4,f"{BARV[i%len(BARV)]:.2f}",size=7.5,fill=INK2,anchor="middle"))
        if b.get("projline") is not None:
            s.append(text(bx+bw-4,by+8,"— proyección",size=9,fill=INK3,anchor="end"))
    elif t in ("line","area"):
        bx,by,bw,bh=x+pad,body_y,w-2*pad,y+h-body_y-24
        s.append(line(bx,by+bh,bx+bw,by+bh,stroke=LINE))
        s.append(line(bx,by,bx,by+bh,stroke=LINE))
        vals=[0.4,0.55,0.5,0.7,0.62,0.8,0.72,0.9,0.6,0.75]
        pts=[(bx+bw*i/(len(vals)-1),by+bh-bh*v) for i,v in enumerate(vals)]
        pstr=" ".join(f"{px:.1f},{py:.1f}" for px,py in pts)
        if t=="area":
            s.append(f'<polygon points="{bx},{by+bh} {pstr} {bx+bw},{by+bh}" fill="{PANEL2}" stroke="none" opacity="0.8"/>')
        s.append(f'<polyline points="{pstr}" fill="none" stroke="{ACCENT}" stroke-width="2"/>')
        if b.get("threshold") is not None:
            ty=by+bh-bh*b["threshold"]
            s.append(line(bx,ty,bx+bw,ty,stroke=INK3,dash="5 4"))
            s.append(text(bx+bw-4,ty-4,"umbral",size=9,fill=INK3,anchor="end"))
        labs=MONTHS[12-len(vals):]
        for i in range(len(vals)):
            px=bx+bw*i/(len(vals)-1)
            s.append(text(px,by+bh+12,labs[i],size=8,fill=INK3,anchor="middle"))
    elif t=="table":
        cols=b.get("cols",["Col A","Col B","Col C","Col D"])
        nrows=b.get("nrows",5)
        tx,ty,tw=x+pad,body_y,w-2*pad
        rowh=min(24,(y+h-body_y-10)/(nrows+1))
        cw=tw/len(cols)
        s.append(rect(tx,ty,tw,rowh,fill=PANEL2,stroke=LINE,rx=3,sw=0.8))
        for i,c in enumerate(cols):
            s.append(text(tx+i*cw+6,ty+rowh*0.66,c,size=10.5,fill=INK,weight="700"))
        for r_ in range(nrows):
            yy=ty+rowh*(r_+1)
            s.append(line(tx,yy+rowh,tx+tw,yy+rowh,stroke=LINE2)) if False else None
            s.append(rect(tx,yy,tw,rowh,fill=(BG if r_%2 else "#fbfbfc"),stroke=LINE2,rx=0,sw=0.5))
            for i in range(len(cols)):
                val=sample_cell(cols[i],r_)
                if i==0 and b.get("statuscol"):
                    s.append(dot(tx+10,yy+rowh/2,4,[ST_OK,ST_CRIT,ST_WARN,ST_OK,ST_NULL][r_%5]))
                    s.append(text(tx+20,yy+rowh*0.68,val,size=8.5,fill=INK2))
                else:
                    s.append(text(tx+i*cw+6,yy+rowh*0.68,val,size=8.5,fill=INK2))
        if b.get("expand"):
            s.append(text(tx+tw-6,ty+rowh*1.66,"▸ fila expandible",size=9.5,fill=ACCENT,anchor="end"))
    elif t=="feed":
        items=b.get("items",[("URGENT","Evento crítico",ST_CRIT),("WARNING","Alerta",ST_WARN),("INFO","Información",ST_NULL)])
        fy=body_y+2
        for (sev,txt,col) in items:
            s.append(dot(x+pad+5,fy+7,4,col))
            s.append(text(x+pad+16,fy+11,f"{sev} · {txt}",size=11,fill=INK2))
            fy+=22
    elif t=="gauge":
        # varios gauges circulares (placeholder)
        n=b.get("n",3); gy=body_y+ (h-body_y+y)/2 -6
        gap=w/(n+1)
        for i in range(n):
            cx=x+gap*(i+1); r=min(26,(h-70)/2)
            s.append(f'<circle cx="{cx}" cy="{y+h*0.58}" r="{r}" fill="none" stroke="{LINE}" stroke-width="6"/>')
            s.append(f'<path d="M {cx-r} {y+h*0.58} A {r} {r} 0 0 1 {cx+r*0.3} {y+h*0.58-r*0.95}" fill="none" stroke="{ACCENT}" stroke-width="6"/>')
            s.append(text(cx,y+h*0.58+4,"◔",size=12,fill=INK3,anchor="middle"))
            s.append(text(cx,y+h*0.58+r+16,b.get("labels",["V","A","kW"])[i%3],size=10,fill=INK2,anchor="middle"))
    elif t=="form":
        fields=b.get("fields",["Campo 1","Campo 2","Campo 3"])
        fy=body_y+2
        for f in fields:
            s.append(text(x+pad,fy+11,f,size=11,fill=INK2))
            s.append(rect(x+pad,fy+16,w-2*pad,20,fill=BG,stroke=LINE,rx=4))
            fy+=44
        checks=b.get("checks")
        if checks:
            s.append(text(x+pad,fy+11,b.get("checksLabel","Secciones a incluir"),size=11,fill=INK2)); fy+=20
            colw=(w-2*pad)/2
            for i,c in enumerate(checks):
                cxp=x+pad+(i%2)*colw; cyp=fy+(i//2)*22
                s.append(rect(cxp,cyp,12,12,fill=ACCENT,stroke=ACCENT,rx=2))
                s.append(text(cxp+6,cyp+10,"✓",size=8.5,fill="#ffffff",anchor="middle"))
                s.append(text(cxp+19,cyp+10,c,size=10.5,fill=INK2))
            fy+=((len(checks)+1)//2)*22+6
    elif t=="heatmap":
        gx,gy,gw,gh=x+pad,body_y,w-2*pad,y+h-body_y-14
        cols_,rows_=b.get("cols",12),b.get("rowsn",7)
        cw=gw/cols_; ch=gh/rows_
        tone=[ST_NULL,PANEL2,INK3,ST_WARN,ST_CRIT]
        for r_ in range(rows_):
            for c_ in range(cols_):
                idx=(r_*3+c_*2)%5
                s.append(rect(gx+c_*cw+1,gy+r_*ch+1,cw-2,ch-2,fill=tone[idx],stroke=LINE2,rx=1,sw=0.4))
    elif t=="timeline":
        items=b.get("items",["Evento","Evento","Evento","Evento"])
        ty=body_y+4
        s.append(line(x+pad+5,ty,x+pad+5,y+h-16,stroke=LINE))
        for it in items:
            s.append(dot(x+pad+5,ty+7,4,PANEL2))
            s.append(text(x+pad+16,ty+11,it,size=11,fill=INK2))
            ty+=26
    elif t=="actions":
        # fila de botones (CTA acento)
        btns=b.get("btns",["Acción"]); bx=x
        for bl in btns:
            bw2=max(90, 12+len(bl)*7)
            primary = (btns.index(bl)==0)
            s.append(rect(bx,y,bw2,h,fill=(ACCENT if primary else BG),stroke=ACCENT,rx=6))
            s.append(text(bx+bw2/2,y+h*0.63,bl,size=12,fill=("#ffffff" if primary else ACCENT),weight="600",anchor="middle"))
            bx+=bw2+10
    elif t=="tabs":
        tabs=b.get("tabs",["Tab"]); bx=x
        for i,tb in enumerate(tabs):
            bw2=max(70,12+len(tb)*7.2); active=(i==b.get("active",0))
            s.append(rect(bx,y,bw2,h,fill=(ACCENT_BG if active else BG),stroke=(ACCENT if active else LINE),rx=6))
            s.append(text(bx+bw2/2,y+h*0.65,tb,size=11.5,fill=(ACCENT if active else INK2),weight="600" if active else "normal",anchor="middle"))
            bx+=bw2+8
    elif t=="kpirow":
        # (no usado directamente; los KPI se colocan como bloques 'kpi')
        pass
    elif t=="legend":
        s.append(text(x,y+12,"Semáforo:",size=10.5,fill=INK2,weight="600"))
        bx=x+70
        for (col,lab) in [(ST_OK,"Normal"),(ST_WARN,"Alerta"),(ST_CRIT,"Crítico"),(ST_NULL,"Sin dato")]:
            s.append(dot(bx,y+8,5,col)); s.append(text(bx+10,y+12,lab,size=10.5,fill=INK2)); bx+=78
    else:  # panel genérico con sublabels
        subs=b.get("subs",[])
        sy=body_y+6
        for su in subs:
            s.append(text(x+pad,sy,"• "+su,size=11,fill=INK2)); sy+=17

    # el tag de requerimientos lo dibuja render_svg() con reqtag_br() (abajo-derecha)
    return "".join(s)

def reqtag_br(x,y,w,h,reqs):
    if not reqs: return ""
    s="["+", ".join(reqs)+"]"
    return text(x+w-8, y+h-8, s, size=10.5, fill=ACCENT, weight="600", anchor="end")

# --- acciones consolidadas en el header (coherente con el prototipo) ---
# Pantallas cuya acción primaria ya está cubierta por la barra de acciones.
DROP_PRIMARY_SVG={"3.4","3.6","4.2","4.5","5.3","6.2","6.3","6.5","6.6","7.1","7.2"}
def is_form_actions(b):
    return any((x or "").strip().lower()=="cancelar" for x in b.get("btns",[]))
def header_actions(scr):
    """Botones de acción que van en el header (primaria + acciones de página,
    deduplicadas). Los controles de formulario (con Cancelar) NO suben."""
    btns=[]; pa=scr.get("primaryAction")
    if pa and scr.get("id") not in DROP_PRIMARY_SVG: btns.append(pa)
    for b in scr.get("blocks",[]):
        if b.get("type")=="actions" and not is_form_actions(b) and not b.get("phide"):
            for x in b.get("btns",[]):
                if x not in btns: btns.append(x)
    if not btns and pa: btns.append(pa)
    return btns

# Cambios de esta iteración (mid-fi) — se muestran en el índice y en la portada del PDF.
CHANGELOG=[
    ("Acciones en el header, sin repetir",
     "Todas las acciones de página se consolidan arriba a la derecha; se eliminó la barra de botones duplicada al pie. Los controles de formulario (Guardar/Cancelar) permanecen junto a su formulario."),
    ("Reportes ejecutivos (3.4): un solo formulario",
     "La configuración y los checkboxes de «Secciones a incluir» quedan integrados en un único contenedor de formulario a la izquierda, con la vista previa a la derecha y el historial a lo ancho abajo."),
    ("Consumo jerárquico (3.2): un solo mapa por niveles",
     "La navegación País → Centro comercial → Tienda/Local ocurre dentro del mismo mapa (igual que en el Panel consolidado); se quitó el contenedor de planta aparte y los KPIs del mall se muestran en 3 tarjetas separadas."),
    ("Densificación de layouts",
     "Métricas en una fila y bloques lado a lado (p. ej. mapa junto al feed en el Panel consolidado) para ver más información sin scroll extenso; la grilla de 12 columnas se mantiene en anchos de laptop."),
    ("Prototipo interactivo (mid-fi)",
     "Login por perfil con credenciales demo, flujos funcionales (Iniciar orden, Nuevo ticket, Ingreso CNR, Asignar alarma, Generar/Exportar…), filtros con chips y buscador. En el perfil Técnico las pantallas son móviles y los modales se muestran dentro del teléfono."),
    ("Apertura del prototipo",
     "El botón «Abrir prototipo interactivo» abre en una pestaña nueva del navegador."),
]

# ------------------------------------------------------------------ chrome
def chrome_desktop(scr):
    W,H=1440,900
    prof=scr["profile"]; s=[]
    s.append(rect(0,0,W,H,fill=BG,stroke="none",rx=0))
    # topbar
    s.append(rect(0,0,W,56,fill="#fbfbfc",stroke=LINE,rx=0))
    s.append(rect(20,16,120,24,fill=PANEL2,stroke=LINE,rx=4))
    s.append(text(80,32,"GLOBE · EMS",size=12,fill=INK,weight="700",anchor="middle"))
    # selector de perfil
    s.append(text(170,26,"Perfil activo",size=9,fill=INK3))
    s.append(rect(170,30,200,20,fill=ACCENT_BG,stroke=ACCENT,rx=4))
    s.append(text(180,44,PROFILE_LABEL[prof]+"  ▾",size=11.5,fill=ACCENT,weight="600"))
    s.append(text(390,44,PROFILE_AUTH[prof],size=10,fill=INK3))
    # búsqueda global
    s.append(rect(600,16,372,24,fill=BG,stroke=LINE,rx=12))
    s.append(text(616,33,"⌕",size=14,fill=INK3))
    s.append(text(634,32,"Buscar medidor, mall, ticket, usuario…",size=10.5,fill=INK3))
    # campana de alertas + contador
    s.append(rect(1092,17,94,22,fill=BG,stroke=LINE,rx=11))
    s.append(text(1106,32,"⌁ Alertas",size=10.5,fill=INK2))
    s.append(dot(1182,19,8,ST_CRIT,letter="5"))
    # usuario + sesión
    s.append(dot(1210,20,9,PANEL2))
    s.append(text(W-24,26,"nmatus@grupoglobe.com",size=10.5,fill=INK2,anchor="end"))
    s.append(text(W-24,42,"Sesión 15 min · MFA activo (CYB-06/02)",size=9,fill=INK3,anchor="end"))
    # aside
    s.append(rect(0,56,240,H-56,fill="#fafbfc",stroke=LINE,rx=0))
    s.append(text(20,84,"MENÚ · "+PROFILE_LABEL[prof].upper(),size=10,fill=INK3,weight="700"))
    my=100
    for item in MENUS[prof]:
        active = (item==scr["activeMenu"])
        if active:
            s.append(rect(8,my,224,30,fill=ACCENT_BG,stroke="none",rx=5))
            s.append(rect(8,my,3,30,fill=ACCENT,stroke="none",rx=0))
        s.append(text(22,my+20,item,size=12,fill=(ACCENT if active else INK2),
                      weight="700" if active else "normal"))
        my+=34
    # footer aside
    s.append(text(20,H-20,"PASA · Anexo 07",size=9,fill=INK3))
    # título de contenido
    s.append(text(264,88,f'{scr["id"]}  {scr["title"]}',size=20,fill=INK,weight="700"))
    # zona de acciones (arriba-derecha): todas las acciones de página van aquí,
    # sin repetirse en el contenido. Los controles de formulario quedan abajo.
    hb=header_actions(scr); dev="Escritorio · 1440×900"
    if hb:
        widths=[max(78,20+len(t)*6.6) for t in hb]
        total=sum(widths)+8*(len(hb)-1)
        bx=1416-total
        s.append(text(bx-12,90,dev,size=9.5,fill=INK3,anchor="end"))
        for i,t in enumerate(hb):
            wbt=widths[i]; primary=(i==0)
            s.append(rect(bx,71,wbt,30,fill=(ACCENT if primary else BG),stroke=ACCENT,rx=6))
            s.append(text(bx+wbt/2,90,t,size=11,fill=("#ffffff" if primary else ACCENT),weight="700" if primary else "600",anchor="middle"))
            bx+=wbt+8
    else:
        s.append(rect(1416-118,74,118,22,fill=BG,stroke=LINE,rx=11))
        s.append(text(1416-59,89,dev,size=10,fill=INK2,anchor="middle"))
    # breadcrumb (contexto de drill-down) o subtítulo
    bc=scr.get("breadcrumb")
    if bc:
        s.append(text(264,110,"  ›  ".join(bc),size=12,fill=INK2,weight="600"))
    else:
        s.append(text(264,110,scr.get("subtitle",""),size=12,fill=INK2))
    # indicador en vivo / última actualización (derecha)
    live=scr.get("live")
    if live:
        lw=len(live)*5.3
        s.append(dot(1416-lw-14,106,4,ST_OK))
        s.append(text(1416,110,live,size=10,fill=INK2,anchor="end"))
    # barra de filtros
    fy=124
    s.append(rect(264,fy,1152,42,fill="#f7f8fa",stroke=LINE,rx=6))
    s.append(text(276,fy+26,"Filtros:",size=11,fill=INK2,weight="700"))
    fx=336
    for f in scr.get("filters",[]):
        chip=f'{f["name"]} ({f["default"]})'
        cw=14+len(chip)*6.4
        s.append(rect(fx,fy+9,cw,24,fill=BG,stroke=ACCENT,rx=12))
        s.append(text(fx+cw/2,fy+25,chip,size=10.5,fill=ACCENT,anchor="middle"))
        fx+=cw+10
        if fx>1416-140: break
    if not scr.get("filters"):
        s.append(text(336,fy+26,"(esta pantalla no declara filtros en el informe)",size=10.5,fill=INK3))
    return W,H,s

def chrome_mobile(scr):
    W,H=390,844
    prof=scr["profile"]; s=[]
    s.append(rect(0,0,W,H,fill=BG,stroke=LINE,rx=0))
    # topbar
    s.append(rect(0,0,W,52,fill="#fbfbfc",stroke=LINE,rx=0))
    s.append(text(16,26,"☰",size=18,fill=INK))
    s.append(text(40,26,"GLOBE · EMS",size=12,fill=INK,weight="700"))
    s.append(text(40,40,PROFILE_LABEL[prof]+" · PWA",size=9.5,fill=INK3))
    s.append(dot(W-20,26,9,PANEL2))
    # título
    s.append(text(16,78,f'{scr["id"]} {scr["title"]}',size=16,fill=INK,weight="700"))
    s.append(rect(W-96,64,80,18,fill=BG,stroke=LINE,rx=9))
    s.append(text(W-56,77,"Móvil 390×844",size=8.5,fill=INK2,anchor="middle"))
    # filtros (fila desplazable)
    fy=94
    s.append(rect(12,fy,W-24,34,fill="#f7f8fa",stroke=LINE,rx=6))
    fx=22
    for f in scr.get("filters",[]):
        chip=f'{f["name"]}: {f["default"]}'
        cw=12+len(chip)*5.6
        if fx+cw>W-40:
            s.append(text(W-20,fy+21,"›",size=14,fill=ACCENT,anchor="end")); break
        s.append(rect(fx,fy+7,cw,20,fill=BG,stroke=ACCENT,rx=10))
        s.append(text(fx+cw/2,fy+21,chip,size=9,fill=ACCENT,anchor="middle"))
        fx+=cw+8
    if not scr.get("filters"):
        s.append(text(22,fy+21,"(sin filtros declarados)",size=9.5,fill=INK3))
    # barra de acción primaria fija (sobre el nav inferior · alcance del pulgar)
    mp=scr.get("mobilePrimary")
    if mp:
        s.append(rect(0,H-56-52,W,52,fill="#fbfbfc",stroke=LINE,rx=0))
        s.append(rect(12,H-56-44,W-24,36,fill=ACCENT,stroke=ACCENT,rx=8))
        s.append(text(W/2,H-56-20,mp,size=13,fill="#ffffff",weight="700",anchor="middle"))
    # bottom nav
    s.append(rect(0,H-56,W,56,fill="#fbfbfc",stroke=LINE,rx=0))
    navs=["Órdenes","Activos","Comms","Bitácora","Más"]
    for i,n in enumerate(navs):
        cx=W/5*(i+0.5); active=(i==scr.get("navActive",0))
        s.append(dot(cx,H-38,4,ACCENT if active else INK3))
        s.append(text(cx,H-18,n,size=8.5,fill=(ACCENT if active else INK3),anchor="middle",weight="600" if active else "normal"))
    return W,H,s

# ------------------------------------------------------------------ ensamblado
def render_svg(scr):
    device=scr.get("device","desktop")
    resolve_geometry(scr)
    if device=="mobile":
        W,H,s=chrome_mobile(scr)
    else:
        W,H,s=chrome_desktop(scr)
    # notas
    for nb in scr.get("notes",[]):
        nx=nb.get("x",264); ny=nb.get("y",180); nw=nb.get("w",300)
        lines=wrap(nb["text"],int(nw/6.2))
        nh=14+len(lines)*14
        s.append(rect(nx,ny,nw,nh,fill="#fff7e6" if False else "#f4f6f8",stroke=ACCENT,rx=6,dash="4 3"))
        s.append(text(nx+10,ny+16,"⚑ Nota",size=10,fill=ACCENT,weight="700"))
        for i,ln in enumerate(lines):
            s.append(text(nx+10,ny+30+i*14,ln,size=10,fill=INK2))
    # bloques
    desktop = device!="mobile"
    for b in scr.get("blocks",[]):
        if b.get("phide"): continue                                   # oculto (integrado en otro bloque)
        if desktop and b.get("type")=="actions" and not is_form_actions(b):
            continue                                                  # acción de página → va en el header
        s.append(draw_block(b))
        if b.get("reqs") and b.get("type") not in ("title","kpirow","tabs","actions","legend"):
            s.append(reqtag_br(b["x"],b["y"],b["w"],b["h"],b["reqs"]))
    svg=(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
         f'width="{W}" height="{H}" font-family="{FONT}">'+"".join(s)+"</svg>")
    return svg

# ------------------------------------------------------------------ detalle md + html
def render_detail_md(scr):
    d=scr["detail"]; L=[]
    L.append(f'# {scr["id"]} {scr["title"]} — Perfil {PROFILE_LABEL[scr["profile"]]}\n')
    L.append("## a) Detalle de la pantalla (según informe EMS PASA)\n")
    L.append("**Descripción general**\n")
    L.append(d.get("descripcion","").strip()+"\n")
    if d.get("componentes"):
        L.append("\n**Componentes / elementos**\n")
        L.append("| Componente | Descripción | Reqs. PASA |")
        L.append("|---|---|---|")
        for c in d["componentes"]:
            L.append(f'| {c["nombre"]} | {c["descripcion"]} | {", ".join(c.get("reqs",[]))} |')
    if d.get("filtros"):
        L.append("\n**Filtros disponibles**\n")
        L.append("| Filtro | Opciones | Valor por defecto |")
        L.append("|---|---|---|")
        for f in d["filtros"]:
            L.append(f'| {f["nombre"]} | {f.get("opciones","")} | {f.get("default","")} |')
    L.append("\n## b) Justificación de experiencia de usuario\n")
    for u in d.get("ux",[]):
        L.append(f'### {u["componente"]}')
        L.append(u["texto"].strip())
        if u.get("principio"):
            L.append(f'\n*Principio de usabilidad: {u["principio"]}*\n')
        L.append("")
    return "\n".join(L)

def detail_html(scr):
    d=scr["detail"]; H=[]
    H.append('<div class="detail">')
    H.append('<h4>a) Detalle de la pantalla <span class="src">(según informe EMS PASA)</span></h4>')
    H.append(f'<p class="desc">{esc(d.get("descripcion",""))}</p>')
    if d.get("componentes"):
        H.append('<p class="lbl">Componentes / elementos</p><table><thead><tr><th>Componente</th><th>Descripción</th><th>Reqs. PASA</th></tr></thead><tbody>')
        for c in d["componentes"]:
            H.append(f'<tr><td><b>{esc(c["nombre"])}</b></td><td>{esc(c["descripcion"])}</td><td class="req">{esc(", ".join(c.get("reqs",[])))}</td></tr>')
        H.append('</tbody></table>')
    if d.get("filtros"):
        H.append('<p class="lbl">Filtros disponibles</p><table><thead><tr><th>Filtro</th><th>Opciones</th><th>Por defecto</th></tr></thead><tbody>')
        for f in d["filtros"]:
            H.append(f'<tr><td><b>{esc(f["nombre"])}</b></td><td>{esc(f.get("opciones",""))}</td><td>{esc(f.get("default",""))}</td></tr>')
        H.append('</tbody></table>')
    H.append('<h4>b) Justificación de experiencia de usuario</h4>')
    for u in d.get("ux",[]):
        H.append(f'<div class="ux"><p class="uxc">{esc(u["componente"])}</p><p>{esc(u["texto"])}</p>')
        if u.get("principio"):
            H.append(f'<p class="prin">Principio: {esc(u["principio"])}</p>')
        H.append('</div>')
    H.append('</div>')
    return "\n".join(H)

# ------------------------------------------------------------------ main
def main():
    base=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    datadir=os.path.join(base,"_build","data")
    files=sorted(glob.glob(os.path.join(datadir,"*.json")))
    screens=[]
    for fp in files:
        with open(fp,encoding="utf-8") as fh:
            arr=json.load(fh)
            if isinstance(arr,dict): arr=[arr]
            screens.extend(arr)
    # orden por id numérico (3.1, 3.2, ...)
    def keyf(s):
        a,b=s["id"].split("."); return (int(a),int(b))
    screens.sort(key=keyf)
    order=["gerencial","operacional","tecnico","auditor","super-admin"]
    for scr in screens:
        svg=render_svg(scr)
        md=render_detail_md(scr)
        folder=os.path.join(base,PROFILE_FOLDER[scr["profile"]])
        os.makedirs(folder,exist_ok=True)
        stem=f'{scr["id"]}-{scr["slug"]}'
        with open(os.path.join(folder,stem+".svg"),"w",encoding="utf-8") as fh: fh.write(svg)
        with open(os.path.join(folder,stem+".detalle.md"),"w",encoding="utf-8") as fh: fh.write(md)
    build_index(base,screens,order)
    print(f"OK: {len(screens)} pantallas renderizadas.")

def build_index(base,screens,order):
    by={}
    for s in screens: by.setdefault(s["profile"],[]).append(s)
    css="""
*{box-sizing:border-box}html,body{width:100%;max-width:none}body{margin:0;font-family:'Segoe UI',Arial,sans-serif;color:#2b2f36;background:#eceef1}
header.top{position:sticky;top:0;z-index:10;background:#2b2f36;color:#fff;padding:14px 24px}
header.top h1{margin:0;font-size:17px} header.top p{margin:4px 0 10px;font-size:12px;color:#c3c8d0}
nav.anchors{display:flex;flex-wrap:wrap;gap:6px}
nav.anchors a{font-size:11.5px;color:#e7ecf1;background:#5b7089;padding:4px 10px;border-radius:12px;text-decoration:none}
nav.anchors a:hover{background:#6d84a0}
header.top a.pdf{display:inline-block;margin:0 0 12px;font-size:12px;color:#fff;background:#5b7089;border:1px solid #7d93ad;padding:6px 14px;border-radius:6px;text-decoration:none;font-weight:600}
header.top a.pdf:hover{background:#6d84a0}
details.chlog{margin:2px 0 12px;background:#343a44;border:1px solid #4b5563;border-radius:8px;padding:8px 14px;max-width:1100px}
details.chlog summary{cursor:pointer;font-size:12.5px;font-weight:700;color:#fff}
details.chlog ul{margin:10px 0 4px;padding-left:18px}
details.chlog li{font-size:12px;color:#d7dbe1;margin:0 0 7px;line-height:1.45}
details.chlog li b{color:#fff}
.group{padding:22px 24px}.group h2{font-size:15px;border-left:4px solid #5b7089;padding-left:10px;margin:18px 0 6px;scroll-margin-top:104px}
.group .gmeta{font-size:12px;color:#6b7280;margin:0 0 14px 14px}
.row{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);grid-template-rows:auto auto;column-gap:18px;background:#fff;border:1px solid #c3c8d0;border-radius:10px;padding:16px;margin-bottom:20px;scroll-margin-top:104px}
.rowtitle{grid-column:1 / -1;grid-row:1;margin:0 0 10px;font-size:14px;color:#2b2f36}
.wf{grid-column:1;grid-row:2;aspect-ratio:1440 / 900;max-height:calc(100vh - 150px);width:100%;display:flex;align-items:center;justify-content:center;background:#fafbfc;border:1px solid #d9dce1;border-radius:6px;overflow:hidden}
.wf.wf-mob{aspect-ratio:390 / 844}
.wf img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain}
.detail{grid-column:2;grid-row:2;align-self:start;font-size:12.5px;overflow-y:auto;overflow-x:hidden;min-height:0;max-height:calc(100vh - 150px);padding-right:8px}
.detail h4{margin:2px 0 8px;font-size:13px;color:#5b7089;border-bottom:1px solid #e6e8ec;padding-bottom:4px}
.detail .src{font-weight:normal;color:#9aa1ac;font-size:11px}
.detail p.desc{margin:0 0 10px}.detail p.lbl{font-weight:700;margin:12px 0 4px;font-size:12px}
.detail table{width:100%;border-collapse:collapse;margin-bottom:6px}
.detail th{background:#e6e8ec;text-align:left;padding:5px 6px;font-size:11px}
.detail td{border-bottom:1px solid #eceef1;padding:5px 6px;font-size:11.5px;vertical-align:top}
.detail td.req,.detail .req{color:#5b7089;font-weight:600;white-space:nowrap}
.detail .ux{margin:8px 0}.detail .uxc{font-weight:700;margin:0 0 2px;font-size:12px}
.detail .ux p{margin:0 0 3px}.detail .prin{color:#5b7089;font-style:italic;font-size:11.5px}
@media(max-width:860px){.row{grid-template-columns:1fr;grid-template-rows:auto auto auto}.rowtitle{grid-column:1}.wf{grid-column:1;grid-row:2;aspect-ratio:auto;max-height:56vh}.wf img{max-height:56vh}.detail{grid-column:1;grid-row:3;max-height:82vh}}
"""
    H=['<!doctype html><html lang="es"><head><meta charset="utf-8">',
       '<title>EMS PASA — Wireframes low-fi por perfil</title>',
       f'<style>{css}</style></head><body>']
    H.append('<header class="top"><h1>EMS PASA — Wireframes de baja fidelidad por perfil de usuario</h1>')
    H.append('<p>Globe Power SpA · Fuente: Especificación de Pantallas v2.0 · Mapa gerencial reconciliado a 3 niveles (País → Centro comercial → Tienda/Local) · operación monopaís (Chile)</p>')
    H.append('<a class="pdf" href="EMS_PASA_wireframes.pdf" target="_blank" rel="noopener">⬇ Descargar documentación (PDF · 35 pantallas)</a>')
    H.append('<a class="pdf" href="prototipo/" target="_blank" rel="noopener" style="background:#48596e">▶ Abrir prototipo interactivo (mid-fi)</a>')
    H.append('<details class="chlog" open><summary>Cambios de esta iteración (mid-fi)</summary><ul>')
    for tit,txt in CHANGELOG:
        H.append(f'<li><b>{esc(tit)}.</b> {esc(txt)}</li>')
    H.append('</ul></details>')
    H.append('<nav class="anchors">')
    for p in order:
        if p in by: H.append(f'<a href="#{p}">{PROFILE_LABEL[p]} ({len(by[p])})</a>')
    H.append('</nav></header>')
    for p in order:
        if p not in by: continue
        H.append(f'<section class="group" id="{p}"><h2>Perfil {PROFILE_LABEL[p]}</h2>')
        H.append(f'<p class="gmeta">{PROFILE_AUTH[p]}</p>')
        for s in by[p]:
            stem=f'{s["id"]}-{s["slug"]}'
            src=f'{PROFILE_FOLDER[p]}/{stem}.svg'
            wfcls=" wf-mob" if s.get("device")=="mobile" else ""
            H.append(f'<div class="row" id="{stem}"><h3 class="rowtitle">{esc(s["id"])} · {esc(s["title"])}</h3>'
                     f'<div class="wf{wfcls}"><img src="{src}" alt="Wireframe {esc(s["id"])}"></div>')
            H.append(detail_html(s))
            H.append('</div>')
        H.append('</section>')
    H.append("""<script>
(function(){
  function sync(){
    var two = window.matchMedia('(min-width:861px)').matches;
    document.querySelectorAll('.row').forEach(function(r){
      var wf=r.querySelector('.wf'), d=r.querySelector('.detail');
      if(!wf||!d) return;
      if(two){ d.style.maxHeight = Math.round(wf.getBoundingClientRect().height)+'px'; }
      else { d.style.maxHeight = ''; }
    });
  }
  window.addEventListener('load', sync);
  window.addEventListener('resize', sync);
  document.addEventListener('DOMContentLoaded', sync);
  sync();
})();
</script>""")
    H.append('</body></html>')
    with open(os.path.join(base,"index.html"),"w",encoding="utf-8") as fh:
        fh.write("\n".join(H))

if __name__=="__main__":
    main()
