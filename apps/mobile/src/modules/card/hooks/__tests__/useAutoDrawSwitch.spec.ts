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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

const { submitAutoDrawDelegation, isKillswitchConfigured } = vi.hoisted(() => ({
    submitAutoDrawDelegation: vi.fn(),
    isKillswitchConfigured: vi.fn(),
}))
const mockBuildEnable = vi.fn()
const mockBuildKill = vi.fn()
vi.mock('@perawallet/wallet-core-card', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-card')),
    submitAutoDrawDelegation,
    isKillswitchConfigured,
    useKillswitchAutoDraw: () => ({
        buildEnable: mockBuildEnable,
        buildKill: mockBuildKill,
    }),
}))

const mockSignProgram = vi.fn()
const mockSubmit = vi.fn()
vi.mock('@perawallet/wallet-core-signing', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-signing')),
    useProgramSigner: () => ({ signProgram: mockSignProgram }),
    encodeDelegatedLsigAccount: () => new Uint8Array([9, 9, 9]),
    useSignAndSubmitGroup: () => ({ submit: mockSubmit }),
}))

vi.mock('@perawallet/wallet-core-blockchain', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-blockchain')),
    useNetwork: () => ({ network: 'testnet' }),
}))

import { AlgodError } from '@perawallet/wallet-core-blockchain'
import { useAutoDrawSwitch } from '../useAutoDrawSwitch'

const localAccount: WalletAccount = {
    id: 'a1',
    type: AccountTypes.algo25,
    address: 'FUNDINGADDR',
    keyPairId: 'kp1',
} as WalletAccount

const ledgerAccount: WalletAccount = {
    id: 'a2',
    type: AccountTypes.hardware,
    address: 'LEDGERADDR',
} as WalletAccount

beforeEach(() => {
    vi.clearAllMocks()
    submitAutoDrawDelegation.mockResolvedValue(undefined)
    isKillswitchConfigured.mockReturnValue(true)
    mockSignProgram.mockResolvedValue(new Uint8Array([1, 2, 3]))
    mockBuildEnable.mockResolvedValue([{ txn: 'enable' }])
    mockBuildKill.mockResolvedValue([{ txn: 'kill' }])
    mockSubmit.mockResolvedValue({ txIds: ['TX1'] })
})

describe('useAutoDrawSwitch', () => {
    it('canSwitchToAuto is true only for local-key accounts', () => {
        const { result } = renderHook(() => useAutoDrawSwitch())
        expect(result.current.canSwitchToAuto(localAccount)).toBe(true)
        expect(result.current.canSwitchToAuto(ledgerAccount)).toBe(false)
    })

    it('enableAutoDraw posts the LSig then submits the on-chain enable, in order', async () => {
        const { result } = renderHook(() => useAutoDrawSwitch())

        await result.current.enableAutoDraw(localAccount, 'CARD')

        expect(submitAutoDrawDelegation).toHaveBeenCalledWith(
            expect.objectContaining({
                network: 'testnet',
                token: 'usdc',
                address: 'FUNDINGADDR',
                cardAddress: 'CARD',
                signLsigProgram: expect.any(Function),
            }),
        )
        expect(mockBuildEnable).toHaveBeenCalledWith({
            sender: 'FUNDINGADDR',
            cardAddress: 'CARD',
        })
        expect(mockSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ unsignedTxs: [{ txn: 'enable' }] }),
        )
        expect(
            submitAutoDrawDelegation.mock.invocationCallOrder[0],
        ).toBeLessThan(mockSubmit.mock.invocationCallOrder[0])
    })

    it('enableAutoDraw skips the on-chain leg when the Killswitch is unconfigured', async () => {
        isKillswitchConfigured.mockReturnValue(false)
        const { result } = renderHook(() => useAutoDrawSwitch())

        await result.current.enableAutoDraw(localAccount, 'CARD')

        expect(submitAutoDrawDelegation).toHaveBeenCalledTimes(1)
        expect(mockBuildEnable).not.toHaveBeenCalled()
        expect(mockSubmit).not.toHaveBeenCalled()
    })

    it('enableAutoDraw treats ALREADY_ENABLED as success', async () => {
        mockSubmit.mockRejectedValue(
            new AlgodError('logic_error', {
                msg: 'assert failed ALREADY_ENABLED',
            }),
        )
        const { result } = renderHook(() => useAutoDrawSwitch())

        await expect(
            result.current.enableAutoDraw(localAccount, 'CARD'),
        ).resolves.toBeUndefined()
    })

    it('enableAutoDraw rethrows other on-chain failures', async () => {
        mockSubmit.mockRejectedValue(
            new AlgodError('logic_error', { msg: 'NOT_CARD_OWNER' }),
        )
        const { result } = renderHook(() => useAutoDrawSwitch())

        await expect(
            result.current.enableAutoDraw(localAccount, 'CARD'),
        ).rejects.toThrow()
    })

    it('disableAutoDraw submits kill(), tolerating ALREADY_DISABLED', async () => {
        const { result } = renderHook(() => useAutoDrawSwitch())

        await result.current.disableAutoDraw(localAccount)
        expect(mockBuildKill).toHaveBeenCalledWith({ sender: 'FUNDINGADDR' })
        expect(mockSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ unsignedTxs: [{ txn: 'kill' }] }),
        )

        vi.clearAllMocks()
        isKillswitchConfigured.mockReturnValue(true)
        mockBuildKill.mockResolvedValue([{ txn: 'kill' }])
        mockSubmit.mockRejectedValue(
            new AlgodError('logic_error', { msg: 'ALREADY_DISABLED' }),
        )
        await expect(
            result.current.disableAutoDraw(localAccount),
        ).resolves.toBeUndefined()
    })

    it('disableAutoDraw skips on-chain when the Killswitch is unconfigured', async () => {
        isKillswitchConfigured.mockReturnValue(false)
        const { result } = renderHook(() => useAutoDrawSwitch())

        await result.current.disableAutoDraw(localAccount)

        expect(mockBuildKill).not.toHaveBeenCalled()
        expect(mockSubmit).not.toHaveBeenCalled()
    })
})
