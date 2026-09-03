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

import { makeStyles } from '@rneui/themed'
import type { ScaledSize } from 'react-native'

const DOT_SIZE = 6
const DOT_RADIUS = 3

export const useStyles = makeStyles((theme, dimensions: ScaledSize) => {
    const mediaSize = dimensions.width - 2 * theme.spacing.xl

    return {
        image: {
            width: mediaSize,
            height: mediaSize,
            borderRadius: theme.borderRadius.lg,
            overflow: 'hidden',
        },
        videoPlayer: {
            width: mediaSize,
            height: mediaSize,
            borderRadius: theme.borderRadius.lg,
            overflow: 'hidden',
        },
        placeholder: {
            width: mediaSize,
            height: mediaSize / 2,
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
            alignSelf: 'center',
            marginVertical: theme.spacing.lg,
        },
        page: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
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
            height: mediaSize + 2 * theme.spacing.lg,
        },
    }
})
