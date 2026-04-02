function syncSidebarCssVars() {
  const sidebarOffset = (!mobileViewport && sidebarOpen) ? '404px' : '0px';
  document.documentElement.style.setProperty('--sidebar-offset', sidebarOffset);
  syncFlowWordRendererPlacement();
}

function setSidebarOpen(nextOpen) {
  sidebarOpen = Boolean(nextOpen);
  document.body.classList.toggle('sidebar-open', sidebarOpen && mobileViewport);
  document.body.classList.toggle('sidebar-collapsed', !sidebarOpen && !mobileViewport);
  document.getElementById('sidebarToggleBtn').setAttribute('aria-expanded', String(sidebarOpen));
  document.getElementById('sidebarToggleBtn').setAttribute('aria-label', sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar');
  if (!sidebarOpen) setNavigationMenuOpen(false);
  syncSidebarCssVars();
}

function syncSidebarForViewport() {
  const nextMobile = window.innerWidth <= MOBILE_BREAKPOINT;
  if (nextMobile !== mobileViewport) {
    mobileViewport = nextMobile;
    if (mobileViewport) {
      setSidebarOpen(false);
    } else if (!sidebarOpen) {
      setSidebarOpen(true);
    } else {
      syncSidebarCssVars();
    }
  } else {
    syncSidebarCssVars();
  }
}

function initSidebarSectionToggles() {
  const sections = document.querySelectorAll('#sidebarPanel .sidebar-scroll > .sec');

  const setSectionCollapsed = (section, toggleBtn, collapsed) => {
    section.classList.toggle('is-collapsed', collapsed);
    toggleBtn.setAttribute('aria-expanded', String(!collapsed));
  };

  sections.forEach((section, index) => {
    const label = section.querySelector(':scope > .sec-label');
    if (!label) return;
    const sectionId = section.id || `sidebarSection${index + 1}`;
    section.id = sectionId;

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'sec-toggle';
    const startsCollapsed = section.classList.contains('is-collapsed');
    toggleBtn.setAttribute('aria-expanded', String(!startsCollapsed));
    const contentId = `${sectionId}Content`;
    toggleBtn.setAttribute('aria-controls', contentId);

    label.parentNode.insertBefore(toggleBtn, label);
    toggleBtn.appendChild(label);

    const contentWrap = document.createElement('div');
    contentWrap.className = 'sec-content';
    contentWrap.id = contentId;

    const contentInner = document.createElement('div');
    contentInner.className = 'sec-inner';
    while (toggleBtn.nextSibling) {
      contentInner.appendChild(toggleBtn.nextSibling);
    }
    contentWrap.appendChild(contentInner);
    section.appendChild(contentWrap);

    toggleBtn.addEventListener('click', () => {
      const shouldExpand = section.classList.contains('is-collapsed');
      if (shouldExpand) {
        sections.forEach((otherSection) => {
          if (otherSection === section) return;
          const otherToggle = otherSection.querySelector(':scope > .sec-toggle');
          if (!otherToggle) return;
          setSectionCollapsed(otherSection, otherToggle, true);
        });
      }
      setSectionCollapsed(section, toggleBtn, !shouldExpand);
    });
  });
}

function enhanceEvidenceBadges() {
  document.querySelectorAll('.sci').forEach((badge) => {
    if (badge.dataset.enhanced === 'true') return;
    const label = badge.textContent.trim();
    badge.dataset.enhanced = 'true';
    badge.dataset.evidenceLabel = label;
    badge.setAttribute('aria-label', label);
    badge.innerHTML = '<span class="sci-icon" aria-hidden="true">✦</span><span class="sci-text"></span>';
    const textNode = badge.querySelector('.sci-text');
    if (textNode) textNode.textContent = label;
  });
}

function getTotalPages() {
  if (pdf) return pdf.numPages;
  if (textDoc) return textDoc.numPages;
  return 0;
}
