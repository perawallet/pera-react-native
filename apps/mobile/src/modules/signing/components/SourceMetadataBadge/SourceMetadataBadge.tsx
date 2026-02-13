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

import { PWIcon, PWImage, PWText, PWView } from '@components/core'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import { useStyles } from './styles'
import { useMemo } from 'react'
import { stripUrlScheme } from '@perawallet/wallet-core-shared'

export type SourceMetadataBadgeProps = {
    metadata: SignRequestSource
}

export const SourceMetadataBadge = ({ metadata }: SourceMetadataBadgeProps) => {
    const styles = useStyles()
    const preferredIcon =
        metadata.icons?.find(
            icon =>
                icon.endsWith('.png') ||
                icon.endsWith('.jpg') ||
                icon.endsWith('.jpeg'),
        ) ?? metadata.icons?.at(0)

    const url = useMemo(() => stripUrlScheme(metadata.url), [metadata.url])

    return (
        <PWView style={styles.container}>
            {preferredIcon ? (
                <PWImage
                    source={{ uri: preferredIcon }}
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
            {!!metadata.name && (
                <PWText
                    variant='caption'
                    style={styles.name}
                >
                    {metadata.name}
                </PWText>
            )}
            {!!metadata.name && !!metadata.url && (
                <PWText
                    variant='caption'
                    style={styles.separator}
                >
                    &middot;
                </PWText>
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
