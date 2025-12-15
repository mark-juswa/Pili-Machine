document.addEventListener('DOMContentLoaded', function() {
    const reportsTableBody = document.getElementById('reportsTableBody');
    const reportsTableHead = document.getElementById('reportsTableHead');
    const reportType = document.getElementById('reportType');
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    const generateReportBtn = document.getElementById('generateReportBtn');
    const exportPdfBtn = document.getElementById('exportPdf');
    const exportExcelBtn = document.getElementById('exportExcel');
    const dateRangeSummary = document.getElementById('dateRangeSummary');

    let filteredBatchesData = [];

    // Set default date range (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    if (startDate) {
        startDate.value = thirtyDaysAgo.toISOString().split('T')[0];
    }
    if (endDate) {
        endDate.value = today.toISOString().split('T')[0];
    }

    // Function to load batches with readings within date range
    async function loadBatchesInDateRange(start, end, reportTypeValue) {
        if (!window.supabase) {
            console.error('Supabase client not initialized.');
            return [];
        }

        // Adjust dates to include full day
        const startDateObj = new Date(start);
        startDateObj.setHours(0, 0, 0, 0);
        const endDateObj = new Date(end);
        endDateObj.setHours(23, 59, 59, 999);

        // Build query based on report type
        let query = window.supabase
            .from('batches')
            .select('id, created_at, status, note, finished_at');

        if (reportTypeValue === 'sales') {
            query = query.eq('status', 'sold');
            // Filter by finished_at (sale date) for sales
            query = query.gte('finished_at', startDateObj.toISOString())
                         .lte('finished_at', endDateObj.toISOString());
        } else {
            query = query.neq('status', 'sold');
            // Filter by created_at for batches
            query = query.gte('created_at', startDateObj.toISOString())
                         .lte('created_at', endDateObj.toISOString());
        }

        query = query.order('created_at', { ascending: false });

        const { data: batches, error: batchesError } = await query;

        if (batchesError) {
            console.error('Error fetching batches:', batchesError);
            return [];
        }

        // Get selling price
        const { data: priceData } = await window.supabase
            .from('app_settings')
            .select('setting_value')
            .eq('setting_name', 'pili_selling_price')
            .single();
        const sellingPrice = priceData ? parseFloat(priceData.setting_value) : 350;

        // For each batch, fetch shell and nut readings
        const batchesWithReadings = await Promise.all(
            batches.map(async (batch) => {
                const { data: shellReadings } = await window.supabase
                    .from('shell_readings')
                    .select('weight')
                    .eq('batch_id', batch.id);

                const { data: nutReadings } = await window.supabase
                    .from('nut_readings')
                    .select('weight')
                    .eq('batch_id', batch.id);

                const shellWeight = shellReadings
                    ? shellReadings.reduce((sum, reading) => sum + parseFloat(reading.weight || 0), 0)
                    : 0;
                const nutWeight = nutReadings
                    ? nutReadings.reduce((sum, reading) => sum + parseFloat(reading.weight || 0), 0)
                    : 0;
                const totalWeight = shellWeight + nutWeight;
                const inputWeight = nutWeight;
                const weightLost = inputWeight - shellWeight;
                const salesValue = nutWeight * sellingPrice;

                return {
                    id: batch.id,
                    date: reportTypeValue === 'sales' ? (batch.finished_at || batch.created_at) : batch.created_at,
                    created_at: batch.created_at,
                    finished_at: batch.finished_at,
                    status: batch.status,
                    note: batch.note || '',
                    inputWeight: inputWeight,
                    shellWeight: shellWeight,
                    nutWeight: nutWeight,
                    totalWeight: totalWeight,
                    weightLost: weightLost,
                    salesValue: salesValue
                };
            })
        );

        return batchesWithReadings;
    }

    // Function to render batches table
    function renderBatchesTable(batchesData) {
        if (!reportsTableBody) return;

        reportsTableBody.innerHTML = '';

        if (batchesData.length === 0) {
            const row = reportsTableBody.insertRow();
            row.innerHTML = `<td colspan="10" class="text-center py-4">No data found for the selected date range.</td>`;
            return;
        }

        batchesData.forEach(batch => {
            const row = reportsTableBody.insertRow();
            const date = new Date(batch.date);
            const formattedDate = date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const weightLostDisplay = batch.weightLost >= 0 
                ? batch.weightLost.toFixed(2) 
                : `<span style="color: #dc2626;">${batch.weightLost.toFixed(2)}</span>`;

            const statusDisplay = batch.status === 'sold' 
                ? `<span style="color: #dc2626; font-weight: 600;">Sold</span>` 
                : `<span style="color: #16a34a; font-weight: 600;">Active</span>`;

            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>${batch.id}</td>
                <td>${batch.inputWeight.toFixed(2)}</td>
                <td>${batch.shellWeight.toFixed(2)}</td>
                <td>${batch.nutWeight.toFixed(2)}</td>
                <td>${batch.totalWeight.toFixed(2)}</td>
                <td>${weightLostDisplay}</td>
                <td>₱${batch.salesValue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>${statusDisplay}</td>
                <td>${batch.note || 'N/A'}</td>
            `;
        });
    }

    // Function to update summary
    function updateSummary(batchesData) {
        if (!dateRangeSummary || batchesData.length === 0) {
            if (dateRangeSummary) dateRangeSummary.style.display = 'none';
            return;
        }

        const totals = batchesData.reduce((acc, batch) => {
            acc.totalBatches += 1;
            acc.totalShellWeight += batch.shellWeight;
            acc.totalNutWeight += batch.nutWeight;
            acc.totalWeight += batch.totalWeight;
            acc.totalWeightLost += batch.weightLost;
            acc.totalSalesValue += batch.salesValue;
            return acc;
        }, {
            totalBatches: 0,
            totalShellWeight: 0,
            totalNutWeight: 0,
            totalWeight: 0,
            totalWeightLost: 0,
            totalSalesValue: 0
        });

        document.getElementById('summaryTotalBatches').textContent = totals.totalBatches;
        document.getElementById('summaryTotalShellWeight').textContent = `${totals.totalShellWeight.toFixed(2)} kg`;
        document.getElementById('summaryTotalNutWeight').textContent = `${totals.totalNutWeight.toFixed(2)} kg`;
        document.getElementById('summaryTotalWeight').textContent = `${totals.totalWeight.toFixed(2)} kg`;
        
        const weightLostDisplay = totals.totalWeightLost >= 0 
            ? `${totals.totalWeightLost.toFixed(2)} kg` 
            : `<span style="color: #dc2626;">${totals.totalWeightLost.toFixed(2)} kg</span>`;
        document.getElementById('summaryTotalWeightLost').innerHTML = weightLostDisplay;

        document.getElementById('summaryTotalSalesValue').textContent = `₱${totals.totalSalesValue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        dateRangeSummary.style.display = 'block';
    }

    // Generate report function
    async function generateReport() {
        if (!startDate || !endDate || !reportType) {
            alert('Please fill in all fields.');
            return;
        }

        const start = startDate.value;
        const end = endDate.value;
        const reportTypeValue = reportType.value;

        if (!start || !end) {
            alert('Please select both start and end dates.');
            return;
        }

        if (new Date(start) > new Date(end)) {
            alert('Start date must be before or equal to end date.');
            return;
        }

        // Show loading
        reportsTableBody.innerHTML = '<tr><td colspan="10" class="text-center py-4">Loading data...</td></tr>';

        // Load data
        filteredBatchesData = await loadBatchesInDateRange(start, end, reportTypeValue);
        
        // Render table
        renderBatchesTable(filteredBatchesData);
        
        // Update summary
        updateSummary(filteredBatchesData);
    }

    // Event listeners
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', generateReport);
    }

    // Allow Enter key to generate report
    if (startDate) {
        startDate.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') generateReport();
        });
    }
    if (endDate) {
        endDate.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') generateReport();
        });
    }

    // --- Export Functionality ---
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', function() {
            if (filteredBatchesData.length === 0) {
                alert('Please generate a report first.');
                return;
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.setFontSize(16);
            const reportTitle = reportType.value === 'batches' 
                ? 'Pili Cracker Batch Report' 
                : 'Pili Cracker Sales Report';
            doc.text(reportTitle, 14, 20);

            // Add date range
            doc.setFontSize(10);
            doc.text(`Date Range: ${startDate.value} to ${endDate.value}`, 14, 30);

            const table = document.getElementById('reportsTable');
            const headers = Array.from(table.tHead.rows[0].cells).map(th => th.textContent);

            const data = Array.from(table.tBodies[0].rows).map(row =>
                Array.from(row.cells).map(cell => {
                    const text = cell.textContent.trim();
                    return text.replace(/₱/g, '').replace(/Active|Sold/g, '').trim();
                })
            );

            if (data.length > 0 && !data[0][0].includes('No data')) {
                doc.autoTable({
                    head: [headers],
                    body: data,
                    startY: 40,
                    styles: { fontSize: 8, cellPadding: 2 },
                    headStyles: { fillColor: [47, 107, 253], textColor: 255, fontStyle: 'bold' },
                    margin: { top: 10, left: 10, right: 10 }
                });
            }

            const fileName = `${reportType.value}_report_${startDate.value}_to_${endDate.value}.pdf`;
            doc.save(fileName);
        });
    }

    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', function() {
            if (filteredBatchesData.length === 0) {
                alert('Please generate a report first.');
                return;
            }

            const table = document.getElementById('reportsTable');
            const wb = XLSX.utils.table_to_book(table, { sheet: "Report" });

            // Add summary sheet
            const totals = filteredBatchesData.reduce((acc, batch) => {
                acc.totalBatches += 1;
                acc.totalShellWeight += batch.shellWeight;
                acc.totalNutWeight += batch.nutWeight;
                acc.totalWeight += batch.totalWeight;
                acc.totalWeightLost += batch.weightLost;
                acc.totalSalesValue += batch.salesValue;
                return acc;
            }, {
                totalBatches: 0,
                totalShellWeight: 0,
                totalNutWeight: 0,
                totalWeight: 0,
                totalWeightLost: 0,
                totalSalesValue: 0
            });

            const summaryData = [
                ['Report Summary'],
                [''],
                ['Report Type', reportType.value === 'batches' ? 'Batches' : 'Sales'],
                ['Date Range', `${startDate.value} to ${endDate.value}`],
                [''],
                ['Total Batches', totals.totalBatches],
                ['Total Shell Weight (kg)', totals.totalShellWeight.toFixed(2)],
                ['Total Nut Weight (kg)', totals.totalNutWeight.toFixed(2)],
                ['Total Weight (kg)', totals.totalWeight.toFixed(2)],
                ['Total Weight Lost (kg)', totals.totalWeightLost.toFixed(2)],
                ['Total Sales Value (₱)', totals.totalSalesValue.toFixed(2)]
            ];

            const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

            const fileName = `${reportType.value}_report_${startDate.value}_to_${endDate.value}.xlsx`;
            XLSX.writeFile(wb, fileName);
        });
    }

    // Auto-generate report on page load with default dates
    setTimeout(async () => {
        if (window.supabase && startDate && endDate) {
            await generateReport();
        }
    }, 100);
});
