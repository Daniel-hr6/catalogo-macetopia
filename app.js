let cart = [];
let config = {};
let products = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const [configRes, productsRes] = await Promise.all([
            fetch('/api/config'),
            fetch('/api/products')
        ]);
        config = await configRes.json();
        products = await productsRes.json();

        // Apply customization
        if (config.logoUrl) {
            document.querySelectorAll('.logo-link img').forEach(img => img.src = config.logoUrl);
            const hero = document.querySelector('.hero');
            if (hero) hero.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.3)), url('${config.logoUrl}')`;
        }
        if (config.clrBackground) document.documentElement.style.setProperty('--clr-background', config.clrBackground);
        if (config.clrSurface) document.documentElement.style.setProperty('--clr-surface', config.clrSurface);
        if (config.clrTextMain) document.documentElement.style.setProperty('--clr-text-main', config.clrTextMain);
        if (config.clrAccent) {
            document.documentElement.style.setProperty('--clr-accent', config.clrAccent);
        }
    } catch (e) {
        console.error("Error cargando datos:", e);
        document.getElementById('catalog-grid').innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Error al cargar el catálogo. Inténtalo más tarde.</p>';
        return;
    }

    // 1. Renderizar catálogo
    const catalogGrid = document.getElementById('catalog-grid');
    
    if (typeof products !== 'undefined' && products.length > 0) {
        products.forEach(product => {
            const card = document.createElement('article');
            card.className = 'product-card';
            
            // Format price
            const formattedPrice = `${config.currency}${product.price.toFixed(2)} ${config.currencyCode}`;
            
            const stockLevel = product.stock || 0;
            const hasStock = stockLevel > 0;
            const stockLabel = hasStock ? '' : '<div style="position:absolute; top:10px; left:10px; background:rgba(231,76,60,0.9); color:white; padding:4px 8px; border-radius:4px; font-weight:bold; font-size:0.8rem; z-index:10; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">Agotado</div>';
            const btnState = hasStock ? '' : 'disabled style="background:#7f8fa6; cursor:not-allowed; border:none; color:white;"';
            const btnText = hasStock ? 'Agregar al pedido' : 'Sin stock';

            card.style.position = 'relative';

            card.innerHTML = `
                ${stockLabel}
                <div class="product-image-wrapper">
                    <img src="${product.image}" alt="${product.name}" class="product-image" loading="lazy">
                </div>
                <span class="product-category">${product.category}</span>
                <h3 class="product-name">${product.name}</h3>
                <p class="product-description">${product.description}</p>
                <div class="product-footer">
                    <span class="product-price">${formattedPrice}</span>
                    <button class="btn btn-primary btn-order" data-id="${product.id}" ${btnState}>${btnText}</button>
                </div>
            `;
            
            catalogGrid.appendChild(card);
        });
    } else {
        catalogGrid.innerHTML = '<p class="section-description" style="grid-column: 1/-1; text-align: center;">No hay productos disponibles por el momento.</p>';
    }

    // 2. Lógica del Carrito (Agregar, Eliminar, Renderizar)
    function addToCart(productId) {
        const product = products.find(p => p.id === productId);
        if (!product) return;

        const existingItem = cart.find(item => item.id === productId);
        const currentQty = existingItem ? existingItem.quantity : 0;
        const availableStock = product.stock || 0;
        
        if (currentQty + 1 > availableStock) {
            alert(`¡Lo sentimos! Solo tenemos ${availableStock} unidades de este artículo disponibles.`);
            return;
        }

        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({ ...product, quantity: 1 });
        }
        
        // Efecto visual de agregar
        updateCartUI();
        openCart();
    }

    function removeFromCart(productId) {
        cart = cart.filter(item => item.id !== productId);
        updateCartUI();
    }

    function updateCartUI() {
        // Actualizar contador
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        document.getElementById('cart-count').textContent = totalItems;
        
        const cartItemsContainer = document.getElementById('cart-items');
        cartItemsContainer.innerHTML = '';

        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p class="empty-cart-msg">Aún no has agregado macetas a tu pedido.</p>';
            document.getElementById('cart-total-price').textContent = `${config.currency}0.00 ${config.currencyCode}`;
            return;
        }

        let totalPrice = 0;

        cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            totalPrice += itemTotal;

            const itemEl = document.createElement('div');
            itemEl.className = 'cart-item';
            itemEl.innerHTML = `
                <img src="${item.image}" alt="${item.name}" class="cart-item-img">
                <div class="cart-item-details">
                    <div class="cart-item-title">${item.name}</div>
                    <div class="cart-item-price">${config.currency}${item.price.toFixed(2)} x ${item.quantity}</div>
                </div>
                <button class="remove-item-btn" data-id="${item.id}" aria-label="Eliminar">&times;</button>
            `;
            cartItemsContainer.appendChild(itemEl);
        });

        document.getElementById('cart-total-price').textContent = `${config.currency}${totalPrice.toFixed(2)} ${config.currencyCode}`;

        // Listeners for remove buttons
        document.querySelectorAll('.remove-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                removeFromCart(e.target.getAttribute('data-id'));
            });
        });
    }

    // 3. Manejo de la Interfaz del Carrito (Abrir / Cerrar)
    const cartSidebar = document.getElementById('cart-sidebar');
    const cartOverlay = document.getElementById('cart-overlay');
    
    function openCart() {
        cartSidebar.classList.add('open');
        cartOverlay.classList.add('open');
    }

    function closeCart() {
        cartSidebar.classList.remove('open');
        cartOverlay.classList.remove('open');
    }

    document.getElementById('cart-btn').addEventListener('click', openCart);
    document.getElementById('close-cart-btn').addEventListener('click', closeCart);
    cartOverlay.addEventListener('click', closeCart);

    // 4. Lógica para generar enlace de pedido multi-producto (WhatsApp o Messenger)
    function generateOrderUrl(messageText) {
        const textEncoded = encodeURIComponent(messageText);
        let url = "";
        let isMessenger = false;

        if (config.preferredContact === 'whatsapp' && config.whatsapp) {
            url = `https://wa.me/${config.whatsapp}?text=${textEncoded}`;
        } else if (config.messenger) {
            url = `${config.messenger}`;
            isMessenger = true;
        } else if (config.whatsapp) {
            url = `https://wa.me/${config.whatsapp}?text=${textEncoded}`;
        } else {
            console.error("No hay método de contacto configurado en data.js");
            alert("No se ha configurado un método de contacto.");
            return null;
        }
        return { url, isMessenger };
    }

    function openContact(message) {
        const contactInfo = generateOrderUrl(message);
        if (!contactInfo || !contactInfo.url) return;

        if (contactInfo.isMessenger) {
            navigator.clipboard.writeText(message).then(() => {
                alert("📝 Hemos copiado tu pedido al portapapeles porque Messenger no permite pre-llenarlo de forma automática.\\n\\n¡Solo dale a 'Pegar' (Ctrl+V) en el chat!");
                window.open(contactInfo.url, '_blank');
            }).catch(() => {
                window.open(contactInfo.url, '_blank');
            });
        } else {
            window.open(contactInfo.url, '_blank');
        }
    }

    // 5. Manejar click en "Agregar al pedido" (Botones de productos)
    const orderButtons = document.querySelectorAll('.btn-order');
    orderButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const productId = e.target.getAttribute('data-id');
            addToCart(productId);
        });
    });

    // 6. Checkout: Enviar todo el carrito
    document.getElementById('checkout-btn').addEventListener('click', () => {
        if (cart.length === 0) {
            alert("Tu pedido está vacío. ¡Agrega unas macetas primero!");
            return;
        }

        let message = `¡Hola! Me gustaría hacer el siguiente pedido de macetas:\\n\\n`;
        let total = 0;

        cart.forEach((item, index) => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            message += `${index + 1}. ${item.name} (x${item.quantity}) - ${config.currency}${itemTotal.toFixed(2)}\\n`;
        });

        message += `\\nTotal a pagar: ${config.currency}${total.toFixed(2)} ${config.currencyCode}\\n\\n¿Me podrían indicar los pasos para el pago y envío?`;
        
        openContact(message);
    });

    // 7. Botones genéricos de contacto (Floating button & Footer button & Nav button)
    const genericContactBtns = [
        document.getElementById('floating-btn'),
        document.getElementById('footer-contact-btn'),
        document.getElementById('nav-contact-btn')
    ];

    genericContactBtns.forEach(btn => {
        if (!btn) return;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const message = config.greetingMessage || "¡Hola! Me gustaría hacer una consulta sobre las macetas.";
            openContact(message);
        });
    });

    // 8. Utilidades extra
    document.getElementById('current-year').textContent = new Date().getFullYear();

    let lastScrollTop = 0;
    const navbar = document.querySelector('.navbar');
    
    window.addEventListener('scroll', () => {
        let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        if (scrollTop > lastScrollTop && scrollTop > 100) {
            navbar.style.transform = 'translateY(-100%)';
        } else {
            navbar.style.transform = 'translateY(0)';
        }
        lastScrollTop = scrollTop;
    }, false);

    // 9. Admin redirect logic for logo
    document.querySelectorAll('.logo-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            if (localStorage.getItem('adminPassword')) {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'login.html';
            }
        });
    });

    // Inicializar UI vacía al cargar
    updateCartUI();
});
