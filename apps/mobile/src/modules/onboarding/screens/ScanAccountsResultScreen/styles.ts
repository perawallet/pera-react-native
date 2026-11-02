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
    root: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    // Shrinks to the room between the text and the buttons, then scrolls:
    // a scan can turn a network on for every account in the wallet.
    accounts: {
        alignSelf: 'stretch',
        flexGrow: 0,
        flexShrink: 1,
        marginTop: theme.spacing.xl,
    },
    accountsContent: {
        gap: theme.spacing.sm,
        paddingBottom: 0,
    },
    account: {
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGray,
        borderRadius: theme.borderRadius.lg,
        paddingHorizontal: theme.spacing.md,
    },
}))
