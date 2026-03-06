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
import {
    ALGO_ASSET_ID,
    useAssetsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    displayUnitsToBaseUnits,
    useAccountInformationQuery,
    useSuggestedParametersQuery,
} from '@perawallet/wallet-core-blockchain'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'
import { useLanguage } from '@hooks/useLanguage'

type useTransactionConfirmationScreenResult = {
    asset: PeraAsset | null | undefined
    amount: Decimal | undefined
    destination: string | undefined
    selectedAccount: WalletAccount | null
    selectedAsset: AssetWithAccountBalance | undefined
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
        const { selectedAsset, amount, destination, note, isCloseAccount } =
            useSendFunds()
        const { t } = useLanguage()

        const assetIDs = useMemo(
            () => (selectedAsset?.assetId ? [selectedAsset.assetId] : []),
            [selectedAsset?.assetId],
        )
        const { data: assets } = useAssetsQuery(assetIDs)
        const asset = useMemo(() => {
            if (!selectedAsset?.assetId) return null
            return assets.get(selectedAsset?.assetId)
        }, [selectedAsset, assets])

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
                selectedAsset?.assetId,
            )

        const { data: receiverAccountInfo, isError: receiverQueryError } =
            useAccountInformationQuery(destination ?? '')

        const handleConfirm = () => {
            if (
                !selectedAccount ||
                !selectedAsset ||
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

            // For ALGO payments, check receiver will meet minimum balance.
            // Only validate when we have receiver info or the query errored
            // (account doesn't exist on-chain yet).
            if (
                selectedAsset.assetId === ALGO_ASSET_ID &&
                !isCloseAccount &&
                (receiverAccountInfo || receiverQueryError)
            ) {
                const sendAmountMicroAlgos = BigInt(
                    displayUnitsToBaseUnits(amount, asset.decimals).toString(),
                )
                const receiverBalance = receiverAccountInfo?.amount ?? 0n
                const receiverMinBalance =
                    receiverAccountInfo?.minBalance ?? 100000n
                const receiverPostBalance =
                    receiverBalance + sendAmountMicroAlgos

                if (receiverPostBalance < receiverMinBalance) {
                    showToast(
                        {
                            title: t(
                                'send_funds.confirmation.receiver_min_balance_title',
                            ),
                            body: t(
                                'send_funds.confirmation.receiver_min_balance_body',
                            ),
                            type: 'error',
                        },
                        {
                            notifier: bottomSheetNotifier.current ?? undefined,
                        },
                    )
                    return
                }
            }

            navigation.navigate('TransactionProcessing')
        }

        const isReady = !!(selectedAccount && selectedAsset && amount && asset)

        return {
            asset,
            amount,
            destination,
            selectedAccount,
            selectedAsset,
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
