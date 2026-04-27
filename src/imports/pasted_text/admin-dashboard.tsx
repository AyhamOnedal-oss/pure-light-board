Rename the current dashboard page title from:

* Dashboard

to:

* Dashboard Users

Then create a completely new and separate admin panel called:

* Admin Dashboard

This Admin Dashboard is the main control panel for managing all user dashboards, subscriptions, platforms, revenues, customer accounts, invoices, server services, and team management.

Apply the following requirements EXACTLY as described.

---

🌍 1. GLOBAL ADMIN LAYOUT

Create a premium SaaS-style Admin Dashboard with:

* Arabic / English language switch at the top
* Dark / Light mode switch at the top
* Notification bell / send notification tool at the top

Admin must be able to:

* Click notification button
* Open a text area / input field
* Write notification content
* Send the notification to user dashboards

Add global date filters:

* Current Month
* Previous Month
* Last 3 Months
* Last 6 Months
* Current Year

Also add custom date range:

* From
* To

Also add:

* Export / Download Excel button

---

📊 2. MAIN ADMIN DASHBOARD KPIs

Display the following KPI cards:

* Total Customers
* Active Customers
  (customers with active subscriptions)
* Inactive Customers
  (customers whose subscriptions ended)
* Total App Uninstalls
  (uninstalls from Zid and Salla)
* Total Bubble Clicks
  (sum of all clicks across all user dashboards)
* Average Response Time
  (average AI response time across all users and their customers)

These KPI cards must be animated and count upward on page load.

---

📈 3. DASHBOARD CHARTS

All charts must be:

* professional
* interactive
* animated on page load and on page entry

Add the following charts:

A. Total Words / Tokens Usage
Show:

* Total words consumed across all customers
* Paid usage
* Trial usage

Take into account:

* customers who started on trial and then converted to paid
* customers who stayed on trial
* customers who started directly on paid plans

B. Conversion to Paid Subscription
Show:

* percentage of users who started as trial and converted to paid
* support cases such as:

  * trial → paid
  * trial → another trial plan → paid

C. Total Subscriptions by Platform
Show:

* Zid
* Salla
  Split by:
* total
* active
* inactive
* cancelled

D. Plan Consumption Chart
There are 4 plans:

* Economy
* Basic
* Professional
* Business

For each plan show:

* number of subscribers
* average words usage
* total words usage

E. New Subscribers List
Show latest subscribers with max visible 5 rows, with internal scroll if more.

Each row must show:

* Store logo
* Store name
* Platform
* Subscription date
* Total tokens
* Used tokens

F. Server / Service Usage Chart
Track connected services such as:

* Supabase
* Hostinger
* Resend
* OpenAI

Show their plan usage / service consumption percentages based on backend integration.

G. First Subscription Type Chart
Show what customers selected as their first subscription:

* Trial
* Economy
* Basic
* Professional
* Business

H. Plan Upgrade / Conversion Flow Chart
Show transitions such as:

* Trial → Economy
* Trial → Basic
* Trial → Professional
* Economy → Basic
* Economy → Professional
* Basic → Professional
* Professional → Business

I. Customer Source Comparison Chart
Compare customer sources:

* Zid
* Salla

J. Uninstall Comparison Chart
Compare app uninstalls between:

* Zid
* Salla

K. Subscribers by Plan – Zid
Show:

* Economy
* Basic
* Professional
* Business
* Total

L. Subscribers by Plan – Salla
Show:

* Economy
* Basic
* Professional
* Business
* Total

M. Server Status Section
Show connected service status:

* Supabase
* OpenAI
* Hostinger
* Resend

Statuses:

* Connected
* Disconnected
  Use clear colors:
* Green
* Red
* other status colors where needed

---

📑 4. REPORTS SECTION

Create Reports menu with 3 subpages:

* Zid
* Salla
* All

Each reports page must include filters:

* Current Month
* Previous Month
* Last 3 Months
* Last 6 Months
* Current Year
* Custom date range (From / To)
* Export Excel

---

📘 5. REPORTS – ZID

Show:

* Total Subscribers
* Total Revenue
* Pending Amount

Important note:
Pending amount means subscription amounts that have not yet been manually confirmed as received.

Include plan details table for Zid:

* Trial
* Economy
* Basic
* Professional
* Business

Show for each:

* Plan price
* Number of subscribers
* Total amount

Include revenue chart by time:

* If yearly filter: by months
* If monthly filter: by days
* If 3 months / 6 months: grouped accordingly

Count only actual paid subscribers in paid-plan charts, not trial users.

---

📙 6. REPORTS – SALLA

Create the exact same structure and logic as Zid reports:

* Total Subscribers
* Total Revenue
* Pending Amount
* Plan details
* Revenue chart
* Same filters
* Same export behavior

---

📗 7. REPORTS – ALL

Combine Zid + Salla data and show:

* Total Subscribers
* Total Revenue Including Tax
* Tax
* Revenue Excluding Tax
* Net Profit
* Pending Amount

Also show:

* platform comparison summary:

  * Zid subscribers
  * Zid revenue
  * Zid pending amount
  * Salla subscribers
  * Salla revenue
  * Salla pending amount

Include combined plan details:

* Economy
* Basic
* Professional
* Business

Show total subscribers and total amount across both platforms.

---

👥 8. CUSTOMER MANAGEMENT

Create Customer Management page with:

Search by:

* Store Name
* Email
* Phone Number

Filters:

* Platform (Zid / Salla)
* Plan
* Status (Active / Inactive / Cancelled)

Customer list columns:

* Store logo
* Store name
* Platform
* Plan
* Usage percentage
* Words / tokens
* Actions:

  * Login as Customer
  * Customer Details

---

👤 9. CUSTOMER DETAILS PAGE

When clicking Customer Details, show:

A. Store Information

* Store name
* Store logo
* Email
* Owner name
* Customer phone number
* Usage
* Registration date
* Trial word usage
* Paid word usage
* Chat rating
* Bubble clicks
* Platform
* Current / latest / expired plan

B. Customer Subscriptions
Show:

* Current subscription plan
* Subscription status
* Start date
* End date
* Used words
* Trial words
* Animated words usage chart
* Previous subscriptions

Actions:

* End subscription
* Add words
* Renew trial subscription

C. Customer Activity / Events Log
Track actions such as:

* Admin logged in as customer
* Subscription expired
* Subscription renewed
* Words exhausted
* Other customer events

D. Customer Notes
Allow:

* Add note
* Show staff member name
* Show note content
* Track support actions performed for this customer

E. Customer Conversations
Show this customer’s conversations

F. Customer Tickets
Show this customer’s tickets

G. Customer Account Actions
Allow:

* Disable account
* Enable account
* Send email reset link
* Send password reset link
* Enable bubble
* Disable bubble
* Refresh link
* Delete account

Also place a top button:

* Login as Customer

---

💳 10. INVOICES & PAYMENTS

Create section:

* Subscription Payments
* Server Invoices
* Other Invoices

---

💰 11. SUBSCRIPTION PAYMENTS

This section manages pending subscription payments coming from Zid and Salla.

Create separate areas for:

* Pending Zid Payments
* Pending Salla Payments

Each row should show:

* Store name
* Subscription date
* Plan
* Amount
* Payment status:

  * Paid (Green)
  * Pending (Orange)

Admin must be able to:

* mark payment as received
* assign payment month / payment date
* confirm pending payments cleanly and easily

Design this section in a clear and efficient way so pending payments are not confused.

---

🖥️ 12. SERVER INVOICES

Create Server Invoices section with list and Create Invoice button.

Fields:

* Server name
* Plan type
* Amount
* Tax
* Amount after tax
* Start date
* Duration
* End date
* Renewal type (Auto / Manual)
* Usage percentage
* Status:

  * Active
  * Inactive
  * Expired
  * Cancelled

Actions:

* Edit
* Delete

When editing or creating:

* Tax is fixed at 15%
* Checkbox to enable / disable tax
* If tax enabled:
  auto calculate amount after tax
* If tax disabled:
  tax = 0

Start date, duration, and end date should be managed professionally and consistently.

---

🧾 13. OTHER INVOICES

Create another invoice section for general invoices.

Fields:

* Invoice name
* Vendor / Party
* Details
* Amount
* Tax
* Amount after tax
* Invoice date
* Invoice number
* Status:

  * Paid
  * Unpaid

Actions:

* Edit
* Delete

Create / Edit form must include:

* Invoice name
* Vendor
* Details
* Amount
* Tax enable / disable
* Tax fixed at 15% when enabled
* Invoice date
* Invoice number
* Cancel
* Save / Update

---

👨‍💼 14. TEAM MANAGEMENT

Create Team Management page.

KPI cards:

* Total Employees
* Active Employees

Employee list columns:

* Employee name
* Email
* Phone number
* Permissions
* Status (Active / Inactive)
* Actions:

  * Edit
  * Disable
  * Re-send password / reset link
  * Delete

When editing employee:

* Name
* Email
* Phone
* Permissions
* Status
* Re-send password
* Save Changes
* Cancel

Permissions examples:

* Main Dashboard
* Customer Management
* Team Management
* Reports
* Invoices
* Servers

Add button:

* Add Employee

Add Employee form:

* Employee name
* Email
* Phone
* Permissions
* Status (Active / Inactive)

---

🎨 15. DESIGN REQUIREMENTS

The Admin Dashboard must be:

* more advanced than user dashboard
* highly professional
* visually clean
* scalable
* ready for backend integration
* fully responsive

All charts must be:

* animated
* interactive
* smooth
* professional SaaS style

All sections must support:

* Arabic / English
* Light / Dark mode
* persistence after refresh
* proper save behavior

---

⚠️ FINAL INSTRUCTION

Apply exactly what is listed above.
This is a separate Admin Dashboard for platform management.
Do not replace or break the existing Dashboard Users.
Keep Dashboard Users as the user-facing dashboard, and Admin Dashboard as a new independent admin control panel.
