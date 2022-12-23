# -*- coding: utf-8 -*-
# Copyright (c) 2020, RC and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from ts.utils import get_total_item_qty
from frappe import _


class SalesOrderUpdation(Document):
	pass


@frappe.whitelist()
def update_sales_order(order_id=None):
	if order_id:
		sale_order = frappe.get_doc("Sales Order", order_id)
		for res in sale_order.items:
			total_qty = get_total_item_qty(sale_order.company, res.item_code)
			total_qty = round(total_qty, 3)
			auth_limits = frappe.get_list("Authorization Rule", filters={'master_name': res.item_group}, fields="*")
			for a in auth_limits:
				if 'Sales Manager' in a.approving_role and a.value and not res.sales_manager_limit:
					frappe.db.sql("""UPDATE `tabSales Order Item` SET sales_manager_limit = {0} WHERE name = '{1}'""".format(a.value, res.name))
				if 'Director' in a.approving_role and a.value and not res.director_limit:
					frappe.db.sql("""UPDATE `tabSales Order Item` SET director_limit = {0} WHERE name = '{1}'""".format(a.value, res.name))
			if not res.price_list_rate:
				p_rate = frappe.db.sql("select price_list_rate from `tabItem Price` where price_list = %s and selling = 1 and item_code = %s order by valid_from desc limit 1", (sale_order.selling_price_list, res.item_code), as_dict=True)
				for p in p_rate:
					price_list_rate = 0
					if p.get('price_list_rate'):
						price_list_rate = p.get('price_list_rate')
					discount_percentage = round((1 - res.rate / price_list_rate) * 100.0, 3)
					discount_amount = price_list_rate - res.rate
					frappe.msgprint(_("{0} - {1} - {2}").format(price_list_rate, discount_percentage, discount_amount))
					frappe.db.sql("""UPDATE `tabSales Order Item` SET price_list_rate = {0}, discount_percentage = {1}, discount_amount = {2}, total_qty = {3} WHERE name = '{4}'""".format(price_list_rate, discount_percentage, discount_amount, total_qty, res.name))
