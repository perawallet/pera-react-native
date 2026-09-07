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

import { useCallback } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import {
    type Arc60ParsedPayload,
    type Arc60SignRequest,
    type SigningLifecycleEvent,
    isArc60OriginMismatch,
    isExternalCallbackSource,
    resolveAllSignerAddresses,
    useLastSigningEvent,
    useSigningPipeline,
} from '@perawallet/wallet-core-signing'
import {
    useFindAccountByAddress,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { trackEvent, CardEvent } from '@analytics'
import { useLanguage } from '@hooks/useLanguage'
import { useIsQuantumDataSigningBlocked } from '@hooks/useIsQuantumDataSigningBlocked'
import { useQuantumDappWarning } from '@hooks/useQuantumDappWarning'
import { useAlgodErrorMessage } from '@hooks/useAlgodErrorMessage'
import { resolveErrorCopy } from '@i18n/resolveErrorCopy'
import type { SigningStackParamList } from '@modules/signing/routes'

type NavigationProp = StackNavigationProp<SigningStackParamList, 'Arc60Signing'>

type UseArc60SigningScreenResult = {
    request: Nullable<Arc60SignRequest>
    account: Optional<WalletAccount>
    parsed: Nullable<Arc60ParsedPayload>
    isPending: boolean
    canConfirm: boolean
    /** Localized copy for the pipeline's failure, resolved for direct display. */
    errorMessage: Nullable<string>
    /**
     * The SIWA `domain` is asking for a signature from an origin the wallet
     * actually loaded a different page from — a relay/phishing signal. Surfaced
     * as a non-blocking warning (the user can still confirm). False unless the
     * request carries a platform-verified origin (i.e. webview-sourced).
     */
    hasOriginMismatch: boolean
    /**
     * The named signer is a quantum account, whose Falcon signature the
     * ARC-60 protocol can't verify yet — the screen must show a terminal
     * notice instead of the confirm control.
     */
    isQuantumBlocked: boolean
    handleApprove: () => void
    handleReject: () => void
    handleDetailsPress: () => void
}

export const useArc60SigningScreen = (): UseArc60SigningScreenResult => {
    const navigation = useNavigation<NavigationProp>()
    const { t } = useLanguage()
    const { getMessage } = useAlgodErrorMessage()
    const pipeline = useSigningPipeline()
    const { confirmQuantumDappUsage } = useQuantumDappWarning()
    const request =
        (pipeline.currentRequest as Optional<Arc60SignRequest>) ?? null

    const account = useFindAccountByAddress(request?.stdSigData.signer ?? '')
    const isQuantumBlocked = useIsQuantumDataSigningBlocked(request)
    const parsed =
        pipeline.resolved?.kind.type === 'arc60'
            ? pipeline.resolved.kind.parsed
            : null

    // Reflects the bus's `signing-started` event for the current request so
    // the spinner appears the instant the actor enters the signing stage,
    // without waiting for the next React render of pipeline.isLoading.
    const signingStarted = useLastSigningEvent(
        (e): e is Extract<SigningLifecycleEvent, { type: 'signing-started' }> =>
            e.type === 'signing-started',
        request?.id,
    )
    const isApproving = !!signingStarted

    // `sourceType: 'arc60'` marks the first-party card-creation request (the
    // only local producer of ARC-60 requests); dApp-originated ones come in as
    // 'injected' / 'webview' / 'walletconnect' and must not fire card events.
    const isCardRequest = request?.sourceType === 'arc60'

    const handleApprove = useCallback(() => {
        // Backstop for the blocked terminal state — the confirm control is
        // not rendered when quantum-blocked, so this should be unreachable.
        if (isQuantumBlocked) return

        if (isCardRequest) trackEvent(CardEvent.CreateArbTxConfirm)

        void (async () => {
            // This screen drives the pipeline itself, so the sign-time backstop
            // in SigningActionButtons never runs for ARC-60.
            if (request && isExternalCallbackSource(request.sourceType)) {
                const decision = await confirmQuantumDappUsage(
                    resolveAllSignerAddresses(request),
                )
                if (decision === 'cancel') {
                    pipeline.fail()
                    return
                }
            }

            pipeline.next()
        })()
    }, [
        pipeline,
        isCardRequest,
        request,
        confirmQuantumDappUsage,
        isQuantumBlocked,
    ])

    const handleReject = useCallback(() => {
        if (isCardRequest) trackEvent(CardEvent.CreateArbTxClose)
        pipeline.fail()
    }, [pipeline, isCardRequest])

    const handleDetailsPress = useCallback(() => {
        navigation.navigate('Arc60SigningDetails')
    }, [navigation])

    const isPending = pipeline.isLoading || isApproving
    const canConfirm =
        !isPending && !!account && parsed?.type === 'siwa' && !isQuantumBlocked

    const hasOriginMismatch = isArc60OriginMismatch(
        request?.stdSigData.domain ?? '',
        request?.verifiedOrigin,
    )

    const errorMessage = pipeline.error
        ? resolveErrorCopy(pipeline.error, t, undefined, getMessage).body
        : null

    return {
        request,
        account: account ?? undefined,
        parsed,
        isPending,
        canConfirm,
        errorMessage,
        hasOriginMismatch,
        isQuantumBlocked,
        handleApprove,
        handleReject,
        handleDetailsPress,
    }
}
