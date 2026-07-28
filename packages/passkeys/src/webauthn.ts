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

/**
 * Narrow, React-Native-free surface for implementing the `KeystoreSigner`
 * port (see `authenticator.ts`) against a concrete keystore backend, e.g.
 * `@perawallet/wallet-extension-keystore-chrome`'s adapter.
 *
 * Deliberately does NOT re-export `./bootstrap` or `./hooks` (what the
 * package root `.` entry point exports): those pull in
 * `@perawallet/wallet-extension-provider`, which pulls in
 * `@algorandfoundation/react-native-keystore` -> `react-native-mmkv` -- none
 * of which resolve outside a React Native runtime. A browser-extension
 * consumer that only needs the pure crypto/wire port must not be forced to
 * satisfy that whole native module graph just to import one type and a
 * handful of pure functions.
 */
export * from './authenticator/authenticator'
export * from './authenticator/wire'
export {
    splitP256PublicKey,
    type P256PublicKeyXY,
} from './authenticator/webauthn-structures'
export { isPasskeyKey, PASSKEY_KEY_TYPES } from './models/passkey'
