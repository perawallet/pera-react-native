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

// Augments the `crypto` module with the Argon2id primitive that
// react-native-quick-crypto exposes when the app aliases `crypto` to it on
// React Native. `@types/node` omits `argon2`, so the base package declares the
// shape it depends on here. Any other frontend must alias `crypto` to an
// implementation providing this same function.
declare module 'crypto' {
    interface QuickCryptoArgon2Params {
        message: Uint8Array
        nonce: Uint8Array
        parallelism: number
        tagLength: number
        memory: number
        passes: number
        version?: number
    }

    export function argon2(
        algorithm: 'argon2id' | 'argon2i' | 'argon2d',
        params: QuickCryptoArgon2Params,
        callback: (error: Error | null, result: Uint8Array) => void,
    ): void
}
