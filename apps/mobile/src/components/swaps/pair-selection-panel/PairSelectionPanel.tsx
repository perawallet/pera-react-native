import { useStyles } from './styles';
import { useCallback, useState } from 'react';
import { Divider, Text, useTheme } from '@rneui/themed';
import Decimal from 'decimal.js';
import AssetSelection from '../../common/asset-selection/AssetSelection';
import CurrencyDisplay from '../../common/currency-display/CurrencyDisplay';
import PeraView from '../../common/view/PeraView';
import { TouchableOpacity, View } from 'react-native';

import SwitchIcon from '../../../../assets/icons/switch.svg';
import SlidersIcon from '../../../../assets/icons/sliders.svg';
import CurrencyInput from '../../common/currency-input/CurrencyInput';
import { useV1AssetsList } from '@perawallet/core';

const PairSelectionPanel = () => {
  const styles = useStyles();
  const { theme } = useTheme();

  const { data: algoAssets } = useV1AssetsList({
    params: {
        q: 'algo'
    }
  })

  const { data: usdcAssets } = useV1AssetsList({
    params: {
        q: 'usdc'
    }
  })

  const algoAsset = algoAssets?.results?.length ? algoAssets.results.at(0) : null
  const usdcAsset = usdcAssets?.results?.length ? usdcAssets.results.at(0) : null

  //TODO: some or all of these should probably come from either an account hook, the state store or a calculation
  const [sendAmount, setSendAmount] = useState('0.00');
  const [receiveAmount, _] = useState(Decimal(0));
  const [receiveAmountUSD, __] = useState(Decimal(0));
  const [fromBalance, ___] = useState(Decimal(0));
  const [toBalance, ____] = useState(Decimal(0));

  const handleAmountChange = useCallback(
    (formatted: string) => {
      setSendAmount(formatted);
    },
    [setSendAmount],
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
            <CurrencyInput
              cursorColor={theme.colors.textGray}
              style={styles.primaryInput}
              value={sendAmount}
              minPrecision={2}
              maxPrecision={18} //TODO: replace with asset precision
              onChangeText={handleAmountChange}
              affinityCalculationStrategy={0}
            />
            <CurrencyDisplay
              style={styles.secondaryAmountText}
              precision={2}
              currency="USD"
              value={receiveAmountUSD}
            />
          </PeraView>
          {algoAsset && <AssetSelection asset={algoAsset} />}
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
          {usdcAsset && <AssetSelection asset={usdcAsset} />}
        </PeraView>
      </PeraView>
    </PeraView>
  );
};

export default PairSelectionPanel;
