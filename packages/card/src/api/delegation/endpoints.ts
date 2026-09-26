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

import type { Network } from '@perawallet/wallet-core-shared'
import { getCardApiError, isAlreadyCreatedError } from '../errors'
import { getCardTransport } from '../transport'
import {
    cardAdapterFor,
    type DelegationApprovalParams,
    type DelegatorProgramParams,
} from '../../chain-adapter'
import type { CardDelegationToken, CardExternalWallet } from '../../models'
import {
    delegationAcceptedResponseSchema,
    delegationTokenResponseSchema,
    externalWalletsResponseSchema,
} from './schema'
import { transformExternalWallet } from './transformers'

export type DelegationRequestParams = {
    network: Network
    signal?: AbortSignal
}

/** Single-use (~10 min) token pair consumed by the post-approval call. */
export const fetchDelegationToken = async (
    params: DelegationRequestParams,
): Promise<CardDelegationToken> => {
    const { network, signal } = params

    const response = await getCardTransport().request({
        network,
        method: 'GET',
        path: '/v1/delegation/token',
        authenticated: true,
        signal,
    })

    return delegationTokenResponseSchema.parse(response.data)
}

export const fetchExternalWallets = async (
    params: DelegationRequestParams,
): Promise<CardExternalWallet[]> => {
    const { network, signal } = params

    const response = await getCardTransport().request({
        network,
        method: 'GET',
        path: '/v1/wallet/external',
        authenticated: true,
        signal,
    })

    return externalWalletsResponseSchema
        .parse(response.data)
        .map(transformExternalWallet)
}

/**
 * A 2xx the schema cannot read is still a success: the delegation service
 * answers some calls with a bare status line, and rejecting that shape would
 * fail a registration it has already accepted. Only an explicit `success:
 * false` is a rejection.
 */
const assertAccepted = (data: unknown): void => {
    const parsed = delegationAcceptedResponseSchema.safeParse(data)
    if (parsed.success && !parsed.data.success) {
        throw new Error('Card delegation was rejected')
    }
}

export type PostDelegationApprovalParams = DelegationApprovalParams & {
    network: Network
    signal?: AbortSignal
}

/**
 * Registers the delegated wallet with Baanx, completing card creation. A
 * replay of a lost response resolves rather than throwing: the delegation is
 * registered either way.
 */
export const postDelegationApproval = async ({
    network,
    signal,
    ...params
}: PostDelegationApprovalParams): Promise<void> => {
    const { path, data } =
        cardAdapterFor(network).delegationApprovalRequest(params)

    try {
        const response = await getCardTransport().request({
            network,
            method: 'POST',
            path,
            authenticated: true,
            data,
            signal,
        })
        assertAccepted(response.data)
    } catch (error) {
        const apiError = await getCardApiError(error)
        if (isAlreadyCreatedError(apiError)) return
        throw error
    }
}

export type PostDelegatorLsigParams = DelegatorProgramParams & {
    network: Network
    signal?: AbortSignal
}

/**
 * Persists the signed AutoDraw delegation with Baanx, keyed by the delegator
 * that signed it. The delegation signature is itself the ownership proof, so
 * no separate SIWA signature accompanies it. Registered once per wallet and
 * currency.
 */
export const postDelegatorLsig = async ({
    network,
    signal,
    ...params
}: PostDelegatorLsigParams): Promise<void> => {
    const { path, data } =
        cardAdapterFor(network).delegatorProgramRequest(params)

    const response = await getCardTransport().request({
        network,
        method: 'POST',
        path,
        authenticated: true,
        data,
        signal,
    })

    assertAccepted(response.data)
}
