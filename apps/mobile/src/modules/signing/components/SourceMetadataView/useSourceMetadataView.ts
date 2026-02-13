import { useMemo } from 'react'

import { stripUrlScheme } from '@perawallet/wallet-core-shared'
import { useProjectByUrlQuery } from '@perawallet/wallet-core-projects'
import { SignRequestSource } from '@perawallet/wallet-core-signing'
import { useWebView } from '@hooks/usePeraWebviewInterface'
import { v4 as uuid } from 'uuid'

export const useSourceMetadataView = (metadata: SignRequestSource) => {
    const { data: project } = useProjectByUrlQuery({
        url: metadata.url,
        isEnabled: !!metadata.url,
    })

    const preferredIcon =
        metadata.icons?.find(
            icon =>
                icon.endsWith('.png') ||
                icon.endsWith('.jpg') ||
                icon.endsWith('.jpeg'),
        ) ?? metadata.icons?.at(0)

    const displayIcon = project?.logoPng ?? preferredIcon
    const displayName = project?.name ?? metadata.name

    const url = useMemo(() => stripUrlScheme(metadata.url), [metadata.url])

    const { pushWebView } = useWebView()

    const handlePressUrl = () => {
        if (!metadata.url) return
        pushWebView({ id: uuid(), url: metadata.url })
    }

    return {
        displayIcon,
        displayName,
        url,
        project,
        handlePressUrl,
    }
}
