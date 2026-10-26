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

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useAddressPoisoningWarningContent } from '../useAddressPoisoningWarningContent'

const RECIPIENT = 'ABCDXXXXWXYZ'
const KNOWN = 'ABCDYYYYWXYQ'

describe('useAddressPoisoningWarningContent', () => {
    it('starts unacknowledged and acknowledges on request', () => {
        const { result } = renderHook(() =>
            useAddressPoisoningWarningContent({
                recipient: RECIPIENT,
                risk: { kind: 'dustOnly' },
            }),
        )

        expect(result.current.isAcknowledged).toBe(false)

        act(() => result.current.setIsAcknowledged(true))

        expect(result.current.isAcknowledged).toBe(true)
    })

    it('highlights where a look-alike differs from the known address', () => {
        const { result } = renderHook(() =>
            useAddressPoisoningWarningContent({
                recipient: RECIPIENT,
                risk: { kind: 'lookalike', similarTo: KNOWN },
            }),
        )

        expect(result.current.recipientSegments).toEqual([
            { text: 'ABCD', isDifferent: false },
            { text: 'XXXX', isDifferent: true },
            { text: 'WXY', isDifferent: false },
            { text: 'Z', isDifferent: true },
        ])
        expect(result.current.similarToSegments).toEqual([
            { text: 'ABCD', isDifferent: false },
            { text: 'YYYY', isDifferent: true },
            { text: 'WXY', isDifferent: false },
            { text: 'Q', isDifferent: true },
        ])
    })

    it('shows a dust-only address whole, with nothing to compare', () => {
        const { result } = renderHook(() =>
            useAddressPoisoningWarningContent({
                recipient: RECIPIENT,
                risk: { kind: 'dustOnly' },
            }),
        )

        expect(result.current.recipientSegments).toEqual([
            { text: RECIPIENT, isDifferent: false },
        ])
        expect(result.current.similarToSegments).toBeUndefined()
    })
})
