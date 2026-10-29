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
    topActions: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        paddingHorizontal: theme.spacing.xl,
        marginBottom: theme.spacing.lg,
    },
    topAction: {
        flex: 1,
    },
    accountInfoContainer: {
        paddingHorizontal: theme.spacing.xl,
        marginBottom: theme.spacing.lg,
    },
    networksTitle: {
        paddingHorizontal: theme.spacing.xl,
        marginBottom: theme.spacing.md,
    },
    networkList: {
        paddingHorizontal: theme.spacing.xl,
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.lg,
    },
    seeAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        padding: theme.spacing.md,
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGray,
        borderRadius: theme.borderRadius.lg,
        backgroundColor: theme.colors.layerGrayLightest,
    },
    chainIconStack: {
        flexDirection: 'row',
    },
    // The ring matches seeAllButton's fill so each overlapping icon stays distinct.
    stackedChainIcon: {
        marginLeft: -theme.spacing.xs,
        borderWidth: theme.borders.md,
        borderColor: theme.colors.layerGrayLightest,
        borderRadius: theme.borderRadius.full,
    },
    sharedAccountOptions: {
        marginBottom: theme.spacing.lg,
    },
}))
