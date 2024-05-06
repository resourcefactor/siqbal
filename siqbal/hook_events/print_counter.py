from __future__ import unicode_literals
import frappe


@frappe.whitelist()
def update_print_no(doc):
	old_count = 0
	if doc.print_count:
		old_count = doc.print_count
	count = old_count + 1
	print("count", count)
	frappe.db.sql("""UPDATE `tabSales Order` SET `print_count` = {0} WHERE name = '{1}'""".format(count, doc.name))
	frappe.db.commit()
	return count
