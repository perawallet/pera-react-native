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

import { Text, useTheme } from '@rneui/themed';
import { ScreenState } from '../bottom-sheet/SendFundsBottomSheet';
import { useSelectedAccount } from '@perawallet/core';
import { useWindowDimensions } from 'react-native';
import { useStyles } from './styles';
import { useContext, useState } from 'react';
import { SendFundsContext } from '../../../providers/SendFundsProvider';
import PWView from '../../common/view/PWView';
import PWTouchableOpacity from '../../common/touchable-opacity/PWTouchableOpacity';
import AccountDisplay from '../../common/account-display/AccountDisplay';
import AssetIcon from '../../common/asset-icon/AssetIcon';
import SendFundsInfoPanel from '../info-panel/SendFundsInfoPanel';
import PWIcon from '../../common/icons/PWIcon';

type SendFundsTitlePanelProps = {
  screenState: ScreenState;
  handleBack: () => void;
};

const SendFundsTitlePanel = ({
  screenState,
  handleBack
}: SendFundsTitlePanelProps) => {
  const { theme } = useTheme();
  const selectedAccount = useSelectedAccount();
  const dimensions = useWindowDimensions();
  const styles = useStyles(dimensions);
  const [infoOpen, setInfoOpen] = useState(false);
  const { canSelectAsset, selectedAsset } = useContext(SendFundsContext);

  const openInfo = () => {
    setInfoOpen(true);
  };
  const closeInfo = () => {
    setInfoOpen(false);
  };

  return (
    <PWView style={styles.titleContainer}>
      <PWTouchableOpacity
        style={styles.titleButtonContainer}
        onPress={handleBack}
      >
        {screenState === 'select-asset' ||
        (screenState === 'input-amount' && !canSelectAsset) ? (
          <PWIcon name="cross" />
        ) : (
          <PWIcon name="chevron-left" />
        )}
      </PWTouchableOpacity>
      {screenState === 'select-asset' && <Text h4>Select Asset</Text>}
      {screenState === 'input-amount' && (
        <PWView style={styles.accountTitleContainer}>
          <Text>Send {selectedAsset?.name}</Text>
          <AccountDisplay
            account={selectedAccount ?? undefined}
            style={styles.accountDisplay}
            iconProps={{ width: 16, height: 16 }}
            textProps={{ style: styles.accountDisplaySubHeading }}
            showChevron={false}
          />
        </PWView>
      )}
      {screenState === 'select-destination' && (
        <PWView style={styles.assetTitleContainer}>
          <AssetIcon asset={selectedAsset} size={theme.spacing.xl} />
          <Text>{selectedAsset?.name}</Text>
        </PWView>
      )}
      {screenState === 'confirm-transaction' && (
        <Text h4>Confirm Transaction</Text>
      )}
      <PWView style={styles.titleButtonContainer}>
        {screenState === 'input-amount' && (
          <PWIcon name="info" onPress={openInfo} />
        )}
      </PWView>
      {screenState === 'input-amount' && (
        <SendFundsInfoPanel isVisible={infoOpen} onClose={closeInfo} />
      )}
    </PWView>
  );
};

export default SendFundsTitlePanel;
