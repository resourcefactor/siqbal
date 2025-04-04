{% include "siqbal/public/js/utils.js" %}
frappe.provide('siqbal.stock');

frappe.ui.form.on('Purchase Receipt', {
	validate: function (frm, cdt, cdn) {
		if (frm.doc.docstatus === 0) {
			validateBoxes(frm);
			CalculateBreakage(frm);
			frm.doc.items.forEach((d) => {
				frappe.db.get_value("User", frappe.session.user, "user_warehouse").then((r) => {
					if (r.message.user_warehouse) {
						d.warehouse = r.message.user_warehouse;
						frm.doc.set_warehouse = r.message.user_warehouse;
					}
					if (d.rejected_qty > 0) {
						frappe.db.get_value("Warehouse", frm.doc.set_warehouse, "rejected_warehouse").then((res) => {
							frm.doc.rejected_warehouse = res.message.rejected_warehouse;
						});
						frappe.db.get_value("Warehouse", d.warehouse, "rejected_warehouse").then((res) => {
							d.rejected_warehouse = res.message.rejected_warehouse;
						});
					}
				});

				if(!frm.doc.is_return && d.rejected_boxes < 0) {
					frappe.throw(__("Row {0}: Rejected Quantity cannot be Negative", [d.idx]));
				} else if(!frm.doc.is_return && d.rejected_pieces < 0) {
					frappe.throw(__("Row {0}: Rejected Quantity cannot be Negative", [d.idx]));
				}
			});
			calculate_total_boxes(frm);
		}
	},
	onload: function (frm, cdt, cdn) {
		if (frm.doc.docstatus === 0) {
			frm.doc.items.forEach((d) => {
				if (d.qty !== d.sqm && d.item_code) {
					CalculateSQM(d, "received_qty", cdt, cdn);
				}
				if(!d.warehouse || !frm.doc.set_warehouse) {
					frappe.db.get_value("User", frappe.session.user, "user_warehouse").then((r) => {
						if (r.message.user_warehouse) {
							d.warehouse = r.message.user_warehouse;
							frm.doc.set_warehouse = r.message.user_warehouse;
						}
						if (d.rejected_qty > 0) {
							frappe.db.get_value("Warehouse", frm.doc.set_warehouse, "rejected_warehouse").then((res) => {
								frm.doc.rejected_warehouse = res.message.rejected_warehouse;
							});
							frappe.db.get_value("Warehouse", d.warehouse, "rejected_warehouse").then((res) => {
								d.rejected_warehouse = res.message.rejected_warehouse;
							});
						}
					});
				}
			});
			frm.refresh_field("items");
		}
	}
});

frappe.ui.form.on('Purchase Receipt Item', {
	pieces: function (frm, cdt, cdn) { CalculateSQM(locals[cdt][cdn], "pieces", cdt, cdn); },
	sqm: function (frm, cdt, cdn) { CalculateSQM(locals[cdt][cdn], "sqm", cdt, cdn); },
	boxes: function (frm, cdt, cdn) { CalculateSQM(locals[cdt][cdn], "boxes", cdt, cdn); row.qty = row.received_qty - row.rejected_qty },
	received_qty: function (frm, cdt, cdn) { CalculateSQM(locals[cdt][cdn], "received_qty", cdt, cdn); },
	item_name: function (frm, cdt, cdn) { CalculateSQM(locals[cdt][cdn], "received_qty", cdt, cdn); },
	rejected_qty: function (frm, cdt, cdn) { CalculateBreakage(frm); },
	rate: function (frm) { CalculateBreakage(frm); },
	rejected_boxes: function (frm, cdt, cdn) {
		var row = locals[cdt][cdn];
		var total_piece = 0;
		if (typeof row.def_boxes != 'undefined' && row.def_boxes) {
			var total_piece = Math.round(row.rejected_boxes * row.def_pieces);
			var new_rej_sqm = parseFloat((total_piece * (row.def_boxes / row.def_pieces)).toFixed(4));
			if (new_rej_sqm > 0) {
				row.rejected_boxes = Math.floor((new_rej_sqm / row.def_boxes).toFixed(4));
				row.qty = row.received_qty - row.rejected_qty
			}
			else {
				row.rejected_boxes = Math.ceil((new_rej_sqm / row.def_boxes).toFixed(4));
			}
			row.rejected_pieces = (total_piece % row.def_pieces);
			frappe.model.set_value(cdt, cdn, 'rejected_qty', new_rej_sqm);
			frm.refresh_field("items");
		}
	},
	rejected_pieces: function (frm, cdt, cdn) {
		frm.doc.items.forEach((d) => {
			if(!frm.doc.is_return && d.rejected_pieces < 0) {
				frappe.throw(__("Row {0}: Rejected Quantity cannot be Negative", [d.idx]));
			}
		});

		var row = locals[cdt][cdn];
		var total_piece = 0;
		var total_piece = Math.round(row.rejected_pieces + (row.rejected_boxes * row.def_pieces));
		var new_rej_sqm = parseFloat(total_piece * (row.def_boxes / row.def_pieces));

		row.rejected_boxes = Math.floor(new_rej_sqm / row.def_boxes);
		row.rejected_pieces = (total_piece % row.def_pieces);
		row.rejected_qty = new_rej_sqm;
		row.qty = row.received_qty - row.rejected_qty;

		if (row.rejected_qty > 0) {
			frappe.db.get_value("Warehouse", frm.doc.set_warehouse, "rejected_warehouse").then((res) => {
				frm.doc.rejected_warehouse = res.message.rejected_warehouse;
			});
			frappe.db.get_value("Warehouse", row.warehouse, "rejected_warehouse").then((res) => {
				row.rejected_warehouse = res.message.rejected_warehouse;
			});
		}

		frm.refresh_field("items");
	},
	item_code: function (frm, cdt, cdn) {
		frappe.model.set_value(cdt, cdn, "received_qty", 1);
		CalculateSQM(locals[cdt][cdn], "received_qty", cdt, cdn);
	}
});

function CalculateSQM(crow, field, cdt, cdn) {
	if (typeof crow.def_boxes != 'undefined' && crow.def_boxes && crow.def_boxes > 0) {
		var total_piece = 0.0;
		switch (field) {
			case "pieces": total_piece = Math.round(crow.pieces + (crow.boxes * crow.def_pieces)); break;
			case "boxes": total_piece = Math.round(crow.boxes * crow.def_pieces); break;
			case "sqm": total_piece = Math.round(crow.sqm / (crow.def_boxes / crow.def_pieces)); break;
			case "received_qty": total_piece = Math.round(crow.received_qty / (crow.def_boxes / crow.def_pieces));
		}
		var new_sqm = parseFloat((total_piece * (crow.def_boxes / crow.def_pieces)).toFixed(4));
		if (new_sqm > 0) {
			crow.boxes = Math.floor((new_sqm / crow.def_boxes).toFixed(4));
		}
		else {
			crow.boxes = Math.ceil((new_sqm / crow.def_boxes).toFixed(4));
		}
		crow.pieces = (total_piece % crow.def_pieces);
		frappe.model.set_value(cdt, cdn, 'received_qty', new_sqm);
		crow.sqm = new_sqm;
		cur_frm.refresh_field("items");
	}
	else {
		var new_sqm = 0;
		switch (field) {
			case "pieces": new_sqm = crow.pieces; break;
			case "boxes": new_sqm = crow.boxes; break;
			case "sqm": new_sqm = crow.sqm; break;
			case "received_qty": new_sqm = crow.qty; break;
		}
		crow.sqm = new_sqm; crow.boxes = new_sqm; crow.pieces = new_sqm; crow.received_qty = new_sqm;
		cur_frm.refresh_field("items");
	}
}


function CalculateBreakage(frm) {
	var total_breakage = 0;
	$.each(frm.doc.items || [], function (i, d) {
		if (d.rejected_qty > 0) { total_breakage += d.rejected_qty * d.rate; }
	})
}

siqbal.stock.PurchaseReceiptController = class PurchaseReceiptController extends erpnext.stock.PurchaseReceiptController {
	refresh() {
		var me = this;
		super.refresh();
		if (!this.frm.doc.is_return && this.frm.doc.status != "Closed") {
			if (this.frm.doc.docstatus == 0) {
				cur_frm.remove_custom_button(__("Purchase Order"), "Get items from");

				this.frm.add_custom_button(__('Purchase Order'),
					function () {
						erpnext.utils.map_current_doc({
							method: "siqbal.utils.ts_make_purchase_receipt",
							source_doctype: "Purchase Order",
							target: me.frm,
							setters: {
								supplier: me.frm.doc.supplier || undefined,
							},
							get_query_filters: {
								docstatus: 1,
								status: ["not in", ["Closed", "On Hold"]],
								per_received: ["<", 99.99],
								company: me.frm.doc.company
							}
						})
					}, __("Get items from"));
			}
		}
	}
};

extend_cscript(cur_frm.cscript, new siqbal.stock.PurchaseReceiptController({ frm: cur_frm }));
