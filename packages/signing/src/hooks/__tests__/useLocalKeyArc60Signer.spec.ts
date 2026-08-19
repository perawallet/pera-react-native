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
import { sha256 } from '@noble/hashes/sha2.js'
import { canonify } from 'canonify'
import { encodeToBase64, type Optional } from '@perawallet/wallet-core-shared'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useLocalKeyArc60Signer } from '../useLocalKeyArc60Signer'
import {
    ARC60_SCOPE_AUTH,
    Arc60BadJsonError,
    Arc60DomainMismatchError,
    Arc60FailedHdPathError,
    Arc60InvalidScopeError,
    Arc60InvalidSignerError,
} from '../../utils/arc60'
import type { Arc60Metadata, Arc60StdSigData } from '../../pipeline/types'

const mockSignDataWithKey = vi.fn()
// Stable reference across renders — production's `signDataWithKey` is an
// unstable body function today, which happens to mask a stale-closure in the
// signer's dep array. Pinning it here means only the `accounts` dep can force
// a callback rebuild, so the dep-array test actually guards the fix.
const mockStableSignData = (...args: any[]) => mockSignDataWithKey(...args)

vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<object>()),
    useKMS: () => ({
        signDataWithKey: mockStableSignData,
    }),
}))

let mockAccounts: WalletAccount[] = []

// Real account helpers (resolveSignerForAccount, type guards, BIP44 validation)
// — only the store is stubbed.
vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        // Override the hook the signer actually calls. Stubbing `useAccountsStore`
        // does nothing here: the real `useAllAccounts` binds to its own
        // module-local store import, not this barrel export.
        useAllAccounts: () => mockAccounts,
    }
})

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

const algo25Account = {
    address: 'ALGO25_ADDR',
    keyPairId: 'key-algo25-ed25519',
    type: 'algo25',
} as unknown as WalletAccount

const hardwareAccount = {
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

const quantumAccount = {
    address: 'QUANTUM_ADDR',
    keyPairId: 'key-quantum-falcon',
    type: 'quantum',
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
        nonce: 'abc123',
        chain_id: 'algorand:mainnet',
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

describe('useLocalKeyArc60Signer', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAccounts = []
        mockSignDataWithKey.mockResolvedValue([new Uint8Array([0])])
    })

    test('rejects unsupported scope', async () => {
        const { result } = renderHook(() => useLocalKeyArc60Signer())
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
        const { result } = renderHook(() => useLocalKeyArc60Signer())
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
        const tampered = new Uint8Array(validAuthData)
        tampered[0] ^= 0xff
        const { result } = renderHook(() => useLocalKeyArc60Signer())
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

    test('signs an HD account via signDataWithKey with sha256(data)||sha256(authenticatorData) payload', async () => {
        const sigBytes = new Uint8Array([1, 2, 3])
        mockSignDataWithKey.mockResolvedValue([sigBytes])

        const { result } = renderHook(() => useLocalKeyArc60Signer())
        let signature: Optional<Uint8Array>
        await act(async () => {
            signature = await result.current.signArc60(
                hdAccount,
                validStdSigData,
                validMetadata,
            )
        })

        expect(signature).toEqual(sigBytes)
        expect(mockSignDataWithKey).toHaveBeenCalledTimes(1)
        const [childId, _domain, items] = mockSignDataWithKey.mock.calls[0]
        expect(childId).toBe('key-hd-child')
        const payload = items[0] as Uint8Array
        expect(payload.slice(0, 32)).toEqual(sha256(samplePayload))
        expect(payload.slice(32)).toEqual(sha256(validAuthData))
        expect(payload.length).toBe(64)
    })

    test('rejects when hdPath does not match the signer derivation', async () => {
        const { result } = renderHook(() => useLocalKeyArc60Signer())
        await expect(
            act(async () => {
                await result.current.signArc60(
                    hdAccount,
                    {
                        ...validStdSigData,
                        hdPath: "m/44'/283'/0'/0/99",
                    },
                    validMetadata,
                )
            }),
        ).rejects.toBeInstanceOf(Arc60FailedHdPathError)
    })

    test('accepts a matching hdPath', async () => {
        mockSignDataWithKey.mockResolvedValue([new Uint8Array([1])])
        const { result } = renderHook(() => useLocalKeyArc60Signer())
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
        const algo25Siwa = new TextEncoder().encode(
            buildSiwa({ account_address: 'ALGO25_ADDR' }),
        )
        const { result } = renderHook(() => useLocalKeyArc60Signer())
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

    test('signs an Algo25 account via signDataWithKey with no MX prefix', async () => {
        mockSignDataWithKey.mockResolvedValue([new Uint8Array([7])])
        const algo25Siwa = new TextEncoder().encode(
            buildSiwa({ account_address: 'ALGO25_ADDR' }),
        )

        const { result } = renderHook(() => useLocalKeyArc60Signer())
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

        const [childId, _domain, items] = mockSignDataWithKey.mock.calls[0]
        expect(childId).toBe('key-algo25-ed25519')
        const payload = items[0] as Uint8Array
        expect(payload[0]).not.toBe('M'.charCodeAt(0))
        expect(payload[1]).not.toBe('X'.charCodeAt(0))
        expect(payload.slice(0, 32)).toEqual(sha256(algo25Siwa))
    })

    test('rejects when SIWA domain does not match request domain', async () => {
        const mismatched = new TextEncoder().encode(
            buildSiwa({ domain: 'evil.io' }),
        )
        const { result } = renderHook(() => useLocalKeyArc60Signer())
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
        const mismatched = new TextEncoder().encode(
            buildSiwa({ account_address: 'OTHER_ADDR' }),
        )
        const { result } = renderHook(() => useLocalKeyArc60Signer())
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
        const nonSiwa = new TextEncoder().encode('{"not":"siwa"}')
        const { result } = renderHook(() => useLocalKeyArc60Signer())
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

    test('signs a rekeyed algo25 with its OWN keypair (not the auth chain)', async () => {
        // The dApp verifies the signature against ORIG_ADDR's pubkey, so
        // we sign with ORIG_ADDR's own key even though it has been rekeyed.
        const original = {
            ...algo25Account,
            address: 'ORIG_ADDR',
            rekeyAddress: 'AUTH_ADDR',
        } as unknown as WalletAccount
        mockSignDataWithKey.mockResolvedValue([new Uint8Array([1])])

        const origSiwa = new TextEncoder().encode(
            buildSiwa({ account_address: 'ORIG_ADDR' }),
        )

        const { result } = renderHook(() => useLocalKeyArc60Signer())
        await act(async () => {
            await result.current.signArc60(
                original,
                {
                    ...validStdSigData,
                    data: encodeToBase64(origSiwa),
                    signer: 'ORIG_ADDR',
                },
                validMetadata,
            )
        })

        const [childId] = mockSignDataWithKey.mock.calls[0]
        expect(childId).toBe('key-algo25-ed25519')
    })

    test('rejects a watch-rekeyed account even when the auth has keys', async () => {
        const watchSource = {
            address: 'WATCH_ADDR',
            type: 'watch',
            rekeyAddress: 'AUTH_ADDR',
        } as unknown as WalletAccount

        const watchSiwa = new TextEncoder().encode(
            buildSiwa({ account_address: 'WATCH_ADDR' }),
        )

        const { result } = renderHook(() => useLocalKeyArc60Signer())
        await expect(
            act(async () => {
                await result.current.signArc60(
                    watchSource,
                    {
                        ...validStdSigData,
                        data: encodeToBase64(watchSiwa),
                        signer: 'WATCH_ADDR',
                    },
                    validMetadata,
                )
            }),
        ).rejects.toBeInstanceOf(Arc60InvalidSignerError)
    })

    test('signs ARC-60 data for a quantum account, on the same arm as Algo25', async () => {
        mockSignDataWithKey.mockResolvedValue([new Uint8Array([9])])
        const quantumSiwa = new TextEncoder().encode(
            buildSiwa({ account_address: 'QUANTUM_ADDR' }),
        )

        const { result } = renderHook(() => useLocalKeyArc60Signer())
        let signature: Optional<Uint8Array>
        await act(async () => {
            signature = await result.current.signArc60(
                quantumAccount,
                {
                    ...validStdSigData,
                    data: encodeToBase64(quantumSiwa),
                    signer: 'QUANTUM_ADDR',
                },
                validMetadata,
            )
        })

        expect(signature).toBeInstanceOf(Uint8Array)
        const [childId] = mockSignDataWithKey.mock.calls[0]
        expect(childId).toBe('key-quantum-falcon')
    })

    test('rejects an hdPath for a quantum account, as it does for algo25', async () => {
        const quantumSiwa = new TextEncoder().encode(
            buildSiwa({ account_address: 'QUANTUM_ADDR' }),
        )
        const { result } = renderHook(() => useLocalKeyArc60Signer())
        await expect(
            act(async () => {
                await result.current.signArc60(
                    quantumAccount,
                    {
                        ...validStdSigData,
                        data: encodeToBase64(quantumSiwa),
                        signer: 'QUANTUM_ADDR',
                        hdPath: "m/44'/283'/0'/0/0",
                    },
                    validMetadata,
                )
            }),
        ).rejects.toBeInstanceOf(Arc60FailedHdPathError)
    })

    test('rejects a Ledger account (raw-byte signing unsupported on device)', async () => {
        const ledger = {
            ...hardwareAccount,
            address: 'LED_ADDR',
        } as unknown as WalletAccount

        const ledgerSiwa = new TextEncoder().encode(
            buildSiwa({ account_address: 'LED_ADDR' }),
        )

        const { result } = renderHook(() => useLocalKeyArc60Signer())
        await expect(
            act(async () => {
                await result.current.signArc60(
                    ledger,
                    {
                        ...validStdSigData,
                        data: encodeToBase64(ledgerSiwa),
                        signer: 'LED_ADDR',
                    },
                    validMetadata,
                )
            }),
        ).rejects.toBeInstanceOf(Arc60InvalidSignerError)
    })

    test('re-reads the account list on rerender (rekey revoked after mount fails closed)', async () => {
        const rekeyed = {
            ...algo25Account,
            address: 'ORIG_ADDR',
            rekeyAddress: 'AUTH_ADDR',
        } as unknown as WalletAccount

        // SIWA names ORIG_ADDR but the dApp asks AUTH_ADDR to sign, so the
        // rekey cross-check must confirm AUTH_ADDR is ORIG_ADDR's authority.
        const origSiwa = new TextEncoder().encode(
            buildSiwa({ account_address: 'ORIG_ADDR' }),
        )
        const sigData: Arc60StdSigData = {
            ...validStdSigData,
            data: encodeToBase64(origSiwa),
            signer: 'AUTH_ADDR',
        }

        mockAccounts = [rekeyed]
        const { result, rerender } = renderHook(() => useLocalKeyArc60Signer())

        // Rekey is current — the cross-check passes and the account signs.
        await act(async () => {
            await result.current.signArc60(rekeyed, sigData, validMetadata)
        })
        expect(mockSignDataWithKey).toHaveBeenCalledTimes(1)

        // Rekey revoked after mount. A stale closure would still see AUTH_ADDR
        // as the authority and sign; the fresh list must reject it.
        mockAccounts = [{ ...rekeyed, rekeyAddress: undefined }]
        rerender()

        await expect(
            act(async () => {
                await result.current.signArc60(rekeyed, sigData, validMetadata)
            }),
        ).rejects.toBeInstanceOf(Arc60InvalidSignerError)
        expect(mockSignDataWithKey).toHaveBeenCalledTimes(1)
    })
})
