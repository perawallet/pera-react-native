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

import { useMemo } from 'react'

import {
    stripUrlScheme,
    generateUniqueId,
} from '@perawallet/wallet-core-shared'
import { useProjectByUrlQuery } from '@perawallet/wallet-core-projects'
import { SignRequestSource } from '@perawallet/wallet-core-signing'
import { useWebView } from '@hooks/usePeraWebviewInterface'

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

    const displayIcon = preferredIcon ?? project?.logoPng
    const displayName = metadata.name ?? project?.name

    const url = useMemo(() => stripUrlScheme(metadata.url), [metadata.url])

    const { pushWebView } = useWebView()

    const handlePressUrl = () => {
        if (!metadata.url) return
        pushWebView({ id: generateUniqueId(), url: metadata.url })
    }

    return {
        displayIcon,
        displayName,
        url,
        project,
        handlePressUrl,
    }
}
