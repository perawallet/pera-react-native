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
import { logger, LogLevel } from '../logging'

describe('logging', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {})
        vi.spyOn(console, 'error').mockImplementation(() => {})
        vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('logger', () => {
        beforeEach(() => {
            // Reset level to DEBUG for tests to ensure all logs are captured
            logger.setLevel(LogLevel.DEBUG)
        })

        test('debug logs when level is DEBUG', () => {
            logger.debug('test message')
            expect(console.log).toHaveBeenCalledWith('[DEBUG] test message')
        })

        test('info logs when level is DEBUG', () => {
            logger.info('test message')
            expect(console.log).toHaveBeenCalledWith('[INFO] test message')
        })

        test('warn logs when level is DEBUG', () => {
            logger.warn('test message')
            expect(console.warn).toHaveBeenCalledWith('[WARN] test message')
        })

        test('error logs with context', () => {
            const context = { key: 'val' }
            logger.error('test error', context)
            expect(console.error).toHaveBeenCalledWith(
                '[ERROR] test error',
                context,
            )
        })

        test('does not log debug when level is INFO', () => {
            logger.setLevel(LogLevel.INFO)
            logger.debug('should not show')
            expect(console.log).not.toHaveBeenCalled()
        })

        test('logs error even when level is ERROR', () => {
            logger.setLevel(LogLevel.ERROR)
            logger.error('critical')
            expect(console.error).toHaveBeenCalledWith('[ERROR] critical')
        })
    })
})
