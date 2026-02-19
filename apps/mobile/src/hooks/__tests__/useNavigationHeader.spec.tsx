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

import React from 'react'
import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useNavigationHeader } from '../useNavigationHeader'

const mockSetOptions = vi.fn()

vi.mock('@react-navigation/native', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...actual,
        useNavigation: () => ({
            setOptions: mockSetOptions,
        }),
    }
})

describe('useNavigationHeader', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('sets headerRight when right is provided', () => {
        const rightElement = React.createElement('div', null, 'right')

        renderHook(() => useNavigationHeader({ right: rightElement }))

        expect(mockSetOptions).toHaveBeenCalledWith(
            expect.objectContaining({
                headerRight: expect.any(Function),
            }),
        )

        const call = mockSetOptions.mock.calls[0][0]
        expect(call.headerRight()).toBe(rightElement)
        expect(call.headerLeft).toBeUndefined()
        expect(call.headerTitle).toBeUndefined()
        expect(call.title).toBeUndefined()
    })

    it('sets headerLeft when left is provided', () => {
        const leftElement = React.createElement('div', null, 'left')

        renderHook(() => useNavigationHeader({ left: leftElement }))

        expect(mockSetOptions).toHaveBeenCalledWith(
            expect.objectContaining({
                headerLeft: expect.any(Function),
            }),
        )

        const call = mockSetOptions.mock.calls[0][0]
        expect(call.headerLeft()).toBe(leftElement)
    })

    it('sets headerTitle when title is a ReactNode', () => {
        const titleElement = React.createElement('div', null, 'Title')

        renderHook(() => useNavigationHeader({ title: titleElement }))

        expect(mockSetOptions).toHaveBeenCalledWith(
            expect.objectContaining({
                headerTitle: expect.any(Function),
            }),
        )

        const call = mockSetOptions.mock.calls[0][0]
        expect(call.headerTitle()).toBe(titleElement)
        expect(call.title).toBeUndefined()
    })

    it('sets title string when title is a string', () => {
        renderHook(() => useNavigationHeader({ title: 'My Title' }))

        expect(mockSetOptions).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'My Title',
            }),
        )

        const call = mockSetOptions.mock.calls[0][0]
        expect(call.headerTitle).toBeUndefined()
    })

    it('does not call setOptions when enabled is false', () => {
        renderHook(() =>
            useNavigationHeader({
                right: React.createElement('div'),
                enabled: false,
            }),
        )

        expect(mockSetOptions).not.toHaveBeenCalled()
    })

    it('sets multiple options at once', () => {
        const leftElement = React.createElement('div', null, 'left')
        const rightElement = React.createElement('div', null, 'right')
        const titleElement = React.createElement('div', null, 'title')

        renderHook(() =>
            useNavigationHeader({
                left: leftElement,
                right: rightElement,
                title: titleElement,
            }),
        )

        const call = mockSetOptions.mock.calls[0][0]
        expect(call.headerLeft()).toBe(leftElement)
        expect(call.headerRight()).toBe(rightElement)
        expect(call.headerTitle()).toBe(titleElement)
    })

    it('sets headerRight to render null when right is null', () => {
        renderHook(() => useNavigationHeader({ right: null }))

        expect(mockSetOptions).toHaveBeenCalledWith(
            expect.objectContaining({
                headerRight: expect.any(Function),
            }),
        )

        const call = mockSetOptions.mock.calls[0][0]
        expect(call.headerRight()).toBeNull()
    })
})
