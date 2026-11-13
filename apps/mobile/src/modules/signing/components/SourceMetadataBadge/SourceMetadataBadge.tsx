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

import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import { PWIcon, PWImage, PWText, PWView } from '@components/core'
import { ProjectVerificationIcon } from '@modules/projects'
import { useSourceMetadataBadge } from './useSourceMetadataBadge'
import { useStyles } from './styles'

export type SourceMetadataBadgeProps = {
    metadata: SignRequestSource
    /** Origin the platform observed (never dApp-asserted); gates the verified badge. */
    verifiedOrigin?: string
}

/** The requesting site by its domain; the name a site gives itself is never shown beside it. */
export const SourceMetadataBadge = ({
    metadata,
    verifiedOrigin,
}: SourceMetadataBadgeProps) => {
    const styles = useStyles()
    const {
        displayIcon,
        displayName,
        url,
        verificationTier,
        requestOriginLabel,
    } = useSourceMetadataBadge(metadata, verifiedOrigin)
    const label = url || displayName

    return (
        <PWView style={styles.wrapper}>
            <PWView
                style={styles.container}
                testID='source_metadata_badge'
            >
                {displayIcon ? (
                    // Clipped by a round frame: sites ship square icons, and the image's own radius doesn't always clip.
                    <PWView style={styles.iconFrame}>
                        <PWImage
                            source={{ uri: displayIcon }}
                            style={styles.icon}
                        />
                    </PWView>
                ) : (
                    <PWView style={styles.iconFallback}>
                        <PWIcon
                            name='globe'
                            variant='secondary'
                            size='xs'
                        />
                    </PWView>
                )}
                {!!label && (
                    <PWText
                        variant='footnoteMedium'
                        style={styles.url}
                        numberOfLines={1}
                    >
                        {label}
                    </PWText>
                )}
                {!!verificationTier && (
                    <ProjectVerificationIcon
                        tier={verificationTier}
                        size='sm'
                    />
                )}
            </PWView>
            {!!requestOriginLabel && (
                <PWText
                    variant='caption'
                    style={styles.requestOrigin}
                >
                    {requestOriginLabel}
                </PWText>
            )}
        </PWView>
    )
}
