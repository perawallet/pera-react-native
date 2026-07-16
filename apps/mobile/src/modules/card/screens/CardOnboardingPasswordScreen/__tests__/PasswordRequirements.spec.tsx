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

import { render, screen } from '@test-utils/render'
import { describe, it, expect } from 'vitest'
import { PASSWORD_RULES } from '@perawallet/wallet-core-card'
import { PasswordRequirements } from '../PasswordRequirements'

const ruleRow = (id: string) =>
    screen.queryByTestId(`card-onboarding-password-rule-${id}`)

describe('PasswordRequirements', () => {
    it('renders one row per rule, in lockstep with PASSWORD_RULES', () => {
        render(<PasswordRequirements password='' />)

        // The row set is driven by PASSWORD_RULES, so the screen and schema can
        // never drift apart.
        PASSWORD_RULES.forEach(rule => {
            expect(ruleRow(rule.id)).toBeTruthy()
        })
    })

    it('renders the same rows regardless of how much the password satisfies', () => {
        render(<PasswordRequirements password='Passw0rd!' />)

        PASSWORD_RULES.forEach(rule => {
            expect(ruleRow(rule.id)).toBeTruthy()
        })
    })
})
