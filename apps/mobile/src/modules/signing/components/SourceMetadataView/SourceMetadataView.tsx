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

import { PWButton, PWIcon, PWImage, PWText, PWView } from '@components/core'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import { useStyles } from './styles'
import { useSourceMetadataView } from './useSourceMetadataView'
import { ProjectVerificationIcon } from '@modules/projects/components/ProjectVerificationIcon'

export type SourceMetadataViewProps = {
    metadata: SignRequestSource
    /** Origin the platform observed (never dApp-asserted); gates the verified badge. */
    verifiedOrigin?: string
}

export const SourceMetadataView = ({
    metadata,
    verifiedOrigin,
}: SourceMetadataViewProps) => {
    const styles = useStyles()

    const { displayIcon, displayName, verificationTier, handlePressUrl } =
        useSourceMetadataView(metadata, verifiedOrigin)

    return (
        <PWView style={styles.container}>
            {displayIcon ? (
                <PWImage
                    source={{ uri: displayIcon }}
                    style={styles.icon}
                />
            ) : (
                <PWView style={styles.iconContainer}>
                    <PWIcon
                        name='wallet-connect'
                        variant='secondary'
                        size='xl'
                    />
                </PWView>
            )}
            <PWView style={styles.titleContainer}>
                <PWView style={styles.nameRow}>
                    <PWText
                        variant='h3'
                        style={styles.title}
                    >
                        {displayName}
                    </PWText>
                    {!!verificationTier && (
                        <ProjectVerificationIcon
                            tier={verificationTier}
                            size='sm'
                        />
                    )}
                </PWView>
                {!!metadata.url && (
                    <PWButton
                        variant='link'
                        onPress={handlePressUrl}
                        title={metadata.url}
                    />
                )}
            </PWView>
        </PWView>
    )
}
