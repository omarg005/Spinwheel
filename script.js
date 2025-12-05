// Function to handle state selection
function updateStateValue() {
    // This function is no longer needed since we're using the select value directly
    // But we'll keep it to prevent the error
    console.log("State selected: " + document.getElementById('stateSelect').value);
}

// Function to allow only numbers in input fields
function onlyNumbers(event) {
    const keyCode = event.which ? event.which : event.keyCode;
    if (keyCode < 48 || keyCode > 57) {
        return false;
    }
    return true;
}

// validateAndSubmit is now defined in app.js
// This file only contains utility functions 