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

import { act } from '@testing-library/react'
import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'

const { useCardAutoDraw, enableAutoDraw, disableAutoDraw } = vi.hoisted(() => {
    const enable = vi.fn()
    const disable = vi.fn()
    return {
        enableAutoDraw: enable,
        disableAutoDraw: disable,
        useCardAutoDraw: vi.fn(() => ({
            enableAutoDraw: enable,
            disableAutoDraw: disable,
        })),
    }
})
vi.mock('@perawallet/wallet-core-card', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-card')),
    useCardAutoDraw,
}))

import { registerAlgorandCardAdapter } from '@test-utils/cardChainAdapter'
import { useAutoDrawSwitch } from '../useAutoDrawSwitch'

const localAccount: WalletAccount = {
    id: 'a1',
    custody: { kind: 'local', seed: 'algo25' },
    address: 'FUNDINGADDR',
    keyPairId: 'kp1',
} as WalletAccount

const ledgerAccount: WalletAccount = {
    id: 'a2',
    custody: {
        kind: 'hardware',
        device: {
            manufacturer: 'ledger',
            deviceId: 'device-1',
            deviceName: 'Nano X',
            transportType: 'ble',
        },
        accountIndex: 0,
    },
    address: 'LEDGERADDR',
} as WalletAccount

beforeEach(() => {
    registerAlgorandCardAdapter()
    enableAutoDraw.mockResolvedValue(undefined)
    disableAutoDraw.mockResolvedValue(undefined)
})

describe('useAutoDrawSwitch', () => {
    it('canSwitchToAuto is true only for local-key accounts', () => {
        const { result } = renderHook(() => useAutoDrawSwitch())

        expect(result.current.canSwitchToAuto(localAccount)).toBe(true)
        expect(result.current.canSwitchToAuto(ledgerAccount)).toBe(false)
    })

    it('runs auto-draw on the card scope', () => {
        renderHook(() => useAutoDrawSwitch())

        expect(useCardAutoDraw).toHaveBeenCalledWith(
            expect.objectContaining({ chainId: 'algorand' }),
        )
    })

    it('enables for the account and card, pending only while in flight', async () => {
        let finish: () => void = () => {}
        enableAutoDraw.mockReturnValue(
            new Promise<void>(resolve => {
                finish = resolve
            }),
        )
        const { result } = renderHook(() => useAutoDrawSwitch())

        let enabling: Promise<void> = Promise.resolve()
        act(() => {
            enabling = result.current.enableAutoDraw(localAccount, 'CARD')
        })
        expect(result.current.isPending).toBe(true)
        await act(async () => {
            finish()
            await enabling
        })

        expect(enableAutoDraw).toHaveBeenCalledWith(localAccount, 'CARD')
        expect(result.current.isPending).toBe(false)
    })

    it('rethrows a failed enable and clears pending', async () => {
        enableAutoDraw.mockRejectedValue(new Error('NOT_CARD_OWNER'))
        const { result } = renderHook(() => useAutoDrawSwitch())

        await act(async () => {
            await expect(
                result.current.enableAutoDraw(localAccount, 'CARD'),
            ).rejects.toThrow('NOT_CARD_OWNER')
        })
        expect(result.current.isPending).toBe(false)
    })

    it('disables for the account and rethrows a failure', async () => {
        const { result } = renderHook(() => useAutoDrawSwitch())

        await act(async () => {
            await result.current.disableAutoDraw(localAccount)
        })
        expect(disableAutoDraw).toHaveBeenCalledWith(localAccount)

        disableAutoDraw.mockRejectedValue(new Error('network down'))
        await act(async () => {
            await expect(
                result.current.disableAutoDraw(localAccount),
            ).rejects.toThrow('network down')
        })
        expect(result.current.isPending).toBe(false)
    })
})
