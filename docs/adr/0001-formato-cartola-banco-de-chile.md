# ADR 0001 — Formato de cartola Banco de Chile y clave de deduplicacion

- **Estado**: aceptado
- **Fecha**: 2026-08-18
- **Fases afectadas**: F4 (import XLS/CSV)

## Contexto

El importador de F4 tiene como caso principal la cartola de Banco de Chile. Antes de
disenar el parser se inspeccionaron las **7 cartolas reales** disponibles en
`datos-privados/cartolas/` (ene-jul 2026, 280 movimientos) para no asumir nada sobre
columnas, fechas ni montos.

Los archivos son **OLE2/BIFF8 binario** (magic `D0 CF 11 E0 A1 B1 1A E1`, Excel
97-2003), no CSV ni HTML disfrazado como exportan otros bancos. Se leen con SheetJS
(`xlsx`).

## Estructura verificada

Identica en los 7 archivos:

- Tres hojas: `Hoja1`, `Hoja2`, `Hoja3`. **Solo `Hoja1` tiene datos**; las otras dos
  vienen vacias (sin `!ref`).
- El rango util arranca en la columna **B**, no en la A (`!ref` = `B4:N…`). Al usar
  `sheet_to_json({header:1})` el indice 0 del arreglo corresponde a la columna B.
- Las columnas N-M-…-H estan dentro del `!ref` pero siempre vacias.

### Bloque de metadatos (columnas B y C)

| Fila | Etiqueta (col. B) | Valor (col. C) |
|---|---|---|
| 8 | `Sr(a): ` | nombre del titular |
| 9 | `Rut:` | RUT con puntos y guion |
| 10 | `Cuenta:` | `00-225-72192-09` |
| 11 | `Moneda:` | `Pesos Chilenos (CLP)` |
| 14 | `Detalle Cartola Historica` | etiqueta `Fecha de Emision` en **D14**, valor en **E14** |
| 16-17 | `Folio Cartola` / `Saldo Contable` / `Retenciones 24 Hrs.` / `Retenciones 48 Hrs.` | numericos |
| 20-21 | `Saldo Inicial` / `Saldo Disponible` / `Linea de Credito` | numericos |

`Fecha de Emision` viene como texto **con un espacio inicial**: `" 30/01/2026"`. Hay
que hacer `trim()`.

### Tabla de movimientos

Encabezado en la **fila 25** (indice 24), constante en los 7 archivos:

| Col. | Encabezado | Tipo | Notas |
|---|---|---|---|
| B | `Fecha` | texto | `DD/MM`, **sin ano** |
| C | `Descripcion` | texto | max. 34 caracteres, truncada por el banco |
| D | `Canal o Sucursal` | texto | `OF. CONCEPCION`, `INTERNET`, `CENTRAL`, `OF. PANAMERICAN` |
| E | `Cargos (PESOS)` | numero | egreso, **siempre positivo** |
| F | `Abonos (PESOS)` | numero | ingreso, **siempre positivo** |
| G | `Saldo (PESOS)` | numero | saldo corrido, **disperso** |

Los datos empiezan en la fila 26 y terminan donde se acaban las filas con fecha y
descripcion. Despues hay filas vacias y, cerca del final, un pie legal en la columna B
(`Informate sobre la garantia estatal…`) que **no** es un movimiento.

## Hallazgos que condicionan el parser

### 1. La fecha no trae ano

`DD/MM`. El ano se deriva de `Fecha de Emision`:

```
ano = anoEmision - (mesFila > mesEmision ? 1 : 0)
```

El caso real esta en `cartola_30012026.xls`: la fila `SALDO INICIAL` es `30/12`, o sea
diciembre de **2025**, en una cartola emitida el `30/01/2026`. Se verifico ademas que
las filas vienen en **orden cronologico estricto** en los 7 archivos, lo que sirve como
comprobacion secundaria del rollover.

### 2. Montos: enteros nativos, signo por columna

Las 280 filas tienen celdas numericas (`t: 'n'`) con **valores enteros**: cero decimales,
cero montos como texto, cero separadores de miles que parsear. Coincide con CLP
exponente 0, asi que el valor entra directo a `amount_minor` sin conversion.

Rango observado: 1 a 1.806.324 CLP.

El signo **no** esta en el numero sino en la columna: `Cargos` es egreso, `Abonos` es
ingreso. Se verifico que **ninguna fila** tiene las dos columnas llenas ni las dos
vacias, asi que la regla es total.

### 3. Filas centinela que no son movimientos

La primera fila de datos es siempre `SALDO INICIAL` y la ultima `SALDO FINAL`. Ambas
llevan fecha y saldo pero **ni cargo ni abono**. Hay que descartarlas por descripcion,
no por posicion.

La fecha de `SALDO INICIAL` corresponde al cierre de la cartola anterior.

### 4. La columna Saldo es dispersa

Solo 88 de 280 movimientos traen saldo: el banco lo escribe unicamente en el **ultimo
movimiento de cada dia**. No sirve como campo por transaccion; sirve para **validar** el
lote (saldo inicial + suma de abonos - suma de cargos debe cuadrar con el saldo final).

### 5. Las cartolas no se solapan

Se comparo cada par consecutivo: **0 movimientos repetidos** entre archivos. Los cortes
son limpios y el `SALDO INICIAL` es solo arrastre de saldo, no una transaccion repetida.

## Decision

El plan original de F4 deduplicaba por `hash(fecha + monto + descripcion)`. **Eso esta
mal** y se cambia.

Existe un contraejemplo real en `cartola_30042026.xls`, filas 45 y 46:

```
13/04 | PAGO:MERCADOPAGO*CONCE | 3600
13/04 | PAGO:MERCADOPAGO*CONCE | 3600
```

Son dos compras legitimas distintas, el mismo dia, en el mismo comercio, por el mismo
monto. Con la clave original la segunda se descartaria silenciosamente como duplicado y
la base quedaria descuadrada contra el saldo del banco.

**La clave de dedupe incluye un ordinal de ocurrencia**: dentro de un mismo
`(fecha, descripcion, monto, canal)` se numeran las repeticiones 0, 1, 2… en el orden en
que aparecen en el archivo.

```
dedupeKey = hash(cuenta, fecha, descripcion, monto, canal, ordinal)
```

Esto mantiene idempotente reimportar la misma cartola (mismo archivo produce los mismos
ordinales, porque el orden de filas es estable) y a la vez conserva los duplicados
genuinos. El criterio de verificacion de F4 sigue siendo valido: importar dos veces no
duplica nada.

## Consecuencias

- El parser necesita `Fecha de Emision` para poder fechar cualquier fila: no es un campo
  opcional del mapeo de columnas.
- La validacion de cuadratura por saldo entra como chequeo del lote de importacion y
  puede mostrarse en la vista previa.
- El mapeo de columnas de la UI puede traer Banco de Chile como preset detectado por el
  encabezado de la fila 25, con el mapeo manual como respaldo para otros bancos.
- Se derivaran fixtures **anonimizados** de estas cartolas a
  `packages/core/src/csv/__fixtures__/`, conservando los casos borde: el rollover de ano,
  el duplicado legitimo, el saldo disperso y las filas centinela.
