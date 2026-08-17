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

import React, { useCallback, useMemo, useState } from 'react'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { useQuantumDappWarning } from '@hooks/useQuantumDappWarning'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { toAlgodError } from '@perawallet/wallet-core-blockchain'
import {
    getRekeyedUnsignableReason,
    isExternalCallbackSource,
    isSignRequestMultisigUnsignable,
    resolveAllSignerAddresses,
    type SignRequest,
    type SigningPipelineEvent,
    useSigningPipeline,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    trackEvent,
    WalletConnectEvent,
    AnalyticsMetadataKey,
} from '@analytics'
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
    slideResetKey: number
    isLoading: boolean
    hasMultipleTransactions: boolean
    currentRequest: Optional<SignRequest>
    isMultisigCosign: boolean
    /**
     * When set, the request cannot be signed (unsignable multisig, or a
     * sender rekeyed to a missing/watch-only auth) — the confirm slider is
     * replaced by this explanation.
     */
    cannotSignNotice: Optional<{ title: string; body: string }>
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
    const allAccounts = useAllAccounts()

    const navigation =
        useNavigation<StackNavigationProp<SigningStackParamList>>()
    const { getPreference } = usePreferences()
    const { request: requestBottomSheet } = useBottomSheet()
    const { confirmQuantumDappUsage } = useQuantumDappWarning()

    // Bumped to remount the slide-to-confirm slider so it resets as needed
    const [slideResetKey, setSlideResetKey] = useState(0)

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
                // Pipeline errors wrap the node's rejection text, which the
                // toast would otherwise print raw. Recognized node rejections
                // (overspend, stale-rekey "should have been authorized by"…)
                // get their localized copy; unrecognized ones keep the
                // original error's message.
                const algodError = toAlgodError(event.error)
                showError(
                    algodError.code === 'unknown_node_error'
                        ? event.error
                        : algodError,
                    t('signing.transaction_view.transaction_failed_title'),
                    {
                        notifier: bottomSheetNotifier.current ?? undefined,
                    },
                )
            }
        },
        // `pipeline` is returned by useSigningPipeline below (it receives this
        // callback), so it cannot be listed as a dependency here. handleEvent
        // reads pipeline.resolved lazily at call time, by which point it is set.
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const cannotSignNotice = useMemo(() => {
        if (!currentRequest) return undefined
        if (isSignRequestMultisigUnsignable(currentRequest, allAccounts)) {
            return {
                title: t('signing.cannot_sign.title'),
                body: t('signing.cannot_sign.body'),
            }
        }
        const rekeyedReason = getRekeyedUnsignableReason(
            currentRequest,
            allAccounts,
        )
        if (rekeyedReason) {
            return {
                title: t('signing.cannot_sign.title'),
                body: t(
                    rekeyedReason.kind === 'authMissing'
                        ? 'signing.cannot_sign.rekeyed_auth_missing_body'
                        : 'signing.cannot_sign.rekeyed_auth_watch_body',
                    { authAddress: rekeyedReason.authAddress },
                ),
            }
        }
        return undefined
    }, [currentRequest, allAccounts, t])

    // WalletConnect transaction confirm/decline analytics. Only dapp-originated
    // (`walletconnect`) requests carry these events; in-app/local signing is
    // tracked through its own flow. Dapp name/url come from the request's
    // sourceMetadata (peerMetadata), mirroring the session events.
    const walletConnectTxPayload = useMemo(() => {
        if (currentRequest?.sourceType !== 'walletconnect') return null
        return {
            [AnalyticsMetadataKey.DappName]:
                currentRequest.sourceMetadata?.name ?? '',
            [AnalyticsMetadataKey.DappUrl]:
                currentRequest.sourceMetadata?.url ?? '',
            [AnalyticsMetadataKey.TransactionCount]: allTransactions.length,
        }
    }, [currentRequest, allTransactions.length])

    const handleSignAndSend = useCallback(() => {
        if (cannotSignNotice) return

        void (async () => {
            // Backstop for sessions approved before this warning shipped, so
            // the connect-time gate never ran for them. Scoped to
            // dApp-originated requests — a local send is not a dApp.
            if (
                currentRequest &&
                isExternalCallbackSource(currentRequest.sourceType)
            ) {
                const decision = await confirmQuantumDappUsage(
                    resolveAllSignerAddresses(currentRequest),
                )
                if (decision === 'cancel') {
                    if (walletConnectTxPayload) {
                        trackEvent(
                            WalletConnectEvent.TransactionDeclined,
                            walletConnectTxPayload,
                        )
                    }
                    pipeline.fail()
                    return
                }
            }

            if (guardedWarningType !== null) {
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
                if (result !== 'confirm') {
                    // Not proceeding to signing — reset the slider so it is
                    // unslid when the user returns to the sign screen.
                    setSlideResetKey(key => key + 1)
                    if (result === 'go-to-settings') {
                        navigation.navigate('SecuritySettings')
                    }
                    return
                }
            }

            if (walletConnectTxPayload) {
                trackEvent(
                    WalletConnectEvent.TransactionConfirmed,
                    walletConnectTxPayload,
                )
            }
            pipeline.next()
        })()
    }, [
        cannotSignNotice,
        currentRequest,
        confirmQuantumDappUsage,
        guardedWarningType,
        pipeline,
        requestBottomSheet,
        navigation,
        walletConnectTxPayload,
    ])

    const handleReject = useCallback(() => {
        if (walletConnectTxPayload) {
            trackEvent(
                WalletConnectEvent.TransactionDeclined,
                walletConnectTxPayload,
            )
        }
        pipeline.fail()
    }, [pipeline, walletConnectTxPayload])

    const cosignKind =
        pipeline.resolved?.kind.type === 'transactions'
            ? pipeline.resolved.kind
            : null
    const isMultisigCosign = cosignKind?.isMultisigCosign ?? false
    const cosignSignerAddress = cosignKind?.cosignSignerAddress ?? ''

    return {
        handleSignAndSend,
        handleReject,
        slideResetKey,
        isLoading,
        hasMultipleTransactions: allTransactions.length > 1,
        currentRequest,
        isMultisigCosign,
        cannotSignNotice,
        cosignSignerAddress,
    }
}
