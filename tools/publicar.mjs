/**
 * Publica una version: sube el numero, etiqueta y deja compilando la APK.
 *
 *     node tools/publicar.mjs 0.4.1 "Lo que trae esta version"
 *
 * Existe porque el procedimiento tiene un paso que muerde y no avisa: hay que
 * subir **`versionCode`**, no solo `version`. Son campos distintos de
 * `app.json`, y `versionCode` es el unico que Android compara para decidir si
 * una APK es actualizacion de la anterior. Las v0.1.0 y v0.2.0 salieron las dos
 * con el mismo numero por olvidarlo.
 *
 * ## El orden importa
 *
 * Todo lo que puede fallar va **antes** de lo que deja rastro. Primero las
 * comprobaciones y las pruebas, que no tocan nada; recien despues el commit, el
 * push y la etiqueta. Asi un error deja el repositorio como estaba en vez de a
 * medio publicar.
 *
 * No espera a que la APK termine: son unos 25 minutos y bloquear la terminal
 * todo ese rato no le sirve a nadie. Al final imprime como seguirla.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP_JSON = join(RAIZ, 'apps/mobile/app.json');

/** Corre un comando y devuelve su salida. Si falla, se corta el script. */
function correr(programa, argumentos, opciones = {}) {
  return execFileSync(programa, argumentos, {
    cwd: RAIZ,
    encoding: 'utf8',
    stdio: opciones.mostrar ? 'inherit' : 'pipe',
    shell: opciones.shell ?? false,
  });
}

function morir(mensaje) {
  console.error('\n  ✗ ' + mensaje + '\n');
  process.exit(1);
}

function paso(texto) {
  console.log('\n  ▸ ' + texto);
}

// ───────────────────────── lo que nos pasaron ─────────────────────────

const [versionCruda, descripcion] = process.argv.slice(2);

if (!versionCruda || !descripcion) {
  console.error(`
  Uso: node tools/publicar.mjs <version> "<descripcion>"

    node tools/publicar.mjs 0.4.1 "Arregla el selector de carpeta en Android"

  La descripcion queda en la etiqueta. GitHub lista los commits aparte.
`);
  process.exit(1);
}

// Se acepta con o sin la v: la etiqueta siempre la lleva.
const version = versionCruda.replace(/^v/, '');
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  morir(`"${versionCruda}" no es una version. Se espera algo como 0.4.1.`);
}
const etiqueta = 'v' + version;

// ───────────────────── comprobar antes de tocar nada ─────────────────────

paso('Revisando el repositorio');

const rama = correr('git', ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
if (rama !== 'main') {
  morir(`Estas en "${rama}". Las versiones salen de main.`);
}

// `--porcelain` lista lo modificado; lo sin seguir no cuenta, porque el
// repositorio tiene archivos propios del usuario que nunca se versionan.
const sucio = correr('git', ['status', '--porcelain', '--untracked-files=no']).trim();
if (sucio !== '') {
  morir('Hay cambios sin confirmar:\n\n' + sucio + '\n\n    Confirmalos o guardalos antes de publicar.');
}

const etiquetas = correr('git', ['tag']).split('\n').map((t) => t.trim());
if (etiquetas.includes(etiqueta)) {
  morir(
    `La etiqueta ${etiqueta} ya existe. Si quieres rehacerla:\n\n`
    + `    git tag -d ${etiqueta}\n`
    + `    git push origin :refs/tags/${etiqueta}`,
  );
}

paso('Revisando tipos y pruebas');
// Lo mismo que corre el workflow. Aca tarda segundos; alla, diez minutos antes
// de abortar.
correr('npm', ['run', 'typecheck'], { mostrar: true, shell: true });
correr('npm', ['test'], { mostrar: true, shell: true });

// ─────────────────────── subir el numero de version ───────────────────────

paso('Subiendo el numero de version');

const antes = readFileSync(APP_JSON, 'utf8');

const codigoActual = antes.match(/"versionCode":\s*(\d+)/);
if (codigoActual === null) morir('No encontre "versionCode" en app.json.');
const codigoNuevo = Number(codigoActual[1]) + 1;

// Se reemplaza con expresiones y no con `JSON.parse` a proposito: parsear y
// volver a escribir reformatea el archivo entero y el diff deja de leerse.
const despues = antes
  .replace(/"version":\s*"[^"]*"/, `"version": "${version}"`)
  .replace(/"versionCode":\s*\d+/, `"versionCode": ${codigoNuevo}`);

if (despues === antes) morir('No cambio nada en app.json. Revisa el archivo.');
writeFileSync(APP_JSON, despues);
console.log(`    version ${version}, versionCode ${codigoNuevo}`);

// ──────────────────────────── publicar ────────────────────────────

paso('Confirmando y subiendo');
correr('git', ['add', 'apps/mobile/app.json']);
correr('git', ['commit', '-m', '🔖 ' + etiqueta]);
correr('git', ['push', 'origin', 'main'], { mostrar: true });

paso('Etiquetando ' + etiqueta);
correr('git', ['tag', '-a', etiqueta, '-m', descripcion]);
correr('git', ['push', 'origin', etiqueta], { mostrar: true });

// ──────────────────────────── donde mirar ────────────────────────────

const remoto = correr('git', ['remote', 'get-url', 'origin']).trim();
const repo = (remoto.match(/github\.com[:/](.+?)(?:\.git)?$/) ?? [])[1] ?? '';

console.log(`
  ✓ ${etiqueta} en camino. La APK tarda unos 25 minutos.

    Para seguirla:      gh run watch
    O en el navegador:  https://github.com/${repo}/actions

    Cuando termine queda en un enlace que no cambia entre versiones:
    https://github.com/${repo}/releases/latest/download/iceberg.apk
`);
