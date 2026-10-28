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

import { useMemo } from 'react'

import {
    isSameOrigin,
    originOf,
    stripUrlScheme,
} from '@perawallet/wallet-core-shared'
import {
    resolveDisplayableVerificationTier,
    useProjectByUrlQuery,
} from '@perawallet/wallet-core-projects'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import { useSiteSafetyQuery } from '@perawallet/wallet-core-site-safety'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useLanguage } from '@hooks/useLanguage'

export const useSourceMetadataBadge = (
    metadata: SignRequestSource,
    verifiedOrigin?: string,
) => {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const { t } = useLanguage()
    const { data: project } = useProjectByUrlQuery({
        scope,
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

    // Same inputs as the sign gate, so this reads its cached verdict.
    const attestedOrigin = metadata.verification?.verifiedOrigin
    const { verdict } = useSiteSafetyQuery({
        urls: [metadata.url, verifiedOrigin, attestedOrigin],
        isFlaggedByWalletConnectVerify:
            metadata.verification?.status === 'scam',
        isEnabled: !!(metadata.url || verifiedOrigin || attestedOrigin),
    })

    // The lookup key (metadata.url) is peer-asserted, so a `verified` tier is
    // trusted only against the platform-observed origin.
    const verificationTier = resolveDisplayableVerificationTier(
        project,
        verifiedOrigin,
        verdict.kind !== 'clear',
    )

    const url = useMemo(() => stripUrlScheme(metadata.url), [metadata.url])

    // The name and url above are what the dApp claims about itself.
    const requestOriginLabel =
        verifiedOrigin && !isSameOrigin(verifiedOrigin, metadata.url)
            ? t('dapp.approval.request_origin', {
                  origin: stripUrlScheme(
                      originOf(verifiedOrigin) ?? verifiedOrigin,
                  ),
              })
            : undefined

    return {
        displayIcon,
        displayName,
        url,
        verificationTier,
        requestOriginLabel,
    }
}
