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

import { useQuery } from '@tanstack/react-query'
import {
    useAlgorandClient,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import { fetchOnChainAccountInformation } from './endpoints'
import { mapOnChainAccountInformation } from './mappers'
import { getOnChainAccountInformationQueryKey } from './querykeys'

// Short freshness window instead of refetch-on-every-mount: send-flow
// navigation remounts consumers several times back-to-back, and each remount
// was a guaranteed algod hit.
const ON_CHAIN_ACCOUNT_INFO_STALE_TIME_MS = 15_000

export const useOnChainAccountInformationQuery = (address: string) => {
    const { network } = useNetwork()
    const algokit = useAlgorandClient()

    return useQuery({
        queryKey: getOnChainAccountInformationQueryKey(address, network),
        queryFn: () => fetchOnChainAccountInformation(algokit, address),
        select: mapOnChainAccountInformation,
        enabled: !!address,
        staleTime: ON_CHAIN_ACCOUNT_INFO_STALE_TIME_MS,
    })
}
