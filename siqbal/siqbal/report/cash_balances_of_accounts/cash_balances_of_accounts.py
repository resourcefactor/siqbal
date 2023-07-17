# Copyright (c) 2023, RC and contributors
# For license information, please see license.txt


from __future__ import unicode_literals
import frappe


def execute(filters=None):
	columns = get_columns()
	data = get_data(filters)
	datas = []
	item_details = {}
	for d in data:
		key = (d['account_type'])
		item_details.setdefault(key, {"details": []})
		fifo_queue = item_details[key]["details"]
		fifo_queue.append(d)

	g_total_col_3 = 0
	account_type = ''
	for k in item_details.keys():
		total_col_3 = 0
		for d in item_details[k]['details']:
			total_col_3 += float(d['balance_amount'])
			account_type = d['account_type']
			if account_type != 'Fabric':
				g_total_col_3 += float(d['balance_amount'])
			datas.append(d)
		datas.append({'account': None, 'account_type': '<b> Total </b>', 'balance_amount': total_col_3})
	datas.append({'account': None, 'account_type': '<b>Grand Total</b>', 'balance_amount': g_total_col_3})

	return columns, datas


def get_columns():
	columns = [
		{
			"label": "Account",
			"fieldtype": "Link",
			"fieldname": "account",
			"options": "Account",
			"width": 150,
		},
		{
			"label": "Account Type",
			"fieldtype": "Data",
			"fieldname": "account_type",
			"width": 150
		},
		{
			"label": "Balance Amount",
			"fieldtype": "Currency",
			"fieldname": "balance_amount",
			"width": 150
		}
	]
	return columns


def get_data(filters):
	data = []
	accounts_list = frappe.db.get_list("Account", {"disabled": 0, "account_type": ["in", ["Bank", "Cash"]]}, ["name", "account_type"], order_by="account_type",)
	for account in accounts_list:
		query = """select
				sum(debit-credit) as balance_amount
				from `tabGL Entry` as gle
				where gle.is_cancelled = 0
				and gle.posting_date <= '{0}' and gle.account = '{1}'
			""".format(filters.get('date'), account.name)

		result = frappe.db.sql(query, as_dict=True)

		for row in result:
			if row.balance_amount and row.balance_amount != 0:
				row = {
					"account": account.name,
					"account_type": account.account_type,
					"balance_amount": row.balance_amount
				}
				data.append(row)

	return data
