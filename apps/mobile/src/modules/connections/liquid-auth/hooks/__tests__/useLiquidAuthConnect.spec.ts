/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLiquidAuth } from '@perawallet/wallet-core-liquid-auth'
import { ALGORAND_GENESIS } from '../../networks'
import { useLiquidAuthConnect } from '../useLiquidAuthConnect'

const connectInternal = vi.fn()
const disconnectInternal = vi.fn()

vi.mock('@perawallet/wallet-core-liquid-auth', () => ({
    useLiquidAuth: vi.fn(),
    useLiquidAuthStore: { getState: () => ({ sessions: [] }) },
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => [],
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({ addSignRequest: vi.fn() }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'testnet' }),
    useAlgorandClient: () => ({
        client: { algod: { sendRawTransaction: vi.fn() } },
    }),
}))

describe('useLiquidAuthConnect', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useLiquidAuth).mockReturnValue({
            connect: connectInternal,
            disconnect: disconnectInternal,
        })
    })

    it('assembles the config for the current (testnet) network with the three collaborators', () => {
        renderHook(() => useLiquidAuthConnect())

        const config = vi.mocked(useLiquidAuth).mock.calls[0]![0]
        expect(config.networks).toEqual([
            {
                genesisHash: ALGORAND_GENESIS.testnet.genesisHash,
                genesisId: ALGORAND_GENESIS.testnet.genesisId,
            },
        ])
        expect(config.providerId).toBeTruthy()
        expect(config.name).toBe('Pera Wallet')
        expect(typeof config.enqueueArc60).toBe('function')
        expect(typeof config.submitSignedTxns).toBe('function')
    })

    it('forwards the caller-supplied account into the underlying connect', async () => {
        const { result } = renderHook(() => useLiquidAuthConnect())

        await act(async () => {
            await result.current.connect({
                host: 'https://debug.liquidauth.com',
                requestId: 'req-1',
                address: 'CHOSEN_ADDR',
            })
        })

        expect(connectInternal).toHaveBeenCalledWith({
            host: 'https://debug.liquidauth.com',
            requestId: 'req-1',
            address: 'CHOSEN_ADDR',
        })
    })
})
