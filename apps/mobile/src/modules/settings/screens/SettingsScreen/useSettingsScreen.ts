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
import { useSettingsOptions } from './useSettingsOptions'
import { SettingsStackParamsList } from '@modules/settings/routes'
import {
    deferToNextCycle,
    generateUniqueId,
} from '@perawallet/wallet-core-shared'
import { clearAccountsStore } from '@modules/settings/hooks/useDeleteAllData'
import { useCallback } from 'react'

export const useSettingsScreen = () => {
    const navigation = useAppNavigation()
    const { pushWebView } = useWebView()
    const {
        isOpen: isDeleteModalOpen,
        open: openDeleteModal,
        close: closeDeleteModal,
    } = useModalState()
    const {
        isOpen: isSuccessModalOpen,
        open: openSuccessModal,
        close: closeSuccessModal,
    } = useModalState()
    const {
        isOpen: isRatingModalOpen,
        open: openRatingModal,
        close: closeRatingModal,
    } = useModalState()
    const { settingsOptions } = useSettingsOptions()

    const goToSettingsPage = (route: keyof SettingsStackParamsList) => {
        navigation.push(route)
    }

    const openWebView = (url: string) => {
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
    }) => {
        if (page.route) {
            goToSettingsPage(page.route)
        } else if (page.url) {
            openWebView(page.url)
        } else {
            openRatingModal()
        }
    }

    const handleDeleteSuccess = useCallback(() => {
        openSuccessModal()
    }, [openSuccessModal])

    const handleSuccessClose = useCallback(() => {
        closeSuccessModal()
        clearAccountsStore()

        deferToNextCycle(() => {
            navigation.navigate('Onboarding', {
                screen: 'OnboardingHome',
            })
        })
    }, [closeSuccessModal])

    return {
        isDeleteModalOpen,
        openDeleteModal,
        closeDeleteModal,
        isSuccessModalOpen,
        handleDeleteSuccess,
        handleSuccessClose,
        isRatingModalOpen,
        closeRatingModal,
        settingsOptions,
        handleTapEvent,
    }
}
