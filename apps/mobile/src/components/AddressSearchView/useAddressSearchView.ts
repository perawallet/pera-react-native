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
import {
    LEGACY_CHAIN_ID,
    type ChainFamily,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { useContacts, type Contact } from '@perawallet/wallet-core-contacts'
import {
    addressOn,
    findAddressHolder,
    useAccountValueTotalsQuery,
    useAllAccounts,
    useSortedAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-chain-algorand/blockchain'
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
    /** `address` is the contact's entry in the searched family. */
    | { type: 'contact'; contact: Contact; address: string; key: string }
    | { type: 'nfd'; nfd: NfdSearchResult; key: string }
    | { type: 'address'; address: string; key: string }
    | { type: 'paste'; address: string; key: string }

type UseAddressSearchViewProps = {
    /** Only contacts holding an address in this family are offered. */
    chainFamily: ChainFamily
    excludeAddress?: string
    /** Only accounts passing this predicate are offered. */
    accountFilter?: (account: WalletAccount) => boolean
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

export const useAddressSearchView = ({
    chainFamily,
    excludeAddress,
    accountFilter,
    showAllContactsWhenEmpty = false,
    showClipboardPaste = false,
}: UseAddressSearchViewProps): UseAddressSearchViewResult => {
    const [value, setValue] = useState('')
    const [clipboardAddress, setClipboardAddress] =
        useState<Nullable<string>>(null)
    const { findContacts } = useContacts()
    const { readText } = useClipboard()
    const allAccounts = useAllAccounts()
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const { accountValueTotals } = useAccountValueTotalsQuery(
        allAccounts,
        scope,
    )
    // The switcher and the sort sheet render the user's chosen account order,
    // so the picker has to sort too — otherwise the same accounts read in a
    // different order here than everywhere else in the app.
    const { sortedAccounts: accounts } = useSortedAccounts(
        allAccounts,
        accountValueTotals,
        scope.chainId,
    )

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
                : accounts.filter(a => {
                      const address = addressOn(a, scope) ?? ''
                      return (
                          address !== excludeAddress &&
                          (!accountFilter || accountFilter(a)) &&
                          (!value?.length ||
                              address
                                  .toLowerCase()
                                  .includes(value.toLowerCase()) ||
                              a.name
                                  ?.toLowerCase()
                                  .includes(value.toLowerCase()))
                      )
                  }),
        [value, accounts, excludeAddress, accountFilter, addressIsValid, scope],
    )

    const matchingContacts = useMemo(() => {
        if (addressIsValid) return []
        if (!value.length && !showAllContactsWhenEmpty) return []
        // A contact must not appear under "Contacts" if its address is:
        // - any wallet account (so an account saved as a contact only shows under "My Accounts")
        // - the explicitly-excluded address (e.g. the FROM account in a send flow)
        const excludedAddresses = new Set(
            accounts.flatMap(a => addressOn(a, scope) ?? []),
        )
        if (excludeAddress) excludedAddresses.add(excludeAddress)
        return findContacts({ keyword: value, family: chainFamily }).flatMap(
            contact => {
                const address = contact.addresses[chainFamily]
                return address && !excludedAddresses.has(address)
                    ? [{ contact, address }]
                    : []
            },
        )
    }, [
        value,
        findContacts,
        chainFamily,
        addressIsValid,
        showAllContactsWhenEmpty,
        accounts,
        excludeAddress,
        scope,
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
            const ownAccount = findAddressHolder(accounts, scope, value)
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
                    key: `account-${addressOn(a, scope)}-${items.length}`,
                })
            }
        }

        if (matchingContacts.length > 0) {
            items.push({
                type: 'section_header',
                title: 'address_entry.contacts',
                key: 'header-contacts',
            })
            for (const { contact, address } of matchingContacts) {
                items.push({
                    type: 'contact',
                    contact,
                    address,
                    key: `contact-${address}-${items.length}`,
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
        scope,
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
