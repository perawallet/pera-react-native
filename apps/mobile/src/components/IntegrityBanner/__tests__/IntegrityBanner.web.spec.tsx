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

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@test-utils/render'
import { IntegrityBanner } from '../IntegrityBanner.web'
import type { UseIntegrityBannerResult } from '../useIntegrityBanner.web'

const banner = vi.hoisted(() => ({
    current: {} as Partial<UseIntegrityBannerResult>,
}))

vi.mock('../useIntegrityBanner.web', () => ({
    useIntegrityBanner: () => ({
        isVisible: true,
        mode: 'service',
        label: 'Pera services unavailable',
        description: 'Explanation',
        actionLabel: 'Retry',
        onAction: vi.fn(),
        isActionPending: false,
        isExpanded: true,
        isExplanationRendered: true,
        entryAnimatedStyle: {},
        explanationAnimatedStyle: {},
        ...banner.current,
    }),
}))

describe('IntegrityBanner', () => {
    it('renders the pill with its explanation and wires the action', () => {
        const onAction = vi.fn()
        banner.current = { onAction }

        render(<IntegrityBanner />)
        fireEvent.click(screen.getByText('Retry'))

        expect(screen.getByText('Pera services unavailable')).toBeTruthy()
        expect(screen.getByText('Explanation')).toBeTruthy()
        expect(onAction).toHaveBeenCalledTimes(1)
    })

    it('shows no action while one is in flight', () => {
        banner.current = { isActionPending: true }

        render(<IntegrityBanner />)

        expect(screen.queryByText('Retry')).toBeNull()
    })

    it('renders nothing while hidden', () => {
        banner.current = { isVisible: false }

        render(<IntegrityBanner />)

        expect(screen.queryByText('Pera services unavailable')).toBeNull()
    })
})
