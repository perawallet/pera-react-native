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

import type { Nullable, Maybe } from '@perawallet/wallet-core-shared'
import {
    ACCOUNT_RECORD_FORMAT_VERSION,
    BackupAccountType,
    accountEntryPayloadSchema,
    accountIdentityOf,
    accountRecordPayloadSchema,
    hdPositionOf,
    isChainBackupKind,
    type AccountEntryPayload,
    type AccountRecordChain,
    type AccountRecordPayload,
    type BackupItemKind,
} from './payloads'

/** False for a record a newer client wrote, which this build leaves for that
 *  client to restore. */
export const isAccountRecordReadable = (
    record: AccountRecordPayload,
): boolean => record.formatVersion <= ACCOUNT_RECORD_FORMAT_VERSION

/** One entry of a record, as the chain's own address item. */
export type AccountRecordEntry = {
    chain: string
    payload: AccountEntryPayload
}

/** Every entry that parses, named and stamped from the record. One this build
 *  can't parse is simply absent: it stays in the record untouched. */
const parsedEntries = (record: AccountRecordPayload): AccountRecordEntry[] =>
    record.chains.flatMap(({ chain, ...entry }) => {
        const parsed = accountEntryPayloadSchema.safeParse({
            ...entry,
            customName: record.customName,
            updatedAt: record.updatedAt,
        })
        return parsed.success ? [{ chain, payload: parsed.data }] : []
    })

/**
 * The entries this build restores. `canRead` answers per entry: whether its
 * chain is one this build backs up, and whether it decodes the entry's kind.
 * Empty for a record a newer client wrote.
 */
export const accountRecordEntries = (
    record: AccountRecordPayload,
    canRead: (entry: AccountRecordEntry) => boolean,
): AccountRecordEntry[] =>
    isAccountRecordReadable(record) ? parsedEntries(record).filter(canRead) : []

/** What the record's key hashes: `accountIdentityOf` of its entries, which a
 *  legacy item of the same account also yields. */
export const accountRecordIdentity = (record: AccountRecordPayload): string => {
    const hd = parsedEntries(record).find(
        ({ payload }) => hdPositionOf(payload) !== null,
    )
    return hd
        ? accountIdentityOf(hd.payload)
        : (record.chains[0]?.address ?? '')
}

/** The seed an HD record derives from, whose secret is filed under it; null
 *  for every other account. */
export const accountRecordSeedReference = (
    record: AccountRecordPayload,
): Nullable<string> => {
    for (const { payload } of parsedEntries(record)) {
        const position = hdPositionOf(payload)
        if (position) return position.seedReference
    }
    return null
}

/** Every chain's address, read by this build or not. */
export const accountRecordAddresses = (
    record: AccountRecordPayload,
): string[] => record.chains.map(entry => entry.address)

const FORMAT_KINDS: ReadonlySet<string> = new Set(
    Object.values(BackupAccountType),
)

const asItemKind = (type: string): Nullable<BackupItemKind> =>
    FORMAT_KINDS.has(type) || isChainBackupKind(type)
        ? (type as BackupItemKind)
        : null

/** The kind a review row shows for the account: an entry a chain adapter
 *  owns where there is one, since only an adapter names its glyph, else the
 *  first entry's. */
export const accountRecordType = (
    record: AccountRecordPayload,
): Nullable<BackupItemKind> => {
    const owned = record.chains.find(entry => isChainBackupKind(entry.type))
    return asItemKind((owned ?? record.chains[0])?.type ?? '')
}

/** Chain-id order, so two devices holding the same account write the same
 *  bytes. */
export const orderAccountRecordChains = <T extends { chain: string }>(
    chains: readonly T[],
): T[] => [...chains].sort((a, b) => a.chain.localeCompare(b.chain))

/**
 * This device's record laid over the last one it saw remotely. A field or chain
 * this build does not know is kept, and so is a chain the account lacks here:
 * an import that failed leaves the chain off this device, and dropping it on
 * the next write would erase it from the backup. Removing a chain is therefore
 * never a side effect of a write.
 */
export const mergeAccountRecord = (
    remote: Maybe<Record<string, unknown>>,
    local: AccountRecordPayload,
): AccountRecordPayload => {
    if (!remote) return local
    const remoteChains = (
        Array.isArray(remote.chains) ? remote.chains : []
    ).filter(
        (entry): entry is AccountRecordChain =>
            typeof entry === 'object' &&
            entry !== null &&
            typeof (entry as { chain?: unknown }).chain === 'string',
    )
    const localByChain = new Map(
        local.chains.map(entry => [entry.chain, entry]),
    )
    const remoteIds = new Set(remoteChains.map(entry => entry.chain))
    return {
        ...remote,
        ...local,
        chains: orderAccountRecordChains([
            ...remoteChains.map(entry => ({
                ...entry,
                ...localByChain.get(entry.chain),
            })),
            ...local.chains.filter(entry => !remoteIds.has(entry.chain)),
        ]),
    }
}

/** The seed of cached record content; null when it is not a readable HD
 *  record. */
export const cachedRecordSeedReference = (
    record: Maybe<Record<string, unknown>>,
): Nullable<string> => {
    const parsed = accountRecordPayloadSchema.safeParse(record)
    return parsed.success ? accountRecordSeedReference(parsed.data) : null
}

/** One chain of a record as a review row lists it. `chain` is as the record
 *  wrote it, which may be a chain this build doesn't register. */
export type CachedRecordChain = {
    chain: string
    address: string
}

/** What a review row shows of cached record content, parsed once. */
export type CachedRecordOverview = {
    /** Only a newer client can read the record. */
    needsUpdate: boolean
    /** Every chain, a newer client's record included; empty when it is not a record. */
    chains: CachedRecordChain[]
}

export const cachedRecordOverview = (
    record: Maybe<Record<string, unknown>>,
): CachedRecordOverview => {
    const parsed = accountRecordPayloadSchema.safeParse(record)
    if (!parsed.success) return { needsUpdate: false, chains: [] }
    return {
        needsUpdate: !isAccountRecordReadable(parsed.data),
        chains: parsed.data.chains.map(({ chain, address }) => ({
            chain,
            address,
        })),
    }
}

/** True for content cached from a record only a newer client can read; this
 *  build never writes over such a record. */
export const isNewerAccountRecord = (
    record: Maybe<Record<string, unknown>>,
): boolean => {
    const parsed = accountRecordPayloadSchema.safeParse(record)
    return parsed.success && !isAccountRecordReadable(parsed.data)
}
