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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { CardStatus, FundingType, OnboardingStep } from '../../models'

const registerStoreMock = vi.fn()
vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return { ...original, registerStore: registerStoreMock }
})

describe('useCardStore', () => {
    beforeEach(async () => {
        const { useCardStore } = await import('../ux-store')
        useCardStore.getState().resetState()
    })

    test('setOnboardingStep updates the onboarding cursor', async () => {
        const { useCardStore } = await import('../ux-store')
        const { result } = renderHook(() => useCardStore())

        act(() => result.current.setOnboardingStep(OnboardingStep.Address))

        expect(result.current.onboardingStep).toBe(OnboardingStep.Address)
    })

    test('stores the onboarding contact inputs', async () => {
        const { useCardStore } = await import('../ux-store')
        const { result } = renderHook(() => useCardStore())

        act(() => {
            result.current.setEmail('john@example.com')
            result.current.setCountryIso('GB')
            result.current.setVerificationCode('PERA123')
        })

        expect(result.current.email).toBe('john@example.com')
        expect(result.current.countryIso).toBe('GB')
        expect(result.current.verificationCode).toBe('PERA123')
    })

    test('setPhone stores the phone inputs', async () => {
        const { useCardStore } = await import('../ux-store')
        const { result } = renderHook(() => useCardStore())

        act(() =>
            result.current.setPhone({
                phoneCountryCode: '44',
                phoneNumber: '7400846282',
            }),
        )

        expect(result.current.phoneCountryCode).toBe('44')
        expect(result.current.phoneNumber).toBe('7400846282')
    })

    test('the verification codes are transient — never persisted', async () => {
        const { useCardStore } = await import('../ux-store')
        const { result } = renderHook(() => useCardStore())

        act(() => {
            result.current.setVerificationCode('123456')
            result.current.setPhoneVerificationCode('654321')
        })

        expect(result.current.verificationCode).toBe('123456')
        expect(result.current.phoneVerificationCode).toBe('654321')
        // The persisted snapshot must exclude both OTPs.
        const persisted = (
            useCardStore as unknown as {
                persist: {
                    getOptions: () => {
                        partialize?: (state: unknown) => Record<string, unknown>
                    }
                }
            }
        ).persist
            .getOptions()
            .partialize?.(useCardStore.getState())
        expect(persisted).not.toHaveProperty('verificationCode')
        expect(persisted).not.toHaveProperty('phoneVerificationCode')
    })

    test('setCodeVerificationError is transient and clears on reset', async () => {
        const { useCardStore } = await import('../ux-store')
        const { result } = renderHook(() => useCardStore())

        act(() => result.current.setCodeVerificationError('phone'))
        expect(result.current.codeVerificationError).toBe('phone')

        // It's a transient UI signal — excluded from the persisted snapshot.
        const persisted = (
            useCardStore as unknown as {
                persist: {
                    getOptions: () => {
                        partialize?: (state: unknown) => Record<string, unknown>
                    }
                }
            }
        ).persist
            .getOptions()
            .partialize?.(useCardStore.getState())
        expect(persisted).not.toHaveProperty('codeVerificationError')

        act(() => result.current.resetOnboardingProgress())
        expect(result.current.codeVerificationError).toBeNull()
    })

    test('email and phone KYC PII are never persisted', async () => {
        const { useCardStore } = await import('../ux-store')
        const { result } = renderHook(() => useCardStore())

        act(() => {
            result.current.setEmail('john@example.com')
            result.current.setPhone({
                phoneCountryCode: '44',
                phoneNumber: '7400846282',
            })
        })

        expect(result.current.email).toBe('john@example.com')
        expect(result.current.phoneNumber).toBe('7400846282')

        const persisted = (
            useCardStore as unknown as {
                persist: {
                    getOptions: () => {
                        partialize?: (state: unknown) => Record<string, unknown>
                    }
                }
            }
        ).persist
            .getOptions()
            .partialize?.(useCardStore.getState())
        expect(persisted).not.toHaveProperty('email')
        expect(persisted).not.toHaveProperty('phoneCountryCode')
        expect(persisted).not.toHaveProperty('phoneNumber')
    })

    test('migration strips KYC PII left on disk by earlier builds, preserving non-PII fields', async () => {
        const { useCardStore } = await import('../ux-store')

        const migratedState = (
            useCardStore as unknown as {
                persist: {
                    getOptions: () => {
                        migrate?: (state: unknown) => Record<string, unknown>
                    }
                }
            }
        ).persist
            .getOptions()
            .migrate?.({
                onboardingId: 'ob-1',
                email: 'john@example.com',
                phoneCountryCode: '44',
                phoneNumber: '7400846282',
            })

        expect(migratedState).not.toHaveProperty('email')
        expect(migratedState).not.toHaveProperty('phoneCountryCode')
        expect(migratedState).not.toHaveProperty('phoneNumber')
        expect(migratedState).toMatchObject({ onboardingId: 'ob-1' })
    })

    test('resetState clears the onboarding contact inputs', async () => {
        const { useCardStore } = await import('../ux-store')
        const { result } = renderHook(() => useCardStore())

        act(() => {
            result.current.setEmail('john@example.com')
            result.current.setCountryIso('GB')
            result.current.setVerificationCode('PERA123')
            result.current.setPhone({
                phoneCountryCode: '44',
                phoneNumber: '7400846282',
            })
        })
        act(() => result.current.resetState())

        expect(result.current.email).toBeNull()
        expect(result.current.countryIso).toBeNull()
        expect(result.current.verificationCode).toBeNull()
        expect(result.current.phoneCountryCode).toBeNull()
        expect(result.current.phoneNumber).toBeNull()
    })

    test('setAllowMarketing updates the consent flag (defaults to opted-in)', async () => {
        const { useCardStore } = await import('../ux-store')
        const { result } = renderHook(() => useCardStore())

        expect(result.current.allowMarketing).toBe(true)

        act(() => result.current.setAllowMarketing(false))

        expect(result.current.allowMarketing).toBe(false)
    })

    test('setSelectedFundingType stores (and persists) the chosen funding type', async () => {
        const { useCardStore } = await import('../ux-store')
        const { result } = renderHook(() => useCardStore())

        expect(result.current.selectedFundingType).toBeNull()

        act(() => result.current.setSelectedFundingType(FundingType.Manual))

        expect(result.current.selectedFundingType).toBe(FundingType.Manual)
        // Persisted so the later card-creation step can read it on a cold resume.
        const persisted = (
            useCardStore as unknown as {
                persist: {
                    getOptions: () => {
                        partialize?: (state: unknown) => Record<string, unknown>
                    }
                }
            }
        ).persist
            .getOptions()
            .partialize?.(useCardStore.getState())
        expect(persisted?.selectedFundingType).toBe(FundingType.Manual)
    })

    test('setCardSnapshot stores the non-sensitive card hint', async () => {
        const { useCardStore } = await import('../ux-store')
        const { result } = renderHook(() => useCardStore())

        act(() =>
            result.current.setCardSnapshot({
                cardId: 'card_1',
                status: CardStatus.Active,
                panLast4: '1234',
            }),
        )

        expect(result.current.cardId).toBe('card_1')
        expect(result.current.lastKnownStatus).toBe(CardStatus.Active)
        expect(result.current.lastKnownPanLast4).toBe('1234')
    })

    test('resetState restores the initial defaults', async () => {
        const { useCardStore } = await import('../ux-store')
        const { result } = renderHook(() => useCardStore())

        act(() => {
            result.current.setOnboardingStep(OnboardingStep.Address)
            result.current.setTransactionFilters({ searchKey: 'coffee' })
        })
        act(() => result.current.resetState())

        expect(result.current.onboardingStep).toBe(OnboardingStep.EmailSend)
        expect(result.current.transactionFilters).toEqual({})
        expect(result.current.cardId).toBeNull()
    })

    test('resetOnboardingProgress clears onboarding fields but keeps card snapshot/filters', async () => {
        const { useCardStore } = await import('../ux-store')
        const { result } = renderHook(() => useCardStore())

        act(() => {
            result.current.setOnboardingStep(OnboardingStep.Completed)
            result.current.setEmail('john@example.com')
            result.current.setOnboardingId('onb_1')
            result.current.setConsentSetId('cs_1')
            result.current.setConnectedFundingSourceAddress('ADDR1')
            result.current.setSelectedFundingType(FundingType.Auto)
            result.current.setAllowMarketing(false)
            // Card-snapshot / filters should survive a fresh sign-up.
            result.current.setCardSnapshot({
                cardId: 'card_1',
                status: CardStatus.Active,
                panLast4: '1234',
            })
            result.current.setTransactionFilters({ searchKey: 'coffee' })
        })
        // Persisted so a cross-reload retry can still link the consent set.
        const persisted = (
            useCardStore as unknown as {
                persist: {
                    getOptions: () => {
                        partialize?: (state: unknown) => Record<string, unknown>
                    }
                }
            }
        ).persist
            .getOptions()
            .partialize?.(useCardStore.getState())
        expect(persisted?.consentSetId).toBe('cs_1')

        act(() => result.current.resetOnboardingProgress())

        // Onboarding progress reset → setup checklist re-locks.
        expect(result.current.onboardingStep).toBe(OnboardingStep.EmailSend)
        expect(result.current.email).toBeNull()
        expect(result.current.onboardingId).toBeNull()
        expect(result.current.consentSetId).toBeNull()
        expect(result.current.connectedFundingSourceAddress).toBeNull()
        expect(result.current.selectedFundingType).toBeNull()
        expect(result.current.allowMarketing).toBe(true)
        // Card snapshot / filters preserved.
        expect(result.current.cardId).toBe('card_1')
        expect(result.current.lastKnownStatus).toBe(CardStatus.Active)
        expect(result.current.transactionFilters).toEqual({
            searchKey: 'coffee',
        })
    })

    test('registers clearStorage and resetState under card-store', async () => {
        await import('../ux-store')

        const registration = registerStoreMock.mock.calls.at(-1)?.[0]
        expect(registration?.name).toBe('card-store')
    })
})
