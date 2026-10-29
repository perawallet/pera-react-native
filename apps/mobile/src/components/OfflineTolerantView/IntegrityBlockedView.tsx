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

import { PWButton, type PWViewProps } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { useIntegrityAccessState } from '@hooks/useIntegrityAccessState'
import { useLanguage } from '@hooks/useLanguage'

type IntegrityBlockedViewProps = {
    onRetry?: () => void
    style?: PWViewProps['style']
}

// Mounted only while the arm shows, so a surface that is not blocked never
// subscribes to the access state.
export const IntegrityBlockedView = ({
    onRetry,
    style,
}: IntegrityBlockedViewProps) => {
    const { t } = useLanguage()
    const { state, retry, verify } = useIntegrityAccessState()

    if (state.status === 'degraded' && state.reason === 'verification') {
        return (
            <EmptyView
                icon='shield-warning'
                title={t('integrityCheck.surface.verify_title')}
                body={t('integrityCheck.surface.verify_body')}
                button={
                    <PWButton
                        variant='link'
                        title={t('integrityCheck.banner.verify')}
                        onPress={verify}
                    />
                }
                shouldTruncateBody={false}
                style={style}
            />
        )
    }

    // The worker has given up on this installation; no button, since another
    // attempt cannot change the answer.
    if (state.status === 'degraded' && state.reason === 'blocked') {
        return (
            <EmptyView
                icon='shield-warning'
                title={t('integrityCheck.surface.service_title')}
                body={t('integrityCheck.surface.blocked_body')}
                shouldTruncateBody={false}
                style={style}
            />
        )
    }

    // A ready token landed after this query failed, so there is nothing left
    // to mint and only the caller's own refetch can help.
    const handleRetry = state.status === 'ready' ? (onRetry ?? retry) : retry

    return (
        <EmptyView
            icon='shield-warning'
            title={t('integrityCheck.surface.service_title')}
            body={t('integrityCheck.surface.service_body')}
            button={
                <PWButton
                    variant='link'
                    title={t('integrityCheck.banner.retry')}
                    onPress={handleRetry}
                />
            }
            shouldTruncateBody={false}
            style={style}
        />
    )
}
