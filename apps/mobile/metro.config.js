// Metro en monorepo: por defecto solo mira la carpeta de la app, asi que hay que
// decirle que vigile la raiz del workspace y que resuelva los node_modules de
// arriba. Sin esto, `@iceberg/core` y `@iceberg/ui` no se encuentran.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// npm hoista al root; sin esto Metro puede cargar dos copias de react.
config.resolver.disableHierarchicalLookup = true;

// expo-sqlite en web corre wa-sqlite dentro de un Web Worker y ese worker
// importa un .wasm. Metro no trata .wasm como asset por defecto, asi que el
// worker.bundle responde 500 y `openDatabaseAsync` se queda colgado para
// siempre: no resuelve ni lanza, que es lo peor posible para depurar.
config.resolver.assetExts.push('wasm');

// Las migraciones de drizzle-kit son archivos .sql importados desde JS. Van a
// sourceExts (no a assetExts) porque babel-plugin-inline-import las inserta como
// texto en tiempo de compilacion.
config.resolver.sourceExts.push('sql');

/**
 * Aislamiento de origen cruzado para el servidor de desarrollo web.
 *
 * En web, expo-sqlite corre wa-sqlite en un Web Worker y hace el puente
 * sincrono con `SharedArrayBuffer`, que el navegador solo expone si la pagina
 * esta "cross-origin isolated". Sin estas cabeceras, abrir la base falla con
 * `SharedArrayBuffer is not defined`.
 *
 * Se parchea `writeHead` en vez de usar un middleware porque no hay donde
 * engancharse: Expo monta su propio stack **delante** del de Metro, asi que un
 * `enhanceMiddleware` nunca ve la peticion del documento HTML —que es justo la
 * que necesita las cabeceras— y el `server` que Metro pasa a ese hook es su
 * propio Server, no el de node, asi que tampoco sirve `prependListener`.
 *
 * El parche vive solo en el proceso del servidor de desarrollo; no entra al
 * bundle ni corre en el telefono. Es un problema **solo de web**: en Android
 * expo-sqlite usa SQLite nativo. Al publicar la version web habria que poner las
 * mismas cabeceras en el hosting.
 */
const http = require('node:http');

const writeHeadOriginal = http.ServerResponse.prototype.writeHead;
http.ServerResponse.prototype.writeHead = function writeHeadConAislamiento(...args) {
  if (!this.headersSent) {
    this.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    this.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    this.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
  return writeHeadOriginal.apply(this, args);
};

module.exports = config;
