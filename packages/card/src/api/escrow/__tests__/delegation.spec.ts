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

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { compileAutoDrawProgram, postDelegatorLsig } = vi.hoisted(() => ({
    compileAutoDrawProgram: vi.fn(),
    postDelegatorLsig: vi.fn(),
}))
vi.mock('../lsig', () => ({ compileAutoDrawProgram }))
vi.mock('../endpoints', () => ({ postDelegatorLsig }))

import { submitAutoDrawDelegation } from '../delegation'

const PROGRAM = new Uint8Array([0x06, 0x81, 0x01])

describe('submitAutoDrawDelegation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        compileAutoDrawProgram.mockResolvedValue(PROGRAM)
        postDelegatorLsig.mockResolvedValue({ delegatorAddress: 'ADDR' })
    })

    it('compiles, signs the program, and POSTs the base64 LSig in order', async () => {
        const signLsigProgram = vi.fn(async () => new Uint8Array([9, 9, 9]))

        await submitAutoDrawDelegation({
            network: 'testnet',
            token: 'usdc',
            address: 'ADDR',
            cardAddress: 'CARD',
            signLsigProgram,
        })

        expect(compileAutoDrawProgram).toHaveBeenCalledWith({
            network: 'testnet',
        })
        expect(signLsigProgram).toHaveBeenCalledWith(PROGRAM)
        expect(postDelegatorLsig).toHaveBeenCalledWith(
            expect.objectContaining({
                network: 'testnet',
                token: 'usdc',
                delegatorAddress: 'ADDR',
                cardAddress: 'CARD',
                lsigBytes: 'CQkJ', // base64 of [9,9,9]
            }),
        )
        // compile → sign → post.
        expect(compileAutoDrawProgram.mock.invocationCallOrder[0]).toBeLessThan(
            signLsigProgram.mock.invocationCallOrder[0],
        )
        expect(signLsigProgram.mock.invocationCallOrder[0]).toBeLessThan(
            postDelegatorLsig.mock.invocationCallOrder[0],
        )
    })

    it('propagates a compile failure without POSTing', async () => {
        compileAutoDrawProgram.mockRejectedValue(new Error('compile boom'))
        const signLsigProgram = vi.fn()

        await expect(
            submitAutoDrawDelegation({
                network: 'testnet',
                token: 'usdc',
                address: 'ADDR',
                cardAddress: 'CARD',
                signLsigProgram,
            }),
        ).rejects.toThrow('compile boom')
        expect(signLsigProgram).not.toHaveBeenCalled()
        expect(postDelegatorLsig).not.toHaveBeenCalled()
    })
})
