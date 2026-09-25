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
    const raw = deps.storage.getString(METADATA_PREFIX + id)
    if (raw === undefined) return false

    try {
        const written = JSON.parse(raw) as Record<string, unknown>
        const wrapped = (written.publicKey as { $u8?: unknown } | undefined)
            ?.$u8
        const metadata = written.metadata as Record<string, unknown> | undefined
        const enc = written.privateKeyEnc as { iv?: unknown } | undefined
        const { record } = split

        if (written.id !== id || written.type !== record.type) return false
        if (
            typeof wrapped !== 'string' ||
            !bytesEqual(base64.decode(wrapped), record.publicKey)
        ) {
            return false
        }
        if (
            typeof metadata?.origin !== 'string' ||
            metadata.origin !== record.metadata.origin
        ) {
            return false
        }
        if (enc?.iv !== record.privateKeyEnc?.iv) return false
    } catch {
        return false
    }

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
