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

// @vitest-environment node

import { describe, it, expect } from 'vitest'
import type { MultisigSignRequest } from '@perawallet/wallet-core-multisig'
import { getSignedResponseCount } from '../signRequestStatus'

const withResponses = (
    responses: Array<{ response: string }>,
): Pick<MultisigSignRequest, 'transactionLists'> =>
    ({
        transactionLists: [{ responses }],
    }) as unknown as Pick<MultisigSignRequest, 'transactionLists'>

describe('getSignedResponseCount', () => {
    it('counts only the responses marked as signed', () => {
        const request = withResponses([
            { response: 'signed' },
            { response: 'pending' },
            { response: 'signed' },
            { response: 'rejected' },
        ])
        expect(getSignedResponseCount(request)).toBe(2)
    })

    it('returns 0 when no response is signed', () => {
        const request = withResponses([
            { response: 'pending' },
            { response: 'rejected' },
        ])
        expect(getSignedResponseCount(request)).toBe(0)
    })

    it('returns 0 when the first transaction list has no responses', () => {
        const request = withResponses([])
        expect(getSignedResponseCount(request)).toBe(0)
    })

    it('returns 0 when there is no transaction list at all', () => {
        const request = {
            transactionLists: [],
        } as unknown as Pick<MultisigSignRequest, 'transactionLists'>
        expect(getSignedResponseCount(request)).toBe(0)
    })
})
