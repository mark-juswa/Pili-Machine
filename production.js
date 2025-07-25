document.addEventListener('DOMContentLoaded', function() {
    const activityLogTableBody = document.getElementById('activityLogTableBody');
    const crackButton = document.getElementById('crackPiliBtn');
    const cancelButton = document.getElementById('cancelProductionBtn');
    const weightToCrackInput = document.getElementById('weightToCrack');
    const priceInput = document.getElementById('price'); // This is price_per_kg_input
    const descriptionInput = document.getElementById('description');

    // Elements for the Crack Success Modal
    const crackSuccessModal = document.getElementById('crackSuccessModal');
    const crackSuccessMessage = document.getElementById('crackSuccessMessage');
    const closeCrackSuccessBtn = document.getElementById('closeCrackSuccessBtn');

    // Function to load activity log data from Supabase
    async function loadActivityLogFromSupabase() {
        if (!window.supabase) {
            console.error('Supabase client not initialized.');
            return [];
        }
        const { data, error } = await window.supabase
            .from('production_logs')
            .select('*')
            .order('date', { ascending: false }); // Order by date descending

        if (error) {
            console.error('Error fetching production logs:', error);
            return [];
        }
        return data.map(entry => ({
            date: entry.date,
            inputKg: parseFloat(entry.input_kg),
            price: parseFloat(entry.price_per_kg_input), // Renamed for consistency with old code
            description: entry.description || '',
            id: entry.id // Store Supabase ID for deletion
        }));
    }

    // Function to render activity log data
    async function renderActivityLog() {
        const activityLogData = await loadActivityLogFromSupabase();
        activityLogTableBody.innerHTML = ''; // Clear existing rows

        if (activityLogData.length === 0) {
            const row = activityLogTableBody.insertRow();
            row.innerHTML = `<td colspan="5" class="text-center py-4">No production activity yet.</td>`;
            return;
        }

        activityLogData.forEach((entry) => {
            const row = activityLogTableBody.insertRow();
            row.innerHTML = `
                <td>${entry.date}</td>
                <td>${entry.inputKg}</td>
                <td>₱${entry.price.toLocaleString('en-PH')}</td>
                <td>${entry.description}</td>
                <td>
                    <img src="images/delete.png" alt="Delete" class="delete-icon" data-id="${entry.id}">
                </td>
            `;
        });
        addDeleteEventListeners(); // Add listeners to new delete buttons
    }

    // Add event listeners to dynamically created delete buttons
    function addDeleteEventListeners() {
        document.querySelectorAll('.delete-icon').forEach(icon => {
            icon.onclick = async function() {
                const id = this.dataset.id;
                await deleteActivityLogEntry(id);
            };
        });
    }

    // Function to delete activity log entry from Supabase
    async function deleteActivityLogEntry(id) {
        if (!window.supabase) {
            console.error('Supabase client not initialized.');
            return;
        }
        const { error } = await window.supabase
            .from('production_logs')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting production log:', error);
            alert('Failed to delete entry. Please try again.');
        } else {
            console.log('Production log deleted successfully.');
            await renderActivityLog(); // Re-render the table
            if (typeof window.updateDashboardMetrics === 'function') {
                window.updateDashboardMetrics(); // Refresh dashboard metrics
            }
        }
    }

    // Function to add new activity log entry to Supabase
    async function addActivityLogEntry(weight, price, description) {
        if (!window.supabase) {
            console.error('Supabase client not initialized.');
            return false;
        }

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const formattedDate = `${yyyy}-${mm}-${dd}`;

        const { data, error } = await window.supabase
            .from('production_logs')
            .insert([
                {
                    date: formattedDate,
                    input_kg: parseFloat(weight),
                    price_per_kg_input: parseFloat(price),
                    description: description || ''
                    // You might add cracked_output_kg and expected_sales_value here if you capture them
                }
            ]);

        if (error) {
            console.error('Error adding production log:', error);
            alert('Failed to add entry. Please check console for details.');
            return false;
        } else {
            console.log('Production log added successfully:', data);
            await renderActivityLog(); // Re-render the table
            if (typeof window.updateDashboardMetrics === 'function') {
                window.updateDashboardMetrics(); // Refresh dashboard metrics
            }
            return true;
        }
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
            const price = priceInput.value;
            const description = descriptionInput.value;

            if (!weight || isNaN(weight) || parseFloat(weight) <= 0) {
                alert('Please enter a valid weight to crack (must be a positive number).');
                return;
            }
            if (!price || isNaN(price) || parseFloat(price) <= 0) {
                alert('Please enter a valid price (cost per kg of input, must be a positive number).');
                return;
            }

            const success = await addActivityLogEntry(weight, price, description);

            if (success) {
                // Show success modal
                crackSuccessMessage.textContent = `${weight}kg of pili processed.`;
                crackSuccessModal.classList.remove('hidden');

                // Clear inputs after cracking
                weightToCrackInput.value = '0'; // Reset auto-detected
                priceInput.value = '';
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
            priceInput.value = '';
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