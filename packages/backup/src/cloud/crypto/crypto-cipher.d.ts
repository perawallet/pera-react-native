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

// Augments the `crypto` module with AES-GCM cipher primitives that
// react-native-quick-crypto exposes when the app aliases `crypto` to it on
// React Native. These types use Uint8Array so that the backup package can
// avoid a @types/node dependency. Any other frontend must alias `crypto` to an
// implementation providing these same functions.
declare module 'crypto' {
    interface GcmCipher {
        setAAD(buffer: Uint8Array): this
        update(data: Uint8Array): Uint8Array
        final(): Uint8Array
        getAuthTag(): Uint8Array
    }

    interface GcmDecipher {
        setAAD(buffer: Uint8Array): this
        setAuthTag(tag: Uint8Array): this
        update(data: Uint8Array): Uint8Array
        final(): Uint8Array
    }

    export function randomBytes(size: number): Uint8Array

    export function createCipheriv(
        algorithm: 'aes-256-gcm',
        key: Uint8Array,
        iv: Uint8Array,
    ): GcmCipher

    export function createDecipheriv(
        algorithm: 'aes-256-gcm',
        key: Uint8Array,
        iv: Uint8Array,
    ): GcmDecipher
}
