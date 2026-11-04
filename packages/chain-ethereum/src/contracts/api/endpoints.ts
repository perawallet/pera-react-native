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
import { buildIntegrityHeaders } from '@perawallet/wallet-core-app-integrity'
import {
    isPeraServiceUnavailableError,
    queryClient,
    type RequestConfiguration,
} from '@perawallet/wallet-core-shared'
import { eip155ChainIdOf } from '../../blockchain/utils/caip19'
import type { EvmChain } from '../../chains/types'
import type { EvmContractAbiAnswer } from '../types'
import { evmContractAbiResponseSchema } from './schema'

export const CONTRACTS_SERVICE = 'contracts'

// The backend's uncached lookup asks the chain and then two registries in
// turn, which can take 8 s. Nothing waits on the answer, but the review shows
// a spinner until it settles, so give up soon after that.
export const CONTRACT_ABI_LOOKUP_BOUNDS = {
    timeout: 10_000,
    retry: { limit: 0 },
} satisfies Pick<RequestConfiguration, 'timeout' | 'retry'>

export const contractAbiPath = (
    eip155ChainId: number | string,
    address: string,
): string => `/api/v3/evm/${eip155ChainId}/contracts/${address}/abi/`

/**
 * Resolves `unavailable` when the scope offers no lookup; rejects on any
 * other failure, so a backend that couldn't answer is never read as
 * "not verified".
 */
export const fetchEvmContractAbi = async (
    scope: ChainScope,
    chain: EvmChain,
    address: Address,
): Promise<EvmContractAbiAnswer> => {
    let data: unknown
    try {
        ;({ data } = await queryClient<unknown>({
            backend: 'pera',
            service: CONTRACTS_SERVICE,
            scope,
            method: 'GET',
            url: contractAbiPath(
                eip155ChainIdOf(scope, chain),
                address.toLowerCase(),
            ),
            headers: buildIntegrityHeaders(),
            ...CONTRACT_ABI_LOOKUP_BOUNDS,
        }))
    } catch (error) {
        if (isPeraServiceUnavailableError(error)) {
            return { status: 'unavailable' }
        }
        throw error
    }
    const response = evmContractAbiResponseSchema.parse(data)
    if (response.status !== 'verified') return { status: 'unverified' }
    return {
        status: 'verified',
        abi: response.abi,
        ...(response.proxy && {
            proxy: {
                implementation: getAddress(response.proxy.implementation),
            },
        }),
    }
}
