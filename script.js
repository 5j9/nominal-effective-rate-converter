const MAPPING = {
    'Daily': 365,
    'Monthly': 12,
    'Quarterly': 4,
    'Annual': 1
};
const MATRIX_INPUTS = {};
const PERIOD_NAMES = ['Daily', 'Monthly', 'Quarterly', 'Annual'];
// All possible input types
const RATE_TYPES = ['nominal', 'effective_period'];

const principalAmountInput = document.getElementById('principalAmount');
const timeValueInput = document.getElementById('timeValue');
const timeUnitInputs = document.querySelectorAll('input[name="timeUnit"]');
const futureValueSpan = document.getElementById('futureValue');

let activeInputId = null; // Tracks the ID of the field last modified

// --- Initialization and Setup ---

// 1. Map all inputs and attach event listeners
PERIOD_NAMES.forEach(period => {
    RATE_TYPES.forEach(type => {
        const id = `${type}_${period}`;
        const element = document.getElementById(id);
        if (element) {
            MATRIX_INPUTS[id] = element;
            element.addEventListener('input', (event) => {
                // Clear the content of all other fields before calculation
                clearAllButOne(id);
                activeInputId = id;
                updateAllRates(id);
            });
        }
    });
});

// 2. Setup Future Value listeners
principalAmountInput.addEventListener('input', calculateFutureValue);
timeValueInput.addEventListener('input', calculateFutureValue);
timeUnitInputs.forEach(input => {
    input.addEventListener('change', calculateFutureValue);
});

// --- Core Conversion Functions ---

/**
 * Clears all fields in the matrix except the one being edited.
 * @param {string} excludeId - The ID of the input field to keep.
 */
function clearAllButOne(excludeId) {
    for (const id in MATRIX_INPUTS) {
        if (id !== excludeId) {
            MATRIX_INPUTS[id].value = '';
        }
    }
}

/**
 * Converts the single input rate into the Effective Annual Rate (EAR).
 * @param {string} inputId - The ID of the field that was just edited.
 * @returns {number | null} The Effective Annual Rate (EAR) as a decimal, or null if input is invalid.
 */
function calculateEffectiveAnnualRate(inputId) {
    const inputElement = MATRIX_INPUTS[inputId];
    if (!inputElement) return null;

    const inputValue = parseFloat(inputElement.value);
    if (isNaN(inputValue) || inputValue < 0) return null;

    const rate = inputValue / 100;
    const parts = inputId.split('_');

    // Determine the base type and period from the ID
    let type = parts[0];
    let period = parts[parts.length - 1];

    // Handle the composite type name
    if (parts[1] === 'period') type = 'effective_period';

    const m = MAPPING[period]; // Compounding periods per year

    if (type === 'effective_period') {
        // The input is the Effective Rate for the compounding period (r_period).
        // EAR = (1 + r_period)^m - 1
        return Math.pow(1 + rate, m) - 1;
    } else { // type === 'nominal' (Stated Annual Rate for Period m)
        // The input is the Stated Annual Rate compounded m times.
        // EAR = (1 + Nominal_Annual/m)^m - 1
        return Math.pow(1 + rate / m, m) - 1;
    }
}


/**
 * Updates all other fields in the matrix based on the calculated EAR.
 * @param {number} earDecimal - The Effective Annual Rate as a decimal.
 * @param {string} excludeId - The ID of the field to skip updating.
 */
function updateMatrix(earDecimal, excludeId) {

    // 1. Iterate through all targets and convert from EAR.
    for (const id in MATRIX_INPUTS) {
        if (id === excludeId) continue;

        const parts = id.split('_');
        let type = parts[0];
        let period = parts[parts.length - 1];

        // Handle the composite type name
        if (parts[1] === 'period') type = 'effective_period';

        const m = MAPPING[period];

        let result; // The final rate value in percent

        if (type === 'effective_period') {
            // Target: Effective Period Rate (r_period)
            // Formula: r_period = (1 + EAR)^(1/m) - 1
            result = (Math.pow(1 + earDecimal, 1 / m) - 1) * 100;

        } else { // type === 'nominal' (Stated Annual Rate for Period m)
            // Target: Stated Annual Rate (Nominal_m)
            // Formula: Nominal_m = m * [(1 + EAR)^(1/m) - 1] 
            const effectivePeriodRate = Math.pow(1 + earDecimal, 1 / m) - 1;
            result = (effectivePeriodRate * m) * 100;
        }

        MATRIX_INPUTS[id].value = result.toFixed(6); // Use 6 decimal places for precision
    }
}

/**
 * Main orchestration function.
 * @param {string} inputId - The ID of the field that was just edited.
 */
function updateAllRates(inputId) {
    const ear = calculateEffectiveAnnualRate(inputId);

    if (ear !== null) {
        updateMatrix(ear, inputId);
    } else {
        // If the input is invalid (cleared or non-positive), clear the rest of the matrix
        clearAllButOne(inputId);
    }

    // Recalculate Future Value regardless of rate validity (it handles null/zero rates)
    calculateFutureValue();
}

// --- Future Value Calculation ---

function calculateFutureValue() {
    const principal = parseFloat(principalAmountInput.value || 1000); // Default to 1000
    const timeValue = parseFloat(timeValueInput.value || 1);
    let timeUnit = 'years';

    timeUnitInputs.forEach(input => {
        if (input.checked) {
            timeUnit = input.value;
        }
    });

    // Determine the active EAR from the last input field, or default to 0.
    let earDecimal = 0;
    if (activeInputId) {
        const calculatedEar = calculateEffectiveAnnualRate(activeInputId);
        if (calculatedEar !== null) {
            earDecimal = calculatedEar;
        }
    }

    if (isNaN(principal) || principal < 0 || isNaN(timeValue) || timeValue < 0) {
        futureValueSpan.textContent = "Invalid Input";
        return;
    }

    // Convert time to years
    let timeInYears;
    switch (timeUnit) {
        case 'days':
            timeInYears = timeValue / 365;
            break;
        case 'months':
            timeInYears = timeValue / 12;
            break;
        case 'years':
        default:
            timeInYears = timeValue;
            break;
    }

    // Formula: FV = PV * (1 + EAR)^t
    const futureValue = principal * Math.pow(1 + earDecimal, timeInYears);

    futureValueSpan.textContent = '$' + futureValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Set initial default values and run calculation once
document.getElementById('principalAmount').value = 1000;
document.getElementById('timeValue').value = 1;
document.getElementById('timeUnitYears').checked = true;

// Initialize with a default rate (e.g., 5% Annual EAR)
const initialRateId = 'nominal_Annual';
document.getElementById(initialRateId).value = 5;
activeInputId = initialRateId;
updateAllRates(initialRateId); 
