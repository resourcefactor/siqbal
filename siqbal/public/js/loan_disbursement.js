frappe.ui.form.on('Loan Disbursement', {
    applicant: function(frm) {
		if (frm.doc.applicant) {
			frappe.model.with_doc(frm.doc.applicant_type, frm.doc.applicant, function() {
				var applicant = frappe.model.get_doc(frm.doc.applicant_type, frm.doc.applicant);
				frm.set_value("applicant_name",
					applicant.employee_name || applicant.member_name);
			});
		}
		else {
			frm.set_value("applicant_name", null);
		}
	}
})