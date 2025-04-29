import frappe
from frappe import _, session
from frappe.utils import comma_or, cstr, flt, has_common
from frappe.utils.background_jobs import enqueue
from collections import defaultdict
from erpnext.setup.doctype.authorization_control.authorization_control import AuthorizationControl


class OverrideAuthorizationControl(AuthorizationControl):
    custom_throw = False
    custom_doc_name = None
    custom_auth_details = defaultdict(dict)

    def get_appr_user_role(
        self,
        det,
        doctype_name,
        total,
        based_on,
        condition,
        item,
        company,
        doc_obj=None,
        item_obj=None,
    ):
        amt_list, appr_users, appr_roles = [], [], []
        users, roles = "", ""
        if det:
            for x in det:
                amt_list.append(flt(x[0]))
            max_amount = max(amt_list)

            app_dtl = frappe.db.sql(
                """select approving_user, approving_role from `tabAuthorization Rule`
                where transaction = %s and (value = %s or value > %s)
                and docstatus != 2 and based_on = %s and company = %s %s"""
                % ("%s", "%s", "%s", "%s", "%s", condition),
                (doctype_name, flt(max_amount), total, based_on, company),
            )

            if not app_dtl:
                app_dtl = frappe.db.sql(
                    """select approving_user, approving_role from `tabAuthorization Rule`
                    where transaction = %s and (value = %s or value > %s) and docstatus != 2
                    and based_on = %s and ifnull(company,'') = '' %s"""
                    % ("%s", "%s", "%s", "%s", condition),
                    (doctype_name, flt(max_amount), total, based_on),
                )

            for d in app_dtl:
                if d[0]:
                    appr_users.append(d[0])
                if d[1]:
                    appr_roles.append(d[1])

            if not has_common(appr_roles, frappe.get_roles()) and not has_common(
                appr_users, [session["user"]]
            ):
                self.custom_throw = True
                if item_obj and (appr_roles or appr_users):
                    if appr_roles:
                        self.custom_auth_details[item_obj.item_code][appr_roles[0]] = (
                            flt(max_amount)
                        )
                    elif appr_users:
                        self.custom_auth_details[item_obj.item_code][appr_users[0]] = (
                            flt(max_amount)
                        )
                if doc_obj:
                    self.custom_doc_name = doc_obj.name
                #
                # frappe.msgprint(_("Not authroized since {0} exceeds limits").format(_(based_on)))
                # frappe.throw(_("Can be approved by {0}").format(comma_or(appr_roles + appr_users)))

    def validate_auth_rule(
        self,
        doctype_name,
        total,
        based_on,
        cond,
        company,
        item="",
        doc_obj=None,
        item_obj=None,
    ):
        chk = 1
        add_cond1, add_cond2 = "", ""
        if based_on in ["Itemwise Discount", "Item Group wise Discount"]:
            add_cond1 += " and master_name = " + frappe.db.escape(cstr(item))
            itemwise_exists = frappe.db.sql(
                """select value from `tabAuthorization Rule`
                where transaction = %s and value <= %s
                and based_on = %s and company = %s and docstatus != 2 %s %s"""
                % ("%s", "%s", "%s", "%s", cond, add_cond1),
                (doctype_name, total, based_on, company),
            )

            if not itemwise_exists:
                itemwise_exists = frappe.db.sql(
                    """select value from `tabAuthorization Rule`
                    where transaction = %s and value <= %s and based_on = %s
                    and ifnull(company,'') = ''	and docstatus != 2 %s %s"""
                    % ("%s", "%s", "%s", cond, add_cond1),
                    (doctype_name, total, based_on),
                )

            if itemwise_exists:
                self.get_appr_user_role(
                    itemwise_exists,
                    doctype_name,
                    total,
                    based_on,
                    cond + add_cond1,
                    item,
                    company,
                    doc_obj,
                    item_obj,
                )
                chk = 0
        if chk == 1:
            if based_on in ["Itemwise Discount", "Item Group wise Discount"]:
                add_cond2 += " and ifnull(master_name,'') = ''"

            appr = frappe.db.sql(
                """select value from `tabAuthorization Rule`
                where transaction = %s and value <= %s and based_on = %s
                and company = %s and docstatus != 2 %s %s"""
                % ("%s", "%s", "%s", "%s", cond, add_cond2),
                (doctype_name, total, based_on, company),
            )

            if not appr:
                appr = frappe.db.sql(
                    """select value from `tabAuthorization Rule`
                    where transaction = %s and value <= %s and based_on = %s
                    and ifnull(company,'') = '' and docstatus != 2 %s %s"""
                    % ("%s", "%s", "%s", cond, add_cond2),
                    (doctype_name, total, based_on),
                )

            self.get_appr_user_role(
                appr,
                doctype_name,
                total,
                based_on,
                cond + add_cond2,
                item,
                company,
                doc_obj,
                item_obj,
            )

    def bifurcate_based_on_type(
        self, doctype_name, total, av_dis, based_on, doc_obj, val, company
    ):
        add_cond = ""
        auth_value = av_dis

        if val == 1:
            add_cond += " and system_user = {}".format(
                frappe.db.escape(session["user"])
            )
        elif val == 2:
            add_cond += " and system_role IN %s" % (
                "('" + "','".join(frappe.get_roles()) + "')"
            )
        else:
            add_cond += (
                " and ifnull(system_user,'') = '' and ifnull(system_role,'') = ''"
            )

        if based_on == "Grand Total":
            auth_value = total
        elif based_on == "Customerwise Discount":
            if doc_obj:
                if doc_obj.doctype == "Sales Invoice":
                    customer = doc_obj.customer
                else:
                    customer = doc_obj.customer_name
                add_cond = " and master_name = {}".format(frappe.db.escape(customer))
        if based_on == "Itemwise Discount":
            if doc_obj:
                for t in doc_obj.get("items"):
                    self.validate_auth_rule(
                        doctype_name,
                        t.discount_percentage,
                        based_on,
                        add_cond,
                        company,
                        t.item_code,
                        doc_obj=None,
                        item_obj=None,
                    )
        elif based_on == "Item Group wise Discount":
            if doc_obj:
                for t in doc_obj.get("items"):
                    if t.item_group:
                        self.validate_auth_rule(
                            doctype_name,
                            t.discount_percentage,
                            based_on,
                            add_cond,
                            company,
                            t.item_group,
                            doc_obj,
                            t,
                        )
        else:
            item = ""
            self.validate_auth_rule(
                doctype_name,
                auth_value,
                based_on,
                add_cond,
                company,
                item,
                doc_obj,
                item_obj=None,
            )

    def validate_approving_authority(self, doctype_name, company, total, doc_obj=""):
        if not frappe.db.count("Authorization Rule"):
            return

        self.custom_throw = False
        self.custom_doc_name = None
        self.custom_auth_details = defaultdict(dict)

        av_dis = 0
        if doc_obj:
            price_list_rate, base_rate = 0, 0
            for d in doc_obj.get("items"):
                if d.base_rate:
                    price_list_rate += flt(d.base_price_list_rate) or flt(d.base_rate)
                    base_rate += flt(d.base_rate)
            if doc_obj.get("discount_amount"):
                base_rate -= flt(doc_obj.discount_amount)

            if price_list_rate:
                av_dis = 100 - flt(base_rate * 100 / price_list_rate)

        final_based_on = [
            "Grand Total",
            "Average Discount",
            "Customerwise Discount",
            "Itemwise Discount",
            "Item Group wise Discount",
        ]

        # Check for authorization set for individual user
        based_on = [
            x[0]
            for x in frappe.db.sql(
                """select distinct based_on from `tabAuthorization Rule`
            where transaction = %s and system_user = %s
            and (company = %s or ifnull(company,'')='') and docstatus != 2""",
                (doctype_name, session["user"], company),
            )
        ]

        for d in based_on:
            self.bifurcate_based_on_type(
                doctype_name, total, av_dis, d, doc_obj, 1, company
            )

        # Remove user specific rules from global authorization rules
        for r in based_on:
            if r in final_based_on and r not in [
                "Itemwise Discount",
                "Item Group wise Discount",
            ]:
                final_based_on.remove(r)

        # Check for authorization set on particular roles
        based_on = [
            x[0]
            for x in frappe.db.sql(
                """select based_on
            from `tabAuthorization Rule`
            where transaction = %s and system_role IN (%s) and based_on IN (%s)
            and (company = %s or ifnull(company,'')='')
            and docstatus != 2
        """
                % (
                    "%s",
                    "'" + "','".join(frappe.get_roles()) + "'",
                    "'" + "','".join(final_based_on) + "'",
                    "%s",
                ),
                (doctype_name, company),
            )
        ]

        for d in based_on:
            self.bifurcate_based_on_type(
                doctype_name, total, av_dis, d, doc_obj, 2, company
            )

        # Remove role specific rules from global authorization rules
        for r in based_on:
            if r in final_based_on and r not in [
                "Itemwise Discount",
                "Item Group wise Discount",
            ]:
                final_based_on.remove(r)

        # Check for global authorization
        for g in final_based_on:
            self.bifurcate_based_on_type(
                doctype_name, total, av_dis, g, doc_obj, 0, company
            )

        if self.custom_throw:
            # set_custom_field(self.custom_doc_name, self.custom_auth_details)
            enqueue(
                set_custom_field,
                queue="default",
                timeout=60000,
                event="set_custom_field",
                docname=self.custom_doc_name,
                is_async=False,
                custom_auth_details=self.custom_auth_details,
            )
            frappe.throw(
                _(
                    "Not authroized to submit. Items {0} needs to be approved by {1}"
                ).format(
                    ", ".join(self.custom_auth_details.keys()),
                    ", ".join(
                        list(
                            set(
                                [
                                    str(d)
                                    for k, v in self.custom_auth_details.items()
                                    for d in v.keys()
                                ]
                            )
                        )
                    ),
                )
            )


def set_custom_field(docname, custom_auth_details):
    appr_roles = []
    doc = frappe.get_doc("Sales Order", docname)
    for item in doc.get("items"):
        auth_details = custom_auth_details.get(item.item_code)
        given_role = None
        if auth_details:
            for role, discount in auth_details.items():
                if discount <= item.discount_percentage:
                    item.custom_approver_role = role
                    item.needs_approval = 1
                    # item.db_set("custom_approver_role", role)
                    # item.db_set("needs_approval", 1)
                    appr_roles.append(role)

    doc.needs_approval = 1
    # doc.db_set("needs_approval", 1)
    print(appr_roles, "========================================")
    # appr_roles = list(set(apprneeds_approval_roles))
    doc.approval_by = ", ".join(appr_roles)
    # doc.db_set("approval_by", ", ".join(appr_roles))
    doc.save()
    frappe.db.commit()
