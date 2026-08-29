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
    type ArbitraryDataSignRequest,
    type PeraArbitraryDataMessage,
    type SigningLifecycleEvent,
    isExternalCallbackSource,
    resolveAllSignerAddresses,
    useLastSigningEvent,
    useSigningPipeline,
} from '@perawallet/wallet-core-signing'
import { useIsQuantumDataSigningBlocked } from '@hooks/useIsQuantumDataSigningBlocked'
import { useQuantumDappWarning } from '@hooks/useQuantumDappWarning'
import type { SigningStackParamList } from '@modules/signing/routes'
import type { Nullable } from '@perawallet/wallet-core-shared'

type NavigationProp = StackNavigationProp<
    SigningStackParamList,
    'ArbitraryDataSigning'
>

type UseArbitraryDataSigningScreenResult = {
    request: Nullable<ArbitraryDataSignRequest>
    isSingleSignRequest: boolean
    isPending: boolean
    /**
     * A named signer is a quantum account, whose Falcon signature the
     * arbitrary-data scheme can't verify yet — the screen must show a
     * terminal notice instead of the confirm control.
     */
    isQuantumBlocked: boolean
    handleApprove: () => void
    handleReject: () => void
    handleDetailsPress: (message: PeraArbitraryDataMessage) => void
}

export const useArbitraryDataSigningScreen =
    (): UseArbitraryDataSigningScreenResult => {
        const navigation = useNavigation<NavigationProp>()
        const pipeline = useSigningPipeline()
        const { confirmQuantumDappUsage } = useQuantumDappWarning()
        const request =
            (pipeline.currentRequest as ArbitraryDataSignRequest) ?? null
        const isQuantumBlocked = useIsQuantumDataSigningBlocked(request)

        const isSingleSignRequest = request?.data.length === 1

        // Reflects the bus's `signing-started` event for the current request so
        // the spinner appears the instant the actor enters the signing stage,
        // without waiting for the next React render of pipeline.isLoading.
        const signingStarted = useLastSigningEvent(
            (
                e,
            ): e is Extract<
                SigningLifecycleEvent,
                { type: 'signing-started' }
            > => e.type === 'signing-started',
            request?.id,
        )
        const isApproving = !!signingStarted

        const handleApprove = useCallback(() => {
            // Backstop for the blocked terminal state — the confirm control
            // is not rendered when quantum-blocked, so this should be
            // unreachable.
            if (isQuantumBlocked) return

            void (async () => {
                // This screen drives the pipeline itself, so the sign-time
                // backstop in SigningActionButtons never runs for this request.
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
        }, [pipeline, request, confirmQuantumDappUsage, isQuantumBlocked])

        const handleReject = useCallback(() => {
            pipeline.fail()
        }, [pipeline])

        const handleDetailsPress = useCallback(
            (message: PeraArbitraryDataMessage) => {
                navigation.navigate('ArbitraryDataSigningDetails', { message })
            },
            [navigation],
        )

        return {
            request,
            isSingleSignRequest,
            isPending: pipeline.isLoading || isApproving,
            isQuantumBlocked,
            handleApprove,
            handleReject,
            handleDetailsPress,
        }
    }
