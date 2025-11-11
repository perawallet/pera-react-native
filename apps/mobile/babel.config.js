/*
 Copyright 2022-2025 Pera Wallet, LDA
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
  const presets = ['module:@react-native/babel-preset']
  const plugins = [
    [
      'module-resolver',
      {
        root: ["./src"],
        alias: {
          'crypto': 'react-native-quick-crypto',
          'stream': 'readable-stream',
          'buffer': '@craftzdog/react-native-buffer',
          'base64-js': 'react-native-quick-base64',
          "@components/*": "./src/components",
          "@providers/*": "./src/providers",
          "@routes/*": "./src/routes",
          "@screens/*": "./src/screens",
          "@assets/*": "./src/../assets",
        },
      },
    ],
    '@babel/plugin-transform-export-namespace-from',
    'react-native-worklets/plugin',
  ]

  return {
    presets,
    plugins
  }
};
