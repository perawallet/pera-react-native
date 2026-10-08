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

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
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

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    getSelectedScope: (chainId: string) => ({
        chainId,
        networkId: network.current,
    }),
    useNetworkStore: {
        getState: () => ({ network: network.current }),
        subscribe: (cb: (state: unknown, prev: unknown) => void) => {
            network.listeners.push(cb)
            return () => {}
        },
    },
}))

type Modules = typeof import('@perawallet/wallet-core-accounts') &
    typeof import('../network-rekey-sync')

// Imported once: re-importing the accounts graph per test is slow enough to
// time out under a loaded runner.
let modules: Modules

const account = (): WalletAccount => ({
    id: 'a',
    custody: { kind: 'local', seed: 'algo25' },
    address: 'A',
    keyPairId: 'k',
})

describe('startNetworkRekeySync', () => {
    beforeAll(async () => {
        const accounts = await import('@perawallet/wallet-core-accounts')
        const { algorandAccountsAdapter } = await import('../adapter')
        accounts.accountsChainAdapters.reset()
        accounts.accountsChainAdapters.register(algorandAccountsAdapter)
        modules = {
            ...accounts,
            ...(await import('../network-rekey-sync')),
        }
    }, 30_000)

    beforeEach(() => {
        network.current = 'mainnet'
        modules.useAccountsStore.getState().resetState()
    })

    // First, while the module's started flag is still unset.
    it('subscribes once however often it is started', () => {
        const before = network.listeners.length

        modules.startNetworkRekeySync()
        modules.startNetworkRekeySync()

        expect(network.listeners).toHaveLength(before + 1)
    })

    it('flips each account mirror to the new network on a switch', () => {
        const { useAccountsStore } = modules
        useAccountsStore.getState().setAccounts([account()])
        useAccountsStore.getState().applyNetworkRekeyState('mainnet')
        useAccountsStore
            .getState()
            .updateAccountRekeyAddress('A', 'AUTH', 'mainnet')
        useAccountsStore
            .getState()
            .updateAccountRekeyAddress('A', null, 'testnet')

        network.switchTo('testnet')
        expect(
            useAccountsStore.getState().accounts[0].rekeyAddress,
        ).toBeUndefined()

        network.switchTo('mainnet')
        expect(useAccountsStore.getState().accounts[0].rekeyAddress).toBe(
            'AUTH',
        )
    })

    it('makes rekeyed and signable state follow the network switch', () => {
        const { useAccountsStore, isRekeyedAccount, canSignWith } = modules
        useAccountsStore.getState().setAccounts([account()])
        useAccountsStore.getState().applyNetworkRekeyState('mainnet')
        // Rekeyed on mainnet to an auth the wallet doesn't hold.
        useAccountsStore
            .getState()
            .updateAccountRekeyAddress('A', 'EXTERNAL', 'mainnet')
        useAccountsStore
            .getState()
            .updateAccountRekeyAddress('A', null, 'testnet')

        const onMainnet = useAccountsStore.getState().accounts[0]
        expect(isRekeyedAccount(onMainnet, ALGORAND_CHAIN_ID)).toBe(true)
        expect(canSignWith(onMainnet, [onMainnet], ALGORAND_CHAIN_ID)).toBe(
            false,
        )

        network.switchTo('testnet')

        const onTestnet = useAccountsStore.getState().accounts[0]
        expect(isRekeyedAccount(onTestnet, ALGORAND_CHAIN_ID)).toBe(false)
        expect(canSignWith(onTestnet, [onTestnet], ALGORAND_CHAIN_ID)).toBe(
            true,
        )
    })
})
