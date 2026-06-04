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

type StyleProps = { bottomInset: number }

export const useStyles = makeStyles((theme, { bottomInset }: StyleProps) => {
    const warning = {
        alignSelf: 'stretch' as const,
        textAlign: 'left' as const,
        fontWeight: 'bold' as const,
    }
    return {
        // The sheet draws edge-to-edge, so add the bottom safe-area inset to
        // keep the close button clear of the home indicator.
        container: {
            padding: theme.spacing.xl,
            gap: theme.spacing.xl,
            alignItems: 'center',
            paddingBottom: theme.spacing.xl + bottomInset,
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
