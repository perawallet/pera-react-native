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

import { useLanguage } from '@hooks/useLanguage'
import {
    CollapsibleSection,
    ComparisonRow,
} from '../SettingsDeveloperMigrationViewerScreen'
import type { RNMigrationSnapshot } from '../useRNMigrationSnapshot'

export const NotificationFiltersSection = ({
    filters,
    rn,
}: {
    filters: string[]
    rn: RNMigrationSnapshot
}) => {
    const { t } = useLanguage()
    return (
        <CollapsibleSection
            title={t(
                'settings.developer.migration_viewer.section_notification_filters',
            )}
            count={filters.length}
        >
            <ComparisonRow
                label='muted count'
                legacyValue={filters.length}
                rnValue={rn.notificationDisabledAccounts.size}
                matches={
                    filters.length === rn.notificationDisabledAccounts.size
                }
            />
            {filters.map((address, i) => (
                <ComparisonRow
                    key={`${address}-${i}`}
                    label={`#${i}`}
                    legacyValue={address}
                    rnValue={
                        rn.notificationDisabledAccounts.has(address)
                            ? address
                            : '(not muted in RN)'
                    }
                    matches={rn.notificationDisabledAccounts.has(address)}
                />
            ))}
        </CollapsibleSection>
    )
}
