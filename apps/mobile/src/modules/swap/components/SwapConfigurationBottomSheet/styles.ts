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
        paddingBottom: theme.spacing.xl,
    },
    section: {
        paddingHorizontal: theme.spacing.lg,
        marginBottom: theme.spacing.xl,
    },
    sectionTitle: {
        color: theme.colors.textGray,
        marginBottom: theme.spacing.sm,
    },
    inputContainer: {
        paddingHorizontal: 0,
    },
    inputInnerContainer: {
        borderRadius: theme.spacing.xs,
        paddingHorizontal: theme.spacing.sm,
    },
    input: {
        paddingLeft: 0,
    },
    errorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: theme.spacing.xs,
    },
    errorText: {
        color: theme.colors.negative,
        marginLeft: theme.spacing.sm,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.sm,
        marginTop: theme.spacing.md,
    },
    currencyToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: theme.spacing.md,
    },
    currencyToggleLabel: {
        color: theme.colors.textMain,
        flex: 1,
    },
}))

type ChipStyleProps = {
    isSelected: boolean
}

export const useChipStyles = makeStyles(
    (theme, { isSelected }: ChipStyleProps) => ({
        container: {
            backgroundColor: isSelected
                ? theme.colors.positiveLighter
                : theme.colors.layerGrayLighter,
            borderRadius: theme.borderRadius.full,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
        },
        label: {
            color: isSelected ? theme.colors.positive : theme.colors.textGray,
        },
    }),
)
