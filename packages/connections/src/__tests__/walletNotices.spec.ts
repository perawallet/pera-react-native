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
import type { StoreApi, UseBoundStore } from 'zustand'
import { dappRequestChainAdapters } from '../dappRequest'
import { watchWalletNotices } from '../walletNotices'

type FakeAccount = { chains: Record<string, { address: string }> }

// Each chain's network is a pure function of the wallet mode, and one chain
// ('static') never moves, so "moved chains only" is observable.
const NETWORK_BY_MODE: Record<string, Record<string, string>> = {
    live: { algorand: 'mainnet', ethereum: 'mainnet', static: 'only' },
    developer: { algorand: 'testnet', ethereum: 'sepolia', static: 'only' },
}

vi.mock('@perawallet/wallet-core-chain-shared', async () => {
    const { create: createStore } = await import('zustand')
    const store = createStore(() => ({ mode: 'live', unrelated: 0 }))
    return {
        useNetworkStore: store,
        getSelectedScope: (chainId: string) => ({
            chainId,
            networkId: NETWORK_BY_MODE[store.getState().mode][chainId],
        }),
    }
})

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const { create: createStore } = await import('zustand')
    return {
        useAccountsStore: createStore(() => ({
            accounts: [] as FakeAccount[],
            unrelated: 0,
        })),
        chainAccountOf: (account: FakeAccount, chainId: string) =>
            account.chains[chainId],
    }
})

type Fake<T> = UseBoundStore<StoreApi<T>>

const networks = (await import('@perawallet/wallet-core-chain-shared'))
    .useNetworkStore as unknown as Fake<{ mode: string; unrelated: number }>
const accountsStore = (await import('@perawallet/wallet-core-accounts'))
    .useAccountsStore as unknown as Fake<{
    accounts: FakeAccount[]
    unrelated: number
}>

const account = (ethereum?: string, algorand?: string): FakeAccount => ({
    chains: {
        ...(ethereum ? { ethereum: { address: ethereum } } : {}),
        ...(algorand ? { algorand: { address: algorand } } : {}),
    },
})

const registerChain = (chainId: string): void => {
    dappRequestChainAdapters.register({ chainId } as never)
}

describe('watchWalletNotices', () => {
    const notify = vi.fn(async () => {})

    beforeEach(() => {
        notify.mockClear()
        networks.setState({ mode: 'live', unrelated: 0 })
        accountsStore.setState({ accounts: [], unrelated: 0 })
        dappRequestChainAdapters.reset()
        registerChain('algorand')
        registerChain('ethereum')
        registerChain('static')
    })

    it('announces a network-changed notice for each chain whose network moved, and no other', () => {
        const stop = watchWalletNotices({ notify })

        networks.setState({ mode: 'developer' })

        expect(notify).toHaveBeenCalledTimes(2)
        expect(notify).toHaveBeenCalledWith({
            type: 'network-changed',
            scope: { chainId: 'algorand', networkId: 'testnet' },
        })
        expect(notify).toHaveBeenCalledWith({
            type: 'network-changed',
            scope: { chainId: 'ethereum', networkId: 'sepolia' },
        })
        stop()
    })

    it('stays quiet when a network store write moves no network', () => {
        const stop = watchWalletNotices({ notify })

        networks.setState({ unrelated: 1 })

        expect(notify).not.toHaveBeenCalled()
        stop()
    })

    it('announces a switch once, not again on the next unrelated write', () => {
        const stop = watchWalletNotices({ notify })

        networks.setState({ mode: 'developer' })
        notify.mockClear()
        networks.setState({ unrelated: 2 })

        expect(notify).not.toHaveBeenCalled()
        stop()
    })

    it('announces an added account with the wallet addresses and what changed', () => {
        accountsStore.setState({ accounts: [account('0xAAA')] })
        const stop = watchWalletNotices({ notify })

        accountsStore.setState({
            accounts: [account('0xAAA'), account('0xBBB')],
        })

        expect(notify).toHaveBeenCalledTimes(1)
        expect(notify).toHaveBeenCalledWith({
            type: 'accounts-changed',
            chainId: 'ethereum',
            accounts: ['0xAAA', '0xBBB'],
            changed: ['0xBBB'],
        })
        stop()
    })

    it('announces a removed account', () => {
        accountsStore.setState({
            accounts: [account('0xAAA'), account('0xBBB')],
        })
        const stop = watchWalletNotices({ notify })

        accountsStore.setState({ accounts: [account('0xAAA')] })

        expect(notify).toHaveBeenCalledWith({
            type: 'accounts-changed',
            chainId: 'ethereum',
            accounts: ['0xAAA'],
            changed: ['0xBBB'],
        })
        stop()
    })

    it('announces only the chain whose addresses changed', () => {
        const stop = watchWalletNotices({ notify })

        accountsStore.setState({ accounts: [account(undefined, 'ALGO1')] })

        expect(notify).toHaveBeenCalledTimes(1)
        expect(notify).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'accounts-changed',
                chainId: 'algorand',
            }),
        )
        stop()
    })

    it('stays quiet when an account write leaves every address set alone', () => {
        accountsStore.setState({ accounts: [account('0xAAA')] })
        const stop = watchWalletNotices({ notify })

        accountsStore.setState({ accounts: [account('0xAAA')] })
        accountsStore.setState({ unrelated: 1 })

        expect(notify).not.toHaveBeenCalled()
        stop()
    })

    it('stops announcing once unsubscribed', () => {
        const stop = watchWalletNotices({ notify })

        stop()
        networks.setState({ mode: 'developer' })
        accountsStore.setState({ accounts: [account('0xAAA')] })

        expect(notify).not.toHaveBeenCalled()
    })
})
