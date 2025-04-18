{% include "siqbal/public/js/utils.js" %}
frappe.provide('siqbal.buying');

frappe.ui.form.on("Purchase Order", {
	schedule_date: function (frm) {
		if (frm.doc.docstatus == 0) {
			$.each(frm.doc.items || [], function (i, d) {
				d.expected_delivery_date = frm.doc.schedule_date;
				d.schedule_date = frm.doc.schedule_date;
			})
		}
	},
	// belows setup is for controller
	// setup(frm) {
	// 	frm._controller = new siqbal.buying.PurchaseOrderController({ frm });
	// }

});




frappe.ui.form.on("Purchase Order", "onload", function (frm, cdt, cdn) {
	$.each(frm.doc.items || [], function (i, d) {
		if (d.qty != d.sqm && d.item_code != 'undefined') { CalculateSQM(d, "qty", cdt, cdn); }
	})
});

frappe.ui.form.on("Purchase Order", "validate", function (frm, cdt, cdn) {
	validateBoxes(frm);
	calculate_total_boxes(frm);
});


frappe.ui.form.on('Purchase Order Item',
	{
		pieces: function (frm, cdt, cdn) { CalculateSQM(locals[cdt][cdn], "pieces", cdt, cdn); },
		sqm: function (frm, cdt, cdn) { CalculateSQM(locals[cdt][cdn], "sqm", cdt, cdn); },
		boxes: function (frm, cdt, cdn) { CalculateSQM(locals[cdt][cdn], "boxes", cdt, cdn); },
		qty: function (frm, cdt, cdn) { CalculateSQM(locals[cdt][cdn], "qty", cdt, cdn); },
		item_name: function (frm, cdt, cdn) { CalculateSQM(locals[cdt][cdn], "qty", cdt, cdn); },
		item_code: function (frm, cdt, cdn) {
			frappe.model.set_value(cdt, cdn, "qty", 1);
			frappe.model.set_value(cdt, cdn, "discount_percentage", 0);
			frappe.model.set_value(cdt, cdn, "discount_amount", 0);
			CalculateSQM(locals[cdt][cdn], "qty", cdt, cdn);
		}
	})

function CalculateSQM(crow, field, cdt, cdn) {
	if (typeof crow.def_boxes != 'undefined' && crow.def_boxes && crow.def_boxes > 0) {
		var total_piece = 0.0;
		switch (field) {
			case "pieces": total_piece = Math.round(crow.pieces + (crow.boxes * crow.def_pieces)); break;
			case "boxes": total_piece = Math.round(crow.boxes * crow.def_pieces); break;
			case "sqm": total_piece = Math.round(crow.sqm / (crow.def_boxes / crow.def_pieces)); break;
			case "qty": total_piece = Math.round(crow.qty / (crow.def_boxes / crow.def_pieces));
		}
		var new_sqm = parseFloat((total_piece * (crow.def_boxes / crow.def_pieces)).toFixed(4));
		crow.boxes = Math.floor((new_sqm / crow.def_boxes).toFixed(4));
		crow.pieces = (total_piece % crow.def_pieces);
		frappe.model.set_value(cdt, cdn, 'qty', new_sqm);
		crow.sqm = new_sqm;
		cur_frm.refresh_field("items");
	}
	else {
		var new_sqm = 0;
		switch (field) {
			case "pieces": new_sqm = crow.pieces; break;
			case "boxes": new_sqm = crow.boxes; break;
			case "sqm": new_sqm = crow.sqm; break;
			case "qty": new_sqm = crow.qty; break;
		}
		crow.sqm = new_sqm; crow.boxes = new_sqm; crow.pieces = new_sqm; crow.qty = new_sqm;
		cur_frm.refresh_field("items");
	}
}


// updated the PurchaseOrderController to handle the custom button for creating a Purchase Receipt
// and to manage the custom button for creating a Sales Order


siqbal.buying.PurchaseOrderController = class PurchaseOrderController extends erpnext.buying.BuyingController {

	refresh(doc, cdt, cdn) {
		var me = this;
		super.refresh();
		var allow_receipt = false;
		var is_drop_ship = false;

		for (var i in cur_frm.doc.items) {
			var item = cur_frm.doc.items[i];
			if (item.delivered_by_supplier !== 1) {
				allow_receipt = true;
			} else {
				is_drop_ship = true;
			}

			if (is_drop_ship && allow_receipt) {
				break;
			}
		}

		this.frm.set_df_property("drop_ship", "hidden", !is_drop_ship);

		if (doc.docstatus == 1) {
			this.frm.fields_dict.items_section.wrapper.addClass("hide-border");
			if (!this.frm.doc.set_warehouse) {
				this.frm.fields_dict.items_section.wrapper.removeClass("hide-border");
			}

			if (!["Closed", "Delivered"].includes(doc.status)) {
				if (
					this.frm.doc.status !== "Closed" &&
					flt(this.frm.doc.per_received, 2) < 100 &&
					flt(this.frm.doc.per_billed, 2) < 100
				) {
					if (!this.frm.doc.__onload || this.frm.doc.__onload.can_update_items) {
						this.frm.add_custom_button(__("Update Items"), () => {
							erpnext.utils.update_child_items({
								frm: this.frm,
								child_docname: "items",
								child_doctype: "Purchase Order Detail",
								cannot_add_row: false,
							});
						});
						calculate_total_boxes(this.frm);
					}
				}
				if (this.frm.has_perm("submit")) {
					if (flt(doc.per_billed, 2) < 100 || flt(doc.per_received, 2) < 100) {
						if (doc.status != "On Hold") {
							this.frm.add_custom_button(
								__("Hold"),
								() => this.hold_purchase_order(),
								__("Status")
							);
						} else {
							this.frm.add_custom_button(
								__("Resume"),
								() => this.unhold_purchase_order(),
								__("Status")
							);
						}
						this.frm.add_custom_button(
							__("Close"),
							() => this.close_purchase_order(),
							__("Status")
						);
					}
				}

				if (is_drop_ship && doc.status != "Delivered") {
					this.frm.add_custom_button(__("Delivered"), this.delivered_by_supplier, __("Status"));

					this.frm.page.set_inner_btn_group_as_primary(__("Status"));
				}
			} else if (["Closed", "Delivered"].includes(doc.status)) {
				if (this.frm.has_perm("submit")) {
					this.frm.add_custom_button(
						__("Re-open"),
						() => this.unclose_purchase_order(),
						__("Status")
					);
				}
			}
			if (doc.status != "Closed") {
				if (doc.status != "On Hold") {
					if (flt(doc.per_received, 2) < 100 && allow_receipt) {
						cur_frm.add_custom_button(
							__("Purchase Receipt"),
							//    							this.make_purchase_receipt,
							this.ts_make_purchase_receipt,
							__("Create")
						);
						if (doc.is_subcontracted) {
							if (doc.is_old_subcontracting_flow) {
								if (me.has_unsupplied_items()) {
									cur_frm.add_custom_button(
										__("Material to Supplier"),
										function () {
											me.make_stock_entry();
										},
										__("Transfer")
									);
								}
							} else {
								cur_frm.add_custom_button(
									__("Subcontracting Order"),
									this.make_subcontracting_order,
									__("Create")
								);
							}
						}
					}
					if (flt(doc.per_billed, 2) < 100)
						cur_frm.add_custom_button(
							__("Purchase Invoice"),
							this.make_purchase_invoice,
							__("Create")
						);

					if (flt(doc.per_billed, 2) < 100 && doc.status != "Delivered") {
						this.frm.add_custom_button(
							__("Payment"),
							() => this.make_payment_entry(),
							__("Create")
						);
					}

					if (flt(doc.per_billed, 2) < 100) {
						this.frm.add_custom_button(
							__("Payment Request"),
							function () {
								me.make_payment_request();
							},
							__("Create")
						);
					}

					if (doc.docstatus === 1 && !doc.inter_company_order_reference) {
						let me = this;
						let internal = me.frm.doc.is_internal_supplier;
						if (internal) {
							let button_label =
								me.frm.doc.company === me.frm.doc.represents_company
									? "Internal Sales Order"
									: "Inter Company Sales Order";

							me.frm.add_custom_button(
								button_label,
								function () {
									me.make_inter_company_order(me.frm);
								},
								__("Create")
							);
						}
					}
				}

				cur_frm.page.set_inner_btn_group_as_primary(__("Create"));
			}
		} else if (doc.docstatus === 0) {
			cur_frm.cscript.add_from_mappers();
		}
	}

	ts_make_purchase_receipt() {
		frappe.model.open_mapped_doc({
			method: "siqbal.utils.ts_make_purchase_receipt",
			frm: cur_frm
		})
	}
};

extend_cscript(cur_frm.cscript, new siqbal.buying.PurchaseOrderController({ frm: cur_frm }));


