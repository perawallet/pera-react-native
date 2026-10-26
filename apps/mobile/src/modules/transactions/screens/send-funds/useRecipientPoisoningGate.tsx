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
    addressOn,
    useAllAccounts,
    useSigningAccounts,
} from '@perawallet/wallet-core-accounts'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import {
    useAddressPoisoningQuery,
    type AddressPoisoningRisk,
} from '@perawallet/wallet-core-transactions'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useSendScope } from '@modules/transactions/hooks'
import {
    AddressPoisoningWarningContent,
    type AddressPoisoningDecision,
} from '../../components/send-funds/AddressPoisoningWarningContent'

type UseRecipientPoisoningGateResult = {
    /** False when the user backed out of the warning. */
    screenRecipient: (address: string) => Promise<boolean>
    isScreeningRecipient: boolean
}

export const useRecipientPoisoningGate =
    (): UseRecipientPoisoningGateResult => {
        const scope = useSendScope()
        const accounts = useAllAccounts()
        const signingAccounts = useSigningAccounts(scope.chainId)
        const { contacts } = useContacts()
        const { assessRecipient } = useAddressPoisoningQuery()
        const { request } = useBottomSheet()
        const [isScreeningRecipient, setIsScreeningRecipient] = useState(false)

        const ownAddresses = useMemo(
            () => accounts.flatMap(account => addressOn(account, scope) ?? []),
            [accounts, scope],
        )
        // A watch account's payees aren't the user's: counting them would
        // wave through every address a watched exchange ever paid.
        const senders = useMemo(
            () =>
                signingAccounts.flatMap(
                    account => addressOn(account, scope) ?? [],
                ),
            [signingAccounts, scope],
        )
        const contactAddresses = useMemo(() => {
            const family = getChainDescriptor(scope.chainId).family
            return contacts.flatMap(contact => contact.addresses[family] ?? [])
        }, [contacts, scope.chainId])

        const screenRecipient = useCallback(
            async (address: string) => {
                setIsScreeningRecipient(true)
                let risk: Nullable<AddressPoisoningRisk>
                try {
                    risk = await assessRecipient({
                        recipient: address,
                        scope,
                        ownAddresses,
                        senders,
                        contactAddresses,
                    })
                } catch (error) {
                    // A warning, never a gate the send can't pass.
                    logger.warn('address poisoning: screening failed', {
                        error,
                    })
                    return true
                } finally {
                    setIsScreeningRecipient(false)
                }
                if (!risk) return true

                const decision = await request<AddressPoisoningDecision>({
                    contents: (
                        <AddressPoisoningWarningContent
                            recipient={address}
                            risk={risk}
                            scope={scope}
                        />
                    ),
                    options: { size: 'auto' },
                })
                return decision === 'continue'
            },
            [
                assessRecipient,
                scope,
                ownAddresses,
                senders,
                contactAddresses,
                request,
            ],
        )

        return { screenRecipient, isScreeningRecipient }
    }
