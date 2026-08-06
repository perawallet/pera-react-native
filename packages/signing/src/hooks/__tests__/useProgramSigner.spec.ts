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
import { renderHook, act } from '@testing-library/react'
import { LogicSig } from 'algosdk'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    useProgramSigner,
    ProgramSigningUnsupportedError,
} from '../useProgramSigner'

const mockSignDataWithKey = vi.fn()

vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<object>()),
    useKMS: () => ({
        signDataWithKey: (...args: any[]) => mockSignDataWithKey(...args),
    }),
}))

const hdAccount = {
    address: 'HD_ADDR',
    keyPairId: 'key-hd-child',
    type: 'hdWallet',
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 1,
        derivationType: 9,
    },
} as unknown as WalletAccount

// A minimal but valid program blob (version byte + pushint 1).
const PROGRAM = new Uint8Array([0x04, 0x81, 0x01])
const SIG = new Uint8Array(64).fill(7)

describe('useProgramSigner', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSignDataWithKey.mockResolvedValue([SIG])
    })

    test('signs "Program"-prefixed bytes with the account key and domain', async () => {
        const { result } = renderHook(() => useProgramSigner())

        await act(async () => {
            await result.current.signProgram(hdAccount, PROGRAM)
        })

        expect(mockSignDataWithKey).toHaveBeenCalledTimes(1)
        const [childId, domain, items] = mockSignDataWithKey.mock.calls[0]
        expect(childId).toBe('key-hd-child')
        expect(domain).toBe('pera.accounts')

        const signedBytes = items[0] as Uint8Array
        const prefix = new TextEncoder().encode('Program')
        expect([...signedBytes.slice(0, prefix.length)]).toEqual([...prefix])
        expect([...signedBytes.slice(prefix.length)]).toEqual([...PROGRAM])
    })

    test('signDelegatedLsig returns an algosdk-decodable delegated LSig', async () => {
        const { result } = renderHook(() => useProgramSigner())

        let signedProgram: Uint8Array | undefined
        await act(async () => {
            ;({ signedProgram } = await result.current.signDelegatedLsig(
                hdAccount,
                PROGRAM,
            ))
        })

        const decoded = LogicSig.fromByte(signedProgram!)
        expect([...decoded.logic]).toEqual([...PROGRAM])
        expect([...(decoded.sig ?? [])]).toEqual([...SIG])
    })

    test('rejects watch accounts with the typed error', async () => {
        const watchAccount = {
            address: 'WATCH_ADDR',
            type: 'watch',
        } as unknown as WalletAccount

        const { result } = renderHook(() => useProgramSigner())

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
        const rekeyedAccount = {
            ...hdAccount,
            rekeyAddress: 'AUTH_ADDR',
        } as unknown as WalletAccount

        const { result } = renderHook(() => useProgramSigner())

        await expect(
            act(async () => {
                await result.current.signProgram(rekeyedAccount, PROGRAM)
            }),
        ).rejects.toThrow(ProgramSigningUnsupportedError)
        expect(mockSignDataWithKey).not.toHaveBeenCalled()
    })

    test('rejects hardware wallet accounts with the typed error', async () => {
        const hwAccount = {
            address: 'HW_ADDR',
            type: 'hardware',
            hardwareDetails: {
                manufacturer: 'ledger',
                deviceId: 'd',
                deviceName: 'L',
                accountIndex: 0,
                transportType: 'ble',
            },
        } as unknown as WalletAccount

        const { result } = renderHook(() => useProgramSigner())

        await expect(
            act(async () => {
                await result.current.signDelegatedLsig(hwAccount, PROGRAM)
            }),
        ).rejects.toThrow(ProgramSigningUnsupportedError)
        expect(mockSignDataWithKey).not.toHaveBeenCalled()
    })
})
