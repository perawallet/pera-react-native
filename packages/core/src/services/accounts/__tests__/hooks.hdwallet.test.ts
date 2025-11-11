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
import { renderHook } from '@testing-library/react'

// Hoisted spies and mocks for wallet API and bip39
const apiSpies = vi.hoisted(() => {
    return {
        deriveSpy: vi.fn(),
        keyGenSpy: vi.fn(),
        signTxnSpy: vi.fn(),
        signDataSpy: vi.fn(),
    }
})

const xhdSpies = vi.hoisted(() => {
    return {
        fromSeed: vi.fn(() => 'ROOT_KEY'),
    }
})

const bip39Spies = vi.hoisted(() => {
    return {
        generateMnemonic: vi.fn(() => 'test mnemonic'),
        mnemonicToSeedSync: vi.fn(() => Buffer.from('seed_sync')),
        mnemonicToSeed: vi.fn(async () => Buffer.from('seed_async')),
        mnemonicToEntropy: vi.fn(async () => Buffer.from('entropy')),
        entropyToMnemonic: vi.fn(() => 'entropy mnemonic'),
    }
})

vi.mock('@perawallet/xhdwallet', () => {
    return {
        BIP32DerivationTypes: { Khovratovich: 32, Peikert: 9 },
        BIP32DerivationType: { Peikert: 'PEIKERT', Other: 'OTHER' },
        Encoding: { BASE64: 'BASE64' },
        fromSeed: xhdSpies.fromSeed,
        KeyContext: { Address: 'Address' },
        KeyContexts: { Address: 0, Identity: 1 },
        Encodings: { MSGPACK: 'msgpack', BASE64: 'base64', NONE: 'none' },
        XHDWalletAPI: class {
            deriveKey = apiSpies.deriveSpy
            keyGen = apiSpies.keyGenSpy
            signAlgoTransaction = apiSpies.signTxnSpy
            signData = apiSpies.signDataSpy
        },
    }
})

vi.mock('bip39', () => bip39Spies)

describe('services/accounts/useHDWallet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('generateMasterKey generates mnemonic and returns seed/entropy', async () => {
        vi.resetModules()
        const { useHDWallet } = await import('../hooks.hdwallet')
        const { result } = renderHook(() => useHDWallet())
        const masterKey = await result.current.generateMasterKey()
        expect(bip39Spies.generateMnemonic).toHaveBeenCalledTimes(1)
        expect(bip39Spies.mnemonicToSeed).toHaveBeenCalledTimes(1)
        expect(bip39Spies.mnemonicToEntropy).toHaveBeenCalledTimes(1)
        expect(masterKey.seed).toEqual(Buffer.from('seed_async'))
        expect(masterKey.entropy).toEqual(Buffer.from('entropy'))
    })

    test('entropyToMnemonic delegates to bip39.entropyToMnemonic', async () => {
        vi.resetModules()
        const { useHDWallet } = await import('../hooks.hdwallet')
        const { result } = renderHook(() => useHDWallet())
        const mnemonic = result.current.entropyToMnemonic(
            Buffer.from('entropy'),
        )
        expect(bip39Spies.entropyToMnemonic).toHaveBeenCalledWith(
            Buffer.from('entropy'),
        )
        expect(mnemonic).toBe('entropy mnemonic')
    })

    test('deriveKey uses seed and returns key material', async () => {
        vi.resetModules()
        const seed = Buffer.from('sync_seed')

        // Prepare API responses: "PRIVKEY" and "ADDRESS"
        const priv = new Uint8Array([80, 82, 73, 86, 75, 69, 89])
        const addr = new Uint8Array([65, 68, 68, 82, 69, 83, 83])
        apiSpies.deriveSpy.mockResolvedValueOnce(priv)
        apiSpies.keyGenSpy.mockResolvedValueOnce(addr)

        const { useHDWallet } = await import('../hooks.hdwallet')
        const { result } = renderHook(() => useHDWallet())
        const out = await result.current.deriveKey({
            seed,
        })

        // Assert calls
        expect(xhdSpies.fromSeed).toHaveBeenCalledWith(seed)
        expect(apiSpies.deriveSpy).toHaveBeenCalledWith(
            'ROOT_KEY',
            [44, 283, 0, 0, 0],
            true,
            9,
        )
        expect(apiSpies.keyGenSpy).toHaveBeenCalledWith('ROOT_KEY', 0, 0, 0, 9)

        // Assert
        expect(out.privateKey).toBe(priv)
        expect(out.address).toBe(addr)
    })

    test('deriveKey allows overriding account, keyIndex and derivationType', async () => {
        vi.resetModules()
        const seed = Buffer.from('sync_seed')

        // Mock API responses (values not important)
        apiSpies.deriveSpy.mockResolvedValueOnce(new Uint8Array([49]).buffer)
        apiSpies.keyGenSpy.mockResolvedValueOnce(new Uint8Array([50]).buffer)

        const { useHDWallet } = await import('../hooks.hdwallet')
        const xhd = await import('@perawallet/xhdwallet')
        const { result } = renderHook(() => useHDWallet())
        await result.current.deriveKey({
            seed,
            account: 7,
            keyIndex: 9,
            derivationType: (xhd as any).BIP32DerivationType.Other,
        })

        expect(apiSpies.deriveSpy).toHaveBeenCalledWith(
            'ROOT_KEY',
            [44, 283, 7, 0, 9],
            true,
            'OTHER',
        )
        expect(apiSpies.keyGenSpy).toHaveBeenCalledWith(
            'ROOT_KEY',
            0,
            7,
            9,
            'OTHER',
        )
    })

    test('signTransaction derives root and signs with correct params', async () => {
        vi.resetModules()
        const seed = Buffer.from('sync_seed')
        apiSpies.signTxnSpy.mockResolvedValueOnce('SIGNED_TX')

        const { useHDWallet } = await import('../hooks.hdwallet')
        const { result } = renderHook(() => useHDWallet())
        const hd: any = {
            walletId: 'w',
            account: 4,
            change: 0,
            keyIndex: 6,
            derivationType: 'PEIKERT',
        }
        const txn = Buffer.from('txn')
        const signed = await result.current.signTransaction(seed, hd, txn)

        expect(xhdSpies.fromSeed).toHaveBeenCalled()
        expect(apiSpies.signTxnSpy).toHaveBeenCalledWith(
            'ROOT_KEY',
            0,
            4,
            6,
            txn,
            9,
        )
        expect(signed).toBe('SIGNED_TX')
    })

    test('signData derives root and signs with BASE64 metadata schema', async () => {
        vi.resetModules()
        const seed = Buffer.from('sync_seed')
        apiSpies.signDataSpy.mockResolvedValueOnce('SIGNED_DATA')

        const { useHDWallet } = await import('../hooks.hdwallet')
        const { result } = renderHook(() => useHDWallet())
        const hd: any = {
            walletId: 'w',
            account: 1,
            change: 0,
            keyIndex: 2,
            derivationType: 'PEIKERT',
        }
        const payload = Buffer.from('data')
        const signed = await result.current.signData(seed, hd, payload)

        expect(apiSpies.signDataSpy).toHaveBeenCalled()
        const call = (apiSpies.signDataSpy as any).mock.calls[0]
        expect(call[0]).toBe('ROOT_KEY')
        expect(call[1]).toBe(0)
        expect(call[2]).toBe(1)
        expect(call[3]).toBe(2)
        expect(call[4]).toBe(payload)
        expect(call[5]).toEqual(
            expect.objectContaining({
                encoding: 'base64',
                schema: expect.anything(),
            }),
        )
        expect(call[6]).toBe(9)
        expect(signed).toBe('SIGNED_DATA')
    })
})
