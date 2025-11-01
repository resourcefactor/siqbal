# Copyright (c) 2013, RC and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _

def execute(filters=None):
	if not filters: 
		filters = {}
	
	# Set default dates if not provided
	if not filters.get('fdate'):
		filters['fdate'] = frappe.utils.today()
	if not filters.get('tdate'):
		filters['tdate'] = frappe.utils.today()
	
	columns = get_columns()
	data = get_data(filters)
	return columns, data

def get_data(filters):
	# Validate that company is provided
	if not filters.get('company'):
		frappe.throw(_("Please select a Company"))
	
	return frappe.db.sql("""
		SELECT
			tsm.cost_center,
			tsm.salesman,
			IFNULL(tso.rounded_total, 0) as gross_sale,
			IFNULL(tco.canceld_sale, 0) as canceled_sale,
			IFNULL(tsr.sales_return, 0) as sales_return,
			IFNULL(osr.old_system_return, 0) as old_system_return,
			(IFNULL(tso.rounded_total, 0) - IFNULL(tsr.sales_return, 0) - IFNULL(osr.old_system_return, 0)) as net_sale,
			IFNULL(tso.cash_sale, 0) as cash_sale,
			IFNULL(tso.credit_sale, 0) as credit_sale,
			IFNULL(per.recovery, 0) as recovery
		FROM (
			SELECT name as salesman, user_costcenter as cost_center 
			FROM tabUser 
			WHERE user_warehouse IN (
				SELECT name FROM `tabWarehouse` WHERE company = %(company)s
			)
		) as tsm
		LEFT JOIN (
			SELECT 
				sum(rounded_total) as rounded_total,
				sum(advance_paid) as advance_paid,
				sum(IF(customer_group = "Cash Customer", rounded_total, 0)) as cash_sale,
				sum(IF(customer_group = "Credit Customer", rounded_total, 0)) as credit_sale,
				owner
			FROM `tabSales Order` 
			WHERE docstatus = 1 
				AND company = %(company)s 
				AND transaction_date >= %(fdate)s 
				AND transaction_date <= %(tdate)s 
			GROUP BY owner
		) tso ON tsm.salesman = tso.owner
		LEFT JOIN (
			SELECT cost_center, owner, sum(rounded_total) as canceld_sale 
			FROM `tabSales Order` 
			WHERE docstatus = 2 
				AND DATE(modified) >= %(fdate)s 
				AND DATE(modified) <= %(tdate)s 
			GROUP BY owner
		) tco ON tsm.salesman = tco.owner
		LEFT JOIN (
			SELECT tc.cost_center, sales_order_owner, ABS(sum(tsi.net_amount)) as sales_return 
			FROM `tabSales Invoice` tc 
			INNER JOIN `tabSales Invoice Item` tsi ON tc.name = tsi.parent 
			WHERE is_return = 1 
				AND tc.docstatus = 1 
				AND company = %(company)s 
				AND tc.posting_date >= %(fdate)s 
				AND tc.posting_date <= %(tdate)s 
			GROUP BY tc.sales_order_owner
		) tsr ON tsm.salesman = tsr.sales_order_owner
		LEFT JOIN (
			SELECT '', cust_sales_order_owner, ABS(sum(rounded_total)) as old_system_return 
			FROM `tabPurchase Receipt` tpi 
			WHERE tpi.docstatus = 1 
				AND company = %(company)s 
				AND tpi.posting_date >= %(fdate)s 
				AND tpi.posting_date <= %(tdate)s 
			GROUP BY tpi.cust_sales_order_owner
		) osr ON tsm.salesman = osr.cust_sales_order_owner
		LEFT JOIN (
			SELECT '', cust_sales_order_owner, sum(allocated_amount) as recovery 
			FROM `tabPayment Entry Reference` tper 
			INNER JOIN `tabPayment Entry` tpe ON tper.parent = tpe.name 
			WHERE tpe.docstatus = 1 
				AND tpe.posting_date >= %(fdate)s 
				AND tpe.posting_date <= %(tdate)s 
			GROUP BY tper.cust_sales_order_owner
		) as per ON tsm.salesman = per.cust_sales_order_owner 
		ORDER BY tsm.cost_center, tsm.salesman;
	""", filters, as_dict=False)

def get_columns():
	"""return columns"""
	columns = [
		_("Branch") + ":Link/Cost Center:150",
		_("Salesman") + ":Link/User:150",
		_("Gross Sale") + ":Currency:100",
		_("Canceld Sale") + ":Currency:100",
		_("Sales Return") + ":Currency:100",
		_("Old Sys Return") + ":Currency:100",
		_("Net Sale") + ":Currency:100",
		_("Cash Sale") + ":Currency:100",
		_("Credit Sale") + ":Currency:100",
		_("Recovery") + ":Currency:100",
	]
	return columns