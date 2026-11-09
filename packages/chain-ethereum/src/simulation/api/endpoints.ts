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
import { buildIntegrityHeaders } from '@perawallet/wallet-core-app-integrity'
import {
    isPeraServiceUnavailableError,
    queryClient,
    type RequestConfiguration,
} from '@perawallet/wallet-core-shared'
import { eip155ChainIdOf } from '../../blockchain/utils/caip19'
import type { EvmChain } from '../../chains/types'
import type { EvmSimulationRequest, EvmTransactionSimulation } from '../types'
import { evmSimulationResponseSchema } from './schema'
import { toEvmTransactionSimulation } from './transformers'

export const SIMULATIONS_SERVICE = 'simulations'

// The backend answers within about 3 s or says unavailable; one retry would
// only hold the review's spinner longer, and it rate-limits each device.
export const SIMULATION_REQUEST_BOUNDS = {
    timeout: 5000,
    retry: { limit: 0 },
} satisfies Pick<RequestConfiguration, 'timeout' | 'retry'>

export const simulationPath = (eip155ChainId: number | string): string =>
    `/api/v3/evm/${eip155ChainId}/simulations/`

/**
 * Resolves `unavailable` when the scope offers no simulation or the backend
 * can't make a prediction; rejects on any other failure. Neither is ever an
 * empty success.
 */
export const fetchEvmTransactionSimulation = async (
    scope: ChainScope,
    chain: EvmChain,
    request: EvmSimulationRequest,
): Promise<EvmTransactionSimulation> => {
    let data: unknown
    try {
        ;({ data } = await queryClient<unknown>({
            backend: 'pera',
            service: SIMULATIONS_SERVICE,
            scope,
            method: 'POST',
            url: simulationPath(eip155ChainIdOf(scope, chain)),
            headers: buildIntegrityHeaders(),
            data: {
                from: request.from.toLowerCase(),
                to: request.to.toLowerCase(),
                value: request.value.toFixed(),
                data: request.data,
                gas: request.gas.toString(),
                max_fee_per_gas: request.maxFeePerGas.toFixed(),
                max_priority_fee_per_gas:
                    request.maxPriorityFeePerGas.toFixed(),
            },
            ...SIMULATION_REQUEST_BOUNDS,
        }))
    } catch (error) {
        if (isPeraServiceUnavailableError(error)) {
            return { status: 'unavailable' }
        }
        throw error
    }
    return toEvmTransactionSimulation(
        evmSimulationResponseSchema.parse(data),
        scope,
        chain,
    )
}
