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
    setLastRefreshedRound: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: {
        getState: () => ({
            accounts: [{ address: 'ADDR1' }, { address: 'ADDR2' }],
        }),
    },
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetworkStore: { getState: () => ({ network: 'testnet' }) },
}))

vi.mock('@perawallet/wallet-core-polling', () => ({
    usePollingStore: {
        getState: () => ({
            lastRefreshedRound: { mainnet: 42 },
            setLastRefreshedRound: mocks.setLastRefreshedRound,
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

    it('writes the checkpoint through the polling store', () => {
        createSyncStorePorts().setLastRefreshedRound('mainnet', 99)

        expect(mocks.setLastRefreshedRound).toHaveBeenCalledWith('mainnet', 99)
    })
})
