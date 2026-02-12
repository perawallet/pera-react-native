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

import { PWButton, PWIcon, PWImage, PWText, PWView } from '@components/core'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import { useWebView } from '@hooks/usePeraWebviewInterface'
import { v7 as uuid } from 'uuid'
import { useStyles } from './styles'

export type SourceMetadataViewProps = {
    metadata: SignRequestSource
}

export const SourceMetadataView = ({ metadata }: SourceMetadataViewProps) => {
    const styles = useStyles()
    const preferredIcon =
        metadata.icons?.find(
            icon =>
                icon.endsWith('.png') ||
                icon.endsWith('.jpg') ||
                icon.endsWith('.jpeg'),
        ) ?? metadata.icons?.at(0)
    const { pushWebView } = useWebView()

    const handlePressUrl = () => {
        if (!metadata.url) return
        pushWebView({ id: uuid(), url: metadata.url })
    }

    return (
        <PWView style={styles.container}>
            {preferredIcon ? (
                <PWImage
                    source={{ uri: preferredIcon }}
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
                <PWText
                    variant='h3'
                    style={styles.title}
                >
                    {metadata.name}
                </PWText>
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
