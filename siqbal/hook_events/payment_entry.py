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
