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
import { getTypography } from '@theme/typography'

export const useStyles = makeStyles(theme => ({
    enterWrapper: {
        // Clip while the reveal grows height from 0; otherwise children
        // overflow visibly during the animation.
        overflow: 'hidden',
    },
    // Takes the banner out of flow at zero opacity so the measure pass can read
    // its natural height without the user seeing it.
    measurer: {
        position: 'absolute',
        left: 0,
        right: 0,
        opacity: 0,
    },
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.negative,
        paddingVertical: theme.spacing.lg,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.borderRadius.sm,
        gap: theme.spacing.sm,
    },
    text: {
        ...getTypography(theme, 'body'),
        flex: 1,
        color: theme.colors.textWhite,
        marginHorizontal: theme.spacing.xs,
    },
    ctaButton: {
        height: theme.spacing.xxl,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.borderRadius.xs,
        backgroundColor: theme.colors.bannerButton,
        justifyContent: 'center',
        alignItems: 'center',
    },
    ctaText: {
        ...getTypography(theme, 'body'),
        color: theme.colors.textWhite,
    },
}))
