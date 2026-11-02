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

import { getProvider } from '@perawallet/wallet-extension-provider'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'

/**
 * The scope of the chain the wallet is built around: the first chain the
 * build registers, which is the chain an account's custody, its address and
 * its totals are read on.
 *
 * Shared code asks for this scope rather than naming a chain of its own, so a
 * build that ships another chain's UI reads that chain instead. A feature that
 * knows which chain the user is on passes its own scope down instead.
 */
export const useHomeChainScope = (): ChainScope => {
    const [homeChainId] = getProvider().chains.list()

    return useSelectedScope(homeChainId?.id)
}
