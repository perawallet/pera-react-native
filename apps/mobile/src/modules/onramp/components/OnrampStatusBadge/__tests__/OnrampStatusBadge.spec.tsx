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
import React from 'react'
import { render, screen } from '@test-utils/render'
import { OnrampStatusBadge } from '../OnrampStatusBadge'

describe('OnrampStatusBadge', () => {
    // i18n is not initialized in unit tests, so `t(key)` returns the key itself.
    // Assert on the resolved i18n key per status.
    it('renders the completed label for a completed status', () => {
        render(<OnrampStatusBadge status='completed' />)

        expect(screen.getByText('onramp.status.completed')).toBeTruthy()
    })

    it('renders the failed label for a failed status', () => {
        render(<OnrampStatusBadge status='failed' />)

        expect(screen.getByText('onramp.status.failed')).toBeTruthy()
    })
})
