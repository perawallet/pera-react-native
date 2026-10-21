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

const SQUARE_BUTTON_SIZE = 32

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
    networkCard: {
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGray,
        borderRadius: theme.borderRadius.lg,
        backgroundColor: theme.colors.layerGrayLightest,
    },
    networkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        minWidth: 0,
    },
    networkText: {
        flex: 1,
        minWidth: 0,
    },
    networkAddress: {
        color: theme.colors.textGray,
    },
    networkActions: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
    },
    squareButton: {
        width: SQUARE_BUTTON_SIZE,
        height: SQUARE_BUTTON_SIZE,
        borderRadius: theme.borderRadius.sm,
        backgroundColor: theme.colors.buttonSquareBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chevronExpanded: {
        transform: [{ rotate: '180deg' }],
    },
    expandedSection: {
        borderTopWidth: theme.borders.sm,
        borderTopColor: theme.colors.layerGray,
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
    stackedChainIcon: {
        marginLeft: -theme.spacing.xs,
    },
    sharedAccountOptions: {
        marginBottom: theme.spacing.lg,
    },
}))
