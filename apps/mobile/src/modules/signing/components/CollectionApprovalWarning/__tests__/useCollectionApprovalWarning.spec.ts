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

import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCollectionApprovalWarning } from '../useCollectionApprovalWarning'

vi.mock('@hooks/useLanguage')

describe('useCollectionApprovalWarning', () => {
    it('warns that the operator can take every item, naming the operator', () => {
        const { result } = renderHook(() =>
            useCollectionApprovalWarning(
                '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            ),
        )

        expect(result.current.rows).toEqual([
            {
                type: 'collection',
                icon: 'warning',
                message: 'signing.collection_approval.warning',
                emphasis: 'signing.spend_approval.spend_warning_bold',
                caption: 'signing.collection_approval.operator_caption',
            },
        ])
    })
})
