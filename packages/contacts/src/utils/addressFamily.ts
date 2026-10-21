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
    addressCodecs,
    CHAIN_FAMILIES,
    type AddressCodec,
    type ChainFamily,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { Contact, ContactAddresses } from '../models'

export type ContactAddressEntry = { family: ChainFamily; address: string }

/** The contact's non-empty addresses, in `CHAIN_FAMILIES` order. */
export const contactAddressEntries = (
    addresses: ContactAddresses,
): ContactAddressEntry[] =>
    CHAIN_FAMILIES.flatMap(family => {
        const address = addresses[family]
        return address ? [{ family, address }] : []
    })

/** The first of the contact's addresses in family order; empty when it holds none. */
export const primaryContactAddress = ({
    addresses,
}: Pick<Contact, 'addresses'>): string =>
    contactAddressEntries(addresses)[0]?.address ?? ''

/** The first registered chain's codec in each family, in registry order. */
const familyCodecs = (): Map<ChainFamily, AddressCodec> => {
    const codecs = new Map<ChainFamily, AddressCodec>()
    for (const { id, family } of getProvider().chains.list()) {
        if (!codecs.has(family) && addressCodecs.has(id)) {
            codecs.set(family, addressCodecs.get(id))
        }
    }
    return codecs
}

export type AddressFamilyMatch = {
    family: ChainFamily
    /** In the family's canonical form, such as an EIP-55 checksum. */
    address: string
}

/**
 * The family whose address codec accepts `address`, tried over every
 * registered family; unset when none does. Chains within a family share an
 * address format, so the first chain's codec answers for its family, and no
 * two families' formats overlap.
 */
export const addressFamilyOf = (
    address: string,
): Optional<AddressFamilyMatch> => {
    for (const [family, codec] of familyCodecs()) {
        if (codec.isValid(address)) {
            return { family, address: codec.normalize(address) }
        }
    }
    return undefined
}

/**
 * Whether `address` is valid for `family`. True when no chain of the family
 * is registered: this build can't judge an address a restore brought from a
 * build that registers it, and must not refuse to save the contact over it.
 */
export const isValidFamilyAddress = (
    family: ChainFamily,
    address: string,
): boolean => {
    const codec = familyCodecs().get(family)
    return codec === undefined || codec.isValid(address)
}

/** Whether two addresses of `family` are the same, by its codec when registered. */
export const isSameFamilyAddress = (
    family: ChainFamily,
    a: string,
    b: string,
): boolean => {
    const codec = familyCodecs().get(family)
    if (codec === undefined) return a === b
    return codec.isValid(a) && codec.isValid(b) && codec.areEqual(a, b)
}

/**
 * The first contact holding `address`, compared by each family's codec so
 * checksum case doesn't matter; only on `family` when given.
 */
export const findContactByAddress = <C extends Pick<Contact, 'addresses'>>(
    contacts: readonly C[],
    address: string,
    family?: ChainFamily,
): Optional<C> =>
    contacts.find(contact => {
        if (family !== undefined) {
            const held = contact.addresses[family]
            return !!held && isSameFamilyAddress(family, held, address)
        }
        return contactAddressEntries(contact.addresses).some(entry =>
            isSameFamilyAddress(entry.family, entry.address, address),
        )
    })
