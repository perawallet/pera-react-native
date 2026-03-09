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

const ICON_SIZE = 20

export const useStyles = makeStyles(theme => ({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        backgroundColor: theme.colors.modalityBg,
        borderRadius: ICON_SIZE,
        paddingVertical: theme.spacing.xs,
        paddingHorizontal: theme.spacing.md,
        gap: theme.spacing.sm,
    },
    icon: {
        width: ICON_SIZE,
        height: ICON_SIZE,
        borderRadius: ICON_SIZE / 2,
    },
    iconFallback: {
        width: ICON_SIZE,
        height: ICON_SIZE,
        borderRadius: ICON_SIZE / 2,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.layerGrayLighter,
    },
    name: {
        color: theme.colors.textWhite,
    },
    separator: {
        color: theme.colors.textGrayLighter,
    },
    url: {
        color: theme.colors.textGrayLighter,
    },
}))
