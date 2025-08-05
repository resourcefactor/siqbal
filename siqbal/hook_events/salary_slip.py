import frappe
from frappe.utils import get_first_day, get_last_day, flt

from hrms.payroll.doctype.salary_slip.salary_slip_loan_utils import _get_loan_details



def fetch_scheduled_employee_loans(doc, method):
	from lending.loan_management.doctype.loan_repayment.loan_repayment import calculate_amounts

	doc.total_loan_repayment = 0
	doc.total_interest_amount = 0
	doc.total_principal_amount = 0

	if not doc.get("loans", []):
		loan_details = _get_loan_details(doc)

		for loan in loan_details:
			amounts = calculate_amounts(loan.name, doc.end_date, "Regular Payment")

			if amounts["interest_amount"] or amounts["payable_principal_amount"]:
				doc.append(
					"loans",
					{
						"loan": loan.name,
						"total_payment": amounts["interest_amount"] + amounts["payable_principal_amount"],
						"interest_amount": amounts["interest_amount"],
						"principal_amount": amounts["payable_principal_amount"],
						"loan_account": loan.loan_account,
						"interest_income_account": loan.interest_income_account,
					},
				)
	if not doc.get("loans"):
		doc.set("loans", [])

	for payment in doc.get("loans", []):
		amounts = calculate_amounts(payment.loan, doc.end_date, "Regular Payment")
		total_amount = amounts["interest_amount"] + amounts["payable_principal_amount"]
		if payment.total_payment > total_amount:
			frappe.throw(
				_(
					"""Row {0}: Paid amount {1} is greater than pending accrued amount {2} against loan {3}"""
				).format(
					payment.idx,
					frappe.bold(payment.total_payment),
					frappe.bold(total_amount),
					frappe.bold(payment.loan),
				)
			)

		doc.total_interest_amount += payment.interest_amount
		doc.total_principal_amount += payment.principal_amount
		doc.total_loan_repayment += payment.total_payment

