# Copyright (c) 2023, RC and contributors
# For license information, please see license.txt


from __future__ import unicode_literals
import frappe


def execute(filters=None):
	columns = get_columns()
	data = get_data(filters)
	return columns, data


def get_columns():
	columns = [
		{
			"label": "Customer Name",
			"fieldtype": "Data",
			"fieldname": "customer_name",
			"width": 150
		},
		{
			"label": "Sales Order Amount",
			"fieldtype": "Currency",
			"fieldname": "sales_order_amount",
			"width": 150
		},
		{
			"label": "Sales Invoice Amount",
			"fieldtype": "Currency",
			"fieldname": "sales_invoice_amount",
			"width": 150
		},
		{
			"label": "Pending Sales Order Amount",
			"fieldtype": "Currency",
			"fieldname": "pending_sales_order_amount",
			"width": 150
		},
		{
			"label": "Sales Return",
			"fieldtype": "Currency",
			"fieldname": "sales_return",
			"width": 150
		},
		{
			"label": "Payment Received",
			"fieldtype": "Currency",
			"fieldname": "payment_received",
			"width": 150
		},
		{
			"label": "Balance Per S.O.",
			"fieldtype": "Currency",
			"fieldname": "balance_per_so",
			"width": 150
		},
		{
			"label": "Balance Per S.I.",
			"fieldtype": "Currency",
			"fieldname": "balance_per_si",
			"width": 150
		}
	]
	return columns


def get_data(filters):
	salesman_query = ""
	if filters.get('salesman'):
		salesman_query += " and so.owner = '{0}'".format(filters.get('salesman'))

	query = """select foo.customer_name, sum(foo.sales_order_amount) as sales_order_amount,
		sum(sales_invoice_amount) as sales_invoice_amount, sum(sales_return) as sales_return,
		sum(payment_received) as payment_received
		from
			(select so.customer_name, so.grand_total as sales_order_amount,

			(select ifnull(sum(sii.amount), 0)
			from `tabSales Invoice` as si
			inner join `tabSales Invoice Item` as sii on sii.parent=si.name and sii.sales_order=so.name
			where si.sales_order_owner=so.owner and si.customer=so.customer and si.docstatus=1) as sales_invoice_amount,

			(select ifnull(sum(sii.amount), 0)
			from `tabSales Invoice` as si
			inner join `tabSales Invoice Item` as sii on sii.parent=si.name and sii.sales_order=so.name
			where si.sales_order_owner=so.owner and si.customer=so.customer and si.docstatus=1 and si.is_return=1) as sales_return,

			(select ifnull(sum(per.allocated_amount), 0)
			from `tabPayment Entry Reference` as per
			inner join `tabPayment Entry` as pe on per.parent=pe.name and (so.name=per.sales_order or so.name=per.reference_name)
			where pe.docstatus=1) as payment_received

			from `tabSales Order` as so
			where so.docstatus = 1 and so.company = '{0}' and so.transaction_date >= '{1}' and so.transaction_date <= '{2}'
			{3}) as foo
			group by foo.customer_name""".format(filters.get('company'), filters.get('from_date'), filters.get('to_date'), salesman_query)

	result = frappe.db.sql(query, as_dict=True)

	data = []
	for row in result:
		pending_sales_order_amount = (row.sales_order_amount if row.sales_order_amount else 0) - (row.sales_invoice_amount if row.sales_invoice_amount else 0)
		row = {
			"customer_name": row.customer_name,
			"sales_order_amount": row.sales_order_amount,
			"sales_invoice_amount": row.sales_invoice_amount,
			"pending_sales_order_amount": pending_sales_order_amount,
			"sales_return": row.sales_return,
			"payment_received": row.payment_received,
			"balance_per_so": (row.sales_order_amount if row.sales_order_amount else 0) - (row.sales_return if row.sales_return else 0) - (row.payment_received if row.payment_received else 0),
			"balance_per_si": (row.sales_invoice_amount if row.sales_invoice_amount else 0) - (row.sales_return if row.sales_return else 0) - (row.payment_received if row.payment_received else 0)
		}
		data.append(row)

	return data
