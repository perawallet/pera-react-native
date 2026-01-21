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

import { ZINDEX_ORDER } from '@constants/ui'
import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => {
    return {
        container: {
            flex: 1,
            backgroundColor: theme.colors.background,
            paddingHorizontal: theme.spacing.lg,
        },
        iconBar: {
            padding: 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: theme.spacing.lg,
        },
        iconBarColumn: {
            width: '33.3333%',
            flexDirection: 'row',
            justifyContent: 'center',
            textAlign: 'center',
            gap: theme.spacing.xl,
        },
        menuContainer: {
            gap: theme.spacing.md,
            flex: 1,
            flexDirection: 'column',
            marginTop: theme.spacing.xl,
        },
        scannerClose: {
            marginTop: theme.spacing.xl,
            marginLeft: theme.spacing.lg,
            width: theme.spacing['3xl'],
            height: theme.spacing['3xl'],
            zIndex: ZINDEX_ORDER.layer2,
        },
    }
})
