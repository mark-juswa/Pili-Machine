// Make updateDashboardMetrics global so production.js can call it
window.updateDashboardMetrics = async function() { // Made async
    const ctx = document.getElementById('productionChart');
    const productionHistoryTableBody = document.querySelector('#dashboardProductionHistoryTableBody');
    const totalInputKgElement = document.getElementById('totalInputKg');
    const inputPurchasedDateElement = document.getElementById('inputPurchasedDate');
    const inputPurchasedSourceElement = document.getElementById('inputPurchasedSource');
    const latestPiliCrackedKgElement = document.getElementById('latestPiliCrackedKg');
    const latestPiliCrackedDateElement = document.getElementById('latestPiliCrackedDate');
    const expectedSalesMainMetric = document.getElementById('expectedSales');
    const expectedSalesPricePerKg = document.getElementById('expectedSalesPricePerKg');

    // Function to load production log data from Supabase
    async function loadProductionDataFromSupabase() {
        if (!window.supabase) {
            console.error('Supabase client not initialized.');
            return [];
        }
        const { data, error } = await window.supabase
            .from('production_logs')
            .select('date, input_kg, price_per_kg_input') // Select only necessary columns
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching production logs for dashboard:', error);
            return [];
        }
        return data.map(entry => ({
            date: entry.date,
            inputKg: parseFloat(entry.input_kg),
            price: parseFloat(entry.price_per_kg_input) // Cost per kg input
        }));
    }

    // Function to load selling price from Supabase
    async function loadSellingPriceFromSupabase() {
        if (!window.supabase) {
            console.error('Supabase client not initialized.');
            return 350; // Default if Supabase not ready
        }
        const { data, error } = await window.supabase
            .from('app_settings')
            .select('setting_value')
            .eq('setting_name', 'pili_selling_price')
            .single(); // Expecting only one row for this setting

        if (error && error.code !== 'PGRST116') { // PGRST116 means "no rows found"
            console.error('Error fetching selling price from Supabase:', error);
            return 350; // Default if error
        }
        return data ? parseFloat(data.setting_value) : 350; // Default to 350 if not found
    }

    let activityLogData = await loadProductionDataFromSupabase(); // Await data
    let currentSellingPrice = await loadSellingPriceFromSupabase(); // Await data

    // --- Chart Data Generation ---
    const today = new Date();
    const currentYear = today.getFullYear();

    const chartLabels = [];
    const monthlyData = new Array(12).fill(0);

    for (let i = 0; i < 12; i++) {
        const monthDate = new Date(currentYear, i, 1);
        chartLabels.push(monthDate.toLocaleString('en-US', { month: 'short' }) + '\n' + currentYear);
    }

    activityLogData.forEach(entry => {
        const entryDate = new Date(entry.date);
        if (entryDate.getFullYear() === currentYear) {
            const monthIndex = entryDate.getMonth();
            monthlyData[monthIndex] += entry.inputKg;
        }
    });

    if (ctx) {
        if (window.myProductionChart instanceof Chart) {
            window.myProductionChart.destroy();
        }

        window.myProductionChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'Production (Kg)',
                    data: monthlyData,
                    borderColor: '#2F6BFD',
                    backgroundColor: 'rgba(47, 107, 253, 0.2)',
                    tension: 0.4,
                    pointRadius: 5,
                    pointBackgroundColor: '#2F6BFD',
                    pointBorderColor: '#fff',
                    pointHoverRadius: 7,
                    fill: true,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: Math.max(90, Math.ceil(Math.max(...monthlyData) / 10) * 10 + 20),
                        ticks: {
                            stepSize: 10,
                            color: '#525459'
                        },
                        grid: {
                            color: '#E0E0E0',
                            drawBorder: false
                        }
                    },
                    x: {
                        ticks: {
                            color: '#525459'
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    let totalInputKg = 0;
    let totalExpectedSales = 0;
    let latestEntry = null;

    // Clear existing table rows in Production History
    if (productionHistoryTableBody) {
        productionHistoryTableBody.innerHTML = '';
    }

    activityLogData.forEach(entry => {
        totalInputKg += entry.inputKg;
        totalExpectedSales += (entry.inputKg * currentSellingPrice); // Using the loaded selling price

        // Populate Production History table
        if (productionHistoryTableBody) {
            const row = productionHistoryTableBody.insertRow();
            row.innerHTML = `
                <td>${entry.date}</td>
                <td>${entry.inputKg}</td>
                <td>₱${entry.price.toLocaleString('en-PH')}</td>
            `;
        }

        // Determine latest entry for 'Input Purchased' and 'Pili Cracked'
        if (!latestEntry || new Date(entry.date) > new Date(latestEntry.date)) {
            latestEntry = entry;
        }
    });

    // Update 'Input Purchased' card
    if (totalInputKgElement) {
        totalInputKgElement.textContent = `${totalInputKg}kg`;
    }
    if (inputPurchasedDateElement && latestEntry) {
        inputPurchasedDateElement.textContent = new Date(latestEntry.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } else if (inputPurchasedDateElement) {
        inputPurchasedDateElement.textContent = 'No Data';
    }
    if (inputPurchasedSourceElement && latestEntry) {
        inputPurchasedSourceElement.textContent = latestEntry.description || 'N/A'; // Assuming description is also available for latest entry
    } else if (inputPurchasedSourceElement) {
        inputPurchasedSourceElement.textContent = 'N/A';
    }

    // Update 'Pili Cracked' card
    if (latestPiliCrackedKgElement) {
        latestPiliCrackedKgElement.textContent = `${totalInputKg}kg`; // Assuming Pili Cracked shows the total input from the activity log
    }
    if (latestPiliCrackedDateElement && latestEntry) {
        latestPiliCrackedDateElement.textContent = new Date(latestEntry.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } else if (latestPiliCrackedDateElement) {
        latestPiliCrackedDateElement.textContent = 'No Data';
    }

    // Update 'Expected Sales' card
    if (expectedSalesMainMetric) {
        expectedSalesMainMetric.textContent = `₱${totalExpectedSales.toLocaleString('en-PH')}`;
    }
    if (expectedSalesPricePerKg) {
        expectedSalesPricePerKg.textContent = `Price Per Kg: ₱${currentSellingPrice.toLocaleString('en-PH')}`;
    }
};

document.addEventListener('DOMContentLoaded', function() {
    // Modal elements
    const priceModal = document.getElementById('priceModal');
    const currentSellingPriceInput = document.getElementById('currentSellingPrice');
    const saveSellingPriceBtn = document.getElementById('saveSellingPriceBtn');
    const cancelSellingPriceBtn = document.getElementById('cancelSellingPriceBtn');
    const expectedSalesCard = document.querySelector('.expected-sales-card');
    const sellingPriceMessage = document.getElementById('sellingPriceMessage');

    // Function to load selling price from Supabase (internal to this script)
    async function loadSellingPriceInternal() {
        if (!window.supabase) {
            console.error('Supabase client not initialized.');
            return 350; // Default if Supabase not ready
        }
        const { data, error } = await window.supabase
            .from('app_settings')
            .select('setting_value')
            .eq('setting_name', 'pili_selling_price')
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching selling price internally:', error);
            return 350;
        }
        return data ? parseFloat(data.setting_value) : 350;
    }

    // Function to save/update selling price to Supabase (internal to this script)
    async function saveSellingPriceInternal(price) {
        if (!window.supabase) {
            console.error('Supabase client not initialized.');
            return false;
        }

        // First, check if the setting already exists
        const { data: existingSetting, error: fetchError } = await window.supabase
            .from('app_settings')
            .select('id')
            .eq('setting_name', 'pili_selling_price')
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows found
            console.error('Error checking existing setting:', fetchError);
            return false;
        }

        let updateError;
        if (existingSetting) {
            // Update existing setting
            const { error } = await window.supabase
                .from('app_settings')
                .update({ setting_value: price, updated_at: new Date().toISOString() })
                .eq('id', existingSetting.id);
            updateError = error;
        } else {
            // Insert new setting if it doesn't exist
            const { error } = await window.supabase
                .from('app_settings')
                .insert({ setting_name: 'pili_selling_price', setting_value: price });
            updateError = error;
        }

        if (updateError) {
            console.error('Error saving selling price to Supabase:', updateError);
            return false;
        }
        return true;
    }

    // --- Modal Event Listeners ---
    if (expectedSalesCard) {
        expectedSalesCard.addEventListener('click', async function() { // Made async
            priceModal.classList.remove('hidden');
            currentSellingPriceInput.value = await loadSellingPriceInternal(); // Pre-fill with current value
            currentSellingPriceInput.focus();
            sellingPriceMessage.classList.add('hidden');
        });
    }

    if (saveSellingPriceBtn) {
        saveSellingPriceBtn.addEventListener('click', async function() { // Made async
            const newPrice = parseFloat(currentSellingPriceInput.value);
            if (typeof newPrice === 'number' && !isNaN(newPrice) && newPrice > 0) {
                const saveSuccess = await saveSellingPriceInternal(newPrice); // Await save operation

                if (saveSuccess) {
                    sellingPriceMessage.textContent = 'Selling price saved successfully!';
                    sellingPriceMessage.classList.remove('hidden', 'error-message');
                    sellingPriceMessage.classList.add('success-message');

                    setTimeout(async () => { // Made async
                        priceModal.classList.add('hidden');
                        sellingPriceMessage.classList.add('hidden');
                        await window.updateDashboardMetrics(); // Call async global function
                    }, 1000);
                } else {
                    sellingPriceMessage.textContent = 'Failed to save selling price. Please try again.';
                    sellingPriceMessage.classList.remove('hidden', 'success-message');
                    sellingPriceMessage.classList.add('error-message');
                }
            } else {
                sellingPriceMessage.textContent = 'Please enter a valid positive number.';
                sellingPriceMessage.classList.remove('hidden', 'success-message');
                sellingPriceMessage.classList.add('error-message');
            }
        });
    }

    if (cancelSellingPriceBtn) {
        cancelSellingPriceBtn.addEventListener('click', function() {
            priceModal.classList.add('hidden');
            sellingPriceMessage.classList.add('hidden');
        });
    }

    // Initial render of the dashboard metrics and chart when DOM is ready
    // Ensure this runs AFTER supabase client is initialized
    setTimeout(async () => { // Use a slight delay or wait for supabase global var
        if (window.supabase) {
            await window.updateDashboardMetrics(); // Call the async global function
        } else {
            console.warn('Supabase not yet available for initial dashboard update. Retrying...');
            // Simple retry mechanism if supabase isn't immediately available
            setTimeout(async () => {
                 if (window.supabase) {
                    await window.updateDashboardMetrics();
                 } else {
                    console.error('Supabase still not available. Dashboard might not load data.');
                 }
            }, 500);
        }
    }, 100); // Small delay to ensure supabase client is ready
});