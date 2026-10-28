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

// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
    getAppStateTransition,
    getPollingTransitionAction,
    isActiveAppState,
    isBackgroundLikeAppState,
    isBackgroundTransition,
    isForegroundTransition,
} from '../app-state'

describe('app-state utils', () => {
    it('detects active app state', () => {
        expect(isActiveAppState('active')).toBe(true)
        expect(isActiveAppState('inactive')).toBe(false)
        expect(isActiveAppState('background')).toBe(false)
        expect(isActiveAppState('unknown')).toBe(false)
        expect(isActiveAppState(undefined)).toBe(false)
        expect(isActiveAppState(null)).toBe(false)
    })

    it('detects background-like app state by platform', () => {
        expect(isBackgroundLikeAppState('inactive', 'ios')).toBe(true)
        expect(isBackgroundLikeAppState('background', 'ios')).toBe(true)
        expect(isBackgroundLikeAppState('inactive', 'android')).toBe(false)
        expect(isBackgroundLikeAppState('background', 'android')).toBe(true)
        expect(isBackgroundLikeAppState('active', 'ios')).toBe(false)
        expect(isBackgroundLikeAppState('unknown', 'android')).toBe(false)
    })

    it('detects foreground transitions by platform', () => {
        expect(isForegroundTransition('inactive', 'active', 'ios')).toBe(true)
        expect(isForegroundTransition('background', 'active', 'ios')).toBe(true)
        expect(isForegroundTransition('background', 'active', 'android')).toBe(
            true,
        )
        expect(isForegroundTransition('inactive', 'active', 'android')).toBe(
            false,
        )
    })

    it('detects background transitions by platform', () => {
        expect(isBackgroundTransition('active', 'inactive', 'ios')).toBe(true)
        expect(isBackgroundTransition('active', 'background', 'ios')).toBe(true)
        expect(isBackgroundTransition('active', 'background', 'android')).toBe(
            true,
        )
        expect(
            isBackgroundTransition('inactive', 'background', 'android'),
        ).toBe(true)
        expect(isBackgroundTransition('active', 'inactive', 'android')).toBe(
            false,
        )
    })

    it('returns expected polling transition action', () => {
        expect(getPollingTransitionAction('inactive', 'active', 'ios')).toBe(
            'start',
        )
        expect(
            getPollingTransitionAction('background', 'active', 'android'),
        ).toBe('start')
        expect(getPollingTransitionAction('active', 'inactive', 'ios')).toBe(
            'stop',
        )
        expect(
            getPollingTransitionAction('active', 'background', 'android'),
        ).toBe('stop')
        expect(
            getPollingTransitionAction('active', 'inactive', 'android'),
        ).toBe(null)
    })

    it('returns expected app state transition flags', () => {
        expect(getAppStateTransition('active', 'inactive', 'ios')).toEqual({
            didLeaveForeground: true,
            didEnterForeground: false,
        })
        expect(getAppStateTransition('inactive', 'active', 'ios')).toEqual({
            didLeaveForeground: false,
            didEnterForeground: true,
        })
        expect(getAppStateTransition('active', 'inactive', 'android')).toEqual({
            didLeaveForeground: false,
            didEnterForeground: false,
        })
        expect(
            getAppStateTransition('inactive', 'background', 'android'),
        ).toEqual({
            didLeaveForeground: true,
            didEnterForeground: false,
        })
        expect(
            getAppStateTransition('background', 'active', 'android'),
        ).toEqual({
            didLeaveForeground: false,
            didEnterForeground: true,
        })
    })
})
