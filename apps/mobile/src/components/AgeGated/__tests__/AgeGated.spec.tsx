/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { Text } from 'react-native'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useAgeGate = vi.fn()
vi.mock('@modules/age-gate/hooks/useAgeGate', () => ({
    useAgeGate: () => useAgeGate(),
}))

let isFocused = true
vi.mock('@react-navigation/native', async importOriginal => ({
    ...(await importOriginal<typeof import('@react-navigation/native')>()),
    useIsFocused: () => isFocused,
}))

import { AgeGated } from '../AgeGated'

const baseHook = {
    status: 'unknown' as const,
    isAdult: false,
    ensureChecked: vi.fn(),
    retry: vi.fn(),
}

describe('AgeGated', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        isFocused = true
    })

    it('renders children when adult', () => {
        useAgeGate.mockReturnValue({
            ...baseHook,
            status: 'adult',
            isAdult: true,
        })
        render(
            <AgeGated>
                <Text>gated content</Text>
            </AgeGated>,
        )
        expect(screen.getByText('gated content')).toBeTruthy()
    })

    it('renders the fallback when minor', () => {
        useAgeGate.mockReturnValue({ ...baseHook, status: 'minor' })
        render(
            <AgeGated>
                <Text>gated content</Text>
            </AgeGated>,
        )
        expect(screen.queryByText('gated content')).toBeNull()
        expect(screen.getByTestId('age-gate-retry')).toBeTruthy()
    })

    it('renders the fallback when status is unknown', () => {
        useAgeGate.mockReturnValue({ ...baseHook, status: 'unknown' })
        render(
            <AgeGated>
                <Text>gated content</Text>
            </AgeGated>,
        )
        expect(screen.queryByText('gated content')).toBeNull()
        expect(screen.getByTestId('age-gate-retry')).toBeTruthy()
    })

    it('calls ensureChecked on mount when focused', () => {
        const ensureChecked = vi.fn()
        useAgeGate.mockReturnValue({ ...baseHook, ensureChecked })
        render(
            <AgeGated>
                <Text>gated content</Text>
            </AgeGated>,
        )
        expect(ensureChecked).toHaveBeenCalled()
    })

    it('does not call ensureChecked when the screen is not focused', () => {
        isFocused = false
        const ensureChecked = vi.fn()
        useAgeGate.mockReturnValue({ ...baseHook, ensureChecked })
        render(
            <AgeGated>
                <Text>gated content</Text>
            </AgeGated>,
        )
        expect(ensureChecked).not.toHaveBeenCalled()
    })
})
