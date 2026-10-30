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

import {
    formatDatetime,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import type { CloudBackupSummary } from '@modules/cloud-backup'
import type { WidgetBackup } from './snapshot'

type Translate = (key: string, options?: Record<string, unknown>) => string

type ResolveWidgetBackupParams = {
    cloud: CloudBackupSummary
    passphrase: { needingCount: number; isPending: boolean }
    locale: string
    t: Translate
}

const formatSyncedAt = (millis: Nullable<number>, locale: string) =>
    millis == null ? null : formatDatetime(new Date(millis), locale, 'short')

const resolveCloud = (
    cloud: CloudBackupSummary,
    locale: string,
    t: Translate,
): WidgetBackup['cloud'] => {
    switch (cloud.state) {
        case 'unavailable': {
            return null
        }
        case 'notSetUp': {
            return {
                state: 'notSetUp',
                title: t('widgets.backup_not_set_up'),
                detail: t('widgets.backup_tap_to_back_up'),
            }
        }
        case 'failed': {
            const date = formatSyncedAt(cloud.lastSyncedAt, locale)
            return {
                state: 'failed',
                title: t('widgets.backup_failed'),
                detail: date
                    ? t('cloud_backup.overview.last_successful_sync', { date })
                    : null,
            }
        }
        case 'partial': {
            return {
                state: 'partial',
                title: t('widgets.backup_accounts_missing', {
                    count: cloud.notBackedUpCount,
                }),
                detail: t('widgets.backup_tap_to_back_up'),
            }
        }
        case 'backedUp': {
            const date = formatSyncedAt(cloud.lastSyncedAt, locale)
            return {
                state: 'backedUp',
                title: t('widgets.backup_backed_up'),
                detail: date ? t('widgets.backup_last_sync', { date }) : null,
            }
        }
        default: {
            const exhaustiveCheck: never = cloud
            return exhaustiveCheck
        }
    }
}

/** `undefined` while the passphrase count is still loading. */
export const resolveWidgetBackup = ({
    cloud,
    passphrase,
    locale,
    t,
}: ResolveWidgetBackupParams): Optional<WidgetBackup> => {
    if (passphrase.isPending) return undefined
    return {
        cloud: resolveCloud(cloud, locale, t),
        passphrase:
            passphrase.needingCount > 0
                ? {
                      state: 'needed',
                      title: t('widgets.passphrase_needed', {
                          count: passphrase.needingCount,
                      }),
                      detail: t('widgets.backup_tap_to_back_up'),
                  }
                : {
                      state: 'backedUp',
                      title: t('widgets.passphrase_backed_up'),
                      detail: null,
                  },
    }
}
