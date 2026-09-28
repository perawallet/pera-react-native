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

import { Buffer } from 'buffer'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const algorandGetAddressMock = vi.hoisted(() => vi.fn())
const algorandSignMock = vi.hoisted(() => vi.fn())
const algorandGetVersionMock = vi.hoisted(() => vi.fn())
const algorandSignDataMock = vi.hoisted(() => vi.fn())
const algorandAppConstructed = vi.hoisted(() => vi.fn())

vi.mock('@algorandfoundation/ledger-algorand-js', () => ({
    AlgorandApp: class {
        constructor(transport: unknown) {
            algorandAppConstructed(transport)
        }
        getAddressAndPubKey = algorandGetAddressMock
        sign = algorandSignMock
        getVersion = algorandGetVersionMock
        signData = algorandSignDataMock
    },
}))

import {
    LedgerDeviceBusyError,
    LedgerSigningError,
    LedgerUserRejectedError,
} from '@perawallet/wallet-extension-ledger-shared'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { algorandLedgerAppDriver } from '../driver'

const arbitrarySignRequest = {
    accountIndex: 0,
    data: 'e30=',
    signerPublicKey: new Uint8Array(32),
    domain: 'example.com',
    authenticatorData: new Uint8Array(37),
    scope: 1,
    encoding: 'base64',
}

describe('algorandLedgerAppDriver', () => {
    const closeMock = vi.fn()
    const raw = { close: closeMock }
    const open = () => algorandLedgerAppDriver.open(raw)

    beforeEach(() => {
        vi.clearAllMocks()
        algorandGetAddressMock.mockResolvedValue({
            address: Buffer.from('ALGO_ADDR'),
            publicKey: Buffer.alloc(32),
        })
    })

    test('is keyed by the Algorand chain', () => {
        expect(algorandLedgerAppDriver.chainId).toBe(ALGORAND_CHAIN_ID)
    })

    test('opens the Algorand app over the transport it is given', () => {
        open()

        expect(algorandAppConstructed).toHaveBeenCalledWith(raw)
    })

    test('getAddress delegates to the Algorand app and returns public key bytes', async () => {
        algorandGetAddressMock.mockResolvedValue({
            address: Buffer.from('ALGO_ADDR'),
            publicKey: Buffer.from(
                'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
                'hex',
            ),
        })

        const account = await open().getAddress(0)

        expect(algorandGetAddressMock).toHaveBeenCalledWith(0, false)
        expect(account.address).toBe('ALGO_ADDR')
        expect(account.publicKey).toBeInstanceOf(Uint8Array)
        expect(account.publicKey.length).toBe(32)
        expect(account.accountIndex).toBe(0)
    })

    test('getAddress passes verify through so the device displays the address', async () => {
        await open().getAddress(3, true)

        expect(algorandGetAddressMock).toHaveBeenCalledWith(3, true)
    })

    test('getAddress translates app errors through classifyLedgerError', async () => {
        algorandGetAddressMock.mockRejectedValue({ statusCode: 0x6986 })

        await expect(open().getAddress(0)).rejects.toBeInstanceOf(
            LedgerUserRejectedError,
        )
    })

    test('routes APDU failures through a transport-specific classifier', async () => {
        const failure = new Error('transport-specific')
        algorandGetAddressMock.mockRejectedValue(failure)
        const classifyError = vi.fn(() => new LedgerDeviceBusyError())

        await expect(
            algorandLedgerAppDriver.open(raw, classifyError).getAddress(0),
        ).rejects.toBeInstanceOf(LedgerDeviceBusyError)
        expect(classifyError).toHaveBeenCalledWith(failure)
    })

    test('signTransaction passes the msgpack bytes as a Buffer and returns the signature bytes', async () => {
        algorandSignMock.mockResolvedValue({
            signature: Buffer.from([1, 2, 3]),
        })

        const sig = await open().signTransaction(0, new Uint8Array([10, 20]))

        expect(algorandSignMock).toHaveBeenCalledWith(0, Buffer.from([10, 20]))
        expect(Array.from(sig)).toEqual([1, 2, 3])
    })

    test('signTransaction primes the device via getAddressAndPubKey before every sign call', async () => {
        algorandSignMock.mockResolvedValue({
            signature: Buffer.from([1, 2, 3]),
        })

        await open().signTransaction(0, new Uint8Array([10, 20]))

        expect(algorandGetAddressMock).toHaveBeenCalledWith(0, false)
        expect(algorandGetAddressMock.mock.invocationCallOrder[0]).toBeLessThan(
            algorandSignMock.mock.invocationCallOrder[0],
        )
    })

    test('signTransaction re-primes on every call for the same account index — no caching', async () => {
        algorandSignMock.mockResolvedValue({
            signature: Buffer.from([1, 2, 3]),
        })
        const transport = open()

        await transport.signTransaction(0, new Uint8Array([10]))
        await transport.signTransaction(0, new Uint8Array([20]))
        await transport.signTransaction(0, new Uint8Array([30]))

        expect(algorandGetAddressMock).toHaveBeenCalledTimes(3)
        expect(algorandSignMock).toHaveBeenCalledTimes(3)
    })

    test('signTransaction primes the requested account index, not a hardcoded one', async () => {
        algorandSignMock.mockResolvedValue({
            signature: Buffer.from([1, 2, 3]),
        })

        await open().signTransaction(7, new Uint8Array([10]))

        expect(algorandGetAddressMock).toHaveBeenCalledWith(7, false)
        expect(algorandSignMock).toHaveBeenCalledWith(7, Buffer.from([10]))
    })

    test('signTransaction throws LedgerSigningError on empty signature', async () => {
        algorandSignMock.mockResolvedValue({ signature: Buffer.alloc(0) })

        await expect(
            open().signTransaction(0, new Uint8Array([1])),
        ).rejects.toBeInstanceOf(LedgerSigningError)
    })

    test('signTransaction translates app errors through classifyLedgerError', async () => {
        algorandSignMock.mockRejectedValue({ returnCode: 0x6986 })

        await expect(
            open().signTransaction(0, new Uint8Array([1])),
        ).rejects.toBeInstanceOf(LedgerUserRejectedError)
    })

    test('getAppVersion delegates to the app and returns the version triple', async () => {
        algorandGetVersionMock.mockResolvedValue({
            major: 2,
            minor: 1,
            patch: 3,
            deviceLocked: false,
        })

        await expect(open().getAppVersion()).resolves.toEqual({
            major: 2,
            minor: 1,
            patch: 3,
        })
    })

    test('getAppVersion translates app errors through classifyLedgerError', async () => {
        algorandGetVersionMock.mockRejectedValue({ returnCode: 0x6986 })

        await expect(open().getAppVersion()).rejects.toBeInstanceOf(
            LedgerUserRejectedError,
        )
    })

    test('signData maps the request onto the app with the Algorand BIP-44 path', async () => {
        algorandSignDataMock.mockResolvedValue({
            signature: Uint8Array.from([9, 8, 7]),
        })

        const sig = await open().signData({
            ...arbitrarySignRequest,
            accountIndex: 2,
            requestId: 'req-1',
        })

        expect(algorandSignDataMock).toHaveBeenCalledWith(
            {
                data: 'e30=',
                signer: arbitrarySignRequest.signerPublicKey,
                domain: 'example.com',
                authenticationData: arbitrarySignRequest.authenticatorData,
                requestId: 'req-1',
                hdPath: "m/44'/283'/2'/0/0",
            },
            { scope: 1, encoding: 'base64' },
        )
        expect(Array.from(sig)).toEqual([9, 8, 7])
    })

    test('signData translates app errors through classifyLedgerError', async () => {
        algorandSignDataMock.mockRejectedValue({ returnCode: 0x6986 })

        await expect(
            open().signData(arbitrarySignRequest),
        ).rejects.toBeInstanceOf(LedgerUserRejectedError)
    })

    test('signData throws LedgerSigningError on empty signature', async () => {
        algorandSignDataMock.mockResolvedValue({
            signature: new Uint8Array(0),
        })

        await expect(
            open().signData(arbitrarySignRequest),
        ).rejects.toBeInstanceOf(LedgerSigningError)
    })

    test('disconnect closes the underlying transport', async () => {
        closeMock.mockResolvedValue(undefined)

        await open().disconnect()

        expect(closeMock).toHaveBeenCalled()
    })
})
