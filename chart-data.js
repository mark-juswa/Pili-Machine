// Make updateDashboardMetrics global so production.js can call it
window.updateDashboardMetrics = async function() { // Made async
    const ctx = document.getElementById('productionChart');

    // Function to load batches with shell and nut readings from Supabase
    async function loadBatchesWithReadings() {
        if (!window.supabase) {
            console.error('Supabase client not initialized.');
            return [];
        }

        // Fetch batches with their shell and nut readings (only non-sold batches)
        const { data: batches, error: batchesError } = await window.supabase
            .from('batches')
            .select('id, created_at, status, note')
            .neq('status', 'sold')
            .order('created_at', { ascending: false });

        if (batchesError) {
            console.error('Error fetching batches:', batchesError);
            return [];
        }

        // For each batch, fetch shell and nut readings
        const batchesWithReadings = await Promise.all(
            batches.map(async (batch) => {
                // Fetch shell readings for this batch
                const { data: shellReadings, error: shellError } = await window.supabase
                    .from('shell_readings')
                    .select('weight')
                    .eq('batch_id', batch.id);

                if (shellError) {
                    console.error(`Error fetching shell readings for batch ${batch.id}:`, shellError);
                }

                // Fetch nut readings for this batch
                const { data: nutReadings, error: nutError } = await window.supabase
                    .from('nut_readings')
                    .select('weight')
                    .eq('batch_id', batch.id);

                if (nutError) {
                    console.error(`Error fetching nut readings for batch ${batch.id}:`, nutError);
                }

                // Calculate totals
                const shellWeight = shellReadings
                    ? shellReadings.reduce((sum, reading) => sum + parseFloat(reading.weight || 0), 0)
                    : 0;
                const nutWeight = nutReadings
                    ? nutReadings.reduce((sum, reading) => sum + parseFloat(reading.weight || 0), 0)
                    : 0;
                const totalWeight = shellWeight + nutWeight;
                
                // Input weight is the nut_weight (weight to crack - this is what was put in)
                // After cracking, we measure shell_weight (the shells removed)
                // The actual nut weight remaining = Input Weight - Shell Weight - Other Losses
                // Weight Lost = Input Weight - (Shell Weight + Remaining Nut Weight)
                // Since we don't have remaining nut weight separately, we'll calculate:
                // Weight Lost = Input Weight - Shell Weight (the difference represents weight lost)
                // This assumes the remaining weight is the nut weight, and any difference is loss
                const inputWeight = nutWeight; // Input weight is what was put in to crack
                // Weight lost = Input - Shell (assuming remaining is nut weight, any difference is loss)
                // Or more simply: Weight Lost = Shell Weight (the material removed)
                // Let's use: Weight Lost = Input Weight - Shell Weight
                const weightLost = inputWeight - shellWeight; // Weight lost during cracking process

                return {
                    id: batch.id,
                    created_at: batch.created_at,
                    status: batch.status,
                    note: batch.note || '',
                    inputWeight: inputWeight,
                    shellWeight: shellWeight,
                    nutWeight: nutWeight,
                    totalWeight: totalWeight,
                    weightLost: weightLost
                };
            })
        );

        return batchesWithReadings;
    }

    // Function to load selling price from Supabase (for chart data)
    async function loadSellingPriceFromSupabase() {
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
            console.error('Error fetching selling price from Supabase:', error);
            return 350;
        }
        return data ? parseFloat(data.setting_value) : 350;
    }

    // Function to load sold batches with shell and nut readings
    async function loadSoldBatches() {
        if (!window.supabase) {
            console.error('Supabase client not initialized.');
            return [];
        }

        // Fetch sold batches with their shell and nut readings
        const { data: batches, error: batchesError } = await window.supabase
            .from('batches')
            .select('id, created_at, status, note, finished_at')
            .eq('status', 'sold')
            .order('finished_at', { ascending: false });

        if (batchesError) {
            console.error('Error fetching sold batches:', batchesError);
            return [];
        }

        // For each batch, fetch shell and nut readings
        const batchesWithReadings = await Promise.all(
            batches.map(async (batch) => {
                // Fetch shell readings for this batch
                const { data: shellReadings, error: shellError } = await window.supabase
                    .from('shell_readings')
                    .select('weight')
                    .eq('batch_id', batch.id);

                if (shellError) {
                    console.error(`Error fetching shell readings for batch ${batch.id}:`, shellError);
                }

                // Fetch nut readings for this batch
                const { data: nutReadings, error: nutError } = await window.supabase
                    .from('nut_readings')
                    .select('weight')
                    .eq('batch_id', batch.id);

                if (nutError) {
                    console.error(`Error fetching nut readings for batch ${batch.id}:`, nutError);
                }

                // Calculate totals
                const shellWeight = shellReadings
                    ? shellReadings.reduce((sum, reading) => sum + parseFloat(reading.weight || 0), 0)
                    : 0;
                const nutWeight = nutReadings
                    ? nutReadings.reduce((sum, reading) => sum + parseFloat(reading.weight || 0), 0)
                    : 0;
                const totalWeight = shellWeight + nutWeight;
                
                // Input weight is the nut_weight (weight to crack)
                const inputWeight = nutWeight;
                const outputWeight = shellWeight + nutWeight;
                const weightLost = inputWeight - outputWeight;

                return {
                    id: batch.id,
                    created_at: batch.created_at,
                    finished_at: batch.finished_at || batch.created_at,
                    status: batch.status,
                    note: batch.note || '',
                    inputWeight: inputWeight,
                    shellWeight: shellWeight,
                    nutWeight: nutWeight,
                    totalWeight: totalWeight,
                    weightLost: weightLost
                };
            })
        );

        return batchesWithReadings;
    }

    const batchesData = await loadBatchesWithReadings();
    const soldBatchesData = await loadSoldBatches();
    let currentSellingPrice = await loadSellingPriceFromSupabase();

    // --- Chart Data Generation ---
    const today = new Date();
    const currentYear = today.getFullYear();

    const chartLabels = [];
    const monthlyData = new Array(12).fill(0);

    for (let i = 0; i < 12; i++) {
        const monthDate = new Date(currentYear, i, 1);
        chartLabels.push(monthDate.toLocaleString('en-US', { month: 'short' }) + '\n' + currentYear);
    }

    batchesData.forEach(batch => {
        const entryDate = new Date(batch.created_at);
        if (entryDate.getFullYear() === currentYear) {
            const monthIndex = entryDate.getMonth();
            monthlyData[monthIndex] += batch.totalWeight;
        }
    });

    if (ctx) {
        if (window.myProductionChart instanceof Chart) {
            window.myProductionChart.destroy();
        }

        const maxValue = Math.max(...monthlyData, 0);
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
                        max: Math.max(90, Math.ceil(maxValue / 10) * 10 + 20),
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

    // Calculate summary statistics
    let totalBatches = batchesData.length;
    let totalShellWeight = 0;
    let totalNutWeight = 0;
    let totalProduction = 0;
    let totalInputWeight = 0;
    let totalWeightLost = 0;
    let averagePerBatch = 0;
    let averageWeightLost = 0;
    let totalSalesValue = 0;
    let latestBatch = null;

    batchesData.forEach(batch => {
        totalShellWeight += batch.shellWeight;
        totalNutWeight += batch.nutWeight;
        totalProduction += batch.totalWeight;
        totalInputWeight += batch.inputWeight;
        totalWeightLost += batch.weightLost;

        // Calculate sales value for this batch (based on nut weight)
        batch.salesValue = batch.nutWeight * currentSellingPrice;
        totalSalesValue += batch.salesValue;

        // Find latest batch
        if (!latestBatch || new Date(batch.created_at) > new Date(latestBatch.created_at)) {
            latestBatch = batch;
        }
    });

    if (totalBatches > 0) {
        averagePerBatch = totalProduction / totalBatches;
        averageWeightLost = totalWeightLost / totalBatches;
    }

    // Update summary statistics cards
    const totalBatchesElement = document.getElementById('totalBatches');
    const totalShellWeightElement = document.getElementById('totalShellWeight');
    const totalShellWeightDateElement = document.getElementById('totalShellWeightDate');
    const totalNutWeightElement = document.getElementById('totalNutWeight');
    const totalNutWeightDateElement = document.getElementById('totalNutWeightDate');
    const totalProductionElement = document.getElementById('totalProduction');
    const averagePerBatchElement = document.getElementById('averagePerBatch');
    const latestBatchDateElement = document.getElementById('latestBatchDate');
    const latestBatchWeightElement = document.getElementById('latestBatchWeight');

    if (totalBatchesElement) {
        totalBatchesElement.textContent = totalBatches;
    }

    if (totalShellWeightElement) {
        totalShellWeightElement.textContent = `${totalShellWeight.toFixed(2)}kg`;
    }
    if (totalShellWeightDateElement && latestBatch) {
        const date = new Date(latestBatch.created_at);
        totalShellWeightDateElement.textContent = `Last updated: ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }

    if (totalNutWeightElement) {
        totalNutWeightElement.textContent = `${totalNutWeight.toFixed(2)}kg`;
    }
    if (totalNutWeightDateElement && latestBatch) {
        const date = new Date(latestBatch.created_at);
        totalNutWeightDateElement.textContent = `Last updated: ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }

    if (totalProductionElement) {
        totalProductionElement.textContent = `${totalProduction.toFixed(2)}kg`;
    }

    if (averagePerBatchElement) {
        averagePerBatchElement.textContent = `${averagePerBatch.toFixed(2)}kg`;
    }

    // Update average weight lost card
    const averageWeightLostElement = document.getElementById('averageWeightLost');
    if (averageWeightLostElement) {
        averageWeightLostElement.textContent = `${averageWeightLost.toFixed(2)}kg`;
    }

    if (latestBatchDateElement && latestBatch) {
        const date = new Date(latestBatch.created_at);
        latestBatchDateElement.textContent = date.toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } else if (latestBatchDateElement) {
        latestBatchDateElement.textContent = 'No batches yet';
    }

    if (latestBatchWeightElement && latestBatch) {
        latestBatchWeightElement.textContent = `${latestBatch.totalWeight.toFixed(2)}kg`;
    } else if (latestBatchWeightElement) {
        latestBatchWeightElement.textContent = '0kg';
    }

    // Update sales summary card
    const totalSalesValueElement = document.getElementById('totalSalesValue');
    const salesPricePerKgElement = document.getElementById('salesPricePerKg');

    if (totalSalesValueElement) {
        totalSalesValueElement.textContent = `₱${totalSalesValue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    if (salesPricePerKgElement) {
        salesPricePerKgElement.textContent = `Price per kg: ₱${currentSellingPrice.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Populate batches table
    const batchesTableBody = document.getElementById('batchesTableBody');
    if (batchesTableBody) {
        batchesTableBody.innerHTML = '';

        if (batchesData.length === 0) {
            const row = batchesTableBody.insertRow();
            row.innerHTML = `<td colspan="10" class="text-center py-4">No batches found.</td>`;
        } else {
            batchesData.forEach(batch => {
                const row = batchesTableBody.insertRow();
                const date = new Date(batch.created_at);
                const formattedDate = date.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                // Calculate sales value for this batch
                const salesValue = batch.nutWeight * currentSellingPrice;
                
                // Format weight lost (show negative values in red or with minus sign)
                const weightLostDisplay = batch.weightLost >= 0 
                    ? batch.weightLost.toFixed(2) 
                    : `<span style="color: #dc2626;">${batch.weightLost.toFixed(2)}</span>`;

                row.innerHTML = `
                    <td>${batch.id}</td>
                    <td>${formattedDate}</td>
                    <td>${batch.status || 'N/A'}</td>
                    <td>${batch.inputWeight.toFixed(2)}</td>
                    <td>${batch.shellWeight.toFixed(2)}</td>
                    <td>${batch.nutWeight.toFixed(2)}</td>
                    <td>${batch.totalWeight.toFixed(2)}</td>
                    <td>${weightLostDisplay}</td>
                    <td>₱${salesValue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>${batch.note || 'N/A'}</td>
                    <td>
                        <button class="btn-sell" data-batch-id="${batch.id}">Sell</button>
                    </td>
                `;
            });

            // Add event listeners to sell buttons
            document.querySelectorAll('.btn-sell').forEach(btn => {
                btn.addEventListener('click', async function() {
                    const batchId = this.dataset.batchId;
                    await window.sellBatch(batchId);
                });
            });
        }
    }

    // Populate sales table
    const salesTableBody = document.getElementById('salesTableBody');
    if (salesTableBody) {
        salesTableBody.innerHTML = '';

        if (soldBatchesData.length === 0) {
            const row = salesTableBody.insertRow();
            row.innerHTML = `<td colspan="7" class="text-center py-4">No sales yet.</td>`;
        } else {
            soldBatchesData.forEach(batch => {
                const row = salesTableBody.insertRow();
                const soldDate = new Date(batch.finished_at);
                const formattedSoldDate = soldDate.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                // Calculate sales value for this batch (use price at time of sale or current price)
                const salesValue = batch.nutWeight * currentSellingPrice;

                row.innerHTML = `
                    <td>${batch.id}</td>
                    <td>${formattedSoldDate}</td>
                    <td>${batch.shellWeight.toFixed(2)}</td>
                    <td>${batch.nutWeight.toFixed(2)}</td>
                    <td>${batch.totalWeight.toFixed(2)}</td>
                    <td>₱${salesValue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>${batch.note || 'N/A'}</td>
                `;
            });
        }
    }
};

// Function to sell a batch (make it globally accessible)
window.sellBatch = async function(batchId) {
    if (!window.supabase) {
        console.error('Supabase client not initialized.');
        alert('Error: Database connection not available.');
        return;
    }

    if (!confirm('Are you sure you want to mark this batch as sold? It will be moved to the sales table.')) {
        return;
    }

    // Update batch status to 'sold' and set finished_at timestamp
    const { error } = await window.supabase
        .from('batches')
        .update({ 
            status: 'sold',
            finished_at: new Date().toISOString()
        })
        .eq('id', batchId);

    if (error) {
        console.error('Error selling batch:', error);
        alert('Failed to sell batch. Please try again.');
        return;
    }

    console.log('Batch sold successfully.');
    
    // Refresh the dashboard
    if (typeof window.updateDashboardMetrics === 'function') {
        await window.updateDashboardMetrics();
    }
};

document.addEventListener('DOMContentLoaded', function() {
    // Modal elements
    const priceModal = document.getElementById('priceModal');
    const currentSellingPriceInput = document.getElementById('currentSellingPrice');
    const saveSellingPriceBtn = document.getElementById('saveSellingPriceBtn');
    const cancelSellingPriceBtn = document.getElementById('cancelSellingPriceBtn');
    const totalSalesValueCard = document.getElementById('totalSalesValueCard');
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
    // Make Total Sales Value card clickable to update selling price
    if (totalSalesValueCard) {
        totalSalesValueCard.style.cursor = 'pointer';
        totalSalesValueCard.addEventListener('click', async function() {
            priceModal.classList.remove('hidden');
            currentSellingPriceInput.value = await loadSellingPriceInternal();
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