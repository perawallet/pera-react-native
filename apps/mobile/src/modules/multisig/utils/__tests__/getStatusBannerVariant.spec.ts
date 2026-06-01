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

import { describe, it, expect } from 'vitest'
import type { SignRequestStatus } from '@perawallet/wallet-core-multisig'
import { getStatusBannerVariant } from '../getStatusBannerVariant'

describe('getStatusBannerVariant', () => {
    it('returns waiting when status is null', () => {
        expect(getStatusBannerVariant(null)).toBe('waiting')
    })

    it('returns success for confirmed status', () => {
        expect(getStatusBannerVariant('confirmed')).toBe('success')
    })

    it.each<SignRequestStatus>(['failed', 'expired', 'declined'])(
        'returns failure for %s status',
        status => {
            expect(getStatusBannerVariant(status)).toBe('failure')
        },
    )

    it('returns waiting for pending status', () => {
        expect(getStatusBannerVariant('pending')).toBe('waiting')
    })

    it.each<SignRequestStatus>(['ready', 'submitting'])(
        'returns submitting for %s status (threshold met, on its way)',
        status => {
            expect(getStatusBannerVariant(status)).toBe('submitting')
        },
    )
})
