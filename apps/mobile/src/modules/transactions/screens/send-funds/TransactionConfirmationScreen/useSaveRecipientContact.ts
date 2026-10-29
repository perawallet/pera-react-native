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
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import {
    findAccountByAddressOn,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import {
    findContactByAddress,
    useContacts,
} from '@perawallet/wallet-core-contacts'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { SendFundsStackParamList } from '@modules/transactions/routes/send-funds/types'

export type UseSaveRecipientContactResult = {
    /**
     * The recipient is neither one of the user's accounts nor a contact on its
     * family, and nothing is signing: Add Contact would open over a Ledger or
     * biometric prompt and the send would move on underneath it.
     */
    canSaveRecipient: boolean
    saveRecipient: () => void
}

export const useSaveRecipientContact = (
    destination: Optional<string>,
    scope: ChainScope,
    isSigning: boolean,
): UseSaveRecipientContactResult => {
    const accounts = useAllAccounts()
    const { contacts } = useContacts()
    const navigation =
        useNavigation<StackNavigationProp<SendFundsStackParamList>>()
    const family = getChainDescriptor(scope.chainId).family

    const canSaveRecipient = useMemo(() => {
        if (!destination || isSigning) return false
        if (findAccountByAddressOn(accounts, scope.chainId, destination)) {
            return false
        }
        // The To row resolves its contact by the same rule.
        return !findContactByAddress(contacts, destination, family)
    }, [destination, isSigning, accounts, scope.chainId, contacts, family])

    const saveRecipient = useCallback(() => {
        if (!destination) return
        navigation.navigate('AddContact', {
            address: destination,
            chainId: scope.chainId,
        })
    }, [destination, scope.chainId, navigation])

    return { canSaveRecipient, saveRecipient }
}
