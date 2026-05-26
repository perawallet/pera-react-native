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

export const useStyles = makeStyles((theme, { bottomInset }: StyleProps) => ({
    // Default bottom padding so scroll content clears the bottom edge. Mirrors
    // PWFlatList; in a sheet it also adds the safe-area inset so content clears
    // the nav bar (the sheet draws edge-to-edge). Callers opt out by setting
    // their own bottom padding on `contentContainerStyle`.
    contentContainer: {
        paddingBottom: theme.spacing.xl + bottomInset,
    },
}))
