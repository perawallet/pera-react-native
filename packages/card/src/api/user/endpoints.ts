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

import { HTTPError } from 'ky'
import { ZodError } from 'zod'
import {
    logger,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { getCardTransport } from '../transport'
import type { CardUser, VeriffSession } from '../../models'
import { userResponseSchema, verificationSessionResponseSchema } from './schema'
import { transformUser } from './transformers'

export type FetchUserParams = {
    network: Network
    signal?: AbortSignal
}

/** Returns `null` when there is no user record yet (404). */
export const fetchUser = async (
    params: FetchUserParams,
): Promise<Nullable<CardUser>> => {
    const { network, signal } = params

    try {
        const response = await getCardTransport().request({
            network,
            method: 'GET',
            path: '/v1/user',
            authenticated: true,
            signal,
        })
        return transformUser(userResponseSchema.parse(response.data))
    } catch (error) {
        if (error instanceof HTTPError && error.response.status === 404) {
            return null
        }
        if (error instanceof ZodError) {
            logger.warn('User response validation failed', {
                issues: error.issues,
            })
            return null
        }
        throw error
    }
}

export type FetchVerificationSessionParams = {
    network: Network
    signal?: AbortSignal
}

/**
 * Starts/returns the Veriff KYC session via GET /v1/user/verification. The
 * caller opens the returned `sessionUrl`, then polls GET /v1/user for the
 * `verificationState` to transition.
 */
export const fetchVerificationSession = async (
    params: FetchVerificationSessionParams,
): Promise<VeriffSession> => {
    const response = await getCardTransport().request({
        network: params.network,
        method: 'GET',
        path: '/v1/user/verification',
        authenticated: true,
        signal: params.signal,
    })
    const parsed = verificationSessionResponseSchema.parse(response.data)
    return { sessionUrl: parsed.sessionUrl }
}
