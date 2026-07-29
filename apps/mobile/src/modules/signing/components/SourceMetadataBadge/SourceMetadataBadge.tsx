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

import { PWIcon, PWImage, PWText, PWView } from '@components/core'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import { useStyles } from './styles'
import { useSourceMetadataBadge } from './useSourceMetadataBadge'
import { ProjectVerificationIcon } from '@modules/projects/components/ProjectVerificationIcon'

export type SourceMetadataBadgeProps = {
    metadata: SignRequestSource
    /** Origin the platform observed (never dApp-asserted); gates the verified badge. */
    verifiedOrigin?: string
}

export const SourceMetadataBadge = ({
    metadata,
    verifiedOrigin,
}: SourceMetadataBadgeProps) => {
    const styles = useStyles()
    const { displayIcon, displayName, url, verificationTier } =
        useSourceMetadataBadge(metadata, verifiedOrigin)

    return (
        <PWView style={styles.container}>
            {displayIcon ? (
                <PWImage
                    source={{ uri: displayIcon }}
                    style={styles.icon}
                />
            ) : (
                <PWView style={styles.iconFallback}>
                    <PWIcon
                        name='wallet-connect'
                        variant='secondary'
                        size='sm'
                    />
                </PWView>
            )}
            {!!displayName && (
                <PWText
                    variant='caption'
                    style={styles.name}
                >
                    {displayName}
                </PWText>
            )}
            {!!displayName && !!metadata.url && (
                <PWText
                    variant='caption'
                    style={styles.separator}
                >
                    &middot;
                </PWText>
            )}
            {!!verificationTier && (
                <ProjectVerificationIcon
                    tier={verificationTier}
                    size='sm'
                />
            )}
            {!!url && (
                <PWText
                    variant='caption'
                    style={styles.url}
                >
                    {url}
                </PWText>
            )}
        </PWView>
    )
}
