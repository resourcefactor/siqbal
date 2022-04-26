import frappe
from frappe.utils import flt, cint
from erpnext.accounts.doctype.purchase_invoice.purchase_invoice import PurchaseInvoice

class OverridePurchaseInvoice(PurchaseInvoice):

    @frappe.whitelist()
    def validate_accepted_rejected_qty(self):
        pass