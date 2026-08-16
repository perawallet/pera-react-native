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

import { useCallback, useMemo } from 'react'
import { useAssetAuthoritiesQuery } from '@perawallet/wallet-core-assets'
import { type Nullable } from '@perawallet/wallet-core-shared'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { type IconName } from '@components/core/PWIcon/constants'
import { type AssetSecurityTagVariant } from '../AssetSecurityTag'
import {
    AssetSecurityInfoContent,
    type AssetSecurityAuthority,
} from '../AssetSecurityInfoContent'

type TagDescriptor = {
    iconName: IconName
    label: string
    variant: AssetSecurityTagVariant
    testID: string
    onPress: () => void
}

type UseAssetSecurityTagsResult = {
    isVisible: boolean
    freezeTag: TagDescriptor
    clawbackTag: TagDescriptor
}

type AuthorityPreset = {
    iconName: IconName
    testID: string
    activeLabelKey: string
    inactiveLabelKey: string
}

const AUTHORITY_PRESETS: Record<AssetSecurityAuthority, AuthorityPreset> = {
    freeze: {
        iconName: 'snowflake',
        testID: 'asset-freeze-tag',
        activeLabelKey: 'asset_details.markets.freeze',
        inactiveLabelKey: 'asset_details.markets.no_freeze',
    },
    clawback: {
        iconName: 'undo',
        testID: 'asset-clawback-tag',
        activeLabelKey: 'asset_details.markets.clawback',
        inactiveLabelKey: 'asset_details.markets.no_clawback',
    },
}

const useSecurityInfoSheet = () => {
    const { request } = useBottomSheet()

    return useCallback(
        (authority: AssetSecurityAuthority, address: Nullable<string>) => {
            void request<void>({
                contents: (
                    <AssetSecurityInfoContent
                        authority={authority}
                        address={address}
                    />
                ),
                options: { size: 'auto', enablePanDownToClose: true },
            })
        },
        [request],
    )
}

const useSecurityTagBuilder = () => {
    const { t } = useLanguage()
    const openInfoSheet = useSecurityInfoSheet()

    return useCallback(
        (
            authority: AssetSecurityAuthority,
            isActive: boolean,
            address: Nullable<string>,
        ): TagDescriptor => {
            const preset = AUTHORITY_PRESETS[authority]

            return {
                iconName: preset.iconName,
                testID: preset.testID,
                variant: isActive ? 'warning' : 'neutral',
                label: t(
                    isActive ? preset.activeLabelKey : preset.inactiveLabelKey,
                ),
                onPress: () => openInfoSheet(authority, address),
            }
        },
        [t, openInfoSheet],
    )
}

export const useAssetSecurityTags = (
    assetId: string,
): UseAssetSecurityTagsResult => {
    const buildTag = useSecurityTagBuilder()
    const {
        hasFreeze,
        hasClawback,
        freezeAddress,
        clawbackAddress,
        isSuccess,
    } = useAssetAuthoritiesQuery(assetId)

    return useMemo(
        () => ({
            isVisible: isSuccess,
            freezeTag: buildTag('freeze', hasFreeze, freezeAddress),
            clawbackTag: buildTag('clawback', hasClawback, clawbackAddress),
        }),
        [
            buildTag,
            hasFreeze,
            hasClawback,
            freezeAddress,
            clawbackAddress,
            isSuccess,
        ],
    )
}
