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
import type { CardChainAdapter } from '../../chain-adapter'
import { registerFakeCardAdapter } from '../../__tests__/fakeCardAdapter'

const { useNetwork } = vi.hoisted(() => ({ useNetwork: vi.fn() }))
vi.mock('@perawallet/wallet-core-blockchain', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-blockchain')),
    useNetwork,
}))

import { useKillswitchAutoDraw } from '../useKillswitchAutoDraw'

let adapter: CardChainAdapter

beforeEach(() => {
    vi.clearAllMocks()
    useNetwork.mockReturnValue({ network: 'testnet' })
    adapter = registerFakeCardAdapter()
})

describe('useKillswitchAutoDraw', () => {
    it("toggles auto-draw through the network's chain adapter", async () => {
        vi.mocked(adapter.autoDraw.isEnabled).mockResolvedValue(true)
        const { result } = renderHook(() => useKillswitchAutoDraw())

        await result.current.buildEnable({
            sender: 'SENDER',
            cardAddress: 'CARD',
            asset: '10458941',
        })
        await result.current.buildKill({ sender: 'SENDER', asset: '10458941' })
        await expect(
            result.current.isAutoDrawEnabled({
                sender: 'SENDER',
                asset: '10458941',
            }),
        ).resolves.toBe(true)

        const expected = {
            network: 'testnet',
            sender: 'SENDER',
            asset: '10458941',
        }
        expect(adapter.autoDraw.buildEnable).toHaveBeenCalledWith({
            ...expected,
            cardAddress: 'CARD',
        })
        expect(adapter.autoDraw.buildKill).toHaveBeenCalledWith(expected)
        expect(adapter.autoDraw.isEnabled).toHaveBeenCalledWith(expected)
    })
})
