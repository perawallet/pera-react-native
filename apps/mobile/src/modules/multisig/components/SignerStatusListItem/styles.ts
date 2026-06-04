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

export const useStyles = makeStyles(theme => ({
    // Card skin merged onto the layout row; overrides its default vertical
    // padding/gap and adds the trailing horizontal padding + border.
    container: {
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        gap: theme.spacing.md,
        borderRadius: theme.spacing.sm,
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGray,
        backgroundColor: theme.colors.background,
    },
}))
