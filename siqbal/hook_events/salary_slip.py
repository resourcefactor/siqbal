import frappe
from frappe.utils import getdate



@frappe.whitelist()
def get_employee_loan_repayments(employee, start_date, end_date):
    loans = frappe.get_all("Loan",
        filters={
            "applicant_type": "Employee",
            "applicant": employee,
            "repayment_start_date": ["<=", getdate(end_date)],
            "status": "Disbursed",
            "docstatus": 1
        },
        fields=["name", "monthly_repayment_amount", "loan_type"]
    )

    repayments = []
    for loan in loans:
        repayments.append({
            "salary_component": "Loan Repayment",
            "amount": loan.monthly_repayment_amount,
            "loan": loan.name
        })

    return repayments
    