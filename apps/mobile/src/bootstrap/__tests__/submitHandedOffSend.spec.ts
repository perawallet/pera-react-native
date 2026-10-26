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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SignedTransaction } from '@perawallet/wallet-core-chain-contract'
import { SubmissionError } from '@perawallet/wallet-core-signing'

const { submitAndAutoRefresh } = vi.hoisted(() => ({
    submitAndAutoRefresh: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-signing', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-signing')
    >()),
    submitAndAutoRefresh,
}))

import { submitHandedOffSend } from '../submitHandedOffSend'

const SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const
const SIGNED = [
    { scope: SCOPE, id: '0xhash', bytes: new Uint8Array([1]) },
] as unknown as SignedTransaction[]

const nodeError = (code: string) => Object.assign(new Error(code), { code })

describe('submitHandedOffSend', () => {
    beforeEach(() => {
        submitAndAutoRefresh.mockReset()
    })

    it('submits on the first transaction’s scope and resolves with its hashes', async () => {
        submitAndAutoRefresh.mockResolvedValue(['0xhash'])

        await expect(submitHandedOffSend(SIGNED)).resolves.toEqual(['0xhash'])
        expect(submitAndAutoRefresh).toHaveBeenCalledWith(SCOPE, SIGNED)
    })

    it('answers an unknown outcome with the hash, since the send may still mine', async () => {
        submitAndAutoRefresh.mockRejectedValue(
            new SubmissionError(
                ['0xhash'],
                'unknown-outcome',
                nodeError('timeout'),
            ),
        )

        await expect(submitHandedOffSend(SIGNED)).resolves.toEqual(['0xhash'])
    })

    it('rethrows a node refusal', async () => {
        const refusal = new SubmissionError(
            ['0xhash'],
            'rejected-by-node',
            nodeError('nonce_too_low'),
        )
        submitAndAutoRefresh.mockRejectedValue(refusal)

        await expect(submitHandedOffSend(SIGNED)).rejects.toBe(refusal)
    })

    it('rethrows any other failure', async () => {
        const failure = new Error('no broadcaster')
        submitAndAutoRefresh.mockRejectedValue(failure)

        await expect(submitHandedOffSend(SIGNED)).rejects.toBe(failure)
    })
})
