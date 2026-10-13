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

const mockWaitForConfirmation = vi.hoisted(() => vi.fn())
vi.mock('algosdk', async () => ({
    ...(await vi.importActual<object>('algosdk')),
    waitForConfirmation: mockWaitForConfirmation,
}))

import type { Algodv2 } from 'algosdk'
import {
    CONFIRMATION_ROUNDS_TO_WAIT,
    waitForTransactionConfirmation,
} from '../confirmation'

const algod = { tag: 'algod' } as unknown as Algodv2

describe('waitForTransactionConfirmation', () => {
    beforeEach(() => {
        mockWaitForConfirmation.mockReset()
        mockWaitForConfirmation.mockResolvedValue({ confirmedRound: 1n })
    })

    it('polls algod for the transaction with the default round budget', async () => {
        await waitForTransactionConfirmation(algod, 'TX')

        expect(mockWaitForConfirmation).toHaveBeenCalledWith(
            algod,
            'TX',
            CONFIRMATION_ROUNDS_TO_WAIT,
        )
    })

    it('passes a custom round budget through', async () => {
        await waitForTransactionConfirmation(algod, 'TX', 3)

        expect(mockWaitForConfirmation).toHaveBeenCalledWith(algod, 'TX', 3)
    })

    it('surfaces a confirmation failure', async () => {
        mockWaitForConfirmation.mockRejectedValue(new Error('timed out'))

        await expect(
            waitForTransactionConfirmation(algod, 'TX'),
        ).rejects.toThrow('timed out')
    })
})
