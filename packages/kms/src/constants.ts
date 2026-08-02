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
 * Stamped into a seed's `metadata.scheme` at commit time. The keystore stores
 * every wallet root as `type: 'seed'`, so this is what drives the HD vs Algo25
 * dispatch in `signTransactionsWithKey`.
 */
export const SeedScheme = {
    Bip39: 'bip39',
    Algo25: 'algo25',
    /**
     * Deliberately NOT named after the signature algorithm — that lives on the
     * signing child's `type` (`'falcon1024'`), so swapping schemes later needs
     * no seed-metadata migration.
     */
    Quantum: 'quantum',
} as const

export type SeedScheme = (typeof SeedScheme)[keyof typeof SeedScheme]

/**
 * Legacy producers (ASB, older Pera Web) emit the full 64-byte tweetnacl
 * secret key (seed || pubKey); modern ones emit the seed alone. The leading
 * 32 bytes are the seed either way.
 */
export const ALGO25_SEED_LENGTH = 32

/**
 * Identical to ALGO25_SEED_LENGTH on purpose: the quantum mnemonic format IS
 * algo25, so quantum seeds reuse the algo25 mnemonic<->seed utilities as-is.
 */
export const QUANTUM_SEED_LENGTH = 32

/**
 * The only origins allowed private-key access via `checkAccess`. The
 * fail-closed `DEFAULT_SEED_ACL` and both consumers must agree on these exact
 * strings, so kms owns them rather than each side repeating a literal.
 */
export const SIGNING_ACCESS_DOMAIN = 'pera.accounts'
export const BACKUP_ACCESS_DOMAIN = 'backup-flow'
