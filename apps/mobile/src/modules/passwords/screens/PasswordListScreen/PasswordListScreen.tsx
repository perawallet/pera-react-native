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

import { useCallback } from 'react'
import { ActivityIndicator } from 'react-native'
import {
    PWButton,
    PWFlatList,
    PWIcon,
    PWListItem,
    PWScreen,
    PWText,
    PWTouchableIcon,
    PWView,
} from '@components/core'
import { EmptyView } from '@components/EmptyView'
import type { Login } from '@perawallet/wallet-core-passwords'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { usePasswordListScreen } from './usePasswordListScreen'
import { useStyles } from './styles'

export const PasswordListScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        logins,
        isLoading,
        isProviderActive,
        autofillStatus,
        handleAdd,
        handleSelect,
        handleEnableProvider,
        handleEnableAutofill,
    } = usePasswordListScreen()

    useNavigationHeader({
        right: (
            <PWTouchableIcon
                name='plus'
                onPress={handleAdd}
                testID='password_list_add_button'
            />
        ),
    })

    const renderItem = useCallback(
        ({ item }: { item: Login }) => (
            <PWListItem
                icon='key'
                title={item.domain}
                value={item.username}
                onPress={() => handleSelect(item.id)}
                testID={`password_list_item_${item.id}`}
            />
        ),
        [handleSelect],
    )

    const keyExtractor = useCallback((login: Login) => login.id, [])

    return (
        <PWScreen
            scroll='never'
            testID='password_list_screen'
        >
            <PWView
                style={styles.noticeRow}
                testID='password_list_not_backed_up_notice'
            >
                <PWIcon
                    name='info'
                    variant='secondary'
                />
                <PWText
                    variant='caption'
                    style={styles.noticeText}
                >
                    {t('settings.passwords.not_backed_up_notice')}
                </PWText>
            </PWView>
            {!isProviderActive && (
                <PWView
                    style={styles.disabledContainer}
                    testID='password_list_provider_disabled'
                >
                    <PWText variant='h3'>
                        {t('settings.passwords.provider_disabled_title')}
                    </PWText>
                    <PWText
                        variant='caption'
                        style={styles.disabledBody}
                    >
                        {t('settings.passwords.provider_disabled_body')}
                    </PWText>
                    <PWButton
                        variant='primary'
                        title={t('settings.passwords.enable_provider_action')}
                        onPress={handleEnableProvider}
                        testID='password_list_enable_provider_button'
                    />
                </PWView>
            )}
            {autofillStatus !== 'active' && (
                <PWView
                    style={styles.disabledContainer}
                    testID='password_list_autofill_disabled'
                >
                    <PWText variant='h3'>
                        {t('settings.passwords.autofill_disabled_title')}
                    </PWText>
                    <PWText
                        variant='caption'
                        style={styles.disabledBody}
                    >
                        {t(
                            autofillStatus === 'unsupported'
                                ? 'settings.passwords.autofill_unsupported_body'
                                : 'settings.passwords.autofill_disabled_body',
                        )}
                    </PWText>
                    {autofillStatus === 'inactive' && (
                        <PWButton
                            variant='primary'
                            title={t(
                                'settings.passwords.enable_autofill_action',
                            )}
                            onPress={handleEnableAutofill}
                            testID='password_list_enable_autofill_button'
                        />
                    )}
                </PWView>
            )}
            {isLoading ? (
                <PWView
                    style={styles.centered}
                    testID='password_list_loading_state'
                >
                    <ActivityIndicator />
                </PWView>
            ) : logins.length === 0 ? (
                <EmptyView
                    icon='key'
                    title={t('settings.passwords.empty_title')}
                    body={t('settings.passwords.empty_body')}
                    testID='password_list_empty_state'
                />
            ) : (
                <PWFlatList
                    data={logins}
                    keyExtractor={keyExtractor}
                    renderItem={renderItem}
                    testID='password_list'
                />
            )}
        </PWScreen>
    )
}
