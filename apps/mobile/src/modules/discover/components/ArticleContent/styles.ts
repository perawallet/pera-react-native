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
  container: {
    gap: theme.spacing.md,
  },
  italic: {
    fontStyle: "italic",
  },
  link: {
    color: theme.colors.linkPrimary,
  },
  listItem: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  listMarker: {
    minWidth: theme.spacing.lg,
  },
  listBody: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  list: {
    gap: theme.spacing.xs,
  },
  quote: {
    gap: theme.spacing.sm,
    paddingLeft: theme.spacing.md,
    borderLeftWidth: theme.spacing.xxs,
    borderLeftColor: theme.colors.layerGray,
  },
  code: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.layerGrayLighter,
  },
  rule: {
    height: theme.borders.sm,
    backgroundColor: theme.colors.layerGray,
  },
  image: {
    width: "100%",
    borderRadius: theme.borderRadius.sm,
  },
}));
