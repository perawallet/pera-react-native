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

import { useCallback, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import {
    type ArbitraryDataSignRequest,
    type PeraArbitraryDataMessage,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import type { SigningStackParamList } from '@modules/signing/routes'

type NavigationProp = StackNavigationProp<
    SigningStackParamList,
    'ArbitraryDataSigning'
>

type UseArbitraryDataSigningScreenResult = {
    request: ArbitraryDataSignRequest | null
    isSingleSignRequest: boolean
    isPending: boolean
    handleApprove: () => void
    handleReject: () => void
    handleDetailsPress: (message: PeraArbitraryDataMessage) => void
}

export const useArbitraryDataSigningScreen =
    (): UseArbitraryDataSigningScreenResult => {
        const navigation = useNavigation<NavigationProp>()
        const {
            currentRequest,
            signAndSendRequest,
            rejectRequest: coreRejectRequest,
        } = useSigningRequest()
        const request = (currentRequest as ArbitraryDataSignRequest) ?? null
        const [isPending, setIsPending] = useState(false)

        const isSingleSignRequest = request?.data.length === 1

        const handleApprove = useCallback(async () => {
            if (!request) return
            setIsPending(true)
            try {
                await signAndSendRequest(request)
            } catch (error) {
                await request.error?.(`${error}`)
            } finally {
                setIsPending(false)
            }
        }, [request, signAndSendRequest])

        const handleReject = useCallback(() => {
            if (!request) return
            coreRejectRequest(request)
        }, [request, coreRejectRequest])

        const handleDetailsPress = useCallback(
            (message: PeraArbitraryDataMessage) => {
                navigation.navigate('ArbitraryDataSigningDetails', { message })
            },
            [navigation],
        )

        return {
            request,
            isSingleSignRequest,
            isPending,
            handleApprove,
            handleReject,
            handleDetailsPress,
        }
    }
