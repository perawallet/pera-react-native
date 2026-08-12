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

export const useStyles = makeStyles(theme => {
    return {
        trigger: {
            flexShrink: 1,
            minWidth: 0,
        },
        container: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingRight: theme.spacing.md,
            paddingLeft: theme.spacing.xs,
            gap: theme.spacing.sm,
            // Full radius so the trigger stays pill-shaped when the account
            // renders two lines (name/address + NFD).
            borderRadius: theme.borderRadius.full,
            backgroundColor: theme.colors.background,
        },
    }
})
