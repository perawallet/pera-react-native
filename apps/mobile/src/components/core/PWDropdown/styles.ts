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

const DROPDOWN_MIN_WIDTH = 200

export const useStyles = makeStyles(theme => ({
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
    },
    label: {
        color: theme.colors.textMain,
    },
    labelDestructive: {
        color: theme.colors.alertNegative,
    },
}))
