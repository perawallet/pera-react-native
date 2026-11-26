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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    useTokenInboxQuery,
    useWalletHoldingSources,
} from '@perawallet/wallet-core-accounts'
import { useTokenInboxes } from '../useTokenInboxes'

const ETHEREUM = { chainId: 'ethereum', networkId: 'mainnet' } as ChainScope
const BASE = { chainId: 'base', networkId: 'mainnet' } as ChainScope

const row = (address: string, scope: ChainScope, assetId: string) => ({
    address,
    scope,
    assetId,
})

describe('useTokenInboxes', () => {
    it('gives each address and network holding waiting tokens one row, in source order', () => {
        vi.mocked(useWalletHoldingSources).mockReturnValue([
            { address: '0xa', scope: ETHEREUM },
            { address: '0xa', scope: BASE },
            { address: '0xb', scope: ETHEREUM },
        ])
        vi.mocked(useTokenInboxQuery).mockReturnValue({
            holdings: [
                row('0xb', ETHEREUM, '0x1'),
                row('0xa', BASE, '0x2'),
                row('0xa', BASE, '0x3'),
            ] as unknown as ReturnType<typeof useTokenInboxQuery>['holdings'],
            isPending: false,
        })

        const { result } = renderHook(() => useTokenInboxes())

        expect(
            result.current.map(({ scope, item }) => [
                scope.chainId,
                item.data.address,
                item.data.requestCount,
            ]),
        ).toEqual([
            ['base', '0xa', 2],
            ['ethereum', '0xb', 1],
        ])
        expect(result.current[0]?.item.type).toBe('asa_inbox')
    })
})
