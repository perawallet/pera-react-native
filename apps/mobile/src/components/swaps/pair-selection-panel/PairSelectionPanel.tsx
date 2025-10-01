import { useAppStore } from '@perawallet/core';
import { useStyles } from './styles';
import { useMemo, useState } from 'react';
import { Divider, Input, Text } from '@rneui/themed';
import Decimal from 'decimal.js';
import AssetSelection from '../../common/asset-selection/AssetSelection';
import CurrencyDisplay from '../../common/currency-display/CurrencyDisplay';
import PeraView from '../../common/view/PeraView';
import { TouchableOpacity, View } from 'react-native';

import SwitchIcon from '../../../../assets/icons/switch.svg';
import SlidersIcon from '../../../../assets/icons/sliders.svg';

// TODO: these should be loaded from the server
import AlgoAssetIcon from '../../../../assets/icons/assets/algo.svg';
import USDCAssetIcon from '../../../../assets/icons/assets/usdc.svg';

const PairSelectionPanel = () => {
  const styles = useStyles();

  //TODO: some or all of these should probably come from either an account hook, the state store or a calculation
  const [receiveAmount, setRecieveAmount] = useState(Decimal(0));
  const [receiveAmountUSD, setRecieveAmountUSD] = useState(Decimal(0));
  const [fromBalance, setFromBalance] = useState(Decimal(0));
  const [toBalance, setToBalance] = useState(Decimal(0));
  const getSelectedAccount = useAppStore(state => state.getSelectedAccount);
  const selectedAccountIndex = useAppStore(state => state.selectedAccountIndex);
  const fromAsset = useAppStore(state => state.fromAsset);
  const toAsset = useAppStore(state => state.toAsset);

  const selectedAccount = useMemo(
    () => getSelectedAccount,
    [selectedAccountIndex],
  );

  return (
    <PeraView style={styles.container}>
      <PeraView style={styles.fromContainer}>
        <PeraView style={styles.titleRow}>
          <Text style={styles.titleText}>You pay</Text>
          <PeraView style={styles.titleBalanceContainer}>
            <Text style={styles.titleText}>Balance:</Text>
            <CurrencyDisplay
              style={styles.titleCurrency}
              precision={2}
              currency="ALGO"
              value={fromBalance}
            />
          </PeraView>
        </PeraView>
        <PeraView style={styles.inputContainer}>
          <PeraView style={styles.inputAmountsContainer}>
            <Input
              inputContainerStyle={styles.primaryInputContainer}
              inputStyle={styles.primaryInput}
              value={receiveAmount.toFixed(2)}
              renderErrorMessage={false}
            />
            <CurrencyDisplay
              style={styles.secondaryAmountText}
              precision={2}
              currency="USD"
              value={receiveAmountUSD}
            />
          </PeraView>
          <AssetSelection name="ALGO" icon={<AlgoAssetIcon />} />
        </PeraView>
      </PeraView>
      <View style={styles.floatButtonContainer}>
        <TouchableOpacity style={styles.floatButton}>
          <SwitchIcon style={styles.floatButtonIcon} />
        </TouchableOpacity>
        <View style={styles.floatSplitButton}>
          <TouchableOpacity style={styles.floatSplitButtonItem}>
            <SlidersIcon style={styles.greenIcon} />
          </TouchableOpacity>
          <Divider style={styles.floatSplitDivider} orientation="vertical" />
          <TouchableOpacity style={styles.floatSplitButtonItem}>
            <Text style={styles.floatButtonText}>MAX</Text>
          </TouchableOpacity>
        </View>
      </View>
      <PeraView style={styles.toContainer}>
        <PeraView style={styles.titleRow}>
          <Text style={styles.titleText}>You receive</Text>
          <PeraView style={styles.titleBalanceContainer}>
            <Text style={styles.titleText}>Balance:</Text>
            <CurrencyDisplay
              style={styles.titleCurrency}
              precision={2}
              currency="ALGO"
              value={toBalance}
            />
          </PeraView>
        </PeraView>
        <PeraView style={styles.inputContainer}>
          <PeraView style={styles.inputAmountsContainer}>
            <CurrencyDisplay
              h2Style={styles.primaryAmountText}
              showSymbol={false}
              precision={2}
              currency="ALGO"
              h2
              value={receiveAmount}
            />
            <CurrencyDisplay
              style={styles.secondaryAmountText}
              precision={2}
              currency="USD"
              value={receiveAmountUSD}
            />
          </PeraView>
          <AssetSelection name="USDC" icon={<USDCAssetIcon />} />
        </PeraView>
      </PeraView>
    </PeraView>
  );
};

export default PairSelectionPanel;
