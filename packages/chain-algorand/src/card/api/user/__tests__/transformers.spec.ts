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

import { describe, it, expect } from 'vitest'
import { transformUser } from '../transformers'
import {
    CardEligibilityReason,
    CardEligibilityStatus,
    VerificationState,
} from '../../../models'

describe('transformUser', () => {
    it('maps verification states including REJECTED', () => {
        expect(
            transformUser({ id: 'u1', verificationState: 'REJECTED' })
                .verificationState,
        ).toBe(VerificationState.Rejected)
        expect(
            transformUser({ id: 'u1', verificationState: 'VERIFIED' })
                .verificationState,
        ).toBe(VerificationState.Verified)
    })

    it('falls back to Unverified for an unknown state', () => {
        expect(
            transformUser({ id: 'u1', verificationState: 'WAT' })
                .verificationState,
        ).toBe(VerificationState.Unverified)
    })

    it('maps the eligibility status and reason', () => {
        const user = transformUser({
            id: 'u1',
            verificationState: 'PENDING',
            cardEligibilityStatus: 'ineligible',
            cardEligibilityReason: 'edd_required',
        })

        expect(user.eligibilityStatus).toBe(CardEligibilityStatus.Ineligible)
        expect(user.eligibilityReason).toBe(CardEligibilityReason.EddRequired)
    })

    // A reason we have no copy for must not reach the UI as a raw enum; the
    // notice falls back to its generic "in review" wording instead.
    it('nulls an unmodelled eligibility status or reason', () => {
        const user = transformUser({
            id: 'u1',
            verificationState: 'PENDING',
            cardEligibilityStatus: 'under_review',
            cardEligibilityReason: 'sanctions_hit',
        })

        expect(user.eligibilityStatus).toBeNull()
        expect(user.eligibilityReason).toBeNull()
    })

    it('nulls eligibility fields Baanx omits entirely', () => {
        const user = transformUser({ id: 'u1', verificationState: 'VERIFIED' })

        expect(user.eligibilityStatus).toBeNull()
        expect(user.eligibilityReason).toBeNull()
    })

    it('coerces null optional fields to undefined', () => {
        const user = transformUser({
            id: 'u1',
            firstName: null,
            email: null,
            verificationState: 'VERIFIED',
        })

        expect(user.firstName).toBeUndefined()
        expect(user.email).toBeUndefined()
    })
})
