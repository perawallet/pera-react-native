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

import { useCallback, useMemo, useState } from 'react'
import { useContacts, type Contact } from '@perawallet/wallet-core-contacts'
import {
    useAllAccounts,
    type AccountType,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import {
    useNfdSearchQuery,
    type NfdSearchResult,
} from '@perawallet/wallet-core-nfd'
import {
    useDebouncedValue,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { SEARCH_DEBOUNCE_TIME } from '@constants/ui'
import { useClipboard } from '@hooks/useClipboard'
import { useFocusEffect } from '@react-navigation/native'

export type AddressSearchItem =
    | { type: 'section_header'; title: string; key: string }
    | { type: 'account'; account: WalletAccount; key: string }
    | { type: 'contact'; contact: Contact; key: string }
    | { type: 'nfd'; nfd: NfdSearchResult; key: string }
    | { type: 'address'; address: string; key: string }
    | { type: 'paste'; address: string; key: string }

type UseAddressSearchViewProps = {
    excludeAddress?: string
    excludeTypes?: AccountType[]
    showAllContactsWhenEmpty?: boolean
    /**
     * Offer the clipboard's address as the first row. Opt-in because reading the
     * clipboard makes iOS show its "pasted from" notice, so only the flows that
     * want the affordance pay for it — mirrors native Android, where
     * `willCopiedItemBeHandled` is the send-receiver screen only.
     */
    showClipboardPaste?: boolean
}

type UseAddressSearchViewResult = {
    value: string
    setValue: (text: string) => void
    matchingItems: AddressSearchItem[]
    hasResults: boolean
    isNfdLoading: boolean
}

export const useAddressSearchView = (
    props?: UseAddressSearchViewProps,
): UseAddressSearchViewResult => {
    const excludeAddress = props?.excludeAddress
    const excludeTypes = props?.excludeTypes
    const showAllContactsWhenEmpty = props?.showAllContactsWhenEmpty ?? false
    const showClipboardPaste = props?.showClipboardPaste ?? false
    const [value, setValue] = useState('')
    const [clipboardAddress, setClipboardAddress] =
        useState<Nullable<string>>(null)
    const { findContacts } = useContacts()
    const { readText } = useClipboard()
    const accounts = useAllAccounts()

    const addressIsValid = useMemo(() => isValidAlgorandAddress(value), [value])

    // Re-read on focus rather than once on mount: the user leaves to copy an
    // address and comes back, which is the whole point of the affordance. Mirrors
    // the native `onResume` re-read.
    useFocusEffect(
        useCallback(() => {
            if (!showClipboardPaste) return
            let isActive = true
            void readText().then(text => {
                if (!isActive) return
                setClipboardAddress(isValidAlgorandAddress(text) ? text : null)
            })
            return () => {
                isActive = false
            }
        }, [showClipboardPaste, readText]),
    )

    const debouncedValue = useDebouncedValue(value, SEARCH_DEBOUNCE_TIME)
    const shouldSearchNfd = debouncedValue.includes('.') && !addressIsValid
    const { data: nfdData, isLoading: isNfdLoading } = useNfdSearchQuery(
        debouncedValue,
        { enabled: shouldSearchNfd },
    )
    const nfdResults = useMemo(() => nfdData ?? [], [nfdData])

    const matchingAccounts = useMemo(
        () =>
            addressIsValid
                ? []
                : accounts.filter(
                      a =>
                          a.address !== excludeAddress &&
                          (!excludeTypes || !excludeTypes.includes(a.type)) &&
                          (!value?.length ||
                              a.address
                                  .toLowerCase()
                                  .includes(value.toLowerCase()) ||
                              a.name
                                  ?.toLowerCase()
                                  .includes(value.toLowerCase())),
                  ),
        [value, accounts, excludeAddress, excludeTypes, addressIsValid],
    )

    const matchingContacts = useMemo(() => {
        if (addressIsValid) return []
        if (!value.length && !showAllContactsWhenEmpty) return []
        // A contact must not appear under "Contacts" if its address is:
        // - any wallet account (so an account saved as a contact only shows under "My Accounts")
        // - the explicitly-excluded address (e.g. the FROM account in a send flow)
        const excludedAddresses = new Set(accounts.map(a => a.address))
        if (excludeAddress) excludedAddresses.add(excludeAddress)
        return findContacts({ keyword: value }).filter(
            c => !excludedAddresses.has(c.address),
        )
    }, [
        value,
        findContacts,
        addressIsValid,
        showAllContactsWhenEmpty,
        accounts,
        excludeAddress,
    ])

    const matchingItems = useMemo(() => {
        const items: AddressSearchItem[] = []

        // First row, and deliberately not gated on the query or deduped against
        // the user's own accounts — matches native.
        if (clipboardAddress) {
            items.push({
                type: 'paste',
                address: clipboardAddress,
                key: `paste-${clipboardAddress}`,
            })
        }

        if (addressIsValid) {
            const ownAccount = accounts.find(a => a.address === value)
            items.push({
                type: 'section_header',
                title: 'address_entry.address',
                key: 'header-address',
            })
            if (ownAccount) {
                items.push({
                    type: 'account',
                    account: ownAccount,
                    key: `address-${value}-${items.length}`,
                })
            } else {
                items.push({
                    type: 'address',
                    address: value,
                    key: `address-${value}-${items.length}`,
                })
            }
        }

        if (nfdResults.length > 0) {
            items.push({
                type: 'section_header',
                title: 'address_entry.nfd_results',
                key: 'header-nfd',
            })
            for (const nfd of nfdResults) {
                items.push({
                    type: 'nfd',
                    nfd,
                    key: `nfd-${nfd.name}-${items.length}`,
                })
            }
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
                    key: `account-${a.address}-${items.length}`,
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
                    key: `contact-${c.address}-${items.length}`,
                })
            }
        }

        return items
    }, [
        addressIsValid,
        value,
        accounts,
        matchingAccounts,
        matchingContacts,
        nfdResults,
        clipboardAddress,
    ])

    const hasResults = matchingItems.length > 0

    return {
        value,
        setValue,
        matchingItems,
        hasResults,
        isNfdLoading,
    }
}
