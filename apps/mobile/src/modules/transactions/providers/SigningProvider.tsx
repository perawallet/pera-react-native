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

import React, { PropsWithChildren, useEffect } from 'react'
import { PWBottomSheet } from '@components/core'
import { SignRequestView } from '@modules/transactions/components/signing/SignRequestView'
import { useWindowDimensions } from 'react-native'
import {
    useSigningRequest,
    type TransactionSignRequest,
} from '@perawallet/wallet-core-signing'
import { deferToNextCycle } from '@perawallet/wallet-core-shared'
import { SigningContextProvider } from '@modules/transactions/components/signing/SigningContextProvider'

export type SigningProviderProps = {} & PropsWithChildren

export function SigningProvider({ children }: SigningProviderProps) {
    const { pendingSignRequests } = useSigningRequest()
    const nextRequest = pendingSignRequests.at(0)
    const { height } = useWindowDimensions()
    const [isVisible, setIsVisible] = React.useState(false)

    useEffect(() => {
        setIsVisible(false)
        if (nextRequest) {
            deferToNextCycle(() => {
                setIsVisible(true)
            })
        }
    }, [pendingSignRequests])

    return (
        <>
            {children}
            <PWBottomSheet
                innerContainerStyle={{ height: height - 100 }}
                isVisible={isVisible}
            >
                {!!nextRequest &&
                    <SigningContextProvider
                        request={
                            nextRequest as TransactionSignRequest
                        }
                    >
                        <SignRequestView request={nextRequest} />
                    </SigningContextProvider>
                }
            </PWBottomSheet>
        </>
    )
}
