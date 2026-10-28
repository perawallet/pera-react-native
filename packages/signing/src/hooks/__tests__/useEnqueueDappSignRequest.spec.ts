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

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '../../__tests__/registerAlgorandAccounts'
import { renderHook } from '@testing-library/react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'

import { registerFakePlannerAdapter } from '../../__tests__/fakePlannerAdapter'
import type { DappResolveResult } from '../../chain-adapter'
import type { TransactionSignRequest } from '../../models'
import {
    useEnqueueDappSignRequest,
    type ExternalSignTxnTransport,
} from '../useEnqueueDappSignRequest'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

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

describe('useEnqueueDappSignRequest', () => {
    const enqueued = { id: 'req-1' } as TransactionSignRequest
    const enqueueDappRequest = vi.fn(async () => enqueued)

    beforeEach(() => {
        vi.clearAllMocks()
        registerFakePlannerAdapter({
            enqueueDappRequest,
        })
    })

    it('hands the planner the resolved group, the transport and the signing-request bindings', async () => {
        const { result } = renderHook(() => useEnqueueDappSignRequest(SCOPE))
        const resolved: DappResolveResult = { payload: { toSign: [] } }
        const transport = {
            transportId: 't',
        } as unknown as ExternalSignTxnTransport

        const outcome = await result.current(resolved, transport)

        expect(outcome).toBe(enqueued)
        expect(enqueueDappRequest).toHaveBeenCalledWith(resolved, transport, {
            assignFeeToGroup: mockAssignFeeToGroup,
            addSignRequest: mockAddSignRequest,
            removeSignRequest: mockRemoveSignRequest,
        })
    })
})
