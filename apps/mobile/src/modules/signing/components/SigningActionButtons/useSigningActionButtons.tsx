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

import React, { useCallback, useMemo } from 'react'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import {
    type SignRequest,
    type SigningPipelineEvent,
    useSigningPipeline,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import type { Optional } from '@perawallet/wallet-core-shared'
import { bottomSheetNotifier } from '@components/core'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { SigningStackParamList } from '@modules/signing/routes'
import { useBottomSheet } from '@modules/bottom-sheet'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import {
    SecurityGuardContent,
    type GuardedWarningType,
    type SecurityGuardContentResult,
} from '../SecurityGuardContent'

export type UseSigningActionButtonsResult = {
    handleSignAndSend: () => void
    handleReject: () => void
    isLoading: boolean
    hasMultipleTransactions: boolean
    currentRequest: Optional<SignRequest>
    isMultisigCosign: boolean
    cosignSignerAddress: string
}

const preferenceKeyMap: Record<GuardedWarningType, string> = {
    rekey: UserPreferences.rekeySupportEnabled,
    'asset-freeze': UserPreferences.assetFreezeSupportEnabled,
}

export const useSigningActionButtons = (): UseSigningActionButtonsResult => {
    const { showError } = useErrorToast()
    const { t } = useLanguage()
    const { currentRequest } = useSigningRequest()

    const navigation =
        useNavigation<StackNavigationProp<SigningStackParamList>>()
    const { getPreference } = usePreferences()
    const { request: requestBottomSheet } = useBottomSheet()

    const handleEvent = useCallback(
        (event: SigningPipelineEvent) => {
            if (event.type !== 'signing_failed') return

            // Hardware-wallet signing failures are surfaced through the
            // LedgerSigningContent sheet (which renders LedgerErrorContent
            // inline for non-BLE errors) or via the auto-opened
            // LedgerConnectionIssueContent troubleshooting sheet for BLE-class
            // errors. The toast pre-dates that surface and would duplicate the
            // error UI, so skip it for hardware signers.
            if (pipeline.resolved?.signerType === 'hardware') return

            if (pipeline.resolved?.transport.kind === 'algod') {
                showError(
                    event.error,
                    t('signing.transaction_view.transaction_failed_title'),
                    {
                        notifier: bottomSheetNotifier.current ?? undefined,
                    },
                )
            }
        },
        [showError, t],
    )

    const pipeline = useSigningPipeline({ onEvent: handleEvent })

    const { allTransactions, warnings, isLoading } = pipeline

    const guardedWarningType = useMemo(() => {
        const presentTypes: GuardedWarningType[] = []
        if (warnings.some(w => w.type === 'rekey')) presentTypes.push('rekey')
        if (warnings.some(w => w.type === 'asset-freeze'))
            presentTypes.push('asset-freeze')

        if (presentTypes.length === 0) return null

        // Prioritize a type where support is disabled (must block)
        const disabledType = presentTypes.find(
            type => !getPreference(preferenceKeyMap[type]),
        )
        if (disabledType) return disabledType

        // All present types are enabled — show "are you sure?" for the first
        return presentTypes[0]
    }, [warnings, getPreference])

    const handleSignAndSend = useCallback(() => {
        if (guardedWarningType !== null) {
            void (async () => {
                const result =
                    await requestBottomSheet<SecurityGuardContentResult>({
                        contents: (
                            <SecurityGuardContent
                                warningType={guardedWarningType}
                            />
                        ),
                        options: {
                            size: 'auto',
                            enablePanDownToClose: true,
                        },
                    })
                if (result === 'confirm') {
                    pipeline.next()
                } else if (result === 'go-to-settings') {
                    navigation.navigate('SecuritySettings')
                }
            })()
            return
        }
        pipeline.next()
    }, [guardedWarningType, pipeline, requestBottomSheet, navigation])

    const handleReject = useCallback(() => {
        pipeline.fail()
    }, [pipeline])

    const cosignKind =
        pipeline.resolved?.kind.type === 'transactions'
            ? pipeline.resolved.kind
            : null
    const isMultisigCosign = cosignKind?.isMultisigCosign ?? false
    const cosignSignerAddress = cosignKind?.cosignSignerAddress ?? ''

    return {
        handleSignAndSend,
        handleReject,
        isLoading,
        hasMultipleTransactions: allTransactions.length > 1,
        currentRequest,
        isMultisigCosign,
        cosignSignerAddress,
    }
}
