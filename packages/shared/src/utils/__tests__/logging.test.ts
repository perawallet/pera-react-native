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

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    logger,
    LogLevel,
    redactSensitiveContext,
    redactSensitiveUrl,
} from '../logging'

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
            // Not named `key`: that is a sensitive exact key (WC handshake
            // key param) and gets redacted by design.
            const context = { detail: 'val' }
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

        test('breaks circular references so the report still serializes', () => {
            const errorReporter = vi.fn()
            logger.setErrorReporter(errorReporter)

            const circular: Record<string, unknown> = {}
            circular.self = circular

            logger.error('still goes out', circular as never)

            const reported = errorReporter.mock.calls[0]?.[0] as {
                error: Error
            }
            // The redactor replaces the cycle with the truncation marker so
            // JSON.stringify never throws; the message is reportable rather
            // than dropped to the "[unserializable context]" fallback.
            expect(reported.error.message).toContain('still goes out')
            expect(reported.error.message).not.toContain(
                '[unserializable context]',
            )
        })

        test('does not crash when console.error throws (RN LogBox in dev)', () => {
            const errorReporter = vi.fn()
            logger.setErrorReporter(errorReporter)

            // Simulate RN LogBox crashing inside console.error.
            ;(console.error as ReturnType<typeof vi.fn>).mockImplementation(
                () => {
                    throw new TypeError(
                        "Cannot read property 'log' of undefined",
                    )
                },
            )

            expect(() => logger.error('still reports')).not.toThrow()

            // Falls back to console.log so the dev still sees the message.
            expect(console.log).toHaveBeenCalledWith(
                '[ERROR] [ERROR] still reports',
            )

            // Error reporter (Sentry / etc.) still fires.
            expect(errorReporter).toHaveBeenCalledWith(
                expect.objectContaining({
                    severity: 'error',
                    error: expect.any(Error),
                }),
            )
        })

        test('does not crash when both console.error and console.log throw', () => {
            const errorReporter = vi.fn()
            logger.setErrorReporter(errorReporter)

            ;(console.error as ReturnType<typeof vi.fn>).mockImplementation(
                () => {
                    throw new Error('LogBox blew up')
                },
            )
            ;(console.log as ReturnType<typeof vi.fn>).mockImplementation(
                () => {
                    throw new Error('also broken')
                },
            )

            expect(() => logger.error('still reports')).not.toThrow()
            expect(errorReporter).toHaveBeenCalled()
        })

        test('redacts mnemonic-bearing URLs in logger context', () => {
            const errorReporter = vi.fn()
            logger.setErrorReporter(errorReporter)

            logger.error('deeplink failed', {
                url: 'perawallet://app/recover-address/?mnemonic=word1+word2+word3+word4+word5',
            })

            const reported = errorReporter.mock.calls[0]?.[0] as {
                error: Error
            }
            expect(reported.error.message).not.toContain('word1+word2')
            expect(reported.error.message).toContain('[REDACTED]')
        })

        test('redacts sensitive keys at the top level of context', () => {
            const errorReporter = vi.fn()
            logger.setErrorReporter(errorReporter)

            logger.error('signing failed', {
                mnemonic: 'word1 word2 word3',
                userId: 'public-id',
            })

            const reported = errorReporter.mock.calls[0]?.[0] as {
                error: Error
            }
            expect(reported.error.message).not.toContain('word1 word2')
            expect(reported.error.message).toContain('[REDACTED]')
            expect(reported.error.message).toContain('public-id')
        })
    })

    describe('redactSensitiveUrl', () => {
        test('redacts mnemonic query parameter', () => {
            expect(
                redactSensitiveUrl(
                    'perawallet://app/recover-address/?mnemonic=word1+word2',
                ),
            ).toBe('perawallet://app/recover-address/?mnemonic=[REDACTED]')
        })

        test('redacts multiple sensitive params', () => {
            const out = redactSensitiveUrl(
                'https://example.com/?passphrase=secret&pin=123456&safe=ok',
            )
            expect(out).toContain('passphrase=[REDACTED]')
            expect(out).toContain('pin=[REDACTED]')
            expect(out).toContain('safe=ok')
        })

        test('is a no-op for URLs without sensitive params', () => {
            const url = 'https://example.com/path?foo=bar&baz=qux'
            expect(redactSensitiveUrl(url)).toBe(url)
        })

        test('is a no-op for plain strings without "="', () => {
            expect(redactSensitiveUrl('not a url')).toBe('not a url')
        })

        test('matches case-insensitively', () => {
            expect(
                redactSensitiveUrl('foo://x?MNEMONIC=word1+word2'),
            ).toContain('[REDACTED]')
        })

        test('redacts the exact `key` param (WC v1 symmetric handshake key) but preserves key-suffixed params', () => {
            const out = redactSensitiveUrl(
                'wc:topic@1?bridge=https://bridge.example&key=deadbeef&keyregType=online',
            )
            expect(out).toContain('key=[REDACTED]')
            expect(out).toContain('bridge=https://bridge.example')
            expect(out).toContain('keyregType=online')
        })

        test('redacts exact `txn`/`stxn` query params but preserves `txnGroup`', () => {
            const out = redactSensitiveUrl(
                'foo://x?txn=AAID&stxn=BBIE&txnGroup=g1',
            )
            expect(out).toContain('txn=[REDACTED]')
            expect(out).toContain('stxn=[REDACTED]')
            expect(out).toContain('txnGroup=g1')
        })

        test('redacts JSON-embedded sensitive values', () => {
            // The Pera Web QR deeplink is a raw JSON string, not a URL.
            // Without JSON-aware redaction the 32-byte cipher key would
            // pass through to the crash reporter on a deeplink failure.
            const json =
                '{"backupId":"abc","encryptionKey":"AAECAwQFBgcICQ==","version":1}'
            const out = redactSensitiveUrl(json)
            expect(out).not.toContain('AAECAwQFBgcICQ==')
            expect(out).toContain('"encryptionKey":"[REDACTED]"')
            expect(out).toContain('"backupId":"abc"')
        })

        test('redacts JSON values for any sensitive fragment', () => {
            const json =
                '{"mnemonic":"a b c","privateKey":"deadbeef","safe":"ok"}'
            const out = redactSensitiveUrl(json)
            expect(out).toContain('"mnemonic":"[REDACTED]"')
            expect(out).toContain('"privateKey":"[REDACTED]"')
            expect(out).toContain('"safe":"ok"')
        })
    })

    describe('redactSensitiveContext', () => {
        test('redacts sensitive top-level keys', () => {
            const out = redactSensitiveContext({
                mnemonic: 'a b c',
                privateKey: 'deadbeef',
                user: 'will',
            })
            expect(out.mnemonic).toBe('[REDACTED]')
            expect(out.privateKey).toBe('[REDACTED]')
            expect(out.user).toBe('will')
        })

        test('redacts sensitive keys in nested objects', () => {
            const out = redactSensitiveContext({
                payload: {
                    mnemonic: 'a b c',
                    type: 'RECOVER_ADDRESS',
                },
            }) as { payload: { mnemonic: string; type: string } }
            expect(out.payload.mnemonic).toBe('[REDACTED]')
            expect(out.payload.type).toBe('RECOVER_ADDRESS')
        })

        test('redacts WalletConnect transaction blobs (txn) but keeps signer addresses', () => {
            const out = redactSensitiveContext({
                payload: {
                    params: [{ txn: 'AAIDAAEAAQAABQ==', signers: ['ADDR1'] }],
                },
            }) as {
                payload: { params: Array<{ txn: string; signers: string[] }> }
            }
            expect(out.payload.params[0].txn).toBe('[REDACTED]')
            expect(out.payload.params[0].signers).toEqual(['ADDR1'])
        })

        test('only the exact `txn` key is redacted — txnGroup/txns/txnBytes are preserved', () => {
            const out = redactSensitiveContext({
                txn: 'AAIDAAEAAQAABQ==',
                txnGroup: 'group-id-1',
                txns: ['t1', 't2'],
                txnBytes: 1234,
            }) as {
                txn: string
                txnGroup: string
                txns: string[]
                txnBytes: number
            }
            expect(out.txn).toBe('[REDACTED]')
            expect(out.txnGroup).toBe('group-id-1')
            expect(out.txns).toEqual(['t1', 't2'])
            expect(out.txnBytes).toBe(1234)
        })

        test('redacts other raw transaction-payload keys (stxn, signed/raw/unsigned txn) but keeps diagnostic txn* fields', () => {
            const out = redactSensitiveContext({
                stxn: 'gqNzaWfEQ==',
                signedTxns: ['blob1', 'blob2'],
                rawTxns: ['raw1'],
                unsignedTxn: 'unsigned-blob',
                // diagnostic siblings must survive
                txnGroup: 'group-id-1',
                txns: ['t1', 't2'],
                txnBytes: 1234,
            }) as Record<string, unknown>

            expect(out.stxn).toBe('[REDACTED]')
            expect(out.signedTxns).toBe('[REDACTED]')
            expect(out.rawTxns).toBe('[REDACTED]')
            expect(out.unsignedTxn).toBe('[REDACTED]')
            expect(out.txnGroup).toBe('group-id-1')
            expect(out.txns).toEqual(['t1', 't2'])
            expect(out.txnBytes).toBe(1234)
        })

        test('redacts algo_signData message (data) and auth challenge but keeps the signer', () => {
            const out = redactSensitiveContext({
                payload: {
                    params: [
                        {
                            data: 'eyJ0ZXN0IjoxfQ==',
                            authenticatorData: 'AAAA',
                            signer: 'ADDR1',
                        },
                    ],
                },
            }) as {
                payload: {
                    params: Array<{
                        data: string
                        authenticatorData: string
                        signer: string
                    }>
                }
            }
            const item = out.payload.params[0]
            expect(item.data).toBe('[REDACTED]')
            expect(item.authenticatorData).toBe('[REDACTED]')
            expect(item.signer).toBe('ADDR1')
        })

        test('preserves a plain `data` field when there is no authenticatorData sibling', () => {
            const out = redactSensitiveContext({
                data: { items: [1, 2, 3] },
                count: 3,
            }) as { data: { items: number[] }; count: number }
            expect(out.data).toEqual({ items: [1, 2, 3] })
            expect(out.count).toBe(3)
        })

        test('redacts a stringified `txn` field but preserves `txnGroup` in JSON strings', () => {
            const out = redactSensitiveContext({
                raw: '{"txn":"AAID","txnGroup":"g1"}',
            }) as { raw: string }
            expect(out.raw).toContain('"txn":"[REDACTED]"')
            expect(out.raw).toContain('"txnGroup":"g1"')
        })

        test('redacts URL strings in non-sensitive keys', () => {
            const out = redactSensitiveContext({
                url: 'perawallet://app/recover-address/?mnemonic=word1+word2',
            })
            expect(out.url).toBe(
                'perawallet://app/recover-address/?mnemonic=[REDACTED]',
            )
        })

        test('preserves Error instances verbatim', () => {
            const err = new TypeError('boom')
            const out = redactSensitiveContext({ error: err })
            expect(out.error).toBe(err)
        })

        test('truncates objects deeper than the recursion limit', () => {
            // 12 levels deep — beyond MAX_REDACT_DEPTH (8)
            let nested: Record<string, unknown> = { leaf: 'value' }
            for (let i = 0; i < 12; i++) nested = { wrap: nested }

            const out = redactSensitiveContext({ root: nested }) as Record<
                string,
                unknown
            >
            // Walk down — at some point we hit the truncation marker.
            const json = JSON.stringify(out)
            expect(json).toContain('[…]')
        })

        test('handles circular references without throwing', () => {
            const a: Record<string, unknown> = {}
            a.self = a
            expect(() => redactSensitiveContext({ a })).not.toThrow()
        })

        test('redacts encryptionKey (Pera Web QR cipher key)', () => {
            const out = redactSensitiveContext({
                parsedData: {
                    type: 'PERA_WEB_IMPORT',
                    backupId: 'abc',
                    encryptionKey: new Uint8Array(32).fill(7),
                },
            }) as {
                parsedData: {
                    type: string
                    backupId: string
                    encryptionKey: string
                }
            }
            expect(out.parsedData.encryptionKey).toBe('[REDACTED]')
            expect(out.parsedData.backupId).toBe('abc')
            expect(out.parsedData.type).toBe('PERA_WEB_IMPORT')
        })
    })
})
