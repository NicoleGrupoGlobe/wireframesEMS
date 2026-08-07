# Spec de autoría de datos de pantallas — EMS PASA wireframes low-fi

Tu tarea: producir **un archivo JSON** con las pantallas de UN perfil, siguiendo
este esquema exacto. NO escribes SVG ni HTML: un renderizador compartido
(`_build/render.py`) convierte tu JSON en SVG + Markdown. Debes producir JSON
válido (sin comentarios, sin comas finales).

## Fuente de contenido (obligatoria, no inventar)
Lee el texto extraído del informe fuente v2.0 en:
`<SCRATCH>/v2.0.txt`
Usa SOLO los componentes, descripciones, filtros y requerimientos PASA que
aparecen ahí para tu perfil. Si un dato falta, NO lo inventes: agrega una nota
(`notes`) o acláralo. Transcribe/parafrasea fielmente en el bloque `detail`.

## Ejemplo de referencia (imítalo en estructura y calidad)
`_build/data/01-gerencial.json` — perfil Gerencial ya terminado. Ábrelo y sigue
su forma, densidad de detalle y estilo de justificación UX.

## Esquema de una pantalla
```json
{
  "id": "4.1", "slug": "monitoreo-en-vivo", "profile": "<clave-perfil>",
  "device": "desktop",            // o "mobile" (solo donde se indique)
  "title": "Monitoreo en vivo",
  "activeMenu": "Monitoreo en vivo",   // DEBE coincidir EXACTO con el menú (abajo)
  "subtitle": "una línea de contexto",
  "filters": [ {"name":"País","default":"Todos"}, ... ],   // van a la barra de filtros
  "notes": [ {"x":264,"y":184,"w":300,"text":"..."} ],      // opcional, recuadros en lienzo
  "blocks": [ ... ],              // ver catálogo
  "detail": {
    "descripcion": "…",
    "componentes": [ {"nombre":"…","descripcion":"…","reqs":["DAT-03"]} ],
    "filtros":     [ {"nombre":"…","opciones":"…","default":"…"} ],
    "ux":          [ {"componente":"…","texto":"…","principio":"…"} ]
  }
}
```
El archivo es un **array** de estas pantallas.

## Grilla y coordenadas (desktop 1440×900)
- Área de contenido: 12 columnas. Cada bloque usa `"col"` (0–11) + `"colspan"` + `"y"` + `"h"`.
  El renderer calcula x/ancho desde la grilla (garantiza alineación).
- Rango vertical usable: `y` de **184 a 884**. No te salgas ni superpongas bloques.
- Un bloque a ancho completo: `"col":0,"colspan":12`. Media pantalla: colspan 6. Tercio: colspan 4.
- Puedes fijar `"x"`,`"w"` explícitos en vez de col (p. ej. para `legend`).

## Pantallas móviles (PWA 390×844)
Solo estas llevan `"device":"mobile"`: **5.2 Activos**, **5.1 Mis órdenes**,
**5.4 Registro de intervención**, **5.5 Ingreso CNR manual** (perfil Técnico).
En móvil los bloques se apilan automáticamente (1 columna, ancho fijo). NO uses
`col`; solo da `type`, `h`, `label`, `meta`, `reqs` y campos propios del tipo, en
orden de arriba→abajo. Usa 4–7 bloques; suma de alturas ≲ 650. Añade
`"navActive": <0-4>` a la pantalla para resaltar el ítem de la barra inferior.

## Catálogo de tipos de bloque
Todo bloque acepta: `label` (título), `meta` (subtítulo pequeño, opcional),
`reqs` (lista de requerimientos, se dibuja como `[DAT-03, …]` abajo-derecha).
Campos propios por tipo:
- `kpi` — tarjeta métrica. `value` (str), `delta` (str), `spark` (bool).
- `map` — mapa con marcadores. `markers`: lista de `[fx,fy,estado]` con fx,fy en 0..1 y estado en {"ok","warn","crit","null"}.
- `planta` — plano de planta (grilla de celdas coloreadas automática).
- `tree` — árbol. `rows`: lista de `[indent(0/1/2), "texto", estado|false|null]`. `caret`:"▾".
- `bars` / `stackedbars` / `histogram` / `waterfall` — gráficos de barras. `hl`:índice a resaltar (solo bars). `projline`:1 marca proyección.
- `line` / `area` — series. `threshold`: 0..1 dibuja línea de umbral.
- `table` — tabla. `cols`:[…], `nrows`:int, `statuscol`:bool (1ª col con punto de estado), `expand`:bool (marca fila expandible).
- `feed` — lista de eventos. `items`: `[["URGENT","texto","crit"], …]`.
- `gauge` — gauges circulares. `n`:int, `labels`:[…].
- `form` — formulario. `fields`:["Etiqueta de campo", …] (cada uno dibuja label+input).
- `heatmap` — matriz. `cols`:int, `rowsn`:int.
- `timeline` — línea de tiempo vertical. `items`:["texto", …].
- `actions` — fila de botones (el 1º es CTA de acento). `btns`:["Guardar","Cancelar"]. (frameless)
- `tabs` — pestañas. `tabs`:["A","B"], `active`:idx. (frameless)
- `legend` — leyenda de semáforo (fija). (frameless; usa x/y/w)
- `panel` (por defecto) — bloque rotulado con viñetas. `subs`:["línea 1","línea 2"].
Nota: los tipos frameless (`tabs`,`actions`,`legend`) NO dibujan label/meta/reqs.

## Menús (activeMenu debe coincidir EXACTO)
- operacional: "Monitoreo en vivo","Alarmas y eventos","Tickets y SLA","Calidad y backfill","CNR pendientes","Mapa de cobertura"
- tecnico: "Mis órdenes","Activos (medidores)","Diagnóstico comms","Registro de intervención","Ingreso CNR manual","Maestro de medidores","Reglas de transformación"
- auditor: "Calidad de datos","Cuadratura de agregación","Pista de auditoría","Trazabilidad / lineage","Datos crudos (raw)","Exportar evidencia"
- super-admin: "Tenants y malls","Config y releases","Usuarios y roles","Observabilidad","Integraciones","Seguridad y PAM","Réplica y datos","SLOs de datos","Throttle y cargas","Retención y privacidad"

## Buenas prácticas de diagramación (obligatorias)
- Jerarquía visual: lo más importante/urgente arriba-izquierda o en el bloque de
  mayor peso. Un único punto de entrada claro por pantalla.
- Agrupación por afinidad: KPIs juntos (fila de tarjetas), gráficos/tablas como
  bloque principal, filtros SIEMPRE en la barra superior (via `filters`, no como bloque).
- Alineación a la grilla y espaciado uniforme (deja ~12–16 px de aire entre bloques
  dejando huecos en `y`).

## Justificación UX (bloque `detail.ux`) — la parte más importante
Para cada componente o agrupación relevante, explica DESDE UX (no negocio) por qué
se ubicó/diseñó así, ADAPTADO al perfil. Cita un principio de usabilidad breve y
aplicado (no teoría). 4–6 ítems por pantalla. NUNCA repitas la misma frase entre
pantallas. Tonos por perfil:
- Operacional: uso diario intensivo por turno, priorización por severidad/antigüedad,
  acción rápida sobre alarmas/tickets, densidad alta pero escaneable, feedback de estado.
- Técnico: uso en terreno con una mano y baja señal (móvil), inmutabilidad y firma,
  formularios cortos, confirmaciones antes de acciones irreversibles, offline-tolerante.
- Auditor: verificación exhaustiva, trazabilidad, comparación lado a lado, exportación
  firmada, inmutabilidad visible, nada editable, confianza en la evidencia.
- Súper-admin: máximo privilegio y prevención de error crítico, gates de aprobación,
  confirmaciones destructivas, visibilidad de estado del sistema, todo auditado.

## Entregable
Escribe SOLO el archivo JSON en la ruta que se te indique. Valida mentalmente que
sea JSON parseable. No ejecutes el renderer.
