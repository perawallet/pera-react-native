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
    type Arc60ParsedPayload,
    type Arc60SignRequest,
    parseArc60ForDisplay,
    useSigningPipeline,
} from '@perawallet/wallet-core-signing'
import {
    useFindAccountByAddress,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { SigningStackParamList } from '@modules/signing/routes'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'

type NavigationProp = StackNavigationProp<SigningStackParamList, 'Arc60Signing'>

type UseArc60SigningScreenResult = {
    request: Nullable<Arc60SignRequest>
    account: Optional<WalletAccount>
    parsed: Nullable<Arc60ParsedPayload>
    isPending: boolean
    canConfirm: boolean
    error: Nullable<Error>
    handleApprove: () => void
    handleReject: () => void
    handleDetailsPress: () => void
}

export const useArc60SigningScreen = (): UseArc60SigningScreenResult => {
    const navigation = useNavigation<NavigationProp>()
    const pipeline = useSigningPipeline()
    const request =
        (pipeline.currentRequest as Optional<Arc60SignRequest>) ?? null

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
    }, [pipeline.next])

    const handleReject = useCallback(() => {
        pipeline.fail()
    }, [pipeline.fail])

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
