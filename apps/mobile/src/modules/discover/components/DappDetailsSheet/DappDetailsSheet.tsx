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

import type { ChainId } from "@perawallet/wallet-core-chain-contract";
import type { Nullable } from "@perawallet/wallet-core-shared";
import {
  PWButton,
  PWIcon,
  PWImage,
  PWSheetLayout,
  PWText,
  PWTouchableOpacity,
  PWView,
} from "@components/core";
import { ProjectVerificationIcon } from "@modules/projects";
import { useLanguage } from "@hooks/useLanguage";
import type { DirectoryDapp } from "../../utils/dappDirectory";
import { useDappDetailsSheet } from "./useDappDetailsSheet";
import { useStyles } from "./styles";

export type DappDetailsSheetProps = {
  item: DirectoryDapp;
  chainId: Nullable<ChainId>;
  /** The project's tier at open time; a project's details do not change while the sheet is up. */
  isVerified: boolean;
};

export const DappDetailsSheet = ({
  item,
  chainId,
  isVerified,
}: DappDetailsSheetProps) => {
  const styles = useStyles();
  const { t } = useLanguage();
  const sheet = useDappDetailsSheet({ item, chainId });
  const { dapp } = item;

  // PWSheetLayout pads the sides and adds the bottom inset the sheet host leaves out.
  return (
    <PWSheetLayout testID="discover_dapp_details">
      <PWView style={styles.container}>
        <PWView>
          {item.backgroundImage ? (
            <PWImage
              source={{ uri: item.backgroundImage }}
              style={styles.banner}
            />
          ) : (
            <PWView style={styles.banner} />
          )}
          <PWView style={styles.logo}>
            {dapp.logo ? (
              <PWImage source={{ uri: dapp.logo }} style={styles.logoImage} />
            ) : (
              <PWIcon name="globe" variant="secondary" />
            )}
          </PWView>
        </PWView>
        <PWView style={styles.titleRow}>
          <PWText variant="h3" numberOfLines={2} style={styles.title}>
            {dapp.name}
          </PWText>
          {isVerified ? (
            <ProjectVerificationIcon tier="verified" size="sm" />
          ) : null}
          <PWTouchableOpacity
            style={styles.star}
            onPress={sheet.toggleFavorite}
            accessibilityLabel={t(
              sheet.isFavorite
                ? "discover.dapp_row.unfavorite"
                : "discover.dapp_row.favorite",
            )}
            testID="discover_dapp_details_star"
          >
            <PWIcon
              name={sheet.isFavorite ? "star-filled" : "star"}
              variant={sheet.isFavorite ? "favorite" : "secondary"}
            />
          </PWTouchableOpacity>
        </PWView>
        {item.description ? (
          <PWView style={styles.section}>
            <PWText variant="caption" style={styles.label}>
              {t("discover.dapps.about")}
            </PWText>
            <PWText testID="discover_dapp_details_description">
              {item.description}
            </PWText>
          </PWView>
        ) : null}
        <PWView style={styles.section}>
          <PWText variant="caption" style={styles.label}>
            {t("discover.dapps.website")}
          </PWText>
          <PWText>{sheet.host}</PWText>
        </PWView>
        <PWButton
          variant="primary"
          title={t("discover.dapps.open")}
          onPress={sheet.open}
          testID="discover_dapp_details_open"
        />
      </PWView>
    </PWSheetLayout>
  );
};
