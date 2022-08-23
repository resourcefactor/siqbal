import frappe
from frappe.desk.form.linked_with import get_linked_doctypes

def update_rename_company_data():
	old_company_name = 'S Iqbal Home'
	new_company_name = 'S Iqbal Tiles'
	linked_doc_info = get_linked_doctypes('Company')
	# print("--------",linked_doc_info)
	if linked_doc_info:
		for key in linked_doc_info.keys():
			doctype = key
			if 'child_doctype' in linked_doc_info[key].keys():
				doctype = linked_doc_info[key]['child_doctype']
			if frappe.db.exists("DocType", doctype) and not frappe.db.get_value("DocType", doctype,'issingle'):
				for field in linked_doc_info[key]['fieldname']:
					frappe.db.sql("""UPDATE `tab{0}` set {1}='{2}'
									WHERE {3}='{4}'""".format(doctype, field, new_company_name,
															  field, old_company_name))
				print(f"updated {doctype} company data")
		frappe.db.sql("""UPDATE `tabCompany` set name='{0}' WHERE name='{1}'""".format(new_company_name,old_company_name))
		frappe.db.sql("""UPDATE `tabStock Ledger Entry` set company='{0}' WHERE company='{1}'""".format(new_company_name,old_company_name))
		print("updated Stock Ledger Entry company data")
		frappe.db.sql("""UPDATE `tabGL Entry` set company='{0}' WHERE company='{1}'""".format(new_company_name,old_company_name))
		print("updated GL Entry company data")