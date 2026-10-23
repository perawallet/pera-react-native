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
import {
    addressCodecs,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useCapabilityCheck } from '@hooks/useCapability'

/** Registered chains with an address codec and watchAccounts on: the chains a watch address can be entered for. */
export const useWatchableChainIds = (): ChainId[] => {
    const checkCapability = useCapabilityCheck()
    const { chains } = getProvider()
    return addressCodecs
        .list()
        .map(codec => codec.chainId)
        .filter(
            chainId =>
                chains.has(chainId) &&
                checkCapability({
                    chain: { chainId, capability: 'watchAccounts' },
                }),
        )
}
