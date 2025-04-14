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
	setup(frm) {
		frm._controller = new siqbal.buying.PurchaseOrderController({ frm });
	}
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
	refresh() {
		const doc = this.frm.doc;
		const frm = this.frm;

		let allow_receipt = false;
		let is_drop_ship = false;

		for (const item of doc.items) {
			if (item.delivered_by_supplier !== 1) {
				allow_receipt = true;
			} else {
				is_drop_ship = true;
			}
			if (is_drop_ship && allow_receipt) break;
		}

		frm.remove_custom_button(__("Receipt"), "Create");

		if (doc.docstatus === 1 && doc.status !== "Closed" && doc.status !== "On Hold") {
			if (flt(doc.per_received, 2) < 100 && allow_receipt) {
				frm.add_custom_button(__('Receipt'), () => {
					this.ts_make_purchase_receipt();
				}, __('Create'));
			}
		}

		if (doc.docstatus === 0 && frm.page.current_view_name !== "pos" && !doc.is_return) {
			frm.add_custom_button(__('Sales Order'), () => {
				erpnext.utils.map_current_doc({
					method: "siqbal.utils.ts_make_purchase_order",
					source_doctype: "Sales Order",
					target: frm,
					setters: {},
					get_query_filters: {
						docstatus: 1,
						status: ["not in", ["Closed", "On Hold"]],
						per_billed: ["<", 99.99],
						company: doc.company
					}
				});
			}, __("Get Items From"));
		}
	}

	ts_make_purchase_receipt() {
		frappe.model.open_mapped_doc({
			method: "siqbal.utils.ts_make_purchase_receipt",
			frm: this.frm
		});
	}
};


extend_cscript(cur_frm.cscript, new siqbal.buying.PurchaseOrderController({ frm: cur_frm }));
