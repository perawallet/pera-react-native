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
            logger.setErrorReporter(undefined)
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

        test('formats Error objects in context', () => {
            const error = new Error('something broke')
            logger.error('operation failed', { error })
            expect(console.error).toHaveBeenCalledWith(
                '[ERROR] operation failed',
                expect.objectContaining({
                    error: expect.objectContaining({
                        name: 'Error',
                        message: 'something broke',
                    }),
                }),
            )
        })

        test('omits stack from formatted Error context value when missing', () => {
            const error = new Error('no stack')
            error.stack = undefined
            logger.error('operation failed', { error })
            expect(console.error).toHaveBeenCalledWith(
                '[ERROR] operation failed',
                {
                    error: {
                        name: 'Error',
                        message: 'no stack',
                    },
                },
            )
        })

        test('passes non-Error context values through as-is', () => {
            logger.warn('something happened', { error: 'a string error' })
            expect(console.warn).toHaveBeenCalledWith(
                '[WARN] something happened',
                { error: 'a string error' },
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

        test('forwards errors to configured error reporter', () => {
            const errorReporter = vi.fn()
            logger.setErrorReporter(errorReporter)

            logger.error('error message', { source: 'test' })

            expect(errorReporter).toHaveBeenCalledTimes(1)
            expect(errorReporter).toHaveBeenCalledWith(
                expect.objectContaining({
                    severity: 'error',
                    error: expect.any(Error),
                }),
            )
            expect(
                (
                    errorReporter.mock.calls[0]?.[0] as {
                        error: Error
                    }
                ).error.message,
            ).toContain('error message')
        })

        test('forwards critical logs to configured error reporter', () => {
            const errorReporter = vi.fn()
            logger.setErrorReporter(errorReporter)

            logger.critical('critical message')

            expect(errorReporter).toHaveBeenCalledTimes(1)
            expect(errorReporter).toHaveBeenCalledWith(
                expect.objectContaining({
                    severity: 'critical',
                    error: expect.any(Error),
                }),
            )
            expect(
                (
                    errorReporter.mock.calls[0]?.[0] as {
                        error: Error
                    }
                ).error.message,
            ).toContain('critical message')
        })

        test('does not forward warn logs to configured error reporter', () => {
            const errorReporter = vi.fn()
            logger.setErrorReporter(errorReporter)

            logger.warn('warn message')

            expect(errorReporter).not.toHaveBeenCalled()
        })

        test('does not throw when error reporter throws', () => {
            logger.setErrorReporter(() => {
                throw new Error('reporting failed')
            })

            expect(() => {
                logger.error('will still be logged')
            }).not.toThrow()
        })

        test('forwards the caught Error directly when no extra context is provided', () => {
            const errorReporter = vi.fn()
            logger.setErrorReporter(errorReporter)

            const original = new Error('boom')
            logger.error(original)

            expect(errorReporter).toHaveBeenCalledWith(
                expect.objectContaining({
                    severity: 'error',
                    error: original,
                }),
            )
        })

        test('preserves the original name and stack when reporting an Error with context', () => {
            const errorReporter = vi.fn()
            logger.setErrorReporter(errorReporter)

            const original = new TypeError('oh no')
            logger.error(original, { source: 'test' })

            const reported = errorReporter.mock.calls[0]?.[0] as {
                error: Error
            }
            expect(reported.error.name).toBe('TypeError')
            expect(reported.error.message).toContain('oh no')
            expect(reported.error.message).toContain('context:')
        })

        test('falls back to an "[unserializable context]" marker when JSON fails', () => {
            const errorReporter = vi.fn()
            logger.setErrorReporter(errorReporter)

            const circular: Record<string, unknown> = {}
            circular.self = circular

            logger.error('still goes out', circular as never)

            const reported = errorReporter.mock.calls[0]?.[0] as {
                error: Error
            }
            expect(reported.error.message).toContain('[unserializable context]')
        })
    })
})
