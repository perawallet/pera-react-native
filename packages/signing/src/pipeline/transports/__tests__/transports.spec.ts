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

import { beforeEach, describe, test, expect, vi } from 'vitest'
import {
    ScopeChangedError,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { createCallbackTransport } from '../createCallbackTransport'
import { createWalletConnectTransport } from '../createWalletConnectTransport'
import { TransportError } from '../../errors'
import type {
    SigningResult,
    SourceMetadata,
    SignedTransactionData,
} from '../../types'

const ALGORAND_TESTNET: ChainScope = {
    chainId: 'algorand',
    networkId: 'testnet',
}

const transactionResult: SigningResult = {
    signedData: {
        type: 'transactions',
        signed: [{ txn: {} as never, blob: new Uint8Array() } as never],
    } as SignedTransactionData,
    signers: [{ address: 'ADDR' }],
}

describe('createCallbackTransport', () => {
    test('calls approve and returns callback-sent', async () => {
        const approve = vi.fn().mockResolvedValue(undefined)
        const transport = createCallbackTransport()
        const source: SourceMetadata = {
            type: 'local',
            transport: 'callback',
            requestId: 'req-1',
            callbacks: { approve },
        }

        const result = await transport.send(transactionResult, source)

        expect(approve).toHaveBeenCalledWith(transactionResult)
        expect(result).toEqual({ type: 'callback-sent', requestId: 'req-1' })
    })

    test('defaults requestId to empty string when not provided', async () => {
        const approve = vi.fn().mockResolvedValue(undefined)
        const transport = createCallbackTransport()
        const source: SourceMetadata = {
            type: 'local',
            transport: 'callback',
            callbacks: { approve },
        }

        const result = await transport.send(transactionResult, source)

        if (result.type === 'callback-sent') {
            expect(result.requestId).toBe('')
        }
    })

    test('throws when approve callback is missing', async () => {
        const transport = createCallbackTransport()
        const source: SourceMetadata = {
            type: 'local',
            transport: 'callback',
        }

        await expect(transport.send(transactionResult, source)).rejects.toThrow(
            'No approve callback',
        )
    })

    test('forwards approve failures via error callback and throws TransportError', async () => {
        const approve = vi.fn().mockRejectedValue(new Error('approve fail'))
        const errorCb = vi.fn().mockResolvedValue(undefined)
        const transport = createCallbackTransport()
        const source: SourceMetadata = {
            type: 'local',
            transport: 'callback',
            callbacks: { approve, error: errorCb },
        }

        await expect(transport.send(transactionResult, source)).rejects.toThrow(
            TransportError,
        )
        expect(errorCb).toHaveBeenCalled()
    })

    test('wraps non-Error rejections in TransportError', async () => {
        const approve = vi.fn().mockRejectedValue('string err')
        const transport = createCallbackTransport()
        const source: SourceMetadata = {
            type: 'local',
            transport: 'callback',
            callbacks: { approve },
        }

        await expect(transport.send(transactionResult, source)).rejects.toThrow(
            TransportError,
        )
    })
})

describe('createWalletConnectTransport', () => {
    beforeEach(() => {
        useNetworkStore.getState().resetState()
        useNetworkStore.getState().setNetwork('testnet')
    })

    test('calls approve and returns callback-sent with requestId', async () => {
        const approve = vi.fn().mockResolvedValue(undefined)
        const transport = createWalletConnectTransport(ALGORAND_TESTNET)
        const source: SourceMetadata = {
            type: 'walletconnect',
            requestId: 'wc-1',
            callbacks: { approve },
        }

        const result = await transport.send(transactionResult, source)

        expect(approve).toHaveBeenCalledWith(transactionResult)
        expect(result).toEqual({ type: 'callback-sent', requestId: 'wc-1' })
    })

    test('throws when approve callback is missing', async () => {
        const transport = createWalletConnectTransport(ALGORAND_TESTNET)

        await expect(
            transport.send(transactionResult, { type: 'walletconnect' }),
        ).rejects.toThrow('No approve callback')
    })

    test('throws when requestId is missing', async () => {
        const approve = vi.fn()
        const transport = createWalletConnectTransport(ALGORAND_TESTNET)

        await expect(
            transport.send(transactionResult, {
                type: 'walletconnect',
                callbacks: { approve },
            }),
        ).rejects.toThrow('No request ID')
    })

    test('calls error callback when approve rejects', async () => {
        const approve = vi.fn().mockRejectedValue(new Error('reject'))
        const errorCb = vi.fn().mockResolvedValue(undefined)
        const transport = createWalletConnectTransport(ALGORAND_TESTNET)

        await expect(
            transport.send(transactionResult, {
                type: 'walletconnect',
                requestId: 'wc-1',
                callbacks: { approve, error: errorCb },
            }),
        ).rejects.toThrow(TransportError)

        expect(errorCb).toHaveBeenCalled()
    })

    test('wraps non-Error rejections in TransportError', async () => {
        const approve = vi.fn().mockRejectedValue(42)
        const transport = createWalletConnectTransport(ALGORAND_TESTNET)

        await expect(
            transport.send(transactionResult, {
                type: 'walletconnect',
                requestId: 'wc-1',
                callbacks: { approve },
            }),
        ).rejects.toThrow(TransportError)
    })

    test("aborts with ScopeChangedError when the captured chain's network switches", async () => {
        const approve = vi.fn().mockResolvedValue(undefined)
        const transport = createWalletConnectTransport(ALGORAND_TESTNET)

        useNetworkStore.getState().setNetwork('mainnet')

        await expect(
            transport.send(transactionResult, {
                type: 'walletconnect',
                requestId: 'wc-1',
                callbacks: { approve },
            }),
        ).rejects.toBeInstanceOf(ScopeChangedError)
        expect(approve).not.toHaveBeenCalled()
    })

    test('delivers when only another chain switches network', async () => {
        const approve = vi.fn().mockResolvedValue(undefined)
        const transport = createWalletConnectTransport(ALGORAND_TESTNET)

        useNetworkStore.getState().selectNetwork('ethereum', 'sepolia')

        await transport.send(transactionResult, {
            type: 'walletconnect',
            requestId: 'wc-1',
            callbacks: { approve },
        })

        expect(approve).toHaveBeenCalledWith(transactionResult)
    })
})
