# Copyright (c) 2023, RC and contributors
# For license information, please see license.txt


from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.utils import getdate, nowdate

class UnbilledCustomerOrdersReport(object):
	def __init__(self, filters=None):
		self.filters = frappe._dict(filters or {})
		self.filters.from_date = getdate(self.filters.from_date or nowdate())
		self.filters.to_date = getdate(self.filters.to_date or nowdate())

	def run(self):
		if self.filters.from_date > self.filters.to_date:
			frappe.throw(_("From Date must be before To Date"))

		columns = self.get_columns()
		data = self.get_data()
		return columns, data

	def get_columns(self):
		columns = [
			{
				"label": _("Date"),
				"fieldtype": "Date",
				"fieldname": "posting_date",
				"width": 150
			},
			{
				"label": _("Voucher Type"),
				"fieldtype": "Data",
				"fieldname": "voucher_type",
				"width": 200
			},
			{
				"label": _("Voucher"),
				"fieldtype": "Data",
				"fieldname": "voucher_no",
				"width": 220
			},
			{
				"label": _("Return Voucher No"),
				"fieldtype": "Link",
				"fieldname": "return_voucher_no",
				"options": "Sales Invoice",
				"width": 220
			},
			{
				"label": _("Debit"),
				"fieldtype": "Currency",
				"fieldname": "debit",
				"width": 150
			},
			{
				"label": _("Credit"),
				"fieldtype": "Currency",
				"fieldname": "credit",
				"width": 150
			},
			{
				"label": _("Balance"),
				"fieldtype": "Currency",
				"fieldname": "balance",
				"width": 150
			}
		]

		return columns

	def get_data(self):
		return self.get_gl_entries()

	def get_gl_entries(self):
		data = []
		total_debit = total_credit = 0

		opening_balance = frappe._dict({
			"posting_date": self.filters.from_date,
			"voucher_type": "Opening Balance",
			"voucher_no": "",
			"return_voucher_no": "",
			"debit": 0.0,
			"credit": 0.0,
			"balance": 0.0
		})
		ledger_rows = []
		closing_balance = frappe._dict({
			"posting_date": self.filters.to_date,
			"voucher_type": "Closing Balance",
			"voucher_no": "",
			"return_voucher_no": "",
			"debit": 0.0,
			"credit": 0.0,
			"balance": 0.0
		})
		self.gl_entries = frappe.db.sql("""
				select
					posting_date, voucher_type, voucher_no,
					if(sum(debit-credit) > 0, sum(debit-credit), 0) as debit,
					if(sum(debit-credit) < 0, -sum(debit-credit), 0) as credit,
					GROUP_CONCAT(DISTINCT against_voucher_type SEPARATOR ', ') as against_voucher_type,
					GROUP_CONCAT(DISTINCT against_voucher SEPARATOR ', ') as against_voucher
				from
					`tabGL Entry`
				where
					docstatus < 2 and party_type='Customer' and party = %(customer)s and posting_date < %(from_date)s
					and company = %(company)s and voucher_type != 'Sales Invoice'
					and is_cancelled = 0
				group by voucher_type, voucher_no
				order by posting_date""", self.filters, as_dict=True)

		for gle in self.gl_entries:
			opening_balance.debit += gle.debit
			opening_balance.credit += gle.credit
			total_debit += gle.debit
			total_credit += gle.credit

		opening_debit_data = frappe.db.sql("""select
				ifnull(sum(ABS(rounded_total)),0)
				from `tabSales Order`
				where docstatus = 1
				and customer = %(customer)s
				and company = %(company)s
				and docstatus = 1
				and status != 'Closed'
				and transaction_date < %(from_date)s""", self.filters)[0][0]

		opening_balance.debit += opening_debit_data
		total_debit += opening_debit_data

		opening_credit_data = frappe.db.sql("""select
				ifnull(sum(ABS(si.rounded_total)),0) as credit
				from `tabSales Order` as so
				inner join `tabSales Invoice` as si on si.name in (select distinct parent from `tabSales Invoice Item` where sales_order = so.name) and si.is_return = 1 and si.docstatus = 1
				where so.docstatus = 1
				and so.customer = %(customer)s
				and so.company = %(company)s
				and so.status != 'Closed'
				and  so.transaction_date < %(from_date)s""", self.filters)[0][0]

		opening_balance.credit += opening_credit_data
		total_credit += opening_credit_data

		sales_inv_gl = frappe.db.sql("""select
				transaction_date as posting_date,
				'Sales Order' as voucher_type,
				name as voucher_no,
				null as return_voucher_no,
				owner,
				sum(ABS(rounded_total)) as debit ,0 as credit, 0 as balance
				from `tabSales Order`
				where docstatus = 1
				and customer = %(customer)s
				and company = %(company)s
				and transaction_date >= %(from_date)s
				and transaction_date <= %(to_date)s
				and status != 'Closed'
				group by transaction_date,name,voucher_type,owner,return_voucher_no
				order by transaction_date, name""", self.filters, as_dict=True)

		for res in sales_inv_gl:
			if res.get('debit'):
				total_debit += res.get('debit')
			if res.get('credit'):
				total_credit += res.get('credit')

		r_sales_inv_gl1 = frappe.db.sql("""select si.posting_date as posting_date,
				so.name as voucher_no,
				so.owner,
				'Return' as voucher_type,
				si.name as return_voucher_no,
				0 as debit,
				sum(ABS(si.rounded_total)) as credit,
				0 as balance
				from `tabSales Order` as so
				inner join `tabSales Invoice` as si on si.name in (select distinct parent from `tabSales Invoice Item` where sales_order = so.name) and si.is_return = 1 and si.docstatus = 1
				where so.docstatus = 1
				and so.customer = %(customer)s
				and so.transaction_date >= %(from_date)s
				and so.transaction_date <= %(to_date)s
				and so.company = %(company)s
				and so.status != 'Closed'
				group by so.transaction_date,so.name,voucher_type,so.owner,si.name
				order by so.transaction_date,so.name """, self.filters, as_dict=True)

		for res in r_sales_inv_gl1:
			if res.get('debit'):
				total_debit += res.get('debit')
			if res.get('credit'):
				total_credit += res.get('credit')

		payment_ent_gl = frappe.db.sql("""select
			null as posting_date, gl.voucher_type, gl.voucher_no,null as return_voucher_no,
			if(sum(gl.debit-gl.credit) > 0, sum(gl.debit-gl.credit), 0) as debit,
			if(sum(gl.debit-gl.credit) < 0, -sum(gl.debit-gl.credit), 0) as credit,
			GROUP_CONCAT(DISTINCT gl.name SEPARATOR ', ') as name,
			0 as balance
			from
			`tabGL Entry` as gl
			inner join `tabPayment Entry` as si on si.name = gl.voucher_no
			where
			gl.docstatus < 2 and gl.party_type='Customer' and gl.party = %(customer)s
			and gl.posting_date >= %(from_date)s
			and gl.posting_date <= %(to_date)s
			and gl.company = %(company)s
			and gl.voucher_type = 'Payment Entry'
			and gl.is_cancelled = 0
			group by gl.voucher_type,gl.voucher_no,return_voucher_no
			order by gl.posting_date""", self.filters, as_dict=True)
		for res in payment_ent_gl:
			if res.get('debit'):
				total_debit += res.get('debit')
			if res.get('credit'):
				total_credit += res.get('credit')
			if res.get('name'):
				split_name_lst = (res.get('name')).split(",")
				if split_name_lst:
					gl = frappe.get_doc("GL Entry", split_name_lst[0])
					res['posting_date'] = gl.posting_date

		other_entry = frappe.db.sql("""select
				posting_date, voucher_type, voucher_no,null as return_voucher_no,
				if(sum(debit-credit) > 0, sum(debit-credit), 0) as debit,
				if(sum(debit-credit) < 0, -sum(debit-credit), 0) as credit,
				0 as balance
				from
				`tabGL Entry`
				where
				docstatus < 2 and party_type='Customer' and party = %(customer)s
				and posting_date >= %(from_date)s
				and posting_date <= %(to_date)s
				and company = %(company)s
				and voucher_type not in ('Payment Entry', 'Sales Invoice')
				and is_cancelled = 0
				group by voucher_type, voucher_no,return_voucher_no
				order by posting_date""", self.filters, as_dict=True)

		for res in other_entry:
			if res.get('credit'):
				total_credit += res.get('credit')
			if res.get('debit'):
				total_debit += res.get('debit')

		closing_balance.debit += total_debit
		closing_balance.credit += total_credit

		data.append(opening_balance)

		if sales_inv_gl:
			data.extend(sales_inv_gl)
		if r_sales_inv_gl1:
			data.extend(r_sales_inv_gl1)
		if payment_ent_gl:
			data.extend(payment_ent_gl)
		if other_entry:
			data.extend(other_entry)

		# data.append(closing_balance)
		frappe.db.commit()
		frappe.db.sql("DROP TABLE IF EXISTS `so report`")
		frappe.db.sql("""CREATE TABLE `so report`(
				posting_date DATE,
				voucher_type varchar(100),
				voucher_no varchar(100),
				return_voucher_no varchar(100),
				debit DOUBLE,
				credit DOUBLE,
				balance DOUBLE)""")
		for res in data:
			frappe.db.sql("""INSERT INTO `so report` VALUES(%(posting_date)s, %(voucher_type)s, %(voucher_no)s, %(return_voucher_no)s, %(debit)s, %(credit)s, %(balance)s)""",res)
		dd = frappe.db.sql("""select * from `so report` order by posting_date""", as_dict=True)
		dd.append(closing_balance)
		self.calculate_running_total(dd)
		return dd
		# return data

	def calculate_running_total(self, data):
		for i, d in enumerate(data):
			d.balance = d.debit - d.credit
			if i > 0 and d.voucher_type != 'Closing Balance':
				prev_row = data[i - 1]
				d.balance += prev_row.balance


def execute(filters=None):
	return UnbilledCustomerOrdersReport(filters).run()
