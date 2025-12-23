import PWIcon from "@components/icons/PWIcon"
import { CheckBox, CheckBoxProps } from "@rneui/themed"

type PWCheckboxProps = {
    children?: React.ReactNode
} & CheckBoxProps

const PWCheckbox = ({ children, ...props }: PWCheckboxProps) => {
    return (
        <CheckBox {...props}
            checkedIcon={<PWIcon name='check' variant='positive' />}
        >{children}</CheckBox>
    )
}

export default PWCheckbox
