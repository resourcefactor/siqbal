{% include "siqbal/public/js/utils.js" %}

frappe.ui.form.on("Purchase Invoice", "onload", function (frm, cdt, cdn) {
	if (frm.doc.docstatus == 0) {
		$.each(frm.doc.items || [], function (i, d) {
			if (d.qty != d.sqm && d.item_code != 'undefined') { CalculateSQM(d, "received_qty", cdt, cdn); }
		})
	}
});

// frappe.ui.form.on("Purchase Invoice", "validate", function (frm, cdt, cdn) {
// 	if (frm.doc.docstatus == 0) {
// 		validateBoxes(frm);
// 		// var ret_obj = setseries(frm.doc.company); cur_frm.set_value("naming_series", ret_obj.series);
// 		calculate_total_boxes(frm);
// 	}
// });

// frappe.ui.form.on('Purchase Invoice', {
// 	company: function (frm) {
// 		var ret_obj = setseries(frm.doc.company); frm.set_value("naming_series", ret_obj.series);
// 	}
// });

frappe.ui.form.on('Purchase Invoice Item',
	{
		pieces: function (frm, cdt, cdn) { CalculateSQM(locals[cdt][cdn], "pieces", cdt, cdn); },
		sqm: function (frm, cdt, cdn) { CalculateSQM(locals[cdt][cdn], "sqm", cdt, cdn); },
		// boxes: function (frm, cdt, cdn) { CalculateSQM(locals[cdt][cdn], "boxes", cdt, cdn); },
		boxes: function (frm, cdt, cdn) { CalculateSQM(locals[cdt][cdn], "boxes", cdt, cdn); row.qty = row.received_qty - row.rejected_qty },
		received_qty: function (frm, cdt, cdn) { CalculateSQM(locals[cdt][cdn], "received_qty", cdt, cdn); },
		// qty: function (frm, cdt, cdn) { CalculateSQM(locals[cdt][cdn], "qty", cdt, cdn); },
		item_name: function (frm, cdt, cdn) { CalculateSQM(locals[cdt][cdn], "received_qty", cdt, cdn); },
		rejected_qty: function (frm, cdt, cdn) { CalculateBreakage(frm); },

		rejected_boxes: function (frm, cdt, cdn) {
			frm.doc.items.forEach((d) => {
				if (!frm.doc.is_return && d.rejected_boxes < 0) {
					frappe.throw(__("Row {0}: Rejected Quantity cannot be Negative", [d.idx]));
				}
			});

			var row = locals[cdt][cdn];
			var total_piece = 0;
			if (typeof row.def_boxes != 'undefined' && row.def_boxes) {
				var total_piece = Math.round(row.rejected_boxes * row.def_pieces);
				var new_rej_sqm = parseFloat((total_piece * (row.def_boxes / row.def_pieces)).toFixed(4));

				if (new_rej_sqm > 0) {
					row.rejected_boxes = Math.floor((new_rej_sqm / row.def_boxes).toFixed(4));
					// row.qty = row.received_qty - row.rejected_qty;
				}
				else {
					row.rejected_boxes = Math.ceil((new_rej_sqm / row.def_boxes).toFixed(4));
				}

				row.rejected_pieces = (total_piece % row.def_pieces);
				row.rejected_qty = new_rej_sqm;
				row.qty = row.received_qty - row.rejected_qty;
			}

			if (row.rejected_qty > 0) {
				frappe.db.get_value("Warehouse", frm.doc.set_warehouse, "rejected_warehouse").then((res) => {
					frm.set_value("rejected_warehouse", res.rejected_warehouse);
				});
				frappe.db.get_value("Warehouse", row.warehouse, "rejected_warehouse", (res) => {
					frappe.model.set_value(cdt, cdn, "rejected_warehouse", res.rejected_warehouse);
				});
			}

			frm.refresh_field("items");
		},
		rejected_pieces: function (frm, cdt, cdn) {
			frm.doc.items.forEach((d) => {
				if (!frm.doc.is_return && d.rejected_pieces < 0) {
					frappe.throw(__("Row {0}: Rejected Quantity cannot be Negative", [d.idx]));
				}
			});

			var row = locals[cdt][cdn];
			if (!row.rejected_pieces) {
				row.rejected_pieces = 0;
			} else if (!row.rejected_boxes) {
				row.rejected_boxes = 0;
			}
			var total_piece = 0;
			var total_piece = Math.round(row.rejected_pieces + (row.rejected_boxes * row.def_pieces));
			var new_rej_sqm = parseFloat(total_piece * (row.def_boxes / row.def_pieces));

			row.rejected_boxes = Math.floor(new_rej_sqm / row.def_boxes);
			row.rejected_pieces = (total_piece % row.def_pieces);
			row.rejected_qty = new_rej_sqm;
			row.qty = row.received_qty - row.rejected_qty;

			if (row.rejected_qty > 0) {
				frappe.db.get_value("Warehouse", frm.doc.set_warehouse, "rejected_warehouse").then((res) => {
					frm.doc.rejected_warehouse = res.rejected_warehouse;
				});
				frappe.db.get_value("Warehouse", row.warehouse, "rejected_warehouse").then((res) => {
					row.rejected_warehouse = res.rejected_warehouse;
				});
			}

			frm.refresh_field("items");
		},
		item_code: function (frm, cdt, cdn) {
			frappe.model.set_value(cdt, cdn, "qty", 1);
			frappe.model.set_value(cdt, cdn, "discount_percentage", 0);
			frappe.model.set_value(cdt, cdn, "discount_amount", 0);
			CalculateSQM(locals[cdt][cdn], "qty", cdt, cdn);
		}
	})

// function CalculateSQM(crow, field, cdt, cdn) {
// 	var d = locals[cdt][cdn];
// 	if (typeof crow.def_boxes != 'undefined' && crow.def_boxes && crow.def_boxes > 0) {
// 		var total_piece = 0.0;
// 		switch (field) {
// 			case "pieces": total_piece = Math.round(crow.pieces + (crow.boxes * crow.def_pieces)); break;
// 			case "boxes": total_piece = Math.round(crow.boxes * crow.def_pieces); break;
// 			case "sqm": total_piece = Math.round(crow.sqm / (crow.def_boxes / crow.def_pieces)); break;
// 			case "qty": total_piece = Math.round(crow.qty / (crow.def_boxes / crow.def_pieces));
// 		}
// 		var new_sqm = parseFloat((total_piece * (crow.def_boxes / crow.def_pieces)).toFixed(4));
// 		if (new_sqm > 0) {
// 			crow.boxes = Math.floor((new_sqm / crow.def_boxes).toFixed(4));
// 		} else { crow.boxes = Math.ceil((new_sqm / crow.def_boxes).toFixed(4)); }
// 		crow.pieces = (total_piece % crow.def_pieces);
// 		d.qty =  new_sqm;
// 		// frappe.model.set_value(cdt, cdn, 'qty', new_sqm);
// 		crow.sqm = new_sqm;
// 		cur_frm.refresh_field("items");
// 	}
// 	else {
// 		var new_sqm = 0;
// 		switch (field) {
// 			case "pieces": new_sqm = crow.pieces; break;
// 			case "boxes": new_sqm = crow.boxes; break;
// 			case "sqm": new_sqm = crow.sqm; break;
// 			case "qty": new_sqm = crow.qty; break;
// 		}
// 		crow.sqm = new_sqm; crow.boxes = new_sqm; crow.pieces = new_sqm; crow.qty = new_sqm;
// 		cur_frm.refresh_field("items");
// 	}
// }



function CalculateSQM(crow, field, cdt, cdn) {
	if (typeof crow.def_boxes != 'undefined' && crow.def_boxes && crow.def_boxes > 0) {
		var total_piece = 0.0;
		switch (field) {
			case "pieces": total_piece = Math.round(crow.pieces + (crow.boxes * crow.def_pieces)); break;
			case "boxes": total_piece = Math.round(crow.boxes * crow.def_pieces); break;
			case "sqm": total_piece = Math.round(crow.sqm / (crow.def_boxes / crow.def_pieces)); break;
			case "received_qty": total_piece = Math.round(crow.received_qty / (crow.def_boxes / crow.def_pieces));
			case "qty": total_piece = Math.round(crow.qty / (crow.def_boxes / crow.def_pieces));
		}
		var new_sqm = parseFloat((total_piece * (crow.def_boxes / crow.def_pieces)).toFixed(4));
		if (new_sqm > 0) {
			crow.boxes = Math.floor((new_sqm / crow.def_boxes).toFixed(4));
		}
		else {
			crow.boxes = Math.ceil((new_sqm / crow.def_boxes).toFixed(4));
		}
		crow.pieces = (total_piece % crow.def_pieces);
		crow.received_qty = new_sqm;
		// frappe.model.set_value(cdt, cdn, 'received_qty', new_sqm);
		frappe.model.set_value(cdt, cdn, "qty", crow.received_qty - crow.rejected_qty);
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
			case "qty": new_sqm = crow.qty; break;
		}
		crow.sqm = new_sqm; crow.boxes = new_sqm; crow.pieces = new_sqm; crow.received_qty = new_sqm;
		cur_frm.refresh_field("items");
	}
}
