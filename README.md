# Iceberg

Finanzas personales para Chile. **Local-first**: tus datos viven en tu teléfono y no salen
de ahí salvo que tú los exportes.

Sobre la línea de agua va el gasto **comprometido** —arriendo, cuentas, cuotas: lo que llega
igual—; debajo, el **variable**, que es sobre lo único que puedes decidir. La línea no está
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
- Sincroniza con otro teléfono por una carpeta compartida --de Drive, de Dropbox, la que
  sea--, con cifrado opcional. Sin servidor ni cuenta: cada aparato escribe su propio
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

## Publicar

Una versión nueva es una etiqueta; el resto lo hace GitHub Actions:

```bash
git tag v0.2.0 && git push --tags
```

La APK va firmada con la llave de depuración de Expo: sirve para instalar y compartir, no
para la Play Store.

Para la versión web, `npm run exportar:web` deja el sitio en `dist/`. **GitHub Pages no
sirve**: SQLite en el navegador necesita `SharedArrayBuffer`, que exige las cabeceras
`Cross-Origin-Opener-Policy` y `Cross-Origin-Embedder-Policy`, y Pages no deja ponerlas.
Cloudflare Pages y Netlify leen el `_headers` incluido; Vercel usa el `vercel.json`.

## Privacidad

Las cartolas reales llevan nombre, RUT y número de cuenta: viven en `datos-privados/`,
ignorado por partida doble. Lo único versionado es una cartola **sintética**.

## Licencia

[MIT](LICENSE).
