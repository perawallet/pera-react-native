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

import type { Migration } from '@algorandfoundation/provider-migrations'
import type { PeraMigrationContext } from '../types'

/**
 * The now-removed `migrateKeystoreLayout`'s completion marker. Any device that
 * ran an earlier build of this branch may still have it on disk, and nothing
 * ever writes it again after this revision — kept only so this file and
 * {@link ../0004-adopt-material-less-records}'s candidate filter agree on the
 * literal.
 */
export const LAYOUT_VERSION_KEY = 'pera/keystore-layout-version'

/**
 * Removes the stale `migrateKeystoreLayout` completion stamp.
 *
 * canary.19 mints the Keychain master key only while the keystore's MMKV is
 * **literally empty** (`masterKeyForWrite` in `engine.js`): `if
 * (storage.getAllKeys().length > 0) throw error`. A device that upgraded
 * mid-branch and has nothing else on disk yet — the stamp was written before
 * any account existed — would have that single key block every future master-
 * key mint forever, with no other code path able to clear it. This is the
 * exact bug `7780c1f58` fixed for the in-house migration itself; deleting the
 * writer without also deleting the leftover key would reopen it.
 *
 * Ordered before revision `0004` so a store holding only the stamp is already
 * clean before that revision's flat-candidate scan runs.
 *
 * Decided from the key's mere presence: no master key is read and nothing is
 * decrypted, so this cannot raise a biometric prompt at launch.
 */
export const migration: Migration<PeraMigrationContext> = {
    id: 3,
    name: 'remove-layout-version-stamp',
    up: ({ storage }: PeraMigrationContext): void => {
        if (storage.getString(LAYOUT_VERSION_KEY) !== undefined) {
            storage.remove(LAYOUT_VERSION_KEY)
        }
    },
}
