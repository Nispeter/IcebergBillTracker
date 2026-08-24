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
(`.github/workflows/apk.yml`). Son cuatro pasos.

**1. Sube el número de versión** en `apps/mobile/app.json`:

```jsonc
"version": "0.4.0",        // lo que ve el usuario
"android": {
  "versionCode": 4,        // +1 siempre, es lo que Android compara
}
```

Los dos, no uno. `versionCode` es el único que Android mira para decidir si una APK es
una actualización de la anterior: si no sube, el teléfono puede negarse a instalarla
encima. `version` es solo el texto que se muestra.

**2. Comprueba antes de esperar diez minutos.** El workflow corre esto igual y aborta si
falla, pero acá tarda segundos:

```bash
npm run typecheck && npm test
```

**3. Sube el commit y la etiqueta.** La etiqueta tiene que empezar con `v`: es lo que
dispara el workflow.

```bash
git add apps/mobile/app.json && git commit -m "🔖 v0.4.0"
git push origin main
git tag -a v0.4.0 -m "Lo que trae esta versión"
git push origin v0.4.0
```

**4. Mira cómo va.** Tarda unos 25 minutos, casi todos en Gradle:

```bash
gh run watch          # o la pestaña Actions en GitHub
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
