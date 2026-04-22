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

import { describe, test, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@test-utils/render'

vi.mock('@assets/icons/shield-check.svg', () => ({
    default: (props: React.SVGProps<SVGSVGElement>) =>
        React.createElement('div', {
            ...props,
            'data-testid': 'shield-check-svg',
        }),
}))

const mockPopToTop = vi.fn()
const mockParentGoBack = vi.fn()

vi.mock('@react-navigation/native', async importOriginal => {
    const original =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...original,
        useNavigation: () => ({
            popToTop: mockPopToTop,
            getParent: () => ({ goBack: mockParentGoBack }),
        }),
    }
})

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (k: string) => k }),
}))

import { BackupSuccessScreen } from '../BackupSuccessScreen'

describe('BackupSuccessScreen', () => {
    test('pressing Done dismisses the backup stack (goes back to parent)', () => {
        render(<BackupSuccessScreen />)
        fireEvent.click(screen.getByTestId('backup_success_done'))
        expect(
            mockPopToTop.mock.calls.length + mockParentGoBack.mock.calls.length,
        ).toBeGreaterThan(0)
    })
})
