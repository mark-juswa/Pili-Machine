document.addEventListener('DOMContentLoaded', function() {
    const reportsTableBody = document.getElementById('reportsTableBody');
    const filterTodayBtn = document.getElementById('filterToday');
    const filterThisWeekBtn = document.getElementById('filterThisWeek');
    const filterMonthlyBtn = document.getElementById('filterMonthly');
    const filterYearlyBtn = document.getElementById('filterYearly');
    const exportPdfBtn = document.getElementById('exportPdf');
    const exportExcelBtn = document.getElementById('exportExcel');

    let allActivityLogData = [];

    // Function to load data from Supabase for reports
    async function loadProductionDataFromSupabase() {
        if (!window.supabase) {
            console.error('Supabase client not initialized.');
            return [];
        }
        const { data, error } = await window.supabase
            .from('production_logs')
            .select('date, input_kg, price_per_kg_input, description') // Select relevant columns
            .order('date', { ascending: false }); // Order by date descending

        if (error) {
            console.error('Error fetching production logs for reports:', error);
            return [];
        }

        return data.map(entry => ({
            date: entry.date,
            inputKg: parseFloat(entry.input_kg),
            price: parseFloat(entry.price_per_kg_input), // This is the cost per kg input
            description: entry.description || '',
            costOfInput: parseFloat(entry.input_kg) * parseFloat(entry.price_per_kg_input)
        }));
    }

    // Main load and filter function (now async)
    async function initializeReportsData() {
        allActivityLogData = await loadProductionDataFromSupabase();
        filterReports('today'); // Show today's report by default
        setActiveFilterButton(filterTodayBtn); // Set Today button as active
    }


    // Function to render table based on filtered data
    function renderReportsTable(data) {
        reportsTableBody.innerHTML = ''; // Clear existing rows
        if (data.length === 0) {
            const row = reportsTableBody.insertRow();
            row.innerHTML = `<td colspan="4" class="text-center py-4">No data available for this period.</td>`;
            return;
        }

        data.forEach(entry => {
            const row = reportsTableBody.insertRow();
            row.innerHTML = `
                <td>${entry.date}</td>
                <td>${entry.inputKg}kg</td>
                <td>₱${entry.costOfInput.toLocaleString('en-PH')}</td>
                <td>${entry.description || 'N/A'}</td>
            `;
        });
    }

    // --- Filtering Logic ---
    function filterReports(period) {
        let filteredData = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of today

        allActivityLogData.forEach(entry => {
            const entryDate = new Date(entry.date);
            entryDate.setHours(0, 0, 0, 0); // Normalize entry date

            if (period === 'today') {
                if (entryDate.getTime() === today.getTime()) {
                    filteredData.push(entry);
                }
            } else if (period === 'thisWeek') {
                const startOfWeek = new Date(today);
                startOfWeek.setDate(today.getDate() - today.getDay());
                startOfWeek.setHours(0, 0, 0, 0);

                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 6);
                endOfWeek.setHours(23, 59, 59, 999);

                if (entryDate >= startOfWeek && entryDate <= endOfWeek) {
                    filteredData.push(entry);
                }
            } else if (period === 'thisMonth') {
                const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                startOfMonth.setHours(0, 0, 0, 0);

                const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                endOfMonth.setHours(23, 59, 59, 999);

                if (entryDate >= startOfMonth && entryDate <= endOfMonth) {
                    filteredData.push(entry);
                }
            } else if (period === 'yearly') {
                if (entryDate.getFullYear() === today.getFullYear()) {
                    filteredData.push(entry);
                }
            }
        });
        renderReportsTable(filteredData);
    }

    // --- Filter Button Event Listeners ---
    function setActiveFilterButton(activeButton) {
        document.querySelectorAll('.btn-filter').forEach(button => {
            button.classList.remove('active');
        });
        activeButton.classList.add('active');
    }

    if (filterTodayBtn) {
        filterTodayBtn.addEventListener('click', function() {
            setActiveFilterButton(this);
            filterReports('today');
        });
    }

    if (filterThisWeekBtn) {
        filterThisWeekBtn.addEventListener('click', function() {
            setActiveFilterButton(this);
            filterReports('thisWeek');
        });
    }

    if (filterMonthlyBtn) {
        filterMonthlyBtn.addEventListener('click', function() {
            setActiveFilterButton(this);
            filterReports('thisMonth');
        });
    }

    if (filterYearlyBtn) {
        filterYearlyBtn.addEventListener('click', function() {
            setActiveFilterButton(this);
            filterReports('yearly');
        });
    }

    // --- Export Functionality ---
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', function() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.setFontSize(16);
            doc.text("Pili Cracker Production Report", 14, 20);

            const table = document.getElementById('reportsTable');
            const headers = Array.from(table.tHead.rows[0].cells).map(th => th.textContent);

            const data = Array.from(table.tBodies[0].rows).map(row =>
                Array.from(row.cells).map(cell => cell.textContent)
            );

            if (data.length === 1 && data[0].length === 1 && data[0][0].includes('No data available')) {
                 doc.text("No data available for the selected period.", 14, 30);
            } else {
                doc.autoTable({
                    head: [headers],
                    body: data,
                    startY: 30,
                    styles: { fontSize: 10, cellPadding: 2 },
                    headStyles: { fillColor: [47, 107, 253], textColor: 255, fontStyle: 'bold' },
                    columnStyles: {
                        0: { cellWidth: 40 },
                        1: { cellWidth: 35 },
                        2: { cellWidth: 40 },
                        3: { cellWidth: 'auto' }
                    },
                    margin: { top: 10, left: 10, right: 10 }
                });
            }

            doc.save('pili_production_report.pdf');
        });
    }

    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', function() {
            const table = document.getElementById('reportsTable');
            const wb = XLSX.utils.table_to_book(table, { sheet: "Report" });

            const sheetName = "Report";
            if (wb.Sheets[sheetName] && wb.Sheets[sheetName]['A1'] && wb.Sheets[sheetName]['A1'].v.includes('No data available')) {
                wb.Sheets[sheetName] = {};
                XLSX.utils.sheet_add_aoa(wb.Sheets[sheetName], [["No data available for the selected period."]], { origin: "A1" });
            }

            XLSX.writeFile(wb, 'pili_production_report.xlsx');
        });
    }

    // Initial load and render
    // Use a small delay to ensure supabase client is initialized
    setTimeout(async () => {
        if (window.supabase) {
            await initializeReportsData();
        } else {
            console.warn('Supabase not yet available for reports. Retrying...');
            setTimeout(async () => {
                if (window.supabase) {
                    await initializeReportsData();
                } else {
                    console.error('Supabase still not available. Reports might not load data.');
                }
            }, 500);
        }
    }, 100);
});