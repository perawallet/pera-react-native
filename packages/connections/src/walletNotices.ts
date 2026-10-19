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

import {
    chainAccountOf,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId, NetworkId } from '@perawallet/wallet-core-chain-contract'
import {
    getSelectedScope,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import { dappRequestChainAdapters } from './dappRequest'
import type { ConnectionRegistry } from './registry'

const dappChainIds = (): ChainId[] =>
    dappRequestChainAdapters.list().map(({ chainId }) => chainId)

const addressesOn = (
    accounts: readonly WalletAccount[],
    chainId: ChainId,
): Set<string> =>
    new Set(
        accounts.flatMap(account => {
            const address = chainAccountOf(account, chainId)?.address
            return address === undefined ? [] : [address]
        }),
    )

const symmetricDifference = (a: Set<string>, b: Set<string>): string[] => [
    ...[...a].filter(address => !b.has(address)),
    ...[...b].filter(address => !a.has(address)),
]

/**
 * Feeds the registry a notice whenever a chain's selected network moves or
 * its set of account addresses changes, whatever caused it: a dApp's switch,
 * the wallet's own settings, an account added or removed. The registry fans
 * each notice out; every handler decides whether it concerns a session.
 *
 * Baselines are taken at call time, so a change made before it is never
 * announced. Returns the unsubscribe.
 */
export const watchWalletNotices = (
    registry: Pick<ConnectionRegistry, 'notify'>,
): (() => void) => {
    const networks = new Map<ChainId, NetworkId>()
    const addresses = new Map<ChainId, Set<string>>()
    const accountsNow = useAccountsStore.getState().accounts
    for (const chainId of dappChainIds()) {
        networks.set(chainId, getSelectedScope(chainId).networkId)
        addresses.set(chainId, addressesOn(accountsNow, chainId))
    }

    const unsubscribeNetwork = useNetworkStore.subscribe(() => {
        for (const chainId of dappChainIds()) {
            const scope = getSelectedScope(chainId)
            const before = networks.get(chainId)
            networks.set(chainId, scope.networkId)
            if (before === undefined || before === scope.networkId) continue
            void registry.notify({ type: 'network-changed', scope })
        }
    })

    const unsubscribeAccounts = useAccountsStore.subscribe(
        (state, previous) => {
            if (state.accounts === previous.accounts) return
            for (const chainId of dappChainIds()) {
                const held = addressesOn(state.accounts, chainId)
                const before = addresses.get(chainId)
                addresses.set(chainId, held)
                if (before === undefined) continue
                const changed = symmetricDifference(before, held)
                if (changed.length === 0) continue
                void registry.notify({
                    type: 'accounts-changed',
                    chainId,
                    accounts: [...held],
                    changed,
                })
            }
        },
    )

    return () => {
        unsubscribeNetwork()
        unsubscribeAccounts()
    }
}
