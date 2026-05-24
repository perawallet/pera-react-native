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
    container: {
        paddingVertical: theme.spacing.lg,
    },
    addressCard: {
        marginHorizontal: theme.spacing.xl,
        marginBottom: theme.spacing.lg,
        padding: theme.spacing.lg,
        backgroundColor: theme.colors.layerGrayLighter,
        borderRadius: theme.borderRadius.lg,
    },
    addressLabel: {
        color: theme.colors.textGray,
        marginBottom: theme.spacing.xs,
    },
    addressText: {
        color: theme.colors.textMain,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.lg,
        paddingHorizontal: theme.spacing.xl,
        gap: theme.spacing.lg,
    },
    optionTextContainer: {
        flex: 1,
        flexDirection: 'column',
    },
    optionSubtitle: {
        color: theme.colors.textGray,
    },
}))
