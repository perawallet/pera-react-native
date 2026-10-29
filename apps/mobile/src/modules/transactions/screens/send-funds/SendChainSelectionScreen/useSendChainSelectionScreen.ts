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

import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useSendFunds } from '@modules/transactions/hooks'

import {
    useAccountChainSelection,
    type UseAccountChainSelectionResult,
} from '../../../hooks/chain-selection/useAccountChainSelection'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'

export const useSendChainSelectionScreen =
    (): UseAccountChainSelectionResult => {
        const account = useSelectedAccount()
        const { setSelectedAsset, setChainId } = useSendFunds()
        const navigation =
            useNavigation<StackNavigationProp<SendFundsStackParamList>>()

        const handleSelectChain = useCallback(
            (chainId: ChainId) => {
                // An asset picked before going back would otherwise keep the send on its chain.
                setSelectedAsset(undefined)
                setChainId(chainId)
                navigation.navigate('AssetSelection')
            },
            [setSelectedAsset, setChainId, navigation],
        )

        return useAccountChainSelection({
            account: account ?? undefined,
            capability: 'send',
            onSelectChain: handleSelectChain,
        })
    }
