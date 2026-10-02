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
import {
    closeCurrentTab,
    getConsumedExpandedFlow,
} from '@perawallet/wallet-core-browser-runtime'
import { useLanguage } from '@hooks/useLanguage'
import {
    useCameraTabResultStore,
    type CameraTabResult,
} from './useCameraTabResultStore'

const COPY_KEYS: Record<CameraTabResult, { title: string; body: string }> = {
    'account-imported': {
        title: 'camera_tab.account_imported_title',
        body: 'camera_tab.body',
    },
    'backup-restored': {
        title: 'camera_tab.backup_restored_title',
        body: 'camera_tab.body',
    },
    'import-failed': {
        title: 'onboarding.import_account.failed_title',
        body: 'onboarding.import_account.failed_body',
    },
}

type UseCameraTabResultResult = {
    result: CameraTabResult | null
    title: string
    body: string
    closeLabel: string
    retryLabel: string
    cancelLabel: string
    handleClose: () => void
    handleRetry: () => void
}

export const useCameraTabResult = (): UseCameraTabResultResult => {
    const { t } = useLanguage()
    const result = useCameraTabResultStore(state => state.result)

    const handleClose = useCallback(() => {
        void closeCurrentTab()
    }, [])

    // Reloading this tab on its own flow restarts the scan from a clean shell;
    // openExpandedTab would instead re-point whichever expanded tab it finds first.
    const handleRetry = useCallback(() => {
        const flow = getConsumedExpandedFlow()
        window.location.replace(
            flow ? `expanded.html?flow=${flow}` : 'expanded.html',
        )
    }, [])

    return {
        result,
        title: result ? t(COPY_KEYS[result].title) : '',
        body: result ? t(COPY_KEYS[result].body) : '',
        closeLabel: t('qr_scanner.camera_access_close'),
        retryLabel: t('qr_scanner.try_again'),
        cancelLabel: t('common.cancel.label'),
        handleClose,
        handleRetry,
    }
}
