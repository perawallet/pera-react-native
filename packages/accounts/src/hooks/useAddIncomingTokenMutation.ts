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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { isNativeAssetId } from '@perawallet/wallet-core-assets'
import { logger } from '@perawallet/wallet-core-shared'
import { receivesUnaskedAssets } from '../chainProtocol'
import { useAddTokenMutation } from './useAddTokenMutation'

type AddIncomingTokenVariables = {
    accountAddress: string
    scope: ChainScope
    assetId: string
}

export type UseAddIncomingTokenMutationResult = {
    /** Never rejects: a failed add leaves the token to received-token detection. */
    addIncomingToken: (variables: AddIncomingTokenVariables) => Promise<void>
}

/**
 * Adds the token a swap or a purchase will deliver, so every read of the
 * account includes it once it lands. A transfer someone else sends doesn't
 * touch the account on chain, so nothing else flags the read that would see it.
 * Only on a chain that receives tokens unasked; an opt-in chain prepares its own.
 */
export const useAddIncomingTokenMutation =
    (): UseAddIncomingTokenMutationResult => {
        const { addToken } = useAddTokenMutation()
        const addIncomingToken = useCallback(
            async (variables: AddIncomingTokenVariables) => {
                const { chainId } = variables.scope
                try {
                    if (
                        !receivesUnaskedAssets(chainId) ||
                        isNativeAssetId(chainId, variables.assetId)
                    ) {
                        return
                    }
                    await addToken(variables)
                } catch (error) {
                    logger.warn('Adding an incoming token failed', {
                        scope: variables.scope,
                        assetId: variables.assetId,
                        error,
                    })
                }
            },
            [addToken],
        )
        return { addIncomingToken }
    }
