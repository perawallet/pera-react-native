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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'

import type { RampDepositInstructions } from '../models'
import { useOnrampStore } from '../store'

type UseOnrampResult = {
    selectedSourceTokenId: Nullable<string>
    selectedDestinationTokenId: Nullable<string>
    selectedChainId: Nullable<ChainId>
    senderAddress: string
    setSelectedSourceTokenId: (id: Nullable<string>) => void
    setSelectedDestinationTokenId: (id: Nullable<string>) => void
    setSelectedChainId: (chainId: Nullable<ChainId>) => void
    setSenderAddress: (address: string) => void
    rememberDepositInstructions: (
        orderId: string,
        instructions: RampDepositInstructions,
    ) => void
}

export const useOnramp = (): UseOnrampResult => {
    const selectedSourceTokenId = useOnrampStore(
        state => state.selectedSourceTokenId,
    )
    const selectedDestinationTokenId = useOnrampStore(
        state => state.selectedDestinationTokenId,
    )
    const selectedChainId = useOnrampStore(state => state.selectedChainId)
    const senderAddress = useOnrampStore(state => state.senderAddress)
    const setSelectedSourceTokenId = useOnrampStore(
        state => state.setSelectedSourceTokenId,
    )
    const setSelectedDestinationTokenId = useOnrampStore(
        state => state.setSelectedDestinationTokenId,
    )
    const setSelectedChainId = useOnrampStore(state => state.setSelectedChainId)
    const setSenderAddress = useOnrampStore(state => state.setSenderAddress)
    const rememberDepositInstructions = useOnrampStore(
        state => state.rememberDepositInstructions,
    )

    return {
        selectedSourceTokenId,
        selectedDestinationTokenId,
        selectedChainId,
        senderAddress,
        setSelectedSourceTokenId,
        setSelectedDestinationTokenId,
        setSelectedChainId,
        setSenderAddress,
        rememberDepositInstructions,
    }
}

/** The pay-in details remembered for a deposit order placed on this device. */
export const useRampDepositInstructions = (
    orderId: string,
): Nullable<RampDepositInstructions> =>
    useOnrampStore(state => state.depositInstructions[orderId] ?? null)
