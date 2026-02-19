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

import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { usePreferences } from '@perawallet/wallet-core-settings'
import {
    useArc59SendSummaryQuery,
    useAccountInformationQuery,
    type Arc59SendSummaryResponse,
} from '@perawallet/wallet-core-blockchain'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useSendFunds } from '@modules/transactions/hooks'
import { UserPreferences } from '@constants/user-preferences'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'

type UseARC59SendSummaryScreenResult = {
    summary: Arc59SendSummaryResponse | null
    isLoading: boolean
    isWarningVisible: boolean
    formattedAmount: string
    formattedFee: string
    assetUnitName: string
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
        const { hasPreference, setPreference } = usePreferences()
        const { selectedAsset, destination, amount, setArc59Summary } =
            useSendFunds()
        const selectedAccount = useSelectedAccount()
        const [isWarningVisible, setIsWarningVisible] = useState(false)

        const assetId = selectedAsset?.assetId ?? ''
        const receiverAddress = destination ?? ''

        const { summary, isLoading } = useArc59SendSummaryQuery(
            receiverAddress,
            assetId,
        )

        const { data: accountInfo } = useAccountInformationQuery(
            selectedAccount?.address ?? '',
        )

        // Show warning on first visit
        useEffect(() => {
            if (
                summary &&
                !hasPreference(UserPreferences.hasSeenArc59Warning)
            ) {
                setIsWarningVisible(true)
            }
        }, [summary, hasPreference])

        // Check for insufficient balance
        useEffect(() => {
            if (!summary || !accountInfo) return

            const availableAlgo = accountInfo.amount - accountInfo.minBalance
            const requiredMicroAlgo = BigInt(
                summary.total_protocol_and_mbr_fee * 1_000_000,
            )

            if (availableAlgo < requiredMicroAlgo) {
                navigation.replace('InsufficientBalance', {
                    requiredBalance:
                        summary.total_protocol_and_mbr_fee.toFixed(6),
                })
            }
        }, [summary, accountInfo, navigation])

        // Store the summary for transaction processing
        useEffect(() => {
            if (summary) {
                setArc59Summary(summary)
            }
        }, [summary, setArc59Summary])

        const assetUnitName = selectedAsset?.assetId
            ? selectedAsset.assetId
            : 'ASA'

        const formattedAmount = amount
            ? `${amount.toString()} ${assetUnitName}`
            : ''
        const formattedFee = summary
            ? summary.total_protocol_and_mbr_fee.toFixed(2)
            : '...'

        const handleSend = useCallback(() => {
            navigation.navigate('TransactionProcessing')
        }, [navigation])

        const handleClose = useCallback(() => {
            navigation.goBack()
        }, [navigation])

        const handleReadMore = useCallback(() => {
            setIsWarningVisible(true)
        }, [])

        const handleWarningConfirm = useCallback(() => {
            setPreference(UserPreferences.hasSeenArc59Warning, 'true')
            setIsWarningVisible(false)
        }, [setPreference])

        const handleWarningClose = useCallback(() => {
            setIsWarningVisible(false)
        }, [])

        return {
            summary,
            isLoading,
            isWarningVisible,
            formattedAmount,
            formattedFee,
            assetUnitName,
            handleSend,
            handleClose,
            handleReadMore,
            handleWarningConfirm,
            handleWarningClose,
        }
    }
