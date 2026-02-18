// Cart functionality
let cart = [];
let cartCount = 0;

// Currency / INR conversion settings
const EXCHANGE_RATE_USD_TO_INR = 82; // update as needed
const CURRENCY_LOCALE = 'en-IN';

function formatPriceINR(usd) {
    const inr = Number(usd) * EXCHANGE_RATE_USD_TO_INR;
    return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency: 'INR' }).format(inr);
}

function parseUsdFromPriceElement(el) {
    if (!el) return 0;
    const data = el.dataset.usd;
    if (data) return parseFloat(data);
    const text = el.textContent || '';
    const n = parseFloat(text.replace(/[^0-9.]/g, '')) || 0;
    return n;
}

// Load cart from localStorage
function loadCart() {
    const savedCart = localStorage.getItem('kayalCart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartCount();
    }
}

// Load products from API and display them
async function loadProducts() {
    try {
        const response = await fetch('https://backend-production-4bcf.up.railway.app/api/products');
        if (!response.ok) {
            throw new Error('Failed to load products');
        }
        const products = await response.json();
        displayProducts(products);
    } catch (error) {
        console.error('Error loading products:', error);
        // Fallback to showing a message if API fails
        const productsGrid = document.querySelector('.products-grid');
        if (productsGrid) {
            productsGrid.innerHTML = '<p class="error-message">Unable to load products. Please try again later.</p>';
        }
    }
}

// Display products dynamically
function displayProducts(products) {
    const productsGrid = document.querySelector('.products-grid');
    if (!productsGrid) return;

    if (products.length === 0) {
        productsGrid.innerHTML = '<p class="no-products">No products available at the moment.</p>';
        return;
    }

    const productsHTML = products.map(product => {
        // Handle sizes and colors with error checking
        let sizes = [];
        let colors = [];
        try {
            sizes = product.sizes ? JSON.parse(product.sizes) : [];
            colors = product.colors ? JSON.parse(product.colors) : [];
        } catch (e) {
            console.warn('Error parsing sizes/colors for product:', product.id, e);
        }

        // Handle image display
        let imageHTML = '👕'; // Default emoji
        if (product.image) {
            // Check if it's a URL or emoji
            if (product.image.startsWith('http') || product.image.startsWith('https')) {
                // Try to extract actual image URL from Bing search URLs
                let imageUrl = product.image;
                if (product.image.includes('bing.com/images/search') && product.image.includes('mediaurl=')) {
                    try {
                        const url = new URL(product.image);
                        const mediaUrl = url.searchParams.get('mediaurl');
                        if (mediaUrl) {
                            imageUrl = decodeURIComponent(mediaUrl);
                        }
                    } catch (e) {
                        console.warn('Error parsing Bing image URL:', e);
                    }
                }
                
                imageHTML = `<img src="${imageUrl}" alt="${product.name}" onerror="this.style.display='none'; this.nextSibling.style.display='block';" style="max-width: 100%; max-height: 150px; object-fit: cover; border-radius: 8px;"><span style="display: none; font-size: 4rem;">👕</span>`;
            } else {
                imageHTML = product.image; // Use as-is (emoji or text)
            }
        }

        return `
            <div class="product-card" data-product-id="${product.id}" onclick="goToProductDetails(${product.id})">
                <div class="product-image">${imageHTML}</div>
                <h3>${product.name}</h3>
                <p class="description">${product.description || 'No description available'}</p>
                <p class="price" data-usd="${product.price}">$${product.price}</p>
                <p class="rating">⭐⭐⭐⭐⭐ (${Math.floor(Math.random() * 200) + 50} reviews)</p>
                <button class="btn btn-secondary" onclick="event.stopPropagation(); addToCart('${product.name.replace(/'/g, "\\'")}', ${product.price})">Add to Cart</button>
            </div>
        `;
    }).join('');

    productsGrid.innerHTML = productsHTML;

    // Convert prices to INR after loading
    convertPricesToINR();
}

// Add item to cart
function addToCart(productName, price) {
    const item = {
        id: cart.length + 1,
        name: productName,
        price: price,
        quantity: 1
    };
    
    // Check if item already exists
    const existingItem = cart.find(p => p.name === productName);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push(item);
    }
    
    // Save to localStorage
    localStorage.setItem('kayalCart', JSON.stringify(cart));
    updateCartCount();
    
    // Show notification
    showNotification(`${productName} added to cart!`);
}

// Navigate to product details page
async function goToProductDetails(productId) {
    try {
        // Try to fetch product details first and save a copy to localStorage
        const resp = await fetch(`https://backend-production-4bcf.up.railway.app/api/products/${productId}`);
        if (resp.ok) {
            const product = await resp.json();
            localStorage.setItem('kayalLastProduct', JSON.stringify(product));
            localStorage.setItem('kayalLastProductId', String(productId));
        } else {
            // clear if can't fetch
            localStorage.removeItem('kayalLastProduct');
            localStorage.removeItem('kayalLastProductId');
        }
    } catch (e) {
        // ignore fetch errors, navigation will still happen and product page will try other fallbacks
        console.warn('Could not prefetch product:', e);
    }

    window.location.href = `product.html?id=${productId}`;
}

// Update cart count
function updateCartCount() {
    cartCount = cart.reduce((total, item) => total + item.quantity, 0);
    const cartIcons = document.querySelectorAll('.cart-icon');
    cartIcons.forEach(icon => {
        icon.textContent = `🛒 Cart (${cartCount})`;
    });
}

// Show notification
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

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Newsletter handler
function handleNewsletter(e) {
    e.preventDefault();
    const email = e.target.querySelector('input[type="email"]').value;
    
    if (validateEmail(email)) {
        localStorage.setItem('newsletterEmail', email);
        showNotification(`Welcome! Check your email at ${email} for special offers.`);
        e.target.reset();
    } else {
        showNotification('Please enter a valid email address.');
    }
}

// Contact form handler
function handleContactForm(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        subject: formData.get('subject'),
        message: formData.get('message'),
        timestamp: new Date().toISOString()
    };
    
    // Save to localStorage
    const messages = JSON.parse(localStorage.getItem('contactMessages') || '[]');
    messages.push(data);
    localStorage.setItem('contactMessages', JSON.stringify(messages));
    
    showNotification('Thank you! We received your message and will get back to you soon.');
    e.target.reset();
}

// Email validation
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Sort products
function sortProducts(sortBy) {
    const products = document.querySelectorAll('.product-card');
    const productArray = Array.from(products);
    
    switch(sortBy) {
        case 'price-low':
            productArray.sort((a, b) => {
                const priceA = parseFloat(a.querySelector('.price').dataset.usd || a.querySelector('.price').textContent.replace(/[^0-9.]/g, ''));
                const priceB = parseFloat(b.querySelector('.price').dataset.usd || b.querySelector('.price').textContent.replace(/[^0-9.]/g, ''));
                return priceA - priceB;
            });
            break;
        case 'price-high':
            productArray.sort((a, b) => {
                const priceA = parseFloat(a.querySelector('.price').dataset.usd || a.querySelector('.price').textContent.replace(/[^0-9.]/g, ''));
                const priceB = parseFloat(b.querySelector('.price').dataset.usd || b.querySelector('.price').textContent.replace(/[^0-9.]/g, ''));
                return priceB - priceA;
            });
            break;
        case 'newest':
            // Reverse order for newest
            productArray.reverse();
            break;
        default:
            break;
    }
    
    // Re-append sorted products
    const container = document.querySelector('.products-shop') || document.querySelector('.products-grid');
    if (container) {
        productArray.forEach(product => {
            container.appendChild(product);
        });
    }
}

// Hamburger menu toggle
function setupMobileMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    if (!hamburger || !navMenu) return;

    hamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        navMenu.classList.toggle('mobile-open');
        hamburger.classList.toggle('is-active');
    });

    // Close menu when a link is clicked
    navMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('mobile-open');
            hamburger.classList.remove('is-active');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-container')) {
            navMenu.classList.remove('mobile-open');
            hamburger.classList.remove('is-active');
        }
    });
}

// Price range filter
function setupPriceFilter() {
    const priceRange = document.getElementById('priceRange');
    const priceValue = document.getElementById('priceValue');
    
    if (priceRange) {
        // ensure priceValue keeps USD value in dataset, but show INR formatted
        priceValue.dataset.usd = priceRange.value;
        priceValue.textContent = formatPriceINR(priceRange.value);

        priceRange.addEventListener('input', (e) => {
            priceValue.dataset.usd = e.target.value;
            priceValue.textContent = formatPriceINR(e.target.value);
        });
    }
}

// Smooth scroll for navigation
function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Active navigation link
function updateActiveNavLink() {
    const currentLocation = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-menu a').forEach(link => {
        if (link.href.includes(currentLocation) || 
            (currentLocation === '' && link.href.includes('index.html'))) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// Initialize everything
document.addEventListener('DOMContentLoaded', () => {
    loadCart();
    setupMobileMenu();
    setupPriceFilter();
    setupSmoothScroll();
    updateActiveNavLink();
    convertPricesToINR();
    
    // Load products dynamically on shop page
    if (window.location.pathname.includes('shop.html') || document.querySelector('.products-grid')) {
        loadProducts();
    }
    
    // Add search functionality to page
    console.log('Kayal store initialized successfully!');
});

// Convert all visible price elements to INR on page load
function convertPricesToINR() {
    const priceEls = document.querySelectorAll('.price, .stat-number[data-usd], .free-shipping-usd');
    priceEls.forEach(el => {
        const usd = parseUsdFromPriceElement(el);
        if (!isNaN(usd)) {
            el.textContent = formatPriceINR(usd);
            // keep USD value for sorting & data
            el.dataset.usd = usd;
        }
    });

    // Update any numeric spans like #priceValue if they have data-usd
    const priceValueEl = document.getElementById('priceValue');
    if (priceValueEl && priceValueEl.dataset.usd) {
        priceValueEl.textContent = formatPriceINR(priceValueEl.dataset.usd);
    }
}

// Prevent default behavior for demo links
document.addEventListener('click', (e) => {
    if (e.target.matches('a[href="#"]')) {
        e.preventDefault();
    }
});
