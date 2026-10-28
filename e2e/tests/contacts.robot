*** Settings ***
Documentation       Contacts on Android and iOS from one suite. Each case loads its own fixture, so any
...                 case runs, retries or fails alone without taking the next one with it.
Resource            ../resources/contacts.resource

Suite Setup         Start Pera With Wallet
Suite Teardown      Close Pera
Test Teardown       Capture Failure Screenshot
Test Timeout        ${E2E_TEST_TIMEOUT}
Test Tags           contacts


*** Variables ***
${NEW_CONTACT_NAME}         E2E New Contact
${EDITED_CONTACT_NAME}      E2E Edited Contact


*** Test Cases ***
Empty State Offers Add Contact
    [Tags]    id:contacts.list.empty    p2
    Start With No Contacts
    Page Should Not Contain Element    ${CONTACTS_SEARCH_INPUT}

Leaving Add Contact Without Saving Adds Nothing
    [Tags]    id:contacts.create.abandon    p2
    Start With No Contacts
    Open Add Contact From Empty State
    Fill Contact Form    ${NEW_CONTACT_NAME}    ${FIXTURE_CONTACT_ADDRESS}
    Tap Back
    Wait Until Page Contains Element    ${CONTACTS_EMPTY_ADD_BUTTON}    timeout=15s

New Contact Is Saved With Its Name And Address
    [Tags]    id:contacts.create.valid    p1
    Start With No Contacts
    Open Add Contact From Empty State
    Fill Contact Form    ${NEW_CONTACT_NAME}    ${FIXTURE_CONTACT_ADDRESS}
    Tap    ${ADD_CONTACT_BUTTON}
    Contact Row Should Be Listed    ${FIXTURE_CONTACT_ADDRESS}
    Open Contact    ${FIXTURE_CONTACT_ADDRESS}
    Contact Should Show Name    ${NEW_CONTACT_NAME}

Saved Contact Survives An App Restart
    [Tags]    id:contacts.persist.restart    p1
    Start With One Contact
    Relaunch Pera
    Open Contacts From Menu
    Contact Row Should Be Listed    ${FIXTURE_CONTACT_ADDRESS}

Search Keeps Matching Contacts
    [Tags]    id:contacts.search.match    p1
    Start With One Contact
    Search Contacts    ${FIXTURE_CONTACT_NAME}
    Contact Row Should Be Listed    ${FIXTURE_CONTACT_ADDRESS}

Search Hides Contacts That Do Not Match
    [Tags]    id:contacts.search.no-match    p1
    Start With One Contact
    Search Contacts    zzz-no-such-contact
    ${row}=    Contact Row    ${FIXTURE_CONTACT_ADDRESS}
    Wait Until Page Does Not Contain Element    ${row}    timeout=10s
    Clear Text    ${CONTACTS_SEARCH_INPUT}
    Contact Row Should Be Listed    ${FIXTURE_CONTACT_ADDRESS}

Tapping A Row Opens The Contact
    [Tags]    id:contacts.view.open    p2
    Start With One Contact
    Open Contact    ${FIXTURE_CONTACT_ADDRESS}
    Contact Should Show Name    ${FIXTURE_CONTACT_NAME}
    Page Should Contain Element    ${VIEW_CONTACT_EDIT_BUTTON}
    Page Should Contain Element    ${VIEW_CONTACT_QR_BUTTON}

QR Sheet Opens From The Contact Screen
    [Tags]    id:contacts.qr.from-view    p2
    Start With One Contact
    Open Contact    ${FIXTURE_CONTACT_ADDRESS}
    Tap    ${VIEW_CONTACT_QR_BUTTON}
    Contact QR Sheet Should Be Open
    Close Sheet
    Wait Until Page Contains Element    ${VIEW_CONTACT_SHARE_BUTTON}    timeout=15s

QR Sheet Opens From The Contact Row
    [Tags]    id:contacts.qr.from-row    p2
    Start With One Contact
    Tap    tid=contact_row_qr_button_${FIXTURE_CONTACT_ADDRESS}
    Contact QR Sheet Should Be Open
    Close Sheet
    Wait Until Page Contains Element    ${CONTACTS_SEARCH_INPUT}    timeout=15s

Edited Name Is Saved
    [Tags]    id:contacts.edit.name    p1
    Start With One Contact
    Open Contact    ${FIXTURE_CONTACT_ADDRESS}
    Open Edit Contact
    Clear Text    ${CONTACT_NAME_INPUT}
    Input Text    ${CONTACT_NAME_INPUT}    ${EDITED_CONTACT_NAME}
    Tap    ${EDIT_CONTACT_DONE_BUTTON}
    Contact Should Show Name    ${EDITED_CONTACT_NAME}

Cancelling Delete Keeps The Contact
    [Tags]    id:contacts.delete.cancel    p1
    Start With One Contact
    Open Contact    ${FIXTURE_CONTACT_ADDRESS}
    Open Edit Contact
    Open Delete Confirmation
    Tap    ${CONTACT_DELETE_CANCEL_BUTTON}
    Wait Until Page Does Not Contain Element    ${CONTACT_DELETE_CANCEL_BUTTON}    timeout=10s
    Tap    ${EDIT_CONTACT_DONE_BUTTON}
    Contact Should Show Name    ${FIXTURE_CONTACT_NAME}

Deleting Removes The Contact
    [Tags]    id:contacts.delete.confirm    p1
    Start With One Contact
    Open Contact    ${FIXTURE_CONTACT_ADDRESS}
    Open Edit Contact
    Open Delete Confirmation
    Tap    ${CONTACT_DELETE_CONFIRM_BUTTON}
    Wait Until Page Contains Element    ${CONTACTS_EMPTY_ADD_BUTTON}    timeout=15s
