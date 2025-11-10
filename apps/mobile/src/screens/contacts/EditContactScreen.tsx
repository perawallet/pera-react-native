import { Dialog, Input, Text, useTheme } from "@rneui/themed";
import ContactAvatar from "../../components/common/contact-avatar/ContactAvatar";
import PeraView from "../../components/common/view/PeraView";
import AddressEntryField from "../../components/common/address-entry/AddressEntryField";
import { Contact, useContacts, contactSchema, truncateAlgorandAddress } from "@perawallet/core";
import { ParamListBase, StaticScreenProps, useNavigation } from "@react-navigation/native";
import { KeyboardAvoidingView } from "react-native";
import { useStyles } from "./EditContactScreen.styles";
import PeraButton from "../../components/common/button/PeraButton";
import { ScrollView } from "react-native-gesture-handler";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import CopyIcon from '../../../assets/icons/copy.svg'
import useToast from "../../hooks/toast";
import Clipboard from '@react-native-clipboard/clipboard';
import { useState } from "react";

type EditContactScreenProps = StaticScreenProps<{
}>;

const LONG_ADDRESS_FORMAT = 20

const EditContactScreen = ({ route }: EditContactScreenProps) => {
    const styles = useStyles()
    const { saveContact, findContacts, deleteContact, selectedContact, setSelectedContact } = useContacts()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { theme } = useTheme()
    const { showToast } = useToast()
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)

    const {
        control,
        handleSubmit,
        setError,
        formState: { isValid, errors },
    } = useForm({
        resolver: zodResolver(contactSchema),
        defaultValues: selectedContact ?? {}
    });
    
    const copyAddress = () => {
        Clipboard.setString(selectedContact?.address || '')
        showToast({
            title: '',
            body: 'Address copied to clipboard',
            type: 'info'
        })
    }

    const openDeleteModal = () => {
        setDeleteModalOpen(true)
    }

    const closeDeleteModal = () => {
        setDeleteModalOpen(false)
    }

    const save = (data: Contact) => {
        if (!selectedContact) {
            const matches = findContacts({
                keyword: data.address,
                matchAddress: true,
                matchName: false,
                matchNFD: false
            })

            if (matches?.length) {
                setError("address", {
                    message: "Contact for this address already exists."
                })
                return
            }
        }

        if (isValid) {
            saveContact(data)
            setSelectedContact(null)
            navigation.goBack()
        }
    }

    const removeContact = () => {
        if (!selectedContact) {
            navigation.replace('Contacts')
        } else {
            deleteContact(selectedContact)
            setSelectedContact(null)
            navigation.replace('Contacts')
        }
    }

    return <KeyboardAvoidingView behavior="height">
        <ScrollView style={styles.container} >
            <PeraView style={styles.avatar}>
                <ContactAvatar size="large" contact={selectedContact ?? {name: '', address: ''}} />
            </PeraView>
            <PeraView style={styles.formContainer}>
                <Controller
                    control={control}
                    name="name"
                    render={({ field: { onChange, onBlur, value } }) => (
                        <Input onBlur={onBlur} onChangeText={onChange} value={value} label="Name" 
                            errorMessage={errors.name?.message} />
                    )}
                />
                {!selectedContact && <Controller
                    control={control}
                    name="address"
                    render={({ field: { onChange, onBlur, value } }) => (
                        <AddressEntryField allowQRCode label="Address" onBlur={onBlur} onChangeText={onChange} value={value} 
                            errorMessage={errors.address?.message} />
                    )}
                />}
                {!!selectedContact && 
                <PeraView>
                    <Text style={styles.label}>Address</Text>
                    <PeraView style={styles.addressValueContainer}>
                        <Text style={styles.value}>{truncateAlgorandAddress(selectedContact.address, LONG_ADDRESS_FORMAT)}</Text>
                        <CopyIcon onPress={copyAddress} color={theme.colors.textGray} width={theme.spacing.lg} height={theme.spacing.lg} />
                    </PeraView>
                </PeraView>}
                <PeraView style={styles.buttonContainer}>
                    {!!selectedContact && <PeraButton onPress={openDeleteModal} title="Delete" variant="destructive" minWidth={100} />}
                    <PeraButton onPress={handleSubmit(save)} title="Save" variant="primary" minWidth={100} />
                </PeraView>
            </PeraView>
        </ScrollView>
        <Dialog
            isVisible={deleteModalOpen}
            onBackdropPress={closeDeleteModal}
            >
            <Dialog.Title title="Are you sure?"/>
            <Text>Are you sure you want to delete this contact?</Text>
            <Dialog.Actions>
                <Dialog.Button title="Delete" titleStyle={{color: theme.colors.error}} onPress={removeContact}/>
                <Dialog.Button title="Cancel" onPress={closeDeleteModal}/>
            </Dialog.Actions>
        </Dialog>
    </KeyboardAvoidingView>
}

export default EditContactScreen