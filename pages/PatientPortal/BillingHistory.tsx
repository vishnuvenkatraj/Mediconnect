import React from 'react';
import { MOCK_BILLS } from '../../constants';
import type { Bill, User, Invoice } from '../../types';
import EmptyState from '../../components/Common/EmptyState';
import { formatDisplayDate } from '../../services/dataSanitizer';
import { saveInvoice as dbSaveInvoice } from '../../services/database';
import { downloadBillPdf } from '../../services/pdfBillGenerator';

interface BillingHistoryProps {
  patientId: string;
  user: User;
  invoices?: Invoice[];
  setInvoices?: React.Dispatch<React.SetStateAction<Invoice[]>>;
}

const BillingHistory: React.FC<BillingHistoryProps> = ({ patientId, user, invoices, setInvoices }) => {
  const patientInvoicesAsBills: Bill[] = (invoices || [])
    .filter(inv => inv.patientId === patientId || inv.patientName.toLowerCase() === user.name.toLowerCase())
    .map(inv => ({
      id: inv.id,
      patientId: inv.patientId,
      date: inv.issueDate,
      service: inv.items.map(i => i.description).join(', ') || `Invoice ${inv.invoiceNumber}`,
      amount: inv.totalAmount,
      status: (inv.status === 'Paid' ? 'Paid' : 'Due') as 'Paid' | 'Due'
    }));

  const mockBills = MOCK_BILLS.filter(bill => bill.patientId === patientId);
  // Merge and deduplicate by ID
  const allBillsMap = new Map<string, Bill>();
  mockBills.forEach(b => allBillsMap.set(b.id, b));
  patientInvoicesAsBills.forEach(b => allBillsMap.set(b.id, b));
  const bills = Array.from(allBillsMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handlePayBill = (billId: string) => {
    if (setInvoices && invoices) {
      setInvoices(prev => prev.map(inv => {
        if (inv.id === billId) {
          const updated: Invoice = { ...inv, status: 'Paid' };
          dbSaveInvoice(updated);
          return updated;
        }
        return inv;
      }));
    }
    alert("Payment successful! Your invoice has been marked as Paid.");
  };
  
  const handleDownloadPdf = async (bill: Bill) => {
    try {
      // Find full invoice if available to get line-by-line itemization
      const matchingInvoice = (invoices || []).find(
        inv => inv.id === bill.id || (inv.patientId === patientId && Math.abs(inv.totalAmount - bill.amount) < 0.01)
      );

      await downloadBillPdf({
        bill,
        invoice: matchingInvoice,
        patientUser: user,
      });
    } catch (err) {
      console.error("Invoice PDF generation error:", err);
      alert("Failed to download invoice PDF. Please try again.");
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-800 dark:text-dark-text mb-6">Billing & Payments</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-dark-card">
          <thead className="bg-light dark:bg-dark-bg">
            <tr>
              <th className="text-left py-3 px-4 uppercase font-semibold text-sm text-gray-600 dark:text-gray-300">Date</th>
              <th className="text-left py-3 px-4 uppercase font-semibold text-sm text-gray-600 dark:text-gray-300">Service</th>
              <th className="text-left py-3 px-4 uppercase font-semibold text-sm text-gray-600 dark:text-gray-300">Amount</th>
              <th className="text-left py-3 px-4 uppercase font-semibold text-sm text-gray-600 dark:text-gray-300">Status</th>
              <th className="text-left py-3 px-4 uppercase font-semibold text-sm text-gray-600 dark:text-gray-300">Action</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 dark:text-dark-text">
            {bills.length > 0 ? (
              bills.map(bill => (
                <tr key={bill.id} className="border-b border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg">
                  <td className="py-3 px-4">{formatDisplayDate(bill.date)}</td>
                  <td className="py-3 px-4 font-medium">{bill.service}</td>
                  <td className="py-3 px-4 font-semibold">${Number(bill.amount || 0).toFixed(2)}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                      bill.status === 'Paid' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                    }`}>
                      {bill.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleDownloadPdf(bill)}
                        className="inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-primary dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60 font-semibold py-1.5 px-3 rounded-lg text-xs transition border border-blue-200 dark:border-blue-700"
                        title="Download Official PDF Bill with Hospital Logo"
                      >
                        <span>📄</span> Download Bill
                      </button>
                      {bill.status === 'Due' && (
                        <button
                          onClick={() => handlePayBill(bill.id)}
                          className="bg-secondary text-white font-semibold py-1.5 px-3 rounded-lg text-xs hover:bg-green-600 transition shadow-sm"
                        >
                          Pay Now
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-8">
                  <EmptyState
                    icon="💳"
                    title="No billing statements found"
                    description="You have no outstanding or historical invoices on file."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BillingHistory;