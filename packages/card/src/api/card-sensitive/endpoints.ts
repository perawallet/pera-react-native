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

import type { Network } from '@perawallet/wallet-core-shared'
import { getCardTransport } from '../transport'
import type {
    CardImageCustomCss,
    CardSecureView,
    CardSetPinSession,
} from '../../models'
import {
    cardSecureViewResponseSchema,
    cardSetPinSessionResponseSchema,
} from './schema'
import {
    transformCardSecureView,
    transformCardSetPinSession,
} from './transformers'

export type SensitiveCardParams = {
    network: Network
    signal?: AbortSignal
}

export type CardDetailsTokenParams = SensitiveCardParams & {
    /** Colors for the server-rendered image; Baanx defaults apply if omitted. */
    customCss?: CardImageCustomCss
}

/**
 * Single-use secure view of the card details (PAN/CVV). Returns a token + an
 * image URL to render — raw values are never exposed. Held transiently by the
 * caller; never persisted or cached.
 */
export const fetchCardDetailsToken = async (
    params: CardDetailsTokenParams,
): Promise<CardSecureView> => {
    const response = await getCardTransport().request({
        network: params.network,
        method: 'POST',
        path: '/v1/card/details/token',
        authenticated: true,
        signal: params.signal,
        data: params.customCss ? { customCss: params.customCss } : undefined,
    })
    return transformCardSecureView(
        cardSecureViewResponseSchema.parse(response.data),
    )
}

/** Single-use secure view of the card PIN (rendered as an image). */
export const fetchCardPinToken = async (
    params: SensitiveCardParams,
): Promise<CardSecureView> => {
    const response = await getCardTransport().request({
        network: params.network,
        method: 'POST',
        path: '/v1/card/pin/token',
        authenticated: true,
        signal: params.signal,
    })
    return transformCardSecureView(
        cardSecureViewResponseSchema.parse(response.data),
    )
}

/**
 * Starts a set-PIN session. Returns a token + a hosted page URL the user opens
 * to set their PIN (the PIN itself is never sent through this client).
 */
export const createSetPinSession = async (
    params: SensitiveCardParams,
): Promise<CardSetPinSession> => {
    const response = await getCardTransport().request({
        network: params.network,
        method: 'POST',
        path: '/v1/card/set-pin/token',
        authenticated: true,
        signal: params.signal,
    })
    return transformCardSetPinSession(
        cardSetPinSessionResponseSchema.parse(response.data),
    )
}
