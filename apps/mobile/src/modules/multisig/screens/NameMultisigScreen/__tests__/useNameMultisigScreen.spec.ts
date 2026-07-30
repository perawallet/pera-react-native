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
import { useNameMultisigScreen } from '../useNameMultisigScreen'
import { useMultisigCreationStore } from '../../../hooks/useMultisigCreation'
import type { NameMultisigImportParams } from '../../../routes/types'

const mockMutateAsync = vi.fn()
const mockSetAccounts = vi.fn()
const mockSetSelectedAccountAddress = vi.fn()
const mockSetShouldPlayConfetti = vi.fn()
const mockExitAccountFlow = vi.fn()
const mockErrorToast = vi.fn()
const mockAddListener = vi.fn(
    (_event: string, _listener: (e: { preventDefault: () => void }) => void) =>
        vi.fn(),
)
const mockSetOptions = vi.fn()
const mockUseAllAccounts = vi.fn((): WalletAccount[] => [])
const mockUseDeviceID = vi.fn(() => 'device-id')
const mockGenerateMultisigAddress = vi.fn(
    (_version: number, _threshold: number, _addresses: string[]) =>
        'MULTISIG_ADDR',
)

const mockNavigation = {
    addListener: mockAddListener,
    setOptions: mockSetOptions,
}
const mockUseRoute = vi.fn<
    () => { params: NameMultisigImportParams | undefined }
>(() => ({ params: undefined }))

vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<object>('@react-navigation/native')
    return {
        ...actual,
        useNavigation: () => mockNavigation,
        useRoute: () => mockUseRoute(),
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
        generateMultisigAddress: (
            version: number,
            threshold: number,
            addresses: string[],
        ) => mockGenerateMultisigAddress(version, threshold, addresses),
        useNetwork: () => ({ network: 'mainnet' }),
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
            t: (key: string, opts?: Record<string, unknown>) => {
                if (key === 'multisig.name.default_name')
                    return 'Shared Account'
                if (opts) return `${key}:${JSON.stringify(opts)}`
                return key
            },
            i18n: { changeLanguage: vi.fn(), language: 'en' },
        }),
    }
})

describe('useNameMultisigScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal(
            'requestAnimationFrame',
            (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown,
        )
        mockUseAllAccounts.mockReturnValue([])
        mockUseDeviceID.mockReturnValue('device-id')
        mockMutateAsync.mockResolvedValue(undefined)
        mockGenerateMultisigAddress.mockReturnValue('MULTISIG_ADDR')
        mockAddListener.mockReturnValue(vi.fn())
        mockUseRoute.mockReturnValue({ params: undefined })

        const store = useMultisigCreationStore.getState()
        store.resetState()
        store.addParticipant({ address: 'ADDR1' })
        store.addParticipant({ address: 'ADDR2' })
        store.setThreshold(2)
    })

    it('initializes with auto-numbered default name (#1) when no shared accounts exist', () => {
        const { result } = renderHook(() => useNameMultisigScreen())

        expect(result.current.accountName).toBe('Shared Account #1')
        expect(result.current.isCreating).toBe(false)
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

        const { result } = renderHook(() => useNameMultisigScreen())

        expect(result.current.accountName).toBe('Shared Account #2')
    })

    it('skips taken "#N" slots regardless of account type', () => {
        mockUseAllAccounts.mockReturnValue([
            {
                address: 'W1',
                name: 'Shared Account #1',
                type: 'watch',
            } as WalletAccount,
        ])

        const { result } = renderHook(() => useNameMultisigScreen())

        expect(result.current.accountName).toBe('Shared Account #2')
    })

    it('handleNameChange updates the name', () => {
        const { result } = renderHook(() => useNameMultisigScreen())

        act(() => {
            result.current.handleNameChange('My Wallet')
        })

        expect(result.current.accountName).toBe('My Wallet')
    })

    it('allows a name already used by another account (names need not be unique)', () => {
        mockUseAllAccounts.mockReturnValue([
            { address: 'A', name: 'my account' } as WalletAccount,
        ])

        const { result } = renderHook(() => useNameMultisigScreen())

        act(() => {
            result.current.handleNameChange('  MY ACCOUNT  ')
        })

        expect(result.current.isFinishDisabled).toBe(false)
    })

    it('isFinishDisabled is true when name is empty', () => {
        const { result } = renderHook(() => useNameMultisigScreen())

        act(() => {
            result.current.handleNameChange('   ')
        })

        expect(result.current.isFinishDisabled).toBe(true)
    })

    it('handleFinish calls mutation, updates accounts, selects address, plays confetti, exits', async () => {
        const existing = [{ address: 'X', name: 'Other' } as WalletAccount]
        mockUseAllAccounts.mockReturnValue(existing)

        const { result } = renderHook(() => useNameMultisigScreen())

        await act(async () => {
            await result.current.handleFinish()
        })

        expect(mockMutateAsync).toHaveBeenCalledWith({
            version: 1,
            threshold: 2,
            participant_addresses: ['ADDR1', 'ADDR2'],
            device_id: 'device-id',
        })
        expect(mockGenerateMultisigAddress).toHaveBeenCalledWith(1, 2, [
            'ADDR1',
            'ADDR2',
        ])
        expect(mockSetAccounts).toHaveBeenCalledWith([
            ...existing,
            expect.objectContaining({
                type: 'multisig',
                address: 'MULTISIG_ADDR',
                name: 'Shared Account #1',
                multisigDetails: {
                    threshold: 2,
                    addresses: ['ADDR1', 'ADDR2'],
                    version: 1,
                },
            }),
        ])
        expect(mockSetSelectedAccountAddress).toHaveBeenCalledWith(
            'MULTISIG_ADDR',
        )
        expect(mockSetShouldPlayConfetti).toHaveBeenCalledWith(true)
        expect(mockExitAccountFlow).toHaveBeenCalled()
    })

    it('handleFinish shows duplicate-account toast and skips mutation when an account with the generated multisig address already exists', async () => {
        // Pre-seed the wallet with an account holding the address
        // generateMultisigAddress will produce — same participants +
        // threshold deterministically yield the same address, so re-creating
        // the configuration must not silently append a second copy. (Mirror
        // of the algo25/HD duplicate-prevention behavior.)
        mockUseAllAccounts.mockReturnValue([
            {
                address: 'MULTISIG_ADDR',
                name: 'Existing Shared',
                type: 'multisig',
                multisigDetails: {
                    threshold: 2,
                    addresses: ['ADDR1', 'ADDR2'],
                    version: 1,
                },
            } as WalletAccount,
        ])

        const { result } = renderHook(() => useNameMultisigScreen())

        await act(async () => {
            await result.current.handleFinish()
        })

        expect(mockErrorToast).toHaveBeenCalledWith(
            'multisig.name.duplicate_account_title',
            'multisig.name.duplicate_account_body',
        )
        // The remote create call is skipped — we never reach the mutation
        // for an existing address.
        expect(mockMutateAsync).not.toHaveBeenCalled()
        expect(mockSetAccounts).not.toHaveBeenCalled()
        expect(mockSetSelectedAccountAddress).not.toHaveBeenCalled()
        expect(mockExitAccountFlow).not.toHaveBeenCalled()
        // Loading flag is reset (the `finally` block runs after the early
        // return) so the user can correct their input and try again.
        expect(result.current.isCreating).toBe(false)
    })

    it('handleFinish shows error toast and skips mutation when deviceId is missing', async () => {
        mockUseDeviceID.mockReturnValue('')

        const { result } = renderHook(() => useNameMultisigScreen())

        await act(async () => {
            await result.current.handleFinish()
        })

        expect(mockErrorToast).toHaveBeenCalled()
        expect(mockMutateAsync).not.toHaveBeenCalled()
        expect(mockExitAccountFlow).not.toHaveBeenCalled()
    })

    it('handleFinish shows error toast when the mutation rejects', async () => {
        mockMutateAsync.mockRejectedValue(new Error('boom'))

        const { result } = renderHook(() => useNameMultisigScreen())

        await act(async () => {
            await result.current.handleFinish()
        })

        expect(mockErrorToast).toHaveBeenCalled()
        expect(mockExitAccountFlow).not.toHaveBeenCalled()
        expect(result.current.isCreating).toBe(false)
    })

    it('ignores concurrent handleFinish calls while isCreating', async () => {
        let resolveMutation: (value: unknown) => void = () => {}
        mockMutateAsync.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveMutation = resolve
                }),
        )

        const { result } = renderHook(() => useNameMultisigScreen())

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

    it('registers beforeRemove listener and disables headerLeft while creating', async () => {
        let resolveMutation: (value: unknown) => void = () => {}
        mockMutateAsync.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveMutation = resolve
                }),
        )

        const { result } = renderHook(() => useNameMultisigScreen())

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

    describe('import mode (route params present)', () => {
        const importParams: NameMultisigImportParams = {
            address: 'IMPORTED_SHARED_ADDR',
            threshold: 3,
            addresses: ['IMP1', 'IMP2', 'IMP3'],
            version: 1,
        }

        beforeEach(() => {
            mockUseRoute.mockReturnValue({ params: importParams })
            // Import happy path: the address re-derived from the scanned
            // (version, threshold, participants) must equal the address the
            // QR payload carried, or handleFinish aborts on the mismatch
            // guard before persisting.
            mockGenerateMultisigAddress.mockReturnValue('IMPORTED_SHARED_ADDR')
        })

        it('handleFinish verifies the derived address, then saves the imported account', async () => {
            const existing = [{ address: 'X', name: 'Other' } as WalletAccount]
            mockUseAllAccounts.mockReturnValue(existing)

            const { result } = renderHook(() => useNameMultisigScreen())

            await act(async () => {
                await result.current.handleFinish()
            })

            // The address is re-derived locally and verified against the
            // scanned payload before persisting.
            expect(mockGenerateMultisigAddress).toHaveBeenCalledWith(1, 3, [
                'IMP1',
                'IMP2',
                'IMP3',
            ])
            expect(mockMutateAsync).toHaveBeenCalledWith({
                version: 1,
                threshold: 3,
                participant_addresses: ['IMP1', 'IMP2', 'IMP3'],
                device_id: 'device-id',
            })
            expect(mockSetAccounts).toHaveBeenCalledWith([
                ...existing,
                expect.objectContaining({
                    type: 'multisig',
                    address: 'IMPORTED_SHARED_ADDR',
                    multisigDetails: {
                        threshold: 3,
                        addresses: ['IMP1', 'IMP2', 'IMP3'],
                        version: 1,
                    },
                }),
            ])
            expect(mockSetSelectedAccountAddress).toHaveBeenCalledWith(
                'IMPORTED_SHARED_ADDR',
            )
            expect(mockExitAccountFlow).toHaveBeenCalled()
        })

        it('handleFinish blocks when the imported address is already in the wallet', async () => {
            mockUseAllAccounts.mockReturnValue([
                {
                    address: 'IMPORTED_SHARED_ADDR',
                    name: 'Existing Shared',
                    type: 'multisig',
                    multisigDetails: {
                        threshold: 3,
                        addresses: ['IMP1', 'IMP2', 'IMP3'],
                        version: 1,
                    },
                } as WalletAccount,
            ])

            const { result } = renderHook(() => useNameMultisigScreen())

            await act(async () => {
                await result.current.handleFinish()
            })

            expect(mockErrorToast).toHaveBeenCalledWith(
                'multisig.name.duplicate_account_title',
                'multisig.name.duplicate_account_body',
            )
            expect(mockMutateAsync).not.toHaveBeenCalled()
            expect(mockSetAccounts).not.toHaveBeenCalled()
        })

        it('handleFinish aborts with a mismatch toast when the derived address does not match the scanned address', async () => {
            // The QR payload claims IMPORTED_SHARED_ADDR, but deriving the
            // multisig address from its (version, threshold, participants)
            // yields a different address — the payload is corrupt or
            // tampered with. handleFinish must refuse to persist.
            mockGenerateMultisigAddress.mockReturnValue(
                'DERIVED_DIFFERENT_ADDR',
            )
            mockUseAllAccounts.mockReturnValue([])

            const { result } = renderHook(() => useNameMultisigScreen())

            await act(async () => {
                await result.current.handleFinish()
            })

            expect(mockErrorToast).toHaveBeenCalledWith(
                'multisig.import.address_mismatch_title',
                'multisig.import.address_mismatch_body',
            )
            expect(mockMutateAsync).not.toHaveBeenCalled()
            expect(mockSetAccounts).not.toHaveBeenCalled()
            expect(mockSetSelectedAccountAddress).not.toHaveBeenCalled()
            expect(mockExitAccountFlow).not.toHaveBeenCalled()
            expect(result.current.isCreating).toBe(false)
        })
    })

    it('beforeRemove listener calls preventDefault during isCreating', async () => {
        let capturedListener: (e: {
            preventDefault: () => void
        }) => void = () => {}
        mockAddListener.mockImplementation(
            (
                _event: string,
                listener: (e: { preventDefault: () => void }) => void,
            ) => {
                capturedListener = listener
                return vi.fn()
            },
        )
        let resolveMutation: (value: unknown) => void = () => {}
        mockMutateAsync.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveMutation = resolve
                }),
        )

        const { result } = renderHook(() => useNameMultisigScreen())

        act(() => {
            void result.current.handleFinish()
        })

        const preventDefault = vi.fn()
        capturedListener({ preventDefault })
        expect(preventDefault).toHaveBeenCalled()

        await act(async () => {
            resolveMutation(undefined)
        })
    })

    it('releases the navigation lock so the finish-time exit can navigate', async () => {
        let capturedListener: (e: {
            preventDefault: () => void
        }) => void = () => {}
        mockAddListener.mockImplementation(
            (
                _event: string,
                listener: (e: { preventDefault: () => void }) => void,
            ) => {
                capturedListener = listener
                return vi.fn()
            },
        )
        // exitAccountFlow stands in for navigation.reset, which fires
        // `beforeRemove`. handleFinish must release the lock (via
        // allowProgrammaticNavigation) before calling it, or the exit is
        // blocked and the screen never leaves.
        const preventDefault = vi.fn()
        mockExitAccountFlow.mockImplementationOnce(() => {
            capturedListener({ preventDefault })
        })

        const { result } = renderHook(() => useNameMultisigScreen())

        await act(async () => {
            await result.current.handleFinish()
        })

        expect(mockExitAccountFlow).toHaveBeenCalled()
        expect(preventDefault).not.toHaveBeenCalled()
    })
})
