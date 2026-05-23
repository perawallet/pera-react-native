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
        paddingTop: theme.spacing.xxl,
    },
    headerButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
    },
    header: {
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    name: {
        textAlign: 'center',
        color: theme.colors.textMain,
    },
    shortAddress: {
        color: theme.colors.textGrayLighter,
        textAlign: 'center',
    },
    divider: {
        height: theme.borders.sm,
        backgroundColor: theme.colors.layerGrayLighter,
        marginVertical: theme.spacing.xl,
    },
    addressSection: {
        gap: theme.spacing.sm,
    },
    nfdSection: {
        marginTop: theme.spacing.xl,
    },
    addressLabel: {
        color: theme.colors.textMain,
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.md,
    },
    addressTextWrapper: {
        flex: 1,
    },
    fullAddress: {
        color: theme.colors.textMain,
    },
}))
