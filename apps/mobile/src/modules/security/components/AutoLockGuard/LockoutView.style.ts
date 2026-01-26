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
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    lockoutContainer: {
        flex: 1,
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing['4xl'],
        paddingBottom: theme.spacing.xxl,
    },
    lockoutContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    lockoutIconContainer: {
        width: 80,
        height: 80,
        borderRadius: theme.spacing.sm,
        backgroundColor: theme.colors.error,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing['4xl'],
    },
    lockoutTitle: {
        textAlign: 'center',
        marginBottom: theme.spacing.sm,
    },
    lockoutSubtitle: {
        color: theme.colors.textGray,
        textAlign: 'center',
        marginBottom: theme.spacing.xxl,
    },
    lockoutActions: {
        paddingTop: theme.spacing.lg,
    },
    divider: {
        paddingBottom: theme.spacing.xxl,
        marginBottom: theme.spacing.xxl,
        borderBottomWidth: theme.borders.sm,
        borderBottomColor: theme.colors.layerGrayLighter,
    },
}))
