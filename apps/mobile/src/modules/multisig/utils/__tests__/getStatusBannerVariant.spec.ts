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

    it('keeps a failed request on the submitting banner while inside the recovery window', () => {
        // A `failed` async broadcast can be a transient backend false-negative
        // for a transaction that actually confirmed; while still recovering we
        // render the intermediate banner so a later `confirmed` can supersede it.
        expect(getStatusBannerVariant('failed', true)).toBe('submitting')
    })

    it('returns failure for a failed request once the recovery window is exhausted', () => {
        expect(getStatusBannerVariant('failed', false)).toBe('failure')
    })

    it.each<SignRequestStatus>(['expired', 'declined'])(
        'never suppresses genuinely terminal %s status, even within the recovery window',
        status => {
            expect(getStatusBannerVariant(status, true)).toBe('failure')
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

    it.each<SignRequestStatus>(['ready', 'submitting'])(
        'returns failure for %s status the wallet could not deliver',
        status => {
            // Nothing is on its way: the signatures are complete but the dApp
            // session is gone and no client action can move the record, so the
            // "Submitting transaction…" banner would never come true.
            expect(getStatusBannerVariant(status, false, true)).toBe('failure')
        },
    )

    it('still reports success for a confirmed request marked undeliverable', () => {
        // A stale marker must never override a genuinely confirmed request.
        expect(getStatusBannerVariant('confirmed', false, true)).toBe('success')
    })
})
