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
    // A 16pt icon in sm padding: the design's 32pt square.
    squareButton: {
        padding: theme.spacing.sm,
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
}))
