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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useMultisigInvitationNameScreen } from '../useMultisigInvitationNameScreen'
import type { MultisigInvitationParam } from '../../../routes/types'

const mockMutateAsync = vi.fn()
const mockSetAccounts = vi.fn()
const mockSetSelectedAccountAddress = vi.fn()
const mockSetShouldPlayConfetti = vi.fn()
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
const mockGenerateMultisigAddress = vi.fn()

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
        useSelectedAccountAddress: () => ({
            selectedAccountAddress: null,
            setSelectedAccountAddress: mockSetSelectedAccountAddress,
        }),
        useAccountsStore: (selector: (state: unknown) => unknown) =>
            selector({ setAccounts: mockSetAccounts }),
    }
})

vi.mock('@modules/onboarding/hooks', () => ({
    useShouldPlayConfetti: () => ({
        shouldPlayConfetti: false,
        setShouldPlayConfetti: mockSetShouldPlayConfetti,
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-blockchain',
    )
    return {
        ...actual,
        useNetwork: () => ({ network: 'mainnet' }),
        generateMultisigAddress: (...args: unknown[]) =>
            mockGenerateMultisigAddress(...args),
    }
})

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: () => mockUseDeviceID(),
    DeviceAccountTypes: {
        algo25: 'algo25',
        hdWallet: 'hdWallet',
        hardware: 'hardware',
        multisig: 'multisig',
        watch: 'watch',
        quantum: 'quantum',
    },
}))

vi.mock('@perawallet/wallet-core-messages', () => ({
    useDeleteMultisigInvitationMutation: () => ({
        mutateAsync: mockMutateAsync,
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
        // Default: re-derived address matches the invitation's claimed address.
        mockGenerateMultisigAddress.mockReturnValue(invitation.address)
    })

    it('initializes with auto-numbered default name (#1) when no shared accounts exist', () => {
        const { result } = renderHook(() => useMultisigInvitationNameScreen())

        expect(result.current.accountName).toBe('Shared Account #1')
        expect(result.current.isSaving).toBe(false)
    })

    it('handleNameChange updates the name', () => {
        const { result } = renderHook(() => useMultisigInvitationNameScreen())

        act(() => {
            result.current.handleNameChange('My Shared Wallet')
        })

        expect(result.current.accountName).toBe('My Shared Wallet')
    })

    it('increments default name based on existing multisig account count', () => {
        mockUseAllAccounts.mockReturnValue([
            {
                address: 'M1',
                name: 'Coffee fund',
                type: 'multisig',
                multisigDetails: {
                    threshold: 2,
                    addresses: ['A', 'B'],
                    version: 1,
                },
            } as WalletAccount,
        ])

        const { result } = renderHook(() => useMultisigInvitationNameScreen())

        expect(result.current.accountName).toBe('Shared Account #2')
        expect(result.current.isNameTaken).toBe(false)
        expect(result.current.nameError).toBeUndefined()
        expect(result.current.isFinishDisabled).toBe(false)
    })

    it('skips taken "#N" slots above the multisig count', () => {
        mockUseAllAccounts.mockReturnValue([
            {
                address: 'M1',
                name: 'Shared Account #1',
                type: 'multisig',
                multisigDetails: {
                    threshold: 2,
                    addresses: ['A', 'B'],
                    version: 1,
                },
            } as WalletAccount,
            {
                address: 'M2',
                name: 'shared account #2',
                type: 'multisig',
                multisigDetails: {
                    threshold: 2,
                    addresses: ['C', 'D'],
                    version: 1,
                },
            } as WalletAccount,
        ])

        const { result } = renderHook(() => useMultisigInvitationNameScreen())

        expect(result.current.accountName).toBe('Shared Account #3')
        expect(result.current.isNameTaken).toBe(false)
    })

    it('fires isNameTaken when user types a colliding name (case-insensitive, trimmed)', () => {
        mockUseAllAccounts.mockReturnValue([
            { address: 'A', name: 'My Wallet' } as WalletAccount,
        ])

        const { result } = renderHook(() => useMultisigInvitationNameScreen())

        act(() => {
            result.current.handleNameChange('  my wallet  ')
        })

        expect(result.current.isNameTaken).toBe(true)
        expect(result.current.nameError).toBe('multisig.name.error_name_taken')
        expect(result.current.isFinishDisabled).toBe(true)
    })

    it('excludes the invitation account itself from the count and the taken set (post-save re-render)', () => {
        mockUseAllAccounts.mockReturnValue([
            {
                address: invitation.address,
                name: 'Shared Account #1',
                type: 'multisig',
                multisigDetails: {
                    threshold: invitation.threshold,
                    addresses: invitation.participantAddresses,
                    version: 1,
                },
            } as WalletAccount,
        ])

        const { result } = renderHook(() => useMultisigInvitationNameScreen())

        expect(result.current.accountName).toBe('Shared Account #1')
        expect(result.current.isNameTaken).toBe(false)
        expect(result.current.nameError).toBeUndefined()
        expect(result.current.isFinishDisabled).toBe(false)
    })

    it('isFinishDisabled is true when name is empty or whitespace', () => {
        const { result } = renderHook(() => useMultisigInvitationNameScreen())

        act(() => {
            result.current.handleNameChange('   ')
        })

        expect(result.current.isFinishDisabled).toBe(true)
    })

    it('handleFinish follows happy path: DELETE, setAccounts, select new account, play confetti, success toast, popToTop', async () => {
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
                name: 'Shared Account #1',
                multisigDetails: {
                    threshold: 2,
                    addresses: ['ADDR1', 'ADDR2', 'ADDR3'],
                    version: 1,
                },
            }),
        ])
        expect(mockSetSelectedAccountAddress).toHaveBeenCalledWith('MSIG_ADDR')
        expect(mockSetShouldPlayConfetti).toHaveBeenCalledWith(true)
        expect(mockSuccessToast).toHaveBeenCalled()
        expect(mockPopToTop).toHaveBeenCalled()
    })

    it('handleFinish refuses to persist (and does not consume the invitation) when the re-derived address does not match the claimed address', async () => {
        // Backend-supplied address disagrees with what the participant set
        // actually derives to — corrupt or tampered invitation.
        mockGenerateMultisigAddress.mockReturnValue('DERIVED_DIFFERENT_ADDR')

        const { result } = renderHook(() => useMultisigInvitationNameScreen())

        await act(async () => {
            await result.current.handleFinish()
        })

        expect(mockGenerateMultisigAddress).toHaveBeenCalledWith(
            invitation.version,
            invitation.threshold,
            invitation.participantAddresses,
        )
        expect(mockErrorToast).toHaveBeenCalledWith(
            'multisig.import.address_mismatch_title',
            'multisig.import.address_mismatch_body',
        )
        expect(mockMutateAsync).not.toHaveBeenCalled()
        expect(mockSetAccounts).not.toHaveBeenCalled()
        expect(mockSetSelectedAccountAddress).not.toHaveBeenCalled()
        expect(mockPopToTop).not.toHaveBeenCalled()
        expect(result.current.isSaving).toBe(false)
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
