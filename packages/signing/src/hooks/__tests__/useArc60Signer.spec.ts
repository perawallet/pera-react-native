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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { sha256 } from '@noble/hashes/sha256'
import { canonify } from 'canonify'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useArc60Signer } from '../useArc60Signer'
import {
    ARC60_SCOPE_AUTH,
    Arc60BadJsonError,
    Arc60DomainMismatchError,
    Arc60FailedHdPathError,
    Arc60InvalidScopeError,
    Arc60InvalidSignerError,
} from '../../utils/arc60'
import { SIWA_CHAIN_ID } from '../../utils/siwa'
import type { Arc60Metadata, Arc60StdSigData } from '../../pipeline/types'

const mockGetKeyOrThrow = vi.fn()
const mockWithHDSession = vi.fn()
const mockWithAlgo25Session = vi.fn()

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: () => ({
        getKeyOrThrow: (...args: any[]) => mockGetKeyOrThrow(...args),
        withHDSession: (...args: any[]) => mockWithHDSession(...args),
        withAlgo25Session: (...args: any[]) => mockWithAlgo25Session(...args),
    }),
}))

const mockIsHDWalletAccount = vi.fn()
const mockIsAlgo25Account = vi.fn()
const mockIsHardwareWalletAccount = vi.fn()
let mockAccounts: WalletAccount[] = []
let mockAuthAddresses: Map<string, string | null> = new Map()

vi.mock('@perawallet/wallet-core-accounts', async () => {
    // Keep the real BIP44 helpers (pure, no store deps) so hdPath validation
    // exercises the production code path from the accounts package.
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useAccountsStore: (selector: any) =>
            selector({ accounts: mockAccounts }),
        useAccountAuthAddresses: () => ({
            authAddresses: mockAuthAddresses,
            isPending: false,
            isFetched: true,
        }),
        isHDWalletAccount: (...args: any[]) => mockIsHDWalletAccount(...args),
        isAlgo25Account: (...args: any[]) => mockIsAlgo25Account(...args),
        isHardwareWalletAccount: (...args: any[]) =>
            mockIsHardwareWalletAccount(...args),
    }
})

const mockKey = { id: 'key-1', type: 'HDWalletRootKey', publicKey: '' }

const hdAccount = {
    address: 'HD_ADDR',
    keyPairId: 'key-1',
    type: 'hdWallet',
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 1,
        derivationType: 9,
    },
} as unknown as WalletAccount

const algo25Account = {
    address: 'ALGO25_ADDR',
    keyPairId: 'key-1',
    type: 'algo25',
} as unknown as WalletAccount

const hardwareAccount = {
    address: 'HW_ADDR',
    type: 'hardware',
} as unknown as WalletAccount

const domain = 'arc60.io'
const rpIdHash = sha256(new TextEncoder().encode(domain))
const validAuthData = new Uint8Array([...rpIdHash, 0x05])

const buildSiwa = (overrides: Record<string, unknown> = {}): string =>
    canonify({
        domain,
        account_address: 'HD_ADDR',
        uri: 'https://arc60.io/login',
        version: '1',
        chain_id: SIWA_CHAIN_ID,
        type: 'ed25519',
        ...overrides,
    })!

const samplePayload = new TextEncoder().encode(buildSiwa())
const validStdSigData: Arc60StdSigData = {
    data: encodeToBase64(samplePayload),
    signer: 'HD_ADDR',
    domain,
    authenticatorData: validAuthData,
}
const validMetadata: Arc60Metadata = {
    scope: ARC60_SCOPE_AUTH,
    encoding: 'base64',
}

describe('useArc60Signer', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAccounts = []
        mockAuthAddresses = new Map()
        mockGetKeyOrThrow.mockReturnValue(mockKey)
        mockIsHDWalletAccount.mockReturnValue(false)
        mockIsAlgo25Account.mockReturnValue(false)
        mockIsHardwareWalletAccount.mockReturnValue(false)
    })

    test('rejects unsupported scope', async () => {
        const { result } = renderHook(() => useArc60Signer())
        await expect(
            act(async () => {
                await result.current.signArc60(hdAccount, validStdSigData, {
                    scope: 99,
                    encoding: 'base64',
                })
            }),
        ).rejects.toBeInstanceOf(Arc60InvalidScopeError)
    })

    test('rejects hardware wallet accounts', async () => {
        mockIsHardwareWalletAccount.mockReturnValue(true)
        const { result } = renderHook(() => useArc60Signer())
        await expect(
            act(async () => {
                await result.current.signArc60(
                    hardwareAccount,
                    validStdSigData,
                    validMetadata,
                )
            }),
        ).rejects.toBeInstanceOf(Arc60InvalidSignerError)
    })

    test('rejects when authenticatorData rpIdHash mismatches', async () => {
        mockIsHDWalletAccount.mockReturnValue(true)
        const tampered = new Uint8Array(validAuthData)
        tampered[0] ^= 0xff
        const { result } = renderHook(() => useArc60Signer())
        await expect(
            act(async () => {
                await result.current.signArc60(
                    hdAccount,
                    { ...validStdSigData, authenticatorData: tampered },
                    validMetadata,
                )
            }),
        ).rejects.toBeInstanceOf(Arc60DomainMismatchError)
    })

    test('signs with HD session using sha256(data)||sha256(authenticatorData) payload', async () => {
        mockIsHDWalletAccount.mockReturnValue(true)
        const sigBytes = new Uint8Array([1, 2, 3])
        const mockSignData = vi.fn().mockResolvedValue(sigBytes)
        mockWithHDSession.mockImplementation(
            async (_key: any, _domain: string, handler: any) =>
                handler({ signData: mockSignData }),
        )

        const { result } = renderHook(() => useArc60Signer())
        let signature: Uint8Array | undefined
        await act(async () => {
            signature = await result.current.signArc60(
                hdAccount,
                validStdSigData,
                validMetadata,
            )
        })

        expect(signature).toEqual(sigBytes)
        expect(mockSignData).toHaveBeenCalledTimes(1)
        const [derivation, payload] = mockSignData.mock.calls[0]
        expect(derivation).toEqual({
            account: 0,
            keyIndex: 1,
            derivationType: 9,
        })
        // First 32 bytes = sha256(decoded data)
        expect((payload as Uint8Array).slice(0, 32)).toEqual(
            sha256(samplePayload),
        )
        // Last 32 bytes = sha256(authenticatorData)
        expect((payload as Uint8Array).slice(32)).toEqual(sha256(validAuthData))
        expect((payload as Uint8Array).length).toBe(64)
    })

    test('rejects when hdPath does not match the signer derivation', async () => {
        mockIsHDWalletAccount.mockReturnValue(true)
        const { result } = renderHook(() => useArc60Signer())
        await expect(
            act(async () => {
                await result.current.signArc60(
                    hdAccount,
                    {
                        ...validStdSigData,
                        // different keyIndex than the signer's hdWalletDetails
                        hdPath: "m/44'/283'/0'/0/99",
                    },
                    validMetadata,
                )
            }),
        ).rejects.toBeInstanceOf(Arc60FailedHdPathError)
    })

    test('accepts a matching hdPath', async () => {
        mockIsHDWalletAccount.mockReturnValue(true)
        mockWithHDSession.mockImplementation(
            async (_key: any, _domain: string, handler: any) =>
                handler({
                    signData: vi.fn().mockResolvedValue(new Uint8Array([1])),
                }),
        )
        const { result } = renderHook(() => useArc60Signer())
        await expect(
            act(async () => {
                await result.current.signArc60(
                    hdAccount,
                    { ...validStdSigData, hdPath: "m/44'/283'/0'/0/1" },
                    validMetadata,
                )
            }),
        ).resolves.not.toThrow()
    })

    test('rejects hdPath on Algo25 accounts', async () => {
        mockIsAlgo25Account.mockReturnValue(true)
        const algo25Siwa = new TextEncoder().encode(
            buildSiwa({ account_address: 'ALGO25_ADDR' }),
        )
        const { result } = renderHook(() => useArc60Signer())
        await expect(
            act(async () => {
                await result.current.signArc60(
                    algo25Account,
                    {
                        ...validStdSigData,
                        data: encodeToBase64(algo25Siwa),
                        signer: 'ALGO25_ADDR',
                        hdPath: "m/44'/283'/0'/0/0",
                    },
                    validMetadata,
                )
            }),
        ).rejects.toBeInstanceOf(Arc60FailedHdPathError)
    })

    test('signs with Algo25 session and no MX prefix', async () => {
        mockIsAlgo25Account.mockReturnValue(true)
        const mockSignData = vi.fn().mockResolvedValue(new Uint8Array([7]))
        mockWithAlgo25Session.mockImplementation(
            async (_key: any, _domain: string, handler: any) =>
                handler({ signData: mockSignData }),
        )
        const algo25Siwa = new TextEncoder().encode(
            buildSiwa({ account_address: 'ALGO25_ADDR' }),
        )

        const { result } = renderHook(() => useArc60Signer())
        await act(async () => {
            await result.current.signArc60(
                algo25Account,
                {
                    ...validStdSigData,
                    data: encodeToBase64(algo25Siwa),
                    signer: 'ALGO25_ADDR',
                },
                validMetadata,
            )
        })

        const payload = mockSignData.mock.calls[0][0] as Uint8Array
        // Must NOT start with "MX"
        expect(payload[0]).not.toBe('M'.charCodeAt(0))
        expect(payload[1]).not.toBe('X'.charCodeAt(0))
        // Must start with sha256(decoded data)
        expect(payload.slice(0, 32)).toEqual(sha256(algo25Siwa))
    })

    test('rejects when SIWA domain does not match request domain', async () => {
        mockIsHDWalletAccount.mockReturnValue(true)
        const mismatched = new TextEncoder().encode(
            buildSiwa({ domain: 'evil.io' }),
        )
        const { result } = renderHook(() => useArc60Signer())
        await expect(
            act(async () => {
                await result.current.signArc60(
                    hdAccount,
                    { ...validStdSigData, data: encodeToBase64(mismatched) },
                    validMetadata,
                )
            }),
        ).rejects.toBeInstanceOf(Arc60BadJsonError)
    })

    test('rejects when SIWA account_address does not match request signer', async () => {
        mockIsHDWalletAccount.mockReturnValue(true)
        const mismatched = new TextEncoder().encode(
            buildSiwa({ account_address: 'OTHER_ADDR' }),
        )
        const { result } = renderHook(() => useArc60Signer())
        await expect(
            act(async () => {
                await result.current.signArc60(
                    hdAccount,
                    { ...validStdSigData, data: encodeToBase64(mismatched) },
                    validMetadata,
                )
            }),
        ).rejects.toBeInstanceOf(Arc60InvalidSignerError)
    })

    test('rejects when payload is not canonical SIWA JSON', async () => {
        mockIsHDWalletAccount.mockReturnValue(true)
        const nonSiwa = new TextEncoder().encode('{"not":"siwa"}')
        const { result } = renderHook(() => useArc60Signer())
        await expect(
            act(async () => {
                await result.current.signArc60(
                    hdAccount,
                    { ...validStdSigData, data: encodeToBase64(nonSiwa) },
                    validMetadata,
                )
            }),
        ).rejects.toBeInstanceOf(Arc60BadJsonError)
    })

    test('delegates to the rekeyed account when present', async () => {
        const rekeyed = {
            ...algo25Account,
            address: 'REKEY_ADDR',
        } as unknown as WalletAccount
        const original = {
            ...algo25Account,
            address: 'ORIG_ADDR',
        } as unknown as WalletAccount
        mockAccounts = [rekeyed]
        mockAuthAddresses = new Map([['ORIG_ADDR', 'REKEY_ADDR']])
        mockIsAlgo25Account.mockReturnValue(true)
        const mockSignData = vi.fn().mockResolvedValue(new Uint8Array([1]))
        mockWithAlgo25Session.mockImplementation(
            async (_key: any, _domain: string, handler: any) =>
                handler({ signData: mockSignData }),
        )

        const { result } = renderHook(() => useArc60Signer())
        await act(async () => {
            await result.current.signArc60(
                original,
                validStdSigData,
                validMetadata,
            )
        })

        expect(mockSignData).toHaveBeenCalled()
    })
})
