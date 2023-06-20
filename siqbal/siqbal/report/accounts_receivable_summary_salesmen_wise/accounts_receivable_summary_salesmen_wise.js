// Copyright (c) 2023, RC and contributors
// For license information, please see license.txt
/* eslint-disable */

frappe.query_reports["Accounts Receivable Summary Salesmen Wise"] = {
	"filters": [
		{
			"fieldname":"company",
			"label": __("Company"),
			"fieldtype": "Link",
			"options": "Company",
			"default":	frappe.user_defaults.company,
			"reqd": 1
		},
		// {
		// 	"fieldname":"customer",
		// 	"label": __("Customer"),
		// 	"fieldtype": "Link",
		// 	"options": "Customer"
		// },
		{
			"fieldname":"salesman",
			"label": __("Salesman"),
			"fieldtype": "Link",
			"options": "User"
		},
		{
			"fieldname":"from_date",
			"label": __("From Date"),
			"fieldtype": "Date",
			"default": frappe.datetime.add_months(frappe.datetime.get_today(), -1),
			"reqd": 1,
			"width": "60px"
		},
		{
			"fieldname":"to_date",
			"label": __("To Date"),
			"fieldtype": "Date",
			"default": frappe.datetime.get_today(),
			"reqd": 1,
			"width": "60px"
		},
	]
};
