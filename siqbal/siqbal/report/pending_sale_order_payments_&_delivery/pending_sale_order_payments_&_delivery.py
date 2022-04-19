# Copyright (c) 2022, RC and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _, _dict

def execute(filters=None):
	columns = get_columns()
	data = get_data(filters)
	return columns, data

def get_columns():
	columns = [
		{
			"fieldname": "date",
			"fieldtype": "Date",
			"label": "Date",
			"options": "Sales Order",
			"width": 90
		},
		{
			"fieldname": "so_no",
			"fieldtype": "Link",
			"label": "SO No.",
			"options": "Sales Order",
			"width": 90
		},
		{
			"fieldname": "customer_name",
			"fieldtype": "Data",
			"label": "Customer Name",
			"width": 200
		},
		{
			"fieldname": "order_amount",
			"fieldtype": "Currency",
			"label": "Order Amount",
			"width": 120
		},
		{
			"fieldname": "delivery_amount",
			"fieldtype": "Currency",
			"label": "Delivery Amount",
			"width": 120
		},
		{
			"fieldname": "return_amount",
			"fieldtype": "Currency",
			"label": "Return Amount",
			"width": 120
		},
		{
			"fieldname": "payment",
			"fieldtype": "Currency",
			"label": "Payment",
			"width": 120
		},
		{
			"fieldname": "pending_payment",
			"fieldtype": "Currency",
			"label": "Pending Payment",
			"width": 120
		},
		{
			"fieldname": "pending_delivery",
			"fieldtype": "Currency",
			"label": "Pending Delivery",
			"width": 120
		}
	]
	return columns

def get_data(filters):
	query = """select
		so.transaction_date,
		so.name,
		so.customer_name,
		so.rounded_total,
		
		(select
		sum(si1.rounded_total)
		from `tabSales Invoice` as si1
		where si1.docstatus=1 and si1.cust_sales_order_number = so.name
		group by si1.cust_sales_order_number) as rounded_total_si,
		
		(select
		sum(si2.rounded_total)
		from `tabSales Invoice` as si2
		where si2.docstatus=1 and si2.is_return=1 and si2.cust_sales_order_number = so.name
		group by si2.cust_sales_order_number) as return_amount,

		so.advance_paid
		from `tabSales Order` as so
		where so.docstatus = 1 and so.status != 'Closed'"""

	if filters.get('from_date'):
		query += " and so.transaction_date >= '{0}'".format(filters.get('from_date'))

	if filters.get('to_date'):
		query += " and so.transaction_date <= '{0}'".format(filters.get('to_date'))

	if filters.get('created_by'):
		query += " and so.owner = '{0}'".format(filters.get('created_by'))

	result = frappe.db.sql(query,as_dict=True)
	data = []
	for row in result:
		row = {
			"date": row.transaction_date,
			"so_no": row.name,
			"customer_name": row.customer_name,
			"order_amount": row.rounded_total,
			"delivery_amount": row.rounded_total_si,
			"return_amount": row.return_amount,
			"payment": row.advance_paid,
			"pending_payment": (row.rounded_total_si if row.rounded_total_si else 0) - (-(row.return_amount) if row.return_amount else 0) - (row.advance_paid if row.advance_paid else 0),
			"pending_delivery": (row.rounded_total if row.rounded_total else 0) - (row.rounded_total_si if row.rounded_total_si else 0) - (-(row.return_amount) if row.return_amount else 0)
		}
		data.append(row)
	return data