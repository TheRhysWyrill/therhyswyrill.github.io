document.addEventListener('DOMContentLoaded', () => {

    // Mobile only
    if (window.matchMedia('(min-width: 769px)').matches) {
        return;
    }

    // Prevent duplicates
    if (document.getElementById('back-to-top')) {
        return;
    }

    const button = document.createElement('button');

    button.id = 'back-to-top';
    button.type = 'button';
    button.innerHTML = '<i class="fas fa-chevron-up"></i>';
    button.title = 'Back to top';
    button.setAttribute('aria-label', 'Back to top');

    document.body.appendChild(button);

    const toggleButton = () => {
        button.classList.toggle('visible', window.scrollY > 300);
    };

    window.addEventListener('scroll', toggleButton, { passive: true });

    button.addEventListener('click', () => {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        window.scrollTo({
            top: 0,
            behavior: prefersReducedMotion ? 'auto' : 'smooth'
        });
    });

    toggleButton();
});