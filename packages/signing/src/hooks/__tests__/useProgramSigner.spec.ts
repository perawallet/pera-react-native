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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
    useAccountChainStateStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { seedAuthority } from '../../__tests__/registerAlgorandAccounts'
import { renderHook, act } from '@testing-library/react'
import { registerFakePlannerAdapter } from '../../__tests__/fakePlannerAdapter'
import {
    hdAccount as buildHdAccount,
    ledgerAccount,
    watchAccount as watch,
} from '../../__tests__/accounts'
import {
    useProgramSigner,
    ProgramSigningUnsupportedError,
} from '../useProgramSigner'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

const mockSignDataWithKey = vi.fn()

vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<object>()),
    useKMS: () => ({
        signDataWithKey: (...args: any[]) => mockSignDataWithKey(...args),
    }),
}))

const hdAccount = buildHdAccount('HD_ADDR', {
    keyPairId: 'key-hd-child',
})

// A minimal but valid program blob (version byte + pushint 1).
const PROGRAM = new Uint8Array([0x04, 0x81, 0x01])
const SIG = new Uint8Array(64).fill(7)

const PAYLOAD = new Uint8Array([9, 9, 9])
const programPayload = vi.fn((_program: Uint8Array) => PAYLOAD)

describe('useProgramSigner', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useAccountChainStateStore.getState().resetState()
        mockSignDataWithKey.mockResolvedValue([SIG])
        registerFakePlannerAdapter({ programPayload })
    })

    test('signs the planner payload with the account key and domain', async () => {
        const { result } = renderHook(() => useProgramSigner(SCOPE))

        await act(async () => {
            await result.current.signProgram(hdAccount, PROGRAM)
        })

        expect(mockSignDataWithKey).toHaveBeenCalledTimes(1)
        const [childId, domain, items] = mockSignDataWithKey.mock.calls[0]
        expect(childId).toBe('key-hd-child')
        expect(domain).toBe('pera.accounts')

        expect(programPayload).toHaveBeenCalledWith(PROGRAM)
        expect(items).toEqual([PAYLOAD])
    })

    test('rejects watch accounts with the typed error', async () => {
        const watchAccount = watch('WATCH_ADDR')

        const { result } = renderHook(() => useProgramSigner(SCOPE))

        await expect(
            act(async () => {
                await result.current.signProgram(watchAccount, PROGRAM)
            }),
        ).rejects.toThrow(ProgramSigningUnsupportedError)
        expect(mockSignDataWithKey).not.toHaveBeenCalled()
    })

    // A rekeyed account's own key would produce a signature the chain checks
    // against the auth-addr and rejects at draw time — refuse it up front.
    test('rejects rekeyed accounts with the typed error', async () => {
        const rekeyedAccount = hdAccount
        seedAuthority('HD_ADDR', 'AUTH_ADDR')

        const { result } = renderHook(() => useProgramSigner(SCOPE))

        await expect(
            act(async () => {
                await result.current.signProgram(rekeyedAccount, PROGRAM)
            }),
        ).rejects.toThrow(ProgramSigningUnsupportedError)
        expect(mockSignDataWithKey).not.toHaveBeenCalled()
    })

    test('rejects hardware wallet accounts with the typed error', async () => {
        const hwAccount = ledgerAccount('HW_ADDR')

        const { result } = renderHook(() => useProgramSigner(SCOPE))

        await expect(
            act(async () => {
                await result.current.signProgram(hwAccount, PROGRAM)
            }),
        ).rejects.toThrow(ProgramSigningUnsupportedError)
        expect(mockSignDataWithKey).not.toHaveBeenCalled()
    })
})
