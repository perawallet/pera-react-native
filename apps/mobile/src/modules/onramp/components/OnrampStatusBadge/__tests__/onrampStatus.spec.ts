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
import type { OnrampStatus } from '@perawallet/wallet-core-onramp'
import { getOnrampStatusDescriptor } from '../onrampStatus'

describe('getOnrampStatusDescriptor', () => {
    it('maps completed to a positive check icon', () => {
        const descriptor = getOnrampStatusDescriptor('completed')

        expect(descriptor.icon).toBe('check')
        expect(descriptor.color).toBe('positive')
        expect(descriptor.iconVariant).toBe('positive')
        expect(descriptor.labelKey).toBe('onramp.status.completed')
    })

    it('maps pending to a warning-colored indicator', () => {
        const descriptor = getOnrampStatusDescriptor('pending')

        expect(descriptor.color).toBe('warning')
        expect(descriptor.iconVariant).toBe('warning')
    })

    it('maps failed to a negative error-circle icon', () => {
        const descriptor = getOnrampStatusDescriptor('failed')

        expect(descriptor.icon).toBe('error-circle')
        expect(descriptor.color).toBe('negative')
    })

    it('maps pending and in_progress to their status icons', () => {
        expect(getOnrampStatusDescriptor('pending').icon).toBe('pending')
        expect(getOnrampStatusDescriptor('in_progress').icon).toBe('progress')
        expect(getOnrampStatusDescriptor('in_progress').color).toBe('main')
    })

    it('omits the icon for cancelled orders', () => {
        const descriptor = getOnrampStatusDescriptor('cancelled')

        expect(descriptor.icon).toBeNull()
        expect(descriptor.color).toBe('neutral')
    })

    it('provides a descriptor for every status', () => {
        const statuses: OnrampStatus[] = [
            'pending',
            'in_progress',
            'completed',
            'failed',
            'cancelled',
        ]

        statuses.forEach(status => {
            const descriptor = getOnrampStatusDescriptor(status)
            expect(descriptor.labelKey).toBe(`onramp.status.${status}`)
        })
    })
})
