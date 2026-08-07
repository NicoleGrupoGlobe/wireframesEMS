# -*- coding: utf-8 -*-
"""Genera prototipo/data.js (modelo de datos del prototipo interactivo)."""
import json, os, glob
import render

BASE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATADIR=os.path.join(BASE,"_build","data")
OUT=os.path.join(BASE,"prototipo","data.js")

def load():
    scr=[]
    for fp in sorted(glob.glob(os.path.join(DATADIR,"*.json"))):
        arr=json.load(open(fp,encoding="utf-8"))
        scr.extend(arr if isinstance(arr,list) else [arr])
    scr.sort(key=lambda s:(int(s["id"].split(".")[0]), int(s["id"].split(".")[1])))
    return scr

def main():
    os.makedirs(os.path.join(BASE,"prototipo"),exist_ok=True)
    payload={
        "screens": load(),
        "menus": render.MENUS,
        "labels": render.PROFILE_LABEL,
        "auth": render.PROFILE_AUTH,
        "order": ["gerencial","operacional","tecnico","auditor","super-admin"],
    }
    with open(OUT,"w",encoding="utf-8") as fh:
        fh.write("window.EMS = ")
        json.dump(payload,fh,ensure_ascii=False)
        fh.write(";\n")
    print("OK:",OUT,"·",len(payload["screens"]),"pantallas")

if __name__=="__main__":
    main()
