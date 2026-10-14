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

import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useLanguage } from '@hooks/useLanguage'
import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'

export type GuardedWarningType = 'rekey' | 'asset-freeze'

export type SecurityGuardContentResult = 'confirm' | 'go-to-settings'

export type SecurityGuardContentProps = {
    warningType: GuardedWarningType
}

type GuardedWarningMessages = {
    confirmTitle: I18nKey
    confirmDescription: I18nKey
    confirmGoToSettings: I18nKey
    areYouSureTitle: I18nKey
    areYouSureDescription: I18nKey
    areYouSureContinue: I18nKey
}

const preferenceKeyMap: Record<GuardedWarningType, string> = {
    rekey: UserPreferences.rekeySupportEnabled,
    'asset-freeze': UserPreferences.assetFreezeSupportEnabled,
}

const i18nKeyMap: Record<GuardedWarningType, GuardedWarningMessages> = {
    rekey: {
        confirmTitle: i18nKey('transactions.warning.rekey_confirm_title'),
        confirmDescription: i18nKey(
            'transactions.warning.rekey_confirm_description',
        ),
        confirmGoToSettings: i18nKey(
            'transactions.warning.rekey_confirm_go_to_settings',
        ),
        areYouSureTitle: i18nKey(
            'transactions.warning.rekey_are_you_sure_title',
        ),
        areYouSureDescription: i18nKey(
            'transactions.warning.rekey_are_you_sure_description',
        ),
        areYouSureContinue: i18nKey(
            'transactions.warning.rekey_are_you_sure_continue',
        ),
    },
    'asset-freeze': {
        confirmTitle: i18nKey(
            'transactions.warning.asset_freeze_confirm_title',
        ),
        confirmDescription: i18nKey(
            'transactions.warning.asset_freeze_confirm_description',
        ),
        confirmGoToSettings: i18nKey(
            'transactions.warning.asset_freeze_confirm_go_to_settings',
        ),
        areYouSureTitle: i18nKey(
            'transactions.warning.asset_freeze_are_you_sure_title',
        ),
        areYouSureDescription: i18nKey(
            'transactions.warning.asset_freeze_are_you_sure_description',
        ),
        areYouSureContinue: i18nKey(
            'transactions.warning.asset_freeze_are_you_sure_continue',
        ),
    },
}

export const SecurityGuardContent = ({
    warningType,
}: SecurityGuardContentProps) => {
    const { t } = useLanguage()
    const { getPreference } = usePreferences()
    const isSupportEnabled = !!getPreference(preferenceKeyMap[warningType])
    const keys = i18nKeyMap[warningType]

    return (
        <ConfirmActionContent<SecurityGuardContentResult>
            icon='warning'
            iconVariant='error'
            title={
                isSupportEnabled
                    ? t(keys.areYouSureTitle)
                    : t(keys.confirmTitle)
            }
            message={
                isSupportEnabled
                    ? t(keys.areYouSureDescription)
                    : t(keys.confirmDescription)
            }
            confirmLabel={
                isSupportEnabled
                    ? t(keys.areYouSureContinue)
                    : t(keys.confirmGoToSettings)
            }
            confirmValue={isSupportEnabled ? 'confirm' : 'go-to-settings'}
            cancelLabel={t('common.cancel.label')}
            buttonPaddingStyle='normal'
        />
    )
}
