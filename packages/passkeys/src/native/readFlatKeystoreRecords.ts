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
    decode as keystoreDecode,
    openData as keystoreOpenData,
    readMasterKey,
    storage as keystoreStorage,
} from '@algorandfoundation/react-native-keystore'
import type { Key } from '@algorandfoundation/keystore-core'
import {
    isNativeProviderRecordPayload,
    openNativeProviderRecord,
} from './nativeProviderRecord'

/**
 * Reads the **flat bare-id records the credential providers own**, which is
 * where a passkey credential actually lives on iOS and Android.
 *
 * The keystore's own `k/`+`m/` split layout is deliberately *not* where they
 * live: `extensions/provider`'s `repairs/0002-rematerialize-passkey-credentials`
 * rewrites every credential as a flat record and deletes the pair, because
 * Android's `CredentialRepository.getCredential` tries the split layout first
 * and a surviving `k/` record shadows the flat copy. So anything that walks the
 * reactive keystore store sees no credentials at all on a device.
 *
 * Two writers seal these records and both are read here, because which one
 * wrote a given credential depends on how it got there:
 *
 * - the credential provider's own `{iv, tag, content}` envelope
 *   (`sealNativeProviderRecord`, and the repair that rematerialised it), and
 * - the keystore's `sealData` `{iv, content}`, with the GCM tag inside the
 *   ciphertext, which is what a credential minted on-device carries.
 *
 * Like {@link readFlaggedPasskeyCredentials} this never rejects: a keychain
 * that will not open must degrade to "nothing found", and `isComplete` is what
 * carries that apart from a genuinely empty keystore.
 */

export type FlatKeystoreStorage = {
    getAllKeys: () => string[]
    getString: (key: string) => string | undefined
}

export type ReadFlatKeystoreRecordsDeps = {
    /** Callers supply this: `react-native-quick-crypto` is not a dependency of
     *  this package and every caller already has a `SubtleCrypto`. */
    subtle: SubtleCrypto
    storage?: FlatKeystoreStorage
    readMasterKey?: () => Promise<Uint8Array>
    /** The keystore's envelope opener and codec. Injectable because the
     *  keystore package's own module graph pulls MMKV, which will not load in
     *  a unit test. */
    openData?: (
        subtle: SubtleCrypto,
        key: Uint8Array,
        payload: string,
    ) => Promise<string>
    decode?: (data: string) => unknown
}

export type FlatKeystoreRecordScan = {
    keys: Key[]
    /** False when an entry could not be listed, read or opened — without it an
     *  empty `keys` cannot be told apart from a keystore holding none. */
    isComplete: boolean
}

const readMasterKeyBytes = async (): Promise<Uint8Array> => {
    const masterKey = await readMasterKey()
    try {
        return Uint8Array.from(masterKey)
    } finally {
        masterKey.fill(0)
    }
}

/** The provider envelope carries byte fields as JSON number arrays; the
 *  keystore codec already hands back `Uint8Array`. Everything downstream reads
 *  them as bytes. */
const toBytes = (value: unknown): Uint8Array | undefined => {
    if (value instanceof Uint8Array) return value
    if (Array.isArray(value) && value.every(byte => typeof byte === 'number')) {
        return Uint8Array.from(value as number[])
    }
    return undefined
}

const toKey = (record: unknown): Key | null => {
    if (typeof record !== 'object' || record === null) return null
    const candidate = record as Partial<Key> & { publicKey?: unknown }
    if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
        return null
    }

    const publicKey = toBytes(candidate.publicKey)
    return {
        ...(candidate as Key),
        ...(publicKey ? { publicKey } : {}),
    } as Key
}

export const readFlatKeystoreRecords = async ({
    subtle,
    storage = keystoreStorage,
    readMasterKey: readKey = readMasterKeyBytes,
    openData = keystoreOpenData,
    decode = keystoreDecode,
}: ReadFlatKeystoreRecordsDeps): Promise<FlatKeystoreRecordScan> => {
    let bareIds: string[]
    try {
        bareIds = storage
            .getAllKeys()
            .filter(
                key =>
                    !key.startsWith(METADATA_PREFIX) &&
                    !key.startsWith(MATERIAL_PREFIX),
            )
    } catch {
        return { keys: [], isComplete: false }
    }

    // Opening anything needs the master key, so answer "nothing to open"
    // before asking for it.
    if (bareIds.length === 0) return { keys: [], isComplete: true }

    let masterKey: Uint8Array
    try {
        masterKey = await readKey()
    } catch {
        return { keys: [], isComplete: false }
    }

    try {
        const keys: Key[] = []
        let isComplete = true

        for (const id of bareIds) {
            let payload: string | undefined
            try {
                payload = storage.getString(id)
            } catch {
                isComplete = false
                continue
            }
            // Listed a moment ago and unreadable now: an entry we cannot rule
            // out, not one we ruled out.
            if (payload === undefined) {
                isComplete = false
                continue
            }

            try {
                const record = isNativeProviderRecordPayload(payload)
                    ? await openNativeProviderRecord(subtle, masterKey, payload)
                    : decode(await openData(subtle, masterKey, payload))
                const key = toKey(record)
                if (key) keys.push(key)
            } catch {
                isComplete = false
            }
        }

        return { keys, isComplete }
    } finally {
        masterKey.fill(0)
    }
}
