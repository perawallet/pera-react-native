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

/**
 * The context Pera's own keystore revisions run against, mirroring upstream's
 * `KeystoreMigrationContext`.
 *
 * Resolved **lazily** by the runner — only when a revision is actually pending
 * — so building it must stay cheap and side-effect-free. In particular
 * `masterKeyForRead` is a thunk, never an awaited value: calling it can raise a
 * biometric prompt, and a revision that decides from the plaintext `k/` bucket
 * must never trigger one at launch.
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
}
