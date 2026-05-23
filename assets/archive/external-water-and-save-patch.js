(() => {
  function isExternalWaterName(value) {
    const text = String(value || '').trim();
    return text.includes('مياه خارجية') || text.includes('صنابير للمواطنين') || text.includes('خارج المحطة');
  }

  function patchExternalWaterRows() {
    document.querySelectorAll('#beneficiariesRows tr').forEach(row => {
      const nameInput = row.querySelector('[data-b="name"]');
      const carsInput = row.querySelector('[data-b="cars"]');
      if (!nameInput || !carsInput) return;

      const carsCell = carsInput.closest('td');
      if (isExternalWaterName(nameInput.value)) {
        carsInput.value = '';
        carsInput.readOnly = true;
        carsInput.dataset.externalWater = 'true';
        carsInput.classList.add('external-water-cars-input');
        row.classList.add('external-water-row');
        if (carsCell && !carsCell.querySelector('.external-water-note')) {
          carsCell.insertAdjacentHTML('beforeend', '<span class="external-water-note">لا يوجد سيارات</span>');
        }
      } else {
        carsInput.readOnly = false;
        delete carsInput.dataset.externalWater;
        carsInput.classList.remove('external-water-cars-input');
        row.classList.remove('external-water-row');
        carsCell?.querySelector('.external-water-note')?.remove();
      }
    });
  }

  function observeBeneficiaryRows() {
    patchExternalWaterRows();
    document.body.addEventListener('input', event => {
      if (event.target?.matches?.('[data-b="name"]')) patchExternalWaterRows();
    });
    document.body.addEventListener('change', event => {
      if (event.target?.matches?.('[data-b="name"]')) patchExternalWaterRows();
    });

    const observer = new MutationObserver(() => patchExternalWaterRows());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.ExternalWaterPatch = { patch: patchExternalWaterRows };
  window.addEventListener('DOMContentLoaded', observeBeneficiaryRows);
})();
