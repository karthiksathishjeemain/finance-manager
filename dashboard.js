
async function checkAuth() {
    try {
        const response = await fetch('/api/check-auth');
        const result = await response.json();

        if (!result.authenticated) {
            window.location.href = '/login.html';
            return false;
        }

        document.getElementById('familyNameDisplay').textContent = `${result.familyName} Family`;
        return true;
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login.html';
        return false;
    }
}


class LoanManager {
    constructor() {
        this.loans = [];
        this.familyMembers = [];
        this.currentFilter = 'all';
        this.currentPersonFilter = 'all';
        this.editingLoanId = null;
        this.init();
    }

    async init() {
        const isAuth = await checkAuth();
        if (!isAuth) return;

        this.setupEventListeners();
        await this.loadFamilyMembers();
        await this.loadLoans();
        this.setTodayDate();
    }


    async loadFamilyMembers() {
        try {
            const response = await fetch('/api/family-members');
            if (response.ok) {
                this.familyMembers = await response.json();
                this.updateBorrowedByDropdown();
                this.updatePersonFilter();
                this.renderFamilyMembersList();
            }
        } catch (error) {
            console.error('Error loading family members:', error);
        }
    }

    updateBorrowedByDropdown() {
        const select = document.getElementById('borrowedBy');
        select.innerHTML = '<option value="">Select family member...</option>';

        this.familyMembers.forEach(member => {
            const option = document.createElement('option');
            option.value = member.name;
            option.textContent = member.name;
            select.appendChild(option);
        });
    }

    renderFamilyMembersList() {
        const container = document.getElementById('familyMembersList');

        if (this.familyMembers.length === 0) {
            container.innerHTML = `
                <div class="empty-members">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" stroke-width="2"/>
                        <path d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z" stroke="currentColor" stroke-width="2"/>
                        <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="currentColor" stroke-width="2"/>
                        <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <p>No family members added yet</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.familyMembers.map(member => `
            <div class="member-card" data-member-id="${member.id}">
                <div class="member-info">
                    <div class="member-icon">${member.name.charAt(0).toUpperCase()}</div>
                    <span class="member-name">${this.escapeHtml(member.name)}</span>
                </div>
                <div class="member-actions">
                    <button class="icon-btn delete" onclick="loanManager.deleteFamilyMember(${member.id})" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 6H5H21" stroke="currentColor" stroke-width="2"/>
                            <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');
    }

    async addFamilyMember() {
        const input = document.getElementById('newMemberName');
        const name = input.value.trim();

        if (!name) {
            this.showNotification('Please enter a family member name', 'error');
            return;
        }

        try {
            const response = await fetch('/api/family-members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });

            if (response.ok) {
                const newMember = await response.json();
                this.familyMembers.push(newMember);
                this.familyMembers.sort((a, b) => a.name.localeCompare(b.name));
                this.updateBorrowedByDropdown();
                this.updatePersonFilter();
                this.renderFamilyMembersList();
                input.value = '';
                this.showNotification('Family member added successfully!', 'success');
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Error adding family member', 'error');
            }
        } catch (error) {
            console.error('Error adding family member:', error);
            this.showNotification('Error adding family member', 'error');
        }
    }

    async deleteFamilyMember(id) {
        const member = this.familyMembers.find(m => m.id === id);
        if (!member) return;

        if (!confirm(`Are you sure you want to delete "${member.name}"?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/family-members/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.familyMembers = this.familyMembers.filter(m => m.id !== id);
                this.updateBorrowedByDropdown();
                this.updatePersonFilter();
                this.renderFamilyMembersList();
                this.showNotification('Family member deleted successfully!', 'success');
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Error deleting family member', 'error');
            }
        } catch (error) {
            console.error('Error deleting family member:', error);
            this.showNotification('Error deleting family member', 'error');
        }
    }


    async loadLoans() {
        try {
            const response = await fetch('/api/loans');
            if (response.ok) {
                this.loans = await response.json();
                this.renderLoans();
                this.updateStats();
            } else if (response.status === 401) {
                window.location.href = '/login.html';
            } else {
                this.showNotification('Error loading loans', 'error');
            }
        } catch (error) {
            console.error('Error loading loans:', error);
            this.showNotification('Error loading loans', 'error');
        }
    }

    async addLoan(loanData) {
        try {
            const response = await fetch('/api/loans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loanData)
            });

            if (response.ok) {
                const newLoan = await response.json();
                this.loans.unshift(newLoan);
                this.updatePersonFilter();
                this.renderLoans();
                this.updateStats();
                this.showNotification('Loan added successfully!', 'success');
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Error adding loan', 'error');
            }
        } catch (error) {
            console.error('Error adding loan:', error);
            this.showNotification('Error adding loan', 'error');
        }
    }

    async updateLoan(id, loanData) {
        try {
            const response = await fetch(`/api/loans/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loanData)
            });

            if (response.ok) {
                const updatedLoan = await response.json();
                const index = this.loans.findIndex(loan => loan.id == id);
                if (index !== -1) {
                    this.loans[index] = updatedLoan;
                }
                this.updatePersonFilter();
                this.renderLoans();
                this.updateStats();
                this.showNotification('Loan updated successfully!', 'success');
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Error updating loan', 'error');
            }
        } catch (error) {
            console.error('Error updating loan:', error);
            this.showNotification('Error updating loan', 'error');
        }
    }

    async deleteLoan(id) {
        if (!confirm('Are you sure you want to delete this loan?')) {
            return;
        }

        try {
            const response = await fetch(`/api/loans/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.loans = this.loans.filter(loan => loan.id != id);
                this.updatePersonFilter();
                this.renderLoans();
                this.updateStats();
                this.showNotification('Loan deleted successfully!', 'success');
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Error deleting loan', 'error');
            }
        } catch (error) {
            console.error('Error deleting loan:', error);
            this.showNotification('Error deleting loan', 'error');
        }
    }

    updatePersonFilter() {
        const personSelect = document.getElementById('personFilter');
        const uniquePersons = [...new Set(this.loans.map(loan => loan.borrowed_by))].sort();

        personSelect.innerHTML = '<option value="all">All Family Members</option>';

        uniquePersons.forEach(person => {
            const option = document.createElement('option');
            option.value = person;
            option.textContent = person;
            personSelect.appendChild(option);
        });
    }

    calculateCurrentAmount(loan) {
        const principal = parseFloat(loan.amount);
        const rate = parseFloat(loan.interest_rate) || 0;

        if (rate === 0) {
            return principal;
        }

        const loanDate = new Date(loan.date);
        const today = new Date();
        const daysDiff = Math.floor((today - loanDate) / (1000 * 60 * 60 * 24));
        const yearsDiff = daysDiff / 365.25;

        const currentAmount = principal * (1 + (rate / 100) * yearsDiff);

        return currentAmount;
    }

    renderLoans() {
        const loansGrid = document.getElementById('loansGrid');
        const emptyState = document.getElementById('emptyState');
        const heading = document.getElementById('loansHeading');

        let filteredLoans = this.loans;

        if (this.currentFilter !== 'all') {
            filteredLoans = filteredLoans.filter(loan => loan.loan_source === this.currentFilter);
        }

        if (this.currentPersonFilter !== 'all') {
            filteredLoans = filteredLoans.filter(loan => loan.borrowed_by === this.currentPersonFilter);
        }

        let headingText = 'All Loans';
        if (this.currentFilter === 'bank' && this.currentPersonFilter === 'all') {
            headingText = 'Bank Loans';
        } else if (this.currentFilter === 'shg' && this.currentPersonFilter === 'all') {
            headingText = 'Self-Help Group Loans';
        } else if (this.currentPersonFilter !== 'all' && this.currentFilter === 'all') {
            headingText = `${this.currentPersonFilter}'s Loans`;
        } else if (this.currentPersonFilter !== 'all' && this.currentFilter === 'bank') {
            headingText = `${this.currentPersonFilter}'s Bank Loans`;
        } else if (this.currentPersonFilter !== 'all' && this.currentFilter === 'shg') {
            headingText = `${this.currentPersonFilter}'s Self-Help Group Loans`;
        }
        heading.textContent = headingText;

        if (filteredLoans.length === 0) {
            loansGrid.style.display = 'none';
            emptyState.classList.add('visible');
        } else {
            loansGrid.style.display = 'grid';
            emptyState.classList.remove('visible');

            loansGrid.innerHTML = filteredLoans.map((loan, index) => this.createLoanCard(loan, index)).join('');
        }
    }

    createLoanCard(loan, index) {
        const formattedDate = new Date(loan.date).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });

        const originalAmount = parseFloat(loan.amount);
        const currentAmount = this.calculateCurrentAmount(loan);
        const hasInterest = loan.interest_rate && loan.interest_rate > 0;

        const formattedOriginalAmount = this.formatCurrency(originalAmount);
        const formattedCurrentAmount = this.formatCurrency(currentAmount);

        const sourceLabel = loan.loan_source === 'bank' ? 'Bank' : 'Self-Help Group';
        const sourceClass = loan.loan_source === 'bank' ? 'bank' : 'shg';

        return `
            <div class="loan-card ${sourceClass}" style="animation-delay: ${index * 0.05}s">
                <div class="loan-header">
                    <div class="loan-person">
                        <h3>${this.escapeHtml(loan.lender_name)}</h3>
                        <span class="loan-type-badge ${sourceClass}">
                            ${sourceLabel}
                        </span>
                    </div>
                    <div class="loan-actions">
                        <button class="icon-btn edit" onclick="loanManager.editLoan(${loan.id})" title="Edit">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="icon-btn delete" onclick="loanManager.deleteLoan(${loan.id})" title="Delete">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 6H5H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="loan-borrower">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Borrowed by: <strong>${this.escapeHtml(loan.borrowed_by)}</strong>
                </div>
                <div class="loan-amount-section">
                    <div class="loan-amount-label">Original Amount</div>
                    <div class="loan-amount">${formattedOriginalAmount}</div>
                </div>
                ${hasInterest ? `
                    <div class="loan-current-amount">
                        <div class="current-amount-label">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 8V12L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                            </svg>
                            Current Amount (with ${loan.interest_rate}% interest)
                        </div>
                        <div class="current-amount-value">${formattedCurrentAmount}</div>
                        <div class="interest-earned">+${this.formatCurrency(currentAmount - originalAmount)} interest</div>
                    </div>
                ` : ''}
                <div class="loan-date">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Loan Date: ${formattedDate}
                </div>
                ${loan.notes ? `<div class="loan-notes">${this.escapeHtml(loan.notes)}</div>` : ''}
            </div>
        `;
    }

    updateStats() {
        const totalLoans = this.loans.length;
        const totalBorrowed = this.loans.reduce((sum, loan) => sum + parseFloat(loan.amount), 0);
        const fromBanks = this.loans
            .filter(loan => loan.loan_source === 'bank')
            .reduce((sum, loan) => sum + parseFloat(loan.amount), 0);
        const fromSHG = this.loans
            .filter(loan => loan.loan_source === 'shg')
            .reduce((sum, loan) => sum + parseFloat(loan.amount), 0);

        document.getElementById('totalLoans').textContent = totalLoans;
        document.getElementById('totalBorrowed').textContent = this.formatCurrency(totalBorrowed);
        document.getElementById('fromBanks').textContent = this.formatCurrency(fromBanks);
        document.getElementById('fromSHG').textContent = this.formatCurrency(fromSHG);
    }

    openModal(mode = 'add', loanId = null) {
        const modal = document.getElementById('loanModal');
        const modalTitle = document.getElementById('modalTitle');
        const form = document.getElementById('loanForm');

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        if (mode === 'edit' && loanId) {
            this.editingLoanId = loanId;
            const loan = this.loans.find(l => l.id == loanId);
            if (loan) {
                modalTitle.textContent = 'Edit Loan';
                document.getElementById('borrowedBy').value = loan.borrowed_by;
                document.getElementById('lenderName').value = loan.lender_name;
                document.querySelector(`input[name="loanSource"][value="${loan.loan_source}"]`).checked = true;
                document.getElementById('amount').value = loan.amount;
                document.getElementById('date').value = loan.date;
                document.getElementById('interestRate').value = loan.interest_rate || '';
                document.getElementById('notes').value = loan.notes || '';
            }
        } else {
            this.editingLoanId = null;
            modalTitle.textContent = 'Add New Loan';
            form.reset();
            this.setTodayDate();
        }
    }

    closeModal() {
        const modal = document.getElementById('loanModal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
        this.editingLoanId = null;
    }

    openSettingsModal() {
        const modal = document.getElementById('settingsModal');
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        this.renderFamilyMembersList();
    }

    closeSettingsModal() {
        const modal = document.getElementById('settingsModal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    editLoan(id) {
        this.openModal('edit', id);
    }

    setupEventListeners() {
        document.getElementById('addLoanBtn').addEventListener('click', () => {
            this.openModal('add');
        });

        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.openSettingsModal();
        });

        document.getElementById('logoutBtn').addEventListener('click', async () => {
            try {
                const response = await fetch('/api/logout', { method: 'POST' });
                if (response.ok) {
                    window.location.href = '/login.html';
                }
            } catch (error) {
                console.error('Logout error:', error);
            }
        });

        document.getElementById('modalClose').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('modalOverlay').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('settingsClose').addEventListener('click', () => {
            this.closeSettingsModal();
        });

        document.getElementById('settingsOverlay').addEventListener('click', () => {
            this.closeSettingsModal();
        });

        document.getElementById('addMemberBtn').addEventListener('click', () => {
            this.addFamilyMember();
        });

        document.getElementById('newMemberName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addFamilyMember();
            }
        });

        document.getElementById('loanForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit(e);
        });

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.renderLoans();
            });
        });

        document.getElementById('personFilter').addEventListener('change', (e) => {
            this.currentPersonFilter = e.target.value;
            this.renderLoans();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                this.closeSettingsModal();
            }
        });
    }

    async handleFormSubmit(e) {
        const formData = new FormData(e.target);
        const loanData = {
            borrowedBy: formData.get('borrowedBy'),
            lenderName: formData.get('lenderName').trim(),
            loanSource: formData.get('loanSource'),
            amount: parseFloat(formData.get('amount')),
            date: formData.get('date'),
            interestRate: formData.get('interestRate') ? parseFloat(formData.get('interestRate')) : null,
            notes: formData.get('notes').trim()
        };

        if (!loanData.borrowedBy) {
            this.showNotification('Please select who borrowed the loan', 'error');
            return;
        }

        if (this.editingLoanId) {
            await this.updateLoan(this.editingLoanId, loanData);
        } else {
            await this.addLoan(loanData);
        }

        this.closeModal();
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setTodayDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('date').value = today;
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'};
            color: white;
            border-radius: var(--radius-md);
            box-shadow: var(--shadow-lg);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
            font-weight: 600;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}


const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }

    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100px);
        }
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    .loan-borrower {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--color-text-secondary);
        font-size: 0.875rem;
        margin-bottom: var(--spacing-md);
        padding: 0.5rem;
        background: var(--color-bg-tertiary);
        border-radius: var(--radius-sm);
    }

    .loan-borrower svg {
        width: 16px;
        height: 16px;
        color: var(--color-primary);
    }

    .loan-borrower strong {
        color: var(--color-text-primary);
    }

    .loan-amount-section {
        margin-bottom: var(--spacing-sm);
    }

    .loan-amount-label {
        font-size: 0.75rem;
        color: var(--color-text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 0.25rem;
    }

    .loan-amount {
        font-size: 2rem;
        font-weight: 800;
        background: linear-gradient(135deg, var(--color-text-primary), var(--color-text-secondary));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    .loan-current-amount {
        background: linear-gradient(135deg, 
            hsla(var(--loan-color-h, 142), var(--loan-color-s, 76%), var(--loan-color-l, 36%), 0.1),
            hsla(var(--loan-color-h, 142), var(--loan-color-s, 76%), var(--loan-color-l, 36%), 0.05));
        border: 1px solid hsla(var(--loan-color-h, 142), var(--loan-color-s, 76%), var(--loan-color-l, 36%), 0.3);
        border-radius: var(--radius-md);
        padding: var(--spacing-sm);
        margin-bottom: var(--spacing-sm);
    }

    .loan-card.bank .loan-current-amount {
        --loan-color-h: 142;
        --loan-color-s: 76%;
        --loan-color-l: 36%;
    }

    .loan-card.shg .loan-current-amount {
        --loan-color-h: 38;
        --loan-color-s: 92%;
        --loan-color-l: 50%;
    }

    .current-amount-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.75rem;
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 0.5rem;
    }

    .current-amount-label svg {
        width: 14px;
        height: 14px;
    }

    .current-amount-value {
        font-size: 1.5rem;
        font-weight: 800;
        color: var(--color-success-light);
        margin-bottom: 0.25rem;
    }

    .interest-earned {
        font-size: 0.75rem;
        color: var(--color-success-light);
        font-weight: 600;
    }
`;
document.head.appendChild(style);


let loanManager;

document.addEventListener('DOMContentLoaded', () => {
    loanManager = new LoanManager();
});
