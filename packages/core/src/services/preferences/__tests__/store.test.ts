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

import { describe, test, expect } from 'vitest'
import { createStore } from 'zustand'
import { createPreferencesSlice, partializePreferencesSlice } from '../store'
import type { PreferencesSlice } from '../store'

describe('services/preferences/store', () => {
    test('createPreferencesSlice initializes with empty preferences', () => {
        const store = createStore<PreferencesSlice>()(createPreferencesSlice)

        expect(store.getState().preferences).toEqual({})
    })

    test('setPreference adds new preference', () => {
        const store = createStore<PreferencesSlice>()(createPreferencesSlice)

        store.getState().setPreference('theme', 'dark')

        expect(store.getState().preferences).toEqual({
            theme: 'dark'
        })
    })

    test('setPreference updates existing preference', () => {
        const store = createStore<PreferencesSlice>()(createPreferencesSlice)

        store.getState().setPreference('theme', 'light')
        store.getState().setPreference('theme', 'dark')

        expect(store.getState().preferences).toEqual({
            theme: 'dark'
        })
    })

    test('setPreference handles multiple preferences', () => {
        const store = createStore<PreferencesSlice>()(createPreferencesSlice)

        store.getState().setPreference('theme', 'dark')
        store.getState().setPreference('language', 'en')
        store.getState().setPreference('notifications', 'enabled')

        expect(store.getState().preferences).toEqual({
            theme: 'dark',
            language: 'en',
            notifications: 'enabled'
        })
    })

    test('getPreference returns correct value for existing key', () => {
        const store = createStore<PreferencesSlice>()(createPreferencesSlice)

        store.getState().setPreference('theme', 'dark')

        expect(store.getState().getPreference('theme')).toBe('dark')
    })

    test('getPreference returns null for non-existent key', () => {
        const store = createStore<PreferencesSlice>()(createPreferencesSlice)

        expect(store.getState().getPreference('nonexistent')).toBeNull()
    })

    test('deletePreference removes existing preference', () => {
        const store = createStore<PreferencesSlice>()(createPreferencesSlice)

        store.getState().setPreference('theme', 'dark')
        store.getState().setPreference('language', 'en')

        store.getState().deletePreference('theme')

        expect(store.getState().preferences).toEqual({
            language: 'en'
        })
    })

    test('deletePreference handles non-existent key gracefully', () => {
        const store = createStore<PreferencesSlice>()(createPreferencesSlice)

        store.getState().setPreference('theme', 'dark')

        store.getState().deletePreference('nonexistent')

        expect(store.getState().preferences).toEqual({
            theme: 'dark'
        })
    })

    test('deletePreference preserves other preferences when removing one', () => {
        const store = createStore<PreferencesSlice>()(createPreferencesSlice)

        store.getState().setPreference('theme', 'dark')
        store.getState().setPreference('language', 'en')
        store.getState().setPreference('notifications', 'enabled')

        store.getState().deletePreference('language')

        expect(store.getState().preferences).toEqual({
            theme: 'dark',
            notifications: 'enabled'
        })
    })

    test('partializePreferencesSlice returns only preferences', () => {
        const fullState: PreferencesSlice = {
            preferences: { theme: 'dark' },
            getPreference: vi.fn(),
            setPreference: vi.fn(),
            deletePreference: vi.fn(),
        }

        const partialized = partializePreferencesSlice(fullState)

        expect(partialized).toEqual({
            preferences: { theme: 'dark' }
        })
    })

    test('partializePreferencesSlice handles empty preferences', () => {
        const fullState: PreferencesSlice = {
            preferences: {},
            getPreference: vi.fn(),
            setPreference: vi.fn(),
            deletePreference: vi.fn(),
        }

        const partialized = partializePreferencesSlice(fullState)

        expect(partialized).toEqual({
            preferences: {}
        })
    })

    test('store maintains immutability when updating preferences', () => {
        const store = createStore<PreferencesSlice>()(createPreferencesSlice)

        const initialState = store.getState().preferences
        store.getState().setPreference('theme', 'dark')

        // Original object should not be mutated
        expect(initialState).toEqual({})
        expect(store.getState().preferences).toEqual({ theme: 'dark' })
    })

    test('getPreference returns null when preferences is empty', () => {
        const store = createStore<PreferencesSlice>()(createPreferencesSlice)

        expect(store.getState().getPreference('any-key')).toBeNull()
    })

    test('setPreference with empty string value', () => {
        const store = createStore<PreferencesSlice>()(createPreferencesSlice)

        store.getState().setPreference('empty-pref', '')

        expect(store.getState().preferences).toEqual({
            'empty-pref': ''
        })
        expect(store.getState().getPreference('empty-pref')).toBe('')
    })

    test('deletePreference on empty store does nothing', () => {
        const store = createStore<PreferencesSlice>()(createPreferencesSlice)

        store.getState().deletePreference('anything')

        expect(store.getState().preferences).toEqual({})
    })
})