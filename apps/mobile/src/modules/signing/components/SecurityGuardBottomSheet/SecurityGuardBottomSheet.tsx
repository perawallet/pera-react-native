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

import {
    PWBottomSheet,
    PWButton,
    PWIcon,
    PWText,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './SecurityGuardBottomSheet.style'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'

type GuardedWarningType = 'rekey' | 'asset-freeze'

type SecurityGuardBottomSheetProps = {
    isOpen: boolean
    warningType: GuardedWarningType
    onClose: () => void
    onConfirm: () => void
    onGoToSettings: () => void
}

type GuardedWarningMessages = {
    confirmTitle: string
    confirmDescription: string
    confirmGoToSettings: string
    areYouSureTitle: string
    areYouSureDescription: string
    areYouSureContinue: string
}

const preferenceKeyMap: Record<GuardedWarningType, string> = {
    rekey: UserPreferences.rekeySupportEnabled,
    'asset-freeze': UserPreferences.assetFreezeSupportEnabled,
}

const i18nKeyMap: Record<GuardedWarningType, GuardedWarningMessages> = {
    rekey: {
        confirmTitle: 'transactions.warning.rekey_confirm_title',
        confirmDescription: 'transactions.warning.rekey_confirm_description',
        confirmGoToSettings:
            'transactions.warning.rekey_confirm_go_to_settings',
        areYouSureTitle: 'transactions.warning.rekey_are_you_sure_title',
        areYouSureDescription:
            'transactions.warning.rekey_are_you_sure_description',
        areYouSureContinue: 'transactions.warning.rekey_are_you_sure_continue',
    },
    'asset-freeze': {
        confirmTitle: 'transactions.warning.asset_freeze_confirm_title',
        confirmDescription:
            'transactions.warning.asset_freeze_confirm_description',
        confirmGoToSettings:
            'transactions.warning.asset_freeze_confirm_go_to_settings',
        areYouSureTitle: 'transactions.warning.asset_freeze_are_you_sure_title',
        areYouSureDescription:
            'transactions.warning.asset_freeze_are_you_sure_description',
        areYouSureContinue:
            'transactions.warning.asset_freeze_are_you_sure_continue',
    },
}

export const SecurityGuardBottomSheet = (
    props: SecurityGuardBottomSheetProps,
) => {
    const { isOpen, warningType, onClose, onConfirm, onGoToSettings } = props
    const { t } = useLanguage()
    const styles = useStyles()
    const { getPreference } = usePreferences()
    const isSupportEnabled = !!getPreference(preferenceKeyMap[warningType])
    const keys = i18nKeyMap[warningType]

    return (
        <PWBottomSheet
            isVisible={isOpen}
            onBackdropPress={onClose}
            innerContainerStyle={styles.bottomSheetContainer}
            enablePanDownToClose
        >
            <PWIcon
                name='info'
                variant='error'
                size='xxl'
                style={styles.bottomSheetIcon}
            />
            <PWText variant='h3'>
                {isSupportEnabled
                    ? t(keys.areYouSureTitle)
                    : t(keys.confirmTitle)}
            </PWText>
            <PWText style={styles.bottomSheetMessage}>
                {isSupportEnabled
                    ? t(keys.areYouSureDescription)
                    : t(keys.confirmDescription)}
            </PWText>
            <PWView style={styles.bottomSheetActions}>
                {isSupportEnabled ? (
                    <PWButton
                        variant='primary'
                        title={t(keys.areYouSureContinue)}
                        onPress={onConfirm}
                        paddingStyle='dense'
                    />
                ) : (
                    <PWButton
                        variant='primary'
                        title={t(keys.confirmGoToSettings)}
                        onPress={onGoToSettings}
                        paddingStyle='dense'
                    />
                )}
                <PWButton
                    variant='secondary'
                    title={t('common.cancel.label')}
                    onPress={onClose}
                    paddingStyle='dense'
                />
            </PWView>
        </PWBottomSheet>
    )
}
