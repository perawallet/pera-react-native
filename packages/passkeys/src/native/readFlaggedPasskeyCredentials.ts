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
    readMasterKey,
    storage as keystoreStorage,
} from '@algorandfoundation/react-native-keystore'
import { flatRecordToPasskey, type Passkey } from '../models/passkey'
import {
    isNativeProviderRecordPayload,
    openNativeProviderRecord,
} from './nativeProviderRecord'

/**
 * Unlike its siblings in this folder, this module is **not** dependency-free
 * and must never be added to the `./native` entry point — that entry exists so
 * `packages/migrate` can take the codec without dragging
 * `react-native-keystore` (and through it `react-native-mmkv`) along.
 *
 * Reads the migration marker off the **flat, bare-id provider records**,
 * because that is the only place it survives. Upstream's
 * `migrateLegacyPasskeys` stamps `metadata.migration` onto a `k/` record, and
 * `extensions/provider`'s `repairs/0002-rematerialize-passkey-credentials`
 * then deletes that very record — it rematerializes the flat copy the native
 * credential providers actually read and removes the `k/`+`m/` pair. The
 * marker survives in the flat copy through that module's `...rest` spread, and
 * `0002-rematerialize-passkey-credentials.spec.ts`'s "carries the
 * metadata.migration flag upstream stamps on a legacy passkey across the
 * un-adopt" pins that carry-through (with a stand-in value — the marker's own
 * value is pinned in `models/__tests__/passkey.spec.ts`). A flagged credential
 * that repair un-adopted therefore never appears in `listMeta()`/the reactive
 * keystore store again; one that repair declined keeps its `k/` pair and still
 * does — `usePasskeyMigrationBanner` unions both sources.
 *
 * A flagged credential still signs in; what it cannot do is come back from the
 * recovery phrase, because the migration wrote no `scheme` and the legacy
 * derivation cannot be reproduced. So nothing here deletes anything — the read
 * only feeds the banner that lets the user decide.
 */

export type FlaggedPasskeyStorage = {
    getAllKeys: () => string[]
    getString: (key: string) => string | undefined
}

export type ReadFlaggedPasskeyCredentialsDeps = {
    /**
     * Callers supply this rather than the module importing it:
     * `react-native-quick-crypto` is not a dependency of this package (see its
     * `package.json`), and every caller already has a `SubtleCrypto` to hand —
     * the mobile app from that module, tests from `globalThis.crypto`.
     */
    subtle: SubtleCrypto
    storage?: FlaggedPasskeyStorage
    readMasterKey?: () => Promise<Uint8Array>
}

export type FlaggedPasskeyScan = {
    flagged: Passkey[]
    /**
     * Whether every bare-id entry was actually examined. False when the key
     * listing or the master key could not be read, or when an entry that *is*
     * a credential-provider payload could not be opened.
     *
     * Without it `flagged: []` is ambiguous — this function never rejects (see
     * below), so a total failure and a clean scan of an unflagged keystore look
     * identical. A caller gating an irreversible action must branch on this,
     * not on the emptiness of `flagged`.
     *
     * An entry that is not a provider payload at all (the keystore's own legacy
     * `{iv, content}` writer shares the bare-id namespace) does not clear it:
     * that entry was examined, it simply isn't a credential record.
     */
    isComplete: boolean
}

/**
 * The keystore hands back a Buffer that stays live in the JS heap until it is
 * overwritten, and the caller only ever sees (and zeroes) the copy.
 */
const readMasterKeyBytes = async (): Promise<Uint8Array> => {
    const masterKey = await readMasterKey()
    try {
        return Uint8Array.from(masterKey)
    } finally {
        masterKey.fill(0)
    }
}

/**
 * Every credential whose record carries the marker, plus whether the scan that
 * found them saw everything. Never rejects on a read failure: this feeds an
 * advisory banner on a settings screen, so a keychain that will not open must
 * degrade to "nothing to warn about", never to an error state over the passkey
 * list itself. {@link FlaggedPasskeyScan.isComplete} is what carries the
 * failure instead.
 */
export const readFlaggedPasskeyCredentials = async ({
    subtle,
    storage = keystoreStorage,
    readMasterKey: readKey = readMasterKeyBytes,
}: ReadFlaggedPasskeyCredentialsDeps): Promise<FlaggedPasskeyScan> => {
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
        return { flagged: [], isComplete: false }
    }

    // Opening a record needs the master key, so answer "nothing to open"
    // before asking for it.
    if (bareIds.length === 0) return { flagged: [], isComplete: true }

    let masterKey: Uint8Array
    try {
        masterKey = await readKey()
    } catch {
        return { flagged: [], isComplete: false }
    }

    try {
        const flagged: Passkey[] = []
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
            if (!isNativeProviderRecordPayload(payload)) continue

            try {
                const record = await openNativeProviderRecord(
                    subtle,
                    masterKey,
                    payload,
                )
                const passkey = flatRecordToPasskey(record)
                if (passkey?.needsMigration) flagged.push(passkey)
            } catch {
                // Shaped like a record but sealed with something this app
                // cannot open, so its marker — if any — stays unread.
                isComplete = false
            }
        }
        return { flagged, isComplete }
    } finally {
        masterKey.fill(0)
    }
}
