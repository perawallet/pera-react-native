/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useMemo, useState } from 'react'
import Decimal from 'decimal.js'
import { bottomSheetNotifier } from '@components/core'
import { useToast } from '@hooks/useToast'
import { useSendFunds } from '@modules/transactions/hooks'
import {
    useAccountAssetBalanceQuery,
    useSelectedAccount,
    type AssetWithAccountBalance,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useAssetsQuery, type PeraAsset } from '@perawallet/wallet-core-assets'
import { useSuggestedParametersQuery } from '@perawallet/wallet-core-blockchain'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'
import { useLanguage } from '@hooks/useLanguage'

type useTransactionConfirmationScreenResult = {
    asset: PeraAsset | null | undefined
    amount: Decimal | undefined
    destination: string | undefined
    selectedAccount: WalletAccount | null
    selectedAssetId: string | undefined
    params: { minFee: bigint } | undefined
    paramsPending: boolean
    currentBalance: AssetWithAccountBalance | null
    currentBalancePending: boolean
    note: string | undefined
    noteOpen: boolean
    openNote: () => void
    closeNote: () => void
    handleConfirm: () => void
    isReady: boolean
    isCloseAccount: boolean
}

export const useTransactionConfirmationScreen =
    (): useTransactionConfirmationScreenResult => {
        const navigation =
            useNavigation<StackNavigationProp<SendFundsStackParamList>>()
        const { selectedAssetId, amount, destination, note, isCloseAccount } =
            useSendFunds()
        const { t } = useLanguage()

        const assetIDs = useMemo(
            () => (selectedAssetId ? [selectedAssetId] : []),
            [selectedAssetId],
        )
        const { data: assets } = useAssetsQuery(assetIDs)
        const asset = useMemo(() => {
            if (!selectedAssetId) return null
            return assets.get(selectedAssetId)
        }, [selectedAssetId, assets])

        const selectedAccount = useSelectedAccount()
        const { showToast } = useToast()
        const [noteOpen, setNoteOpen] = useState(false)

        const { data: params, isPending: paramsPending } =
            useSuggestedParametersQuery()

        const openNote = () => {
            setNoteOpen(true)
        }

        const closeNote = () => {
            setNoteOpen(false)
        }

        const { data: currentBalance, isPending: currentBalancePending } =
            useAccountAssetBalanceQuery(
                selectedAccount ?? undefined,
                selectedAssetId,
            )

        const handleConfirm = () => {
            if (
                !selectedAccount ||
                !selectedAssetId ||
                !destination ||
                !amount ||
                !asset
            ) {
                showToast(
                    {
                        title: t('errors.transaction.title'),
                        body: t('errors.transaction.body'),
                        type: 'error',
                    },
                    {
                        notifier: bottomSheetNotifier.current ?? undefined,
                    },
                )
                return
            }

            navigation.navigate('TransactionProcessing')
        }

        const isReady = !!(
            selectedAccount &&
            selectedAssetId &&
            amount &&
            asset
        )

        return {
            asset,
            amount,
            destination,
            selectedAccount,
            selectedAssetId,
            params,
            paramsPending,
            currentBalance,
            currentBalancePending,
            note,
            noteOpen,
            openNote,
            closeNote,
            handleConfirm,
            isReady,
            isCloseAccount,
        }
    }
