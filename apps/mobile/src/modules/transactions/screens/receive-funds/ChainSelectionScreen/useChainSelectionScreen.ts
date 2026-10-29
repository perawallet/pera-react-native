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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useReceiveFunds } from '@modules/transactions/hooks'

import {
    useAccountChainSelection,
    type UseAccountChainSelectionResult,
} from '@modules/transactions/hooks/chain-selection/useAccountChainSelection'
import type { ReceiveFundsStackParamList } from '@modules/transactions/routes/receive-funds/types'

export type UseChainSelectionScreenResult = UseAccountChainSelectionResult

export const useChainSelectionScreen = (): UseChainSelectionScreenResult => {
    const { selectedAccount, setSelectedAccount, setChainId } =
        useReceiveFunds()
    const navigation =
        useNavigation<StackNavigationProp<ReceiveFundsStackParamList>>()

    const handleSelectChain = useCallback(
        (chainId: ChainId) => {
            setChainId(chainId)
            navigation.navigate('QRView')
        },
        [setChainId, navigation],
    )

    // The receive store holds a copy of the account, so swap in the one that holds the added chain.
    return useAccountChainSelection({
        account: selectedAccount,
        capability: 'receive',
        onSelectChain: handleSelectChain,
        onChainEnabled: setSelectedAccount,
    })
}
