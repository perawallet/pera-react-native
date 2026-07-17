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

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

let mockOS = 'android'

// Default the RN Platform mock to android so the implicit-platform branch
// of `getAppStatePlatform` (when called without an override) lands on a
// known value. Individual tests pass an explicit platform argument to
// `isForegroundTransition`, so this only affects the no-arg path.
vi.mock('react-native', () => ({
    get Platform() {
        return { OS: mockOS }
    },
}))

import { getAppStatePlatform, isForegroundTransition } from '../app-state'

describe('isForegroundTransition', () => {
    it('returns true for the canonical Android background→active', () => {
        expect(isForegroundTransition('background', 'active', 'android')).toBe(
            true,
        )
    })

    it('returns false for Android inactive→active (only real background counts)', () => {
        expect(isForegroundTransition('inactive', 'active', 'android')).toBe(
            false,
        )
    })

    it('returns true for iOS background→active', () => {
        expect(isForegroundTransition('background', 'active', 'ios')).toBe(true)
    })

    it('returns true for iOS inactive→active', () => {
        expect(isForegroundTransition('inactive', 'active', 'ios')).toBe(true)
    })

    it('returns false for iOS active→active', () => {
        expect(isForegroundTransition('active', 'active', 'ios')).toBe(false)
    })

    it('returns false on iOS when next state is not active', () => {
        expect(isForegroundTransition('background', 'inactive', 'ios')).toBe(
            false,
        )
    })

    it('returns false when previous state is undefined (non-string guard)', () => {
        expect(isForegroundTransition(undefined, 'active', 'ios')).toBe(false)
    })

    it('returns false when previous state is null (non-string guard)', () => {
        expect(isForegroundTransition(null, 'active', 'android')).toBe(false)
    })
})

describe('getAppStatePlatform', () => {
    it('returns android when Platform.OS is android', () => {
        expect(getAppStatePlatform()).toBe('android')
    })
})

describe('web platform', () => {
    beforeEach(() => {
        mockOS = 'web'
    })

    afterEach(() => {
        mockOS = 'android'
    })

    it('reports web when Platform.OS is web', () => {
        expect(getAppStatePlatform()).toBe('web')
    })

    it('detects background→active as a foreground transition on web', () => {
        expect(isForegroundTransition('background', 'active', 'web')).toBe(true)
    })

    it('ignores every other transition on web (react-native-web emits only active/background)', () => {
        expect(isForegroundTransition('active', 'background', 'web')).toBe(
            false,
        )
        expect(isForegroundTransition('inactive', 'active', 'web')).toBe(false)
        expect(isForegroundTransition(null, 'active', 'web')).toBe(false)
        expect(isForegroundTransition('active', 'active', 'web')).toBe(false)
    })
})
