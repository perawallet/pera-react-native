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
import { contractPath } from './endpoints'
import type {
    EvmContractAbiResponse,
    EvmContractMetadataResponse,
} from './schema'

export type PeraEvmContractFixtures = {
    /** Defaults to every host. */
    baseUrl?: string
    /**
     * Answers keyed by lowercase contract address; an address left out is
     * not verified. A number fails every lookup with that status.
     */
    contractAbis?: Record<string, EvmContractAbiResponse> | number
    /** Pera's curated metadata keyed by lowercase contract address; an address left out is unknown. */
    contractMetadata?: Record<string, EvmContractMetadataResponse>
}

export const contractMetadataResponse = (
    name: string,
    projectName: string,
    projectUrl: string,
    verificationTier = 'verified',
): EvmContractMetadataResponse => ({
    name,
    project: {
        name: projectName,
        url: projectUrl,
        logo_png: null,
        verification_tier: verificationTier,
    },
})

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

/** The Pera backend's contracts endpoint, answering only the parts `include` asks for. */
export const peraEvmContractHandlers = ({
    baseUrl = '*',
    contractAbis = {},
    contractMetadata = {},
}: PeraEvmContractFixtures = {}): RequestHandler[] => [
    http.get(
        `${baseUrl.replace(/\/+$/, '')}${contractPath(':chainId', ':address')}`,
        ({ request, params }) => {
            const refused = rejectUnauthenticated(request)
            if (refused) return refused
            if (typeof contractAbis === 'number') {
                return HttpResponse.json({}, { status: contractAbis })
            }
            const address = String(params.address).toLowerCase()
            const include = (
                new URL(request.url).searchParams.get('include') ??
                'abi,metadata'
            ).split(',')
            return HttpResponse.json({
                id: `eip155:${String(params.chainId)}:${address}`,
                ...(include.includes('abi') && {
                    abi: contractAbis[address] ?? NOT_VERIFIED,
                }),
                ...(include.includes('metadata') && {
                    metadata: contractMetadata[address] ?? null,
                }),
            })
        },
    ),
]
