// Admin Dashboard JavaScript
const API_URL = 'https://backend-production-4bcf.up.railway.app/api';
let currentEditingProduct = null;

// Check admin auth on page load
document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();
    loadDashboardStats();
    loadProducts();
    loadUsers();
    loadOrders();
    loadSettings();
    setupTabSwitching();
    setupMobileUI();
    // If URL has ?edit=<id>, open product modal for editing
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('edit');
    if (editId) {
        switchTab('products');
        (async () => {
            try {
                const res = await fetch(`${API_URL}/products/${editId}`);
                if (!res.ok) throw new Error('Product not found');
                const product = await res.json();
                // call admin edit function to populate modal
                editProduct(product.id, product);
            } catch (e) {
                showError('productError', 'Failed to load product for editing: ' + e.message);
            }
        })();
    }
});

// Mobile / touch UI setup
function setupMobileUI() {
    const hamburger = document.getElementById('mobileHamburger');
    const sidebar = document.querySelector('.admin-sidebar');
    const userBtn = document.querySelector('.user-menu-btn');
    const dropdown = document.querySelector('.dropdown-menu');

    if (hamburger && sidebar) {
        hamburger.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('open');
            const expanded = hamburger.getAttribute('aria-expanded') === 'true';
            hamburger.setAttribute('aria-expanded', String(!expanded));
            hamburger.classList.toggle('is-active');
        });

        hamburger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                hamburger.click();
            }
        });
    }

    if (userBtn && dropdown) {
        userBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        });

        document.addEventListener('click', (ev) => {
            if (!ev.target.closest('.user-menu')) {
                dropdown.style.display = 'none';
            }
        });
    }

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768 && sidebar) {
            sidebar.classList.remove('open');
            if (hamburger) hamburger.classList.remove('is-active');
        }
    });
}

// Check if user is authenticated as admin
function checkAdminAuth() {
    // Validate token / admin access by calling a protected admin endpoint.
    (async () => {
        const user = localStorage.getItem('kayalUser');
        const token = localStorage.getItem('kayalToken');

        if (!user || !token) {
            window.location.href = 'login.html';
            return;
        }

        try {
            const res = await fetch(`${API_URL}/admin/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                // Not an admin or token invalid - redirect to login
                console.warn('Admin validation failed, redirecting to login:', res.status);
                localStorage.removeItem('kayalToken');
                window.location.href = 'login.html';
                return;
            }

            // Valid admin - show name in UI
            const userData = JSON.parse(user);
            const btn = document.querySelector('.user-menu-btn');
            if (btn) btn.textContent = `👤 ${userData.firstName} ▼`;
        } catch (err) {
            console.error('Error validating admin token:', err);
            localStorage.removeItem('kayalToken');
            window.location.href = 'login.html';
        }
    })();
}

// Setup tab switching
function setupTabSwitching() {
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = link.getAttribute('href').substring(1);
            switchTab(tabName);
        });
    });
}

// Switch between tabs
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Remove active class from all sidebar links
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tabName).classList.add('active');

    // Add active class to clicked link
    document.querySelector(`a[href="#${tabName}"]`).classList.add('active');

    // Reload data for specific tabs
    if (tabName === 'products') {
        loadProducts();
    } else if (tabName === 'users') {
        loadUsers();
    } else if (tabName === 'orders') {
        loadOrders();
    } else if (tabName === 'settings') {
        loadSettings();
    }
}

// ============================================
// DASHBOARD FUNCTIONS
// ============================================

async function loadDashboardStats() {
    try {
        const token = localStorage.getItem('kayalToken');
        const response = await fetch(`${API_URL}/admin/stats`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 403) {
                window.location.href = 'login.html';
            }
            throw new Error('Failed to load stats');
        }

        const data = await response.json();
        document.getElementById('statUsers').textContent = data.users;
        document.getElementById('statProducts').textContent = data.products;
        document.getElementById('statOrders').textContent = data.orders;
        // show revenue in INR
        const revenueUsd = parseFloat(data.revenue) || 0;
        document.getElementById('statRevenue').textContent = formatPriceINR(revenueUsd);
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Admin-side INR formatter (same exchange rate as main site)
const ADMIN_EXCHANGE_RATE = 82;
function formatPriceINR(usd) {
    const inr = Number(usd) * ADMIN_EXCHANGE_RATE;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(inr);
}

// ============================================
// PRODUCT FUNCTIONS
// ============================================

async function loadProducts() {
    try {
        const token = localStorage.getItem('kayalToken');
        const response = await fetch(`${API_URL}/admin/products`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load products');
        }

        const products = await response.json();
        displayProducts(products);
    } catch (error) {
        showError('productError', 'Error loading products: ' + error.message);
    }
}

function displayProducts(products) {
    const tbody = document.getElementById('productsTableBody');
    
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No products found</td></tr>';
        return;
    }

    tbody.innerHTML = products.map(product => `
        <tr>
            <td>${product.id}</td>
            <td>${product.name}</td>
            <td>${formatPriceINR(parseFloat(product.price).toFixed(2))}</td>
            <td>${product.stock}</td>
            <td>${product.category || '-'}</td>
            <td>
                <span class="status-badge ${product.isActive ? 'status-active' : 'status-inactive'}">
                    ${product.isActive ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <div class="table-actions">
                    <button class="action-btn action-edit" onclick="editProduct(${product.id}, ${JSON.stringify(product).replace(/"/g, '&quot;')})">Edit</button>
                    <button class="action-btn action-delete" onclick="deleteProduct(${product.id})">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openProductModal() {
    currentEditingProduct = null;
    document.getElementById('productModalTitle').textContent = 'Add New Product';
    document.getElementById('productForm').reset();
    document.getElementById('productModal').style.display = 'flex';
}

function editProduct(id, product) {
    currentEditingProduct = product;
    document.getElementById('productModalTitle').textContent = 'Edit Product';
    
    document.getElementById('productName').value = product.name;
    document.getElementById('productDescription').value = product.description || '';
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productStock').value = product.stock;
    document.getElementById('productCategory').value = product.category || '';
    
    const sizes = Array.isArray(product.sizes) ? product.sizes.join(',') : product.sizes || '';
    const colors = Array.isArray(product.colors) ? product.colors.join(',') : product.colors || '';
    
    document.getElementById('productSizes').value = sizes;
    document.getElementById('productColors').value = colors;
    document.getElementById('productImage').value = product.image || '';
    document.getElementById('productActive').checked = product.isActive;
    
    document.getElementById('productModal').style.display = 'flex';
}

function closeProductModal() {
    document.getElementById('productModal').style.display = 'none';
    currentEditingProduct = null;
}

async function handleProductSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const token = localStorage.getItem('kayalToken');

    const productData = {
        name: formData.get('name'),
        description: formData.get('description'),
        price: parseFloat(formData.get('price')),
        category: formData.get('category'),
        sizes: formData.get('sizes').split(',').map(s => s.trim()).filter(s => s),
        colors: formData.get('colors').split(',').map(c => c.trim()).filter(c => c),
        stock: parseInt(formData.get('stock')) || 0,
        image: formData.get('image'),
        isActive: formData.get('isActive') ? 1 : 0
    };

    try {
        const method = currentEditingProduct ? 'PUT' : 'POST';
        const url = currentEditingProduct 
            ? `${API_URL}/admin/products/${currentEditingProduct.id}`
            : `${API_URL}/admin/products`;

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(productData)
        });

        const data = await response.json();

        if (response.ok) {
            showSuccess('productSuccess', currentEditingProduct ? 'Product updated successfully' : 'Product created successfully');
            closeProductModal();
            loadProducts();
        } else {
            throw new Error(data.message || 'Failed to save product');
        }
    } catch (error) {
        showError('productError', error.message);
    }
}

async function deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this product?')) {
        return;
    }

    try {
        const token = localStorage.getItem('kayalToken');
        const response = await fetch(`${API_URL}/admin/products/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            showSuccess('productSuccess', 'Product deleted successfully');
            loadProducts();
        } else {
            const data = await response.json();
            throw new Error(data.message || 'Failed to delete product');
        }
    } catch (error) {
        showError('productError', error.message);
    }
}

// ============================================
// USER FUNCTIONS
// ============================================

async function loadUsers() {
    try {
        const token = localStorage.getItem('kayalToken');
        const response = await fetch(`${API_URL}/admin/users`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load users');
        }

        const users = await response.json();
        displayUsers(users);
    } catch (error) {
        showError('userError', 'Error loading users: ' + error.message);
    }
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.id}</td>
            <td>${user.firstName} ${user.lastName}</td>
            <td>${user.email}</td>
            <td>${user.phone || '-'}</td>
            <td>${user.city || '-'}</td>
            <td>${new Date(user.createdAt).toLocaleDateString()}</td>
            <td>
                <div class="table-actions">
                    <button class="action-btn action-delete" onclick="deleteUser(${user.id})">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function deleteUser(id) {
    if (!confirm('Are you sure you want to delete this user?')) {
        return;
    }

    try {
        const token = localStorage.getItem('kayalToken');
        const response = await fetch(`${API_URL}/admin/users/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            showSuccess('userSuccess', 'User deleted successfully');
            loadUsers();
        } else {
            const data = await response.json();
            throw new Error(data.message || 'Failed to delete user');
        }
    } catch (error) {
        showError('userError', error.message);
    }
}

// ============================================
// ORDER FUNCTIONS
// ============================================

async function loadOrders() {
    try {
        const token = localStorage.getItem('kayalToken');
        const response = await fetch(`${API_URL}/admin/orders`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load orders');
        }

        const orders = await response.json();
        displayOrders(orders);
    } catch (error) {
        showError('orderError', 'Error loading orders: ' + error.message);
    }
}

function displayOrders(orders) {
    const tbody = document.getElementById('ordersTableBody');
    
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No orders found</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>${order.orderNumber}</td>
            <td>${order.userId}</td>
            <td>$${parseFloat(order.totalAmount).toFixed(2)}</td>
            <td>
                <span class="status-badge status-${order.status}">
                    ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
            </td>
            <td>${new Date(order.createdAt).toLocaleDateString()}</td>
            <td>
                <div class="table-actions">
                    <button class="action-btn action-status" onclick="openOrderModal(${order.id}, '${order.status}')">Update</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openOrderModal(orderId, currentStatus) {
    document.getElementById('orderIdInput').value = orderId;
    document.getElementById('orderStatus').value = currentStatus;
    document.getElementById('orderModal').style.display = 'flex';
}

function closeOrderModal() {
    document.getElementById('orderModal').style.display = 'none';
}

async function handleOrderStatusUpdate(event) {
    event.preventDefault();

    const orderId = document.getElementById('orderIdInput').value;
    const status = document.getElementById('orderStatus').value;
    const token = localStorage.getItem('kayalToken');

    try {
        const response = await fetch(`${API_URL}/admin/orders/${orderId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status })
        });

        if (response.ok) {
            showSuccess('orderSuccess', 'Order status updated successfully');
            closeOrderModal();
            loadOrders();
        } else {
            const data = await response.json();
            throw new Error(data.message || 'Failed to update order');
        }
    } catch (error) {
        showError('orderError', error.message);
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showError(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.style.display = 'block';

    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

function showSuccess(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.style.display = 'block';

    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

function handleLogout(event) {
    event.preventDefault();

    localStorage.removeItem('kayalUser');
    localStorage.removeItem('kayalToken');

    window.location.href = 'index.html';
}

// SITE SETTINGS FUNCTIONS

// Load site settings
async function loadSettings() {
    try {
        const response = await fetch(`${API_URL}/admin/site-settings`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('kayalToken')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load settings');
        }

        const settings = await response.json();

        // Populate form fields
        settings.forEach(setting => {
            const input = document.getElementById(getInputIdForSetting(setting.setting_key));
            if (input) {
                input.value = setting.setting_value;
            }
        });

    } catch (error) {
        console.error('Error loading settings:', error);
        showError('settingsError', 'Error loading settings: ' + error.message);
    }
}

// Save site settings
async function saveSettings() {
    const settings = [
        { key: 'hero_emoji', inputId: 'heroEmoji', urlId: 'heroEmojiUrl' },
        { key: 'classic_white_emoji', inputId: 'classicWhiteEmoji', urlId: 'classicWhiteUrl' },
        { key: 'color_bold_emoji', inputId: 'colorBoldEmoji', urlId: 'colorBoldUrl' },
        { key: 'premium_comfort_emoji', inputId: 'premiumComfortEmoji', urlId: 'premiumComfortUrl' },
        { key: 'signature_edition_emoji', inputId: 'signatureEditionEmoji', urlId: 'signatureEditionUrl' },
        { key: 'shipping_icon', inputId: 'shippingIcon', urlId: 'shippingUrl' },
        { key: 'returns_icon', inputId: 'returnsIcon', urlId: 'returnsUrl' },
        { key: 'support_icon', inputId: 'supportIcon', urlId: 'supportUrl' }
    ];

    let successCount = 0;
    let errorCount = 0;

    for (const setting of settings) {
        const emojiInput = document.getElementById(setting.inputId);
        const urlInput = document.getElementById(setting.urlId);
        
        // Use URL if provided, otherwise use emoji
        const valueToSave = (urlInput && urlInput.value.trim()) || (emojiInput && emojiInput.value.trim());
        
        if (valueToSave) {
            try {
                const response = await fetch(`${API_URL}/admin/site-settings/${setting.key}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('kayalToken')}`
                    },
                    body: JSON.stringify({ value: valueToSave })
                });

                if (response.ok) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                console.error(`Error saving ${setting.key}:`, error);
                errorCount++;
            }
        }
    }

    if (errorCount === 0) {
        showSuccess('settingsSuccess', `All settings saved successfully! (${successCount} updated)`);
    } else {
        showError('settingsError', `Some settings failed to save. ${successCount} saved, ${errorCount} failed.`);
    }
}

// Helper function to get input ID for setting key
function getInputIdForSetting(key) {
    const mapping = {
        'hero_emoji': 'heroEmoji',
        'classic_white_emoji': 'classicWhiteEmoji',
        'color_bold_emoji': 'colorBoldEmoji',
        'premium_comfort_emoji': 'premiumComfortEmoji',
        'signature_edition_emoji': 'signatureEditionEmoji',
        'shipping_icon': 'shippingIcon',
        'returns_icon': 'returnsIcon',
        'support_icon': 'supportIcon'
    };
    return mapping[key];
}

// Show success message
function showSuccess(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }
}

// Show error message
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }
}

// Close modals when clicking outside
document.addEventListener('click', (event) => {
    const productModal = document.getElementById('productModal');
    const orderModal = document.getElementById('orderModal');

    if (event.target === productModal) {
        productModal.style.display = 'none';
    }

    if (event.target === orderModal) {
        orderModal.style.display = 'none';
    }
});
