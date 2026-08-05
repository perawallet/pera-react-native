/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

module.exports = function (api) {
  api.cache(true);
  // Use Expo's babel preset which wraps @react-native/babel-preset
  // with additional Expo-specific transformations
  const presets = ['babel-preset-expo']
  const plugins = [
    [
      'module-resolver',
      {
        root: ["./src"],
        // Node-core polyfills (crypto/stream/buffer/base64-js) are NOT aliased
        // here — metro.config.js `polyfillMap` maps them to the mobile app's
        // node_modules instead. Aliasing them at the Babel layer resolves
        // relative to the importing file, which fails for workspace packages
        // (packages/security, packages/kms, …) that have no copy of the
        // polyfill, producing 'Could not resolve "react-native-quick-crypto"'
        // warnings on every cache miss.
        alias: {
          "@components": "./src/components",
          "@providers": "./src/providers",
          "@layouts": "./src/layouts",
          "@routes": "./src/routes",
          "@hooks": "./src/hooks",
          "@i18n": "./src/i18n",
          "@analytics": "./src/analytics",
          "@constants": "./src/constants",
          "@modules": "./src/modules",
          "@assets": "./assets",
          "@theme": "./src/theme",
          "@utils": "./src/utils",
        },
      },
    ],
    '@babel/plugin-transform-export-namespace-from',
    'react-native-worklets/plugin',
  ]

  return {
    presets,
    plugins,
  }
};
