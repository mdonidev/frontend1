// Authentication functions
const API_URL = 'https://backend-production-4bcf.up.railway.app/api';

// Load user from localStorage on page load
document.addEventListener('DOMContentLoaded', () => {
    loadUserSession();
    setupPasswordStrength();
});

// Load user session
function loadUserSession() {
    const user = localStorage.getItem('kayalUser');
    if (user) {
        updateNavForLoggedIn(JSON.parse(user));
    }
}

// Update navigation for logged in users
function updateNavForLoggedIn(user) {
    const navMenu = document.querySelector('.nav-menu');
    if (!navMenu) return;

    // Remove login link if exists
    const loginLink = navMenu.querySelector('a[href="login.html"]');
    if (loginLink) {
        loginLink.remove();
    }

    // Add user menu
    const userMenuHTML = `
        <li class="user-menu">
            <button class="user-menu-btn">👤 ${user.firstName} ▼</button>
            <div class="dropdown-menu" style="display: none;">
                <a href="dashboard.html">Dashboard</a>
                <a href="orders.html">My Orders</a>
                <a href="profile.html">Profile</a>
                <a href="favorites.html">Favorites</a>
                <hr>
                <a href="#" onclick="handleLogout(event)">Logout</a>
            </div>
        </li>
    `;

    navMenu.insertAdjacentHTML('beforeend', userMenuHTML);

    // Add dropdown toggle functionality
    const userMenuBtn = navMenu.querySelector('.user-menu-btn');
    const dropdownMenu = navMenu.querySelector('.dropdown-menu');

    userMenuBtn.addEventListener('click', () => {
        dropdownMenu.style.display = dropdownMenu.style.display === 'none' ? 'block' : 'none';
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.user-menu')) {
            dropdownMenu.style.display = 'none';
        }
    });
}

// Handle Login
async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;

    const errorDiv = document.getElementById('loginError');
    const successDiv = document.getElementById('loginSuccess');

    try {
        // Clear previous messages
        errorDiv.style.display = 'none';
        successDiv.style.display = 'none';

        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Save user data
            localStorage.setItem('kayalUser', JSON.stringify(data.user));
            localStorage.setItem('kayalToken', data.token);

            if (rememberMe) {
                localStorage.setItem('kayalRememberMe', email);
            }

            successDiv.textContent = 'Login successful! Redirecting...';
            successDiv.style.display = 'block';

            // Check if user is an admin by probing a protected admin endpoint.
            (async () => {
                try {
                    const adminRes = await fetch(`${API_URL}/admin/stats`, {
                        headers: { 'Authorization': `Bearer ${data.token}` }
                    });

                    if (adminRes.ok) {
                        // User is admin - redirect to admin dashboard
                        setTimeout(() => { window.location.href = 'admin.html'; }, 1000);
                        return;
                    }
                } catch (e) {
                    console.warn('Admin check failed:', e);
                }

                // Not admin - go to home
                setTimeout(() => { window.location.href = 'index.html'; }, 1000);
            })();
        } else {
            throw new Error(data.message || 'Login failed');
        }
    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
    }
}

// Handle Register
async function handleRegister(event) {
    event.preventDefault();

    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const phone = document.getElementById('phone').value;
    const address = document.getElementById('address').value;
    const city = document.getElementById('city').value;
    const zipCode = document.getElementById('zipCode').value;
    const newsletter = document.getElementById('newsletter').checked;

    const errorDiv = document.getElementById('registerError');
    const successDiv = document.getElementById('registerSuccess');

    // Clear previous messages
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    // Validation
    if (password !== confirmPassword) {
        errorDiv.textContent = 'Passwords do not match!';
        errorDiv.style.display = 'block';
        return;
    }

    if (password.length < 8) {
        errorDiv.textContent = 'Password must be at least 8 characters long!';
        errorDiv.style.display = 'block';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                firstName,
                lastName,
                email,
                password,
                phone,
                address,
                city,
                zipCode,
                newsletter
            })
        });

        const data = await response.json();

        if (response.ok) {
            successDiv.textContent = 'Account created successfully! Redirecting to login...';
            successDiv.style.display = 'block';

            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            throw new Error(data.message || 'Registration failed');
        }
    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
    }
}

// Handle Logout
function handleLogout(event) {
    event.preventDefault();

    localStorage.removeItem('kayalUser');
    localStorage.removeItem('kayalToken');

    showNotification('You have been logged out');

    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

// Setup password strength meter
function setupPasswordStrength() {
    const passwordInput = document.getElementById('regPassword');
    if (!passwordInput) return;

    passwordInput.addEventListener('input', (e) => {
        const password = e.target.value;
        const strengthBar = document.getElementById('strengthBar');
        const strengthText = document.getElementById('strengthText');

        if (!strengthBar || !strengthText) return;

        let strength = 0;
        let text = '';
        let color = '';

        // Check password strength
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^a-zA-Z0-9]/.test(password)) strength++;

        // Set strength level
        if (strength <= 2) {
            text = 'Weak';
            color = '#FF6B6B';
            strengthBar.style.width = '33%';
        } else if (strength <= 4) {
            text = 'Medium';
            color = '#F39C12';
            strengthBar.style.width = '66%';
        } else {
            text = 'Strong';
            color = '#4ECDC4';
            strengthBar.style.width = '100%';
        }

        strengthBar.style.backgroundColor = color;
        strengthText.textContent = text;
        strengthText.style.color = color;
    });
}

// Show notification helper
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #4ECDC4;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 2000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Remember me functionality
function loadRememberedEmail() {
    const rememberedEmail = localStorage.getItem('kayalRememberMe');
    if (rememberedEmail) {
        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.value = rememberedEmail;
            document.getElementById('rememberMe').checked = true;
        }
    }
}

// Call on page load
document.addEventListener('DOMContentLoaded', loadRememberedEmail);

// Attach handlers for social login buttons (Google / Facebook)
document.addEventListener('DOMContentLoaded', () => {
    const serverOrigin = window.location.origin || 'http://localhost:3000';

    // Generic social sign-in handler
    function socialSignIn(provider) {
        // Prefer opening OAuth flow on the server if implemented
        const oauthUrl = `${serverOrigin}/auth/${provider}`;

        // Try opening a popup to start OAuth flow
        const win = window.open(oauthUrl, `_blank`, 'toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=600,height=700');
        if (!win) {
            // Popup blocked - fallback to navigation
            window.location.href = oauthUrl;
            return;
        }
        win.focus();
    }

    // Wire up buttons on login/register pages (if present)
    const googleButtons = document.querySelectorAll('.social-btn.google-btn');
    const fbButtons = document.querySelectorAll('.social-btn.facebook-btn');

    googleButtons.forEach(btn => btn.addEventListener('click', (e) => {
        e.preventDefault();
        socialSignIn('google');
    }));

    fbButtons.forEach(btn => btn.addEventListener('click', (e) => {
        e.preventDefault();
        socialSignIn('facebook');
    }));

    // If OAuth backend is not implemented, show friendly message instead of 404
    // (This keeps UX clear while backend work is pending.)
    function showOAuthNotConfiguredMessage(provider) {
        alert(`Social login with ${provider} is not configured on this site yet. You can still register using email and password.`);
    }

    // Optional: detect if /auth/google or /auth/facebook endpoints exist by probing head
    async function checkOAuthEndpoint(provider) {
        try {
            const res = await fetch(`${serverOrigin}/auth/${provider}`, { method: 'HEAD' });
            return res.ok;
        } catch (e) {
            return false;
        }
    }

    // If endpoints don't exist, replace handler with helpful alert to avoid confusing 404s
    (async () => {
        const googleAvailable = await checkOAuthEndpoint('google');
        const fbAvailable = await checkOAuthEndpoint('facebook');

        if (!googleAvailable) {
            googleButtons.forEach(btn => btn.replaceWith(btn.cloneNode(true)));
            document.querySelectorAll('.social-btn.google-btn').forEach(b => b.addEventListener('click', (e) => {
                e.preventDefault();
                showOAuthNotConfiguredMessage('Google');
            }));
        }

        if (!fbAvailable) {
            fbButtons.forEach(btn => btn.replaceWith(btn.cloneNode(true)));
            document.querySelectorAll('.social-btn.facebook-btn').forEach(b => b.addEventListener('click', (e) => {
                e.preventDefault();
                showOAuthNotConfiguredMessage('Facebook');
            }));
        }
    })();
});
