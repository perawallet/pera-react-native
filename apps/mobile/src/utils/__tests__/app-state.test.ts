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

import { describe, expect, it } from 'vitest'
import {
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

    it('detects background-like app state', () => {
        expect(isBackgroundLikeAppState('inactive')).toBe(true)
        expect(isBackgroundLikeAppState('background')).toBe(true)
        expect(isBackgroundLikeAppState('active')).toBe(false)
        expect(isBackgroundLikeAppState('unknown')).toBe(false)
        expect(isBackgroundLikeAppState(undefined)).toBe(false)
        expect(isBackgroundLikeAppState(null)).toBe(false)
    })

    it('detects foreground transitions', () => {
        expect(isForegroundTransition('inactive', 'active')).toBe(true)
        expect(isForegroundTransition('background', 'active')).toBe(true)
        expect(isForegroundTransition('active', 'active')).toBe(false)
        expect(isForegroundTransition('active', 'inactive')).toBe(false)
        expect(isForegroundTransition(undefined, 'active')).toBe(false)
        expect(isForegroundTransition('background', undefined)).toBe(false)
        expect(isForegroundTransition(null, 'active')).toBe(false)
        expect(isForegroundTransition('background', null)).toBe(false)
        expect(isForegroundTransition('unknown', 'active')).toBe(false)
    })

    it('detects background transitions', () => {
        expect(isBackgroundTransition('active', 'inactive')).toBe(true)
        expect(isBackgroundTransition('active', 'background')).toBe(true)
        expect(isBackgroundTransition('inactive', 'background')).toBe(false)
        expect(isBackgroundTransition('background', 'active')).toBe(false)
        expect(isBackgroundTransition(undefined, 'inactive')).toBe(false)
        expect(isBackgroundTransition('active', undefined)).toBe(false)
        expect(isBackgroundTransition(null, 'inactive')).toBe(false)
        expect(isBackgroundTransition('active', null)).toBe(false)
        expect(isBackgroundTransition('active', 'unknown')).toBe(false)
    })

    it('returns expected polling transition action', () => {
        expect(getPollingTransitionAction('inactive', 'active')).toBe('start')
        expect(getPollingTransitionAction('background', 'active')).toBe('start')
        expect(getPollingTransitionAction('active', 'inactive')).toBe('stop')
        expect(getPollingTransitionAction('active', 'background')).toBe('stop')
        expect(getPollingTransitionAction('active', 'active')).toBe(null)
        expect(getPollingTransitionAction('unknown', 'active')).toBe(null)
        expect(getPollingTransitionAction('active', 'unknown')).toBe(null)
        expect(getPollingTransitionAction(undefined, 'active')).toBe(null)
        expect(getPollingTransitionAction('active', undefined)).toBe(null)
    })
})
