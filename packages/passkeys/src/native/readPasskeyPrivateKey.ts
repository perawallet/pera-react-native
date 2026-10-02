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

import {
    MATERIAL_PREFIX,
    METADATA_PREFIX,
    openData as keystoreOpenData,
    readMasterKey,
    storage as keystoreStorage,
} from '@algorandfoundation/react-native-keystore'
import {
    fromStandardBase64,
    isNativeProviderRecordPayload,
    openNativeProviderRecord,
} from './nativeProviderRecord'
import { p256PrivateKeyFromPkcs8 } from '../crypto/p256Pkcs8'
import type { FlatKeystoreStorage } from './readFlatKeystoreRecords'

const P256_PRIVATE_KEY_LENGTH = 32

export type PasskeyPrivateKeyReaderDeps = {
    subtle: SubtleCrypto
    storage?: Pick<FlatKeystoreStorage, 'getString'>
    readMasterKey?: () => Promise<Uint8Array>
    /** Injectable for the same reason as in `readFlatKeystoreRecords`: the
     *  keystore package's module graph pulls MMKV. */
    openData?: (
        subtle: SubtleCrypto,
        key: Uint8Array,
        payload: string,
    ) => Promise<string>
}

/** Resolves to the raw 32-byte P-256 scalar, owned by the caller, or `null`
 *  when the record holds none this process can read. */
export type PasskeyPrivateKeyReader = ((
    credentialId: string,
) => Promise<Uint8Array | null>) & {
    /** Zeroes the cached master key; await after the last read. */
    dispose: () => Promise<void>
}

/** Takes ownership of `material`: it is returned, or zeroed. */
const toRawScalar = (material: Uint8Array): Uint8Array | null => {
    if (material.length === P256_PRIVATE_KEY_LENGTH) return material
    try {
        return p256PrivateKeyFromPkcs8(material)
    } finally {
        material.fill(0)
    }
}

const toPrivateKey = (value: unknown): Uint8Array | null => {
    if (!Array.isArray(value)) return null
    if (!value.every(byte => typeof byte === 'number')) return null
    const bytes = Uint8Array.from(value as number[])
    ;(value as number[]).fill(0)
    return toRawScalar(bytes)
}

/** Reads iOS's bare-id record or Android's unwrapped `m/<id>`. An Android key
 *  minted under a biometric requirement (`privateKeyEnc` in `k/`) only opens
 *  behind the provider's `BiometricPrompt`, so it reads as `null`. */
export const createPasskeyPrivateKeyReader = ({
    subtle,
    storage = keystoreStorage,
    readMasterKey: readKey = readMasterKey,
    openData = keystoreOpenData,
}: PasskeyPrivateKeyReaderDeps): PasskeyPrivateKeyReader => {
    let masterKeyPromise: Promise<Uint8Array> | undefined

    const resolveMasterKey = (): Promise<Uint8Array> => {
        if (!masterKeyPromise) {
            masterKeyPromise = readKey().catch(error => {
                masterKeyPromise = undefined
                throw error
            })
        }
        return masterKeyPromise
    }

    const readBareRecord = async (
        payload: string,
    ): Promise<Uint8Array | null> => {
        if (!isNativeProviderRecordPayload(payload)) return null
        const record = (await openNativeProviderRecord(
            subtle,
            await resolveMasterKey(),
            payload,
        )) as { privateKey?: unknown; privateKeyEnc?: unknown }
        if (record.privateKeyEnc !== undefined) return null
        return toPrivateKey(record.privateKey)
    }

    const readSplitRecord = async (
        credentialId: string,
    ): Promise<Uint8Array | null> => {
        const metadata = storage.getString(METADATA_PREFIX + credentialId)
        const sealed = storage.getString(MATERIAL_PREFIX + credentialId)
        if (metadata === undefined || sealed === undefined) return null
        const record = JSON.parse(metadata) as { privateKeyEnc?: unknown }
        if (record.privateKeyEnc !== undefined) return null

        return toRawScalar(
            fromStandardBase64(
                await openData(subtle, await resolveMasterKey(), sealed),
            ),
        )
    }

    const read: PasskeyPrivateKeyReader = async credentialId => {
        try {
            const bare = storage.getString(credentialId)
            return bare !== undefined
                ? await readBareRecord(bare)
                : await readSplitRecord(credentialId)
        } catch {
            // An unreadable record is the same answer as one without a key: the
            // caller falls back to re-deriving from the owning seed.
            return null
        }
    }

    read.dispose = async (): Promise<void> => {
        const pending = masterKeyPromise
        masterKeyPromise = undefined
        if (!pending) return
        const masterKey = await pending.catch(() => null)
        masterKey?.fill(0)
    }

    return read
}
