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

/**
 * Wallet-domain scheme stamped into a seed's `metadata.scheme` at commit
 * time. The keystore stores every wallet root as `type: 'seed'`; the scheme
 * distinguishes a BIP39/XHD HD wallet from a flat Algo25 keypair so the
 * scheme drives the dispatch in `signTransactionsWithKey` (HD vs Algo25).
 */
export const SeedScheme = {
    Bip39: 'bip39',
    Algo25: 'algo25',
} as const

export type SeedScheme = (typeof SeedScheme)[keyof typeof SeedScheme]

/**
 * Byte length of an Algo25 seed (the secret half of an Ed25519 keypair).
 * Some legacy producers (ASB, older Pera Web) emit the full 64-byte
 * tweetnacl secret key (seed || pubKey); modern producers emit the 32-byte
 * seed alone. The leading 32 bytes are always the seed in either case.
 */
export const ALGO25_SEED_LENGTH = 32
