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

import PWBottomSheet, {
  PWBottomSheetProps,
} from '../../common/bottom-sheet/PWBottomSheet';
import { Input, Text } from '@rneui/themed';
import { useContext, useEffect, useState } from 'react';
import CrossIcon from '../../../../assets/icons/cross.svg';
import { useForm, Controller } from 'react-hook-form';
import { useStyles } from './styles';
import PWView from '../../common/view/PWView';
import { SendFundsContext } from '../../../providers/SendFundsProvider';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MAX_TX_NOTE_BYTES } from '@perawallet/core';

type AddNotePanelProps = {
  onClose: () => void;
} & PWBottomSheetProps;

const NOTE_SCHEMA = z.object({
  note: z
    .string()
    .refine(data => Buffer.from(data).byteLength <= MAX_TX_NOTE_BYTES, {
      error: 'Notes may not exceed 1kb in length',
    })
    .optional(),
});

const AddNotePanel = ({ isVisible, onClose, ...rest }: AddNotePanelProps) => {
  const styles = useStyles();
  const { note, setNote } = useContext(SendFundsContext);
  const [isEdit, setIsEdit] = useState(!!note);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(NOTE_SCHEMA),
    defaultValues: { note },
  });

  const handleClose = () => {
    onClose();
  };

  const done = ({ note: inputNote }: { note?: string }) => {
    setNote(inputNote);
    handleClose();
  };

  useEffect(() => {
    reset({ note });
    setIsEdit(!!note);
  }, [note, reset]);

  return (
    <PWBottomSheet isVisible={isVisible} {...rest}>
      <PWView style={styles.container}>
        <PWView style={styles.titleContainer}>
          <CrossIcon onPress={handleClose} />
          <Text h4>{isEdit ? 'Edit' : 'Add'} Note</Text>
          <Text onPress={handleSubmit(done)}>Done</Text>
        </PWView>
        <PWView style={styles.container}>
          <Controller
            control={control}
            name="note"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                label="Enter your note"
                errorMessage={errors.note?.message}
              />
            )}
          />
        </PWView>
      </PWView>
    </PWBottomSheet>
  );
};

export default AddNotePanel;
