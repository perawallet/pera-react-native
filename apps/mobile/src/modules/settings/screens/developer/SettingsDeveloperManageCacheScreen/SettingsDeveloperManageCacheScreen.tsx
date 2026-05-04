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

import { useState } from 'react'
import { PWButton, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { getSyncService } from '@perawallet/wallet-core-background'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useStyles } from './styles'

export const SettingsDeveloperManageCacheScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { showToast } = useToast()
    const accounts = useAllAccounts()
    const { network } = useNetwork()
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
            // guardrails-ignore-next-line no-error-toast-in-catch reason: localized refresh_cache error copy preserved; no exception detail surfaced to user
            showToast({
                title: t('settings.developer.refresh_cache_error_title'),
                body: t('settings.developer.refresh_cache_error_body'),
                type: 'error',
            })
        } finally {
            setIsRefreshing(false)
        }
    }

    return (
        <PWView style={styles.container}>
            <PWButton
                variant='primary'
                title={t('settings.developer.refresh_cache')}
                icon='reload'
                onPress={handleRefreshCache}
                isLoading={isRefreshing}
                isDisabled={isRefreshing}
            />
        </PWView>
    )
}
