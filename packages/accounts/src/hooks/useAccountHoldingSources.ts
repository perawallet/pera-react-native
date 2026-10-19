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
import type { ChainId, NetworkId } from '@perawallet/wallet-core-chain-contract'
import {
    selectChainNetworkId,
    useNetworkStore,
    useSwitchedOffChainIds,
} from '@perawallet/wallet-core-chain-shared'
import type { Maybe } from '@perawallet/wallet-core-shared'
import { chainAccountOf } from '../credentials/accessors'
import type { AccountHoldingSource } from '../db'
import type { WalletAccount } from '../models'
import { useRegisteredChainIds } from './accountChainEntries'

const SOURCE_SEPARATOR = '|'
const FIELD_SEPARATOR = '::'

/**
 * Where the account's holdings live: one source per registered chain the
 * account has an entry on, in registry order, at that chain's selected
 * network. A switched-off chain contributes none.
 */
export const useAccountHoldingSources = (
    account: Maybe<WalletAccount>,
): AccountHoldingSource[] => {
    const registeredChainIds = useRegisteredChainIds()
    const switchedOffChainIds = useSwitchedOffChainIds()
    // A primitive, so the result keeps its identity until a chain, an address
    // or a selected network actually changes.
    const key = useNetworkStore(state =>
        account
            ? registeredChainIds
                  .filter(chainId => !switchedOffChainIds.includes(chainId))
                  .flatMap(chainId => {
                      const address = chainAccountOf(account, chainId)?.address
                      return address
                          ? [
                                [
                                    chainId,
                                    selectChainNetworkId(state, chainId),
                                    address,
                                ].join(FIELD_SEPARATOR),
                            ]
                          : []
                  })
                  .join(SOURCE_SEPARATOR)
            : '',
    )

    return useMemo(
        () =>
            key
                ? key.split(SOURCE_SEPARATOR).map(source => {
                      const [chainId, networkId, address] = source.split(
                          FIELD_SEPARATOR,
                      ) as [ChainId, NetworkId, string]
                      return { address, scope: { chainId, networkId } }
                  })
                : [],
        [key],
    )
}
