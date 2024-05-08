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

	g_total_opening_balance_col_3, g_total_received_col_4, g_total_paid_col_5, g_total_closing_balance_col_6 = 0, 0, 0, 0
	# account_type = ''
	for k in item_details.keys():
		total_opening_balance_col_3, total_received_col_4, total_paid_col_5, total_closing_balance_col_6 = 0, 0, 0, 0
		for d in item_details[k]['details']:
			total_opening_balance_col_3 += float(d['opening_balance']) if d['opening_balance'] else 0
			total_received_col_4 += float(d['total_received']) if d['total_received'] else 0
			total_paid_col_5 += float(d['total_paid']) if d['total_paid'] else 0
			total_closing_balance_col_6 += float(d['closing_balance']) if d['closing_balance'] else 0
			# account_type = d['account_type']
			# if account_type != 'Fabric':
			g_total_opening_balance_col_3 += float(d['opening_balance']) if d['opening_balance'] else 0
			g_total_received_col_4 += float(d['total_received']) if d['total_received'] else 0
			g_total_paid_col_5 += float(d['total_paid']) if d['total_paid'] else 0
			g_total_closing_balance_col_6 += float(d['closing_balance']) if d['closing_balance'] else 0
			datas.append(d)
		datas.append({'account': None, 'account_type': '<b> Total </b>', 'opening_balance': total_opening_balance_col_3, 'total_received': total_received_col_4, 'total_paid': total_paid_col_5, 'closing_balance': total_closing_balance_col_6})
	datas.append({'account': None, 'account_type': '<b>Grand Total</b>', 'opening_balance': g_total_opening_balance_col_3, 'total_received': g_total_received_col_4, 'total_paid': g_total_paid_col_5, 'closing_balance': g_total_closing_balance_col_6})

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
			"label": "Opening Balance",
			"fieldtype": "Currency",
			"fieldname": "opening_balance",
			"width": 150
		},
		{
			"label": "Total Received",
			"fieldtype": "Currency",
			"fieldname": "total_received",
			"width": 150
		},
		{
			"label": "Total Paid",
			"fieldtype": "Currency",
			"fieldname": "total_paid",
			"width": 150
		},
		{
			"label": "Closing Balance",
			"fieldtype": "Currency",
			"fieldname": "closing_balance",
			"width": 150
		}
	]
	return columns


def get_data(filters):
	data = []
	if not filters.get('account_type'):
		accounts_list = frappe.db.get_list("Account", {"disabled": 0, "account_type": ["in", ["Bank", "Cash"]]}, ["name", "account_type"], order_by="account_type",)
	else:
		accounts_list = frappe.db.get_list("Account", {"disabled": 0, "account_type": filters.get('account_type')}, ["name", "account_type"], order_by="account_type",)

	for account in accounts_list:
		query = """select
					(
						select sum(debit-credit)
						from `tabGL Entry` as gle1
						where gle1.is_cancelled = 0
						and gle1.posting_date < '{0}' and gle1.account = '{2}'
					) as opening_balance,
					(
						select sum(debit-credit)
						from `tabGL Entry` as gle2
						where gle2.is_cancelled = 0
						and gle2.posting_date <= '{1}' and gle2.account = '{2}'
					) as closing_balance,
					sum(debit) as total_received,
					sum(credit) as total_paid
				from `tabGL Entry` as gle
				where gle.is_cancelled = 0
				and gle.posting_date >= '{0}' and gle.posting_date <= '{1}'
				and gle.account = '{2}'
			""".format(filters.get('from_date'), filters.get('to_date'), account.name)

		result = frappe.db.sql(query, as_dict=True)

		for row in result:
			if row.opening_balance or row.total_received or row.total_paid or row.closing_balance:
				row = {
					"account": account.name,
					"account_type": account.account_type,
					"opening_balance": row.opening_balance,
					"total_received": row.total_received,
					"total_paid": row.total_paid,
					"closing_balance": row.closing_balance,
				}
				data.append(row)
	return data
