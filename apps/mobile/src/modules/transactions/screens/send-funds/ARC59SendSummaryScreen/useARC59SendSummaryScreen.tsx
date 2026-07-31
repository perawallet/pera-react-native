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

import { type FC, useCallback, useEffect, useState } from 'react'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import {
    getArc59SignedFundingAmount,
    useArc59SendSummaryQuery,
    type Arc59SendSummaryResponse,
} from '@perawallet/wallet-core-asa-inbox'
import {
    useAccountInformationQuery,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import {
    ALGO_ASSET,
    type PeraAsset,
    toWholeUnits,
    useSingleAssetDetailsQuery,
} from '@perawallet/wallet-core-assets'
import {
    ALGO_ASSET_NAME,
    formatCurrency,
    generateOrderedUniqueId,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { config } from '@perawallet/wallet-core-config'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useWebView } from '@modules/webview/hooks'
import { useSendFunds } from '@modules/transactions/hooks'
import { ARC59WarningContent } from '@modules/transactions/components/send-funds/ARC59WarningContent'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'
import LightHeaderImage from '@assets/images/asset-inbox-send-light.svg'
import DarkHeaderImage from '@assets/images/asset-inbox-send-dark.svg'
import { useThemeMode } from '@rneui/themed'
import { type SvgProps } from 'react-native-svg'
import { type Decimal } from 'decimal.js'

type UseARC59SendSummaryScreenResult = {
    summary?: Arc59SendSummaryResponse
    isLoading: boolean
    assetId: string
    recipientAddress: string
    amount: Nullable<Decimal>
    fee: Nullable<Decimal>
    asset: Nullable<PeraAsset>
    HeaderImageComponent: FC<SvgProps>
    handleSend: () => void
    handleClose: () => void
    handleReadMore: () => void
    isProcessing: boolean
}

export const useARC59SendSummaryScreen =
    (): UseARC59SendSummaryScreenResult => {
        const navigation =
            useNavigation<StackNavigationProp<SendFundsStackParamList>>()
        const { selectedAssetId, destination, amount, setArc59Summary } =
            useSendFunds()
        const selectedAccount = useSelectedAccount()
        const { request: requestBottomSheet } = useBottomSheet()
        const { pushWebView } = useWebView()
        const { mode } = useThemeMode()

        const assetId = selectedAssetId ?? ''
        const receiverAddress = destination ?? ''

        const { data: summary, isLoading: summaryLoading } =
            useArc59SendSummaryQuery(receiverAddress, assetId)

        const { data: asset, isLoading: assetLoading } =
            useSingleAssetDetailsQuery(assetId)

        const { data: accountInfo } = useAccountInformationQuery(
            selectedAccount?.address ?? '',
        )

        const isLoading = summaryLoading || assetLoading
        const headerImage = mode === 'dark' ? DarkHeaderImage : LightHeaderImage

        useEffect(() => {
            if (!summary || !accountInfo) return

            const availableAlgo = accountInfo.amount - accountInfo.minBalance
            // Gate on the amount actually signed (PERA-4710), not the
            // independent `total_protocol_and_mbr_fee` field.
            const requiredMicroAlgo = getArc59SignedFundingAmount(summary)

            if (availableAlgo < requiredMicroAlgo) {
                const requiredAlgo = toWholeUnits(requiredMicroAlgo, ALGO_ASSET)
                navigation.replace('InsufficientBalance', {
                    requiredBalance: formatCurrency(
                        requiredAlgo,
                        ALGO_ASSET.decimals,
                        ALGO_ASSET_NAME,
                    ),
                })
            }
        }, [summary, accountInfo, navigation])

        useEffect(() => {
            if (summary) {
                setArc59Summary(summary)
            }
        }, [summary, setArc59Summary])

        const fee = summary
            ? toWholeUnits(getArc59SignedFundingAmount(summary), ALGO_ASSET)
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
                contents: <ARC59WarningContent />,
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (result === 'confirm') {
                navigation.navigate('TransactionProcessing')
            } else {
                setIsProcessing(false)
            }
        }, [requestBottomSheet, navigation])

        const handleSend = useCallback(() => {
            void showWarningSheet()
        }, [showWarningSheet])

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
            assetId,
            recipientAddress: receiverAddress,
            fee,
            amount: amount ?? null,
            HeaderImageComponent: headerImage,
            asset: asset ?? null,
            handleSend,
            handleClose,
            handleReadMore,
            isProcessing,
        }
    }
