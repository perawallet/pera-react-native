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
import { getTypography } from '@theme/typography'

export const useStyles = makeStyles(theme => {
    const bodyTypography = getTypography(theme, 'body')

    return {
        externalContainer: {
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            backgroundColor: theme.colors.background,
        },
        container: {
            backgroundColor: theme.colors.layerGrayLighter,
            borderRadius: theme.spacing.xxl,
            height: theme.spacing['3xl'],
            overflow: 'hidden',
            position: 'relative',
            flexDirection: 'row',
        },
        labelContainer: {
            alignItems: 'center',
            justifyContent: 'center',
        },
        activeLayer: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
        },
        indicatorWrapper: {
            position: 'absolute',
            height: '100%',
            top: 0,
            left: 0,
        },
        indicator: {
            flex: 1,
            backgroundColor: theme.colors.white,
            height: theme.spacing.xxl,
            margin: theme.spacing.xs,
            borderRadius: theme.spacing.xxl,
            ...theme.shadows.md,
        },
        title: {
            fontFamily: bodyTypography.fontFamily,
            fontSize: bodyTypography.fontSize,
            fontWeight: '600',
            textTransform: 'none',
        },
        activeTitle: {
            color: theme.colors.black,
        },
        inactiveTitle: {
            color: theme.colors.textGray,
        },
        tab: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
        },
    }
})
