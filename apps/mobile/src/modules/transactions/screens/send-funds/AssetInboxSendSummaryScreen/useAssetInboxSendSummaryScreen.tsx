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

import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import { Decimal } from 'decimal.js'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import {
    useAssetInboxSendSummaryQuery,
    useSpendableBalanceQuery,
    type AssetInboxSendSummary,
} from '@perawallet/wallet-core-transactions'
import {
    chainAccountOf,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import {
    formatAssetAmount,
    useNativeAsset,
    type PeraAsset,
    toWholeUnits,
    useSingleAssetDetailsQuery,
} from '@perawallet/wallet-core-assets'
import {
    generateOrderedUniqueId,
    isIntegrityRequiredError,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { config } from '@perawallet/wallet-core-config'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useWebView } from '@modules/webview'
import {
    useRecipientSafety,
    useSendFunds,
    useSendScope,
    type UseRecipientSafetyResult,
} from '@modules/transactions/hooks'
import { AssetInboxWarningContent } from '@modules/transactions/components/send-funds/AssetInboxWarningContent'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'
import LightHeaderImage from '@assets/images/asset-inbox-send-light.svg'
import DarkHeaderImage from '@assets/images/asset-inbox-send-dark.svg'
import { useThemeMode } from '@rneui/themed'
import type { SvgProps } from 'react-native-svg'

type UseAssetInboxSendSummaryScreenResult = {
    summary?: AssetInboxSendSummary
    isLoading: boolean
    isUnavailableOnNetwork: boolean
    isIntegrityBlocked: boolean
    assetId: string
    recipientAddress: string
    scope: ChainScope
    recipientSafety: UseRecipientSafetyResult
    amount: Nullable<Decimal>
    /** Display units of the native asset. */
    fee: Nullable<Decimal>
    nativeAsset: PeraAsset
    asset: Nullable<PeraAsset>
    HeaderImageComponent: FC<SvgProps>
    handleSend: () => void
    handleClose: () => void
    handleReadMore: () => void
    isProcessing: boolean
}

export const useAssetInboxSendSummaryScreen =
    (): UseAssetInboxSendSummaryScreenResult => {
        const scope = useSendScope()
        const nativeAsset = useNativeAsset(scope)
        const navigation =
            useNavigation<StackNavigationProp<SendFundsStackParamList>>()
        const { selectedAssetId, destination, amount, setAssetInboxQuote } =
            useSendFunds()
        const selectedAccount = useSelectedAccount()
        const { request: requestBottomSheet } = useBottomSheet()
        const { pushWebView } = useWebView()
        const { mode } = useThemeMode()

        const assetId = selectedAssetId ?? ''
        const receiverAddress = destination ?? ''
        const recipientSafety = useRecipientSafety({
            recipient: destination,
            senderAddress: selectedAccount
                ? chainAccountOf(selectedAccount, scope.chainId)?.address
                : undefined,
            scope,
        })

        const {
            data: summaryData,
            isLoading: summaryLoading,
            isError: isSummaryError,
            error: summaryError,
            isUnavailableOnNetwork,
        } = useAssetInboxSendSummaryQuery(scope, receiverAddress, assetId)
        const isIntegrityBlocked =
            isSummaryError && isIntegrityRequiredError(summaryError)
        // Query data is Maybe<T> (null while unavailable); this screen only
        // distinguishes "have a summary" from "don't", so collapse to undefined.
        const summary = summaryData ?? undefined

        const { data: asset, isLoading: assetLoading } =
            useSingleAssetDetailsQuery(assetId, scope)

        // No fee: the inbox quote's funding amount already covers the group.
        const spendableInput = useMemo(
            () =>
                selectedAccount
                    ? {
                          account: selectedAccount,
                          asset: {
                              chainId: scope.chainId,
                              assetId: nativeAsset.assetId,
                          },
                          scope,
                          fee: new Decimal(0),
                      }
                    : undefined,
            [selectedAccount, scope, nativeAsset.assetId],
        )
        const { data: spendable } = useSpendableBalanceQuery(spendableInput)

        const isLoading = summaryLoading || assetLoading
        const headerImage = mode === 'dark' ? DarkHeaderImage : LightHeaderImage

        useEffect(() => {
            if (!summary || !spendable) return

            // Gate on the amount actually signed, not any other fee the
            // backend quotes.
            const required = new Decimal(summary.fundingAmount.toString())

            if (spendable.max.lt(required)) {
                navigation.replace('InsufficientBalance', {
                    requiredBalanceLabel: formatAssetAmount(
                        required,
                        nativeAsset,
                    ),
                })
            }
        }, [summary, spendable, navigation, nativeAsset])

        useEffect(() => {
            if (summary) {
                setAssetInboxQuote(summary.quote)
            }
        }, [summary, setAssetInboxQuote])

        const fee = summary
            ? toWholeUnits(summary.fundingAmount, nativeAsset)
            : null

        const [isProcessing, setIsProcessing] = useState(false)

        // Returning to this screen (e.g. after the send fails on the processing
        // screen) unlocks the slider so the user can try again.
        useFocusEffect(
            useCallback(() => {
                setIsProcessing(false)
            }, []),
        )

        const showWarningSheet = useCallback(async () => {
            // Hold the slider in its slid/loading state while the warning sheet
            // is open and through to the processing screen; only return it to
            // idle if the user backs out (dismisses the warning).
            setIsProcessing(true)
            const result = await requestBottomSheet<'confirm'>({
                contents: <AssetInboxWarningContent />,
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (result === 'confirm') {
                navigation.navigate('TransactionProcessing')
            } else {
                setIsProcessing(false)
            }
        }, [requestBottomSheet, navigation])

        const handleSend = useCallback(() => {
            if (recipientSafety.isConfirmBlocked) return
            void showWarningSheet()
        }, [recipientSafety.isConfirmBlocked, showWarningSheet])

        const handleClose = useCallback(() => {
            navigation.goBack()
        }, [navigation])

        const handleReadMore = useCallback(() => {
            pushWebView({
                id: generateOrderedUniqueId(),
                url: config.assetInboxSupportUrl,
            })
        }, [pushWebView])

        return {
            summary,
            isLoading,
            isUnavailableOnNetwork,
            isIntegrityBlocked,
            assetId,
            recipientAddress: receiverAddress,
            scope,
            recipientSafety,
            fee,
            nativeAsset,
            amount: amount ?? null,
            HeaderImageComponent: headerImage,
            asset: asset ?? null,
            handleSend,
            handleClose,
            handleReadMore,
            isProcessing,
        }
    }
