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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useCreateMultisigScreen } from '../screens/CreateMultisigScreen/useCreateMultisigScreen'
import { useSetThresholdScreen } from '../screens/SetThresholdScreen/useSetThresholdScreen'
import { useNameMultisigScreen } from '../screens/NameMultisigScreen/useNameMultisigScreen'
import { useMultisigCreationStore } from '../hooks/useMultisigCreation'

const mockPush = vi.fn()
const mockMutateAsync = vi.fn()
const mockSetAccounts = vi.fn()
const mockSetSelectedAccountAddress = vi.fn()
const mockSetShouldPlayConfetti = vi.fn()
const mockExitAccountFlow = vi.fn()
const mockErrorToast = vi.fn()
const mockGenerateMultisigAddress = vi.fn(
    (_version: number, _threshold: number, _addresses: string[]) =>
        'NEW_MULTISIG_ADDR',
)
const mockUseAllAccounts = vi.fn((): WalletAccount[] => [])

const mockNavigation = {
    addListener: vi.fn(() => vi.fn()),
    setOptions: vi.fn(),
}

vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<object>('@react-navigation/native')
    return {
        ...actual,
        useNavigation: () => mockNavigation,
    }
})

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        push: mockPush,
        goBack: vi.fn(),
    }),
}))

vi.mock('@hooks/useModalState', () => {
    let isOpen = false
    return {
        useModalState: () => ({
            get isOpen() {
                return isOpen
            },
            open: vi.fn(() => {
                isOpen = true
            }),
            close: vi.fn(() => {
                isOpen = false
            }),
        }),
    }
})

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useAllAccounts: () => mockUseAllAccounts(),
        useSelectedAccountAddress: () => ({
            selectedAccountAddress: null,
            setSelectedAccountAddress: mockSetSelectedAccountAddress,
        }),
        useAccountsStore: (selector: (state: unknown) => unknown) =>
            selector({ setAccounts: mockSetAccounts }),
    }
})

vi.mock('@perawallet/wallet-core-multisig', () => ({
    useCreateMultisigAccountMutation: () => ({
        mutateAsync: mockMutateAsync,
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-blockchain',
    )
    return {
        ...actual,
        generateMultisigAddress: (v: number, t: number, addrs: string[]) =>
            mockGenerateMultisigAddress(v, t, addrs),
        useNetwork: () => ({ network: 'mainnet' }),
    }
})

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: () => 'device-id',
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        errorToast: mockErrorToast,
        showToast: vi.fn(),
    }),
}))

vi.mock('@modules/onboarding/hooks', () => ({
    useShouldPlayConfetti: () => ({
        shouldPlayConfetti: false,
        setShouldPlayConfetti: mockSetShouldPlayConfetti,
    }),
    useExitAccountFlow: () => ({
        exitAccountFlow: mockExitAccountFlow,
    }),
}))

vi.mock('react-i18next', async () => {
    const actual = await vi.importActual<object>('react-i18next')
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string) => {
                if (key === 'multisig.name.default_name')
                    return 'Shared Account'
                return key
            },
            i18n: { changeLanguage: vi.fn(), language: 'en' },
        }),
    }
})

describe('multisig creation flow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal(
            'requestAnimationFrame',
            (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown,
        )
        mockUseAllAccounts.mockReturnValue([])
        mockMutateAsync.mockResolvedValue(undefined)
        mockGenerateMultisigAddress.mockReturnValue('NEW_MULTISIG_ADDR')
        useMultisigCreationStore.getState().resetState()
    })

    it('happy path: 2 participants → default threshold 2 → finish creates multisig', async () => {
        const createHook = renderHook(() => useCreateMultisigScreen())

        act(() => {
            createHook.result.current.handleAddAddress('ADDR_A')
        })
        act(() => {
            createHook.result.current.handleAddAddress('ADDR_B')
        })

        expect(createHook.result.current.canContinue).toBe(true)
        expect(createHook.result.current.participants).toHaveLength(2)

        act(() => {
            createHook.result.current.handleContinue()
        })
        expect(mockPush).toHaveBeenCalledWith('SetThreshold')

        const thresholdHook = renderHook(() => useSetThresholdScreen())

        expect(thresholdHook.result.current.threshold).toBe(2)
        expect(thresholdHook.result.current.participantCount).toBe(2)
        expect(thresholdHook.result.current.participants).toHaveLength(2)

        act(() => {
            thresholdHook.result.current.handleContinue()
        })

        act(() => {
            thresholdHook.result.current.handleProceed()
        })
        expect(mockPush).toHaveBeenCalledWith('NameMultisig')

        const nameHook = renderHook(() => useNameMultisigScreen())
        expect(nameHook.result.current.accountName).toBe('Shared Account')

        await act(async () => {
            await nameHook.result.current.handleFinish()
        })

        expect(mockMutateAsync).toHaveBeenCalledWith({
            version: 1,
            threshold: 2,
            participant_addresses: ['ADDR_A', 'ADDR_B'],
            device_id: 'device-id',
        })
        expect(mockGenerateMultisigAddress).toHaveBeenCalledWith(1, 2, [
            'ADDR_A',
            'ADDR_B',
        ])
        expect(mockSetAccounts).toHaveBeenCalledWith([
            expect.objectContaining({
                type: 'multisig',
                address: 'NEW_MULTISIG_ADDR',
                name: 'Shared Account',
                multisigDetails: {
                    threshold: 2,
                    addresses: ['ADDR_A', 'ADDR_B'],
                },
            }),
        ])
        expect(mockSetSelectedAccountAddress).toHaveBeenCalledWith(
            'NEW_MULTISIG_ADDR',
        )
        expect(mockSetShouldPlayConfetti).toHaveBeenCalledWith(true)
        expect(mockExitAccountFlow).toHaveBeenCalled()

        expect(useMultisigCreationStore.getState().participants).toEqual([])
        expect(useMultisigCreationStore.getState().threshold).toBe(2)
    })

    it('blocks finish when account name collides with existing account', async () => {
        mockUseAllAccounts.mockReturnValue([
            { address: 'EXISTING', name: 'Shared Account' } as WalletAccount,
        ])

        const createHook = renderHook(() => useCreateMultisigScreen())
        act(() => {
            createHook.result.current.handleAddAddress('ADDR_A')
        })
        act(() => {
            createHook.result.current.handleAddAddress('ADDR_B')
        })

        const nameHook = renderHook(() => useNameMultisigScreen())

        expect(nameHook.result.current.isNameTaken).toBe(true)
        expect(nameHook.result.current.isFinishDisabled).toBe(true)

        act(() => {
            nameHook.result.current.handleNameChange('My Shared Wallet')
        })

        expect(nameHook.result.current.isNameTaken).toBe(false)
        expect(nameHook.result.current.isFinishDisabled).toBe(false)
    })

    it('threshold increments/decrements stay within participant bounds', () => {
        const createHook = renderHook(() => useCreateMultisigScreen())
        act(() => {
            createHook.result.current.handleAddAddress('ADDR_A')
        })
        act(() => {
            createHook.result.current.handleAddAddress('ADDR_B')
        })
        act(() => {
            createHook.result.current.handleAddAddress('ADDR_C')
        })

        const thresholdHook = renderHook(() => useSetThresholdScreen())

        expect(thresholdHook.result.current.threshold).toBe(2)

        act(() => {
            thresholdHook.result.current.handleIncrement()
        })
        expect(thresholdHook.result.current.threshold).toBe(3)

        act(() => {
            thresholdHook.result.current.handleIncrement()
        })
        expect(thresholdHook.result.current.threshold).toBe(3)

        act(() => {
            thresholdHook.result.current.handleDecrement()
        })
        act(() => {
            thresholdHook.result.current.handleDecrement()
        })
        act(() => {
            thresholdHook.result.current.handleDecrement()
        })
        expect(thresholdHook.result.current.threshold).toBe(1)
    })
})
