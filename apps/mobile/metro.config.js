const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;
// expo nests expo-modules-core under node_modules/expo; with hierarchical
// lookup disabled Metro cannot see it unless we map it explicitly.
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  'expo-modules-core': path.resolve(
    workspaceRoot,
    'node_modules/expo/node_modules/expo-modules-core',
  ),
};
config.resolver.blockList = [
  /apps\/api\/.*/,
  /apps\/ui-mockups\/.*/,
  /tmp_.*\.(json|sql)$/,
  /\.batch\d+.*\.sql$/,
];

module.exports = config;
