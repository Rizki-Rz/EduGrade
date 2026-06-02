const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'edu-grade-f8krc7fmk-rizki-rzs-projects.vercel.app'; // Ganti dengan URL backend yang dideploy nanti
const API = `${API_BASE}/nilai`;
const API_SISWA = `${API_BASE}/siswa`;

// Global Variables
let allSiswa = [];
let allNilai = [];
let predikatDoughnutChart = null;
let fuzzyMembershipChart = null;

// Initialize Date
document.getElementById('live-date').innerText = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
});

// Switch Tab Menu
function switchTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-pane-custom').forEach(tab => {
        tab.classList.add('d-none');
    });

    // Remove active state from all menu links
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => {
        item.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(`tab-${tabId}`).classList.remove('d-none');

    // Add active state to selected menu link
    document.getElementById(`menu-${tabId}`).classList.add('active');

    // Update Topbar Title
    const titles = {
        'dashboard': 'Dashboard Analisis & Hasil Predikat Fuzzy',
        'input': 'Evaluasi Hasil Belajar & Kalkulasi Fuzzy',
        'siswa': 'Manajemen Data Akademik Siswa'
    };
    document.getElementById('page-title').innerText = titles[tabId] || 'EduGrade Fuzzy';

    // Refresh Data on Tab Switch
    if (tabId === 'dashboard') {
        tampilData();
        loadSiswa();
    } else if (tabId === 'input') {
        loadSiswa();
    } else if (tabId === 'siswa') {
        loadSiswa();
    }
}

// Toast Notifications
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const id = 'toast-' + Date.now();
    const bgClass = type === 'success' ? 'bg-success' : (type === 'danger' ? 'bg-danger' : 'bg-warning text-dark');
    const iconClass = type === 'success' ? 'bi-check-circle-fill' : (type === 'danger' ? 'bi-exclamation-triangle-fill' : 'bi-exclamation-circle-fill');

    const toastHTML = `
        <div id="${id}" class="toast align-items-center text-white ${bgClass} border-0 shadow-lg" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body d-flex align-items-center gap-2">
                    <i class="bi ${iconClass} fs-5"></i>
                    <div>${message}</div>
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', toastHTML);
    const toastElement = document.getElementById(id);
    const bsToast = new bootstrap.Toast(toastElement, { delay: 4000 });
    bsToast.show();

    // Remove from DOM after hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

// Load Students List
async function loadSiswa() {
    try {
        const responseSiswa = await fetch(API_SISWA);
        allSiswa = await responseSiswa.json();

        const responseNilai = await fetch(API);
        allNilai = await responseNilai.json();

        // Filter out students who already have grades
        const gradedSiswaIds = allNilai.map(n => n.siswa_id);
        const ungradedSiswa = allSiswa.filter(s => !gradedSiswaIds.includes(s.id));

        // Populate Select Dropdown in input form
        let selectHtml = '<option value="">-- Pilih Siswa --</option>';
        ungradedSiswa.forEach(siswa => {
            selectHtml += `<option value="${siswa.id}">${siswa.nama} - ${siswa.kelas} (NIS: ${siswa.nis})</option>`;
        });
        document.getElementById('siswa_id').innerHTML = selectHtml;

        // Populate Table in Kelola Siswa
        let tableHtml = '';
        if (allSiswa.length === 0) {
            tableHtml = '<tr><td colspan="4" class="text-center py-4 text-muted">Belum ada data siswa. Silakan tambahkan.</td></tr>';
        } else {
            allSiswa.forEach(siswa => {
                tableHtml += `
                    <tr>
                        <td class="fw-bold">${siswa.nis}</td>
                        <td>${siswa.nama}</td>
                        <td><span class="badge bg-light text-dark border">${siswa.kelas}</span></td>
                        <td class="text-end">
                            <button class="btn-action btn-action-delete" onclick="hapusSiswa(${siswa.id})" title="Hapus Siswa">
                                <i class="bi bi-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
        }
        document.getElementById('tbodySiswa').innerHTML = tableHtml;

        // Update Stats Dashboard
        document.getElementById('stat-total-siswa').innerText = allSiswa.length;
        document.getElementById('stat-siswa-dinilai').innerText = allNilai.length;

    } catch (error) {
        showToast('Gagal memuat data siswa: ' + error.message, 'danger');
    }
}

// Display Grades Table and Render Stats & Charts
async function tampilData() {
    try {
        const response = await fetch(API);
        allNilai = await response.json();

        let tableHtml = '';

        if (allNilai.length === 0) {
            tableHtml = '<tr><td colspan="5" class="text-center py-4 text-muted">Belum ada data nilai. Silakan tambahkan di menu "Input Nilai".</td></tr>';
            document.getElementById('tbodyNilai').innerHTML = tableHtml;
            document.getElementById('stat-rata-kelas').innerText = '0.0';
            document.getElementById('stat-predikat-dominan').innerText = '-';
            updateDoughnutChart({ 'Baik': 0, 'Cukup': 0, 'Kurang': 0 });
            return;
        }

        let totalAvg = 0;
        const counts = { 'Baik': 0, 'Cukup': 0, 'Kurang': 0 };

        allNilai.forEach(item => {
            const avg = parseFloat(item.rata_rata);
            totalAvg += avg;

            // Count for chart
            if (counts[item.predikat] !== undefined) {
                counts[item.predikat]++;
            }

            let badgeClass = 'badge-cukup';
            let iconClass = 'bi-exclamation-triangle';
            if (item.predikat === 'Baik') {
                badgeClass = 'badge-baik';
                iconClass = 'bi-patch-check';
            } else if (item.predikat === 'Kurang') {
                badgeClass = 'badge-kurang';
                iconClass = 'bi-exclamation-octagon';
            }

            tableHtml += `
                <tr>
                    <td>
                        <div class="fw-bold">${item.nama}</div>
                    </td>
                    <td><span class="badge bg-light text-dark border">${item.kelas}</span></td>
                    <td class="fw-bold text-primary">${avg.toFixed(2)}</td>
                    <td>
                        <span class="badge-predicate ${badgeClass}">
                            <i class="bi ${iconClass}"></i> ${item.predikat}
                        </span>
                    </td>
                    <td class="text-end">
                        <div class="d-flex justify-content-end gap-2">
                            <button class="btn-action btn-action-detail" onclick="bukaDetail(${item.id})" title="Lihat Detail Fuzzy">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="btn-action btn-action-delete" onclick="hapusNilai(${item.id})" title="Hapus Nilai">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        document.getElementById('tbodyNilai').innerHTML = tableHtml;

        // Update stats
        const classAvg = totalAvg / allNilai.length;
        document.getElementById('stat-rata-kelas').innerText = classAvg.toFixed(2);

        // Find dominant predicate
        let dominant = '-';
        let maxVal = -1;
        Object.keys(counts).forEach(key => {
            if (counts[key] > maxVal && counts[key] > 0) {
                maxVal = counts[key];
                dominant = key;
            }
        });
        document.getElementById('stat-predikat-dominan').innerText = dominant;

        // Render/Update Doughnut Chart
        updateDoughnutChart(counts);

    } catch (error) {
        showToast('Gagal memuat data nilai: ' + error.message, 'danger');
    }
}

// Update Doughnut Chart for Predicate Distribution
function updateDoughnutChart(counts) {
    const ctx = document.getElementById('predikatChart').getContext('2d');

    const data = {
        labels: ['Baik', 'Cukup', 'Kurang'],
        datasets: [{
            data: [counts['Baik'], counts['Cukup'], counts['Kurang']],
            backgroundColor: ['#10b981', '#f59e0b', '#f43f5e'],
            borderWidth: 2,
            borderColor: '#ffffff',
            hoverOffset: 4
        }]
    };

    if (predikatDoughnutChart) {
        predikatDoughnutChart.data = data;
        predikatDoughnutChart.update();
    } else {
        predikatDoughnutChart = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: {
                                family: "'Plus Jakarta Sans', sans-serif",
                                size: 12
                            },
                            usePointStyle: true,
                            padding: 15
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }
}

// Fuzzy logic helper formulas in client-side for real-time preview
function clientFuzzyRendah(x) {
    if (x <= 60) return 1;
    if (x >= 70) return 0;
    return (70 - x) / 10;
}

function clientFuzzySedang(x) {
    if (x <= 60 || x >= 85) return 0;
    if (x === 75) return 1;
    if (x > 60 && x < 75) return (x - 60) / 15;
    return (85 - x) / 10;
}

function clientFuzzyTinggi(x) {
    if (x <= 75) return 0;
    if (x >= 90) return 1;
    return (x - 75) / 15;
}

function clientHitungPredikat(rataRata) {
    const rendah = clientFuzzyRendah(rataRata);
    const sedang = clientFuzzySedang(rataRata);
    const tinggi = clientFuzzyTinggi(rataRata);

    const max = Math.max(rendah, sedang, tinggi);
    let predikat = '';

    if (max === rendah) {
        predikat = 'Kurang';
    } else if (max === sedang) {
        predikat = 'Cukup';
    } else {
        predikat = 'Baik';
    }

    return { rendah, sedang, tinggi, predikat };
}

// Update Live Preview during inputs
function updateLivePreview() {
    const mtk = parseInt(document.getElementById('matematika').value) || 0;
    const ind = parseInt(document.getElementById('bahasa_indonesia').value) || 0;
    const ing = parseInt(document.getElementById('bahasa_inggris').value) || 0;
    const ipa = parseInt(document.getElementById('ipa').value) || 0;

    const hasInput = document.getElementById('matematika').value !== '' ||
        document.getElementById('bahasa_indonesia').value !== '' ||
        document.getElementById('bahasa_inggris').value !== '' ||
        document.getElementById('ipa').value !== '';

    if (!hasInput) {
        resetLivePreview();
        return;
    }

    const count = [
        document.getElementById('matematika').value,
        document.getElementById('bahasa_indonesia').value,
        document.getElementById('bahasa_inggris').value,
        document.getElementById('ipa').value
    ].filter(v => v !== '').length;

    const avg = (mtk + ind + ing + ipa) / (count || 1);
    document.getElementById('preview-avg').innerText = avg.toFixed(2);

    const fuzzy = clientHitungPredikat(avg);

    // Update membership values UI
    document.getElementById('preview-mu-rendah').innerText = fuzzy.rendah.toFixed(2);
    document.getElementById('preview-bar-rendah').style.width = (fuzzy.rendah * 100) + '%';

    document.getElementById('preview-mu-sedang').innerText = fuzzy.sedang.toFixed(2);
    document.getElementById('preview-bar-sedang').style.width = (fuzzy.sedang * 100) + '%';

    document.getElementById('preview-mu-tinggi').innerText = fuzzy.tinggi.toFixed(2);
    document.getElementById('preview-bar-tinggi').style.width = (fuzzy.tinggi * 100) + '%';

    // Update Predicate Badge
    const badge = document.getElementById('preview-badge');
    badge.className = 'badge-predicate py-2 px-3 fs-6 border-0 text-white';

    if (fuzzy.predikat === 'Baik') {
        badge.classList.add('bg-success');
        badge.innerHTML = '<i class="bi bi-patch-check-fill me-1"></i> Estimasi Baik';
    } else if (fuzzy.predikat === 'Cukup') {
        badge.classList.add('bg-warning');
        badge.classList.add('text-dark');
        badge.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-1"></i> Estimasi Cukup';
    } else {
        badge.classList.add('bg-danger');
        badge.innerHTML = '<i class="bi bi-exclamation-octagon-fill me-1"></i> Estimasi Kurang';
    }
}

function resetLivePreview() {
    document.getElementById('preview-avg').innerText = '0.00';
    document.getElementById('preview-mu-rendah').innerText = '0.00';
    document.getElementById('preview-bar-rendah').style.width = '0%';
    document.getElementById('preview-mu-sedang').innerText = '0.00';
    document.getElementById('preview-bar-sedang').style.width = '0%';
    document.getElementById('preview-mu-tinggi').innerText = '0.00';
    document.getElementById('preview-bar-tinggi').style.width = '0%';

    const badge = document.getElementById('preview-badge');
    badge.className = 'badge-predicate bg-secondary text-white border-0 py-2 px-3 fs-6';
    badge.innerHTML = '<i class="bi bi-question-circle"></i> Menunggu Input';
}

// Form Grades Submission
document.getElementById('formNilai').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
        siswa_id: parseInt(document.getElementById('siswa_id').value),
        matematika: parseInt(document.getElementById('matematika').value),
        bahasa_indonesia: parseInt(document.getElementById('bahasa_indonesia').value),
        bahasa_inggris: parseInt(document.getElementById('bahasa_inggris').value),
        ipa: parseInt(document.getElementById('ipa').value)
    };

    try {
        const response = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            showToast(result.message, 'success');
            document.getElementById('formNilai').reset();
            resetLivePreview();
            switchTab('dashboard');
        } else {
            showToast(result.message || 'Gagal menyimpan nilai', 'danger');
        }
    } catch (error) {
        showToast('Koneksi server gagal: ' + error.message, 'danger');
    }
});

// Form Student Submission
document.getElementById('formSiswa').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
        nis: document.getElementById('siswa_nis').value,
        nama: document.getElementById('siswa_nama').value,
        kelas: document.getElementById('siswa_kelas').value
    };

    try {
        const response = await fetch(API_SISWA, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            showToast(result.message, 'success');
            document.getElementById('formSiswa').reset();
            loadSiswa();
        } else {
            showToast(result.message || 'Gagal menambahkan siswa', 'danger');
        }
    } catch (error) {
        showToast('Koneksi server gagal: ' + error.message, 'danger');
    }
});

// Delete Grade
async function hapusNilai(id) {
    if (confirm('Apakah Anda yakin ingin menghapus data nilai siswa ini?')) {
        try {
            const response = await fetch(`${API}/${id}`, {
                method: 'DELETE'
            });
            const result = await response.json();

            if (response.ok) {
                showToast(result.message, 'success');
                tampilData();
                loadSiswa();
            } else {
                showToast(result.message || 'Gagal menghapus data', 'danger');
            }
        } catch (error) {
            showToast('Koneksi server gagal: ' + error.message, 'danger');
        }
    }
}

// Delete Student
async function hapusSiswa(id) {
    if (confirm('Menghapus siswa juga akan menghapus seluruh data nilai terkait. Apakah Anda yakin?')) {
        try {
            const response = await fetch(`${API_SISWA}/${id}`, {
                method: 'DELETE'
            });
            const result = await response.json();

            if (response.ok) {
                showToast(result.message, 'success');
                loadSiswa();
                tampilData();
            } else {
                showToast(result.message || 'Gagal menghapus siswa', 'danger');
            }
        } catch (error) {
            showToast('Koneksi server gagal: ' + error.message, 'danger');
        }
    }
}

// Filter tables dynamically
function filterNilaiTable() {
    const query = document.getElementById('search-nilai').value.toLowerCase();
    const rows = document.querySelectorAll('#tbodyNilai tr');

    rows.forEach(row => {
        if (row.cells.length < 2) return; // Skip empty row
        const nama = row.cells[0].textContent.toLowerCase();
        const kelas = row.cells[1].textContent.toLowerCase();
        if (nama.includes(query) || kelas.includes(query)) {
            row.classList.remove('d-none');
        } else {
            row.classList.add('d-none');
        }
    });
}

function filterSiswaTable() {
    const query = document.getElementById('search-siswa').value.toLowerCase();
    const rows = document.querySelectorAll('#tbodySiswa tr');

    rows.forEach(row => {
        if (row.cells.length < 3) return; // Skip empty row
        const nis = row.cells[0].textContent.toLowerCase();
        const nama = row.cells[1].textContent.toLowerCase();
        const kelas = row.cells[2].textContent.toLowerCase();
        if (nis.includes(query) || nama.includes(query) || kelas.includes(query)) {
            row.classList.remove('d-none');
        } else {
            row.classList.add('d-none');
        }
    });
}

// Open Details Modal and Plot Fuzzy Graph
function bukaDetail(id) {
    const item = allNilai.find(n => n.id === id);
    if (!item) return;

    // Set textual details
    document.getElementById('detail-nama').innerText = item.nama;
    document.getElementById('detail-kelas').innerText = item.kelas;
    document.getElementById('detail-matematika').innerText = item.matematika;
    document.getElementById('detail-bahasa').innerText = item.bahasa_indonesia;
    document.getElementById('detail-inggris').innerText = item.bahasa_inggris;
    document.getElementById('detail-ipa').innerText = item.ipa;

    const avg = parseFloat(item.rata_rata);
    document.getElementById('detail-rata-rata').innerText = avg.toFixed(2);

    // Set Predicate badge color in modal
    const predikatBadge = document.getElementById('detail-predikat');
    predikatBadge.innerText = item.predikat;
    predikatBadge.className = 'badge-predicate py-1 px-3 fs-6';
    if (item.predikat === 'Baik') {
        predikatBadge.classList.add('badge-baik');
    } else if (item.predikat === 'Cukup') {
        predikatBadge.classList.add('badge-cukup');
    } else {
        predikatBadge.classList.add('badge-kurang');
    }

    // Set Mu values
    const rendah = item.fuzzy?.rendah ?? clientFuzzyRendah(avg);
    const sedang = item.fuzzy?.sedang ?? clientFuzzySedang(avg);
    const tinggi = item.fuzzy?.tinggi ?? clientFuzzyTinggi(avg);

    document.getElementById('detail-mu-rendah').innerText = rendah.toFixed(2);
    document.getElementById('detail-mu-sedang').innerText = sedang.toFixed(2);
    document.getElementById('detail-mu-tinggi').innerText = tinggi.toFixed(2);

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('detailModal'));
    modal.show();

    // Build/Rebuild Chart.js membership curves
    setTimeout(() => {
        renderFuzzyGraph(avg, rendah, sedang, tinggi);
    }, 300);
}

// Draw Fuzzy Logic Graph using Chart.js
function renderFuzzyGraph(avg, r_val, s_val, t_val) {
    const ctx = document.getElementById('fuzzyGraph').getContext('2d');

    // Destroy previous instance
    if (fuzzyMembershipChart) {
        fuzzyMembershipChart.destroy();
    }

    // Curves definitions
    // Rendah: 1 at 0 to 60, declines to 0 at 70
    const rendahData = [
        { x: 0, y: 1 },
        { x: 60, y: 1 },
        { x: 70, y: 0 },
        { x: 100, y: 0 }
    ];

    // Sedang: 0 at 60, peaks at 75 (1), declines to 0 at 85
    const sedangData = [
        { x: 0, y: 0 },
        { x: 60, y: 0 },
        { x: 75, y: 1 },
        { x: 85, y: 0 },
        { x: 100, y: 0 }
    ];

    // Tinggi: 0 at 75, climbs to 1 at 90
    const tinggiData = [
        { x: 0, y: 0 },
        { x: 75, y: 0 },
        { x: 90, y: 1 },
        { x: 100, y: 1 }
    ];

    // Student line
    const studentLineData = [
        { x: avg, y: 0 },
        { x: avg, y: 1 }
    ];

    // Intersection points to highlight
    const intersections = [];
    if (r_val > 0) intersections.push({ x: avg, y: r_val, label: `Rendah: ${r_val.toFixed(2)}` });
    if (s_val > 0) intersections.push({ x: avg, y: s_val, label: `Sedang: ${s_val.toFixed(2)}` });
    if (t_val > 0) intersections.push({ x: avg, y: t_val, label: `Tinggi: ${t_val.toFixed(2)}` });

    fuzzyMembershipChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Rendah',
                    data: rendahData,
                    borderColor: '#f43f5e',
                    borderWidth: 3,
                    showLine: true,
                    fill: false,
                    tension: 0,
                    pointRadius: 0
                },
                {
                    label: 'Sedang',
                    data: sedangData,
                    borderColor: '#f59e0b',
                    borderWidth: 3,
                    showLine: true,
                    fill: false,
                    tension: 0,
                    pointRadius: 0
                },
                {
                    label: 'Tinggi',
                    data: tinggiData,
                    borderColor: '#10b981',
                    borderWidth: 3,
                    showLine: true,
                    fill: false,
                    tension: 0,
                    pointRadius: 0
                },
                {
                    label: `Rata-rata (${avg.toFixed(1)})`,
                    data: studentLineData,
                    borderColor: '#3b82f6',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    showLine: true,
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: 'Titik Posisi',
                    data: intersections,
                    backgroundColor: '#1e293b',
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    min: 40,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Nilai Rata-rata (x)',
                        font: { family: "'Plus Jakarta Sans', sans-serif", weight: 'bold' }
                    },
                    grid: { color: '#f1f5f9' }
                },
                y: {
                    min: 0,
                    max: 1.1,
                    ticks: {
                        stepSize: 0.2
                    },
                    title: {
                        display: true,
                        text: 'Derajat Keanggotaan (\u03BC)',
                        font: { family: "'Plus Jakarta Sans', sans-serif", weight: 'bold' }
                    },
                    grid: { color: '#f1f5f9' }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: { family: "'Plus Jakarta Sans', sans-serif', size: 10" },
                        usePointStyle: true,
                        padding: 8
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            if (context.dataset.label === 'Titik Posisi') {
                                return context.raw.label;
                            }
                            return `${context.dataset.label}: (${context.raw.x}, ${context.raw.y.toFixed(2)})`;
                        }
                    }
                }
            }
        }
    });
}

let excelParsedData = [];

// Download Excel Template for grading
function downloadTemplate() {
    try {
        const wb = XLSX.utils.book_new();
        const wsData = [
            ["nis", "nama", "kelas", "matematika", "bahasa_indonesia", "bahasa_inggris", "ipa"],
            ["1001", "Budi Santoso", "XII RPL 1", 80, 85, 78, 90],
            ["1002", "Siti Aminah", "XII RPL 1", 95, 90, 92, 88],
            ["1003", "Clara Olivia", "XII RPL 2", 70, 75, 72, 68]
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Auto-fit column widths
        ws['!cols'] = [
            { wch: 12 }, // nis
            { wch: 22 }, // nama
            { wch: 15 }, // kelas
            { wch: 12 }, // matematika
            { wch: 18 }, // bahasa_indonesia
            { wch: 16 }, // bahasa_inggris
            { wch: 10 }  // ipa
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Template Import");
        XLSX.writeFile(wb, "template_import_nilai.xlsx");
        showToast("Template Excel berhasil diunduh", "success");
    } catch (error) {
        showToast("Gagal mengunduh template: " + error.message, "danger");
    }
}

// Handle selected file parse
function handleExcelFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const filenameDisplay = document.getElementById('excel-filename-display');
    if (filenameDisplay) {
        filenameDisplay.innerText = `Berkas Terpilih: ${file.name}`;
        filenameDisplay.classList.remove('d-none');
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = e.target.result;
            const workbook = XLSX.read(data, { type: 'binary' });

            // Get first sheet
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // Convert to JSON array
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

            if (jsonData.length === 0) {
                showToast("File Excel kosong atau tidak valid", "danger");
                cancelExcelImport();
                return;
            }

            // Standardize columns
            excelParsedData = jsonData.map(row => {
                const normalizedRow = {};
                for (const key in row) {
                    const normKey = key.toLowerCase().trim().replace(/[\s\-]/g, '_');
                    normalizedRow[normKey] = row[key];
                }
                return {
                    nis: normalizedRow.nis || normalizedRow.nomor_induk || '',
                    nama: normalizedRow.nama || normalizedRow.nama_lengkap || normalizedRow.nama_siswa || '',
                    kelas: normalizedRow.kelas || '',
                    matematika: normalizedRow.matematika || normalizedRow.mtk || 0,
                    bahasa_indonesia: normalizedRow.bahasa_indonesia || normalizedRow.b_indo || normalizedRow.bahasa || 0,
                    bahasa_inggris: normalizedRow.bahasa_inggris || normalizedRow.b_ing || 0,
                    ipa: normalizedRow.ipa || normalizedRow.sains || 0
                };
            });

            renderExcelPreview();

        } catch (error) {
            showToast("Gagal membaca file Excel: " + error.message, "danger");
            cancelExcelImport();
        }
    };

    reader.onerror = function () {
        showToast("Error saat membaca file", "danger");
        cancelExcelImport();
    };

    reader.readAsBinaryString(file);
}

// Render dynamic preview of Excel contents
function renderExcelPreview() {
    const tbody = document.getElementById('tbodyExcelPreview');
    tbody.innerHTML = '';

    let validCount = 0;
    const totalCount = excelParsedData.length;

    excelParsedData.forEach((row) => {
        const mtk = parseInt(row.matematika);
        const ind = parseInt(row.bahasa_indonesia);
        const ing = parseInt(row.bahasa_inggris);
        const ipa = parseInt(row.ipa);

        // Validasi
        const hasNis = row.nis !== '';
        const isValidMtk = !isNaN(mtk) && mtk >= 0 && mtk <= 100;
        const isValidInd = !isNaN(ind) && ind >= 0 && ind <= 100;
        const isValidIng = !isNaN(ing) && ing >= 0 && ing <= 100;
        const isValidIpa = !isNaN(ipa) && ipa >= 0 && ipa <= 100;

        const isRowValid = hasNis && isValidMtk && isValidInd && isValidIng && isValidIpa;

        let statusBadge = '';
        if (isRowValid) {
            statusBadge = '<span class="badge bg-success-subtle text-success border border-success border-opacity-25 rounded-pill px-2">Valid</span>';
            validCount++;
        } else {
            let reasons = [];
            if (!hasNis) reasons.push("NIS kosong");
            if (!isValidMtk) reasons.push("Matematika tidak valid");
            if (!isValidInd) reasons.push("Bahasa Indonesia tidak valid");
            if (!isValidIng) reasons.push("Bahasa Inggris tidak valid");
            if (!isValidIpa) reasons.push("IPA tidak valid");
            statusBadge = `<span class="badge bg-danger-subtle text-danger border border-danger border-opacity-25 rounded-pill px-2" title="${reasons.join(', ')}">Error</span>`;
        }

        const tr = document.createElement('tr');
        if (!isRowValid) {
            tr.className = 'table-danger';
        }

        tr.innerHTML = `
            <td class="fw-bold">${row.nis || '<span class="text-danger">KOSONG</span>'}</td>
            <td>${row.nama || '<span class="text-muted">-</span>'}</td>
            <td><span class="badge bg-light text-dark border">${row.kelas || '-'}</span></td>
            <td>${row.matematika}</td>
            <td>${row.bahasa_indonesia}</td>
            <td>${row.bahasa_inggris}</td>
            <td>${row.ipa}</td>
            <td class="text-center">${statusBadge}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('excel-row-count').innerText = totalCount;
    document.getElementById('excel-valid-summary').innerText = `${validCount} Valid / ${totalCount} Baris`;

    // Enable/disable submit button
    const btnImport = document.getElementById('btnImportExcel');
    if (validCount === 0) {
        btnImport.disabled = true;
        btnImport.classList.add('opacity-50');
    } else {
        btnImport.disabled = false;
        btnImport.classList.remove('opacity-50');
    }

    document.getElementById('excel-preview-container').classList.remove('d-none');
}

// Upload JSON representation to API endpoint
async function uploadExcelData() {
    const overwrite = document.getElementById('overwriteExcel').checked;

    const validData = excelParsedData.filter(row => {
        const mtk = parseInt(row.matematika);
        const ind = parseInt(row.bahasa_indonesia);
        const ing = parseInt(row.bahasa_inggris);
        const ipa = parseInt(row.ipa);

        const hasNis = row.nis !== '';
        const isValidMtk = !isNaN(mtk) && mtk >= 0 && mtk <= 100;
        const isValidInd = !isNaN(ind) && ind >= 0 && ind <= 100;
        const isValidIng = !isNaN(ing) && ing >= 0 && ing <= 100;
        const isValidIpa = !isNaN(ipa) && ipa >= 0 && ipa <= 100;

        return hasNis && isValidMtk && isValidInd && isValidIng && isValidIpa;
    });

    if (validData.length === 0) {
        showToast("Tidak ada data valid untuk di-import", "warning");
        return;
    }

    const btnImport = document.getElementById('btnImportExcel');
    btnImport.disabled = true;
    btnImport.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Memproses...';

    try {
        const response = await fetch('http://localhost:3000/nilai/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: validData, overwrite })
        });

        const result = await response.json();

        if (response.ok) {
            const s = result.summary;
            let detailMsg = `Import Selesai! Sukses: ${s.success}, Edit: ${s.updated}`;
            if (s.skipped > 0) detailMsg += `, Lewat: ${s.skipped}`;
            if (s.failed > 0) detailMsg += `, Gagal: ${s.failed}`;

            showToast(detailMsg, s.failed > 0 ? 'warning' : 'success');

            cancelExcelImport();

            await loadSiswa();
            await tampilData();
            switchTab('dashboard');
        } else {
            showToast(result.message || "Gagal mengimport data", "danger");
            btnImport.disabled = false;
            btnImport.innerHTML = '<i class="bi bi-upload me-2"></i>Import Sekarang';
        }
    } catch (error) {
        showToast("Koneksi server gagal: " + error.message, "danger");
        btnImport.disabled = false;
        btnImport.innerHTML = '<i class="bi bi-upload me-2"></i>Import Sekarang';
    }
}

// Cancel import, reset fields
function cancelExcelImport() {
    document.getElementById('excelFile').value = '';
    excelParsedData = [];
    document.getElementById('excel-preview-container').classList.add('d-none');
    document.getElementById('tbodyExcelPreview').innerHTML = '';

    const filenameDisplay = document.getElementById('excel-filename-display');
    if (filenameDisplay) {
        filenameDisplay.innerText = '';
        filenameDisplay.classList.add('d-none');
    }
}

// Setup Drag and Drop events for Excel Upload Zone
function setupExcelDragAndDrop() {
    const zone = document.getElementById('excelUploadZone');
    if (!zone) return;

    ['dragenter', 'dragover'].forEach(eventName => {
        zone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.add('excel-upload-zone-active');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        zone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.remove('excel-upload-zone-active');
        }, false);
    });

    zone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            const input = document.getElementById('excelFile');
            input.files = files;
            const event = { target: { files: files } };
            handleExcelFileSelect(event);
        }
    }, false);
}

// Initial Load
switchTab('dashboard');
loadSiswa();
tampilData();
setupExcelDragAndDrop();