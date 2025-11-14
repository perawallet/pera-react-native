import PWBottomSheet, { PWBottomSheetProps } from "../../common/bottom-sheet/PWBottomSheet"
import { Input, Text } from "@rneui/themed"
import { useContext, useEffect, useState } from "react"
import CrossIcon from '../../../../assets/icons/cross.svg'
import { useForm, Controller } from 'react-hook-form';
import { useStyles } from "./styles"
import PWView from "../../common/view/PWView"
import { SendFundsContext } from "../../../providers/SendFundsProvider"
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from 'zod'
import { MAX_TX_NOTE_BYTES } from "@perawallet/core";

type AddNotePanelProps = {
    onClose: () => void
} & PWBottomSheetProps

const NOTE_SCHEMA = z.object({
    note: z.string()
        .refine((data) => Buffer.from(data).byteLength <= MAX_TX_NOTE_BYTES, { error: "Notes may not exceed 1kb in length"})
        .optional()
})

const AddNotePanel = ({ isVisible, onClose, ...rest } : AddNotePanelProps) => {
    const styles = useStyles()
    const { note, setNote } = useContext(SendFundsContext)
    const [ isEdit, setIsEdit ] = useState(!!note)
    
      const {
        control,
        handleSubmit,
        reset,
        formState: { isValid, errors },
      } = useForm({
        resolver: zodResolver(NOTE_SCHEMA),
        defaultValues: { note },
      });

    const handleClose = () => {
        onClose()
    }

    const done = ({ note }: { note?: string}) => {
        setNote(note)
        handleClose()
    }

    useEffect(() => {
        reset({ note })
        setIsEdit(!!note)
    }, [note, reset])

    return <PWBottomSheet isVisible={isVisible} {...rest}>
        <PWView style={styles.container}>
            <PWView style={styles.titleContainer}>
                <CrossIcon onPress={handleClose}/>
                <Text h4>{isEdit ? 'Edit' : 'Add' } Note</Text>
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
                            errorMessage={errors.note?.message} />
                    )} />
            </PWView>
        </PWView>
    </PWBottomSheet>

}

export default AddNotePanel