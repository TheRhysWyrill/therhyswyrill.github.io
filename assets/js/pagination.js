/*
 * Shared pagination renderer for the reviews archive and the video vault.
 * Draws chevrons, a sliding page-number window and ellipses into a container.
 *
 * Usage:
 *   window.setupPaginationNav({
 *     container:    element that receives the pagination buttons,
 *     totalPages:   total number of pages,
 *     currentPage:  the active page (1-based),
 *     activeColor:  CSS color highlighting the active page button
 *                   (applied as the --pg-active custom property),
 *     onPageChange: callback invoked with the new page number
 *   });
 *
 * All styling lives in _sass/base/_site-styles.scss (.pagination-nav,
 * .pagination-btn, .pagination-ellipsis), so this module stays free of
 * page-specific logic and inline styles.
 */
(function () {
    'use strict';

    function createNavButton(config, text, targetPage, isDisabled) {
        const btn = document.createElement("button");
        btn.className = "pagination-btn";

        const isActive = targetPage === config.currentPage && !isDisabled;
        if (isActive) {
            btn.classList.add("is-active");
        }
        if (isDisabled) {
            btn.classList.add("is-disabled");
        } else if (targetPage !== config.currentPage) {
            btn.addEventListener("click", () => config.onPageChange(targetPage));
        }

        btn.innerText = text;
        return btn;
    }

    // Sliding window of page numbers: 1 ... (c-1) c (c+1) ... N,
    // clamped near the edges so the window never collapses.
    function pageNumbers(totalPages, currentPage) {
        let startWindow = Math.max(2, currentPage - 1);
        let endWindow = Math.min(totalPages - 1, currentPage + 1);

        if (currentPage <= 2) {
            endWindow = Math.min(totalPages - 1, 3);
        }
        if (currentPage >= totalPages - 1) {
            startWindow = Math.max(2, totalPages - 2);
        }

        const pages = [1];
        for (let i = startWindow; i <= endWindow; i++) {
            if (i > 1 && i < totalPages) {
                pages.push(i);
            }
        }
        if (totalPages > 1) {
            pages.push(totalPages);
        }
        return [...new Set(pages)].sort((a, b) => a - b);
    }

    window.setupPaginationNav = function (options) {
        const container = options.container;
        if (!container) return;

        container.innerHTML = "";
        container.classList.add("pagination-nav");
        container.style.setProperty("--pg-active", options.activeColor || "#252e36");

        if (!options.totalPages || options.totalPages <= 1) {
            // !important so the inline toggle wins over the container's
            // stylesheet rule, which also declares display: flex.
            container.style.setProperty("display", "none", "important");
            return;
        }

        container.style.setProperty("display", "flex", "important");

        const config = {
            currentPage: options.currentPage,
            onPageChange: options.onPageChange || function () {}
        };

        // 1. Chevron left
        container.appendChild(createNavButton(config, "«", options.currentPage - 1, options.currentPage === 1));

        // 2. Page numbers and structural ellipses
        let lastPageNum = 0;
        pageNumbers(options.totalPages, options.currentPage).forEach(pageNum => {
            if (lastPageNum > 0 && pageNum - lastPageNum > 1) {
                const ellipsis = document.createElement("span");
                ellipsis.className = "pagination-ellipsis";
                ellipsis.innerText = "...";
                container.appendChild(ellipsis);
            }

            container.appendChild(createNavButton(config, pageNum, pageNum, false));
            lastPageNum = pageNum;
        });

        // 3. Chevron right
        container.appendChild(createNavButton(config, "»", options.currentPage + 1, options.currentPage === options.totalPages));
    };
})();
