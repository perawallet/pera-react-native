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

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { AppState } from 'react-native'
import type { Passkey } from '@perawallet/wallet-core-passkeys'
import { useSettingsPasskeysScreen } from '../useSettingsPasskeysScreen'

const mocks = vi.hoisted(() => ({
    passkeys: [] as { id: string }[],
    isPasskeysLoading: false,
    isPasskeysError: false,
    refetch: vi.fn(),
    removePasskey: vi.fn(),
    isStatusLoading: false,
    isProviderActive: true,
    hasHDWallet: true,
    hasStrongBiometricOrCredential: true,
    usePasskeyMigrationBanner: vi.fn(),
    requestSheet: vi.fn(),
    showToast: vi.fn(),
    isCloudBackupEnabled: true,
    isPasskeyBackedUp: vi.fn<(s: unknown, id: string) => boolean>(() => false),
    deletePasskeyFromBackup: vi.fn(async () => 'settled'),
    keepPasskeyInBackup: vi.fn(async () => true),
}))

vi.mock('../../../components/PasskeyMigrationBanner', () => ({
    usePasskeyMigrationBanner: mocks.usePasskeyMigrationBanner,
}))

vi.mock('@perawallet/wallet-core-passkeys', () => ({
    usePasskeysQuery: () => ({
        passkeys: mocks.passkeys,
        isLoading: mocks.isPasskeysLoading,
        isError: mocks.isPasskeysError,
        refetch: mocks.refetch,
    }),
    usePasskeyAutofillStatus: () => ({
        isLoading: mocks.isStatusLoading,
        isProviderActive: mocks.isProviderActive,
        refresh: vi.fn(),
        openProviderSettings: vi.fn(),
    }),
    useRemovePasskeyMutation: () => ({ removePasskey: mocks.removePasskey }),
}))

vi.mock('@perawallet/wallet-core-security', () => ({
    useBiometricSecurityLevel: () => ({
        isLoading: false,
        hasStrongBiometricOrCredential: mocks.hasStrongBiometricOrCredential,
        refresh: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useHasHDWallet: () => mocks.hasHDWallet,
}))

vi.mock('../openCredentialProviderSettings', () => ({
    openCredentialProviderSettings: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mocks.requestSheet }),
}))

vi.mock('@modules/cloud-backup', () => ({
    DeleteFromBackupSheet: () => null,
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    getBackupSyncManager: () => ({
        deletePasskeyFromBackup: mocks.deletePasskeyFromBackup,
        keepPasskeyInBackup: mocks.keepPasskeyInBackup,
    }),
    isPasskeyBackedUp: (syncState: unknown, credentialId: string) =>
        mocks.isPasskeyBackedUp(syncState, credentialId),
    useBackupSyncStateStore: (selector: (s: unknown) => unknown) =>
        selector({ syncState: null }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { warn: vi.fn() },
}))

vi.mock('@hooks/useIsCloudBackupEnabled', () => ({
    useIsCloudBackupEnabled: () => mocks.isCloudBackupEnabled,
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mocks.showToast }),
}))

vi.mock('@components/ConfirmActionContent', () => ({
    ConfirmActionContent: () => null,
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: vi.fn() }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@analytics', () => ({
    trackEvent: vi.fn(),
    PasskeysEvent: { Deleted: 'passkeys_deleted' },
}))

const flaggedPasskey = {
    id: 'cred-1',
    keyId: 'cred-1',
    needsMigration: true,
} as Passkey
const unflaggedPasskey = {
    id: 'cred-2',
    keyId: 'cred-2',
    source: 'keystore',
    needsMigration: false,
} as Passkey
// What a credential `repairs/0002` un-adopted looks like on the list: the
// native identity store has no metadata bag, so the row reports `false`
// whether or not the flat record carries the marker.
const unreadableFlagPasskey = {
    id: 'cred-3',
    keyId: 'cred-3',
    source: 'native',
    needsMigration: false,
} as Passkey

const setMigration = (overrides: {
    affected?: Passkey[]
    isVisible?: boolean
    isFlagSourceComplete?: boolean
}) =>
    mocks.usePasskeyMigrationBanner.mockReturnValue({
        affected: [],
        isVisible: false,
        canRecreate: false,
        isFlagSourceComplete: true,
        onRecreate: vi.fn(),
        onDismiss: vi.fn(),
        ...overrides,
    })

const expectBannerGates = (gates: {
    isManaging: boolean
    isProviderActive?: boolean
}) =>
    expect(mocks.usePasskeyMigrationBanner).toHaveBeenCalledWith(
        expect.objectContaining(gates),
    )

describe('useSettingsPasskeysScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.passkeys = []
        mocks.isPasskeysLoading = false
        mocks.isPasskeysError = false
        mocks.isStatusLoading = false
        mocks.isProviderActive = true
        mocks.hasHDWallet = true
        mocks.hasStrongBiometricOrCredential = true
        mocks.isCloudBackupEnabled = true
        mocks.isPasskeyBackedUp.mockReturnValue(false)
        mocks.deletePasskeyFromBackup.mockResolvedValue('settled')
        mocks.keepPasskeyInBackup.mockResolvedValue(true)
        // Every sheet in this flow resolves a value; the confirm comes first.
        mocks.requestSheet.mockResolvedValue(true)
        setMigration({})
        vi.spyOn(AppState, 'addEventListener').mockReturnValue({
            remove: vi.fn(),
        } as unknown as ReturnType<typeof AppState.addEventListener>)
    })

    it('does not let the banner show while the status or the list is still loading', () => {
        mocks.isPasskeysLoading = true

        const { result } = renderHook(() => useSettingsPasskeysScreen())

        expect(result.current.state).toBe('loading')
        expectBannerGates({ isManaging: false })
    })

    it('does not let the banner show when the list errored', () => {
        mocks.isPasskeysError = true

        const { result } = renderHook(() => useSettingsPasskeysScreen())

        expect(result.current.state).toBe('error')
        expectBannerGates({ isManaging: false })
    })

    // Both banner gates are wired here rather than in the screen body, so the
    // wiring is checkable. This state separates the managed-content gate from
    // the scanner one: the prerequisites are all met, so `canScan` is true (and
    // passing it in `isManaging`'s place would still compile) while the screen
    // is not managing anything.
    it('hands the banner the managed-content gate, not the scanner gate', () => {
        mocks.isProviderActive = false

        const { result } = renderHook(() => useSettingsPasskeysScreen())

        expect(result.current.state).toBe('disabled')
        expect(result.current.canScan).toBe(true)
        expectBannerGates({ isManaging: false, isProviderActive: false })
    })

    it('lets the banner show once the provider is on and the list is empty', () => {
        const { result } = renderHook(() => useSettingsPasskeysScreen())

        expect(result.current.state).toBe('empty')
        expectBannerGates({ isManaging: true })
    })

    // The other half: `populated` wins over `disabled` in `resolveState`, so
    // the screen is managing while a replacement passkey cannot be registered.
    // Passing `isManaging` for `isProviderActive` would pass the case above.
    it('hands the banner the raw provider state, not the managed-content gate', () => {
        mocks.passkeys = [{ id: 'cred-1' }]
        mocks.isProviderActive = false

        const { result } = renderHook(() => useSettingsPasskeysScreen())

        expect(result.current.state).toBe('populated')
        expectBannerGates({ isManaging: true, isProviderActive: false })
    })

    // R7 again, at the row this time: the banner's CTA is not the only way to
    // reach the delete flow, so the same rule has to hold for the list.
    it('withholds removal of a flagged passkey while the provider is off', () => {
        mocks.passkeys = [{ id: 'cred-1' }]
        mocks.isProviderActive = false

        const { result } = renderHook(() => useSettingsPasskeysScreen())

        expect(result.current.canRemove(flaggedPasskey)).toBe(false)
    })

    // The flag means "not derivable from the recovery passphrase". Everything
    // without it is, so withholding those would cost the user an action for no
    // protection at all.
    it('keeps an unflagged passkey removable while the provider is off', () => {
        mocks.passkeys = [{ id: 'cred-1' }]
        mocks.isProviderActive = false

        const { result } = renderHook(() => useSettingsPasskeysScreen())

        expect(result.current.canRemove(unflaggedPasskey)).toBe(true)
    })

    // Paired rather than asserted alone: `canRemove` returns true for anything
    // once the provider is active, so a one-sided assertion here holds even if
    // the flag stops being consulted at all.
    it('offers removal of a flagged passkey once the provider is active, and only then', () => {
        mocks.passkeys = [{ id: 'cred-1' }]
        mocks.isProviderActive = false

        const { result, rerender } = renderHook(() =>
            useSettingsPasskeysScreen(),
        )
        expect(result.current.canRemove(flaggedPasskey)).toBe(false)

        mocks.isProviderActive = true
        rerender()

        expect(result.current.canRemove(flaggedPasskey)).toBe(true)
    })

    // The hole three rounds of gating missed: `needsMigration` is hardcoded
    // `false` for a `source: 'native'` row, which is what every credential
    // `repairs/0002` un-adopted comes back as — the majority. The migration
    // read is the only place their flag survives, so the gate has to union it.
    it('withholds removal of a credential only the migration read knows is flagged', () => {
        mocks.passkeys = [{ id: 'cred-3' }]
        mocks.isProviderActive = false
        setMigration({ affected: [unreadableFlagPasskey] })

        const { result } = renderHook(() => useSettingsPasskeysScreen())

        expect(result.current.canRemove(unreadableFlagPasskey)).toBe(false)
    })

    // An incomplete read reports no affected credentials, which is
    // indistinguishable from "none are flagged" — so a row that has no marker
    // of its own waits rather than offering a one-way action on a credential
    // that may well be flagged. `isComplete` covers the in-flight read AND
    // every failure the read swallows into a resolved empty list.
    it('withholds removal from a native row while the migration read is incomplete', () => {
        mocks.passkeys = [{ id: 'cred-3' }]
        mocks.isProviderActive = false
        setMigration({ isFlagSourceComplete: false })

        const { result } = renderHook(() => useSettingsPasskeysScreen())

        expect(result.current.canRemove(unreadableFlagPasskey)).toBe(false)
    })

    // The other side, so the gate above cannot be satisfied by refusing
    // everything. A keystore row's `needsMigration` is read off its own `k/`
    // metadata by `usePasskeysQuery`, a source the flat read is not involved
    // in — so `false` there is a real answer even when the flat scan learnt
    // nothing, and blocking it would cost the user an action for no protection.
    it('keeps an unflagged keystore row removable while the migration read is incomplete', () => {
        mocks.passkeys = [{ id: 'cred-2' }]
        mocks.isProviderActive = false
        setMigration({ isFlagSourceComplete: false })

        const { result } = renderHook(() => useSettingsPasskeysScreen())

        expect(result.current.canRemove(unflaggedPasskey)).toBe(true)
    })

    // Joined on `id` — the url-safe-normalised credential id both sources
    // agree on — not on the raw `keyId`. The native stores normalise through
    // `credentialIdCandidates` because the same credential's raw id has been
    // persisted in both standard and url-safe base64, so a keyId-join silently
    // misses the flag and hands the row a trash icon.
    // Neither side's raw id equals the normalised one, and the two differ from
    // each other — so joining on `keyId` misses whichever side is mutated, and
    // an asymmetric join (`id` one side, `keyId` the other) misses too.
    it('withholds removal of a flagged credential the flat read reports under a differently-encoded keyId', () => {
        const row = {
            id: 'q-_ABC',
            keyId: 'q-_ABC=',
            source: 'native',
            needsMigration: false,
        } as Passkey
        const flatCopy = {
            id: 'q-_ABC',
            keyId: 'q+/ABC==',
            source: 'provider',
            needsMigration: true,
        } as Passkey
        mocks.passkeys = [{ id: 'q-_ABC' }]
        mocks.isProviderActive = false
        setMigration({ affected: [flatCopy] })

        const { result } = renderHook(() => useSettingsPasskeysScreen())

        expect(result.current.canRemove(row)).toBe(false)
    })

    describe('removing a credential the cloud backup holds', () => {
        const backedUpPasskey = {
            id: 'cred-1',
            keyId: 'raw-cred-1',
            displayName: 'example.com',
            source: 'keystore',
            needsMigration: false,
        } as Passkey
        const unbackedPasskey = { ...backedUpPasskey } as Passkey

        const requestDelete = async (passkey: Passkey) => {
            const { result } = renderHook(() => useSettingsPasskeysScreen())
            await act(async () => {
                result.current.onRequestDelete(passkey)
            })
        }

        it('removes a credential the backup does not hold without asking', async () => {
            await requestDelete(unbackedPasskey)

            expect(mocks.requestSheet).toHaveBeenCalledTimes(1)
            expect(mocks.deletePasskeyFromBackup).not.toHaveBeenCalled()
            expect(mocks.removePasskey).toHaveBeenCalledWith(unbackedPasskey)
        })

        // The backup keys on the raw keystore id; `Passkey.id` is its base64url
        // form and differs whenever the raw id contains `/` or `+`. Querying
        // with the wrong one makes the gate silently never fire.
        it('records the delete against the raw keystore id before removing', async () => {
            mocks.isPasskeyBackedUp.mockReturnValue(true)

            await requestDelete(backedUpPasskey)

            expect(mocks.isPasskeyBackedUp).toHaveBeenCalledWith(
                null,
                'raw-cred-1',
            )
            expect(mocks.deletePasskeyFromBackup).toHaveBeenCalledWith(
                'raw-cred-1',
            )
            expect(mocks.removePasskey).toHaveBeenCalledWith(backedUpPasskey)
        })

        it('keeps the backup copy when the user declines, then removes', async () => {
            mocks.isPasskeyBackedUp.mockReturnValue(true)
            mocks.requestSheet
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false)

            await requestDelete(backedUpPasskey)

            expect(mocks.keepPasskeyInBackup).toHaveBeenCalledWith(
                'raw-cred-1',
                'example.com',
            )
            expect(mocks.deletePasskeyFromBackup).not.toHaveBeenCalled()
            expect(mocks.removePasskey).toHaveBeenCalledWith(backedUpPasskey)
        })

        it('leaves the credential in place when the backup refuses the choice', async () => {
            mocks.isPasskeyBackedUp.mockReturnValue(true)
            mocks.deletePasskeyFromBackup.mockResolvedValue('refused')

            await requestDelete(backedUpPasskey)

            expect(mocks.showToast).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'error' }),
            )
            expect(mocks.removePasskey).not.toHaveBeenCalled()
        })

        it('leaves the credential in place when the choice sheet is dismissed', async () => {
            mocks.isPasskeyBackedUp.mockReturnValue(true)
            mocks.requestSheet
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(undefined)

            await requestDelete(backedUpPasskey)

            expect(mocks.keepPasskeyInBackup).not.toHaveBeenCalled()
            expect(mocks.deletePasskeyFromBackup).not.toHaveBeenCalled()
            expect(mocks.removePasskey).not.toHaveBeenCalled()
        })
    })

    it('exposes the banner state it composed', () => {
        setMigration({ isVisible: true })

        const { result } = renderHook(() => useSettingsPasskeysScreen())

        expect(result.current.migration.isVisible).toBe(true)
        expect(result.current.migration.canRecreate).toBe(false)
    })
})
