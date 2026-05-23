(() => {
  function patchReportFormTimeInputs() {
    if (!window.AppUI || window.AppUI.__timeExportPatched) return;

    const originalReportForm = window.AppUI.reportForm;
    window.AppUI.reportForm = function patchedReportForm(...args) {
      return originalReportForm(...args)
        .replace('name="reportDate" type="date"', 'name="reportDate" type="text" inputmode="numeric" class="date-field" placeholder="03/05/2026"')
        .replace('تاريخ التقرير<input', 'تاريخ التقرير <small class="time-hint">مثال: 03/05/2026</small><input')
        .replace('name="generatorStart" type="time"', 'name="generatorStart" type="text" inputmode="numeric" class="time-field js-time-picker" readonly placeholder="06:25 ص" onclick="TimeDatePicker.openTime(this)"')
        .replace('name="generatorEnd" type="time"', 'name="generatorEnd" type="text" inputmode="numeric" class="time-field js-time-picker" readonly placeholder="03:25 م" onclick="TimeDatePicker.openTime(this)"')
        .replace('وقت التشغيل<input', 'وقت التشغيل <small class="time-hint">اضغط لاختيار الساعة صباحًا/مساءً</small><input')
        .replace('وقت الإيقاف<input', 'وقت الإيقاف <small class="time-hint">اضغط لاختيار الساعة صباحًا/مساءً</small><input');
    };

    window.AppUI.__timeExportPatched = true;
  }

  function parseDisplayTime(value) {
    const display = window.ReportUtils?.displayTimeArabic?.(value) || value || '';
    const match = String(display).match(/(\d{1,2}):(\d{2})\s*([صم])?/);
    return {
      hour: match ? String(Number(match[1])).padStart(2, '0') : '06',
      minute: match ? match[2] : '00',
      period: match?.[3] || 'ص'
    };
  }

  function openTime(input) {
    const current = parseDisplayTime(input.value);
    const modal = document.createElement('div');
    modal.id = 'timePickerModal';
    modal.className = 'modal open time-picker-modal';
    modal.innerHTML = `<div class="modal-backdrop" onclick="TimeDatePicker.close()"></div><div class="modal-panel time-picker-panel"><button class="close" onclick="TimeDatePicker.close()">×</button><div class="modal-title"><span>🕒</span><div><h2>اختيار الوقت</h2><p>اختر الساعة والدقائق ثم صباحًا أو مساءً.</p></div></div><div class="time-picker-grid"><label>الساعة<select id="tpHour">${Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => `<option value="${h}" ${h === current.hour ? 'selected' : ''}>${h}</option>`).join('')}</select></label><label>الدقيقة<select id="tpMinute">${Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => `<option value="${m}" ${m === current.minute ? 'selected' : ''}>${m}</option>`).join('')}</select></label><label>الفترة<select id="tpPeriod"><option value="ص" ${current.period === 'ص' ? 'selected' : ''}>صباحًا</option><option value="م" ${current.period === 'م' ? 'selected' : ''}>مساءً</option></select></label></div><div class="quick-time-buttons"><button type="button" onclick="TimeDatePicker.setQuick('06:00 ص')">06:00 ص</button><button type="button" onclick="TimeDatePicker.setQuick('06:30 ص')">06:30 ص</button><button type="button" onclick="TimeDatePicker.setQuick('03:00 م')">03:00 م</button><button type="button" onclick="TimeDatePicker.setQuick('03:30 م')">03:30 م</button><button type="button" onclick="TimeDatePicker.setQuick('04:00 م')">04:00 م</button></div><div class="actions modal-actions"><button class="btn primary big" onclick="TimeDatePicker.apply()">اعتماد الوقت</button><button class="btn" onclick="TimeDatePicker.close()">إلغاء</button></div></div>`;
    document.body.appendChild(modal);
    window.TimeDatePicker.currentInput = input;
  }

  function close() {
    document.getElementById('timePickerModal')?.remove();
    window.TimeDatePicker.currentInput = null;
  }

  function setQuick(value) {
    const parsed = parseDisplayTime(value);
    document.getElementById('tpHour').value = parsed.hour;
    document.getElementById('tpMinute').value = parsed.minute;
    document.getElementById('tpPeriod').value = parsed.period;
  }

  function apply() {
    const input = window.TimeDatePicker.currentInput;
    if (!input) return close();
    const hour = document.getElementById('tpHour').value;
    const minute = document.getElementById('tpMinute').value;
    const period = document.getElementById('tpPeriod').value;
    input.value = `${hour}:${minute} ${period}`;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    close();
  }

  window.TimeDatePicker = { openTime, close, setQuick, apply, currentInput: null };
  patchReportFormTimeInputs();
})();
