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
import { isKycSubmitted, isKycVerified, VerificationState } from '../user'

describe('isKycSubmitted', () => {
    it('is true once KYC is submitted (PENDING) or complete (VERIFIED)', () => {
        expect(isKycSubmitted(VerificationState.Pending)).toBe(true)
        expect(isKycSubmitted(VerificationState.Verified)).toBe(true)
    })

    it('is false for not-submitted, rejected, and unknown/unfetched states', () => {
        expect(isKycSubmitted(VerificationState.Unverified)).toBe(false)
        expect(isKycSubmitted(VerificationState.Rejected)).toBe(false)
        expect(isKycSubmitted(null)).toBe(false)
    })
})

describe('isKycVerified', () => {
    it('is true only for a complete (VERIFIED) review', () => {
        expect(isKycVerified(VerificationState.Verified)).toBe(true)
    })

    it('is false for every other state, including submitted-but-PENDING', () => {
        expect(isKycVerified(VerificationState.Pending)).toBe(false)
        expect(isKycVerified(VerificationState.Unverified)).toBe(false)
        expect(isKycVerified(VerificationState.Rejected)).toBe(false)
        expect(isKycVerified(null)).toBe(false)
    })
})
