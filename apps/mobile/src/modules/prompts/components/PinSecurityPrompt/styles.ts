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
        gap: theme.spacing.lg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dontAskButton: {
        padding: theme.spacing.sm,
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        width: '100%',
    },
    content: {
        flexGrow: 1,
        marginTop: theme.spacing.xxl,
        gap: theme.spacing.lg,
    },
    title: {
        textAlign: 'left',
    },
    description: {
        textAlign: 'left',
    },
    buttonContainer: {
        gap: theme.spacing.lg,
    },
}))
