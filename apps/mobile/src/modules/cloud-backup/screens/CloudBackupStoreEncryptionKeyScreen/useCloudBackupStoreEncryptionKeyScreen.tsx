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

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigation, type NavigationAction } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useCloudBackupDraftStore } from '@perawallet/wallet-core-backup'
import { logger } from '@perawallet/wallet-core-shared'
import { trackEvent, CloudBackupEvent } from '@analytics'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useRequirePinVerification } from '@modules/security'
import { useBackRemovalGuard } from '@hooks/useBackRemovalGuard'
import type { OptionListOption } from '@components/OptionList'
import { ConfirmLeaveBackupSetupSheet } from '../../components/ConfirmLeaveBackupSetupSheet'
import { useCredentialsFileDestinations } from '../../hooks/useCredentialsFileDestinations'
import { useEnableCloudBackup } from '../../hooks/useEnableCloudBackup'
import { useSaveCredentialsFile } from '../../hooks/useSaveCredentialsFile'
import type { CredentialsFileSource } from '../../storage'
import type { CloudBackupStackParamList } from '../../routes/types'

// `ConfirmActionContent` renders plain views, so it needs the default
// container to report its height; `autoCreateContainer: false` would leave
// `size: 'auto'` with nothing to measure and the sheet would never appear.
const LEAVE_SHEET_OPTIONS = {
    size: 'auto',
    enablePanDownToClose: true,
} as const

type CloudBackupNavigation =
    NativeStackNavigationProp<CloudBackupStackParamList>

/**
 * The backup is registered but nothing is on the device yet, so a back action
 * abandons it.
 *
 * Once `isEnabling` is set the offer is withdrawn: react-query does not cancel
 * a mutation when its screen unmounts, so the keystore write and `setConfigured`
 * land either way and the sheet's "nothing is backed up" would be a promise we
 * cannot keep.
 */
const useLeaveGuard = (
    navigation: CloudBackupNavigation,
    isEnabling: boolean,
): void => {
    const { request: requestBottomSheet } = useBottomSheet()

    const confirmLeave = useCallback(
        (action: NavigationAction, allowRemoval: () => void) => {
            void (async () => {
                try {
                    const shouldLeave = await requestBottomSheet<boolean>({
                        contents: <ConfirmLeaveBackupSetupSheet />,
                        options: LEAVE_SHEET_OPTIONS,
                    })
                    if (!shouldLeave) return
                    allowRemoval()
                    // `popTo` rather than the original action: a plain back
                    // lands on the passphrase screen, still mounted below.
                    navigation.popTo('CloudBackupHome')
                } catch (error) {
                    // Fail open: `request` rejects when no sheet host is
                    // mounted, and the back action is already prevented, so
                    // swallowing this would leave Enable as the only way off
                    // the screen.
                    logger.error(
                        'useLeaveGuard: could not confirm leaving cloud backup setup',
                        { error },
                    )
                    allowRemoval()
                    navigation.dispatch(action)
                }
            })()
        },
        [navigation, requestBottomSheet],
    )

    useBackRemovalGuard({ isBlocking: isEnabling, onBackAttempt: confirmLeave })
}

type UseCloudBackupStoreEncryptionKeyScreenResult = {
    encryptionKey: string
    destinations: OptionListOption[]
    isConfirmed: boolean
    toggleConfirmed: () => void
    handleEnable: () => void
    isEnabling: boolean
    isSaving: boolean
}

export const useCloudBackupStoreEncryptionKeyScreen =
    (): UseCloudBackupStoreEncryptionKeyScreenResult => {
        const navigation = useNavigation<CloudBackupNavigation>()
        const salt = useCloudBackupDraftStore(state => state.salt)
        const backupId = useCloudBackupDraftStore(
            state => state.registration?.backupId ?? null,
        )
        const clearDraft = useCloudBackupDraftStore(state => state.clearDraft)
        const { saveCredentials, isSaving } = useSaveCredentialsFile()
        const { enableBackup, isEnabling } = useEnableCloudBackup()
        const { requirePinVerification } = useRequirePinVerification()
        const [isConfirmed, setIsConfirmed] = useState(false)

        useLeaveGuard(navigation, isEnabling)

        // Scrubs the retained phrase and registration keys however the screen
        // is left — abandoning and a successful enable both stop here, and
        // clearing twice is harmless.
        useEffect(() => () => clearDraft(), [clearDraft])

        const handleSelectDestination = useCallback(
            (destination: CredentialsFileSource) => {
                void saveCredentials(destination, { salt, backupId })
            },
            [backupId, salt, saveCredentials],
        )

        const destinations = useCredentialsFileDestinations(
            handleSelectDestination,
        )

        const toggleConfirmed = useCallback(() => {
            if (!isConfirmed) trackEvent(CloudBackupEvent.ConfirmStoredCheck)
            setIsConfirmed(value => !value)
        }, [isConfirmed])

        // `isEnabling` only goes true once the PIN gate resolves, so the button
        // is still live while the PIN sheet mounts: a second tap in that window
        // would open a second PIN request.
        const isConfirmingRef = useRef(false)

        const confirmEnable = useCallback(async () => {
            if (isConfirmingRef.current) return
            isConfirmingRef.current = true
            try {
                trackEvent(CloudBackupEvent.ConfirmEnable)
                if (!(await requirePinVerification())) return
                enableBackup()
            } finally {
                isConfirmingRef.current = false
            }
        }, [requirePinVerification, enableBackup])

        const handleEnable = useCallback(
            () => void confirmEnable(),
            [confirmEnable],
        )

        return {
            encryptionKey: salt ?? '',
            destinations,
            isConfirmed,
            toggleConfirmed,
            handleEnable,
            isEnabling,
            isSaving,
        }
    }
