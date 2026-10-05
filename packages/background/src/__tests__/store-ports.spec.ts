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
            accounts: [{ address: 'ADDR1' }, { address: 'ADDR2' }],
        }),
    },
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useNetworkStore: { getState: () => ({ network: 'testnet' }) },
}))

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
    it('reads accounts and the active network from the stores', () => {
        const ports = createSyncStorePorts()

        expect(ports.getAccountAddresses()).toEqual(['ADDR1', 'ADDR2'])
        expect(ports.getActiveNetwork()).toBe('testnet')
    })

    it('reads a network absent from the round map as never-synced (null)', () => {
        const ports = createSyncStorePorts()

        expect(ports.getLastRefreshedRound('mainnet')).toBe(42)
        expect(ports.getLastRefreshedRound('testnet')).toBeNull()
    })

    it('writes the checkpoint through the sync cursor store', () => {
        createSyncStorePorts().setLastRefreshedRound('mainnet', 99)

        expect(mocks.setRefreshRound).toHaveBeenCalledWith('mainnet', 99)
    })

    it('reads each asset sync timestamp from its own cursor field, null when absent', () => {
        const ports = createSyncStorePorts()

        expect(ports.getLastSyncAt('mainnet', 'assets')).toBe(1000)
        expect(ports.getLastSyncAt('mainnet', 'prices')).toBe(2000)
        expect(ports.getLastSyncAt('testnet', 'assets')).toBeNull()
        expect(ports.getLastSyncAt('testnet', 'prices')).toBeNull()
    })

    it('writes an asset sync timestamp through the sync cursor store', () => {
        createSyncStorePorts().setLastSyncAt('testnet', 'prices', 3000)

        expect(mocks.markSynced).toHaveBeenCalledWith('testnet', 'prices', 3000)
    })
})
