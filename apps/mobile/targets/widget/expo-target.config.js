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
  // Must differ from the PeraWidgets native-module pod: both emit a Swift module
  // named after themselves into the same products folder, and the app would
  // import the iOS 17 extension's module instead of the pod.
  name: 'PeraWidgetExtension',
  bundleIdentifier: '.widget',
  deploymentTarget: '17.0',
  // Hand-copied from src/theme/tokens/{light,dark}.ts; keep the token names.
  colors: {
    background: { light: '#FFFFFF', dark: '#18181B' },
    layerGrayLighter: { light: '#F1F1F2', dark: '#27272A' },
    textMain: { light: '#18181B', dark: '#F1F1F2' },
    textGray: { light: '#71717A', dark: '#A1A1AA' },
    positive: { light: '#1F8E9D', dark: '#2CB7BC' },
    negative: { light: '#DB4645', dark: '#FF6D5F' },
    testnetBg: '#EDB21C',
    testnetText: '#18181B',
  },
  images: {
    // Small on purpose: WidgetKit renders the whole widget blank when an image
    // exceeds its pixel budget, and the 1024 px app icon does.
    peraLogo: '../../assets/images/widget-logo.png',
    // An SF Symbols template, so it becomes a symbolset the Scan control can tint.
    peraScan: '../symbols/pera-scan.svg',
  },
  // Pera's App Group is added by the passkey-autofill plugin's mod, not
  // ios.entitlements, so apple-targets cannot mirror it on its own.
  entitlements: {
    'com.apple.security.application-groups': [
      `group.${config.ios.bundleIdentifier}`,
    ],
  },
})
