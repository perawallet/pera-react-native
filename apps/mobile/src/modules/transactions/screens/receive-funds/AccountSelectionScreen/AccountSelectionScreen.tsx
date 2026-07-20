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

import { useCallback } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import {
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { AccountPicker } from '@modules/accounts/components/AccountPicker'
import { useReceiveFunds } from '@modules/transactions/hooks'

import type { ReceiveFundsStackParamList } from '../../../routes/receive-funds/types'

export const AccountSelectionScreen = () => {
    const accounts = useAllAccounts()
    const { setSelectedAccount } = useReceiveFunds()
    const navigation =
        useNavigation<StackNavigationProp<ReceiveFundsStackParamList>>()

    const handleSelected = useCallback(
        (account: WalletAccount) => {
            setSelectedAccount(account)
            navigation.navigate('QRView')
        },
        [navigation, setSelectedAccount],
    )

    return (
        <AccountPicker
            accounts={accounts}
            onSelect={handleSelected}
            rowTestIDPrefix='receive_account_row'
        />
    )
}
