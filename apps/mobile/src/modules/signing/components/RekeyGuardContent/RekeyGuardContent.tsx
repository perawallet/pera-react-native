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

import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PWButton, PWIcon, PWText, PWView } from '@components/core'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { useStyles } from './styles'

export type RekeyGuardContentResult = 'confirm' | 'go-to-settings'

export type RekeyGuardContentProps = Record<string, never>

export const RekeyGuardContent = (_props: RekeyGuardContentProps = {}) => {
    const { t } = useLanguage()
    const insets = useSafeAreaInsets()
    const styles = useStyles({ bottomInset: insets.bottom })
    const { getPreference } = usePreferences()
    const { resolve, dismiss } = useBottomSheetResult<RekeyGuardContentResult>()
    const isRekeySupportEnabled = !!getPreference(
        UserPreferences.rekeySupportEnabled,
    )

    return (
        <>
            <PWIcon
                name='warning'
                variant='error'
                size='xxl'
                style={styles.bottomSheetIcon}
            />
            <PWText variant='h3'>
                {isRekeySupportEnabled
                    ? t('transactions.warning.rekey_are_you_sure_title')
                    : t('transactions.warning.rekey_confirm_title')}
            </PWText>
            <PWText style={styles.bottomSheetMessage}>
                {isRekeySupportEnabled
                    ? t('transactions.warning.rekey_are_you_sure_description')
                    : t('transactions.warning.rekey_confirm_description')}
            </PWText>
            <PWView style={styles.bottomSheetActions}>
                {isRekeySupportEnabled ? (
                    <PWButton
                        variant='primary'
                        title={t(
                            'transactions.warning.rekey_are_you_sure_continue',
                        )}
                        onPress={() => resolve('confirm')}
                        paddingStyle='dense'
                    />
                ) : (
                    <PWButton
                        variant='primary'
                        title={t(
                            'transactions.warning.rekey_confirm_go_to_settings',
                        )}
                        onPress={() => resolve('go-to-settings')}
                        paddingStyle='dense'
                    />
                )}
                <PWButton
                    variant='secondary'
                    title={t('common.cancel.label')}
                    onPress={dismiss}
                    paddingStyle='dense'
                />
            </PWView>
        </>
    )
}
