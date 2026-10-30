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
    CHAIN_FAMILIES,
    isChainFamily,
    LEGACY_CHAIN_FAMILY,
    type ChainFamily,
} from '@perawallet/wallet-core-chain-contract'
import {
    contactAddressEntries,
    derivedContactId,
    type ContactAddressEntry,
} from '@perawallet/wallet-core-contacts'
import type { Maybe, Nullable } from '@perawallet/wallet-core-shared'
import { isContactItemKey, isContactRecordKey } from './itemKeys'
import type { SyncItemState } from './syncState'
import type { BackupItemKey } from './types'
import {
    CONTACT_RECORD_FORMAT_VERSION,
    contactRecordPayloadSchema,
    type ContactRecordAddress,
    type ContactRecordPayload,
} from './payloads'

export type ContactRecordEntry = ContactAddressEntry

export { contactAddressEntries }

const familyRank = (family: string): number => {
    const index = (CHAIN_FAMILIES as readonly string[]).indexOf(family)
    return index === -1 ? CHAIN_FAMILIES.length : index
}

/** Known families first, in `CHAIN_FAMILIES` order, so two devices holding the
 *  same contact write the same bytes. The rest keep the order they arrived in:
 *  `CHAIN_FAMILIES` only grows, so that is the newer writer's own order, and
 *  re-sorting them would make the two builds rewrite the record on every sync. */
export const orderContactRecordAddresses = <T extends { family: string }>(
    addresses: readonly T[],
): T[] =>
    [...addresses].sort((a, b) => familyRank(a.family) - familyRank(b.family))

/** False for a record a newer client wrote, which this build leaves for that
 *  client to restore. */
export const isContactRecordReadable = (
    record: ContactRecordPayload,
): boolean => record.formatVersion <= CONTACT_RECORD_FORMAT_VERSION

/** The families this build knows, ordered; empty for a record a newer client
 *  wrote. */
export const contactRecordEntries = (
    record: ContactRecordPayload,
): ContactRecordEntry[] =>
    isContactRecordReadable(record)
        ? orderContactRecordAddresses(record.addresses).flatMap(
              ({ family, address }) =>
                  isChainFamily(family) ? [{ family, address }] : [],
          )
        : []

/** The families the record says were removed that this build knows. */
export const contactRecordRemovedFamilies = (
    record: ContactRecordPayload,
): ChainFamily[] =>
    isContactRecordReadable(record)
        ? (record.removed ?? []).filter(isChainFamily)
        : []

/** Every entry's address, read by this build or not, so `[0]` is the
 *  primary. */
export const contactRecordAddresses = (
    record: ContactRecordPayload,
): string[] => orderContactRecordAddresses(record.addresses).map(e => e.address)

/**
 * This device's record laid over the last one it saw remotely. A field or
 * family this build does not know is kept, and so is a family the contact
 * lacks here: an import that failed leaves the family off this device, and
 * dropping it on the next write would erase it from the backup. Only a family
 * this device's record lists in `removed` is dropped; a removal another device
 * wrote stays listed until a family holds an address again.
 */
export const mergeContactRecord = (
    remote: Maybe<Record<string, unknown>>,
    local: ContactRecordPayload,
): ContactRecordPayload => {
    if (!remote) return local
    const remoteAddresses = (
        Array.isArray(remote.addresses) ? remote.addresses : []
    ).filter(
        (entry): entry is ContactRecordAddress =>
            typeof entry === 'object' &&
            entry !== null &&
            typeof (entry as { family?: unknown }).family === 'string',
    )
    const localByFamily = new Map(local.addresses.map(e => [e.family, e]))
    const locallyRemoved = new Set(local.removed ?? [])
    const kept = remoteAddresses.filter(e => !locallyRemoved.has(e.family))
    const keptFamilies = new Set(kept.map(e => e.family))
    const addresses = orderContactRecordAddresses([
        ...kept.map(entry => ({
            ...entry,
            ...localByFamily.get(entry.family),
        })),
        ...local.addresses.filter(e => !keptFamilies.has(e.family)),
    ])
    const held = new Set(addresses.map(e => e.family))
    const remoteRemoved = Array.isArray(remote.removed)
        ? remote.removed.filter(
              (family): family is string => typeof family === 'string',
          )
        : []
    const removed = [...new Set([...remoteRemoved, ...locallyRemoved])].filter(
        family => !held.has(family),
    )
    const { removed: _, ...merged } = { ...remote, ...local }
    return {
        ...merged,
        addresses,
        ...(removed.length > 0 ? { removed } : {}),
    }
}

/** True for content cached from a record only a newer client can read; this
 *  build never writes over such a record. */
export const isNewerContactRecord = (
    record: Maybe<Record<string, unknown>>,
): boolean => {
    const parsed = contactRecordPayloadSchema.safeParse(record)
    return parsed.success && !isContactRecordReadable(parsed.data)
}

/** The id of the contact a tracked item backs up: a record's from the content
 *  last seen, a legacy item's derived from its address the way every device
 *  derives it. Null when this device has never decrypted the item. */
export const trackedContactId = (
    key: BackupItemKey,
    item: SyncItemState,
): Nullable<string> => {
    if (isContactRecordKey(key))
        return typeof item.record?.id === 'string' ? item.record.id : null
    if (isContactItemKey(key) && item.address)
        return derivedContactId({ [LEGACY_CHAIN_FAMILY]: item.address })
    return null
}
