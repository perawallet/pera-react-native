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

// The ring gets its own view because RN counts borders inside min sizes.
export const useStyles = makeStyles(theme => ({
    ring: {
        borderRadius: theme.borderRadius.full,
        borderWidth: theme.borders.md,
        borderColor: theme.colors.background,
    },
    disc: {
        minWidth: theme.spacing.lg,
        minHeight: theme.spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.borderRadius.full,
        backgroundColor: theme.colors.layerGrayLighter,
    },
}))
