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

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from '@perawallet/wallet-core-shared'
import { VaultEvent } from '@analytics'

const mocks = vi.hoisted(() => {
    class MockInvalidPasswordError extends Error {
        constructor() {
            super('Invalid password.')
            this.name = 'InvalidPasswordError'
        }
    }
    class MockPasskeyPrfUnsupportedError extends Error {
        constructor() {
            super('PRF extension not supported.')
            this.name = 'PasskeyPrfUnsupportedError'
        }
    }
    class MockVaultReauthRequiredError extends Error {
        constructor() {
            super('A password must be proven again.')
            this.name = 'VaultReauthRequiredError'
        }
    }
    class MockVaultLockedError extends Error {
        constructor() {
            super('Vault is locked.')
            this.name = 'VaultLockedError'
        }
    }
    class MockVaultLockedOutError extends Error {
        constructor() {
            super('Vault unlock is temporarily locked out')
            this.name = 'VaultLockedOutError'
        }
    }
    return {
        enablePasskeyUnlockWithSession: vi.fn(),
        enablePasskeyUnlock: vi.fn(),
        requireVaultPassword: vi.fn(),
        trackEvent: vi.fn(),
        showToast: vi.fn(),
        MockInvalidPasswordError,
        MockPasskeyPrfUnsupportedError,
        MockVaultReauthRequiredError,
        MockVaultLockedError,
        MockVaultLockedOutError,
    }
})

vi.mock('@perawallet/wallet-extension-keystore-chrome', () => ({
    enablePasskeyUnlockWithSession: mocks.enablePasskeyUnlockWithSession,
    enablePasskeyUnlock: mocks.enablePasskeyUnlock,
    InvalidPasswordError: mocks.MockInvalidPasswordError,
    PasskeyPrfUnsupportedError: mocks.MockPasskeyPrfUnsupportedError,
    VaultReauthRequiredError: mocks.MockVaultReauthRequiredError,
    VaultLockedError: mocks.MockVaultLockedError,
}))
vi.mock('@analytics', async importOriginal => ({
    ...(await importOriginal<typeof import('@analytics')>()),
    trackEvent: mocks.trackEvent,
}))
vi.mock('@hooks/useLanguage')
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mocks.showToast }),
}))
vi.mock('../../../hooks/useRequireVaultPassword', () => ({
    useRequireVaultPassword: () => ({
        requireVaultPassword: mocks.requireVaultPassword,
    }),
}))

import {
    toPasskeySetupFailure,
    usePasskeyUnlockSetup,
    type UsePasskeyUnlockSetupParams,
} from '../usePasskeyUnlockSetup.web'

const renderSetup = (params: Partial<UsePasskeyUnlockSetupParams> = {}) =>
    renderHook(() => usePasskeyUnlockSetup({ screen: 'onboarding', ...params }))

const failEvents = () =>
    mocks.trackEvent.mock.calls.filter(
        ([event]) => event === VaultEvent.PasskeyEnableFail,
    )

describe('toPasskeySetupFailure', () => {
    it.each([
        [new DOMException('closed', 'NotAllowedError'), 'not-saved'],
        [new DOMException('no resident key', 'NotSupportedError'), 'not-saved'],
        [new DOMException('no uv', 'ConstraintError'), 'not-saved'],
        [new mocks.MockPasskeyPrfUnsupportedError(), 'prf-unsupported'],
        [new DOMException('excluded', 'InvalidStateError'), 'unexpected'],
        [new DOMException('origin', 'SecurityError'), 'unexpected'],
        [new Error('storage write failed'), 'unexpected'],
        ['not even an error', 'unexpected'],
    ])('maps %s to %s', (error, expected) => {
        expect(toPasskeySetupFailure(error)).toBe(expected)
    })
})

describe('usePasskeyUnlockSetup', () => {
    let warn: ReturnType<typeof vi.spyOn>
    let error: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        mocks.enablePasskeyUnlockWithSession.mockResolvedValue(undefined)
        mocks.enablePasskeyUnlock.mockResolvedValue(undefined)
        mocks.requireVaultPassword.mockResolvedValue(true)
        warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
        error = vi.spyOn(logger, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        warn.mockRestore()
        error.mockRestore()
    })

    describe('enableWithSession', () => {
        it('is pending while the ceremony runs and refuses a second call', async () => {
            let resolve: () => void = () => {}
            mocks.enablePasskeyUnlockWithSession.mockReturnValueOnce(
                new Promise<void>(r => {
                    resolve = r
                }),
            )
            const { result } = renderSetup()

            let first: Promise<void> = Promise.resolve()
            act(() => {
                first = result.current.enableWithSession()
            })
            expect(result.current.status).toBe('pending')
            await act(() => result.current.enableWithSession())
            expect(mocks.enablePasskeyUnlockWithSession).toHaveBeenCalledTimes(
                1,
            )

            resolve()
            await act(() => first)
            expect(result.current.status).toBe('enabled')
        })

        it('reaches enabled, tracks success and calls onEnabled when the blob is written', async () => {
            const onEnabled = vi.fn()
            const { result } = renderSetup({ onEnabled })

            await act(() => result.current.enableWithSession())

            expect(result.current.status).toBe('enabled')
            expect(onEnabled).toHaveBeenCalledTimes(1)
            expect(mocks.trackEvent).toHaveBeenCalledWith(
                VaultEvent.PasskeyEnableSuccess,
                { screen: 'onboarding' },
            )
        })

        it('lands in not-saved on NotAllowedError, never enabled, and logs name and message at warn', async () => {
            mocks.enablePasskeyUnlockWithSession.mockRejectedValueOnce(
                new DOMException('closed', 'NotAllowedError'),
            )
            const onEnabled = vi.fn()
            const { result } = renderSetup({ onEnabled })

            await act(() => result.current.enableWithSession())

            expect(result.current.status).toBe('not-saved')
            expect(onEnabled).not.toHaveBeenCalled()
            expect(warn).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    name: 'NotAllowedError',
                    message: 'closed',
                    status: 'not-saved',
                }),
            )
            expect(mocks.trackEvent).toHaveBeenCalledWith(
                VaultEvent.PasskeyEnableFail,
                {
                    screen: 'onboarding',
                    error_root_cause: 'not-saved:NotAllowedError',
                },
            )
        })

        it('lands in prf-unsupported on PasskeyPrfUnsupportedError', async () => {
            mocks.enablePasskeyUnlockWithSession.mockRejectedValueOnce(
                new mocks.MockPasskeyPrfUnsupportedError(),
            )
            const { result } = renderSetup()

            await act(() => result.current.enableWithSession())

            expect(result.current.status).toBe('prf-unsupported')
            expect(mocks.trackEvent).toHaveBeenCalledWith(
                VaultEvent.PasskeyEnableFail,
                {
                    screen: 'onboarding',
                    error_root_cause:
                        'prf-unsupported:PasskeyPrfUnsupportedError',
                },
            )
        })

        it('lands in unexpected on anything else and also logs the error object at error level', async () => {
            mocks.enablePasskeyUnlockWithSession.mockRejectedValueOnce(
                new Error('boom'),
            )
            const { result } = renderSetup()

            await act(() => result.current.enableWithSession())

            expect(result.current.status).toBe('unexpected')
            expect(error).toHaveBeenCalled()
            expect(mocks.trackEvent).toHaveBeenCalledWith(
                VaultEvent.PasskeyEnableFail,
                { screen: 'onboarding', error_root_cause: 'unexpected:Error' },
            )
        })

        it('re-asks for the password when the window lapsed, then retries', async () => {
            mocks.enablePasskeyUnlockWithSession.mockRejectedValueOnce(
                new mocks.MockVaultReauthRequiredError(),
            )
            const { result } = renderSetup()

            await act(() => result.current.enableWithSession())

            expect(mocks.requireVaultPassword).toHaveBeenCalledWith(
                'vault.passkey_setup.reauth_description',
            )
            expect(mocks.enablePasskeyUnlockWithSession).toHaveBeenCalledTimes(
                2,
            )
            expect(result.current.status).toBe('enabled')
        })

        it('returns to idle, with no failure event, when the password sheet is dismissed', async () => {
            mocks.enablePasskeyUnlockWithSession.mockRejectedValueOnce(
                new mocks.MockVaultReauthRequiredError(),
            )
            mocks.requireVaultPassword.mockResolvedValueOnce(false)
            const { result } = renderSetup()

            await act(() => result.current.enableWithSession())

            expect(mocks.enablePasskeyUnlockWithSession).toHaveBeenCalledTimes(
                1,
            )
            expect(result.current.status).toBe('idle')
            expect(failEvents()).toEqual([])
        })

        it('reports the outcome in place, with no toast, when the surface stays open', async () => {
            mocks.enablePasskeyUnlockWithSession.mockRejectedValueOnce(
                new mocks.MockVaultReauthRequiredError(),
            )
            const { result } = renderSetup()

            await act(() => result.current.enableWithSession())

            expect(result.current.status).toBe('enabled')
            expect(mocks.showToast).not.toHaveBeenCalled()
        })

        describe('when the surface closes itself for the password sheet', () => {
            beforeEach(() => {
                mocks.enablePasskeyUnlockWithSession.mockRejectedValueOnce(
                    new mocks.MockVaultReauthRequiredError(),
                )
            })

            it('closes the surface before asking for the password, then retries', async () => {
                const order: string[] = []
                const onBeforeReauth = vi.fn(() => {
                    order.push('close')
                })
                mocks.requireVaultPassword.mockImplementationOnce(async () => {
                    order.push('password')
                    return true
                })
                const { result } = renderSetup({ onBeforeReauth })

                await act(() => result.current.enableWithSession())

                expect(order).toEqual(['close', 'password'])
                expect(
                    mocks.enablePasskeyUnlockWithSession,
                ).toHaveBeenCalledTimes(2)
            })

            it('reports success in a toast', async () => {
                const { result } = renderSetup({ onBeforeReauth: vi.fn() })

                await act(() => result.current.enableWithSession())

                expect(mocks.showToast).toHaveBeenCalledWith({
                    title: 'vault.passkey_setup.success_title',
                    body: 'vault.passkey_setup.success_body',
                    type: 'success',
                })
            })

            it('reports a failed retry in a toast with its hint', async () => {
                mocks.enablePasskeyUnlockWithSession.mockRejectedValueOnce(
                    new DOMException('closed', 'NotAllowedError'),
                )
                const { result } = renderSetup({ onBeforeReauth: vi.fn() })

                await act(() => result.current.enableWithSession())

                expect(mocks.showToast).toHaveBeenCalledWith({
                    title: 'vault.passkey_setup.error_not_saved',
                    body: 'vault.passkey_setup.hint_not_saved_body',
                    type: 'error',
                })
                expect(failEvents()).toHaveLength(1)
            })

            it('shows no toast when the password sheet is dismissed', async () => {
                mocks.requireVaultPassword.mockResolvedValueOnce(false)
                const { result } = renderSetup({ onBeforeReauth: vi.fn() })

                await act(() => result.current.enableWithSession())

                expect(mocks.showToast).not.toHaveBeenCalled()
                expect(failEvents()).toEqual([])
            })
        })

        it('returns to idle without a sheet or a failure event when the vault is locked', async () => {
            mocks.enablePasskeyUnlockWithSession.mockRejectedValueOnce(
                new mocks.MockVaultLockedError(),
            )
            const { result } = renderSetup()

            await act(() => result.current.enableWithSession())

            expect(result.current.status).toBe('idle')
            expect(mocks.requireVaultPassword).not.toHaveBeenCalled()
            expect(failEvents()).toEqual([])
        })

        it('retries from a failure state', async () => {
            mocks.enablePasskeyUnlockWithSession.mockRejectedValueOnce(
                new DOMException('closed', 'NotAllowedError'),
            )
            const { result } = renderSetup()

            await act(() => result.current.enableWithSession())
            expect(result.current.status).toBe('not-saved')

            await act(() => result.current.enableWithSession())
            expect(result.current.status).toBe('enabled')
        })
    })

    describe('enableWithPassword', () => {
        it('passes the password to the keystore and reaches enabled', async () => {
            const { result } = renderSetup({ screen: 'settings' })

            await act(() => result.current.enableWithPassword('pw'))

            expect(mocks.enablePasskeyUnlock).toHaveBeenCalledWith('pw')
            expect(result.current.status).toBe('enabled')
        })

        it('rethrows InvalidPasswordError and returns to idle without a failure event', async () => {
            mocks.enablePasskeyUnlock.mockRejectedValueOnce(
                new mocks.MockInvalidPasswordError(),
            )
            const { result } = renderSetup({ screen: 'settings' })

            await expect(
                act(() => result.current.enableWithPassword('x')),
            ).rejects.toBeInstanceOf(mocks.MockInvalidPasswordError)

            expect(result.current.status).toBe('idle')
            expect(failEvents()).toEqual([])
        })

        it('maps NotAllowedError to not-saved like the session path', async () => {
            mocks.enablePasskeyUnlock.mockRejectedValueOnce(
                new DOMException('closed', 'NotAllowedError'),
            )
            const { result } = renderSetup({ screen: 'settings' })

            await act(() => result.current.enableWithPassword('pw'))

            expect(result.current.status).toBe('not-saved')
        })

        it('maps a lockout to unexpected', async () => {
            mocks.enablePasskeyUnlock.mockRejectedValueOnce(
                new mocks.MockVaultLockedOutError(),
            )
            const { result } = renderSetup({ screen: 'settings' })

            await act(() => result.current.enableWithPassword('pw'))

            expect(result.current.status).toBe('unexpected')
        })
    })

    describe('analytics', () => {
        it.each(['onboarding', 'prompt'] as const)(
            'tracks the offer view once on mount for %s',
            screen => {
                const { rerender } = renderSetup({ screen })
                rerender()

                expect(mocks.trackEvent).toHaveBeenCalledTimes(1)
                expect(mocks.trackEvent).toHaveBeenCalledWith(
                    VaultEvent.PasskeyOfferView,
                    { screen },
                )
            },
        )

        it('does not track an offer view for settings', () => {
            renderSetup({ screen: 'settings' })

            expect(mocks.trackEvent).not.toHaveBeenCalled()
        })

        it('recordSkip tracks the skip with the screen', () => {
            const { result } = renderSetup({ screen: 'prompt' })

            act(() => result.current.recordSkip())

            expect(mocks.trackEvent).toHaveBeenCalledWith(
                VaultEvent.PasskeyOfferSkip,
                { screen: 'prompt' },
            )
        })
    })
})
