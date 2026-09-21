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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { trackEvent, CloudBackupEvent } from '@analytics'
import { useCloudBackupStoreEncryptionKeyScreen } from '../useCloudBackupStoreEncryptionKeyScreen'

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics/events/contexts')),
    trackEvent: vi.fn(),
}))

type BeforeRemoveEvent = {
    data: { action: { type: string } }
    preventDefault: () => void
}

const {
    SALT,
    BACKUP_ID,
    addListenerMock,
    popToMock,
    dispatchMock,
    setOptionsMock,
    enableState,
    requestMock,
    clearDraftMock,
    saveCredentialsMock,
    enableBackupMock,
    requirePinVerificationMock,
    destinationsMock,
    draftState,
} = vi.hoisted(() => {
    const salt = 'q311Z4ReDNWpMVuH8XdvSw=='
    const backupId = `did:pera:VQBGR${'A'.repeat(53)}`

    return {
        SALT: salt,
        BACKUP_ID: backupId,
        addListenerMock: vi.fn(
            (_event: string, _listener: (event: BeforeRemoveEvent) => void) =>
                vi.fn(),
        ),
        popToMock: vi.fn(),
        dispatchMock: vi.fn(),
        setOptionsMock: vi.fn(),
        enableState: { isEnabling: false },
        requestMock: vi.fn(),
        clearDraftMock: vi.fn(),
        saveCredentialsMock: vi.fn(),
        enableBackupMock: vi.fn(),
        requirePinVerificationMock: vi.fn(),
        destinationsMock: vi.fn(),
        draftState: {
            salt: salt as string | null,
            registration: { backupId } as { backupId: string } | null,
        },
    }
})

vi.mock('@perawallet/wallet-core-backup', () => ({
    useCloudBackupDraftStore: (
        selector: (s: {
            salt: string | null
            registration: { backupId: string } | null
            clearDraft: () => void
        }) => unknown,
    ) =>
        selector({
            salt: draftState.salt,
            registration: draftState.registration,
            clearDraft: clearDraftMock,
        }),
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        addListener: addListenerMock,
        popTo: popToMock,
        dispatch: dispatchMock,
        setOptions: setOptionsMock,
    }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: requestMock }),
}))

vi.mock('@modules/security', () => ({
    useRequirePinVerification: () => ({
        requirePinVerification: requirePinVerificationMock,
    }),
}))

vi.mock('../../../hooks/useSaveCredentialsFile', () => ({
    useSaveCredentialsFile: () => ({ saveCredentials: saveCredentialsMock }),
}))

vi.mock('../../../hooks/useCredentialsFileDestinations', () => ({
    useCredentialsFileDestinations: destinationsMock,
}))

vi.mock('../../../hooks/useEnableCloudBackup', () => ({
    useEnableCloudBackup: () => ({
        enableBackup: enableBackupMock,
        isEnabling: enableState.isEnabling,
    }),
}))

vi.mock('../../../components/ConfirmLeaveBackupSetupSheet', () => ({
    ConfirmLeaveBackupSetupSheet: () => null,
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

let onSelectDestination: (destination: string) => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    enableState.isEnabling = false
    draftState.salt = SALT
    draftState.registration = { backupId: BACKUP_ID }
    requirePinVerificationMock.mockResolvedValue(true)
    destinationsMock.mockImplementation(
        (onSelect: (destination: string) => void) => {
            onSelectDestination = onSelect
            return [{ key: 'device', title: 'device', onPress: vi.fn() }]
        },
    )
})

const flushPromises = () =>
    act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
    })

describe('useCloudBackupStoreEncryptionKeyScreen', () => {
    test('shows the drafted encryption key', () => {
        const { result } = renderHook(() =>
            useCloudBackupStoreEncryptionKeyScreen(),
        )

        expect(result.current.encryptionKey).toBe(SALT)
    })

    test('saves the drafted credentials to the chosen destination', async () => {
        renderHook(() => useCloudBackupStoreEncryptionKeyScreen())

        await act(async () => onSelectDestination('device'))

        expect(saveCredentialsMock).toHaveBeenCalledWith('device', {
            salt: SALT,
            backupId: BACKUP_ID,
        })
    })

    // The save hook owns the refusal, so what this screen owes it is the pair
    // as the draft actually holds it — never a blank key silently dropped here.
    test('hands an incomplete pair to the save hook rather than papering over it', async () => {
        draftState.registration = null
        renderHook(() => useCloudBackupStoreEncryptionKeyScreen())

        await act(async () => onSelectDestination('device'))

        expect(saveCredentialsMock).toHaveBeenCalledWith('device', {
            salt: SALT,
            backupId: null,
        })
    })

    test('zeroes the retained draft when the screen goes away', () => {
        const { unmount } = renderHook(() =>
            useCloudBackupStoreEncryptionKeyScreen(),
        )

        expect(clearDraftMock).not.toHaveBeenCalled()

        unmount()

        expect(clearDraftMock).toHaveBeenCalledTimes(1)
    })

    // Storing is offered, not required: a user who wrote the key down is not
    // forced through a file picker.
    test('the checkbox alone arms the enable button', () => {
        const { result } = renderHook(() =>
            useCloudBackupStoreEncryptionKeyScreen(),
        )

        expect(result.current.isConfirmed).toBe(false)

        act(() => result.current.toggleConfirmed())

        expect(result.current.isConfirmed).toBe(true)
        expect(trackEvent).toHaveBeenCalledWith(
            CloudBackupEvent.ConfirmStoredCheck,
        )
        expect(saveCredentialsMock).not.toHaveBeenCalled()
    })

    test('enables the backup only after the PIN gate passes', async () => {
        let passGate: (verified: boolean) => void = () => undefined
        requirePinVerificationMock.mockReturnValueOnce(
            new Promise<boolean>(resolve => {
                passGate = resolve
            }),
        )
        const { result } = renderHook(() =>
            useCloudBackupStoreEncryptionKeyScreen(),
        )

        act(() => result.current.handleEnable())
        await flushPromises()

        expect(trackEvent).toHaveBeenCalledWith(CloudBackupEvent.ConfirmEnable)
        expect(enableBackupMock).not.toHaveBeenCalled()

        passGate(true)
        await flushPromises()

        expect(enableBackupMock).toHaveBeenCalledTimes(1)
    })

    test('does not enable the backup when the PIN gate is cancelled', async () => {
        requirePinVerificationMock.mockResolvedValueOnce(false)
        const { result } = renderHook(() =>
            useCloudBackupStoreEncryptionKeyScreen(),
        )

        act(() => result.current.handleEnable())
        await flushPromises()

        expect(enableBackupMock).not.toHaveBeenCalled()
    })

    // `isEnabling` is still false while the PIN sheet mounts, so the button
    // stays live and only this guard stops a second PIN request.
    test('ignores a second enable while the PIN gate is open', async () => {
        requirePinVerificationMock.mockReturnValueOnce(
            new Promise<boolean>(() => undefined),
        )
        const { result } = renderHook(() =>
            useCloudBackupStoreEncryptionKeyScreen(),
        )

        act(() => result.current.handleEnable())
        act(() => result.current.handleEnable())
        await flushPromises()

        expect(requirePinVerificationMock).toHaveBeenCalledTimes(1)
        expect(trackEvent).toHaveBeenCalledTimes(1)
    })

    test('warns before a back action and stays put when the user declines', async () => {
        requestMock.mockResolvedValue(undefined)
        renderHook(() => useCloudBackupStoreEncryptionKeyScreen())
        const [eventName, listener] = addListenerMock.mock.calls[0]
        expect(eventName).toBe('beforeRemove')
        const preventDefault = vi.fn()

        await act(async () =>
            listener({
                data: { action: { type: 'GO_BACK' } },
                preventDefault,
            }),
        )
        await flushPromises()

        expect(preventDefault).toHaveBeenCalled()
        expect(popToMock).not.toHaveBeenCalled()
    })

    test('leaves the whole flow when the user confirms', async () => {
        requestMock.mockResolvedValue(true)
        renderHook(() => useCloudBackupStoreEncryptionKeyScreen())
        const [, listener] = addListenerMock.mock.calls[0]

        await act(async () =>
            listener({
                data: { action: { type: 'GO_BACK' } },
                preventDefault: vi.fn(),
            }),
        )
        await flushPromises()

        expect(popToMock).toHaveBeenCalledWith('CloudBackupHome')
    })

    // `request` rejects when no sheet host is mounted, and the back action is
    // already prevented by then.
    test('lets the user leave when the confirm sheet cannot be shown', async () => {
        const action = { type: 'GO_BACK' }
        requestMock.mockRejectedValueOnce(new Error('no sheet host'))
        renderHook(() => useCloudBackupStoreEncryptionKeyScreen())
        const [, listener] = addListenerMock.mock.calls[0]

        await act(async () =>
            listener({ data: { action }, preventDefault: vi.fn() }),
        )
        await flushPromises()

        expect(dispatchMock).toHaveBeenCalledWith(action)
    })

    test('does not reopen the sheet once the user has confirmed leaving', async () => {
        requestMock.mockResolvedValue(true)
        renderHook(() => useCloudBackupStoreEncryptionKeyScreen())
        const [, listener] = addListenerMock.mock.calls[0]

        await act(async () =>
            listener({
                data: { action: { type: 'GO_BACK' } },
                preventDefault: vi.fn(),
            }),
        )
        await flushPromises()
        expect(popToMock).toHaveBeenCalledTimes(1)

        const preventDefault = vi.fn()
        await act(async () =>
            listener({
                data: { action: { type: 'GO_BACK' } },
                preventDefault,
            }),
        )
        await flushPromises()

        expect(preventDefault).not.toHaveBeenCalled()
        expect(requestMock).toHaveBeenCalledTimes(1)
        expect(popToMock).toHaveBeenCalledTimes(1)
    })

    // react-query runs the mutation to completion after an unmount, so offering
    // to leave here would enable the backup the user just chose to abandon.
    test('refuses a back action while the enable is in flight, without offering to leave', async () => {
        enableState.isEnabling = true
        renderHook(() => useCloudBackupStoreEncryptionKeyScreen())
        const [, listener] = addListenerMock.mock.calls[0]
        const preventDefault = vi.fn()

        await act(async () =>
            listener({
                data: { action: { type: 'GO_BACK' } },
                preventDefault,
            }),
        )
        await flushPromises()

        expect(preventDefault).toHaveBeenCalled()
        expect(requestMock).not.toHaveBeenCalled()
        expect(popToMock).not.toHaveBeenCalled()
        expect(dispatchMock).not.toHaveBeenCalled()
    })

    test('drops the back affordance only while the enable is in flight', () => {
        const { rerender } = renderHook(() =>
            useCloudBackupStoreEncryptionKeyScreen(),
        )

        // The gesture stays off throughout: this screen always intercepts back,
        // it only changes what it does with it.
        expect(setOptionsMock).toHaveBeenLastCalledWith({
            headerLeft: undefined,
            gestureEnabled: false,
        })

        enableState.isEnabling = true
        rerender()

        expect(setOptionsMock).toHaveBeenLastCalledWith({
            headerLeft: expect.any(Function),
            gestureEnabled: false,
        })
    })

    // react-query runs `onSuccess` before the observer settles, so the reset
    // fires while `isEnabling` is still true — the same state the guard above
    // hard-blocks back in. Intercepting it would trap the user on a screen
    // whose job is done.
    test('does not warn on the reset that follows a successful enable', async () => {
        enableState.isEnabling = true
        renderHook(() => useCloudBackupStoreEncryptionKeyScreen())
        const [, listener] = addListenerMock.mock.calls[0]
        const preventDefault = vi.fn()

        await act(async () =>
            listener({
                data: { action: { type: 'RESET' } },
                preventDefault,
            }),
        )

        expect(preventDefault).not.toHaveBeenCalled()
        expect(requestMock).not.toHaveBeenCalled()
    })
})
