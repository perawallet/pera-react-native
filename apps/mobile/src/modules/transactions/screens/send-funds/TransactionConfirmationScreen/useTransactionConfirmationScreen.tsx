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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Decimal } from 'decimal.js'
import { bottomSheetNotifier } from '@components/core'
import { useToast } from '@hooks/useToast'
import { useSendFunds } from '@modules/transactions/hooks'
import { useBottomSheet } from '@modules/bottom-sheet'
import { AddNoteContent } from '../../../components/send-funds/AddNoteContent'
import {
    useAccountAssetBalanceQuery,
    useOnChainAccountInformationQuery,
    useSelectedAccount,
    type AssetWithAccountBalance,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    ALGO_ASSET,
    ALGO_ASSET_ID,
    isCollectible,
    toWholeUnits,
    useAssetsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    displayUnitsToBaseUnits,
    useSuggestedParametersQuery,
} from '@perawallet/wallet-core-blockchain'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'
import { useLanguage } from '@hooks/useLanguage'
import type { Maybe, Nullable, Optional } from '@perawallet/wallet-core-shared'

type useTransactionConfirmationScreenResult = {
    asset: Maybe<PeraAsset>
    amount: Optional<Decimal>
    destination: Optional<string>
    selectedAccount: Nullable<WalletAccount>
    selectedAssetId: Optional<string>
    params: Optional<{ minFee: bigint }>
    paramsPending: boolean
    currentBalance: Nullable<AssetWithAccountBalance>
    currentBalancePending: boolean
    note: Optional<string>
    openNote: () => void
    handleConfirm: () => void
    isCollectible: boolean
    isReady: boolean
    isCloseAccount: boolean
    isRecipientBelowMbr: boolean
    recipientMbrDisplay: string
    isRecipientInfoPending: boolean
    /**
     * True while a signing attempt is in flight (the user slid to confirm
     * and we're inside `TransactionProcessing`). Flips back to false when
     * the screen regains focus, which happens after a failed signing
     * `navigation.goBack()` — resetting the slide-to-confirm thumb to its
     * idle position so the user can retry.
     */
    isSigning: boolean
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
        const { request: requestBottomSheet } = useBottomSheet()

        const { data: params, isPending: paramsPending } =
            useSuggestedParametersQuery()

        const openNote = useCallback(() => {
            void requestBottomSheet({
                contents: <AddNoteContent />,
                options: { size: 'auto', enablePanDownToClose: true },
            })
        }, [requestBottomSheet])

        const { data: currentBalance, isPending: currentBalancePending } =
            useAccountAssetBalanceQuery(
                selectedAccount ?? undefined,
                selectedAssetId,
            )

        const isAlgoSend = selectedAssetId === ALGO_ASSET_ID
        const {
            data: recipientAccountInfo,
            isPending: recipientAccountInfoPending,
        } = useOnChainAccountInformationQuery(
            isAlgoSend ? (destination ?? '') : '',
        )
        const isRecipientInfoPending =
            isAlgoSend && !!destination && recipientAccountInfoPending

        const { isRecipientBelowMbr, recipientMbrDisplay } = useMemo(() => {
            const mbr = recipientAccountInfo?.minBalance ?? 0n
            const mbrDisplay = toWholeUnits(mbr, ALGO_ASSET).toString()
            if (!isAlgoSend || !amount || !recipientAccountInfo) {
                return {
                    isRecipientBelowMbr: false,
                    recipientMbrDisplay: mbrDisplay,
                }
            }
            const amountInMicroAlgos = BigInt(
                displayUnitsToBaseUnits(amount, ALGO_ASSET.decimals).toString(),
            )
            const recipientBalanceAfter =
                recipientAccountInfo.amount + amountInMicroAlgos
            return {
                isRecipientBelowMbr:
                    recipientBalanceAfter < recipientAccountInfo.minBalance,
                recipientMbrDisplay: mbrDisplay,
            }
        }, [isAlgoSend, amount, recipientAccountInfo])

        const [isSigning, setIsSigning] = useState(false)
        const isFocused = useIsFocused()
        // The screen loses focus on `navigation.navigate('TransactionProcessing')`
        // and regains it on `navigation.goBack()` (i.e. signing failed).
        // Use that signal to reset the slide-to-confirm thumb — its internal
        // useEffect resets `translateX` when its `isLoading` prop flips back
        // to false (see PWSlideToConfirm/usePWSlideToConfirm.ts).
        useEffect(() => {
            if (isFocused) {
                setIsSigning(false)
            }
        }, [isFocused])

        const handleConfirm = () => {
            if (isRecipientInfoPending) {
                return
            }

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

            if (isRecipientBelowMbr) {
                showToast(
                    {
                        title: t(
                            'send_funds.confirmation.recipient_below_mbr.title',
                        ),
                        body: t(
                            'send_funds.confirmation.recipient_below_mbr.body',
                            { min: recipientMbrDisplay },
                        ),
                        type: 'error',
                    },
                    {
                        notifier: bottomSheetNotifier.current ?? undefined,
                    },
                )
                return
            }

            setIsSigning(true)
            navigation.navigate('TransactionProcessing')
        }

        const isReady = !!(
            selectedAccount &&
            selectedAssetId &&
            amount &&
            asset
        )

        const isCollectibleAsset = asset ? isCollectible(asset) : false

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
            openNote,
            handleConfirm,
            isCollectible: isCollectibleAsset,
            isReady,
            isCloseAccount,
            isRecipientBelowMbr,
            recipientMbrDisplay,
            isRecipientInfoPending,
            isSigning,
        }
    }
