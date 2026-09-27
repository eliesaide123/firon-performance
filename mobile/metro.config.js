const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * `@firon/shared` lives outside the project root (CONTRACT §11.3), so Metro has to be told
 * to watch it and how to resolve the package name to its `src` folder.
 */
const sharedPath = path.resolve(__dirname, '../shared');

/**
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [sharedPath],
  resolver: {
    extraNodeModules: {
      '@firon/shared': path.resolve(sharedPath, 'src'),
    },
    /**
     * `shared/` has no node_modules of its own, so when Babel's transform injects a helper
     * (`@babel/runtime/helpers/*`) into a shared source file, Metro's default upward walk from
     * `../shared/src` never reaches this project's node_modules and the bundle fails to resolve.
     * Pinning the search path here makes every dependency of a shared file resolve against the
     * app's installed packages — which is also what guarantees one copy of React at runtime.
     */
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
