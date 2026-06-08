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

export const useStyles = makeStyles(theme => {
    return {
        externalContainer: {
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.sm,
            backgroundColor: theme.colors.background,
        },
        container: {
            backgroundColor: theme.colors.layerGrayLighter,
            borderRadius: theme.spacing.xxl,
            // minHeight (not height) so the bar grows when labels wrap to a
            // second line under large accessibility font sizes.
            minHeight: theme.spacing['3xl'],
            overflow: 'hidden',
            position: 'relative',
            flexDirection: 'row',
        },
        labelContainer: {
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'stretch',
            width: '100%',
            paddingHorizontal: theme.spacing.xs,
        },
        labelTextContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
            maxWidth: '100%',
            minWidth: 0,
            flexShrink: 1,
        },
        activeLayer: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'row',
            gap: theme.spacing.xs,
            paddingHorizontal: theme.spacing.md,
        },
        indicatorWrapper: {
            position: 'absolute',
            height: '100%',
            top: 0,
            left: 0,
        },
        indicator: {
            flex: 1,
            backgroundColor: theme.colors.background,
            height: theme.spacing.xxl,
            margin: theme.spacing.xs,
            borderRadius: theme.spacing.xxl,
            ...theme.shadows.md,
        },
        label: {
            textTransform: 'none',
            flexShrink: 1,
            minWidth: 0,
            textAlign: 'center',
        },
        activeTitle: {
            color: theme.colors.textMain,
        },
        inactiveTitle: {
            color: theme.colors.textGray,
        },
        tab: {
            flex: 1,
            minWidth: 0,
            alignItems: 'center',
            justifyContent: 'center',
            // Vertical padding gives wrapped (2-line) labels breathing room;
            // height is left to flex/stretch so the tab grows with its label.
            paddingVertical: theme.spacing.xs,
        },
    }
})
