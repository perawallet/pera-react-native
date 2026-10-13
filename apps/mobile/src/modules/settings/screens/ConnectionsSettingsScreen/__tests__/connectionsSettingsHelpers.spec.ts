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
import type { ConnectionSettingsRow } from '@perawallet/wallet-core-connections'
import { toUnifiedConnection } from '../connectionsSettingsHelpers'

const row: ConnectionSettingsRow = {
    id: 'conn-1',
    kind: 'walletconnect-v1',
    title: 'Dapp',
    subtitle: 'https://d.app',
    accounts: [],
    isConnected: true,
    createdAt: 1000,
    lastActiveAt: 2000,
    peer: { name: 'Dapp' },
    permissions: [],
    networks: ['mainnet'],
}

describe('toUnifiedConnection', () => {
    // The unified list is kind-agnostic; the badge and copy branch on the
    // record's own kind, not on a label the mapper invents.
    it('carries the row kind through instead of relabelling it', () => {
        expect(toUnifiedConnection(row, vi.fn()).kind).toBe('walletconnect-v1')
    })

    it('revokes by the connection id', () => {
        const revoke = vi.fn()

        toUnifiedConnection(row, revoke).onRevoke()

        expect(revoke).toHaveBeenCalledWith('conn-1')
    })
})
