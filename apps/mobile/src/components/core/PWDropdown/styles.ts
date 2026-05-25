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

export const DROPDOWN_MIN_WIDTH = 200

// Cap the menu at 80% of the screen so a long label can't push it edge-to-edge;
// labels that still don't fit truncate at this width rather than overflowing.
export const DROPDOWN_MAX_WIDTH_RATIO = 0.8

type StyleProps = {
    windowWidth: number
}

export const useStyles = makeStyles((theme, { windowWidth }: StyleProps) => ({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    dropdown: {
        position: 'absolute',
        backgroundColor: theme.colors.background,
        borderRadius: theme.spacing.xl,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        minWidth: DROPDOWN_MIN_WIDTH,
        maxWidth: windowWidth * DROPDOWN_MAX_WIDTH_RATIO,
        overflow: 'hidden',
        ...theme.shadows.md,
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGray,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        gap: theme.spacing.md,
        minWidth: 0,
    },
    labelContainer: {
        flexShrink: 1,
        minWidth: 0,
    },
    label: {
        color: theme.colors.textMain,
    },
    labelDestructive: {
        color: theme.colors.alertNegative,
    },
}))
