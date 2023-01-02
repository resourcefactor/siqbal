{% include "siqbal/public/js/utils.js" %}

frappe.ui.form.on("Sales Invoice", {
	refresh: function (frm, cdt, cdn) {
		if (frm.doc.docstatus == 0 && !frm.doc.__islocal) {
			var label = __("Split Invoice between Warehouses");
			frm.add_custom_button(label, () => split_invoice_between_warehouse(frm));
		}
	},
	onload: function (frm, cdt, cdn) {
		if (frm.doc.docstatus == 0) {
			if (frm.doc.is_return == 1) { frm.set_df_property("update_stock", "read_only", 1); }
			// frm.get_field("custom_delivery_warehouse").get_query = function (doc, cdt, cdn) {
			// 	return {
			// 		filters: { 'company': doc.company }
			// 	}
			// }
			$.each(frm.doc.items || [], function (i, d) {
				if (!frm.doc.cust_sales_order_owner) {
					get_sales_order_owner(d.sales_order);
				}
				if (d.qty != d.sqm && d.item_code != 'undefined') { CalculateSQM(d, "qty", cdt, cdn); }
				frappe.call({
					method: "frappe.client.get",
					args: {
						doctype: "Sales Order",
						filters: { "name": d.sales_order },
						fieldname: "cost_center"
					},
					callback: function (r) {
						d.cost_center = r.message.cost_center
						cur_frm.refresh_field("items");
					}
				});
			});
		}
		frappe.after_ajax(function () {
			setup_warehouse_query('warehouse', frm);
		});
	},
	validate: function (frm, cdt, cdn) {
		if (frm.doc.docstatus == 0) {
			validateBoxes(frm);
			calculate_total_boxes(frm);
			if (frm.doc.calculate_so_discount_ == true) {
				frappe.call({
					method: "frappe.client.get_list",
					args: {
						doctype: "Sales Order",
						filters: { 'name': frm.doc.cust_sales_order_number },
						fields: ['discount_amount', 'total', 'grand_total']
					},
					callback: function (r) {
						var discount_per = (r.message[0].discount_amount * 100) / r.message[0].total;
						frm.set_value("additional_discount_percentage", discount_per);
						frm.set_value("discount_amount", (frm.doc.total * discount_per) / 100);

					}
				})
			}
			// if (!frm.doc.custom_delivery_warehouse) { frm.set_value("custom_delivery_warehouse", "Delivery Depot - TS"); }
			$.each(frm.doc.items || [], function (i, d) {
				if (d.item_group != 'Fixed Assets' && d.item_group != 'SERVICE') {
					if (d.qty == 0 || d.rate == 0) {
						frappe.throw("0 Qty or Rate is not allowed. Please check item " + d.item_code);
						frappe.validated = false; return;
					}
					if (frm.doc.update_stock) {
						if (d.qty > d.actual_qty) {
							frappe.throw("Stock Is not availabe in selected warehouse for item code " + d.item_code);
							frappe.validated = false; return;
						}
					}
				}
				// if (frm.doc.direct_delivery_from_warehouse && frm.doc.custom_delivery_warehouse != "Delivery Depot - TS") { d.warehouse = frm.doc.custom_delivery_warehouse; }
			})
			$.each(frm.doc.items || [], function (i, d) {
				frappe.call({
					method: "frappe.client.get",
					args: {
						doctype: "Sales Order",
						filters: { "name": d.sales_order },
						fieldname: "cost_center"
					},
					callback: function (r) {
						d.cost_center = r.message.cost_center;
					}
				})
			})
			cur_frm.refresh_field("items");
			if (!frm.doc.ignore_advances_calculation) {
				if (!frm.doc.is_return) {
					return frm.call({
						method: "set_advances",
						doc: frm.doc,
						callback: function (r, rt) {
							refresh_field("advances");
						}
					})
				}
			}
		}
	},
	// custom_delivery_warehouse: function (frm) {
	// 	$.each(frm.doc.items || [], function (i, d) {
	// 		frappe.model.set_value(d.doctype, d.name, "warehouse", frm.doc.custom_delivery_warehouse);
	// 	})
	// },
	// direct_delivery_from_warehouse: function (frm) {
	// 	if (frm.doc.direct_delivery_from_warehouse) {
	// 		frappe.call({
	// 			method: "frappe.client.get",
	// 			args: {
	// 				doctype: "User",
	// 				filters: { "name": frappe.session.user },
	// 				fieldname: "user_warehouse"
	// 			},
	// 			callback: function (r) {
	// 				if (r.message.user_warehouse) {
	// 					frm.set_value("custom_delivery_warehouse", r.message.user_warehouse);
	// 				}
	// 			}
	// 		})
	// 	}
	// }
});

frappe.ui.form.on('Sales Invoice Item',
	{
		pieces: function (frm, cdt, cdn) { CalculateSQM(locals[cdt][cdn], "pieces", cdt, cdn); },
		sqm: function (frm, cdt, cdn) { CalculateSQM(locals[cdt][cdn], "sqm", cdt, cdn); },
		boxes: function (frm, cdt, cdn) { CalculateSQM(locals[cdt][cdn], "boxes", cdt, cdn); },
		qty: function (frm, cdt, cdn) { CalculateSQM(locals[cdt][cdn], "qty", cdt, cdn); },
		item_name: function (frm, cdt, cdn) { CalculateSQM(locals[cdt][cdn], "qty", cdt, cdn); },
		item_code: function (frm, cdt, cdn) {
			frappe.model.set_value(cdt, cdn, "qty", 1);
			CalculateSQM(locals[cdt][cdn], "qty", cdt, cdn);
		}
	})

function get_sales_order_owner(sales_order) {
	frappe.call({
		method: "frappe.client.get",
		args: {
			doctype: "Sales Order",
			filters: { "name": sales_order },
			fieldname: "owner"
		},
		callback: function (r) {
			cur_frm.set_value("sales_order_owner", r.message.owner);
		}
	})
}

handlePrintButtonClickEvent(cur_frm);

function handlePrintButtonClickEvent(cur_frm) {
	var btn = document.getElementsByClassName('btn-print-print');
	if (btn) {
		for (var i = 0; i < btn.length; i++) {
			if (btn[i].textContent.trim() == "Print") {
				btn[i].addEventListener("click", function () {
					increase_print_count(cur_frm);
				});
				break;
			}
		}
	}
}

function increase_print_count(frm) {
	frappe.db.get_value(frm.doc.doctype, frm.doc.name, "print_count", (r) => {
		frappe.db.set_value(frm.doc.doctype, frm.doc.name, "print_count", Number(r.print_count) + 1);
	});
}

function split_invoice_between_warehouse(frm) {
	if(frm.is_dirty()) {
		frappe.throw(__("You have unsaved changes. Please save or reload the document first."))
	} else {
	frappe.confirm(__("Are you sure you want to split this Sales Invoice between Warehouses?"),
		() => frappe.call({
			method: "siqbal.hook_events.sales_invoice.split_invoice_between_warehouse",
			args: {
				"source_name": frm.doc.name
			},
			freeze: true,
			callback: function (r) {
				if (!r.exc) {
					frm.reload_doc();
				}
			}
		}),
		() => window.close()
	);
	}
}
