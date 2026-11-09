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

import { delay, http, HttpResponse, type RequestHandler } from 'msw'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { rejectUnauthenticated } from '../../assets/api/msw-handlers'
import { simulationPath } from './endpoints'
import type { EvmSimulationResponse } from './schema'

export type PeraEvmSimulationFixtures = {
    /** Defaults to every host. */
    baseUrl?: string
    /**
     * The answer to every simulation. A number fails the request with that
     * status; `'hang'` never answers. Unset, the backend serves no simulation.
     */
    simulation?: EvmSimulationResponse | number | 'hang'
}

export const simulationSuccessResponse = (
    assetChanges: EvmSimulationResponse['asset_changes'],
    approvalChanges: EvmSimulationResponse['approval_changes'] = [],
): EvmSimulationResponse => ({
    status: 'success',
    block_number: 26_347_663,
    asset_changes: assetChanges,
    approval_changes: approvalChanges,
    revert_reason: null,
    unavailable_reason: null,
})

export const simulationRevertedResponse = (
    reason: Nullable<string>,
): EvmSimulationResponse => ({
    status: 'reverted',
    block_number: 26_347_663,
    asset_changes: [],
    approval_changes: [],
    revert_reason: reason,
    unavailable_reason: null,
})

export const simulationUnavailableResponse = (
    reason = 'provider_error',
): EvmSimulationResponse => ({
    status: 'unavailable',
    block_number: null,
    asset_changes: [],
    approval_changes: [],
    revert_reason: null,
    unavailable_reason: reason,
})

/** The Pera backend's transaction-simulation endpoint. */
export const peraEvmSimulationHandlers = ({
    baseUrl = '*',
    simulation = simulationUnavailableResponse('chain_not_supported'),
}: PeraEvmSimulationFixtures = {}): RequestHandler[] => [
    http.post(
        `${baseUrl.replace(/\/+$/, '')}${simulationPath(':chainId')}`,
        async ({ request }) => {
            const refused = rejectUnauthenticated(request)
            if (refused) return refused
            if (simulation === 'hang') {
                await delay('infinite')
            }
            if (typeof simulation === 'number') {
                return HttpResponse.json({}, { status: simulation })
            }
            return HttpResponse.json(simulation)
        },
    ),
]
