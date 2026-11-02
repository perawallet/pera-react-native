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

// lanekeep-ignore-next-line pera/no-numeric-sizes reason: the hero's icon disc sits between TransactionIcon's md (48) and lg (72) steps
const ICON_DISC_SIZE = 60

export const useStyles = makeStyles(theme => ({
    // With the layout's gap below it, this leaves 24 to the first card.
    container: {
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingTop: theme.spacing.xl,
        paddingBottom: theme.spacing.sm,
        width: '100%',
    },
    icon: {
        width: ICON_DISC_SIZE,
        height: ICON_DISC_SIZE,
        borderRadius: ICON_DISC_SIZE / 2,
    },
    heading: {
        alignItems: 'center',
        width: '100%',
    },
    title: {
        color: theme.colors.textGray,
        textAlign: 'center',
    },
}))
