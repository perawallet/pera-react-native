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
import AddressSearchView from '../../common/address-search/AddressSearchView';
import { useContext } from 'react';
import { SendFundsContext } from '../../../providers/SendFundsProvider';
import SendFundsTitlePanel from '../title-panel/SendFundsTitlePanel';
import { useStyles } from './styles';

type SendFundsSelectDestinationProps = {
  onNext: () => void;
  onBack: () => void;
};

const SendFundsSelectDestination = ({
  onNext,
  onBack,
}: SendFundsSelectDestinationProps) => {
  const { setDestination } = useContext(SendFundsContext);
  const styles = useStyles();

  const handleSelected = (address: string) => {
    setDestination(address);
    onNext();
  };

  return (
    <PWView style={styles.container}>
      <SendFundsTitlePanel
        handleBack={onBack}
        screenState="select-destination"
      />
      <AddressSearchView onSelected={handleSelected} />
    </PWView>
  );
};

export default SendFundsSelectDestination;
