/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useMemo, useState } from 'react'
import { useContacts, type Contact } from '@perawallet/wallet-core-contacts'
import {
    AccountTypes,
    useAllAccounts,
    type AccountType,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'

export type AddressSearchItem =
    | { type: 'section_header'; title: string; key: string }
    | { type: 'account'; account: WalletAccount; key: string }
    | { type: 'contact'; contact: Contact; key: string }

type UseAddressSearchViewProps = {
    excludeAddress?: string
    excludeTypes?: AccountType[]
}

type UseAddressSearchViewResult = {
    value: string
    setValue: (text: string) => void
    matchingItems: AddressSearchItem[]
    hasResults: boolean
}

export const useAddressSearchView = (
    props?: UseAddressSearchViewProps,
): UseAddressSearchViewResult => {
    const excludeAddress = props?.excludeAddress
    const excludeTypes = props?.excludeTypes
    const [value, setValue] = useState('')
    const { findContacts } = useContacts()
    const accounts = useAllAccounts()

    const addressIsValid = useMemo(() => isValidAlgorandAddress(value), [value])

    const matchingAccounts = useMemo(
        () =>
            addressIsValid
                ? []
                : accounts.filter(
                      a =>
                          a.address !== excludeAddress &&
                          (!excludeTypes || !excludeTypes.includes(a.type)) &&
                          a.address.includes(value),
                  ),
        [value, accounts, excludeAddress, excludeTypes, addressIsValid],
    )

    const matchingContacts = useMemo(
        () =>
            addressIsValid
                ? []
                : value.length
                  ? findContacts({ keyword: value })
                  : [],
        [value, findContacts, addressIsValid],
    )

    const matchingItems = useMemo(() => {
        const items: AddressSearchItem[] = []

        if (addressIsValid) {
            items.push({
                type: 'section_header',
                title: 'address_entry.address',
                key: 'header-address',
            })
            items.push({
                type: 'account',
                account: {
                    type: AccountTypes.watch,
                    address: value,
                },
                key: `address-${value}`,
            })
        }

        if (matchingAccounts.length > 0) {
            items.push({
                type: 'section_header',
                title: 'address_entry.my_accounts',
                key: 'header-accounts',
            })
            for (const a of matchingAccounts) {
                items.push({
                    type: 'account',
                    account: a,
                    key: `account-${a.address}`,
                })
            }
        }

        if (matchingContacts.length > 0) {
            items.push({
                type: 'section_header',
                title: 'address_entry.contacts',
                key: 'header-contacts',
            })
            for (const c of matchingContacts) {
                items.push({
                    type: 'contact',
                    contact: c,
                    key: `contact-${c.address}`,
                })
            }
        }

        return items
    }, [addressIsValid, value, matchingAccounts, matchingContacts])

    const hasResults = matchingItems.length > 0

    return {
        value,
        setValue,
        matchingItems,
        hasResults,
    }
}
