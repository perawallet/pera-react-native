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

/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: 'widget',
  name: 'PeraWidgets',
  bundleIdentifier: '.widget',
  deploymentTarget: '17.0',
  // Hand-copied from src/theme/tokens/{light,dark}.ts; keep the token names.
  colors: {
    background: { color: '#FFFFFF', darkColor: '#18181B' },
    layerGrayLighter: { color: '#F1F1F2', darkColor: '#27272A' },
    textMain: { color: '#18181B', darkColor: '#F1F1F2' },
    textGray: { color: '#71717A', darkColor: '#A1A1AA' },
    positive: { color: '#1F8E9D', darkColor: '#2CB7BC' },
    negative: { color: '#DB4645', darkColor: '#FF6D5F' },
    testnetBg: '#EDB21C',
    testnetText: '#18181B',
  },
  images: {
    peraLogo: '../../assets/icon-ios.png',
  },
  // Pera's App Group is added by the passkey-autofill plugin's mod, not
  // ios.entitlements, so apple-targets cannot mirror it on its own.
  entitlements: {
    'com.apple.security.application-groups': [
      `group.${config.ios.bundleIdentifier}`,
    ],
  },
})
