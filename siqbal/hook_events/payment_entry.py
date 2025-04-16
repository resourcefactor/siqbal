import frappe
from frappe import _


def validate_sales_order(pe, method):
    for reference in pe.references:
        if reference.reference_doctype in ["Sales Invoice", "Sales Order"]:
            so = None
            if reference.reference_doctype == "Sales Invoice":
                so = frappe.db.get_value("Sales Invoice", reference.reference_name, "cust_sales_order_number")
            elif reference.reference_doctype == "Sales Order":
                so = reference.reference_name
            if reference.sales_order != so:
                reference.sales_order = so
                if method == 'on_update_after_submit':
                    reference.db_update()


def validate_salaryslip_amount(pe, method):
    if pe.salary_slip_id:
        rounded_total = frappe.db.get_value("Salary Slip", pe.salary_slip_id, "rounded_total")
        total_paid_amount = frappe.db.get_value("Payment Entry", {"salary_slip_id": pe.salary_slip_id, "docstatus": 1}, "sum(paid_amount)")
        if rounded_total < pe.paid_amount:
            frappe.throw(_("Payment cannot Excceed from Salary Slip Amount {0}").format(rounded_total))
        if rounded_total < (pe.paid_amount + (total_paid_amount if total_paid_amount else 0)):
            frappe.throw(_("Payment cannot Excceed from Salary Slip Amount {0}").format(rounded_total))


def update_salaryslip_status(pe, method):
    if pe.salary_slip_id:
        total_paid_amount = frappe.db.get_value("Payment Entry", {"salary_slip_id": pe.salary_slip_id, "docstatus": 1}, "sum(paid_amount)")
        if method == "on_submit":
            total_salary = frappe.db.get_value("Salary Slip", pe.salary_slip_id, "rounded_total")
            if (total_salary if total_salary else 0) == (total_paid_amount if total_paid_amount else 0):
                slipsatus = "Paid"
            else:
                slipsatus = "Partial Paid"
        elif method == "on_cancel":
            if total_paid_amount:
                slipsatus = "Partial Paid"
            else:
                slipsatus = "Not Paid"
        frappe.db.sql("""update `tabSalary Slip` set payment_status =%s
                where name=%s""", (slipsatus, pe.salary_slip_id))


def update_sales_order_name(pe, method):
    for ref in pe.references:
        if ref.sales_order:
            so_owner = frappe.db.get_value("Sales Order", ref.sales_order, "owner")
            if so_owner:
                ref.cust_sales_order_owner = so_owner
        ref.db_update()



# Dynamically create payment entry against payment entry

def create_payment_entry_against_payment_entry(self, method):
    ts_settings = frappe.get_single("SIqbal Settings")
    mode_of_payment = frappe.db.get_value(
        "Supplier Payment", {"company": self.company}, "mode_of_payment"
    )

    # if self.payment_type == "Receive" and (
    # 	mode_of_payment and mode_of_payment == self.mode_of_payment
    # ):
    if ts_settings.enable_direct_transfer_to_supplier:
        # Get account from Mode of Payment
        paid_from_account = frappe.db.get_value(
            "Mode of Payment Account",
            {"parent": mode_of_payment, "company": self.company},
            "default_account",
        )

        if not paid_from_account:
            frappe.throw(
                _(
                    "No default account set for Mode of Payment {0} in company {1}"
                ).format(mode_of_payment, self.company)
            )

        account_currency = frappe.db.get_value(
            "Account", paid_from_account, "account_currency"
        )
        pe = frappe.new_doc("Payment Entry")
        print("===========================0", pe.payment_type_ts)
        pe.company = self.company
        pe.posting_date = self.posting_date
        pe.mode_of_payment = mode_of_payment
        pe.payment_type = "Pay"
        pe.party_type = "Supplier"
        pe.party_type_ts = "Supplier"
        pe.party = self.payment_supplier
        pe.reference_no = self.reference_no
        pe.reference_date = self.reference_date
        pe.remarks = self.remarks
        pe.supplier_payment_entry = self.name
        pe.paid_amount = self.paid_amount
        pe.received_amount = self.received_amount
        pe.source_exchange_rate = self.source_exchange_rate
        pe.party_account = None
        pe.party_account_field = None

        pe.paid_from = paid_from_account
        pe.paid_from_account_currency = account_currency

        # fpe.insert(ignore_permissions=True)
        pe.set_missing_values()
        print("pe", pe)
        pe.save(ignore_permissions=True)
        pe.submit()
