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
 * The deterministic-P256 passkey main key's identity, in one place because two
 * writers mint it: `usePasskeyMainKey` (`@perawallet/wallet-core-kms`) for a
 * new wallet, and `repairs/0003-mint-passkey-main-key` for an existing one. If
 * they disagreed, the back-fill would mint a second root beside the app's and
 * the native providers would pick whichever their scan reached first.
 *
 * Deliberately import-free so `@perawallet/wallet-core-kms` can consume it
 * through this package's barrel without the migration modules (and their MMKV
 * imports) coming along.
 */

/** `metadata.scheme` distinguishing this root from the XHD BIP32-Ed25519 one. */
export const PASSKEY_MAIN_KEY_SCHEME = 'pbkdf2-p256'

export const passkeyMainKeyId = (seedKeyId: string): string =>
    `${seedKeyId}-passkey-main`
