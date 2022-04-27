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
			"fieldname": "id",
			"fieldtype": "Link",
			"label": "ID",
			"options": "Sales Order",
			"width": 90
		},
		{
			"fieldname": "salesman",
			"fieldtype": "Data",
			"label": "Salesman",
			"width": 200
		},
		{
			"fieldname": "customer",
			"fieldtype": "Link",
			"label": "Customer",
			"options": "Customer",
			"width": 100
		},
		{
			"fieldname": "customer_name",
			"fieldtype": "Data",
			"label": "Customer Name",
			"width": 200
		},
		{
			"fieldname": "date",
			"fieldtype": "Date",
			"label": "Date",
			"width": 100
		},
		{
			"fieldname": "total",
			"fieldtype": "Currency",
			"label": "Total",
			"width": 120
		},
		{
			"fieldname": "payment",
			"fieldtype": "Currency",
			"label": "Payment",
			"width": 120
		},
		{
			"fieldname": "returns",
			"fieldtype": "Currency",
			"label": "Returns",
			"width": 120
		},
		{
			"fieldname": "pending",
			"fieldtype": "Currency",
			"label": "Pending",
			"width": 120
		},
		{
			"fieldname": "status",
			"fieldtype": "Data",
			"label": "Status",
			"width": 120
		},
		{
			"fieldname": "delivery_status",
			"fieldtype": "Data",
			"label": "Delivery",
			"width": 120
		},
		{
			"fieldname": "billing",
			"fieldtype": "Data",
			"label": "Billing",
			"width": 120
		},
		{
			"fieldname": "delivered",
			"fieldtype": "Data",
			"label": "Delivered",
			"width": 120
		},
		{
			"fieldname": "billed_percent",
			"fieldtype": "Data",
			"label": "Billed Percent",
			"width": 120
		},
		{
			"fieldname": "owner",
			"fieldtype": "Data",
			"label": "Owner",
			"width": 120
		},
		{
			"fieldname": "allow_delivery",
			"fieldtype": "Check",
			"label": "Allow Delivery",
			"width": 100
		},
		{
			"fieldname": "delivery_comments",
			"fieldtype": "Data",
			"label": "Delivery Comments",
			"width": 200
		}
	]
	return columns

def get_data(filters):
	customer_filter = ""
	if not (filters.get("customer_group")):
		frappe.throw(_("Please set Customer Group First"))
	else:
		customer_filter = """ and customer_group in (select name from `tabCustomer Group`
				where lft>=(select lft from `tabCustomer Group` where name = '{0}')
				and rgt<=(select rgt from `tabCustomer Group` where name = '{0}' ))""".format(filters.get("customer_group"))

	query = """select
		so.name,
		so.customer,
		so.customer_name,
		so.transaction_date,
		so.rounded_total,

		(select
		sum(per.allocated_amount)
		from `tabPayment Entry` as pe
		left join `tabPayment Entry Reference` per on per.parent = pe.name
		where pe.docstatus=1 and per.sales_order = so.name
		group by per.sales_order) as payment,
		
		(select
		sum(si2.rounded_total)
		from `tabSales Invoice` as si2
		where si2.docstatus=1 and si2.is_return=1 and si2.cust_sales_order_number = so.name
		group by si2.cust_sales_order_number) as returns,

		so.status,
		so.delivery_status,
		so.billing_status,
		so.per_delivered,
		so.per_billed,
		so.owner,
		so.allow_delivery,
		so.delivery_approval_comments

		from `tabSales Order` as so
		where so.docstatus = 1 and so.status != 'Closed' {0}""".format(customer_filter)

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
			"id": row.name,
			"salesman": frappe.db.get_value('User', {'email': row.owner}, 'full_name'),
			"customer": row.customer,
			"customer_name": row.customer_name,
			"date": row.transaction_date,
			"total": row.rounded_total,
			"payment": row.payment,
			"returns": row.returns,
			"pending": (row.rounded_total if row.rounded_total else 0) - (-(row.returns) if row.returns else 0) - (row.payment if row.payment else 0),
			"status": row.status,
			"delivery_status": row.delivery_status,
			"billing": row.billing_status,
			"delivered": row.per_delivered,
			"billing_percent": row.per_billed,
			"owner": row.owner,
			"allow_delivery": row.allow_delivery,
			"delivery_comments": row.delivery_approval_comments
		}
		data.append(row)
	return data