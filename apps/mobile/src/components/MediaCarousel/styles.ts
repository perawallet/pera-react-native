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

export const useStyles = makeStyles((theme, dimensions: ScaledSize) => {
    // lanekeep-ignore-next-line pera/no-numeric-sizes reason: window width minus xl padding on each side
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
        counter: {
            position: 'absolute',
            top: theme.spacing.md,
            right: theme.spacing.md,
            borderRadius: theme.borderRadius.sm,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: theme.spacing.xxs,
            backgroundColor: theme.colors.nftIconBg,
        },
        counterText: {
            color: theme.colors.textWhite,
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
            // The pager already leaves lg under the media; xl below keeps the
            // dots grouped with the media rather than the action row.
            marginBottom: theme.spacing.xl,
        },
        dot: {
            width: theme.spacing.sm,
            height: theme.spacing.sm,
            borderRadius: theme.borderRadius.full,
            backgroundColor: theme.colors.textGrayLighter,
        },
        dotActive: {
            width: theme.spacing.lg,
            backgroundColor: theme.colors.textMain,
        },
        pagerView: {
            // lanekeep-ignore-next-line pera/no-numeric-sizes reason: pager is the media plus lg above and below
            height: mediaSize + 2 * theme.spacing.lg,
        },
    }
})
