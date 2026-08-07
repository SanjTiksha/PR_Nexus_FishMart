import { useState, useEffect } from 'react';

const DailyStockManager = ({ fishData }) => {
  const [stockEntries, setStockEntries] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualEntries, setManualEntries] = useState({});
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');

  // Load stock data directly from Firestore (no caching)
  useEffect(() => {
    const loadStockData = async () => {
      try {
        console.log('🔄 Loading stock data from Firestore...');
        const { loadDailyStockFromFirestore } = await import('../services/firestoreService');
        const firestoreEntries = await loadDailyStockFromFirestore();
        
        if (firestoreEntries && firestoreEntries.length > 0) {
          setStockEntries(firestoreEntries);
          console.log('✅ Loaded stock data from Firestore:', firestoreEntries.length, 'entries');
        } else {
          console.log('No stock data found in Firestore, starting fresh');
          setStockEntries([]);
        }
      } catch (error) {
        console.error('❌ Error loading stock data from Firestore:', error);
        console.error('❌ Error details:', {
          message: error.message,
          code: error.code,
          stack: error.stack?.substring(0, 300)
        });
        setStockEntries([]);
      }
    };

    loadStockData();
  }, []);

  // Load WhatsApp number from localStorage
  useEffect(() => {
    const savedWhatsappNumber = localStorage.getItem('whatsappReportNumber');
    if (savedWhatsappNumber) {
      setWhatsappNumber(savedWhatsappNumber);
    }
  }, []);

  // Save stock data to Firestore whenever it changes (no localStorage caching)
  useEffect(() => {
    if (stockEntries.length > 0) {
      const saveStockData = async () => {
        try {
          // Save to Firestore only
          const { saveDailyStockEntries } = await import('../services/firestoreService');
          await saveDailyStockEntries(stockEntries);
          console.log('✅ Saved stock data to Firestore:', stockEntries.length, 'entries');
        } catch (firestoreError) {
          console.error('❌ Error saving stock data to Firestore:', firestoreError);
          console.error('❌ Error details:', {
            message: firestoreError.message,
            code: firestoreError.code,
            stack: firestoreError.stack?.substring(0, 300)
          });
          alert('Error saving data to Firestore. Please check your connection and try again.');
        }
      };

      saveStockData();
    }
  }, [stockEntries]);

  // Get previous day's net amount for a specific fish based on current selected date
  const getYesterdayNet = (fishId) => {
    const selectedDate = new Date(currentDate);
    const previousDate = new Date(selectedDate);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousDateStr = previousDate.toISOString().split('T')[0];
    
    const previousEntry = stockEntries.find(entry => 
      entry.fishId === fishId && entry.date === previousDateStr
    );
    
    return previousEntry ? previousEntry.netAmount : 0;
  };

  // Calculate total for an entry
  const calculateTotal = (yesterdayNet, todayQuantity) => {
    return (yesterdayNet || 0) + (todayQuantity || 0);
  };

  // Calculate net amount for an entry
  const calculateNetAmount = (total, todaySale, returnToMarket, adjustQuantity) => {
    const totalNum = total || 0;
    const saleNum = todaySale || 0;
    const returnNum = returnToMarket || 0;
    const adjustNum = adjustQuantity || 0;
    
    return totalNum - saleNum - returnNum + adjustNum;
  };

  // Handle edit
  const handleEdit = (entry) => {
    // For editing, we'll use the manual entry interface
    const entries = {};
    entries[entry.fishId] = {
      fishId: entry.fishId,
      fishName: entry.fishName,
      yesterdayNet: entry.yesterdayNet,
      todayQuantity: entry.todayQuantity,
      todaySale: entry.todaySale,
      returnToMarket: entry.returnToMarket,
      adjustQuantity: entry.adjustQuantity
    };
    setManualEntries(entries);
    setShowManualEntry(true);
  };

  // Handle delete
  const handleDelete = async (entryId) => {
    if (window.confirm('Are you sure you want to delete this stock entry?')) {
      try {
        // Delete from Firestore
        const { deleteDailyStockEntry } = await import('../services/firestoreService');
        await deleteDailyStockEntry(entryId);
        console.log('✅ Deleted stock entry from Firestore:', entryId);
      } catch (error) {
        console.error('⚠️ Error deleting from Firestore (continuing with local delete):', error);
      }
      
      // Update local state
      setStockEntries(prev => prev.filter(entry => entry.id !== entryId));
    }
  };

  // Export to Excel-like CSV
  const handleExportToCSV = () => {
    const currentEntries = getCurrentDateEntries();
    if (currentEntries.length === 0) {
      alert('No data to export for this date.');
      return;
    }

    const csvHeaders = [
      'Fish Name',
      'Yesterday Net',
      'Today Quantity', 
      'Total',
      'Today Sale',
      'Return to Market',
      'Adjust Quantity',
      'Net Amount'
    ];

    const csvData = currentEntries.map(entry => [
      entry.fishName,
      entry.yesterdayNet.toFixed(2),
      entry.todayQuantity.toFixed(2),
      entry.total.toFixed(2),
      entry.todaySale.toFixed(2),
      entry.returnToMarket.toFixed(2),
      entry.adjustQuantity.toFixed(2),
      entry.netAmount.toFixed(2)
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `daily_stock_${currentDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Print Excel-like table
  const handlePrint = () => {
    const currentEntries = getCurrentDateEntries();
    if (currentEntries.length === 0) {
      alert('No data to print for this date.');
      return;
    }

    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Daily Stock Report - ${currentDate}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h1 { color: #2563eb; margin: 0; }
          .header p { color: #6b7280; margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; text-align: center; }
          th { background-color: #f3f4f6; font-weight: bold; }
          .fish-name { text-align: left; }
          .totals { background-color: #e5e7eb; font-weight: bold; }
          .positive { color: #059669; }
          .negative { color: #dc2626; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Daily Stock Management Report</h1>
          <p>Date: ${new Date(currentDate).toLocaleDateString('en-IN')}</p>
          <p>Generated on: ${new Date().toLocaleString('en-IN')}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Fish Name</th>
              <th>Yesterday Net</th>
              <th>Today Quantity</th>
              <th>Total</th>
              <th>Today Sale</th>
              <th>Return to Market</th>
              <th>Adjust</th>
              <th>Net Amount</th>
            </tr>
          </thead>
          <tbody>
            ${currentEntries.map((entry, index) => `
              <tr>
                <td>${index + 1}</td>
                <td class="fish-name">${entry.fishName}</td>
                <td>${entry.yesterdayNet.toFixed(2)}</td>
                <td>${entry.todayQuantity.toFixed(2)}</td>
                <td>${entry.total.toFixed(2)}</td>
                <td>${entry.todaySale.toFixed(2)}</td>
                <td>${entry.returnToMarket.toFixed(2)}</td>
                <td class="${entry.adjustQuantity > 0 ? 'positive' : entry.adjustQuantity < 0 ? 'negative' : ''}">
                  ${entry.adjustQuantity > 0 ? '+' : ''}${entry.adjustQuantity.toFixed(2)}
                </td>
                <td class="${entry.netAmount >= 0 ? 'positive' : 'negative'}">${entry.netAmount.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="totals">
              <td>Σ</td>
              <td class="fish-name">TOTALS</td>
              <td>${currentEntries.reduce((sum, entry) => sum + entry.yesterdayNet, 0).toFixed(2)}</td>
              <td>${currentEntries.reduce((sum, entry) => sum + entry.todayQuantity, 0).toFixed(2)}</td>
              <td>${currentEntries.reduce((sum, entry) => sum + entry.total, 0).toFixed(2)}</td>
              <td>${currentEntries.reduce((sum, entry) => sum + entry.todaySale, 0).toFixed(2)}</td>
              <td>${currentEntries.reduce((sum, entry) => sum + entry.returnToMarket, 0).toFixed(2)}</td>
              <td>${currentEntries.reduce((sum, entry) => sum + entry.adjustQuantity, 0).toFixed(2)}</td>
              <td>${currentEntries.reduce((sum, entry) => sum + entry.netAmount, 0).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  // Get entries for current date
  const getCurrentDateEntries = () => {
    return stockEntries.filter(entry => entry.date === currentDate);
  };

  // Handle date change and refresh entries
  const handleDateChange = (newDate) => {
    setCurrentDate(newDate);
    // Clear any existing manual entries when date changes
    setManualEntries({});
    setShowManualEntry(false);
  };


  // Initialize manual entries for all fish
  const initializeManualEntries = () => {
    const entries = {};
    fishData.fishes.forEach(fish => {
      const yesterdayNet = getYesterdayNet(fish.id);
      entries[fish.id] = {
        fishId: fish.id,
        fishName: fish.name,
        yesterdayNet: yesterdayNet,
        todayQuantity: 0,
        todaySale: 0,
        returnToMarket: 0,
        adjustQuantity: 0
      };
    });
    setManualEntries(entries);
  };

  // Handle manual entry input change
  const handleManualEntryChange = (fishId, field, value) => {
    setManualEntries(prev => ({
      ...prev,
      [fishId]: {
        ...prev[fishId],
        [field]: parseFloat(value) || 0
      }
    }));
  };

  // Calculate values for manual entry
  const calculateManualValues = (fishId) => {
    const entry = manualEntries[fishId];
    if (!entry) return { total: 0, netAmount: 0 };
    
    const total = entry.yesterdayNet + entry.todayQuantity;
    const netAmount = total - entry.todaySale - entry.returnToMarket + entry.adjustQuantity;
    
    return { total, netAmount };
  };

  // Save all manual entries
  const handleSaveAllManualEntries = async () => {
    const newEntries = [];
    const updatedEntries = [];
    
    Object.values(manualEntries).forEach(entry => {
      if (entry.todayQuantity > 0 || entry.todaySale > 0 || entry.returnToMarket > 0 || entry.adjustQuantity !== 0) {
        const { total, netAmount } = calculateManualValues(entry.fishId);
        
        // Check if this fish already has an entry for today
        const existingEntry = stockEntries.find(e => e.fishId === entry.fishId && e.date === currentDate);
        
        if (existingEntry) {
          // Update existing entry
          const updatedEntry = {
            ...existingEntry,
            yesterdayNet: entry.yesterdayNet,
            todayQuantity: entry.todayQuantity,
            total: total,
            todaySale: entry.todaySale,
            returnToMarket: entry.returnToMarket,
            adjustQuantity: entry.adjustQuantity,
            netAmount: netAmount,
            updatedAt: new Date().toISOString()
          };
          updatedEntries.push(updatedEntry);
        } else {
          // Create new entry
          const newEntry = {
            id: Date.now() + Math.random(),
            fishId: entry.fishId,
            fishName: entry.fishName,
            date: currentDate,
            yesterdayNet: entry.yesterdayNet,
            todayQuantity: entry.todayQuantity,
            total: total,
            todaySale: entry.todaySale,
            returnToMarket: entry.returnToMarket,
            adjustQuantity: entry.adjustQuantity,
            netAmount: netAmount,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          newEntries.push(newEntry);
        }
      }
    });

    if (newEntries.length === 0 && updatedEntries.length === 0) {
      alert('Please enter at least one value for any fish.');
      return;
    }

    // Save to Firestore first and get IDs
    const entriesWithFirestoreIds = [];
    try {
      const { saveDailyStockEntry } = await import('../services/firestoreService');
      const allEntries = [...newEntries, ...updatedEntries];
      
      // Save each entry to Firestore and get document ID
      for (const entry of allEntries) {
        try {
          const firestoreId = await saveDailyStockEntry(entry);
          // Use Firestore ID if we got one, otherwise keep original ID
          entriesWithFirestoreIds.push({
            ...entry,
            id: firestoreId || entry.id
          });
        } catch (entryError) {
          console.error('⚠️ Error saving individual entry to Firestore:', entryError);
          // Still include entry even if Firestore save failed
          entriesWithFirestoreIds.push(entry);
        }
      }
      
      console.log('✅ Saved entries to Firestore');
    } catch (error) {
      console.error('⚠️ Error saving to Firestore:', error);
      // Use original entries if Firestore fails
      entriesWithFirestoreIds.push(...newEntries, ...updatedEntries);
    }

    // Update stock entries with Firestore IDs
    setStockEntries(prev => {
      let updated = [...prev];
      
      // Remove existing entries that are being updated
      updated = updated.filter(entry => 
        !updatedEntries.some(ue => ue.id === entry.id)
      );
      
      // Add all entries (new + updated) with Firestore IDs
      updated = [...updated, ...entriesWithFirestoreIds];
      
      return updated;
    });

    setShowManualEntry(false);
    setManualEntries({});
    
    const totalSaved = newEntries.length + updatedEntries.length;
    const message = newEntries.length > 0 && updatedEntries.length > 0 
      ? `Successfully saved ${newEntries.length} new entries and updated ${updatedEntries.length} existing entries to Firestore!`
      : newEntries.length > 0 
      ? `Successfully saved ${newEntries.length} new stock entries to Firestore!`
      : `Successfully updated ${updatedEntries.length} existing entries to Firestore!`;
    
    alert(message);
  };

  // Clear all manual entries
  const handleClearAllManualEntries = () => {
    if (window.confirm('Are you sure you want to clear all entries?')) {
      initializeManualEntries();
    }
  };

  // Force save data to Firestore (no localStorage caching)
  const handleForceSave = async () => {
    try {
      // Save to Firestore only
      const { saveDailyStockEntries } = await import('../services/firestoreService');
      await saveDailyStockEntries(stockEntries);
      alert(`✅ Data saved successfully to Firestore! ${stockEntries.length} entries saved.`);
      console.log('✅ Force saved stock data to Firestore:', stockEntries);
    } catch (firestoreError) {
      console.error('Error saving to Firestore:', firestoreError);
      alert(`⚠️ Firestore update failed. Please check your connection and try again.`);
    }
  };


  // Save WhatsApp number
  const handleSaveWhatsappNumber = (number) => {
    const cleanNumber = number.replace(/\D/g, ''); // Remove non-digits
    if (cleanNumber.length >= 10) {
      setWhatsappNumber(cleanNumber);
      localStorage.setItem('whatsappReportNumber', cleanNumber);
      alert('WhatsApp number saved successfully!');
      return true;
    } else {
      alert('Please enter a valid WhatsApp number (at least 10 digits)');
      return false;
    }
  };

  // Generate WhatsApp report
  const generateWhatsAppReport = () => {
    const currentEntries = getCurrentDateEntries();
    if (currentEntries.length === 0) {
      alert('No stock entries found for this date.');
      return null;
    }

    const dateStr = new Date(currentDate).toLocaleDateString('en-IN');
    const shopName = fishData.shopInfo?.name || 'PR Nexus FishMart';
    
    let report = `📊 *Daily Stock Report - ${shopName}*\n`;
    report += `📅 Date: ${dateStr}\n`;
    report += `⏰ Generated: ${new Date().toLocaleString('en-IN')}\n\n`;
    
    report += `📋 *Stock Summary:*\n`;
    report += `• Total Entries: ${currentEntries.length}\n`;
    report += `• Total Sales: ${currentEntries.reduce((sum, entry) => sum + entry.todaySale, 0).toFixed(2)}\n`;
    report += `• Total Net Amount: ${currentEntries.reduce((sum, entry) => sum + entry.netAmount, 0).toFixed(2)}\n\n`;
    
    // Create perfectly aligned tabular format for WhatsApp
    report += `📝 *Stock Details (Table Format):*\n\n`;
    
    // Helper functions for perfect alignment
    const pad = (str, len) => String(str).padEnd(len, " ");
    const num = (n, len = 7) => String(Number(n).toFixed(2)).padStart(len, " ");
    const padLeft = (str, len) => String(str).padStart(len, " ");
    
    // Table header with perfect spacing
    report += `| # | Fish Name     |  Y.Net  |  T.Qty  |  Total  | Sales  |  Ret  |  Adj  |  Net  |\n`;
    report += `|---|---------------|---------|---------|---------|--------|-------|-------|-------|\n`;
    
    // Data rows with perfect alignment
    currentEntries.forEach((entry, index) => {
      const fishName = entry.fishName.length > 12 ? entry.fishName.substring(0, 12) + '..' : entry.fishName;
      const adjust = entry.adjustQuantity > 0 ? `+${entry.adjustQuantity.toFixed(2)}` : entry.adjustQuantity.toFixed(2);
      
      const row = `| ${padLeft(index + 1, 1)} | ${pad(fishName, 13)} | ${num(entry.yesterdayNet)} | ${num(entry.todayQuantity)} | ${num(entry.total)} | ${num(entry.todaySale, 6)} | ${num(entry.returnToMarket, 5)} | ${num(entry.adjustQuantity, 5)} | ${num(entry.netAmount)} |`;
      report += `${row}\n`;
    });
    
    // Totals row with perfect alignment
    const totalYesterday = currentEntries.reduce((sum, entry) => sum + entry.yesterdayNet, 0);
    const totalTodayQty = currentEntries.reduce((sum, entry) => sum + entry.todayQuantity, 0);
    const totalTotal = currentEntries.reduce((sum, entry) => sum + entry.total, 0);
    const totalSales = currentEntries.reduce((sum, entry) => sum + entry.todaySale, 0);
    const totalReturns = currentEntries.reduce((sum, entry) => sum + entry.returnToMarket, 0);
    const totalAdjust = currentEntries.reduce((sum, entry) => sum + entry.adjustQuantity, 0);
    const totalNet = currentEntries.reduce((sum, entry) => sum + entry.netAmount, 0);
    
    const totalsRow = `| Σ | ${pad('TOTALS', 13)} | ${num(totalYesterday)} | ${num(totalTodayQty)} | ${num(totalTotal)} | ${num(totalSales, 6)} | ${num(totalReturns, 5)} | ${num(totalAdjust, 5)} | ${num(totalNet)} |`;
    report += `${totalsRow}\n\n`;
    
    // Add column explanations
    report += `*Column Legend:*\n`;
    report += `Y.Net = Yesterday Net, T.Qty = Today Quantity\n`;
    report += `Ret = Return to Market, Adj = Adjustment\n\n`;
    
    report += `---\n`;
    report += `📱 Generated by PR Nexus FishMart Management System\n`;
    report += `🔄 For updates, contact: ${fishData.shopInfo?.phone || 'N/A'}`;
    
    return report;
  };

  // Send WhatsApp report
  const handleSendWhatsAppReport = () => {
    if (!whatsappNumber) {
      setShowWhatsAppModal(true);
      return;
    }

    const report = generateWhatsAppReport();
    if (report) {
      const encodedReport = encodeURIComponent(report);
      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedReport}`;
      
      // Open WhatsApp in new tab
      window.open(whatsappUrl, '_blank');
    }
  };

  // Preview WhatsApp report
  const handlePreviewWhatsAppReport = () => {
    const report = generateWhatsAppReport();
    if (report) {
      const previewWindow = window.open('', '_blank', 'width=600,height=700');
      previewWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>WhatsApp Report Preview</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              background: #f0f0f0;
            }
            .preview-container {
              background: white;
              padding: 20px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              max-width: 500px;
              margin: 0 auto;
            }
            .whatsapp-header {
              background: #25D366;
              color: white;
              padding: 15px;
              border-radius: 10px 10px 0 0;
              text-align: center;
              margin: -20px -20px 20px -20px;
            }
            .report-content {
              white-space: pre;
              line-height: 1.4;
              font-size: 13px;
              font-family: 'Courier New', monospace;
              overflow-x: auto;
              background: #f8f9fa;
              padding: 15px;
              border-radius: 8px;
              border: 1px solid #e9ecef;
            }
            .close-btn {
              background: #25D366;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 5px;
              cursor: pointer;
              margin-top: 20px;
              width: 100%;
            }
          </style>
        </head>
        <body>
          <div class="preview-container">
            <div class="whatsapp-header">
              <h2>📱 WhatsApp Report Preview</h2>
              <p>This is how your report will appear in WhatsApp</p>
              <p style="font-size: 12px; margin-top: 5px;">Table will render in monospace format for perfect alignment</p>
            </div>
            <div class="report-content">${report}</div>
            <button class="close-btn" onclick="window.close()">Close Preview</button>
          </div>
        </body>
        </html>
      `);
    }
  };

  // Generate PDF content for download
  const generatePDFContent = () => {
    const currentEntries = getCurrentDateEntries();
    if (currentEntries.length === 0) {
      alert('No stock entries found for this date.');
      return null;
    }

    // Create a simple text-based PDF-like content
    let pdfContent = `DAILY STOCK REPORT\n`;
    pdfContent += `Date: ${currentDate}\n`;
    pdfContent += `Generated: ${new Date().toLocaleString()}\n`;
    pdfContent += `Shop: ${fishData.shopInfo?.name || 'PR Nexus FishMart'}\n`;
    pdfContent += `Phone: ${fishData.shopInfo?.phone || 'N/A'}\n\n`;
    
    pdfContent += `FISH STOCK DETAILS\n`;
    pdfContent += `${'='.repeat(80)}\n\n`;
    
    // Table header
    pdfContent += `Fish Name           | Y.Net  | T.Qty | Total  | Sales  | Return | Adjust | Net Amt\n`;
    pdfContent += `${'-'.repeat(80)}\n`;
    
    // Table rows
    currentEntries.forEach(entry => {
      const fishName = entry.fishName.length > 15 ? entry.fishName.substring(0, 15) + '..' : entry.fishName.padEnd(15);
      pdfContent += `${fishName} | ${entry.yesterdayNet.toFixed(2).padStart(6)} | ${entry.todayQuantity.toFixed(2).padStart(5)} | ${entry.total.toFixed(2).padStart(6)} | ${entry.todaySale.toFixed(2).padStart(6)} | ${entry.returnToMarket.toFixed(2).padStart(6)} | ${entry.adjustQuantity.toFixed(2).padStart(6)} | ${entry.netAmount.toFixed(2).padStart(7)}\n`;
    });
    
    pdfContent += `\nSUMMARY\n`;
    pdfContent += `${'='.repeat(40)}\n`;
    pdfContent += `Total Entries: ${currentEntries.length}\n`;
    pdfContent += `Total Sales: ₹${currentEntries.reduce((sum, entry) => sum + entry.todaySale, 0).toFixed(2)}\n`;
    pdfContent += `Total Net Amount: ₹${currentEntries.reduce((sum, entry) => sum + entry.netAmount, 0).toFixed(2)}\n`;
    
    return pdfContent;
  };

  // Download PDF file
  const handleDownloadPDF = () => {
    const pdfContent = generatePDFContent();
    if (!pdfContent) return; // Exit if no content
    
    const blob = new Blob([pdfContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-stock-report-${currentDate}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Send WhatsApp report with PDF attachment option
  const handleSendWhatsAppReportWithPDF = () => {
    if (!whatsappNumber) {
      setShowWhatsAppModal(true);
      return;
    }

    // Check if we have data first
    const currentEntries = getCurrentDateEntries();
    if (currentEntries.length === 0) {
      alert('No stock entries found for this date.');
      return;
    }

    // First download the PDF
    handleDownloadPDF();
    
    // Then open WhatsApp with text message
    const report = generateWhatsAppReport();
    if (report) {
      const encodedReport = encodeURIComponent(report);
      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedReport}`;
      
      // Open WhatsApp in new tab
      window.open(whatsappUrl, '_blank');
      
      // Show instruction to user
      setTimeout(() => {
        alert('📱 WhatsApp opened with text report.\n📄 PDF file downloaded to your device.\n\nTo attach PDF:\n1. In WhatsApp, click the attachment icon (📎)\n2. Select "Document"\n3. Choose the downloaded file: daily-stock-report-' + currentDate + '.txt');
      }, 1000);
    }
  };

  // Get all available dates from stock entries
  const getAvailableDates = () => {
    const dates = [...new Set(stockEntries.map(entry => entry.date))];
    return dates.sort((a, b) => new Date(b) - new Date(a)); // Sort newest first
  };

  // Delete entries for a specific date
  const handleDeleteDateEntries = async (dateToDelete) => {
    if (window.confirm(`Are you sure you want to delete ALL entries for ${dateToDelete}?\n\nThis action cannot be undone!`)) {
      const entriesToDelete = stockEntries.filter(entry => entry.date === dateToDelete);
      const updatedEntries = stockEntries.filter(entry => entry.date !== dateToDelete);
      
      // Delete from Firestore
      try {
        const { deleteDailyStockEntry } = await import('../services/firestoreService');
        for (const entry of entriesToDelete) {
          await deleteDailyStockEntry(entry.id);
        }
        console.log('✅ Deleted entries from Firestore for date:', dateToDelete);
      } catch (error) {
        console.error('⚠️ Error deleting from Firestore:', error);
      }
      
      // Update local state
      setStockEntries(updatedEntries);
      
      alert(`Successfully deleted all entries for ${dateToDelete} from Firestore!`);
    }
  };

  // Delete old entries (older than specified days)
  const handleDeleteOldEntries = async () => {
    const daysToKeep = prompt('Delete entries older than how many days?\n\nEnter number of days (e.g., 30 for entries older than 30 days):');
    
    if (!daysToKeep || isNaN(daysToKeep) || daysToKeep < 1) {
      alert('Please enter a valid number of days (minimum 1)');
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(daysToKeep));
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const oldEntries = stockEntries.filter(entry => entry.date < cutoffDateStr);
    
    if (oldEntries.length === 0) {
      alert(`No entries found older than ${daysToKeep} days.`);
      return;
    }

    const uniqueOldDates = [...new Set(oldEntries.map(entry => entry.date))];
    
    if (window.confirm(`Found ${oldEntries.length} entries from ${uniqueOldDates.length} dates older than ${daysToKeep} days.\n\nDates to be deleted:\n${uniqueOldDates.join(', ')}\n\nAre you sure you want to delete these entries?\n\nThis action cannot be undone!`)) {
      // Delete from Firestore
      try {
        const { deleteDailyStockEntry } = await import('../services/firestoreService');
        for (const entry of oldEntries) {
          await deleteDailyStockEntry(entry.id);
        }
        console.log('✅ Deleted old entries from Firestore');
      } catch (error) {
        console.error('⚠️ Error deleting from Firestore:', error);
      }
      
      // Update local state
      const updatedEntries = stockEntries.filter(entry => entry.date >= cutoffDateStr);
      setStockEntries(updatedEntries);
      
      alert(`Successfully deleted ${oldEntries.length} entries from ${uniqueOldDates.length} old dates from Firestore!`);
    }
  };

  return (
    <section className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-white px-6 py-10 sm:px-10 relative">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-10 border-b pb-6 border-blue-100">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 tracking-tight">
            🐟 Daily Stock Management
          </h1>
          <p className="text-gray-500 mt-2 text-sm sm:text-base">
            Manage your fish inventory, generate reports, and track daily sales with ease.
          </p>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <input
            type="date"
            value={currentDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-gray-700 text-sm sm:text-base"
          />
          <button
            onClick={() => {
              initializeManualEntries();
              setShowManualEntry(true);
            }}
            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-5 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all"
            disabled={fishData.fishes.length === 0}
          >
            <i className="mr-2">📊</i> Manual Entry
          </button>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-wrap gap-3 justify-start bg-white/80 backdrop-blur-sm border border-gray-100 rounded-2xl p-4 shadow-md mb-10">
        {[
          { label: "Export CSV", color: "from-orange-400 to-pink-500", icon: "📤", action: handleExportToCSV, disabled: getCurrentDateEntries().length === 0 },
          { label: "Print", color: "from-purple-500 to-indigo-600", icon: "🖨️", action: handlePrint, disabled: getCurrentDateEntries().length === 0 },
          { label: "Force Save", color: "from-blue-600 to-cyan-500", icon: "💾", action: handleForceSave, disabled: false },
          { label: "Preview Report", color: "from-sky-500 to-blue-600", icon: "👁️", action: handlePreviewWhatsAppReport, disabled: getCurrentDateEntries().length === 0 },
          { label: "WhatsApp Report", color: "from-green-400 to-emerald-500", icon: "💬", action: handleSendWhatsAppReport, disabled: getCurrentDateEntries().length === 0 },
          { label: "Download PDF", color: "from-pink-500 to-rose-500", icon: "📄", action: handleDownloadPDF, disabled: getCurrentDateEntries().length === 0 },
          { label: "Delete Old Data", color: "from-red-500 to-orange-600", icon: "🗑️", action: handleDeleteOldEntries, disabled: false },
        ].map((btn, i) => (
          <button
            key={i}
            onClick={btn.action}
            disabled={btn.disabled}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white font-medium text-sm sm:text-base shadow-md hover:scale-105 transition-all bg-gradient-to-r ${btn.color} ${btn.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {btn.icon} {btn.label}
          </button>
        ))}
      </div>

      {/* Status Summary */}
      <div className="bg-white/90 backdrop-blur-md border border-gray-100 rounded-2xl p-5 shadow-md mb-8 flex flex-wrap items-center justify-between">
        <div className="flex items-center gap-2 text-gray-700 font-medium">
          <span className="text-lg">📅</span> {currentDate}
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>🧾 {getCurrentDateEntries().length} entries today</span>
          <span>📦 {stockEntries.length} total saved</span>
          <span className="flex items-center gap-1 text-green-600 font-semibold">
            ✅ Auto-saved
          </span>
        </div>
      </div>

      {/* Excel-like Info Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-gray-300 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-blue-600 text-xl">📊</span>
            <div className="text-gray-800 text-sm">
              <p><strong>Manual Entry Daily Stock Management:</strong> Fill all fish data in one go with Excel-style interface</p>
              <p className="mt-1 text-xs text-gray-600">
                <strong>Formula:</strong> Net Amount = Total - Today's Sale - Return to Market + Adjust Quantity
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-xs text-gray-600">
            <span className="bg-white px-2 py-1 rounded border">📅 {new Date(currentDate).toLocaleDateString('en-IN')}</span>
            <span className="bg-white px-2 py-1 rounded border">📋 {getCurrentDateEntries().length} entries today</span>
            <span className="bg-white px-2 py-1 rounded border">💾 {stockEntries.length} total saved</span>
            <span className="bg-green-100 px-2 py-1 rounded border text-green-700">✅ Auto-saved</span>
            {whatsappNumber && (
              <span 
                className="bg-green-100 px-2 py-1 rounded border text-green-700 cursor-pointer hover:bg-green-200"
                onClick={() => setShowWhatsAppModal(true)}
                title="Click to change WhatsApp number"
              >
                📱 {whatsappNumber}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Data Status Warning */}
      {stockEntries.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <span className="text-yellow-600 text-lg">⚠️</span>
            <div className="text-yellow-800 text-sm">
              <p><strong>No Stock Data Found:</strong> This appears to be your first time using the system or data was cleared.</p>
              <p className="mt-1">Click "📝 Manual Entry (All Fish)" to start adding your daily stock data.</p>
            </div>
          </div>
        </div>
      )}

      {/* Available Dates Management */}
      {getAvailableDates().length > 0 && (
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              📅 Available Dates ({getAvailableDates().length})
          </h3>
            <span className="text-sm text-gray-600">
              Click on a date to delete all entries for that date
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {getAvailableDates().map((date) => {
              const dateEntries = stockEntries.filter(entry => entry.date === date);
              const isCurrentDate = date === currentDate;
              
              return (
                <div
                  key={date}
                  className={`relative group border rounded-lg p-3 transition-all duration-200 ${
                    isCurrentDate 
                      ? 'border-blue-300 bg-blue-50' 
                      : 'border-gray-200 bg-gray-50 hover:border-red-300 hover:bg-red-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className={`font-medium ${isCurrentDate ? 'text-blue-900' : 'text-gray-900'}`}>
                        {new Date(date).toLocaleDateString('en-IN')}
                      </p>
                      <p className={`text-sm ${isCurrentDate ? 'text-blue-700' : 'text-gray-600'}`}>
                        {dateEntries.length} entries
                      </p>
                      {isCurrentDate && (
                        <span className="inline-block mt-1 px-2 py-1 text-xs bg-blue-200 text-blue-800 rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    
                    {!isCurrentDate && (
                      <button
                        onClick={() => handleDeleteDateEntries(date)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded"
                        title={`Delete all entries for ${new Date(date).toLocaleDateString('en-IN')}`}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ Warning:</strong> Deleting date entries is permanent and cannot be undone. 
              Make sure to export important data before deleting.
            </p>
          </div>
        </div>
      )}


      {/* Manual Entry Interface - All Fish in Row/Column Format */}
      {showManualEntry && (
        <div className="card p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-900">
              Manual Entry - All Fish ({new Date(currentDate).toLocaleDateString('en-IN')})
            </h3>
            <div className="flex space-x-3">
              <button
                onClick={handleSaveAllManualEntries}
                className="btn-primary bg-green-600 hover:bg-green-700"
              >
                💾 Save All Entries
              </button>
              <button
                onClick={handleClearAllManualEntries}
                className="btn-secondary bg-yellow-600 hover:bg-yellow-700"
              >
                🗑️ Clear All
              </button>
          <button
            onClick={() => {
                  setShowManualEntry(false);
                  setManualEntries({});
            }}
                className="btn-secondary"
          >
                Cancel
          </button>
        </div>
          </div>

          {/* Manual Entry Table */}
          <div className="overflow-x-auto border border-gray-300 rounded-lg">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-gray-200 border-b-2 border-gray-400">
                  <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-300 min-w-[40px] bg-gray-300">
                    #
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-300 min-w-[150px]">
                    Fish Name
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-300 min-w-[100px] bg-blue-50">
                    Yesterday Net
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-300 min-w-[120px]">
                    Today Quantity
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-300 min-w-[100px] bg-blue-50">
                    Total
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-300 min-w-[100px]">
                    Today Sale
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-300 min-w-[120px]">
                    Return Market
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-300 min-w-[100px]">
                    Adjust (+/-)
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-300 min-w-[100px] bg-green-50">
                    Net Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {fishData.fishes.map((fish, index) => {
                  const entry = manualEntries[fish.id] || {
                    fishId: fish.id,
                    fishName: fish.name,
                    yesterdayNet: getYesterdayNet(fish.id),
                    todayQuantity: 0,
                    todaySale: 0,
                    returnToMarket: 0,
                    adjustQuantity: 0
                  };
                  const { total, netAmount } = calculateManualValues(fish.id);
                  
                  return (
                    <tr key={fish.id} className={`hover:bg-blue-50 border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-2 py-2 text-center text-xs text-gray-600 border-r border-gray-300 bg-gray-100 font-mono">
                        {index + 1}
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 border-r border-gray-300">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                          {fish.name}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 text-center border-r border-gray-300 font-mono bg-blue-50">
                        {entry.yesterdayNet.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-center border-r border-gray-300">
                        <input
                          type="number"
                          step="0.01"
                          value={entry.todayQuantity || ''}
                          onChange={(e) => handleManualEntryChange(fish.id, 'todayQuantity', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-600 focus:border-transparent text-center"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 text-center border-r border-gray-300 font-mono font-bold bg-blue-50">
                        {total.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-center border-r border-gray-300">
                        <input
                          type="number"
                          step="0.01"
                          value={entry.todaySale || ''}
                          onChange={(e) => handleManualEntryChange(fish.id, 'todaySale', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-600 focus:border-transparent text-center"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-3 py-2 text-center border-r border-gray-300">
                        <input
                          type="number"
                          step="0.01"
                          value={entry.returnToMarket || ''}
                          onChange={(e) => handleManualEntryChange(fish.id, 'returnToMarket', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-600 focus:border-transparent text-center"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-3 py-2 text-center border-r border-gray-300">
                        <input
                          type="number"
                          step="0.01"
                          value={entry.adjustQuantity || ''}
                          onChange={(e) => handleManualEntryChange(fish.id, 'adjustQuantity', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-600 focus:border-transparent text-center"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-3 py-2 text-sm font-bold text-center border-r border-gray-300 font-mono bg-green-50">
                        <span className={`${netAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {netAmount.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Footer Row with Totals */}
              <tfoot>
                <tr className="bg-gray-300 border-t-2 border-gray-400 font-bold">
                  <td className="px-2 py-2 text-center text-xs text-gray-600 border-r border-gray-300 bg-gray-400 font-mono">
                    Σ
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 border-r border-gray-300">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-gray-600 rounded-full mr-2"></div>
                      TOTALS
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 text-center border-r border-gray-300 font-mono bg-blue-100">
                    {Object.values(manualEntries).reduce((sum, entry) => sum + (entry.yesterdayNet || 0), 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 text-center border-r border-gray-300 font-mono">
                    {Object.values(manualEntries).reduce((sum, entry) => sum + (entry.todayQuantity || 0), 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 text-center border-r border-gray-300 font-mono bg-blue-100">
                    {Object.values(manualEntries).reduce((sum, entry) => {
                      const { total } = calculateManualValues(entry.fishId);
                      return sum + total;
                    }, 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 text-center border-r border-gray-300 font-mono">
                    {Object.values(manualEntries).reduce((sum, entry) => sum + (entry.todaySale || 0), 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 text-center border-r border-gray-300 font-mono">
                    {Object.values(manualEntries).reduce((sum, entry) => sum + (entry.returnToMarket || 0), 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 text-center border-r border-gray-300 font-mono">
                    {Object.values(manualEntries).reduce((sum, entry) => sum + (entry.adjustQuantity || 0), 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 text-center border-r border-gray-300 font-mono bg-green-100">
                    {Object.values(manualEntries).reduce((sum, entry) => {
                      const { netAmount } = calculateManualValues(entry.fishId);
                      return sum + netAmount;
                    }, 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Instructions */}
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <span className="text-yellow-600 text-lg">💡</span>
              <div className="text-yellow-800 text-sm">
                <p><strong>Instructions:</strong></p>
                <ul className="mt-1 list-disc list-inside space-y-1">
                  <li>Fill in the quantities for each fish in the respective columns</li>
                  <li><strong>Yesterday Net:</strong> Auto-filled from previous day (read-only)</li>
                  <li><strong>Today Quantity:</strong> New stock received today</li>
                  <li><strong>Today Sale:</strong> Quantity sold today</li>
                  <li><strong>Return Market:</strong> Fish returned to market</li>
                  <li><strong>Adjust:</strong> Manual adjustment (+ or -)</li>
                  <li><strong>Total & Net Amount:</strong> Calculated automatically</li>
                  <li>Click "Save All Entries" to save all data at once</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock Entries Section */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200">
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900">
            Stock Entries for {new Date(currentDate).toLocaleDateString('en-IN')}
          </h3>
        </div>
        
        {getCurrentDateEntries().length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <div className="text-4xl mb-4">📊</div>
            <p>No stock entries for this date.</p>
            <p className="text-sm">Click "Add Stock Entry" to start tracking.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-gray-200 border-b-2 border-gray-400">
                  <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-300 min-w-[40px] bg-gray-300">
                    #
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-300 min-w-[120px]">
                    Fish Name
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-300 min-w-[100px]">
                    Yesterday Net
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-300 min-w-[110px]">
                    Today Quantity
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-300 min-w-[80px] bg-blue-50">
                    Total
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-300 min-w-[100px]">
                    Today's Sale
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-300 min-w-[120px]">
                    Return to Market
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-300 min-w-[90px]">
                    Adjust (+/-)
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-300 min-w-[100px] bg-green-50">
                    Net Amount
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[100px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {getCurrentDateEntries().map((entry, index) => (
                  <tr key={entry.id} className={`hover:bg-blue-50 border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-2 py-2 text-center text-xs text-gray-600 border-r border-gray-300 bg-gray-100 font-mono">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2 text-sm font-medium text-gray-900 border-r border-gray-300">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                        {entry.fishName}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-center border-r border-gray-300 font-mono">
                      {entry.yesterdayNet.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-center border-r border-gray-300 font-mono">
                      {entry.todayQuantity.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-center border-r border-gray-300 font-mono font-bold bg-blue-50">
                      {entry.total.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-center border-r border-gray-300 font-mono">
                      {entry.todaySale.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-center border-r border-gray-300 font-mono">
                      {entry.returnToMarket.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-sm text-center border-r border-gray-300 font-mono">
                      <span className={`${entry.adjustQuantity > 0 ? 'text-green-600' : entry.adjustQuantity < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        {entry.adjustQuantity > 0 ? '+' : ''}{entry.adjustQuantity.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm font-bold text-center border-r border-gray-300 font-mono bg-green-50">
                      <span className={`${entry.netAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {entry.netAmount.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm font-medium text-center">
                      <div className="flex justify-center space-x-1">
                        <button
                          onClick={() => handleEdit(entry)}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                          title="Edit Entry (Opens Manual Entry)"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                          title="Delete Entry"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Footer Row with Totals */}
              <tfoot>
                <tr className="bg-gray-300 border-t-2 border-gray-400 font-bold">
                  <td className="px-2 py-2 text-center text-xs text-gray-600 border-r border-gray-300 bg-gray-400 font-mono">
                    Σ
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 border-r border-gray-300">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-gray-600 rounded-full mr-2"></div>
                      TOTALS
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 text-center border-r border-gray-300 font-mono">
                    {getCurrentDateEntries().reduce((sum, entry) => sum + entry.yesterdayNet, 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 text-center border-r border-gray-300 font-mono">
                    {getCurrentDateEntries().reduce((sum, entry) => sum + entry.todayQuantity, 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 text-center border-r border-gray-300 font-mono bg-blue-100">
                    {getCurrentDateEntries().reduce((sum, entry) => sum + entry.total, 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 text-center border-r border-gray-300 font-mono">
                    {getCurrentDateEntries().reduce((sum, entry) => sum + entry.todaySale, 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 text-center border-r border-gray-300 font-mono">
                    {getCurrentDateEntries().reduce((sum, entry) => sum + entry.returnToMarket, 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 text-center border-r border-gray-300 font-mono">
                    {getCurrentDateEntries().reduce((sum, entry) => sum + entry.adjustQuantity, 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 text-center border-r border-gray-300 font-mono bg-green-100">
                    {getCurrentDateEntries().reduce((sum, entry) => sum + entry.netAmount, 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 text-center">
                    {getCurrentDateEntries().length} items
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Summary Card */}
      {getCurrentDateEntries().length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4">
            <div className="text-2xl font-bold text-blue-600">
              {getCurrentDateEntries().length}
            </div>
            <div className="text-sm text-gray-600">Total Entries</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-bold text-green-600">
              {getCurrentDateEntries().reduce((sum, entry) => sum + entry.todaySale, 0).toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">Total Sales Today</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-bold text-purple-600">
              {getCurrentDateEntries().reduce((sum, entry) => sum + entry.netAmount, 0).toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">Total Net Amount</div>
          </div>
        </div>
      )}

      {/* WhatsApp Number Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              📱 WhatsApp Number Setup
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter your WhatsApp number to receive daily stock reports. This number will be saved and used only for sending reports.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  WhatsApp Number
                </label>
                <input
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="Enter WhatsApp number (e.g., 919096205136)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-600 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Include country code (e.g., 91 for India)
                </p>
              </div>
              
              {whatsappNumber && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">
                    <strong>Current Number:</strong> {whatsappNumber}
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  if (handleSaveWhatsappNumber(whatsappNumber)) {
                    setShowWhatsAppModal(false);
                    // Automatically send report after saving number
                    setTimeout(() => {
                      const report = generateWhatsAppReport();
                      if (report) {
                        const encodedReport = encodeURIComponent(report);
                        const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedReport}`;
                        window.open(whatsappUrl, '_blank');
                      }
                    }, 500);
                  }
                }}
                className="flex-1 btn-primary bg-green-600 hover:bg-green-700"
              >
                💾 Save & Send Report
              </button>
              <button
                onClick={() => setShowWhatsAppModal(false)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>Note:</strong> This number is only used for sending stock reports via WhatsApp. 
                It's stored locally and not shared with any third parties.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={() => {
          initializeManualEntries();
          setShowManualEntry(true);
        }}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 flex items-center justify-center z-50"
        title="Add New Stock Entry"
      >
        <span className="text-xl">+</span>
      </button>
    </section>
  );
};

export default DailyStockManager;
