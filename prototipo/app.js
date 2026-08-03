/* EMS · Prototipo interactivo mid-fi (grayscale). Sin dependencias. */
(function(){
"use strict";
var EMS = window.EMS;
var byRoute = {}, byProfile = {};
EMS.order.forEach(function(p){ byProfile[p]=[]; });
EMS.screens.forEach(function(s){ byRoute[s.profile+"/"+s.slug]=s; byProfile[s.profile].push(s); });

var MALLS=["Costanera Center","Mallplaza Egaña","Alto Las Condes","Arauco Maipú","Mallplaza Vespucio","Portal Ñuñoa"];
var USERS=["p.soto","m.rivas","c.díaz","a.fuentes","operador N2"];
var NAV=["Órdenes","Activos","Comms","Bitácora","Más"];
var MONTHS=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
var SER=[64,70,58,78,72,86,90,66,80,60,88,76];          // alturas % (serie mensual)
var VAL=[1.04,1.12,0.98,1.18,1.10,1.24,1.28,1.06,1.20,0.96,1.26,1.17]; // valor por barra
var LINEV=[0.42,0.55,0.5,0.66,0.6,0.78,0.72,0.9,0.62,0.8]; // serie de línea

function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function h(v){return Math.abs(Math.sin(v))*0.6+0.35;} // pseudo-altura estable 0.35..0.95
function span(b){return 's'+((b&&b.colspan)||12);}

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
function table(b){
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
  var chips=filterSelects().filter(function(s){return s.selectedIndex>0;}).map(function(s){
    var k=s.getAttribute("data-key");
    return '<span class="achip">'+esc(k)+': '+esc(s.value)+'<b data-act="clearone" data-key="'+esc(k)+'" title="Quitar">✕</b></span>';
  }).join("");
  var box=document.getElementById("fchips"); if(box) box.innerHTML=chips;
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
       '<button class="fclear" data-act="clearfilters">✕ Limpiar filtros</button></div>'+
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
  if(s.id==="3.1"){ // un solo mapa por niveles: fusiona mapa + plano de planta
    blocks=s.blocks.filter(function(b){return b.type!=="planta";})
      .map(function(b){return b.type==="map"?Object.assign({},b,{_leveled:true}):b;});
  }
  return screenHead(s)+filters(s)+'<div class="grid">'+blocks.map(renderBlock).join("")+'</div>';
}
function renderMobile(s){
  var body=filters(s)+s.blocks.map(renderBlock).join("");
  var prim=s.mobilePrimary?'<div class="p-primary"><button class="btn btn-primary" data-act="btn" data-v="'+esc(s.mobilePrimary)+'">'+esc(s.mobilePrimary)+'</button></div>':'';
  var nav='<div class="p-nav">'+NAV.map(function(n,i){return '<div class="n'+(i===(s.navActive||0)?' active':'')+'"><span class="d"></span>'+n+'</div>';}).join("")+'</div>';
  var phone='<div class="phone"><div class="p-top"><span style="font-size:16px">☰</span><div><div style="font-size:12px;font-weight:700">GLOBE · EMS</div><div style="font-size:9px;color:var(--ink-3)">Técnico · PWA</div></div></div>'+
    '<div class="p-body">'+body+'</div>'+prim+nav+'</div>';
  var note='<div class="phone-note"><h3>Vista de terreno (PWA)</h3><p>Pantalla optimizada para uso con una mano y baja señal: menos densidad, targets grandes y la acción principal fija sobre el nav inferior (alcance del pulgar).</p><p>Usá el menú lateral para recorrer las demás pantallas del perfil Técnico.</p></div>';
  return screenHead(s)+'<div class="phonewrap">'+phone+note+'</div>';
}

/* ---------------- shell ---------------- */
function topbar(prof){
  return '<div class="topbar">'+
    '<div class="brand"><span class="logo">E</span>EMS</div>'+
    '<div class="profile-btn" data-act="profmenu"><span class="lbl">Perfil activo</span><span class="val">'+esc(EMS.labels[prof])+' ▾</span></div>'+
    '<span class="auth">'+esc(EMS.auth[prof])+'</span>'+
    '<div class="search"><span class="ic">⌕</span><input placeholder="Buscar medidor, mall, ticket, usuario…" data-act="search"></div>'+
    '<div class="top-right"><div class="bell" data-act="bell">⌁ Alertas <span class="badge">5</span></div>'+
    '<div class="user"><div class="em">nmatus@grupoglobe.com</div><div class="se">Sesión 15 min · MFA activo</div></div></div></div>';
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

/* ---------------- router ---------------- */
function parse(){
  var hash=(location.hash||"").replace(/^#\/?/,"");
  if(byRoute[hash]) return hash;
  return EMS.order[0]+"/"+byProfile[EMS.order[0]][0].slug;
}
function render(){
  closePops();
  var key=parse(), s=byRoute[key];
  var app=document.getElementById("app");
  app.innerHTML=topbar(s.profile)+sidebar(s.profile,s.activeMenu)+
    '<div class="content">'+(s.device==="mobile"?renderMobile(s):renderDesktop(s))+'</div>'+
    '<div class="hint">Prototipo interactivo · escala de grises · <b>'+key+'</b></div>';
  var c=document.querySelector(".content"); if(c) c.scrollTop=0;
  refreshFilterState();
}

/* ---------------- interacciones ---------------- */
var openEl=null;
function closePops(){document.querySelectorAll(".pop,.backdrop").forEach(function(e){e.remove();});openEl=null;}
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

document.addEventListener("click",function(e){
  var t=e.target.closest("[data-act]");
  if(!t){return;}
  var act=t.getAttribute("data-act");
  if(act==="btn"){ toast("Acción: “"+t.getAttribute("data-v")+"” — simulada en el prototipo"); }
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
  else if(act==="clearfilters"){ clearFilters(); }
  else if(act==="clearone"){ var k=t.getAttribute("data-key"); filterSelects().forEach(function(s){if(s.getAttribute("data-key")===k)s.selectedIndex=0;}); applyFilters(); refreshFilterState(); }
  else if(act==="exprow"){ var ex=t.nextElementSibling; if(ex&&ex.classList.contains("exp")){var open=ex.style.display!=="none";ex.style.display=open?"none":"table-row";var c2=t.querySelector(".chev");if(c2)c2.classList.toggle("open",!open);} }
  else if(act==="profmenu"){
    var html=EMS.order.map(function(p){return '<div class="pi" data-go="'+p+'"><b style="min-width:96px;display:inline-block">'+esc(EMS.labels[p])+'</b><span style="color:var(--ink-3);font-size:11px">'+esc(EMS.auth[p]).split("·")[0]+'</span></div>';}).join("");
    var p=popUnder(t,html);
    p.querySelectorAll("[data-go]").forEach(function(it){it.addEventListener("click",function(){var pr=it.getAttribute("data-go");closePops();location.hash="#/"+pr+"/"+firstSlug(pr);});});
    e.stopPropagation();
  }
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
document.addEventListener("keydown",function(e){if(e.key==="Escape")closePops();});
render();
})();
