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

import { makeStyles } from "@rneui/themed";

export const useStyles = makeStyles((theme) => ({
  card: {
    borderRadius: theme.spacing.md,
    overflow: "hidden",
    backgroundColor: theme.colors.layerGray,
  },
  banner: {
    width: "100%",
    aspectRatio: 2,
    backgroundColor: theme.colors.layerGray,
  },
  body: {
    gap: theme.spacing.xs,
    padding: theme.spacing.lg,
  },
  date: {
    color: theme.colors.textGray,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  read: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xxs,
  },
}));
