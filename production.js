document.addEventListener('DOMContentLoaded', function() {
    const activityLogTableBody = document.getElementById('activityLogTableBody');
    const crackButton = document.getElementById('crackPiliBtn');
    const cancelButton = document.getElementById('cancelProductionBtn');
    const weightToCrackInput = document.getElementById('weightToCrack');
    const shellWeightInput = document.getElementById('shellWeight');
    const descriptionInput = document.getElementById('description');

    // Elements for the Crack Success Modal
    const crackSuccessModal = document.getElementById('crackSuccessModal');
    const crackSuccessMessage = document.getElementById('crackSuccessMessage');
    const closeCrackSuccessBtn = document.getElementById('closeCrackSuccessBtn');

    // Function to load activity log data from Supabase (batches with shell and nut readings)
    async function loadActivityLogFromSupabase() {
        if (!window.supabase) {
            console.error('Supabase client not initialized.');
            return [];
        }

        // Fetch batches with their shell and nut readings
        const { data: batches, error: batchesError } = await window.supabase
            .from('batches')
            .select('id, created_at, status, note')
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
                    .select('id, weight')
                    .eq('batch_id', batch.id);

                if (shellError) {
                    console.error(`Error fetching shell readings for batch ${batch.id}:`, shellError);
                }

                // Fetch nut readings for this batch
                const { data: nutReadings, error: nutError } = await window.supabase
                    .from('nut_readings')
                    .select('id, weight')
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

                // Get the first reading ID for deletion (we'll delete the batch which cascades)
                const firstNutReadingId = nutReadings && nutReadings.length > 0 ? nutReadings[0].id : null;

                return {
                    id: batch.id,
                    created_at: batch.created_at,
                    status: batch.status,
                    note: batch.note || '',
                    shellWeight: shellWeight,
                    nutWeight: nutWeight,
                    totalWeight: totalWeight,
                    firstNutReadingId: firstNutReadingId
                };
            })
        );

        return batchesWithReadings;
    }

    // Function to render activity log data
    async function renderActivityLog() {
        const activityLogData = await loadActivityLogFromSupabase();
        activityLogTableBody.innerHTML = ''; // Clear existing rows

        if (activityLogData.length === 0) {
            const row = activityLogTableBody.insertRow();
            row.innerHTML = `<td colspan="7" class="text-center py-4">No production activity yet.</td>`;
            return;
        }

        activityLogData.forEach((entry) => {
            const row = activityLogTableBody.insertRow();
            const date = new Date(entry.created_at);
            const formattedDate = date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            row.innerHTML = `
                <td>${entry.id}</td>
                <td>${formattedDate}</td>
                <td>${entry.shellWeight.toFixed(2)}</td>
                <td>${entry.nutWeight.toFixed(2)}</td>
                <td>${entry.totalWeight.toFixed(2)}</td>
                <td>${entry.note}</td>
                <td>
                    <img src="images/delete.png" alt="Delete" class="delete-icon" data-batch-id="${entry.id}" data-nut-reading-id="${entry.firstNutReadingId || ''}">
                </td>
            `;
        });
        addDeleteEventListeners(); // Add listeners to new delete buttons
    }

    // Add event listeners to dynamically created delete buttons
    function addDeleteEventListeners() {
        document.querySelectorAll('.delete-icon').forEach(icon => {
            icon.onclick = async function() {
                const batchId = this.dataset.batchId;
                const nutReadingId = this.dataset.nutReadingId;
                await deleteActivityLogEntry(batchId, nutReadingId);
            };
        });
    }

    // Function to delete a batch and all its readings
    async function deleteActivityLogEntry(batchId, nutReadingId) {
        if (!window.supabase) {
            console.error('Supabase client not initialized.');
            return;
        }

        if (!batchId) {
            alert('Invalid batch ID.');
            return;
        }

        // Delete all shell readings for this batch
        const { error: shellDelErr } = await window.supabase
            .from('shell_readings')
            .delete()
            .eq('batch_id', batchId);
        if (shellDelErr) {
            console.error('Error deleting shell readings:', shellDelErr);
        }

        // Delete all nut readings for this batch
        const { error: nutDelErr } = await window.supabase
            .from('nut_readings')
            .delete()
            .eq('batch_id', batchId);
        if (nutDelErr) {
            console.error('Error deleting nut readings:', nutDelErr);
            alert('Failed to delete readings. Please try again.');
            return;
        }

        // Delete the batch itself
        const { error: batchDelErr } = await window.supabase
            .from('batches')
            .delete()
            .eq('id', batchId);
        if (batchDelErr) {
            console.error('Error deleting batch:', batchDelErr);
            alert('Failed to delete batch. Please try again.');
            return;
        }

        console.log('Batch and all readings deleted successfully.');
        await renderActivityLog();
        if (typeof window.updateDashboardMetrics === 'function') {
            window.updateDashboardMetrics();
        }
    }

    // Function to add new activity log entry to Supabase
    async function addActivityLogEntry(weight, shellWeight, description) {
        if (!window.supabase) {
            console.error('Supabase client not initialized.');
            return false;
        }

        const today = new Date();
        // 1) Create batch
        const { data: batchData, error: batchErr } = await window.supabase
            .from('batches')
            .insert([
                {
                    device_id: 'web',
                    created_at: today.toISOString(),
                    status: 'completed',
                    note: description || null
                }
            ])
            .select('id')
            .single();
        if (batchErr || !batchData) {
            console.error('Error creating batch:', batchErr);
            alert('Failed to create batch.');
            return false;
        }
        const batchId = batchData.id;

        // 2) Insert nut reading
        const { error: nutErr } = await window.supabase
            .from('nut_readings')
            .insert([{ batch_id: batchId, timestamp: today.toISOString(), weight: parseFloat(weight), note: description || null }]);
        if (nutErr) {
            console.error('Error inserting nut reading:', nutErr);
            alert('Failed to add nut reading.');
            return false;
        }

        // 3) Optionally insert shell reading
        const sw = parseFloat(shellWeight);
        if (!isNaN(sw) && sw > 0) {
            const { error: shellErr } = await window.supabase
                .from('shell_readings')
                .insert([{ batch_id: batchId, timestamp: today.toISOString(), weight: sw, note: description || null }]);
            if (shellErr) {
                console.error('Error inserting shell reading:', shellErr);
                // continue without blocking
            }
        }

        console.log('Batch and readings added successfully');
        await renderActivityLog();
        if (typeof window.updateDashboardMetrics === 'function') {
            window.updateDashboardMetrics();
        }
        return true;
    }

    // --- Functionality for Input Fields and Buttons ---

    // Simulate auto-detection (e.g., after a few seconds)
    setTimeout(() => {
        if (weightToCrackInput.value === '0' || weightToCrackInput.value === '') {
            weightToCrackInput.value = '10'; // Simulate auto-detected weight if not already set
        }
    }, 2000);

    if (crackButton) {
        crackButton.addEventListener('click', async function() {
            const weight = weightToCrackInput.value;
            const shellWeight = shellWeightInput ? shellWeightInput.value : '';
            const description = descriptionInput.value;

            if (!weight || isNaN(weight) || parseFloat(weight) <= 0) {
                alert('Please enter a valid weight to crack (must be a positive number).');
                return;
            }

            const success = await addActivityLogEntry(weight, shellWeight, description);

            if (success) {
                // Show success modal
                crackSuccessMessage.textContent = `${weight}kg of pili processed.`;
                crackSuccessModal.classList.remove('hidden');

                // Clear inputs after cracking
                weightToCrackInput.value = '0'; // Reset auto-detected
                if (shellWeightInput) shellWeightInput.value = '';
                descriptionInput.value = '';

                // Automatically hide success modal after 2 seconds
                setTimeout(() => {
                    crackSuccessModal.classList.add('hidden');
                }, 2000);
            }
        });
    }

    if (cancelButton) {
        cancelButton.addEventListener('click', function() {
            weightToCrackInput.value = '0';
            if (shellWeightInput) shellWeightInput.value = '';
            descriptionInput.value = '';
        });
    }

    // Close button for Crack Success Modal
    if (closeCrackSuccessBtn) {
        closeCrackSuccessBtn.addEventListener('click', function() {
            crackSuccessModal.classList.add('hidden');
        });
    }

    // Initial render of the activity log when the page loads
    renderActivityLog();
});