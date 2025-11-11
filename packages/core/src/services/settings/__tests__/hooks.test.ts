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
import { renderHook } from '@testing-library/react'
import { useSettings } from '../hooks'

// Mock the store
const storeMock = vi.hoisted(() => {
    let state: any = { theme: 'light' }
    return {
        create() {
            const useAppStore: any = (selector?: any) => selector ? selector(state) : state
            ;(useAppStore as any).getState = () => state
            ;(useAppStore as any).setState = (partial: any) => {
                state = { ...state, ...partial }
            }
            return { useAppStore }
        },
    }
})
vi.mock('../../../store/app-store', () => storeMock.create())

describe('services/settings/hooks', () => {
    test('returns theme and setTheme from store', () => {
        const setTheme = vi.fn()
        storeMock.create().useAppStore.setState({ theme: 'dark', setTheme })

        const { result } = renderHook(() => useSettings())

        expect(result.current.theme).toBe('dark')
        expect(result.current.setTheme).toBe(setTheme)
    })

    test('returns default theme when not set', () => {
        const setTheme = vi.fn()
        storeMock.create().useAppStore.setState({ theme: undefined, setTheme })

        const { result } = renderHook(() => useSettings())

        expect(result.current.theme).toBeUndefined()
        expect(result.current.setTheme).toBe(setTheme)
    })
})