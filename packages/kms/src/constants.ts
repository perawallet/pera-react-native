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
 * Wallet-domain scheme stamped into a seed's `metadata.scheme` at commit
 * time. The keystore stores every wallet root as `type: 'seed'`; the scheme
 * distinguishes a BIP39/XHD HD wallet from a flat Algo25 keypair so the
 * scheme drives the dispatch in `signTransactionsWithKey` (HD vs Algo25).
 */
export const SeedScheme = {
    Bip39: 'bip39',
    Algo25: 'algo25',
    /**
     * Post-quantum wallet root. Deliberately NOT named after the signature
     * algorithm: the concrete algorithm (currently Falcon-1024) is recorded
     * on the signing child entry's `type` (`'falcon1024'`), so a future
     * signature-scheme swap needs no seed-metadata migration.
     */
    Quantum: 'quantum',
} as const

export type SeedScheme = (typeof SeedScheme)[keyof typeof SeedScheme]

/**
 * Byte length of an Algo25 seed (the secret half of an Ed25519 keypair).
 * Some legacy producers (ASB, older Pera Web) emit the full 64-byte
 * tweetnacl secret key (seed || pubKey); modern producers emit the 32-byte
 * seed alone. The leading 32 bytes are always the seed in either case.
 */
export const ALGO25_SEED_LENGTH = 32

/**
 * Byte length of a quantum seed. Deliberately identical to
 * ALGO25_SEED_LENGTH: the quantum mnemonic format IS algo25 (24 data words +
 * 1 SHA-512/256 checksum word over 32 bytes of entropy), so quantum seeds
 * reuse the existing algo25 mnemonic↔seed utilities unchanged.
 */
export const QUANTUM_SEED_LENGTH = 32

/**
 * The origins that legitimately request private-key access from a seed via
 * `checkAccess`: the signing pipeline and the mnemonic backup flow. The
 * fail-closed seed-ACL default (`DEFAULT_SEED_ACL` in utils) and these
 * consumers must agree on the exact strings, so kms — the lowest common
 * dependency of signing and the backup flow — owns them as the single source
 * of truth instead of each side repeating a literal that could drift.
 */
export const SIGNING_ACCESS_DOMAIN = 'pera.accounts'
export const BACKUP_ACCESS_DOMAIN = 'backup-flow'
