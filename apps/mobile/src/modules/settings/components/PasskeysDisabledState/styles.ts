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
    disabledContainer: {
        flex: 1,
        padding: theme.spacing.xl,
        gap: theme.spacing.xl,
    },
    disabledHero: {
        alignItems: 'center',
        gap: theme.spacing.xl,
        paddingTop: theme.spacing['3xl'],
    },
    disabledBody: {
        textAlign: 'center',
        color: theme.colors.textMain,
    },
    infoCard: {
        marginTop: 'auto',
        padding: theme.spacing.xl,
        gap: theme.spacing.xl,
        backgroundColor: theme.colors.layerGrayLighter,
        borderRadius: theme.borderRadius.md,
    },
    infoHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    infoCardBody: {
        color: theme.colors.textGray,
    },
}))
