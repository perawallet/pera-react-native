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
    addDeviceIntegrityHeader,
    logger,
    queryClient,
    type Network,
} from '@perawallet/wallet-core-shared'

import {
    feeDelegationResponseSchema,
    type FeeDelegationApiResponse,
    type FeeDelegationRequest,
} from './schema'

/**
 * Logs the backend's `{ error, code }` body for a sponsorship refusal. The
 * shared normalizer only carries a `type` discriminator, so this route's
 * `code` would otherwise be dropped, leaving just "503 service unavailable"
 * for three causes that are fixed in completely different places:
 * FEE_DELEGATION_UNCONFIGURED (deployment env), FEE_DELEGATOR_INSUFFICIENT_FUNDS
 * (top up the sponsor) and ALGOD_UNAVAILABLE (infra).
 *
 * Reads ky's pre-parsed `data`: ky consumes the response body to populate it,
 * so `response.json()` no longer works. The thrown value is normally a
 * `PeraNetworkError`, which exposes the ky error as `originalError`, so this
 * checks both that and the raw error (for a direct throw).
 */
const logFeeDelegationFailure = (error: unknown): void => {
    const candidates = [
        error,
        (error as { originalError?: unknown })?.originalError,
    ]
    for (const candidate of candidates) {
        const body = (candidate as { data?: unknown })?.data
        if (body === undefined || body === null) continue
        logger.error('Fee delegation refused by the backend', {
            status: (candidate as { response?: { status?: number } })?.response
                ?.status,
            body,
        })
        return
    }
    logger.error('Fee delegation request failed', { error })
}

/**
 * Asks the backend to sponsor the fees (and, with `includeAssetOptInMbr`,
 * the account's MBR shortfall) for an unsigned transaction group. The backend prepends a
 * sponsor payment, RE-GROUPS the whole payload (new group id), signs only the
 * sponsor slot, and returns the ARC-0001 group for the wallet to sign its own
 * slots. The route sits behind the app-integrity guard, so a valid (non-
 * expired) attestation token is required.
 */
export const requestFeeDelegation = async (
    request: FeeDelegationRequest,
    integrityToken: string,
    network: Network,
    signal?: AbortSignal,
): Promise<FeeDelegationApiResponse> => {
    let response
    try {
        response = await queryClient<unknown>({
            backend: 'pera',
            network,
            method: 'POST',
            url: '/api/v3/fee-delegation',
            data: request,
            headers: addDeviceIntegrityHeader({
                'x-app-integrity-token': integrityToken,
            }),
            signal,
        })
    } catch (error) {
        logFeeDelegationFailure(error)
        throw error
    }

    return feeDelegationResponseSchema.parse(response.data)
}
