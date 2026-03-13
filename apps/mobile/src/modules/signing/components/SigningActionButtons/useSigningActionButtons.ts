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

import { useCallback, useMemo } from 'react'
import { useToast } from '@hooks/useToast'
import { config } from '@perawallet/wallet-core-config'
import { useLanguage } from '@hooks/useLanguage'
import {
    type SigningPipelineEvent,
    useSigningPipeline,
} from '@perawallet/wallet-core-signing'
import { bottomSheetNotifier } from '@components/core'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { SigningStackParamList } from '@modules/signing/routes'
import { useModalState } from '@hooks/useModalState'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'

type GuardedWarningType = 'rekey' | 'asset-freeze'

const preferenceKeyMap: Record<GuardedWarningType, string> = {
    rekey: UserPreferences.rekeySupportEnabled,
    'asset-freeze': UserPreferences.assetFreezeSupportEnabled,
}

export const useSigningActionButtons = () => {
    const { showToast } = useToast()
    const { t } = useLanguage()

    const securityGuardModal = useModalState()
    const navigation =
        useNavigation<StackNavigationProp<SigningStackParamList>>()
    const { getPreference } = usePreferences()

    const handleEvent = useCallback(
        (event: SigningPipelineEvent) => {
            if (event.type !== 'signing_failed') return
            const req = pipeline.currentRequest
            if (req?.transport === 'algod') {
                showToast(
                    {
                        type: 'error',
                        title: t(
                            'signing.transaction_view.transaction_failed_title',
                        ),
                        body: config.debugEnabled
                            ? `${event.error}`
                            : t(
                                  'signing.transaction_view.transaction_failed_body',
                              ),
                    },
                    {
                        notifier: bottomSheetNotifier.current ?? undefined,
                    },
                )
            }
        },
        [showToast, t],
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
            securityGuardModal.open()
            return
        }
        pipeline.next()
    }, [guardedWarningType, pipeline])

    const handleSecurityGuardConfirm = useCallback(() => {
        securityGuardModal.close()
        pipeline.next()
    }, [pipeline])

    const handleSecurityGuardGoToSettings = useCallback(() => {
        securityGuardModal.close()
        navigation.navigate('SecuritySettings')
    }, [navigation])

    const closeSecurityGuard = useCallback(() => {
        securityGuardModal.close()
    }, [])

    const handleReject = useCallback(() => {
        pipeline.fail()
    }, [pipeline])

    return {
        handleSignAndSend,
        handleReject,
        isLoading,
        hasMultipleTransactions: allTransactions.length > 1,
        guardedWarningType,
        isSecurityGuardOpen: securityGuardModal.isOpen,
        handleSecurityGuardConfirm,
        handleSecurityGuardGoToSettings,
        closeSecurityGuard,
    }
}
