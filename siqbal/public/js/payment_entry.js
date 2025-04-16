{% include "siqbal/public/js/utils.js" %}


frappe.ui.form.on("Payment Entry", {
	onload: function (frm) {
		if (frm.doc.docstatus == 0) {
			// var ret_obj = setseries(frm.doc.company);
			// frm.set_value("naming_series", ret_obj.series);
			$.each(frm.doc.references || [], function (i, d) {
				get_sales_order_owner(d.reference_doctype, d.reference_name, d);
			});
			set_supplier_property(frm);
		}
	},
	validate: function (frm) {
		if (frm.doc.docstatus == 0) {
			if (frm.doc.unallocated_amount > 0 && (frm.doc.party == "LOADER BIKE" || frm.doc.party == "GL PAYMENT")) {
				msgprint("Excess Payment Not Allowed. Unallocated should be 0");
				frappe.validated = false;
				return;
			}
			// var ret_obj = setseries(frm.doc.company);
			// cur_frm.set_value("naming_series", ret_obj.series);
		}
	},
	company: function (frm) {
		// var ret_obj = setseries(frm.doc.company);
		// frm.set_value("naming_series", ret_obj.series);
		link_si_to_so(frm);
	},
	references_on_form_rendered: function (frm) {
		link_si_to_so(frm);
	},
	mode_of_payment: function (frm) {
		frm.events.set_total_allocated_amount(frm);
		set_supplier_property(frm);
		for (var row of frm.doc.references) {
			if (row.reference_doctype == "Sales Invoice" || row.reference_doctype == "Sales Order") {
				if (row.reference_doctype == "Sales Invoice") {
					var doctype = "Sales Invoice";
					var fieldname = "cust_sales_order_number"
				}
				else if (row.reference_doctype == "Sales Order") {
					var doctype = "Sales Order";
					var fieldname = "name";
				}
				get_sales_order(row, doctype, fieldname);
			}
		}
	},
});

frappe.ui.form.on('Payment Entry Reference', {
	reference_name: function (frm, cdt, cdn) {
		var row = locals[cdt][cdn];
		if (row.reference_doctype == "Sales Invoice" && row.reference_name) {
			frappe.db.get_value("Sales Invoice", row.reference_name, "cust_sales_order_number", (r) => {
				if (r.cust_sales_order_number) {
					frappe.model.set_value(cdt, cdn, "sales_order", r.cust_sales_order_number);
				}
			});
		}
		else if (row.reference_doctype == "Sales Order" && row.reference_name) {
			frappe.model.set_value(cdt, cdn, "sales_order", row.reference_name);
		}
	}
});

function get_sales_order(row, doctype, fieldname) {
	frappe.call({
		method: "frappe.client.get_value",
		args: {
			doctype: doctype,
			fieldname: fieldname,
			filters: { "name": row.reference_name }
		},
		callback: function (r) {
			if (r.message) {
				frappe.model.set_value(row.doctype, row.name, "sales_order", r.message.cust_sales_order_number || r.message.name);
			}
		}
	});
}

function link_si_to_so(frm) {
	// var doctypes = ["Sales Invoice", "Sales Order", "Journal Entry"];
	for (var reference of frm.get_field("references").grid.grid_rows) {

		if (reference.get_field("reference_doctype").value == "Sales Invoice") {
			var fieldname = "cust_sales_order_number";
			frappe.db.get_value("Sales Invoice", reference.get_field("reference_name").value, fieldname, function (value) {
				reference.get_field("sales_order").set_model_value(value[fieldname]);
			});
		}
		else if (reference.get_field("reference_doctype").value == "Sales Order") {
			var sales_order = reference.get_field("reference_name").value
			reference.get_field("sales_order").set_model_value(sales_order);
		}
	}
}

// function setseries(company) {
// 	var ret_obj = { twarehouse: "", series: "" };
// 	switch (company) {
// 		case "Turk Tiles": ret_obj.series = "TT-PE-"; break;
// }
// 	return ret_obj;
// }

function get_sales_order_owner(doctype, docnumber, row) {
	var fieldfetch = "";
	if (doctype == "Sales Order") {
		fieldfetch = "owner";
	}
	if (doctype == "Sales Invoice") {
		fieldfetch = "sales_order_owner";
	}
	frappe.call({
		method: "frappe.client.get",
		args: {
			doctype: doctype,
			filters: { "name": docnumber },
			fieldname: fieldfetch
		},
		callback: function (r) {
			if (doctype == "Sales Order") {
				row.cust_sales_order_owner = r.message.owner;
			}
			if (doctype == "Sales Invoice") {
				row.cust_sales_order_owner = r.message.sales_order_owner;
				// frappe.model.set_value(row.doctype, row.name, "cust_sales_order_owner", r.message.sales_order_owner);
			}
			// cur_frm.save_or_update();
		}
	});
}


function set_supplier_property(frm) {
	frappe.db.get_single_value("SIqbal Settings", "enable_direct_transfer_to_supplier").then((value) => {
		if (value == 1) {
			frappe.db.get_doc("SIqbal Settings", "SIqbal Settings").then((settingsDoc) => {
				// Ensure the child table exists and has entries
				if (settingsDoc.supplier_payment && settingsDoc.supplier_payment.length > 0) {
					settingsDoc.supplier_payment.forEach((row) => {
						// Check if the mode_of_payment matches
						if (row.mode_of_payment == frm.doc.mode_of_payment && !frm.doc.supplier_payment_entry) {
							// Set payment_supplier as required
							frm.set_df_property("payment_supplier", "reqd", 1);
							frm.set_df_property("payment_supplier", "hidden", 0);
						} else {
							frm.set_value("payment_supplier", "");
							frm.set_df_property("payment_supplier", "reqd", 0);
							frm.set_df_property("payment_supplier", "hidden", 1);
						}
					});
				}
			});
		} else {
			frm.set_value("payment_supplier", "");
			frm.set_df_property("payment_supplier", "reqd", 0);
			frm.set_df_property("payment_supplier", "hidden", 1);
		}
	});
}