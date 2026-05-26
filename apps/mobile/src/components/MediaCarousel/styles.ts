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

import { makeStyles } from '@rneui/themed'
import { ScaledSize } from 'react-native'

const DOT_SIZE = 6
const DOT_RADIUS = 3

export const useStyles = makeStyles((theme, dimensions: ScaledSize) => {
    const maxWidth = dimensions.width - 2 * theme.spacing.xl
    const maxHeight = dimensions.width - 2 * theme.spacing.xl

    return {
        image: {
            width: '100%',
            height: '100%',
            borderRadius: theme.borderRadius.lg,
            overflow: 'hidden',
            maxWidth,
            maxHeight,
        },
        videoPlayer: {
            width: '100%',
            height: '100%',
            borderRadius: theme.borderRadius.lg,
            overflow: 'hidden',
            maxWidth,
            maxHeight,
        },
        imageContainer: {
            width: '100%',
            height: '100%',
        },
        placeholder: {
            // Reserve a compact, fixed media area for the no-image case.
            // `flex: 1` collapses to the icon's size (floating it up over the
            // content above), while a full square is too large for an empty
            // placeholder — half the media square reads as a tidy empty state.
            width: '100%',
            height: maxHeight / 2,
            alignItems: 'center',
            justifyContent: 'center',
        },
        modelBadge: {
            flexDirection: 'row',
            gap: theme.spacing.xs,
            position: 'absolute',
            borderRadius: theme.borderRadius.full,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: theme.spacing.xs,
            bottom: theme.spacing.md,
            left: theme.spacing.md,
            backgroundColor: theme.colors.nftIconBg,
            alignItems: 'center',
            justifyContent: 'center',
        },
        modelBadgeText: {
            color: theme.colors.textWhite,
        },
        fullScreenButton: {
            position: 'absolute',
            bottom: theme.spacing.md,
            right: theme.spacing.md,
            borderRadius: theme.borderRadius.sm,
            backgroundColor: theme.colors.nftIconBg,
            alignItems: 'center',
            justifyContent: 'center',
        },
        carouselItem: {
            width: '100%',
            maxWidth,
            maxHeight,
            // The maxWidth cap would otherwise left-align the item (and its
            // centered placeholder), shifting it off-centre on wider screens.
            alignSelf: 'center',
            // Vertical spacing lives on this box (not the media) so the media
            // fills it exactly and the absolute overlays (fullscreen / 3D
            // badge) land on the media's real corners.
            marginVertical: theme.spacing.lg,
        },
        indicator: {
            flexDirection: 'row',
            justifyContent: 'center',
            gap: theme.spacing.xs,
            marginTop: theme.spacing.sm,
        },
        dot: {
            width: DOT_SIZE,
            height: DOT_SIZE,
            borderRadius: DOT_RADIUS,
            backgroundColor: theme.colors.layerGrayLighter,
        },
        dotActive: {
            backgroundColor: theme.colors.textMain,
        },
        pagerView: {
            flex: 1,
            height: dimensions.width,
        },
    }
})
