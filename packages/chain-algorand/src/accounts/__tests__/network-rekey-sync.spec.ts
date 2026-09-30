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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { ALGORAND_CHAIN_ID } from '../../chain-id'

const network = vi.hoisted(() => {
    const listeners: Array<(state: unknown, prev: unknown) => void> = []
    const holder = {
        current: 'mainnet',
        listeners,
        switchTo(next: string) {
            const prev = holder.current
            holder.current = next
            for (const cb of [...listeners])
                cb({ network: next }, { network: prev })
        },
    }
    return holder
})

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetworkStore: {
        getState: () => ({ network: network.current }),
        subscribe: (cb: (state: unknown, prev: unknown) => void) => {
            network.listeners.push(cb)
            return () => {}
        },
    },
}))

const loadModules = async () => {
    vi.resetModules()
    const accounts = await import('@perawallet/wallet-core-accounts')
    const { algorandAccountsAdapter } = await import('../adapter')
    accounts.accountsChainAdapters.reset()
    accounts.accountsChainAdapters.register(algorandAccountsAdapter)
    const { startNetworkRekeySync } = await import('../network-rekey-sync')
    return { ...accounts, startNetworkRekeySync }
}

const account = (): WalletAccount => ({
    id: 'a',
    type: 'algo25',
    address: 'A',
    keyPairId: 'k',
})

describe('startNetworkRekeySync', () => {
    beforeEach(() => {
        network.current = 'mainnet'
        network.listeners.length = 0
    })

    it('flips each account mirror to the new network on a switch', async () => {
        const { useAccountsStore, startNetworkRekeySync } = await loadModules()
        useAccountsStore.getState().setAccounts([account()])
        useAccountsStore.getState().applyNetworkRekeyState('mainnet')
        useAccountsStore
            .getState()
            .updateAccountRekeyAddress('A', 'AUTH', 'mainnet')
        useAccountsStore
            .getState()
            .updateAccountRekeyAddress('A', null, 'testnet')
        startNetworkRekeySync()

        network.switchTo('testnet')
        expect(
            useAccountsStore.getState().accounts[0].rekeyAddress,
        ).toBeUndefined()

        network.switchTo('mainnet')
        expect(useAccountsStore.getState().accounts[0].rekeyAddress).toBe(
            'AUTH',
        )
    })

    it('subscribes once however often it is started', async () => {
        const { startNetworkRekeySync } = await loadModules()
        const before = network.listeners.length

        startNetworkRekeySync()
        startNetworkRekeySync()

        expect(network.listeners).toHaveLength(before + 1)
    })

    it('makes rekeyed and signable state follow the network switch', async () => {
        const {
            useAccountsStore,
            startNetworkRekeySync,
            isRekeyedAccount,
            canSignWith,
        } = await loadModules()
        useAccountsStore.getState().setAccounts([account()])
        useAccountsStore.getState().applyNetworkRekeyState('mainnet')
        // Rekeyed on mainnet to an auth the wallet doesn't hold.
        useAccountsStore
            .getState()
            .updateAccountRekeyAddress('A', 'EXTERNAL', 'mainnet')
        useAccountsStore
            .getState()
            .updateAccountRekeyAddress('A', null, 'testnet')
        startNetworkRekeySync()

        const onMainnet = useAccountsStore.getState().accounts[0]
        expect(isRekeyedAccount(onMainnet)).toBe(true)
        expect(canSignWith(onMainnet, [onMainnet], ALGORAND_CHAIN_ID)).toBe(
            false,
        )

        network.switchTo('testnet')

        const onTestnet = useAccountsStore.getState().accounts[0]
        expect(isRekeyedAccount(onTestnet)).toBe(false)
        expect(canSignWith(onTestnet, [onTestnet], ALGORAND_CHAIN_ID)).toBe(
            true,
        )
    })
})
