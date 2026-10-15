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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { HTTPError } from 'ky'
import { ZodError } from 'zod'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { getCardTransport } from '../transport'
import { CardType, type Card } from '../../models'
import { cardStatusResponseSchema } from './schema'
import { transformCard } from './transformers'

export type FetchCardStatusParams = {
    scope: ChainScope
    signal?: AbortSignal
}

/** Returns `null` when the user has not ordered a card yet (404). */
export const fetchCardStatus = async (
    params: FetchCardStatusParams,
): Promise<Nullable<Card>> => {
    const { scope, signal } = params

    try {
        const response = await getCardTransport().request({
            scope,
            method: 'GET',
            path: '/v1/card/status',
            authenticated: true,
            signal,
        })
        return transformCard(cardStatusResponseSchema.parse(response.data))
    } catch (error) {
        if (error instanceof HTTPError && error.response.status === 404) {
            return null
        }
        if (error instanceof ZodError) {
            logger.warn('Card status response validation failed', {
                issues: error.issues,
            })
            return null
        }
        throw error
    }
}

export type OrderCardParams = {
    type?: CardType
    scope: ChainScope
    signal?: AbortSignal
}

export const orderCard = async (params: OrderCardParams): Promise<void> => {
    const { type = CardType.Virtual, scope, signal } = params

    await getCardTransport().request({
        scope,
        method: 'POST',
        path: '/v1/card/order',
        authenticated: true,
        data: { type },
        signal,
    })
}

export type CardLifecycleParams = {
    scope: ChainScope
    signal?: AbortSignal
}

export const freezeCard = async (
    params: CardLifecycleParams,
): Promise<void> => {
    await getCardTransport().request({
        scope: params.scope,
        method: 'POST',
        path: '/v1/card/freeze',
        authenticated: true,
        signal: params.signal,
    })
}

export const unfreezeCard = async (
    params: CardLifecycleParams,
): Promise<void> => {
    await getCardTransport().request({
        scope: params.scope,
        method: 'POST',
        path: '/v1/card/unfreeze',
        authenticated: true,
        signal: params.signal,
    })
}
