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
import type { Key } from '@algorandfoundation/keystore-core'
import {
    MATERIAL_PREFIX,
    METADATA_PREFIX,
    decode,
    openData,
    serializeKey,
} from '@algorandfoundation/react-native-keystore'
import type { PeraMigrationContext } from '../migrations/types'
import {
    createJournal,
    holdsSameMaterial,
    sealAndVerify,
} from '../migrations/sealing'
import type {
    FlatProviderCredential,
    SplitCredentialRecord,
    SplitProviderCredential,
} from './splitProviderCredential'

export type SplitStorageDeps = Pick<PeraMigrationContext, 'storage' | 'subtle'>

const padBase64Url = (value: string): string =>
    value + '='.repeat((4 - (value.length % 4)) % 4)

const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean =>
    a.length === b.length && a.every((byte, index) => byte === b[index])

/**
 * Opens a flat bare-id credential record the way the Android provider's
 * `decodeLegacyRecord` does: a JSON envelope (either shape) is opened with the
 * master key; anything else is the unsealed base64url payload. `decode` needs
 * padded base64url, which every known writer produces, but padding is
 * restored anyway so an unpadded record is not mistaken for a foreign one.
 */
export const openFlatProviderRecord = async (
    subtle: SubtleCrypto,
    masterKey: Uint8Array,
    payload: string,
): Promise<FlatProviderCredential> => {
    const plaintext = (
        payload.startsWith('{')
            ? await openData(subtle, masterKey, payload)
            : payload
    ).trim()
    return decode(
        plaintext.startsWith('{') ? plaintext : padBase64Url(plaintext),
    ) as unknown as FlatProviderCredential
}

/**
 * `k/<id>` parsed, when it names the same credential as `record` the way the
 * Android provider reads it: the same id and type, `publicKey` as
 * `{"$u8": …}` holding the same bytes, and the same non-empty
 * `metadata.origin`. `undefined` when it is missing, unreadable or different.
 */
const readSameCredentialMetadata = (
    deps: SplitStorageDeps,
    id: string,
    record: SplitCredentialRecord,
): Record<string, unknown> | undefined => {
    const raw = deps.storage.getString(METADATA_PREFIX + id)
    if (raw === undefined) return undefined

    try {
        const written = JSON.parse(raw) as Record<string, unknown>
        const wrapped = (written.publicKey as { $u8?: unknown } | undefined)
            ?.$u8
        const metadata = written.metadata as Record<string, unknown> | undefined

        if (written.id !== id || written.type !== record.type) return undefined
        if (
            typeof wrapped !== 'string' ||
            !bytesEqual(base64.decode(wrapped), record.publicKey)
        ) {
            return undefined
        }
        if (
            typeof metadata?.origin !== 'string' ||
            metadata.origin !== record.metadata.origin
        ) {
            return undefined
        }
        return written
    } catch {
        return undefined
    }
}

/**
 * True when `k/<id>` describes the credential `split` holds, and, for a
 * credential with material, `m/<id>` exists and opens with the master key.
 * The sealed content may differ: a credential wrapped again under a fresh
 * biometric IV is still the same credential.
 */
export const describesSameCredential = async (
    deps: SplitStorageDeps,
    masterKey: Uint8Array,
    id: string,
    split: SplitProviderCredential,
): Promise<boolean> => {
    if (readSameCredentialMetadata(deps, id, split.record) === undefined) {
        return false
    }
    if (split.material === undefined) return true

    const sealed = deps.storage.getString(MATERIAL_PREFIX + id)
    if (sealed === undefined) return false
    try {
        await openData(deps.subtle, masterKey, sealed)
        return true
    } catch {
        return false
    }
}

/**
 * True when `k/<id>` (and `m/<id>`, for a credential with material) hold
 * exactly `split`, read the way the Android provider reads them: `publicKey`
 * as `{"$u8": …}`, a non-empty `metadata.origin`, the biometric IV under
 * `privateKeyEnc.iv`.
 */
export const verifySplitProviderCredential = async (
    deps: SplitStorageDeps,
    masterKey: Uint8Array,
    id: string,
    split: SplitProviderCredential,
): Promise<boolean> => {
    const written = readSameCredentialMetadata(deps, id, split.record)
    if (written === undefined) return false

    const enc = written.privateKeyEnc as { iv?: unknown } | undefined
    if (enc?.iv !== split.record.privateKeyEnc?.iv) return false

    return split.material === undefined
        ? true
        : holdsSameMaterial(
              deps,
              masterKey,
              MATERIAL_PREFIX + id,
              split.material,
          )
}

/**
 * Writes `split` as `m/<id>` then `k/<id>` and confirms both read back. `k/`
 * goes last because it is what makes the credential visible to the provider.
 * On any failure every key this call wrote is restored to what it held
 * before, and the error is rethrown.
 */
export const writeSplitProviderCredential = async (
    deps: SplitStorageDeps,
    masterKey: Uint8Array,
    id: string,
    split: SplitProviderCredential,
): Promise<void> => {
    const journal = createJournal(deps.storage)
    try {
        if (split.material !== undefined) {
            journal.track(MATERIAL_PREFIX + id)
            await sealAndVerify(
                deps,
                masterKey,
                MATERIAL_PREFIX + id,
                split.material,
            )
        }
        journal.set(
            METADATA_PREFIX + id,
            serializeKey(split.record as unknown as Key),
        )
        if (
            !(await verifySplitProviderCredential(deps, masterKey, id, split))
        ) {
            throw new Error(`split credential ${id} did not read back`)
        }
    } catch (error) {
        journal.rollback()
        throw error
    }
}
