/* ============================================
   FreelanceDesk — Application Logic
   Vanilla JS, localStorage persistence
   ============================================ */

(function () {
    'use strict';

    // ============================================
    // CONSTANTS
    // ============================================
    var STORAGE_KEYS = {
        PROFILE: 'fd_profile',
        SETTINGS: 'fd_settings',
        CLIENTS: 'fd_clients',
        INVOICES: 'fd_invoices',
        CONTRACTS: 'fd_contracts'
    };

    var CONTRACT_TEMPLATES = {
        'web-development': {
            title: 'Web Development Agreement',
            description: 'Agreement for web development services including design, development, and deployment.',
            scope: '1. Requirements Analysis & Planning\n2. UI/UX Design\n3. Frontend Development\n4. Backend Development\n5. Testing & Quality Assurance\n6. Deployment & Launch\n7. 30-day Post-launch Support',
            paymentTerms: 'Payment schedule:\n- 30% upfront deposit upon signing\n- 40% upon design approval\n- 30% upon project completion and delivery'
        },
        'design': {
            title: 'Design Services Agreement',
            description: 'Agreement for professional design services including branding, visual design, and asset creation.',
            scope: '1. Discovery & Research\n2. Concept Development (3 initial concepts)\n3. Design Refinement (2 rounds of revisions)\n4. Final Asset Delivery (all formats)\n5. Brand Guidelines Document',
            paymentTerms: 'Payment schedule:\n- 50% upfront deposit upon signing\n- 50% upon final delivery and approval'
        },
        'consulting': {
            title: 'Consulting Services Agreement',
            description: 'Agreement for professional consulting services including analysis, strategy, and recommendations.',
            scope: '1. Initial Assessment & Discovery\n2. Research & Analysis\n3. Strategy Development\n4. Recommendation Report\n5. Implementation Support\n6. Follow-up Review (30 days)',
            paymentTerms: 'Billed at agreed hourly/daily rate.\nInvoiced monthly with Net 30 payment terms.'
        }
    };

    var VIEW_TITLES = {
        dashboard: 'Dashboard',
        invoices: 'Invoices',
        contracts: 'Contracts',
        clients: 'Clients',
        settings: 'Settings'
    };

    // ============================================
    // STORAGE MANAGER
    // ============================================
    var Storage = {
        get: function (key) {
            try {
                var data = localStorage.getItem(key);
                return data ? JSON.parse(data) : null;
            } catch (e) {
                return null;
            }
        },
        set: function (key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
                console.error('Storage error:', e);
            }
        },
        remove: function (key) {
            localStorage.removeItem(key);
        }
    };

    // ============================================
    // STATE
    // ============================================
    var state = {
        currentView: 'dashboard',
        profile: {},
        settings: {},
        clients: [],
        invoices: [],
        contracts: []
    };

    // ============================================
    // UTILITIES
    // ============================================
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    function getSettings() {
        return {
            currency: state.settings.currency || '$',
            taxRate: parseFloat(state.settings.taxRate) || 0,
            paymentTerms: state.settings.paymentTerms || 'net-30',
            invoicePrefix: state.settings.invoicePrefix || 'INV'
        };
    }

    function formatCurrency(amount) {
        var s = getSettings();
        var num = parseFloat(amount) || 0;
        return s.currency + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        var d = new Date(dateStr);
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }

    function formatDateShort(dateStr) {
        if (!dateStr) return '—';
        var d = new Date(dateStr);
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[d.getMonth()] + ' ' + d.getDate();
    }

    function todayStr() {
        return new Date().toISOString().split('T')[0];
    }

    function timeAgo(dateStr) {
        var now = new Date();
        var past = new Date(dateStr);
        var diff = Math.floor((now - past) / 1000);
        if (diff < 60) return 'just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
        return formatDateShort(dateStr);
    }

    function getInitials(name) {
        if (!name) return '??';
        var parts = name.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.substring(0, 2).toUpperCase();
    }

    function getClientName(clientId) {
        var client = state.clients.find(function (c) { return c.id === clientId; });
        return client ? client.name : 'Unknown Client';
    }

    function getNextInvoiceNumber() {
        var s = getSettings();
        var maxNum = 0;
        state.invoices.forEach(function (inv) {
            var num = parseInt(inv.number.replace(s.invoicePrefix + '-', ''), 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
        });
        var next = maxNum + 1;
        return s.invoicePrefix + '-' + String(next).padStart(3, '0');
    }

    function getDueDate(issuedDate, terms) {
        var d = new Date(issuedDate);
        switch (terms) {
            case 'due-on-receipt': break;
            case 'net-15': d.setDate(d.getDate() + 15); break;
            case 'net-30': d.setDate(d.getDate() + 30); break;
            case 'net-45': d.setDate(d.getDate() + 45); break;
            case 'net-60': d.setDate(d.getDate() + 60); break;
            default: d.setDate(d.getDate() + 30);
        }
        return d.toISOString().split('T')[0];
    }

    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // ============================================
    // DATA LOADING
    // ============================================
    function loadData() {
        state.profile = Storage.get(STORAGE_KEYS.PROFILE) || {};
        state.settings = Storage.get(STORAGE_KEYS.SETTINGS) || {};
        state.clients = Storage.get(STORAGE_KEYS.CLIENTS) || [];
        state.invoices = Storage.get(STORAGE_KEYS.INVOICES) || [];
        state.contracts = Storage.get(STORAGE_KEYS.CONTRACTS) || [];
        updateAutoStatuses();
    }

    function saveClients() { Storage.set(STORAGE_KEYS.CLIENTS, state.clients); }
    function saveInvoices() { Storage.set(STORAGE_KEYS.INVOICES, state.invoices); }
    function saveContracts() { Storage.set(STORAGE_KEYS.CONTRACTS, state.contracts); }
    function saveProfile() { Storage.set(STORAGE_KEYS.PROFILE, state.profile); }
    function saveSettings() { Storage.set(STORAGE_KEYS.SETTINGS, state.settings); }

    function updateAutoStatuses() {
        var today = todayStr();
        var changed = false;

        // Auto-overdue invoices
        state.invoices.forEach(function (inv) {
            if ((inv.status === 'sent' || inv.status === 'draft') && inv.dueDate && inv.dueDate < today) {
                inv.status = 'overdue';
                changed = true;
            }
        });
        if (changed) saveInvoices();

        // Auto-expire contracts
        changed = false;
        state.contracts.forEach(function (c) {
            if (c.status === 'active' && c.endDate && c.endDate < today) {
                c.status = 'expired';
                changed = true;
            }
        });
        if (changed) saveContracts();
    }

    // ============================================
    // NAVIGATION
    // ============================================
    function navigate(viewName) {
        if (!VIEW_TITLES[viewName]) viewName = 'dashboard';
        state.currentView = viewName;

        // Update nav links
        document.querySelectorAll('.nav-link').forEach(function (link) {
            link.classList.toggle('active', link.getAttribute('data-view') === viewName);
        });

        // Update views
        document.querySelectorAll('.view').forEach(function (v) {
            v.classList.remove('active');
        });
        var target = document.getElementById('view-' + viewName);
        if (target) target.classList.add('active');

        // Update title
        document.getElementById('page-title').textContent = VIEW_TITLES[viewName];

        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('active');

        // Render view content
        renderView(viewName);
    }

    function renderView(viewName) {
        switch (viewName) {
            case 'dashboard': renderDashboard(); break;
            case 'invoices': renderInvoices(); break;
            case 'contracts': renderContracts(); break;
            case 'clients': renderClients(); break;
            case 'settings': renderSettingsView(); break;
        }
    }

    // ============================================
    // MODAL SYSTEM
    // ============================================
    function openModal(title, contentHtml, wide) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = contentHtml;
        var container = document.getElementById('modal-container');
        container.style.maxWidth = wide ? '800px' : '680px';
        document.getElementById('modal-overlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        document.getElementById('modal-overlay').classList.remove('active');
        document.body.style.overflow = '';
    }

    // ============================================
    // CONFIRM DIALOG
    // ============================================
    var confirmCallback = null;

    function showConfirm(title, message, btnText, callback) {
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        document.getElementById('confirm-ok').textContent = btnText || 'Delete';
        document.getElementById('confirm-overlay').classList.add('active');
        confirmCallback = callback;
    }

    function closeConfirm() {
        document.getElementById('confirm-overlay').classList.remove('active');
        confirmCallback = null;
    }

    // ============================================
    // TOAST SYSTEM
    // ============================================
    function showToast(message) {
        var container = document.getElementById('toast-container');
        var toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = '<svg class="toast-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>' + escapeHtml(message);
        container.appendChild(toast);

        setTimeout(function () {
            toast.classList.add('toast-exit');
            setTimeout(function () {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, 3000);
    }

    // ============================================
    // SIDEBAR PROFILE
    // ============================================
    function updateSidebarProfile() {
        var name = state.profile.name || 'Freelancer';
        var business = state.profile.business || 'Set up your profile';
        document.getElementById('sidebar-username').textContent = name;
        document.getElementById('sidebar-business').textContent = business;
        document.getElementById('sidebar-avatar').textContent = getInitials(name);
    }

    // ============================================
    // DASHBOARD
    // ============================================
    function renderDashboard() {
        // Stats
        var totalRevenue = 0;
        var pending = 0;

        state.invoices.forEach(function (inv) {
            if (inv.status === 'paid') totalRevenue += parseFloat(inv.total) || 0;
            if (inv.status === 'sent' || inv.status === 'overdue') pending += parseFloat(inv.total) || 0;
        });

        var activeContracts = state.contracts.filter(function (c) { return c.status === 'active'; }).length;

        document.getElementById('stat-revenue').textContent = formatCurrency(totalRevenue);
        document.getElementById('stat-pending').textContent = formatCurrency(pending);
        document.getElementById('stat-contracts').textContent = activeContracts;
        document.getElementById('stat-clients').textContent = state.clients.length;

        // Chart
        renderRevenueChart();

        // Activity feed
        renderActivityFeed();
    }

    function renderRevenueChart() {
        var canvas = document.getElementById('revenue-chart');
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        var rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        ctx.scale(2, 2);
        var w = rect.width;
        var h = rect.height;

        // Clear
        ctx.clearRect(0, 0, w, h);

        // Get last 6 months data
        var months = [];
        var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        var now = new Date();

        for (var i = 5; i >= 0; i--) {
            var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({
                key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
                label: monthNames[d.getMonth()],
                value: 0
            });
        }

        // Sum paid invoices by month
        state.invoices.forEach(function (inv) {
            if (inv.status === 'paid' && inv.issuedDate) {
                var key = inv.issuedDate.substring(0, 7);
                months.forEach(function (m) {
                    if (m.key === key) m.value += parseFloat(inv.total) || 0;
                });
            }
        });

        var maxVal = Math.max.apply(null, months.map(function (m) { return m.value; }));
        if (maxVal === 0) maxVal = 1000;

        // Drawing params
        var padding = { top: 20, right: 20, bottom: 40, left: 60 };
        var chartW = w - padding.left - padding.right;
        var chartH = h - padding.top - padding.bottom;
        var barCount = months.length;
        var barGap = 16;
        var barWidth = (chartW - barGap * (barCount - 1)) / barCount;

        // Y-axis grid lines
        var gridLines = 4;
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 1;
        ctx.font = '11px JetBrains Mono, monospace';
        ctx.fillStyle = '#aaaaaa';
        ctx.textAlign = 'right';

        for (var g = 0; g <= gridLines; g++) {
            var yVal = (maxVal / gridLines) * g;
            var yPos = padding.top + chartH - (chartH * (g / gridLines));
            ctx.beginPath();
            ctx.moveTo(padding.left, yPos);
            ctx.lineTo(w - padding.right, yPos);
            ctx.stroke();

            var label = yVal >= 1000 ? (yVal / 1000).toFixed(1) + 'k' : yVal.toFixed(0);
            ctx.fillText(label, padding.left - 10, yPos + 4);
        }

        // Bars
        months.forEach(function (m, idx) {
            var x = padding.left + idx * (barWidth + barGap);
            var barH = (m.value / maxVal) * chartH;
            var y = padding.top + chartH - barH;

            // Bar
            ctx.fillStyle = '#111111';
            var radius = 4;
            if (barH > radius * 2) {
                ctx.beginPath();
                ctx.moveTo(x + radius, y);
                ctx.lineTo(x + barWidth - radius, y);
                ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
                ctx.lineTo(x + barWidth, padding.top + chartH);
                ctx.lineTo(x, padding.top + chartH);
                ctx.lineTo(x, y + radius);
                ctx.quadraticCurveTo(x, y, x + radius, y);
                ctx.closePath();
                ctx.fill();
            } else if (barH > 0) {
                ctx.fillRect(x, y, barWidth, barH);
            } else {
                // Draw a thin line for zero
                ctx.fillStyle = '#e0e0e0';
                ctx.fillRect(x, padding.top + chartH - 2, barWidth, 2);
                ctx.fillStyle = '#111111';
            }

            // Month label
            ctx.fillStyle = '#888888';
            ctx.textAlign = 'center';
            ctx.font = '11px Inter, sans-serif';
            ctx.fillText(m.label, x + barWidth / 2, padding.top + chartH + 24);
        });
    }

    function renderActivityFeed() {
        var feed = document.getElementById('activity-feed');
        var activities = [];

        state.invoices.forEach(function (inv) {
            activities.push({
                type: 'invoice',
                text: '<strong>' + escapeHtml(inv.number) + '</strong> — ' + escapeHtml(getClientName(inv.clientId)) + ' — ' + formatCurrency(inv.total),
                date: inv.createdAt
            });
        });

        state.contracts.forEach(function (c) {
            activities.push({
                type: 'contract',
                text: '<strong>' + escapeHtml(c.title) + '</strong> — ' + escapeHtml(getClientName(c.clientId)),
                date: c.createdAt
            });
        });

        state.clients.forEach(function (cl) {
            activities.push({
                type: 'client',
                text: 'New client <strong>' + escapeHtml(cl.name) + '</strong> added',
                date: cl.createdAt
            });
        });

        activities.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
        activities = activities.slice(0, 10);

        if (activities.length === 0) {
            feed.innerHTML = '<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cccccc" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><p>No recent activity</p><span>Create your first invoice, contract, or add a client to get started.</span></div>';
            return;
        }

        var html = '';
        activities.forEach(function (a) {
            html += '<div class="activity-item">';
            html += '<div class="activity-dot ' + a.type + '"></div>';
            html += '<div class="activity-text">' + a.text + '</div>';
            html += '<div class="activity-time">' + timeAgo(a.date) + '</div>';
            html += '</div>';
        });
        feed.innerHTML = html;
    }

    // ============================================
    // INVOICES
    // ============================================
    function renderInvoices(search, filter) {
        search = search || document.getElementById('invoice-search').value.toLowerCase();
        filter = filter || document.getElementById('invoice-filter').value;

        var filtered = state.invoices.filter(function (inv) {
            if (filter !== 'all' && inv.status !== filter) return false;
            if (search) {
                var clientName = getClientName(inv.clientId).toLowerCase();
                return inv.number.toLowerCase().indexOf(search) !== -1 || clientName.indexOf(search) !== -1;
            }
            return true;
        });

        // Sort by creation date descending
        filtered.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

        var tbody = document.getElementById('invoices-tbody');
        var emptyEl = document.getElementById('invoices-empty');
        var tableWrapper = document.getElementById('invoices-table-wrapper');

        if (state.invoices.length === 0) {
            tableWrapper.style.display = 'none';
            emptyEl.style.display = 'flex';
            return;
        }

        tableWrapper.style.display = 'block';
        emptyEl.style.display = 'none';

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#999;">No invoices match your search.</td></tr>';
            return;
        }

        var html = '';
        filtered.forEach(function (inv) {
            html += '<tr>';
            html += '<td class="col-number">' + escapeHtml(inv.number) + '</td>';
            html += '<td>' + escapeHtml(getClientName(inv.clientId)) + '</td>';
            html += '<td class="col-amount">' + formatCurrency(inv.total) + '</td>';
            html += '<td><span class="badge badge-' + inv.status + '">' + inv.status + '</span></td>';
            html += '<td class="col-date">' + formatDate(inv.issuedDate) + '</td>';
            html += '<td class="col-date">' + formatDate(inv.dueDate) + '</td>';
            html += '<td><div class="col-actions">';
            html += '<button class="action-btn" onclick="App.previewInvoice(\'' + inv.id + '\')" title="Preview"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>';
            html += '<button class="action-btn" onclick="App.editInvoice(\'' + inv.id + '\')" title="Edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>';
            if (inv.status !== 'paid') {
                html += '<button class="action-btn" onclick="App.markInvoicePaid(\'' + inv.id + '\')" title="Mark Paid"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></button>';
            }
            html += '<button class="action-btn delete" onclick="App.deleteInvoice(\'' + inv.id + '\')" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>';
            html += '</div></td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;
    }

    function openInvoiceForm(existingInvoice) {
        var inv = existingInvoice || null;
        var isEdit = !!inv;
        var s = getSettings();

        var clientOptions = '<option value="">Select client...</option>';
        state.clients.forEach(function (c) {
            var sel = inv && inv.clientId === c.id ? ' selected' : '';
            clientOptions += '<option value="' + c.id + '"' + sel + '>' + escapeHtml(c.name) + '</option>';
        });

        var items = inv ? inv.items : [{ description: '', qty: 1, rate: 0 }];
        var taxRate = inv ? inv.taxRate : s.taxRate;
        var discount = inv ? inv.discount : 0;

        var html = '<form id="invoice-form">';
        html += '<div class="form-row">';
        html += '<div class="form-group"><label>Client</label><select id="inv-client" required>' + clientOptions + '</select></div>';
        html += '<div class="form-group"><label>Invoice #</label><input type="text" id="inv-number" value="' + escapeHtml(inv ? inv.number : getNextInvoiceNumber()) + '" required></div>';
        html += '</div>';
        html += '<div class="form-row">';
        html += '<div class="form-group"><label>Issue Date</label><input type="date" id="inv-issued" value="' + (inv ? inv.issuedDate : todayStr()) + '" required></div>';
        html += '<div class="form-group"><label>Due Date</label><input type="date" id="inv-due" value="' + (inv ? inv.dueDate : getDueDate(todayStr(), s.paymentTerms)) + '" required></div>';
        html += '</div>';
        html += '<div class="form-row">';
        html += '<div class="form-group"><label>Status</label><select id="inv-status"><option value="draft"' + (inv && inv.status === 'draft' ? ' selected' : '') + '>Draft</option><option value="sent"' + (inv && inv.status === 'sent' ? ' selected' : '') + '>Sent</option><option value="paid"' + (inv && inv.status === 'paid' ? ' selected' : '') + '>Paid</option></select></div>';
        html += '<div class="form-group"></div>';
        html += '</div>';

        // Line items
        html += '<div style="margin-top:20px;margin-bottom:8px;"><label style="font-size:0.75rem;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:0.04em;">Line Items</label></div>';
        html += '<div class="line-items-header"><span>Description</span><span>Qty</span><span>Rate</span><span>Amount</span><span></span></div>';
        html += '<div id="line-items-container">';
        items.forEach(function (item, idx) {
            html += buildLineItemRow(item, idx);
        });
        html += '</div>';
        html += '<button type="button" class="add-item-btn" id="btn-add-line-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Line Item</button>';

        // Totals
        html += '<div class="invoice-totals">';
        html += '<div class="totals-row"><span>Subtotal</span><span id="inv-subtotal">' + formatCurrency(0) + '</span></div>';
        html += '<div class="totals-input-row"><span>Tax (%)</span><input type="number" id="inv-tax" value="' + taxRate + '" min="0" max="100" step="0.5"></div>';
        html += '<div class="totals-input-row"><span>Discount (' + s.currency + ')</span><input type="number" id="inv-discount" value="' + discount + '" min="0" step="0.01"></div>';
        html += '<div class="totals-row total-final"><span>Total</span><span id="inv-total">' + formatCurrency(0) + '</span></div>';
        html += '</div>';

        // Notes
        html += '<div class="form-group full-width" style="margin-top:20px;"><label>Notes</label><textarea id="inv-notes" rows="3" placeholder="Payment instructions, thank you message, etc.">' + escapeHtml(inv ? inv.notes : '') + '</textarea></div>';

        html += '<div class="form-actions">';
        html += '<button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>';
        html += '<button type="submit" class="btn btn-primary">' + (isEdit ? 'Update Invoice' : 'Create Invoice') + '</button>';
        html += '</div>';
        html += '</form>';

        openModal(isEdit ? 'Edit Invoice' : 'New Invoice', html, true);

        // Attach events
        document.getElementById('invoice-form').addEventListener('submit', function (e) {
            e.preventDefault();
            saveInvoiceForm(inv ? inv.id : null);
        });

        document.getElementById('btn-add-line-item').addEventListener('click', addLineItem);
        attachLineItemEvents();
        recalcInvoice();
    }

    function buildLineItemRow(item, idx) {
        var amount = (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0);
        var html = '<div class="line-item-row" data-idx="' + idx + '">';
        html += '<input type="text" class="li-desc" value="' + escapeHtml(item.description) + '" placeholder="Description">';
        html += '<input type="number" class="li-qty" value="' + (item.qty || 1) + '" min="0" step="1">';
        html += '<input type="number" class="li-rate" value="' + (item.rate || 0) + '" min="0" step="0.01">';
        html += '<div class="item-amount">' + formatCurrency(amount) + '</div>';
        html += '<button type="button" class="remove-item-btn" title="Remove">&times;</button>';
        html += '</div>';
        return html;
    }

    function addLineItem() {
        var container = document.getElementById('line-items-container');
        var idx = container.querySelectorAll('.line-item-row').length;
        var div = document.createElement('div');
        div.innerHTML = buildLineItemRow({ description: '', qty: 1, rate: 0 }, idx);
        container.appendChild(div.firstElementChild);
        attachLineItemEvents();
    }

    function attachLineItemEvents() {
        var container = document.getElementById('line-items-container');
        if (!container) return;

        container.querySelectorAll('.li-qty, .li-rate').forEach(function (input) {
            input.removeEventListener('input', recalcInvoice);
            input.addEventListener('input', recalcInvoice);
        });

        container.querySelectorAll('.remove-item-btn').forEach(function (btn) {
            btn.onclick = function () {
                var rows = container.querySelectorAll('.line-item-row');
                if (rows.length <= 1) return;
                btn.closest('.line-item-row').remove();
                recalcInvoice();
            };
        });

        var taxInput = document.getElementById('inv-tax');
        var discInput = document.getElementById('inv-discount');
        if (taxInput) {
            taxInput.removeEventListener('input', recalcInvoice);
            taxInput.addEventListener('input', recalcInvoice);
        }
        if (discInput) {
            discInput.removeEventListener('input', recalcInvoice);
            discInput.addEventListener('input', recalcInvoice);
        }
    }

    function recalcInvoice() {
        var container = document.getElementById('line-items-container');
        if (!container) return;

        var subtotal = 0;
        container.querySelectorAll('.line-item-row').forEach(function (row) {
            var qty = parseFloat(row.querySelector('.li-qty').value) || 0;
            var rate = parseFloat(row.querySelector('.li-rate').value) || 0;
            var amount = qty * rate;
            subtotal += amount;
            row.querySelector('.item-amount').textContent = formatCurrency(amount);
        });

        var taxRate = parseFloat(document.getElementById('inv-tax').value) || 0;
        var discount = parseFloat(document.getElementById('inv-discount').value) || 0;
        var taxAmount = subtotal * (taxRate / 100);
        var total = subtotal + taxAmount - discount;
        if (total < 0) total = 0;

        document.getElementById('inv-subtotal').textContent = formatCurrency(subtotal);
        document.getElementById('inv-total').textContent = formatCurrency(total);
    }

    function saveInvoiceForm(existingId) {
        var clientId = document.getElementById('inv-client').value;
        if (!clientId) {
            showToast('Please select a client');
            return;
        }

        var items = [];
        document.querySelectorAll('#line-items-container .line-item-row').forEach(function (row) {
            items.push({
                description: row.querySelector('.li-desc').value,
                qty: parseFloat(row.querySelector('.li-qty').value) || 0,
                rate: parseFloat(row.querySelector('.li-rate').value) || 0
            });
        });

        var subtotal = 0;
        items.forEach(function (item) { subtotal += item.qty * item.rate; });
        var taxRate = parseFloat(document.getElementById('inv-tax').value) || 0;
        var discount = parseFloat(document.getElementById('inv-discount').value) || 0;
        var taxAmount = subtotal * (taxRate / 100);
        var total = subtotal + taxAmount - discount;
        if (total < 0) total = 0;

        var data = {
            id: existingId || generateId(),
            number: document.getElementById('inv-number').value,
            clientId: clientId,
            items: items,
            subtotal: subtotal,
            taxRate: taxRate,
            taxAmount: taxAmount,
            discount: discount,
            total: total,
            status: document.getElementById('inv-status').value,
            issuedDate: document.getElementById('inv-issued').value,
            dueDate: document.getElementById('inv-due').value,
            notes: document.getElementById('inv-notes').value,
            createdAt: existingId ? (state.invoices.find(function (i) { return i.id === existingId; }) || {}).createdAt || new Date().toISOString() : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (existingId) {
            var idx = state.invoices.findIndex(function (i) { return i.id === existingId; });
            if (idx !== -1) state.invoices[idx] = data;
        } else {
            state.invoices.push(data);
        }

        saveInvoices();
        closeModal();
        renderInvoices();
        showToast(existingId ? 'Invoice updated' : 'Invoice created');
    }

    function previewInvoice(id) {
        var inv = state.invoices.find(function (i) { return i.id === id; });
        if (!inv) return;

        var client = state.clients.find(function (c) { return c.id === inv.clientId; });
        var clientName = client ? client.name : 'Unknown Client';
        var clientEmail = client ? client.email : '';
        var clientCompany = client ? client.company : '';
        var clientAddress = client ? client.address : '';

        var profileName = state.profile.name || 'Your Name';
        var profileBusiness = state.profile.business || '';
        var profileEmail = state.profile.email || '';
        var profileAddress = state.profile.address || '';
        var profilePhone = state.profile.phone || '';
        var profileWebsite = state.profile.website || '';

        var html = '<div class="invoice-preview">';

        // Header
        html += '<div class="preview-header">';
        html += '<div class="preview-brand">';
        html += '<h2>' + escapeHtml(profileBusiness || profileName) + '</h2>';
        var brandDetails = [];
        if (profileEmail) brandDetails.push(escapeHtml(profileEmail));
        if (profilePhone) brandDetails.push(escapeHtml(profilePhone));
        if (profileWebsite) brandDetails.push(escapeHtml(profileWebsite));
        if (profileAddress) brandDetails.push(escapeHtml(profileAddress));
        if (brandDetails.length) html += '<p>' + brandDetails.join('<br>') + '</p>';
        html += '</div>';

        html += '<div class="preview-invoice-info">';
        html += '<h3>' + escapeHtml(inv.number) + '</h3>';
        html += '<p>Issued: ' + formatDate(inv.issuedDate) + '<br>Due: ' + formatDate(inv.dueDate) + '<br>Status: ' + inv.status.toUpperCase() + '</p>';
        html += '</div>';
        html += '</div>';

        // Parties
        html += '<div class="preview-parties">';
        html += '<div class="preview-party"><h4>From</h4><p><strong>' + escapeHtml(profileName) + '</strong>';
        if (profileBusiness) html += '<br>' + escapeHtml(profileBusiness);
        if (profileAddress) html += '<br>' + escapeHtml(profileAddress);
        html += '</p></div>';
        html += '<div class="preview-party"><h4>Bill To</h4><p><strong>' + escapeHtml(clientName) + '</strong>';
        if (clientCompany) html += '<br>' + escapeHtml(clientCompany);
        if (clientEmail) html += '<br>' + escapeHtml(clientEmail);
        if (clientAddress) html += '<br>' + escapeHtml(clientAddress);
        html += '</p></div>';
        html += '</div>';

        // Items table
        html += '<table class="preview-table"><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>';
        (inv.items || []).forEach(function (item) {
            var amount = (item.qty || 0) * (item.rate || 0);
            html += '<tr><td>' + escapeHtml(item.description || '—') + '</td><td class="align-center">' + item.qty + '</td><td class="align-right">' + formatCurrency(item.rate) + '</td><td>' + formatCurrency(amount) + '</td></tr>';
        });
        html += '</tbody></table>';

        // Totals
        html += '<div class="preview-totals"><div class="preview-totals-table">';
        html += '<div class="totals-row"><span>Subtotal</span><span>' + formatCurrency(inv.subtotal) + '</span></div>';
        if (inv.taxRate) html += '<div class="totals-row"><span>Tax (' + inv.taxRate + '%)</span><span>' + formatCurrency(inv.taxAmount) + '</span></div>';
        if (inv.discount) html += '<div class="totals-row"><span>Discount</span><span>-' + formatCurrency(inv.discount) + '</span></div>';
        html += '<div class="totals-row total-final"><span>Total</span><span>' + formatCurrency(inv.total) + '</span></div>';
        html += '</div></div>';

        // Notes
        if (inv.notes) {
            html += '<div class="preview-notes"><strong>Notes</strong>' + escapeHtml(inv.notes) + '</div>';
        }

        // Footer
        html += '<div class="preview-footer">Thank you for your business</div>';
        html += '</div>';

        openModal('Invoice Preview', html, true);
    }

    function markInvoicePaid(id) {
        var inv = state.invoices.find(function (i) { return i.id === id; });
        if (inv) {
            inv.status = 'paid';
            inv.updatedAt = new Date().toISOString();
            saveInvoices();
            renderInvoices();
            showToast('Invoice marked as paid');
        }
    }

    function deleteInvoice(id) {
        showConfirm('Delete Invoice', 'Are you sure you want to delete this invoice? This action cannot be undone.', 'Delete', function () {
            state.invoices = state.invoices.filter(function (i) { return i.id !== id; });
            saveInvoices();
            renderInvoices();
            showToast('Invoice deleted');
        });
    }

    // ============================================
    // CONTRACTS
    // ============================================
    function renderContracts(search, filter) {
        search = search || document.getElementById('contract-search').value.toLowerCase();
        filter = filter || document.getElementById('contract-filter').value;

        var filtered = state.contracts.filter(function (c) {
            if (filter !== 'all' && c.status !== filter) return false;
            if (search) {
                var clientName = getClientName(c.clientId).toLowerCase();
                return c.title.toLowerCase().indexOf(search) !== -1 || clientName.indexOf(search) !== -1;
            }
            return true;
        });

        filtered.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

        var tbody = document.getElementById('contracts-tbody');
        var emptyEl = document.getElementById('contracts-empty');
        var tableWrapper = document.getElementById('contracts-table-wrapper');

        if (state.contracts.length === 0) {
            tableWrapper.style.display = 'none';
            emptyEl.style.display = 'flex';
            return;
        }

        tableWrapper.style.display = 'block';
        emptyEl.style.display = 'none';

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#999;">No contracts match your search.</td></tr>';
            return;
        }

        var html = '';
        filtered.forEach(function (c) {
            html += '<tr>';
            html += '<td style="font-weight:600;color:#111;">' + escapeHtml(c.title) + '</td>';
            html += '<td>' + escapeHtml(getClientName(c.clientId)) + '</td>';
            html += '<td class="col-amount">' + formatCurrency(c.value) + '</td>';
            html += '<td><span class="badge badge-' + c.status + '">' + c.status + '</span></td>';
            html += '<td class="col-date">' + formatDate(c.startDate) + '</td>';
            html += '<td class="col-date">' + formatDate(c.endDate) + '</td>';
            html += '<td><div class="col-actions">';
            html += '<button class="action-btn" onclick="App.viewContract(\'' + c.id + '\')" title="View"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>';
            html += '<button class="action-btn" onclick="App.editContract(\'' + c.id + '\')" title="Edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>';
            html += '<button class="action-btn delete" onclick="App.deleteContract(\'' + c.id + '\')" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>';
            html += '</div></td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;
    }

    function openContractForm(existingContract) {
        var c = existingContract || null;
        var isEdit = !!c;

        var clientOptions = '<option value="">Select client...</option>';
        state.clients.forEach(function (cl) {
            var sel = c && c.clientId === cl.id ? ' selected' : '';
            clientOptions += '<option value="' + cl.id + '"' + sel + '>' + escapeHtml(cl.name) + '</option>';
        });

        var html = '';

        // Template selector (only for new)
        if (!isEdit) {
            html += '<div style="margin-bottom:20px;"><label style="font-size:0.75rem;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:0.04em;display:block;margin-bottom:8px;">Start from Template</label>';
            html += '<div class="template-cards">';
            html += '<div class="template-card" data-template="web-development"><h4>Web Development</h4><p>Full-stack project</p></div>';
            html += '<div class="template-card" data-template="design"><h4>Design</h4><p>Branding & visual</p></div>';
            html += '<div class="template-card" data-template="consulting"><h4>Consulting</h4><p>Strategy & advice</p></div>';
            html += '</div></div>';
        }

        html += '<form id="contract-form">';
        html += '<div class="form-row">';
        html += '<div class="form-group"><label>Client</label><select id="ct-client" required>' + clientOptions + '</select></div>';
        html += '<div class="form-group"><label>Status</label><select id="ct-status"><option value="draft"' + (c && c.status === 'draft' ? ' selected' : '') + '>Draft</option><option value="active"' + (c && c.status === 'active' ? ' selected' : '') + '>Active</option><option value="completed"' + (c && c.status === 'completed' ? ' selected' : '') + '>Completed</option></select></div>';
        html += '</div>';
        html += '<div class="form-group full-width" style="margin-bottom:16px;"><label>Title</label><input type="text" id="ct-title" value="' + escapeHtml(c ? c.title : '') + '" placeholder="Project or agreement title" required></div>';
        html += '<div class="form-group full-width" style="margin-bottom:16px;"><label>Description</label><textarea id="ct-description" rows="2" placeholder="Brief description...">' + escapeHtml(c ? c.description : '') + '</textarea></div>';
        html += '<div class="form-group full-width" style="margin-bottom:16px;"><label>Scope of Work</label><textarea id="ct-scope" rows="4" placeholder="Deliverables and milestones...">' + escapeHtml(c ? c.scope : '') + '</textarea></div>';
        html += '<div class="form-row">';
        html += '<div class="form-group"><label>Start Date</label><input type="date" id="ct-start" value="' + (c ? c.startDate : todayStr()) + '" required></div>';
        html += '<div class="form-group"><label>End Date</label><input type="date" id="ct-end" value="' + (c ? c.endDate : '') + '" required></div>';
        html += '</div>';
        html += '<div class="form-row">';
        html += '<div class="form-group"><label>Contract Value</label><input type="number" id="ct-value" value="' + (c ? c.value : '') + '" min="0" step="0.01" placeholder="0.00" required></div>';
        html += '<div class="form-group"><label>Payment Terms</label><textarea id="ct-payment" rows="2" placeholder="Payment schedule...">' + escapeHtml(c ? c.paymentTerms : '') + '</textarea></div>';
        html += '</div>';
        html += '<div class="form-actions">';
        html += '<button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>';
        html += '<button type="submit" class="btn btn-primary">' + (isEdit ? 'Update Contract' : 'Create Contract') + '</button>';
        html += '</div>';
        html += '</form>';

        openModal(isEdit ? 'Edit Contract' : 'New Contract', html, true);

        // Template card events
        if (!isEdit) {
            document.querySelectorAll('.template-card').forEach(function (card) {
                card.addEventListener('click', function () {
                    document.querySelectorAll('.template-card').forEach(function (tc) { tc.classList.remove('selected'); });
                    card.classList.add('selected');
                    var tpl = CONTRACT_TEMPLATES[card.getAttribute('data-template')];
                    if (tpl) {
                        document.getElementById('ct-title').value = tpl.title;
                        document.getElementById('ct-description').value = tpl.description;
                        document.getElementById('ct-scope').value = tpl.scope;
                        document.getElementById('ct-payment').value = tpl.paymentTerms;
                    }
                });
            });
        }

        document.getElementById('contract-form').addEventListener('submit', function (e) {
            e.preventDefault();
            saveContractForm(c ? c.id : null);
        });
    }

    function saveContractForm(existingId) {
        var clientId = document.getElementById('ct-client').value;
        if (!clientId) {
            showToast('Please select a client');
            return;
        }

        var data = {
            id: existingId || generateId(),
            clientId: clientId,
            title: document.getElementById('ct-title').value,
            description: document.getElementById('ct-description').value,
            scope: document.getElementById('ct-scope').value,
            startDate: document.getElementById('ct-start').value,
            endDate: document.getElementById('ct-end').value,
            value: parseFloat(document.getElementById('ct-value').value) || 0,
            paymentTerms: document.getElementById('ct-payment').value,
            status: document.getElementById('ct-status').value,
            createdAt: existingId ? (state.contracts.find(function (c) { return c.id === existingId; }) || {}).createdAt || new Date().toISOString() : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (existingId) {
            var idx = state.contracts.findIndex(function (c) { return c.id === existingId; });
            if (idx !== -1) state.contracts[idx] = data;
        } else {
            state.contracts.push(data);
        }

        saveContracts();
        closeModal();
        renderContracts();
        showToast(existingId ? 'Contract updated' : 'Contract created');
    }

    function viewContract(id) {
        var c = state.contracts.find(function (ct) { return ct.id === id; });
        if (!c) return;

        var clientName = getClientName(c.clientId);

        var html = '<div class="contract-meta-grid">';
        html += '<div class="contract-meta-item"><label>Client</label><span>' + escapeHtml(clientName) + '</span></div>';
        html += '<div class="contract-meta-item"><label>Value</label><span>' + formatCurrency(c.value) + '</span></div>';
        html += '<div class="contract-meta-item"><label>Status</label><span class="badge badge-' + c.status + '">' + c.status + '</span></div>';
        html += '<div class="contract-meta-item"><label>Start Date</label><span>' + formatDate(c.startDate) + '</span></div>';
        html += '<div class="contract-meta-item"><label>End Date</label><span>' + formatDate(c.endDate) + '</span></div>';
        html += '<div class="contract-meta-item"><label>Created</label><span>' + formatDate(c.createdAt) + '</span></div>';
        html += '</div>';

        if (c.description) {
            html += '<div class="contract-detail-section"><h4>Description</h4><p>' + escapeHtml(c.description) + '</p></div>';
        }
        if (c.scope) {
            html += '<div class="contract-detail-section"><h4>Scope of Work</h4><p>' + escapeHtml(c.scope) + '</p></div>';
        }
        if (c.paymentTerms) {
            html += '<div class="contract-detail-section"><h4>Payment Terms</h4><p>' + escapeHtml(c.paymentTerms) + '</p></div>';
        }

        openModal(c.title, html, true);
    }

    function deleteContract(id) {
        showConfirm('Delete Contract', 'Are you sure you want to delete this contract? This action cannot be undone.', 'Delete', function () {
            state.contracts = state.contracts.filter(function (c) { return c.id !== id; });
            saveContracts();
            renderContracts();
            showToast('Contract deleted');
        });
    }

    // ============================================
    // CLIENTS
    // ============================================
    function renderClients(search) {
        search = search || document.getElementById('client-search').value.toLowerCase();

        var filtered = state.clients.filter(function (c) {
            if (search) {
                return c.name.toLowerCase().indexOf(search) !== -1 ||
                    (c.email && c.email.toLowerCase().indexOf(search) !== -1) ||
                    (c.company && c.company.toLowerCase().indexOf(search) !== -1);
            }
            return true;
        });

        filtered.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

        var grid = document.getElementById('clients-grid');
        var emptyEl = document.getElementById('clients-empty');

        if (state.clients.length === 0) {
            grid.style.display = 'none';
            emptyEl.style.display = 'flex';
            return;
        }

        grid.style.display = 'grid';
        emptyEl.style.display = 'none';

        if (filtered.length === 0) {
            grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><p>No clients match your search.</p></div>';
            return;
        }

        var html = '';
        filtered.forEach(function (c) {
            var invoiceTotal = 0;
            var invoiceCount = 0;
            state.invoices.forEach(function (inv) {
                if (inv.clientId === c.id) {
                    invoiceTotal += parseFloat(inv.total) || 0;
                    invoiceCount++;
                }
            });
            var contractCount = state.contracts.filter(function (ct) { return ct.clientId === c.id; }).length;

            html += '<div class="client-card" onclick="App.viewClient(\'' + c.id + '\')">';
            html += '<div class="client-card-header">';
            html += '<div class="client-avatar">' + getInitials(c.name) + '</div>';
            html += '<div>';
            html += '<div class="client-name">' + escapeHtml(c.name) + '</div>';
            if (c.company) html += '<div class="client-company">' + escapeHtml(c.company) + '</div>';
            html += '</div>';
            html += '</div>';
            html += '<div class="client-meta">';
            html += '<div class="client-meta-item"><span class="client-meta-label">Invoiced</span><span class="client-meta-value">' + formatCurrency(invoiceTotal) + '</span></div>';
            html += '<div class="client-meta-item"><span class="client-meta-label">Invoices</span><span class="client-meta-value">' + invoiceCount + '</span></div>';
            html += '<div class="client-meta-item"><span class="client-meta-label">Contracts</span><span class="client-meta-value">' + contractCount + '</span></div>';
            html += '</div>';
            html += '</div>';
        });
        grid.innerHTML = html;
    }

    function openClientForm(existingClient) {
        var c = existingClient || null;
        var isEdit = !!c;

        var html = '<form id="client-form">';
        html += '<div class="form-row">';
        html += '<div class="form-group"><label>Full Name</label><input type="text" id="cl-name" value="' + escapeHtml(c ? c.name : '') + '" placeholder="Client name" required></div>';
        html += '<div class="form-group"><label>Email</label><input type="email" id="cl-email" value="' + escapeHtml(c ? c.email : '') + '" placeholder="client@example.com"></div>';
        html += '</div>';
        html += '<div class="form-row">';
        html += '<div class="form-group"><label>Phone</label><input type="tel" id="cl-phone" value="' + escapeHtml(c ? c.phone : '') + '" placeholder="+1 (555) 000-0000"></div>';
        html += '<div class="form-group"><label>Company</label><input type="text" id="cl-company" value="' + escapeHtml(c ? c.company : '') + '" placeholder="Company name"></div>';
        html += '</div>';
        html += '<div class="form-group full-width" style="margin-bottom:16px;"><label>Address</label><textarea id="cl-address" rows="3" placeholder="Street, City, State, ZIP">' + escapeHtml(c ? c.address : '') + '</textarea></div>';
        html += '<div class="form-actions">';
        html += '<button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>';
        html += '<button type="submit" class="btn btn-primary">' + (isEdit ? 'Update Client' : 'Add Client') + '</button>';
        html += '</div>';
        html += '</form>';

        openModal(isEdit ? 'Edit Client' : 'Add Client', html);

        document.getElementById('client-form').addEventListener('submit', function (e) {
            e.preventDefault();
            saveClientForm(c ? c.id : null);
        });
    }

    function saveClientForm(existingId) {
        var name = document.getElementById('cl-name').value.trim();
        if (!name) {
            showToast('Please enter a client name');
            return;
        }

        var data = {
            id: existingId || generateId(),
            name: name,
            email: document.getElementById('cl-email').value.trim(),
            phone: document.getElementById('cl-phone').value.trim(),
            company: document.getElementById('cl-company').value.trim(),
            address: document.getElementById('cl-address').value.trim(),
            createdAt: existingId ? (state.clients.find(function (c) { return c.id === existingId; }) || {}).createdAt || new Date().toISOString() : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (existingId) {
            var idx = state.clients.findIndex(function (c) { return c.id === existingId; });
            if (idx !== -1) state.clients[idx] = data;
        } else {
            state.clients.push(data);
        }

        saveClients();
        closeModal();
        renderClients();
        showToast(existingId ? 'Client updated' : 'Client added');
    }

    function viewClient(id) {
        var c = state.clients.find(function (cl) { return cl.id === id; });
        if (!c) return;

        var clientInvoices = state.invoices.filter(function (inv) { return inv.clientId === c.id; });
        var clientContracts = state.contracts.filter(function (ct) { return ct.clientId === c.id; });

        var html = '<div class="client-profile-header">';
        html += '<div class="client-profile-avatar">' + getInitials(c.name) + '</div>';
        html += '<div class="client-profile-info"><h3>' + escapeHtml(c.name) + '</h3>';
        if (c.company) html += '<p>' + escapeHtml(c.company) + '</p>';
        html += '</div>';
        html += '</div>';

        html += '<div class="client-profile-details">';
        html += '<div class="client-detail-item"><span class="client-detail-label">Email</span><span class="client-detail-value">' + escapeHtml(c.email || '—') + '</span></div>';
        html += '<div class="client-detail-item"><span class="client-detail-label">Phone</span><span class="client-detail-value">' + escapeHtml(c.phone || '—') + '</span></div>';
        html += '<div class="client-detail-item"><span class="client-detail-label">Address</span><span class="client-detail-value">' + escapeHtml(c.address || '—') + '</span></div>';
        html += '<div class="client-detail-item"><span class="client-detail-label">Added</span><span class="client-detail-value">' + formatDate(c.createdAt) + '</span></div>';
        html += '</div>';

        // Invoices
        html += '<h4 class="client-section-title">Invoices (' + clientInvoices.length + ')</h4>';
        if (clientInvoices.length > 0) {
            html += '<table class="client-mini-table"><thead><tr><th>Number</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>';
            clientInvoices.forEach(function (inv) {
                html += '<tr><td>' + escapeHtml(inv.number) + '</td><td style="font-family:JetBrains Mono,monospace;font-weight:600;">' + formatCurrency(inv.total) + '</td><td><span class="badge badge-' + inv.status + '">' + inv.status + '</span></td><td>' + formatDate(inv.issuedDate) + '</td></tr>';
            });
            html += '</tbody></table>';
        } else {
            html += '<p style="font-size:0.8125rem;color:#999;margin-bottom:24px;">No invoices yet for this client.</p>';
        }

        // Contracts
        html += '<h4 class="client-section-title">Contracts (' + clientContracts.length + ')</h4>';
        if (clientContracts.length > 0) {
            html += '<table class="client-mini-table"><thead><tr><th>Title</th><th>Value</th><th>Status</th></tr></thead><tbody>';
            clientContracts.forEach(function (ct) {
                html += '<tr><td>' + escapeHtml(ct.title) + '</td><td style="font-family:JetBrains Mono,monospace;font-weight:600;">' + formatCurrency(ct.value) + '</td><td><span class="badge badge-' + ct.status + '">' + ct.status + '</span></td></tr>';
            });
            html += '</tbody></table>';
        } else {
            html += '<p style="font-size:0.8125rem;color:#999;margin-bottom:24px;">No contracts yet for this client.</p>';
        }

        // Actions
        html += '<div class="form-actions">';
        html += '<button type="button" class="btn btn-danger" onclick="App.deleteClient(\'' + c.id + '\')">Delete Client</button>';
        html += '<button type="button" class="btn btn-secondary" onclick="App.editClient(\'' + c.id + '\')">Edit Client</button>';
        html += '</div>';

        openModal(c.name, html, true);
    }

    function deleteClient(id) {
        showConfirm('Delete Client', 'Are you sure? All linked invoices and contracts will NOT be deleted, but will show "Unknown Client".', 'Delete', function () {
            state.clients = state.clients.filter(function (c) { return c.id !== id; });
            saveClients();
            closeModal();
            renderClients();
            showToast('Client deleted');
        });
    }

    // ============================================
    // SETTINGS
    // ============================================
    function renderSettingsView() {
        // Populate profile form
        document.getElementById('profile-name').value = state.profile.name || '';
        document.getElementById('profile-email').value = state.profile.email || '';
        document.getElementById('profile-business').value = state.profile.business || '';
        document.getElementById('profile-phone').value = state.profile.phone || '';
        document.getElementById('profile-website').value = state.profile.website || '';
        document.getElementById('profile-address').value = state.profile.address || '';

        // Populate defaults form
        document.getElementById('default-currency').value = state.settings.currency || '$';
        document.getElementById('default-tax').value = state.settings.taxRate || '';
        document.getElementById('default-terms').value = state.settings.paymentTerms || 'net-30';
        document.getElementById('default-prefix').value = state.settings.invoicePrefix || 'INV';
    }

    function handleProfileSave(e) {
        e.preventDefault();
        state.profile = {
            name: document.getElementById('profile-name').value.trim(),
            email: document.getElementById('profile-email').value.trim(),
            business: document.getElementById('profile-business').value.trim(),
            phone: document.getElementById('profile-phone').value.trim(),
            website: document.getElementById('profile-website').value.trim(),
            address: document.getElementById('profile-address').value.trim()
        };
        saveProfile();
        updateSidebarProfile();
        showToast('Profile saved');
    }

    function handleDefaultsSave(e) {
        e.preventDefault();
        state.settings = {
            currency: document.getElementById('default-currency').value.trim() || '$',
            taxRate: parseFloat(document.getElementById('default-tax').value) || 0,
            paymentTerms: document.getElementById('default-terms').value,
            invoicePrefix: document.getElementById('default-prefix').value.trim() || 'INV'
        };
        saveSettings();
        showToast('Invoice defaults saved');
    }

    function exportData() {
        var data = {
            exportedAt: new Date().toISOString(),
            version: '1.0',
            profile: state.profile,
            settings: state.settings,
            clients: state.clients,
            invoices: state.invoices,
            contracts: state.contracts
        };

        var json = JSON.stringify(data, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'freelancedesk-backup-' + todayStr() + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Data exported successfully');
    }

    function importData(file) {
        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var data = JSON.parse(e.target.result);
                if (data.clients && data.invoices && data.contracts) {
                    state.profile = data.profile || {};
                    state.settings = data.settings || {};
                    state.clients = data.clients || [];
                    state.invoices = data.invoices || [];
                    state.contracts = data.contracts || [];

                    saveProfile();
                    saveSettings();
                    saveClients();
                    saveInvoices();
                    saveContracts();

                    updateSidebarProfile();
                    renderView(state.currentView);
                    showToast('Data imported successfully');
                } else {
                    showToast('Invalid backup file format');
                }
            } catch (err) {
                showToast('Failed to parse file');
            }
        };
        reader.readAsText(file);
    }

    function clearAllData() {
        showConfirm('Clear All Data', 'This will permanently delete ALL your invoices, contracts, clients, and settings. This cannot be undone.', 'Clear Everything', function () {
            Object.keys(STORAGE_KEYS).forEach(function (key) {
                Storage.remove(STORAGE_KEYS[key]);
            });
            state.profile = {};
            state.settings = {};
            state.clients = [];
            state.invoices = [];
            state.contracts = [];

            updateSidebarProfile();
            renderView(state.currentView);
            showToast('All data cleared');
        });
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================
    function setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(function (link) {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                navigate(link.getAttribute('data-view'));
            });
        });

        // Mobile menu
        document.getElementById('menu-toggle').addEventListener('click', function () {
            document.getElementById('sidebar').classList.toggle('open');
            document.getElementById('sidebar-overlay').classList.toggle('active');
        });

        document.getElementById('sidebar-overlay').addEventListener('click', function () {
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebar-overlay').classList.remove('active');
        });

        // Modal close
        document.getElementById('modal-close').addEventListener('click', closeModal);
        document.getElementById('modal-overlay').addEventListener('click', function (e) {
            if (e.target === document.getElementById('modal-overlay')) closeModal();
        });

        // Confirm dialog
        document.getElementById('confirm-cancel').addEventListener('click', closeConfirm);
        document.getElementById('confirm-ok').addEventListener('click', function () {
            if (confirmCallback) confirmCallback();
            closeConfirm();
        });
        document.getElementById('confirm-overlay').addEventListener('click', function (e) {
            if (e.target === document.getElementById('confirm-overlay')) closeConfirm();
        });

        // Quick actions
        document.getElementById('qa-invoice').addEventListener('click', function () { openInvoiceForm(); });
        document.getElementById('qa-contract').addEventListener('click', function () { openContractForm(); });
        document.getElementById('qa-client').addEventListener('click', function () { openClientForm(); });

        // Invoices
        document.getElementById('btn-new-invoice').addEventListener('click', function () { openInvoiceForm(); });
        document.getElementById('btn-empty-invoice').addEventListener('click', function () { openInvoiceForm(); });
        document.getElementById('invoice-search').addEventListener('input', function () { renderInvoices(); });
        document.getElementById('invoice-filter').addEventListener('change', function () { renderInvoices(); });

        // Contracts
        document.getElementById('btn-new-contract').addEventListener('click', function () { openContractForm(); });
        document.getElementById('btn-empty-contract').addEventListener('click', function () { openContractForm(); });
        document.getElementById('contract-search').addEventListener('input', function () { renderContracts(); });
        document.getElementById('contract-filter').addEventListener('change', function () { renderContracts(); });

        // Clients
        document.getElementById('btn-new-client').addEventListener('click', function () { openClientForm(); });
        document.getElementById('btn-empty-client').addEventListener('click', function () { openClientForm(); });
        document.getElementById('client-search').addEventListener('input', function () { renderClients(); });

        // Settings
        document.getElementById('profile-form').addEventListener('submit', handleProfileSave);
        document.getElementById('defaults-form').addEventListener('submit', handleDefaultsSave);
        document.getElementById('btn-export').addEventListener('click', exportData);
        document.getElementById('import-file').addEventListener('change', function (e) {
            if (e.target.files.length > 0) {
                importData(e.target.files[0]);
                e.target.value = '';
            }
        });
        document.getElementById('btn-clear-data').addEventListener('click', clearAllData);

        // Hash navigation
        window.addEventListener('hashchange', function () {
            var hash = window.location.hash.replace('#', '') || 'dashboard';
            navigate(hash);
        });

        // Keyboard
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                if (document.getElementById('confirm-overlay').classList.contains('active')) {
                    closeConfirm();
                } else if (document.getElementById('modal-overlay').classList.contains('active')) {
                    closeModal();
                }
            }
        });

        // Window resize (chart redraw)
        var resizeTimer;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                if (state.currentView === 'dashboard') renderRevenueChart();
            }, 250);
        });
    }

    // ============================================
    // CURRENT DATE
    // ============================================
    function updateCurrentDate() {
        var now = new Date();
        var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        document.getElementById('current-date').textContent = days[now.getDay()] + ', ' + months[now.getMonth()] + ' ' + now.getDate();
    }

    // ============================================
    // INITIALIZATION
    // ============================================
    function init() {
        loadData();
        updateCurrentDate();
        updateSidebarProfile();
        setupEventListeners();

        // Navigate based on hash or default to dashboard
        var hash = window.location.hash.replace('#', '') || 'dashboard';
        navigate(hash);
    }

    // ============================================
    // PUBLIC API (for inline onclick handlers)
    // ============================================
    window.App = {
        closeModal: closeModal,
        previewInvoice: previewInvoice,
        editInvoice: function (id) {
            var inv = state.invoices.find(function (i) { return i.id === id; });
            if (inv) openInvoiceForm(inv);
        },
        markInvoicePaid: markInvoicePaid,
        deleteInvoice: deleteInvoice,
        viewContract: viewContract,
        editContract: function (id) {
            var c = state.contracts.find(function (ct) { return ct.id === id; });
            if (c) openContractForm(c);
        },
        deleteContract: deleteContract,
        viewClient: viewClient,
        editClient: function (id) {
            var c = state.clients.find(function (cl) { return cl.id === id; });
            if (c) {
                closeModal();
                setTimeout(function () { openClientForm(c); }, 200);
            }
        },
        deleteClient: function (id) {
            closeModal();
            setTimeout(function () { deleteClient(id); }, 200);
        }
    };

    // ============================================
    // BOOT
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
