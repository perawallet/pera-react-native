*** Settings ***
Resource            app.resource


*** Variables ***
# Mirrors FIXTURE_CONTACTS in apps/mobile/src/modules/deeplink/handlers/useE2eFixtureDeeplink.ts.
${FIXTURE_CONTACT_NAME}             AutoTestContact
${FIXTURE_CONTACT_ADDRESS}          CBLWUBRWCWNKZ2Y2Q5HFKN7XISNBVAN47422MZOKH5OGCZ3H5JYLTDPLOA

${MENU_CONTACTS_BUTTON}             tid=menu_contacts_button
${CONTACTS_SEARCH_INPUT}            tid=contacts_search_input
${CONTACTS_EMPTY_ADD_BUTTON}        tid=contacts_empty_add_button
${ADD_CONTACT_BUTTON}               tid=add_contact_button
${CONTACT_NAME_INPUT}               tid=contact_name_input
${CONTACT_ADDRESS_INPUT}            tid=contact_address_input
${CONTACT_ADD_ADDRESS_BUTTON}       tid=contact_add_address_button
${VIEW_CONTACT_SHARE_BUTTON}        tid=view_contact_share_button
${VIEW_CONTACT_EDIT_BUTTON}         tid=view_contact_edit_button
${VIEW_CONTACT_QR_BUTTON}           tid=view_contact_qr_algorand
${EDIT_CONTACT_DONE_BUTTON}         tid=edit_contact_done_button
${EDIT_CONTACT_DELETE_BUTTON}       tid=edit_contact_delete_button
${CONTACT_DELETE_CONFIRM_BUTTON}    tid=contact_delete_confirm_button
${CONTACT_DELETE_CANCEL_BUTTON}     tid=contact_delete_cancel_button
${CONTACT_QR_COPY_BUTTON}           tid=contact_qr_copy_button
${CONTACT_QR_SHARE_BUTTON}          tid=contact_qr_share_button


*** Keywords ***
Start With No Contacts
    Load Fixture    contacts-empty
    Wait Until Page Contains Element    ${CONTACTS_EMPTY_ADD_BUTTON}    timeout=15s

Start With One Contact
    Load Fixture    contacts-one
    Contact Row Should Be Listed    ${FIXTURE_CONTACT_ADDRESS}

Open Contacts From Menu
    Wait Until Page Contains Element    ${MENU_TAB}    timeout=30s
    Tap    ${MENU_TAB}
    Wait Until Page Contains Element    ${MENU_CONTACTS_BUTTON}    timeout=15s
    Tap    ${MENU_CONTACTS_BUTTON}

Contact Row
    [Arguments]    ${address}
    RETURN    tid=contact_row_${address}

Contact Row Should Be Listed
    [Arguments]    ${address}
    ${row}=    Contact Row    ${address}
    Wait Until Page Contains Element    ${row}    timeout=15s

Open Add Contact From Empty State
    Tap    ${CONTACTS_EMPTY_ADD_BUTTON}
    Wait Until Page Contains Element    ${CONTACT_NAME_INPUT}    timeout=15s

Fill Contact Form
    [Arguments]    ${name}    ${address}
    Clear Text    ${CONTACT_NAME_INPUT}
    Input Text    ${CONTACT_NAME_INPUT}    ${name}
    # A contact holds an address per chain family now, so the form opens with no address field
    # at all: Add address reveals one. Without this the fill went straight at an input that is
    # not on screen yet.
    ${field}=    Run Keyword And Return Status
    ...    Page Should Contain Element    ${CONTACT_ADDRESS_INPUT}
    IF    not ${field}
        Wait Until Settled    ${CONTACT_ADD_ADDRESS_BUTTON}
        Tap    ${CONTACT_ADD_ADDRESS_BUTTON}
        Wait Until Page Contains Element    ${CONTACT_ADDRESS_INPUT}    timeout=15s
    END
    Clear Text    ${CONTACT_ADDRESS_INPUT}
    Input Text    ${CONTACT_ADDRESS_INPUT}    ${address}
    # An open keyboard takes the next header tap to close itself.
    Dismiss Keyboard

Open Contact
    [Arguments]    ${address}
    ${row}=    Contact Row    ${address}
    Tap    ${row}
    Wait Until Page Contains Element    ${VIEW_CONTACT_SHARE_BUTTON}    timeout=15s

Contact Should Show Name
    [Documentation]    On the View Contact screen.
    [Arguments]    ${name}
    Wait Until Page Contains    ${name}    timeout=15s

Open Delete Confirmation
    Tap    ${EDIT_CONTACT_DELETE_BUTTON}
    Wait Until Settled    ${CONTACT_DELETE_CANCEL_BUTTON}

Open Edit Contact
    Tap    ${VIEW_CONTACT_EDIT_BUTTON}
    Wait Until Page Contains Element    ${EDIT_CONTACT_DONE_BUTTON}    timeout=15s

Search Contacts
    [Arguments]    ${term}
    Tap    ${CONTACTS_SEARCH_INPUT}
    Type Exactly    ${CONTACTS_SEARCH_INPUT}    ${term}

Contact QR Sheet Should Be Open
    Wait Until Settled    ${CONTACT_QR_COPY_BUTTON}
    Wait Until Page Contains Element    ${CONTACT_QR_SHARE_BUTTON}    timeout=10s
