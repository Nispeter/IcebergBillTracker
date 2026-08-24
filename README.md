# Iceberg

Finanzas personales para Chile. **Local-first**: tus datos viven en tu teléfono y no salen
de ahí salvo que tú los exportes.

Sobre la línea de agua va el gasto **comprometido**: arriendo, cuentas, cuotas, lo que llega
igual. Debajo va el **variable**, que es sobre lo único que puedes decidir. La línea no está
puesta a ojo: se calcula para que el *área* sobre ella sea la proporción exacta.

## Instalar en Android

[**Descargar la APK**](https://github.com/Nispeter/IcebergBillTracker/releases/latest/download/iceberg.apk)
· ~112 MB

Android pedirá permiso para "instalar apps de origen desconocido": es porque no viene de la
Play Store.

## Qué hace

- Importa la cartola del banco (`.xls` de Banco de Chile; mapeo manual para otros).
  Reimportar el mismo archivo no duplica nada.
- Categoriza sola por comercio, con reglas propias que puedes agregar.
- Doce categorías de fábrica más las que agregues tú, y decides cuáles cuentan como
  gasto comprometido.
- Detecta cuentas periódicas en tu historial y propone crearlas.
- Marca lo que se sale de lo habitual con mediana y MAD, no con promedios.
- Sincroniza con otro teléfono por una carpeta compartida de Drive, de Dropbox o la que
  sea, con cifrado opcional. Sin servidor ni cuenta: cada aparato escribe su propio
  archivo y lee los de los demás.
- Cuentas separadas: un libro compartido y otro personal, y decides cuál viaja.

## Desarrollo

Requiere **Node 22+** (`better-sqlite3` lo exige; con Node 20 revienta con un segfault).

```bash
npm install
npm run movil       # Expo Go: escanea el QR
npm run web         # en el navegador
npm test            # 658 pruebas
npm run typecheck
```

## Estructura

Monorepo de npm workspaces. La lógica no sabe de React.

| Paquete | Qué vive ahí |
|---|---|
| `core` | Dinero, fechas, análisis, recurrencia, cartola, fusión, cifrado. |
| `db` | Esquema y repositorios sobre Drizzle + SQLite. |
| `ui` | Tokens de diseño y geometría. Único lugar con colores hexadecimales. |
| `apps/mobile` | Expo + React Native. Android y web del mismo código. |
| `tools/seed` | Generador de datos de prueba. |

Cuatro decisiones que conviene saber antes de tocar el código:

- **El dinero son enteros.** El peso no tiene decimales y un `0.1 + 0.2` en un saldo es
  inaceptable.
- **Fechas `YYYY-MM-DD` con aritmética en UTC**, para esquivar el horario de verano.
- **Nada se borra de verdad**: cada fila lleva lápida, que es lo que hace que un borrado
  viaje al sincronizar.
- **El orden lo da un HLC**: el orden lexicográfico de `updatedAt` es el orden causal, y por
  eso la fusión converge.

## Publicar una versión

Una versión nueva es **una etiqueta**; compilar y publicar lo hace GitHub Actions
(`.github/workflows/apk.yml`). Todo el procedimiento está en un script:

```bash
node tools/publicar.mjs 0.4.1 "Arregla el selector de carpeta en Android"
```

Eso sube el número de versión, corre tipos y pruebas, confirma, etiqueta y empuja. Antes
de tocar nada comprueba que estés en `main`, que no haya cambios sin confirmar y que la
etiqueta no exista, así que si algo está mal se corta sin dejar el repositorio a medio
publicar.

Después tarda unos 25 minutos, casi todos en Gradle. Para seguirla:

```bash
gh run watch          # o la pestaña Actions en GitHub
```

### Qué hace por dentro

Vale la pena saberlo por si alguna vez hay que hacerlo a mano:

**Sube los dos números** de `apps/mobile/app.json`, no uno:

```jsonc
"version": "0.4.1",        // el texto que se muestra
"android": {
  "versionCode": 5,        // +1 siempre, es lo que Android compara
}
```

`versionCode` es el único que Android mira para decidir si una APK es actualización de la
anterior: si no sube, el teléfono puede negarse a instalarla encima. Es el paso que se
olvida, y por eso existe el script.

**Corre `npm run typecheck && npm test` antes de empujar.** El workflow los corre igual y
aborta si fallan, pero acá tarda segundos en vez de diez minutos.

**Etiqueta con `v` adelante**, que es lo que dispara el workflow:

```bash
git push origin main
git tag -a v0.4.1 -m "Lo que trae esta versión"
git push origin v0.4.1
```

Al terminar, la APK queda en un enlace que **no cambia entre versiones**:

```
https://github.com/Nispeter/IcebergBillTracker/releases/latest/download/iceberg.apk
```

### Cosas que conviene saber

**Compilar sin publicar**: en la pestaña Actions, `APK` → `Run workflow`. Deja la APK como
artefacto de la corrida, sin crear un release. Sirve para probar que compila sin quemar un
número de versión.

**Te equivocaste de etiqueta**: bórrala de los dos lados y vuelve a etiquetar.

```bash
git tag -d v0.4.0
git push origin :refs/tags/v0.4.0
```

**No hace falta ningún secreto.** La APK va firmada con la llave de depuración de Expo, que
es pública: sirve para instalar y compartir, no para la Play Store. Publicar de verdad
pide generar una llave propia y guardarla en los secretos del repositorio.

Para la versión web, `npm run exportar:web` deja el sitio en `dist/`. **GitHub Pages no
sirve**: SQLite en el navegador necesita `SharedArrayBuffer`, que exige las cabeceras
`Cross-Origin-Opener-Policy` y `Cross-Origin-Embedder-Policy`, y Pages no deja ponerlas.
Cloudflare Pages y Netlify leen el `_headers` incluido; Vercel usa el `vercel.json`.

## Privacidad

Las cartolas reales llevan nombre, RUT y número de cuenta: viven en `datos-privados/`,
ignorado por partida doble. Lo único versionado es una cartola **sintética**.

## Licencia

[MIT](LICENSE).
