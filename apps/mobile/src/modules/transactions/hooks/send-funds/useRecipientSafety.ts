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

import { useCallback, useMemo } from 'react'
import {
    canSignWith,
    chainAccountOf,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import { useContactsStore } from '@perawallet/wallet-core-contacts'
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    assessRecipient,
    useTrustedCounterpartiesQuery,
    type KnownAddress,
    type RecipientAssessment,
} from '@perawallet/wallet-core-transactions'
import { useSendFundsStore } from './useSendFunds'

export type UseRecipientSafetyResult = {
    assessment: Optional<RecipientAssessment>
    isPending: boolean
    isAcknowledged: boolean
    toggleAcknowledged: () => void
    isConfirmBlocked: boolean
}

export const useRecipientSafety = ({
    recipient,
    senderAddress,
    scope,
}: {
    recipient: Optional<string>
    /** Only this account's history holds Confirm; the others are best effort. */
    senderAddress: Optional<string>
    scope: ChainScope
}): UseRecipientSafetyResult => {
    const accounts = useAllAccounts()
    const contacts = useContactsStore(state => state.contacts)
    const isAcknowledged = useSendFundsStore(
        state => state.isRecipientAcknowledged,
    )
    const setIsRecipientAcknowledged = useSendFundsStore(
        state => state.setIsRecipientAcknowledged,
    )

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

    const accountAddresses = useMemo(
        () =>
            walletAddresses.flatMap(({ address, source }) =>
                source === 'own-account' ? [address] : [],
            ),
        [walletAddresses],
    )
    const {
        data: counterparties,
        isPending,
        hasSenderHistory,
    } = useTrustedCounterpartiesQuery({
        senderAddress,
        accountAddresses,
        scope,
        isEnabled: !!recipient,
    })

    const assessment = useMemo(() => {
        if (!recipient || isPending) return undefined
        const result = assessRecipient({
            recipient,
            chainId: scope.chainId,
            knownAddresses: [
                ...walletAddresses,
                ...contactAddresses,
                ...counterparties.map(
                    ({ address, hasBeenPaid }): KnownAddress => ({
                        address,
                        source: 'history',
                        isInboundOnly: !hasBeenPaid,
                    }),
                ),
            ],
        })
        // Without the sender's history a regular payee looks new, and a false
        // "never sent" notice teaches people to ignore it.
        return result.kind === 'first-send' && !hasSenderHistory
            ? undefined
            : result
    }, [
        recipient,
        isPending,
        hasSenderHistory,
        scope.chainId,
        walletAddresses,
        contactAddresses,
        counterparties,
    ])

    const toggleAcknowledged = useCallback(
        () => setIsRecipientAcknowledged(!isAcknowledged),
        [isAcknowledged, setIsRecipientAcknowledged],
    )

    return {
        assessment,
        isPending: !!recipient && isPending,
        isAcknowledged,
        toggleAcknowledged,
        isConfirmBlocked:
            (!!recipient && isPending) ||
            (assessment?.kind === 'look-alike' && !isAcknowledged),
    }
}
