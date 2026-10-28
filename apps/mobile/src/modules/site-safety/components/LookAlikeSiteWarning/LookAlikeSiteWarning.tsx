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

import { useState } from 'react'
import type { ImpersonationTarget } from '@perawallet/wallet-core-site-safety'
import {
    PWButton,
    PWCheckbox,
    PWRoundIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { getTestProps } from '@utils/test-id-helper'
import { useStyles } from './styles'

export type LookAlikeSiteWarningProps = {
    host: string
    imitates: ImpersonationTarget
    onReject: () => void
    onContinue: () => void
}

export const LookAlikeSiteWarning = ({
    host,
    imitates,
    onReject,
    onContinue,
}: LookAlikeSiteWarningProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const [isAcknowledged, setIsAcknowledged] = useState(false)

    const handleToggleAcknowledged = (): void => {
        setIsAcknowledged(previous => !previous)
    }

    return (
        <PWView
            style={styles.container}
            testID='site_look_alike_warning'
        >
            <PWView style={styles.content}>
                <PWRoundIcon
                    icon='shield-warning'
                    size='xl'
                    variant='error'
                />
                <PWText
                    variant='h3'
                    style={styles.title}
                >
                    {t('site_safety.look_alike.title')}
                </PWText>
                <PWText
                    variant='bodySemibold'
                    style={styles.host}
                    {...getTestProps('site_look_alike_host')}
                >
                    {host}
                </PWText>
                <PWText
                    style={styles.body}
                    {...getTestProps('site_look_alike_body')}
                >
                    {t('site_safety.look_alike.body', {
                        name: imitates.name,
                        domain: imitates.domain,
                    })}
                </PWText>
            </PWView>
            <PWView style={styles.actions}>
                <PWTouchableOpacity
                    style={styles.acknowledge}
                    onPress={handleToggleAcknowledged}
                    {...getTestProps('site_look_alike_acknowledge')}
                >
                    <PWCheckbox
                        checked={isAcknowledged}
                        onPress={handleToggleAcknowledged}
                    />
                    <PWText style={styles.acknowledgeLabel}>
                        {t('site_safety.look_alike.acknowledge', {
                            name: imitates.name,
                        })}
                    </PWText>
                </PWTouchableOpacity>
                <PWButton
                    title={t('site_safety.look_alike.continue')}
                    variant='secondary'
                    isDisabled={!isAcknowledged}
                    onPress={onContinue}
                    {...getTestProps('site_look_alike_continue')}
                />
                <PWButton
                    title={t('site_safety.look_alike.reject')}
                    variant='primary'
                    onPress={onReject}
                    {...getTestProps('site_look_alike_reject')}
                />
            </PWView>
        </PWView>
    )
}
