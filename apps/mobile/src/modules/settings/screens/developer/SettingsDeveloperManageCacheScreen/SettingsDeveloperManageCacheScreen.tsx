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

import { useState } from 'react'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useAgeGateStore } from '@perawallet/wallet-core-age-gate'
import { getSyncService } from '@perawallet/wallet-core-background'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useBannersStore } from '@perawallet/wallet-core-banners'
import { usePreferences } from '@perawallet/wallet-core-settings'

import { PWButton, PWScreen, PWView } from '@components/core'
import { OneTimeUserPreferenceFlags } from '@constants/user-preferences'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useStyles } from './styles'

export const SettingsDeveloperManageCacheScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { showToast } = useToast()
    const accounts = useAllAccounts()
    const { network } = useNetwork()
    const resetBanners = useBannersStore(state => state.resetState)
    const resetAgeGate = useAgeGateStore(state => state.resetState)
    const { deletePreference } = usePreferences()
    const [isRefreshing, setIsRefreshing] = useState(false)

    const handleRefreshCache = async () => {
        setIsRefreshing(true)
        const addresses = accounts?.map(account => account.address) ?? []
        try {
            const syncService = getSyncService()
            await syncService.refreshAccounts(addresses, network)
            syncService.invalidateQueries()
            showToast({
                title: t('settings.developer.refresh_cache_success_title'),
                body: t('settings.developer.refresh_cache_success_body'),
                type: 'success',
            })
        } catch {
            // lanekeep-ignore-next-line pera/no-error-toast-in-catch reason: refresh_cache_error_* names this dev action; showError would fall through to the generic errors.general.* copy
            showToast({
                title: t('settings.developer.refresh_cache_error_title'),
                body: t('settings.developer.refresh_cache_error_body'),
                type: 'error',
            })
        } finally {
            setIsRefreshing(false)
        }
    }

    const handleResetBanners = () => {
        resetBanners()
        showToast({
            title: t('settings.developer.reset_banners_success_title'),
            body: t('settings.developer.reset_banners_success_body'),
            type: 'success',
        })
    }

    const handleClearOneTimeFlags = () => {
        OneTimeUserPreferenceFlags.forEach(deletePreference)
        resetAgeGate()
        showToast({
            title: t('settings.developer.clear_one_time_flags_success_title'),
            body: t('settings.developer.clear_one_time_flags_success_body'),
            type: 'success',
        })
    }

    return (
        <PWScreen testID='manage_cache_screen'>
            <PWView style={styles.content}>
                <PWButton
                    variant='primary'
                    title={t('settings.developer.refresh_cache')}
                    icon='reload'
                    onPress={() => void handleRefreshCache()}
                    isLoading={isRefreshing}
                    isDisabled={isRefreshing}
                    testID='manage_cache_refresh_button'
                />
                <PWButton
                    variant='secondary'
                    title={t('settings.developer.reset_banners')}
                    icon='bell'
                    onPress={handleResetBanners}
                    testID='manage_cache_reset_banners_button'
                />
                <PWButton
                    variant='secondary'
                    title={t('settings.developer.clear_one_time_flags')}
                    icon='trash'
                    onPress={handleClearOneTimeFlags}
                    testID='manage_cache_clear_flags_button'
                />
            </PWView>
        </PWScreen>
    )
}
