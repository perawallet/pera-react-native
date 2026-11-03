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

import { buildIntegrityHeaders } from '@perawallet/wallet-core-app-integrity'
import type { WalletMode } from '@perawallet/wallet-core-chain-contract'
import { queryClient } from '@perawallet/wallet-core-shared'

export const PERA_CHAINS_PATH = 'api/v4/chains/'

const isChainList = (
    data: unknown,
): data is { results: Array<{ chain_id: string }> } =>
    typeof data === 'object' &&
    data !== null &&
    Array.isArray((data as { results?: unknown }).results) &&
    (data as { results: unknown[] }).results.every(
        item =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as { chain_id?: unknown }).chain_id === 'string',
    )

/**
 * The CAIP-2 ids of every chain the deployment serves. Rejects on a body that
 * isn't a chain list, so a broken answer never reads as "no chains".
 */
export const fetchPeraServedChainIds = async (
    deployment: WalletMode,
): Promise<string[]> => {
    const { data } = await queryClient<unknown>({
        backend: 'pera',
        deployment,
        method: 'GET',
        url: PERA_CHAINS_PATH,
        headers: buildIntegrityHeaders(),
    })
    if (!isChainList(data)) {
        throw new Error(
            'GET /api/v4/chains/ answered something other than a chain list',
        )
    }
    return data.results.map(({ chain_id }) => chain_id)
}
