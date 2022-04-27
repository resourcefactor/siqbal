// Copyright (c) 2016, RC and contributors
// For license information, please see license.txt
/* eslint-disable */


frappe.query_reports["Pending Sales Order"] = {
	"filters": [
		{
			"fieldname": "from_date",
			"label": __("From Date"),
			"fieldtype": "Date",
			"default": get_today(),
			"reqd": 1
		},
		{
			"fieldname": "to_date",
			"label": __("To Date"),
			"fieldtype": "Date",
			"default": get_today(),
			"reqd": 1
		},
		{
			"fieldname": "customer_group",
			"label": __("Customer Group"),
			"fieldtype": "Link",
			"default": "Cash Customer",
			"options": "Customer Group",
			"reqd": 1
		}
	]
}