# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from . import __version__ as app_version

app_name = "SIqbal"
app_title = "SIqbal"
app_publisher = "RC"
app_description = "Customizations for SIqbal"
app_icon = "octicon octicon-file-directory"
app_color = "green"
app_email = "developer@rccorner.com"
app_license = "MIT"

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
app_include_css = "/assets/siqbal/css/siqbal.css"
# app_include_js = "/assets/siqbal/js/siqbal.js"

# include js, css files in header of web template
# web_include_css = "/assets/siqbal/css/siqbal.css"
# web_include_js = "/assets/siqbal/js/siqbal.js"

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

doctype_js = {
		"Address": "public/js/address.js",
		"Architect and Contractor": "public/js/architect_and_contractor.js",
		"Authorization Rule": "public/js/authorization_rule.js",
		"Customer": "public/js/customer.js",
		"Delivery Note" : "public/js/delivery_note.js",
		"Item": "public/js/item.js",
		"Journal Entry": "public/js/journal_entry.js",
		"Landed Cost Voucher": "public/js/landed_cost_voucher.js",
		"Material Request" : "public/js/material_request.js",
		"Opportunity": "public/js/opportunity.js",
		"Payment Entry": "public/js/payment_entry.js",
		"Property Detail": "public/js/property_detail.js",
		"Purchase Invoice" : "public/js/purchase_invoice.js",
		"Purchase Order" : "public/js/purchase_order.js",
		"Purchase Receipt" : "public/js/purchase_receipt.js",
		"Quotation" : "public/js/quotation.js",
		"Request for Quotation": "public/js/request_for_quotation.js",
		"Salary Slip" : "public/js/salary_slip.js",
		"Sales Invoice" : "public/js/sales_invoice.js",
		"Sales Order" : "public/js/sales_order.js",
		"Stock Entry" : "public/js/stock_entry.js",
		"Stock Reconciliation" : "public/js/stock_reconciliation.js",
		"Supplier Quotation": "public/js/supplier_quotation.js"
	}

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
#	"Role": "home_page"
# }

# Website user home page (by function)
# get_website_user_home_page = "siqbal.utils.get_home_page"

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Installation
# ------------

# before_install = "siqbal.install.before_install"
# after_install = "siqbal.install.after_install"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "siqbal.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
#	}
# }

doc_events = {
	"Sales Order": {
		"validate": [
			"siqbal.hook_events.sales_order.set_average_valuation_rate",
		#	"siqbal.utils.validate_date"
		],
		"before_submit": "siqbal.hook_events.sales_order.unset_needs_approval",
		"before_update_after_submit": "siqbal.hook_events.sales_order.validate_items_rate_and_update_boxes"
	},
	"Sales Invoice": {
		"validate": [
			"siqbal.hook_events.sales_invoice.validate_discount_while_return",
			"siqbal.hook_events.sales_invoice.validate_taxes_and_charges_from_so",
			"siqbal.utils.add_location",
			"siqbal.hook_events.sales_invoice.validate_sales_invoice"
		#	"siqbal.utils.validate_date"
		],
		"before_insert": "siqbal.hook_events.sales_invoice.set_supplier_details",
		"on_submit": [
			"siqbal.hook_events.sales_invoice.update_reserved_qty",
			"siqbal.hook_events.sales_invoice.create_purchase_invoices_against_sales_taxes",
			# "siqbal.utils.change_pi_status"			
			#"siqbal.hook_events.sales_invoice.validate_user_warehouse"
		],
		"on_cancel": "siqbal.hook_events.sales_invoice.update_reserved_qty"
	},
	"Payment Entry": {
		"validate": [
			"siqbal.hook_events.payment_entry.validate_sales_order",
			# "siqbal.hook_events.payment_entry.validate_salaryslip_amount",
			#"siqbal.utils.validate_date"
		],
		# "on_submit": "siqbal.hook_events.payment_entry.update_salaryslip_status",
		# "on_cancel": "siqbal.hook_events.payment_entry.update_salaryslip_status"
	},
	"Stock Entry": {
		#"validate": "siqbal.utils.validate_date",
		#"on_submit": "siqbal.hook_events.stock_entry.validate_user_warehouse"
	},
	"Opportunity": {
		"validate": "siqbal.utils.send_followup_sms"
	},
	"Purchase Invoice": {
		"validate": "siqbal.utils.add_location"
	},
	"Purchase Order": {
		#"validate": "siqbal.utils.validate_date"
	},
	"Purchase Receipt": {
		#"validate": "siqbal.utils.validate_date"
	},
	"Stock Reconciliation": {
		#"validate": "siqbal.utils.validate_date"
	},
	# "Quotation": {
		#"validate": "siqbal.utils.validate_date"
	# },
	# "Journal Entry": {
	# 	"before_save": "siqbal.hook_events.journal_entry.set_name"
	# }
}


jenv = {
	"methods" : [
	"get_qrcode_image:siqbal.utils.get_qrcode_image"
	]
}


# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"siqbal.tasks.all"
# 	],
# 	"daily": [
# 		"siqbal.tasks.daily"
# 	],
# 	"hourly": [
# 		"siqbal.tasks.hourly"
# 	],
# 	"weekly": [
# 		"siqbal.tasks.weekly"
# 	]
# 	"monthly": [
# 		"siqbal.tasks.monthly"
# 	]
# }

# Testing
# -------

# before_tests = "siqbal.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "siqbal.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "siqbal.task.get_dashboard_data"
# }

