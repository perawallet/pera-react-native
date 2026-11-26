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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    useAllAccounts,
    useTokenInboxQuery,
    useWalletHoldingSources,
} from '@perawallet/wallet-core-accounts'
import type { InboxItem } from '@perawallet/wallet-core-messages'
import { useAccountAssetInboxes } from '../useAccountAssetInboxes'

const ALGORAND = { chainId: 'algorand', networkId: 'mainnet' }
const ETHEREUM = { chainId: 'ethereum', networkId: 'mainnet' }
const BASE = { chainId: 'base', networkId: 'mainnet' }

const signer = {
    id: 'signer',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: 'ALGO' },
        ethereum: { address: '0xa' },
        base: { address: '0xa' },
    },
}
const quiet = {
    id: 'quiet',
    custody: { kind: 'local', seed: null },
    chains: { ethereum: { address: '0xq' } },
}
const watched = {
    id: 'watched',
    custody: { kind: 'watch' },
    chains: { ethereum: { address: '0xw' } },
}

const asaItem = (address: string, requestCount: number) =>
    ({
        type: 'asa_inbox',
        data: { address, inboxAddress: null, requestCount },
        createdAt: new Date(0),
    }) as InboxItem

describe('useAccountAssetInboxes', () => {
    beforeEach(() => {
        vi.mocked(useAllAccounts).mockReturnValue([
            signer,
            quiet,
            watched,
        ] as unknown as ReturnType<typeof useAllAccounts>)
        vi.mocked(useWalletHoldingSources).mockReturnValue([
            { address: '0xa', scope: ETHEREUM },
            { address: '0xa', scope: BASE },
            { address: '0xq', scope: ETHEREUM },
            { address: '0xw', scope: ETHEREUM },
        ] as unknown as ReturnType<typeof useWalletHoldingSources>)
        vi.mocked(useTokenInboxQuery).mockReturnValue({
            holdings: [
                { address: '0xa', scope: ETHEREUM, assetId: '0x1' },
                { address: '0xa', scope: BASE, assetId: '0x2' },
            ] as unknown as ReturnType<typeof useTokenInboxQuery>['holdings'],
            isPending: false,
        })
    })

    it("merges an account's backend requests with its waiting tokens on every network into one inbox", () => {
        const { result } = renderHook(() =>
            useAccountAssetInboxes({
                backendItems: [asaItem('ALGO', 3)],
                backendScope: ALGORAND as never,
            }),
        )

        expect(result.current).toEqual([
            {
                account: signer,
                backendItem: asaItem('ALGO', 3),
                tokenCount: 2,
                requestCount: 5,
            },
        ])
    })

    it("leaves watch accounts out, reading none of their tokens and none of the backend's rows for them", () => {
        renderHook(() =>
            useAccountAssetInboxes({
                backendItems: [asaItem('0xw', 1)],
                backendScope: ETHEREUM as never,
            }),
        )

        expect(vi.mocked(useTokenInboxQuery).mock.lastCall?.[0]).toEqual([
            { address: '0xa', scope: ETHEREUM },
            { address: '0xa', scope: BASE },
            { address: '0xq', scope: ETHEREUM },
        ])
    })
})
