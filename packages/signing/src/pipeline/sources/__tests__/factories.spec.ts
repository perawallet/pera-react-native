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

import { describe, test, expect, vi } from 'vitest'
import {
    createLocalSource,
    createExternalSource,
    createFetchSource,
} from '../factories'
import { SourceError } from '../../errors'
import type { SignableData } from '../../types'

const TRANSACTION_DATA: SignableData = {
    type: 'transactions',
    transactions: [],
    rawTransactionsBase64: [],
    indicesToSign: [0],
}

describe('createLocalSource', () => {
    test('wraps builder result with local source metadata', async () => {
        const builder = vi.fn().mockResolvedValue({
            data: TRANSACTION_DATA,
            signerAddress: 'ADDR1',
        })
        const source = createLocalSource(builder)

        const group = await source.getSignableData({ foo: 'bar' })

        expect(builder).toHaveBeenCalledWith({ foo: 'bar' })
        expect(group.source).toEqual({ type: 'local' })
        expect(group.signerAddress).toBe('ADDR1')
        expect(group.data).toBe(TRANSACTION_DATA)
    })

    test('wraps thrown Error in SourceError preserving message', async () => {
        const builder = vi.fn().mockRejectedValue(new Error('builder failure'))
        const source = createLocalSource(builder)

        await expect(source.getSignableData({})).rejects.toThrow(SourceError)
        await expect(source.getSignableData({})).rejects.toThrow(
            'builder failure',
        )
    })

    test('wraps non-Error thrown value in SourceError', async () => {
        const builder = vi.fn().mockRejectedValue('plain string error')
        const source = createLocalSource(builder)

        await expect(source.getSignableData({})).rejects.toThrow(SourceError)
        await expect(source.getSignableData({})).rejects.toThrow(
            'plain string error',
        )
    })
})

describe('createExternalSource', () => {
    test('wraps decoder result with walletconnect metadata merged in', async () => {
        const decoder = vi.fn().mockResolvedValue({
            data: TRANSACTION_DATA,
            signerAddress: 'ADDR1',
            metadata: {
                peerMetadata: { name: 'dApp' },
                requestId: '42',
            },
        })
        const source = createExternalSource(decoder)

        const group = await source.getSignableData({ external: true })

        expect(decoder).toHaveBeenCalledWith({ external: true })
        expect(group.source).toEqual({
            type: 'walletconnect',
            peerMetadata: { name: 'dApp' },
            requestId: '42',
        })
        expect(group.signerAddress).toBe('ADDR1')
    })

    test('wraps thrown Error in SourceError', async () => {
        const decoder = vi.fn().mockRejectedValue(new Error('decode failed'))
        const source = createExternalSource(decoder)

        await expect(source.getSignableData({})).rejects.toThrow(SourceError)
        await expect(source.getSignableData({})).rejects.toThrow(
            'decode failed',
        )
    })

    test('wraps non-Error thrown value in SourceError', async () => {
        const decoder = vi.fn().mockRejectedValue(42)
        const source = createExternalSource(decoder)

        await expect(source.getSignableData({})).rejects.toThrow(SourceError)
        await expect(source.getSignableData({})).rejects.toThrow('42')
    })
})

describe('createFetchSource', () => {
    test('wraps fetcher result with multisig-cosign source metadata', async () => {
        const fetcher = vi.fn().mockResolvedValue({
            data: TRANSACTION_DATA,
            signerAddress: 'ADDR1',
            signRequestId: 'req-1',
        })
        const source = createFetchSource(fetcher)

        const group = await source.getSignableData({ id: 'req-1' })

        expect(fetcher).toHaveBeenCalledWith({ id: 'req-1' })
        expect(group.source).toEqual({
            type: 'multisig-cosign',
            signRequestId: 'req-1',
        })
        expect(group.signerAddress).toBe('ADDR1')
    })

    test('wraps thrown Error in SourceError', async () => {
        const fetcher = vi.fn().mockRejectedValue(new Error('fetch failed'))
        const source = createFetchSource(fetcher)

        await expect(source.getSignableData({})).rejects.toThrow(SourceError)
        await expect(source.getSignableData({})).rejects.toThrow('fetch failed')
    })

    test('wraps non-Error thrown value in SourceError', async () => {
        const fetcher = vi.fn().mockRejectedValue({ weird: 'object' })
        const source = createFetchSource(fetcher)

        await expect(source.getSignableData({})).rejects.toThrow(SourceError)
    })
})
