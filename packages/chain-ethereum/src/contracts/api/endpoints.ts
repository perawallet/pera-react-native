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

import { getAddress, type Address } from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { buildIntegrityHeadersWhenReady } from '@perawallet/wallet-core-app-integrity'
import {
    isPeraServiceUnavailableError,
    queryClient,
    type Nullable,
    type Optional,
    type RequestConfiguration,
} from '@perawallet/wallet-core-shared'
import { eip155ChainIdOf } from '../../blockchain/utils/caip19'
import type { EvmChain } from '../../chains/types'
import type { EvmContractAbiAnswer, EvmContractMetadata } from '../types'
import { evmContractResponseSchema, type EvmContractResponse } from './schema'

export const CONTRACTS_SERVICE = 'contracts'

export type EvmContractPart = 'abi' | 'metadata'

// The backend's uncached ABI lookup asks the chain and then two registries in
// turn, which can take 8 s. Nothing waits on the answer, but the review shows
// a spinner until it settles, so give up soon after that.
export const CONTRACT_ABI_LOOKUP_BOUNDS = {
    timeout: 10_000,
    retry: { limit: 0 },
} satisfies Pick<RequestConfiguration, 'timeout' | 'retry'>

// Metadata alone is one database read, and a label that comes late is worth
// less than the bundled fallback shown meanwhile.
export const CONTRACT_METADATA_LOOKUP_BOUNDS = {
    timeout: 5000,
    retry: { limit: 0 },
} satisfies Pick<RequestConfiguration, 'timeout' | 'retry'>

const BOUNDS: Record<EvmContractPart, typeof CONTRACT_ABI_LOOKUP_BOUNDS> = {
    abi: CONTRACT_ABI_LOOKUP_BOUNDS,
    metadata: CONTRACT_METADATA_LOOKUP_BOUNDS,
}

export const contractPath = (
    eip155ChainId: number | string,
    address: string,
): string => `/api/v3/evm/${eip155ChainId}/contracts/${address}/`

/** Undefined when the scope offers no lookup. */
const fetchContractPart = async (
    scope: ChainScope,
    chain: EvmChain,
    address: Address,
    part: EvmContractPart,
): Promise<Optional<EvmContractResponse>> => {
    let data: unknown
    try {
        ;({ data } = await queryClient<unknown>({
            backend: 'pera',
            service: CONTRACTS_SERVICE,
            scope,
            method: 'GET',
            url: contractPath(
                eip155ChainIdOf(scope, chain),
                address.toLowerCase(),
            ),
            params: { include: part },
            headers: await buildIntegrityHeadersWhenReady(),
            ...BOUNDS[part],
        }))
    } catch (error) {
        if (isPeraServiceUnavailableError(error)) return undefined
        throw error
    }
    return evmContractResponseSchema.parse(data)
}

/**
 * Resolves `unavailable` when the scope offers no lookup; rejects on any
 * other failure, including registries the backend couldn't ask, so a lookup
 * that couldn't answer is never read as "not verified".
 */
export const fetchEvmContractAbi = async (
    scope: ChainScope,
    chain: EvmChain,
    address: Address,
): Promise<EvmContractAbiAnswer> => {
    const response = await fetchContractPart(scope, chain, address, 'abi')
    if (!response) return { status: 'unavailable' }
    const { abi } = response
    if (!abi) throw new Error('The contract answer has no ABI')
    if (abi.status === 'unavailable') {
        throw new Error("The backend couldn't ask the ABI registries")
    }
    if (abi.status !== 'verified') return { status: 'unverified' }
    return {
        status: 'verified',
        abi: abi.abi,
        ...(abi.proxy && {
            proxy: { implementation: getAddress(abi.proxy.implementation) },
        }),
    }
}

/**
 * Null for a contract Pera doesn't know, one whose project isn't verified, or
 * on a scope that offers no lookup: an unchecked entry must never name a
 * contract the user is about to trust.
 */
export const fetchEvmContractMetadata = async (
    scope: ChainScope,
    chain: EvmChain,
    address: Address,
): Promise<Nullable<EvmContractMetadata>> => {
    const response = await fetchContractPart(scope, chain, address, 'metadata')
    const metadata = response?.metadata
    if (!metadata || metadata.project.verification_tier !== 'verified') {
        return null
    }
    return {
        name: metadata.name,
        projectUrl: metadata.project.url,
    }
}
