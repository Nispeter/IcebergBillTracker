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

module.exports = config;
