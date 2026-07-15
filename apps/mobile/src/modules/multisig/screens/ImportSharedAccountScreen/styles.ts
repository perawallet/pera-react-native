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
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    bodyContent: {
        paddingTop: theme.spacing.lg,
        gap: theme.spacing.lg,
    },
    toolbarTitle: {
        alignItems: 'center',
        gap: theme.spacing.xxs,
    },
    toolbarAddress: {
        color: theme.colors.textGray,
        textAlign: 'center',
    },
    headerBackButton: {
        marginLeft: theme.spacing.md,
    },
    sectionHeading: {
        color: theme.colors.textGray,
        marginTop: theme.spacing.sm,
    },
    participantRow: {
        paddingVertical: theme.spacing.md,
    },
    centerState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.xl,
        gap: theme.spacing.md,
    },
    stateBody: {
        color: theme.colors.textGray,
        textAlign: 'center',
    },
    footerContent: {
        gap: theme.spacing.sm,
    },
    bottomActions: {
        flexDirection: 'row',
        gap: theme.spacing.md,
    },
    ignoreButton: {
        flex: 1,
    },
    addButton: {
        flex: 2,
    },
    alreadyImportedNote: {
        color: theme.colors.textGray,
        textAlign: 'center',
    },
}))
