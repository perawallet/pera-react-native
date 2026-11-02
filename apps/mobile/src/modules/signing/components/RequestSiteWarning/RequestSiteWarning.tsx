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
    PWCheckbox,
    PWRoundIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useRequestSiteSafety } from '../../hooks/useRequestSiteSafety'
import { useStyles } from './styles'

export const RequestSiteWarning = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { blockedSite, isAcknowledged, toggleAcknowledged } =
        useRequestSiteSafety()

    if (!blockedSite) return null

    return (
        <PWView
            style={styles.warning}
            testID='request_site_warning'
        >
            <PWView style={styles.header}>
                <PWRoundIcon
                    icon='info'
                    size='md'
                    variant='error'
                />
                <PWText
                    variant='bodySemibold'
                    style={styles.title}
                >
                    {t('site_safety.blocked.title')}
                </PWText>
            </PWView>
            {!!blockedSite.host && (
                <PWText
                    variant='bodySemibold'
                    style={styles.host}
                    testID='request_site_host'
                >
                    {blockedSite.host}
                </PWText>
            )}
            <PWText style={styles.body}>
                {blockedSite.reason === 'walletconnect-verify'
                    ? t('site_safety.blocked.body_verify')
                    : t('site_safety.blocked.body')}
            </PWText>
            <PWTouchableOpacity
                style={styles.acknowledge}
                onPress={toggleAcknowledged}
                testID='request_site_acknowledge'
            >
                <PWCheckbox
                    checked={isAcknowledged}
                    onPress={toggleAcknowledged}
                />
                <PWText style={styles.acknowledgeLabel}>
                    {t('site_safety.blocked.acknowledge')}
                </PWText>
            </PWTouchableOpacity>
        </PWView>
    )
}
