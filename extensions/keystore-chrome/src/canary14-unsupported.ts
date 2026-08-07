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

// Metro aliases `@algorandfoundation/react-native-keystore` to this package for
// `platform === 'web'` (see apps/mobile/metro.config.js), on the premise that
// the two share an export surface. Since the mobile app moved to
// react-native-keystore canary.14 that premise no longer holds: this package is
// a port of canary.12 and has no engine factory or WebCrypto seal helpers.
//
// These throwing stubs exist so the web bundle fails at the exact call with a
// message naming the cause, instead of dying on an opaque
// "createReactNativeKeyStore is not a function" three frames deeper. They are
// deliberately NOT an implementation: the real fix is replacing this vendored
// port with @algorandfoundation/keystore-web, which is tracked separately.
//
// Delete this file wholesale when that port lands.
const unsupported = (symbol: string) => (): never => {
    throw new Error(
        `${symbol} is unavailable on web: extensions/keystore-chrome is a port of ` +
            `react-native-keystore canary.12 and does not implement the canary.14 ` +
            `surface the app now uses. Replace this port with ` +
            `@algorandfoundation/keystore-web. See the Metro alias in ` +
            `apps/mobile/metro.config.js.`,
    )
}

export const createReactNativeKeyStore = unsupported(
    'createReactNativeKeyStore',
)
export const sealData = unsupported('sealData')
export const openData = unsupported('openData')
