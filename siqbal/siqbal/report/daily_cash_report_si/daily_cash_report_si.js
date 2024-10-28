// Copyright (c) 2024, RC and contributors
// For license information, please see license.txt
/* eslint-disable */

frappe.query_reports["Daily Cash Report SI"] = {
  filters: [
    {
      fieldname: "company",
      label: __("Company"),
      fieldtype: "Link",
      options: "Company",
      default: frappe.defaults.get_user_default("Company"),
      reqd: 1,
    },
    {
      fieldname: "finance_book",
      label: __("Finance Book"),
      fieldtype: "Link",
      options: "Finance Book",
      hidden: 1,
    },
    {
      fieldname: "date",
      label: __("Date"),
      fieldtype: "Date",
      default: frappe.datetime.get_today(),
      reqd: 1,
      width: "60px",
    },
    {
      fieldname: "from_date",
      label: __("Date"),
      fieldtype: "Date",
      default: frappe.datetime.get_today(),
      hidden: 1,
      width: "60px",
    },
    {
      fieldname: "to_date",
      label: __("Date"),
      fieldtype: "Date",
      default: frappe.datetime.get_today(),
      hidden: 1,
      width: "60px",
    },
    {
      fieldname: "account",
      label: __("Account"),
      fieldtype: "MultiSelectList",
      options: "Account",
      reqd: 1,
      get_data: function (txt) {
        return frappe.db.get_link_options("Account", txt, {
          company: frappe.query_report.get_filter_value("company"),
          account_type: ["in", ["Bank", "Cash"]],
        });
      },
    },
    {
      fieldname: "voucher_no",
      label: __("Voucher No"),
      fieldtype: "Data",
      hidden: 1,
      on_change: function () {
        frappe.query_report.set_filter_value(
          "group_by",
          "Group by Voucher (Consolidated)"
        );
      },
    },
    {
      fieldtype: "Break",
    },
    {
      fieldname: "party_type",
      label: __("Party Type"),
      fieldtype: "Autocomplete",
      hidden: 1,
      options: Object.keys(frappe.boot.party_account_types),
      on_change: function () {
        frappe.query_report.set_filter_value("party", "");
      },
    },
    {
      fieldname: "party",
      label: __("Party"),
      fieldtype: "MultiSelectList",
      hidden: 1,
      get_data: function (txt) {
        if (!frappe.query_report.filters) return;

        let party_type = frappe.query_report.get_filter_value("party_type");
        if (!party_type) return;

        return frappe.db.get_link_options(party_type, txt);
      },
      on_change: function () {
        var party_type = frappe.query_report.get_filter_value("party_type");
        var parties = frappe.query_report.get_filter_value("party");

        if (!party_type || parties.length === 0 || parties.length > 1) {
          frappe.query_report.set_filter_value("party_name", "");
          frappe.query_report.set_filter_value("tax_id", "");
          return;
        } else {
          var party = parties[0];
          var fieldname = erpnext.utils.get_party_name(party_type) || "name";
          frappe.db.get_value(party_type, party, fieldname, function (value) {
            frappe.query_report.set_filter_value(
              "party_name",
              value[fieldname]
            );
          });

          if (party_type === "Customer" || party_type === "Supplier") {
            frappe.db.get_value(party_type, party, "tax_id", function (value) {
              frappe.query_report.set_filter_value("tax_id", value["tax_id"]);
            });
          }
        }
      },
    },
    {
      fieldname: "party_name",
      label: __("Party Name"),
      fieldtype: "Data",
      hidden: 1,
    },
    {
      fieldname: "group_by",
      label: __("Group by"),
      fieldtype: "Select",
      options: [
        "",
        {
          label: __("Group by Voucher"),
          value: "Group by Voucher",
        },
        {
          label: __("Group by Voucher (Consolidated)"),
          value: "Group by Voucher (Consolidated)",
        },
        {
          label: __("Group by Account"),
          value: "Group by Account",
        },
        {
          label: __("Group by Party"),
          value: "Group by Party",
        },
      ],
      default: "Group by Voucher (Consolidated)",
      hidden: 1,
    },
    {
      fieldname: "tax_id",
      label: __("Tax Id"),
      fieldtype: "Data",
      hidden: 1,
    },
    {
      fieldname: "presentation_currency",
      label: __("Currency"),
      fieldtype: "Select",
      hidden: 1,
      options: erpnext.get_presentation_currency_list(),
    },
    {
      fieldname: "cost_center",
      label: __("Cost Center"),
      fieldtype: "MultiSelectList",
      hidden: 1,
      get_data: function (txt) {
        return frappe.db.get_link_options("Cost Center", txt, {
          company: frappe.query_report.get_filter_value("company"),
        });
      },
    },
    {
      fieldname: "project",
      label: __("Project"),
      fieldtype: "MultiSelectList",
      hidden: 1,
      get_data: function (txt) {
        return frappe.db.get_link_options("Project", txt, {
          company: frappe.query_report.get_filter_value("company"),
        });
      },
    },
    {
      fieldname: "include_dimensions",
      label: __("Consider Accounting Dimensions"),
      fieldtype: "Check",
      default: 1,
      hidden: 1,
    },
    {
      fieldname: "show_opening_entries",
      label: __("Show Opening Entries"),
      fieldtype: "Check",
      hidden: 1,
    },
    {
      fieldname: "include_default_book_entries",
      label: __("Include Default Book Entries"),
      fieldtype: "Check",
      default: 1,
      hidden: 1,
    },
    {
      fieldname: "show_cancelled_entries",
      label: __("Show Cancelled Entries"),
      fieldtype: "Check",
      hidden: 1,
    },
    {
      fieldname: "show_net_values_in_party_account",
      label: __("Show Net Values in Party Account"),
      fieldtype: "Check",
      hidden: 1,
    },
  ],
};

erpnext.utils.add_dimensions('General Ledger', 15)
