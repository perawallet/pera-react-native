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
} from '@perawallet/wallet-core-chain-shared'
import type { Maybe } from '@perawallet/wallet-core-shared'
import { chainAccountOf } from '../credentials/accessors'
import type { AccountHoldingSource } from '../db'
import type { WalletAccount } from '../models'
import { useRegisteredChainIds } from './accountChainEntries'
import { useAllAccounts } from './useAllAccounts'

const SOURCE_SEPARATOR = '|'
const FIELD_SEPARATOR = '::'

type NetworkStoreState = ReturnType<typeof useNetworkStore.getState>

// Each source as a string, so a hook can hold them as one primitive and keep
// its result's identity until a chain, an address or a selected network changes.
const sourceKeysOf = (
    state: NetworkStoreState,
    registeredChainIds: readonly ChainId[],
    account: WalletAccount,
): string[] =>
    registeredChainIds.flatMap(chainId => {
        const address = chainAccountOf(account, chainId)?.address
        return address
            ? [
                  [chainId, selectChainNetworkId(state, chainId), address].join(
                      FIELD_SEPARATOR,
                  ),
              ]
            : []
    })

const sourcesOfKey = (key: string): AccountHoldingSource[] =>
    key
        ? key.split(SOURCE_SEPARATOR).map(source => {
              const [chainId, networkId, address] = source.split(
                  FIELD_SEPARATOR,
              ) as [ChainId, NetworkId, string]
              return { address, scope: { chainId, networkId } }
          })
        : []

/**
 * Where the account's holdings live: one source per registered chain the
 * account has an entry on, in registry order, at that chain's selected
 * network.
 */
export const useAccountHoldingSources = (
    account: Maybe<WalletAccount>,
): AccountHoldingSource[] => {
    const registeredChainIds = useRegisteredChainIds()
    const key = useNetworkStore(state =>
        account
            ? sourceKeysOf(state, registeredChainIds, account).join(
                  SOURCE_SEPARATOR,
              )
            : '',
    )

    return useMemo(() => sourcesOfKey(key), [key])
}

/**
 * Every account's holding sources, accounts in store order and each one's
 * chains in registry order; an address on a scope that two accounts share is
 * listed once.
 */
export const useWalletHoldingSources = (): AccountHoldingSource[] => {
    const accounts = useAllAccounts()
    const registeredChainIds = useRegisteredChainIds()
    const key = useNetworkStore(state =>
        [
            ...new Set(
                accounts.flatMap(account =>
                    sourceKeysOf(state, registeredChainIds, account),
                ),
            ),
        ].join(SOURCE_SEPARATOR),
    )

    return useMemo(() => sourcesOfKey(key), [key])
}
