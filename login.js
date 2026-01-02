// ============================================
// TAB SWITCHING
// ============================================

document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;

        // Update active tab
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update active form
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        document.getElementById(`${tabName}Form`).classList.add('active');

        // Clear alert
        hideAlert();
    });
});

// ============================================
// ALERT FUNCTIONS
// ============================================

function showAlert(message, type = 'error') {
    const alertBox = document.getElementById('alertBox');
    alertBox.textContent = message;
    alertBox.className = `alert alert-${type} show`;
}

function hideAlert() {
    const alertBox = document.getElementById('alertBox');
    alertBox.classList.remove('show');
}

// ============================================
// LOGIN FORM
// ============================================

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const formData = new FormData(e.target);
    const data = {
        familyName: formData.get('familyName').trim(),
        password: formData.get('password')
    };

    if (!data.familyName || !data.password) {
        showAlert('Please fill in all fields', 'error');
        return;
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            showAlert('Login successful! Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 1000);
        } else {
            showAlert(result.error || 'Login failed', 'error');
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
    }
});

// ============================================
// REGISTER FORM
// ============================================

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const formData = new FormData(e.target);
    const data = {
        familyName: formData.get('familyName').trim(),
        password: formData.get('password'),
        confirmPassword: formData.get('confirmPassword')
    };

    // Validation
    if (!data.familyName || !data.password || !data.confirmPassword) {
        showAlert('Please fill in all fields', 'error');
        return;
    }

    if (data.password !== data.confirmPassword) {
        showAlert('Passwords do not match', 'error');
        return;
    }

    if (data.familyName.length < 2) {
        showAlert('Family name must be at least 2 characters', 'error');
        return;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                familyName: data.familyName,
                password: data.password
            })
        });

        const result = await response.json();

        if (response.ok) {
            showAlert('Account created successfully!', 'success');
            // Show family members modal
            setTimeout(() => {
                showFamilyMembersModal();
            }, 500);
        } else {
            showAlert(result.error || 'Registration failed', 'error');
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
    }
});

// ============================================
// FAMILY MEMBERS MODAL
// ============================================

function showFamilyMembersModal() {
    const modal = document.getElementById('familyMembersModal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function hideFamilyMembersModal() {
    const modal = document.getElementById('familyMembersModal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

function addMemberInput() {
    const membersList = document.getElementById('membersList');
    const inputGroup = document.createElement('div');
    inputGroup.className = 'member-input-group';
    inputGroup.innerHTML = `
        <input type="text" class="member-input" placeholder="Enter family member name" />
        <button type="button" class="btn-remove-member" onclick="removeMemberInput(this)">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2"/>
            </svg>
        </button>
    `;
    membersList.appendChild(inputGroup);

    // Show remove buttons if there's more than one input
    updateRemoveButtons();
}

function removeMemberInput(button) {
    const inputGroup = button.parentElement;
    inputGroup.remove();
    updateRemoveButtons();
}

function updateRemoveButtons() {
    const inputGroups = document.querySelectorAll('.member-input-group');
    inputGroups.forEach((group, index) => {
        const removeBtn = group.querySelector('.btn-remove-member');
        if (inputGroups.length > 1) {
            removeBtn.style.display = 'flex';
        } else {
            removeBtn.style.display = 'none';
        }
    });
}

async function saveFamilyMembers() {
    const inputs = document.querySelectorAll('.member-input');
    const members = Array.from(inputs)
        .map(input => input.value.trim())
        .filter(name => name.length > 0);

    if (members.length === 0) {
        alert('Please add at least one family member or click "Skip for Now"');
        return;
    }

    try {
        const response = await fetch('/api/family-members/bulk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ members })
        });

        if (response.ok) {
            hideFamilyMembersModal();
            showAlert('Family members added successfully! Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 1000);
        } else {
            const error = await response.json();
            alert(error.error || 'Error adding family members');
        }
    } catch (error) {
        alert('Network error. Please try again.');
    }
}

function skipFamilyMembers() {
    hideFamilyMembersModal();
    showAlert('Redirecting to dashboard...', 'success');
    setTimeout(() => {
        window.location.href = '/dashboard.html';
    }, 1000);
}

// ============================================
// CHECK IF ALREADY LOGGED IN
// ============================================

async function checkAuth() {
    try {
        const response = await fetch('/api/check-auth');
        const result = await response.json();

        if (result.authenticated) {
            window.location.href = '/dashboard.html';
        }
    } catch (error) {
        console.log('Not authenticated');
    }
}

// Check auth on page load
checkAuth();
