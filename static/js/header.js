// static/js/header.js
document.addEventListener('DOMContentLoaded', () => {
    // User Dropdown Menu
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');

    if (userMenuBtn && userDropdown) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenuBtn.classList.toggle('active');
            userDropdown.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
                userMenuBtn.classList.remove('active');
                userDropdown.classList.remove('active');
            }
        });
    }

    // Mobile Navigation
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileNavPanel = document.getElementById('mobileNavPanel');
    const mobileNavOverlay = document.getElementById('mobileNavOverlay');

    if (mobileMenuBtn && mobileNavPanel && mobileNavOverlay) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileNavPanel.classList.toggle('active');
            mobileNavOverlay.classList.toggle('active');
            document.body.style.overflow = mobileNavPanel.classList.contains('active') ? 'hidden' : '';
        });

        mobileNavOverlay.addEventListener('click', () => {
            mobileNavPanel.classList.remove('active');
            mobileNavOverlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
});
