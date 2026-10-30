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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    useChainCapability,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import { useResolvedAddress } from '@hooks/useResolvedAddress'

/**
 * The name-service lookup only runs on a chain that has one, so another
 * chain's address is never sent to it; the fallback is the address truncated
 * with that chain's codec. An empty address skips the lookup.
 */
export const useCounterpartyName = (
    address: string,
    chainId: ChainId,
): string => {
    const hasNameService = useChainCapability(chainId, 'nameService')
    const { displayName } = useResolvedAddress(
        address,
        useSelectedScope(chainId),
        { enabled: !!address && hasNameService },
    )
    return displayName
}
