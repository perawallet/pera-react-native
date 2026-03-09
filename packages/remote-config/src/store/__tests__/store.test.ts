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

import { describe, test, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MemoryKeyValueStorage } from '@test-utils'
import { createRemoteConfigStore } from '../store'

describe('remote-config/store', () => {
    let storage: MemoryKeyValueStorage

    beforeEach(() => {
        storage = new MemoryKeyValueStorage()
    })

    test('should initialize with default empty config overrides', () => {
        const useStore = createRemoteConfigStore(storage)

        const { result } = renderHook(() => useStore())

        expect(result.current.configOverrides).toEqual({})
    })

    test('should set config override', () => {
        const useStore = createRemoteConfigStore(storage)

        const { result } = renderHook(() => useStore())

        act(() => {
            result.current.setConfigOverride('test_key', 'test_value')
        })

        expect(result.current.configOverrides['test_key']).toBe('test_value')
    })

    test('should update existing config override', () => {
        const useStore = createRemoteConfigStore(storage)

        const { result } = renderHook(() => useStore())

        act(() => {
            result.current.setConfigOverride('test_key', 'initial_value')
        })

        act(() => {
            result.current.setConfigOverride('test_key', 'updated_value')
        })

        expect(result.current.configOverrides['test_key']).toBe('updated_value')
    })

    test('should remove config override when value is null', () => {
        const useStore = createRemoteConfigStore(storage)

        const { result } = renderHook(() => useStore())

        act(() => {
            result.current.setConfigOverride('test_key', 'test_value')
        })

        expect(result.current.configOverrides['test_key']).toBe('test_value')

        act(() => {
            result.current.setConfigOverride('test_key', null)
        })

        expect(result.current.configOverrides['test_key']).toBeUndefined()
    })

    test('should handle boolean and number overrides', () => {
        const useStore = createRemoteConfigStore(storage)

        const { result } = renderHook(() => useStore())

        act(() => {
            result.current.setConfigOverride('bool_key', true)
            result.current.setConfigOverride('number_key', 123)
        })

        expect(result.current.configOverrides['bool_key']).toBe(true)
        expect(result.current.configOverrides['number_key']).toBe(123)
    })
})
