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

import type { KeychainStorage } from '@algorandfoundation/react-native-keystore'
import type { DeclinedRegister } from './declined'

/**
 * The context Pera's own keystore revisions run against, mirroring upstream's
 * `KeystoreMigrationContext`.
 *
 * Resolved **lazily** by the runner — only when a revision is actually pending
 * — so building it must stay cheap and side-effect-free. In particular
 * `masterKeyForRead` is a thunk, never an awaited value: calling it can raise a
 * biometric prompt, and a revision that decides from the plaintext `k/` bucket
 * must never trigger one at launch.
 *
 * **A revision's `up` must never reject.** A rejection fails the whole run and
 * rejects `keystore.ready`, stopping the app booting, and because the ledger
 * entry is written only after `up` resolves it re-runs next launch. A transient
 * cause (I/O, a cancelled biometric prompt) clears; a deterministic one
 * re-fails forever, with no way out but a reinstall. So every storage mutation
 * a per-record failure can trigger swallows its own failure and records the
 * record through {@link DeclinedRegister} instead.
 */
export type PeraMigrationContext = {
    /** The MMKV-style store holding the keystore's records. */
    storage: KeychainStorage
    /** Host Subtle implementation, for revisions that open or re-seal material. */
    subtle: SubtleCrypto
    /**
     * Resolves the existing master key for a **read**. Must not create one — a
     * missing master key is how a fresh install (nothing to migrate) looks.
     */
    masterKeyForRead: () => Promise<Uint8Array>
    /**
     * Durable note of records a revision deliberately left alone. Backed by the
     * **migrations ledger's** MMKV instance — writing it to the keystore's would
     * leave that store non-empty and permanently block a fresh install from
     * minting its master key.
     */
    declined: DeclinedRegister
}
