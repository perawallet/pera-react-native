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

import type { Nullable } from '@perawallet/wallet-core-shared'

import { useOnrampStore } from '../store'

type UseOnrampResult = {
    selectedSourceTokenId: Nullable<string>
    selectedDestinationTokenId: Nullable<string>
    senderAddress: string
    setSelectedSourceTokenId: (id: Nullable<string>) => void
    setSelectedDestinationTokenId: (id: Nullable<string>) => void
    setSenderAddress: (address: string) => void
}

export const useOnramp = (): UseOnrampResult => {
    const selectedSourceTokenId = useOnrampStore(
        state => state.selectedSourceTokenId,
    )
    const selectedDestinationTokenId = useOnrampStore(
        state => state.selectedDestinationTokenId,
    )
    const senderAddress = useOnrampStore(state => state.senderAddress)
    const setSelectedSourceTokenId = useOnrampStore(
        state => state.setSelectedSourceTokenId,
    )
    const setSelectedDestinationTokenId = useOnrampStore(
        state => state.setSelectedDestinationTokenId,
    )
    const setSenderAddress = useOnrampStore(state => state.setSenderAddress)

    return {
        selectedSourceTokenId,
        selectedDestinationTokenId,
        senderAddress,
        setSelectedSourceTokenId,
        setSelectedDestinationTokenId,
        setSenderAddress,
    }
}
