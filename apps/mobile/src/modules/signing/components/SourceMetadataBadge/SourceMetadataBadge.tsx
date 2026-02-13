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
