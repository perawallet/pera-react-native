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

import { describe, it, expect } from 'vitest'
import { getAppStateTransition } from '../app-state'

describe('getAppStateTransition', () => {
    it('returns no transition for null or unexpected states', () => {
        expect(getAppStateTransition(null, 'active', 'android')).toEqual({
            didLeaveForeground: false,
            didEnterForeground: false,
        })

        expect(getAppStateTransition('active', 'unknown', 'ios')).toEqual({
            didLeaveForeground: false,
            didEnterForeground: false,
        })
    })

    it('ignores inactive to active noise on Android', () => {
        expect(
            getAppStateTransition('active', 'inactive', 'android'),
        ).toEqual({
            didLeaveForeground: false,
            didEnterForeground: false,
        })

        expect(
            getAppStateTransition('inactive', 'active', 'android'),
        ).toEqual({
            didLeaveForeground: false,
            didEnterForeground: false,
        })
    })

    it('treats real background transitions as leave and enter on Android', () => {
        expect(
            getAppStateTransition('active', 'background', 'android'),
        ).toEqual({
            didLeaveForeground: true,
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

    it('supports iOS inactive/background transitions', () => {
        expect(getAppStateTransition('active', 'inactive', 'ios')).toEqual({
            didLeaveForeground: true,
            didEnterForeground: false,
        })

        expect(getAppStateTransition('inactive', 'active', 'ios')).toEqual({
            didLeaveForeground: false,
            didEnterForeground: true,
        })

        expect(getAppStateTransition('active', 'background', 'ios')).toEqual({
            didLeaveForeground: true,
            didEnterForeground: false,
        })

        expect(getAppStateTransition('background', 'active', 'ios')).toEqual({
            didLeaveForeground: false,
            didEnterForeground: true,
        })
    })
})
