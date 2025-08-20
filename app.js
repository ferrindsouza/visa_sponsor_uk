// This file contains all the JavaScript logic for the UK Visa Sponsor Filter app.

const fileInput = document.getElementById('csvFile');
const filterBtn = document.getElementById('filterBtn');
const downloadBtn = document.getElementById('downloadBtn');
const companyTypeInput = document.getElementById('companyType');
const countrySelect = document.getElementById('country');
const sponsorTypeSelect = document.getElementById('sponsorType');
const routeSelect = document.getElementById('route');
const statusMessage = document.getElementById('statusMessage');
const messageText = document.getElementById('messageText');
const loadingIndicator = document.getElementById('loadingIndicator');
const resultsSection = document.getElementById('resultsSection');
const resultsTableBody = document.querySelector('#resultsTable tbody');
const resultsTableHeader = document.querySelector('#resultsTable thead tr');
const resultCount = document.getElementById('resultCount');
const noResults = document.getElementById('noResults');
const geminiOutput = document.getElementById('geminiOutput');
const geminiContent = document.getElementById('geminiContent');

let allData = [];
let headers = [];
let filteredData = []; // Store filtered data for download

// --- Gemini API Key (Required for local use) ---
// This key is automatically provided in the online environment, but you need to add your own for local use.
// You can get a key from https://aistudio.google.com/
// const API_KEY = ""; // Uncomment this and add your key if you are running this locally.
const API_KEY = ""; // In the online canvas environment, this is automatically handled.
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEY}`;

// Helper function to show a status message
function showStatus(message, isLoading = false) {
    statusMessage.classList.remove('hidden');
    messageText.textContent = message;
    if (isLoading) {
        loadingIndicator.classList.remove('hidden');
    } else {
        loadingIndicator.classList.add('hidden');
    }
}

// Helper function to clear all results and messages
function clearResults() {
    resultsSection.classList.add('hidden');
    noResults.classList.add('hidden');
    statusMessage.classList.add('hidden');
    downloadBtn.classList.add('hidden');
    geminiOutput.classList.add('hidden');
    resultsTableBody.innerHTML = '';
    resultsTableHeader.innerHTML = '';
}

// Event listener for file selection
fileInput.addEventListener('change', (event) => {
    clearResults();
    const file = event.target.files[0];
    if (file) {
        showStatus('File selected: ' + file.name);
        readCSV(file);
    }
});

// Function to read and parse the CSV file
function readCSV(file) {
    if (file.size > 20 * 1024 * 1024) { // 20 MB limit to prevent browser issues
        showStatus('File is too large. Please select a file under 20 MB.', false);
        return;
    }

    const reader = new FileReader();

    reader.onloadstart = () => showStatus('Reading file...', true);
    reader.onload = (e) => {
        const text = e.target.result;
        parseCSV(text);
        showStatus('File read successfully. Ready to filter.', false);
    };
    reader.onerror = () => showStatus('Error reading file. Please try again.', false);

    reader.readAsText(file);
}

// Function to parse CSV text into an array of objects
function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    // Updated to use the new column names
    headers = ['Organisation Name', 'Town/City', 'County', 'Type & Rating', 'Route'];
    
    allData = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        let obj = {};
        obj['Organisation Name'] = values[0];
        obj['Town/City'] = values[1];
        obj['County'] = values[2];
        obj['Type & Rating'] = values[3];
        obj['Route'] = values[4];
        return obj;
    });
}

// Event listener for the filter button
filterBtn.addEventListener('click', () => {
    if (allData.length === 0) {
        showStatus('Please upload a CSV file first.', false);
        return;
    }
    applyFilters();
});

// Main function to apply all filters
function applyFilters() {
    clearResults();
    showStatus('Applying filters...', true);
    
    const companyTypeKeywords = companyTypeInput.value.toLowerCase().split(',').map(k => k.trim());
    const countryValue = countrySelect.value;
    const sponsorTypeValue = sponsorTypeSelect.value;
    const routeValue = routeSelect.value;
    
    // Keywords for different regions
    const scotlandKeywords = ['scotland', 'edinburgh', 'glasgow', 'aberdeen', 'dundee', 'inverness'];
    const ukKeywords = ['england', 'wales', 'northern ireland', 'london', 'manchester', 'birmingham', 'leeds', 'liverpool', 'cardiff', 'belfast'];

    // Use a timeout to prevent UI from freezing on large files
    setTimeout(() => {
        filteredData = allData.filter(company => {
            const orgName = (company['Organisation Name'] || '').toLowerCase();
            const townCity = (company['Town/City'] || '').toLowerCase();
            const county = (company['County'] || '').toLowerCase();
            const typeRating = (company['Type & Rating'] || '').toLowerCase();
            const route = (company.Route || '').toLowerCase();

            // Filter 1: IT-based company
            const isITCompany = companyTypeKeywords.some(keyword => 
                orgName.includes(keyword) || 
                townCity.includes(keyword) || 
                county.includes(keyword)
            );

            // Filter 2: Country (Scotland or other UK)
            let isCountryMatch = false;
            if (countryValue === 'Scotland') {
                isCountryMatch = scotlandKeywords.some(keyword => townCity.includes(keyword) || county.includes(keyword));
            } else if (countryValue === 'UK') {
                isCountryMatch = ukKeywords.some(keyword => townCity.includes(keyword) || county.includes(keyword));
                // Ensure it's not also a Scottish location to avoid overlap
                isCountryMatch = isCountryMatch && !scotlandKeywords.some(keyword => townCity.includes(keyword) || county.includes(keyword));
            }

            // Filter 3: Sponsor Type and Rating
            const isSponsorTypeMatch = (sponsorTypeValue === 'Worker (A rating)' && typeRating.includes('worker') && typeRating.includes('(a rating)')) || 
                                      (sponsorTypeValue === 'Temporary' && typeRating.includes('temporary'));

            // Filter 4: Route
            const isRouteMatch = route.includes(routeValue.toLowerCase());

            return isITCompany && isCountryMatch && isSponsorTypeMatch && isRouteMatch;
        });
        
        showStatus('Filtering complete. Displaying results.', false);
        displayResults(filteredData);
    }, 10);
}

// Function to display filtered results in the table
function displayResults(data) {
    resultsTableHeader.innerHTML = '';
    resultsTableBody.innerHTML = '';

    if (data.length === 0) {
        resultsSection.classList.add('hidden');
        noResults.classList.remove('hidden');
        downloadBtn.classList.add('hidden');
        return;
    }

    resultsSection.classList.remove('hidden');
    noResults.classList.add('hidden');
    downloadBtn.classList.remove('hidden');

    // Set the result count
    resultCount.textContent = `${data.length} results found`;

    // Create table headers from the original CSV headers
    const newHeaders = [...headers, 'LinkedIn', 'AI Actions'];
    newHeaders.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        th.classList.add('px-6', 'py-3', 'text-xs', 'font-medium', 'text-gray-500', 'uppercase', 'tracking-wider');
        resultsTableHeader.appendChild(th);
    });

    // Create table rows for the filtered data
    data.forEach(rowData => {
        const row = document.createElement('tr');
        row.classList.add('hover:bg-gray-50');
        
        // Add cells for the original data
        headers.forEach(header => {
            const cell = document.createElement('td');
            cell.textContent = rowData[header] || 'N/A';
            cell.classList.add('px-6', 'py-4', 'whitespace-nowrap', 'text-sm', 'text-gray-900');
            row.appendChild(cell);
        });

        // Add a new cell for the LinkedIn link
        const linkedInCell = document.createElement('td');
        const companyName = rowData['Organisation Name'];
        if (companyName) {
            const linkedInUrl = `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(companyName)}`;
            const link = document.createElement('a');
            link.href = linkedInUrl;
            link.textContent = 'View on LinkedIn';
            link.target = '_blank';
            link.classList.add('text-blue-600', 'hover:underline', 'font-medium');
            linkedInCell.appendChild(link);
        }
        linkedInCell.classList.add('px-6', 'py-4', 'whitespace-nowrap', 'text-sm', 'text-gray-900');
        row.appendChild(linkedInCell);

        // Add a new cell for the Gemini API buttons
        const actionsCell = document.createElement('td');
        actionsCell.classList.add('px-6', 'py-4', 'whitespace-nowrap', 'text-sm', 'text-gray-900', 'space-x-2');
        
        const summaryBtn = document.createElement('button');
        summaryBtn.textContent = '✨ Summarize Company';
        summaryBtn.classList.add('bg-purple-100', 'text-purple-800', 'font-bold', 'py-1', 'px-3', 'rounded-full', 'hover:bg-purple-200');
        summaryBtn.addEventListener('click', () => generateText(rowData['Organisation Name'], 'summary'));

        const emailBtn = document.createElement('button');
        emailBtn.textContent = '✨ Generate Email';
        emailBtn.classList.add('bg-purple-100', 'text-purple-800', 'font-bold', 'py-1', 'px-3', 'rounded-full', 'hover:bg-purple-200');
        emailBtn.addEventListener('click', () => generateText(rowData['Organisation Name'], 'email'));

        const itCheckBtn = document.createElement('button');
        itCheckBtn.textContent = '✨ Verify IT Company';
        itCheckBtn.classList.add('bg-purple-100', 'text-purple-800', 'font-bold', 'py-1', 'px-3', 'rounded-full', 'hover:bg-purple-200');
        itCheckBtn.addEventListener('click', () => generateText(rowData['Organisation Name'], 'it_check'));

        actionsCell.appendChild(summaryBtn);
        actionsCell.appendChild(emailBtn);
        actionsCell.appendChild(itCheckBtn);
        row.appendChild(actionsCell);

        resultsTableBody.appendChild(row);
    });
}

// Function to create and download a CSV file
function downloadCSV(data) {
    if (data.length === 0) {
        showStatus('No data to download.', false);
        return;
    }

    // Generate CSV content
    const csvRows = [];
    csvRows.push(headers.map(header => `"${header}"`).join(',')); // Add headers
    data.forEach(row => {
        const values = headers.map(header => `"${row[header] || ''}"`);
        csvRows.push(values.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    // Create a temporary link and trigger a download
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'filtered_companies.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showStatus('Filtered CSV downloaded successfully!', false);
}

// --- New Gemini API Functions ---
// Function to handle exponential backoff for API calls
const withExponentialBackoff = async (fn, retries = 3, delay = 1000) => {
    try {
        return await fn();
    } catch (error) {
        if (retries > 0) {
            console.log(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return withExponentialBackoff(fn, retries - 1, delay * 2);
        }
        throw error;
    }
};

// Main function to call the Gemini API
async function generateText(companyName, type) {
    geminiOutput.classList.remove('hidden');
    geminiContent.textContent = 'Generating...';
    
    let prompt;
    if (type === 'summary') {
        prompt = `Provide a brief, one-paragraph summary of what the company "${companyName}" does. Focus on their industry and services. If you don't know, respond with "Information not available for this company."`;
    } else if (type === 'email') {
        prompt = `Draft a concise, professional email to a recruiter for a job application at "${companyName}". Keep it under 100 words. The email should express strong interest in the company, mention the job seeker is a skilled worker, and ask about potential opportunities.`;
    } else if (type === 'it_check') {
        prompt = `Is "${companyName}" a company primarily in the IT, technology, or software industry? Respond with a single word: "Yes," "No," or "Unsure."`;
    }


    try {
        const payload = {
            contents: [{
                role: "user",
                parts: [{ text: prompt }]
            }]
        };

        const response = await withExponentialBackoff(() => fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }));

        if (!response.ok) {
            throw new Error(`API call failed with status: ${response.status}`);
        }

        const result = await response.json();
        const generatedText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (generatedText) {
            geminiContent.textContent = generatedText;
        } else {
            geminiContent.textContent = 'Could not generate a response. Please try again.';
        }

    } catch (error) {
        console.error('Error calling Gemini API:', error);
        geminiContent.textContent = 'An error occurred. Please try again later.';
    }
}
