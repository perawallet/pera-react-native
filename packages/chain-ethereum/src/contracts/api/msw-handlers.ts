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

import { http, HttpResponse, type RequestHandler } from 'msw'
import type { Address } from 'viem'
import { rejectUnauthenticated } from '../../assets/api/msw-handlers'
import { contractAbiPath } from './endpoints'
import type { EvmContractAbiResponse } from './schema'

export type PeraEvmContractAbiFixtures = {
    /** Defaults to every host. */
    baseUrl?: string
    /**
     * Answers keyed by lowercase contract address; an address left out is
     * not verified. A number fails every lookup with that status.
     */
    contractAbis?: Record<string, EvmContractAbiResponse> | number
}

export const verifiedAbiResponse = (
    abi: readonly unknown[],
    implementation?: Address,
): EvmContractAbiResponse => ({
    status: 'verified',
    abi: [...abi],
    registry: 'sourcify',
    proxy: implementation
        ? { standard: 'eip1967', implementation: implementation.toLowerCase() }
        : null,
})

const NOT_VERIFIED: EvmContractAbiResponse = {
    status: 'not_verified',
    abi: null,
    registry: null,
    proxy: null,
}

/** The Pera backend's verified-ABI endpoint. */
export const peraEvmContractAbiHandlers = ({
    baseUrl = '*',
    contractAbis = {},
}: PeraEvmContractAbiFixtures = {}): RequestHandler[] => [
    http.get(
        `${baseUrl.replace(/\/+$/, '')}${contractAbiPath(':chainId', ':address')}`,
        ({ request, params }) => {
            const refused = rejectUnauthenticated(request)
            if (refused) return refused
            if (typeof contractAbis === 'number') {
                return HttpResponse.json({}, { status: contractAbis })
            }
            return HttpResponse.json(
                contractAbis[String(params.address).toLowerCase()] ??
                    NOT_VERIFIED,
            )
        },
    ),
]
