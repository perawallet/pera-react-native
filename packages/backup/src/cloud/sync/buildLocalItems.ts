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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { Nullable, Maybe } from '@perawallet/wallet-core-shared'
import {
    accountRecordAddresses,
    accountRecordType,
    contactRecordAddresses,
    isAccountRecordKey,
    isContactRecordKey,
    isNewerAccountRecord,
    isNewerContactRecord,
    mergeAccountRecord,
    mergeContactRecord,
    type AccountRecordPayload,
    type ContactRecordPayload,
    type SyncState,
} from '../models'
import { itemContentHash } from './itemContentHash'
import type {
    LocalItem,
    LocalSnapshot,
    SerializedAccount,
    SerializedItem,
} from './types'

/** Content hash ignores `updatedAt` so a pure timestamp bump is not "dirty". */
export const withContentHash = (item: SerializedItem): LocalItem => {
    const { payload } = item
    return {
        ...item,
        contentHash: itemContentHash(
            item.key,
            payload as Record<string, unknown>,
        ),
        ...identifiersOf(payload),
    }
}

// Both records are loose objects, which TypeScript won't narrow on `in`, so
// the guards say which key identifies each.
const isAccountRecordPayload = (
    payload: SerializedItem['payload'],
): payload is AccountRecordPayload => 'chains' in payload

const isContactRecordPayload = (
    payload: SerializedItem['payload'],
): payload is ContactRecordPayload => 'addresses' in payload

/** What the tracked item caches so review rows and actions can name it: the
 *  key itself is a hash. */
const identifiersOf = (
    payload: SerializedItem['payload'],
): Pick<LocalItem, 'address' | 'addresses' | 'accountType'> => {
    if (isAccountRecordPayload(payload)) {
        return {
            address: payload.chains[0]?.address ?? '',
            addresses: accountRecordAddresses(payload),
            accountType: accountRecordType(payload),
        }
    }
    if (isContactRecordPayload(payload)) {
        const addresses = contactRecordAddresses(payload)
        return { address: addresses[0] ?? '', addresses, accountType: null }
    }
    return {
        // A passkey has no address; its credential id is the identifier the
        // review buckets match on.
        address: 'address' in payload ? payload.address : payload.credentialId,
        accountType: 'type' in payload ? payload.type : null,
    }
}

export const buildLocalItems = async (
    accounts: WalletAccount[],
    serializeAccount: (
        a: WalletAccount,
    ) => Promise<Nullable<SerializedAccount>>,
): Promise<LocalSnapshot> => {
    // Keyed map dedupes shared items (the hdSeed secret repeats across every
    // child of a seed with identical content). Last write wins; safe because
    // duplicate keys only ever carry byte-identical payloads.
    const byKey = new Map<string, LocalItem>()
    let skipped = 0
    for (const account of accounts) {
        const serialized = await serializeAccount(account)
        if (serialized === null) {
            skipped += 1
            continue
        }
        const items: Nullable<SerializedItem>[] = [
            serialized.record,
            serialized.secrets,
            ...(serialized.extraItems ?? []),
        ]
        for (const item of items) {
            if (!item) continue
            const local = withContentHash(item)
            byKey.set(local.key, local)
        }
    }
    return { items: [...byKey.values()], skipped }
}

const isRecordKey = (key: string): boolean =>
    isAccountRecordKey(key) || isContactRecordKey(key)

const isNewerRecord = (
    key: string,
    record: Maybe<Record<string, unknown>>,
): boolean =>
    isContactRecordKey(key)
        ? isNewerContactRecord(record)
        : isNewerAccountRecord(record)

/** Lays each account and contact record over the content its tracked item last
 *  held, so what this build can't read goes back to the server as it came. */
export const withTrackedRecords = (
    items: LocalItem[],
    state: SyncState,
): LocalItem[] =>
    items.map(item => {
        const remote = state.items[item.key]?.record
        if (!remote || !isRecordKey(item.key)) return item
        return withContentHash({
            key: item.key,
            type: item.type,
            payload: isContactRecordKey(item.key)
                ? mergeContactRecord(
                      remote,
                      item.payload as ContactRecordPayload,
                  )
                : mergeAccountRecord(
                      remote,
                      item.payload as AccountRecordPayload,
                  ),
        })
    })

/**
 * Records went into reconcile laid over what the backup held before this
 * sync's deltas, and a delta may have brought a newer one since. Re-lays each
 * dirty record over that, so the push keeps what another device just wrote,
 * and stands down a push over a record a newer client now owns.
 */
export const refreshRecordsForPush = (
    state: SyncState,
    recordItems: LocalItem[],
): { state: SyncState; items: LocalItem[] } => {
    const items = withTrackedRecords(recordItems, state)
    const tracked = { ...state.items }
    for (const item of items) {
        const current = tracked[item.key]
        if (!isRecordKey(item.key) || !current?.isDirty) continue
        tracked[item.key] = isNewerRecord(item.key, current.record)
            ? { ...current, isDirty: false }
            : {
                  ...current,
                  localContentHash: item.contentHash,
                  record: item.payload as Record<string, unknown>,
              }
    }
    return { state: { ...state, items: tracked }, items }
}
