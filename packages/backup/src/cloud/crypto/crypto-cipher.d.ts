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

// Augments the `crypto` module with the random-bytes primitive that
// react-native-quick-crypto exposes when the app aliases `crypto` to it on
// React Native. Typed as Uint8Array so this package needs no @types/node.
// The AES-GCM and Argon2id primitives live in `@perawallet/wallet-core-kms`.
declare module 'crypto' {
    export function randomBytes(size: number): Uint8Array
}
