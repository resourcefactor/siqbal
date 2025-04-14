// Updated to version-15
frappe.provide("siqbal");


frappe.ui.form.on("Purchase Invoice", {
	setup(frm) {
		frm.wrapper.addEventListener("grid-row-render", (e) => {
			const grid_row = e.detail;
			if (['Sales Taxes and Charges', 'Purchase Taxes and Charges'].includes(grid_row.doc.doctype)) {
				erpnext.taxes.set_conditional_mandatory_rate_or_amount(grid_row);
			}
		});
	},

	onload(frm) {
		if (frm.doc.docstatus === 0 && frm.get_field("taxes")) {
			frm.set_query("account_head", "taxes", (doc) => {
				let account_type = frm.cscript.tax_table === "Sales Taxes and Charges"
					? ["Tax", "Chargeable", "Expense Account"]
					: ["Tax", "Chargeable", "Income Account", "Expenses Included In Valuation"];

				return {
					query: "erpnext.controllers.queries.tax_account_query",
					filters: {
						account_type,
						company: doc.company
					}
				};
			});

			frm.set_query("cost_center", "taxes", (doc) => ({
				filters: {
					company: doc.company,
					is_group: 0
				}
			}));
		}
	},

	refresh(frm) {
		const allowed_doctypes = [
			"Sales Order Updation", "Quotation", "Sales Order", "Sales Invoice", "Delivery Note",
			"Purchase Order", "Purchase Receipt", "Purchase Invoice", "Stock Entry",
			"Stock Reconciliation", "Material Request", "Item Label"
		];

		if (frm.doc.docstatus === 0 && allowed_doctypes.includes(frm.doctype)) {
			const item_wrapper = frm.fields_dict["items"].$wrapper;
			const grid_buttons = $(item_wrapper).find(".grid-buttons");
			if (!grid_buttons.find(".custom-add-multiple-rows").length) {
				grid_buttons.append(`
					<button type="reset" class="custom-add-multiple-rows btn btn-xs btn-default" style="margin-left: 4px;">
						Add Items
					</button>
				`);
			}

			grid_buttons.find(".custom-add-multiple-rows").off().click(() => {
				frm.events.custom_add_multiple_items(frm);
			});
		}
	},

	custom_add_multiple_items(frm) {
		let multi_item_dialog = frappe.custom_mutli_add_dialog(frm);
		multi_item_dialog.show();
		multi_item_dialog.$wrapper.find('.modal-dialog').css("max-width", "1260px");
	},

	validate(frm) {
		if (frm.get_docfield("taxes")) {
			frm.get_docfield("taxes", "rate").reqd = 0;
			frm.get_docfield("taxes", "tax_amount").reqd = 0;
		}
	},

	taxes_on_form_rendered(frm) {
		erpnext.taxes.set_conditional_mandatory_rate_or_amount(frm.open_grid_row());
	}
});

function CalculateSQM(row, field, cdt, cdn) {
	if (typeof row.def_boxes !== 'undefined' && row.def_boxes > 0) {
		let total_piece = 0.0;
		switch (field) {
			case "pieces": total_piece = Math.round(row.pieces + (row.boxes * row.def_pieces)); break;
			case "boxes": total_piece = Math.round(row.boxes * row.def_pieces); break;
			case "sqm": total_piece = Math.round(row.sqm / (row.def_boxes / row.def_pieces)); break;
			case "qty": total_piece = Math.round(row.qty / (row.def_boxes / row.def_pieces)); break;
		}
		let new_sqm = parseFloat((total_piece * (row.def_boxes / row.def_pieces)).toFixed(4));
		row.boxes = new_sqm > 0 ? Math.floor((new_sqm / row.def_boxes).toFixed(4)) : Math.ceil((new_sqm / row.def_boxes).toFixed(4));
		row.pieces = total_piece % row.def_pieces;
		frappe.model.set_value(cdt, cdn, 'qty', new_sqm);
		row.sqm = new_sqm;
	}
	else {
		let val = row[field];
		row.sqm = row.boxes = row.pieces = row.qty = val;
	}
	frappe.get_doc(cdt, cdn).refresh();
	calculate_total_boxes(frappe.get_doc(cdt, cdn).__islocal ? cur_frm : frappe.ui.form.get_form(cdt, cdn));
}

function calculate_total_boxes(frm) {
	let totalqty = 0, totalbox = 0, totalpieces = 0, loosetotal = 0;
	(frm.doc.items || []).forEach(d => {
		totalqty += d.qty;
		totalbox += d.boxes;
		totalpieces += d.pieces;
		loosetotal += (d.boxes * d.def_pieces) + d.pieces;
	});
	frm.set_value("cust_total_qty", totalqty);
	frm.set_value("cust_total_box", totalbox);
	frm.set_value("cust_total_pieces", totalpieces);
	frm.set_value("custom_loose_total", loosetotal);
}

function validateBoxes(frm) {
	const qtyFieldName = frm.doc.doctype === "Purchase Receipt" ? "received_qty" : "qty";
	(frm.doc.items || []).forEach(d => {
		CalculateSQM(d, qtyFieldName, d.doctype, d.name);
	});
}

function setup_warehouse_query(warehouse, frm) {
	frm.set_query(warehouse, 'items', (doc, cdt, cdn) => {
		let row = locals[cdt][cdn];
		let filters = erpnext.queries.warehouse(frm.doc);
		if (row.item_code) {
			filters.query = "siqbal.utils.warehouse_query";
			filters.filters.push(["Bin", "item_code", "=", row.item_code]);
		}
		return filters;
	});
}

function set_address_query(frm, customer) {
	if (frappe.meta.has_field(frm.doctype, "shipping_address_name")) {
		frm.fields_dict.shipping_address_name.get_query = () => ({
			query: "siqbal.utils.address_query",
			filters: { address_title: customer }
		});
	}
	if (frappe.meta.has_field(frm.doctype, "customer_address")) {
		frm.fields_dict.customer_address.get_query = () => ({
			query: "siqbal.utils.address_query",
			filters: { address_title: customer }
		});
	}
}

function set_total_qty(frm, cdt, cdn) {
	let row = locals[cdt][cdn];
	if (row.item_code && frm.doc.company) {
		frappe.call({
			method: "siqbal.utils.get_total_item_qty",
			args: {
				company: frm.doc.company,
				item_code: row.item_code
			},
			callback(r) {
				let total_qty = r.message > 0 ? Number(r.message).toFixed(4) : '0';
				frappe.model.set_value(cdt, cdn, 'total_qty', total_qty);
			}
		});
	}
}
