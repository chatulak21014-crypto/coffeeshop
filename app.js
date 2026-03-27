var STORAGE_CATEGORIES = 'cafe_categories';
var STORAGE_ITEMS = 'cafe_items';

function generateId(prefix) {
    return prefix + Date.now() + Math.random().toString(36).slice(2, 6);
}

function loadCategories() {
    var raw = localStorage.getItem(STORAGE_CATEGORIES);
    return raw ? JSON.parse(raw) : null;
}

function saveCategories(cats) {
    localStorage.setItem(STORAGE_CATEGORIES, JSON.stringify(cats));
}

function loadItems() {
    var raw = localStorage.getItem(STORAGE_ITEMS);
    return raw ? JSON.parse(raw) : null;
}

function saveItems(items) {
    localStorage.setItem(STORAGE_ITEMS, JSON.stringify(items));
}

function seedData() {
    var catId = generateId('cat_');
    var categories = [{ id: catId, name: 'Coffee' }];
    var items = [
        { id: generateId('item_'), name: 'Cafe Special', categoryId: catId, imageUrl: 'https://cdn-icons-png.flaticon.com/512/924/924514.png', price: null, sale: null },
        { id: generateId('item_'), name: 'Small Cafe', categoryId: catId, imageUrl: 'https://cdn-icons-png.flaticon.com/512/3050/3050525.png', price: null, sale: null },
        { id: generateId('item_'), name: 'Normal Ice Cafe', categoryId: catId, imageUrl: 'https://cdn-icons-png.flaticon.com/512/2935/2935307.png', price: null, sale: null }
    ];
    saveCategories(categories);
    saveItems(items);
    return { categories: categories, items: items };
}

function getData() {
    var categories = loadCategories();
    var items = loadItems();
    if (!categories || !items) {
        var seed = seedData();
        categories = seed.categories;
        items = seed.items;
    }
    return { categories: categories, items: items };
}

var orders = [];
var freeGroups = {};
var activeOrders = [];
var orderCounter = 0;
var currentItemId = null;
var editingItemId = null;
var currentScreen = 'mainScreen';
var renamingCategoryId = null;

var dingSound = new Audio('applepay.mp3');
dingSound.preload = 'auto';

function unlockAudio() {
    dingSound.muted = true;
    dingSound.play().then(function() {
        dingSound.pause();
        dingSound.muted = false;
        dingSound.currentTime = 0;
    }).catch(function() {});
}

function playDing() {
    dingSound.currentTime = 0;
    dingSound.play().catch(function() {});
}

function esc(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showScreen(id) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) {
        screens[i].classList.remove('active');
    }
    document.getElementById(id).classList.add('active');
    currentScreen = id;

    document.getElementById('gearBtn').style.display = (id === 'mainScreen') ? 'block' : 'none';
    document.getElementById('viewOrderBtn').style.display = (id === 'mainScreen' && orders.length > 0) ? 'block' : 'none';

    if (id === 'mainScreen') renderMenu();
    if (id === 'orderScreen') renderReceipt();
    if (id === 'adminScreen') renderAdmin();
}

function renderMenu() {
    var data = getData();
    var categories = data.categories;
    var items = data.items;
    var container = document.getElementById('menuContent');
    var html = '';

    for (var ci = 0; ci < categories.length; ci++) {
        var cat = categories[ci];
        var catItems = items.filter(function(it) { return it.categoryId === cat.id; });
        if (catItems.length === 0) continue;

        html += '<div class="category-header">' + esc(cat.name) + '</div>';
        html += '<div class="chips-row">';
        for (var ii = 0; ii < catItems.length; ii++) {
            var item = catItems[ii];
            var salePct = item.sale != null ? item.sale : null;
            var oos = item.outOfStock === true;
            var priceStr = '';
            if (item.price != null) {
                if (salePct !== null) {
                    var discountedPrice = (item.price * (1 - salePct / 100)).toFixed(2);
                    priceStr = '<div class="chip-price"><s class="chip-price-orig">\u20AA' + item.price + '</s> \u20AA' + discountedPrice + '</div>';
                } else {
                    priceStr = '<div class="chip-price">\u20AA' + item.price + '</div>';
                }
            }
            var saleBadge = salePct !== null ? '<div class="chip-sale-badge">-' + salePct + '%</div>' : '';
            var imgHtml = item.imageUrl
                ? '<img src="' + esc(item.imageUrl) + '"><div class="chip-placeholder hidden">\u2615</div>'
                : '<div class="chip-placeholder">\u2615</div>';
            var classes = 'chip' + (salePct !== null ? ' chip-on-sale' : '') + (oos ? ' chip-oos' : '');
            var action = oos ? '' : 'data-action="select-item" data-item-id="' + item.id + '"';
            html += '<button class="' + classes + '" ' + action + (oos ? ' disabled' : '') + '>'
                + imgHtml
                + '<div class="chip-info">'
                + '<div class="chip-name">' + esc(item.name) + '</div>'
                + priceStr
                + '</div>'
                + saleBadge
                + (oos ? '<div class="chip-oos-label">Out of Stock</div>' : '')
                + '</button>';
        }
        html += '</div>';
    }

    if (!html) {
        html = '<div class="empty-state">No menu items yet. Tap \u2699\uFE0F to add some.</div>';
    }

    container.innerHTML = html;
    updateOrderButton();
    renderSidebar();
}

function updateOrderButton() {
    var btn = document.getElementById('viewOrderBtn');
    var badge = document.getElementById('orderBadge');
    if (orders.length > 0 && currentScreen === 'mainScreen') {
        btn.style.display = 'block';
        badge.textContent = orders.length;
    } else {
        btn.style.display = 'none';
    }
}

function selectItem(itemId) {
    var data = getData();
    var item = data.items.find(function(i) { return i.id === itemId; });
    if (!item) return;
    currentItemId = itemId;
    document.getElementById('customTitle').textContent = item.name;
    document.getElementById('customInput').value = '';
    showScreen('customScreen');
}

function addToOrder() {
    var data = getData();
    var item = data.items.find(function(i) { return i.id === currentItemId; });
    if (!item) return;
    var note = document.getElementById('customInput').value.trim();
    orders.push({
        itemId: item.id,
        name: item.name,
        price: item.price,
        sale: item.sale != null ? item.sale : null,
        note: note
    });
    showScreen('orderScreen');
}

function getGroupedOrders() {
    var groups = [];
    var keys = {};
    for (var i = 0; i < orders.length; i++) {
        var entry = orders[i];
        var key = entry.itemId + '||' + entry.note;
        if (!(key in keys)) {
            var group = { itemId: entry.itemId, name: entry.name, price: entry.price, sale: entry.sale, note: entry.note, qty: 0 };
            keys[key] = group;
            groups.push(group);
        }
        keys[key].qty++;
    }
    return groups;
}

function renderReceipt() {
    var groups = getGroupedOrders();
    var html = '';
    html += '<div class="receipt-header">\u2615 Cafe Worker App</div>';
    html += '<hr class="receipt-divider">';

    if (groups.length === 0) {
        html += '<div class="receipt-empty">No items</div>';
    } else {
        for (var gi = 0; gi < groups.length; gi++) {
            var g = groups[gi];
            var freeCount = freeGroups[gi] || 0;
            var paidQty = g.qty - freeCount;
            var hasPrice = g.price != null && g.price > 0;
            var effectiveUnitPrice = (hasPrice && g.sale != null) ? g.price * (1 - g.sale / 100) : g.price;

            var priceStr = '';
            if (hasPrice) {
                if (freeCount >= g.qty) {
                    priceStr = '<s class="free-price">\u20AA' + (effectiveUnitPrice * g.qty).toFixed(2) + '</s> FREE';
                } else if (freeCount > 0) {
                    priceStr = '\u20AA' + (effectiveUnitPrice * paidQty).toFixed(2) + ' <span class="receipt-partial-free">(' + freeCount + ' free)</span>';
                } else if (g.sale != null) {
                    priceStr = '<s class="sale-orig-price">\u20AA' + (g.price * g.qty).toFixed(2) + '</s> \u20AA' + (effectiveUnitPrice * g.qty).toFixed(2);
                } else {
                    priceStr = '\u20AA' + (effectiveUnitPrice * g.qty).toFixed(2);
                }
            }

            var saleTag = (hasPrice && g.sale != null && freeCount === 0)
                ? '<span class="receipt-sale-tag">-' + g.sale + '%</span>'
                : '';

            var freeBtnLabel = freeCount > 0 ? '\u2713 Free \u00D7' + freeCount : 'Free';
            var freeBtn = hasPrice
                ? '<button class="receipt-free-btn' + (freeCount > 0 ? ' active' : '') + '" data-action="toggle-free" data-group-index="' + gi + '">' + freeBtnLabel + '</button>'
                : '';
            html += '<div class="receipt-line">'
                + '<span class="receipt-line-left">' + g.qty + 'x ' + esc(g.name) + saleTag + '</span>'
                + '<span>' + priceStr + '</span>'
                + freeBtn
                + '<button class="receipt-remove" data-action="remove-order" data-group-index="' + gi + '" title="Remove one">\u00D7</button>'
                + '</div>';
            if (g.note) {
                html += '<div class="receipt-note">' + esc(g.note) + '</div>';
            }
        }

        var hasAnyPrice = groups.some(function(g) { return g.price != null; });
        if (hasAnyPrice) {
            var total = groups.reduce(function(sum, g, i) {
                if (g.price == null) return sum;
                var fc = freeGroups[i] || 0;
                var paid = g.qty - fc;
                if (paid <= 0) return sum;
                var u = (g.sale != null) ? g.price * (1 - g.sale / 100) : g.price;
                return sum + u * paid;
            }, 0);
            html += '<hr class="receipt-divider">';
            html += '<div class="receipt-total"><span>TOTAL</span><span>\u20AA' + total.toFixed(2) + '</span></div>';
        }

        html += '<div class="receipt-count">' + orders.length + ' item' + (orders.length !== 1 ? 's' : '') + '</div>';
    }

    document.getElementById('receiptContent').innerHTML = html;
}

function removeOrderGroup(groupIndex) {
    var groups = getGroupedOrders();
    if (groupIndex < 0 || groupIndex >= groups.length) return;
    var g = groups[groupIndex];
    var idx = -1;
    for (var i = 0; i < orders.length; i++) {
        if (orders[i].itemId === g.itemId && orders[i].note === g.note) {
            idx = i;
            break;
        }
    }
    if (idx !== -1) {
        orders.splice(idx, 1);
    }
    if (orders.length === 0) {
        showScreen('mainScreen');
    } else {
        renderReceipt();
    }
}

function completeOrder(customerName) {
    if (orders.length === 0) return;
    var groups = getGroupedOrders();
    var freeCountMap = {};
    for (var gi = 0; gi < groups.length; gi++) {
        if (freeGroups[gi] > 0) {
            freeCountMap[groups[gi].itemId + '||' + groups[gi].note] = freeGroups[gi];
        }
    }
    var freeUsed = {};
    var snapshot = [];
    for (var i = 0; i < orders.length; i++) {
        var o = orders[i];
        var key = o.itemId + '||' + o.note;
        var freeCnt = freeCountMap[key] || 0;
        var used = freeUsed[key] || 0;
        var isFreeItem = used < freeCnt;
        freeUsed[key] = used + 1;
        var effectivePrice = isFreeItem ? null : o.price;
        if (effectivePrice !== null && o.sale != null) {
            effectivePrice = parseFloat((effectivePrice * (1 - o.sale / 100)).toFixed(2));
        }
        snapshot.push({
            itemId: o.itemId,
            name: o.name,
            price: effectivePrice,
            note: o.note
        });
    }
    unlockAudio();
    var overlay = document.getElementById('overlay');
    overlay.innerHTML = 'Waiting for payment...';
    overlay.style.display = 'flex';

    setTimeout(function() {
        overlay.innerHTML = '<div class="overlay-spinner"></div>Processing payment...';
    }, 2000);

    setTimeout(function() {
        overlay.innerHTML = 'Done!';
        playDing();
        orderCounter++;
        var now = new Date();
        var h = now.getHours();
        var m = now.getMinutes();
        var timeStr = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
        activeOrders.push({
            id: generateId('order_'),
            number: orderCounter,
            name: customerName,
            items: snapshot,
            time: timeStr
        });
        setTimeout(function() {
            overlay.style.display = 'none';
            orders = [];
            freeGroups = {};
            showScreen('mainScreen');
        }, 2000);
    }, 4000);
}

function groupItems(items) {
    var groups = [];
    var keys = {};
    for (var i = 0; i < items.length; i++) {
        var entry = items[i];
        var key = entry.itemId + '||' + entry.note;
        if (!(key in keys)) {
            var group = { itemId: entry.itemId, name: entry.name, price: entry.price, note: entry.note, qty: 0 };
            keys[key] = group;
            groups.push(group);
        }
        keys[key].qty++;
    }
    return groups;
}

function renderSidebar() {
    var container = document.getElementById('sidebarOrders');
    var badge = document.getElementById('sidebarBadge');
    badge.textContent = activeOrders.length;
    badge.style.display = activeOrders.length > 0 ? 'inline-flex' : 'none';

    if (activeOrders.length === 0) {
        container.innerHTML = '<div class="empty-state-sm">No active orders</div>';
        return;
    }

    var html = '';
    for (var oi = 0; oi < activeOrders.length; oi++) {
        var ao = activeOrders[oi];
        var groups = groupItems(ao.items);
        html += '<div class="sidebar-receipt">';
        html += '<div class="sidebar-receipt-header">' + esc(ao.name) + ' (#' + ao.number + ')</div>';
        html += '<hr class="receipt-divider">';
        for (var gi = 0; gi < groups.length; gi++) {
            var g = groups[gi];
            var priceStr = (g.price != null) ? '\u20AA' + (g.price * g.qty).toFixed(2) : '';
            html += '<div class="sidebar-receipt-line">'
                + '<span>' + g.qty + 'x ' + esc(g.name) + '</span>'
                + '<span>' + priceStr + '</span>'
                + '</div>';
            if (g.note) {
                html += '<div class="sidebar-receipt-note">' + esc(g.note) + '</div>';
            }
        }
        var hasAnyPrice = groups.some(function(g) { return g.price != null; });
        if (hasAnyPrice) {
            var total = groups.reduce(function(sum, g) { return sum + (g.price != null ? g.price * g.qty : 0); }, 0);
            html += '<hr class="receipt-divider">';
            html += '<div class="sidebar-receipt-total"><span>TOTAL</span><span>\u20AA' + total.toFixed(2) + '</span></div>';
        }
        html += '<div class="sidebar-receipt-time">' + ao.time + '</div>';
        html += '<button class="sidebar-done-btn" data-action="complete-active" data-order-id="' + ao.id + '">Done</button>';
        html += '</div>';
    }
    container.innerHTML = html;
}

function completeActiveOrder(orderId) {
    activeOrders = activeOrders.filter(function(o) { return o.id !== orderId; });
    renderSidebar();
}

function renderAdmin() {
    renderAdminCategories();
    renderAdminItems();
}

function renderAdminCategories() {
    var data = getData();
    var categories = data.categories;
    var items = data.items;
    var container = document.getElementById('adminCategoryList');
    var html = '';

    for (var ci = 0; ci < categories.length; ci++) {
        var cat = categories[ci];
        var itemCount = items.filter(function(i) { return i.categoryId === cat.id; }).length;
        if (renamingCategoryId === cat.id) {
            html += '<div class="admin-list-item">'
                + '<div class="item-info">'
                + '<input type="text" id="renameCatInput" value="' + esc(cat.name) + '" class="rename-input">'
                + '</div>'
                + '<div class="admin-actions">'
                + '<button class="admin-icon-btn" data-action="confirm-rename" data-cat-id="' + cat.id + '" title="Save">\u2713</button>'
                + '<button class="admin-icon-btn" data-action="cancel-rename" title="Cancel">\u2717</button>'
                + '</div>'
                + '</div>';
        } else {
            html += '<div class="admin-list-item">'
                + '<div class="item-info">'
                + '<div class="item-name">' + esc(cat.name) + '</div>'
                + '<div class="item-detail">' + itemCount + ' item' + (itemCount !== 1 ? 's' : '') + '</div>'
                + '</div>'
                + '<div class="admin-actions">'
                + '<button class="admin-icon-btn" data-action="rename-cat" data-cat-id="' + cat.id + '" title="Rename">\u270F\uFE0F</button>'
                + '<button class="admin-icon-btn danger" data-action="delete-cat" data-cat-id="' + cat.id + '" title="Delete">\uD83D\uDDD1\uFE0F</button>'
                + '</div>'
                + '</div>';
        }
    }

    if (categories.length === 0) {
        html = '<div class="empty-state-sm">No categories yet.</div>';
    }

    container.innerHTML = html;

    if (renamingCategoryId) {
        var input = document.getElementById('renameCatInput');
        if (input) input.focus();
    }
}

function addCategory() {
    var input = document.getElementById('newCategoryName');
    var name = input.value.trim();
    if (!name) return;
    var data = getData();
    data.categories.push({ id: generateId('cat_'), name: name });
    saveCategories(data.categories);
    input.value = '';
    renderAdmin();
}

function startRenameCategory(catId) {
    renamingCategoryId = catId;
    renderAdminCategories();
}

function cancelRenameCategory() {
    renamingCategoryId = null;
    renderAdminCategories();
}

function confirmRenameCategory(catId) {
    var input = document.getElementById('renameCatInput');
    var newName = input.value.trim();
    if (!newName) return;
    var categories = loadCategories() || [];
    var cat = categories.find(function(c) { return c.id === catId; });
    if (cat) {
        cat.name = newName;
        saveCategories(categories);
    }
    renamingCategoryId = null;
    renderAdmin();
}

function deleteCategory(catId) {
    var data = getData();
    var hasItems = data.items.some(function(i) { return i.categoryId === catId; });
    if (hasItems) {
        alert('Remove all items in this category first.');
        return;
    }
    var updated = data.categories.filter(function(c) { return c.id !== catId; });
    saveCategories(updated);
    renderAdmin();
}

function renderAdminItems() {
    var data = getData();
    var categories = data.categories;
    var items = data.items;
    var container = document.getElementById('adminItemList');
    var html = '';

    for (var ci = 0; ci < categories.length; ci++) {
        var cat = categories[ci];
        var catItems = items.filter(function(i) { return i.categoryId === cat.id; });
        if (catItems.length === 0) continue;
        html += '<div class="admin-category-group">';
        html += '<div class="admin-category-group-header">' + esc(cat.name) + '</div>';
        for (var ii = 0; ii < catItems.length; ii++) {
            var item = catItems[ii];
            var priceStr = item.price != null ? '\u20AA' + item.price : 'No price';
            var saleBadge = item.sale != null ? '<span class="admin-sale-badge">-' + item.sale + '%</span>' : '';
            var oos = item.outOfStock === true;
            var imgHtml = item.imageUrl
                ? '<img src="' + esc(item.imageUrl) + '">'
                : '';
            html += '<div class="admin-list-item' + (oos ? ' admin-item-oos' : '') + '">'
                + imgHtml
                + '<div class="item-info">'
                + '<div class="item-name">' + esc(item.name) + ' ' + saleBadge + '</div>'
                + '<div class="item-detail">' + priceStr + (oos ? ' \u2014 <span class="admin-oos-text">Out of stock</span>' : '') + '</div>'
                + '</div>'
                + '<div class="admin-actions">'
                + '<button class="admin-icon-btn' + (oos ? ' oos-active' : '') + '" data-action="toggle-stock" data-item-id="' + item.id + '" title="' + (oos ? 'Mark in stock' : 'Mark out of stock') + '">' + (oos ? '\u2705' : '\u274C') + '</button>'
                + '<button class="admin-icon-btn" data-action="edit-item" data-item-id="' + item.id + '" title="Edit">\u270F\uFE0F</button>'
                + '<button class="admin-icon-btn danger" data-action="delete-item" data-item-id="' + item.id + '" title="Delete">\uD83D\uDDD1\uFE0F</button>'
                + '</div>'
                + '</div>';
        }
        html += '</div>';
    }

    var uncategorized = items.filter(function(i) {
        return !categories.some(function(c) { return c.id === i.categoryId; });
    });
    if (uncategorized.length > 0) {
        html += '<div class="admin-category-group"><div class="admin-category-group-header">Uncategorized</div>';
        for (var ui = 0; ui < uncategorized.length; ui++) {
            var uitem = uncategorized[ui];
            var upriceStr = uitem.price != null ? '\u20AA' + uitem.price : 'No price';
            var usaleBadge = uitem.sale != null ? '<span class="admin-sale-badge">-' + uitem.sale + '%</span>' : '';
            var uoos = uitem.outOfStock === true;
            html += '<div class="admin-list-item' + (uoos ? ' admin-item-oos' : '') + '">'
                + '<div class="item-info">'
                + '<div class="item-name">' + esc(uitem.name) + ' ' + usaleBadge + '</div>'
                + '<div class="item-detail">' + upriceStr + (uoos ? ' \u2014 <span class="admin-oos-text">Out of stock</span>' : '') + '</div>'
                + '</div>'
                + '<div class="admin-actions">'
                + '<button class="admin-icon-btn' + (uoos ? ' oos-active' : '') + '" data-action="toggle-stock" data-item-id="' + uitem.id + '" title="' + (uoos ? 'Mark in stock' : 'Mark out of stock') + '">' + (uoos ? '\u2705' : '\u274C') + '</button>'
                + '<button class="admin-icon-btn" data-action="edit-item" data-item-id="' + uitem.id + '" title="Edit">\u270F\uFE0F</button>'
                + '<button class="admin-icon-btn danger" data-action="delete-item" data-item-id="' + uitem.id + '" title="Delete">\uD83D\uDDD1\uFE0F</button>'
                + '</div>'
                + '</div>';
        }
        html += '</div>';
    }

    if (items.length === 0) {
        html = '<div class="empty-state-sm">No items yet.</div>';
    }

    container.innerHTML = html;
}

function openItemEditor(itemId) {
    editingItemId = itemId;
    var data = getData();

    document.getElementById('editorTitle').textContent = itemId ? 'Edit Item' : 'Add Item';
    document.getElementById('editorError').textContent = '';

    var catSelect = document.getElementById('editorCategory');
    catSelect.innerHTML = '';
    for (var ci = 0; ci < data.categories.length; ci++) {
        var cat = data.categories[ci];
        var opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        catSelect.appendChild(opt);
    }

    if (data.categories.length === 0) {
        document.getElementById('editorError').textContent = 'Create a category first.';
    }

    if (itemId) {
        var item = data.items.find(function(i) { return i.id === itemId; });
        if (item) {
            document.getElementById('editorName').value = item.name;
            document.getElementById('editorCategory').value = item.categoryId;
            document.getElementById('editorPrice').value = item.price != null ? item.price : '';
            document.getElementById('editorImageUrl').value = item.imageUrl || '';
            document.getElementById('editorSale').value = item.sale != null ? item.sale : '';
        }
    } else {
        document.getElementById('editorName').value = '';
        document.getElementById('editorPrice').value = '';
        document.getElementById('editorImageUrl').value = '';
        document.getElementById('editorSale').value = '';
    }

    updateImagePreview();
    showScreen('editorScreen');
}

function updateImagePreview() {
    var url = document.getElementById('editorImageUrl').value.trim();
    var preview = document.getElementById('editorImagePreview');
    if (url) {
        var img = document.createElement('img');
        img.src = url;
        img.addEventListener('error', function() {
            preview.innerHTML = '';
            var span = document.createElement('span');
            span.className = 'placeholder';
            span.textContent = '\u2615';
            preview.appendChild(span);
        });
        preview.innerHTML = '';
        preview.appendChild(img);
    } else {
        preview.innerHTML = '';
        var span = document.createElement('span');
        span.className = 'placeholder';
        span.textContent = '\u2615';
        preview.appendChild(span);
    }
}

function saveItem() {
    var name = document.getElementById('editorName').value.trim();
    var categoryId = document.getElementById('editorCategory').value;
    var priceRaw = document.getElementById('editorPrice').value.trim();
    var imageUrl = document.getElementById('editorImageUrl').value.trim();
    var saleRaw = document.getElementById('editorSale').value.trim();
    var errorEl = document.getElementById('editorError');

    if (!name) {
        errorEl.textContent = 'Name is required.';
        return;
    }
    if (!categoryId) {
        errorEl.textContent = 'Category is required. Create one first.';
        return;
    }

    var price = priceRaw === '' ? null : parseFloat(priceRaw);
    if (priceRaw !== '' && (isNaN(price) || price < 0)) {
        errorEl.textContent = 'Price must be a positive number.';
        return;
    }

    var sale = saleRaw === '' ? null : parseFloat(saleRaw);
    if (saleRaw !== '' && (isNaN(sale) || sale < 1 || sale > 99)) {
        errorEl.textContent = 'Sale must be between 1 and 99.';
        return;
    }

    var items = loadItems() || [];

    if (editingItemId) {
        var item = items.find(function(i) { return i.id === editingItemId; });
        if (item) {
            item.name = name;
            item.categoryId = categoryId;
            item.price = price;
            item.imageUrl = imageUrl;
            item.sale = sale;
        }
    } else {
        items.push({
            id: generateId('item_'),
            name: name,
            categoryId: categoryId,
            imageUrl: imageUrl,
            price: price,
            sale: sale
        });
    }

    saveItems(items);
    editingItemId = null;
    showScreen('adminScreen');
}

function toggleStock(itemId) {
    var items = loadItems() || [];
    var item = items.find(function(i) { return i.id === itemId; });
    if (item) {
        item.outOfStock = !item.outOfStock;
        saveItems(items);
        renderAdminItems();
    }
}

function deleteItem(itemId) {
    var items = loadItems() || [];
    var updated = items.filter(function(i) { return i.id !== itemId; });
    saveItems(updated);
    renderAdmin();
}

function findAction(el) {
    while (el && el !== document.body) {
        if (el.dataset && el.dataset.action) return el;
        el = el.parentElement;
    }
    return null;
}

document.addEventListener('error', function(e) {
    if (e.target.tagName === 'IMG') {
        e.target.style.display = 'none';
        var sib = e.target.nextElementSibling;
        if (sib && sib.classList.contains('chip-placeholder')) {
            sib.classList.remove('hidden');
        }
    }
}, true);

document.getElementById('gearBtn').addEventListener('click', function() {
    showScreen('adminScreen');
});

document.getElementById('viewOrderBtn').addEventListener('click', function() {
    showScreen('orderScreen');
});

document.getElementById('btnAddToOrder').addEventListener('click', function() {
    addToOrder();
});

document.getElementById('btnCustomCancel').addEventListener('click', function() {
    showScreen('mainScreen');
});

document.getElementById('btnDone').addEventListener('click', function() {
    document.getElementById('nameInput').value = '';
    showScreen('nameScreen');
});

document.getElementById('btnNameDone').addEventListener('click', function() {
    var name = document.getElementById('nameInput').value.trim();
    if (!name) return;
    completeOrder(name);
});

document.getElementById('btnNameCancel').addEventListener('click', function() {
    showScreen('orderScreen');
});

document.getElementById('btnAddMore').addEventListener('click', function() {
    showScreen('mainScreen');
});

document.getElementById('btnAddCategory').addEventListener('click', function() {
    addCategory();
});

document.getElementById('btnAddItem').addEventListener('click', function() {
    openItemEditor(null);
});

document.getElementById('btnBackup').addEventListener('click', function() {
    var data = {
        categories: loadCategories() || [],
        items: loadItems() || []
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'cafe-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

document.getElementById('btnRestore').addEventListener('click', function() {
    document.getElementById('restoreFileInput').click();
});

document.getElementById('restoreFileInput').addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
        try {
            var data = JSON.parse(ev.target.result);
            if (!Array.isArray(data.categories) || !Array.isArray(data.items)) {
                alert('Invalid backup file: missing categories or items.');
                return;
            }
            if (!confirm('This will replace all current menu data. Continue?')) return;
            saveCategories(data.categories);
            saveItems(data.items);
            renderAdmin();
        } catch (err) {
            alert('Failed to read backup file.');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
});

document.getElementById('btnBackToCashier').addEventListener('click', function() {
    showScreen('mainScreen');
});

document.getElementById('btnSaveItem').addEventListener('click', function() {
    saveItem();
});

document.getElementById('btnEditorCancel').addEventListener('click', function() {
    showScreen('adminScreen');
});

document.getElementById('editorImageUrl').addEventListener('input', function() {
    updateImagePreview();
});

document.getElementById('menuContent').addEventListener('click', function(e) {
    var target = findAction(e.target);
    if (!target) return;
    if (target.dataset.action === 'select-item') {
        selectItem(target.dataset.itemId);
    }
});

document.getElementById('receiptContent').addEventListener('click', function(e) {
    var target = findAction(e.target);
    if (!target) return;
    if (target.dataset.action === 'remove-order') {
        removeOrderGroup(parseInt(target.dataset.groupIndex, 10));
    } else if (target.dataset.action === 'toggle-free') {
        var idx = parseInt(target.dataset.groupIndex, 10);
        var groups = getGroupedOrders();
        var maxQty = groups[idx] ? groups[idx].qty : 1;
        var current = freeGroups[idx] || 0;
        freeGroups[idx] = current + 1 > maxQty ? 0 : current + 1;
        renderReceipt();
    }
});

document.getElementById('adminCategoryList').addEventListener('click', function(e) {
    var target = findAction(e.target);
    if (!target) return;
    var action = target.dataset.action;
    if (action === 'rename-cat') {
        startRenameCategory(target.dataset.catId);
    } else if (action === 'delete-cat') {
        deleteCategory(target.dataset.catId);
    } else if (action === 'confirm-rename') {
        confirmRenameCategory(target.dataset.catId);
    } else if (action === 'cancel-rename') {
        cancelRenameCategory();
    }
});

document.getElementById('adminItemList').addEventListener('click', function(e) {
    var target = findAction(e.target);
    if (!target) return;
    var action = target.dataset.action;
    if (action === 'toggle-stock') {
        toggleStock(target.dataset.itemId);
    } else if (action === 'edit-item') {
        openItemEditor(target.dataset.itemId);
    } else if (action === 'delete-item') {
        deleteItem(target.dataset.itemId);
    }
});

document.getElementById('sidebarOrders').addEventListener('click', function(e) {
    var target = findAction(e.target);
    if (!target) return;
    if (target.dataset.action === 'complete-active') {
        completeActiveOrder(target.dataset.orderId);
    }
});


renderMenu();
