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

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@test-utils/render'
import { useCameraTabResultStore } from '../useCameraTabResultStore'
import { CameraTabResult } from '../CameraTabResult.web'

const { mockCloseCurrentTab } = vi.hoisted(() => ({
    mockCloseCurrentTab: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-browser-runtime', () => ({
    closeCurrentTab: () => mockCloseCurrentTab(),
}))

describe('CameraTabResult', () => {
    beforeEach(() => {
        mockCloseCurrentTab.mockReset()
        useCameraTabResultStore.setState({ result: null })
    })

    it('renders nothing until an action has finished', () => {
        render(<CameraTabResult />)

        expect(screen.queryByTestId('camera-tab-result')).toBeNull()
    })

    it.each([
        ['account-imported', 'camera_tab.account_imported_title'],
        ['backup-restored', 'camera_tab.backup_restored_title'],
    ] as const)('names the %s action', (result, titleKey) => {
        act(() => useCameraTabResultStore.getState().showResult(result))

        render(<CameraTabResult />)

        expect(screen.getByText(titleKey)).toBeTruthy()
    })

    it('closes the tab from the primary action', () => {
        act(() =>
            useCameraTabResultStore.getState().showResult('account-imported'),
        )
        render(<CameraTabResult />)

        fireEvent.click(screen.getByTestId('camera-tab-result-primary'))

        expect(mockCloseCurrentTab).toHaveBeenCalledTimes(1)
    })
})
