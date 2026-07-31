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

const {
    compileAutoDrawProgram,
    postDelegatorLsig,
    isKillswitchConfigured,
    resolveEscrowChainConfig,
} = vi.hoisted(() => ({
    compileAutoDrawProgram: vi.fn(),
    postDelegatorLsig: vi.fn(),
    isKillswitchConfigured: vi.fn(),
    resolveEscrowChainConfig: vi.fn(),
}))
const mockBuildEnable = vi.fn()
const mockBuildKill = vi.fn()
const mockIsAutoDrawEnabled = vi.fn()
vi.mock('@perawallet/wallet-core-card', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-card')),
    compileAutoDrawProgram,
    postDelegatorLsig,
    isKillswitchConfigured,
    resolveEscrowChainConfig,
    useKillswitchAutoDraw: () => ({
        buildEnable: mockBuildEnable,
        buildKill: mockBuildKill,
        isAutoDrawEnabled: mockIsAutoDrawEnabled,
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

const mockSubmitWithFeeDelegation = vi.fn()
vi.mock('@perawallet/wallet-core-fee-delegation', () => ({
    useFeeDelegation: () => ({
        submitWithFeeDelegation: mockSubmitWithFeeDelegation,
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-blockchain')),
    useNetwork: () => ({ network: 'testnet' }),
}))

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
    compileAutoDrawProgram.mockResolvedValue(new Uint8Array([7, 7, 7]))
    postDelegatorLsig.mockResolvedValue({ delegatorAddress: 'FUNDINGADDR' })
    isKillswitchConfigured.mockReturnValue(true)
    resolveEscrowChainConfig.mockReturnValue({
        assetId: '10458941',
        killswitchAppId: '222',
        mainAppId: '111',
    })
    mockSignProgram.mockResolvedValue(new Uint8Array([1, 2, 3]))
    mockBuildEnable.mockResolvedValue([{ txn: 'enable' }])
    mockBuildKill.mockResolvedValue([{ txn: 'kill' }])
    mockSubmit.mockResolvedValue({ txIds: ['TX1'] })
    mockSubmitWithFeeDelegation.mockResolvedValue(undefined)
    // Default chain state: not enabled (enable proceeds, kill would no-op —
    // individual tests flip this to exercise the pre-check branches).
    mockIsAutoDrawEnabled.mockResolvedValue(false)
})

describe('useAutoDrawSwitch', () => {
    it('canSwitchToAuto is true only for local-key accounts', () => {
        const { result } = renderHook(() => useAutoDrawSwitch())
        expect(result.current.canSwitchToAuto(localAccount)).toBe(true)
        expect(result.current.canSwitchToAuto(ledgerAccount)).toBe(false)
    })

    it('enableAutoDraw posts the LSig then submits the fee-delegated on-chain enable, in order', async () => {
        const { result } = renderHook(() => useAutoDrawSwitch())

        await result.current.enableAutoDraw(localAccount, 'CARD')

        expect(postDelegatorLsig).toHaveBeenCalledWith(
            expect.objectContaining({
                network: 'testnet',
                token: 'usdc',
                delegatorAddress: 'FUNDINGADDR',
                cardAddress: 'CARD',
                lsigBytes: expect.any(String),
            }),
        )
        expect(mockBuildEnable).toHaveBeenCalledWith({
            sender: 'FUNDINGADDR',
            cardAddress: 'CARD',
            asset: '10458941',
        })
        // Fee-delegated: the sponsor covers the fees (the backend simulate
        // prices in enable's inner call) and the account's min-balance top-up.
        expect(mockSubmitWithFeeDelegation).toHaveBeenCalledWith(
            expect.objectContaining({
                account: 'FUNDINGADDR',
                transactions: [{ txn: 'enable' }],
                includeAssetOptInMbr: true,
            }),
        )
        expect(postDelegatorLsig.mock.invocationCallOrder[0]).toBeLessThan(
            mockSubmitWithFeeDelegation.mock.invocationCallOrder[0],
        )
    })

    it('enableAutoDraw skips the on-chain leg when the Killswitch is unconfigured', async () => {
        isKillswitchConfigured.mockReturnValue(false)
        const { result } = renderHook(() => useAutoDrawSwitch())

        await result.current.enableAutoDraw(localAccount, 'CARD')

        expect(postDelegatorLsig).toHaveBeenCalledTimes(1)
        expect(mockBuildEnable).not.toHaveBeenCalled()
        expect(mockSubmitWithFeeDelegation).not.toHaveBeenCalled()
    })

    it('enableAutoDraw skips the on-chain enable when already enabled (idempotent retry)', async () => {
        mockIsAutoDrawEnabled.mockResolvedValue(true)
        const { result } = renderHook(() => useAutoDrawSwitch())

        await expect(
            result.current.enableAutoDraw(localAccount, 'CARD'),
        ).resolves.toBeUndefined()

        // The LSig is still (re-)registered — AB upserts it — but the enable
        // would revert ALREADY_ENABLED, so it must not be built or submitted.
        expect(postDelegatorLsig).toHaveBeenCalledTimes(1)
        expect(mockBuildEnable).not.toHaveBeenCalled()
        expect(mockSubmitWithFeeDelegation).not.toHaveBeenCalled()
    })

    it('enableAutoDraw rethrows on-chain failures', async () => {
        mockSubmitWithFeeDelegation.mockRejectedValue(
            new Error('NOT_CARD_OWNER'),
        )
        const { result } = renderHook(() => useAutoDrawSwitch())

        await expect(
            result.current.enableAutoDraw(localAccount, 'CARD'),
        ).rejects.toThrow()
    })

    it('enableAutoDraw fails closed when the state read fails', async () => {
        mockIsAutoDrawEnabled.mockRejectedValue(new Error('network down'))
        const { result } = renderHook(() => useAutoDrawSwitch())

        await expect(
            result.current.enableAutoDraw(localAccount, 'CARD'),
        ).rejects.toThrow('network down')
        expect(mockSubmitWithFeeDelegation).not.toHaveBeenCalled()
    })

    it('disableAutoDraw submits kill() when auto-draw is enabled on-chain', async () => {
        mockIsAutoDrawEnabled.mockResolvedValue(true)
        const { result } = renderHook(() => useAutoDrawSwitch())

        await result.current.disableAutoDraw(localAccount)

        expect(mockBuildKill).toHaveBeenCalledWith({
            sender: 'FUNDINGADDR',
            asset: '10458941',
        })
        expect(mockSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ unsignedTxs: [{ txn: 'kill' }] }),
        )
    })

    it('disableAutoDraw no-ops when there is no on-chain enable to kill', async () => {
        // Covers the retry case AND any legacy persisted-Auto state whose
        // enable never actually ran — switching to Manual must succeed
        // instead of dead-ending on an ALREADY_DISABLED revert.
        mockIsAutoDrawEnabled.mockResolvedValue(false)
        const { result } = renderHook(() => useAutoDrawSwitch())

        await expect(
            result.current.disableAutoDraw(localAccount),
        ).resolves.toBeUndefined()

        expect(mockBuildKill).not.toHaveBeenCalled()
        expect(mockSubmit).not.toHaveBeenCalled()
    })

    it('disableAutoDraw skips on-chain when the Killswitch is unconfigured', async () => {
        isKillswitchConfigured.mockReturnValue(false)
        const { result } = renderHook(() => useAutoDrawSwitch())

        await result.current.disableAutoDraw(localAccount)

        expect(mockBuildKill).not.toHaveBeenCalled()
        expect(mockSubmit).not.toHaveBeenCalled()
    })
})
