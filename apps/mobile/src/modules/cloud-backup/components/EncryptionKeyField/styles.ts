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

export const useStyles = makeStyles(theme => ({
    // alignSelf is a no-op in a stretch column; it keeps the field full-width
    // inside the confirm sheet's centred container.
    section: {
        alignSelf: 'stretch',
        gap: theme.spacing.sm,
    },
    label: {
        color: theme.colors.textGray,
    },
    keyField: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        minHeight: theme.spacing['3xl'] + theme.spacing.sm,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.borderRadius.sm,
        backgroundColor: theme.colors.layerGrayLightest,
    },
    keyText: {
        flex: 1,
        minWidth: 0,
    },
}))
