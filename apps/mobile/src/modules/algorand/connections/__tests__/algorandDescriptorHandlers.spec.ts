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

type DappDeps = { chainId: string; getCustomNetworkGenesisHash: () => unknown }

const {
    createWalletConnectV1Handler,
    createDappConnectionHandler,
    customNodes,
} = vi.hoisted(() => ({
    createWalletConnectV1Handler: vi.fn((_deps: unknown) => ({
        kind: 'walletconnect-v1',
    })),
    createDappConnectionHandler: vi.fn((_deps: DappDeps) => ({
        kind: 'dapp',
    })),
    customNodes: new Map<string, { genesisHash: string }>(),
}))

vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    createWalletConnectV1Handler,
}))

vi.mock('@perawallet/wallet-core-dapp', () => ({
    createDappConnectionHandler,
    createNoopDappTransport: () => ({}),
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    customNodeAdapters: {
        has: (chainId: string) => customNodes.has(chainId),
        get: (chainId: string) => ({ read: () => customNodes.get(chainId) }),
    },
}))

import { createAlgorandDescriptorHandlers } from '../algorandDescriptorHandlers'

const getNetworkId = vi.fn()

const dappDeps = (): DappDeps => {
    createAlgorandDescriptorHandlers({ getNetworkId })
    return createDappConnectionHandler.mock.calls[0][0]
}

describe('createAlgorandDescriptorHandlers', () => {
    beforeEach(() => {
        customNodes.clear()
        createWalletConnectV1Handler.mockClear()
        createDappConnectionHandler.mockClear()
    })

    it('builds the v1 and dapp handlers on the Algorand chain', () => {
        const handlers = createAlgorandDescriptorHandlers({ getNetworkId })

        expect(handlers).toEqual([
            { kind: 'walletconnect-v1' },
            { kind: 'dapp' },
        ])
        expect(createWalletConnectV1Handler).toHaveBeenCalledWith({
            chainId: 'algorand',
            getNetworkId,
        })
        expect(dappDeps().chainId).toBe('algorand')
    })

    it("reads the custom network genesis hash from the dapp handler's chain", () => {
        customNodes.set('algorand', { genesisHash: 'custom-gh' })

        expect(dappDeps().getCustomNetworkGenesisHash()).toBe('custom-gh')
    })

    it('has no genesis hash when the chain has no custom node', () => {
        expect(dappDeps().getCustomNetworkGenesisHash()).toBeUndefined()
    })
})
