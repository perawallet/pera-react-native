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

export const useStyles = makeStyles(theme => {
    return {
        row: {
            flexDirection: 'row',
            paddingVertical: theme.spacing.md,
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: theme.spacing.md,
        },
        content: {
            flex: 1,
            // minWidth:0 lets the label truncate instead of overflowing the flex row.
            minWidth: 0,
        },
        radioContainer: {
            borderWidth: theme.borders.sm,
            borderRadius: theme.spacing.xl,
            borderColor: theme.colors.layerGray,
            width: theme.spacing.xl,
            height: theme.spacing.xl,
            justifyContent: 'center',
            alignItems: 'center',
            flexShrink: 0,
        },
        selectedBorder: {
            borderColor: theme.colors.positive,
        },
        selectedRadio: {
            borderRadius: theme.spacing.lg,
            width: theme.spacing.md,
            height: theme.spacing.md,
            backgroundColor: theme.colors.positive,
        },
        disabled: {
            opacity: 0.5,
        },
    }
})
