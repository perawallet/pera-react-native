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

import { PWListItem, PWScreen } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useSettingsDeveloperMenuScreen } from './useSettingsDeveloperMenuScreen'

export const SettingsDeveloperMenuScreen = () => {
    const { t } = useLanguage()
    const { isGalleryAvailable, handleNavigate, handleOpenTestingDapp } =
        useSettingsDeveloperMenuScreen()

    return (
        <PWScreen>
            <PWListItem
                onPress={() => handleNavigate('FeatureFlags')}
                icon='sliders'
                title={t('screens.feature_flags')}
            />
            <PWListItem
                onPress={() => handleNavigate('MigrationViewer')}
                icon='code'
                title='Migration Viewer'
            />
            <PWListItem
                onPress={() => handleNavigate('KeystoreMigrations')}
                icon='reload'
                title='Keystore Migrations'
            />
            <PWListItem
                onPress={handleOpenTestingDapp}
                icon='globe'
                title={t('settings.developer.debug_dapp')}
            />
            <PWListItem
                onPress={() => handleNavigate('ManageCache')}
                icon='reload'
                title={t('settings.developer.manage_cache')}
            />
            <PWListItem
                onPress={() => handleNavigate('AppIntegrity')}
                icon='shield-check'
                title={t('settings.developer.app_integrity')}
            />
            {isGalleryAvailable && (
                <PWListItem
                    onPress={() => handleNavigate('Gallery')}
                    icon='dot-stack'
                    title={t('settings.developer.screen_gallery')}
                    testID='developer_menu_gallery_item'
                />
            )}
        </PWScreen>
    )
}
