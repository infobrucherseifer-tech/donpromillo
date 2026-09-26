// Statusverwaltung im laufenden Betrieb
let transactions = [];

// DOM Elemente abgreifen
const transactionForm = document.getElementById('transaction-form');
const transactionList = document.getElementById('transaction-list');
const emptyState = document.getElementById('empty-state');

const totalIncomeEl = document.getElementById('total-income');
const totalExpenseEl = document.getElementById('total-expense');
const netBalanceEl = document.getElementById('net-balance');

const btnExport = document.getElementById('btn-export');
const btnImport = document.getElementById('btn-import');
const btnPrint = document.getElementById('btn-print');
const btnClear = document.getElementById('btn-clear');

// Initialisierung bei App-Start
function init() {
    updateUI();
    document.getElementById('date').valueAsDate = new Date();
}

// Berechnet Kontostand und rendert das Dashboard neu
function updateUI() {
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    transactionList.innerHTML = '';

    if (transactions.length === 0) {
        emptyState.style.display = 'block';
        totalIncomeEl.textContent = '0,00 €';
        totalExpenseEl.textContent = '0,00 €';
        netBalanceEl.textContent = '0,00 €';
        netBalanceEl.className = 'amount';
        return;
    }

    emptyState.style.display = 'none';

    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach(t => {
        const amount = parseFloat(t.amount);
        if (t.type === 'income') {
            totalIncome += amount;
        } else {
            totalExpense += amount;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(t.date)}</td>
            <td>${escapeHtml(t.description)}</td>
            <td class="${t.type === 'income' ? 'income' : 'expense'}">
                ${t.type === 'income' ? 'Einnahme' : 'Ausgabe'}
            </td>
            <td class="text-right ${t.type === 'income' ? 'income' : 'expense'}">
                ${t.type === 'income' ? '+' : '-'}&nbsp;${formatCurrency(amount)}
            </td>
            <td class="no-print">
                <button class="btn-delete" onclick="deleteTransaction('${t.id}')">Löschen</button>
            </td>
        `;
        transactionList.appendChild(row);
    });

    const netBalance = totalIncome - totalExpense;

    totalIncomeEl.textContent = formatCurrency(totalIncome);
    totalExpenseEl.textContent = formatCurrency(totalExpense);
    netBalanceEl.textContent = formatCurrency(netBalance);

    if (netBalance > 0) {
        netBalanceEl.className = 'amount income';
    } else if (netBalance < 0) {
        netBalanceEl.className = 'amount expense';
    } else {
        netBalanceEl.className = 'amount';
    }
}

// Neue Buchung hinzufügen
transactionForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const newTransaction = {
        id: '_' + Math.random().toString(36).substr(2, 9),
        date: document.getElementById('date').value,
        description: document.getElementById('description').value.trim(),
        type: document.getElementById('type').value,
        amount: parseFloat(document.getElementById('amount').value)
    };

    transactions.push(newTransaction);
    updateUI();

    document.getElementById('description').value = '';
    document.getElementById('amount').value = '';
});

// Einzelne Buchung löschen
window.deleteTransaction = function(id) {
    transactions = transactions.filter(t => t.id !== id);
    updateUI();
};

// MODIFIZIERT: Datei-Export mit echtem Datei-Auswahldialog (File System Access API)
btnExport.addEventListener('click', async () => {
    if (transactions.length === 0) {
        alert('Es gibt keine Daten zum Exportieren!');
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    const defaultName = `don_promillo_kassenbuch_${today}.json`;

    // Prüfen, ob der Browser die moderne Speicher-API unterstützt
    if ('showSaveFilePicker' in window) {
        try {
            const options = {
                suggestedName: defaultName,
                types: [{
                    description: 'JSON-Kassenbuch',
                    accept: { 'application/json': ['.json'] }
                }]
            };
            
            // Öffnet den System-Dialog, in dem du deinen Ordner "Kassenbuch/data" wählen kannst
            const handle = await window.showSaveFilePicker(options);
            const writable = await handle.createWritable();
            
            await writable.write(JSON.stringify(transactions, null, 2));
            await writable.close();
            
            alert('Datei erfolgreich im gewählten Ordner gespeichert!');
        } catch (err) {
            // Abbrechen fangen, ohne einen Fehler zu werfen
            if (err.name !== 'AbortError') {
                alert('Fehler beim Speichern der Datei: ' + err.message);
            }
        }
    } else {
        // Fallback für ältere Browser (Standard-Download-Ordner)
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(transactions, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", defaultName);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    }
});

// Datei-Import (JSON laden & fortschreiben)
btnImport.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const importedData = JSON.parse(event.target.result);
            
            if (!Array.isArray(importedData)) {
                throw new Error('Ungültiges Kassenbuch-Format.');
            }

            let addedCount = 0;
            let duplicateCount = 0;

            importedData.forEach(item => {
                const exists = transactions.some(t => t.id === item.id);
                if (!exists && item.date && item.description && item.type && item.amount) {
                    transactions.push(item);
                    addedCount++;
                } else if (exists) {
                    duplicateCount++;
                }
            });

            updateUI();
            
            let message = `${addedCount} neue Einträge wurden erfolgreich hinzugefügt.`;
            if (duplicateCount > 0) {
                message += ` (${duplicateCount} bereits vorhandene Einträge wurden übersprungen.)`;
            }
            alert(message);

        } catch (err) {
            alert('Fehler beim Lesen der Datei: Vergewissere dich, dass es eine valide Kassenbuch-JSON ist.');
        }
        btnImport.value = '';
    };
    reader.readAsText(file);
});

// Druckfunktion auslösen
btnPrint.addEventListener('click', () => {
    window.print();
});

// Ansicht leeren
btnClear.addEventListener('click', () => {
    if (confirm('Möchtest du die aktuelle Ansicht wirklich leeren? (Deine JSON-Dateien auf dem Computer bleiben unberührt!)')) {
        transactions = [];
        updateUI();
    }
});

// Hilfsfunktionen
function formatCurrency(num) {
    return num.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('de-DE');
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

init();



