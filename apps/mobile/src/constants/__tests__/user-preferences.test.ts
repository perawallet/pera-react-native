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

import {
    UserPreferences,
    OneTimeUserPreferenceFlags,
} from '../user-preferences'

describe('UserPreferences', () => {
    it('exposes the expected transaction info agreement key', () => {
        expect(UserPreferences).toHaveProperty(
            'transactionInfoAgreed',
            'transaction-info-agreed',
        )
    })

    it('includes the quantum dApp warning acknowledgement as a one-time flag', () => {
        expect(UserPreferences.quantumDappWarningAcknowledged).toBe(
            'quantum-dapp-warning-acknowledged',
        )
        expect(OneTimeUserPreferenceFlags).toContain(
            UserPreferences.quantumDappWarningAcknowledged,
        )
    })
})
