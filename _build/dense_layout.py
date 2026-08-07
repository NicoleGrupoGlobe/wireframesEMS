# -*- coding: utf-8 -*-
"""Densifica el layout del prototipo por pantalla: fija pspan (ancho) y porder
(orden) SOLO para el prototipo. render.py ignora ambos → los SVG no cambian."""
import json, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, "_build", "data")

FILE_BY_PREFIX = {"3": "01-gerencial.json", "4": "02-operacional.json",
                  "6": "04-auditor.json", "7": "05-super-admin.json"}

# id_pantalla -> lista (indice_bloque, pspan) en el orden visual deseado.
# El porder se asigna por la posición en la lista.
SPECS = {
    "3.1": [(3,3),(4,3),(5,3),(6,3),(0,8),(7,4),(8,8),(1,4)],
    "3.2": [(1,4),(2,4),(3,4),(0,8),(4,4),(5,12),(6,12)],
    "3.3": [(0,7),(1,5),(2,7),(3,5)],
    "3.4": [(0,7),(2,5),(4,12)],  # form (config+checks) izq · vista previa der · historial full
    "3.5": [(0,3),(1,3),(2,3),(3,3),(4,5),(5,7),(6,4),(7,8)],
    "3.6": [(0,6),(1,6),(3,6),(4,6)],
    "4.1": [(0,3),(1,3),(2,2),(3,2),(4,2),(5,8),(8,4),(6,8),(7,4)],
    "4.2": [(0,7),(1,5),(2,7),(4,5)],
    "4.4": [(0,7),(1,5),(2,7),(4,5)],
    "6.3": [(0,7),(2,5),(3,12)],
    "6.6": [(0,6),(1,6),(3,6),(4,6)],
    "7.2": [(0,7),(2,5),(1,7),(4,5)],
    "7.5": [(0,7),(2,5),(1,7),(3,5)],
}


def main():
    # agrupar por archivo
    by_file = {}
    for sid, spec in SPECS.items():
        by_file.setdefault(FILE_BY_PREFIX[sid.split(".")[0]], {})[sid] = spec

    for fname, specs in by_file.items():
        fp = os.path.join(DATA, fname)
        screens = json.load(open(fp, encoding="utf-8"))
        touched = []
        for s in screens:
            if s.get("id") not in specs:
                continue
            spec = specs[s["id"]]
            blocks = s.get("blocks", [])
            # limpia estado previo en esta pantalla
            for b in blocks:
                b.pop("pspan", None); b.pop("porder", None)
            for order, (idx, pspan) in enumerate(spec):
                if idx >= len(blocks):
                    raise SystemExit("ERROR %s idx %d fuera de rango" % (s["id"], idx))
                blocks[idx]["pspan"] = pspan
                blocks[idx]["porder"] = order
            touched.append(s["id"])
        json.dump(screens, open(fp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("OK", fname, touched)


if __name__ == "__main__":
    main()
