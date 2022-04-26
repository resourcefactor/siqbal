// Copyright (c) 2022, RC and contributors
// For license information, please see license.txt
/* eslint-disable */

frappe.query_reports["Pending Sale Order Payments & Delivery"] = {
	"filters": [
		{
			"fieldname": "from_date",
			"fieldtype": "Date",
			"label": "From Date",
			"default": frappe.datetime.add_months(frappe.datetime.get_today(), -1),
			"reqd": 1,
		},
		{
			"fieldname": "to_date",
			"fieldtype": "Date",
			"label": "TO Date",
			"default": frappe.datetime.get_today(),
			"reqd": 1,
		},
		{
			"fieldname": "created_by",
			"fieldtype": "Link",
			"label": "Created By",
			"options": "User"
		},
	]
};