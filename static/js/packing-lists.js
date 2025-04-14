// Packing List Management
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if packing list elements exist
    if (!document.getElementById('packingLists')) return;

    const packingManager = new PackingListManager();
    packingManager.init();
});

class PackingListManager {
    constructor() {
        // DOM Elements
        this.elements = {
            listsContainer: document.getElementById('packingLists'),
            newListInput: document.getElementById('newPackingList'),
            addListBtn: document.getElementById('addPackingBtn'),
            modal: document.getElementById('packingModal'),
            modalTitle: document.getElementById('packingModalTitle'),
            itemsContainer: document.getElementById('packingItemsList'),
            newItemInput: document.getElementById('newPackingItem'),
            addItemBtn: document.getElementById('addPackingItemBtn'),
            modalClose: document.getElementById('packingModalClose')
        };

        // State
        this.currentListId = null;
    }

    init() {
        this.loadPackingLists();
        this.setupEventListeners();
    }

    async loadPackingLists() {
        try {
            const response = await fetch('/api/packing-lists');
            if (!response.ok) throw new Error('Failed to load packing lists');
            
            const lists = await response.json();
            this.renderPackingLists(lists);
        } catch (error) {
            console.error('Error loading packing lists:', error);
            this.showEmptyState();
        }
    }

    renderPackingLists(lists) {
        this.elements.listsContainer.innerHTML = '';
        
        if (lists.length === 0) {
            this.showEmptyState();
            return;
        }
        
        lists.forEach(list => {
            const listElement = document.createElement('div');
            listElement.className = 'packing-list-card';
            listElement.dataset.id = list.id;
            listElement.innerHTML = `
                <div class="packing-list-title">${this.escapeHtml(list.title)}</div>
                <div class="packing-list-meta">
                    ${list.packed_count}/${list.item_count} packed • ${this.formatDate(new Date(list.created_at))}
                </div>
            `;
            listElement.addEventListener('click', () => this.openPackingList(list.id));
            this.elements.listsContainer.appendChild(listElement);
        });
    }

    showEmptyState() {
        this.elements.listsContainer.innerHTML = `
            <div class="empty-packing-state">
                <i class="fas fa-suitcase"></i>
                <p>No packing lists yet</p>
                <p>Create your first list to get started!</p>
            </div>
        `;
    }

    async openPackingList(listId) {
        try {
            const response = await fetch(`/api/packing-lists/${listId}`);
            if (!response.ok) throw new Error('Failed to load packing list');
            
            const list = await response.json();
            if (!list) return;
            
            this.currentListId = listId;
            this.elements.modalTitle.textContent = this.escapeHtml(list.title);
            this.elements.itemsContainer.innerHTML = '';
            
            if (list.items && list.items.length > 0) {
                list.items.forEach(item => {
                    const itemElement = document.createElement('div');
                    itemElement.className = 'packing-item';
                    itemElement.dataset.itemId = item.id;
                    itemElement.innerHTML = `
                        <input type="checkbox" class="packing-item-checkbox" ${item.packed ? 'checked' : ''}>
                        <div class="packing-item-text">${this.escapeHtml(item.text)}</div>
                        <button class="delete-packing-item">
                            <i class="fas fa-trash"></i>
                        </button>
                    `;
                    
                    const checkbox = itemElement.querySelector('.packing-item-checkbox');
                    checkbox.addEventListener('change', () => this.updatePackingItem(item.id, checkbox.checked));
                    
                    const deleteBtn = itemElement.querySelector('.delete-packing-item');
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.deletePackingItem(item.id);
                    });
                    
                    this.elements.itemsContainer.appendChild(itemElement);
                });
            }
            
            this.elements.modal.style.display = 'flex';
        } catch (error) {
            console.error('Error opening packing list:', error);
            this.showAlert('Failed to load packing list');
        }
    }

    async addPackingList() {
        const title = this.elements.newListInput.value.trim();
        if (!title) return;

        try {
            const response = await fetch('/api/packing-lists', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title })
            });
            
            if (!response.ok) throw new Error('Failed to create packing list');
            
            const result = await response.json();
            this.elements.newListInput.value = '';
            this.loadPackingLists();
            this.openPackingList(result.list_id);
        } catch (error) {
            console.error('Error creating packing list:', error);
            this.showAlert('Failed to create packing list');
        }
    }

    async addPackingItem() {
        const text = this.elements.newItemInput.value.trim();
        if (!text || !this.currentListId) return;

        try {
            const response = await fetch('/api/packing-list-items', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    list_id: this.currentListId,
                    text: text
                })
            });
            
            if (!response.ok) throw new Error('Failed to add packing item');
            
            this.elements.newItemInput.value = '';
            this.openPackingList(this.currentListId);
        } catch (error) {
            console.error('Error adding packing item:', error);
            this.showAlert('Failed to add packing item');
        }
    }

    async updatePackingItem(itemId, packed) {
        try {
            const response = await fetch(`/api/packing-list-items/${itemId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ packed })
            });
            
            if (!response.ok) throw new Error('Failed to update packing item');
        } catch (error) {
            console.error('Error updating packing item:', error);
        }
    }

    async deletePackingItem(itemId) {
        if (!confirm('Are you sure you want to delete this item?')) return;
        
        try {
            const response = await fetch(`/api/packing-list-items/${itemId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) throw new Error('Failed to delete packing item');
            
            this.openPackingList(this.currentListId);
        } catch (error) {
            console.error('Error deleting packing item:', error);
            this.showAlert('Failed to delete packing item');
        }
    }

    setupEventListeners() {
        // Add new list
        this.elements.addListBtn?.addEventListener('click', () => this.addPackingList());
        this.elements.newListInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addPackingList();
        });
        
        // Add new item
        this.elements.addItemBtn?.addEventListener('click', () => this.addPackingItem());
        this.elements.newItemInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addPackingItem();
        });
        
        // Close modal
        this.elements.modalClose?.addEventListener('click', () => this.closeModal());
        this.elements.modal?.addEventListener('click', (e) => {
            if (e.target === this.elements.modal) this.closeModal();
        });
    }

    closeModal() {
        this.elements.modal.style.display = 'none';
        this.currentListId = null;
    }

    formatDate(date) {
        const diff = Date.now() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        return `${Math.floor(days / 30)} months ago`;
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    showAlert(message) {
        // You can replace this with your preferred alert/notification system
        alert(message);
    }
}