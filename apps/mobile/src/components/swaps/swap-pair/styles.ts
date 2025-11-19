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
    headerContainer: {
        gap: theme.spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerText: {
        color: theme.colors.helperPositive,
    },
    itemScrollContainer: {
        gap: theme.spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: theme.spacing.sm,
    },
    itemContainer: {
        paddingVertical: theme.spacing.xs,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.spacing.lg,
        backgroundColor: theme.colors.background,
        boxShadow: '0px 2px 4px -1px #00000014',
        borderWidth: 1,
        borderColor: theme.colors.layerGrayLighter,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.lg,
    },
    itemIconContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 48,
    },
    fromIcon: {
        position: 'absolute',
        left: -5,
        top: 7,
        borderColor: theme.colors.background,
        borderWidth: 2,
        width: theme.spacing.xl,
        height: theme.spacing.xl,
    },
    toIcon: {
        position: 'relative',
        borderWidth: 2,
        borderColor: theme.colors.background,
        borderRadius: theme.spacing.xl / 2,
        left: 6,
        bottom: -6,
        zIndex: 2,
        width: theme.spacing.xl,
        height: theme.spacing.xl,
    },
}))
