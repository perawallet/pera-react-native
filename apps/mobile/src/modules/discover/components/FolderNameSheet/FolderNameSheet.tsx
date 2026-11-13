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

import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { PWButton, PWInput, PWSheetLayout, PWView } from "@components/core";
import { SheetHeader } from "@modules/bottom-sheet";
import { useLanguage } from "@hooks/useLanguage";
import { useFolderNameSheet } from "./useFolderNameSheet";
import { useStyles } from "./styles";

export type FolderNameSheetProps = {
  mode: "create" | "rename";
  initialName?: string;
};

/** Asks for a folder name; open it with `useBottomSheet().request<FolderNameSheetResult>`. */
export const FolderNameSheet = ({
  mode,
  initialName,
}: FolderNameSheetProps) => {
  const { t } = useLanguage();
  const styles = useStyles();
  const sheet = useFolderNameSheet({ initialName });

  return (
    <PWSheetLayout
      horizontalPadding="none"
      header={
        <SheetHeader
          title={t(
            mode === "create"
              ? "discover.folders.name_sheet.title_new"
              : "discover.folders.name_sheet.title_rename",
          )}
        />
      }
    >
      <PWView style={styles.inputContainer}>
        <PWInput
          testID="discover_folder_name_input"
          value={sheet.name}
          onChangeText={sheet.setName}
          placeholder={t("discover.folders.name_sheet.placeholder")}
          autoFocus
          returnKeyType="done"
          InputComponent={BottomSheetTextInput}
        />
      </PWView>
      <PWView style={styles.buttonContainer}>
        <PWButton
          testID="discover_folder_name_submit"
          variant="primary"
          title={t(
            mode === "create"
              ? "discover.folders.name_sheet.create"
              : "discover.folders.name_sheet.save",
          )}
          onPress={sheet.submit}
          isDisabled={!sheet.canSubmit}
        />
      </PWView>
    </PWSheetLayout>
  );
};
