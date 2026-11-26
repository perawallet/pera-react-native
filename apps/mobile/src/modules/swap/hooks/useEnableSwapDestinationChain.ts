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

import { useCallback } from 'react'
import {
    chainAccountOf,
    useEnableChain,
} from '@perawallet/wallet-core-accounts'
import { logger } from '@perawallet/wallet-core-shared'
import {
    scopeOfSwapAsset,
    SwapDestinationChainError,
    useSwapAccount,
    type SwapQuote,
} from '@perawallet/wallet-core-swaps'

export type UseEnableSwapDestinationChainResult = {
    /** Rejects with `SwapDestinationChainError` when the network can't be enabled. */
    enableDestinationChain: (quote: SwapQuote) => Promise<void>
}

/** Enables the quote's destination network on the swap account, if it isn't on it yet. */
export const useEnableSwapDestinationChain =
    (): UseEnableSwapDestinationChainResult => {
        const account = useSwapAccount()
        const enableChain = useEnableChain()

        const enableDestinationChain = useCallback(
            async (quote: SwapQuote) => {
                const { chainId } = scopeOfSwapAsset(
                    quote.request.destinationAsset,
                )
                if (!account) throw new SwapDestinationChainError(chainId)
                if (chainAccountOf(account, chainId)) return
                // Derivation blocks the JS thread; let the slide's loading state paint first.
                await new Promise(resolve => requestAnimationFrame(resolve))
                try {
                    await enableChain(account.id, chainId, 'user', {
                        expectedAddress: quote.request.destinationAddress,
                    })
                } catch (error) {
                    logger.warn(
                        'Enabling the swap destination network failed',
                        { chainId, error },
                    )
                    throw new SwapDestinationChainError(
                        chainId,
                        error instanceof Error ? error : undefined,
                    )
                }
            },
            [account, enableChain],
        )

        return { enableDestinationChain }
    }
