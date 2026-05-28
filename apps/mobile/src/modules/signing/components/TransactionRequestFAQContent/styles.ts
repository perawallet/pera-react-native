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
    const warning = {
        alignSelf: 'stretch' as const,
        textAlign: 'left' as const,
        fontWeight: 'bold' as const,
    }
    return {
        container: {
            padding: theme.spacing.xl,
            gap: theme.spacing.xl,
            alignItems: 'center',
        },
        icon: {
            marginVertical: theme.spacing.md,
        },
        title: {
            alignSelf: 'stretch' as const,
            textAlign: 'center' as const,
        },
        message: {
            alignSelf: 'stretch' as const,
            textAlign: 'left' as const,
        },
        warning,
        button: {
            alignSelf: 'stretch' as const,
        },
    }
})
