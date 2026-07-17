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
import { resolveAutoFundingHint } from '../autoFundingHint'

const t = (key: string) => key

describe('resolveAutoFundingHint', () => {
    it('shows the coming-soon hint when the flag is off', () => {
        expect(
            resolveAutoFundingHint(t, {
                isAutoFundingEnabled: false,
                isAutoUnavailable: true,
                fallback: 'limit',
            }),
        ).toBe('peraCard.account.funding_type_auto_coming_soon_hint')
    })

    it('shows the unavailable hint when enabled but the account cannot sign', () => {
        expect(
            resolveAutoFundingHint(t, {
                isAutoFundingEnabled: true,
                isAutoUnavailable: true,
                fallback: 'limit',
            }),
        ).toBe('peraCard.account.funding_type_auto_unavailable_hint')
    })

    it('shows the Ledger hint when the connected account is a Ledger', () => {
        expect(
            resolveAutoFundingHint(t, {
                isAutoFundingEnabled: true,
                isAutoUnavailable: true,
                isLedgerAccount: true,
                fallback: 'limit',
            }),
        ).toBe('peraCard.account.funding_type_auto_ledger_hint')
    })

    it('prefers the coming-soon hint over the Ledger hint when the flag is off', () => {
        expect(
            resolveAutoFundingHint(t, {
                isAutoFundingEnabled: false,
                isAutoUnavailable: true,
                isLedgerAccount: true,
            }),
        ).toBe('peraCard.account.funding_type_auto_coming_soon_hint')
    })

    it('returns the fallback when Auto is enabled and available', () => {
        expect(
            resolveAutoFundingHint(t, {
                isAutoFundingEnabled: true,
                isAutoUnavailable: false,
                fallback: 'limit',
            }),
        ).toBe('limit')
    })

    it('returns undefined when available with no fallback', () => {
        expect(
            resolveAutoFundingHint(t, {
                isAutoFundingEnabled: true,
                isAutoUnavailable: false,
            }),
        ).toBeUndefined()
    })
})
