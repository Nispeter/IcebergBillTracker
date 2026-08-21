# Iceberg

Finanzas personales para Chile, **local-first**: tus datos viven en tu teléfono, en una
base SQLite, y no salen de ahí salvo que tú los exportes.

El iceberg es la idea central. Sobre la línea de agua va el gasto **comprometido** —el
arriendo, las cuentas, las cuotas: lo que llega igual—; debajo, el **variable**, que es
sobre lo único que puedes decidir. La línea no está puesta a ojo: se calcula para que el
*área* sobre ella sea exactamente la proporción del gasto comprometido.

## Qué hace

- **Importa tu cartola** del banco (`.xls` de Banco de Chile, y mapeo manual de columnas
  para otros). Reimportar el mismo archivo no duplica nada.
- **Categoriza sola** por comercio, con un catálogo chileno y reglas propias que puedes
  agregar.
- **Detecta cuentas periódicas** en tu historial y te propone crearlas.
- **Marca lo que se sale de lo habitual** con mediana y MAD, no con promedios: un mes con
  un gasto grande no mueve el umbral.
- **Sincroniza entre dispositivos** por archivo, con fusión convergente y cifrado opcional.
- **Cuentas separadas**: puedes tener un libro compartido y otro personal, y decidir por
  cuenta cuál viaja al sincronizar.

## Correr el proyecto

```bash
npm install
npm run movil     # Expo Go: escanea el QR con el teléfono
npm run web       # en el navegador
npm test          # 658 pruebas
npm run typecheck
```

Para el teléfono necesitas [Expo Go](https://expo.dev/go). Ojo: **`npm run movil`, no
`npx expo start` desde la raíz** — desde ahí Expo no encuentra el punto de entrada.

## Cómo está armado

Monorepo de npm workspaces. La regla es que la lógica no sepa de React:

| Paquete | Qué vive ahí |
|---|---|
| `packages/core` | Dinero, fechas, análisis, recurrencia, parser de cartola, fusión, cifrado. Sin dependencias de UI. |
| `packages/db` | Esquema y repositorios sobre Drizzle + SQLite. |
| `packages/ui` | Tokens de diseño y geometría de los gráficos. **El único lugar con colores hexadecimales.** |
| `apps/mobile` | Expo + React Native. Android y web desde el mismo código. |
| `tools/seed` | Generador de datos de prueba verosímiles. |

Decisiones que conviene saber antes de tocar el código:

- **El dinero son enteros.** `money()` rechaza cualquier cosa que no sea entero seguro; el
  peso chileno no tiene decimales y un `0.1 + 0.2` en un saldo es inaceptable.
- **Las fechas son `YYYY-MM-DD` con aritmética en UTC**, para esquivar el horario de verano
  chileno.
- **Nada se borra de verdad.** Cada fila lleva lápida, que es lo que hace que un borrado
  viaje al sincronizar.
- **El orden lo da un HLC** (reloj lógico híbrido): el orden lexicográfico del `updatedAt`
  es el orden causal, y por eso la fusión converge.

## Publicar la versión web

```bash
npm run exportar:web
```

Deja el sitio en `dist/`. **No sirve GitHub Pages**: SQLite en el navegador necesita
`SharedArrayBuffer`, que exige las cabeceras `Cross-Origin-Opener-Policy` y
`Cross-Origin-Embedder-Policy`, y Pages no permite ponerlas. Sin ellas la app carga y muere
al abrir la base.

Sí funcionan Cloudflare Pages y Netlify —leen el `_headers` que va incluido en el export— y
Vercel, con el `vercel.json` de la raíz.

## Privacidad

Las cartolas reales llevan nombre, RUT y número de cuenta. Viven en `datos-privados/`, que
está ignorado por partida doble: el directorio y el patrón del nombre. Lo único versionado
es una cartola **sintética** que reproduce la estructura del banco con datos inventados.
