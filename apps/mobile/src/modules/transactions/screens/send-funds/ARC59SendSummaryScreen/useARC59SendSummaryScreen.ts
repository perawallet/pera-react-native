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

import { FC, useCallback, useEffect } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import {
    useArc59SendSummaryQuery,
    type Arc59SendSummaryResponse,
} from '@perawallet/wallet-core-asa-inbox'
import {
    useAccountInformationQuery,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import {
    ALGO_ASSET,
    PeraAsset,
    toWholeUnits,
    useSingleAssetDetailsQuery,
} from '@perawallet/wallet-core-assets'
import { formatCurrency } from '@perawallet/wallet-core-shared'
import { useSendFunds } from '@modules/transactions/hooks'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'
import LightHeaderImage from '@assets/images/asset-inbox-send-light.svg'
import DarkHeaderImage from '@assets/images/asset-inbox-send-dark.svg'
import { useThemeMode } from '@rneui/themed'
import { SvgProps } from 'react-native-svg'
import { Decimal } from 'decimal.js'
import { useModalState } from '@hooks/useModalState'

type UseARC59SendSummaryScreenResult = {
    summary?: Arc59SendSummaryResponse
    isLoading: boolean
    isWarningVisible: boolean
    assetId: string
    amount: Decimal | null
    fee: Decimal | null
    asset: PeraAsset | null
    HeaderImageComponent: FC<SvgProps>
    handleSend: () => void
    handleClose: () => void
    handleReadMore: () => void
    handleWarningConfirm: () => void
    handleWarningClose: () => void
}

export const useARC59SendSummaryScreen =
    (): UseARC59SendSummaryScreenResult => {
        const navigation =
            useNavigation<StackNavigationProp<SendFundsStackParamList>>()
        const { selectedAssetId, destination, amount, setArc59Summary } =
            useSendFunds()
        const selectedAccount = useSelectedAccount()
        const warningModal = useModalState()
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

        // Check for insufficient balance
        useEffect(() => {
            if (!summary || !accountInfo) return

            const availableAlgo = accountInfo.amount - accountInfo.minBalance
            const requiredMicroAlgo = BigInt(summary.total_protocol_and_mbr_fee)

            if (availableAlgo < requiredMicroAlgo) {
                const requiredAlgo = toWholeUnits(
                    summary.total_protocol_and_mbr_fee,
                    ALGO_ASSET,
                )
                navigation.replace('InsufficientBalance', {
                    requiredBalance: formatCurrency(
                        requiredAlgo,
                        ALGO_ASSET.decimals,
                        'ALGO',
                    ),
                })
            }
        }, [summary, accountInfo, navigation])

        // Store the summary for transaction processing
        useEffect(() => {
            if (summary) {
                setArc59Summary(summary)
            }
        }, [summary, setArc59Summary])

        const fee = summary
            ? toWholeUnits(summary.total_protocol_and_mbr_fee, ALGO_ASSET)
            : null

        const handleSend = useCallback(() => {
            warningModal.open()
        }, [])

        const handleClose = useCallback(() => {
            navigation.goBack()
        }, [navigation])

        const handleReadMore = useCallback(() => {
            warningModal.open()
        }, [])

        const handleWarningConfirm = useCallback(() => {
            warningModal.close()
            navigation.navigate('TransactionProcessing')
        }, [navigation])

        const handleWarningClose = useCallback(() => {
            warningModal.close()
        }, [])

        return {
            summary,
            isLoading,
            isWarningVisible: warningModal.isOpen,
            assetId,
            fee,
            amount: amount ?? null,
            HeaderImageComponent: headerImage,
            asset: asset ?? null,
            handleSend,
            handleClose,
            handleReadMore,
            handleWarningConfirm,
            handleWarningClose,
        }
    }
