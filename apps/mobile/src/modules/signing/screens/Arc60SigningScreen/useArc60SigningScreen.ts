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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import {
    type Arc60SignRequest,
    useSigningPipeline,
} from '@perawallet/wallet-core-signing'
import {
    useFindAccountByAddress,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    parseArc60ForDisplay,
    type Arc60ParsedPayload,
} from '@modules/signing/components/Arc60DataSigningView'
import type { SigningStackParamList } from '@modules/signing/routes'

type NavigationProp = StackNavigationProp<SigningStackParamList, 'Arc60Signing'>

type UseArc60SigningScreenResult = {
    request: Arc60SignRequest | null
    account: WalletAccount | undefined
    parsed: Arc60ParsedPayload | null
    isPending: boolean
    canConfirm: boolean
    error: Error | null
    handleApprove: () => void
    handleReject: () => void
    handleDetailsPress: () => void
}

export const useArc60SigningScreen = (): UseArc60SigningScreenResult => {
    const navigation = useNavigation<NavigationProp>()
    const pipeline = useSigningPipeline()
    const request =
        (pipeline.currentRequest as Arc60SignRequest | undefined) ?? null

    const account = useFindAccountByAddress(request?.stdSigData.signer ?? '')
    const parsed = useMemo(
        () =>
            request
                ? parseArc60ForDisplay(
                      request.stdSigData.data,
                      request.metadata.encoding,
                  )
                : null,
        [request],
    )

    // Local optimistic flag: flips true the instant the user taps Confirm so
    // the spinner is visible immediately, before the actor's stage transition
    // propagates through the React subscription.
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

    const handleDetailsPress = useCallback(() => {
        navigation.navigate('Arc60SigningDetails')
    }, [navigation])

    const isPending = pipeline.isLoading || isApproving
    const canConfirm = !isPending && !!account && parsed?.type === 'siwa'

    return {
        request,
        account: account ?? undefined,
        parsed,
        isPending,
        canConfirm,
        error: pipeline.error,
        handleApprove,
        handleReject,
        handleDetailsPress,
    }
}
