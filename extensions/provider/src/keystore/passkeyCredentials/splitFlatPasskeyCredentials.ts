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

import { base64, base64url } from '@scure/base'
import {
    MasterKeyNotFoundError,
    METADATA_PREFIX,
} from '@algorandfoundation/react-native-keystore'
import type { KeychainStorage } from '@algorandfoundation/react-native-keystore'
import { isFlatCandidate } from '../migrations/flatCandidate'
import { wipeSecrets } from '../migrations/canary13'
import { wipeBytes } from '../migrations/sealing'
import { safeErrorMessage, safeWarn } from '../migrations/safeLog'
import type { PeraMigrationContext } from '../migrations/types'
import { isPasskeyCredentialType } from './passkeyCredentialTypes'
import {
    liftCredentialMetadata,
    splitProviderCredential,
    type FlatProviderCredential,
} from './splitProviderCredential'
import {
    openFlatProviderRecord,
    verifySplitProviderCredential,
    writeSplitProviderCredential,
} from './splitCredentialStorage'

export type PasskeySplitDeps = Pick<
    PeraMigrationContext,
    'storage' | 'subtle' | 'masterKeyForRead'
>

export type PasskeySplitResult = {
    /** Bare ids now served from `k/`+`m/`: split by this run, or found already split. */
    split: string[]
    /** Ids of `k/` records rewritten to carry their fields under `metadata`. */
    normalized: string[]
    /** Passkey credentials left flat by this run; the next launch retries them. */
    failed: string[]
}

export const emptyPasskeySplit = (): PasskeySplitResult => ({
    split: [],
    normalized: [],
    failed: [],
})

const LOG_PREFIX = '[provider] passkey credential split'

const CREDENTIAL_ID_BYTES = 32

/**
 * Every Android credential writer keys a credential by the base64 SHA-256 of
 * its public key: the provider's `generateCredentialId`, and the legacy
 * import's standard-base64 SHA-256(SPKI DER). A bare key of any other shape is
 * not a credential, so the pass never opens it.
 */
const isCredentialIdShaped = (key: string): boolean => {
    const padded = key + '='.repeat((4 - (key.length % 4)) % 4)
    return [base64, base64url].some(coder => {
        try {
            return coder.decode(padded).length === CREDENTIAL_ID_BYTES
        } catch {
            return false
        }
    })
}

/**
 * Upstream's `adopt-flat-records` carries fields through as found, so a
 * credential from an older writer can land in `k/` with `origin` at the top
 * level, where the Android reader never looks. Plaintext only, so no master key.
 */
const normalizeSplitCredentials = (storage: KeychainStorage): string[] => {
    const normalized: string[] = []
    for (const key of storage.getAllKeys()) {
        if (!key.startsWith(METADATA_PREFIX)) continue
        try {
            const raw = storage.getString(key)
            if (raw === undefined) continue
            const record = JSON.parse(raw) as Record<string, unknown>
            if (!isPasskeyCredentialType(record.type)) continue
            const lifted = liftCredentialMetadata(record)
            if (lifted === record) continue
            storage.set(key, JSON.stringify(lifted))
            normalized.push(key.slice(METADATA_PREFIX.length))
        } catch (error) {
            safeWarn(
                `${LOG_PREFIX}: ${key} left as found: ${safeErrorMessage(error)}`,
            )
        }
    }
    return normalized
}

const removeFlat = (storage: KeychainStorage, key: string): void => {
    try {
        storage.remove(key)
    } catch (error) {
        // `k/` already verified, so the provider serves the credential from the
        // split layout; the next launch takes the resume path for this copy.
        safeWarn(
            `${LOG_PREFIX}: ${key} split, but its flat copy could not be removed: ${safeErrorMessage(error)}`,
        )
    }
}

const splitOne = async (
    deps: PasskeySplitDeps,
    masterKey: Uint8Array,
    key: string,
    result: PasskeySplitResult,
): Promise<void> => {
    const fail = (reason: string): void => {
        result.failed.push(key)
        safeWarn(`${LOG_PREFIX}: ${key} left flat: ${reason}`)
    }

    let flat: FlatProviderCredential | undefined
    let material: Uint8Array | undefined
    try {
        const payload = deps.storage.getString(key)
        if (payload === undefined) return

        try {
            flat = await openFlatProviderRecord(deps.subtle, masterKey, payload)
        } catch {
            // Not sealed with this master key, or not a record at all.
            return
        }
        if (!isPasskeyCredentialType(flat.type)) return

        // The provider reads a credential back at `k/<storage key>`.
        if (flat.id !== undefined && flat.id !== key) {
            return fail('its id does not match its storage key')
        }

        const split = splitProviderCredential(key, flat)
        if (split === undefined) {
            return fail('it cannot be stored in the split layout')
        }
        material = split.material

        if (deps.storage.getString(METADATA_PREFIX + key) !== undefined) {
            if (
                !(await verifySplitProviderCredential(
                    deps,
                    masterKey,
                    key,
                    split,
                ))
            ) {
                return fail('a different k/ record already holds its id')
            }
            removeFlat(deps.storage, key)
            result.split.push(key)
            return
        }

        await writeSplitProviderCredential(deps, masterKey, key, split)
        removeFlat(deps.storage, key)
        result.split.push(key)
    } catch (error) {
        fail(safeErrorMessage(error))
    } finally {
        wipeSecrets(flat)
        // Decoded from `privateKeyEnc.data`, so `wipeSecrets` cannot reach it.
        if (material !== undefined && material !== flat?.privateKey) {
            wipeBytes(material)
        }
    }
}

/**
 * Moves Android's flat bare-id passkey credentials into the `k/`+`m/` split
 * layout, which Pera's patch of the credential provider lists without
 * decrypting anything. Copy, verify, then delete, never the reverse.
 *
 * Runs on every launch instead of as a ledgered revision. A revision is marked
 * applied even when it declines, so a transient failure (the master key not
 * readable at that moment) would hide every passkey for good; here the next
 * launch retries.
 *
 * A launch with nothing flat scans the key list and parses each `k/` record:
 * it decrypts nothing and reads no master key. Only a flat key shaped like a
 * credential id is opened, so a flat record the keystore declined to adopt (a
 * seed or root) is never decrypted here, and the master key is read only
 * while a credential-shaped flat key exists. Pera's master key has no
 * user-authentication binding, so that read never prompts; binding it would
 * prompt on every launch that still finds such a key.
 *
 * Never throws.
 */
export const splitFlatPasskeyCredentials = async (
    deps: PasskeySplitDeps,
): Promise<PasskeySplitResult> => {
    const result = emptyPasskeySplit()
    try {
        result.normalized = normalizeSplitCredentials(deps.storage)

        const candidates = deps.storage
            .getAllKeys()
            .filter(key => isFlatCandidate(key) && isCredentialIdShaped(key))
        if (candidates.length === 0) return result

        let masterKey: Uint8Array
        try {
            masterKey = await deps.masterKeyForRead()
        } catch (error) {
            // Flat records exist, so a missing key is worth a trace too: those
            // credentials stay hidden from the chooser until it can be read.
            const reason =
                error instanceof MasterKeyNotFoundError
                    ? 'no master key'
                    : safeErrorMessage(error)
            safeWarn(
                `${LOG_PREFIX}: master key unavailable, retrying next launch: ${reason}`,
            )
            return result
        }

        try {
            for (const key of candidates) {
                await splitOne(deps, masterKey, key, result)
            }
        } finally {
            wipeBytes(masterKey)
        }
    } catch (error) {
        safeWarn(`${LOG_PREFIX}: pass aborted: ${safeErrorMessage(error)}`)
    }
    return result
}
