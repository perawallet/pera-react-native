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

import { settleBatch } from '../utils/async'
import { queryClient } from './query-client'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'

export type AccountFastLookup = {
    address: string
    accountExists: boolean
}

export type AccountFastLookupResponse = AccountFastLookup[]

// Pera's mobile API serves fast-lookup as a per-address GET — the address
// is embedded in the URL path. There is no batch endpoint; iOS issues one
// request per address.
export const getAccountFastLookupEndpointPath = (address: string) =>
    `/v1/accounts/fast-lookup/${address}/`

/**
 * Raw wire-format response for `/v1/accounts/fast-lookup/{address}/`.
 * Exported so MSW handler factories in `msw-handlers.ts` stay coupled to
 * the real shape — if the API contract drifts, this type changes and both
 * the production fetcher and the mock break together.
 */
export type RawFastLookupResponse = {
    algo_value?: string
    usd_value?: string
    calculation_type?: string
    account_exists?: boolean
}

/**
 * Single-address on-chain presence probe that DISTINGUISHES "not on chain"
 * (`false`) from "probe unavailable" (network/API failure, which THROWS).
 */
export const fetchAccountExists = async (
    address: string,
    scope: ChainScope,
): Promise<boolean> => {
    const response = await queryClient<RawFastLookupResponse>({
        backend: 'pera',
        scope,
        method: 'GET',
        url: getAccountFastLookupEndpointPath(address),
    })
    return response.data?.account_exists ?? false
}

/**
 * One entry per address that answered: a lookup that fails while others in
 * the batch answer is left out, so the HD walk reads it as inactive (it still
 * counts toward the gap, as in iOS's recoverAccounts) and reports the batch
 * as partly answered. Rejects when every lookup fails, so an offline batch
 * isn't read as empty.
 */
export const fetchAccountFastLookup = async (
    addresses: string[],
    scope: ChainScope,
): Promise<AccountFastLookupResponse> => {
    const exists = await settleBatch<string, boolean | undefined>(
        addresses,
        address => fetchAccountExists(address, scope),
        undefined,
    )
    return addresses.flatMap((address, i) => {
        const accountExists = exists[i]
        return accountExists === undefined ? [] : [{ address, accountExists }]
    })
}
