# -*- coding: utf-8 -*-
"""Agrega 'pspan' (span solo-prototipo) a bloques que quedaban con hueco en el
grid del prototipo. NO toca 'colspan' (los SVG absolutos quedan intactos)."""
import json, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, "_build", "data")

# (archivo, id_pantalla, tipo, texto_en_label_o_btns, pspan)
EDITS = [
    ("01-gerencial.json",   "3.4",  "table",   "Historial de reportes",        12),
    ("01-gerencial.json",   "3.5",  "panel",   "Top 5 malls",                  12),
    ("02-operacional.json", "4.2",  "line",    "Panel de detalle",              7),
    ("02-operacional.json", "4.2",  "form",    "Comentario de la alarma",      12),
    ("02-operacional.json", "4.4",  "actions", "Lanzar backfill",              12),
    ("04-auditor.json",     "6.5",  "actions", "Exportar Parquet",             12),
    ("05-super-admin.json", "7.1",  "actions", "Crear tenant",                 12),
    ("05-super-admin.json", "7.2",  "table",   "Historial de despliegues",     12),
    ("05-super-admin.json", "7.3",  "actions", "Asignar / cambiar perfil",     12),
    ("05-super-admin.json", "7.5",  "actions", "Activar / Desactivar",         12),
    ("05-super-admin.json", "7.7",  "actions", "Notificar a PASA",             12),
    # 7.10 — reestructura para que cada fila sume 12
    ("05-super-admin.json", "7.10", "table",   "Cat",                           6),  # Catálogo de políticas
    ("05-super-admin.json", "7.10", "table",   "Cola de ejecuci",               6),
    ("05-super-admin.json", "7.10", "actions", "Ejecutar borrado",             12),
    ("05-super-admin.json", "7.10", "heatmap", "Configurador de campos",       12),
    ("05-super-admin.json", "7.10", "form",    "nueva pol",                     7),
    ("05-super-admin.json", "7.10", "table",   "Historial de ejecuciones",     12),
]


def block_text(b):
    parts = [b.get("label", "")]
    if b.get("btns"):
        parts.append(" ".join(b["btns"]))
    if b.get("tabs"):
        parts.append(" ".join(b["tabs"]))
    return " ".join(parts).lower()


def main():
    changed = {}
    for fname, sid, btype, needle, pspan in EDITS:
        fp = os.path.join(DATA, fname)
        screens = json.load(open(fp, encoding="utf-8"))
        hit = 0
        for s in screens:
            if s.get("id") != sid:
                continue
            for b in s.get("blocks", []):
                if b.get("type") == btype and needle.lower() in block_text(b):
                    b["pspan"] = pspan
                    hit += 1
        if hit != 1:
            raise SystemExit("ERROR: %s %s %s '%s' -> %d coincidencias (esperaba 1)"
                             % (fname, sid, btype, needle, hit))
        json.dump(screens, open(fp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        changed.setdefault(fname, 0)
        changed[fname] += 1
    print("OK:", changed)


if __name__ == "__main__":
    main()
