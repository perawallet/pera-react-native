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

import PWView from '../../common/view/PWView';
import Decimal from 'decimal.js';
import { useContext, useMemo, useState } from 'react';
import CurrencyDisplay from '../../common/currency-display/CurrencyDisplay';
import { useStyles } from './styles';
import PWButton from '../../common/button/PWButton';
import AccountAssetItemView from '../../assets/asset-item/AccountAssetItemView';
import { Button, Text } from '@rneui/themed';
import NumberPad from '../../common/number-pad/NumberPad';
import { SendFundsContext } from '../../../providers/SendFundsProvider';
import AddNotePanel from '../add-note-panel/AddNotePanel';
import useToast from '../../../hooks/toast';
import {
  useAccountBalances,
  useCurrencyConverter,
  useSelectedAccount
} from '@perawallet/core';
import PWHeader from '../../common/header/PWHeader';
import AccountDisplay from '../../common/account-display/AccountDisplay';
import SendFundsInfoPanel from '../info-panel/SendFundsInfoPanel';

type SendFundsInputViewProps = {
  onNext: () => void;
  onBack: () => void;
};

//TODO: handle local currency conversion
//TODO: handle max precision (currently we don't show them but we're still adding characters)
//TODO: max amount validation (+ max amount popup)
//TODO: Should be using DMMono font for numbers
const SendFundsInputView = ({ onNext, onBack }: SendFundsInputViewProps) => {
  const styles = useStyles();
  const selectedAccount = useSelectedAccount();
  const { preferredCurrency, convertUSDToPreferredCurrency } =
    useCurrencyConverter();
  const { canSelectAsset, selectedAsset, note, setNote, setAmount } =
    useContext(SendFundsContext);
  const [value, setValue] = useState<string | null>();
  const [noteOpen, setNoteOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const { showToast } = useToast();

  const { data } = useAccountBalances(selectedAccount ? [selectedAccount] : []);
  const { tokenAmount, usdAmount } = useMemo(() => {
    const asset = data
      .at(0)
      ?.accountInfo?.results?.find(
        info => info.asset_id === selectedAsset?.asset_id
      );
    return {
      tokenAmount: asset?.amount ? Decimal(asset?.amount) : Decimal(0),
      usdAmount: asset?.balance_usd_value
        ? Decimal(asset?.balance_usd_value)
        : Decimal(0)
    };
  }, [data, selectedAsset?.asset_id]);

  const openNote = () => {
    setNoteOpen(true);
  };

  const closeNote = () => {
    setNoteOpen(false);
  };

  const openInfo = () => {
    setInfoOpen(true);
  };
  const closeInfo = () => {
    setInfoOpen(false);
  };

  const setMax = () => {
    setAmount(tokenAmount);
  };

  const handleNext = () => {
    if (!value || Decimal(value) <= Decimal(0)) {
      showToast({
        title: 'Invalid Amount',
        body: 'Please enter a valid amount.',
        type: 'error'
      });
    }
    setAmount(Decimal(value ?? '0'));
    setNote(note ?? undefined);
    onNext();
  };

  const handleKey = (key?: string) => {
    if (key) {
      setValue((value ?? '') + key);
    } else {
      if (value?.length) {
        const newValue = value.substring(0, value.length - 1);
        if (newValue.length) {
          setValue(newValue);
        } else {
          setValue(null);
        }
      }
    }
  };

  const usdValue = useMemo(() => {
    if (!value || !selectedAsset?.usd_price) {
      return null;
    }

    return Decimal(value).mul(Decimal(selectedAsset.usd_price));
  }, [value, selectedAsset?.usd_price]);

  if (!selectedAsset) return <></>;

  return (
    <PWView style={styles.container}>
      <PWHeader
        leftIcon={!canSelectAsset ? 'chevron-left' : 'cross'}
        onLeftPress={onBack}
        rightIcon="info"
        onRightPress={openInfo}
      >
        <Text>Send {selectedAsset?.name}</Text>
        <AccountDisplay
          account={selectedAccount ?? undefined}
          style={styles.accountDisplay}
          iconProps={{ width: 16, height: 16 }}
          textProps={{ style: styles.accountDisplaySubHeading }}
          showChevron={false}
        />
      </PWHeader>
      <CurrencyDisplay
        h1
        currency={selectedAsset.unit_name}
        precision={selectedAsset.fraction_decimals}
        value={value ? Decimal(value) : Decimal(0)}
        h1Style={value ? styles.amount : styles.amountPlaceholder}
        showSymbol={false}
        minPrecision={2}
      />
      <CurrencyDisplay
        currency={preferredCurrency}
        precision={6}
        value={usdValue ? convertUSDToPreferredCurrency(usdValue) : Decimal(0)}
        style={styles.amountPlaceholder}
        showSymbol
        minPrecision={2}
      />

      <PWView style={styles.buttonContainer}>
        <Button
          title={note ? 'Edit Note' : `+ Add Note`}
          buttonStyle={styles.secondaryButton}
          titleStyle={styles.secondaryButtonTitle}
          onPress={openNote}
        />
        <Button
          title="MAX"
          buttonStyle={styles.secondaryButton}
          titleStyle={styles.secondaryButtonTitle}
          onPress={setMax}
        />
      </PWView>

      <PWView style={styles.numpadContainer}>
        <NumberPad onPress={handleKey} />
      </PWView>

      <AccountAssetItemView
        asset={selectedAsset}
        amount={tokenAmount}
        usdAmount={usdAmount}
        style={styles.assetDisplay}
      />

      <PWButton
        variant="primary"
        title="Next"
        containerStyle={styles.nextButton}
        onPress={handleNext}
        disabled={!value}
      />

      <AddNotePanel isVisible={noteOpen} onClose={closeNote} />
      <SendFundsInfoPanel isVisible={infoOpen} onClose={closeInfo} />
    </PWView>
  );
};

export default SendFundsInputView;
