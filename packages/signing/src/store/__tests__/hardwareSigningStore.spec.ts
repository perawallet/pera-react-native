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

import { describe, it, expect, beforeEach } from 'vitest'
import { useHardwareSigningStore } from '../hardwareSigningStore'

describe('useHardwareSigningStore', () => {
    beforeEach(() => useHardwareSigningStore.getState().resetState())

    it('defaults to isTroubleshootingVisible = false', () => {
        expect(
            useHardwareSigningStore.getState().isTroubleshootingVisible,
        ).toBe(false)
    })

    it('openTroubleshooting flips the flag on', () => {
        useHardwareSigningStore.getState().openTroubleshooting()
        expect(
            useHardwareSigningStore.getState().isTroubleshootingVisible,
        ).toBe(true)
    })

    it('closeTroubleshooting flips the flag off', () => {
        useHardwareSigningStore.getState().openTroubleshooting()
        useHardwareSigningStore.getState().closeTroubleshooting()
        expect(
            useHardwareSigningStore.getState().isTroubleshootingVisible,
        ).toBe(false)
    })

    it('resetState restores defaults', () => {
        useHardwareSigningStore.getState().openTroubleshooting()
        useHardwareSigningStore.getState().resetState()
        expect(
            useHardwareSigningStore.getState().isTroubleshootingVisible,
        ).toBe(false)
    })
})
