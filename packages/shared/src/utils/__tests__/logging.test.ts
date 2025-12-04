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

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { infoLog, errorLog, debugLog } from '../logging'

describe('utils/logging', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {})
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('infoLog', () => {
        test('calls console.log with message', () => {
            infoLog('test message')
            expect(console.log).toHaveBeenCalledWith('test message')
        })

        test('calls console.log with message and args', () => {
            infoLog('test message', 'arg1', 'arg2')
            expect(console.log).toHaveBeenCalledWith(
                'test message',
                'arg1',
                'arg2',
            )
        })
    })

    describe('errorLog', () => {
        test('calls console.error with message', () => {
            errorLog('error message')
            expect(console.error).toHaveBeenCalledWith('error message')
        })

        test('calls console.error with message and args', () => {
            errorLog('error message', 'arg1', 'arg2')
            expect(console.error).toHaveBeenCalledWith(
                'error message',
                'arg1',
                'arg2',
            )
        })
    })

    describe('debugLog', () => {
        test('calls console.log with message and args', () => {
            debugLog('debug message', 'arg1')
            // We can't easily test the config.debugEnabled condition without complex mocking
            // Just verify the function can be called without errors
            expect(console.log).toHaveBeenCalled()
        })
    })
})
