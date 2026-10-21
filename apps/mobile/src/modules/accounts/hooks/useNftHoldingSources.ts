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

import { useMemo } from 'react'
import {
    useAccountHoldingSources,
    type AccountHoldingSource,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { Maybe } from '@perawallet/wallet-core-shared'
import { useCapabilityCheck } from '@hooks/useCapability'

/** The account's holding sources on chains whose `nft` capability is on. */
export const useNftHoldingSources = (
    account: Maybe<WalletAccount>,
): AccountHoldingSource[] => {
    const sources = useAccountHoldingSources(account)
    const check = useCapabilityCheck()
    // A primitive, so the result keeps its identity until the set of nft
    // chains changes; the checker itself is rebuilt every render.
    const nftChainIds = sources
        .map(({ scope }) => scope.chainId)
        .filter(chainId => check({ chain: { chainId, capability: 'nft' } }))
        .join()

    return useMemo(() => {
        const enabled = new Set(nftChainIds.split(','))
        return sources.filter(({ scope }) => enabled.has(scope.chainId))
    }, [sources, nftChainIds])
}
