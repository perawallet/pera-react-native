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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAppQuickActions } from '../useAppQuickActions'

const quickActions = vi.hoisted(() => ({
    initial: undefined as { id: string } | undefined,
    setItems: vi.fn(),
    listener: undefined as
        | ((action: { id: string; params?: unknown }) => void)
        | undefined,
    remove: vi.fn(),
    handleDeepLink: vi.fn(),
    qrScanner: true,
}))

vi.mock('expo-quick-actions', () => ({
    get initial() {
        return quickActions.initial
    },
    setItems: quickActions.setItems,
    addListener: (listener: (action: { id: string }) => void) => {
        quickActions.listener = listener
        return { remove: quickActions.remove }
    },
}))

vi.mock('../useDeepLink', () => ({
    useDeepLink: () => ({ handleDeepLink: quickActions.handleDeepLink }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@routes/capabilities', () => ({
    routeCapabilities: {
        get qrScanner() {
            return quickActions.qrScanner
        },
    },
}))

const SCAN_URL = 'perawallet://app/scan/'

describe('useAppQuickActions', () => {
    beforeEach(() => {
        quickActions.initial = undefined
        quickActions.listener = undefined
        quickActions.qrScanner = true
        quickActions.setItems.mockClear()
        quickActions.remove.mockClear()
        quickActions.handleDeepLink.mockClear()
    })

    it('offers a translated Scan action on the app icon', () => {
        renderHook(() => useAppQuickActions())

        expect(quickActions.setItems).toHaveBeenCalledWith([
            {
                id: 'scan',
                title: 'address_entry.scan_qr',
                icon: 'symbol:qrcode.viewfinder',
            },
        ])
    })

    it('opens the scanner when the Scan action is picked while running', () => {
        renderHook(() => useAppQuickActions())

        quickActions.listener?.({ id: 'scan' })

        expect(quickActions.handleDeepLink).toHaveBeenCalledWith(
            SCAN_URL,
            false,
            'in-app',
        )
    })

    // The action that launched the app arrives before any listener exists.
    it('opens the scanner when the Scan action launched the app', () => {
        quickActions.initial = { id: 'scan' }

        renderHook(() => useAppQuickActions())

        expect(quickActions.handleDeepLink).toHaveBeenCalledWith(
            SCAN_URL,
            false,
            'in-app',
        )
    })

    // Params come from the OS, so only the action id is trusted.
    it('ignores unknown actions and any URL they carry', () => {
        renderHook(() => useAppQuickActions())

        quickActions.listener?.({
            id: 'other',
            params: { href: 'perawallet://app/wallet-connect/?uri=x' },
        })

        expect(quickActions.handleDeepLink).not.toHaveBeenCalled()
    })

    it('offers no actions where the app has no scanner', () => {
        quickActions.qrScanner = false

        renderHook(() => useAppQuickActions())

        expect(quickActions.setItems).toHaveBeenCalledWith([])
    })

    it('stops listening on unmount', () => {
        const { unmount } = renderHook(() => useAppQuickActions())

        unmount()

        expect(quickActions.remove).toHaveBeenCalledOnce()
    })
})
