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

import { Networks, queryClient } from '@perawallet/wallet-core-shared'

type AlgoUsdPriceResponse = {
    usd_value?: string | null
}

export type FetchAlgoUsdPriceParams = {
    signal?: AbortSignal
}

export const fetchAlgoUsdPrice = async (
    params?: FetchAlgoUsdPriceParams,
): Promise<string> => {
    const response = await queryClient<AlgoUsdPriceResponse>({
        backend: 'pera',
        network: Networks.mainnet,
        method: 'GET',
        url: `/v1/public/assets/0`,
        signal: params?.signal,
    })

    return response.data.usd_value ?? '0'
}
