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

// @vitest-environment node

import { describe, it, expect, vi } from 'vitest'
import type { ConnectionSettingsRow } from '@perawallet/wallet-core-connections'
import {
    isSiteConnectionKind,
    toUnifiedConnection,
} from '../connectionsSettingsHelpers'

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
    networks: [{ chainId: 'algorand', networkId: 'mainnet' }],
}

const noChainName = () => undefined

describe('toUnifiedConnection', () => {
    // The unified list is kind-agnostic; the badge and copy branch on the
    // record's own kind, not on a label the mapper invents.
    it('carries the row kind through instead of relabelling it', () => {
        expect(toUnifiedConnection(row, vi.fn(), noChainName).kind).toBe(
            'walletconnect-v1',
        )
    })

    it('badges an EVM site with its chain’s name, so it reads apart from the same site’s Algorand row', () => {
        const chainNameOf = vi.fn((chainId: string) =>
            chainId === 'base' ? 'Base' : undefined,
        )
        const evmRow: ConnectionSettingsRow = {
            ...row,
            kind: 'dapp-eip1193',
            networks: [{ chainId: 'base', networkId: 'mainnet' }],
        }

        expect(
            toUnifiedConnection(evmRow, vi.fn(), chainNameOf).badgeLabel,
        ).toBe('Base')
        expect(
            toUnifiedConnection({ ...row, kind: 'dapp' }, vi.fn(), chainNameOf)
                .badgeLabel,
        ).toBeUndefined()
    })

    it('falls back to the kind’s own badge when the EVM site’s chain is unknown here', () => {
        const evmRow: ConnectionSettingsRow = {
            ...row,
            kind: 'dapp-eip1193',
            networks: [],
        }

        expect(
            toUnifiedConnection(evmRow, vi.fn(), () => 'Base').badgeLabel,
        ).toBeUndefined()
        expect(
            toUnifiedConnection(
                {
                    ...evmRow,
                    networks: [{ chainId: 'base', networkId: 'mainnet' }],
                },
                vi.fn(),
                noChainName,
            ).badgeLabel,
        ).toBeUndefined()
    })

    it('revokes by the connection id', () => {
        const revoke = vi.fn()

        toUnifiedConnection(row, revoke, noChainName).onRevoke()

        expect(revoke).toHaveBeenCalledWith('conn-1')
    })
})

describe('isSiteConnectionKind', () => {
    it('counts both injected providers as site connections and WalletConnect as neither', () => {
        expect(isSiteConnectionKind('dapp')).toBe(true)
        expect(isSiteConnectionKind('dapp-eip1193')).toBe(true)
        expect(isSiteConnectionKind('walletconnect-v1')).toBe(false)
        expect(isSiteConnectionKind('walletconnect-v2')).toBe(false)
    })
})
