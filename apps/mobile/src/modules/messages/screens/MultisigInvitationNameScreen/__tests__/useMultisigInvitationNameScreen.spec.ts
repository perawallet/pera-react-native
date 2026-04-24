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
import { useMultisigInvitationNameScreen } from '../useMultisigInvitationNameScreen'
import type { MultisigInvitationParam } from '../../../routes/types'

const mockMutateAsync = vi.fn()
const mockSetAccounts = vi.fn()
const mockInvalidate = vi.fn()
const mockErrorToast = vi.fn()
const mockSuccessToast = vi.fn()
const mockPopToTop = vi.fn()
const mockAddListener = vi.fn(
    (_event: string, _listener: (e: { preventDefault: () => void }) => void) =>
        vi.fn(),
)
const mockSetOptions = vi.fn()
const mockUseAllAccounts = vi.fn((): WalletAccount[] => [])
const mockUseDeviceID = vi.fn(() => 'device-id')

const invitation: MultisigInvitationParam = {
    customId: 'invite-1',
    createdAt: '2025-01-15T00:00:00.000Z',
    address: 'MSIG_ADDR',
    version: 1,
    threshold: 2,
    participantAddresses: ['ADDR1', 'ADDR2', 'ADDR3'],
}

const mockNavigation = {
    addListener: mockAddListener,
    setOptions: mockSetOptions,
    popToTop: mockPopToTop,
}

vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<object>('@react-navigation/native')
    return {
        ...actual,
        useNavigation: () => mockNavigation,
        useRoute: () => ({ params: { invitation } }),
    }
})

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useAllAccounts: () => mockUseAllAccounts(),
        useAccountsStore: (selector: (state: unknown) => unknown) =>
            selector({ setAccounts: mockSetAccounts }),
    }
})

vi.mock('@perawallet/wallet-core-multisig', () => ({
    useDeleteImportInboxMutation: () => ({
        mutateAsync: mockMutateAsync,
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-blockchain',
    )
    return {
        ...actual,
        useNetwork: () => ({ network: 'mainnet' }),
    }
})

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: () => mockUseDeviceID(),
}))

vi.mock('@perawallet/wallet-core-messages', () => ({
    useInboxInvalidator: () => ({
        invalidate: mockInvalidate,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        errorToast: mockErrorToast,
        successToast: mockSuccessToast,
        showToast: vi.fn(),
    }),
}))

vi.mock('react-i18next', async () => {
    const actual = await vi.importActual<object>('react-i18next')
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string, opts?: Record<string, unknown>) => {
                if (key === 'multisig.invitation.name.default_name')
                    return 'Shared Account'
                if (opts) return `${key}:${JSON.stringify(opts)}`
                return key
            },
            i18n: { changeLanguage: vi.fn(), language: 'en' },
        }),
    }
})

describe('useMultisigInvitationNameScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAllAccounts.mockReturnValue([])
        mockUseDeviceID.mockReturnValue('device-id')
        mockMutateAsync.mockResolvedValue(undefined)
        mockAddListener.mockReturnValue(vi.fn())
    })

    it('initializes with default name from i18n', () => {
        const { result } = renderHook(() => useMultisigInvitationNameScreen())

        expect(result.current.accountName).toBe('Shared Account')
        expect(result.current.isSaving).toBe(false)
    })

    it('handleNameChange updates the name', () => {
        const { result } = renderHook(() => useMultisigInvitationNameScreen())

        act(() => {
            result.current.handleNameChange('My Shared Wallet')
        })

        expect(result.current.accountName).toBe('My Shared Wallet')
    })

    it('derives isNameTaken when an existing account matches (case-insensitive, trimmed)', () => {
        mockUseAllAccounts.mockReturnValue([
            { address: 'A', name: 'shared account' } as WalletAccount,
        ])

        const { result } = renderHook(() => useMultisigInvitationNameScreen())

        expect(result.current.isNameTaken).toBe(true)
        expect(result.current.nameError).toBe('multisig.name.error_name_taken')
        expect(result.current.isFinishDisabled).toBe(true)
    })

    it('isFinishDisabled is true when name is empty or whitespace', () => {
        const { result } = renderHook(() => useMultisigInvitationNameScreen())

        act(() => {
            result.current.handleNameChange('   ')
        })

        expect(result.current.isFinishDisabled).toBe(true)
    })

    it('handleFinish follows happy path: DELETE, setAccounts, invalidate, success toast, popToTop', async () => {
        const existing = [{ address: 'X', name: 'Other' } as WalletAccount]
        mockUseAllAccounts.mockReturnValue(existing)

        const { result } = renderHook(() => useMultisigInvitationNameScreen())

        await act(async () => {
            await result.current.handleFinish()
        })

        expect(mockMutateAsync).toHaveBeenCalledWith({
            multisigAddress: 'MSIG_ADDR',
        })
        expect(mockSetAccounts).toHaveBeenCalledWith([
            ...existing,
            expect.objectContaining({
                type: 'multisig',
                address: 'MSIG_ADDR',
                name: 'Shared Account',
                multisigDetails: {
                    threshold: 2,
                    addresses: ['ADDR1', 'ADDR2', 'ADDR3'],
                },
            }),
        ])
        expect(mockInvalidate).toHaveBeenCalled()
        expect(mockSuccessToast).toHaveBeenCalled()
        expect(mockPopToTop).toHaveBeenCalled()
    })

    it('handleFinish bails with error toast when account with same address already exists', async () => {
        mockUseAllAccounts.mockReturnValue([
            { address: 'MSIG_ADDR', name: 'Other' } as WalletAccount,
        ])

        const { result } = renderHook(() => useMultisigInvitationNameScreen())

        act(() => {
            result.current.handleNameChange('Unique Name')
        })

        await act(async () => {
            await result.current.handleFinish()
        })

        expect(mockErrorToast).toHaveBeenCalled()
        expect(mockMutateAsync).not.toHaveBeenCalled()
        expect(mockSetAccounts).not.toHaveBeenCalled()
        expect(mockPopToTop).not.toHaveBeenCalled()
    })

    it('handleFinish shows error toast and does not setAccounts when DELETE fails', async () => {
        mockMutateAsync.mockRejectedValue(new Error('network'))

        const { result } = renderHook(() => useMultisigInvitationNameScreen())

        await act(async () => {
            await result.current.handleFinish()
        })

        expect(mockErrorToast).toHaveBeenCalled()
        expect(mockSetAccounts).not.toHaveBeenCalled()
        expect(mockInvalidate).not.toHaveBeenCalled()
        expect(mockPopToTop).not.toHaveBeenCalled()
        expect(result.current.isSaving).toBe(false)
    })

    it('handleFinish shows error toast when deviceId is missing', async () => {
        mockUseDeviceID.mockReturnValue('')

        const { result } = renderHook(() => useMultisigInvitationNameScreen())

        await act(async () => {
            await result.current.handleFinish()
        })

        expect(mockErrorToast).toHaveBeenCalled()
        expect(mockMutateAsync).not.toHaveBeenCalled()
        expect(mockSetAccounts).not.toHaveBeenCalled()
    })

    it('ignores concurrent handleFinish calls while isSaving', async () => {
        let resolveMutation: (value: unknown) => void = () => {}
        mockMutateAsync.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveMutation = resolve
                }),
        )

        const { result } = renderHook(() => useMultisigInvitationNameScreen())

        await act(async () => {
            void result.current.handleFinish()
            await new Promise(resolve => setTimeout(resolve, 0))
        })

        await act(async () => {
            await result.current.handleFinish()
        })

        expect(mockMutateAsync).toHaveBeenCalledTimes(1)

        await act(async () => {
            resolveMutation(undefined)
            await new Promise(resolve => setTimeout(resolve, 0))
        })
    })

    it('registers beforeRemove listener and disables headerLeft while saving', async () => {
        let resolveMutation: (value: unknown) => void = () => {}
        mockMutateAsync.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveMutation = resolve
                }),
        )

        const { result } = renderHook(() => useMultisigInvitationNameScreen())

        expect(mockAddListener).not.toHaveBeenCalled()

        await act(async () => {
            void result.current.handleFinish()
            await new Promise(resolve => setTimeout(resolve, 0))
        })

        expect(mockAddListener).toHaveBeenCalledWith(
            'beforeRemove',
            expect.any(Function),
        )
        expect(mockSetOptions).toHaveBeenCalledWith({
            headerLeft: expect.any(Function),
        })

        await act(async () => {
            resolveMutation(undefined)
            await new Promise(resolve => setTimeout(resolve, 0))
        })

        expect(mockSetOptions).toHaveBeenLastCalledWith({
            headerLeft: undefined,
        })
    })
})
