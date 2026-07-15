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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, beforeEach, vi } from 'vitest'

type MockUser = {
    id: string
    firstName?: string | null
    lastName?: string | null
    email?: string | null
    phoneNumber?: string | null
    countryOfResidence?: string | null
    verificationState: string
}

type MockCountry = { iso3166alpha2: string; name: string }

const mocks = vi.hoisted(() => ({
    user: null as MockUser | null,
    isLoading: false,
    countries: [] as MockCountry[],
}))

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<object>('@perawallet/wallet-core-card')
    return {
        ...actual,
        useCardUserQuery: () => ({
            data: mocks.user,
            isLoading: mocks.isLoading,
        }),
        useRegistrationSettingsQuery: () => ({
            data: { countries: mocks.countries },
        }),
    }
})

import { useCardAccountDetailsSheet } from '../useCardAccountDetailsSheet'

const UNAVAILABLE = 'peraCard.account_details.value_unavailable'

describe('useCardAccountDetailsSheet', () => {
    beforeEach(() => {
        mocks.user = null
        mocks.isLoading = false
        mocks.countries = []
    })

    it('builds detail rows from the user, with a placeholder for missing fields', () => {
        mocks.user = {
            id: '1',
            firstName: 'John',
            lastName: 'Morgan',
            email: 'john@example.com',
            phoneNumber: null,
            countryOfResidence: 'US',
            verificationState: 'VERIFIED',
        }

        const { result } = renderHook(() => useCardAccountDetailsSheet())
        const byKey = Object.fromEntries(
            result.current.details.map(d => [d.key, d.value]),
        )

        expect(byKey.full_name).toBe('John Morgan')
        expect(byKey.email).toBe('john@example.com')
        // No country list loaded → falls back to the raw ISO code.
        expect(byKey.country).toBe('US')
        // No phone on record → placeholder.
        expect(byKey.phone).toBe(UNAVAILABLE)
    })

    it('resolves the country code to its name from the Baanx list', () => {
        mocks.user = {
            id: '1',
            countryOfResidence: 'DE',
            verificationState: 'VERIFIED',
        }
        mocks.countries = [
            { iso3166alpha2: 'US', name: 'United States' },
            { iso3166alpha2: 'DE', name: 'Germany' },
        ]

        const { result } = renderHook(() => useCardAccountDetailsSheet())
        const country = result.current.details.find(
            d => d.key === 'country',
        )?.value

        expect(country).toBe('Germany')
    })

    it('falls back to a placeholder name when the user is absent', () => {
        const { result } = renderHook(() => useCardAccountDetailsSheet())
        const fullName = result.current.details.find(
            d => d.key === 'full_name',
        )?.value

        expect(fullName).toBe(UNAVAILABLE)
    })

    it('maps each verification state to a KYC tone', () => {
        const cases: Array<[string, string]> = [
            ['VERIFIED', 'verified'],
            ['PENDING', 'pending'],
            ['REJECTED', 'rejected'],
            ['UNVERIFIED', 'unverified'],
        ]

        for (const [state, tone] of cases) {
            mocks.user = { id: '1', verificationState: state }
            const { result } = renderHook(() => useCardAccountDetailsSheet())
            expect(result.current.kyc.tone).toBe(tone)
        }
    })

    it('defaults to the unverified tone when no user is loaded', () => {
        const { result } = renderHook(() => useCardAccountDetailsSheet())

        expect(result.current.kyc.tone).toBe('unverified')
    })

    it('passes through the query loading state', () => {
        mocks.isLoading = true

        const { result } = renderHook(() => useCardAccountDetailsSheet())

        expect(result.current.isLoading).toBe(true)
    })
})
