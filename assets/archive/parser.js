window.ReportParser = (() => {
  const digitMap = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9' };
  const normalize = value => String(value || '').replace(/[٠-٩۰-۹]/g, d => digitMap[d] || d).replace(/\r/g, '').trim();
  const number = value => {
    const n = Number(normalize(value).replace(/[^0-9.,-]/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };
  const first = (text, patterns) => {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return String(match[1] || '').trim();
    }
    return '';
  };

  function inputDate(text) {
    const match = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (!match) return new Date().toISOString().slice(0, 10);
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }

  function displayDate(date) {
    const parts = String(date || '').split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : date;
  }

  function parseTime(line) {
    const value = normalize(line);
    const match = value.match(/(\d{1,2})\s*[:：]\s*(\d{1,2})/);
    if (!match) return '';
    let hour = Number(match[1]);
    const minute = String(match[2]).padStart(2, '0');
    if (/مساء|pm/i.test(value) && hour < 12) hour += 12;
    if (/صباح|am/i.test(value) && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${minute}`;
  }

  function duration(start, end) {
    if (!start || !end) return '';
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let s = sh * 60 + sm;
    let e = eh * 60 + em;
    if (e < s) e += 1440;
    const diff = e - s;
    return `${Math.floor(diff / 60)}:${String(diff % 60).padStart(2, '0')}`;
  }

  function cleanName(line) {
    return String(line || '').replace(/^[\s▪▫◾◼︎\-*\.]+/g, '').replace(/\s+/g, ' ').trim();
  }

  function extractQuantity(line) {
    return number(first(line, [/(?:الكمية\s*\/?|كمية\s*\/?)\s*([0-9.,]+)/i]));
  }

  function extractCars(line) {
    return number(first(line, [/(?:عدد\s+السيارات|السيارات)\s*\/?\s*[:：]?\s*([0-9.,]+)/i]));
  }

  function beneficiaries(text) {
    const start = text.search(/الإنتاج اليومي|الانتاج اليومي|جهات|التعبئة/i);
    const section = start >= 0 ? text.slice(start) : text;
    const lines = section.split('\n').map(x => x.trim()).filter(Boolean);
    const items = [];
    let name = '';

    for (const line of lines) {
      if (/إجمالي|اجمالي|تقرير|ساعة|ساعات|وقود|فحوصات|كميات/.test(line)) continue;

      const hasQty = /(?:الكمية\s*\/?|كمية\s*\/?)\s*[0-9.,]+/i.test(line);
      if (hasQty) {
        const inlineName = cleanName(line.replace(/(?:الكمية\s*\/?|كمية\s*\/?).*$/i, ''));
        const finalName = name || inlineName;
        if (finalName) {
          items.push({ name: finalName, quantity: extractQuantity(line), cars: extractCars(line) });
          name = '';
        }
        continue;
      }

      const external = line.match(/(?:مياه خارجية|صنابير|خارج المحطة).*?([0-9.,]+)\s*كوب/i);
      if (external) {
        items.push({ name: 'مياه خارجية / صنابير للمواطنين خارج المحطة', quantity: number(external[1]), cars: 0 });
        name = '';
        continue;
      }

      const isArabicName = /[\u0600-\u06FF]/.test(line) && !/:/.test(line) && !/PH|TDS|الكلور|الحامضيه/i.test(line);
      if (isArabicName) name = cleanName(line);
    }
    return items.filter(item => item.name && item.quantity >= 0);
  }

  function parse(raw) {
    const text = normalize(raw);
    if (!text) throw new Error('الصق نص التقرير أولًا.');

    const lines = text.split('\n').map(x => x.trim()).filter(Boolean);
    const date = inputDate(text);
    const startLine = lines.find(x => /تشغيل المولد|ساعة تشغيل/i.test(x)) || '';
    const endLine = lines.find(x => /الإيقاف|الايقاف|إيقاف|ايقاف/i.test(x)) || '';
    const start = parseTime(startLine);
    const end = parseTime(endLine);
    const manualDuration = first(text, [/ساعات التشغيل\s*[:：]?\s*([0-9]{1,2}\s*[:：]\s*[0-9]{1,2})/i]);
    const runHours = manualDuration.replace(/\s/g, '').replace('：', ':') || duration(start, end);
    const list = beneficiaries(text);
    const totalQuantity = list.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalCars = list.reduce((sum, item) => sum + Number(item.cars || 0), 0);
    const statedQuantity = number(first(text, [/إجمالي كمية المياه المعبأة\s*[:：]?\s*([0-9.,]+)/, /اجمالي كمية المياه المعبأة\s*[:：]?\s*([0-9.,]+)/]));
    const statedCars = number(first(text, [/إجمالي عدد السيارات\s*[:：]?\s*([0-9.,]+)/, /اجمالي عدد السيارات\s*[:：]?\s*([0-9.,]+)/]));
    const warnings = [];

    if (statedQuantity && statedQuantity !== totalQuantity) warnings.push(`إجمالي المياه المكتوب ${statedQuantity} كوب، بينما المحسوب ${totalQuantity} كوب.`);
    if (statedCars && statedCars !== totalCars) warnings.push(`إجمالي السيارات المكتوب ${statedCars} سيارة، بينما المحسوب ${totalCars} سيارة.`);
    if (!start) warnings.push('لم يتم التعرف على وقت تشغيل المولد.');
    if (!end) warnings.push('لم يتم التعرف على وقت الإيقاف.');
    if (!list.length) warnings.push('لم يتم التعرف على الجهات المستفيدة.');

    return {
      date,
      title: `تقرير تشغيل وضخ المياه ${displayDate(date)}`,
      generatorStart: start,
      generatorEnd: end,
      runHours,
      fuelAdded: number(first(text, [/الوقود\s+المضاف\s+يومياً[^0-9\n]*([0-9.,]+)/, /المضاف\s+يومياً[^0-9\n]*([0-9.,]+)/])),
      fuelConsumed: number(first(text, [/الوقود\s+المستهلك\s+يومياً\s*([0-9.,]+)/, /المستهلك\s+يومياً\s*([0-9.,]+)/])),
      fuelMunicipal: number(first(text, [/المورد\s+من\s+البلدية[^0-9\n]*([0-9.,]+)/])),
      fuelBalance: number(first(text, [/المتبقي[^0-9\n]*([0-9.,]+)/])),
      submersibleRate: number(first(text, [/(?:انتاج|إنتاج)\s+الغاطس\s*[:：]?\s*([0-9.,]+)/])),
      filteredRate: number(first(text, [/بعد\s+الفلترة\s*[:：]?\s*([0-9.,]+)/])),
      wasteQuantity: number(first(text, [/العادم\s*[:：]?\s*([0-9.,]+)/])),
      phFiltered: number(first(text, [/بعد\s+التحلية[^\n]*?Ph\s*[:：]?\s*([0-9.,]+)/i, /بعد\s+التحلية[^\n]*?([0-9.,]+)\s*$/im])),
      phWell: number(first(text, [/لمياه\s+الغاطس[^\n]*?Ph\s*[:：]?\s*([0-9.,]+)/i, /مياه\s+الغاطس[^\n]*?Ph\s*[:：]?\s*([0-9.,]+)/i])),
      tdsFiltered: number(first(text, [/مياه\s+محلاه\)?\s*([0-9.,]+)\s*[:：]?\s*TDS/i])),
      tdsWell: number(first(text, [/بئر\s+مياه\)?\s*([0-9.,]+)\s*[:：]?\s*TDS/i])),
      tdsWaste: number(first(text, [/عادم\)?\s*([0-9.,]+)\s*[:：]?\s*TDS/i])),
      chlorine: number(first(text, [/الكلور\s+الحر\s*[:：]?\s*([0-9.,]+)/])),
      beneficiaries: list,
      totalQuantity,
      totalCars,
      statedQuantity,
      statedCars,
      warnings,
      sourceText: text,
      createdAt: new Date().toISOString()
    };
  }

  return { parse, displayDate };
})();
