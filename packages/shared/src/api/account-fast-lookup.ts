/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { queryClient } from './query-client'
import type { Network } from '../models/base-types'

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

type RawFastLookupResponse = {
    algo_value?: string
    usd_value?: string
    calculation_type?: string
    account_exists?: boolean
}

export const fetchAccountFastLookup = async (
    addresses: string[],
    network: Network,
): Promise<AccountFastLookupResponse> => {
    const tasks = addresses.map(async (address): Promise<AccountFastLookup> => {
        try {
            const response = await queryClient<RawFastLookupResponse>({
                backend: 'pera',
                network,
                method: 'GET',
                url: getAccountFastLookupEndpointPath(address),
            })
            return {
                address,
                accountExists: response.data?.account_exists ?? false,
            }
        } catch {
            // Treat any failure (404, network, timeout) as "no activity" —
            // mirrors iOS's recoverAccounts behavior where a failed lookup
            // increments the gap counter.
            return { address, accountExists: false }
        }
    })

    return Promise.all(tasks)
}
