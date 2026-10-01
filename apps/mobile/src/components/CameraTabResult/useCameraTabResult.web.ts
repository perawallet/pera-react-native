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
import { closeCurrentTab } from '@perawallet/wallet-core-browser-runtime'
import { useLanguage } from '@hooks/useLanguage'
import {
    useCameraTabResultStore,
    type CameraTabResult,
} from './useCameraTabResultStore'

const TITLE_KEYS: Record<CameraTabResult, string> = {
    'account-imported': 'camera_tab.account_imported_title',
    'backup-restored': 'camera_tab.backup_restored_title',
}

type UseCameraTabResultResult = {
    title: string | null
    body: string
    closeLabel: string
    handleClose: () => void
}

export const useCameraTabResult = (): UseCameraTabResultResult => {
    const { t } = useLanguage()
    const result = useCameraTabResultStore(state => state.result)

    const handleClose = useCallback(() => {
        void closeCurrentTab()
    }, [])

    return {
        title: result ? t(TITLE_KEYS[result]) : null,
        body: t('camera_tab.body'),
        closeLabel: t('qr_scanner.camera_access_close'),
        handleClose,
    }
}
