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
import {
    type ArbitraryDataSignRequest,
    type PeraArbitraryDataMessage,
    useSigningPipeline,
} from '@perawallet/wallet-core-signing'
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
    handleApprove: () => void
    handleReject: () => void
    handleDetailsPress: (message: PeraArbitraryDataMessage) => void
}

export const useArbitraryDataSigningScreen =
    (): UseArbitraryDataSigningScreenResult => {
        const navigation = useNavigation<NavigationProp>()
        const pipeline = useSigningPipeline()
        const request =
            (pipeline.currentRequest as ArbitraryDataSignRequest) ?? null

        const isSingleSignRequest = request?.data.length === 1

        // Local optimistic flag: flips true the instant the user taps Confirm
        // so the spinner is visible immediately, before the actor's stage
        // transition propagates through the React subscription.
        const [isApproving, setIsApproving] = useState(false)

        useEffect(() => {
            if (!pipeline.isLoading) setIsApproving(false)
        }, [pipeline.isLoading])

        const handleApprove = useCallback(() => {
            setIsApproving(true)
            pipeline.next()
        }, [pipeline])

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
            handleApprove,
            handleReject,
            handleDetailsPress,
        }
    }
