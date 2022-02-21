import frappe
from frappe.utils import flt, cint
from erpnext.accounts.doctype.sales_invoice.sales_invoice import SalesInvoice

class OverrideSalesInvoice(SalesInvoice):

    @frappe.whitelist()
    def set_advances(self):
        """Returns list of advances against Account, Party, Reference"""

        res = self.get_advance_entries()

        self.set("advances", [])
        advance_allocated = 0
        for d in res:
            # if d.against_order:
            # 	allocated_amount = flt(d.amount)
            # else:
            amount = 0
            if self.get('party_account_currency') == self.company_currency:
                amount = self.get('base_rounded_total') or self.base_grand_total
            else:
                amount = self.get('rounded_total') or self.grand_total

            allocated_amount = min(amount - advance_allocated, d.amount)
            advance_allocated += flt(allocated_amount)

            advance_row = {
                "doctype": self.doctype + " Advance",
                "reference_type": d.reference_type,
                "reference_name": d.reference_name,
                "reference_row": d.reference_row,
                "remarks": d.remarks,
                "advance_amount": flt(d.amount),
                "allocated_amount": allocated_amount,
                "ref_exchange_rate": flt(d.exchange_rate)  # exchange_rate of advance entry
            }

            self.append("advances", advance_row)