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
import { renderHook } from '@testing-library/react'
import type { Arc0001ResolveResult } from '@perawallet/wallet-core-blockchain'

import { registerFakePlannerAdapter } from '../../__tests__/fakePlannerAdapter'
import type { TransactionSignRequest } from '../../models'
import {
    useEnqueueArc0001SignRequest,
    type ExternalSignTxnTransport,
} from '../useEnqueueArc0001SignRequest'

const mockAddSignRequest = vi.fn()
const mockRemoveSignRequest = vi.fn()
const mockAssignFeeToGroup = vi.fn()

vi.mock('../useSigningRequest', () => ({
    useSigningRequest: () => ({
        addSignRequest: mockAddSignRequest,
        removeSignRequest: mockRemoveSignRequest,
    }),
}))

vi.mock('../useMinimumFeeCalculator', () => ({
    useMinimumFeeCalculator: () => ({ assignFeeToGroup: mockAssignFeeToGroup }),
}))

describe('useEnqueueArc0001SignRequest', () => {
    const enqueued = { id: 'req-1' } as TransactionSignRequest
    const enqueueArc0001SignRequest = vi.fn(async () => enqueued)

    beforeEach(() => {
        vi.clearAllMocks()
        registerFakePlannerAdapter({ enqueueArc0001SignRequest })
    })

    it('hands the planner the resolved group, the transport and the signing-request bindings', async () => {
        const { result } = renderHook(() => useEnqueueArc0001SignRequest())
        const resolved = {
            allDecoded: [],
            toSign: [],
        } as unknown as Arc0001ResolveResult
        const transport = {
            transportId: 't',
        } as unknown as ExternalSignTxnTransport

        const outcome = await result.current(resolved, transport)

        expect(outcome).toBe(enqueued)
        expect(enqueueArc0001SignRequest).toHaveBeenCalledWith(
            resolved,
            transport,
            {
                assignFeeToGroup: mockAssignFeeToGroup,
                addSignRequest: mockAddSignRequest,
                removeSignRequest: mockRemoveSignRequest,
            },
        )
    })
})
