/* Complete admin.js rewritten for modern layout and file uploads */
const apiUrl = '/api';

// Intercept fetch to add auth header and handle 401
const originalFetch = window.fetch.bind(window);
window.fetch = async function(...args) {
    const [resource, config] = args;
    const reqConfig = config || {};
    reqConfig.headers = {
        ...reqConfig.headers,
        'x-admin-password': localStorage.getItem('adminPassword') || ''
    };
    
    const response = await originalFetch(resource, reqConfig);
    if (response.status === 401 && resource !== `${apiUrl}/check-password`) {
        localStorage.removeItem('adminPassword');
        window.location.href = 'login.html';
        throw new Error('Unauthorized');
    }
    return response;
};

// --- UI TABS ---
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
        
        e.target.classList.add('active');
        const targetId = e.target.getAttribute('data-target');
        document.getElementById(targetId).style.display = 'block';
    });
});

// --- IMAGE UPLOAD HELPER ---
async function uploadImage(fileInputId) {
    const fileInput = document.getElementById(fileInputId);
    if (!fileInput.files.length) return null;

    const formData = new FormData();
    formData.append('image', fileInput.files[0]);

    const res = await fetch(`${apiUrl}/upload`, {
        method: 'POST',
        headers: { 
            /* Do NOT set Content-Type here; browser will set it to multipart/form-data with boundary */
            'x-admin-password': localStorage.getItem('adminPassword') || '' 
        },
        body: formData
    });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return data.url;
}

// --- CONFIGURATION ---
async function loadConfig() {
    try {
        const res = await fetch(`${apiUrl}/config`);
        const config = await res.json();
        document.getElementById('whatsapp-input').value = config.whatsapp || '';
        document.getElementById('greeting-input').value = config.greetingMessage || '';
        document.getElementById('logo-input').value = config.logoUrl || '';
        document.getElementById('clr-background').value = config.clrBackground || '#F9F8F6';
        document.getElementById('clr-surface').value = config.clrSurface || '#FFFFFF';
        document.getElementById('clr-text-main').value = config.clrTextMain || '#2C2C2A';
        document.getElementById('clr-accent').value = config.clrAccent || '#A67C52';
        
        if (config.logoUrl) {
            const preview = document.getElementById('logo-preview');
            preview.src = config.logoUrl;
            document.getElementById('logo-preview-container').style.display = 'block';
        }
    } catch (e) {
        console.error("Error loading config", e);
    }
}

document.getElementById('config-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // First Handle Logo Upload if any
    let finalLogoUrl = document.getElementById('logo-input').value.trim();
    if (document.getElementById('logo-file').files.length > 0) {
        try {
            finalLogoUrl = await uploadImage('logo-file');
            document.getElementById('logo-input').value = finalLogoUrl;
            document.getElementById('logo-file').value = ''; // clear input
        } catch (e) {
            alert('Error al subir el logo. Revisa el formato.');
            return;
        }
    }

    const whatsapp = document.getElementById('whatsapp-input').value.trim();
    const greeting = document.getElementById('greeting-input').value.trim();
    const clrBackground = document.getElementById('clr-background').value;
    const clrSurface = document.getElementById('clr-surface').value;
    const clrTextMain = document.getElementById('clr-text-main').value;
    const clrAccent = document.getElementById('clr-accent').value;
    const passwordInput = document.getElementById('password-input').value;

    const payload = {
        whatsapp,
        greetingMessage: greeting,
        preferredContact: whatsapp ? 'whatsapp' : 'messenger',
        logoUrl: finalLogoUrl,
        clrBackground,
        clrSurface,
        clrTextMain,
        clrAccent
    };
    if (passwordInput) payload.password = passwordInput;
    
    try {
        await fetch(`${apiUrl}/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (passwordInput) {
            localStorage.removeItem('adminPassword');
            document.getElementById('password-input').value = '';
            alert('Has cambiado la contraseña. Módulo de seguridad reforzado, por favor inicia sesión nuevamente con tu nueva clave.');
            window.location.href = 'login.html';
            return;
        }
        
        const preview = document.getElementById('logo-preview');
        if (finalLogoUrl) {
            preview.src = finalLogoUrl;
            document.getElementById('logo-preview-container').style.display = 'block';
        } else {
            document.getElementById('logo-preview-container').style.display = 'none';
        }
        
        alert('Configuración guardada correctamente.');
    } catch(e) {
        alert('Error al guardar configuración.');
    }
});

// --- PRODUCTS ---
async function loadProducts() {
    try {
        const res = await fetch(`${apiUrl}/products`);
        const products = await res.json();
        const list = document.getElementById('product-list');
        list.innerHTML = '';
        products.forEach(p => {
            const item = document.createElement('div');
            item.className = 'product-item';
            item.innerHTML = `
                <div class="product-info">
                    <img src="${p.image}" alt="${p.name}">
                    <div class="product-details">
                        <strong>${p.name}</strong>
                        <span>$${p.price} MXN &bull; ${p.category} &bull; Stock: ${p.stock !== undefined ? p.stock : 0}</span>
                    </div>
                </div>
                <div class="product-actions">
                    <button class="btn btn-primary btn-action" onclick="editProduct('${p.id}')">Editar</button>
                    <button class="btn btn-danger btn-action" onclick="deleteProduct('${p.id}')">Eliminar</button>
                </div>
            `;
            list.appendChild(item);
        });
    } catch (e) {
        console.error("Error loading products", e);
    }
}

document.getElementById('add-product-btn').addEventListener('click', () => {
    document.getElementById('product-form').reset();
    document.getElementById('product-id').value = '';
    document.getElementById('modal-title').innerText = 'Nuevo Producto';
    document.getElementById('product-modal').style.display = 'flex';
});

document.getElementById('cancel-btn').addEventListener('click', () => {
    document.getElementById('product-modal').style.display = 'none';
});

document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    let finalImageUrl = document.getElementById('product-image').value.trim();
    if (document.getElementById('product-image-file').files.length > 0) {
        try {
            finalImageUrl = await uploadImage('product-image-file');
        } catch (e) {
            alert('Error subiendo imagen del producto.');
            return;
        }
    }

    const id = document.getElementById('product-id').value;
    const product = {
        name: document.getElementById('product-name').value,
        description: document.getElementById('product-desc').value,
        price: parseFloat(document.getElementById('product-price').value),
        category: document.getElementById('product-category').value,
        stock: parseInt(document.getElementById('product-stock').value, 10),
        image: finalImageUrl
    };

    try {
        if (id) {
            await fetch(`${apiUrl}/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(product)
            });
        } else {
            await fetch(`${apiUrl}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(product)
            });
        }
        document.getElementById('product-modal').style.display = 'none';
        loadProducts();
    } catch(e) {
        alert("Error al guardar producto");
    }
});

async function editProduct(id) {
    try {
        const res = await fetch(`${apiUrl}/products`);
        const products = await res.json();
        const p = products.find(prod => prod.id === id);
        if (!p) return;

        document.getElementById('product-id').value = p.id;
        document.getElementById('product-name').value = p.name;
        document.getElementById('product-desc').value = p.description;
        document.getElementById('product-price').value = p.price;
        document.getElementById('product-category').value = p.category;
        document.getElementById('product-stock').value = p.stock !== undefined ? p.stock : 0;
        document.getElementById('product-image').value = p.image;
        document.getElementById('product-image-file').value = '';
        
        document.getElementById('modal-title').innerText = 'Editar Producto';
        document.getElementById('product-modal').style.display = 'flex';
    } catch (e) {
        console.error("Error fetching product data", e);
    }
}

async function deleteProduct(id) {
    if (confirm('¿Seguro que deseas eliminar este producto permanentemente?')) {
        try {
            await fetch(`${apiUrl}/products/${id}`, { method: 'DELETE' });
            loadProducts();
        } catch(e) {
            alert('Error al eliminar producto');
        }
    }
}

// Initialization
async function initApp() {
    if (!localStorage.getItem('adminPassword')) {
        window.location.href = 'login.html';
        return;
    }
    try {
        const res = await originalFetch(`${apiUrl}/check-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: localStorage.getItem('adminPassword') })
        });
        if (!res.ok) throw new Error('Invalid setup');
        document.querySelector('.dashboard-wrapper').classList.add('ready');
        loadConfig();
        loadProducts();
    } catch(e) {
        localStorage.removeItem('adminPassword');
        window.location.href = 'login.html';
    }
}
initApp();
