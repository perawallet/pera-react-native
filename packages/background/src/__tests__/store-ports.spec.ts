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

import { describe, it, expect, vi } from 'vitest'
import { createSyncStorePorts } from '../service/store-ports'

const mocks = vi.hoisted(() => ({
    setRefreshRound: vi.fn(),
    markSynced: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: {
        getState: () => ({
            accounts: [
                {
                    id: '1',
                    custody: { kind: 'watch' },
                    chains: { algorand: { address: 'ADDR1' } },
                },
                {
                    id: '2',
                    custody: { kind: 'watch' },
                    chains: { algorand: { address: 'ADDR2' } },
                },
                {
                    id: '3',
                    custody: { kind: 'watch' },
                    chains: { ethereum: { address: '0xABC' } },
                },
                {
                    id: '4',
                    custody: { kind: 'local', seed: 'bip39' },
                    chains: {
                        algorand: { address: 'ADDR4' },
                        ethereum: { address: '0xDEF' },
                    },
                },
                {
                    id: '5',
                    custody: { kind: 'watch' },
                    // A record from a build that knows more chains.
                    chains: { unknownchain: { address: 'UNKNOWN' } },
                },
            ],
        }),
    },
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    getSelectedScope: (chainId: string) => ({ chainId, networkId: 'testnet' }),
}))

const MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const
const TESTNET = { chainId: 'algorand', networkId: 'testnet' } as const

vi.mock('../polling', () => ({
    useSyncCursorStore: {
        getState: () => ({
            cursors: {
                'algorand/mainnet': {
                    refreshRound: 42,
                    lastAssetSyncAt: 1000,
                    lastPriceSyncAt: 2000,
                },
            },
            setRefreshRound: mocks.setRefreshRound,
            markSynced: mocks.markSynced,
        }),
    },
}))

describe('createSyncStorePorts', () => {
    it('lists every known chain entry of every account, in account order', () => {
        const ports = createSyncStorePorts()

        expect(ports.getAccountChainAddresses()).toEqual([
            { chainId: 'algorand', address: 'ADDR1' },
            { chainId: 'algorand', address: 'ADDR2' },
            { chainId: 'ethereum', address: '0xABC' },
            { chainId: 'algorand', address: 'ADDR4' },
            { chainId: 'ethereum', address: '0xDEF' },
        ])
    })

    it('resolves a chain to its selected scope', () => {
        expect(createSyncStorePorts().getSelectedScope('ethereum')).toEqual({
            chainId: 'ethereum',
            networkId: 'testnet',
        })
    })

    it('reads a scope absent from the cursor map as never-synced (null)', () => {
        const ports = createSyncStorePorts()

        expect(ports.getChangeCursor(MAINNET)).toBe(42)
        expect(ports.getChangeCursor(TESTNET)).toBeNull()
    })

    it('writes the cursor through the sync cursor store', () => {
        createSyncStorePorts().setChangeCursor(MAINNET, 99)

        expect(mocks.setRefreshRound).toHaveBeenCalledWith(MAINNET, 99)
    })

    it('reads each asset sync timestamp from its own cursor field, null when absent', () => {
        const ports = createSyncStorePorts()

        expect(ports.getLastSyncAt(MAINNET, 'assets')).toBe(1000)
        expect(ports.getLastSyncAt(MAINNET, 'prices')).toBe(2000)
        expect(ports.getLastSyncAt(TESTNET, 'assets')).toBeNull()
        expect(ports.getLastSyncAt(TESTNET, 'prices')).toBeNull()
    })

    it('writes an asset sync timestamp through the sync cursor store', () => {
        createSyncStorePorts().setLastSyncAt(TESTNET, 'prices', 3000)

        expect(mocks.markSynced).toHaveBeenCalledWith(TESTNET, 'prices', 3000)
    })
})
