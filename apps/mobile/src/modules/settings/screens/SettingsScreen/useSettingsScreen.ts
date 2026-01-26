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

import { useAppNavigation } from '@hooks/useAppNavigation'
import { useWebView } from '@modules/webview'
import { useModalState } from '@hooks/useModalState'
import { useDeleteAllData } from '@modules/settings/hooks/useDeleteAllData'
import { useSettingsOptions } from '@modules/settings/hooks/useSettingsOptions'
import { SettingsStackParamsList } from '@modules/settings/routes'

export const useSettingsScreen = () => {
    const navigation = useAppNavigation()
    const { pushWebView } = useWebView()
    const { isOpen, open, close } = useModalState()
    const clearAllData = useDeleteAllData()
    const { settingsOptions } = useSettingsOptions()

    const handleDeleteAllAccounts = () => {
        clearAllData()
        close()

        //we need to defer this so that the navigation stack has time to
        //update it's conditions on the next render
        setTimeout(() => {
            navigation.replace('Onboarding', { screen: 'OnboardingHome' })
        }, 0)
    }

    const goToSettingsPage = (route: keyof SettingsStackParamsList) => {
        navigation.push(route)
    }

    const openRating = () => {
        //TODO open ratings view here somehow
    }

    const openWebView = (url: string) => {
        pushWebView({
            url,
            id: '',
        })
    }

    const handleTapEvent = (page: {
        title: string
        icon: string
        url?: string
        route?: keyof SettingsStackParamsList
    }) => {
        if (page.route) {
            goToSettingsPage(page.route)
        } else if (page.url) {
            openWebView(page.url)
        } else {
            openRating()
        }
    }

    return {
        isDeleteModalOpen: isOpen,
        openDeleteModal: open,
        closeDeleteModal: close,
        settingsOptions,
        handleTapEvent,
        handleDeleteAllAccounts,
    }
}
