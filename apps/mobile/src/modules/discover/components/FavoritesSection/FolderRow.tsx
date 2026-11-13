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

import {
  PWIcon,
  PWText,
  PWTouchableOpacity,
  PWView,
  type IconName,
} from "@components/core";
import { useLanguage } from "@hooks/useLanguage";
import { useStyles } from "./styles";

export type FolderRowProps = {
  name: string;
  count: number;
  icon: Extract<IconName, "folder" | "star">;
  onPress: () => void;
  testID?: string;
};

/** A favorites folder (or the All favorites entry): icon, name, "N dApps", chevron. */
export const FolderRow = ({
  name,
  count,
  icon,
  onPress,
  testID,
}: FolderRowProps) => {
  const styles = useStyles();
  const { t } = useLanguage();

  return (
    <PWTouchableOpacity style={styles.row} onPress={onPress} testID={testID}>
      <PWView style={styles.icon}>
        <PWIcon name={icon} variant="secondary" />
      </PWView>
      <PWView style={styles.info}>
        <PWText variant="h4" numberOfLines={1}>
          {name}
        </PWText>
        <PWText variant="caption" style={styles.count}>
          {t("discover.favorites.dapp_count", { count })}
        </PWText>
      </PWView>
      <PWView style={styles.chevron}>
        <PWIcon name="chevron-right" size="sm" variant="secondary" />
      </PWView>
    </PWTouchableOpacity>
  );
};
