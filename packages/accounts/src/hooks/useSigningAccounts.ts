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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    selectChainNetworkId,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import type { WalletAccount } from '../models'
import { useAccountChainStateStore, useAccountsStore } from '../store'
import { canSignWith, signingAddressesOn } from '../signer-resolution'
import { useSelectedChainStates } from './useSelectedChainStates'

/** Held accounts something held can sign for on `chainId`. */
export const useSigningAccounts = (chainId: ChainId) => {
    const accounts = useAccountsStore(state => state.accounts)
    const chainStates = useSelectedChainStates(chainId)
    return useMemo(
        () =>
            accounts.filter(account => canSignWith(account, accounts, chainId)),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- chainStates re-runs the memo: canSignWith reads the chain-state store, not its arguments
        [accounts, chainId, chainStates],
    )
}

/**
 * Held accounts something held can sign for on at least one of `chainIds`;
 * an account with no signing entry on any of them is hidden, not disabled.
 */
export const useSigningAccountsOn = (
    chainIds: readonly ChainId[],
): WalletAccount[] => {
    const accounts = useAccountsStore(state => state.accounts)
    const chainStates = useAccountChainStateStore(state => state.states)
    const networkKey = useNetworkStore(state =>
        chainIds.map(chainId => selectChainNetworkId(state, chainId)).join(),
    )
    const chainKey = chainIds.join()
    return useMemo(
        () =>
            accounts.filter(
                account =>
                    signingAddressesOn(account, accounts, chainIds).length > 0,
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- chainKey stands in for chainIds' content; networkKey and chainStates re-run it when the stores signingAddressesOn reads change
        [accounts, chainKey, chainStates, networkKey],
    )
}
