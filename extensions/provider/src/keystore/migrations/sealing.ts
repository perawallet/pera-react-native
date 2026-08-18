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

import { base64 } from '@scure/base'
import { openData, sealData } from '@algorandfoundation/react-native-keystore'
import type { KeychainStorage } from '@algorandfoundation/react-native-keystore'
import type { PeraMigrationContext } from './types'
import type { LiftedMaterial } from './canary13'

/** Everything the sealing helpers need, so callers outside a migration can use them. */
export type SealingDeps = Pick<PeraMigrationContext, 'storage' | 'subtle'>

/**
 * Decides where every lifted secret is going to live before anything is
 * written, returning `undefined` when two *different* secrets claim one `m/`
 * bucket.
 *
 * One id addresses one bucket. A nested carrier that has no `id` of its own
 * inherits the enclosing one, so `metadata.backup.privateKey` and the record's
 * own `privateKey` both resolve to `m/<id>` — and only one of them can be
 * stored. Dropping the other would destroy a key nothing else holds, so the
 * caller refuses the record instead: left whole, it is recoverable; adopted and
 * short a secret, it is not.
 *
 * Identity, not equality: `liftSecrets` pushes the very array it found, so a
 * secret that is already accounted for under an id resolves to its own bucket
 * without conflict.
 *
 * No shape attested in this repo reaches the refusal: the only nested carrier
 * anywhere, `metadata.rootKey`, always carries its own `id`, and a top-level
 * `privateKey`/`seed` pair never disagrees because canary.13's `importSeed`
 * puts the seed in `privateKey`.
 */
export const placeSecrets = (
    lifted: readonly LiftedMaterial[],
    seeded: readonly (readonly [string, Uint8Array])[] = [],
): Map<string, Uint8Array> | undefined => {
    const placements = new Map<string, Uint8Array>(
        seeded.map(([id, bytes]) => [id, bytes]),
    )

    for (const entry of lifted) {
        const claimed = placements.get(entry.id)
        if (claimed === undefined) placements.set(entry.id, entry.bytes)
        else if (claimed !== entry.bytes) return undefined
    }

    return placements
}

/**
 * Zeroes a decrypted buffer, mirroring what `clearBuffer` does for upstream's
 * own adoption pass. Revisions that open material hold plaintext key bytes in
 * the heap for the length of a record; leaving them there outlives the reason
 * they were read.
 */
export const wipeBytes = (bytes: Uint8Array | undefined): void => {
    bytes?.fill(0)
}

/**
 * Seals `bytes` under `key` and confirms the write reads back to the same
 * plaintext.
 *
 * Throws rather than returning a flag, because every caller's response is the
 * same: roll the record back and leave the copy it was about to replace. A
 * write that lands but cannot be opened is the dangerous case — the key looks
 * occupied to the next run, which then treats it as authoritative and strips
 * the only readable copy from the plaintext bucket.
 */
export const sealAndVerify = async (
    { storage, subtle }: SealingDeps,
    masterKey: Uint8Array,
    key: string,
    bytes: Uint8Array,
): Promise<void> => {
    const encoded = base64.encode(bytes)
    storage.set(key, await sealData(subtle, masterKey, encoded))

    // A write that landed as garbage throws inside `openData` rather than
    // comparing unequal, and the two are the same condition to every caller —
    // so both surface as one message rather than a JSON parse error.
    let reopened: string | undefined
    try {
        const written = storage.getString(key)
        reopened =
            written === undefined
                ? undefined
                : await openData(subtle, masterKey, written)
    } catch {
        reopened = undefined
    }

    if (reopened !== encoded) {
        throw new Error(`sealed material at ${key} did not read back`)
    }
}

/** True when `key` already holds a sealed copy of exactly `bytes`. */
export const holdsSameMaterial = async (
    { storage, subtle }: SealingDeps,
    masterKey: Uint8Array,
    key: string,
    bytes: Uint8Array,
): Promise<boolean> => {
    const sealed = storage.getString(key)
    if (sealed === undefined) return false

    try {
        return (
            (await openData(subtle, masterKey, sealed)) === base64.encode(bytes)
        )
    } catch {
        return false
    }
}

/**
 * Records a storage key's value the first time it is written, so a failed
 * record can be restored to exactly the state it had.
 *
 * `remove` is not a rollback: a key that already held something must get that
 * something back, or a run that failed halfway destroys a bucket it never
 * meant to own.
 */
export const createJournal = (storage: KeychainStorage) => {
    const priors = new Map<string, string | undefined>()

    return {
        set: (key: string, value: string): void => {
            if (!priors.has(key)) priors.set(key, storage.getString(key))
            storage.set(key, value)
        },
        /** Marks `key` as about to be written by something other than `set`. */
        track: (key: string): void => {
            if (!priors.has(key)) priors.set(key, storage.getString(key))
        },
        rollback: (): void => {
            for (const [key, prior] of priors) {
                if (prior === undefined) storage.remove(key)
                else storage.set(key, prior)
            }
        },
    }
}
