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

import { useStyles } from './styles'
import { useAssetFavoriteButton } from './useAssetFavoriteButton'
import {
    PWRoundIcon,
    PWTouchableOpacity,
    type PWTouchableOpacityProps,
} from '@components/core'

export type AssetFavoriteButtonProps = {
    assetId: string
    isFavorite?: boolean
} & Omit<PWTouchableOpacityProps, 'onPress'>

export const AssetFavoriteButton = ({
    assetId,
    isFavorite,
    style,
    ...rest
}: AssetFavoriteButtonProps) => {
    const styles = useStyles()
    const { handleToggleFavorite, isDisabled, isUnavailableOnNetwork } =
        useAssetFavoriteButton(assetId, isFavorite)

    return (
        <PWTouchableOpacity
            onPress={handleToggleFavorite}
            // Unavailable stays tappable so the press can explain why —
            // only the visual disabled state applies.
            disabled={isDisabled && !isUnavailableOnNetwork}
            style={[isUnavailableOnNetwork && styles.unavailable, style]}
            {...rest}
        >
            <PWRoundIcon
                icon={isFavorite ? 'star-filled' : 'star'}
                size='sm'
                variant={isFavorite ? 'favorite' : 'secondary'}
                style={styles.icon}
            />
        </PWTouchableOpacity>
    )
}
