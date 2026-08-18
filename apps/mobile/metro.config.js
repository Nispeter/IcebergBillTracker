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

module.exports = config;
