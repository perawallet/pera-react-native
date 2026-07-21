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
import { Linking } from 'react-native'

import {
    deferToNextCycle,
    generateUniqueId,
    logger,
} from '@perawallet/wallet-core-shared'

import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { trackEvent, SettingsEvent } from '@analytics'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    clearAccountsStore,
    useDeleteAllData,
} from '@modules/settings/hooks/useDeleteAllData'
import { DeleteAllSuccessContent } from '@modules/settings/components/DeleteAllSuccessContent'
import { useWebView } from '@modules/webview'
import { routeCapabilities } from '@routes/capabilities'
import { useSettingsOptions } from './useSettingsOptions'

import type { SettingsStackParamsList } from '@modules/settings/routes'

export const useSettingsScreen = () => {
    const navigation = useAppNavigation()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()
    const { deleteAllData } = useDeleteAllData()
    const { request: requestBottomSheet } = useBottomSheet()
    const { settingsOptions } = useSettingsOptions()

    // Dynamic import: react-native-rate-app (behind RatingsContent) has no
    // web build of its own and is dead weight in the web bundle, since the
    // capability that renders this option is off there. Splitting it into
    // its own chunk keeps it out of the shipped web AppShell bundle.
    const openRatingModal = useCallback(async () => {
        const { RatingsContent } =
            await import('@modules/settings/components/RatingsContent')
        void requestBottomSheet({
            contents: <RatingsContent />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
            },
        })
    }, [requestBottomSheet])

    const goToSettingsPage = (route: keyof SettingsStackParamsList) => {
        navigation.push(route)
    }

    const openWebView = (url: string) => {
        if (!routeCapabilities.inAppWebView) {
            void Linking.openURL(url)
            return
        }
        const id = generateUniqueId()
        pushWebView({
            url,
            id,
        })
    }

    const handleTapEvent = (page: {
        title: string
        icon: string
        url?: string
        route?: keyof SettingsStackParamsList
        action?: 'scanRekeyed'
    }) => {
        if (page.action === 'scanRekeyed') {
            // Root-level flow, not a settings sub-screen: no sourceAddress
            // sweeps every signable key.
            navigation.navigate('RescanRekeyed', {
                screen: 'RescanRekeyedSelect',
                params: {},
            })
            return
        }
        if (page.route) {
            if (page.route === 'PasskeysSettings') {
                trackEvent(SettingsEvent.PassKey)
            }
            goToSettingsPage(page.route)
        } else if (page.url) {
            openWebView(page.url)
        } else {
            openRatingModal().catch(error => {
                logger.error('Failed to open rating modal', { error })
            })
        }
    }

    const showDeleteSuccess = useCallback(async () => {
        await requestBottomSheet({
            contents: <DeleteAllSuccessContent />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
            },
        })

        clearAccountsStore()

        void deferToNextCycle(() => {
            navigation.navigate('Onboarding', {
                screen: 'OnboardingHome',
            })
        })
    }, [navigation, requestBottomSheet])

    const openDeleteConfirm = useCallback(async () => {
        const confirmed = await requestBottomSheet<boolean>({
            contents: (
                <ConfirmActionContent
                    icon='trash'
                    iconVariant='error'
                    title={t('settings.main.remove_title')}
                    message={t('settings.main.remove_message')}
                    confirmLabel={t('settings.main.remove_confirm')}
                    cancelLabel={t('settings.main.remove_cancel')}
                    testID='settings_delete_all_confirm_bottom_sheet'
                    confirmTestID='settings_delete_all_confirm_button'
                    cancelTestID='settings_delete_all_cancel_button'
                />
            ),
            options: { size: 'auto', enablePanDownToClose: true },
        })
        if (!confirmed) return
        await deleteAllData()
        await showDeleteSuccess()
    }, [requestBottomSheet, t, deleteAllData, showDeleteSuccess])

    return {
        openDeleteConfirm,
        settingsOptions,
        handleTapEvent,
    }
}
