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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToast } from '../useToast'
import { Notifier } from 'react-native-notifier'

vi.mock('react-native-notifier', () => ({
    Notifier: {
        showNotification: vi.fn(),
    },
}))

vi.mock('@rneui/themed', () => ({
    makeStyles: () => () => ({
        baseStyle: { zIndex: 1000 },
        successStyle: { backgroundColor: 'green' },
        successStyleText: { color: 'white' },
        errorStyle: { backgroundColor: 'red' },
        errorStyleText: { color: 'white' },
        infoStyle: { backgroundColor: 'blue' },
        infoStyleText: { color: 'white' },
        warningStyle: { backgroundColor: 'yellow' },
        warningStyleText: { color: 'black' },
    }),
}))

describe('useToast', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should show success toast', () => {
        const { result } = renderHook(() => useToast())

        act(() => {
            result.current.showToast({
                title: 'Success',
                body: 'Operation completed',
                type: 'success',
            })
        })

        expect(Notifier.showNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Success',
                description: 'Operation completed',
                componentProps: expect.objectContaining({
                    titleStyle: { color: 'white' },
                }),
            }),
        )
    })

    it('should show error toast', () => {
        const { result } = renderHook(() => useToast())

        act(() => {
            result.current.showToast({
                title: 'Error',
                body: 'Operation failed',
                type: 'error',
            })
        })

        expect(Notifier.showNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Error',
                description: 'Operation failed',
                componentProps: expect.objectContaining({
                    containerStyle: expect.arrayContaining([
                        { backgroundColor: 'red' },
                    ]),
                }),
            }),
        )
    })

    it('should show warning toast', () => {
        const { result } = renderHook(() => useToast())

        act(() => {
            result.current.showToast({
                title: 'Warning',
                body: 'Be careful',
                type: 'warning',
            })
        })

        expect(Notifier.showNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Warning',
                componentProps: expect.objectContaining({
                    containerStyle: expect.arrayContaining([
                        { backgroundColor: 'yellow' },
                    ]),
                }),
            }),
        )
    })

    it('should show info toast by default', () => {
        const { result } = renderHook(() => useToast())

        act(() => {
            result.current.showToast({
                title: 'Info',
                body: 'Just so you know',
                type: 'info',
            })
        })

        expect(Notifier.showNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Info',
                componentProps: expect.objectContaining({
                    containerStyle: expect.arrayContaining([
                        { backgroundColor: 'blue' },
                    ]),
                }),
            }),
        )
    })
})
