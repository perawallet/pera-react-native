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
    useAccountChainOptionsResolver,
    type AccountChainOption,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useEnableChainAction } from '@hooks/useEnableChainAction'
import { useLanguage } from '@hooks/useLanguage'
import {
    displayChainOption,
    type DisplayedChainOption,
} from '@utils/chainOptionDisplay'
import { useReceiveFunds } from '@modules/transactions/hooks'

import type { ReceiveFundsStackParamList } from '../../../routes/receive-funds/types'

/** `address` is truncated by the chain's codec for display. */
export type ReceiveChainRow = DisplayedChainOption<AccountChainOption>

export type UseChainSelectionScreenResult = {
    rows: ReceiveChainRow[]
    /** The chain being enabled while its address is derived; unset otherwise. */
    enablingChainId: Optional<ChainId>
    handleSelectChain: (chainId: ChainId) => void
    handleAddChain: (chainId: ChainId) => void
}

export const useChainSelectionScreen = (): UseChainSelectionScreenResult => {
    const { selectedAccount, setSelectedAccount, setChainId } =
        useReceiveFunds()
    const navigation =
        useNavigation<StackNavigationProp<ReceiveFundsStackParamList>>()
    const optionsOf = useAccountChainOptionsResolver('receive')
    const { t } = useLanguage()
    const { enablingChainId, enableChain } = useEnableChainAction(
        t('errors.general.title'),
    )

    const rows = useMemo(
        (): ReceiveChainRow[] =>
            selectedAccount
                ? optionsOf(selectedAccount).map(displayChainOption)
                : [],
        [selectedAccount, optionsOf],
    )
    const rowByChain = useMemo(
        () => new Map(rows.map(row => [row.chainId, row])),
        [rows],
    )

    const handleSelectChain = useCallback(
        (chainId: ChainId) => {
            if (!rowByChain.get(chainId)?.isEnabled) return
            setChainId(chainId)
            navigation.navigate('QRView')
        },
        [rowByChain, setChainId, navigation],
    )

    const handleAddChain = useCallback(
        (chainId: ChainId) => {
            const row = rowByChain.get(chainId)
            if (!selectedAccount || !row || row.isEnabled) return
            enableChain(selectedAccount.id, chainId, setSelectedAccount)
        },
        [rowByChain, selectedAccount, setSelectedAccount, enableChain],
    )

    return { rows, enablingChainId, handleSelectChain, handleAddChain }
}
