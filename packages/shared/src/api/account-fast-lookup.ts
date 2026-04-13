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

export const getAccountFastLookupEndpointPath = () =>
    `/v1/accounts/fast-lookup/`

export const fetchAccountFastLookup = async (
    addresses: string[],
    network: Network,
): Promise<AccountFastLookupResponse> => {
    const endpointPath = getAccountFastLookupEndpointPath()
    const response = await queryClient<AccountFastLookupResponse>({
        backend: 'pera',
        network,
        method: 'POST',
        url: endpointPath,
        data: { addresses },
    })
    return response.data
}
