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
import {
    MATERIAL_PREFIX,
    METADATA_PREFIX,
} from '@algorandfoundation/react-native-keystore'
import type { PeraMigrationContext } from '../types'

/**
 * The superset `configureHdRootKey` (`@perawallet/wallet-core-passkeys`) scans
 * when it picks the provider's derivation root, kept in step with
 * `migrateKeystoreLayout`'s copy of the same set. Erring wide is deliberate:
 * one shadow too many is a redundant ciphertext, one too few is a record
 * upstream's adoption pass then mangles.
 */
const HD_ROOT_SHADOW_TYPES: ReadonlySet<string> = new Set([
    'hd-root-key',
    'xhd-root-key',
    'hd-seed',
    'seed',
])

/**
 * Retires the bare-id HD-root copy Pera used to keep for the Android and iOS
 * credential providers.
 *
 * Both providers now read `k/` + `m/` directly, so the duplicate is redundant.
 * It is also actively dangerous: upstream's `adopt-flat-records` treats every
 * non-`k/`/`m/` key as a legacy flat record and writes the decoded blob's
 * metadata over `k/<id>` unconditionally — the shadow carries only
 * `{id, type, algorithm, seed}`, so the real record loses `publicKey`,
 * `metadata.scheme` and `bip44Path`, and passkey parent selection (which reads
 * `metadata.scheme`) breaks. This revision runs first so there is nothing left
 * for that pass to misread.
 *
 * The shadow is removed only when the split pair it duplicates is verifiably
 * present. When it is not, the flat record may be the only copy of the key —
 * leave it for upstream's adoption pass, because deleting it is unrecoverable.
 *
 * Decided entirely from the plaintext `k/` record: no master key is read and
 * nothing is decrypted, so this cannot raise a biometric prompt at launch.
 */
export const migration: Migration<PeraMigrationContext> = {
    id: 1,
    name: 'retire-hd-root-shadow',
    up: ({ storage }: PeraMigrationContext): void => {
        for (const key of storage.getAllKeys()) {
            if (key.startsWith(METADATA_PREFIX)) continue
            if (key.startsWith(MATERIAL_PREFIX)) continue

            const meta = storage.getString(METADATA_PREFIX + key)
            if (!meta) continue
            if (!storage.getString(MATERIAL_PREFIX + key)) continue

            let type: unknown
            try {
                type = (JSON.parse(meta) as { type?: unknown }).type
            } catch {
                continue
            }
            if (typeof type !== 'string') continue
            if (!HD_ROOT_SHADOW_TYPES.has(type)) continue

            storage.remove(key)
        }
    },
}

export default migration
