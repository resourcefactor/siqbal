frappe.ui.form.on("Salary Slip", {
	refresh: function (frm) {
		if (frm.doc.docstatus == 1) {
			var label = __("Make Payment");
			frm.add_custom_button(label, function () {
				frappe.model.open_mapped_doc({
					method: "siqbal.utils.make_payment",
					frm: frm
				})
			});
		}
	},
	employee: function(frm) {
		if (frm.doc.employee && frm.doc.start_date && frm.doc.end_date) {
			frappe.call({
				method: 'siqbal.hook_events.salary_slip.get_employee_loan_repayments',
				args: {
					employee: frm.doc.employee,
					start_date: frm.doc.start_date,
					end_date: frm.doc.end_date
				},
				callback: function(r) {
					if (r.message) {
						r.message.forEach(d => {
							let row = frm.add_child("deductions", d);
						});
						frm.refresh_field("deductions");
					}
				}
			});
		}
	}


})


