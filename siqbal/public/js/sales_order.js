{% include "siqbal/public/js/utils.js" %}
{% include "siqbal/public/js/sms_manager.js" %}
{% include 'erpnext/selling/doctype/sales_order/sales_order.js' %}
frappe.provide('siqbal.selling');

frappe.ui.form.on("Sales Order", {
	refresh: function (frm) {
		set_address_query(frm, frm.doc.customer);
		if (frm.doc.docstatus == 0 && frm.doc.company) {
			$.each(frm.doc.items || [], function (i, d) {
				set_total_qty(frm, d.doctype, d.name, d.item_code);
			});
		}
		frm.remove_custom_button(__('Update Items'));
		if (frm.doc.docstatus === 1 && frm.doc.status !== 'Closed' && flt(frm.doc.per_delivered, 6) < 100 && flt(frm.doc.per_billed, 6) < 100) {
			frm.add_custom_button(__('Update Items'), () => {
				frappe.model.open_mapped_doc({
					method: "siqbal.hook_events.sales_order.make_so_updation",
					frm: cur_frm
				});
			});
		}
		if(frm.doc.docstatus == 1){
			frm.add_custom_button(__('Send SMS'), () =>{
				var sms_man = new siqbal.SMSManager(frm.doc);
			});
		}
	},
	onload: function (frm, cdt, cdn) {
		setup_warehouse_query('warehouse', frm);
		if (frm.doc.docstatus == 0) {
			calculate_total_boxes(frm);

			$.each(frm.doc.items || [], function (i, d) {
				if (d.needs_approval) {
					$("div[data-fieldname=items]").find('div.grid-row[data-idx=' + d.idx + ']').css({ 'background-color': '#ffff99' });
					$("div[data-fieldname=items]").find('div.grid-row[data-idx=' + d.idx + ']').find('.grid-static-col').css({ 'background-color': '#ffff99' });
				}
				else {
					$("div[data-fieldname=items]").find('div.grid-row[data-idx=' + d.idx + ']').css({ 'background-color': '#ffffff' });
					$("div[data-fieldname=items]").find('div.grid-row[data-idx=' + d.idx + ']').find('.grid-static-col').css({ 'background-color': '#ffffff' });
				}
			});
			
			frappe.call({
				method: "frappe.client.get",
				args: {
					doctype: "User",
					filters: { "name": frappe.session.user },
					fieldname: "user_costcenter"
				},
				callback: function (r) {
					if (r.message.user_costcenter) {
						frm.set_value("cost_center", r.message.user_costcenter);
						frappe.model.set_value(cdt, cdn, 'cost_center', r.message.user_costcenter);
					}
				}
			});

			$.each(frm.doc.items || [], function (i, d) {
				if (d.qty != d.sqm && d.item_code != 'undefined') { CalculateSQM(d, "qty", cdt, cdn); }
				if (d.sqm == d.boxes && d.pieces == d.boxes && d.def_boxes != 1 && d.item_code != 'undefined') { CalculateSQM(d, "qty", cdt, cdn); }

			});
		}

		for (let item of frm.doc.items) {
			if (item.needs_approval === 1 && item.custom_approver_role && in_list(frappe.user_roles, item.custom_approver_role)) {
				var item_childtable = $(`div[data-name='${item.name}']`);
				$(item_childtable).css('background-color', 'yellow');
			}
		}
	},
	validate: function (frm, cdt, cdn) {
		if (frm.doc.delivery_date < frm.doc.transaction_date){
			frappe.throw(__("Expected Delivery Date should be after the transaction date"));
		}

		if (frm.doc.docstatus == 0) {
			calculate_total_boxes(frm);
			frm.set_value("customer_name", frm.doc.customer_name.toUpperCase());
			if (frm.doc.title)
				frm.set_value("title", frm.doc.title.toUpperCase());
			$.each(frm.doc.taxes || [], function (i, d) {
				d.cost_center = frm.doc.cost_center;
			});

			$.each(frm.doc.items || [], function (i, d) {
				if (d.qty != d.sqm && d.item_code != 'undefined') { CalculateSQM(d, "qty", cdt, cdn); }
				if (d.sqm == d.boxes && d.pieces == d.boxes && d.def_boxes != 1 && d.item_code != 'undefined') { CalculateSQM(d, "qty", cdt, cdn); }
				d.cost_center = frm.doc.cost_center;

				if (frm.doc.company) {
					frappe.db.get_value("Company", frm.doc.company, "abbr", (r) => {
						if (r.abbr) {
							var delivery_depot = "Delivery Depot" + " - " + r.abbr;
							frm.doc.set_warehouse = delivery_depot;
							d.warehouse = delivery_depot;
						}
					});
				}
			});
			validateBoxes(frm);
		}
	},
	delivery_date: function (frm) {
		if (frm.doc.docstatus == 0) {
			$.each(frm.doc.items || [], function (i, d) { d.delivery_date = frm.doc.delivery_date; });
		}
	},
});


frappe.ui.form.on('Sales Order Item', {
	pieces: function (frm, cdt, cdn) {if (frm.doc.docstatus == 0){ CalculateSQM(locals[cdt][cdn], "pieces", cdt, cdn);} },
	sqm: function (frm, cdt, cdn) {if (frm.doc.docstatus == 0){ CalculateSQM(locals[cdt][cdn], "sqm", cdt, cdn); }},
	boxes: function (frm, cdt, cdn) {if (frm.doc.docstatus == 0){ CalculateSQM(locals[cdt][cdn], "boxes", cdt, cdn); }},
	qty: function (frm, cdt, cdn) { if (frm.doc.docstatus == 0){ CalculateSQM(locals[cdt][cdn], "qty", cdt, cdn); }},
	item_code: function(frm, cdt, cdn) {
		frappe.model.set_value(cdt, cdn, "qty", 1);
		CalculateSQM(locals[cdt][cdn], "qty", cdt, cdn);
		frappe.model.set_value(cdt, cdn, "discount_percentage", 0);
		frappe.model.set_value(cdt, cdn, "discount_amount", 0);
		set_total_qty(frm, cdt, cdn);
	}
});



siqbal.selling.SalesOrderController = class SalesOrderController extends erpnext.selling.SellingController {
	onload(doc, dt, dn) {
		super.onload(doc, dt, dn);
	}
	refresh(doc, dt, dn) {
		super.refresh(doc);
		var me = this;
		let allow_delivery = false;
		me.make_sales_invoice = this.ts_make_sales_invoice
		me.make_material_request = this.ts_make_material_request;
		me.make_delivery_note_based_on_delivery_date = this.ts_make_delivery_note_based_on_delivery_date;
		if (doc.docstatus == 1) {
			if (this.frm.has_perm("submit")) {
				if (doc.status === "On Hold") {
					// un-hold
					this.frm.add_custom_button(
						__("Resume"),
						function () {
							me.frm.cscript.update_status("Resume", "Draft");
						},
						__("Status")
					);

					if (flt(doc.per_delivered) < 100 || flt(doc.per_billed) < 100) {
						// close
						this.frm.add_custom_button(__("Close"), () => this.close_sales_order(), __("Status"));
					}
				} else if (doc.status === "Closed") {
					// un-close
					this.frm.add_custom_button(
						__("Re-open"),
						function () {
							me.frm.cscript.update_status("Re-open", "Draft");
						},
						__("Status")
					);
				}
			}
			if (doc.status !== "Closed") {
				if (doc.status !== "On Hold") {
					allow_delivery =
						this.frm.doc.items.some(
							(item) => item.delivered_by_supplier === 0 && item.qty > flt(item.delivered_qty)
						) && !this.frm.doc.skip_delivery_note;

					if (this.frm.has_perm("submit")) {
						if (flt(doc.per_delivered) < 100 || flt(doc.per_billed) < 100) {
							// hold
							this.frm.add_custom_button(
								__("Hold"),
								() => this.hold_sales_order(),
								__("Status")
							);
							// close
							this.frm.add_custom_button(
								__("Close"),
								() => this.close_sales_order(),
								__("Status")
							);
						}
					}

					if (
						(!doc.__onload || !doc.__onload.has_reserved_stock) &&
						flt(doc.per_picked) < 100 &&
						flt(doc.per_delivered) < 100 &&
						frappe.model.can_create("Pick List")
					) {
						this.frm.add_custom_button(
							__("Pick List"),
							() => this.create_pick_list(),
							__("Create")
						);
					}

					const order_is_a_sale = ["Sales", "Shopping Cart"].indexOf(doc.order_type) !== -1;
					const order_is_maintenance = ["Maintenance"].indexOf(doc.order_type) !== -1;
					// order type has been customised then show all the action buttons
					const order_is_a_custom_sale =
						["Sales", "Shopping Cart", "Maintenance"].indexOf(doc.order_type) === -1;

					// delivery note
					if (
						flt(doc.per_delivered) < 100 &&
						(order_is_a_sale || order_is_a_custom_sale) &&
						allow_delivery
					) {
						if (frappe.model.can_create("Delivery Note")) {
							this.frm.add_custom_button(
								__("Delivery Note"),
								() => this.make_delivery_note_based_on_delivery_date(true),
								__("Create")
							);
						}

						if (frappe.model.can_create("Work Order")) {
							this.frm.add_custom_button(
								__("Work Order"),
								() => this.make_work_order(),
								__("Create")
							);
						}
					}

					// sales invoice
					if (flt(doc.per_billed) < 100 && frappe.model.can_create("Sales Invoice")) {
						this.frm.add_custom_button(
							__("Sales Invoice"),
							() => me.make_sales_invoice(),
							__("Create")
						);
					}

					// material request
					if (
						(!doc.order_type ||
							((order_is_a_sale || order_is_a_custom_sale) && flt(doc.per_delivered) < 100)) &&
						frappe.model.can_create("Material Request")
					) {
						this.frm.add_custom_button(
							__("Material Request"),
							() => this.make_material_request(),
							__("Create")
						);
						this.frm.add_custom_button(
							__("Request for Raw Materials"),
							() => this.make_raw_material_request(),
							__("Create")
						);
					}

					// Make Purchase Order
					if (!this.frm.doc.is_internal_customer && frappe.model.can_create("Purchase Order")) {
						this.frm.add_custom_button(
							__("Purchase Order"),
							() => this.make_purchase_order(),
							__("Create")
						);
					}

					// maintenance
					if (flt(doc.per_delivered) < 100 && (order_is_maintenance || order_is_a_custom_sale)) {
						if (frappe.model.can_create("Maintenance Visit")) {
							this.frm.add_custom_button(
								__("Maintenance Visit"),
								() => this.make_maintenance_visit(),
								__("Create")
							);
						}
						if (frappe.model.can_create("Maintenance Schedule")) {
							this.frm.add_custom_button(
								__("Maintenance Schedule"),
								() => this.make_maintenance_schedule(),
								__("Create")
							);
						}
					}

					// project
					if (flt(doc.per_delivered) < 100 && frappe.model.can_create("Project")) {
						this.frm.add_custom_button(__("Project"), () => this.make_project(), __("Create"));
					}

					if (
						doc.docstatus === 1 &&
						!doc.inter_company_order_reference &&
						frappe.model.can_create("Purchase Order")
					) {
						let me = this;
						let internal = me.frm.doc.is_internal_customer;
						if (internal) {
							let button_label =
								me.frm.doc.company === me.frm.doc.represents_company
									? "Internal Purchase Order"
									: "Inter Company Purchase Order";

							me.frm.add_custom_button(
								button_label,
								function () {
									me.make_inter_company_order();
								},
								__("Create")
							);
						}
					}
				}
				// payment request
				if (flt(doc.per_billed) < 100 + frappe.boot.sysdefaults.over_billing_allowance) {
					this.frm.add_custom_button(
						__("Payment Request"),
						() => this.make_payment_request(),
						__("Create")
					);

					if (frappe.model.can_create("Payment Entry")) {
						this.frm.add_custom_button(
							__("Payment"),
							() => this.make_payment_entry(),
							__("Create")
						);
					}
				}
				this.frm.page.set_inner_btn_group_as_primary(__("Create"));
			}
		}

		if (this.frm.doc.docstatus === 0 && frappe.model.can_read("Quotation")) {
			this.frm.add_custom_button(
				__("Quotation"),
				function () {
					let d = erpnext.utils.map_current_doc({
						method: "erpnext.selling.doctype.quotation.quotation.make_sales_order",
						source_doctype: "Quotation",
						target: me.frm,
						setters: [
							{
								label: __("Customer"),
								fieldname: "party_name",
								fieldtype: "Link",
								options: "Customer",
								default: me.frm.doc.customer || undefined,
							},
						],
						get_query_filters: {
							company: me.frm.doc.company,
							docstatus: 1,
							status: ["!=", "Lost"],
						},
					});

					setTimeout(() => {
						d.$parent.append(`
							<span class='small text-muted'>
								${__("Note: Please create Sales Orders from individual Quotations to select from among Alternative Items.")}
							</span>
					`);
					}, 200);
				},
				__("Get Items From")
			);
		}
		this.order_type(doc);
	}

	make_purchase_order() {
		let pending_items = this.frm.doc.items.some((item) => {
			let pending_qty = flt(item.stock_qty) - flt(item.ordered_qty);
			return pending_qty > 0;
		});
		if (!pending_items) {
			frappe.throw({
				message: __("Purchase Order already created for all Sales Order items"),
				title: __("Note"),
			});
		}

		var me = this;
		var dialog = new frappe.ui.Dialog({
			title: __("Select Items"),
			size: "large",
			fields: [
				{
					fieldtype: "Check",
					label: __("Against Default Supplier"),
					fieldname: "against_default_supplier",
					default: 0,
				},
				{
					fieldname: "items_for_po",
					fieldtype: "Table",
					label: __("Select Items"),
					fields: [
						{
							fieldtype: "Data",
							fieldname: "item_code",
							label: __("Item"),
							read_only: 1,
							in_list_view: 1,
						},
						{
							fieldtype: "Data",
							fieldname: "item_name",
							label: __("Item name"),
							read_only: 1,
							in_list_view: 1,
						},
						{
							fieldtype: "Float",
							fieldname: "pending_qty",
							label: __("Pending Qty"),
							read_only: 1,
							in_list_view: 1,
						},
						{
							fieldtype: "Link",
							read_only: 1,
							fieldname: "uom",
							label: __("UOM"),
							in_list_view: 1,
						},
						{
							fieldtype: "Data",
							fieldname: "supplier",
							label: __("Supplier"),
							read_only: 1,
							in_list_view: 1,
						},
					],
				},
			],
			primary_action_label: __("Create Purchase Order"),
			primary_action(args) {
				if (!args) return;

				let selected_items = dialog.fields_dict.items_for_po.grid.get_selected_children();
				if (selected_items.length == 0) {
					frappe.throw({
						message: "Please select Items from the Table",
						title: __("Items Required"),
						indicator: "blue",
					});
				}

				dialog.hide();

				var method = args.against_default_supplier
					? "make_purchase_order_for_default_supplier"
					: "make_purchase_order";
				return frappe.call({
					method: "erpnext.selling.doctype.sales_order.sales_order." + method,
					freeze_message: __("Creating Purchase Order ..."),
					args: {
						source_name: me.frm.doc.name,
						selected_items: selected_items,
					},
					freeze: true,
					callback: function (r) {
						if (!r.exc) {
							if (!args.against_default_supplier) {
								frappe.model.sync(r.message);
								frappe.set_route("Form", r.message.doctype, r.message.name);
							} else {
								frappe.route_options = {
									sales_order: me.frm.doc.name,
								};
								frappe.set_route("List", "Purchase Order");
							}
						}
					},
				});
			},
		});

		dialog.fields_dict["against_default_supplier"].df.onchange = () => set_po_items_data(dialog);

		function set_po_items_data(dialog) {
			var against_default_supplier = dialog.get_value("against_default_supplier");
			var items_for_po = dialog.get_value("items_for_po");

			if (against_default_supplier) {
				let items_with_supplier = items_for_po.filter((item) => item.supplier);

				dialog.fields_dict["items_for_po"].df.data = items_with_supplier;
				dialog.get_field("items_for_po").refresh();
			} else {
				let po_items = [];
				me.frm.doc.items.forEach((d) => {
					let ordered_qty = me.get_ordered_qty(d, me.frm.doc);
					let pending_qty = (flt(d.stock_qty) - ordered_qty) / flt(d.conversion_factor);
					if (pending_qty > 0) {
						po_items.push({
							doctype: "Sales Order Item",
							name: d.name,
							item_name: d.item_name,
							item_code: d.item_code,
							pending_qty: pending_qty,
							uom: d.uom,
							supplier: d.supplier,
						});
					}
				});

				dialog.fields_dict["items_for_po"].df.data = po_items;
				dialog.get_field("items_for_po").refresh();
			}
		}

		set_po_items_data(dialog);
		dialog.get_field("items_for_po").grid.only_sortable();
		dialog.get_field("items_for_po").refresh();
		dialog.wrapper.find(".grid-heading-row .grid-row-check").click();
		dialog.show();
	}

	get_ordered_qty(item, so) {
		let ordered_qty = item.ordered_qty;
		if (so.packed_items && so.packed_items.length) {
			// calculate ordered qty based on packed items in case of product bundle
			let packed_items = so.packed_items.filter((pi) => pi.parent_detail_docname == item.name);
			if (packed_items && packed_items.length) {
				ordered_qty = packed_items.reduce((sum, pi) => sum + flt(pi.ordered_qty), 0);
				ordered_qty = ordered_qty / packed_items.length;
			}
		}
		return ordered_qty;
	}

	order_type() {
		this.toggle_delivery_date();
	}

	toggle_delivery_date() {
		this.frm.fields_dict.items.grid.toggle_reqd(
			"delivery_date",
			this.frm.doc.order_type == "Sales" && !this.frm.doc.skip_delivery_note
		);
	}

	ts_make_sales_invoice() {
		this.check_allow_delivery(this.frm, "Sales Invoice");
	}

	ts_make_material_request() {
		this.check_allow_delivery(this.frm, "Material Request");
	}

	ts_make_delivery_note_based_on_delivery_date() {
		this.check_allow_delivery(this.frm, "Delivery Note");
	}

	check_allow_delivery(frm, to_create) {
		var me = this;
		frappe.call({
			method: "siqbal.hook_events.sales_order.check_to_allow_delivery",
			args: {
				so: frm.docname,
				to_create: to_create
			},
			callback: function (r) {
				if (r.message && r.message == true) {
					if (to_create == "Sales Invoice") {
						frappe.model.open_mapped_doc({
							method: "erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice",
							frm: me.frm
						})
					}
					else if (to_create == "Material Request") {
						frappe.model.open_mapped_doc({
							method: "erpnext.selling.doctype.sales_order.sales_order.make_material_request",
							frm: me.frm
						})
					}
					else if (to_create == "Delivery Note") {
						me.create_new_delivery_delivery_note();
					}
				}
			}
		});
	}

	create_new_delivery_delivery_note() {
		var me = this;

		var delivery_dates = [];
		$.each(this.frm.doc.items || [], function (i, d) {
			if (!delivery_dates.includes(d.delivery_date)) {
				delivery_dates.push(d.delivery_date);
			}
		});

		var item_grid = this.frm.fields_dict["items"].grid;
		if (!item_grid.get_selected().length && delivery_dates.length > 1) {
			var dialog = new frappe.ui.Dialog({
				title: __("Select Items based on Delivery Date"),
				fields: [{ fieldtype: "HTML", fieldname: "dates_html" }]
			});

			var html = $(`
				<div style="border: 1px solid #d1d8dd">
					<div class="list-item list-item--head">
						<div class="list-item__content list-item__content--flex-2">
							${__('Delivery Date')}
						</div>
					</div>
					${delivery_dates.map(date => `
						<div class="list-item">
							<div class="list-item__content list-item__content--flex-2">
								<label>
								<input type="checkbox" data-date="${date}" checked="checked"/>
								${frappe.datetime.str_to_user(date)}
								</label>
							</div>
						</div>
					`).join("")}
				</div>
			`);

			var wrapper = dialog.fields_dict.dates_html.$wrapper;
			wrapper.html(html);

			dialog.set_primary_action(__("Select"), function () {
				var dates = wrapper.find('input[type=checkbox]:checked')
					.map((i, el) => $(el).attr('data-date')).toArray();
				if (!dates) return;

				$.each(dates, function (i, d) {
					$.each(item_grid.grid_rows || [], function (j, row) {
						if (row.doc.delivery_date == d) {
							row.doc.__checked = 1;
						}
					});
				})
				me.new_delivery_note();
				dialog.hide();
			});
			dialog.show();
		} else {
			this.new_delivery_note();
		}
	}

	new_delivery_note() {
		frappe.model.open_mapped_doc({
			method: "erpnext.selling.doctype.sales_order.sales_order.make_delivery_note",
			frm: me.frm
		})
	}
};

extend_cscript(cur_frm.cscript, new siqbal.selling.SalesOrderController({ frm: cur_frm }));