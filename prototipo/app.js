/* EMS · Prototipo interactivo mid-fi (grayscale). Sin dependencias. */
(function(){
"use strict";
var EMS = window.EMS;
var byRoute = {}, byProfile = {};
EMS.order.forEach(function(p){ byProfile[p]=[]; });
EMS.screens.forEach(function(s){ byRoute[s.profile+"/"+s.slug]=s; byProfile[s.profile].push(s); });
var collapsed=false; try{collapsed=localStorage.getItem("ems_nav")==="1";}catch(e){}
var CREDS={
  "gerencial":{email:"gerencia@pasa.cl", pass:"pasa2026", mfa:"Solo lectura · sin MFA"},
  "operacional":{email:"operaciones@pasa.cl", pass:"pasa2026", mfa:"MFA obligatorio"},
  "tecnico":{email:"tecnico@pasa.cl", pass:"pasa2026", mfa:"MFA obligatorio · terreno"},
  "auditor":{email:"auditor@pasa.cl", pass:"pasa2026", mfa:"MFA obligatorio · solo lectura"},
  "super-admin":{email:"admin@globepower.cl", pass:"globe2026", mfa:"Federado + MFA + JIT"}
};
var session=null;
function applyCollapse(){ document.body.classList.toggle("nav-collapsed",collapsed); try{localStorage.setItem("ems_nav",collapsed?"1":"0");}catch(e){} }

var MALLS=["Costanera Center","Mallplaza Egaña","Alto Las Condes","Arauco Maipú","Mallplaza Vespucio","Portal Ñuñoa"];
var USERS=["p.soto","m.rivas","c.díaz","a.fuentes","operador N2"];
var NAV=["Órdenes","Activos","Comms","Bitácora","Más"];
var MONTHS=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
var SER=[64,70,58,78,72,86,90,66,80,60,88,76];          // alturas % (serie mensual)
var VAL=[1.04,1.12,0.98,1.18,1.10,1.24,1.28,1.06,1.20,0.96,1.26,1.17]; // valor por barra
var LINEV=[0.42,0.55,0.5,0.66,0.6,0.78,0.72,0.9,0.62,0.8]; // serie de línea

function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function h(v){return Math.abs(Math.sin(v))*0.6+0.35;} // pseudo-altura estable 0.35..0.95
function span(b){return 's'+((b&&(b.pspan||b.colspan))||12);}

/* ---------------- componentes ---------------- */
function reqs(b){return b.reqs&&b.reqs.length?'<div class="reqs">['+b.reqs.join(", ")+']</div>':'';}
function head(b){return (b.label?'<div class="ct">'+esc(b.label)+'</div>':'')+(b.meta?'<div class="cm">'+esc(b.meta)+'</div>':'');}

function spark(){var pts=[];for(var i=0;i<12;i++){pts.push((i*10)+","+(24-22*h(i+3)));}
  return '<svg class="spark" width="130" height="26" viewBox="0 0 120 26"><polyline points="'+pts.join(" ")+'" fill="none" stroke="var(--accent)" stroke-width="1.6"/></svg>';}

function bars(b){
  var n=(b.type==="histogram")?12:8, i0=12-n, showv=(n<=8&&b.type!=="waterfall"&&b.type!=="stackedbars");
  var out='<div class="chart"><div class="bars">';
  for(var i=0;i<n;i++){
    var idx=i0+i, ph=SER[idx];
    if(b.type==="stackedbars"){
      out+='<div class="bar stk" style="height:'+ph+'%"><i style="height:50%;background:var(--crit)"></i><i style="height:26%;background:var(--warn)"></i><i style="height:24%;background:var(--surface-3)"></i></div>';
    } else if(b.type==="waterfall"){
      out+='<div class="bar" style="height:'+ph+'%;background:'+(i%2?'var(--crit)':'var(--ok)')+'"></div>';
    } else {
      out+='<div class="bar'+(b.hl===i?' hl':'')+'" style="height:'+ph+'%">'+(showv?'<span class="bv num">'+VAL[idx].toFixed(2)+'</span>':'')+'</div>';
    }
  }
  out+='</div><div class="xlabs">'+MONTHS.slice(i0).map(function(m){return '<span>'+m+'</span>';}).join('')+'</div>';
  if(b.type==="stackedbars") out+='<div class="clegend"><span><i style="background:var(--crit)"></i>Abiertas</span><span><i style="background:var(--warn)"></i>Escaladas</span><span><i style="background:var(--surface-3)"></i>Resueltas</span></div>';
  return out+'</div>';
}
function line(b){
  var n=LINEV.length, pts=LINEV.map(function(v,i){return (i*(300/(n-1)))+","+(120-108*v);}).join(" ");
  var thrLine="",thrNote="";
  if(b.threshold!=null){var ty=120-108*b.threshold; thrLine='<line x1="0" y1="'+ty+'" x2="300" y2="'+ty+'" stroke="var(--ink-3)" stroke-width="1" stroke-dasharray="5 4"/>'; thrNote='<div class="thrnote">— — umbral SLA / contractual</div>';}
  var area=(b.type==="area")?'<polygon points="0,120 '+pts+' 300,120" fill="var(--surface-3)" opacity=".7"/>':'';
  var svg='<svg width="100%" height="150" viewBox="0 0 300 128" preserveAspectRatio="none">'+area+thrLine+'<polyline points="'+pts+'" fill="none" stroke="var(--accent)" stroke-width="2.2"/></svg>';
  return '<div class="chart">'+svg+thrNote+'<div class="xlabs">'+MONTHS.slice(2).map(function(m){return '<span>'+m+'</span>';}).join('')+'</div></div>';
}
function map(b){
  var mk=b.markers||[[.25,.35,"ok"],[.55,.5,"crit"],[.72,.3,"warn"],[.4,.68,"ok"],[.82,.66,"null"],[.15,.6,"ok"]];
  var out='<div class="map"><div class="maplabel">Mapa geográfico interactivo · Chile</div>';
  mk.forEach(function(m,i){out+='<div class="marker '+m[2]+'" data-act="marker" data-v="'+esc(MALLS[i%MALLS.length])+'" style="left:'+(m[0]*100)+'%;top:'+(m[1]*100)+'%" title="'+esc(MALLS[i%MALLS.length])+'"></div>';});
  return out+'</div>';
}
function planta(){
  var tones=["ok","ok","warn","ok","crit","null","ok","ok","ok","warn","ok","ok","ok","crit","ok","null","ok","ok"],out='<div class="planta">';
  for(var i=0;i<18;i++){out+='<div class="cell" data-act="cell" style="background:var(--'+tones[i]+')"></div>';}
  return out+'</div>';
}
function tree(b){
  var rows=b.rows||[[0,"Total país — Chile",null],[1,"Costanera Center",false],[2,"Piso 1",false],[2,"Piso 2",false],[1,"Mallplaza Egaña",false]];
  return '<div class="tree">'+rows.map(function(r,i){
    var lvl=r[0], car=lvl<2?'<span class="chev'+(lvl===0?' open':'')+'">▸</span>':'';
    var dot=r[2]?'<span class="dot '+r[2]+'"></span>':'';
    return '<div class="tn lvl'+lvl+(i===1?' active':'')+'" data-act="tree">'+car+dot+'<span>'+esc(r[1])+'</span></div>';
  }).join("")+'</div>';
}
function feed(b){
  var it=b.items||[["URGENT","Sobrecarga transformador — Costanera P2","crit"],["WARNING","Fase desbalanceada — Egaña","warn"],["INFO","Backfill completado — Vespucio","null"]];
  return '<div class="feed">'+it.map(function(x){return '<div class="it"><span class="sev '+x[2]+'">'+esc(x[0])+'</span><span class="tx">'+esc(x[1])+'</span></div>';}).join("")+'</div>';
}
function gauges(b){
  var labs=b.labels||["Voltaje","Corriente","Potencia"],n=b.n||3,out='<div class="gauges">';
  for(var i=0;i<n;i++){var pct=[62,48,74][i%3];out+='<div class="gauge"><div class="ring" style="background:conic-gradient(var(--accent) 0 '+pct+'%,var(--surface-3) '+pct+'% 100%)"><i class="num">'+pct+'%</i></div><div class="gl">'+esc(labs[i%labs.length])+'</div></div>';}
  return out+'</div>';
}
function heatmap(b){
  var c=b.cols||12,r=b.rowsn||7,tones=["null","surface-3","warn","crit","ink-3"],out='<div class="heat" style="grid-template-columns:repeat('+c+',1fr)">';
  for(var i=0;i<c*r;i++){out+='<div class="hc" style="background:var(--'+tones[(i*7)%tones.length==0?0:(i%5)]+')"></div>';}
  return out+'</div>';
}
function timeline(b){
  var it=b.items||["Login · p.soto","Consulta datos crudos","Exportación firmada","Modificación regla 44"];
  return '<div class="timeline">'+it.map(function(x){return '<div class="it"><span class="dot null"></span><span class="tx">'+esc(x)+'</span></div>';}).join("")+'</div>';
}
function form(b){
  var fs=b.fields||["Campo 1","Campo 2","Campo 3"];
  return '<div class="form">'+fs.map(function(f){
    var low=f.toLowerCase(), ctrl;
    if(/adjunt|foto|evidencia/.test(low)) ctrl='<div class="dropzone">Arrastra fotos (JPG/PNG) o PDF · máx. 5</div>';
    else if(/firma/.test(low)) ctrl='<div class="sign">Firma digital del técnico</div>';
    else if(/descrip|justific|motivo|coment/.test(low)) ctrl='<textarea placeholder="'+esc(f)+'"></textarea>';
    else if(/\(/.test(f)) {var opts=(f.match(/\(([^)]+)\)/)||["",""])[1].split("/").map(function(o){return '<option>'+esc(o.trim())+'</option>';}).join("");ctrl='<select>'+opts+'</select>';}
    else ctrl='<input placeholder="'+esc(f)+'">';
    return '<div class="fg"><label>'+esc(f.replace(/\s*\(.*\)/,''))+'</label>'+ctrl+'</div>';
  }).join("")+'</div>';
}
function skeleton(){var ws=[92,72,84,60,78];return '<div style="padding-top:4px">'+ws.map(function(w){return '<div style="height:10px;border-radius:5px;background:var(--surface-3);margin:10px 0;width:'+w+'%"></div>';}).join("")+'</div>';}
function placeholder(b){
  var t=((b.label||"")+" "+(b.meta||"")).toLowerCase();
  if(/mapa/.test(t)) return map(b);
  if(/histogram|lag|distribu|barras|apilad|scorecard|consumo de api/.test(t)) return bars({type:"histogram"});
  if(/gráfic|grafic|línea|linea|tendenc|evoluci|curva|serie|latenc|p95|uptime|throughput|sla/.test(t)) return line({});
  if(/gauge|voltaje|corriente|potencia/.test(t)) return gauges({});
  return skeleton();
}
function cellFor(col,ri){
  var l=col.toLowerCase();
  if(l.trim()==="id")return '<span class="num">OT-'+(2200+ri*11)+'</span>';
  if(/mall|centro|tenant/.test(l))return MALLS[ri%MALLS.length];
  if(/zona|piso|sala|rack|tablero|ubicaci/.test(l))return "Piso "+((ri%3)+1)+" · Z"+((ri%4)+1);
  if(/serial|medidor|tag|gateway/.test(l))return "SN-"+(4400+ri*7);
  if(/descrip|motivo|tipo|causa/.test(l))return ["Sobreconsumo","Fase desbalanceada","Dato tardío","Offline >4h","CNR manual"][ri%5];
  if(/sev/.test(l))return '<span class="sev '+["crit","warn","null"][ri%3]+'">'+["CRÍT","ALTA","MEDIA"][ri%3]+'</span>';
  if(/apertura|transcurr|últim|hora|timestamp|fecha|heartbeat/.test(l))return '<span class="num">11:'+(10+ri)+' · 31-07</span>';
  if(/precio/.test(l))return '<span class="num">'+(3.1+ri*0.18).toFixed(2)+'</span>';
  if(/consumo|mwh|volumen/.test(l))return '<span class="num">'+(120+ri*13.4).toFixed(1)+'</span>';
  if(/costo|uf/.test(l))return '<span class="num">'+(1200+ri*230).toLocaleString("es-CL")+'</span>';
  if(/variaci/.test(l))return '<span class="num">'+(ri%2?'▲':'▼')+' '+(0.6+ri*0.7).toFixed(1)+'%</span>';
  if(/%|cobert|éxito|exito|online|calidad|disponib/.test(l))return '<span class="num">'+(88+ri*1.3).toFixed(1)+'%</span>';
  if(/estado/.test(l))return ["Activo","Offline","Estimado","Activo","CNR"][ri%5];
  if(/usuario|respons|aprob/.test(l))return USERS[ri%USERS.length];
  if(/ticket|orden|versi|política|politica|regla|integr|incidente/.test(l))return "OT-"+(2200+ri*11);
  if(/crít|warn|resuel|n°|nº|medidores|usuarios|días|dias|requests|cuota/.test(l))return '<span class="num">'+((ri*3+2)%9)+'</span>';
  return "—";
}
var isMobileRender=false;
function tableCards(b){
  var cols=b.cols||["Col A","Col B","Col C"], nr=b.nrows||5, exp=!!b.expand, st=!!b.statuscol;
  var out='<div class="tcards">';
  for(var ri=0;ri<nr;ri++){
    out+='<div class="tcard"'+(exp?' data-act="exprowc"':'')+'>';
    cols.forEach(function(c,ci){
      var v=cellFor(c,ri);
      if(ci===0){
        var dot=st?'<span class="dot '+["ok","crit","warn","ok","null"][ri%5]+'"></span> ':'';
        out+='<div class="tc-title">'+dot+v+(exp?'<span class="chev" style="margin-left:auto">▸</span>':'')+'</div>';
      } else {
        out+='<div class="tc-row"><span class="tc-k">'+esc(c)+'</span><span class="tc-v">'+v+'</span></div>';
      }
    });
    if(exp) out+='<div class="tc-exp" style="display:none">Detalle: valor que disparó · baseline esperado · historial de acciones · lineage de la lectura.</div>';
    out+='</div>';
  }
  return out+'</div>';
}
function table(b){
  if(isMobileRender) return tableCards(b);
  var cols=b.cols||["Col A","Col B","Col C"], nr=b.nrows||5, exp=!!b.expand, st=!!b.statuscol;
  var out='<table class="tbl"><thead><tr>';
  cols.forEach(function(c){out+='<th data-act="sort" title="Ordenar por '+esc(c)+'">'+esc(c)+' ⇅</th>';});
  out+='</tr></thead><tbody>';
  for(var ri=0;ri<nr;ri++){
    out+='<tr class="row"'+(exp?' data-act="exprow"':'')+'>';
    cols.forEach(function(c,ci){
      var v=cellFor(c,ri);
      if(ci===0&&st){var tone=["ok","crit","warn","ok","null"][ri%5];v='<span class="dot '+tone+'"></span> '+v;}
      if(ci===0&&exp){v='<span class="chev">▸</span> '+v;}
      out+='<td>'+v+'</td>';
    });
    out+='</tr>';
    if(exp){out+='<tr class="exp" style="display:none"><td colspan="'+cols.length+'">Detalle: valor que disparó · baseline esperado · historial de acciones · lineage de la lectura.</td></tr>';}
  }
  return out+'</tbody></table>';
}

/* ---- índice de búsqueda (datos dummy) ---- */
var INDEX=[
  {t:"Medidor",l:"SN-4471 · Costanera Center · P2",r:"tecnico/activos-medidores"},
  {t:"Medidor",l:"SN-4408 · Mallplaza Egaña · P1",r:"tecnico/activos-medidores"},
  {t:"Medidor",l:"SN-4414 · Alto Las Condes · P3",r:"tecnico/activos-medidores"},
  {t:"Medidor",l:"SN-4421 · Arauco Maipú",r:"tecnico/activos-medidores"},
  {t:"Mall",l:"Costanera Center",r:"gerencial/consumo-jerarquico"},
  {t:"Mall",l:"Mallplaza Egaña",r:"gerencial/consumo-jerarquico"},
  {t:"Mall",l:"Alto Las Condes",r:"gerencial/consumo-jerarquico"},
  {t:"Mall",l:"Arauco Maipú",r:"gerencial/consumo-jerarquico"},
  {t:"Ticket",l:"OT-2291 · Sin lectura >4h · Costanera",r:"operacional/tickets-sla"},
  {t:"Ticket",l:"OT-2304 · Backfill pendiente · Maipú",r:"operacional/tickets-sla"},
  {t:"CNR",l:"CNR #182 · Alto Las Condes · pendiente",r:"operacional/cnr-pendientes"},
  {t:"Alarma",l:"Sobrecarga transformador · Costanera P2",r:"operacional/alarmas-eventos"},
  {t:"Alarma",l:"Fase desbalanceada · Egaña",r:"operacional/alarmas-eventos"},
  {t:"Orden",l:"OT-2291 · Diagnóstico comms · Maipú",r:"tecnico/mis-ordenes"},
  {t:"Regla",l:"Factor Wh→kWh · SN-4471",r:"tecnico/reglas-transformacion"},
  {t:"Usuario",l:"p.soto · Operacional",r:"super-admin/usuarios-roles"},
  {t:"Usuario",l:"m.rivas · Técnico",r:"super-admin/usuarios-roles"},
  {t:"Tenant",l:"Mallplaza Vespucio · tenant",r:"super-admin/tenants-malls"}
];
function openSearch(q){
  q=(q||"").trim().toLowerCase();
  var box=document.querySelector(".search"); if(!box) return;
  var list = q ? INDEX.filter(function(e){return (e.t+" "+e.l).toLowerCase().indexOf(q)>=0;}) : INDEX.slice(0,6);
  var html = list.length ? list.slice(0,8).map(function(e){
      return '<div class="pi" data-nav="'+e.r+'"><span class="stag">'+esc(e.t)+'</span>'+esc(e.l)+'</div>';
    }).join("") : '<div class="pi" style="color:var(--ink-3)">Sin resultados para “'+esc(q)+'”</div>';
  var old=box.querySelector(".searchpop"); if(old) old.remove();
  if(!document.querySelector(".backdrop")){var bd=document.createElement("div");bd.className="backdrop";bd.addEventListener("click",closePops);document.body.appendChild(bd);}
  var p=document.createElement("div");p.className="pop searchpop";p.innerHTML=html;box.appendChild(p);openEl=p;
  p.querySelectorAll("[data-nav]").forEach(function(it){it.addEventListener("click",function(){var inp=box.querySelector("input");if(inp)inp.value="";closePops();location.hash="#/"+it.getAttribute("data-nav");});});
}
function filterSelects(){return [].slice.call(document.querySelectorAll('.filters select[data-act="filter"]'));}
function colKeyOf(key){key=(key||"").toLowerCase();return /mall|tenant|centro/.test(key)?"mall":/sev/.test(key)?"sev":null;}
function applyFilters(){
  // restricciones activas (select ≠ opción por defecto) que mapean a una columna
  var cons=[];
  filterSelects().forEach(function(s){
    if(s.selectedIndex===0) return;
    var ck=colKeyOf(s.getAttribute("data-key")); if(!ck) return;
    cons.push({ck:ck,val:s.value.toLowerCase().trim()});
  });
  document.querySelectorAll(".content table.tbl").forEach(function(tb){
    var idx={}, ths=[].slice.call(tb.querySelectorAll("thead th"));
    ths.forEach(function(th,i){var h=th.textContent.toLowerCase(); if(h.indexOf("mall")>=0)idx.mall=i; if(h.indexOf("sev")>=0)idx.sev=i;});
    [].slice.call(tb.querySelectorAll("tbody tr.row")).forEach(function(tr){
      var ok=true;
      cons.forEach(function(c){
        var i=idx[c.ck]; if(i==null) return; // esta tabla no tiene esa columna → no aplica
        var cell=tr.children[i]?tr.children[i].textContent.toLowerCase().trim():"";
        if(!(cell&&(cell.indexOf(c.val)>=0||c.val.indexOf(cell)>=0))) ok=false;
      });
      tr.style.display=ok?"":"none";
      var ex=tr.nextElementSibling; if(ex&&ex.classList.contains("exp")) ex.style.display="none";
    });
  });
}
function refreshFilterState(){
  var actives=filterSelects().filter(function(s){return s.selectedIndex>0;});
  var chips=actives.map(function(s){
    var k=s.getAttribute("data-key");
    return '<span class="achip">'+esc(k)+': '+esc(s.value)+'<b data-act="clearone" data-key="'+esc(k)+'" title="Quitar">✕</b></span>';
  }).join("");
  var box=document.getElementById("fchips"); if(box) box.innerHTML=chips;
  var clr=document.getElementById("fclear"); if(clr) clr.style.display=actives.length?"":"none";
  var cnt=document.getElementById("fcount");
  if(cnt){
    var tb=document.querySelector(".content table.tbl");
    if(tb){var rows=[].slice.call(tb.querySelectorAll("tbody tr.row"));var vis=rows.filter(function(r){return r.style.display!=="none";}).length;cnt.textContent=vis+" de "+rows.length+" filas";}
    else cnt.textContent="";
  }
}
function clearFilters(){ filterSelects().forEach(function(s){s.selectedIndex=0;}); applyFilters(); refreshFilterState(); toast("Filtros limpiados"); }
function sortTable(th){
  var tb=th.closest("table"), tbody=tb.querySelector("tbody");
  var ci=[].slice.call(th.parentNode.children).indexOf(th);
  var rows=[].slice.call(tbody.querySelectorAll("tr.row"));
  th._asc=!th._asc; var dir=th._asc;
  rows.sort(function(a,b){
    var x=(a.children[ci]||{}).textContent||"", y=(b.children[ci]||{}).textContent||"";
    var nx=parseFloat(x.replace(/[^\d.\-]/g,"")), ny=parseFloat(y.replace(/[^\d.\-]/g,""));
    if(!isNaN(nx)&&!isNaN(ny)&&x.replace(/[^\d]/g,"")!=="") return dir?nx-ny:ny-nx;
    return dir?x.localeCompare(y):y.localeCompare(x);
  });
  rows.forEach(function(r){var ex=r.nextElementSibling;tbody.appendChild(r);if(ex&&ex.classList.contains("exp"))tbody.appendChild(ex);});
  toast("Ordenado por “"+th.textContent.replace("⇅","").trim()+"” "+(dir?"▲":"▼"));
}

/* ---- mapa por niveles (un solo mapa, drill-down País→Centro comercial→Tienda/Local) ---- */
function countryView(){
  return '<div class="map" style="height:360px">'+
    '<div style="position:absolute;top:12px;left:50%;transform:translateX(-50%);font-size:12px;color:var(--ink-3)">Nivel 1 · País — click en Chile para ver sus centros comerciales</div>'+
    '<div class="marker ok" data-act="drilltomalls" data-v="Chile" title="Chile · 6 centros comerciales" style="left:50%;top:47%;width:38px;height:38px"></div>'+
    '<div style="position:absolute;left:50%;top:63%;transform:translateX(-50%);font-size:14px;color:var(--ink);font-weight:700">Chile</div>'+
    '<div style="position:absolute;left:50%;top:70%;transform:translateX(-50%);font-size:11px;color:var(--ink-3)">6 centros comerciales · 2.480 medidores</div>'+
    '</div>';
}
function mallsView(){
  var mk=[[.22,.32,"ok"],[.55,.5,"crit"],[.72,.28,"warn"],[.4,.7,"ok"],[.84,.64,"null"],[.15,.58,"ok"]];
  var out='<div class="map" style="height:360px"><div class="maplabel">Nivel 2 · Centro comercial — Chile · click en un mall para ver sus tiendas</div>';
  mk.forEach(function(m,i){out+='<div class="marker '+m[2]+'" data-act="drilltomall" data-v="'+esc(MALLS[i%MALLS.length])+'" title="'+esc(MALLS[i%MALLS.length])+'" style="left:'+(m[0]*100)+'%;top:'+(m[1]*100)+'%"></div>';});
  return out+'</div>';
}
function floorView(mall){
  var tones=["ok","ok","warn","ok","crit","null","ok","ok","ok","warn","ok","ok","ok","crit","ok","null","ok","ok"],cells='';
  for(var i=0;i<18;i++){cells+='<div class="cell" data-act="cell" title="Local '+(i+1)+'" style="background:var(--'+tones[i]+')"></div>';}
  return '<div class="floorwrap"><div class="planta">'+cells+'</div><div class="floorhint">Nivel 3 · '+esc(mall)+' — Tienda / Local / Isla · hover: consumo [kW] y última alarma</div></div>';
}
function crumbLink(act,txt){return '<a data-act="'+act+'" style="cursor:pointer;color:var(--accent)">'+esc(txt)+'</a>';}
function crumbHTML(level,mall){
  if(level===1) return '<span class="lvlchip lvlnow">Chile · País</span>';
  if(level===2) return '<button class="btn btn-sm" data-act="uptocountry">‹ Volver</button>'+
    '<span class="lvlchip">'+crumbLink("uptocountry","Chile")+'</span><span class="lvlsep">›</span>'+
    '<span class="lvlchip lvlnow">Centro comercial</span>';
  return '<button class="btn btn-sm" data-act="uptomalls">‹ Volver al mapa</button>'+
    '<span class="lvlchip">'+crumbLink("uptocountry","Chile")+'</span><span class="lvlsep">›</span>'+
    '<span class="lvlchip">'+crumbLink("uptomalls",mall)+'</span><span class="lvlsep">›</span>'+
    '<span class="lvlchip lvlnow">Tienda/Local</span>';
}
function leveledMapCard(){
  return '<div class="card pad-b s12"><div class="ct">Mapa del portafolio</div>'+
    '<div class="cm">Un solo mapa · País → Centro comercial → Tienda/Local (drill-down por click)</div>'+
    '<div class="maptools" id="maptools">'+crumbHTML(1)+'</div>'+
    '<div class="mapstage" id="mapstage">'+countryView()+'</div>'+
    reqs({reqs:["ARQ-05","DAT-11","DAT-03","ARQ-09"]})+'</div>';
}
function stg(){return document.getElementById("mapstage");}
function tls(){return document.getElementById("maptools");}
function showCountry(){var s=stg(),t=tls();if(s)s.innerHTML=countryView();if(t)t.innerHTML=crumbHTML(1);}
function showMalls(){var s=stg(),t=tls();if(s)s.innerHTML=mallsView();if(t)t.innerHTML=crumbHTML(2);}
function showFloor(mall){var s=stg(),t=tls();if(s)s.innerHTML=floorView(mall);if(t)t.innerHTML=crumbHTML(3,mall);}

/* mapa tipo→render + si lleva marco .card */
var FRAMELESS={actions:1,tabs:1,legend:1};
function renderBlock(b){
  var inner="";
  switch(b.type){
    case "kpi": inner=head(b)+'<div class="kpi"><div class="val num">'+esc(b.value||"—")+'</div><div class="delta">'+esc(b.delta||"")+'</div>'+(b.spark?'<div class="spark">'+spark()+'</div>':'')+'</div>'; break;
    case "map": if(b._leveled){return leveledMapCard();} inner=head(b)+map(b); break;
    case "planta": inner=head(b)+planta(); break;
    case "tree": inner=head(b)+tree(b); break;
    case "bars": case "stackedbars": case "histogram": case "waterfall": inner=head(b)+bars(b); break;
    case "line": case "area": inner=head(b)+line(b); break;
    case "table": inner=head(b)+'<div style="overflow:auto">'+table(b)+'</div>'; break;
    case "feed": inner=head(b)+feed(b); break;
    case "gauge": inner=head(b)+gauges(b); break;
    case "form": inner=head(b)+form(b); break;
    case "heatmap": inner=head(b)+heatmap(b); break;
    case "timeline": inner=head(b)+timeline(b); break;
    case "actions": return '<div class="bare '+span(b)+'"><div class="actions">'+(b.btns||["Acción"]).map(function(x,i){return '<button class="btn'+(i===0?' btn-primary':'')+'" data-act="btn" data-v="'+esc(x)+'">'+esc(x)+'</button>';}).join("")+'</div></div>';
    case "tabs": return '<div class="bare '+span(b)+'"><div class="tabs">'+(b.tabs||["Tab"]).map(function(x,i){return '<div class="tab'+(i===(b.active||0)?' active':'')+'" data-act="tab">'+esc(x)+'</div>';}).join("")+'</div></div>';
    case "legend": return '<div class="bare '+span(b)+'"><div class="legend"><b>Semáforo:</b><span><span class="dot ok"></span>Normal</span><span><span class="dot warn"></span>Alerta</span><span><span class="dot crit"></span>Crítico</span><span><span class="dot null"></span>Sin dato</span></div></div>';
    default: inner=head(b)+((b.subs&&b.subs.length)?('<ul class="plist">'+b.subs.map(function(x){return '<li>'+esc(x)+'</li>';}).join("")+'</ul>'):placeholder(b));
  }
  return '<div class="card pad-b '+span(b)+'">'+inner+reqs(b)+'</div>';
}

/* ---------------- filtros ---------------- */
function filterOptions(name,def){
  var l=(name||"").toLowerCase(), o=null;
  if(/severidad/.test(l)) o=["Todas","Crítica","Alta","Media","Baja"];
  else if(/estado del medidor|estado de comunicaci/.test(l)) o=["Todos","Online","Offline","Dato estancado >4h","CNR pendiente"];
  else if(/estado/.test(l)) o=["Todas","Abierta","Asignada","Escalada","Resuelta"];
  else if(/mall|tenant|centro/.test(l)) o=["Todos"].concat(MALLS);
  else if(/prioridad/.test(l)) o=["Todas","Alta","Media","Baja"];
  else if(/período|periodo|rango|fecha/.test(l)) o=["Hoy","Últimos 7 días","Últimos 30 días","Mes actual","Trimestre","Año en curso"];
  else if(/moneda/.test(l)) o=["UF","CLP","USD"];
  else if(/granularidad/.test(l)) o=["Mensual","Semanal","Diaria","Horaria"];
  else if(/responsable|usuario|técnico|tecnico/.test(l)) o=["Todas"].concat(USERS);
  if(!o) o=[def,"Opción B","Opción C"];
  var arr=[def].concat(o.filter(function(x){return x!==def;})), seen={}, res=[];
  arr.forEach(function(x){if(!seen[x]){seen[x]=1;res.push(x);}}); return res;
}
function filters(s){
  if(!s.filters||!s.filters.length) return '<div class="filters"><div class="frow"><span class="flabel">Filtros:</span><span class="none">(esta pantalla no declara filtros en el informe)</span></div></div>';
  var out='<div class="filters"><div class="frow"><span class="flabel">Filtros:</span>';
  s.filters.forEach(function(f){
    var opts=filterOptions(f.name,f.default).map(function(o){return '<option>'+esc(o)+'</option>';}).join("");
    out+='<label class="filter"><span class="fn">'+esc(f.name)+':</span><select data-act="filter" data-key="'+esc(f.name)+'">'+opts+'</select></label>';
  });
  out+='<span class="fspacer"></span><span class="fcount" id="fcount"></span>'+
       '<button class="fclear" id="fclear" data-act="clearfilters" style="display:none">✕ Limpiar filtros</button></div>'+
       '<div class="fchips" id="fchips"></div>';
  return out+'</div>';
}

/* ---------------- pantallas ---------------- */
function screenHead(s){
  var right='';
  if(s.live) right+='<span class="live"><span class="d"></span>'+esc(s.live)+'</span>';
  right+='<span class="devtag">'+(s.device==="mobile"?"Móvil · PWA":"Escritorio · 1440×900")+'</span>';
  if(s.primaryAction) right+='<button class="btn btn-primary" data-act="btn" data-v="'+esc(s.primaryAction)+'">'+esc(s.primaryAction)+'</button>';
  var sub = s.breadcrumb?'<div class="crumb">'+s.breadcrumb.map(esc).join("  ›  ")+'</div>':(s.subtitle?'<div class="subtitle">'+esc(s.subtitle)+'</div>':'');
  return '<div class="screen-head"><div><h1>'+esc(s.id)+' · '+esc(s.title)+'</h1>'+sub+'</div><div class="head-right">'+right+'</div></div>';
}
function renderDesktop(s){
  var blocks=s.blocks;
  if(s.id==="3.1"||s.id==="3.2"){ // un solo mapa por niveles: fusiona mapa + plano de planta
    blocks=s.blocks.filter(function(b){return b.type!=="planta";})
      .map(function(b){return b.type==="map"?Object.assign({},b,{_leveled:true}):b;});
  }
  return screenHead(s)+filters(s)+'<div class="grid">'+blocks.map(renderBlock).join("")+'</div>';
}
var MNAV=[["Órdenes","mis-ordenes"],["Activos","activos-medidores"],["Comms","diagnostico-comms"],["Bitácora","registro-intervencion"],["Más",""]];
function renderMobileFull(s){
  document.body.classList.remove("nav-collapsed");
  isMobileRender=true;
  var body=filters(s)+s.blocks.map(renderBlock).join("");
  isMobileRender=false;
  var pa=s.mobilePrimary||s.primaryAction;
  var prim=pa?'<div class="p-primary"><button class="btn btn-primary" data-act="btn" data-v="'+esc(pa)+'">'+esc(pa)+'</button></div>':'';
  var actIdx=4; MNAV.forEach(function(n,i){ if(n[1]===s.slug) actIdx=i; });
  var nav='<div class="p-nav">'+MNAV.map(function(n,i){var act=n[1]?('data-act="mnav" data-slug="'+n[1]+'"'):'data-act="mmenu"';
      return '<div class="n'+(i===actIdx?' active':'')+'" '+act+'><span class="d"></span>'+n[0]+'</div>';}).join("")+'</div>';
  var top='<div class="p-top"><span class="phamb" data-act="mmenu" aria-label="Menú">☰</span>'+
    '<div class="p-brand"><div class="pb1">GLOBE · EMS</div><div class="pb2">'+esc(s.title)+' · Técnico · PWA</div></div>'+
    '<span class="pexit" data-act="logout" title="Cerrar sesión">⏻</span></div>';
  document.getElementById("app").innerHTML=
    '<div class="mobile-only"><div class="phone big">'+top+
      '<div class="p-body">'+body+'</div>'+prim+nav+
      '<div class="mmenu" id="mmenu" style="display:none"></div>'+
    '</div></div>';
}
function toggleMMenu(){
  var el=document.getElementById("mmenu"); if(!el) return;
  if(el.style.display!=="none"){ el.style.display="none"; el.innerHTML=""; return; }
  var items=EMS.menus["tecnico"].map(function(m){var sc=byProfile["tecnico"].filter(function(x){return x.activeMenu===m;})[0];
      return '<a class="mm-item" data-act="mnav" data-slug="'+(sc?sc.slug:"")+'">'+esc(m)+'</a>';}).join("");
  el.innerHTML='<div class="mm-hd">MENÚ · TÉCNICO</div>'+items+'<a class="mm-item mm-exit" data-act="logout">⏻ Cerrar sesión</a>';
  el.style.display="block";
}

/* ---------------- shell ---------------- */
function topbar(prof){
  return '<div class="topbar">'+
    '<button class="navtoggle" data-act="navtoggle" title="Contraer / expandir menú" aria-label="Contraer o expandir el menú lateral">☰</button>'+
    '<div class="brand"><span class="logo">E</span>EMS</div>'+
    '<div class="profile-tag"><span class="lbl">Perfil activo</span><span class="val">'+esc(EMS.labels[prof])+'</span></div>'+
    '<span class="auth">'+esc(EMS.auth[prof])+'</span>'+
    '<div class="search"><span class="ic">⌕</span><input placeholder="Buscar medidor, mall, ticket, usuario…" data-act="search"></div>'+
    '<div class="top-right"><div class="bell" data-act="bell">⌁ Alertas <span class="badge">5</span></div>'+
    '<div class="user"><div class="em">'+esc((CREDS[prof]||{}).email||"usuario@ems")+'</div><div class="se">Sesión 15 min · <a class="lnk" data-act="logout">Cerrar sesión</a></div></div></div></div>';
}
function sidebar(prof,active){
  var items=EMS.menus[prof].map(function(m){
    var s=byProfile[prof].filter(function(x){return x.activeMenu===m;})[0];
    var slug=s?s.slug:"";
    return '<a class="navitem'+(m===active?' active':'')+'" href="#/'+prof+'/'+slug+'">'+esc(m)+'</a>';
  }).join("");
  return '<div class="sidebar"><div class="cap">MENÚ · '+esc(EMS.labels[prof].toUpperCase())+'</div>'+items+
    '<div class="foot">PASA · Anexo 07 · Prototipo mid-fi</div></div>';
}

/* ---------------- login ---------------- */
function renderLogin(){
  document.body.classList.remove("nav-collapsed");
  var creds=EMS.order.map(function(p){var c=CREDS[p];
    return '<div class="lc-row"><div class="lc-info"><div class="lc-p">'+esc(EMS.labels[p])+'</div>'+
      '<div class="lc-e">'+esc(c.email)+'  ·  '+esc(c.pass)+'</div><div class="lc-m">'+esc(c.mfa)+'</div></div>'+
      '<button class="btn btn-sm" data-act="usecred" data-p="'+p+'">Usar</button></div>';}).join("");
  document.getElementById("app").innerHTML=
    '<div class="login"><div class="login-inner">'+
      '<div class="login-card">'+
        '<div class="brand-lg"><span class="logo">E</span> EMS · Globe Power</div>'+
        '<div class="login-sub">Energy Management System — Parque Arauco (PASA)</div>'+
        '<div class="lfield"><label>Correo / usuario</label><input id="lg-user" data-lg placeholder="tu.correo@empresa.cl"></div>'+
        '<div class="lfield"><label>Contraseña</label><input id="lg-pass" data-lg type="password" placeholder="••••••••"></div>'+
        '<div class="lg-err" id="lg-err"></div>'+
        '<button class="btn btn-primary lg-go" data-act="login">Ingresar</button>'+
        '<div class="lg-mfa">Inicio de sesión SSO con Azure AD · MFA según perfil (CYB-01 / CYB-02)</div>'+
      '</div>'+
      '<div class="login-card creds">'+
        '<div class="lc-title">Credenciales de demo</div>'+
        '<div class="lc-note">Wireframe interactivo — inicia sesión con cualquiera para entrar con ese perfil.</div>'+
        creds+
      '</div>'+
    '</div><div class="login-foot">PASA · Anexo 07 · Prototipo mid-fi · escala de grises</div></div>';
}
function enter(profile){
  session=profile;
  var target="#/"+profile+"/"+firstSlug(profile);
  if(location.hash===target) render(); else location.hash=target;
}
function doLogin(){
  var u=(document.getElementById("lg-user").value||"").trim().toLowerCase();
  var p=(document.getElementById("lg-pass").value||"");
  var match=null;
  EMS.order.forEach(function(pr){ var c=CREDS[pr]; if(c.email.toLowerCase()===u && c.pass===p) match=pr; });
  if(match){ enter(match); }
  else { var e=document.getElementById("lg-err"); if(e) e.textContent="Credenciales inválidas. Usa alguna de las de demo (columna derecha)."; }
}

/* ---------------- router ---------------- */
function parse(){
  var hash=(location.hash||"").replace(/^#\/?/,"");
  if(byRoute[hash]) return hash;
  return EMS.order[0]+"/"+byProfile[EMS.order[0]][0].slug;
}
function render(){
  closePops();
  if(!session){ renderLogin(); return; }
  var key=parse(), s=byRoute[key];
  if(s.device==="mobile"||s.profile==="tecnico"){ renderMobileFull(s); refreshFilterState(); return; }
  var app=document.getElementById("app");
  app.innerHTML=topbar(s.profile)+sidebar(s.profile,s.activeMenu)+
    '<div class="content">'+renderDesktop(s)+'</div>'+
    '<div class="hint">Prototipo interactivo · escala de grises · <b>'+key+'</b></div>';
  var c=document.querySelector(".content"); if(c) c.scrollTop=0;
  refreshFilterState();
  applyCollapse();
}

/* ---------------- interacciones ---------------- */
var openEl=null;
function closePops(){document.querySelectorAll(".pop,.backdrop,.modal-backdrop").forEach(function(e){e.remove();});openEl=null;}
function toast(msg){
  var t=document.getElementById("toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(t._t); t._t=setTimeout(function(){t.classList.remove("show");},2200);
}
function popUnder(anchor,html){
  closePops();
  var bd=document.createElement("div"); bd.className="backdrop"; bd.addEventListener("click",closePops); document.body.appendChild(bd);
  var r=anchor.getBoundingClientRect();
  var p=document.createElement("div"); p.className="pop"; p.innerHTML=html;
  p.style.top=(r.bottom+6)+"px"; p.style.left=r.left+"px";
  document.body.appendChild(p); openEl=p;
  return p;
}
function firstSlug(prof){return byProfile[prof][0].slug;}

/* ---- flujo: Generar reporte ---- */
function cfgVal(re){var s=filterSelects().filter(function(x){return re.test((x.getAttribute("data-key")||"").toLowerCase());})[0];return s?s.value:null;}
function nowStr(){var d=new Date();function p(n){return(n<10?"0":"")+n;}return p(d.getDate())+"-"+p(d.getMonth()+1)+" "+p(d.getHours())+":"+p(d.getMinutes());}
function openModal(inner){
  closePops();
  var bd=document.createElement("div"); bd.className="modal-backdrop";
  bd.innerHTML='<div class="modal">'+inner+'</div>';
  bd.addEventListener("click",function(e){ if(e.target===bd) bd.remove(); });
  document.body.appendChild(bd);
  bd.querySelectorAll('[data-mclose]').forEach(function(b){b.addEventListener("click",function(){bd.remove();});});
  return bd;
}
function addHistoryRow(alc,fmt){
  var tb=[].slice.call(document.querySelectorAll(".content table.tbl")).filter(function(t){var h=t.textContent.toLowerCase();return h.indexOf("estado")>=0&&(h.indexOf("fecha")>=0||h.indexOf("formato")>=0);})[0];
  if(!tb) return;
  var ths=[].slice.call(tb.querySelectorAll("thead th")).map(function(x){return x.textContent.toLowerCase();});
  var tr=document.createElement("tr"); tr.className="row newrow"; var cells="";
  ths.forEach(function(h){
    var v="—";
    if(h.indexOf("fecha")>=0) v=nowStr();
    else if(h.indexOf("usuario")>=0) v="nmatus";
    else if(h.indexOf("alcance")>=0) v=esc(alc);
    else if(h.indexOf("formato")>=0) v=esc(fmt);
    else if(h.indexOf("estado")>=0) v='<span class="pill-ok">Listo</span>';
    else if(h.indexOf("descarga")>=0||h.indexOf("link")>=0) v='<a class="lnk" data-act="dlreport">Descargar</a>';
    cells+='<td>'+v+'</td>';
  });
  tr.innerHTML=cells;
  var tbody=tb.querySelector("tbody"); tbody.insertBefore(tr,tbody.firstChild);
  setTimeout(function(){tr.classList.remove("newrow");},1600);
}
function mainTable(){return document.querySelector(".content table.tbl");}
function prependRow(tb,get){
  if(!tb) return;
  var ths=[].slice.call(tb.querySelectorAll("thead th")).map(function(x){return x.textContent.toLowerCase();});
  var tr=document.createElement("tr"); tr.className="row newrow"; var c="";
  ths.forEach(function(h,i){ c+='<td>'+get(h,i)+'</td>'; });
  tr.innerHTML=c; var tbody=tb.querySelector("tbody"); tbody.insertBefore(tr,tbody.firstChild);
  setTimeout(function(){tr.classList.remove("newrow");},1600);
}
function closeBtns(m){m.querySelectorAll('[data-mclose]').forEach(function(b){b.addEventListener("click",function(){m.remove();});});}
function modalConfirm(title,bodyHtml,confirmLabel,onConfirm,danger){
  var m=openModal('<div class="modal-hd"><span>'+esc(title)+'</span><button class="mx" data-mclose>✕</button></div>'+
    '<div class="modal-bd">'+bodyHtml+'</div>'+
    '<div class="modal-ft"><button class="btn" data-mclose>Cancelar</button><button class="btn '+(danger?'btn-danger':'btn-primary')+'" id="mok">'+esc(confirmLabel)+'</button></div>');
  closeBtns(m);
  m.querySelector("#mok").addEventListener("click",function(){ m.remove(); if(onConfirm) onConfirm(); });
}
/* Generar / Exportar → progreso + descarga + historial */
function flowProduce(label){
  var isExp=/^exportar/i.test(label);
  var noun=(label||"reporte").replace(/^(generar|exportar)\s+/i,"").toLowerCase()||(isExp?"exportación":"reporte");
  var nounCap=noun.charAt(0).toUpperCase()+noun.slice(1);
  var fmt=cfgVal(/formato/)||(isExp?"Excel":"PDF"), alc=cfgVal(/alcance/)||"Portafolio completo", per=cfgVal(/período|periodo/)||"Mes actual";
  var summary='<ul class="mlist"><li>Contenido: <b>'+esc(nounCap)+'</b></li><li>Alcance: <b>'+esc(alc)+'</b> · Período: <b>'+esc(per)+'</b></li><li>Formato: <b>'+esc(fmt)+'</b></li></ul>';
  var m=openModal('<div class="modal-hd"><span>'+(isExp?"Exportando":"Generando")+' '+esc(noun)+'…</span></div>'+
    '<div class="modal-bd">'+summary+'<div class="progress"><i id="pgi"></i></div><div class="mnote">Preparando el archivo…</div></div>');
  var pgi=m.querySelector("#pgi"); setTimeout(function(){ if(pgi) pgi.style.width="100%"; },60);
  setTimeout(function(){
    if(!m.parentNode) return;
    var hasTable=!!mainTable();
    m.querySelector(".modal").innerHTML=
      '<div class="modal-hd"><span>✓ '+(isExp?"Exportación lista":(esc(nounCap)+" generado"))+'</span><button class="mx" data-mclose>✕</button></div>'+
      '<div class="modal-bd">'+summary+'<div class="mok">El archivo quedó disponible'+(hasTable?' y se registró en el historial.':'.')+'</div></div>'+
      '<div class="modal-ft"><button class="btn" data-mclose>Cerrar</button><button class="btn btn-primary" data-act="dlreport" data-mclose>⬇ Descargar '+esc(fmt)+'</button></div>';
    closeBtns(m); addHistoryRow(alc,fmt);
    toast((isExp?"Exportación lista":"Reporte generado")+" · en historial");
  },1500);
}
/* Nuevo / Nueva → formulario + alta de fila */
var CREATE_FIELDS={
  "tenant":["Nombre del mall","Moneda","Zona horaria"],
  "usuario":["Nombre","Email","Perfil"],
  "medidor":["Serial","Mall","Protocolo"],
  "ticket":["Descripción","Prioridad","Mall"],
  "regla":["Medidor","Tipo de transformación","Valor"],
  "política":["Tipo de dato","Retención (años)","Acción al vencer"],
  "integración":["Nombre","Tipo","Endpoint"]
};
function flowCreate(label){
  var ent=label.replace(/^nuev[oa]\s+/i,"").toLowerCase();
  var fs=CREATE_FIELDS[ent]||["Nombre","Descripción"];
  var body='<div class="form">'+fs.map(function(f){return '<div class="fg"><label>'+esc(f)+'</label><input data-mf placeholder="'+esc(f)+'"></div>';}).join("")+'</div>';
  var m=openModal('<div class="modal-hd"><span>'+esc(label)+'</span><button class="mx" data-mclose>✕</button></div>'+
    '<div class="modal-bd">'+body+'</div>'+
    '<div class="modal-ft"><button class="btn" data-mclose>Cancelar</button><button class="btn btn-primary" id="mok">Crear</button></div>');
  closeBtns(m);
  m.querySelector("#mok").addEventListener("click",function(){
    var vals=[].slice.call(m.querySelectorAll('[data-mf]')).map(function(i){return i.value.trim();});
    m.remove();
    prependRow(mainTable(),function(h,i){
      if(i===0&&vals[0]) return esc(vals[0]);
      for(var k=1;k<fs.length;k++){ var key=fs[k].toLowerCase().split(" ")[0]; if(vals[k]&&h.indexOf(key)>=0) return esc(vals[k]); }
      if(h.indexOf("estado")>=0) return '<span class="pill-ok">Activo</span>';
      if(h.indexOf("fecha")>=0) return nowStr();
      return cellFor(h,0);
    });
    toast(ent.charAt(0).toUpperCase()+ent.slice(1)+" creado · agregado a la tabla");
  });
}
/* Nuevo ticket → formulario + alta en el tablero */
function flowNewTicket(){
  var body='<div class="form">'+
    '<div class="fg"><label>Título del ticket</label><input id="t-tit" placeholder="Ej. Medidor sin lectura > 4 h — Costanera P2"></div>'+
    '<div class="frow2"><div class="fg"><label>Tipo</label><select id="t-tipo"><option>Alarma</option><option>CNR</option><option>Solicitud</option><option>Mantención</option></select></div>'+
    '<div class="fg"><label>Prioridad</label><select id="t-pri"><option>Crítica</option><option selected>Alta</option><option>Media</option><option>Baja</option></select></div></div>'+
    '<div class="frow2"><div class="fg"><label>Mall</label><select id="t-mall">'+MALLS.map(function(x){return '<option>'+esc(x)+'</option>';}).join("")+'</select></div>'+
    '<div class="fg"><label>Zona / medidor</label><input id="t-med" placeholder="SN-4471 · P2"></div></div>'+
    '<div class="frow2"><div class="fg"><label>Asignar a</label><select id="t-who"><option>Sin asignar</option><option>p.soto</option><option>m.rivas</option><option>Cola N2</option></select></div>'+
    '<div class="fg"><label>Compromiso SLA</label><select id="t-sla"><option>4 h (Alta)</option><option>2 h (Crítica)</option><option>24 h (Media)</option></select></div></div>'+
    '<div class="fg"><label>Descripción</label><textarea id="t-desc" placeholder="Detalle del problema…"></textarea></div>'+
    '<div class="mnote">Se registra con SLA según prioridad (FIN-05/FIN-06) y queda en la pista de auditoría.</div></div>';
  var m=openModal('<div class="modal-hd"><span>Nuevo ticket</span><button class="mx" data-mclose>✕</button></div><div class="modal-bd">'+body+'</div>'+
    '<div class="modal-ft"><button class="btn" data-mclose>Cancelar</button><button class="btn btn-primary" id="mok">Crear ticket</button></div>');
  closeBtns(m);
  m.querySelector("#mok").addEventListener("click",function(){
    var tit=m.querySelector("#t-tit").value.trim()||"Ticket sin título", tipo=m.querySelector("#t-tipo").value,
        pri=m.querySelector("#t-pri").value, mall=m.querySelector("#t-mall").value;
    m.remove();
    var tb=mainTable(); var id="OT-"+(2300+(tb?tb.querySelectorAll("tbody tr.row").length:0));
    prependRow(tb,function(h){
      if(/(^|\s)id(\s|$)/.test(h)||/ticket|orden/.test(h)) return id;
      if(h.indexOf("descrip")>=0) return esc(tit);
      if(h.indexOf("tipo")>=0) return esc(tipo);
      if(h.indexOf("priorid")>=0||h.indexOf("sever")>=0) return esc(pri);
      if(h.indexOf("mall")>=0) return esc(mall);
      if(h.indexOf("estado")>=0) return '<span class="pill-ok">Abierto</span>';
      if(h.indexOf("fecha")>=0||h.indexOf("apertura")>=0||h.indexOf("compromiso")>=0) return nowStr();
      if(h.indexOf("restan")>=0||h.indexOf("vencid")>=0||h.indexOf("días")>=0||h.indexOf("dias")>=0) return "En SLA";
      return cellFor(h,0);
    });
    toast("Ticket "+id+" creado · prioridad "+pri);
  });
}
/* Ingreso de CNR manual → formulario (norma CNR) + firma inmutable */
function flowCNR(){
  var body='<div class="form">'+
    '<div class="frow2"><div class="fg"><label>Medidor</label><input id="c-med" value="SN-4471"></div>'+
    '<div class="fg"><label>Mall / zona</label><input id="c-mall" value="Costanera Center · P2"></div></div>'+
    '<div class="frow2"><div class="fg"><label>Inicio del período</label><input id="c-ini" placeholder="31-07 08:00"></div>'+
    '<div class="fg"><label>Fin del período</label><input id="c-fin" placeholder="31-07 12:00"></div></div>'+
    '<div class="frow2"><div class="fg"><label>Valor real [kWh]</label><input id="c-val" placeholder="Ej. 128,5"></div>'+
    '<div class="fg"><label>Motivo del CNR</label><select id="c-mot"><option>Falla de comunicación</option><option>Medidor en mantención</option><option>Corte programado</option><option>Otro</option></select></div></div>'+
    '<div class="fg"><label>Justificación</label><textarea id="c-just" placeholder="Sustento del consumo no registrado…"></textarea></div>'+
    '<div class="fg"><label>Evidencia</label><div class="dropzone">Adjunta foto o documento de respaldo</div></div>'+
    '<div class="mnote">Al firmar, el valor se marca como <b>“dato manual — CNR”</b> en todos los dashboards y el registro queda <b>inmutable</b> (DAT-20 · DAT-14 · CYB-10). No se puede retroeditar.</div></div>';
  var m=openModal('<div class="modal-hd"><span>Ingreso de CNR manual</span><button class="mx" data-mclose>✕</button></div><div class="modal-bd">'+body+'</div>'+
    '<div class="modal-ft"><button class="btn" data-mclose>Cancelar</button><button class="btn btn-primary" id="mok">Firmar e ingresar</button></div>');
  closeBtns(m);
  m.querySelector("#mok").addEventListener("click",function(){
    var med=m.querySelector("#c-med").value||"SN-4471", val=m.querySelector("#c-val").value||"—", mot=m.querySelector("#c-mot").value;
    m.querySelector(".modal").innerHTML='<div class="modal-hd"><span>✓ CNR ingresada y firmada</span><button class="mx" data-mclose>✕</button></div>'+
      '<div class="modal-bd"><ul class="mlist"><li>Medidor: <b>'+esc(med)+'</b></li><li>Valor real: <b>'+esc(val)+' kWh</b> · Motivo: <b>'+esc(mot)+'</b></li><li>Estado: <b>En revisión (Operacional)</b></li></ul>'+
      '<div class="mok">Marcada como “dato manual — CNR”, inmutable y registrada en la pista de auditoría (DAT-20).</div></div>'+
      '<div class="modal-ft"><button class="btn btn-primary" data-mclose>Listo</button></div>';
    closeBtns(m);
    var tb=[].slice.call(document.querySelectorAll('.content table.tbl')).filter(function(t){return /cnr|medidor|serial/i.test(t.textContent);})[0];
    if(tb) prependRow(tb,function(h){ if(h.indexOf("medidor")>=0||h.indexOf("serial")>=0)return esc(med); if(h.indexOf("estado")>=0)return '<span class="pill-warn">En revisión</span>'; if(/valor|kwh/.test(h))return esc(val); if(h.indexOf("fecha")>=0)return nowStr(); if(h.indexOf("tipo")>=0)return "Manual"; return cellFor(h,0); });
    toast("CNR ingresada y firmada · inmutable");
  });
}
/* Firmar → confirmación de inmutabilidad */
function flowSign(label){
  modalConfirm(label,'Al firmar, el registro queda <b>inmutable</b> (no editable), con sello de tiempo del servidor, usuario y hash de integridad (DAT-19 · CYB-10).','Firmar',function(){ toast("Registro firmado · inmutable ✓"); });
}
/* Probar conexión → test con resultado */
function flowTest(){
  var m=openModal('<div class="modal-hd"><span>Probando conexión…</span></div>'+
    '<div class="modal-bd"><div class="progress"><i id="pgi"></i></div><div class="mnote">Enviando ping al gateway y solicitando lectura…</div></div>');
  var pgi=m.querySelector("#pgi"); setTimeout(function(){ if(pgi) pgi.style.width="100%"; },60);
  setTimeout(function(){ if(!m.parentNode) return;
    m.querySelector(".modal").innerHTML='<div class="modal-hd"><span>✓ Conexión establecida</span><button class="mx" data-mclose>✕</button></div>'+
      '<div class="modal-bd"><ul class="mlist"><li>Estado: <b>Online</b></li><li>Latencia: <b>214 ms</b> · Reintentos: <b>0</b></li><li>Último dato: <b>hace 2 min</b> · Tasa de éxito 24h: <b>99,2%</b></li></ul></div>'+
      '<div class="modal-ft"><button class="btn btn-primary" data-mclose>Cerrar</button></div>';
    closeBtns(m);
  },1300);
}
/* Solicitar despliegue → gate de aprobación PASA */
function flowDeploy(){
  modalConfirm('Solicitar despliegue a producción','Ningún cambio pasa a producción sin pruebas de seguridad y <b>aprobación de al menos un rol PASA</b> (CYB-15). Se abrirá el flujo de aprobación y quedará auditado.','Solicitar aprobación',function(){
    prependRow(mainTable(),function(h){
      if(h.indexOf("estado")>=0) return '<span class="pill-warn">En aprobación</span>';
      if(h.indexOf("fecha")>=0) return nowStr();
      if(h.indexOf("responsable")>=0) return "nmatus";
      if(h.indexOf("versi")>=0) return "v2.4.1";
      return cellFor(h,0);
    });
    toast("Solicitud enviada · esperando aprobación de PASA");
  });
}
function actionMsg(v){
  var l=v.toLowerCase();
  if(/asignar/.test(l)) return "Alarma asignada a nmatus";
  if(/escalar/.test(l)) return "Alarma escalada a soporte N2";
  if(/cerrar/.test(l)) return "Alarma cerrada · queda en pista de auditoría";
  if(/backfill/.test(l)) return "Backfill iniciado · reponiendo datos…";
  if(/iniciar orden/.test(l)) return "Orden iniciada · estado: en curso";
  if(/pausar/.test(l)) return "Orden pausada";
  if(/forzar/.test(l)) return "Re-intento de lectura forzado…";
  if(/programar/.test(l)) return "Programado correctamente";
  if(/activar/.test(l)) return "Estado actualizado";
  if(/notificar/.test(l)) return "Notificación enviada a PASA (< 24 h)";
  if(/ver log/.test(l)) return "Abriendo log de comunicación (últimas 100 líneas)…";
  if(/iniciar/.test(l)) return "Proceso iniciado";
  return "“"+v+"” — acción simulada";
}
function setActionStatus(el,html){
  var wrap=el&&el.closest?el.closest(".actions"):null; if(!wrap) return;
  var s=wrap.querySelector(".actstatus"); if(!s){ s=document.createElement("span"); s.className="actstatus"; wrap.appendChild(s); }
  s.innerHTML=html;
}
function alarmsTable(){return [].slice.call(document.querySelectorAll('.content table.tbl')).filter(function(t){var h=t.textContent.toLowerCase();return h.indexOf("sev")>=0&&h.indexOf("estado")>=0;})[0];}
function markAlarmAssigned(who){
  var tb=alarmsTable(); if(!tb) return;
  var ths=[].slice.call(tb.querySelectorAll('thead th')).map(function(x){return x.textContent.toLowerCase();});
  var respI=-1,estI=-1; ths.forEach(function(h,i){ if(h.indexOf("respons")>=0)respI=i; if(h.indexOf("estado")>=0)estI=i; });
  var row=[].slice.call(tb.querySelectorAll('tbody tr.row')).filter(function(r){return r.style.display!=="none";})[0];
  if(!row) return;
  if(respI>=0&&row.children[respI]) row.children[respI].textContent=who;
  if(estI>=0&&row.children[estI]) row.children[estI].innerHTML='<span class="pill-ok">Asignada</span>';
  row.classList.add("newrow"); setTimeout(function(){row.classList.remove("newrow");},1800);
}
function alarmAssign(el){
  var ctx='<div class="alarmctx"><span class="sev crit">CRÍT</span> <b>Sobrecarga transformador</b> — Costanera Center · P2 · <span class="muted">abierta hace 2 h · baseline superado 38%</span></div>';
  var body='<div class="form">'+
    '<div class="fg"><label>Responsable</label><select id="fa-who"><option>Yo (nmatus)</option><option>p.soto</option><option>m.rivas</option><option>c.díaz</option><option>a.fuentes</option><option>operador N2</option></select></div>'+
    '<div class="frow2"><div class="fg"><label>Nivel de soporte (SLA)</label><select id="fa-lvl"><option>N1</option><option selected>N2</option><option>N3</option></select></div>'+
    '<div class="fg"><label>Prioridad</label><select id="fa-pri"><option selected>Crítica</option><option>Alta</option><option>Media</option><option>Baja</option></select></div></div>'+
    '<div class="fg"><label>Fecha compromiso (SLA)</label><select id="fa-sla"><option>Hoy 16:30 · SLA 2 h (Crítica)</option><option>Hoy 20:30 · 4 h</option><option>Mañana 09:00</option></select></div>'+
    '<div class="fg"><label>Comentario inicial (opcional)</label><textarea id="fa-com" placeholder="Contexto, hipótesis o próximos pasos…"></textarea></div>'+
    '<div class="mnote">La asignación y el comentario quedan en la pista de auditoría (DAT-14).</div></div>';
  var m=openModal('<div class="modal-hd"><span>Asignar alarma</span><button class="mx" data-mclose>✕</button></div>'+
    '<div class="modal-bd">'+ctx+body+'</div>'+
    '<div class="modal-ft"><button class="btn" data-mclose>Cancelar</button><button class="btn btn-primary" id="mok">Asignar alarma</button></div>');
  closeBtns(m);
  m.querySelector("#mok").addEventListener("click",function(){
    var who=m.querySelector("#fa-who").value.replace(/^Yo \(([^)]+)\)$/,"$1");
    var lvl=m.querySelector("#fa-lvl").value;
    m.remove();
    setActionStatus(el,'<span class="pill-ok">Asignada a '+esc(who)+' · '+esc(lvl)+'</span>');
    markAlarmAssigned(who);
    toast("Alarma asignada a "+who+" ("+lvl+") · en pista de auditoría");
  });
}
/* acciones sobre una alarma (Asignar / Escalar / Cerrar / Iniciar backfill) */
function alarmAction(v,el){
  var l=v.toLowerCase();
  if(/asignar/.test(l)){ alarmAssign(el); }
  else if(/escalar/.test(l)){
    modalConfirm("Escalar alarma","La alarma se escalará a <b>soporte N2</b> y quedará registrada en la pista de auditoría (FIN-05).","Escalar",function(){ setActionStatus(el,'<span class="pill-warn">Escalada a N2</span>'); toast("Alarma escalada a soporte N2"); });
  } else if(/cerrar/.test(l)){
    modalConfirm("Cerrar alarma","¿Confirmas el cierre de la alarma? No se elimina: queda registrada en la pista de auditoría (CYB-10).","Cerrar alarma",function(){ setActionStatus(el,'<span class="pill-ok">Cerrada ✓</span>'); toast("Alarma cerrada · en pista de auditoría"); });
  } else { // iniciar backfill
    var m2=openModal('<div class="modal-hd"><span>Backfill automático…</span></div>'+
      '<div class="modal-bd"><div class="progress"><i id="pgi"></i></div><div class="mnote">Reponiendo lecturas faltantes del período (DAT-10)…</div></div>');
    var pgi=m2.querySelector("#pgi"); setTimeout(function(){ if(pgi) pgi.style.width="100%"; },60);
    setTimeout(function(){ if(!m2.parentNode) return;
      m2.querySelector(".modal").innerHTML='<div class="modal-hd"><span>✓ Backfill completado</span><button class="mx" data-mclose>✕</button></div>'+
        '<div class="modal-bd"><div class="mok">Se repusieron las lecturas del gap y se actualizó la calidad del dato.</div></div>'+
        '<div class="modal-ft"><button class="btn btn-primary" data-mclose>Cerrar</button></div>';
      closeBtns(m2); setActionStatus(el,'<span class="pill-ok">Backfill OK</span>'); toast("Backfill completado");
    },1400);
  }
}
/* Iniciar orden (Técnico móvil, 5.1) → contexto + arranque de SLA + atajo a intervención */
function orderCard(){
  return document.querySelector('.p-body .tcards .tcard');
}
function markOrderInProgress(){
  var card=orderCard(); if(!card) return;
  [].slice.call(card.querySelectorAll('.tc-row')).forEach(function(r){
    var k=r.querySelector('.tc-k'), val=r.querySelector('.tc-v');
    if(k&&val&&/estado/i.test(k.textContent)) val.innerHTML='<span class="pill-warn">En curso</span>';
  });
  var dot=card.querySelector('.tc-title .dot'); if(dot){ dot.className='dot warn'; }
  card.classList.add("newrow"); setTimeout(function(){ card.classList.remove("newrow"); },1600);
}
function flowStartOrder(){
  var ctx='<div class="alarmctx"><b>OT-2291</b> · Medidor <b>SN-4471</b> — Costanera Center · P2<br>'+
    '<span class="muted">Problema: sin lectura &gt; 4 h en remarcador · prioridad Alta · SLA 4 h</span></div>';
  var body='<div class="form">'+ctx+
    '<div class="fg"><label>Confirma tu ubicación</label><select id="o-loc"><option>En terreno — Costanera Center P2</option><option>En ruta</option><option>Remoto</option></select></div>'+
    '<div class="fg"><label>Nota de inicio (opcional)</label><textarea id="o-note" placeholder="Ej. Acceso por sala eléctrica P2, medidor sin display…"></textarea></div>'+
    '<div class="mnote">Al iniciar, la orden pasa a <b>En curso</b>, se registra la hora de inicio, arranca el <b>cronómetro de SLA</b> y quedas como responsable (DAT-19 · DAT-23).</div></div>';
  var m=openModal('<div class="modal-hd"><span>Iniciar orden</span><button class="mx" data-mclose>✕</button></div><div class="modal-bd">'+body+'</div>'+
    '<div class="modal-ft"><button class="btn" data-mclose>Cancelar</button><button class="btn btn-primary" id="mok">Iniciar orden</button></div>');
  closeBtns(m);
  m.querySelector("#mok").addEventListener("click",function(){
    markOrderInProgress();
    m.querySelector(".modal").innerHTML='<div class="modal-hd"><span>✓ Orden en curso</span><button class="mx" data-mclose>✕</button></div>'+
      '<div class="modal-bd"><ul class="mlist"><li>Orden: <b>OT-2291</b> · Medidor SN-4471</li>'+
      '<li>Estado: <b>En curso</b> · inicio '+nowStr()+'</li>'+
      '<li>Responsable: <b>tecnico@pasa.cl</b> · SLA <b>4 h</b> en marcha</li></ul>'+
      '<div class="mok">Cronómetro de SLA iniciado. Al terminar en terreno, registra la intervención para cerrar la orden.</div></div>'+
      '<div class="modal-ft"><button class="btn" data-mclose>Cerrar</button>'+
      '<button class="btn btn-primary" data-act="mnav" data-slug="registro-intervencion" data-mclose>Registrar intervención ›</button></div>';
    closeBtns(m);
    toast("Orden OT-2291 iniciada · en curso");
  });
}
function runButton(v,el){
  if(/nuevo ticket/i.test(v)) flowNewTicket();
  else if(/cnr/i.test(v)&&/(firmar|ingres|nuevo)/i.test(v)) flowCNR();
  else if(/^(generar|exportar)/i.test(v)) flowProduce(v);
  else if(/^(nuevo|nueva)/i.test(v)) flowCreate(v);
  else if(/solicitar despliegue/i.test(v)) flowDeploy();
  else if(/^firmar/i.test(v)) flowSign(v);
  else if(/probar conexi/i.test(v)) flowTest();
  else if(/iniciar orden/i.test(v)) flowStartOrder();
  else if(/^(asignar|escalar|cerrar)/i.test(v)||/iniciar backfill/i.test(v)) alarmAction(v,el);
  else if(/^(rollback|ejecutar|desactivar|revocar|borrado)/i.test(v)) modalConfirm(v,'Acción sensible: puede afectar producción o datos y <b>quedará auditada</b>. ¿Confirmas?',v,function(){toast('“'+v+'” ejecutada (demo)');},true);
  else if(/^(iniciar|pausar|forzar|programar|activar|notificar|ver log)/i.test(v)) toast(actionMsg(v));
  else toast("Acción: “"+v+"” — simulada en el prototipo");
}

document.addEventListener("click",function(e){
  var t=e.target.closest("[data-act]");
  if(!t){return;}
  var act=t.getAttribute("data-act");
  if(act==="btn"){ runButton(t.getAttribute("data-v")||"", t); }
  else if(act==="dlreport"){ toast("Descarga iniciada (simulada) · archivo."+((cfgVal(/formato/)||"PDF").toLowerCase())); }
  else if(act==="marker"){ toast("Centro comercial: "+t.getAttribute("data-v")+" · click para drill-down"); }
  else if(act==="cell"){ toast("Tienda/local seleccionado (Nivel 3)"); }
  else if(act==="drilltomalls"){ showMalls(); toast("Nivel 2 · Centro comercial — Chile"); }
  else if(act==="drilltomall"){ showFloor(t.getAttribute("data-v")); toast("Nivel 3 · "+t.getAttribute("data-v")+" — tiendas/locales"); }
  else if(act==="uptomalls"){ showMalls(); }
  else if(act==="uptocountry"){ showCountry(); }
  else if(act==="tree"){ document.querySelectorAll(".tree .tn").forEach(function(n){n.classList.remove("active");}); t.classList.add("active");
      var c=t.querySelector(".chev"); if(c)c.classList.toggle("open"); }
  else if(act==="tab"){ var box=t.parentNode; box.querySelectorAll(".tab").forEach(function(n){n.classList.remove("active");}); t.classList.add("active"); }
  else if(act==="sort"){ sortTable(t); }
  else if(act==="login"){ doLogin(); }
  else if(act==="usecred"){ enter(t.getAttribute("data-p")); }
  else if(act==="logout"){ session=null; location.hash=""; render(); }
  else if(act==="navtoggle"){ collapsed=!collapsed; applyCollapse(); }
  else if(act==="clearfilters"){ clearFilters(); }
  else if(act==="clearone"){ var k=t.getAttribute("data-key"); filterSelects().forEach(function(s){if(s.getAttribute("data-key")===k)s.selectedIndex=0;}); applyFilters(); refreshFilterState(); }
  else if(act==="exprow"){ var ex=t.nextElementSibling; if(ex&&ex.classList.contains("exp")){var open=ex.style.display!=="none";ex.style.display=open?"none":"table-row";var c2=t.querySelector(".chev");if(c2)c2.classList.toggle("open",!open);} }
  else if(act==="exprowc"){ var ex=t.querySelector(".tc-exp"); if(ex){var op=ex.style.display!=="none";ex.style.display=op?"none":"block";var cv=t.querySelector(".chev");if(cv)cv.classList.toggle("open",!op);} }
  else if(act==="mmenu"){ toggleMMenu(); }
  else if(act==="mnav"){ var sl=t.getAttribute("data-slug"); if(sl) location.hash="#/tecnico/"+sl; else toggleMMenu(); }
  else if(act==="bell"){
    var al=[["crit","Sobrecarga transformador — Costanera P2"],["warn","Fase desbalanceada — Egaña"],["warn","Dato estancado >4h — Maipú"],["null","Backfill completado — Vespucio"],["crit","Medidor offline — Alto Las Condes"]];
    var html=al.map(function(a){return '<div class="pi" data-al="1"><span class="sev '+a[0]+'">'+(a[0]==="crit"?"CRÍT":a[0]==="warn"?"WARN":"INFO")+'</span>'+esc(a[1])+'</div>';}).join("");
    var pp=popUnder(t,html);
    pp.querySelectorAll("[data-al]").forEach(function(it){it.addEventListener("click",function(){closePops();location.hash="#/operacional/alarmas-eventos";});});
    e.stopPropagation();
  }
});
document.addEventListener("input",function(e){
  var t=e.target; if(!t.getAttribute) return;
  var act=t.getAttribute("data-act");
  if(act==="filter"){ applyFilters(); refreshFilterState(); }
  else if(act==="search"){ openSearch(t.value); }
});
document.addEventListener("focusin",function(e){
  var t=e.target;
  if(t.getAttribute&&t.getAttribute("data-act")==="search"){ openSearch(t.value); }
});
window.addEventListener("hashchange",render);
document.addEventListener("keydown",function(e){
  if(e.key==="Escape")closePops();
  if(e.key==="Enter"&&e.target&&e.target.getAttribute&&e.target.getAttribute("data-lg")!==null&&e.target.hasAttribute("data-lg")) doLogin();
});
render();
})();
