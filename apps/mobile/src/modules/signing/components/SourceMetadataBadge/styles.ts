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

// lanekeep-ignore-next-line pera/no-numeric-sizes reason: source badge icon size
const ICON_SIZE = 24

export const useStyles = makeStyles(theme => ({
    wrapper: {
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        maxWidth: '100%',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        paddingLeft: theme.spacing.xs,
        paddingRight: theme.spacing.md,
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGray,
        borderRadius: theme.borderRadius.full,
        backgroundColor: theme.colors.background,
    },
    iconFrame: {
        width: ICON_SIZE,
        height: ICON_SIZE,
        borderRadius: theme.borderRadius.full,
        overflow: 'hidden',
    },
    icon: {
        width: ICON_SIZE,
        height: ICON_SIZE,
    },
    iconFallback: {
        width: ICON_SIZE,
        height: ICON_SIZE,
        borderRadius: theme.borderRadius.full,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.layerGrayLighter,
    },
    url: {
        flexShrink: 1,
        color: theme.colors.textMain,
    },
    requestOrigin: {
        textAlign: 'center',
        color: theme.colors.textGray,
    },
}))
