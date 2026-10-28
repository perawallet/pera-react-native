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

import { useMemo } from 'react'
import {
    canSignWith,
    chainAccountOf,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import { useContactsStore } from '@perawallet/wallet-core-contacts'
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    useTrustedCounterpartiesQuery,
    type KnownAddress,
} from '@perawallet/wallet-core-transactions'

export type UseKnownAddressesParams = {
    scope: ChainScope
    /** Only this account's history counts toward `isPending`; the others are best effort. */
    senderAddress: Optional<string>
    /** Gates the history read; wallet and contact addresses are always known. */
    isEnabled: boolean
    /**
     * Reads only the sender's own history instead of every signing account's,
     * for screens opened too often to pay a full history read per account.
     */
    isSenderHistoryOnly?: boolean
}

export type UseKnownAddressesResult = {
    knownAddresses: KnownAddress[]
    isPending: boolean
    /** False when the sender's history failed, timed out or waits offline. */
    hasSenderHistory: boolean
}

export const useKnownAddresses = ({
    scope,
    senderAddress,
    isEnabled,
    isSenderHistoryOnly = false,
}: UseKnownAddressesParams): UseKnownAddressesResult => {
    const accounts = useAllAccounts()
    const contacts = useContactsStore(state => state.contacts)

    // Every wallet address is one the user compares by its ends, but only the
    // ones they sign for vouch for their counterparties: a watched address's
    // history would make a stranger's payees look trusted.
    const walletAddresses = useMemo<KnownAddress[]>(
        () =>
            accounts.flatMap(account => {
                const address = chainAccountOf(account, scope.chainId)?.address
                if (!address) return []
                return [
                    {
                        address,
                        source: canSignWith(account, accounts, scope.chainId)
                            ? 'own-account'
                            : 'watched-account',
                        name: account.name,
                    },
                ]
            }),
        [accounts, scope.chainId],
    )

    const contactAddresses = useMemo<KnownAddress[]>(() => {
        const { family } = getChainDescriptor(scope.chainId)
        return contacts.flatMap(contact => {
            const address = contact.addresses[family]
            return address
                ? [{ address, source: 'contact', name: contact.name }]
                : []
        })
    }, [contacts, scope.chainId])

    const accountAddresses = useMemo(() => {
        const codec = addressCodecs.has(scope.chainId)
            ? addressCodecs.get(scope.chainId)
            : undefined
        const isRead = (address: string) =>
            !isSenderHistoryOnly ||
            (!!senderAddress && !!codec?.areEqual(address, senderAddress))
        return walletAddresses.flatMap(({ address, source }) =>
            source === 'own-account' && isRead(address) ? [address] : [],
        )
    }, [walletAddresses, isSenderHistoryOnly, senderAddress, scope.chainId])
    const {
        data: counterparties,
        isPending,
        hasSenderHistory,
    } = useTrustedCounterpartiesQuery({
        senderAddress,
        accountAddresses,
        scope,
        isEnabled,
    })

    const knownAddresses = useMemo(
        () => [
            ...walletAddresses,
            ...contactAddresses,
            ...counterparties.map(({ address, hasBeenPaid }): KnownAddress => ({
                address,
                source: 'history',
                isInboundOnly: !hasBeenPaid,
            })),
        ],
        [walletAddresses, contactAddresses, counterparties],
    )

    return { knownAddresses, isPending, hasSenderHistory }
}
