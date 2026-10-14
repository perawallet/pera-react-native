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
    type ChainFamily,
} from '@perawallet/wallet-core-chain-contract'
import type {
    Contact,
    ContactAddresses,
} from '@perawallet/wallet-core-contacts'
import {
    CONTACT_RECORD_FORMAT_VERSION,
    contactRecordPayloadSchema,
    type ContactRecordAddress,
    type ContactRecordPayload,
} from './payloads'

export type ContactRecordEntry = { family: ChainFamily; address: string }

/** The contact's non-empty addresses, in `CHAIN_FAMILIES` order. */
export const contactAddressEntries = (
    addresses: ContactAddresses,
): ContactRecordEntry[] =>
    CHAIN_FAMILIES.flatMap(family => {
        const address = addresses[family]
        return address ? [{ family, address }] : []
    })

/** The first one names the contact's record. */
export const contactBackupAddresses = (
    contact: Pick<Contact, 'addresses'>,
): string[] => contactAddressEntries(contact.addresses).map(e => e.address)

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

/** Every entry's address, read by this build or not, so `[0]` is the
 *  primary. */
export const contactRecordAddresses = (
    record: ContactRecordPayload,
): string[] => orderContactRecordAddresses(record.addresses).map(e => e.address)

/**
 * This device's record laid over the last one it saw remotely. A field or
 * family this build does not know is kept, and so is a family the contact
 * lacks here: an import that failed leaves the family off this device, and
 * dropping it on the next write would erase it from the backup. Removing a
 * family is therefore never a side effect of a write.
 */
export const mergeContactRecord = (
    remote: Record<string, unknown> | null | undefined,
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
    const remoteFamilies = new Set(remoteAddresses.map(e => e.family))
    return {
        ...remote,
        ...local,
        addresses: orderContactRecordAddresses([
            ...remoteAddresses.map(entry => ({
                ...entry,
                ...localByFamily.get(entry.family),
            })),
            ...local.addresses.filter(e => !remoteFamilies.has(e.family)),
        ]),
    }
}

/** True for content cached from a record only a newer client can read; this
 *  build never writes over such a record. */
export const isNewerContactRecord = (
    record: Record<string, unknown> | null | undefined,
): boolean => {
    const parsed = contactRecordPayloadSchema.safeParse(record)
    return parsed.success && !isContactRecordReadable(parsed.data)
}
