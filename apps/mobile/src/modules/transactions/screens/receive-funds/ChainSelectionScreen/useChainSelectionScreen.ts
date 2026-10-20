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

import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import {
    useAccountChainOptionsResolver,
    useEnableChain,
    type AccountChainOption,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import type { Optional } from '@perawallet/wallet-core-shared'
import { bottomSheetNotifier } from '@components/core'
import { useErrorToast } from '@hooks/useErrorToast'
import { useIsMounted } from '@hooks/useIsMounted'
import { useLanguage } from '@hooks/useLanguage'
import { useReceiveFunds } from '@modules/transactions/hooks'

import type { ReceiveFundsStackParamList } from '../../../routes/receive-funds/types'

export type ReceiveChainRow = AccountChainOption & { displayName: string }

export type UseChainSelectionScreenResult = {
    rows: ReceiveChainRow[]
    /** The chain being enabled while its address is derived; unset otherwise. */
    enablingChainId: Optional<ChainId>
    handleSelectChain: (chainId: ChainId) => void
}

export const useChainSelectionScreen = (): UseChainSelectionScreenResult => {
    const { selectedAccount, setSelectedAccount, setChainId } =
        useReceiveFunds()
    const navigation =
        useNavigation<StackNavigationProp<ReceiveFundsStackParamList>>()
    const optionsOf = useAccountChainOptionsResolver('receive')
    const enableChain = useEnableChain()
    const { showError } = useErrorToast()
    const { t } = useLanguage()
    const isMounted = useIsMounted()
    const [enablingChainId, setEnablingChainId] = useState<Optional<ChainId>>()
    // State lags a second tap that lands before the re-render.
    const isEnablingRef = useRef(false)

    const rows = useMemo(
        (): ReceiveChainRow[] =>
            selectedAccount
                ? optionsOf(selectedAccount).map(option => ({
                      ...option,
                      displayName:
                          chainDisplayNameOf(option.chainId) ?? option.chainId,
                  }))
                : [],
        [selectedAccount, optionsOf],
    )
    const rowByChain = useMemo(
        () => new Map(rows.map(row => [row.chainId, row])),
        [rows],
    )

    const handleSelectChain = useCallback(
        (chainId: ChainId) => {
            const row = rowByChain.get(chainId)
            if (!selectedAccount || !row || isEnablingRef.current) return
            if (row.isEnabled) {
                setChainId(chainId)
                navigation.navigate('QRView')
                return
            }
            isEnablingRef.current = true
            setEnablingChainId(chainId)
            void (async () => {
                try {
                    const account = await enableChain(
                        selectedAccount.id,
                        chainId,
                        'user',
                    )
                    if (!isMounted()) return
                    setSelectedAccount(account)
                    setChainId(chainId)
                    navigation.navigate('QRView')
                } catch (error) {
                    if (!isMounted()) return
                    showError(error, t('errors.general.title'), {
                        notifier: bottomSheetNotifier.current ?? undefined,
                    })
                } finally {
                    isEnablingRef.current = false
                    if (isMounted()) setEnablingChainId(undefined)
                }
            })()
        },
        [
            rowByChain,
            selectedAccount,
            setSelectedAccount,
            setChainId,
            navigation,
            enableChain,
            isMounted,
            showError,
            t,
        ],
    )

    return { rows, enablingChainId, handleSelectChain }
}
