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
    restoreErrorCategoryOf,
    type RestoreCloudBackupResult,
    type RestoreErrorCategory,
} from '@perawallet/wallet-core-backup'
import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'

type Translate = ReturnType<typeof useLanguage>['t']

const ERROR_KEYS: Record<RestoreErrorCategory, I18nKey> = {
    NOT_FOUND: i18nKey('cloud_backup.restore.error_not_found'),
    INVALID_CREDENTIALS: i18nKey(
        'cloud_backup.restore.error_invalid_credentials',
    ),
    UNKNOWN: i18nKey('cloud_backup.restore.error_unknown'),
}

const outcomeToast = (
    t: Translate,
    {
        incompleteAccountCount,
        newerAccountCount,
    }: Pick<
        RestoreCloudBackupResult,
        'incompleteAccountCount' | 'newerAccountCount'
    >,
) => {
    const update =
        newerAccountCount > 0
            ? t('cloud_backup.restore.update_to_restore', {
                  count: newerAccountCount,
              })
            : ''
    if (incompleteAccountCount > 0) {
        return {
            title: t('cloud_backup.restore.partial_success', {
                count: incompleteAccountCount,
            }),
            body: update,
            type: 'warning' as const,
        }
    }
    if (update) return { title: update, body: '', type: 'warning' as const }
    return {
        title: t('cloud_backup.restore.success'),
        body: '',
        type: 'success' as const,
    }
}

const failureToast = (t: Translate, category: RestoreErrorCategory) => ({
    title: t(ERROR_KEYS[category]),
    body: '',
    type: 'error' as const,
})

export type UseRestoreOutcomeParams = {
    clearDraft: () => void
    /**
     * Where the flow lands once the keys are in. The restore screens are
     * registered in both the cloud-backup stack and the import flow, which
     * have no route in common, so only the registration site can name it.
     */
    onDone: () => void
}

export type UseRestoreOutcomeResult = {
    onSuccess: (result: RestoreCloudBackupResult) => void
    onError: (error: unknown) => void
}

export const useRestoreOutcome = ({
    clearDraft,
    onDone,
}: UseRestoreOutcomeParams): UseRestoreOutcomeResult => {
    const { t } = useLanguage()
    const { showToast } = useToast()

    const onSuccess = useCallback(
        (result: RestoreCloudBackupResult) => {
            showToast(outcomeToast(t, result))
            clearDraft()
            onDone()
        },
        [showToast, t, clearDraft, onDone],
    )

    const onError = useCallback(
        (error: unknown) =>
            showToast(failureToast(t, restoreErrorCategoryOf(error))),
        [showToast, t],
    )

    return { onSuccess, onError }
}
