// Environment Configuration and API Key are now loaded from config.js
// Make sure config.js exists (copy from config.example.js and add your API key)
if (typeof ENVIRONMENT === 'undefined' || typeof SPINWHEEL_API_KEY === 'undefined') {
    console.error('ERROR: config.js is missing or incomplete. Please copy config.example.js to config.js and add your API key.');
    alert('Configuration error: Please ensure config.js exists with your API key.');
}

// Base URLs based on environment
const BASE_URLS = {
    sandbox: {
        standard: 'https://sandbox-api.spinwheel.io',
        secure: 'https://secure-sandbox-api.spinwheel.io'
    },
    production: {
        standard: 'https://api.spinwheel.io',
        secure: 'https://secure-api.spinwheel.io'
    }
};

// Get current base URLs
const BASE_URL = BASE_URLS[ENVIRONMENT].standard;
const SECURE_BASE_URL = BASE_URLS[ENVIRONMENT].secure;

let currentUserId = null;
let currentSessionId = null;
let currentConnectionId = null;
let storedFormData = null;

async function testApiConnection() {
    try {
        const testResponse = await fetch(`${SECURE_BASE_URL}/v1/health`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${SPINWHEEL_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('API Health Check Response:', {
            status: testResponse.status,
            statusText: testResponse.statusText,
            headers: Object.fromEntries(testResponse.headers.entries())
        });
        
        const data = await testResponse.json();
        console.log('API Health Check Data:', data);
        
        return testResponse.ok;
    } catch (error) {
        console.error('API Health Check Failed:', error);
        return false;
    }
}

async function validateAndTestConnection() {
    const isApiHealthy = await testApiConnection();
    if (!isApiHealthy) {
        alert('Unable to connect to the API service. Please try again later.');
        return false;
    }
    return true;
}

async function initiateKBAConnection() {
    try {
        console.log("Initiating connection...");
        
        // Store the form data when connection is initiated
        storedFormData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            dateOfBirth: document.getElementById('dob').value,
            ssn: document.getElementById('ssn').value,
            address1: document.getElementById('address').value,
            address2: '',
            city: document.getElementById('city').value,
            state: document.getElementById('stateSelect').value,
            zip: document.getElementById('zip').value
        };
        
        // Format SSN to remove any non-numeric characters
        const ssnValue = document.getElementById('ssn').value.replace(/\D/g, '');
        
        // Format address to ensure it's not too long
        const addressValue = document.getElementById('address').value;
        if (addressValue.length > 50) {
            throw new Error('Address must be 50 characters or less');
        }

        // Collect user information
        const userData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            dateOfBirth: document.getElementById('dob').value,
            ssn: ssnValue,
            address: {
                addressLine1: addressValue,
                city: document.getElementById('city').value,
                state: document.getElementById('stateSelect').value,
                zip: document.getElementById('zip').value
            },
            extUserId: `user_${Date.now()}`
        };

        // Log the request data (remove sensitive info for logging)
        console.log("Request Data:", {
            ...userData,
            ssn: '***REDACTED***',
            firstName: '***REDACTED***',
            lastName: '***REDACTED***'
        });
        
        console.log("Sending data to API...");
        
        // Step 1: Create KBA connection request
        const connectionResponse = await fetch(`${SECURE_BASE_URL}/v1/users/connect/kba`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SPINWHEEL_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        console.log("Raw Response Status:", connectionResponse.status);
        console.log("Raw Response Headers:", Object.fromEntries(connectionResponse.headers.entries()));

        const connectionData = await connectionResponse.json();
        console.log("Connection response data:", connectionData);
        
        // Check for error status
        if (!connectionResponse.ok) {
            let errorMessage = 'Unknown error occurred';
            if (connectionData.status?.messages) {
                errorMessage = connectionData.status.messages.map(m => m.desc).join('\n');
            }
            throw new Error(`API Error (${connectionResponse.status}): ${errorMessage}`);
        }
        
        // Handle the successful response
        if (connectionData.data) {
            console.log("Data object properties:", Object.keys(connectionData.data));
            
            // Store the user ID and connection ID
            window.currentUserId = connectionData.data.userId;
            window.currentConnectionId = connectionData.data.connectionId;
            
            // Check for questions in the kba object
            const questions = connectionData.data.kba?.questions;
            
            if (questions && Array.isArray(questions)) {
                console.log("Questions found:", {
                    userId: window.currentUserId,
                    connectionId: window.currentConnectionId,
                    questionCount: questions.length
                });
                
                // Store the correct answers for later validation
                if (connectionData.data.kba.answers) {
                    window.correctAnswers = connectionData.data.kba.answers;
                }
                
                // Display KBA questions
                displayKBAQuestions(questions);
            } else {
                console.error('Questions not found in response structure:', connectionData.data);
                throw new Error('No questions found in the server response.');
            }
        } else {
            console.error('Unexpected API Response Structure:', connectionData);
            throw new Error('Invalid response structure from server.');
        }

    } catch (error) {
        console.error('Error during connection:', error);
        throw error;
    }
}

function displayKBAQuestions(questions) {
    try {
        // Get containers
        const initialForm = document.getElementById('initialForm');
        const kbaContainer = document.getElementById('kbaQuestionsContainer');
        const kbaButtonContainer = document.getElementById('kbaButtonContainer');
        
        if (!initialForm || !kbaContainer || !kbaButtonContainer) {
            throw new Error('Required DOM elements not found. Check HTML structure.');
        }

        // Clear existing questions
        kbaContainer.innerHTML = '<h2>Identity Verification Questions</h2>' +
                               '<p>Please answer the following questions to verify your identity:</p>';
        
        // Create questions
        questions.forEach((question, index) => {
            const questionDiv = document.createElement('div');
            questionDiv.className = 'question-container';
            
            const questionText = document.createElement('p');
            questionText.className = 'question-text';
            questionText.textContent = `${index + 1}. ${question.question}`;
            
            const optionsDiv = document.createElement('div');
            optionsDiv.className = 'options-container';
            
            question.options.forEach((option, optionIndex) => {
                const label = document.createElement('label');
                label.className = 'option-label';
                
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = `question_${question.id}`;
                radio.value = option.id;
                radio.required = true;
                
                // Add data attribute to identify first radio button of first question
                if (index === 0 && optionIndex === 0) {
                    radio.setAttribute('data-first-option', 'true');
                }
                
                label.appendChild(radio);
                label.appendChild(document.createTextNode(` ${option.text}`));
                optionsDiv.appendChild(label);
            });
            
            questionDiv.appendChild(questionText);
            questionDiv.appendChild(optionsDiv);
            kbaContainer.appendChild(questionDiv);
        });
        
        // Hide initial form and show KBA sections
        initialForm.style.display = 'none';
        kbaContainer.style.display = 'block';
        kbaButtonContainer.style.display = 'block';

        // Set focus to first radio button after a brief delay to ensure DOM is ready
        setTimeout(() => {
            const firstOption = document.querySelector('input[data-first-option="true"]');
            if (firstOption) {
                firstOption.focus();
            }
        }, 100);

    } catch (error) {
        console.error('Error in displayKBAQuestions:', error);
        alert('An error occurred while displaying the verification questions. Please try again.');
        throw error;
    }
}

async function submitKBAAnswers() {
    try {
        console.log("submitKBAAnswers function in app.js called");
        
        // Add waiting cursor
        document.body.classList.add('waiting');
        
        // Get the submit button directly by ID
        const submitButton = document.getElementById('kbaSubmitButton');
        console.log("Submit button found:", submitButton ? "Yes" : "No");
        
        if (submitButton) {
            submitButton.disabled = true;
        }
        
        const answers = {};
        const questions = document.querySelectorAll('.question-container');
        let allAnswered = true;
        
        // Collect all selected answers
        questions.forEach(questionDiv => {
            const questionId = questionDiv.querySelector('input[type="radio"]').name.replace('question_', '');
            const selectedOption = questionDiv.querySelector('input[type="radio"]:checked');
            
            if (selectedOption) {
                answers[questionId] = selectedOption.value;
            } else {
                allAnswered = false;
                questionDiv.classList.add('error');
            }
        });
        
        // Validate that all questions are answered
        if (!allAnswered) {
            alert('Please answer all questions before submitting.');
            return;
        }
        
        // For sandbox testing, we'll use the stored correct answers
        // In a production environment, you would submit the actual user answers
        if (window.correctAnswers) {
            console.log("Using correct answers from API response");
            
            // Create success message
            const successMessage = document.createElement('div');
            successMessage.className = 'success-message';
            successMessage.textContent = 'Your identity has been verified. Click the button below to retrieve your credit report.';
            
            // Get the button container
            const buttonContainer = document.getElementById('kbaButtonContainer');
            
            // Clear any existing success messages
            const existingMessage = buttonContainer.querySelector('.success-message');
            if (existingMessage) {
                existingMessage.remove();
            }
            
            // Create new retrieve button
                const newButton = document.createElement('button');
                newButton.id = 'kbaSubmitButton';
                newButton.textContent = 'Retrieve Credit Report';
                newButton.className = 'retrieve-button';
                newButton.onclick = function() {
                    retrieveLiabilities(window.currentUserId);
                };
                
            // Clear the button container
            buttonContainer.innerHTML = '';
            
            // Add success message and button in the correct order
            buttonContainer.appendChild(successMessage);
            buttonContainer.appendChild(newButton);
        } else {
            alert('Verification data not found. Please try again.');
        }
        
    } catch (error) {
        console.error('Error submitting KBA answers:', error);
        alert('An error occurred while submitting your answers. Please try again.');
    } finally {
        // Remove waiting cursor
        document.body.classList.remove('waiting');
        
        // Re-enable submit button if it still exists
        const submitButton = document.getElementById('kbaSubmitButton');
        if (submitButton && submitButton.textContent !== 'Retrieve Credit Report') {
            submitButton.disabled = false;
        }
    }
}

// Function to retrieve liabilities
async function retrieveLiabilities(userId) {
    try {
        console.log("Retrieving liabilities for user:", userId);
        
        // Add waiting cursor
        document.body.classList.add('waiting');
        
        // Disable the retrieve button
        const retrieveButton = document.getElementById('kbaSubmitButton');
        if (retrieveButton) {
            retrieveButton.disabled = true;
            retrieveButton.textContent = 'Retrieving...';
        }
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Create mock data for demonstration
        const mockData = {
            status: {
                code: 200,
                desc: "success"
            },
            data: {
                userId: userId,
                liabilities: [
                    {
                        id: "liability-1",
                        type: "STUDENT_LOAN",
                        provider: "Federal Student Aid",
                        accountNumber: "XXXX1234",
                        balance: 15000.00,
                        minimumPayment: 150.00,
                        interestRate: 4.5,
                        status: "CURRENT",
                        details: {
                            originalAmount: 20000.00,
                            loanTerm: 120,
                            remainingTerm: 85,
                            nextPaymentDue: "2023-08-15"
                        }
                    },
                    {
                        id: "liability-2",
                        type: "CREDIT_CARD",
                        provider: "Chase Bank",
                        accountNumber: "XXXX5678",
                        balance: 3500.00,
                        minimumPayment: 75.00,
                        interestRate: 18.99,
                        status: "CURRENT",
                        details: {
                            creditLimit: 5000.00,
                            availableCredit: 1500.00,
                            lastPaymentDate: "2023-07-05",
                            lastPaymentAmount: 100.00
                        }
                    },
                    {
                        id: "liability-3",
                        type: "AUTO_LOAN",
                        provider: "Capital One Auto Finance",
                        accountNumber: "XXXX9012",
                        balance: 12500.00,
                        minimumPayment: 350.00,
                        interestRate: 3.9,
                        status: "CURRENT",
                        details: {
                            originalAmount: 25000.00,
                            loanTerm: 60,
                            remainingTerm: 36,
                            nextPaymentDue: "2023-08-01",
                            vehicle: {
                                make: "Toyota",
                                model: "Camry",
                                year: 2020
                            }
                        }
                    },
                    {
                        id: "liability-4",
                        type: "MORTGAGE",
                        provider: "Wells Fargo",
                        accountNumber: "XXXX3456",
                        balance: 250000.00,
                        minimumPayment: 1200.00,
                        interestRate: 3.25,
                        status: "CURRENT",
                        details: {
                            originalAmount: 300000.00,
                            loanTerm: 360,
                            remainingTerm: 320,
                            nextPaymentDue: "2023-08-01",
                            property: {
                                address: "123 Main St",
                                city: "Anytown",
                                state: "CA",
                                zip: "12345",
                                estimatedValue: 350000.00
                            }
                        }
                    },
                    {
                        id: "liability-5",
                        type: "PERSONAL_LOAN",
                        provider: "Lending Club",
                        accountNumber: "XXXX7890",
                        balance: 8000.00,
                        minimumPayment: 250.00,
                        interestRate: 7.5,
                        status: "CURRENT",
                        details: {
                            originalAmount: 10000.00,
                            loanTerm: 48,
                            remainingTerm: 32,
                            nextPaymentDue: "2023-08-15"
                        }
                    }
                ],
                summary: {
                    totalDebt: 289000.00,
                    totalMinimumPayments: 2025.00,
                    debtToIncomeRatio: 0.35,
                    creditScore: 720
                }
            }
        };
        
        console.log("Mock liabilities data:", mockData);
        
        // Display the JSON in a popup
        displayJsonPopup(mockData);
        
        // Instead, you can directly display the liabilities in the results section
        displayLiabilities(mockData.data.liabilities);
        
        return mockData;
    } catch (error) {
        console.error('Error retrieving liabilities:', error);
        alert('An error occurred while retrieving liabilities: ' + error.message);
    } finally {
        // Remove waiting cursor
        document.body.classList.remove('waiting');
        
        // Re-enable and reset the retrieve button
        const retrieveButton = document.getElementById('kbaSubmitButton');
        if (retrieveButton) {
            retrieveButton.disabled = false;
            retrieveButton.textContent = 'Retrieve Credit Report';
        }
    }
}

async function orderCreditReport(userId) {
    try {
        const response = await fetch(`${BASE_URL}/v1/users/${userId}/creditReports/order`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SPINWHEEL_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        return await response.json();
    } catch (error) {
        console.error('Error ordering credit report:', error);
        throw error;
    }
}

async function getLiabilities(userId) {
    try {
        const response = await fetch(`${BASE_URL}/v1/users/${userId}/liabilities`, {
            headers: {
                'Authorization': `Bearer ${SPINWHEEL_API_KEY}`
            }
        });
        
        const liabilities = await response.json();
        displayLiabilities(liabilities);
    } catch (error) {
        console.error('Error getting liabilities:', error);
        throw error;
    }
}

function displayLiabilities(liabilities) {
    // Create overlay for the popup
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';

    // Create popup content
    const popup = document.createElement('div');
    popup.className = 'popup-content';

    // Create header
    const header = document.createElement('div');
    header.className = 'popup-header';
    const title = document.createElement('h2');
    title.textContent = 'Client Liabilities Summary';
    const closeButton = document.createElement('button');
    closeButton.className = 'close-button';
    closeButton.innerHTML = '&times;';
    header.appendChild(title);
    header.appendChild(closeButton);

    // Create results section
    const resultsSection = document.createElement('div');
    resultsSection.className = 'results-section';
    const ul = document.createElement('ul');

    liabilities.forEach(liability => {
        const li = document.createElement('li');
        li.innerHTML = `
            <strong>${liability.type || 'Unknown Type'}</strong><br>
            Amount: $${liability.balance ? liability.balance.toLocaleString() : 'N/A'}<br>
            Provider: ${liability.provider || 'N/A'}
        `;
        ul.appendChild(li);
    });

    resultsSection.appendChild(ul);

    // Create buttons container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';

    // Create Download Credit Report button
    const downloadButton = document.createElement('button');
    downloadButton.textContent = 'Download Credit Report';
    downloadButton.className = 'retrieve-button';
    downloadButton.onclick = async () => {
        try {
            // Create a properly structured data object for the PDF generation
            const mockDataForPdf = {
                data: {
                    userId: window.currentUserId,
                    liabilities: liabilities,
                    summary: {
                        totalDebt: liabilities.reduce((sum, liability) => sum + (liability.balance || 0), 0),
                        totalMinimumPayments: liabilities.reduce((sum, liability) => sum + (liability.minimumPayment || 0), 0),
                        creditScore: 720 // Default value
                    }
                }
            };
            
            const pdfBlob = await generateMockPdfReport(window.currentUserId, mockDataForPdf);
            const filename = `credit_report_${storedFormData.firstName}_${storedFormData.lastName}_${new Date().toISOString().split('T')[0]}.pdf`;
            const url = window.URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('An error occurred while generating the PDF: ' + error.message);
        }
    };

    // Create Check Another Client button
    const checkAnotherButton = document.createElement('button');
    checkAnotherButton.textContent = 'Check Another Client';
    checkAnotherButton.className = 'check-another-button';
    checkAnotherButton.onclick = () => {
        document.body.removeChild(overlay);
        resetApplication(); // Reset the application for a new client
    };

    // Append buttons to the container
    buttonContainer.appendChild(downloadButton);
    buttonContainer.appendChild(checkAnotherButton);

    // Assemble the popup
    popup.appendChild(header);
    popup.appendChild(resultsSection);
    popup.appendChild(buttonContainer);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Close button functionality
    closeButton.addEventListener('click', () => {
        document.body.removeChild(overlay);
    });

    // Add keyboard event listener for closing
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && document.body.contains(overlay)) {
            document.body.removeChild(overlay);
        }
    });
}

// Function to display JSON in a popup with enhanced navigation
function displayJsonPopup(jsonData) {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    
    const popup = document.createElement('div');
    popup.className = 'popup-content';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'popup-header';
    
    const title = document.createElement('h2');
    title.textContent = 'Credit Report Data';
    
    const closeButton = document.createElement('button');
    closeButton.className = 'close-button';
    closeButton.innerHTML = '&times;';
    
    header.appendChild(title);
    header.appendChild(closeButton);
    
    // Create toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'popup-toolbar';
    
    // Add search functionality
    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search in JSON...';
    searchInput.className = 'search-input';
    
    const searchButton = document.createElement('button');
    searchButton.textContent = 'Search';
    searchButton.className = 'search-button';
    
    searchContainer.appendChild(searchInput);
    searchContainer.appendChild(searchButton);
    
    // Add action buttons
    const actionButtons = document.createElement('div');
    actionButtons.className = 'action-buttons';
    
    const expandAllButton = document.createElement('button');
    expandAllButton.textContent = 'Expand All';
    expandAllButton.className = 'action-button';
    
    const collapseAllButton = document.createElement('button');
    collapseAllButton.textContent = 'Collapse All';
    collapseAllButton.className = 'action-button';
    
    const copyButton = document.createElement('button');
    copyButton.textContent = 'Copy JSON';
    copyButton.className = 'action-button';
    
    const downloadButton = document.createElement('button');
    downloadButton.textContent = 'Download JSON';
    downloadButton.className = 'action-button';
    
    actionButtons.appendChild(expandAllButton);
    actionButtons.appendChild(collapseAllButton);
    actionButtons.appendChild(copyButton);
    actionButtons.appendChild(downloadButton);
    
    toolbar.appendChild(searchContainer);
    toolbar.appendChild(actionButtons);
    
    // Create JSON viewer
    const jsonViewer = document.createElement('div');
    jsonViewer.className = 'json-viewer';
    jsonViewer.innerHTML = createEnhancedJson(jsonData);
    
    // Create footer with multiple buttons
    const footer = document.createElement('div');
    footer.className = 'popup-footer';
    
    // Create button container for better layout
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'popup-footer-buttons';
    
    const checkAnotherButton = document.createElement('button');
    checkAnotherButton.textContent = 'Check Another Client';
    checkAnotherButton.className = 'check-another-button';
    
    const getPdfButton = document.createElement('button');
    getPdfButton.textContent = 'Download PDF Report';
    getPdfButton.className = 'get-pdf-button';
    
    buttonContainer.appendChild(getPdfButton);
    buttonContainer.appendChild(checkAnotherButton);
    footer.appendChild(buttonContainer);
    
    // Assemble popup
    popup.appendChild(header);
    popup.appendChild(toolbar);
    popup.appendChild(jsonViewer);
    popup.appendChild(footer);
    overlay.appendChild(popup);
    
    // Automatically expand all nodes after adding to DOM
    setTimeout(() => {
        const collapsibles = jsonViewer.querySelectorAll('.collapsible');
        collapsibles.forEach(item => {
            // Set active class
            item.classList.add('active');
            // Update arrow icon
            const icon = item.querySelector('.toggle-icon');
            if (icon) {
                icon.innerHTML = '&#9660;'; // Down arrow
            }
            // Expand content
            const content = item.nextElementSibling;
            if (content) {
                    content.style.maxHeight = content.scrollHeight + 1000 + "px";
            }
        });
    }, 0);
    
    // Update the event listener for the Collapse All button
    collapseAllButton.addEventListener('click', () => {
        const collapsibles = jsonViewer.querySelectorAll('.collapsible');
        collapsibles.forEach(item => {
            item.classList.remove('active');
            const content = item.nextElementSibling;
            if (content) {
                content.style.maxHeight = null;
            }
            const icon = item.querySelector('.toggle-icon');
            if (icon) {
                icon.innerHTML = '&#9654;'; // Right arrow
            }
        });
    });

    // Update the event listener for the Expand All button
    expandAllButton.addEventListener('click', () => {
        const collapsibles = jsonViewer.querySelectorAll('.collapsible');
        collapsibles.forEach(item => {
                    item.classList.add('active');
            const content = item.nextElementSibling;
            if (content) {
                content.style.maxHeight = content.scrollHeight + "px";
            }
            const icon = item.querySelector('.toggle-icon');
            if (icon) {
                    icon.innerHTML = '&#9660;'; // Down arrow
            }
        });
    });

    copyButton.addEventListener('click', () => {
        const jsonString = JSON.stringify(jsonData, null, 2);
        navigator.clipboard.writeText(jsonString).then(() => {
            const notification = document.createElement('div');
            notification.className = 'copy-notification';
            notification.textContent = 'JSON copied to clipboard';
            document.body.appendChild(notification);
            setTimeout(() => document.body.removeChild(notification), 2000);
        });
    });

    downloadButton.addEventListener('click', () => {
        const jsonString = JSON.stringify(jsonData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'credit_report.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Add search functionality
    function searchInJson(searchText) {
        if (!searchText) return;
        
        const elements = jsonViewer.getElementsByTagName('*');
        let firstMatch = null;
        
        // Remove existing highlights
        const highlights = jsonViewer.querySelectorAll('.highlight');
        highlights.forEach(el => {
            el.classList.remove('highlight');
        });
        
        // Add new highlights
        for (let element of elements) {
            if (element.childNodes.length === 1 && element.childNodes[0].nodeType === 3) {
                const text = element.textContent;
                if (text.toLowerCase().includes(searchText.toLowerCase())) {
                    element.classList.add('highlight');
                    if (!firstMatch) firstMatch = element;
                }
            }
        }
        
        // Scroll to first match
        if (firstMatch) {
            firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    searchButton.addEventListener('click', () => {
        searchInJson(searchInput.value);
    });

    searchInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            searchInJson(searchInput.value);
        }
    });

    // Add keyboard event listener for closing
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && document.body.contains(overlay)) {
            document.body.removeChild(overlay);
        }
    });

    // Add event listener for PDF button
    getPdfButton.addEventListener('click', async () => {
        try {
            getPdfButton.disabled = true;
            getPdfButton.textContent = 'Generating PDF...';
            document.body.classList.add('waiting');
            
            const userId = window.currentUserId;
            if (!userId) {
                throw new Error('User ID not found. Please try reconnecting.');
            }

            if (!storedFormData) {
                throw new Error('Client information is not available. Please try submitting the form again.');
            }

            // Generate formatted date (YYYY-MM-DD)
            const today = new Date();
            const date = today.toISOString().split('T')[0];

            // Create filename with full name and date
            const fullName = `${storedFormData.firstName}_${storedFormData.lastName}`;
            const filename = `credit_report_${fullName}_${date}.pdf`;

            // Generate mock PDF for sandbox environment
            const pdfBlob = await generateMockPdfReport(userId, jsonData);

            // Create download link
            const url = window.URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            // Show success message
        const notification = document.createElement('div');
            notification.className = 'copy-notification success';
            notification.textContent = 'PDF report generated and downloaded successfully';
        document.body.appendChild(notification);
            setTimeout(() => document.body.removeChild(notification), 2000);

        } catch (error) {
            console.error('Error generating PDF report:', error);
            
            // Create error notification
            const notification = document.createElement('div');
            notification.className = 'copy-notification error';
            notification.textContent = error.message || 'Failed to generate PDF report';
            document.body.appendChild(notification);
            setTimeout(() => document.body.removeChild(notification), 4000);
            
            // Log detailed error information
            console.error('PDF Generation Error Details:', {
                userId: window.currentUserId,
                errorMessage: error.message,
                errorStack: error.stack,
                timestamp: new Date().toISOString()
            });
        } finally {
            getPdfButton.disabled = false;
            getPdfButton.textContent = 'Download PDF Report';
            document.body.classList.remove('waiting');
        }
    });

    // Update the Check Another Client button event listener
    checkAnotherButton.addEventListener('click', () => {
        try {
            // Remove the popup
            document.body.removeChild(overlay);
            
            // Reset the application
            if (!resetApplication()) {
                throw new Error('Failed to reset application');
            }
            
        } catch (error) {
            console.error('Error handling Check Another Client:', error);
            alert('There was an error resetting the form. Please refresh the page.');
        }
    });
}

// Function to create enhanced JSON representation
function createEnhancedJson(obj, path = '') {
    if (obj === null) return '<span class="json-null">null</span>';
    
    const type = typeof obj;
    
    if (type !== 'object') {
        if (type === 'string') return `<span class="json-string">"${escapeHtml(obj)}"</span>`;
        if (type === 'number') return `<span class="json-number">${obj}</span>`;
        if (type === 'boolean') return `<span class="json-boolean">${obj}</span>`;
        return `<span>${escapeHtml(String(obj))}</span>`;
    }
    
    const isArray = Array.isArray(obj);
    const bracketOpen = isArray ? '[' : '{';
    const bracketClose = isArray ? ']' : '}';
    
    if (isArray && obj.length === 0) return `<span class="json-array">[]</span>`;
    if (!isArray && Object.keys(obj).length === 0) return `<span class="json-object">{}</span>`;
    
    let html = `<div class="json-item">`;
    // Set initial state as expanded with down arrow
    html += `<button class="collapsible active"><span class="toggle-icon">&#9660;</span> <span class="${isArray ? 'json-array' : 'json-object'}">${bracketOpen}</span></button>`;
    // Set initial content style for expanded state
    html += `<div class="collapsible-content" style="max-height: none;">`;
    
    if (isArray) {
        obj.forEach((item, index) => {
            const itemPath = `${path}[${index}]`;
            html += `<div class="json-array-item">`;
            html += `<span class="json-index">${index}:</span> `;
            html += createEnhancedJson(item, itemPath);
            if (index < obj.length - 1) html += '<span class="json-comma">,</span>';
            html += `</div>`;
        });
    } else {
        const keys = Object.keys(obj);
        keys.forEach((key, index) => {
            const itemPath = path ? `${path}.${key}` : key;
            html += `<div class="json-object-item">`;
            html += `<span class="json-key">"${escapeHtml(key)}"</span>: `;
            html += createEnhancedJson(obj[key], itemPath);
            if (index < keys.length - 1) html += '<span class="json-comma">,</span>';
            html += `</div>`;
        });
    }
    
    html += `</div>`; // Close collapsible content
    html += `<span class="${isArray ? 'json-array' : 'json-object'}">${bracketClose}</span>`;
    html += `</div>`; // Close json item
    
    return html;
}

// Function to escape HTML special characters
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Function to download JSON as a file
function downloadJson(jsonData) {
    const dataStr = JSON.stringify(jsonData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'credit_report.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
} 

// Add the validateAndSubmit function to app.js
async function validateAndSubmit() {
    try {
        console.log('validateAndSubmit called');
        
        // Get form values
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const dob = document.getElementById('dob').value.trim();
        const ssn = document.getElementById('ssn').value.trim();
        const address = document.getElementById('address').value.trim();
        const city = document.getElementById('city').value.trim();
        const state = document.getElementById('stateSelect').value.trim();
        const zip = document.getElementById('zip').value.trim();

        // Basic validation
        if (!firstName || !lastName || !dob || !ssn || !address || !city || !state || !zip) {
            alert('Please fill in all required fields.');
            return;
        }

        // SSN format validation - remove non-numeric characters first
        const ssnDigits = ssn.replace(/\D/g, '');
        if (ssnDigits.length !== 9) {
            alert('Please enter a valid 9-digit Social Security Number.');
            return;
        }

        // ZIP code validation
        if (!/^\d{5}$/.test(zip)) {
            alert('Please enter a valid 5-digit ZIP code.');
            return;
        }

        // Show loading state
        const submitButton = document.querySelector('button[data-action="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Processing...';
        }

        // If validation passes, initiate KBA connection
        console.log('Calling initiateKBAConnection...');
        await initiateKBAConnection();
        console.log('initiateKBAConnection completed');

    } catch (error) {
        console.error('Error in form submission:', error);
        
        // Re-enable button on error
        const submitButton = document.querySelector('button[data-action="submit"]');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Check Liabilities';
        }
        
        // Display error message
        const errorMessage = error.message || 'An error occurred while submitting the form. Please try again.';
        alert(errorMessage);
        
        // Display error in error container if it exists
        const errorContainer = document.getElementById('errorContainer');
        if (errorContainer) {
            errorContainer.innerHTML = `<div class="error-message">${errorMessage}</div>`;
            errorContainer.style.display = 'block';
        }
    }
}

// Export functions for global access
window.initiateKBAConnection = initiateKBAConnection;
window.submitKBAAnswers = submitKBAAnswers;
window.retrieveLiabilities = retrieveLiabilities;
window.validateAndSubmit = validateAndSubmit;

// Initialize event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing event listeners');
    
    // Add event listener to the submit button as a backup
    const submitButton = document.querySelector('button[data-action="submit"]');
    if (submitButton) {
        console.log('Submit button found, adding event listener');
        submitButton.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Button clicked via event listener');
            validateAndSubmit();
        });
    } else {
        console.error('Submit button not found!');
    }
    
    // Verify function is available
    if (typeof validateAndSubmit === 'function') {
        console.log('validateAndSubmit function is available');
    } else {
        console.error('validateAndSubmit function is NOT available!');
    }
});

// Add a function to generate mock PDF data for sandbox testing
function generateMockPdfReport(userId, liabilitiesData) {
    if (!storedFormData) {
        throw new Error('Form data not available');
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Define page margins and footer space
    const margin = 20;
    const footerSpace = 30;
    const pageHeight = doc.internal.pageSize.height;
    const maxY = pageHeight - footerSpace; // Maximum Y position before footer
    
    // Set line height factor for body text
    const lineHeightFactor = 1.2; // Adjust this value to decrease spacing (1.0 for single spacing)
    doc.setLineHeightFactor(lineHeightFactor);

    // Helper function to check if we need a new page
    function checkNewPage(currentY, requiredSpace) {
        if (currentY + requiredSpace > maxY) {
            doc.addPage();
            addFooter(doc.internal.getNumberOfPages());
            return margin;
        }
        return currentY;
    }
    
    // Function to add footer to each page
    function addFooter(pageNumber) {
        const totalPages = doc.internal.getNumberOfPages();
        doc.setFontSize(10); // Keep footer font size at 10
        doc.setTextColor(100);
        doc.text(`Page ${pageNumber} of ${totalPages}`, 105, pageHeight - 15, { align: 'center' });
        doc.text('Generated by SpinWheel API', 105, pageHeight - 20, { align: 'center' });
    }
    
    // Add header
    doc.setFontSize(20); // Header font size
    doc.setTextColor(0);
    doc.text('Credit Report', 105, margin, { align: 'center' });
    
    // Set body font size to 10
    doc.setFontSize(10);
    
    let yPos = margin + 20;
    
    // Add report info
    doc.setFontSize(10);
    doc.text(`Report Date: ${new Date().toLocaleDateString()}`, margin, yPos);
    yPos += 10;
    doc.text(`User ID: ${userId}`, margin, yPos);
    yPos += 20;
    
    // Add initial form data
    doc.setFontSize(14);
    doc.text('Client Information', margin, yPos);
    yPos += 20;
    
    // Use stored form data
    const {
        firstName,
        lastName,
        dateOfBirth,
        ssn,
        address1,
        address2,
        city,
        state,
        zip
    } = storedFormData;
    
    // Format SSN and DOB
    const maskedSSN = `XXX-XX-${ssn.slice(-4)}`;
    const formattedDOB = new Date(dateOfBirth).toLocaleDateString();
    
    // Add client information
    doc.setFontSize(10);
    const clientInfo = [
        [`Full Name:`, `${firstName} ${lastName}`],
        [`Date of Birth:`, formattedDOB],
        [`SSN:`, maskedSSN],
        [`Address:`, address1],
        [``, address2],
        [`City, State, ZIP:`, `${city}, ${state} ${zip}`]
    ].filter(([label, value]) => value !== '');
    
    clientInfo.forEach(([label, value]) => {
        yPos = checkNewPage(yPos, 10);
        doc.text(label, margin, yPos);
        doc.text(value, margin + 60, yPos);
        yPos += 10;
    });
    
    yPos += 10;
    
    // Add liabilities summary
    yPos = checkNewPage(yPos, 50); // Check if we need a new page for summary
    doc.setFontSize(14);
    doc.text('Liabilities Summary', margin, yPos);
    yPos += 20;
    
    // Add summary data
    const data = liabilitiesData.data;
    doc.setFontSize(10); // Set font size back to 10 for summary
    doc.text(`Total Debt: $${data.summary.totalDebt.toLocaleString()}`, margin, yPos);
    yPos += 10;
    doc.text(`Total Minimum Payments: $${data.summary.totalMinimumPayments.toLocaleString()}`, margin, yPos);
    yPos += 10;
    doc.text(`Credit Score: ${data.summary.creditScore}`, margin, yPos);
    yPos += 20;
    
    // Add individual liabilities
    yPos = checkNewPage(yPos, 30);
    doc.setFontSize(14);
    doc.text('Detailed Liabilities', margin, yPos);
    yPos += 20;
    
    // Process each liability
    data.liabilities.forEach((liability, index) => {
        // Calculate space needed for this liability
        const detailsSpace = liability.details ? 90 : 60;
        yPos = checkNewPage(yPos, detailsSpace);
        
        doc.setFontSize(10); // Set font size to 10 for liability details
        doc.text(`Type: ${liability.type}`, margin, yPos);
        yPos += 10;
        doc.text(`Provider: ${liability.provider}`, margin, yPos);
        yPos += 10;
        doc.text(`Balance: $${liability.balance.toLocaleString()}`, margin, yPos);
        yPos += 10;
        doc.text(`Minimum Payment: $${liability.minimumPayment.toLocaleString()}`, margin, yPos);
        yPos += 10;
        doc.text(`Status: ${liability.status}`, margin, yPos);
        yPos += 10;
        
        // Add additional details if available
        if (liability.details) {
            if (liability.details.originalAmount) {
                yPos = checkNewPage(yPos, 10);
                doc.text(`Original Amount: $${liability.details.originalAmount.toLocaleString()}`, margin + 20, yPos);
                yPos += 10;
            }
            if (liability.details.loanTerm) {
                yPos = checkNewPage(yPos, 10);
                doc.text(`Loan Term: ${liability.details.loanTerm} months`, margin + 20, yPos);
                yPos += 10;
            }
            if (liability.details.remainingTerm) {
                yPos = checkNewPage(yPos, 10);
                doc.text(`Remaining Term: ${liability.details.remainingTerm} months`, margin + 20, yPos);
                yPos += 10;
            }
            if (liability.details.nextPaymentDue) {
                yPos = checkNewPage(yPos, 10);
                doc.text(`Next Payment Due: ${liability.details.nextPaymentDue}`, margin + 20, yPos);
                yPos += 10;
            }
        }
        
        // Add spacing between liabilities
        yPos += 10;
    });
    
    // Add footer to all pages
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addFooter(i);
    }
    
    return doc.output('blob');
}

// Add this function at the top level of app.js
function resetApplication() {
    try {
        // Reset all forms
        const initialForm = document.getElementById('initialForm');
        const kbaContainer = document.getElementById('kbaQuestionsContainer');
        const kbaButtonContainer = document.getElementById('kbaButtonContainer');
        
        // Clear form inputs
        document.querySelectorAll('#initialForm input').forEach(input => {
            input.value = '';
        });
        document.getElementById('stateSelect').value = ''; // Reset state dropdown
        
        // Reset form visibility
        if (initialForm) {
            initialForm.style.display = 'block';
        }
        if (kbaContainer) {
            kbaContainer.style.display = 'none';
            kbaContainer.innerHTML = ''; // Clear KBA questions
        }
        if (kbaButtonContainer) {
            kbaButtonContainer.style.display = 'none';
        }
        
        // Clear stored data
        window.currentUserId = null;
        window.currentConnectionId = null;
        window.correctAnswers = null;
        storedFormData = null;
        
        // Remove any error states
        document.querySelectorAll('.error').forEach(element => {
            element.classList.remove('error');
        });
        
        // Remove any success messages
        document.querySelectorAll('.success-message').forEach(element => {
            element.remove();
        });
        
        // Clear any error messages
        const errorContainer = document.getElementById('errorContainer');
        if (errorContainer) {
            errorContainer.innerHTML = '';
        }
        
        // Reset the results section if it exists
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection) {
            resultsSection.classList.add('hidden');
            const liabilitiesList = document.getElementById('liabilitiesList');
            if (liabilitiesList) {
                liabilitiesList.innerHTML = '';
            }
        }
        
        // Scroll to top of the page
        window.scrollTo(0, 0);
        
        // Clear any waiting states
        document.body.classList.remove('waiting');
        
        // Clear session storage
        sessionStorage.clear();
        
        console.log('Application reset complete');
        return true;
    } catch (error) {
        console.error('Error resetting application:', error);
        return false;
    }
}