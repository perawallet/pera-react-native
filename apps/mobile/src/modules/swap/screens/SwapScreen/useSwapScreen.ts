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

import { useEffect } from 'react'
import { RouteProp, useRoute } from '@react-navigation/native'
import { useSwaps } from '@perawallet/wallet-core-swaps'
import {
    useSelectedAccount,
    useSelectedAccountAddress,
    useSigningAccounts,
} from '@perawallet/wallet-core-accounts'
import { type Optional } from '@perawallet/wallet-core-shared'
import { SwapScreenParams } from '@modules/swap/routes/types'

export const useSwapScreen = () => {
    const route =
        useRoute<RouteProp<{ Swap: Optional<SwapScreenParams> }, 'Swap'>>()
    const { setFromAsset, setToAsset } = useSwaps()
    const selectedAccount = useSelectedAccount()
    const signingAccounts = useSigningAccounts()
    const { setSelectedAccountAddress } = useSelectedAccountAddress()

    useEffect(() => {
        if (
            selectedAccount &&
            !signingAccounts.some(a => a.address === selectedAccount.address) &&
            signingAccounts.length > 0
        ) {
            setSelectedAccountAddress(signingAccounts[0].address)
        }
    }, [selectedAccount, signingAccounts, setSelectedAccountAddress])

    useEffect(() => {
        const params = route.params
        if (!params?.assetInId && !params?.assetOutId) return

        if (params.assetInId) setFromAsset(params.assetInId)
        if (params.assetOutId) setToAsset(params.assetOutId)
    }, [route.params, setFromAsset, setToAsset])
}
