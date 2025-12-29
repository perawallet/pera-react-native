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

export const useStyles = makeStyles(theme => {
    return {
        container: {
            flex: 1,
        },
        scannerClose: {
            marginTop: theme.spacing.xxl,
            marginLeft: theme.spacing.lg,
            width: theme.spacing['3xl'],
            height: theme.spacing['3xl'],
            alignItems: 'center',
            justifyContent: 'center',
        },
        listContainer: {
            flexGrow: 1,
            padding: theme.spacing.xl,
        },
        emptyView: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.colors.background,
        },
        sessionItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.lg,
            padding: theme.spacing.md,
        },
        sessionInfo: {
            flex: 1,
        },
        sessionNameContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
        },
        icon: {
            width: theme.spacing.xl,
            height: theme.spacing.xl,
        },
        listFooter: {
            flex: 1,
            justifyContent: 'flex-end',
            paddingBottom: theme.spacing['3xl'],
        },
    }
})
